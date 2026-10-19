import { createSessionAuthenticator } from "./session-authenticator.js";
import { extractBearerSessionToken } from "./bearer-token.js";

/**
 * Composes strict HTTP Bearer extraction with opaque-session resolution and
 * current trusted account lookup. The host must still provide durable session
 * storage and a trusted account repository.
 */
export function createBearerSessionAuthenticator({ sessionStore, loadActor } = {}) {
  if (!sessionStore || typeof sessionStore.resolve !== "function" || typeof loadActor !== "function") {
    throw new TypeError("sessionStore.resolve and loadActor are required");
  }

  return createSessionAuthenticator({
    sessionStore,
    extractToken: extractBearerSessionToken,
    loadActor
  });
}
