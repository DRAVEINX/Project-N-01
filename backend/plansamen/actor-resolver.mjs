const ALLOWED_ROLES = new Set(["client", "caregiver", "guardian", "parent", "admin"]);

export class AuthorizationError extends Error {
  constructor(code = "FORBIDDEN") {
    super("The authenticated user is not authorized for this action.");
    this.name = "AuthorizationError";
    this.code = code;
  }
}

/**
 * Resolves an actor exclusively from a verified Auth identity and trusted
 * server-side role lookup. The lookup must read the authoritative profile
 * record; it must not use request JSON or user-editable user_metadata.
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
      role = await loadTrustedRole(identity.userId);
    } catch {
      // Fail closed without leaking database details.
      throw new AuthorizationError("AUTHORIZATION_STATE_UNAVAILABLE");
    }

    if (!ALLOWED_ROLES.has(role)) {
      throw new AuthorizationError("FORBIDDEN");
    }

    return Object.freeze({ userId: identity.userId, role });
  };
}
