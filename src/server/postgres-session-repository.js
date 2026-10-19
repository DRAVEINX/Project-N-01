/**
 * PostgreSQL implementation of the durable session repository contract.
 *
 * Inject a node-postgres-compatible pool/client. This module does not create
 * connections, manage secrets, or replace trusted account lookup. The schema
 * lives in migrations/0001_novalife_core.sql.
 */
export function createPostgresSessionRepository({ pool } = {}) {
  if (!pool || typeof pool.query !== "function") {
    throw new TypeError("pool.query is required");
  }

  return Object.freeze({
    async put(digest, record) {
      if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) {
        throw new TypeError("digest must be a lowercase SHA-256 hex digest");
      }
      if (!record || typeof record.actorId !== "string" || !record.actorId.trim() ||
          !Number.isFinite(record.createdAt) || !Number.isFinite(record.expiresAt) ||
          record.expiresAt <= record.createdAt) {
        throw new TypeError("valid session record is required");
      }
      // The digest is the only token-derived value ever persisted.
      await pool.query(
        `INSERT INTO novalife_sessions (token_digest, actor_id, created_at, expires_at)
         VALUES ($1, $2, to_timestamp($3 / 1000.0), to_timestamp($4 / 1000.0))`,
        [digest, record.actorId, record.createdAt, record.expiresAt]
      );
    },

    async get(digest) {
      if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) return null;
      const result = await pool.query(
        `SELECT actor_id,
                (extract(epoch FROM created_at) * 1000)::bigint AS created_at_ms,
                (extract(epoch FROM expires_at) * 1000)::bigint AS expires_at_ms
           FROM novalife_sessions
          WHERE token_digest = $1`,
        [digest]
      );
      const row = result?.rows?.[0];
      if (!row) return null;
      const createdAt = Number(row.created_at_ms);
      const expiresAt = Number(row.expires_at_ms);
      if (typeof row.actor_id !== "string" ||
          !Number.isFinite(createdAt) || !Number.isFinite(expiresAt)) return null;
      return Object.freeze({ actorId: row.actor_id, createdAt, expiresAt });
    },

    async delete(digest) {
      if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) return false;
      const result = await pool.query(
        "DELETE FROM novalife_sessions WHERE token_digest = $1",
        [digest]
      );
      return Number.isInteger(result?.rowCount) && result.rowCount > 0;
    },

    async deleteByActor(actorId) {
      if (typeof actorId !== "string" || !actorId.trim()) return 0;
      const result = await pool.query(
        "DELETE FROM novalife_sessions WHERE actor_id = $1",
        [actorId]
      );
      return Number.isInteger(result?.rowCount) && result.rowCount >= 0
        ? result.rowCount
        : 0;
    }
  });
}
