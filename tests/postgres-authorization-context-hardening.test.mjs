import test from "node:test";
import assert from "node:assert/strict";
import { createPostgresAuthorizationContextLoader } from "../src/server/postgres-authorization-context.js";

function poolWith(responses) {
  const calls = [];
  return {
    calls,
    async query(sql, values) {
      calls.push({ sql, values });
      const result = responses[calls.length - 1];
      if (result instanceof Error) throw result;
      return result ?? { rows: [] };
    },
  };
}

const now = () => new Date("2026-10-20T12:00:00.000Z");
const caregiver = { id: "staff-1", role: "caregiver", active: true };

test("PostgreSQL authorization context excludes expired assignments and revoked or expired consent", async () => {
  const pool = poolWith([
    { rows: [{ client_id: "client-1" }, { client_id: "client-1" }, { client_id: "client-2" }] },
    { rows: [
      { scope: "care_plan" },
      { scope: "care_note" },
      { scope: "care_task" },
      { scope: "care_report" },
      { scope: "care_document" },
    ] },
  ]);
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => "client-1",
    now,
  });

  const context = await loader(caregiver, {});

  assert.deepEqual(context.assignedClientIds, ["client-1", "client-2"]);
  assert.deepEqual(context.grantedScopes, ["carePlan", "careNote", "careTask", "careReport", "careDocuments"]);
  assert.equal(context.clientId, "client-1");
  assert.equal(context.now, Date.parse("2026-10-20T12:00:00.000Z"));
  assert.match(pool.calls[0].sql, /active = TRUE/);
  assert.match(pool.calls[0].sql, /valid_until IS NULL OR valid_until > \$3/);
  assert.match(pool.calls[1].sql, /revoked_at IS NULL/);
  assert.match(pool.calls[1].sql, /expires_at IS NULL OR expires_at > \$3/);
});

test("PostgreSQL authorization context fails closed when assignment lookup fails", async () => {
  const pool = poolWith([new Error("database unavailable")]);
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => "client-1",
    now,
  });

  await assert.rejects(loader(caregiver, {}), /database unavailable/);
  assert.equal(pool.calls.length, 1);
});

test("PostgreSQL authorization context rejects an unsafe resolved client ID before database access", async () => {
  const pool = poolWith([]);
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async () => "client-1/other",
    now,
  });

  await assert.rejects(loader(caregiver, {}), /valid ID segment/);
  assert.equal(pool.calls.length, 0);
});

test("PostgreSQL authorization context does not query caregiver grants for client actors", async () => {
  const pool = poolWith([]);
  const loader = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId: async (actor) => actor.id,
    now,
  });

  const context = await loader({ id: "client-1", role: "client", active: true }, {});

  assert.equal(context.clientId, "client-1");
  assert.deepEqual(context.assignedClientIds, []);
  assert.deepEqual(context.grantedScopes, []);
  assert.equal(pool.calls.length, 0);
});
