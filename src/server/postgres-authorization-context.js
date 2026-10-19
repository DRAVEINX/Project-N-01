const CONSENT_TO_POLICY_SCOPE = Object.freeze({
  care_document: "careDocuments",
  medication_overview: "medication",
  care_message: "careMessages",
  roster: "roster",
  team: "careTeam",
});

const CORE_CARE_SCOPES = Object.freeze([
  "care_plan",
  "care_note",
  "care_task",
  "care_report",
]);

function validActor(actor) {
  return actor && typeof actor.id === "string" && actor.id.trim() &&
    typeof actor.role === "string" && actor.active === true;
}

/**
 * Build a server-side authorization-context loader using PostgreSQL.
 *
 * resolveTargetClientId must resolve the target from trusted route/resource
 * relationships, not blindly copy a client ID from user-controlled input.
 * Return the actor's own ID for personal resources, or null when no target
 * exists. This loader never accepts assignments or consent from the request.
 */
export function createPostgresAuthorizationContextLoader({
  pool,
  resolveTargetClientId,
  now = () => new Date(),
} = {}) {
  if (!pool || typeof pool.query !== "function" ||
      typeof resolveTargetClientId !== "function" ||
      typeof now !== "function") {
    throw new TypeError("pool.query, resolveTargetClientId and now are required");
  }

  return async function loadAuthorizationContext(actor, request) {
    if (!validActor(actor)) throw new TypeError("trusted active actor is required");

    const target = await resolveTargetClientId(actor, request);
    if (target !== null && (typeof target !== "string" || !target.trim())) {
      throw new TypeError("target client resolver must return a non-empty ID or null");
    }

    const currentTime = now();
    const time = currentTime instanceof Date ? currentTime : new Date(currentTime);
    if (!Number.isFinite(time.getTime())) throw new TypeError("now returned an invalid time");

    let assignedClientIds = [];
    if (actor.role === "caregiver" || actor.role === "parent" || actor.role === "guardian") {
      const assignments = await pool.query(
        `SELECT client_id
           FROM novalife_client_assignments
          WHERE actor_id = $1
            AND assignment_role = $2
            AND active = TRUE
            AND valid_from <= $3
            AND (valid_until IS NULL OR valid_until > $3)`,
        [actor.id, actor.role, time]
      );
      assignedClientIds = (assignments?.rows ?? [])
        .map((row) => row?.client_id)
        .filter((id) => typeof id === "string" && id.trim().length > 0);
    }

    let grantedScopes = [];
    if (target !== null && (actor.role === "caregiver" || actor.role === "parent" || actor.role === "guardian")) {
      const consents = await pool.query(
        `SELECT scope
           FROM novalife_consent_grants
          WHERE client_id = $1
            AND grantee_id = $2
            AND revoked_at IS NULL
            AND granted_at <= $3
            AND (expires_at IS NULL OR expires_at > $3)`,
        [target, actor.id, time]
      );
      const scopes = new Set((consents?.rows ?? [])
        .map((row) => row?.scope)
        .filter((scope) => typeof scope === "string"));

      // The policy's "care" scope covers four resource families. Be
      // conservative: require every underlying explicit grant rather than
      // broadening a single granular consent into access to all care resources.
      if (CORE_CARE_SCOPES.every((scope) => scopes.has(scope))) {
        grantedScopes.push("care");
      }
      for (const [databaseScope, policyScope] of Object.entries(CONSENT_TO_POLICY_SCOPE)) {
        if (scopes.has(databaseScope)) grantedScopes.push(policyScope);
      }
    }

    return Object.freeze({
      clientId: target,
      assignedClientIds: Object.freeze(assignedClientIds),
      grantedScopes: Object.freeze(grantedScopes),
      now: time.getTime(),
    });
  };
}
