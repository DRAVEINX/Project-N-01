import test from "node:test";
import assert from "node:assert/strict";
import { createPlanSamenApiServer } from "./server.mjs";

async function withServer(run) {
  const server = createPlanSamenApiServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("health endpoint clearly reports the backend is not configured", async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/v1/healthz`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(await response.json(), {
      status: "prototype",
      backendConfigured: false,
      acceptsPersonalData: false
    });
  });
});

test("all API routes fail closed instead of accepting personal data", async () => {
  await withServer(async baseUrl => {
    for (const [method, path] of [
      ["GET", "/api/v1/appointments"],
      ["POST", "/api/v1/appointments"],
      ["PATCH", "/api/v1/relationships/example"],
      ["DELETE", "/api/v1/appointments/example"]
    ]) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: ["POST", "PATCH", "DELETE"].includes(method) ? JSON.stringify({
          title: "must not be stored",
          notes: "test only"
        }) : undefined
      });
      assert.equal(response.status, 503, `${method} ${path} must remain disabled`);
      const body = await response.json();
      assert.equal(body.error.code, "BACKEND_NOT_CONFIGURED");
      assert.ok(body.error.requestId);
      assert.doesNotMatch(JSON.stringify(body), /must not be stored|test only/);
    }
  });
});

test("unknown non-API paths return a safe 404 response", async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/not-a-route`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, "NOT_FOUND");
  });
});

test("disabled health route rejects non-GET methods and keeps security headers", async () => {
  await withServer(async baseUrl => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      const response = await fetch(`${baseUrl}/api/v1/healthz`, {
        method,
        headers: { "content-type": "application/json" },
        body: ["POST", "PUT", "PATCH", "DELETE"].includes(method) ? JSON.stringify({ personalData: "must not be accepted" }) : undefined
      });
      assert.equal(response.status, 503, `${method} must not expose the health handler as a write route`);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("x-frame-options"), "DENY");
      assert.equal(response.headers.get("referrer-policy"), "no-referrer");
      const body = await response.text();
      assert.doesNotMatch(body, /must not be accepted/);
    }
  });
});

test("API routes remain disabled with query strings and trailing slashes", async () => {
  await withServer(async baseUrl => {
    for (const path of [
      "/api/v1/appointments?clientId=example",
      "/api/v1/appointments/",
      "/api/?debug=true"
    ]) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.equal(response.status, 503, `${path} must remain disabled`);
      assert.equal((await response.json()).error.code, "BACKEND_NOT_CONFIGURED");
    }
  });
});
