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

test("audit request ID rejects control characters and oversized values", async (t) => {
  const cases = [
    { name: "newline injection", requestId: "req-1\\nprivate-note", expected: null },
    { name: "oversized identifier", requestId: "x".repeat(129), expected: null },
    { name: "empty identifier", requestId: "", expected: null },
    { name: "safe identifier", requestId: "req-2026:abc_123.4", expected: "req-2026:abc_123.4" },
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const { run, calls } = fixture();
      await run({ requestId: scenario.requestId });
      assert.equal(calls.audit.length, 1);
      assert.equal(calls.audit[0].requestId, scenario.expected);
    });
  }
});

test("protected handler receives a frozen snapshot of trusted actor identity", async () => {
  const sourceActor = { id: "caregiver-1", role: "caregiver", active: true };
  let handlerActor;
  const { run } = fixture({
    authenticate: async () => sourceActor,
    handler: async (_request, context) => {
      handlerActor = context.actor;
      assert.equal(Object.isFrozen(context.actor), true);
      assert.throws(() => { context.actor.role = "admin"; }, TypeError);
      return { status: 200 };
    }
  });

  assert.deepEqual(await run({}), { status: 200 });
  assert.notEqual(handlerActor, sourceActor);
  assert.equal(handlerActor.role, "caregiver");
  assert.equal(sourceActor.role, "caregiver");
});

test("trusted actor snapshot excludes arbitrary and nested authenticator payloads", async () => {
  const privatePayload = { permissions: ["*"], internalToken: "do-not-forward" };
  const sourceActor = {
    id: "caregiver-1",
    role: "caregiver",
    active: true,
    metadata: privatePayload,
    internalToken: "do-not-forward"
  };
  let handlerActor;
  const { run } = fixture({
    authenticate: async () => sourceActor,
    loadAuthorizationContext: async (actor) => {
      assert.equal(Object.hasOwn(actor, "metadata"), false);
      assert.equal(Object.hasOwn(actor, "internalToken"), false);
      return { clientId: "client-1", assignedClientIds: ["client-1"], grantedScopes: ["care"] };
    },
    handler: async (_request, context) => {
      handlerActor = context.actor;
      assert.deepEqual(Object.keys(context.actor).sort(), ["active", "id", "provisioned", "role"]);
      assert.equal(Object.hasOwn(context.actor, "metadata"), false);
      assert.equal(Object.hasOwn(context.actor, "internalToken"), false);
      return { status: 200 };
    }
  });

  assert.deepEqual(await run({}), { status: 200 });
  assert.equal(handlerActor.metadata, undefined);
  assert.equal(sourceActor.metadata, privatePayload);
  assert.deepEqual(privatePayload.permissions, ["*"]);
});


test("audit actor and client identifiers reject control characters and oversized values", async (t) => {
  const cases = [
    {
      name: "actor identifier with newline",
      actor: { id: "caregiver-1\ninjected", role: "caregiver", active: true },
      context: { clientId: "client-1", assignedClientIds: ["client-1"], grantedScopes: ["care"] },
      expectedActorId: null,
      expectedClientId: "client-1"
    },
    {
      name: "client identifier with control character",
      actor: { id: "caregiver-1", role: "caregiver", active: true },
      context: { clientId: "client-1\u007finjected", assignedClientIds: ["client-1\u007finjected"], grantedScopes: ["care"] },
      expectedActorId: "caregiver-1",
      expectedClientId: null
    },
    {
      name: "oversized client identifier",
      actor: { id: "caregiver-1", role: "caregiver", active: true },
      context: { clientId: "c".repeat(257), assignedClientIds: ["c".repeat(257)], grantedScopes: ["care"] },
      expectedActorId: "caregiver-1",
      expectedClientId: null
    }
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      let event;
      const { run } = fixture({
        authenticate: async () => scenario.actor,
        loadAuthorizationContext: async () => scenario.context,
        audit: async (entry) => { event = entry; }
      });
      await run({});
      assert.equal(event.actorId, scenario.expectedActorId);
      assert.equal(event.clientId, scenario.expectedClientId);
    });
  }
});
