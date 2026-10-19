import test from "node:test";
import assert from "node:assert/strict";
import { createCareTargetResolver } from "../src/server/care-target-resolver.js";

test("client resolves only its own immutable account ID", async () => {
  const resolve = createCareTargetResolver();
  assert.equal(await resolve({ id: "client-1", role: "client", active: true }, { params: {} }), "client-1");
  assert.equal(await resolve({ id: "client-1", role: "client", active: true }, { params: { targetClientId: "client-1" } }), "client-1");
  assert.equal(await resolve({ id: "client-1", role: "client", active: true }, { params: { targetClientId: "client-2" } }), null);
});

test("care roles need a bounded explicit target selector", async () => {
  const resolve = createCareTargetResolver();
  const actor = { id: "staff-1", role: "caregiver", active: true };
  assert.equal(await resolve(actor, { params: {} }), null);
  assert.equal(await resolve(actor, { params: { targetClientId: "" } }), null);
  assert.equal(await resolve(actor, { params: { targetClientId: "x".repeat(201) } }), null);
  assert.equal(await resolve(actor, { params: { targetClientId: "client-9" } }), "client-9");
});

test("parent and guardian roles use selectors but do not grant authorization by themselves", async () => {
  const resolve = createCareTargetResolver();
  for (const role of ["parent", "guardian"]) {
    assert.equal(await resolve({ id: "actor-1", role, active: true }, { params: { targetClientId: "client-2" } }), "client-2");
  }
});

test("inactive, malformed and unsupported actors fail closed", async () => {
  const resolve = createCareTargetResolver();
  assert.equal(await resolve(null, { params: { targetClientId: "client-2" }), null);
  assert.equal(await resolve({ id: "a", role: "caregiver", active: false }, { params: { targetClientId: "client-2" } }), null);
  assert.equal(await resolve({ id: "admin", role: "developer-admin", active: true }, { params: { targetClientId: "client-2" } }), null);
});
