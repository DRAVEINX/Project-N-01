import test from "node:test";
import assert from "node:assert/strict";
import { createSessionStore } from "../src/server/session-store.js";
import {
  createSessionAuthenticator,
  SessionResolutionUnavailableError
} from "../src/server/session-authenticator.js";
import { createAuthorizedHandler } from "../src/server/authorized-handler.js";

function fixture({ actor = { id: "caregiver-1", role: "caregiver", active: true }, loadActor } = {}) {
  const sessions = createSessionStore();
  const session = sessions.create("caregiver-1");
  const authenticator = createSessionAuthenticator({
    sessionStore: sessions,
    extractToken: (request) => request?.sessionToken,
    loadActor: loadActor ?? (async (id) => id === actor?.id ? actor : null)
  });
  return { sessions, session, authenticator };
}

test("resolves the current active actor from trusted account storage", async () => {
  const { session, authenticator } = fixture();
  assert.deepEqual(await authenticator({ sessionToken: session.token, body: { role: "admin", active: true } }), {
    id: "caregiver-1",
    role: "caregiver",
    active: true
  });
});

test("awaits asynchronous durable session-store resolution", async () => {
  const token = "t".repeat(43);
  let resolvedToken;
  const authenticator = createSessionAuthenticator({
    sessionStore: {
      async resolve(value) {
        resolvedToken = value;
        return { actorId: "caregiver-1", createdAt: 1, expiresAt: 9999999999999 };
      }
    },
    extractToken: (request) => request?.sessionToken,
    loadActor: async (id) => ({ id, role: "caregiver", active: true })
  });
  assert.deepEqual(await authenticator({ sessionToken: token }), {
    id: "caregiver-1",
    role: "caregiver",
    active: true
  });
  assert.equal(resolvedToken, token);
});

test("treats session-store outages as unavailable rather than invalid credentials", async () => {
  const authenticator = createSessionAuthenticator({
    sessionStore: { async resolve() { throw new Error("database offline"); } },
    extractToken: (request) => request?.sessionToken,
    loadActor: async () => { throw new Error("must not be called"); }
  });
  await assert.rejects(
    authenticator({ sessionToken: "t".repeat(43) }),
    SessionResolutionUnavailableError
  );
});

test("does not restore a stale role after the account role changes", async () => {
  let role = "caregiver";
  const { session, authenticator } = fixture({
    loadActor: async (id) => ({ id, role, active: true })
  });
  assert.equal((await authenticator({ sessionToken: session.token })).role, "caregiver");
  role = "client";
  assert.equal((await authenticator({ sessionToken: session.token })).role, "client");
});

test("rejects missing, unknown, and revoked session tokens without account lookup", async () => {
  let lookups = 0;
  const { session, sessions, authenticator } = fixture({
    loadActor: async (id) => { lookups++; return { id, role: "caregiver", active: true }; }
  });
  assert.equal(await authenticator({}), null);
  assert.equal(await authenticator({ sessionToken: "x".repeat(40) }), null);
  sessions.revoke(session.token);
  assert.equal(await authenticator({ sessionToken: session.token }), null);
  assert.equal(lookups, 0);
});

test("rejects deleted, disabled, mismatched, or role-less accounts", async (t) => {
  const invalidActors = [
    null,
    { id: "caregiver-1", role: "caregiver", active: false },
    { id: "another-account", role: "caregiver", active: true },
    { id: "caregiver-1", active: true }
  ];
  for (const actor of invalidActors) {
    await t.test(JSON.stringify(actor), async () => {
      const { session, authenticator } = fixture({ actor });
      assert.equal(await authenticator({ sessionToken: session.token }), null);
    });
  }
});

test("trusted account lookup outage is distinguishable from an invalid session", async () => {
  const { session, authenticator } = fixture({
    loadActor: async () => { throw new Error("storage offline"); }
  });
  await assert.rejects(
    authenticator({ sessionToken: session.token }),
    SessionResolutionUnavailableError
  );
});

test("authorized handler returns 503 and never reaches protected data when account lookup is unavailable", async () => {
  const { session, authenticator } = fixture({
    loadActor: async () => { throw new Error("storage offline"); }
  });
  let protectedCalls = 0;
  const run = createAuthorizedHandler({
    resource: "care-plan",
    action: "read",
    authenticate: authenticator,
    loadAuthorizationContext: async () => ({ clientId: "client-1", assignedClientIds: ["client-1"], grantedScopes: ["care"] }),
    audit: async () => {},
    handler: async () => { protectedCalls++; return { status: 200 }; }
  });
  assert.deepEqual(await run({ sessionToken: session.token }), {
    status: 503,
    body: { error: "authentication-unavailable" }
  });
  assert.equal(protectedCalls, 0);
});

test("authorized handler returns 503 on session repository outage without reaching protected data", async () => {
  const authenticator = createSessionAuthenticator({
    sessionStore: { async resolve() { throw new Error("database offline"); } },
    extractToken: (request) => request?.sessionToken,
    loadActor: async () => ({ id: "caregiver-1", role: "caregiver", active: true })
  });
  let protectedCalls = 0;
  const run = createAuthorizedHandler({
    resource: "care-plan",
    action: "read",
    authenticate: authenticator,
    loadAuthorizationContext: async () => ({ clientId: "client-1", assignedClientIds: ["client-1"], grantedScopes: ["care"] }),
    audit: async () => {},
    handler: async () => { protectedCalls++; return { status: 200 }; }
  });
  assert.deepEqual(await run({ sessionToken: "t".repeat(43) }), {
    status: 503,
    body: { error: "authentication-unavailable" }
  });
  assert.equal(protectedCalls, 0);
});
