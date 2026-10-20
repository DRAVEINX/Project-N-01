/**
 * Trusted account repository backed by a PostgreSQL-compatible query pool.
 *
 * Password verification and password-hash generation belong to a separate,
 * reviewed authentication service. This repository never accepts role/active
 * values from request data and never returns password hashes from loadActor.
 */
const ALLOWED_ROLES = new Set(["client", "caregiver", "parent", "guardian", "developer_admin"]);

function normalizeEmail(email) {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

function mapActor(row) {
  if (!row || typeof row.id !== "string" || !row.id.trim() || row.id !== row.id.trim() ||
      typeof row.role !== "string" || !ALLOWED_ROLES.has(row.role) ||
      typeof row.active !== "boolean") return null;
  return Object.freeze({ id: row.id, role: row.role, active: row.active });
}

export function createPostgresAccountRepository({ pool } = {}) {
  if (!pool || typeof pool.query !== "function") {
    throw new TypeError("pool.query is required");
  }

  return Object.freeze({
    async loadActor(id) {
      if (typeof id !== "string" || !id.trim() || id !== id.trim() || id.length > 200) return null;
      const result = await pool.query(
        "SELECT id, role, active FROM novalife_accounts WHERE id = $1 LIMIT 1",
        [id]
      );
      return mapActor(result?.rows?.[0]);
    },

    async findCredentialsByEmail(email) {
      const normalized = normalizeEmail(email);
      if (!normalized) return null;
      const result = await pool.query(
        `SELECT id, email_normalized, password_hash, role, active
           FROM novalife_accounts
          WHERE email_normalized = $1
          LIMIT 1`,
        [normalized]
      );
      const row = result?.rows?.[0];
      if (!row || typeof row.id !== "string" || !row.id.trim() || row.id !== row.id.trim() ||
          typeof row.email_normalized !== "string" ||
          typeof row.password_hash !== "string" ||
          typeof row.role !== "string" || !ALLOWED_ROLES.has(row.role) ||
          typeof row.active !== "boolean") return null;
      return Object.freeze({
        id: row.id,
        email: row.email_normalized,
        passwordHash: row.password_hash,
        role: row.role,
        active: row.active
      });
    },

    async createAccount({ id, email, passwordHash, role }) {
      const normalized = normalizeEmail(email);
      if (typeof id !== "string" || !id.trim() || id !== id.trim() || id.length > 200) {
        throw new TypeError("valid account id is required");
      }
      if (!normalized) throw new TypeError("valid email is required");
      if (typeof passwordHash !== "string" || passwordHash.length < 20) {
        throw new TypeError("a reviewed password hash is required; plaintext is not accepted");
      }
      if (!ALLOWED_ROLES.has(role)) throw new TypeError("invalid account role");

      const result = await pool.query(
        `INSERT INTO novalife_accounts (id, email_normalized, password_hash, role, active)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING id, role, active`,
        [id, normalized, passwordHash, role]
      );
      return mapActor(result?.rows?.[0]);
    }
  });
}
