/**
 * Experimental browser-side encryption primitives for Project N-01.
 *
 * Used by the optional encrypted routine vault and encrypted backup flow.
 * Preferences remain unencrypted; sensitive journal/voice data is not persisted.
 * Requires Web Crypto in a secure context.
 */
const FORMAT = "project-n-01-encrypted-json";
const VERSION = 1;
const ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const MAX_PLAINTEXT_BYTES = 1_000_000;
const MAX_CIPHERTEXT_BYTES = MAX_PLAINTEXT_BYTES + 16;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

function webCrypto() {
  if (!globalThis.crypto?.subtle || typeof globalThis.crypto.getRandomValues !== "function") {
    throw new Error("Secure cryptography is unavailable in this environment.");
  }
  return globalThis.crypto;
}

function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(value, expectedLength, maxLength) {
  if (typeof value !== "string" || value.length > 2_000_000 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error("Invalid encrypted data format.");
  }
  if (maxLength !== undefined && value.length > Math.ceil(maxLength / 3) * 4) {
    throw new Error("Encrypted data exceeds the 1 MB limit.");
  }
  let binary;
  try { binary = atob(value); } catch { throw new Error("Invalid encrypted data format."); }
  if (btoa(binary) !== value) throw new Error("Invalid encrypted data format.");
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (expectedLength !== undefined && bytes.length !== expectedLength) {
    throw new Error("Invalid encrypted data format.");
  }
  if (maxLength !== undefined && bytes.length > maxLength) {
    throw new Error("Encrypted data exceeds the 1 MB limit.");
  }
  return bytes;
}

function validatePassphrase(passphrase) {
  if (typeof passphrase !== "string" || passphrase.length < 12 || passphrase.length > 1024) {
    throw new Error("Use a passphrase between 12 and 1024 characters.");
  }
}

async function deriveKey(passphrase, salt) {
  validatePassphrase(passphrase);
  const crypto = webCrypto();
  const material = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts JSON-compatible data. The returned envelope contains no passphrase
 * or derived key. Keep the passphrase outside the envelope and do not log it.
 */
export async function encryptJson(value, passphrase) {
  const crypto = webCrypto();
  validatePassphrase(passphrase);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const serialized = JSON.stringify(value);
  if (typeof serialized !== "string") throw new Error("Only JSON-serializable values can be encrypted.");
  const plaintext = encoder.encode(serialized);
  if (plaintext.length > MAX_PLAINTEXT_BYTES) throw new Error("Encrypted data exceeds the 1 MB limit.");
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, plaintext);
  return {
    format: FORMAT,
    version: VERSION,
    kdf: "PBKDF2-SHA-256",
    iterations: ITERATIONS,
    cipher: "AES-256-GCM",
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext))
  };
}

/** Decrypts a supported envelope. Authentication or password failures reject. */
export async function decryptJson(envelope, passphrase) {
  const crypto = webCrypto();
  validatePassphrase(passphrase);
  if (!envelope || envelope.format !== FORMAT || envelope.version !== VERSION ||
      envelope.kdf !== "PBKDF2-SHA-256" || envelope.iterations !== ITERATIONS ||
      envelope.cipher !== "AES-256-GCM") {
    throw new Error("Unsupported encrypted data format.");
  }
  const salt = fromBase64(envelope.salt, SALT_BYTES);
  const iv = fromBase64(envelope.iv, IV_BYTES);
  const ciphertext = fromBase64(envelope.ciphertext, undefined, MAX_CIPHERTEXT_BYTES);
  if (ciphertext.length > MAX_CIPHERTEXT_BYTES) throw new Error("Encrypted data exceeds the 1 MB limit.");
  if (ciphertext.length < 16) throw new Error("Invalid encrypted data format.");
  const key = await deriveKey(passphrase, salt);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, ciphertext);
  if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) throw new Error("Decrypted data exceeds the 1 MB limit.");
  return JSON.parse(decoder.decode(plaintext));
}

export const encryptedJsonFormat = Object.freeze({
  format: FORMAT,
  version: VERSION,
  kdf: "PBKDF2-SHA-256",
  iterations: ITERATIONS,
  cipher: "AES-256-GCM"
});


/**
 * Opens an in-memory encryption session. The returned object keeps the derived
 * CryptoKey inside a closure (never in storage or exposed to callers) and uses
 * a fresh random IV for every save. Drop the returned object on lock.
 */
export async function openEncryptedJsonSession(envelope, passphrase) {
  const crypto = webCrypto();
  validatePassphrase(passphrase);
  if (!envelope || envelope.format !== FORMAT || envelope.version !== VERSION ||
      envelope.kdf !== "PBKDF2-SHA-256" || envelope.iterations !== ITERATIONS ||
      envelope.cipher !== "AES-256-GCM") {
    throw new Error("Unsupported encrypted data format.");
  }
  const salt = fromBase64(envelope.salt, SALT_BYTES);
  const iv = fromBase64(envelope.iv, IV_BYTES);
  const ciphertext = fromBase64(envelope.ciphertext, undefined, MAX_CIPHERTEXT_BYTES);
  if (ciphertext.length < 16) {
    throw new Error("Invalid encrypted data size.");
  }
  const key = await deriveKey(passphrase, salt);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, ciphertext);
  if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) throw new Error("Decrypted data exceeds the 1 MB limit.");
  const value = JSON.parse(decoder.decode(plaintext));
  return {
    value,
    async encrypt(nextValue) {
      const serialized = JSON.stringify(nextValue);
      if (typeof serialized !== "string") throw new Error("Only JSON-serializable values can be encrypted.");
      const bytes = encoder.encode(serialized);
      if (bytes.length > MAX_PLAINTEXT_BYTES) throw new Error("Encrypted data exceeds the 1 MB limit.");
      const nextIv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
      const nextCiphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nextIv, tagLength: 128 }, key, bytes);
      return {
        format: FORMAT, version: VERSION, kdf: "PBKDF2-SHA-256", iterations: ITERATIONS,
        cipher: "AES-256-GCM", salt: envelope.salt, iv: toBase64(nextIv),
        ciphertext: toBase64(new Uint8Array(nextCiphertext))
      };
    }
  };
}
