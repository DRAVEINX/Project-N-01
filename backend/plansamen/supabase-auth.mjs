const BEARER_TOKEN_PATTERN = /^Bearer ([A-Za-z0-9._~+\/-]+=*)$/i;

export class AuthenticationError extends Error {
  constructor(code = "UNAUTHENTICATED") {
    super("A valid authenticated session is required.");
    this.name = "AuthenticationError";
    this.code = code;
  }
}

/**
 * Creates a fail-closed verifier for Supabase Auth access tokens.
 * Identity is fetched from Auth; JWT contents and user metadata are never
 * decoded or used as authorization evidence. Roles must be loaded separately
 * from trusted database state.
 */
export function createSupabaseAccessTokenVerifier({
  supabaseUrl = process.env.SUPABASE_URL,
  publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY,
  fetchImpl = fetch,
  timeoutMs = 5000
} = {}) {
  let authUserUrl;
  try {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      throw new Error("Invalid protocol");
    }
    authUserUrl = new URL("/auth/v1/user", parsed.origin).toString();
  } catch {
    authUserUrl = null;
  }

  const configured = Boolean(authUserUrl && typeof publishableKey === "string" &&
    publishableKey.trim() && !/[\r\n]/.test(publishableKey));

  return {
    get configured() {
      return configured;
    },

    async verifyAuthorizationHeader(header) {
      if (!configured) throw new AuthenticationError("AUTH_NOT_CONFIGURED");
      if (typeof header !== "string") throw new AuthenticationError();

      const match = BEARER_TOKEN_PATTERN.exec(header.trim());
      if (!match || match[1].length < 20 || match[1].length > 8192) {
        throw new AuthenticationError();
      }
      const accessToken = match[1];

      let response;
      try {
        response = await fetchImpl(authUserUrl, {
          method: "GET",
          headers: {
            apikey: publishableKey,
            authorization: `Bearer ${accessToken}`,
            accept: "application/json"
          },
          signal: AbortSignal.timeout(timeoutMs)
        });
      } catch {
        throw new AuthenticationError("AUTH_PROVIDER_UNAVAILABLE");
      }

      if (!response.ok) {
        throw new AuthenticationError();
      }

      let user;
      try {
        user = await response.json();
      } catch {
        throw new AuthenticationError();
      }

      if (!user || typeof user.id !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user.id) ||
          user.is_anonymous === true) {
        throw new AuthenticationError();
      }

      // Deliberately return only the stable identifier. Do not return metadata,
      // email, role, token, or other profile fields to downstream authorization.
      return Object.freeze({ userId: user.id });
    }
  };
}
