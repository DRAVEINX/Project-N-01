import test from "node:test";
import assert from "node:assert/strict";
import { createNovaLifePostgresAuthorizedHandler } from "../src/server/novalife-authorized-handler.js";

test("authorized PostgreSQL handler requires a trusted context loader or target resolver", async () => {
  await assert.rejects(
    createNovaLifePostgresAuthorizedHandler({
      pool: null,
      authAudit: async () => {},
      authorizationAudit: async () => {},
      resource: "care-plan",
      action: "read",
      extractToken: () => null,
      handler: async () => ({ status: 200, body: {} }),
    }),
    /loadAuthorizationContext or resolveTargetClientId/
  );
});

test("authorized PostgreSQL handler rejects missing resource/action configuration before DB setup", async () => {
  await assert.rejects(
    createNovaLifePostgresAuthorizedHandler({
      pool: null,
      authAudit: async () => {},
      authorizationAudit: async () => {},
      extractToken: () => null,
      loadAuthorizationContext: async () => ({}),
      handler: async () => ({ status: 200, body: {} }),
    }),
    /resource, action, extractToken/
  );
});

test("factory wires the PostgreSQL context loader when given a trusted target resolver", async () => {
  const pool = { async query() { return { rows: [] }; } };
  let resolverCalls = 0;
  const authorizedHandler = await createNovaLifePostgresAuthorizedHandler({
    pool,
    authAudit: async () => {},
    authorizationAudit: async () => {},
    extractToken: () => null,
    resolveTargetClientId: async () => {
      resolverCalls += 1;
      return "client-1";
    },
    resource: "care-plan",
    action: "read",
    handler: async () => ({ status: 200, body: {} }),
  });

  const response = await authorizedHandler({ body: { clientId: "untrusted-client" } });
  assert.equal(response.status, 401);
  assert.equal(resolverCalls, 0);
});
