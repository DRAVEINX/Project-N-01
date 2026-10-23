import test from "node:test";
import assert from "node:assert/strict";
import { AuthenticationError, createSupabaseAccessTokenVerifier } from "./supabase-auth.mjs";

const TEST_USER_ID = "123e4567-e89b-42d3-a456-426614174000";
const TEST_TOKEN = "synthetic-test-access-token-value-123456";

function verifier(overrides = {}) {
  return createSupabaseAccessTokenVerifier({
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_synthetic_test_key",
    ...overrides
  });
}

test("verifier fails closed when Supabase configuration is missing or invalid", async () => {
  for (const config of [
    { supabaseUrl: "", publishableKey: "key" },
    { supabaseUrl: "http://evil.example", publishableKey: "key" },
    { supabaseUrl: "https://example.supabase.co", publishableKey: "" }
  ]) {
    const subject = verifier(config);
    assert.equal(subject.configured, false);
    await assert.rejects(subject.verifyAuthorizationHeader(`Bearer ${TEST_TOKEN}`), error =>
      error instanceof AuthenticationError && error.code === "AUTH_NOT_CONFIGURED");
  }
});

test("missing, malformed and oversized bearer tokens are rejected before network access", async () => {
  let calls = 0;
  const subject = verifier({ fetchImpl: async () => { calls++; throw new Error("must not call"); } });
  for (const header of [undefined, "", "Basic abc", "Bearer short", `Bearer ${"a".repeat(8200)}`, "Bearer abc\r\nX: y"]) {
    await assert.rejects(subject.verifyAuthorizationHeader(header), AuthenticationError);
  }
  assert.equal(calls, 0);
});

test("valid identity is fetched from Supabase Auth and only the user ID is returned", async () => {
  let request;
  const subject = verifier({
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        id: TEST_USER_ID,
        email: "synthetic@example.invalid",
        user_metadata: { role: "admin" },
        app_metadata: { role: "admin" }
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });

  const identity = await subject.verifyAuthorizationHeader(`Bearer ${TEST_TOKEN}`);
  assert.deepEqual(identity, { userId: TEST_USER_ID });
  assert.equal(request.url, "https://example.supabase.co/auth/v1/user");
  assert.equal(request.options.method, "GET");
  assert.equal(request.options.headers.apikey, "sb_publishable_synthetic_test_key");
  assert.equal(request.options.headers.authorization, `Bearer ${TEST_TOKEN}`);
  assert.equal("role" in identity, false);
});

test("Auth rejection and malformed Auth responses never create an identity", async () => {
  for (const response of [
    new Response("{}", { status: 401 }),
    new Response(JSON.stringify({ id: "not-a-uuid" }), { status: 200 }),
    new Response(JSON.stringify({ id: TEST_USER_ID, is_anonymous: true }), { status: 200 }),
    new Response("not json", { status: 200 })
  ]) {
    const subject = verifier({ fetchImpl: async () => response });
    await assert.rejects(subject.verifyAuthorizationHeader(`Bearer ${TEST_TOKEN}`), AuthenticationError);
  }
});

test("Auth provider network errors return a generic safe error", async () => {
  const subject = verifier({ fetchImpl: async () => { throw new Error("secret response and token"); } });
  await assert.rejects(subject.verifyAuthorizationHeader(`Bearer ${TEST_TOKEN}`), error => {
    assert.equal(error.code, "AUTH_PROVIDER_UNAVAILABLE");
    assert.equal(error.message, "A valid authenticated session is required.");
    assert.doesNotMatch(error.message, /secret response|token/);
    return true;
  });
});
