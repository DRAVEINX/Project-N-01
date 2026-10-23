import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseAccessTokenVerifier } from "./supabase-auth.mjs";
import { createAuthenticatedActorResolver } from "./actor-resolver.mjs";

const USER_ID = "123e4567-e89b-42d3-a456-426614174000";
const TOKEN = "synthetic-test-access-token-value-123456";

test("verified Supabase identity and trusted role lookup compose into a minimal actor", async () => {
  const calls = [];
  const verify = createSupabaseAccessTokenVerifier({
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_synthetic_test_key",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({
        id: USER_ID,
        user_metadata: { role: "admin" },
        app_metadata: { role: "admin" }
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });

  const resolveActor = createAuthenticatedActorResolver({
    verifyAccessToken: verify.verifyAuthorizationHeader,
    loadTrustedRole: async userId => {
      assert.equal(userId, USER_ID);
      return "client";
    }
  });

  const actor = await resolveActor(`Bearer ${TOKEN}`);
  assert.deepEqual(actor, { userId: USER_ID, role: "client" });
  assert.equal(calls.length, 1);
  assert.equal(Object.isFrozen(actor), true);
});

test("invalid Supabase token never triggers role lookup", async () => {
  let roleLookupCalled = false;
  const verify = createSupabaseAccessTokenVerifier({
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_synthetic_test_key",
    fetchImpl: async () => new Response("{}", { status: 401 })
  });
  const resolveActor = createAuthenticatedActorResolver({
    verifyAccessToken: verify.verifyAuthorizationHeader,
    loadTrustedRole: async () => { roleLookupCalled = true; return "admin"; }
  });

  await assert.rejects(resolveActor(`Bearer ${TOKEN}`));
  assert.equal(roleLookupCalled, false);
});
