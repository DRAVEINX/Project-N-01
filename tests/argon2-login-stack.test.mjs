import test from "node:test";
import assert from "node:assert/strict";
import { createArgon2LoginStack } from "../src/server/argon2-login-stack.js";

function createRepositories() {
  let credentials = null;
  let active = true;
  const sessionRows = new Map();
  const auditEvents = [];
  const accountRepository = {
    async findCredentialsByEmail(email) {
      return credentials && email.trim().toLowerCase() === credentials.email ? credentials : null;
    },
    async loadActor(id) {
      if (!credentials || id !== credentials.id) return null;
      return { id, role: credentials.role, active };
    },
  };
  const sessionRepository = {
    async put(digest, record) { sessionRows.set(digest, { ...record }); },
    async get(digest) { return sessionRows.get(digest) ?? null; },
    async delete(digest) { return sessionRows.delete(digest); },
  };
  return {
    accountRepository,
    sessionRepository,
    sessionRows,
    auditEvents,
    setCredentials(value) { credentials = value; },
    deactivate() { active = false; },
    audit: async (event) => auditEvents.push(event),
  };
}

test("composed Argon2id stack logs in, authenticates, and revokes", async () => {
  const repos = createRepositories();
  const stack = await createArgon2LoginStack({
    accountRepository: repos.accountRepository,
    sessionRepository: repos.sessionRepository,
    audit: repos.audit,
    now: () => 1_800_000_000_000,
    ttlMs: 60_000,
  });
  const passwordHash = await stack.hashPassword("a long test-only password");
  repos.setCredentials({
    id: "integration-client",
    email: "client@example.test",
    passwordHash,
    role: "client",
    active: true,
  });

  const result = await stack.login({
    email: " CLIENT@example.test ",
    password: "a long test-only password",
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.actor, { id: "integration-client", role: "client" });
  assert.equal("passwordHash" in result.body, false);
  assert.equal(repos.sessionRows.size, 1);
  assert.deepEqual(await stack.authenticate(result.body.accessToken), {
    actor: { id: "integration-client", role: "client" },
  });

  assert.equal((await stack.login({
    email: "client@example.test",
    password: "incorrect password",
  })).status, 401);
  assert.equal(repos.sessionRows.size, 1, "bad password must not create another session");

  assert.equal(await stack.revoke(result.body.accessToken), true);
  assert.equal(await stack.authenticate(result.body.accessToken), null);
  assert.equal(repos.sessionRows.size, 0);
});

test("composed stack denies unknown accounts and deactivated actors", async () => {
  const repos = createRepositories();
  const stack = await createArgon2LoginStack({
    accountRepository: repos.accountRepository,
    sessionRepository: repos.sessionRepository,
    audit: repos.audit,
  });
  const hash = await stack.hashPassword("another test-only password");
  repos.setCredentials({
    id: "integration-client",
    email: "client@example.test",
    passwordHash: hash,
    role: "client",
    active: true,
  });

  const unknown = await stack.login({ email: "missing@example.test", password: "some password" });
  assert.equal(unknown.status, 401);
  assert.deepEqual(unknown.body, { error: "invalid-credentials" });

  const success = await stack.login({ email: "client@example.test", password: "another test-only password" });
  assert.equal(success.status, 200);
  repos.deactivate();
  assert.equal(await stack.authenticate(success.body.accessToken), null);
  assert.equal(repos.sessionRows.size, 0);
});

test("durable audit callback is mandatory", async () => {
  const repos = createRepositories();
  await assert.rejects(() => createArgon2LoginStack({
    accountRepository: repos.accountRepository,
    sessionRepository: repos.sessionRepository,
  }), /durable audit callback/);
});
