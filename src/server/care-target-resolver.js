const CARE_ROLES = new Set(["caregiver", "parent", "guardian"]);

function validIdSegment(value) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 200 &&
    value.trim() === value &&
    !/[\u0000-\u001F\u007F/\\?#]/.test(value);
}

/**
 * Resolve a care API target using only a trusted authenticated actor and the
 * parsed route selector. The selector is NOT authorization: the downstream
 * authorization gate must still verify an active assignment and current scope
 * consent from PostgreSQL on every request.
 *
 * Client accounts may only resolve to their own immutable account ID. Legacy
 * unscoped routes resolve to null for care roles and therefore fail closed.
 * Developer-admin access is deliberately not provided by this resolver.
 */
export function createCareTargetResolver() {
  return async function resolveTargetClientId(actor, request) {
    if (!actor || !validIdSegment(actor.id) ||
        actor.active !== true || typeof actor.role !== "string") {
      return null;
    }

    const selector = request?.params?.targetClientId;
    if (actor.role === "client" || actor.role === "self") {
      if (selector !== null && selector !== undefined && selector !== actor.id) return null;
      return actor.id;
    }

    if (!CARE_ROLES.has(actor.role) || !validIdSegment(selector)) return null;
    return selector;
  };
}
