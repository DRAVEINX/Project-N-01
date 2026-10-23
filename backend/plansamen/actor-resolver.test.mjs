import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError, createAuthenticatedActorResolver } from "./actor-resolver.mjs";

const USER_ID = "123e4567-e89b-42d3-a456-426614174000";

test("actor role is loaded from trusted server-side state", async () => {
  const seen = [];
  const resolveActor = createAuthenticatedActorResolver({
    verifyAccessToken: async header => {
      assert.equal(header, "Bearer verified-token");
      return { userId: USER_ID };
    },
    loadTrustedRole: async userId => {
      seen.push(userId);
      return "client";
    }
  });
  assert.deepEqual(await resolveActor("Bearer verified-token"), { userId: USER_ID, role: "client" });
  assert.deepEqual(seen, [USER_ID]);
});

test("client-supplied role or identity is never passed to authorization lookup", async () => {
  const resolveActor = createAuthenticatedActorResolver({
    verifyAccessToken: async () => ({ userId: USER_ID, role: "admin", user_metadata: { role: "admin" } }),
    loadTrustedRole: async userId => {
      assert.equal(userId, USER_ID);
      return "client";
    }
  });
  const actor = await resolveActor("Bearer verified-token");
  assert.equal(actor.role, "client");
  assert.equal(actor.userId, USER_ID);
  assert.equal(Object.isFrozen(actor), true);
});

test("unknown roles and missing profiles fail closed", async () => {
  for (const role of [null, undefined, "superadmin", "ADMIN", ""]) {
    const resolveActor = createAuthenticatedActorResolver({
      verifyAccessToken: async () => ({ userId: USER_ID }),
      loadTrustedRole: async () => role
    });
    await assert.rejects(resolveActor("Bearer verified-token"), AuthorizationError);
  }
});

test("database lookup errors become generic authorization errors", async () => {
  const resolveActor = createAuthenticatedActorResolver({
    verifyAccessToken: async () => ({ userId: USER_ID }),
    loadTrustedRole: async () => { throw new Error("database secret"); }
  });
  await assert.rejects(resolveActor("Bearer verified-token"), error => {
    assert.equal(error.code, "AUTHORIZATION_STATE_UNAVAILABLE");
    assert.equal(error.message, "The authenticated user is not authorized for this action.");
    assert.doesNotMatch(error.message, /database secret/);
    return true;
  });
});

test("unverified identity is rejected before role lookup", async () => {
  let lookupCalled = false;
  const resolveActor = createAuthenticatedActorResolver({
    verifyAccessToken: async () => null,
    loadTrustedRole: async () => { lookupCalled = true; return "admin"; }
  });
  await assert.rejects(resolveActor("Bearer forged"), AuthorizationError);
  assert.equal(lookupCalled, false);
});
