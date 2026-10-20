import { Buffer } from "node:buffer";

const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

function send(res, status, body, extraHeaders = {}) {
  const encoded = JSON.stringify(body);
  // HTTP header names are case-insensitive. Filter invariant headers case-
  // insensitively so mixed-case duplicates cannot bypass the security defaults.
  const invariantHeaders = new Set([
    "content-type",
    "cache-control",
    "x-content-type-options",
    "content-length",
  ]);
  const safeExtraHeaders = Object.fromEntries(
    Object.entries(extraHeaders).filter(([name]) =>
      !invariantHeaders.has(name.toLowerCase())
    )
  );
  res.writeHead(status, {
    ...safeExtraHeaders,
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-length": Buffer.byteLength(encoded, "utf8"),
  });
  res.end(encoded);
}

async function readJsonBody(req, maxBodyBytes) {
  const rawLength = req.headers?.["content-length"];
  if (rawLength !== undefined) {
    if (!/^\d+$/.test(String(rawLength)) || Number(rawLength) > maxBodyBytes) {
      const error = new Error("request-body-too-large");
      error.status = 413;
      throw error;
    }
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > maxBodyBytes) {
      const error = new Error("request-body-too-large");
      error.status = 413;
      throw error;
    }
    chunks.push(buffer);
  }
  if (length === 0) return undefined;
  const type = String(req.headers?.["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") {
    const error = new Error("json-content-type-required");
    error.status = 415;
    throw error;
  }
  let parsed;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch {
    const error = new Error("invalid-json");
    error.status = 400;
    throw error;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const error = new Error("json-object-required");
    error.status = 400;
    throw error;
  }
  return parsed;
}

/**
 * Adapt a Node.js IncomingMessage/ServerResponse pair to the care API router.
 *
 * The hosting app must terminate TLS securely or provide an explicit
 * isSecureRequest callback that validates its trusted proxy boundary. Origins
 * are deny-by-default for browser mutation requests. Native clients that omit
 * Origin require an explicit allowMissingOrigin=true deployment decision.
 */
export async function handleNodeCareApiRequest(req, res, router, {
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  allowedOrigins = [],
  allowMissingOrigin = false,
  isSecureRequest = (request) => Boolean(request.socket?.encrypted),
} = {}) {
  if (!router || typeof router.handle !== "function") throw new TypeError("care API router is required");
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes < 1 || maxBodyBytes > 1024 * 1024) {
    throw new TypeError("maxBodyBytes must be between 1 and 1048576");
  }
  if (!Array.isArray(allowedOrigins) || allowedOrigins.some((origin) => typeof origin !== "string" || !origin)) {
    throw new TypeError("allowedOrigins must be an array of exact origin strings");
  }
  const method = String(req.method ?? "GET").toUpperCase();
  const pathname = String(req.url ?? "/").split("?")[0];
  const origin = req.headers?.origin;
  const originAllowed = typeof origin === "string" && allowedOrigins.includes(origin);
  const corsHeaders = originAllowed ? {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type, X-Request-Id",
    "access-control-max-age": "600",
    "vary": "Origin",
  } : {};
  if (!pathname.startsWith("/api/care/") && !pathname.startsWith("/api/auth/")) {
    send(res, 404, { error: "not-found" }, corsHeaders);
    return;
  }
  try {
    if (!await isSecureRequest(req)) {
      send(res, 400, { error: "secure-transport-required" }, corsHeaders);
      return;
    }
  } catch {
    send(res, 400, { error: "secure-transport-required" }, corsHeaders);
    return;
  }

  if (method === "OPTIONS") {
    if (typeof origin !== "string") {
      send(res, 403, { error: "origin-required" });
      return;
    }
    if (!originAllowed) {
      send(res, 403, { error: "origin-not-allowed" });
      return;
    }
    const requestedMethod = String(req.headers?.["access-control-request-method"] ?? "").toUpperCase();
    const allowedMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
    if (!allowedMethods.has(requestedMethod)) {
      send(res, 405, { error: "method-not-allowed" }, corsHeaders);
      return;
    }
    const requestedHeaders = String(req.headers?.["access-control-request-headers"] ?? "")
      .split(",").map((header) => header.trim().toLowerCase()).filter(Boolean);
    const allowedHeaders = new Set(["authorization", "content-type", "x-request-id"]);
    if (requestedHeaders.some((header) => !allowedHeaders.has(header))) {
      send(res, 403, { error: "header-not-allowed" }, corsHeaders);
      return;
    }
    res.writeHead(204, {
      ...corsHeaders,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "content-length": "0",
    });
    res.end();
    return;
  }

  if (BODY_METHODS.has(method)) {
    if (typeof origin !== "string") {
      if (!allowMissingOrigin) {
        send(res, 403, { error: "origin-required" });
        return;
      }
    } else if (!allowedOrigins.includes(origin)) {
      send(res, 403, { error: "origin-not-allowed" });
      return;
    }
  }

  let body;
  try {
    if (BODY_METHODS.has(method)) body = await readJsonBody(req, maxBodyBytes);
  } catch (error) {
    send(res, Number.isInteger(error?.status) ? error.status : 400, {
      error: error?.message === "request-body-too-large" ? "request-body-too-large" :
        error?.message === "json-content-type-required" ? "json-content-type-required" : "invalid-request",
    }, corsHeaders);
    return;
  }

  try {
    const result = await router.handle({
      method,
      url: req.url,
      headers: req.headers,
      requestId: typeof req.headers?.["x-request-id"] === "string" ? req.headers["x-request-id"] : undefined,
      body,
    });
    const status = Number.isInteger(result?.status) ? result.status : 503;
    const responseBody = result && Object.hasOwn(result, "body") ? result.body : { error: "care-data-unavailable" };
    send(res, status, responseBody, {
      ...(result?.headers && typeof result.headers === "object" ? result.headers : {}),
      ...corsHeaders,
    });
  } catch {
    if (!res.headersSent) send(res, 503, { error: "care-data-unavailable" }, corsHeaders);
    else res.destroy();
  }
}
