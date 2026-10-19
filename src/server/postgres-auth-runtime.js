import { createPostgresAccountRepository } from "./postgres-account-repository.js";
import { createPostgresSessionRepository } from "./postgres-session-repository.js";
import { createArgon2LoginStack } from "./argon2-login-stack.js";

/**
 * Wire NovaLife's server-side Argon2id login stack to PostgreSQL repositories.
 *
 * The supplied pool must be configured by the hosting application using
 * private connection credentials and TLS where appropriate. Audit must write
 * to a durable, access-controlled audit destination.
 */
export async function createNovaLifePostgresAuth({
  pool,
  audit,
  now = () => Date.now(),
  ttlMs = 8 * 60 * 60 * 1000,
} = {}) {
  if (!pool || typeof pool.query !== "function") {
    throw new TypeError("a configured PostgreSQL pool is required");
  }
  if (typeof audit !== "function") {
    throw new TypeError("a durable audit callback is required");
  }

  const accounts = createPostgresAccountRepository({ pool });
  const sessions = createPostgresSessionRepository({ pool });
  const auth = await createArgon2LoginStack({
    accountRepository: accounts,
    sessionRepository: sessions,
    audit,
    now,
    ttlMs,
  });

  return Object.freeze({
    accounts,
    login: auth.login,
    authenticate: auth.authenticate,
    revoke: auth.revoke,
    hashPassword: auth.hashPassword,
  });
}
