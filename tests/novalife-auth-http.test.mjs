import test from "node:test";
import assert from "node:assert/strict";
import { createNovaLifeAuthHttpHandler } from "../src/server/novalife-auth-http.js";

test("PostgreSQL HTTP composition requires a trusted rate limiter before initialization", async () => {
  await assert.rejects(
    createNovaLifeAuthHttpHandler({ pool: null, audit: async () => {} }),
    /trusted rateLimit callback/,
  );
});
