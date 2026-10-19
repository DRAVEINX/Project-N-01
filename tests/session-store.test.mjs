import test from "node:test";
import assert from "node:assert/strict";
import { createSessionStore } from "../src/server/session-store.js";

function clockFixture() {
  let time = 1_800_000_000_000;
  return { now: () => time, advance: (ms) => { time += ms; } };
}

test("creates opaque random sessions and resolves only the actor ID", () => {
  const store = createSessionStore();
  const first = store.create("client-1");
  const second = store.create("client-1");
  assert.notEqual(first.token, second.token);
  assert.ok(first.token.length >= 40);
  assert.deepEqual(store.resolve(first.token), {
    actorId: "client-1",
    createdAt: first.createdAt,
    expiresAt: first.expiresAt
  });
  assert.equal("role" in store.resolve(first.token), false);
});

test("does not resolve unknown, malformed, or revoked tokens", () => {
  const store = createSessionStore();
  const session = store.create("client-1");
  assert.equal(store.resolve("not-a-valid-token"), null);
  assert.equal(store.resolve("x".repeat(300)), null);
  assert.equal(store.revoke(session.token), true);
  assert.equal(store.resolve(session.token), null);
  assert.equal(store.revoke(session.token), false);
});

test("expired sessions are denied and purged", () => {
  const clock = clockFixture();
  const store = createSessionStore({ ttlMs: 1_000, now: clock.now });
  const session = store.create("client-1");
  clock.advance(999);
  assert.ok(store.resolve(session.token));
  clock.advance(1);
  assert.equal(store.resolve(session.token), null);
  assert.equal(store.size, 0);
});

test("can revoke all active sessions for one actor without affecting another", () => {
  const store = createSessionStore();
  const a = store.create("client-a");
  const b = store.create("client-a");
  const c = store.create("client-b");
  assert.equal(store.revokeAllForActor("client-a"), 2);
  assert.equal(store.resolve(a.token), null);
  assert.equal(store.resolve(b.token), null);
  assert.ok(store.resolve(c.token));
});

test("rejects invalid configuration and actor IDs", () => {
  assert.throws(() => createSessionStore({ ttlMs: 0 }), /ttlMs/);
  assert.throws(() => createSessionStore({ now: 5 }), /now/);
  const store = createSessionStore();
  assert.throws(() => store.create(" "), /actorId/);
});

test("expired sessions are cleaned when creating a new session", () => {
  const clock = clockFixture();
  const store = createSessionStore({ ttlMs: 10, now: clock.now });
  const old = store.create("client-old");
  clock.advance(10);
  store.create("client-new");
  assert.equal(store.resolve(old.token), null);
  assert.equal(store.size, 1);
});
