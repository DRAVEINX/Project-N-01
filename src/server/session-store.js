import { createHash, randomBytes } from "node:crypto";

/**
 * In-memory opaque session-token store for development and tests.
 *
 * Only a SHA-256 digest of each random token is retained. This store is not
 * durable and does not provide account lookup, login/password verification,
 * CSRF protection, cookies, or distributed revocation. Production deployments
 * must replace it with a shared, durable store and load current account status
 * and role from trusted storage whenever a session is resolved.
 */
export function createSessionStore({ ttlMs = 30 * 60 * 1000, now = () => Date.now() } = {}) {
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1) {
    throw new TypeError("ttlMs must be a positive safe integer");
  }
  if (typeof now !== "function") {
    throw new TypeError("now must be a function");
  }

  const sessions = new Map();

  function digest(token) {
    return createHash("sha256").update(token, "utf8").digest("hex");
  }

  function purgeExpired(currentTime) {
    for (const [key, session] of sessions) {
      if (session.expiresAt <= currentTime) sessions.delete(key);
    }
  }

  return Object.freeze({
    create(actorId) {
      if (typeof actorId !== "string" || !actorId.trim()) {
        throw new TypeError("actorId is required");
      }
      const currentTime = now();
      if (!Number.isFinite(currentTime)) throw new TypeError("clock must return a finite timestamp");
      purgeExpired(currentTime);

      const token = randomBytes(32).toString("base64url");
      const key = digest(token);
      const session = Object.freeze({
        actorId,
        createdAt: currentTime,
        expiresAt: currentTime + ttlMs
      });
      sessions.set(key, session);
      return Object.freeze({ token, actorId, createdAt: session.createdAt, expiresAt: session.expiresAt });
    },

    resolve(token) {
      if (typeof token !== "string" || token.length < 32 || token.length > 256) return null;
      const currentTime = now();
      if (!Number.isFinite(currentTime)) throw new TypeError("clock must return a finite timestamp");
      const key = digest(token);
      const session = sessions.get(key);
      if (!session) return null;
      if (session.expiresAt <= currentTime) {
        sessions.delete(key);
        return null;
      }
      return Object.freeze({ actorId: session.actorId, createdAt: session.createdAt, expiresAt: session.expiresAt });
    },

    revoke(token) {
      if (typeof token !== "string" || token.length < 32 || token.length > 256) return false;
      return sessions.delete(digest(token));
    },

    revokeAllForActor(actorId) {
      if (typeof actorId !== "string" || !actorId.trim()) return 0;
      let removed = 0;
      for (const [key, session] of sessions) {
        if (session.actorId === actorId) {
          sessions.delete(key);
          removed++;
        }
      }
      return removed;
    },

    get size() {
      purgeExpired(now());
      return sessions.size;
    }
  });
}
