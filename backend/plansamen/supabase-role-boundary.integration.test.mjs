import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseAccessTokenVerifier } from "./supabase-auth.mjs";
import { createSupabaseTrustedRoleLoader } from "./supabase-role-loader.mjs";
import { createAuthenticatedActorResolver, AuthorizationError } from "./actor-resolver.mjs";

const USER_ID = "123e4567-e89b-42d3-a456-426614174000";
const TOKEN = "synthetic-test-access-token-value-123456";

test("composes Supabase Auth verification with RLS-scoped trusted role lookup", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: new URL(url), options });
    if (new URL(url).pathname === "/auth/v1/user") {
      return new Response(JSON.stringify({
        id: USER_ID,
        user_metadata: { role: "admin" },
        app_metadata: { role: "admin" }
      }), { status: 200 });
    }
    return new Response(JSON.stringify([{ role: "client" }]), { status: 200 });
  };

  const auth = createSupabaseAccessTokenVerifier({
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_synthetic_test_key",
    fetchImpl
  });
  const roles = createSupabaseTrustedRoleLoader({
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_synthetic_test_key",
    fetchImpl
  });
  const resolveActor = createAuthenticatedActorResolver({
    verifyAccessToken: auth.verifyAuthorizationHeader,
    loadTrustedRole: roles.loadTrustedRole
  });

  const actor = await resolveActor("Bearer " + TOKEN);
  assert.deepEqual(actor, { userId: USER_ID, role: "client" });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url.pathname, "/auth/v1/user");
  assert.equal(requests[1].url.pathname, "/rest/v1/plansamen_profiles");
  assert.equal(requests[1].options.headers.authorization, "Bearer " + TOKEN);
});

test("invalid Auth token stops before the profile role lookup", async () => {
  const paths = [];
  const fetchImpl = async url => {
    paths.push(new URL(url).pathname);
    return new Response("{}", { status: 401 });
  };
  const auth = createSupabaseAccessTokenVerifier({
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_synthetic_test_key",
    fetchImpl
  });
  const roles = createSupabaseTrustedRoleLoader({
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_synthetic_test_key",
    fetchImpl
  });
  const resolveActor = createAuthenticatedActorResolver({
    verifyAccessToken: auth.verifyAuthorizationHeader,
    loadTrustedRole: roles.loadTrustedRole
  });

  await assert.rejects(resolveActor("Bearer " + TOKEN));
  assert.deepEqual(paths, ["/auth/v1/user"]);
});

test("role service outage becomes a generic authorization failure", async () => {
  const fetchImpl = async url => {
    if (new URL(url).pathname === "/auth/v1/user") {
      return new Response(JSON.stringify({ id: USER_ID }), { status: 200 });
    }
    throw new Error("internal service details");
  };
  const auth = createSupabaseAccessTokenVerifier({
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_synthetic_test_key",
    fetchImpl
  });
  const roles = createSupabaseTrustedRoleLoader({
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_synthetic_test_key",
    fetchImpl
  });
  const resolveActor = createAuthenticatedActorResolver({
    verifyAccessToken: auth.verifyAuthorizationHeader,
    loadTrustedRole: roles.loadTrustedRole
  });
  await assert.rejects(resolveActor("Bearer " + TOKEN), error => {
    assert.ok(error instanceof AuthorizationError);
    assert.equal(error.code, "AUTHORIZATION_STATE_UNAVAILABLE");
    assert.doesNotMatch(error.message, /internal service details/);
    return true;
  });
});
