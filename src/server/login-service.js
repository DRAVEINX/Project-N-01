/**
 * Framework-agnostic login service.
 *
 * Inject a reviewed password verifier, a real dummy hash produced by the same
 * password-hashing algorithm, trusted account repository and durable session
 * store. This module does not implement password hashing or HTTP transport.
 */
export function createLoginService({
  accountRepository,
  sessionStore,
  verifyPassword,
  dummyPasswordHash,
  audit = async () => {},
} = {}) {
  if (!accountRepository || typeof accountRepository.findCredentialsByEmail !== "function" ||
      !sessionStore || typeof sessionStore.create !== "function" ||
      typeof verifyPassword !== "function" ||
      typeof dummyPasswordHash !== "string" || dummyPasswordHash.length < 20 ||
      typeof audit !== "function") {
    throw new TypeError("accountRepository, sessionStore, verifyPassword, dummyPasswordHash and audit are required");
  }

  return async function login({ email, password } = {}) {
    if (typeof email !== "string" || typeof password !== "string" ||
        password.length < 1 || password.length > 1024) {
      return { status: 400, body: { error: "invalid-request" } };
    }

    let credentials = null;
    try {
      credentials = await accountRepository.findCredentialsByEmail(email);
    } catch {
      return { status: 503, body: { error: "authentication-unavailable" } };
    }

    // Verify against a real dummy hash for unknown/disabled accounts too, so
    // the obvious user-enumeration timing difference is reduced.
    const storedHash = credentials?.passwordHash ?? dummyPasswordHash;
    let passwordValid = false;
    try {
      passwordValid = await verifyPassword(password, storedHash);
    } catch {
      return { status: 503, body: { error: "authentication-unavailable" } };
    }

    if (!credentials || credentials.active !== true || passwordValid !== true) {
      try {
        await audit({ event: "login", outcome: "deny" });
      } catch {
        return { status: 503, body: { error: "authentication-unavailable" } };
      }
      return { status: 401, body: { error: "invalid-credentials" } };
    }

    let session;
    try {
      session = await sessionStore.create(credentials.id);
      if (!session || typeof session.token !== "string" ||
          typeof session.actorId !== "string" || session.actorId !== credentials.id ||
          !Number.isFinite(session.expiresAt)) {
        throw new TypeError("session store returned an invalid session");
      }
    } catch {
      return { status: 503, body: { error: "authentication-unavailable" } };
    }

    try {
      await audit({ event: "login", outcome: "allow", actorId: credentials.id });
    } catch {
      // Revoke the just-created session if the audit boundary fails.
      try {
        if (typeof sessionStore.revoke === "function") await sessionStore.revoke(session.token);
      } catch {
        // Fail closed in the response; deployment monitoring must alert on storage failure.
      }
      return { status: 503, body: { error: "authentication-unavailable" } };
    }

    return {
      status: 200,
      body: {
        accessToken: session.token,
        tokenType: "Bearer",
        expiresAt: session.expiresAt,
        actor: { id: credentials.id, role: credentials.role }
      }
    };
  };
}
