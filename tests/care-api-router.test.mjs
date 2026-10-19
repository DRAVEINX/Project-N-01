import test from "node:test";
import assert from "node:assert/strict";
import { createNovaLifeCareApiRouter } from "../src/server/care-api-router.js";

function fakePool() {
  const calls = [];
  return {
    calls,
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [] };
    },
  };
}

function dependencies(overrides = {}) {
  return {
    pool: fakePool(),
    authAudit: async () => {},
    authorizationAudit: async () => {},
    extractToken: () => null,
    resolveTargetClientId: async () => null,
    ...overrides,
  };
}

test("router requires a configured database and durable audit callbacks", async () => {
  await assert.rejects(createNovaLifeCareApiRouter({}), /configured PostgreSQL pool/);
  await assert.rejects(createNovaLifeCareApiRouter(dependencies({ authorizationAudit: null })), /durable authAudit and authorizationAudit/);
});

test("unknown resources and paths fail closed without database reads", async () => {
  const deps = dependencies();
  const router = await createNovaLifeCareApiRouter(deps);
  assert.equal((await router.handle({ method: "GET", url: "/api/care/admin-users" })).status, 404);
  assert.equal((await router.handle({ method: "GET", url: "/api/not-care/care-note" })).status, 404);
  assert.equal(deps.pool.calls.length, 0);
});

test("unsupported methods and collection/item method mismatches are rejected", async () => {
  const router = await createNovaLifeCareApiRouter(dependencies());
  assert.equal((await router.handle({ method: "TRACE", url: "/api/care/care-note" })).status, 405);
  assert.equal((await router.handle({ method: "POST", url: "/api/care/care-note/note-1", body: { text: "x" } })).status, 405);
  assert.equal((await router.handle({ method: "DELETE", url: "/api/care/care-note" })).status, 400);
});

test("unauthenticated care-data requests return 401 and never query the care repository", async () => {
  const deps = dependencies();
  const router = await createNovaLifeCareApiRouter(deps);
  const response = await router.handle({ method: "GET", url: "/api/care/care-note" });
  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { error: "unauthenticated" });
  assert.equal(deps.pool.calls.length, 0);
});
