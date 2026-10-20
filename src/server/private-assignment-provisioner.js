import { randomUUID } from "node:crypto";
import { createPostgresAuditRepository } from "./postgres-audit-repository.js";

const ASSIGNMENT_ROLES = new Set(["caregiver", "parent", "guardian"]);
const SAFE_ID = /^[^\u0000-\u001F\u007F/\\?#]{1,200}$/;

function identifier(value, label) {
  if (typeof value !== "string" || value.trim() !== value || !SAFE_ID.test(value)) {
    throw new TypeError(label + " must be a safe identifier");
  }
  return value;
}

function timeValue(value, label, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new TypeError(label + " must be a valid date-time");
  return parsed;
}

async function trustedOperator(client, operatorId) {
  const result = await client.query(
    `SELECT id
       FROM novalife_accounts
      WHERE id = $1 AND role = 'developer_admin' AND active = TRUE
      LIMIT 1
      FOR SHARE`,
    [operatorId]
  );
  return result?.rows?.length === 1;
}

async function writeAudit(client, { operatorId, clientId, action, outcome, reason, idFactory }) {
  const audit = createPostgresAuditRepository({ pool: client, idFactory });
  await audit.authorizationAudit({
    actorId: operatorId,
    clientId: clientId ?? null,
    resource: "client-assignment",
    action,
    outcome,
    reason,
  });
}

export async function createNovaLifeAssignment({
  pool,
  actorId,
  clientId,
  assignmentRole,
  operatorId,
  idFactory = randomUUID,
  now = () => new Date(),
  validFrom,
  validUntil = null,
} = {}) {
  if (!pool || typeof pool.connect !== "function") {
    throw new TypeError("a private administrative PostgreSQL pool is required");
  }
  if (typeof idFactory !== "function" || typeof now !== "function") {
    throw new TypeError("idFactory and now must be functions");
  }
  identifier(actorId, "actorId");
  identifier(clientId, "clientId");
  identifier(operatorId, "operatorId");
  if (actorId === clientId) throw new TypeError("an account cannot be assigned to itself");
  if (!ASSIGNMENT_ROLES.has(assignmentRole)) {
    throw new TypeError("assignment role must be caregiver, parent, or guardian");
  }

  const clockValue = now();
  const currentTime = timeValue(clockValue, "now");
  const startsAt = timeValue(validFrom, "validFrom", currentTime);
  const endsAt = timeValue(validUntil, "validUntil");
  if (!startsAt || (endsAt && endsAt <= startsAt)) {
    throw new TypeError("assignment validity interval is invalid");
  }

  const assignmentId = identifier(idFactory(), "assignmentId");
  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;

    const operatorValid = await trustedOperator(client, operatorId);
    if (!operatorValid) throw new Error("assignment-provisioning-failed");

    const accounts = await client.query(
      `SELECT id, role, active
         FROM novalife_accounts
        WHERE id = ANY($1::text[])
        FOR SHARE`,
      [[actorId, clientId]]
    );
    const byId = new Map((accounts?.rows ?? []).map((row) => [row.id, row]));
    const actor = byId.get(actorId);
    const clientAccount = byId.get(clientId);
    if (!actor || actor.active !== true || actor.role !== assignmentRole ||
        !clientAccount || clientAccount.active !== true || clientAccount.role !== "client") {
      throw new Error("assignment-provisioning-failed");
    }

    const inserted = await client.query(
      `INSERT INTO novalife_client_assignments
         (id, actor_id, client_id, assignment_role, active, valid_from, valid_until, created_by)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7)
       RETURNING id, actor_id, client_id, assignment_role, active, valid_from, valid_until`,
      [assignmentId, actorId, clientId, assignmentRole, startsAt, endsAt, operatorId]
    );
    const row = inserted?.rows?.[0];
    if (!row) throw new Error("assignment-provisioning-failed");

    await writeAudit(client, {
      operatorId,
      clientId,
      action: "create",
      outcome: "allow",
      reason: "private-admin-assignment-provisioning",
      idFactory,
    });
    await client.query("COMMIT");
    transactionOpen = false;

    return Object.freeze({
      id: row.id,
      actorId: row.actor_id,
      clientId: row.client_id,
      role: row.assignment_role,
      active: row.active,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
    });
  } catch {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
    throw new Error("assignment-provisioning-failed");
  } finally {
    client.release();
  }
}

export async function deactivateNovaLifeAssignment({
  pool,
  assignmentId,
  operatorId,
  idFactory = randomUUID,
} = {}) {
  if (!pool || typeof pool.connect !== "function") {
    throw new TypeError("a private administrative PostgreSQL pool is required");
  }
  if (typeof idFactory !== "function") throw new TypeError("idFactory must be a function");
  identifier(assignmentId, "assignmentId");
  identifier(operatorId, "operatorId");

  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    if (!await trustedOperator(client, operatorId)) {
      throw new Error("assignment-deactivation-failed");
    }

    const updated = await client.query(
      `UPDATE novalife_client_assignments
          SET active = FALSE
        WHERE id = $1 AND active = TRUE
        RETURNING client_id, actor_id`,
      [assignmentId]
    );
    const row = updated?.rows?.[0];

    // Ending a relationship must permanently revoke its existing consent
    // grants. Otherwise those grants could become effective again if the same
    // person is assigned to this client at a later date.
    if (row) {
      const revoked = await client.query(
        `UPDATE novalife_consent_grants
            SET revoked_at = now()
          WHERE client_id = $1
            AND grantee_id = $2
            AND revoked_at IS NULL
          RETURNING id`,
        [row.client_id, row.actor_id]
      );
      for (const _grant of revoked?.rows ?? []) {
        await writeAudit(client, {
          operatorId,
          clientId: row.client_id,
          action: "delete",
          outcome: "allow",
          reason: "assignment-deactivation-revoked-consent",
          idFactory,
        });
      }
    }

    await writeAudit(client, {
      operatorId,
      clientId: row?.client_id ?? null,
      action: "deactivate",
      outcome: row ? "allow" : "deny",
      reason: row ? "private-admin-assignment-deactivation" : "assignment-not-active-or-not-found",
      idFactory,
    });
    await client.query("COMMIT");
    transactionOpen = false;
    return Object.freeze({ deactivated: Boolean(row) });
  } catch {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
    throw new Error("assignment-deactivation-failed");
  } finally {
    client.release();
  }
}

export const novaLifeAssignmentRoles = Object.freeze([...ASSIGNMENT_ROLES]);
