import { randomUUID } from "node:crypto";
import { novaLifeCarePortalResources } from "./care-portal-handler.js";
import { createPostgresCareRecordRepository } from "./postgres-care-record-repository.js";
import { createNovaLifePostgresAuth } from "./postgres-auth-runtime.js";
import { createPostgresAuthorizationContextLoader } from "./postgres-authorization-context.js";
import { createAuthorizedHandler } from "./authorized-handler.js";

const DATA_RESOURCES = new Set([...novaLifeCarePortalResources.filter((resource) => resource !== "care-portal"), "mood-report"]);
const METHODS = Object.freeze({ GET: "read", POST: "create", PUT: "update", PATCH: "update", DELETE: "delete" });
const MAX_BODY_BYTES = 64 * 1024;
const CONSENT_SCOPES = new Set([
  "mood", "journal", "care_plan", "care_note", "care_task", "care_report",
  "care_document", "medication_overview", "care_message", "roster", "team",
  "care_consents",
]);
const CONSENT_GRANTEE_ROLES = new Set(["caregiver", "parent", "guardian"]);

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

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function decodeSegment(value) {
  try { return decodeURIComponent(value); }
  catch { return null; }
}

function validSegment(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 200 &&
    value.trim() === value &&
    !value.includes("/") && !value.includes("\\") &&
    !value.includes("?") && !value.includes("#") &&
    !/[\u0000-\u001F\u007F]/.test(value);
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
  if (!isPlainObject(body)) return { error: "invalid-json-object" };
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

  const consentHandlers = new Map();

  const listOwnConsents = createAuthorizedHandler({
    resource: "consent-management",
    action: "read",
    authenticate,
    loadAuthorizationContext,
    audit: authorizationAudit,
    handler: async (_request, context) => {
      const result = await pool.query(
        `SELECT id, grantee_id, scope, granted_at, expires_at, revoked_at
           FROM novalife_consent_grants
          WHERE client_id = $1
          ORDER BY granted_at DESC, id ASC
          LIMIT 200`,
        [context.clientId]
      );
      return json(200, {
        consents: (result?.rows ?? []).map((row) => ({
          id: row.id,
          granteeId: row.grantee_id,
          scope: row.scope,
          grantedAt: row.granted_at,
          expiresAt: row.expires_at,
          revokedAt: row.revoked_at,
        })),
      });
    },
  });

  const grantOwnConsent = createAuthorizedHandler({
    resource: "consent-management",
    action: "create",
    authenticate,
    loadAuthorizationContext,
    audit: authorizationAudit,
    handler: async (request, context) => {
      const parsed = validateBody(request);
      if (parsed.error) return json(400, { error: parsed.error });
      const body = parsed.data;
      const allowedFields = new Set(["granteeId", "scope", "expiresAt"]);
      if (Object.keys(body).some((key) => !allowedFields.has(key)) ||
          typeof body.granteeId !== "string" || !validSegment(body.granteeId) ||
          body.granteeId === context.actor.id ||
          typeof body.scope !== "string" || !CONSENT_SCOPES.has(body.scope)) {
        return json(400, { error: "invalid-consent-request" });
      }

      let expiresAt = null;
      if (body.expiresAt !== undefined && body.expiresAt !== null && body.expiresAt !== "") {
        if (typeof body.expiresAt !== "string") return json(400, { error: "invalid-consent-expiry" });
        const parsedExpiry = Date.parse(body.expiresAt);
        if (!Number.isFinite(parsedExpiry)) return json(400, { error: "invalid-consent-expiry" });
        const nowValue = typeof now === "function" ? now() : Date.now();
        const nowMs = nowValue instanceof Date ? nowValue.getTime() : Number(nowValue);
        if (!Number.isFinite(nowMs) || parsedExpiry <= nowMs) {
          return json(400, { error: "invalid-consent-expiry" });
        }
        expiresAt = new Date(parsedExpiry).toISOString();
      }

      const result = await pool.query(
        `INSERT INTO novalife_consent_grants
           (id, client_id, grantee_id, scope, granted_by, expires_at)
         SELECT $1, $2, account.id, $4, $2, $5
           FROM novalife_accounts AS account
          WHERE account.id = $3
            AND account.active = TRUE
            AND account.role IN ('caregiver', 'parent', 'guardian')
         ON CONFLICT (client_id, grantee_id, scope) WHERE revoked_at IS NULL
         DO UPDATE SET
           granted_by = EXCLUDED.granted_by,
           granted_at = now(),
           expires_at = EXCLUDED.expires_at
         RETURNING id, grantee_id, scope, granted_at, expires_at, revoked_at`,
        [randomUUID(), context.clientId, body.granteeId, body.scope, expiresAt]
      );
      const row = result?.rows?.[0];
      if (!row) return json(400, { error: "invalid-consent-recipient" });
      return json(201, {
        consent: {
          id: row.id,
          granteeId: row.grantee_id,
          scope: row.scope,
          grantedAt: row.granted_at,
          expiresAt: row.expires_at,
          revokedAt: row.revoked_at,
        },
      });
    },
  });

  const revokeOwnConsent = createAuthorizedHandler({
    resource: "consent-management",
    action: "delete",
    authenticate,
    loadAuthorizationContext,
    audit: authorizationAudit,
    handler: async (request, context) => {
      const grantId = request.params?.consentId;
      if (typeof grantId !== "string" || !validSegment(grantId)) {
        return json(404, { error: "not-found" });
      }
      const result = await pool.query(
        `UPDATE novalife_consent_grants
            SET revoked_at = now()
          WHERE id = $1
            AND client_id = $2
            AND revoked_at IS NULL
          RETURNING id`,
        [grantId, context.clientId]
      );
      if (!result?.rows?.length) return json(404, { error: "not-found" });
      return json(200, { revoked: true });
    },
  });

  consentHandlers.set("read", listOwnConsents);
  consentHandlers.set("create", grantOwnConsent);
  consentHandlers.set("delete", revokeOwnConsent);

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
        let loginBodyBytes;
        try {
          loginBodyBytes = isPlainObject(body)
            ? Buffer.byteLength(JSON.stringify(body), "utf8")
            : Infinity;
        } catch {
          loginBodyBytes = Infinity;
        }
        if (!isPlainObject(body) || !Number.isFinite(loginBodyBytes) ||
            loginBodyBytes > MAX_BODY_BYTES ||
            typeof body.email !== "string" || typeof body.password !== "string" ||
            body.email.trim().length === 0 || body.email.length > 320 ||
            body.password.length === 0 || body.password.length > 1024) {
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

      if (requestUrl.pathname === "/api/consents") {
        const action = METHODS[method];
        if (action !== "read" && action !== "create") return json(405, { error: "method-not-allowed" });
        const handler = consentHandlers.get(action);
        const adapted = Object.freeze({
          ...request,
          query: requestUrl.searchParams,
          params: Object.freeze({ ...(request?.params ?? {}), targetClientId: null, consentId: null }),
        });
        try { return await handler(adapted); }
        catch {
          return json(503, { error: "consent-management-unavailable" });
        }
      }

      if (requestUrl.pathname.startsWith("/api/consents/")) {
        if (method !== "DELETE") return json(405, { error: "method-not-allowed" });
        const rawId = requestUrl.pathname.slice("/api/consents/".length);
        let consentId;
        try { consentId = decodeURIComponent(rawId); } catch { return json(404, { error: "not-found" }); }
        if (!validSegment(consentId) || consentId.includes("/")) return json(404, { error: "not-found" });
        try {
          return await consentHandlers.get("delete")(Object.freeze({
            ...request,
            query: requestUrl.searchParams,
            params: Object.freeze({ ...(request?.params ?? {}), targetClientId: null, consentId }),
          }));
        } catch {
          return json(503, { error: "consent-management-unavailable" });
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
