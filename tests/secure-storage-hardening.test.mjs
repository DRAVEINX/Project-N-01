import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { decryptJson } from "../src/secure-storage.js";

if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;

const passphrase = "correct-horse-battery-123";
const encoder = new TextEncoder();
const toBase64 = bytes => Buffer.from(bytes).toString("base64");

async function envelopeForBytes(bytes) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const material = await webcrypto.subtle.importKey(
    "raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]
  );
  const key = await webcrypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const ciphertext = await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 }, key, bytes
  );
  return {
    format: "project-n-01-encrypted-json",
    version: 1,
    kdf: "PBKDF2-SHA-256",
    iterations: 310000,
    cipher: "AES-256-GCM",
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext))
  };
}

test("authenticated ciphertext containing invalid UTF-8 is rejected", async () => {
  const envelope = await envelopeForBytes(new Uint8Array([0xc3, 0x28]));
  await assert.rejects(decryptJson(envelope, passphrase));
});

test("authenticated ciphertext containing valid UTF-8 but invalid JSON is rejected", async () => {
  const envelope = await envelopeForBytes(encoder.encode("{not-json"));
  await assert.rejects(decryptJson(envelope, passphrase), SyntaxError);
});


test("oversized base64 ciphertext is rejected before decoding the payload", async () => {
  const envelope = await envelopeForBytes(encoder.encode("{}"));
  envelope.ciphertext = "A".repeat(1_333_360);
  await assert.rejects(decryptJson(envelope, passphrase), /Invalid encrypted data format/);
});
