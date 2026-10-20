import test from "node:test";
import assert from "node:assert/strict";
import { authorize, authorizationResources } from "../src/authorization-policy.js";

const resourcesByScope = [
  ["care-plan", "carePlan"],
  ["care-note", "careNote"],
  ["care-task", "careTask"],
  ["care-report", "careReport"],
  ["care-document", "careDocuments"],
  ["medication-overview", "medication"],
  ["care-message", "careMessages"],
  ["care-roster", "roster"],
  ["care-team", "careTeam"],
  ["care-consent-record", "careConsents"]
];

for (const role of ["parent", "guardian"]) {
  test(`${role} access requires an active assignment and the exact consent scope`, () => {
    const actor = { id: `${role}-1`, role, active: true };
    const base = { actor, resource: "care-plan", action: "read", clientId: "client-1" };

    assert.equal(authorize({ ...base, assignedClientIds: ["client-1"], grantedScopes: ["carePlan"] }).allowed, true);
    assert.equal(authorize({ ...base, assignedClientIds: [], grantedScopes: ["carePlan"] }).reason, "client-not-assigned");
    assert.equal(authorize({ ...base, assignedClientIds: ["client-1"], grantedScopes: [] }).reason, "scope-not-consented");
    assert.equal(authorize({ ...base, assignedClientIds: ["client-2"], grantedScopes: ["carePlan"] }).reason, "client-not-assigned");
  });

  test(`${role} cannot access another client's personal resources through care role`, () => {
    const actor = { id: `${role}-1`, role, active: true };
    for (const resource of authorizationResources.personal) {
      assert.equal(
        authorize({ actor, resource, action: "read", clientId: "client-1" }).reason,
        "personal-record-owner-only",
        `${role} must not read personal resource ${resource} without an explicit supported model`
      );
    }
  });
}

test("every defined care resource requires its own scope for both parent and guardian", () => {
  for (const role of ["parent", "guardian"]) {
    const actor = { id: `${role}-1`, role, active: true };
    for (const [resource, scope] of resourcesByScope) {
      const base = {
        actor,
        resource,
        action: "read",
        clientId: "client-1",
        assignedClientIds: ["client-1"]
      };
      assert.equal(
        authorize({ ...base, grantedScopes: [scope] }).allowed,
        true,
        `${role} should be allowed for ${resource} with ${scope} consent`
      );
      assert.equal(
        authorize({ ...base, grantedScopes: [] }).reason,
        "scope-not-consented",
        `${role} must be denied for ${resource} without consent`
      );
    }
  }
});
