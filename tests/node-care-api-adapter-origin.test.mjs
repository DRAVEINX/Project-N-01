import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { handleNodeCareApiRequest } from "../src/server/node-care-api-adapter.js";

function request({ origin, encrypted = true } = {}) {
  const req = Readable.from(['{"ok":true}']);
  req.method = "POST";
  req.url = "/api/care/care-note";
  req.headers = {
    "content-type": "application/json",
    ...(origin === undefined ? {} : { origin }),
  };
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
  };
}

function router() {
  return { calls: 0, async handle() { this.calls++; return { status: 200, body: { ok: true } }; } };
}

test("Node adapter compares mutation origins exactly, without URL normalization", async () => {
  const api = router();
  const res = response();
  await handleNodeCareApiRequest(
    request({ origin: "https://app.example/" }),
    res,
    api,
    { allowedOrigins: ["https://app.example"] },
  );

  assert.equal(res.status, 403);
  assert.deepEqual(JSON.parse(res.body), { error: "origin-not-allowed" });
  assert.equal(api.calls, 0);
});

test("Node adapter allows missing mutation Origin only after explicit opt-in", async () => {
  const deniedApi = router();
  const deniedRes = response();
  await handleNodeCareApiRequest(request(), deniedRes, deniedApi, {
    allowedOrigins: ["https://app.example"],
  });
  assert.equal(deniedRes.status, 403);
  assert.equal(deniedApi.calls, 0);

  const allowedApi = router();
  const allowedRes = response();
  await handleNodeCareApiRequest(request(), allowedRes, allowedApi, {
    allowMissingOrigin: true,
  });
  assert.equal(allowedRes.status, 200);
  assert.equal(allowedApi.calls, 1);
});

test("Node adapter fails closed when the secure-transport verifier throws", async () => {
  const api = router();
  const res = response();
  await handleNodeCareApiRequest(request({ origin: "https://app.example" }), res, api, {
    allowedOrigins: ["https://app.example"],
    isSecureRequest() { throw new Error("untrusted proxy configuration"); },
  });

  assert.equal(res.status, 400);
  assert.deepEqual(JSON.parse(res.body), { error: "secure-transport-required" });
  assert.equal(api.calls, 0);
});
