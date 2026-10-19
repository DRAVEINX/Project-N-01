import test from "node:test";
import assert from "node:assert/strict";
import { createNovaLifePostgresAuthorizedHandler } from "../src/server/novalife-authorized-handler.js";

test("authorized PostgreSQL handler requires trusted authorization dependencies before DB setup", async () => {
  await assert.rejects(
    createNovaLifePostgresAuthorizedHandler({
      pool: null,
      authAudit: async () => {},
      authorizationAudit: async () => {},
      resource: "care-plan",
      action: "read",
      handler: async () => ({ status: 200, body: {} }),
    }),
    /extractToken, loadAuthorizationContext, authorizationAudit and handler are required/
  );
});

test("authorized PostgreSQL handler rejects missing resource/action configuration", async () => {
  await assert.rejects(
    createNovaLifePostgresAuthorizedHandler({
      pool: null,
      authAudit: async () => {},
      authorizationAudit: async () => {},
      extractToken: () => null,
      loadAuthorizationContext: async () => ({}),
      handler: async () => ({ status: 200, body: {} }),
    }),
    /resource, action, authenticate, loadAuthorizationContext, audit and handler are required/
  );
});
