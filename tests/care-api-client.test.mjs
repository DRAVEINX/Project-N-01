import test from "node:test";
import assert from "node:assert/strict";
import { createCareApiClient } from "../src/care-api-client.js";

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
