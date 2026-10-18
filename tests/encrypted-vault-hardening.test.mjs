import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { EncryptedVault } from "../src/encrypted-vault.js";

if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const passphrase = "correct-horse-battery-123";

test("vault stores ciphertext only and restores data after lock/reopen", async () => {
  const storage = new MemoryStorage();
  const first = new EncryptedVault(storage, "test-vault");
  const original = { journal: [{ text: "private", drawing: "data" }] };
  await first.initialize(passphrase, original);

  const stored = storage.getItem("test-vault");
  assert.ok(stored);
  assert.doesNotMatch(stored, /private/);
  assert.deepEqual(first.read(), original);

  first.lock();
  assert.equal(first.isUnlocked, false);
  assert.throws(() => first.read(), /Unlock the vault/);

  const second = new EncryptedVault(storage, "test-vault");
  assert.deepEqual(await second.unlock(passphrase), original);
});

test("vault rejects a wrong passphrase without changing stored ciphertext", async () => {
  const storage = new MemoryStorage();
  const vault = new EncryptedVault(storage, "test-vault");
  await vault.initialize(passphrase, { safe: true });
  const before = storage.getItem("test-vault");

  const other = new EncryptedVault(storage, "test-vault");
  await assert.rejects(other.unlock("wrong-passphrase-123"), /decrypt|operation|password/i);
  assert.equal(storage.getItem("test-vault"), before);
  assert.equal(other.isUnlocked, false);
});

test("vault refuses to initialize over existing data", async () => {
  const storage = new MemoryStorage();
  const vault = new EncryptedVault(storage, "test-vault");
  await vault.initialize(passphrase, { version: 1 });
  const before = storage.getItem("test-vault");

  await assert.rejects(vault.initialize(passphrase, { version: 2 }), /already exists/);
  assert.equal(storage.getItem("test-vault"), before);
});

test("vault detects a concurrent storage change before saving", async () => {
  class ChangingStorage extends MemoryStorage {
    constructor() { super(); this.changeOnRead = false; this.readCount = 0; }
    getItem(key) {
      if (this.changeOnRead) {
        this.readCount += 1;
        if (this.readCount === 1) super.setItem(key, '{"external":"change"}');
      }
      return super.getItem(key);
    }
  }

  const storage = new ChangingStorage();
  const vault = new EncryptedVault(storage, "test-vault");
  await vault.initialize(passphrase, { version: 1 });
  storage.changeOnRead = true;
  storage.readCount = 0;

  await assert.rejects(vault.save({ version: 2 }), /changed in another session/);
  assert.equal(storage.getItem("test-vault"), '{"external":"change"}');
});

test("vault restore validates encrypted backup before replacing current data", async () => {
  const storage = new MemoryStorage();
  const vault = new EncryptedVault(storage, "test-vault");
  await vault.initialize(passphrase, { current: "keep" });
  const before = storage.getItem("test-vault");

  await assert.rejects(vault.restoreEnvelope("wrong-passphrase-123", {
    format: "project-n-01-encrypted-json", version: 1, kdf: "PBKDF2-SHA-256",
    iterations: 310000, cipher: "AES-256-GCM", salt: "AAAAAAAAAAAAAAAAAAAAAA==",
    iv: "AAAAAAAAAAAAAAAA", ciphertext: "AAAAAAAAAAAAAAAAAAAAAA=="
  }));
  assert.equal(storage.getItem("test-vault"), before);
  assert.deepEqual(vault.read(), { current: "keep" });
});

test("vault rejects invalid storage adapters and keys", () => {
  assert.throws(() => new EncryptedVault(null), /Storage-compatible/);
  assert.throws(() => new EncryptedVault(new MemoryStorage(), ""), /Invalid vault storage key/);
  assert.throws(() => new EncryptedVault(new MemoryStorage(), "x".repeat(201)), /Invalid vault storage key/);
});

test("failed storage writes leave the current vault and in-memory data unchanged", async () => {
  class FailingStorage extends MemoryStorage {
    constructor() { super(); this.failWrites = false; }
    setItem(key, value) {
      if (this.failWrites) throw new Error("simulated storage quota failure");
      super.setItem(key, value);
    }
  }

  const storage = new FailingStorage();
  const vault = new EncryptedVault(storage, "test-vault");
  await vault.initialize(passphrase, { current: "keep" });
  const before = storage.getItem("test-vault");
  storage.failWrites = true;

  await assert.rejects(vault.save({ current: "new" }), /storage quota failure/);
  assert.equal(storage.getItem("test-vault"), before);
  assert.deepEqual(vault.read(), { current: "keep" });

  const backupStorage = new MemoryStorage();
  const backupVault = new EncryptedVault(backupStorage, "backup-vault");
  await backupVault.initialize(passphrase, { restored: "backup" });
  await assert.rejects(
    vault.restoreEnvelope(passphrase, backupVault.exportEnvelope()),
    /storage quota failure/
  );
  assert.equal(storage.getItem("test-vault"), before);
  assert.deepEqual(vault.read(), { current: "keep" });
});

test("tampered ciphertext cannot unlock a vault or expose plaintext", async () => {
  const storage = new MemoryStorage();
  const vault = new EncryptedVault(storage, "test-vault");
  await vault.initialize(passphrase, { privateNote: "do not expose" });
  const envelope = vault.exportEnvelope();
  const ciphertext = envelope.ciphertext;
  const first = ciphertext[0];
  envelope.ciphertext = (first === "A" ? "B" : "A") + ciphertext.slice(1);
  storage.setItem("test-vault", JSON.stringify(envelope));

  const reopened = new EncryptedVault(storage, "test-vault");
  await assert.rejects(reopened.unlock(passphrase));
  assert.equal(reopened.isUnlocked, false);
  assert.throws(() => reopened.read(), /Unlock the vault/);
});

