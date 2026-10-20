import test from "node:test";
import assert from "node:assert/strict";
import {
  createNovaLifeAssignment,
  deactivateNovaLifeAssignment,
} from "../src/server/private-assignment-provisioner.js";

function fakePool({
  accounts = [
    { id: "operator-1", role: "developer_admin", active: true },
    { id: "client-1", role: "client", active: true },
    { id: "caregiver-1", role: "caregiver", active: true },
    { id: "parent-1", role: "parent", active: true },
    { id: "guardian-1", role: "guardian", active: true },
    { id: "inactive-caregiver", role: "caregiver", active: false },
  ],
  existingAssignment = true,
  failOn = null,
} = {}) {
  const calls = [];
  const pg = {
    released: false,
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (failOn && sql.includes(failOn)) throw new Error("sensitive SQL failure");
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [], rowCount: 0 };
      if (sql.includes("SELECT id") && sql.includes("role = 'developer_admin'")) {
        const user = accounts.find((row) => row.id === values[0] &&
          row.role === "developer_admin" && row.active === true);
        return { rows: user ? [{ id: user.id }] : [] };
      }
      if (sql.includes("WHERE id = ANY($1::text[])")) {
        return { rows: accounts.filter((row) => values[0].includes(row.id)).map((row) => ({ ...row })) };
      }
      if (sql.includes("INSERT INTO novalife_client_assignments")) {
        const [id, actorId, clientId, role, active, validFrom, validUntil] = values;
        if (accounts.some((row) => row.id === actorId && row.active &&
            row.role === role) && accounts.some((row) => row.id === clientId &&
            row.active && row.role === "client")) {
          return { rowCount: 1, rows: [{
            id, actor_id: actorId, client_id: clientId, assignment_role: role, active,
            valid_from: validFrom, valid_until: validUntil,
          }] };
        }
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes("UPDATE novalife_client_assignments")) {
        return existingAssignment
          ? { rowCount: 1, rows: [{ client_id: "client-1" }] }
          : { rowCount: 0, rows: [] };
      }
      if (sql.includes("INSERT INTO novalife_audit_events")) return { rowCount: 1, rows: [] };
      return { rowCount: 0, rows: [] };
    },
    release() { this.released = true; },
  };
  return { calls, client: pg, async connect() { return pg; } };
}

test("requires a private administrative pool", async () => {
  await assert.rejects(createNovaLifeAssignment({
    actorId: "caregiver-1", clientId: "client-1", assignmentRole: "caregiver", operatorId: "operator-1",
  }), /private administrative PostgreSQL pool/);
});

test("creates an active care assignment with the operator and durable audit in one transaction", async () => {
  const pool = fakePool();
  const ids = ["assignment-1", "audit-1"];
  const result = await createNovaLifeAssignment({
    pool,
    actorId: "caregiver-1",
    clientId: "client-1",
    assignmentRole: "caregiver",
    operatorId: "operator-1",
    idFactory: () => ids.shift(),
    now: () => new Date("2026-10-20T10:00:00.000Z"),
  });

  assert.deepEqual(result, {
    id: "assignment-1",
    actorId: "caregiver-1",
    clientId: "client-1",
    role: "caregiver",
    active: true,
    validFrom: new Date("2026-10-20T10:00:00.000Z"),
    validUntil: null,
  });
  assert.equal(pool.calls[0].sql, "BEGIN");
  const insert = pool.calls.find((call) => call.sql.includes("INSERT INTO novalife_client_assignments"));
  assert.ok(insert);
  assert.deepEqual(insert.values, [
    "assignment-1", "caregiver-1", "client-1", "caregiver", true,
    new Date("2026-10-20T10:00:00.000Z"), null, "operator-1",
  ]);
  const audit = pool.calls.find((call) => call.sql.includes("INSERT INTO novalife_audit_events"));
  assert.ok(audit);
  assert.equal(audit.values[1], "operator-1");
  assert.equal(audit.values[2], "client-1");
  assert.equal(audit.values[3], "client-assignment");
  assert.equal(audit.values[4], "create");
  assert.equal(audit.values[5], "allow");
  assert.equal(audit.values[6], "private-admin-assignment-provisioning");
  assert.equal(pool.calls.at(-1).sql, "COMMIT");
  assert.equal(pool.client.released, true);
});

test("permits parent and guardian assignments only to matching active accounts", async () => {
  for (const role of ["parent", "guardian"]) {
    const pool = fakePool();
    const ids = ["assignment-" + role, "audit-" + role];
    const result = await createNovaLifeAssignment({
      pool,
      actorId: role + "-1",
      clientId: "client-1",
      assignmentRole: role,
      operatorId: "operator-1",
      idFactory: () => ids.shift(),
    });
    assert.equal(result.role, role);
  }
});

