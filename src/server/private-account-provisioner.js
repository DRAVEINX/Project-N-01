import { createPostgresAuditRepository } from "./postgres-audit-repository.js";

const ALLOWED_ROLES = new Set(["client", "caregiver", "parent", "guardian"]);
const SAFE_ID = /^[^\u0000-\u001F\u007F/\\?#]{1,200}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeInput({ id, email, password, role, operatorId, hashPassword } = {}) {
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
  if (!ALLOWED_ROLES.has(role)) {
    throw new TypeError("only client, caregiver, parent or guardian accounts may be provisioned by this tool");
  }
  if (typeof operatorId !== "string" || operatorId.trim() !== operatorId || !SAFE_ID.test(operatorId)) {
    throw new TypeError("a safe operator identifier is required for audit");
  }
  if (typeof hashPassword !== "function") throw new TypeError("Argon2id hashPassword function is required");
  return { id, emailNormalized: email.toLowerCase(), password, role, operatorId, hashPassword };
}

/**
 * Private operator-only account provisioning. This is intentionally not an API
 * route. It writes the account and its audit event in one database transaction,
 * uses Argon2id supplied by the server-only password module, and never grants
 * client assignments or consent on the new account's behalf.
 */
export async function provisionNovaLifeAccount({ pool, ...input } = {}) {
  if (!pool || typeof pool.connect !== "function") {
    throw new TypeError("a private administrative PostgreSQL pool is required");
  }
  const normalized = normalizeInput(input);
  const passwordHash = await normalized.hashPassword(normalized.password);
  if (typeof passwordHash !== "string" || !passwordHash.startsWith("$argon2id$") ||
      passwordHash.length < 20 || passwordHash.length > 512) {
    throw new TypeError("password hasher must return a valid Argon2id encoded hash");
  }

  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    const operator = await client.query(
      `SELECT id
         FROM novalife_accounts
        WHERE id = $1 AND role = 'developer_admin' AND active = TRUE
        LIMIT 1
        FOR SHARE`,
      [normalized.operatorId]
    );
    if (operator?.rows?.length !== 1) throw new Error("account-provisioning-failed");

    await client.query(
      `INSERT INTO novalife_accounts
         (id, email_normalized, password_hash, role, active)
       VALUES ($1, $2, $3, $4, TRUE)`,
      [normalized.id, normalized.emailNormalized, passwordHash, normalized.role]
    );

    const audit = createPostgresAuditRepository({ pool: client });
    await audit.authAudit({
      event: "account-provision",
      outcome: "allow",
      actorId: normalized.operatorId,
      reason: "private-admin-provisioning",
    });
    await client.query("COMMIT");
    transactionOpen = false;

    return Object.freeze({
      id: normalized.id,
      email: normalized.emailNormalized,
      role: normalized.role,
      active: true,
    });
  } catch {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
    // Caller gets no driver error, SQL text, password hash, or input values.
    throw new Error("account-provisioning-failed");
  } finally {
    client.release();
  }
}

export const novaLifeProvisionableAccountRoles = Object.freeze([...ALLOWED_ROLES]);
