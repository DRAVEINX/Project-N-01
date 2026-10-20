/**
 * Server-side authorization policy for NovaLife.
 *
 * This module is deliberately pure and dependency-free so API handlers can use
 * it and tests can exercise it. It does not authenticate actors, persist audit
 * records, or protect anything unless every server endpoint calls it.
 */
const PERSONAL_SCOPES = Object.freeze({
  "profile": "profile",
  "mood-report": "mood",
  "journal": "journal",
  "drawing": "journal",
  "appointment": "calendar",
  "weekly-plan": "planning",
  "guide": "guides",
  "trusted-contact": "help",
  "consent-management": "consent"
});

const CARE_SCOPES = Object.freeze({
  "care-plan": "care",
  "care-note": "care",
  "care-task": "care",
  "care-report": "care",
  "care-document": "careDocuments",
  "medication-overview": "medication",
  "care-message": "careMessages",
  "care-roster": "roster",
  "care-team": "careTeam",
  "care-consent-record": "careConsents"
});

const CARE_ROLES = new Set(["caregiver", "parent", "guardian"]);
const VALID_ACTIONS = new Set(["read", "create", "update", "delete", "manage"]);

function deny(reason) {
  return Object.freeze({ allowed: false, reason });
}

function allow(reason) {
  return Object.freeze({ allowed: true, reason });
}

/**
 * @param {object} input
 * @param {{id:string, role:string, active?:boolean, provisioned?:boolean}} input.actor
 * @param {string} input.clientId Target client's immutable account ID.
 * @param {string} input.resource Resource key from the maps above, "care-portal",
 *   "admin-users", or "audit-log".
 * @param {string} input.action read/create/update/delete/manage
 * @param {string[]} [input.assignedClientIds] Server-loaded caregiver assignments.
 * @param {string[]} [input.grantedScopes] Server-loaded, unrevoked client consent.
 * @param {{active:boolean,reason:string,auditId:string,expiresAt:string}} [input.breakGlass]
 * @param {number} [input.now] Current epoch milliseconds, injectable for tests.
 */
export function authorize(input = {}) {
  const actor = input.actor;
  if (!actor || typeof actor.id !== "string" || !actor.id.trim()) return deny("missing-actor");
  if (actor.active !== true) return deny("inactive-account");
  if (!VALID_ACTIONS.has(input.action)) return deny("invalid-action");
  if (typeof input.resource !== "string" || !input.resource) return deny("invalid-resource");

  const role = actor.role;
  const isDeveloperAdmin = role === "developer_admin" && actor.provisioned === true;
  const isCareRole = CARE_ROLES.has(role);
  const clientId = input.clientId;
  const isOwnRecord = typeof clientId === "string" && clientId === actor.id;

  if (role === "developer_admin" && !isDeveloperAdmin) return deny("admin-not-provisioned");
  // Legacy "admin" labels are intentionally not trusted as administrator identity.
  if (role === "admin") return deny("legacy-admin-role-not-trusted");

  if (input.resource === "admin-users" || input.resource === "audit-log") {
    return isDeveloperAdmin ? allow("provisioned-developer-admin") : deny("admin-only-resource");
  }

  if (input.resource === "care-portal") {
    return isCareRole || isDeveloperAdmin
      ? allow(isDeveloperAdmin ? "admin-care-portal-management" : "care-role-portal")
      : deny("care-portal-role-required");
  }

  const scope = Object.hasOwn(PERSONAL_SCOPES, input.resource) ? PERSONAL_SCOPES[input.resource] : undefined;
  if (scope) {
    // Personal records support normal CRUD, but "manage" is a privileged
    // administrative action and must never be inferred from record ownership.
    if (input.action === "manage") return deny("personal-record-manage-not-allowed");
    if (!isOwnRecord) return deny("personal-record-owner-only");
    return role === "client" || role === "self"
      ? allow("own-personal-record")
      : deny("personal-resource-role-not-allowed");
  }

  const careScope = Object.hasOwn(CARE_SCOPES, input.resource) ? CARE_SCOPES[input.resource] : undefined;
  if (!careScope) return deny("unknown-resource");

  // Admin data access is a separately audited, time-limited emergency/support
  // grant; administrator UI access alone never implies access to client records.
  if (isDeveloperAdmin) {
    const grant = input.breakGlass;
    const now = Number.isFinite(input.now) ? input.now : Date.now();
    const expiry = grant && Date.parse(grant.expiresAt);
    if (input.action === "read" && grant && grant.active === true &&
        typeof grant.reason === "string" && grant.reason.trim().length >= 20 &&
        typeof grant.auditId === "string" && grant.auditId.trim() &&
        Number.isFinite(expiry) && expiry > now) {
      return allow("admin-time-limited-audited-support-grant");
    }
    return deny("admin-client-data-needs-audited-grant");
  }

  if (!isCareRole) return deny("care-role-required");
  if (typeof clientId !== "string" || !clientId) return deny("client-required");
  if (!Array.isArray(input.assignedClientIds) || !input.assignedClientIds.includes(clientId)) {
    return deny("client-not-assigned");
  }
  if (!Array.isArray(input.grantedScopes) || !input.grantedScopes.includes(careScope)) {
    return deny("scope-not-consented");
  }
  return allow("assigned-client-with-granted-scope");
}

export const authorizationResources = Object.freeze({
  personal: Object.freeze(Object.keys(PERSONAL_SCOPES)),
  care: Object.freeze(Object.keys(CARE_SCOPES)),
  admin: Object.freeze(["admin-users", "audit-log", "care-portal"])
});
