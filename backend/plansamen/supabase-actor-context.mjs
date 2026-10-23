import { createSupabaseAccessTokenVerifier } from "./supabase-auth.mjs";
import { createSupabaseTrustedRoleLoader } from "./supabase-role-loader.mjs";
import { createAuthenticatedActorResolver } from "./actor-resolver.mjs";

/**
 * Builds the fail-closed authentication boundary for server-side routes.
 * This factory does not enable routes or accept/store personal data by itself.
 * Keep the API disabled until a transactional database operation layer and
 * route-level authorization tests are in place.
 */
export function createSupabaseActorContext(options = {}) {
  const verifier = createSupabaseAccessTokenVerifier(options);
  const roleLoader = createSupabaseTrustedRoleLoader(options);
  const configured = verifier.configured && roleLoader.configured;

  const resolveActor = createAuthenticatedActorResolver({
    verifyAccessToken: header => verifier.verifyAuthorizationHeader(header),
    loadTrustedRole: (userId, header) => roleLoader.loadTrustedRole(userId, header)
  });

  return Object.freeze({
    configured,
    resolveActor
  });
}
