import test from "node:test";
import assert from "node:assert/strict";
import { createPostgresAuthorizationContextLoader } from "../src/server/postgres-authorization-context.js";
import { authorize } from "../src/authorization-policy.js";

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
    { rows: [{ client_id: "client-1" }, { client_id: "client-2" }, { client_id: " client-3 " }, { client_id: "client-2" }, { client_id: "" }, { client_id: null }] },
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
  assert.deepEqual(context.assignedClientIds, ["client-1", "client-2"], "padded and duplicate database IDs must not become assignment grants");
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

test("trusted actor IDs containing embedded control characters fail closed before database access", async () => {
  const pool = fakePool();
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => "client-1",
  });

  for (const id of ["caregiver-\n1", "caregiver-\u0000x", "caregiver-\u007Fx"]) {
    await assert.rejects(
      loader({ id, role: "caregiver", active: true }, {}),
      /trusted active actor is required/
    );
  }
  assert.equal(pool.calls.length, 0);
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

test("assignment loader ignores malformed client IDs returned by the database", async () => {
  const pool = fakePool([
    { rows: [
      { client_id: "client-1" },
      { client_id: "" },
      { client_id: "   " },
      { client_id: null },
      { client_id: 42 },
      {},
      { client_id: "client-2" },
      { client_id: "client-\n2" },
      { client_id: "client-\u0000x" },
      { client_id: " client-3 " },
      { client_id: "client-2" },
    ] },
    { rows: [{ scope: "care_document" }] },
  ]);
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => "client-1",
    now: () => new Date("2026-10-19T10:00:00.000Z"),
  });

  const context = await loader(
    { id: "caregiver-1", role: "caregiver", active: true },
    {}
  );

  assert.deepEqual(context.assignedClientIds, ["client-1", "client-2"]);
  assert.equal(Object.isFrozen(context.assignedClientIds), true);
});


test("maps the explicit care-consent record grant to the exact policy scope", async () => {
  const pool = fakePool([
    { rows: [{ client_id: "client-1" }] },
    { rows: [{ scope: "care_consents" }] },
  ]);
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => "client-1",
    now: () => new Date("2026-10-19T10:00:00.000Z"),
  });
  const context = await loader({ id: "caregiver-1", role: "caregiver", active: true }, {});

  assert.deepEqual(context.grantedScopes, ["careConsents"]);
  assert.equal(authorize({
    actor: { id: "caregiver-1", role: "caregiver", active: true },
    resource: "care-consent-record",
    action: "read",
    clientId: context.clientId,
    assignedClientIds: context.assignedClientIds,
    grantedScopes: context.grantedScopes,
  }).allowed, true, "database consent mapping must satisfy the exact policy scope");
});


test("every care portal data resource maps to the exact policy scope and remains assignment-gated", async (t) => {
  const cases = [
    { resource: "care-plan", grants: ["care_plan", "care_note", "care_task", "care_report"] },
    { resource: "care-note", grants: ["care_plan", "care_note", "care_task", "care_report"] },
    { resource: "care-task", grants: ["care_plan", "care_note", "care_task", "care_report"] },
    { resource: "care-report", grants: ["care_plan", "care_note", "care_task", "care_report"] },
    { resource: "care-document", grants: ["care_document"] },
    { resource: "medication-overview", grants: ["medication_overview"] },
    { resource: "care-message", grants: ["care_message"] },
    { resource: "care-roster", grants: ["roster"] },
    { resource: "care-team", grants: ["team"] },
    { resource: "care-consent-record", grants: ["care_consents"] },
  ];

  for (const scenario of cases) {
    await t.test(scenario.resource, async () => {
      const pool = fakePool([
        { rows: [{ client_id: "client-1" }] },
        { rows: scenario.grants.map((scope) => ({ scope })) },
      ]);
      const loader = createPostgresAuthorizationContextLoader({
        pool,
        resolveTargetClientId: async () => "client-1",
        now: () => new Date("2026-10-19T10:00:00.000Z"),
      });
      const context = await loader({ id: "caregiver-1", role: "caregiver", active: true }, {});
      const allowed = authorize({
        actor: { id: "caregiver-1", role: "caregiver", active: true },
        resource: scenario.resource,
        action: "read",
        clientId: context.clientId,
        assignedClientIds: context.assignedClientIds,
        grantedScopes: context.grantedScopes,
      });
      assert.equal(allowed.allowed, true, `expected matching explicit grants to allow ${scenario.resource}`);

      const unassigned = authorize({
        actor: { id: "caregiver-1", role: "caregiver", active: true },
        resource: scenario.resource,
        action: "read",
        clientId: "client-not-assigned",
        assignedClientIds: context.assignedClientIds,
        grantedScopes: context.grantedScopes,
      });
      assert.equal(unassigned.allowed, false, "consent alone must not bypass client assignment");
      assert.equal(unassigned.reason, "client-not-assigned");
    });
  }
});

