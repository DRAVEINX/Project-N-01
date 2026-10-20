import { randomUUID } from "node:crypto";

const OUTCOMES = new Set(["allow", "deny", "error"]);
const SAFE_FIELD = /^[^\u0000-\u001F\u007F]{1,256}$/;

function optionalSafeText(value, label) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.trim() !== value || !SAFE_FIELD.test(value)) {
    throw new TypeError(label + " must be a safe string of at most 256 characters");
  }
  return value;
}

function requiredSafeText(value, label) {
  const safe = optionalSafeText(value, label);
  if (safe === null || safe.length === 0) throw new TypeError(label + " is required");
  return safe;
}

function normalizeOutcome(value) {
  if (!OUTCOMES.has(value)) throw new TypeError("audit outcome must be allow, deny, or error");
  return value;
}

/**
 * Durable PostgreSQL audit writer for NovaLife's authentication and
 * authorization boundaries. Only a small allow-list of event fields is
 * persisted: credentials, tokens, request bodies, and care payloads are ignored.
 *
 * The supplied pool must be private to the trusted API process. Callers should
 * await each audit method; the API's authorization gate then fails closed if
 * the write fails.
 */
export function createPostgresAuditRepository({ pool, idFactory = randomUUID } = {}) {
  if (!pool || typeof pool.query !== "function") {
    throw new TypeError("pool.query is required");
  }
  if (typeof idFactory !== "function") throw new TypeError("idFactory must be a function");

  async function write({
    actorId = null,
    clientId = null,
    resource,
    action,
    outcome,
    reason,
    requestId = null,
  } = {}) {
    const id = requiredSafeText(idFactory(), "audit id");
    const safeActorId = optionalSafeText(actorId, "actorId");
    const safeClientId = optionalSafeText(clientId, "clientId");
    const safeResource = requiredSafeText(resource, "resource");
    const safeAction = requiredSafeText(action, "action");
    const safeOutcome = normalizeOutcome(outcome);
    const safeReason = requiredSafeText(reason, "reason");
    const safeRequestId = optionalSafeText(requestId, "requestId");

    await pool.query(
      `INSERT INTO novalife_audit_events
         (id, actor_id, client_id, resource, action, outcome, reason, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, safeActorId, safeClientId, safeResource, safeAction, safeOutcome, safeReason, safeRequestId]
    );
  }

  return Object.freeze({
    async authAudit(event) {
      if (!event || typeof event !== "object" || Array.isArray(event)) {
        throw new TypeError("auth audit event is required");
      }
      const action = requiredSafeText(event.event, "auth event");
      const outcome = normalizeOutcome(event.outcome);
      await write({
        actorId: event.actorId ?? null,
        clientId: null,
        resource: "auth",
        action,
        outcome,
        reason: typeof event.reason === "string" && event.reason.trim()
          ? event.reason
          : "authentication-event",
        requestId: event.requestId ?? null,
      });
    },

    async authorizationAudit(event) {
      if (!event || typeof event !== "object" || Array.isArray(event)) {
        throw new TypeError("authorization audit event is required");
      }
      await write({
        actorId: event.actorId ?? null,
        clientId: event.clientId ?? null,
        resource: event.resource,
        action: event.action,
        outcome: event.outcome,
        reason: event.reason,
        requestId: event.requestId ?? null,
      });
    },
  });
}
