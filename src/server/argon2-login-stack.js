import { createArgon2PasswordAdapter } from "./argon2-passwords.js";
import { createLoginService } from "./login-service.js";
import { createSessionManager } from "./session-manager.js";

/**
 * Compose the Argon2id verifier, trusted account repository, durable session
 * repository and login orchestration into one server-side login function.
 *
 * The caller must provide an audit function backed by durable, access-controlled
 * storage. This factory does not configure HTTP, TLS, database connections, or
 * deployment secrets.
 */
export async function createArgon2LoginStack({
  accountRepository,
  sessionRepository,
  audit,
  now = () => Date.now(),
  ttlMs = 8 * 60 * 60 * 1000,
} = {}) {
  if (!accountRepository || typeof accountRepository.findCredentialsByEmail !== "function" ||
      typeof accountRepository.loadActor !== "function" ||
      !sessionRepository || typeof sessionRepository.put !== "function" ||
      typeof sessionRepository.get !== "function" ||
      typeof sessionRepository.delete !== "function" ||
      typeof audit !== "function") {
    throw new TypeError("trusted accountRepository, sessionRepository and durable audit callback are required");
  }

  const passwords = await createArgon2PasswordAdapter();
  const sessionManager = createSessionManager({
    accountRepository,
    sessionRepository,
    now,
    ttlMs,
  });
  const login = createLoginService({
    accountRepository,
    sessionStore: sessionManager,
    verifyPassword: passwords.verifyPassword,
    dummyPasswordHash: passwords.dummyPasswordHash,
    audit,
  });

  return Object.freeze({
    login,
    authenticate: sessionManager.authenticate,
    revoke: sessionManager.revoke,
    hashPassword: passwords.hashPassword,
  });
}
