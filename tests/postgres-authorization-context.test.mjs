import test from "node:test";
import assert from "node:assert/strict";
import { createPostgresAuthorizationContextLoader } from "../src/server/postgres-authorization-context.js";

function fakePool(responses = []) {
  const calls = [];
  return {
    calls,
    async query(sql, values) {
      calls.push({ sql, values });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response ?? { rows: [] };
    }
  };
}

test("requires trusted pool and target resolver", () => {
  assert.throws(() => createPostgresAuthorizationContextLoader(), /pool.query, resolveTargetClientId and now are required/);
  assert.throws(() => createPostgresAuthorizationContextLoader({ pool: { query() {} } }), /resolveTargetClientId/);
});

test("loads current assignments and consent from PostgreSQL, never from request fields", async () => {
  const pool = fakePool([
    { rows: [{ client_id: "client-1" }, { client_id: "client-2" }] },
    { rows: [
      { scope: "care_plan" },
      { scope: "care_note" },
      { scope: "care_task" },
      { scope: "care_report" },
      { scope: "medication_overview" },
      { scope: "team" },
    ] },
  ]);
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async (actor) => actor.id === "staff-1" ? "client-1" : null,
    now: () => new Date("2026-10-19T10:00:00.000Z"),
  });
  const context = await loader(
    { id: "staff-1", role: "caregiver", active: true },
    { body: { clientId: "attacker-chosen", grantedScopes: ["*"] } }
  );
  assert.equal(context.clientId, "client-1");
  assert.deepEqual(context.assignedClientIds, ["client-1", "client-2"]);
  assert.deepEqual(context.grantedScopes, ["care", "medication", "careTeam"]);
  assert.deepEqual(pool.calls[0].values, ["staff-1", "caregiver", new Date("2026-10-19T10:00:00.000Z")]);
  assert.deepEqual(pool.calls[1].values, ["client-1", "staff-1", new Date("2026-10-19T10:00:00.000Z")]);
  assert.doesNotMatch(pool.calls[0].sql, /attacker-chosen/);
});

test("one granular core-care grant does not broaden into the general care scope", async () => {
  const pool = fakePool([
    { rows: [{ client_id: "client-1" }] },
    { rows: [{ scope: "care_plan" }] },
  ]);
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => "client-1",
    now: () => new Date("2026-10-19T10:00:00.000Z"),
  });
  const context = await loader({ id: "staff-1", role: "guardian", active: true }, {});
  assert.deepEqual(context.grantedScopes, []);
});

test("does not query care assignments for client roles and propagates storage failures", async () => {
  const pool = fakePool();
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async (actor) => actor.id,
  });
  const context = await loader({ id: "client-1", role: "client", active: true }, {});
  assert.equal(context.clientId, "client-1");
  assert.deepEqual(context.assignedClientIds, []);
  assert.deepEqual(context.grantedScopes, []);
  assert.equal(pool.calls.length, 0);

  const failingPool = fakePool([new Error("database unavailable")]);
  const failingLoader = createPostgresAuthorizationContextLoader({
    pool: failingPool,
    resolveTargetClientId: async () => "client-1",
  });
  await assert.rejects(
    failingLoader({ id: "caregiver-1", role: "caregiver", active: true }, {}),
    /database unavailable/
  );
});


test("maps each supported consent scope conservatively and ignores unknown or duplicate rows", async () => {
  const pool = fakePool([
    { rows: [{ client_id: "client-1" }] },
    { rows: [
      { scope: "care_plan" },
      { scope: "care_note" },
      { scope: "care_task" },
      { scope: "care_report" },
      { scope: "care_document" },
      { scope: "medication_overview" },
      { scope: "care_message" },
      { scope: "roster" },
      { scope: "team" },
      { scope: "care_document" },
      { scope: "unknown_admin_scope" },
      { scope: null },
    ] },
  ]);
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => "client-1",
    now: () => new Date("2026-10-19T10:00:00.000Z"),
  });
  const context = await loader({ id: "guardian-1", role: "guardian", active: true }, {});
  assert.deepEqual(context.grantedScopes, [
    "care", "careDocuments", "medication", "careMessages", "roster", "careTeam"
  ]);
  assert.equal(pool.calls.length, 2);
});

