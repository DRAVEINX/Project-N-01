import test from "node:test";
import assert from "node:assert/strict";
import { createNovaLifeCareApiRouter } from "../src/server/care-api-router.js";

function fakePool() {
  const calls = [];
  return {
    calls,
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [], rowCount: 0 };
    },
  };
}

function dependencies(overrides = {}) {
  return {
    pool: fakePool(),
    authAudit: async () => {},
    authorizationAudit: async () => {},
    extractToken: (request) => {
      const value = request?.headers?.authorization;
      return typeof value === "string" && value.startsWith("Bearer ") ? value.slice(7) : null;
    },
    resolveTargetClientId: async () => null,
    ...overrides,
  };
}

test("login route validates method and request shape without exposing account provisioning", async () => {
  const deps = dependencies();
  const router = await createNovaLifeCareApiRouter(deps);
  assert.equal((await router.handle({ method: "GET", url: "/api/auth/login" })).status, 405);
  assert.deepEqual(await router.handle({ method: "POST", url: "/api/auth/login", body: { email: "x" } }), {
    status: 400,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
    body: { error: "invalid-login-request" },
  });
  assert.equal((await router.handle({ method: "POST", url: "/api/auth/register", body: {} })).status, 404);
  assert.equal(deps.pool.calls.length, 0, "invalid login payload must not query account storage");
});

test("login rejects arrays, missing fields, and oversized credentials before querying PostgreSQL", async () => {
  const deps = dependencies();
  const router = await createNovaLifeCareApiRouter(deps);
  const invalidBodies = [
    [],
    null,
    { email: "person@example.test" },
    { email: 42, password: "example-password" },
    { email: "person@example.test", password: 42 },
    { email: "x".repeat(321), password: "example-password" },
    { email: "person@example.test", password: "x".repeat(1025) },
  ];

  for (const body of invalidBodies) {
    const response = await router.handle({ method: "POST", url: "/api/auth/login", body });
    assert.equal(response.status, 400, "invalid login body should be rejected");
    assert.deepEqual(response.body, { error: "invalid-login-request" });
  }
  assert.equal(deps.pool.calls.length, 0, "invalid login bodies must not query account storage");
});

test("logout requires a bearer token and rejects unsupported methods", async () => {
  const router = await createNovaLifeCareApiRouter(dependencies());
  assert.equal((await router.handle({ method: "GET", url: "/api/auth/logout" })).status, 405);
  assert.deepEqual((await router.handle({ method: "POST", url: "/api/auth/logout", headers: {} })).body, {
    error: "unauthenticated",
  });
});

test("login uses the shared server authentication runtime and returns generic invalid credentials", async () => {
  const deps = dependencies();
  const router = await createNovaLifeCareApiRouter(deps);
  const response = await router.handle({
    method: "POST",
    url: "/api/auth/login",
    body: { email: "missing@example.test", password: "not-a-real-password" },
  });
  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { error: "invalid-credentials" });
  assert.ok(deps.pool.calls.some((call) => /novalife_accounts/.test(call.sql)));
});
