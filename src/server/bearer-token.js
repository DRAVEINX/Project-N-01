/**
 * Extracts a session token from a single HTTP Authorization: Bearer header.
 *
 * Accepts Fetch Headers and plain Node-style header objects. Ambiguous,
 * repeated, malformed, or non-Bearer values are rejected. This function does
 * not authenticate the token; pass the returned value to the session store.
 *
 * Tokens created by createSessionStore are 32 random bytes encoded as
 * unpadded base64url, which is exactly 43 URL-safe characters.
 */
export function extractBearerSessionToken(request) {
  const headers = request?.headers;
  if (!headers) return null;

  let value;
  if (typeof headers.get === "function") {
    value = headers.get("authorization");
  } else if (typeof headers === "object") {
    value = headers.authorization ?? headers.Authorization;
  } else {
    return null;
  }

  // Arrays and combined values can indicate duplicate/ambiguous credentials.
  if (typeof value !== "string" || value.includes(",")) return null;
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(value);
  return match ? match[1] : null;
}
