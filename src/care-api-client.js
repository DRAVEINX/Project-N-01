const ALLOWED_RESOURCES = new Set([
  "care-portal",
  "care-plan",
  "care-note",
  "care-task",
  "care-report",
  "care-document",
  "medication-overview",
  "care-message",
  "care-roster",
  "care-team",
  "care-consent-record",
]);
const ID_PATTERN = /^[^/\\?#]+$/;

function validId(value, label) {
  if (typeof value !== "string" || !value.trim() || value.length > 200 || !ID_PATTERN.test(value)) {
    throw new TypeError(`valid ${label} is required`);
  }
  return encodeURIComponent(value);
}

function normalizeBaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new TypeError("a configured API base URL is required"); }
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError("API base URL must not contain credentials, query, or fragment");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
    throw new TypeError("care API requires HTTPS (HTTP is allowed only on loopback for local development)");
  }
  return url.href.endsWith("/") ? url.href.slice(0, -1) : url.href;
}

/**
 * Minimal browser/Capacitor client for the authenticated care-data API.
 * Access tokens remain owned by the caller and are never persisted here.
 * Login is delegated to the server; account provisioning and authorization remain
 * server responsibilities for identity, assignments, consent and roles.
 */
export function createCareApiClient({ baseUrl, getAccessToken, fetchImpl = globalThis.fetch } = {}) {
  const base = normalizeBaseUrl(baseUrl);
  if (typeof getAccessToken !== "function") throw new TypeError("getAccessToken callback is required");
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");

  async function request(path, { method = "GET", body } = {}) {
    const token = await getAccessToken();
    if (typeof token !== "string" || !token.trim()) {
      const error = new Error("authentication-required");
      error.code = "authentication-required";
      throw error;
    }

    const headers = { accept: "application/json", authorization: `Bearer ${token}` };
    const options = {
      method,
      headers,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
    };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const response = await fetchImpl(`${base}${path}`, options);
    if (!response || !Number.isInteger(response.status)) throw new Error("care-api-invalid-response");
    let payload = null;
    try { payload = await response.json(); } catch { /* generic error below */ }
    if (!response.ok) {
      const error = new Error(typeof payload?.error === "string" ? payload.error : "care-api-request-failed");
      error.status = response.status;
      error.code = typeof payload?.error === "string" ? payload.error : "care-api-request-failed";
      throw error;
    }
    return payload;
  }

  async function login(email, password) {
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 ||
        typeof password !== "string" || !password.trim() || password.length > 1024) {
      throw new TypeError("valid email and password are required");
    }
    const response = await fetchImpl(`${base}/api/auth/login`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
    });
    let payload = null;
    try { payload = await response.json(); } catch { /* generic error below */ }
    if (!response.ok) {
      const error = new Error(typeof payload?.error === "string" ? payload.error : "authentication-failed");
      error.status = response.status;
      error.code = typeof payload?.error === "string" ? payload.error : "authentication-failed";
      throw error;
    }
    return payload;
  }

  return Object.freeze({
    login,
    logout() {
      return request("/api/auth/logout", { method: "POST" });
    },
    list(clientId, resource, { limit } = {}) {
      const client = validId(clientId, "client ID");
      if (!ALLOWED_RESOURCES.has(resource)) throw new TypeError("resource is not allow-listed");
      const params = new URLSearchParams();
      if (limit !== undefined) {
        if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new TypeError("limit must be an integer from 1 to 100");
        params.set("limit", String(limit));
      }
      const suffix = params.size ? `?${params}` : "";
      return request(`/api/care/clients/${client}/${encodeURIComponent(resource)}${suffix}`);
    },
    get(clientId, resource, recordId) {
      const client = validId(clientId, "client ID");
      const record = validId(recordId, "record ID");
      if (!ALLOWED_RESOURCES.has(resource)) throw new TypeError("resource is not allow-listed");
      return request(`/api/care/clients/${client}/${encodeURIComponent(resource)}/${record}`);
    },
    create(clientId, resource, data) {
      const client = validId(clientId, "client ID");
      if (!ALLOWED_RESOURCES.has(resource)) throw new TypeError("resource is not allow-listed");
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new TypeError("JSON object body is required");
      return request(`/api/care/clients/${client}/${encodeURIComponent(resource)}`, { method: "POST", body: data });
    },
    update(clientId, resource, recordId, data) {
      const client = validId(clientId, "client ID");
      const record = validId(recordId, "record ID");
      if (!ALLOWED_RESOURCES.has(resource)) throw new TypeError("resource is not allow-listed");
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new TypeError("JSON object body is required");
      return request(`/api/care/clients/${client}/${encodeURIComponent(resource)}/${record}`, { method: "PATCH", body: data });
    },
    remove(clientId, resource, recordId) {
      const client = validId(clientId, "client ID");
      const record = validId(recordId, "record ID");
      if (!ALLOWED_RESOURCES.has(resource)) throw new TypeError("resource is not allow-listed");
      return request(`/api/care/clients/${client}/${encodeURIComponent(resource)}/${record}`, { method: "DELETE" });
    },
  });
}


/**
 * Keep a signed-in session in memory only. This wrapper deliberately avoids
 * localStorage/sessionStorage so a bearer token is not left behind on shared
 * devices. A reload requires signing in again.
 */
export function createCareApiSession({ baseUrl, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  if (typeof now !== "function") throw new TypeError("clock callback is required");
  let accessToken = null;
  let expiresAt = 0;
  let actor = null;

  function clearSession() {
    accessToken = null;
    expiresAt = 0;
    actor = null;
  }

  function getAccessToken() {
    if (!accessToken || !Number.isSafeInteger(expiresAt) || expiresAt <= now()) {
      clearSession();
      return null;
    }
    return accessToken;
  }

  const api = createCareApiClient({ baseUrl, getAccessToken, fetchImpl });

  async function login(email, password) {
    // Do not allow a failed account switch to leave the previous identity active.
    clearSession();
    const result = await api.login(email, password);
    if (!result || typeof result.accessToken !== "string" ||
        !result.accessToken.trim() || result.tokenType !== "Bearer" ||
        !Number.isSafeInteger(result.expiresAt) || result.expiresAt <= now() ||
        !result.actor || typeof result.actor.id !== "string" ||
        typeof result.actor.role !== "string") {
      throw new Error("invalid-authentication-response");
    }
    accessToken = result.accessToken;
    expiresAt = result.expiresAt;
    actor = Object.freeze({ id: result.actor.id, role: result.actor.role });
    return Object.freeze({ actor, expiresAt });
  }

  async function logout() {
    if (!getAccessToken()) return;
    try {
      await api.logout();
    } finally {
      clearSession();
    }
  }

  return Object.freeze({
    api,
    login,
    logout,
    getActor() {
      return getAccessToken() ? actor : null;
    },
    isAuthenticated() {
      return getAccessToken() !== null;
    },
  });
}