test("wildcard database grant cannot produce consent scopes or authorize care access", async (t) => {
  for (const role of ["caregiver", "parent", "guardian"]) {
    await t.test(role, async () => {
      const pool = fakePool([
        { rows: [{ client_id: "client-1" }] },
        { rows: [{ scope: "*" }] },
      ]);
      const loader = createPostgresAuthorizationContextLoader({
        pool,
        resolveTargetClientId: async () => "client-1",
        now: () => new Date("2026-10-19T10:00:00.000Z"),
      });
      const actor = { id: role + "-wildcard-db", role, active: true };
      const context = await loader(actor, {});
      assert.deepEqual(context.grantedScopes, []);

      const decision = authorize({
        actor,
        resource: "care-plan",
        action: "read",
        clientId: context.clientId,
        assignedClientIds: context.assignedClientIds,
        grantedScopes: context.grantedScopes,
      });
      assert.equal(decision.allowed, false);
      assert.equal(decision.reason, "scope-not-consented");
    });
  }
});

test("rejects whitespace-padded target IDs before querying PostgreSQL", async () => {
  const pool = fakePool();
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => " client-1 ",
    now: () => new Date("2026-10-19T10:00:00.000Z"),
  });

  await assert.rejects(
    loader({ id: "caregiver-1", role: "caregiver", active: true }, {}),
    /target client resolver must return a trimmed, non-empty ID or null/
  );
  assert.equal(pool.calls.length, 0, "invalid target must fail before assignment or consent queries");
});

test("rejects whitespace-padded trusted actor IDs before querying PostgreSQL", async () => {
  const pool = fakePool();
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => "client-1",
  });

  await assert.rejects(
    loader({ id: " caregiver-1 ", role: "caregiver", active: true }, {}),
    /trusted active actor is required/
  );
  assert.equal(pool.calls.length, 0);
});


test("real authorization context denies consent when the selected client is not assigned to the actor", async () => {
  const pool = fakePool([
    { rows: [{ client_id: "another-client" }] },
    { rows: [
      { scope: "care_plan" },
      { scope: "care_note" },
      { scope: "care_task" },
      { scope: "care_report" },
    ] },
  ]);
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => "client-not-assigned",
    now: () => new Date("2026-10-19T10:00:00.000Z"),
  });
  const actor = { id: "caregiver-1", role: "caregiver", active: true };
  const context = await loader(actor, { params: { targetClientId: "client-not-assigned" } });

  assert.deepEqual(context.assignedClientIds, ["another-client"]);
  assert.deepEqual(context.grantedScopes, ["care"]);
  const decision = authorize({
    actor,
    resource: "care-plan",
    action: "read",
    clientId: context.clientId,
    assignedClientIds: context.assignedClientIds,
    grantedScopes: context.grantedScopes,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "client-not-assigned");
  assert.deepEqual(pool.calls[0].values, [
    "caregiver-1",
    "caregiver",
    new Date("2026-10-19T10:00:00.000Z"),
  ]);
  assert.deepEqual(pool.calls[1].values, [
    "client-not-assigned",
    "caregiver-1",
    new Date("2026-10-19T10:00:00.000Z"),
  ]);
});


test("consent storage outage fails closed after assignment lookup", async () => {
  const pool = fakePool([
    { rows: [{ client_id: "client-1" }] },
    new Error("consent database unavailable"),
  ]);
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => "client-1",
    now: () => new Date("2026-10-19T10:00:00.000Z"),
  });

  await assert.rejects(
    loader({ id: "caregiver-consent-outage", role: "caregiver", active: true }, {}),
    /consent database unavailable/
  );
  assert.equal(pool.calls.length, 2);
  assert.match(pool.calls[1].sql, /revoked_at IS NULL/);
});


test("assignment storage outage fails closed without querying consent storage", async () => {
  const pool = fakePool([
    new Error("assignment database unavailable"),
    { rows: [{ scope: "care_plan" }, { scope: "care_note" }, { scope: "care_task" }, { scope: "care_report" }] },
  ]);
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => "client-1",
    now: () => new Date("2026-10-19T10:00:00.000Z"),
  });

  await assert.rejects(
    loader({ id: "caregiver-assignment-outage", role: "caregiver", active: true }, {}),
    /assignment database unavailable/
  );
  assert.equal(pool.calls.length, 1, "consent storage must not be queried after assignment lookup fails");
  assert.match(pool.calls[0].sql, /novalife_client_assignments/);
});
