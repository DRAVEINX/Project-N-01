import test from "node:test";
import assert from "node:assert/strict";
import { createAuthorizedHandler } from "../src/server/authorized-handler.js";

function fixture(overrides = {}) {
  const calls = { handler: 0, audit: [], context: 0 };
  const run = createAuthorizedHandler({
    resource: "care-plan",
    action: "read",
    authenticate: async () => ({ id: "caregiver-1", role: "caregiver", active: true }),
    loadAuthorizationContext: async () => {
      calls.context++;
      return { clientId: "client-1", assignedClientIds: ["client-1"], grantedScopes: ["care"] };
    },
    audit: async (event) => calls.audit.push(event),
    handler: async (_request, context) => {
      calls.handler++;
      return { status: 200, body: { clientId: context.clientId } };
    },
    ...overrides
  });
  return { run, calls };
}

test("authorized request is audited before the protected handler runs", async () => {
  const { run, calls } = fixture();
  const result = await run({ requestId: "req-1", body: { role: "admin", grantedScopes: ["*"] } });
  assert.deepEqual(result, { status: 200, body: { clientId: "client-1" } });
  assert.equal(calls.handler, 1);
  assert.equal(calls.audit.length, 1);
  assert.equal(calls.audit[0].outcome, "allow");
  assert.equal(calls.audit[0].requestId, "req-1");
  assert.equal("body" in calls.audit[0], false);
});

test("missing assignment is denied and protected handler is never called", async () => {
  const { run, calls } = fixture({
    loadAuthorizationContext: async () => ({
      clientId: "client-2", assignedClientIds: ["client-1"], grantedScopes: ["care"]
    })
  });
  assert.deepEqual(await run({}), { status: 403, body: { error: "forbidden" } });
  assert.equal(calls.handler, 0);
  assert.equal(calls.audit[0].outcome, "deny");
  assert.equal(calls.audit[0].reason, "client-not-assigned");
});

test("authentication failure denies before loading authorization facts", async () => {
  const { run, calls } = fixture({ authenticate: async () => { throw new Error("expired"); } });
  assert.deepEqual(await run({}), { status: 401, body: { error: "unauthenticated" } });
  assert.equal(calls.context, 0);
  assert.equal(calls.handler, 0);
});

test("authorization lookup failure fails closed", async () => {
  const { run, calls } = fixture({
    loadAuthorizationContext: async () => { throw new Error("database unavailable"); }
  });
  assert.deepEqual(await run({}), { status: 503, body: { error: "authorization-unavailable" } });
  assert.equal(calls.handler, 0);
  assert.equal(calls.audit.length, 0);
});

test("audit failure prevents protected handler execution", async () => {
  const { run, calls } = fixture({ audit: async () => { throw new Error("audit unavailable"); } });
  assert.deepEqual(await run({}), { status: 503, body: { error: "authorization-unavailable" } });
  assert.equal(calls.handler, 0);
});

test("invalid gate configuration is rejected", () => {
  assert.throws(() => createAuthorizedHandler({}), /required/);
});
