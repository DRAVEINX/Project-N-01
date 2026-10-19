import { createHash, randomBytes } from "node:crypto";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function digestToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Create a session service around a repository that persists only SHA-256
 * token digests. The raw bearer token is returned once to the caller and is
 * never passed to the repository.
 */
export function createSessionManager({
  sessionRepository,
  accountRepository,
  now = () => Date.now(),
  ttlMs = 8 * 60 * 60 * 1000,
} = {}) {
  if (!sessionRepository ||
      typeof sessionRepository.put !== "function" ||
      typeof sessionRepository.get !== "function" ||
      typeof sessionRepository.delete !== "function" ||
      !accountRepository || typeof accountRepository.loadActor !== "function") {
    throw new TypeError("sessionRepository and accountRepository are required");
  }
  if (typeof now !== "function" || !Number.isSafeInteger(ttlMs) ||
      ttlMs < 60_000 || ttlMs > 30 * 24 * 60 * 60 * 1000) {
    throw new TypeError("now and a TTL between 1 minute and 30 days are required");
  }

  return Object.freeze({
    async create(actorId) {
      if (typeof actorId !== "string" || !actorId.trim() || actorId !== actorId.trim()) {
        throw new TypeError("actorId is required and must not have surrounding whitespace");
      }
      const actor = await accountRepository.loadActor(actorId);
      if (!actor || actor.active !== true || actor.id !== actorId) {
        throw new Error("active trusted actor required");
      }

      const createdAt = now();
      if (!Number.isSafeInteger(createdAt) || createdAt < 0) {
        throw new Error("clock returned an invalid timestamp");
      }
      const expiresAt = createdAt + ttlMs;
      if (!Number.isSafeInteger(expiresAt)) throw new Error("session expiry overflow");

      const token = randomBytes(32).toString("base64url");
      await sessionRepository.put(digestToken(token), { actorId, createdAt, expiresAt });
      return Object.freeze({ token, actorId, expiresAt });
    },

    async authenticate(token) {
      if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return null;
      const digest = digestToken(token);
      const session = await sessionRepository.get(digest);
      if (!session) return null;

      const currentTime = now();
      if (!Number.isSafeInteger(currentTime) || currentTime < 0) {
        throw new Error("clock returned an invalid timestamp");
      }
      if (!Number.isFinite(session.expiresAt) || session.expiresAt <= currentTime) {
        await sessionRepository.delete(digest);
        return null;
      }

      const actor = await accountRepository.loadActor(session.actorId);
      if (!actor || actor.active !== true || actor.id !== session.actorId) {
        await sessionRepository.delete(digest);
        return null;
      }
      return Object.freeze({ actor: Object.freeze({ id: actor.id, role: actor.role }) });
    },

    async revoke(token) {
      if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return false;
      return sessionRepository.delete(digestToken(token));
    },
  });
}
