import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Railway service configuration is healthchecked and contains no secrets or public domain", async () => {
  const config = await readFile(new URL("../.railway/railway.ts", import.meta.url), "utf8");

  assert.match(config, /github\("DRAVEINX\/Project-N-01"/);
  assert.match(config, /branch:\s*"feature\/novalife-care-api-router"/);
  assert.match(config, /healthcheck:\s*"\/healthz"/);
  assert.match(config, /healthcheckTimeout:\s*120/);
  assert.match(config, /NODE_ENV:\s*"production"/);
  assert.match(config, /NOVALIFE_TRUST_PROXY:\s*"true"/);
  assert.doesNotMatch(config, /DATABASE_URL|password|secret|ALLOWED_ORIGINS/i);
  assert.doesNotMatch(config, /domains:\s*\[/, "no public domain should be attached by default");
});
