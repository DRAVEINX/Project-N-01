import test from "node:test";
import assert from "node:assert/strict";
import { createLoginService } from "../src/server/login-service.js";
import { createArgon2PasswordAdapter } from "../src/server/argon2-passwords.js";

test("login service works with the real Argon2id adapter", async () => {
  const passwords = await createArgon2PasswordAdapter();
  const storedHash = await passwords.hashPassword("correct horse battery staple");
  const credentials = {
    id: "integration-client-1",
    email: "client@example.test",
    passwordHash: storedHash,
    role: "client",
    active: true,
  };
  const sessions = [];
  const auditEvents = [];
  const accountRepository = {
    async findCredentialsByEmail(email) {
      return email.trim().toLowerCase() === credentials.email ? credentials : null;
    },
  };
  const sessionStore = {
    async create(actorId) {
      const session = {
        token: "opaque-integration-token-12345678901234567890",
        actorId,
        expiresAt: Date.now() + 60_000,
      };
      sessions.push(session);
      return session;
    },
    async revoke(token) {
      return sessions.some((session) => session.token === token);
    },
  };
  const login = createLoginService({
    accountRepository,
    sessionStore,
    verifyPassword: passwords.verifyPassword,
    dummyPasswordHash: passwords.dummyPasswordHash,
    audit: async (event) => auditEvents.push(event),
  });

  const success = await login({
    email: "CLIENT@example.test",
    password: "correct horse battery staple",
  });
  assert.equal(success.status, 200);
  assert.deepEqual(success.body.actor, { id: credentials.id, role: "client" });
  assert.equal(success.body.tokenType, "Bearer");
  assert.equal(sessions.length, 1);
  assert.equal(auditEvents[0].outcome, "allow");
  assert.equal("passwordHash" in success.body, false);

  const wrongPassword = await login({
    email: credentials.email,
    password: "not the right password",
  });
  assert.equal(wrongPassword.status, 401);
  assert.deepEqual(wrongPassword.body, { error: "invalid-credentials" });
  assert.equal(sessions.length, 1, "wrong password must not create another session");

  const unknownAccount = await login({
    email: "unknown@example.test",
    password: "some password",
  });
  assert.equal(unknownAccount.status, 401);
  assert.deepEqual(unknownAccount.body, { error: "invalid-credentials" });
  assert.equal(sessions.length, 1, "unknown account must not create a session");
});
