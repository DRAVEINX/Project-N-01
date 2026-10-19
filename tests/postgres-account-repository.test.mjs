import test from "node:test";
import assert from "node:assert/strict";
import { createPostgresAccountRepository } from "../src/server/postgres-account-repository.js";

function fakePool({ rows = [], rowCount = 0, error } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, values) {
      calls.push({ sql, values });
      if (error) throw error;
      return { rows, rowCount };
    }
  };
}

test("requires a PostgreSQL-compatible query pool", () => {
  assert.throws(() => createPostgresAccountRepository(), /pool.query is required/);
});

test("loads only trusted actor fields and never returns the password hash", async () => {
  const pool = fakePool({ rows: [{ id: "a1", role: "caregiver", active: true, password_hash: "secret-hash" }] });
  const repo = createPostgresAccountRepository({ pool });
  assert.deepEqual(await repo.loadActor("a1"), { id: "a1", role: "caregiver", active: true });
  assert.deepEqual(pool.calls[0].values, ["a1"]);
  assert.doesNotMatch(pool.calls[0].sql, /password_hash/);
});

test("fails closed on missing rows, malformed IDs, and unknown roles", async () => {
  const pool = fakePool({ rows: [{ id: "a1", role: "superuser", active: true }] });
  const repo = createPostgresAccountRepository({ pool });
  assert.equal(await repo.loadActor("a1"), null);
  assert.equal(await repo.loadActor(" "), null);
  assert.equal(pool.calls.length, 1);
});

test("finds credentials using normalized email and parameterized SQL", async () => {
  const pool = fakePool({ rows: [{
    id: "a1", email_normalized: "person@example.org", password_hash: "scrypt$example-hash-value",
    role: "client", active: true
  }] });
  const repo = createPostgresAccountRepository({ pool });
  assert.deepEqual(await repo.findCredentialsByEmail(" Person@Example.org "), {
    id: "a1", email: "person@example.org", passwordHash: "scrypt$example-hash-value",
    role: "client", active: true
  });
  assert.deepEqual(pool.calls[0].values, ["person@example.org"]);
  assert.match(pool.calls[0].sql, /WHERE email_normalized = \$1/);
});

test("rejects malformed email before database access", async () => {
  const pool = fakePool();
  const repo = createPostgresAccountRepository({ pool });
  assert.equal(await repo.findCredentialsByEmail("not-an-email"), null);
  assert.equal(pool.calls.length, 0);
});

test("creates an account with normalized email and parameterized SQL", async () => {
  const pool = fakePool({ rows: [{ id: "a2", role: "guardian", active: true }] });
  const repo = createPostgresAccountRepository({ pool });
  assert.deepEqual(await repo.createAccount({
    id: "a2", email: "Guardian@Example.org", passwordHash: "scrypt$long-reviewed-hash",
    role: "guardian"
  }), { id: "a2", role: "guardian", active: true });
  assert.deepEqual(pool.calls[0].values, ["a2", "guardian@example.org", "scrypt$long-reviewed-hash", "guardian"]);
  assert.match(pool.calls[0].sql, /INSERT INTO novalife_accounts/);
});

test("accepts parent as a supported trusted account role", async () => {
  const pool = fakePool({ rows: [{ id: "parent-1", role: "parent", active: true }] });
  const repo = createPostgresAccountRepository({ pool });
  assert.deepEqual(await repo.createAccount({
    id: "parent-1",
    email: "parent@example.org",
    passwordHash: "argon2id$reviewed-test-hash-value",
    role: "parent"
  }), { id: "parent-1", role: "parent", active: true });
  assert.deepEqual(pool.calls[0].values, [
    "parent-1", "parent@example.org", "argon2id$reviewed-test-hash-value", "parent"
  ]);
  assert.equal(await repo.loadActor("parent-1"), { id: "parent-1", role: "parent", active: true });
});

test("rejects plaintext-like short passwords and invalid roles before database access", async () => {
  const pool = fakePool();
  const repo = createPostgresAccountRepository({ pool });
  await assert.rejects(repo.createAccount({
    id: "a1", email: "a@example.org", passwordHash: "plaintext", role: "client"
  }), /reviewed password hash/);
  await assert.rejects(repo.createAccount({
    id: "a1", email: "a@example.org", passwordHash: "scrypt$some-long-hash", role: "superuser"
  }), /invalid account role/);
  assert.equal(pool.calls.length, 0);
});

test("propagates database errors so callers can fail closed", async () => {
  const pool = fakePool({ error: new Error("database unavailable") });
  const repo = createPostgresAccountRepository({ pool });
  await assert.rejects(repo.loadActor("a1"), /database unavailable/);
});
