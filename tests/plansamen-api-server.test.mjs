import test from "node:test";
import assert from "node:assert/strict";
import { createPlanSamenApiServer } from "../backend/plansamen/server.mjs";

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
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

test("PlanSamen health endpoint explicitly reports the unconfigured prototype state", async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/v1/healthz`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "prototype",
      backendConfigured: false,
      acceptsPersonalData: false
    });
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'none'/);
  });
});

test("PlanSamen API routes fail closed instead of accepting personal data", async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/v1/appointments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Private appointment",
        clientName: "Example person",
        notes: "Must not be accepted"
      })
    });

    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.equal(payload.error.code, "BACKEND_NOT_CONFIGURED");
    assert.equal(payload.error.message, "Online functies zijn nog niet beschikbaar.");
    assert.match(payload.error.requestId, /^[0-9a-f-]{36}$/i);
  });
});

test("unknown non-API paths return a safe not-found response", async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/not-a-route`);
    assert.equal(response.status, 404);
    const payload = await response.json();
    assert.equal(payload.error.code, "NOT_FOUND");
    assert.equal(payload.error.message, "Niet gevonden.");
    assert.match(payload.error.requestId, /^[0-9a-f-]{36}$/i);
  });
});
