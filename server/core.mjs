import { createHmac, createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual, createCipheriv, createDecipheriv } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const enc = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const dec = value => JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
const b32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function normalizeEmail(value) {
  if (typeof value !== "string") throw new Error("invalid-email");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("invalid-email");
  return email;
}
export function validatePassword(value) {
  if (typeof value !== "string" || value.length < 14 || value.length > 1024) throw new Error("password-policy");
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value)) throw new Error("password-policy");
}
export async function hashPassword(password) {
  validatePassword(password);
  const salt = randomBytes(16);
  const result = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return "scrypt$32768$8$1$" + salt.toString("base64url") + "$" + Buffer.from(result).toString("base64url");
}
export async function verifyPassword(password, encoded) {
  try {
    const [algorithm, n, r, p, saltText, hashText] = String(encoded).split("$");
    if (algorithm !== "scrypt" || n !== "32768" || r !== "8" || p !== "1") return false;
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(hashText, "base64url");
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = Buffer.from(await scrypt(String(password || ""), salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }));
    return timingSafeEqual(actual, expected);
  } catch { return false; }
}
export function signToken(payload, secret, lifetimeSeconds = 1800) {
  if (typeof secret !== "string" || Buffer.byteLength(secret) < 32) throw new Error("weak-signing-secret");
  const now = Math.floor(Date.now() / 1000);
  const header = enc({ alg: "HS256", typ: "JWT" });
  const body = enc({ ...payload, iat: now, exp: now + lifetimeSeconds });
  const content = header + "." + body;
  const signature = createHmac("sha256", secret).update(content).digest("base64url");
  return content + "." + signature;
}
export function verifyToken(token, secret) {
  try {
    if (typeof token !== "string" || token.length > 8192) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = dec(parts[0]);
    const payload = dec(parts[1]);
    if (header.alg !== "HS256" || header.typ !== "JWT" || !Number.isInteger(payload.exp) || payload.exp <= Math.floor(Date.now()/1000)) return null;
    const expected = createHmac("sha256", secret).update(parts[0]+"."+parts[1]).digest();
    const actual = Buffer.from(parts[2], "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    return payload;
  } catch { return null; }
}
export function randomToken(bytes = 32) { return randomBytes(bytes).toString("base64url"); }
export function hashToken(token) { return createHash("sha256").update(String(token)).digest("hex"); }
function base32Encode(bytes) {
  let bits = 0, value = 0, out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += b32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) out += b32[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(text) {
  let bits = 0, value = 0; const bytes = [];
  for (const c of String(text).toUpperCase().replace(/=+$/,"").replace(/\s/g,"")) {
    const idx = b32.indexOf(c); if (idx < 0) throw new Error("invalid-totp-secret");
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(bytes);
}
export function newTotpSecret() { return base32Encode(randomBytes(20)); }
function totpAt(secret, timeMs) {
  const counter = Math.floor(timeMs / 30000);
  if (!Number.isSafeInteger(counter) || counter < 0) return "";
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const number = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(number).padStart(6, "0");
}
export function verifyTotp(secret, code, now = Date.now()) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return false;
  let match = 0;
  for (const offset of [-30000, 0, 30000]) {
    const expected = Buffer.from(totpAt(secret, now + offset));
    const actual = Buffer.from(code);
    match |= expected.length === actual.length && timingSafeEqual(expected, actual) ? 1 : 0;
  }
  return match === 1;
}
export function totpUri(secret, email, issuer = "Project N-01") {
  const label = encodeURIComponent(issuer + ":" + email);
  const query = new URLSearchParams({ secret, issuer, algorithm:"SHA1", digits:"6", period:"30" });
  return "otpauth://totp/" + label + "?" + query.toString();
}
function mfaKey(secret) { return createHash("sha256").update("Project-N-01-MFA-Secret-v1:").update(secret).digest(); }
export function encryptMfaSecret(secretValue, signingSecret) {
  const iv = randomBytes(12); const key = mfaKey(signingSecret);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(String(secretValue), "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}
export function decryptMfaSecret(value, signingSecret) {
  const parts = String(value || "").split(".");
  if (parts.length !== 3) throw new Error("invalid-mfa-secret");
  const decipher = createDecipheriv("aes-256-gcm", mfaKey(signingSecret), Buffer.from(parts[0], "base64url"));
  decipher.setAuthTag(Buffer.from(parts[1], "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(parts[2], "base64url")), decipher.final()]).toString("utf8");
}
export function validateEncryptedEnvelope(envelope) {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) return false;
  const compatible = envelope.format === "project-n-01-life-v1" ||
    envelope.format === "project-n-01-encrypted-json" || envelope.format === "project-n-01-secure-life-v1";
  if (!compatible || envelope.version !== 1 || envelope.cipher !== "AES-256-GCM" ||
      envelope.kdf !== "PBKDF2-SHA-256" || envelope.iterations !== 310000) return false;
  if (![envelope.salt,envelope.iv,envelope.ciphertext].every(x=>typeof x === "string" && x.length > 0)) return false;
  if (envelope.ciphertext.length > 1_400_100 || envelope.salt.length > 128 || envelope.iv.length > 128) return false;
  const validBase64 = value => /^[A-Za-z0-9+/=_-]+$/.test(value);
  if (!validBase64(envelope.salt) || !validBase64(envelope.iv) || !validBase64(envelope.ciphertext)) return false;
  try {
    const decode = value => Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    const salt = decode(envelope.salt);
    const iv = decode(envelope.iv);
    const ciphertext = decode(envelope.ciphertext);
    // Match the client AES-GCM envelope: 16-byte salt, 12-byte IV, and a
    // 16-byte authentication tag plus at most 1 MB of encrypted JSON.
    return salt.length === 16 && iv.length === 12 &&
      ciphertext.length >= 16 && ciphertext.length <= 1_000_016;
  } catch {
    return false;
  }
}
