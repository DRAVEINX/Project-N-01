/**
 * Experimental encrypted local-storage vault.
 * The derived CryptoKey is retained only inside an in-memory session while unlocked.
 * Locking drops that session and its plaintext cache; neither passphrase nor key is stored.
 */
import { encryptJson, openEncryptedJsonSession } from "./secure-storage.js";

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
    this.session = null;
    this.persistedRaw = null;
    this.unlocked = false;
  }

  get isUnlocked() { return this.unlocked; }

  async initialize(passphrase, initialData = {}) {
    if (this.storage.getItem(this.storageKey) !== null) {
      throw new Error("Vault already exists; unlock it instead of initializing.");
    }
    const safeInitialData = cloneJson(initialData);
    const envelope = await encryptJson(safeInitialData, passphrase);
    const session = await openEncryptedJsonSession(envelope, passphrase);
    if (this.storage.getItem(this.storageKey) !== null) {
      throw new Error("Vault was created by another session; unlock it instead.");
    }
    const raw = JSON.stringify(envelope);
    this.storage.setItem(this.storageKey, raw);
    this.persistedRaw = raw;
    this.session = session;
    this.unlockedData = safeInitialData;
    this.unlocked = true;
    return cloneJson(safeInitialData);
  }

  async unlock(passphrase) {
    this.lock();
    const raw = this.storage.getItem(this.storageKey);
    if (raw === null) throw new Error("Vault does not exist.");
    let envelope;
    try { envelope = JSON.parse(raw); } catch { throw new Error("Stored vault is invalid."); }
    const session = await openEncryptedJsonSession(envelope, passphrase);
    const safeData = cloneJson(session.value);
    this.session = session;
    this.persistedRaw = raw;
    this.unlockedData = safeData;
    this.unlocked = true;
    return cloneJson(safeData);
  }

  async save(value) {
    if (!this.unlocked || !this.session) throw new Error("Unlock the vault before saving.");
    const safeValue = cloneJson(value);
    const expectedRaw = this.persistedRaw;
    const envelope = await this.session.encrypt(safeValue);
    if (this.storage.getItem(this.storageKey) !== expectedRaw) {
      throw new Error("Vault changed in another session; unlock it again before saving.");
    }
    const raw = JSON.stringify(envelope);
    this.storage.setItem(this.storageKey, raw);
    this.persistedRaw = raw;
    this.unlockedData = safeValue;
    return cloneJson(safeValue);
  }

  async saveWithPassphrase(passphrase, value) {
    if (!this.unlocked) throw new Error("Unlock the vault before saving.");
    const currentRaw = this.storage.getItem(this.storageKey);
    if (currentRaw === null) throw new Error("Vault does not exist.");
    const verifiedSession = await openEncryptedJsonSession(JSON.parse(currentRaw), passphrase);
    const safeValue = cloneJson(value);
    const envelope = await verifiedSession.encrypt(safeValue);
    if (this.storage.getItem(this.storageKey) !== currentRaw) {
      throw new Error("Vault changed in another session; unlock it again before saving.");
    }
    const raw = JSON.stringify(envelope);
    this.storage.setItem(this.storageKey, raw);
    this.persistedRaw = raw;
    this.session = verifiedSession;
    this.unlockedData = safeValue;
    return cloneJson(safeValue);
  }

  read() {
    if (!this.unlocked) throw new Error("Unlock the vault before reading.");
    return cloneJson(this.unlockedData);
  }

  lock() {
    this.unlockedData = null;
    this.session = null;
    this.persistedRaw = null;
    this.unlocked = false;
  }

  exportEnvelope() {
    const raw = this.storage.getItem(this.storageKey);
    if (raw === null) throw new Error("Vault does not exist.");
    return JSON.parse(raw);
  }

  async restoreEnvelope(passphrase, envelope) {
    const expectedRaw = this.storage.getItem(this.storageKey);
    const session = await openEncryptedJsonSession(envelope, passphrase);
    const restored = cloneJson(session.value);
    if (this.storage.getItem(this.storageKey) !== expectedRaw) {
      throw new Error("Vault changed in another session; reload before restoring a backup.");
    }
    const raw = JSON.stringify(envelope);
    this.storage.setItem(this.storageKey, raw);
    this.persistedRaw = raw;
    this.session = session;
    this.unlockedData = restored;
    this.unlocked = true;
    return cloneJson(restored);
  }

  clearStoredVault() {
    this.lock();
    this.storage.removeItem(this.storageKey);
  }
}
