import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, createArgon2PasswordAdapter } from "../src/server/argon2-passwords.js";

test("Argon2id hashes passwords and verifies only the matching password", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.match(hash, /^\$argon2id\$/);
  assert.notEqual(hash, "correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  assert.equal(await verifyPassword("wrong password", hash), false);
});

test("malformed hashes and invalid inputs fail closed", async () => {
  assert.equal(await verifyPassword("some password", "not-a-valid-hash"), false);
  assert.equal(await verifyPassword("", "$argon2id$v=19$m=19456,t=2,p=1$abc$def"), false);
  await assert.rejects(() => hashPassword(""), TypeError);
});

test("server adapter creates a real Argon2id dummy hash", async () => {
  const adapter = await createArgon2PasswordAdapter();
  assert.match(adapter.dummyPasswordHash, /^\$argon2id\$/);
  assert.equal(await adapter.verifyPassword("not-the-random-dummy-secret", adapter.dummyPasswordHash), false);
  assert.equal(Object.isFrozen(adapter), true);
});
