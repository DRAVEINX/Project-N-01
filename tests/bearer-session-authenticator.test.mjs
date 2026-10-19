import test from "node:test";
import assert from "node:assert/strict";
import { createSessionStore } from "../src/server/session-store.js";
import { createBearerSessionAuthenticator } from "../src/server/bearer-session-authenticator.js";
import { createAuthorizedHandler } from "../src/server/authorized-handler.js";

test("valid bearer session resolves trusted current account and reaches authorized handler", async () => {
  const sessions = createSessionStore();
  const session = sessions.create("caregiver-1");
  const authenticate = createBearerSessionAuthenticator({
    sessionStore: sessions,
    loadActor: async (id) => ({ id, role: "caregiver", active: true })
  });
  let handled = 0;
  const run = createAuthorizedHandler({
    resource: "care-plan",
    action: "read",
    authenticate,
    loadAuthorizationContext: async () => ({
      clientId: "client-1",
      assignedClientIds: ["client-1"],
      grantedScopes: ["care"]
    }),
    audit: async () => {},
    handler: async (_request, context) => {
      handled++;
      return { status: 200, body: { actorId: context.actor.id } };
    }
  });

  assert.deepEqual(await run({
    headers: { authorization: `Bearer ${session.token}` }
  }), { status: 200, body: { actorId: "caregiver-1" } });
  assert.equal(handled, 1);
});

test("malformed bearer token is rejected before trusted account lookup", async () => {
  const sessions = createSessionStore();
  let lookups = 0;
  const authenticate = createBearerSessionAuthenticator({
    sessionStore: sessions,
    loadActor: async (id) => { lookups++; return { id, role: "caregiver", active: true }; }
  });
  assert.equal(await authenticate({ headers: { authorization: "Bearer not-a-real-token" } }), null);
  assert.equal(lookups, 0);
});

test("revoked bearer session cannot pass authentication", async () => {
  const sessions = createSessionStore();
  const session = sessions.create("caregiver-1");
  sessions.revoke(session.token);
  const authenticate = createBearerSessionAuthenticator({
    sessionStore: sessions,
    loadActor: async (id) => ({ id, role: "caregiver", active: true })
  });
  assert.equal(await authenticate({
    headers: { authorization: `Bearer ${session.token}` }
  }), null);
});

test("rejects invalid adapter configuration", () => {
  assert.throws(() => createBearerSessionAuthenticator({}), /required/);
});
