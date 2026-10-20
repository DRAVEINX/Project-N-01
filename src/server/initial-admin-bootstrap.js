import { randomUUID } from "node:crypto";
import { createPostgresAuditRepository } from "./postgres-audit-repository.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_ID = /^[^\u0000-\u001F\u007F/\\?#]{1,200}$/;
const BOOTSTRAP_LOCK = "novalife-initial-developer-admin-bootstrap-v1";

function validate({ id, email, password, hashPassword } = {}) {
  if (typeof id !== "string" || id.trim() !== id || !SAFE_ID.test(id)) {
    throw new TypeError("valid account id is required");
  }
  if (typeof email !== "string" || email.trim() !== email || email.length > 320 ||
      !EMAIL.test(email)) {
    throw new TypeError("valid email is required");
  }
  if (typeof password !== "string" || password.length < 1 || password.length > 1024) {
    throw new TypeError("password must be a non-empty string of at most 1024 characters");
  }
  if (typeof hashPassword !== "function") throw new TypeError("Argon2id hashPassword function is required");
  return { id, email: email.toLowerCase(), password, hashPassword };
}

/**
 * One-time local bootstrap for the initial developer administrator.
 * This is not an API route. It requires a private administrative connection,
 * creates exactly one initial admin, and audits the bootstrap in the same
 * transaction. Once an active or inactive developer_admin row exists, it
 * refuses to run again. Keep the invoking workstation/DB credentials private.
 */
export async function bootstrapNovaLifeDeveloperAdmin({
  pool,
  id,
  email,
  password,
  hashPassword,
  idFactory = randomUUID,
} = {}) {
  if (!pool || typeof pool.connect !== "function") {
    throw new TypeError("a private administrative PostgreSQL pool is required");
  }
  if (typeof idFactory !== "function") throw new TypeError("idFactory must be a function");
  const normalized = validate({ id, email, password, hashPassword });
  const passwordHash = await normalized.hashPassword(normalized.password);
  if (typeof passwordHash !== "string" || !passwordHash.startsWith("$argon2id$") ||
      passwordHash.length < 20 || passwordHash.length > 512) {
    throw new TypeError("password hasher must return a valid Argon2id encoded hash");
  }

  const auditId = idFactory();
  if (typeof auditId !== "string" || auditId.trim() !== auditId || !SAFE_ID.test(auditId)) {
    throw new TypeError("audit id must be a safe identifier");
  }
  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [BOOTSTRAP_LOCK]);

    const existing = await client.query(
      `SELECT id FROM novalife_accounts
        WHERE role = 'developer_admin'
        LIMIT 1
        FOR UPDATE`
    );
    if ((existing?.rows ?? []).length > 0) {
      throw new Error("bootstrap-already-completed");
    }

    await client.query(
      `INSERT INTO novalife_accounts
         (id, email_normalized, password_hash, role, active)
       VALUES ($1, $2, $3, 'developer_admin', TRUE)`,
      [normalized.id, normalized.email, passwordHash]
    );

    const audit = createPostgresAuditRepository({
      pool: client,
      idFactory: () => auditId,
    });
    await audit.authAudit({
      event: "initial-developer-admin-bootstrap",
      outcome: "allow",
      actorId: normalized.id,
      reason: "one-time-private-bootstrap",
    });

    await client.query("COMMIT");
    transactionOpen = false;
    return Object.freeze({ id: normalized.id, email: normalized.email, role: "developer_admin", active: true });
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
    if (error?.message === "bootstrap-already-completed") {
      throw new Error("bootstrap-already-completed");
    }
    throw new Error("initial-admin-bootstrap-failed");
  } finally {
    client.release();
  }
}
