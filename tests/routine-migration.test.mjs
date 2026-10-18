import test from "node:test";
import assert from "node:assert/strict";
import { readLegacyRoutines, migrateLegacyRoutines, legacyRoutineStorageKey } from "../src/routine-migration.js";

class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function mockVault({ alterRead = false } = {}) {
  return {
    data: null,
    initialized: false,
    locked: false,
    async initialize(passphrase, data) {
      assert.equal(passphrase, "correct-horse-battery-123");
      if (this.initialized) throw new Error("already initialized");
      this.data = structuredClone(data);
      this.initialized = true;
    },
    read() {
      return alterRead ? { routines: [] } : structuredClone(this.data);
    },
    lock() { this.locked = true; }
  };
}

const passphrase = "correct-horse-battery-123";

test("legacy routine migration verifies encrypted copy and preserves plaintext source", async () => {
  const original = [
    { id: "morning", name: " Ochtend ", steps: [" Drink water ", "Aankleden"] },
    { id: "bad", name: "", steps: ["ignored"] }
  ];
  const storage = new MemoryStorage({ [legacyRoutineStorageKey]: JSON.stringify(original) });
  const before = storage.getItem(legacyRoutineStorageKey);
  const vault = mockVault();

  const result = await migrateLegacyRoutines({ storage, vault, passphrase });

  assert.equal(result.routineCount, 1);
  assert.equal(result.legacyDataPreserved, true);
  assert.ok(result.warnings.includes("empty-routine-skipped"));
  assert.equal(storage.getItem(legacyRoutineStorageKey), before);
  assert.deepEqual(vault.data, {
    routines: [{ id: "morning", name: "Ochtend", steps: ["Drink water", "Aankleden"] }]
  });
});

test("invalid legacy JSON is rejected without changing the source or initializing the vault", async () => {
  const storage = new MemoryStorage({ [legacyRoutineStorageKey]: "{broken-json" });
  const before = storage.getItem(legacyRoutineStorageKey);
  const vault = mockVault();

  assert.deepEqual(readLegacyRoutines(storage).warnings, ["invalid-json"]);
  await assert.rejects(
    migrateLegacyRoutines({ storage, vault, passphrase }),
    /original data was left untouched/
  );
  assert.equal(storage.getItem(legacyRoutineStorageKey), before);
  assert.equal(vault.initialized, false);
});

test("migration verification failure locks the vault and retains plaintext source", async () => {
  const storage = new MemoryStorage({
    [legacyRoutineStorageKey]: JSON.stringify([{ id: "r1", name: "Routine", steps: ["Step one"] }])
  });
  const before = storage.getItem(legacyRoutineStorageKey);
  const vault = mockVault({ alterRead: true });

  await assert.rejects(
    migrateLegacyRoutines({ storage, vault, passphrase }),
    /verification failed/
  );
  assert.equal(vault.locked, true);
  assert.equal(storage.getItem(legacyRoutineStorageKey), before);
});


test("migration locks the vault and preserves legacy data when read-back throws", async () => {
  const storage = new MemoryStorage({
    [legacyRoutineStorageKey]: JSON.stringify([{ id: "r1", name: "Routine", steps: ["Step one"] }])
  });
  const before = storage.getItem(legacyRoutineStorageKey);
  const vault = mockVault();
  vault.read = () => { throw new Error("storage read failed"); };

  await assert.rejects(
    migrateLegacyRoutines({ storage, vault, passphrase }),
    /verification failed/
  );
  assert.equal(vault.locked, true);
  assert.equal(storage.getItem(legacyRoutineStorageKey), before);
});
