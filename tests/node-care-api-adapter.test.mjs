import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { handleNodeCareApiRequest } from "../src/server/node-care-api-adapter.js";

function request({ method = "GET", url = "/api/care/care-note", headers = {}, chunks = [], encrypted = true } = {}) {
  const req = Readable.from(chunks);
  req.method = method;
  req.url = url;
  req.headers = headers;
  req.socket = { encrypted };
  return req;
}

function response() {
  return {
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = body; },
    destroy() { this.destroyed = true; },
  };
}

function router(result = { status: 200, body: { records: [] } }) {
  return { calls: [], async handle(req) { this.calls.push(req); return result; } };
}

test("Node adapter rejects insecure transport before calling router", async () => {
  const api = router();
  const res = response();
  await handleNodeCareApiRequest(request({ encrypted: false }), res, api);
  assert.equal(res.status, 400);
  assert.equal(api.calls.length, 0);
});

test("Node adapter denies mutation requests without an allowed origin by default", async () => {
  const api = router();
  const res = response();
  await handleNodeCareApiRequest(request({ method: "POST", headers: { "content-type": "application/json" }, chunks: ['{"text":"x"}'] }), res, api, { allowedOrigins: ["https://app.example"] });
  assert.equal(res.status, 403);
  assert.equal(api.calls.length, 0);
});

test("Node adapter rejects oversized bodies while reading the stream", async () => {
  const api = router();
  const res = response();
  await handleNodeCareApiRequest(request({
    method: "POST",
    headers: { origin: "https://app.example", "content-type": "application/json" },
    chunks: ['{"text":"this is too long"}'],
  }), res, api, { allowedOrigins: ["https://app.example"], maxBodyBytes: 8 });
  assert.equal(res.status, 413);
  assert.equal(api.calls.length, 0);
});

test("Node adapter parses bounded JSON and forwards authenticated request headers", async () => {
  const api = router({ status: 201, body: { created: true } });
  const res = response();
  await handleNodeCareApiRequest(request({
    method: "POST",
    headers: {
      origin: "https://app.example",
      "content-type": "application/json",
      authorization: "Bearer test-token",
      "x-request-id": "req-123",
    },
    chunks: ['{"text":"hello"}'],
  }), res, api, { allowedOrigins: ["https://app.example"] });
  assert.equal(res.status, 201);
  assert.deepEqual(JSON.parse(res.body), { created: true });
  assert.deepEqual(api.calls[0].body, { text: "hello" });
  assert.equal(api.calls[0].headers.authorization, "Bearer test-token");
  assert.equal(api.calls[0].requestId, "req-123");
  assert.equal(res.headers["cache-control"], "no-store");
});

test("Node adapter rejects non-object JSON bodies before calling the router", async () => {
  const api = router();
  const cases = [
    { chunks: ['"just a string"'] },
    { chunks: ["42"] },
    { chunks: ["true"] },
    { chunks: ["null"] },
    { chunks: ["[]"] },
  ];

  for (const item of cases) {
    const res = response();
    await handleNodeCareApiRequest(request({
      method: "POST",
      headers: { origin: "https://app.example", "content-type": "application/json" },
      chunks: item.chunks,
    }), res, api, { allowedOrigins: ["https://app.example"] });
    assert.equal(res.status, 400);
    assert.deepEqual(JSON.parse(res.body), { error: "invalid-request" });
  }
  assert.equal(api.calls.length, 0, "non-object JSON bodies must not reach the router");
});

test("Node adapter rejects invalid JSON and non-JSON content types", async () => {
  const api = router();
  const badJson = response();
  await handleNodeCareApiRequest(request({
    method: "POST",
    headers: { origin: "https://app.example", "content-type": "application/json" },
    chunks: ["{bad"],
  }), badJson, api, { allowedOrigins: ["https://app.example"] });
  assert.equal(badJson.status, 400);

  const badType = response();
  await handleNodeCareApiRequest(request({
    method: "POST",
    headers: { origin: "https://app.example", "content-type": "text/plain" },
    chunks: ["hello"],
  }), badType, api, { allowedOrigins: ["https://app.example"] });
  assert.equal(badType.status, 415);
  assert.equal(api.calls.length, 0);
});

test("Node adapter forwards secure login requests to the auth router", async () => {
  const api = router({ status: 200, body: { actor: { id: "account-1", role: "client" }, accessToken: "test-token" } });
  const res = response();
  await handleNodeCareApiRequest(request({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin: "https://app.example", "content-type": "application/json" },
    chunks: ['{"email":"client@example.test","password":"test-password"}'],
  }), res, api, { allowedOrigins: ["https://app.example"] });
  assert.equal(res.status, 200);
  assert.equal(api.calls.length, 1);
  assert.equal(api.calls[0].url, "/api/auth/login");
  assert.deepEqual(api.calls[0].body, { email: "client@example.test", password: "test-password" });
});

test("Node adapter applies the same origin policy to auth mutations", async () => {
  const api = router();
  const res = response();
  await handleNodeCareApiRequest(request({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin: "https://untrusted.example", "content-type": "application/json" },
    chunks: ['{"email":"client@example.test","password":"test-password"}'],
  }), res, api, { allowedOrigins: ["https://app.example"] });
  assert.equal(res.status, 403);
  assert.equal(api.calls.length, 0);
});

test("Node adapter rejects malformed or oversized Content-Length before reading body", async () => {
  const api = router();
  const cases = [
    { contentLength: "not-a-number", expectedStatus: 413 },
    { contentLength: "-1", expectedStatus: 413 },
    { contentLength: "9", expectedStatus: 413, maxBodyBytes: 8 },
  ];

  for (const item of cases) {
    const res = response();
    await handleNodeCareApiRequest(request({
      method: "POST",
      headers: {
        origin: "https://app.example",
        "content-type": "application/json",
        "content-length": item.contentLength,
      },
      chunks: ['{"x":1}'],
    }), res, api, {
      allowedOrigins: ["https://app.example"],
      maxBodyBytes: item.maxBodyBytes ?? 64 * 1024,
    });
    assert.equal(res.status, item.expectedStatus);
  }
  assert.equal(api.calls.length, 0, "invalid Content-Length must not reach the router");
});


test("Node adapter hides unexpected router errors behind a no-store 503 response", async () => {
  const api = {
    calls: 0,
    async handle() {
      this.calls++;
      throw new Error("sensitive database connection details");
    },
  };
  const res = response();
  await handleNodeCareApiRequest(request({ url: "/api/care/care-plan" }), res, api);

  assert.equal(api.calls, 1);
  assert.equal(res.status, 503);
  assert.deepEqual(JSON.parse(res.body), { error: "care-data-unavailable" });
  assert.equal(res.headers["cache-control"], "no-store");
  assert.doesNotMatch(res.body, /sensitive database connection details/);
});
