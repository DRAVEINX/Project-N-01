import { createNovaLifePostgresAuth } from "./postgres-auth-runtime.js";
import { createAuthHttpHandler } from "./auth-http-handler.js";

/**
 * Compose the PostgreSQL-backed authentication runtime with its Fetch API
 * boundary. The caller remains responsible for hosting, HTTPS, and a durable
 * deployment-specific rate limiter.
 */
export async function createNovaLifeAuthHttpHandler({
  pool,
  audit,
  rateLimit,
  now,
  ttlMs,
} = {}) {
  if (typeof rateLimit !== "function") {
    throw new TypeError("a trusted rateLimit callback is required");
  }

  const auth = await createNovaLifePostgresAuth({ pool, audit, now, ttlMs });
  return createAuthHttpHandler({ auth, rateLimit });
}
