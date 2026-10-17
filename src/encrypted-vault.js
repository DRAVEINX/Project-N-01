/**
 * Experimental encrypted local-storage vault.
 *
 * The vault stores a single authenticated-encryption envelope at one storage key.
 * It never persists the passphrase or decrypted value. Callers must explicitly
 * migrate legacy plaintext data; this module intentionally does not guess which
 * records are safe to delete or overwrite.
 */
import { encryptJson, decryptJson } from "./secure-storage.js";

function cloneJson(value) {
  const serialized = JSON.stringify(value);
  if (typeof serialized !== "string") throw new Error("Vault data must be JSON-serializable.");
  return JSON.parse(serialized);
}

export class EncryptedVault {
  constructor(storage, storageKey = "project-n-01-encrypted-vault-v1") {
    if (!storage || typeof storage.getItem !== "function" ||
        typeof storage.setItem !== "function" || typeof storage.removeItem !== "function") {
      throw new TypeError("A Storage-compatible object is required.");
    }
    if (typeof storageKey !== "string" || storageKey.length < 1 || storageKey.length > 200) {
      throw new TypeError("Invalid vault storage key.");
    }
    this.storage = storage;
    this.storageKey = storageKey;
    this.unlockedData = null;
    this.unlocked = false;
  }

  get isUnlocked() {
    return this.unlocked;
  }

  async initialize(passphrase, initialData = {}) {
    if (this.storage.getItem(this.storageKey) !== null) {
      throw new Error("Vault already exists; unlock it instead of initializing.");
    }
    const safeInitialData = cloneJson(initialData);
    const envelope = await encryptJson(safeInitialData, passphrase);
    // Persist successfully before retaining plaintext in memory.
    this.storage.setItem(this.storageKey, JSON.stringify(envelope));
    this.unlockedData = safeInitialData;
    this.unlocked = true;
    return cloneJson(safeInitialData);
  }

  async unlock(passphrase) {
    const raw = this.storage.getItem(this.storageKey);
    if (raw === null) throw new Error("Vault does not exist.");
    let envelope;
    try { envelope = JSON.parse(raw); } catch { throw new Error("Stored vault is invalid."); }
    const decrypted = await decryptJson(envelope, passphrase);
    const safeData = cloneJson(decrypted);
    this.unlockedData = safeData;
    this.unlocked = true;
    return cloneJson(safeData);
  }

  async save(value) {
    if (!this.unlocked) throw new Error("Unlock the vault before saving.");
    const safeValue = cloneJson(value);
    const envelope = await encryptJson(safeValue, this._passphraseRequiredForSave());
    this.storage.setItem(this.storageKey, JSON.stringify(envelope));
    this.unlockedData = safeValue;
    return cloneJson(safeValue);
  }

  _passphraseRequiredForSave() {
    // A key must never be cached in this object; save requires a fresh passphrase.
    throw new Error("Saving requires saveWithPassphrase(passphrase, value).");
  }

  async saveWithPassphrase(passphrase, value) {
    if (!this.unlocked) throw new Error("Unlock the vault before saving.");
    const safeValue = cloneJson(value);
    const envelope = await encryptJson(safeValue, passphrase);
    this.storage.setItem(this.storageKey, JSON.stringify(envelope));
    this.unlockedData = safeValue;
    return cloneJson(safeValue);
  }

  read() {
    if (!this.unlocked) throw new Error("Unlock the vault before reading.");
    return cloneJson(this.unlockedData);
  }

  lock() {
    this.unlockedData = null;
    this.unlocked = false;
  }

  exportEnvelope() {
    const raw = this.storage.getItem(this.storageKey);
    if (raw === null) throw new Error("Vault does not exist.");
    return JSON.parse(raw);
  }

  async restoreEnvelope(passphrase, envelope) {
    const restored = cloneJson(await decryptJson(envelope, passphrase));
    // Do not change current storage or memory until authentication and validation pass.
    this.storage.setItem(this.storageKey, JSON.stringify(envelope));
    this.unlockedData = restored;
    this.unlocked = true;
    return cloneJson(restored);
  }

  clearStoredVault() {
    this.lock();
    this.storage.removeItem(this.storageKey);
  }
}
