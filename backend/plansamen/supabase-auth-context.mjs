import { createSupabaseAccessTokenVerifier } from "./supabase-auth.mjs";
import { createSupabaseTrustedRoleLoader } from "./supabase-role-loader.mjs";
import { createAuthenticatedActorResolver } from "./actor-resolver.mjs";

/**
 * Composes Supabase Auth identity verification with an RLS-scoped role lookup.
 * This factory does not enable routes or accept personal data by itself.
 */
export function createSupabaseAuthContext({
  supabaseUrl,
  publishableKey,
  fetchImpl = fetch,
  timeoutMs = 5000
} = {}) {
  const verifier = createSupabaseAccessTokenVerifier({
    supabaseUrl,
    publishableKey,
    fetchImpl,
    timeoutMs
  });
  const roleLoader = createSupabaseTrustedRoleLoader({
    supabaseUrl,
    publishableKey,
    fetchImpl,
    timeoutMs
  });

  const configured = verifier.configured && roleLoader.configured;
  const resolveActor = createAuthenticatedActorResolver({
    verifyAccessToken: (header) => verifier.verifyAuthorizationHeader(header),
    loadTrustedRole: (userId, header) => roleLoader.loadTrustedRole(userId, header)
  });

  return Object.freeze({
    get configured() { return configured; },
    async authenticate(authorizationHeader) {
      if (!configured) {
        const error = new Error("Authentication is not configured.");
        error.code = "AUTH_NOT_CONFIGURED";
        throw error;
      }
      return resolveActor(authorizationHeader);
    }
  });
}
