import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseAuthContext } from "./supabase-auth-context.mjs";

const userId = "123e4567-e89b-42d3-a456-426614174000";
const token = "a".repeat(32);

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test("composed auth context verifies identity before loading trusted role", async () => {
  const calls = [];
  const auth = createSupabaseAuthContext({
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_test",
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).includes("/auth/v1/user")) return jsonResponse({ id: userId });
      return jsonResponse([{ role: "caregiver" }]);
    }
  });

  assert.equal(auth.configured, true);
  const actor = await auth.authenticate(`Bearer ${token}`);
  assert.deepEqual(actor, { userId, role: "caregiver" });
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/auth\/v1\/user$/);
  assert.match(calls[1].url, /\/rest\/v1\/plansamen_profiles\?/);
  assert.equal(calls[1].options.headers.authorization, `Bearer ${token}`);
});

test("invalid access token stops before trusted role lookup", async () => {
  const calls = [];
  const auth = createSupabaseAuthContext({
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_test",
    fetchImpl: async (url) => {
      calls.push(String(url));
      return jsonResponse({ message: "invalid token" }, 401);
    }
  });

  await assert.rejects(auth.authenticate(`Bearer ${token}`), { code: "UNAUTHENTICATED" });
  assert.equal(calls.length, 1);
});

test("unconfigured context fails closed without network requests", async () => {
  let calls = 0;
  const auth = createSupabaseAuthContext({ fetchImpl: async () => { calls++; } });
  assert.equal(auth.configured, false);
  await assert.rejects(auth.authenticate(`Bearer ${token}`), { code: "AUTH_NOT_CONFIGURED" });
  assert.equal(calls, 0);
});

test("invalid role fails closed and does not create an actor", async () => {
  const auth = createSupabaseAuthContext({
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_test",
    fetchImpl: async (url) => String(url).includes("/auth/v1/user")
      ? jsonResponse({ id: userId })
      : jsonResponse([{ role: "superuser" }])
  });

  await assert.rejects(auth.authenticate(`Bearer ${token}`), { code: "AUTHORIZATION_STATE_UNAVAILABLE" });
});
