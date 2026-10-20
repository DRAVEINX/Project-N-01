import test from "node:test";
import assert from "node:assert/strict";
import { provisionNovaLifeAccount } from "../src/server/private-account-provisioner.js";

function fakePool({ failOn = null, operatorValid = true } = {}) {
  const calls = [];
  const client = {
    released: false,
    async query(sql, values) {
      calls.push({ sql, values });
      if (failOn && sql.includes(failOn)) throw new Error("sensitive database error");
      if (sql.includes("role = 'developer_admin'")) {
        return { rowCount: operatorValid ? 1 : 0, rows: operatorValid ? [{ id: values[0] }] : [] };
      }
      return { rowCount: 1, rows: [] };
    },
    release() { this.released = true; },
  };
  return { calls, client, async connect() { return client; } };
}

function validInput(overrides = {}) {
  return {
    id: "client-123",
    email: "Client@Example.test",
    password: "a private test password",
    role: "client",
    operatorId: "operator-1",
    hashPassword: async (password) => {
      assert.equal(password, "a private test password");
      return "$argon2id$v=19$m=19456,t=2,p=1$testhash";
    },
    ...overrides,
  };
}

test("requires a private administrative pool", async () => {
  await assert.rejects(provisionNovaLifeAccount(validInput()), /private administrative PostgreSQL pool/);
});

test("creates an account and audit row in one transaction without storing plaintext password", async () => {
  const pool = fakePool();
  const result = await provisionNovaLifeAccount({ pool, ...validInput() });

  assert.deepEqual(result, {
    id: "client-123",
    email: "client@example.test",
    role: "client",
    active: true,
  });
  assert.equal(pool.calls[0].sql, "BEGIN");
  const accountInsert = pool.calls.find((call) => call.sql.includes("INSERT INTO novalife_accounts"));
  assert.ok(accountInsert);
  assert.deepEqual(accountInsert.values.slice(0, 2), ["client-123", "client@example.test"]);
  assert.match(accountInsert.values[2], /^\$argon2id\$/);
  assert.equal(accountInsert.values[3], "client");
  assert.doesNotMatch(JSON.stringify(pool.calls), /a private test password/);

  const auditInsert = pool.calls.find((call) => call.sql.includes("INSERT INTO novalife_audit_events"));
  assert.ok(auditInsert);
  assert.equal(auditInsert.values[1], "operator-1");
  assert.equal(auditInsert.values[3], "auth");
  assert.equal(auditInsert.values[4], "account-provision");
  assert.equal(auditInsert.values[5], "allow");
  assert.equal(auditInsert.values[6], "private-admin-provisioning");
  assert.equal(pool.calls.at(-1).sql, "COMMIT");
  assert.equal(pool.client.released, true);
});

test("rejects self-assigned administrator and unknown roles before database access", async () => {
  const pool = fakePool();
  let hashCalls = 0;
  const input = validInput({ hashPassword: async () => { hashCalls++; return "$argon2id$hash"; } });

  await assert.rejects(
    provisionNovaLifeAccount({ pool, ...input, role: "developer_admin" }),
    /only client, caregiver, parent or guardian/
  );
  await assert.rejects(
    provisionNovaLifeAccount({ pool, ...input, role: "superuser" }),
    /only client, caregiver, parent or guardian/
  );
  assert.equal(hashCalls, 0);
  assert.equal(pool.calls.length, 0);
});

test("requires the password hasher to return an Argon2id encoded hash", async () => {
  const pool = fakePool();
  await assert.rejects(
    provisionNovaLifeAccount({
      pool,
      ...validInput({ hashPassword: async () => "plaintext-or-unsupported-hash" }),
    }),
    /Argon2id encoded hash/
  );
  assert.equal(pool.calls.length, 0);
});

test("rolls back the account if durable audit insertion fails", async () => {
  const pool = fakePool({ failOn: "INSERT INTO novalife_audit_events" });
  await assert.rejects(
    provisionNovaLifeAccount({ pool, ...validInput() }),
    /account-provisioning-failed/
  );
  assert.ok(pool.calls.some((call) => call.sql === "ROLLBACK"));
  assert.equal(pool.calls.at(-1).sql, "ROLLBACK");
  assert.equal(pool.client.released, true);
});


test("rejects account provisioning when the operator is not an active developer administrator", async () => {
  const pool = fakePool({ operatorValid: false });
  await assert.rejects(
    provisionNovaLifeAccount({ pool, ...validInput() }),
    /account-provisioning-failed/
  );
  assert.ok(pool.calls.some((call) => call.sql === "ROLLBACK"));
  assert.equal(pool.calls.some((call) => call.sql.includes("INSERT INTO novalife_accounts")), false);
  assert.equal(pool.calls.some((call) => call.sql.includes("INSERT INTO novalife_audit_events")), false);
});
