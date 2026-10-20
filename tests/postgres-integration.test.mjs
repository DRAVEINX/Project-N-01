import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { createPostgresAccountRepository } from "../src/server/postgres-account-repository.js";
import { createPostgresSessionRepository } from "../src/server/postgres-session-repository.js";

const databaseUrl = process.env.DATABASE_URL;

test("real PostgreSQL schema supports account and durable session lifecycle", { skip: !databaseUrl }, async () => {
  // Loaded only in the dedicated integration workflow; ordinary npm test remains dependency-light.
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const accounts = createPostgresAccountRepository({ pool });
  const sessions = createPostgresSessionRepository({ pool });
  const actorId = randomUUID();
  const email = `integration-${actorId}@example.invalid`;
  const token = randomUUID() + randomUUID();
  const digest = createHash("sha256").update(token).digest("hex");
  const createdAt = Date.now();
  const expiresAt = createdAt + 60_000;

  try {
    const actor = await accounts.createAccount({
      id: actorId,
      email,
      passwordHash: "integration-only-reviewed-hash-placeholder",
      role: "client"
    });
    assert.deepEqual(actor, { id: actorId, role: "client", active: true });
    assert.deepEqual(await accounts.loadActor(actorId), actor);

    await sessions.put(digest, { actorId, createdAt, expiresAt });
    const saved = await sessions.get(digest);
    assert.ok(saved);
    assert.equal(saved.actorId, actorId);
    assert.ok(Math.abs(saved.createdAt - createdAt) < 2_000);
    assert.ok(Math.abs(saved.expiresAt - expiresAt) < 2_000);
    assert.equal(await sessions.delete(digest), true);
    assert.equal(await sessions.get(digest), null);
  } finally {
    await sessions.delete(digest).catch(() => {});
    await pool.query("DELETE FROM novalife_accounts WHERE id = $1", [actorId]).catch(() => {});
    await pool.end();
  }
});

import { createNovaLifePostgresAuth } from "../src/server/postgres-auth-runtime.js";

test("composed Argon2id login stack works against real PostgreSQL", { skip: !databaseUrl }, async () => {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const actorId = randomUUID();
  const email = `auth-integration-${actorId}@example.invalid`;
  const auditEvents = [];
  const auth = await createNovaLifePostgresAuth({
    pool,
    audit: async (event) => { auditEvents.push(event); },
    ttlMs: 60_000,
  });

  try {
    const passwordHash = await auth.hashPassword("test-only secure password");
    const actor = await auth.accounts.createAccount({
      id: actorId,
      email,
      passwordHash,
      role: "client",
    });
    assert.deepEqual(actor, { id: actorId, role: "client", active: true });

    const denied = await auth.login({ email, password: "wrong test password" });
    assert.equal(denied.status, 401);
    assert.deepEqual(denied.body, { error: "invalid-credentials" });

    const accepted = await auth.login({ email: email.toUpperCase(), password: "test-only secure password" });
    assert.equal(accepted.status, 200);
    assert.deepEqual(accepted.body.actor, { id: actorId, role: "client" });
    assert.deepEqual(await auth.authenticate(accepted.body.accessToken), {
      actor: { id: actorId, role: "client" },
    });
    assert.equal(auditEvents.filter((event) => event.event === "login" && event.outcome === "allow").length, 1);
    assert.equal(await auth.revoke(accepted.body.accessToken), true);
    assert.equal(await auth.authenticate(accepted.body.accessToken), null);
  } finally {
    await pool.query("DELETE FROM novalife_sessions WHERE actor_id = $1", [actorId]).catch(() => {});
    await pool.query("DELETE FROM novalife_accounts WHERE id = $1", [actorId]).catch(() => {});
    await pool.end();
  }
});


import { createNovaLifeAuthHttpHandler } from "../src/server/novalife-auth-http.js";

