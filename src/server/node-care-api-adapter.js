import { Buffer } from "node:buffer";

const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

function send(res, status, body, extraHeaders = {}) {
  const encoded = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-length": Buffer.byteLength(encoded, "utf8"),
    ...extraHeaders,
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
  if (!pathname.startsWith("/api/care/")) {
    send(res, 404, { error: "not-found" });
    return;
  }
  try {
    if (!await isSecureRequest(req)) {
      send(res, 400, { error: "secure-transport-required" });
      return;
    }
  } catch {
    send(res, 400, { error: "secure-transport-required" });
    return;
  }

  const origin = req.headers?.origin;
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
    });
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
    send(res, status, responseBody, result?.headers && typeof result.headers === "object" ? result.headers : {});
  } catch {
    if (!res.headersSent) send(res, 503, { error: "care-data-unavailable" });
    else res.destroy();
  }
}
