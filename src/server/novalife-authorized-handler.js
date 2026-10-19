import { createNovaLifePostgresAuth } from "./postgres-auth-runtime.js";
import { createAuthorizedHandler } from "./authorized-handler.js";

/**
 * Compose PostgreSQL-backed session authentication with the deny-by-default
 * authorization gate. Authorization facts and audit storage remain explicit
 * trusted deployment dependencies; this factory does not invent them.
 */
export async function createNovaLifePostgresAuthorizedHandler({
  pool,
  authAudit,
  authorizationAudit,
  extractToken,
  loadAuthorizationContext,
  resource,
  action,
  handler,
  now,
  ttlMs,
} = {}) {
  if (typeof resource !== "string" || !resource ||
      typeof action !== "string" || !action ||
      typeof extractToken !== "function" ||
      typeof loadAuthorizationContext !== "function" ||
      typeof authorizationAudit !== "function" ||
      typeof handler !== "function") {
    throw new TypeError(
      "resource, action, extractToken, loadAuthorizationContext, authorizationAudit and handler are required"
    );
  }

  const auth = await createNovaLifePostgresAuth({
    pool,
    audit: authAudit,
    now,
    ttlMs,
  });

  return createAuthorizedHandler({
    resource,
    action,
    authenticate: async (request) => {
      const token = extractToken(request);
      if (typeof token !== "string" || !token) return null;
      const result = await auth.authenticate(token);
      if (!result?.actor) return null;

      // A successful server-side session lookup proves this identity is active.
      // Privileged provisioning must be supplied separately by trusted storage;
      // it is deliberately not inferred from a role name.
      return Object.freeze({
        id: result.actor.id,
        role: result.actor.role,
        active: true,
      });
    },
    loadAuthorizationContext,
    audit: authorizationAudit,
    handler,
  });
}
