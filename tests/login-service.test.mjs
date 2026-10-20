import test from "node:test";
import assert from "node:assert/strict";
import { createLoginService } from "../src/server/login-service.js";

const dummyHash = "test-only-dummy-hash-value";

function setup({ credentials, session, accountError, sessionError, auditError, verify } = {}) {
  const calls = { lookup: [], verify: [], create: [], audit: [], revoke: [] };
  const accountRepository = {
    async findCredentialsByEmail(email) {
      calls.lookup.push(email);
      if (accountError) throw accountError;
      return credentials ?? null;
    }
  };
  const sessionStore = {
    async create(id) {
      calls.create.push(id);
      if (sessionError) throw sessionError;
      return session ?? { token: "a".repeat(43), actorId: id, expiresAt: 999999 };
    },
    async revoke(token) { calls.revoke.push(token); return true; }
  };
  const login = createLoginService({
    accountRepository,
    sessionStore,
    verifyPassword: async (password, hash) => {
      calls.verify.push({ password, hash });
      if (verify instanceof Error) throw verify;
      return typeof verify === "function" ? verify(password, hash) : verify === true && hash === credentials?.passwordHash;
    },
    dummyPasswordHash: dummyHash,
    audit: async (event) => {
      calls.audit.push(event);
      if (auditError) throw auditError;
    }
  });
  return { login, calls };
}

test("requires trusted dependencies and a dummy hash", () => {
  assert.throws(() => createLoginService(), /are required/);
});

test("successful login creates session and returns minimal actor without hash", async () => {
  const credentials = { id: "client-1", email: "c@example.org", passwordHash: "scrypt$test-hash-long", role: "client", active: true };
  const { login, calls } = setup({ credentials, verify: true });
  const result = await login({ email: "c@example.org", password: "correct password" });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.actor, { id: "client-1", role: "client" });
  assert.equal(result.body.tokenType, "Bearer");
  assert.equal(result.body.accessToken.length, 43);
  assert.equal("passwordHash" in result.body, false);
  assert.deepEqual(calls.create, ["client-1"]);
  assert.deepEqual(calls.audit, [{ event: "login", outcome: "allow", actorId: "client-1" }]);
});

test("unknown account verifies dummy hash and returns generic denial", async () => {
  const { login, calls } = setup({ credentials: null, verify: false });
  const result = await login({ email: "missing@example.org", password: "some password" });
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { error: "invalid-credentials" });
  assert.equal(calls.verify[0].hash, dummyHash);
  assert.equal(calls.create.length, 0);
});

test("disabled account is denied even if password verifier says true", async () => {
  const credentials = { id: "c1", email: "c@example.org", passwordHash: "scrypt$test-hash-long", role: "client", active: false };
  const { login, calls } = setup({ credentials, verify: true });
  assert.equal((await login({ email: credentials.email, password: "pw" })).status, 401);
  assert.equal(calls.create.length, 0);
});

test("wrong password does not create a session", async () => {
  const credentials = { id: "c1", email: "c@example.org", passwordHash: "scrypt$test-hash-long", role: "client", active: true };
  const { login, calls } = setup({ credentials, verify: false });
  assert.equal((await login({ email: credentials.email, password: "wrong" })).status, 401);
  assert.equal(calls.create.length, 0);
});

test("malformed requests are rejected", async () => {
  const { login, calls } = setup();
  assert.equal((await login({ email: "a@example.org", password: "" })).status, 400);
  assert.equal((await login({ email: 5, password: "x" })).status, 400);
  assert.equal(calls.lookup.length, 0);
});

test("account storage outage fails closed", async () => {
  const { login, calls } = setup({ accountError: new Error("db down") });
  assert.equal((await login({ email: "a@example.org", password: "pw" })).status, 503);
  assert.equal(calls.create.length, 0);
});

test("password verifier outage fails closed", async () => {
  const credentials = { id: "c1", email: "c@example.org", passwordHash: "scrypt$test-hash-long", role: "client", active: true };
  const { login, calls } = setup({ credentials, verify: new Error("verifier down") });
  assert.equal((await login({ email: credentials.email, password: "pw" })).status, 503);
  assert.equal(calls.create.length, 0);
});

test("session creation outage fails closed", async () => {
  const credentials = { id: "c1", email: "c@example.org", passwordHash: "scrypt$test-hash-long", role: "client", active: true };
  const { login } = setup({ credentials, verify: true, sessionError: new Error("store down") });
  assert.equal((await login({ email: credentials.email, password: "pw" })).status, 503);
});

test("audit failure revokes newly created session and fails closed", async () => {
  const credentials = { id: "c1", email: "c@example.org", passwordHash: "scrypt$test-hash-long", role: "client", active: true };
  const { login, calls } = setup({ credentials, verify: true, auditError: new Error("audit down") });
  const result = await login({ email: credentials.email, password: "pw" });
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, { error: "authentication-unavailable" });
  assert.deepEqual(calls.revoke, ["a".repeat(43)], "the just-created bearer token must be revoked");
  assert.equal("accessToken" in result.body, false, "no token may escape when audit persistence fails");
});