test("does not query consent without a resolved target and rejects malformed resolver results", async () => {
  const pool = fakePool([{ rows: [{ client_id: "client-1" }] }]);
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => null,
    now: () => new Date("2026-10-19T10:00:00.000Z"),
  });
  const context = await loader({ id: "caregiver-1", role: "caregiver", active: true }, {
    body: { clientId: "untrusted-client" }
  });
  assert.equal(context.clientId, null);
  assert.deepEqual(context.grantedScopes, []);
  assert.equal(pool.calls.length, 1);

  const malformedLoader = createPostgresAuthorizationContextLoader({
    pool: fakePool(),
    resolveTargetClientId: async () => "   ",
  });
  await assert.rejects(
    malformedLoader({ id: "caregiver-1", role: "caregiver", active: true }, {}),
    /target client resolver must return/
  );
});

test("rejects invalid clock values rather than loading permissions with an invalid timestamp", async () => {
  const pool = fakePool();
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => "client-1",
    now: () => new Date("invalid"),
  });
  await assert.rejects(
    loader({ id: "caregiver-1", role: "caregiver", active: true }, {}),
    /now returned an invalid time/
  );
  assert.equal(pool.calls.length, 0);
});


test("authorization SQL excludes future, expired, inactive, and revoked grants using one captured timestamp", async () => {
  const pool = fakePool([
    { rows: [{ client_id: "client-1" }] },
    { rows: [{ scope: "care_document" }] },
  ]);
  let clockCalls = 0;
  const fixedTime = new Date("2026-10-19T10:00:00.000Z");
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => "client-1",
    now: () => {
      clockCalls++;
      return fixedTime;
    },
  });

  const context = await loader(
    { id: "caregiver-1", role: "caregiver", active: true },
    { body: { clientId: "attacker-client", grantedScopes: ["*"] } }
  );

  assert.equal(clockCalls, 1);
  assert.match(pool.calls[0].sql, /active = TRUE/);
  assert.match(pool.calls[0].sql, /valid_from <= \$3/);
  assert.match(pool.calls[0].sql, /valid_until IS NULL OR valid_until > \$3/);
  assert.match(pool.calls[1].sql, /revoked_at IS NULL/);
  assert.match(pool.calls[1].sql, /granted_at <= \$3/);
  assert.match(pool.calls[1].sql, /expires_at IS NULL OR expires_at > \$3/);
  assert.deepEqual(pool.calls[0].values, ["caregiver-1", "caregiver", fixedTime]);
  assert.deepEqual(pool.calls[1].values, ["client-1", "caregiver-1", fixedTime]);
  assert.deepEqual(context.grantedScopes, ["careDocuments"]);
});

test("non-caregiver roles never query assignments or consent even when a target is resolved", async () => {
  const pool = fakePool();
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => "client-1",
  });
  const context = await loader({ id: "staff-1", role: "staff", active: true }, {});
  assert.equal(context.clientId, "client-1");
  assert.deepEqual(context.assignedClientIds, []);
  assert.deepEqual(context.grantedScopes, []);
  assert.equal(pool.calls.length, 0);
});


test("parent role loads its own active assignments and current consent", async () => {
  const pool = fakePool([
    { rows: [{ client_id: "client-1" }] },
    { rows: [{ scope: "care_plan" }, { scope: "care_note" }, { scope: "care_task" }, { scope: "care_report" }] },
  ]);
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => "client-1",
    now: () => new Date("2026-10-19T10:00:00.000Z"),
  });
  const context = await loader({ id: "parent-1", role: "parent", active: true }, {});

  assert.equal(pool.calls.length, 2);
  assert.deepEqual(pool.calls[0].values, ["parent-1", "parent", new Date("2026-10-19T10:00:00.000Z")]);
  assert.deepEqual(pool.calls[1].values, ["client-1", "parent-1", new Date("2026-10-19T10:00:00.000Z")]);
  assert.deepEqual(context.assignedClientIds, ["client-1"]);
  assert.deepEqual(context.grantedScopes, ["care"]);
});


test("assignment query applies valid_from predicate using a bound timestamp", async () => {
  const pool = fakePool([
    { rows: [{ client_id: "client-1" }] },
    { rows: [{ scope: "care_document" }] },
  ]);
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => "client-1",
    now: () => new Date("2026-10-19T10:00:00.000Z"),
  });
  await loader({ id: "caregiver-1", role: "caregiver", active: true }, {});

  assert.match(pool.calls[0].sql, /valid_from <= \$3/);
  assert.deepEqual(pool.calls[0].values, [
    "caregiver-1",
    "caregiver",
    new Date("2026-10-19T10:00:00.000Z")
  ]);
});
