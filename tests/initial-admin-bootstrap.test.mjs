import test from "node:test";
import assert from "node:assert/strict";
import { bootstrapNovaLifeDeveloperAdmin } from "../src/server/initial-admin-bootstrap.js";

function fakePool({ existingAdmins = [], failOn = null } = {}) {
  const calls = [];
  const client = {
    released: false,
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (failOn && sql.includes(failOn)) throw new Error("sensitive DB error");
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [], rowCount: 0 };
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [], rowCount: 1 };
      if (sql.includes("WHERE role = 'developer_admin'")) return { rows: existingAdmins.map((id) => ({ id })) };
      if (sql.includes("INSERT INTO novalife_accounts")) return { rows: [], rowCount: 1 };
      if (sql.includes("INSERT INTO novalife_audit_events")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    release() { this.released = true; },
  };
  return { calls, client, async connect() { return client; } };
}

function validInput(overrides = {}) {
  return {
    id: "first-admin",
    email: "Admin@Example.test",
    password: "a private bootstrap password",
    hashPassword: async (password) => {
      assert.equal(password, "a private bootstrap password");
      return "$argon2id$v=19$m=19456,t=2,p=1$bootstrap-test-hash";
    },
    idFactory: () => "audit-bootstrap-1",
    ...overrides,
  };
}

test("requires a trusted private administrative pool", async () => {
  await assert.rejects(
    bootstrapNovaLifeDeveloperAdmin(validInput()),
    /private administrative PostgreSQL pool/
  );
});

test("creates exactly one initial developer-admin and an audit row in one transaction", async () => {
  const pool = fakePool();
  const result = await bootstrapNovaLifeDeveloperAdmin({ pool, ...validInput() });

  assert.deepEqual(result, {
    id: "first-admin",
    email: "admin@example.test",
    role: "developer_admin",
    active: true,
  });
  assert.equal(pool.calls[0].sql, "BEGIN");
  assert.ok(pool.calls.some((call) => call.sql.includes("pg_advisory_xact_lock")));
  const insert = pool.calls.find((call) => call.sql.includes("INSERT INTO novalife_accounts"));
  assert.deepEqual(insert.values.slice(0, 2), ["first-admin", "admin@example.test"]);
  assert.match(insert.values[2], /^\$argon2id\$/);
  assert.equal(pool.calls.filter((call) => call.sql.includes("INSERT INTO novalife_accounts")).length, 1);
  const audit = pool.calls.find((call) => call.sql.includes("INSERT INTO novalife_audit_events"));
  assert.ok(audit);
  assert.equal(audit.values[1], "first-admin");
  assert.equal(audit.values[3], "auth");
  assert.equal(audit.values[4], "initial-developer-admin-bootstrap");
  assert.equal(audit.values[5], "allow");
  assert.equal(audit.values[6], "one-time-private-bootstrap");
  assert.equal(pool.calls.at(-1).sql, "COMMIT");
  assert.equal(pool.client.released, true);
  assert.doesNotMatch(JSON.stringify(pool.calls), /a private bootstrap password/);
});

test("refuses to create another developer-admin after bootstrap has been completed", async () => {
  const pool = fakePool({ existingAdmins: ["existing-admin"] });
  await assert.rejects(
    bootstrapNovaLifeDeveloperAdmin({ pool, ...validInput() }),
    /bootstrap-already-completed/
  );
  assert.equal(pool.calls.some((call) => call.sql.includes("INSERT INTO novalife_accounts")), false);
  assert.equal(pool.calls.some((call) => call.sql.includes("INSERT INTO novalife_audit_events")), false);
  assert.equal(pool.calls.at(-1).sql, "ROLLBACK");
});

test("rejects invalid password hashes before any transaction", async () => {
  const pool = fakePool();
  await assert.rejects(
    bootstrapNovaLifeDeveloperAdmin({
      pool,
      ...validInput({ hashPassword: async () => "not-an-argon2id-hash" }),
    }),
    /Argon2id encoded hash/
  );
  assert.equal(pool.calls.length, 0);
});

test("rolls back the bootstrap if durable audit storage fails", async () => {
  const pool = fakePool({ failOn: "INSERT INTO novalife_audit_events" });
  await assert.rejects(
    bootstrapNovaLifeDeveloperAdmin({ pool, ...validInput() }),
    /initial-admin-bootstrap-failed/
  );
  assert.equal(pool.calls.at(-1).sql, "ROLLBACK");
  assert.equal(pool.client.released, true);
});
