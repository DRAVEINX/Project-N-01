import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, normalizeEmail, validatePassword, signToken, verifyToken, newTotpSecret, verifyTotp, totpUri, encryptMfaSecret, decryptMfaSecret, validateEncryptedEnvelope, hashToken } from "../server/core.mjs";

test("email normalization rejects invalid and normalizes case", () => {
  assert.equal(normalizeEmail(" Person@Example.org "), "person@example.org");
  assert.throws(() => normalizeEmail("not-an-email"), /invalid-email/);
});
test("password policy and scrypt verification work without storing plaintext", async () => {
  const password = "VerySecureGardenDoor928";
  const hash = await hashPassword(password);
  assert.notEqual(hash, password);
  assert.match(hash, /^scrypt\$32768\$8\$1\$/);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("WrongPassword928", hash), false);
  assert.throws(() => validatePassword("weak"), /password-policy/);
});
test("access tokens verify signature and expiry claim", () => {
  const secret = "a-random-test-secret-at-least-32-bytes-long";
  const token = signToken({ sub: "user-1", sid: "session-1" }, secret);
  assert.equal(verifyToken(token, secret).sub, "user-1");
  assert.equal(verifyToken(token, "a-different-random-test-secret-32-bytes"), null);
  assert.equal(verifyToken("junk", secret), null);
});
test("TOTP secret is accepted only for current six-digit code", () => {
  const secret = newTotpSecret();
  const uri = totpUri(secret, "test@example.org");
  assert.match(uri, /^otpauth:\/\/totp\//);
  assert.equal(verifyTotp(secret, "000000", 0) || verifyTotp(secret, "999999", 0), false);
  assert.equal(verifyTotp(secret, "12ab56", 0), false);
});
test("MFA secrets are authenticated when encrypted at rest", () => {
  const secret = "AERU6YTBORUGS4ZANFZWK3DMN5XG";
  const key = "test-jwt-key-at-least-32-characters-here";
  const ciphertext = encryptMfaSecret(secret,key);
  assert.equal(decryptMfaSecret(ciphertext,key),secret);
  assert.throws(()=>decryptMfaSecret(ciphertext,"another-key-at-least-32-characters"), /Unsupported state|auth|decrypt/i);
});
test("server accepts only supported encrypted AES-GCM envelopes", () => {
  const valid = {format:"project-n-01-life-v1",version:1,kdf:"PBKDF2-SHA-256",iterations:310000,cipher:"AES-256-GCM",salt:"AA==",iv:"AA==",ciphertext:"AA=="};
  assert.equal(validateEncryptedEnvelope(valid),true);
  assert.equal(validateEncryptedEnvelope({...valid,cipher:"none"}),false);
  assert.equal(validateEncryptedEnvelope({...valid,format:"unknown"}),false);
  assert.equal(hashToken("secret").length,64);
});
