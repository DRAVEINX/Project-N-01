import test from "node:test";
import assert from "node:assert/strict";
import { AuthorizationError, createAuthenticatedActorResolver } from "./actor-resolver.mjs";

const USER_ID = "123e4567-e89b-42d3-a456-426614174000";

test("role lookup failure denies access without exposing internal errors", async () => {
  const resolveActor = createAuthenticatedActorResolver({
    verifyAccessToken: async () => ({ userId: USER_ID }),
    loadTrustedRole: async () => { throw new Error("private database details"); }
  });

  await assert.rejects(resolveActor("Bearer synthetic"), error => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.code, "AUTHORIZATION_STATE_UNAVAILABLE");
    assert.equal(error.message, "The authenticated user is not authorized for this action.");
    assert.doesNotMatch(error.message, /private database details/);
    return true;
  });
});

test("unknown or missing roles never receive an actor", async () => {
  for (const role of [undefined, null, "", "superadmin", { role: "admin" }]) {
    const resolveActor = createAuthenticatedActorResolver({
      verifyAccessToken: async () => ({ userId: USER_ID }),
      loadTrustedRole: async () => role
    });
    await assert.rejects(resolveActor("Bearer synthetic"), error =>
      error instanceof AuthorizationError && error.code === "FORBIDDEN");
  }
});

test("missing identity is rejected before querying the role store", async () => {
  let lookups = 0;
  const resolveActor = createAuthenticatedActorResolver({
    verifyAccessToken: async () => null,
    loadTrustedRole: async () => { lookups++; return "admin"; }
  });
  await assert.rejects(resolveActor("Bearer synthetic"), AuthorizationError);
  assert.equal(lookups, 0);
});
