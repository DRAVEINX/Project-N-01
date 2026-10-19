import { createNovaLifePostgresAuthorizedHandler } from "./novalife-authorized-handler.js";

// Keep the caregiver/parent/guardian API surface explicitly allow-listed.
// Administrative endpoints and client self-service endpoints must use their
// own separately reviewed route factories.
const CARE_PORTAL_RESOURCES = new Set([
  "care-portal",
  "care-plan",
  "care-note",
  "care-task",
  "care-report",
  "care-document",
  "medication-overview",
  "care-message",
  "care-roster",
  "care-team",
  "care-consent-record",
]);
const ACTIONS = new Set(["read", "create", "update", "delete", "manage"]);

/**
 * Create one authenticated, assignment/consent-checked care-portal API handler.
 *
 * resolveTargetClientId must resolve the target through trusted server-side
 * resource relationships. Never derive authorization from request body fields.
 * The supplied handler must scope all database reads/writes to context.clientId.
 * This creates a protected handler; it does not register a URL or deploy a server.
 */
export async function createNovaLifeCarePortalHandler({
  resource,
  action = "read",
  pool,
  authAudit,
  authorizationAudit,
  extractToken,
  resolveTargetClientId,
  handler,
  now,
  ttlMs,
} = {}) {
  if (!CARE_PORTAL_RESOURCES.has(resource)) {
    throw new TypeError("resource is not an allow-listed care-portal resource");
  }
  if (!ACTIONS.has(action)) {
    throw new TypeError("unsupported care-portal action");
  }
  if (typeof resolveTargetClientId !== "function") {
    throw new TypeError("a trusted resolveTargetClientId callback is required");
  }

  return createNovaLifePostgresAuthorizedHandler({
    pool,
    authAudit,
    authorizationAudit,
    extractToken,
    resolveTargetClientId,
    resource,
    action,
    handler,
    now,
    ttlMs,
  });
}

export const novaLifeCarePortalResources = Object.freeze([...CARE_PORTAL_RESOURCES]);