test("rejects self-assignments, unsupported roles and invalid time ranges before connecting", async () => {
  const pool = fakePool();
  const base = {
    pool,
    actorId: "caregiver-1",
    clientId: "client-1",
    assignmentRole: "caregiver",
    operatorId: "operator-1",
  };
  await assert.rejects(createNovaLifeAssignment({ ...base, actorId: "client-1" }), /cannot be assigned to itself/);
  await assert.rejects(createNovaLifeAssignment({ ...base, assignmentRole: "developer_admin" }), /must be caregiver, parent, or guardian/);
  await assert.rejects(createNovaLifeAssignment({
    ...base,
    validFrom: "2026-10-22T10:00:00.000Z",
    validUntil: "2026-10-21T10:00:00.000Z",
  }), /validity interval is invalid/);
  assert.equal(pool.calls.length, 0);
});

test("rejects an inactive or mismatched caregiver/client and rolls back", async () => {
  const pool = fakePool();
  const ids = ["assignment-1", "audit-1"];
  await assert.rejects(createNovaLifeAssignment({
    pool,
    actorId: "inactive-caregiver",
    clientId: "client-1",
    assignmentRole: "caregiver",
    operatorId: "operator-1",
    idFactory: () => ids.shift(),
  }), /assignment-provisioning-failed/);
  assert.ok(pool.calls.some((call) => call.sql === "ROLLBACK"));
  assert.equal(pool.calls.at(-1).sql, "ROLLBACK");
  assert.equal(pool.client.released, true);
});

test("rejects a non-active developer operator and never inserts a relationship", async () => {
  const pool = fakePool({ accounts: [{ id: "operator-1", role: "client", active: true }] });
  await assert.rejects(createNovaLifeAssignment({
    pool,
    actorId: "caregiver-1",
    clientId: "client-1",
    assignmentRole: "caregiver",
    operatorId: "operator-1",
  }), /assignment-provisioning-failed/);
  assert.equal(pool.calls.some((call) => call.sql.includes("INSERT INTO novalife_client_assignments")), false);
  assert.ok(pool.calls.some((call) => call.sql === "ROLLBACK"));
});

test("deactivates an active assignment and durably audits the change", async () => {
  const pool = fakePool({ existingAssignment: true });
  const ids = ["audit-revoke-1"];
  const result = await deactivateNovaLifeAssignment({
    pool,
    assignmentId: "assignment-1",
    operatorId: "operator-1",
    idFactory: () => ids.shift(),
  });
  assert.deepEqual(result, { deactivated: true });
  const update = pool.calls.find((call) => call.sql.includes("UPDATE novalife_client_assignments"));
  assert.deepEqual(update.values, ["assignment-1"]);
  const audit = pool.calls.find((call) => call.sql.includes("INSERT INTO novalife_audit_events"));
  assert.equal(audit.values[4], "deactivate");
  assert.equal(audit.values[5], "allow");
  assert.equal(audit.values[6], "private-admin-assignment-deactivation");
  assert.equal(pool.calls.at(-1).sql, "COMMIT");
});

test("audits attempts to deactivate missing or already inactive assignments", async () => {
  const pool = fakePool({ existingAssignment: false });
  const result = await deactivateNovaLifeAssignment({
    pool,
    assignmentId: "assignment-missing",
    operatorId: "operator-1",
    idFactory: () => "audit-deny-1",
  });
  assert.deepEqual(result, { deactivated: false });
  const audit = pool.calls.find((call) => call.sql.includes("INSERT INTO novalife_audit_events"));
  assert.equal(audit.values[4], "deactivate");
  assert.equal(audit.values[5], "deny");
  assert.equal(audit.values[6], "assignment-not-active-or-not-found");
  assert.equal(pool.calls.at(-1).sql, "COMMIT");
});

test("audit storage failure rolls assignment changes back", async () => {
  const pool = fakePool({ failOn: "INSERT INTO novalife_audit_events" });
  await assert.rejects(createNovaLifeAssignment({
    pool,
    actorId: "caregiver-1",
    clientId: "client-1",
    assignmentRole: "caregiver",
    operatorId: "operator-1",
    idFactory: () => "audit-fail",
  }), /assignment-provisioning-failed/);
  assert.ok(pool.calls.some((call) => call.sql === "ROLLBACK"));
  assert.equal(pool.calls.at(-1).sql, "ROLLBACK");
});
