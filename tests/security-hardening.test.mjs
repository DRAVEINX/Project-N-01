import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { signToken, verifyToken, newTotpSecret, verifyTotp, validateEncryptedEnvelope } from "../server/core.mjs";

const validEnvelope = () => ({
  format: "project-n-01-life-v1",
  version: 1,
  kdf: "PBKDF2-SHA-256",
  iterations: 310000,
  cipher: "AES-256-GCM",
  salt: Buffer.alloc(16, 1).toString("base64"),
  iv: Buffer.alloc(12, 2).toString("base64"),
  ciphertext: Buffer.alloc(16, 3).toString("base64")
});

test("encrypted envelope validation checks decoded byte lengths, not only field presence", () => {
  assert.equal(validateEncryptedEnvelope(validEnvelope()), true);
  assert.equal(validateEncryptedEnvelope({ ...validEnvelope(), salt: "AA==" }), false);
  assert.equal(validateEncryptedEnvelope({ ...validEnvelope(), iv: Buffer.alloc(16).toString("base64") }), false);
  assert.equal(validateEncryptedEnvelope({ ...validEnvelope(), ciphertext: "AA==" }), false);
  assert.equal(validateEncryptedEnvelope({ ...validEnvelope(), ciphertext: "!!!!" }), false);
  assert.equal(validateEncryptedEnvelope(null), false);
  assert.equal(validateEncryptedEnvelope([]), false);
});

test("encrypted envelope validation rejects ciphertext above the client payload limit", () => {
  const tooLarge = { ...validEnvelope(), ciphertext: Buffer.alloc(1_000_017).toString("base64") };
  assert.equal(validateEncryptedEnvelope(tooLarge), false);
});

test("signed tokens reject altered payloads and expired lifetimes", () => {
  const secret = "unique-test-secret-with-at-least-thirty-two-bytes";
  const token = signToken({ sub: "user-a", sid: "session-a" }, secret);
  const parts = token.split(".");
  parts[1] = Buffer.from(JSON.stringify({ sub: "user-b", sid: "session-a", iat: 1, exp: 9999999999 })).toString("base64url");
  assert.equal(verifyToken(parts.join("."), secret), null);
  assert.equal(verifyToken(signToken({ sub: "user-a" }, secret, -1), secret), null);
});

test("invalid TOTP formats are rejected without throwing", () => {
  const secret = newTotpSecret();
  for (const code of ["", "12345", "1234567", "12a456", null]) {
    assert.equal(verifyTotp(secret, code), false);
  }
});


test("email verification and password reset consume one-time tokens inside row-locked transactions", async () => {
  const server = await readFile(new URL("../server/server.mjs", import.meta.url), "utf8");
  const verifyStart = server.indexOf('if (path === "/v1/auth/verify-email" && method === "POST")');
  const verifyEnd = server.indexOf('if (path === "/v1/auth/resend-verification" && method === "POST")', verifyStart);
  const verifyRoute = server.slice(verifyStart, verifyEnd);
  assert.match(verifyRoute, /const client = await pool\.connect\(\)/);
  assert.match(verifyRoute, /FOR UPDATE OF v/);
  assert.match(verifyRoute, /UPDATE n01_email_verifications SET used_at=NOW\(\) WHERE id=\$1 AND used_at IS NULL AND expires_at>NOW\(\) RETURNING id/);
  assert.match(verifyRoute, /finally \{ client\.release\(\); \}/);
  assert.doesNotMatch(verifyRoute, /await pool\.query\("(?:BEGIN|COMMIT|ROLLBACK)"/);

  const resetStart = server.indexOf('if (path === "/v1/auth/reset-password" && method === "POST")');
  const resetEnd = server.indexOf('if (path === "/v1/auth/logout" && method === "POST")', resetStart);
  const resetRoute = server.slice(resetStart, resetEnd);
  assert.match(resetRoute, /const client = await pool\.connect\(\)/);
  assert.match(resetRoute, /n01_password_resets WHERE token_hash=\$1 AND used_at IS NULL AND expires_at>NOW\(\) FOR UPDATE/);
  assert.match(resetRoute, /UPDATE n01_password_resets SET used_at=NOW\(\) WHERE id=\$1 AND used_at IS NULL AND expires_at>NOW\(\) RETURNING id/);
  assert.match(resetRoute, /UPDATE n01_sessions SET revoked_at=NOW\(\) WHERE user_id=\$1 AND revoked_at IS NULL/);
  assert.match(resetRoute, /finally \{ client\.release\(\); \}/);
  assert.doesNotMatch(resetRoute, /await pool\.query\("(?:BEGIN|COMMIT|ROLLBACK)"/);
});
