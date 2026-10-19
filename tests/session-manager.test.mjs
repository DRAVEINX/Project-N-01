import test from "node:test";
import assert from "node:assert/strict";
import { createSessionManager } from "../src/server/session-manager.js";

function setup({ active = true, now = 1_800_000_000_000, ttlMs = 60_000 } = {}) {
  const rows = new Map();
  const calls = { put: [], get: [], delete: [], actor: [] };
  const sessionRepository = {
    async put(digest, record) {
      calls.put.push({ digest, record });
      rows.set(digest, { ...record });
    },
    async get(digest) {
      calls.get.push(digest);
      return rows.get(digest) ?? null;
    },
    async delete(digest) {
      calls.delete.push(digest);
      return rows.delete(digest);
    },
  };
  const accountRepository = {
    async loadActor(id) {
      calls.actor.push(id);
      if (id !== "client-1") return null;
      return { id, role: "client", active };
    },
  };
  const manager = createSessionManager({
    sessionRepository,
    accountRepository,
    now: () => now,
    ttlMs,
  });
  return { manager, rows, calls };
}

test("requires repositories and a bounded session lifetime", () => {
  assert.throws(() => createSessionManager(), /required/);
  const { manager } = setup();
  assert.ok(manager);
  assert.throws(() => createSessionManager({
    sessionRepository: { put() {}, get() {}, delete() {} },
    accountRepository: { loadActor() {} },
    ttlMs: 1,
  }), /TTL/);
});

test("creates opaque bearer token but persists only its SHA-256 digest", async () => {
  const { manager, calls } = setup();
  const session = await manager.create("client-1");
  assert.match(session.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(session.actorId, "client-1");
  assert.equal(session.expiresAt, 1_800_000_060_000);
  assert.equal(calls.put.length, 1);
  assert.match(calls.put[0].digest, /^[a-f0-9]{64}$/);
  assert.notEqual(calls.put[0].digest, session.token);
  assert.equal(JSON.stringify(calls.put[0]).includes(session.token), false);
});

test("rejects actor IDs with surrounding whitespace before repository access", async () => {
  const { manager, calls } = setup();
  await assert.rejects(() => manager.create(" client-1 "), /surrounding whitespace/);
  await assert.rejects(() => manager.create("client-1 "), /surrounding whitespace/);
  await assert.rejects(() => manager.create(" client-1"), /surrounding whitespace/);
  assert.equal(calls.actor.length, 0);
  assert.equal(calls.put.length, 0);
});

test("authenticates an active actor and returns only minimal identity", async () => {
  const { manager } = setup();
  const session = await manager.create("client-1");
  assert.deepEqual(await manager.authenticate(session.token), {
    actor: { id: "client-1", role: "client" },
  });
});

test("rejects malformed, unknown and revoked tokens", async () => {
  const { manager } = setup();
  assert.equal(await manager.authenticate("not-a-token"), null);
  assert.equal(await manager.revoke("not-a-token"), false);
  const session = await manager.create("client-1");
  assert.equal(await manager.revoke(session.token), true);
  assert.equal(await manager.authenticate(session.token), null);
});

test("deletes sessions containing invalid persisted actor IDs without loading the actor", async () => {
  const { manager, rows, calls } = setup();
  const session = await manager.create("client-1");
  const digest = calls.put[0].digest;
  rows.set(digest, { actorId: " client-1 ", createdAt: 1_800_000_000_000, expiresAt: 1_800_000_060_000 });
  const actorCallsBefore = calls.actor.length;
  assert.equal(await manager.authenticate(session.token), null);
  assert.equal(calls.actor.length, actorCallsBefore);
  assert.equal(rows.has(digest), false);
});

test("deletes sessions with invalid timestamps before actor lookup", async () => {
  const { manager, rows, calls } = setup();
  const session = await manager.create("client-1");
  const digest = calls.put[0].digest;
  rows.set(digest, { actorId: "client-1", createdAt: 1_800_000_060_000, expiresAt: 1_800_000_030_000 });
  const actorCallsBefore = calls.actor.length;
  assert.equal(await manager.authenticate(session.token), null);
  assert.equal(calls.actor.length, actorCallsBefore);
  assert.equal(rows.has(digest), false);
});

test("expires sessions and removes their stored digest", async () => {
  let now = 1_800_000_000_000;
  const rows = new Map();
  const sessionRepository = {
    async put(digest, record) { rows.set(digest, record); },
    async get(digest) { return rows.get(digest) ?? null; },
    async delete(digest) { return rows.delete(digest); },
  };
  const accountRepository = {
    async loadActor(id) { return { id, role: "client", active: true }; },
  };
  const manager = createSessionManager({
    sessionRepository,
    accountRepository,
    now: () => now,
    ttlMs: 60_000,
  });
  const session = await manager.create("client-1");
  now += 60_000;
  assert.equal(await manager.authenticate(session.token), null);
  assert.equal(rows.size, 0);
});

test("does not create sessions for inactive or unknown actors", async () => {
  const inactive = setup({ active: false });
  await assert.rejects(() => inactive.manager.create("client-1"), /active trusted actor/);
  await assert.rejects(() => inactive.manager.create("unknown"), /active trusted actor/);
  assert.equal(inactive.calls.put.length, 0);
});

test("deletes session if account is later deactivated", async () => {
  let active = true;
  const rows = new Map();
  const sessionRepository = {
    async put(digest, record) { rows.set(digest, record); },
    async get(digest) { return rows.get(digest) ?? null; },
    async delete(digest) { return rows.delete(digest); },
  };
  const accountRepository = {
    async loadActor(id) { return { id, role: "caregiver", active }; },
  };
  const manager = createSessionManager({ sessionRepository, accountRepository });
  const session = await manager.create("client-1");
  active = false;
  assert.equal(await manager.authenticate(session.token), null);
  assert.equal(rows.size, 0);
});
