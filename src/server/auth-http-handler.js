const MAX_BODY_BYTES = 8 * 1024;

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "pragma": "no-cache",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

async function readJsonBody(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!/^application\/json(?:\s*;|\s*$)/i.test(contentType)) {
    return { error: "unsupported-media-type" };
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const size = Number(contentLength);
    if (!Number.isSafeInteger(size) || size < 0 || size > MAX_BODY_BYTES) {
      return { error: "payload-too-large" };
    }
  }
  if (!request.body) return { error: "invalid-request" };

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return { error: "payload-too-large" };
      }
      chunks.push(value);
    }
  } catch {
    return { error: "invalid-request" };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "invalid-request" };
    }
    return { value: parsed };
  } catch {
    return { error: "invalid-request" };
  }
}

function readBearerToken(request) {
  const authorization = request.headers.get("authorization");
  if (typeof authorization !== "string") return null;
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization);
  return match?.[1] ?? null;
}

/**
 * Small Fetch API HTTP boundary for a server-only NovaLife auth runtime.
 * A trusted deployment-specific rate limiter is mandatory and must fail closed.
 */
export function createAuthHttpHandler({ auth, rateLimit } = {}) {
  if (!auth || typeof auth.login !== "function" ||
      typeof auth.authenticate !== "function" ||
      typeof auth.revoke !== "function" ||
      typeof rateLimit !== "function") {
    throw new TypeError("auth runtime and mandatory rateLimit callback are required");
  }

  return async function handleAuthRequest(request) {
    if (!(request instanceof Request)) return jsonResponse(400, { error: "invalid-request" });
    const url = new URL(request.url);
    if (url.pathname !== "/auth/login" && url.pathname !== "/auth/me" &&
        url.pathname !== "/auth/logout") {
      return jsonResponse(404, { error: "not-found" });
    }

    if (url.pathname === "/auth/login") {
      if (request.method !== "POST") {
        return jsonResponse(405, { error: "method-not-allowed" });
      }
      let allowed;
      try {
        allowed = await rateLimit({ request, route: "login" });
      } catch {
        return jsonResponse(503, { error: "authentication-unavailable" });
      }
      if (allowed !== true) return jsonResponse(429, { error: "too-many-requests" });

      const parsed = await readJsonBody(request);
      if (parsed.error === "unsupported-media-type") {
        return jsonResponse(415, { error: parsed.error });
      }
      if (parsed.error === "payload-too-large") {
        return jsonResponse(413, { error: parsed.error });
      }
      if (parsed.error || typeof parsed.value.email !== "string" ||
          typeof parsed.value.password !== "string" ||
          Object.keys(parsed.value).some((key) => key !== "email" && key !== "password")) {
        return jsonResponse(400, { error: "invalid-request" });
      }
      const result = await auth.login({
        email: parsed.value.email,
        password: parsed.value.password,
      });
      if (!result || !Number.isInteger(result.status) || !result.body ||
          typeof result.body !== "object") {
        return jsonResponse(503, { error: "authentication-unavailable" });
      }
      return jsonResponse(result.status, result.body);
    }

    if (request.method !== "GET" && !(url.pathname === "/auth/logout" && request.method === "POST")) {
      return jsonResponse(405, { error: "method-not-allowed" });
    }

    const token = readBearerToken(request);
    if (!token) return jsonResponse(401, { error: "unauthorized" });

    if (url.pathname === "/auth/me") {
      let result;
      try {
        result = await auth.authenticate(token);
      } catch {
        return jsonResponse(503, { error: "authentication-unavailable" });
      }
      return result
        ? jsonResponse(200, { actor: result.actor })
        : jsonResponse(401, { error: "unauthorized" });
    }

    try {
      const revoked = await auth.revoke(token);
      return revoked
        ? jsonResponse(200, { loggedOut: true })
        : jsonResponse(401, { error: "unauthorized" });
    } catch {
      return jsonResponse(503, { error: "authentication-unavailable" });
    }
  };
}
