import test from "node:test";
import assert from "node:assert/strict";
import { createCareTargetResolver } from "../src/server/care-target-resolver.js";

test("clients are restricted to their own ID", async () => {
  const resolve = createCareTargetResolver();
  assert.equal(await resolve({ id: "c1", role: "client", active: true }, { params: {} }), "c1");
  assert.equal(await resolve({ id: "c1", role: "client", active: true }, { params: { targetClientId: "c2" } }), null);
});

test("care roles require a bounded target selector", async () => {
  const resolve = createCareTargetResolver();
  const actor = { id: "staff", role: "caregiver", active: true };
  assert.equal(await resolve(actor, { params: {} }), null);
  assert.equal(await resolve(actor, { params: { targetClientId: "c2" } }), "c2");
  assert.equal(await resolve(actor, { params: { targetClientId: "x".repeat(201) } }), null);
});

test("parent and guardian selectors are not authorization", async () => {
  const resolve = createCareTargetResolver();
  for (const role of ["parent", "guardian"]) {
    assert.equal(await resolve({ id: "a", role, active: true }, { params: { targetClientId: "c2" } }), "c2");
  }
});

test("inactive or unsupported actors fail closed", async () => {
  const resolve = createCareTargetResolver();
  assert.equal(await resolve(null, { params: { targetClientId: "c2" } }), null);
  assert.equal(await resolve({ id: "a", role: "caregiver", active: false }, { params: { targetClientId: "c2" } }), null);
  assert.equal(await resolve({ id: "admin", role: "developer-admin", active: true }, { params: { targetClientId: "c2" } }), null);
});
