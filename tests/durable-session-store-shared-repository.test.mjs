import test from "node:test";
import assert from "node:assert/strict";
import { createDurableSessionStore } from "../src/server/durable-session-store.js";

// Shared backing repository fixture: both adapters see the same records.
// A real database implementation must preserve these semantics across processes.
function sharedRepository() {
  const records = new Map();
  return {
    records,
    async put(digest, record) {
      if (records.has(digest)) throw new Error("duplicate session digest");
      records.set(digest, { ...record });
    },
    async get(digest) {
      const record = records.get(digest);
      return record ? { ...record } : null;
    },
    async delete(digest) {
      return records.delete(digest);
    },
    async deleteByActor(actorId) {
      let removed = 0;
      for (const [digest, record] of records) {
        if (record.actorId === actorId) {
          records.delete(digest);
          removed++;
        }
      }
      return removed;
    }
  };
}

function tokenSequence() {
  let sequence = 0;
  return () => (++sequence).toString().padStart(43, "A");
}

test("two store instances resolve and revoke sessions through shared storage", async () => {
  const repository = sharedRepository();
  const nextToken = tokenSequence();
  const first = createDurableSessionStore({ repository, createToken: nextToken });
  const second = createDurableSessionStore({ repository, createToken: nextToken });

  const session = await first.create("client-shared");
  assert.equal((await second.resolve(session.token)).actorId, "client-shared");

  assert.equal(await second.revoke(session.token), true);
  assert.equal(await first.resolve(session.token), null);
});

test("actor-wide revocation is visible to every store instance", async () => {
  const repository = sharedRepository();
  const nextToken = tokenSequence();
  const first = createDurableSessionStore({ repository, createToken: nextToken });
  const second = createDurableSessionStore({ repository, createToken: nextToken });

  const revoked = await first.create("client-a");
  const other = await second.create("client-a");
  const preserved = await second.create("client-b");

  assert.equal(await first.revokeAllForActor("client-a"), 2);
  assert.equal(await second.resolve(revoked.token), null);
  assert.equal(await second.resolve(other.token), null);
  assert.equal((await first.resolve(preserved.token)).actorId, "client-b");
});

test("a duplicate token digest fails without overwriting the existing session", async () => {
  const repository = sharedRepository();
  const repeatedToken = () => "A".repeat(43);
  const store = createDurableSessionStore({ repository, createToken: repeatedToken });

  const original = await store.create("client-original");
  await assert.rejects(() => store.create("client-unexpected"), /duplicate session digest/);

  assert.equal((await store.resolve(original.token)).actorId, "client-original");
  assert.equal(repository.records.size, 1);
});
