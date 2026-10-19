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

test("client-scoped collection and item routes are recognized but still require authentication", async () => {
  const deps = dependencies();
  const router = await createNovaLifeCareApiRouter(deps);
  const collection = await router.handle({ method: "GET", url: "/api/care/clients/client-1/care-note" });
  const item = await router.handle({ method: "GET", url: "/api/care/clients/client-1/care-note/note-1" });
  assert.equal(collection.status, 401);
  assert.equal(item.status, 401);
  assert.deepEqual(collection.body, { error: "unauthenticated" });
  assert.deepEqual(item.body, { error: "unauthenticated" });
  assert.equal(deps.pool.calls.length, 0, "unauthenticated requests must not query care records");
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

test("malformed and overlong client selectors fail closed", async () => {
  const router = await createNovaLifeCareApiRouter(dependencies());
  assert.equal((await router.handle({ method: "GET", url: "/api/care/clients//care-note" })).status, 404);
  assert.equal((await router.handle({ method: "GET", url: "/api/care/clients/" + "x".repeat(201) + "/care-note" })).status, 404);
  assert.equal((await router.handle({ method: "GET", url: "/api/care/clients/client-1/care-note/extra/path" })).status, 404);
});


test("encoded unsafe route segments are rejected before authentication or database access", async () => {
  const deps = dependencies();
  const router = await createNovaLifeCareApiRouter(deps);
  for (const segment of ["client%3Fid", "client%23id", "client%5C%5Cid", "%20client", "client%20"]) {
    const response = await router.handle({
      method: "GET",
      url: `/api/care/clients/${segment}/care-note`,
    });
    assert.equal(response.status, 404, `expected unsafe selector ${segment} to be rejected`);
  }
  assert.equal(deps.pool.calls.length, 0);
});


test("encoded unsafe resource and record ID segments are rejected", async () => {
  const deps = dependencies();
  const router = await createNovaLifeCareApiRouter(deps);
  const unsafePaths = [
    "/api/care/clients/client-1/care%3Fnote",
    "/api/care/clients/client-1/care%23note",
    "/api/care/clients/client-1/care-note/note%2Fother",
    "/api/care/clients/client-1/care-note/note%5Cother",
    "/api/care/clients/client-1/care-note/%20note",
    "/api/care/clients/client-1/care-note/note%20",
  ];
  for (const url of unsafePaths) {
    assert.equal((await router.handle({ method: "GET", url })).status, 404, url);
  }
  assert.equal(deps.pool.calls.length, 0, "invalid paths must not query PostgreSQL");
});
