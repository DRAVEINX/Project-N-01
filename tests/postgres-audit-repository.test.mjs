import test from "node:test";
import assert from "node:assert/strict";
import { createPostgresAuditRepository } from "../src/server/postgres-audit-repository.js";

function fakePool({ error = null } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, values) {
      calls.push({ sql, values });
      if (error) throw error;
      return { rowCount: 1, rows: [] };
    },
  };
}

test("requires a PostgreSQL query pool", () => {
  assert.throws(() => createPostgresAuditRepository(), /pool.query is required/);
  assert.throws(() => createPostgresAuditRepository({ pool: {} }), /pool.query is required/);
});

test("writes authentication events using only approved fields", async () => {
  const pool = fakePool();
  const audit = createPostgresAuditRepository({ pool, idFactory: () => "audit-1" });

  await audit.authAudit({
    event: "login",
    outcome: "allow",
    actorId: "client-1",
    password: "never persist this",
    accessToken: "never persist this either",
    body: { clinical: "private" },
  });

  assert.equal(pool.calls.length, 1);
  assert.match(pool.calls[0].sql, /INSERT INTO novalife_audit_events/);
  assert.deepEqual(pool.calls[0].values, [
    "audit-1", "client-1", null, "auth", "login", "allow", "authentication-event", null,
  ]);
  assert.doesNotMatch(JSON.stringify(pool.calls[0]), /never persist|clinical/);
});

test("writes authorization decisions with actor, client, resource, reason and request ID", async () => {
  const pool = fakePool();
  const audit = createPostgresAuditRepository({ pool, idFactory: () => "audit-2" });

  await audit.authorizationAudit({
    actorId: "caregiver-1",
    clientId: "client-1",
    resource: "care-note",
    action: "read",
    outcome: "deny",
    reason: "scope-not-consented",
    requestId: "req-123",
    carePayload: { note: "private data" },
  });

  assert.deepEqual(pool.calls[0].values, [
    "audit-2", "caregiver-1", "client-1", "care-note",
    "read", "deny", "scope-not-consented", "req-123",
  ]);
  assert.doesNotMatch(JSON.stringify(pool.calls[0]), /private data/);
});

test("rejects malformed event data before any query", async () => {
  const pool = fakePool();
  const audit = createPostgresAuditRepository({ pool, idFactory: () => "audit-3" });

  await assert.rejects(audit.authAudit({ event: "login", outcome: "maybe" }), /outcome/);
  await assert.rejects(audit.authorizationAudit({
    resource: "care-note", action: "read", outcome: "allow",
    reason: "unsafe\nreason",
  }), /safe string/);
  await assert.rejects(audit.authorizationAudit({
    resource: "care-note", action: "read", outcome: "allow",
    reason: "allowed", actorId: " bad actor ",
  }), /safe string/);
  assert.equal(pool.calls.length, 0);
});

test("propagates audit storage failures so protected handlers can fail closed", async () => {
  const pool = fakePool({ error: new Error("database down") });
  const audit = createPostgresAuditRepository({ pool, idFactory: () => "audit-4" });
  await assert.rejects(
    audit.authorizationAudit({
      resource: "care-note", action: "read", outcome: "allow", reason: "allowed",
    }),
    /database down/
  );
});
