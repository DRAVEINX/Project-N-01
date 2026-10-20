import test from "node:test";
import assert from "node:assert/strict";
import { createCareApiClient, createCareApiSession } from "../src/care-api-client.js";

function response(status = 200, body = { records: [] }) {
  return { status, ok: status >= 200 && status < 300, async json() { return body; } };
}

test("client requires HTTPS outside loopback and rejects credential-bearing base URLs", () => {
  assert.throws(() => createCareApiClient({ baseUrl: "http://api.example.test", getAccessToken: () => "token" }), /requires HTTPS/);
  assert.throws(() => createCareApiClient({ baseUrl: "https://user:pass@api.example.test", getAccessToken: () => "token" }), /must not contain credentials/);
  assert.doesNotThrow(() => createCareApiClient({ baseUrl: "http://localhost:4173", getAccessToken: () => "token" }));
});

test("client fails closed when there is no access token and never calls fetch", async () => {
  let calls = 0;
  const api = createCareApiClient({ baseUrl: "https://api.example.test", getAccessToken: () => null, fetchImpl: async () => { calls += 1; return response(); } });
  await assert.rejects(api.list("client-1", "care-note"), (error) => error.code === "authentication-required");
  assert.equal(calls, 0);
});

test("list sends a bearer token without cookies and uses no-store", async () => {
  let observed;
  const api = createCareApiClient({
    baseUrl: "https://api.example.test/",
    getAccessToken: () => "short-lived-test-token",
    fetchImpl: async (url, options) => { observed = { url, options }; return response(); },
  });
  await api.list("client 1", "care-note", { limit: 20 });
  assert.equal(observed.url, "https://api.example.test/api/care/clients/client%201/care-note?limit=20");
  assert.equal(observed.options.headers.authorization, "Bearer short-lived-test-token");
  assert.equal(observed.options.credentials, "omit");
  assert.equal(observed.options.cache, "no-store");
  assert.equal(observed.options.redirect, "error");
  assert.equal(observed.options.referrerPolicy, "no-referrer");
  assert.equal(observed.options.body, undefined);
});

test("client rejects untrusted resource names, malformed identifiers and invalid limits before fetch", async () => {
  let calls = 0;
  const api = createCareApiClient({ baseUrl: "https://api.example.test", getAccessToken: () => "token", fetchImpl: async () => { calls += 1; return response(); } });
  assert.throws(() => api.list("client-1", "account-admin"), /not allow-listed/);
  assert.throws(() => api.list("client-1", "care-note", { limit: 101 }), /limit must be/);
  assert.throws(() => api.get("client/other", "care-note", "note-1"), /valid client ID/);
  assert.throws(() => api.create("client-1", "care-note", []), /JSON object body/);
  assert.equal(calls, 0);
});

test("client sends mutations as JSON and surfaces server authorization errors", async () => {
  const calls = [];
  const api = createCareApiClient({
    baseUrl: "https://api.example.test",
    getAccessToken: () => "token",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1 ? response(201, { id: "note-1" }) : response(403, { error: "forbidden" });
    },
  });
  assert.deepEqual(await api.create("client-1", "care-note", { text: "test" }), { id: "note-1" });
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].options.body), { text: "test" });
  await assert.rejects(api.update("client-1", "care-note", "note-1", { text: "updated" }), (error) => error.status === 403 && error.code === "forbidden");
});


test("login sends credentials without requiring an existing token and uses safe fetch defaults", async () => {
  let observed;
  const api = createCareApiClient({
    baseUrl: "https://api.example.test",
    getAccessToken: () => null,
    fetchImpl: async (url, options) => {
      observed = { url, options };
      return response(200, { accessToken: "short-lived-token", actor: { id: "client-1", role: "client" } });
    },
  });
  const result = await api.login("client@example.test", "long-test-password");
  assert.equal(result.actor.role, "client");
  assert.equal(observed.url, "https://api.example.test/api/auth/login");
  assert.equal(observed.options.credentials, "omit");
  assert.equal(observed.options.cache, "no-store");
  assert.equal(observed.options.redirect, "error");
  assert.equal(observed.options.referrerPolicy, "no-referrer");
  assert.deepEqual(JSON.parse(observed.options.body), { email: "client@example.test", password: "long-test-password" });
  assert.equal("authorization" in observed.options.headers, false);
});

test("login validates input locally and surfaces generic authentication failures", async () => {
  let calls = 0;
  const api = createCareApiClient({
    baseUrl: "https://api.example.test",
    getAccessToken: () => null,
    fetchImpl: async () => { calls += 1; return response(401, { error: "invalid-credentials" }); },
  });
  await assert.rejects(api.login("", "password"), /valid email and password/);
  await assert.rejects(api.login("not-an-email", "password"), /valid email and password/);
  await assert.rejects(api.login("valid@example.test", "   "), /valid email and password/);
  assert.equal(calls, 0);
  await assert.rejects(api.login("missing@example.test", "password"), (error) => error.status === 401 && error.code === "invalid-credentials");
  assert.equal(calls, 1);
});


