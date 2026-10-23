import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseActorContext } from "./supabase-actor-context.mjs";

const USER_ID = "123e4567-e89b-42d3-a456-426614174000";
const TOKEN = "synthetic-test-access-token-value-123456";

test("composed actor context verifies identity before loading RLS-scoped role", async () => {
  const calls = [];
  const context = createSupabaseActorContext({
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_synthetic_test_key",
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).includes("/auth/v1/user")) {
        return new Response(JSON.stringify({ id: USER_ID, user_metadata: { role: "admin" } }), {
          status: 200, headers: { "content-type": "application/json" }
        });
      }
      return new Response(JSON.stringify([{ role: "client" }]), {
        status: 200, headers: { "content-type": "application/json" }
      });
    }
  });

  assert.equal(context.configured, true);
  assert.deepEqual(await context.resolveActor(`Bearer ${TOKEN}`), { userId: USER_ID, role: "client" });
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/auth\/v1\/user$/);
  assert.match(calls[1].url, /\/rest\/v1\/plansamen_profiles\?/);
  assert.equal(calls[1].options.headers.authorization, `Bearer ${TOKEN}`);
  assert.equal(Object.isFrozen(context), true);
});

test("unconfigured actor context reports disabled and rejects requests closed", async () => {
  const context = createSupabaseActorContext({
    supabaseUrl: "not-a-url",
    publishableKey: ""
  });

  assert.equal(context.configured, false);
  await assert.rejects(context.resolveActor(`Bearer ${TOKEN}`));
});

test("Supabase user metadata cannot grant a role when profile lookup fails", async () => {
  const context = createSupabaseActorContext({
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_synthetic_test_key",
    fetchImpl: async url => {
      if (String(url).includes("/auth/v1/user")) {
        return new Response(JSON.stringify({
          id: USER_ID,
          user_metadata: { role: "admin" },
          app_metadata: { role: "admin" }
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("unavailable", { status: 503 });
    }
  });

  await assert.rejects(context.resolveActor(`Bearer ${TOKEN}`), error => {
    assert.equal(error.code, "AUTHORIZATION_STATE_UNAVAILABLE");
    return true;
  });
});


test("invalid access token stops before trusted role lookup", async () => {
  const calls = [];
  const context = createSupabaseActorContext({
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_synthetic_test_key",
    fetchImpl: async url => {
      calls.push(String(url));
      return new Response(JSON.stringify({ message: "invalid token" }), {
        status: 401, headers: { "content-type": "application/json" }
      });
    }
  });

  await assert.rejects(context.resolveActor(`Bearer ${TOKEN}`), error => {
    assert.equal(error.code, "UNAUTHENTICATED");
    return true;
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/auth\/v1\/user$/);
});

test("unknown database role is rejected even when the access token is valid", async () => {
  const calls = [];
  const context = createSupabaseActorContext({
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "sb_publishable_synthetic_test_key",
    fetchImpl: async url => {
      calls.push(String(url));
      const body = String(url).includes("/auth/v1/user")
        ? { id: USER_ID, user_metadata: { role: "admin" } }
        : [{ role: "superuser" }];
      return new Response(JSON.stringify(body), {
        status: 200, headers: { "content-type": "application/json" }
      });
    }
  });

  await assert.rejects(context.resolveActor(`Bearer ${TOKEN}`), error => {
    assert.equal(error.code, "AUTHORIZATION_STATE_UNAVAILABLE");
    return true;
  });
  assert.equal(calls.length, 2);
});
