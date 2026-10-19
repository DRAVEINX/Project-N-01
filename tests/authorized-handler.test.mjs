import test from "node:test";
import assert from "node:assert/strict";
import { createAuthorizedHandler } from "../src/server/authorized-handler.js";
import { SessionResolutionUnavailableError } from "../src/server/session-authenticator.js";

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


test("session storage outage returns 503 before loading permissions or running handler", async () => {
  const { run, calls } = fixture({
    authenticate: async () => { throw new SessionResolutionUnavailableError(); }
  });
  assert.deepEqual(await run({}), {
    status: 503, body: { error: "authentication-unavailable" }
  });
  assert.equal(calls.context, 0);
  assert.equal(calls.handler, 0);
  assert.equal(calls.audit.length, 0);
});

test("malformed trusted actor is rejected before authorization lookup", async () => {
  const { run, calls } = fixture({
    authenticate: async () => ({ id: "   ", role: "caregiver", active: true })
  });
  assert.deepEqual(await run({}), {
    status: 401, body: { error: "unauthenticated" }
  });
  assert.equal(calls.context, 0);
  assert.equal(calls.handler, 0);
});

test("request-supplied client and permission fields cannot replace trusted context", async () => {
  const { run, calls } = fixture({
    loadAuthorizationContext: async (actor) => {
      calls.context++;
      assert.equal(actor.id, "caregiver-1");
      return {
        clientId: "client-1",
        assignedClientIds: ["client-1"],
        grantedScopes: ["care"]
      };
    }
  });
  const response = await run({
    clientId: "client-attacker",
    role: "admin",
    grantedScopes: ["*"],
    body: { clientId: "client-attacker", role: "admin", grantedScopes: ["*"] }
  });
  assert.deepEqual(response, { status: 200, body: { clientId: "client-1" } });
  assert.equal(calls.handler, 1);
  assert.equal(calls.context, 1);
});

test("audit event is immutable, contains only safe metadata, and runs before handler", async () => {
  const order = [];
  let auditedEvent;
  const { run, calls } = fixture({
    audit: async (event) => {
      order.push("audit");
      auditedEvent = event;
      assert.equal(Object.isFrozen(event), true);
      assert.deepEqual(Object.keys(event).sort(), [
        "action", "actorId", "clientId", "outcome", "reason", "requestId", "resource"
      ]);
      assert.equal("body" in event, false);
      assert.equal("grantedScopes" in event, false);
      assert.throws(() => { event.outcome = "allow"; }, TypeError);
    },
    handler: async (_request, context) => {
      order.push("handler");
      calls.handler++;
      return { status: 200, body: { clientId: context.clientId } };
    }
  });
  const result = await run({
    requestId: "safe-request-id",
    body: { note: "private care note", role: "admin", grantedScopes: ["*"] }
  });
  assert.deepEqual(result, { status: 200, body: { clientId: "client-1" } });
  assert.deepEqual(order, ["audit", "handler"]);
  assert.equal(auditedEvent.requestId, "safe-request-id");
  assert.equal(JSON.stringify(auditedEvent).includes("private care note"), false);
});

test("denied access is audited with safe metadata before returning forbidden", async () => {
  const order = [];
  let deniedEvent;
  const { run, calls } = fixture({
    loadAuthorizationContext: async () => ({
      clientId: "client-2",
      assignedClientIds: ["client-1"],
      grantedScopes: []
    }),
    audit: async (event) => {
      order.push("audit");
      deniedEvent = event;
      assert.equal(Object.isFrozen(event), true);
      assert.equal(event.outcome, "deny");
      assert.equal(event.reason, "client-not-assigned");
      assert.equal("body" in event, false);
    },
    handler: async () => {
      order.push("handler");
      calls.handler++;
      return { status: 200 };
    }
  });
  const response = await run({
    requestId: "denied-request",
    body: { note: "private client information", clientId: "client-1" }
  });
  assert.deepEqual(response, { status: 403, body: { error: "forbidden" } });
  assert.deepEqual(order, ["audit"]);
  assert.equal(calls.handler, 0);
  assert.equal(deniedEvent.clientId, "client-2");
  assert.equal(deniedEvent.requestId, "denied-request");
  assert.equal(JSON.stringify(deniedEvent).includes("private client information"), false);
});


test("missing trusted client ID is denied and safely audited before handler", async () => {
  const order = [];
  let event;
  const { run, calls } = fixture({
    loadAuthorizationContext: async () => ({
      clientId: null,
      assignedClientIds: ["client-1"],
      grantedScopes: ["care"]
    }),
    audit: async (entry) => {
      order.push("audit");
      event = entry;
    },
    handler: async () => {
      order.push("handler");
      calls.handler++;
      return { status: 200 };
    }
  });
  const response = await run({
    requestId: "missing-target-request",
    body: { clientId: "client-1", note: "private care information" }
  });
  assert.deepEqual(response, { status: 403, body: { error: "forbidden" } });
  assert.deepEqual(order, ["audit"]);
  assert.equal(calls.handler, 0);
  assert.equal(event.clientId, null);
  assert.equal(event.outcome, "deny");
  assert.equal(event.reason, "client-required");
  assert.equal(JSON.stringify(event).includes("private care information"), false);
});


test("malformed assignment and consent collections fail closed", async (t) => {
  const cases = [
    {
      name: "missing assignment collection",
      context: { clientId: "client-1", assignedClientIds: null, grantedScopes: ["care"] },
      reason: "client-not-assigned"
    },
    {
      name: "non-array consent collection",
      context: { clientId: "client-1", assignedClientIds: ["client-1"], grantedScopes: "care" },
      reason: "scope-not-consented"
    }
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const { run, calls } = fixture({
        loadAuthorizationContext: async () => scenario.context
      });
      const response = await run({ requestId: "malformed-context-request" });
      assert.deepEqual(response, { status: 403, body: { error: "forbidden" } });
      assert.equal(calls.handler, 0);
      assert.equal(calls.audit.length, 1);
      assert.equal(calls.audit[0].outcome, "deny");
      assert.equal(calls.audit[0].reason, scenario.reason);
    });
  }
});


test("invalid authorization context shapes fail closed before audit or handler", async (t) => {
  const cases = [
    { name: "null context", context: null },
    { name: "array context", context: [] },
    { name: "primitive context", context: "client-1" }
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const { run, calls } = fixture({
        loadAuthorizationContext: async () => scenario.context
      });
      const response = await run({ requestId: "invalid-context-shape" });
      assert.deepEqual(response, {
        status: 503,
        body: { error: "authorization-unavailable" }
      });
      assert.equal(calls.handler, 0);
      assert.equal(calls.audit.length, 0);
    });
  }
});
