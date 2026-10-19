import { createHash, randomBytes } from "node:crypto";

/**
 * Creates a durable-session adapter around an injected atomic repository.
 *
 * The repository must implement async put(digest, record), get(digest),
 * delete(digest), and deleteByActor(actorId). Its operations must be durable,
 * shared across application instances, and consistent with the deployment's
 * revocation guarantees. No database vendor is assumed here.
 *
 * Raw tokens are returned only to the caller once; only SHA-256 token digests
 * are sent to the repository. This adapter does not implement login, password
 * verification, HTTP cookies, or account/role validation.
 */
export function createDurableSessionStore({
  repository,
  ttlMs = 30 * 60 * 1000,
  now = () => Date.now(),
  createToken = () => randomBytes(32).toString("base64url")
} = {}) {
  if (!repository ||
      typeof repository.put !== "function" ||
      typeof repository.get !== "function" ||
      typeof repository.delete !== "function" ||
      typeof repository.deleteByActor !== "function") {
    throw new TypeError("repository.put, get, delete and deleteByActor are required");
  }
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1) {
    throw new TypeError("ttlMs must be a positive safe integer");
  }
  if (typeof now !== "function" || typeof createToken !== "function") {
    throw new TypeError("now and createToken must be functions");
  }

  const digest = (token) => createHash("sha256").update(token, "utf8").digest("hex");
  const timestamp = () => {
    const value = now();
    if (!Number.isFinite(value)) throw new TypeError("clock must return a finite timestamp");
    return value;
  };
  const validToken = (token) =>
    typeof token === "string" && token.length >= 32 && token.length <= 256 &&
    /^[A-Za-z0-9_-]+$/.test(token);

  return Object.freeze({
    async create(actorId) {
      if (typeof actorId !== "string" || !actorId.trim()) {
        throw new TypeError("actorId is required");
      }
      const token = createToken();
      if (!validToken(token)) throw new TypeError("createToken must return an opaque base64url token");
      const key = digest(token);
      const createdAt = timestamp();
      const record = Object.freeze({ actorId, createdAt, expiresAt: createdAt + ttlMs });
      // Repository.put must fail rather than silently overwrite an existing digest.
      await repository.put(key, record);
      return Object.freeze({ token, actorId, createdAt, expiresAt: record.expiresAt });
    },

    async resolve(token) {
      if (!validToken(token)) return null;
      const key = digest(token);
      const record = await repository.get(key);
      if (!record || typeof record.actorId !== "string" ||
          !Number.isFinite(record.expiresAt) || !Number.isFinite(record.createdAt)) return null;
      if (record.expiresAt <= timestamp()) {
        await repository.delete(key);
        return null;
      }
      return Object.freeze({
        actorId: record.actorId,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt
      });
    },

    async revoke(token) {
      if (!validToken(token)) return false;
      return Boolean(await repository.delete(digest(token)));
    },

    async revokeAllForActor(actorId) {
      if (typeof actorId !== "string" || !actorId.trim()) return 0;
      const removed = await repository.deleteByActor(actorId);
      if (!Number.isSafeInteger(removed) || removed < 0) {
        throw new TypeError("repository.deleteByActor must return a non-negative integer");
      }
      return removed;
    }
  });
}
