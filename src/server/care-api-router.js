import { createNovaLifeCarePortalHandler, novaLifeCarePortalResources } from "./care-portal-handler.js";
import { createPostgresCareRecordRepository } from "./postgres-care-record-repository.js";

const DATA_RESOURCES = new Set(novaLifeCarePortalResources.filter((resource) => resource !== "care-portal"));
const METHODS = Object.freeze({
  GET: "read",
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
});
const MAX_BODY_BYTES = 64 * 1024;

function json(status, body) {
  return Object.freeze({
    status,
    headers: Object.freeze({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    }),
    body,
  });
}

function parseRoute(request) {
  let url;
  try {
    url = new URL(request?.url ?? request?.path ?? "/", "http://novalife.internal");
  } catch {
    return null;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 3 || parts[0] !== "api" || parts[1] !== "care") return null;
  let resource;
  let id;
  try {
    resource = decodeURIComponent(parts[2]);
    if (parts.length > 3) id = decodeURIComponent(parts[3]);
  } catch {
    return null;
  }
  if (parts.length > 4 || !DATA_RESOURCES.has(resource) ||
      (id !== undefined && (!id || id.length > 200 || id.includes("/")))) return null;
  return { resource, id, query: url.searchParams };
}

function validateBody(request) {
  const body = request?.body;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      (Object.getPrototypeOf(body) !== Object.prototype && Object.getPrototypeOf(body) !== null)) {
    return { error: "invalid-json-object" };
  }
  let encoded;
  try { encoded = JSON.stringify(body); } catch { return { error: "invalid-json-object" }; }
  if (typeof encoded !== "string" || Buffer.byteLength(encoded, "utf8") > MAX_BODY_BYTES) {
    return { error: "request-body-too-large" };
  }
  return { data: body };
}

/**
 * Framework-neutral API router for NovaLife care data.
 *
 * The hosting HTTP server must enforce TLS, request byte limits, timeouts,
 * rate limiting, origin/CSRF policy, and secure token transport. It must pass
 * an authenticated-request adapter with headers, url/path, and parsed body.
 * resolveTargetClientId must resolve the target using trusted server-side
 * relationships; the authorization context then checks active assignments
 * and current consent. No route may accept role, assignment or consent claims
 * from the body.
 */
export async function createNovaLifeCareApiRouter({
  pool,
  authAudit,
  authorizationAudit,
  extractToken,
  resolveTargetClientId,
  now,
  ttlMs,
} = {}) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("configured PostgreSQL pool is required");
  if (typeof authAudit !== "function" || typeof authorizationAudit !== "function") {
    throw new TypeError("durable authAudit and authorizationAudit callbacks are required");
  }
  if (typeof extractToken !== "function" || typeof resolveTargetClientId !== "function") {
    throw new TypeError("extractToken and trusted resolveTargetClientId are required");
  }

  const repository = createPostgresCareRecordRepository({ pool });
  const handlers = new Map();
  for (const resource of DATA_RESOURCES) {
    for (const action of ["read", "create", "update", "delete"]) {
      const handler = async (request, context) => {
        const clientId = context.clientId;
        if (action === "read" && request.params.recordId) {
          const record = await repository.get({ clientId, resource, id: request.params.recordId });
          return json(record ? 200 : 404, record ? { record } : { error: "not-found" });
        }
        if (action === "read") {
          const rawLimit = request.query.get("limit");
          const limit = rawLimit === null ? 50 : Number(rawLimit);
          if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
            return json(400, { error: "invalid-limit" });
          }
          return json(200, { records: await repository.list({ clientId, resource, limit }) });
        }
        if (action === "create") {
          const parsed = validateBody(request);
          if (parsed.error) return json(400, { error: parsed.error });
          const record = await repository.create({ clientId, resource, actorId: context.actor.id, data: parsed.data });
          return json(201, { record });
        }
        if (!request.params.recordId) return json(400, { error: "record-id-required" });
        if (action === "update") {
          const parsed = validateBody(request);
          if (parsed.error) return json(400, { error: parsed.error });
          const record = await repository.update({
            clientId, resource, id: request.params.recordId,
            actorId: context.actor.id, data: parsed.data,
          });
          return json(record ? 200 : 404, record ? { record } : { error: "not-found" });
        }
        const removed = await repository.remove({ clientId, resource, id: request.params.recordId });
        return json(removed ? 200 : 404, removed ? { deleted: true } : { error: "not-found" });
      };
      const protectedHandler = await createNovaLifeCarePortalHandler({
        resource,
        action,
        pool,
        authAudit,
        authorizationAudit,
        extractToken,
        resolveTargetClientId: (actor, request) => resolveTargetClientId(actor, request),
        handler,
        now,
        ttlMs,
      });
      handlers.set(resource + ":" + action, protectedHandler);
    }
  }

  return Object.freeze({
    async handle(request) {
      const method = String(request?.method ?? "GET").toUpperCase();
      const route = parseRoute(request);
      if (!route) return json(404, { error: "not-found" });
      const action = METHODS[method];
      if (!action) return json(405, { error: "method-not-allowed" });
      if (action === "read" && method !== "GET") return json(405, { error: "method-not-allowed" });
      if (action === "create" && route.id !== undefined) return json(405, { error: "method-not-allowed" });
      if ((action === "update" || action === "delete") && route.id === undefined) {
        return json(400, { error: "record-id-required" });
      }
      const protectedHandler = handlers.get(route.resource + ":" + action);
      if (!protectedHandler) return json(404, { error: "not-found" });

      const adapted = Object.freeze({
        ...request,
        query: route.query,
        params: Object.freeze({ ...(request?.params ?? {}), resource: route.resource, recordId: route.id ?? null }),
      });
      try {
        return await protectedHandler(adapted);
      } catch {
        // Avoid returning SQL details or sensitive payloads to API callers.
        return json(503, { error: "care-data-unavailable" });
      }
    },
  });
}
