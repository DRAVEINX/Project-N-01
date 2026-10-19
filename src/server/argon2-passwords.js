import argon2 from "argon2";
import { randomBytes } from "node:crypto";

const OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
});

/**
 * Argon2id password utilities for server-side authentication.
 * Never use this module in browser/mobile client code.
 */
export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 1 || password.length > 1024) {
    throw new TypeError("password must be a non-empty string of at most 1024 characters");
  }
  return argon2.hash(password, OPTIONS);
}

/**
 * Returns false for a malformed/unsupported encoded hash; operational errors
 * are allowed to propagate so callers can fail closed rather than accept login.
 */
export async function verifyPassword(password, encodedHash) {
  if (typeof password !== "string" || password.length < 1 || password.length > 1024 ||
      typeof encodedHash !== "string" || encodedHash.length < 20 || encodedHash.length > 512) {
    return false;
  }
  try {
    return await argon2.verify(encodedHash, password, { type: argon2.argon2id });
  } catch (error) {
    if (error instanceof TypeError || /invalid hash|malformed|encoded hash/i.test(String(error?.message))) {
      return false;
    }
    throw error;
  }
}

/**
 * Build a login-ready adapter once at server startup. The dummy hash is
 * generated with the same algorithm/costs as real hashes to reduce obvious
 * timing differences for unknown email addresses. Keep it in memory only.
 */
export async function createArgon2PasswordAdapter() {
  const dummySecret = randomBytes(32).toString("base64url");
  const dummyPasswordHash = await hashPassword(dummySecret);
  return Object.freeze({ hashPassword, verifyPassword, dummyPasswordHash });
}
