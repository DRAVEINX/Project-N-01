const ALLOWED_ROLES = new Set(["client", "caregiver", "guardian", "parent", "admin"]);

export class AuthorizationError extends Error {
  constructor(code = "FORBIDDEN") {
    super("The authenticated user is not authorized for this action.");
    this.name = "AuthorizationError";
    this.code = code;
  }
}

/**
 * Resolves an actor from verified Auth identity plus a role loaded from
 * trusted server-side state. The Authorization header is forwarded only to
 * the role loader, which uses it for an RLS-scoped own-profile query.
 */
export function createAuthenticatedActorResolver({ verifyAccessToken, loadTrustedRole }) {
  if (typeof verifyAccessToken !== "function" || typeof loadTrustedRole !== "function") {
    throw new TypeError("Verified identity and trusted role lookup are required.");
  }

  return async function resolveActor(authorizationHeader) {
    const identity = await verifyAccessToken(authorizationHeader);
    if (!identity || typeof identity.userId !== "string" || !identity.userId.trim()) {
      throw new AuthorizationError("UNAUTHENTICATED");
    }

    let role;
    try {
      role = await loadTrustedRole(identity.userId, authorizationHeader);
    } catch {
      throw new AuthorizationError("AUTHORIZATION_STATE_UNAVAILABLE");
    }

    if (!ALLOWED_ROLES.has(role)) throw new AuthorizationError("FORBIDDEN");
    return Object.freeze({ userId: identity.userId, role });
  };
}
