import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createDurableSessionStore } from "../src/server/durable-session-store.js";

function repositoryFixture() {
  const records = new Map();
  return {
    records,
    async put(key, value) {
      if (records.has(key)) throw new Error("duplicate session digest");
      records.set(key, { ...value });
    },
    async get(key) {
      const value = records.get(key);
      return value ? { ...value } : null;
    },
    async delete(key) {
      return records.delete(key);
    },
    async deleteByActor(actorId) {
      let removed = 0;
      for (const [key, value] of records) {
        if (value.actorId === actorId) {
          records.delete(key);
          removed++;
        }
      }
      return removed;
    }
  };
}

function clockFixture() {
  let time = 1_800_000_000_000;
  return { now: () => time, advance: (ms) => { time += ms; } };
}

test("persists only a token digest and resolves the opaque session", async () => {
  const repository = repositoryFixture();
  const store = createDurableSessionStore({
    repository,
    createToken: () => "A".repeat(43),
    now: () => 1_800_000_000_000
  });
  const session = await store.create("caregiver-1");
  const digest = createHash("sha256").update(session.token).digest("hex");
  assert.equal(repository.records.has(digest), true);
  assert.equal([...repository.records.keys()].includes(session.token), false);
  assert.deepEqual(await store.resolve(session.token), {
    actorId: "caregiver-1",
    createdAt: session.createdAt,
    expiresAt: session.expiresAt
  });
  assert.equal("role" in (await store.resolve(session.token)), false);
});

test("rejects expired and revoked sessions", async () => {
  const repository = repositoryFixture();
  const clock = clockFixture();
  const store = createDurableSessionStore({
    repository, ttlMs: 1_000, now: clock.now,
    createToken: (() => { let i = 0; return () => String(++i).padStart(43, "A"); })()
  });
  const session = await store.create("client-1");
  clock.advance(1_000);
  assert.equal(await store.resolve(session.token), null);
  assert.equal(repository.records.size, 0);
  const active = await store.create("client-1");
  assert.equal(await store.revoke(active.token), true);
  assert.equal(await store.resolve(active.token), null);
});

test("revokes all sessions for one actor without affecting another", async () => {
  const repository = repositoryFixture();
  let sequence = 0;
  const store = createDurableSessionStore({
    repository, createToken: () => (++sequence).toString().padStart(43, "A")
  });
  const a = await store.create("client-a");
  const b = await store.create("client-a");
  const c = await store.create("client-b");
  assert.equal(await store.revokeAllForActor("client-a"), 2);
  assert.equal(await store.resolve(a.token), null);
  assert.equal(await store.resolve(b.token), null);
  assert.ok(await store.resolve(c.token));
});

test("fails closed on repository outage and rejects invalid configuration", async () => {
  const store = createDurableSessionStore({
    repository: {
      put: async () => {},
      get: async () => { throw new Error("datastore unavailable"); },
      delete: async () => true,
      deleteByActor: async () => 0
    }
  });
  await assert.rejects(() => store.resolve("A".repeat(43)), /datastore unavailable/);
  assert.throws(() => createDurableSessionStore({}), /repository/);
  assert.throws(() => createDurableSessionStore({
    repository: { put() {}, get() {}, delete() {}, deleteByActor() {} },
    ttlMs: 0
  }), /ttlMs/);
});

test("does not accept a malformed generated token", async () => {
  const store = createDurableSessionStore({
    repository: repositoryFixture(), createToken: () => "not-a-valid-token"
  });
  await assert.rejects(() => store.create("client-1"), /opaque base64url token/);
});