test("session keeps the bearer token in memory, attaches it to requests, and clears on logout", async () => {
  let now = 1_800_000_000_000;
  const calls = [];
  const session = createCareApiSession({
    baseUrl: "https://api.example.test",
    now: () => now,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/api/auth/login")) {
        return response(200, {
          accessToken: "a".repeat(43),
          tokenType: "Bearer",
          expiresAt: now + 60_000,
          actor: { id: "caregiver-1", role: "caregiver" },
        });
      }
      if (url.endsWith("/api/auth/logout")) return response(200, { loggedOut: true });
      return response(200, { records: [] });
    },
  });

  assert.equal(session.isAuthenticated(), false);
  const login = await session.login("caregiver@example.test", "test-password");
  assert.deepEqual(login.actor, { id: "caregiver-1", role: "caregiver" });
  assert.equal(session.isAuthenticated(), true);
  assert.deepEqual(session.getActor(), { id: "caregiver-1", role: "caregiver" });

  await session.api.list("client-1", "care-note");
  assert.equal(calls[1].options.headers.authorization, `Bearer ${"a".repeat(43)}`);
  assert.equal(calls[1].options.credentials, "omit");

  await session.logout();
  assert.equal(session.isAuthenticated(), false);
  assert.equal(session.getActor(), null);
  await assert.rejects(session.api.list("client-1", "care-note"), (error) => error.code === "authentication-required");
});

test("session expires in memory and rejects malformed successful login responses", async () => {
  let now = 1_800_000_000_000;
  const session = createCareApiSession({
    baseUrl: "https://api.example.test",
    now: () => now,
    fetchImpl: async () => response(200, {
      accessToken: "b".repeat(43),
      tokenType: "Bearer",
      expiresAt: now + 1000,
      actor: { id: "client-1", role: "client" },
    }),
  });
  await session.login("client@example.test", "test-password");
  now += 1001;
  assert.equal(session.isAuthenticated(), false);
  assert.equal(session.getActor(), null);

  const malformed = createCareApiSession({
    baseUrl: "https://api.example.test",
    now: () => now,
    fetchImpl: async () => response(200, { actor: { id: "client-1", role: "client" } }),
  });
  await assert.rejects(malformed.login("client@example.test", "test-password"), /invalid-authentication-response/);
  assert.equal(malformed.isAuthenticated(), false);
});


test("failed account switch clears the previous in-memory identity", async () => {
  let loginCalls = 0;
  const session = createCareApiSession({
    baseUrl: "https://api.example.test",
    fetchImpl: async () => {
      loginCalls += 1;
      return loginCalls === 1
        ? response(200, {
            accessToken: "c".repeat(43),
            tokenType: "Bearer",
            expiresAt: Date.now() + 60_000,
            actor: { id: "client-1", role: "client" },
          })
        : response(401, { error: "invalid-credentials" });
    },
  });
  await session.login("client@example.test", "first-password");
  assert.equal(session.isAuthenticated(), true);
  await assert.rejects(session.login("caregiver@example.test", "wrong-password"), (error) => error.status === 401);
  assert.equal(session.isAuthenticated(), false);
  assert.equal(session.getActor(), null);
});


test("consent client lists grants, creates a scoped grant and revokes it with bearer auth", async () => {
  const calls = [];
  const api = createCareApiClient({
    baseUrl: "https://api.example.test",
    getAccessToken: () => "short-lived-consent-token",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (options.method === "POST") {
        return response(201, { consent: { id: "grant-1", granteeId: "caregiver-1", scope: "care_note" } });
      }
      if (options.method === "DELETE") return response(200, { revoked: true });
      return response(200, { consents: [{ id: "grant-1", scope: "care_note" }] });
    },
  });

  assert.equal((await api.listMyConsents()).consents.length, 1);
  assert.equal(calls[0].url, "https://api.example.test/api/consents");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.headers.authorization, "Bearer short-lived-consent-token");

  const granted = await api.grantConsent({
    granteeId: "caregiver 1",
    scope: "care_note",
    expiresAt: "2030-01-01T00:00:00.000Z",
  });
  assert.equal(granted.consent.id, "grant-1");
  assert.equal(calls[1].url, "https://api.example.test/api/consents");
  assert.equal(calls[1].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    granteeId: "caregiver 1",
    scope: "care_note",
    expiresAt: "2030-01-01T00:00:00.000Z",
  });
  assert.equal(calls[1].options.credentials, "omit");
  assert.equal(calls[1].options.cache, "no-store");

  assert.deepEqual(await api.revokeConsent("grant-1"), { revoked: true });
  assert.equal(calls[2].url, "https://api.example.test/api/consents/grant-1");
  assert.equal(calls[2].options.method, "DELETE");
  assert.equal(calls[2].options.headers.authorization, "Bearer short-lived-consent-token");
});

test("consent client rejects invalid scopes, identifiers and expiry values before fetch", async () => {
  let calls = 0;
  const api = createCareApiClient({
    baseUrl: "https://api.example.test",
    getAccessToken: () => "token",
    fetchImpl: async () => { calls += 1; return response(); },
  });

  assert.throws(() => api.grantConsent({ granteeId: "caregiver-1", scope: "*" }), /not allow-listed/);
  assert.throws(() => api.grantConsent({ granteeId: "bad/id", scope: "care_note" }), /valid grantee ID/);
  assert.throws(() => api.grantConsent({ granteeId: "caregiver-1", scope: "care_note", expiresAt: "not-a-date" }), /valid date-time/);
  assert.throws(() => api.revokeConsent("bad/id"), /valid consent ID/);
  assert.equal(calls, 0);
});

test("consent client never sends a request without an in-memory bearer token", async () => {
  let calls = 0;
  const api = createCareApiClient({
    baseUrl: "https://api.example.test",
    getAccessToken: () => null,
    fetchImpl: async () => { calls += 1; return response(); },
  });
  await assert.rejects(api.listMyConsents(), (error) => error.code === "authentication-required");
  await assert.rejects(api.grantConsent({ granteeId: "caregiver-1", scope: "care_note" }), (error) => error.code === "authentication-required");
  await assert.rejects(api.revokeConsent("grant-1"), (error) => error.code === "authentication-required");
  assert.equal(calls, 0);
});
