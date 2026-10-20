import test from "node:test";
import assert from "node:assert/strict";
import { createCareTargetResolver } from "../src/server/care-target-resolver.js";

test("clients are restricted to their own ID", async () => {
  const resolve = createCareTargetResolver();
  assert.equal(await resolve({ id: "c1", role: "client", active: true }, { params: {} }), "c1");
  assert.equal(await resolve({ id: "c1", role: "client", active: true }, { params: { targetClientId: "c2" } }), null);
  assert.equal(await resolve({ id: "c1", role: "client", active: true }, { params: { targetClientId: "c1" } }), "c1");
});

test("care roles require a bounded target selector", async () => {
  const resolve = createCareTargetResolver();
  const actor = { id: "staff", role: "caregiver", active: true };
  assert.equal(await resolve(actor, { params: {} }), null);
  assert.equal(await resolve(actor, { params: { targetClientId: "c2" } }), "c2");
  assert.equal(await resolve(actor, { params: { targetClientId: "x".repeat(201) } }), null);
});

test("care target IDs reject path delimiters, query delimiters, and surrounding whitespace", async () => {
  const resolve = createCareTargetResolver();
  const actor = { id: "staff", role: "caregiver", active: true };
  for (const targetClientId of ["", " ", " c2", "c2 ", "c/2", "c\\\\2", "c?2", "c#2"]) {
    assert.equal(
      await resolve(actor, { params: { targetClientId } }),
      null,
      `expected unsafe selector ${JSON.stringify(targetClientId)} to be rejected`
    );
  }
});

test("malformed trusted actor IDs fail closed", async () => {
  const resolve = createCareTargetResolver();
  for (const id of ["", " ", " staff", "staff ", "staff/other", "x".repeat(201)]) {
    assert.equal(await resolve({ id, role: "client", active: true }, { params: {} }), null);
  }
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

test("care target and actor IDs reject ASCII control characters", async () => {
  const resolve = createCareTargetResolver();
  const actor = { id: "staff", role: "caregiver", active: true };
  for (const targetClientId of ["c\\u0000 2", "c\\u000a2", "c\\u001f2", "c\\u007f2"]) {
    assert.equal(
      await resolve(actor, { params: { targetClientId } }),
      null,
      `expected control character in target ${JSON.stringify(targetClientId)} to be rejected`
    );
  }
  for (const id of ["staff\\u0000", "staff\\u000a", "staff\\u007f"]) {
    assert.equal(
      await resolve({ id, role: "client", active: true }, { params: {} }),
      null,
      `expected control character in actor ID ${JSON.stringify(id)} to be rejected`
    );
  }
});