test("composed PostgreSQL HTTP boundary supports login, current actor and logout", { skip: !databaseUrl }, async () => {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const actorId = randomUUID();
  const email = `http-integration-${actorId}@example.invalid`;
  const auditEvents = [];
  const handler = await createNovaLifeAuthHttpHandler({
    pool,
    audit: async (event) => { auditEvents.push(event); },
    rateLimit: async () => true,
    ttlMs: 60_000,
  });

  try {
    const { createNovaLifePostgresAuth: createAuth } = await import("../src/server/postgres-auth-runtime.js");
    const auth = await createAuth({
      pool,
      audit: async () => {},
      ttlMs: 60_000,
    });
    const passwordHash = await auth.hashPassword("HTTP integration-only password");
    await auth.accounts.createAccount({
      id: actorId,
      email,
      passwordHash,
      role: "client",
    });

    const login = await handler(new Request("https://novalife.example/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "HTTP integration-only password" }),
    }));
    assert.equal(login.status, 200);
    const loginBody = await login.json();
    assert.deepEqual(loginBody.actor, { id: actorId, role: "client" });
    const authorization = { authorization: `Bearer ${loginBody.accessToken}` };

    const me = await handler(new Request("https://novalife.example/auth/me", { headers: authorization }));
    assert.equal(me.status, 200);
    assert.deepEqual(await me.json(), { actor: { id: actorId, role: "client" } });

    const logout = await handler(new Request("https://novalife.example/auth/logout", {
      method: "POST",
      headers: authorization,
    }));
    assert.equal(logout.status, 200);
    assert.deepEqual(await logout.json(), { loggedOut: true });

    const afterLogout = await handler(new Request("https://novalife.example/auth/me", { headers: authorization }));
    assert.equal(afterLogout.status, 401);
    assert.ok(auditEvents.some((event) => event.event === "login" && event.outcome === "allow"));
  } finally {
    await pool.query("DELETE FROM novalife_sessions WHERE actor_id = $1", [actorId]).catch(() => {});
    await pool.query("DELETE FROM novalife_accounts WHERE id = $1", [actorId]).catch(() => {});
    await pool.end();
  }
});


test("RLS helper migration denies direct execution to public API roles", { skip: !databaseUrl }, async () => {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });

  try {
    const result = await pool.query(`
      SELECT role_name,
             has_function_privilege(role_name, 'public.rls_auto_enable()', 'EXECUTE') AS can_execute
      FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS roles(role_name)
      ORDER BY role_name
    `);
    assert.deepEqual(
      result.rows.map((row) => ({ role: row.role_name, canExecute: row.can_execute })),
      [
        { role: "anon", canExecute: false },
        { role: "authenticated", canExecute: false },
        { role: "service_role", canExecute: false },
      ]
    );

    const helper = await pool.query(`
      SELECT p.prosecdef AS security_definer
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
    `);
    assert.equal(helper.rowCount, 1, "RLS helper must remain installed for the event trigger");
    assert.equal(helper.rows[0].security_definer, true);

    // The event trigger must still invoke the helper after EXECUTE is revoked
    // from API roles, and it must continue protecting newly created public tables.
    await pool.query("CREATE TABLE public.novalife_rls_trigger_probe (id integer)");
    const rls = await pool.query(`
      SELECT c.relrowsecurity AS rls_enabled
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'novalife_rls_trigger_probe'
    `);
    assert.equal(rls.rows[0]?.rls_enabled, true, "automatic RLS trigger must protect new public tables");
  } finally {
    await pool.query("DROP TABLE IF EXISTS public.novalife_rls_trigger_probe").catch(() => {});
    await pool.end();
  }
});

test("mood-report is accepted by the durable care-record schema", { skip: !databaseUrl }, async () => {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const actorId = randomUUID();
  const email = `mood-integration-${actorId}@example.invalid`;
  const recordId = randomUUID();

  try {
    await pool.query(
      `INSERT INTO novalife_accounts (id, email_normalized, password_hash, role, active)
       VALUES ($1, $2, $3, 'client', TRUE)`,
      [actorId, email, "integration-only-password-hash-placeholder"]
    );
    const saved = await pool.query(
      `INSERT INTO novalife_care_records
         (client_id, resource, record_id, data, created_by, updated_by)
       VALUES ($1, 'mood-report', $2, $3::jsonb, $1, $1)
       RETURNING resource`,
      [actorId, recordId, JSON.stringify({ mood: "okay" })]
    );
    assert.equal(saved.rowCount, 1);
    assert.equal(saved.rows[0].resource, "mood-report");
  } finally {
    await pool.query("DELETE FROM novalife_care_records WHERE client_id = $1", [actorId]).catch(() => {});
    await pool.query("DELETE FROM novalife_accounts WHERE id = $1", [actorId]).catch(() => {});
    await pool.end();
  }
});
