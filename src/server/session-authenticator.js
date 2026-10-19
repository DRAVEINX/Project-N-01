/**
 * Resolves an opaque session token to the account's CURRENT trusted identity.
 *
 * Inject extractToken to adapt the HTTP framework. Never accept actor IDs, roles,
 * active flags, or permissions from request body/query/header fields as identity.
 * loadActor must query trusted account storage on every resolution.
 *
 * This adapter is framework-agnostic; it does not parse cookies or create sessions.
 */
export class SessionResolutionUnavailableError extends Error {
  constructor() {
    super("Trusted session or account lookup is unavailable");
    this.name = "SessionResolutionUnavailableError";
  }
}

export function createSessionAuthenticator({ sessionStore, extractToken, loadActor } = {}) {
  if (!sessionStore || typeof sessionStore.resolve !== "function" ||
      typeof extractToken !== "function" || typeof loadActor !== "function") {
    throw new TypeError("sessionStore.resolve, extractToken and loadActor are required");
  }

  return async function authenticateSession(request) {
    let token;
    try {
      token = extractToken(request);
    } catch {
      return null;
    }
    if (typeof token !== "string" || token.length < 32 || token.length > 256) return null;

    let session;
    try {
      // Must await: the durable session-store adapter is asynchronous.
      session = await sessionStore.resolve(token);
    } catch {
      // A storage outage is not the same as an invalid session. Fail closed
      // and let the HTTP authorization gate return service unavailable (503).
      throw new SessionResolutionUnavailableError();
    }
    if (!session || typeof session.actorId !== "string" || !session.actorId.trim()) return null;

    let actor;
    try {
      actor = await loadActor(session.actorId);
    } catch {
      throw new SessionResolutionUnavailableError();
    }

    // Fail closed if the account was deleted, disabled, changed identity, or
    // lacks a current role. Never restore role/status from the session record.
    if (!actor || actor.id !== session.actorId || actor.active !== true ||
        typeof actor.role !== "string" || !actor.role.trim()) {
      return null;
    }

    return Object.freeze({ id: actor.id, role: actor.role, active: true });
  };
}
