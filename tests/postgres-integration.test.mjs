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
