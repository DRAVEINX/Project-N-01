const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ROLES = new Set(["client", "caregiver", "guardian", "parent", "admin"]);

export class TrustedRoleLookupError extends Error {
  constructor() {
    super("Trusted authorization state is unavailable.");
    this.name = "TrustedRoleLookupError";
    this.code = "AUTHORIZATION_STATE_UNAVAILABLE";
  }
}

/**
 * Fetches the authenticated user's role through Supabase PostgREST.
 * The caller's access token and publishable key are used so database RLS
 * applies. Never put a service-role key in this adapter or a client app.
 */
export function createSupabaseTrustedRoleLoader({
  supabaseUrl = process.env.SUPABASE_URL,
  publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY,
  fetchImpl = fetch,
  timeoutMs = 5000
} = {}) {
  let endpoint;
  try {
    const parsed = new URL(supabaseUrl);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") throw new Error();
    endpoint = new URL("/rest/v1/plansamen_profiles", parsed.origin);
  } catch {
    endpoint = null;
  }
  const configured = Boolean(endpoint && typeof publishableKey === "string" && publishableKey.trim() && !/[\r\n]/.test(publishableKey));

  return {
    get configured() { return configured; },
    async loadTrustedRole(userId, authorizationHeader) {
      if (!configured || typeof userId !== "string" || !USER_ID_PATTERN.test(userId) ||
          typeof authorizationHeader !== "string" ||
          !/^Bearer [A-Za-z0-9._~+\/-]+=*$/i.test(authorizationHeader) ||
          authorizationHeader.length > 8200) throw new TrustedRoleLookupError();

      const url = new URL(endpoint);
      url.searchParams.set("select", "role");
      url.searchParams.set("user_id", "eq." + userId);
      let response;
      try {
        response = await fetchImpl(url.toString(), {
          method: "GET",
          headers: {
            apikey: publishableKey,
            authorization: authorizationHeader,
            accept: "application/json"
          },
          signal: AbortSignal.timeout(timeoutMs)
        });
      } catch {
        throw new TrustedRoleLookupError();
      }
      if (!response.ok) throw new TrustedRoleLookupError();

      let rows;
      try { rows = await response.json(); } catch { throw new TrustedRoleLookupError(); }
      if (!Array.isArray(rows) || rows.length !== 1 || !rows[0] || !ALLOWED_ROLES.has(rows[0].role)) {
        throw new TrustedRoleLookupError();
      }
      return rows[0].role;
    }
  };
}
