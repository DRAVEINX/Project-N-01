import { authorize } from "../authorization-policy.js";
import { SessionResolutionUnavailableError } from "./session-authenticator.js";

/**
 * Creates a fail-closed authorization gate for server handlers.
 *
 * authenticate(request) must verify a session/token and return trusted actor data.
 * loadAuthorizationContext(actor, request) must load current assignments, consent,
 * and target client ID from trusted storage. Never implement either callback using
 * untrusted role/permission fields from request input.
 *
 * This is an integration primitive, not a complete authentication system or API
 * server. It intentionally has no default session provider or database adapter.
 */
export function createAuthorizedHandler({
  resource,
  action,
  authenticate,
  loadAuthorizationContext,
  audit,
  handler
} = {}) {
  if (typeof resource !== "string" || !resource ||
      typeof action !== "string" || !action ||
      typeof authenticate !== "function" ||
      typeof loadAuthorizationContext !== "function" ||
      typeof audit !== "function" ||
      typeof handler !== "function") {
    throw new TypeError("resource, action, authenticate, loadAuthorizationContext, audit and handler are required");
  }

  return async function authorizedHandler(request) {
    let actor;
    try {
      actor = await authenticate(request);
    } catch (error) {
      if (error instanceof SessionResolutionUnavailableError) {
        return { status: 503, body: { error: "authentication-unavailable" } };
      }
      return { status: 401, body: { error: "unauthenticated" } };
    }
    if (!actor || typeof actor.id !== "string" || !actor.id.trim()) {
      return { status: 401, body: { error: "unauthenticated" } };
    }

    let context;
    try {
      context = await loadAuthorizationContext(actor, request);
      if (!context || typeof context !== "object" || Array.isArray(context)) {
        throw new TypeError("Authorization context unavailable");
      }
    } catch {
      return { status: 503, body: { error: "authorization-unavailable" } };
    }

    const decision = authorize({
      actor,
      resource,
      action,
      clientId: context.clientId,
      assignedClientIds: context.assignedClientIds,
      grantedScopes: context.grantedScopes,
      breakGlass: context.breakGlass,
      now: context.now
    });

    const event = Object.freeze({
      actorId: actor.id,
      clientId: typeof context.clientId === "string" ? context.clientId : null,
      resource,
      action,
      outcome: decision.allowed ? "allow" : "deny",
      reason: decision.reason,
      requestId: typeof request?.requestId === "string" ? request.requestId : null
    });

    try {
      await audit(event);
    } catch {
      // Do not perform protected reads/writes if the audit boundary is unavailable.
      return { status: 503, body: { error: "authorization-unavailable" } };
    }

    if (!decision.allowed) {
      return { status: 403, body: { error: "forbidden" } };
    }

    return handler(request, Object.freeze({
      actor,
      clientId: context.clientId,
      authorization: decision
    }));
  };
}
