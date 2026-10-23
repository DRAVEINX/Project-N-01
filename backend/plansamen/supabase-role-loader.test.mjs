import test from "node:test";
import assert from "node:assert/strict";
import { TrustedRoleLookupError, createSupabaseTrustedRoleLoader } from "./supabase-role-loader.mjs";

const USER_ID = "123e4567-e89b-42d3-a456-426614174000";
const TOKEN = "Bearer synthetic-test-access-token-value-123456";

function makeLoader(overrides = {}) {
  return createSupabaseTrustedRoleLoader({
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_synthetic_test_key",
    ...overrides
  });
}

test("queries only the authenticated user's role with RLS credentials", async () => {
  let request;
  const loader = makeLoader({ fetchImpl: async (url, options) => {
    request = { url: new URL(url), options };
    return new Response(JSON.stringify([{ role: "caregiver" }]), { status: 200 });
  } });
  assert.equal(await loader.loadTrustedRole(USER_ID, TOKEN), "caregiver");
  assert.equal(request.url.pathname, "/rest/v1/plansamen_profiles");
  assert.equal(request.url.searchParams.get("select"), "role");
  assert.equal(request.url.searchParams.get("user_id"), "eq." + USER_ID);
  assert.equal(request.options.headers.authorization, TOKEN);
  assert.equal(request.options.headers.apikey, "sb_publishable_synthetic_test_key");
});

test("rejects bad configuration and malformed identity or authorization before fetch", async () => {
  let calls = 0;
  const loader = makeLoader({ supabaseUrl: "http://bad.example", fetchImpl: async () => { calls++; } });
  assert.equal(loader.configured, false);
  for (const [id, token] of [[USER_ID, TOKEN], ["bad", TOKEN], [USER_ID, "Basic abc"], [USER_ID, "Bearer bad\r\nX: y"]]) {
    await assert.rejects(loader.loadTrustedRole(id, token), TrustedRoleLookupError);
  }
  assert.equal(calls, 0);
});

test("fails closed for HTTP errors, invalid JSON, absent or duplicate profiles, and invalid roles", async () => {
  const responses = [
    new Response("{}", { status: 403 }),
    new Response("not json", { status: 200 }),
    new Response("[]", { status: 200 }),
    new Response(JSON.stringify([{ role: "client" }, { role: "admin" }]), { status: 200 }),
    new Response(JSON.stringify([{ role: "superadmin" }]), { status: 200 })
  ];
  for (const response of responses) {
    const loader = makeLoader({ fetchImpl: async () => response });
    await assert.rejects(loader.loadTrustedRole(USER_ID, TOKEN), TrustedRoleLookupError);
  }
});

test("provider errors are not exposed", async () => {
  const loader = makeLoader({ fetchImpl: async () => { throw new Error("private database details"); } });
  await assert.rejects(loader.loadTrustedRole(USER_ID, TOKEN), error => {
    assert.equal(error.code, "AUTHORIZATION_STATE_UNAVAILABLE");
    assert.doesNotMatch(error.message, /private database details/);
    return true;
  });
});
