import { novaLifeCarePortalResources } from "./care-portal-handler.js";
import { createPostgresCareRecordRepository } from "./postgres-care-record-repository.js";
import { createNovaLifePostgresAuth } from "./postgres-auth-runtime.js";
import { createPostgresAuthorizationContextLoader } from "./postgres-authorization-context.js";
import { createAuthorizedHandler } from "./authorized-handler.js";

const DATA_RESOURCES = new Set(novaLifeCarePortalResources.filter((resource) => resource !== "care-portal"));
const METHODS = Object.freeze({ GET: "read", POST: "create", PUT: "update", PATCH: "update", DELETE: "delete" });
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

function decodeSegment(value) {
  try { return decodeURIComponent(value); }
  catch { return null; }
}

function validSegment(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 200 && !value.includes("/");
}

function parseRoute(request) {
  let url;
  try { url = new URL(request?.url ?? request?.path ?? "/", "http://novalife.internal"); }
  catch { return null; }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 3 || parts[0] !== "api" || parts[1] !== "care") return null;

  let resource;
  let id;
  let targetClientId = null;
  if (parts[2] === "clients") {
    // Client IDs are selectors only. The trusted resolver and authorization
    // policy must still verify client identity, active assignment and consent.
    if (parts.length < 5 || parts.length > 6) return null;
    targetClientId = decodeSegment(parts[3]);
    resource = decodeSegment(parts[4]);
    if (!validSegment(targetClientId)) return null;
    if (parts.length === 6) id = decodeSegment(parts[5]);
  } else {
    // Backwards-compatible resource path; deployments must resolve its target
    // through trusted server-side relationships rather than request body data.
    if (parts.length > 4) return null;
    resource = decodeSegment(parts[2]);
    if (parts.length === 4) id = decodeSegment(parts[3]);
  }

  if (!DATA_RESOURCES.has(resource) || (id !== undefined && !validSegment(id))) return null;
  return { resource, id, targetClientId, query: url.searchParams };
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
 * Framework-neutral router for authenticated NovaLife care-data operations.
 * The hosting server must enforce TLS, request byte limits, timeouts, rate
 * limits, origin/CSRF policy and secure token transport. resolveTargetClientId
 * may use params.targetClientId as an untrusted selector, but must validate
 * the target against trusted account data. The authorization context separately
 * checks active assignment and current consent before any repository operation.
 */
export async function createNovaLifeCareApiRouter({
  pool, authAudit, authorizationAudit, extractToken, resolveTargetClientId, now, ttlMs,
} = {}) {
  if (!pool || typeof pool.query !== "function") throw new TypeError("configured PostgreSQL pool is required");
  if (typeof authAudit !== "function" || typeof authorizationAudit !== "function") {
    throw new TypeError("durable authAudit and authorizationAudit callbacks are required");
  }
  if (typeof extractToken !== "function" || typeof resolveTargetClientId !== "function") {
    throw new TypeError("extractToken and trusted resolveTargetClientId are required");
  }

  // Reuse one authentication runtime and one authorization-context loader for
  // every route. Building a separate Argon2/session stack per route would be
  // wasteful and could create inconsistent runtime behavior.
  const auth = await createNovaLifePostgresAuth({ pool, audit: authAudit, now, ttlMs });
  const loadAuthorizationContext = createPostgresAuthorizationContextLoader({
    pool,
    resolveTargetClientId,
    now: now ? () => new Date(now()) : undefined,
  });
  const authenticate = async (request) => {
    const token = extractToken(request);
    if (typeof token !== "string" || !token) return null;
    const result = await auth.authenticate(token);
    if (!result?.actor) return null;
    return Object.freeze({ id: result.actor.id, role: result.actor.role, active: true });
  };
  const repository = createPostgresCareRecordRepository({ pool });
  const handlers = new Map();
  for (const resource of DATA_RESOURCES) {
    for (const action of ["read", "create", "update", "delete"]) {
      const dataHandler = async (request, context) => {
        const clientId = context.clientId;
        if (action === "read" && request.params.recordId) {
          const record = await repository.get({ clientId, resource, id: request.params.recordId });
          return json(record ? 200 : 404, record ? { record } : { error: "not-found" });
        }
        if (action === "read") {
          const rawLimit = request.query.get("limit");
          const limit = rawLimit === null ? 50 : Number(rawLimit);
          if (!Number.isInteger(limit) || limit < 1 || limit > 100) return json(400, { error: "invalid-limit" });
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
            clientId, resource, id: request.params.recordId, actorId: context.actor.id, data: parsed.data,
          });
          return json(record ? 200 : 404, record ? { record } : { error: "not-found" });
        }
        const removed = await repository.remove({ clientId, resource, id: request.params.recordId });
        return json(removed ? 200 : 404, removed ? { deleted: true } : { error: "not-found" });
      };
      const protectedHandler = createAuthorizedHandler({
        resource,
        action,
        authenticate,
        loadAuthorizationContext,
        audit: authorizationAudit,
        handler: dataHandler,
      });
      handlers.set(resource + ":" + action, protectedHandler);
    }
  }

  return Object.freeze({
    async handle(request) {
      const method = String(request?.method ?? "GET").toUpperCase();
      let requestUrl;
      try { requestUrl = new URL(request?.url ?? request?.path ?? "/", "http://novalife.internal"); }
      catch { return json(404, { error: "not-found" }); }

      // Login/logout share the same reviewed PostgreSQL Argon2id session runtime
      // as care-data routes. Account provisioning is deliberately not public.
      if (requestUrl.pathname === "/api/auth/login") {
        if (method !== "POST") return json(405, { error: "method-not-allowed" });
        const body = request?.body;
        if (!body || typeof body !== "object" || Array.isArray(body) ||
            typeof body.email !== "string" || typeof body.password !== "string" ||
            body.email.length > 320 || body.password.length > 1024) {
          return json(400, { error: "invalid-login-request" });
        }
        try {
          const result = await auth.login({ email: body.email, password: body.password });
          return json(result.status, result.body);
        } catch {
          return json(503, { error: "authentication-unavailable" });
        }
      }
      if (requestUrl.pathname === "/api/auth/logout") {
        if (method !== "POST") return json(405, { error: "method-not-allowed" });
        let token;
        try { token = extractToken(request); }
        catch { return json(401, { error: "unauthenticated" }); }
        if (typeof token !== "string" || !token) return json(401, { error: "unauthenticated" });
        try {
          const revoked = await auth.revoke(token);
          return revoked ? json(200, { loggedOut: true }) : json(401, { error: "unauthenticated" });
        } catch {
          return json(503, { error: "authentication-unavailable" });
        }
      }

      const route = parseRoute(request);
      if (!route) return json(404, { error: "not-found" });
      const action = METHODS[method];
      if (!action) return json(405, { error: "method-not-allowed" });
      if (action === "create" && route.id !== undefined) return json(405, { error: "method-not-allowed" });
      if ((action === "update" || action === "delete") && route.id === undefined) {
        return json(400, { error: "record-id-required" });
      }
      const protectedHandler = handlers.get(route.resource + ":" + action);
      if (!protectedHandler) return json(404, { error: "not-found" });
      const adapted = Object.freeze({
        ...request,
        query: route.query,
        params: Object.freeze({
          ...(request?.params ?? {}),
          resource: route.resource,
          recordId: route.id ?? null,
          targetClientId: route.targetClientId,
        }),
      });
      try { return await protectedHandler(adapted); }
      catch {
        // Never expose SQL errors or sensitive care data in generic failures.
        return json(503, { error: "care-data-unavailable" });
      }
    },
  });
}
