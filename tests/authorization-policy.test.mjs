import test from "node:test";
import assert from "node:assert/strict";
import { authorize } from "../src/authorization-policy.js";

const client = { id: "client-1", role: "client", active: true };
const caregiver = { id: "worker-1", role: "caregiver", active: true };
const admin = { id: "admin-1", role: "developer_admin", active: true, provisioned: true };
const assignment = { assignedClientIds: ["client-1"], grantedScopes: ["carePlan", "careDocuments"] };

test("deny by default for missing, inactive and invalid actors/actions", () => {
  assert.equal(authorize({resource:"care-plan",action:"read"}).reason, "missing-actor");
  assert.equal(authorize({actor:{id:"x",role:"client",active:false},resource:"mood-report",action:"read",clientId:"x"}).allowed, false);
  assert.equal(authorize({actor:client,resource:"mood-report",action:"execute",clientId:"client-1"}).reason, "invalid-action");
  assert.equal(authorize({actor:client,resource:"unlisted-resource",action:"read",clientId:"client-1"}).reason, "unknown-resource");
});

test("client may read only their own personal data and cannot open caregiver portal", () => {
  assert.equal(authorize({actor:client,resource:"mood-report",action:"read",clientId:"client-1"}).allowed, true);
  assert.equal(authorize({actor:client,resource:"mood-report",action:"read",clientId:"client-2"}).reason, "personal-record-owner-only");
  assert.equal(authorize({actor:client,resource:"care-portal",action:"read"}).reason, "care-portal-role-required");
  assert.equal(authorize({actor:client,resource:"care-plan",action:"read",clientId:"client-1"}).reason, "care-role-required");
});

test("caregiver must have both an assignment and the relevant granted scope", () => {
  assert.equal(authorize({actor:caregiver,resource:"care-plan",action:"read",clientId:"client-1",...assignment}).allowed, true);
  assert.equal(authorize({actor:caregiver,resource:"care-document",action:"read",clientId:"client-1",...assignment}).allowed, true);
  assert.equal(authorize({actor:caregiver,resource:"care-plan",action:"read",clientId:"client-2",...assignment}).reason, "client-not-assigned");
  assert.equal(authorize({actor:caregiver,resource:"medication-overview",action:"read",clientId:"client-1",...assignment}).reason, "scope-not-consented");
  assert.equal(authorize({actor:caregiver,resource:"care-portal",action:"read"}).allowed, true);
});

test("admin role must be provisioned and admin screens do not automatically grant client-record access", () => {
  assert.equal(authorize({actor:{...admin,provisioned:false},resource:"admin-users",action:"manage"}).reason, "admin-not-provisioned");
  assert.equal(authorize({actor:{id:"fake",role:"admin",active:true},resource:"admin-users",action:"manage"}).reason, "legacy-admin-role-not-trusted");
  assert.equal(authorize({actor:admin,resource:"admin-users",action:"manage"}).allowed, true);
  assert.equal(authorize({actor:admin,resource:"care-portal",action:"manage"}).allowed, true);
  assert.equal(authorize({actor:admin,resource:"care-plan",action:"read",clientId:"client-1"}).reason, "admin-client-data-needs-audited-grant");
});

test("admin support access requires reason, audit ID and an unexpired grant", () => {
  const now = Date.parse("2026-10-19T08:00:00Z");
  const valid = {active:true,reason:"Support issue confirmed by service owner",auditId:"audit-123",expiresAt:"2026-10-19T08:15:00Z"};
  const base = {actor:admin,resource:"care-plan",action:"read",clientId:"client-1",now};
  assert.equal(authorize({...base,breakGlass:valid}).reason, "admin-time-limited-audited-support-grant");
  for (const action of ["create", "update", "delete", "manage"]) {
    assert.equal(
      authorize({ ...base, action, breakGlass: valid }).reason,
      "admin-client-data-needs-audited-grant",
      `support access must not permit ${action} on client records`
    );
  }
  assert.equal(authorize({...base,breakGlass:{...valid,reason:"help"}}).reason, "admin-client-data-needs-audited-grant");
  assert.equal(authorize({...base,breakGlass:{...valid,expiresAt:"2026-10-19T07:59:00Z"}}).reason, "admin-client-data-needs-audited-grant");
  assert.equal(authorize({...base,breakGlass:{...valid,auditId:""}}).reason, "admin-client-data-needs-audited-grant");
});

test("unknown scopes and missing client assignments never fall through to allow", () => {
  assert.equal(authorize({actor:caregiver,resource:"care-task",action:"read",clientId:"client-1",assignedClientIds:["client-1"],grantedScopes:[]}).allowed, false);
  assert.equal(authorize({actor:caregiver,resource:"care-task",action:"read",clientId:"client-1"}).allowed, false);
});

test("personal record ownership does not grant privileged manage actions", () => {
  for (const resource of ["profile", "mood-report", "journal", "drawing", "appointment", "weekly-plan", "guide", "trusted-contact"]) {
    assert.equal(authorize({actor:client,resource,action:"manage",clientId:"client-1"}).reason, "personal-record-manage-not-allowed", resource);
  }
  assert.equal(authorize({actor:client,resource:"mood-report",action:"create",clientId:"client-1"}).allowed, true);
  assert.equal(authorize({actor:client,resource:"mood-report",action:"update",clientId:"client-1"}).allowed, true);
});


test("prototype property names are not treated as authorized resources", () => {
  for (const resource of ["toString", "constructor", "__proto__", "hasOwnProperty"]) {
    assert.equal(
      authorize({ actor: client, resource, action: "read", clientId: "client-1" }).reason,
      "unknown-resource",
      resource
    );
    assert.equal(
      authorize({
        actor: caregiver,
        resource,
        action: "read",
        clientId: "client-1",
        ...assignment
      }).reason,
      "unknown-resource",
      resource
    );
  }
});


test("admin support grant is denied at expiry and for malformed or inactive grants", () => {
  const now = Date.parse("2026-10-19T08:00:00Z");
  const base = {
    actor: admin,
    resource: "care-plan",
    action: "read",
    clientId: "client-1",
    now
  };
  const valid = {
    active: true,
    reason: "Support issue confirmed by service owner",
    auditId: "audit-123",
    expiresAt: "2026-10-19T08:00:00Z"
  };

  assert.equal(
    authorize({ ...base, breakGlass: valid }).reason,
    "admin-client-data-needs-audited-grant",
    "a grant expiring exactly now is no longer valid"
  );
  assert.equal(
    authorize({ ...base, breakGlass: { ...valid, expiresAt: "not-a-date" } }).reason,
    "admin-client-data-needs-audited-grant"
  );
  assert.equal(
    authorize({ ...base, breakGlass: { ...valid, active: false, expiresAt: "2026-10-19T08:15:00Z" } }).reason,
    "admin-client-data-needs-audited-grant"
  );
});


test("caregiver role never gains personal-record access from matching clientId", () => {
  for (const resource of ["profile", "mood-report", "journal", "drawing", "appointment", "weekly-plan", "guide", "trusted-contact"]) {
    assert.equal(
      authorize({ actor: caregiver, resource, action: "read", clientId: caregiver.id }).reason,
      "personal-resource-role-not-allowed",
      resource
    );
  }
});


test("caregiver assignment and consent do not grant direct personal-record access", () => {
  for (const resource of ["profile", "mood-report", "journal", "drawing", "appointment", "weekly-plan", "guide", "trusted-contact"]) {
    assert.equal(
      authorize({
        actor: caregiver,
        resource,
        action: "read",
        clientId: "client-1",
        ...assignment
      }).allowed,
      false,
      resource
    );
  }
});


test("caregiver cannot create, update, delete or manage personal records", () => {
  for (const resource of ["profile", "mood-report", "journal", "drawing", "appointment", "weekly-plan", "guide", "trusted-contact"]) {
    for (const action of ["create", "update", "delete", "manage"]) {
      assert.equal(
        authorize({
          actor: caregiver,
          resource,
          action,
          clientId: "client-1",
          ...assignment
        }).allowed,
        false,
        `${action} ${resource}`
      );
    }
  }
});


test("revoked caregiver assignment or consent and inactive caregiver deny care access", () => {
  const request = {
    actor: caregiver,
    resource: "care-plan",
    action: "read",
    clientId: "client-1",
    assignedClientIds: ["client-1"],
    grantedScopes: ["carePlan"]
  };

  assert.equal(authorize(request).allowed, true, "active assignment and consent permit scoped access");
  assert.equal(
    authorize({ ...request, assignedClientIds: [] }).reason,
    "client-not-assigned",
    "revoked assignment must immediately deny access"
  );
  assert.equal(
    authorize({ ...request, grantedScopes: [] }).reason,
    "scope-not-consented",
    "withdrawn consent must immediately deny access"
  );
  assert.equal(
    authorize({ ...request, actor: { ...caregiver, active: false } }).reason,
    "inactive-account",
    "inactive caregiver accounts must not retain access"
  );
});

test("admin assignment and consent inputs cannot replace an audited support grant", () => {
  const request = {
    actor: admin,
    resource: "care-plan",
    action: "read",
    clientId: "client-1",
    assignedClientIds: ["client-1"],
    grantedScopes: ["carePlan"]
  };

  assert.equal(
    authorize(request).reason,
    "admin-client-data-needs-audited-grant",
    "admin must not inherit caregiver access from assignment and consent"
  );
  assert.equal(
    authorize({ ...request, breakGlass: undefined }).allowed,
    false,
    "assignment and consent alone must never authorize admin client-data access"
  );
});

test("every care resource requires its exact consent scope and an active assignment", () => {
  const cases = [
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

  for (const [resource, requiredScope] of cases) {
    assert.equal(
      authorize({
        actor: caregiver,
        resource,
        action: "read",
        clientId: "client-1",
        assignedClientIds: ["client-1"],
        grantedScopes: [requiredScope]
      }).allowed,
      true,
      `${resource} should allow its explicitly granted scope`
    );
    assert.equal(
      authorize({
        actor: caregiver,
        resource,
        action: "read",
        clientId: "client-1",
        assignedClientIds: ["client-1"],
        grantedScopes: []
      }).reason,
      "scope-not-consented",
      `${resource} must deny access without its consent scope`
    );
    assert.equal(
      authorize({
        actor: caregiver,
        resource,
        action: "read",
        clientId: "client-1",
        assignedClientIds: [],
        grantedScopes: [requiredScope]
      }).reason,
      "client-not-assigned",
      `${resource} must deny access without an active assignment`
    );
  }
});

test("admin support grants never bypass personal-record ownership rules", () => {
  const breakGlass = {
    active: true,
    reason: "Support issue confirmed by service owner",
    auditId: "audit-personal-123",
    expiresAt: "2026-10-19T08:15:00Z"
  };
  const now = Date.parse("2026-10-19T08:00:00Z");

  for (const resource of ["profile", "mood-report", "journal", "drawing", "appointment", "weekly-plan", "guide", "trusted-contact"]) {
    assert.equal(
      authorize({
        actor: admin,
        resource,
        action: "read",
        clientId: "client-1",
        breakGlass,
        now
      }).reason,
      "personal-record-owner-only",
      `support grant must not bypass ownership for ${resource}`
    );
  }
});

test("parent and guardian roles require explicit assignment and consent just like caregivers", () => {
  for (const role of ["parent", "guardian"]) {
    const actor = { id: `${role}-1`, role, active: true };
    const base = {
      actor,
      resource: "care-plan",
      action: "read",
      clientId: "client-1"
    };

    assert.equal(
      authorize({ ...base, assignedClientIds: ["client-1"], grantedScopes: ["carePlan"] }).allowed,
      true,
      `${role} with assignment and consent should be allowed scoped access`
    );
    assert.equal(
      authorize({ ...base, assignedClientIds: [], grantedScopes: ["carePlan"] }).reason,
      "client-not-assigned",
      `${role} without an assignment must be denied`
    );
    assert.equal(
      authorize({ ...base, assignedClientIds: ["client-1"], grantedScopes: [] }).reason,
      "scope-not-consented",
      `${role} without consent must be denied`
    );
    assert.equal(
      authorize({ ...base, assignedClientIds: ["client-1"], grantedScopes: ["carePlan"], actor: { ...actor, active: false } }).reason,
      "inactive-account",
      `${role} with an inactive account must be denied`
    );
  }
});


test("parent and guardian access to care data never grants access to personal records", () => {
  const personalResources = ["profile", "mood-report", "journal", "drawing", "appointment", "weekly-plan", "guide", "trusted-contact"];

  for (const role of ["parent", "guardian"]) {
    const actor = { id: role + "-1", role, active: true };
    for (const resource of personalResources) {
      assert.equal(
        authorize({
          actor,
          resource,
          action: "read",
          clientId: "client-1",
          assignedClientIds: ["client-1"],
          grantedScopes: ["carePlan", "careNote", "careTask", "careReport", "careDocuments", "medication", "careMessages", "roster", "careTeam", "careConsents"]
        }).allowed,
        false,
        role + " with broad care scopes must not read personal resource " + resource
      );
    }
  }
});


test("parent and guardian roles cannot mutate personal records", () => {
  const personalResources = ["profile", "mood-report", "journal", "drawing", "appointment", "weekly-plan", "guide", "trusted-contact"];

  for (const role of ["parent", "guardian"]) {
    const actor = { id: role + "-1", role, active: true };
    for (const resource of personalResources) {
      for (const action of ["create", "update", "delete", "manage"]) {
        assert.equal(
          authorize({
            actor,
            resource,
            action,
            clientId: "client-1",
            assignedClientIds: ["client-1"],
            grantedScopes: ["carePlan", "careNote", "careTask", "careReport", "careDocuments", "medication", "careMessages", "roster", "careTeam", "careConsents"]
          }).allowed,
          false,
          role + " must not " + action + " personal resource " + resource
        );
      }
    }
  }
});


test("parent and guardian roles require the exact consent scope for every care resource", () => {
  const cases = [
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
    const actor = { id: role + "-1", role, active: true };
    for (const [resource, requiredScope] of cases) {
      const base = { actor, resource, action: "read", clientId: "client-1", assignedClientIds: ["client-1"] };
      assert.equal(
        authorize({ ...base, grantedScopes: [requiredScope] }).allowed,
        true,
        role + " with the exact scope should read " + resource
      );
      assert.equal(
        authorize({ ...base, grantedScopes: [] }).reason,
        "scope-not-consented",
        role + " without consent must not read " + resource
      );
      assert.equal(
        authorize({ ...base, assignedClientIds: [], grantedScopes: [requiredScope] }).reason,
        "client-not-assigned",
        role + " without assignment must not read " + resource
      );
    }
  }
});


test("care roles cannot access another client\u0027s care resources with consent for a different client", () => {
  const cases = [
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

  for (const role of ["caregiver", "parent", "guardian"]) {
    const actor = { id: role + "-cross-client", role, active: true };
    for (const [resource, requiredScope] of cases) {
      assert.equal(
        authorize({
          actor,
          resource,
          action: "read",
          clientId: "client-2",
          assignedClientIds: ["client-1"],
          grantedScopes: [requiredScope]
        }).reason,
        "client-not-assigned",
        role + " must not read " + resource + " for a different client"
      );
    }
  }
});


test("only provisioned developer admins may access admin users and audit logs", () => {
  const adminResources = ["admin-users", "audit-log"];
  const actors = [
    client,
    caregiver,
    { id: "parent-admin-boundary", role: "parent", active: true },
    { id: "guardian-admin-boundary", role: "guardian", active: true },
    { id: "unprovisioned-admin", role: "developer_admin", active: true, provisioned: false },
    { id: "legacy-admin", role: "admin", active: true }
  ];

  for (const actor of actors) {
    for (const resource of adminResources) {
      assert.equal(
        authorize({ actor, resource, action: "read" }).allowed,
        false,
        actor.role + " must not read " + resource
      );
      assert.equal(
        authorize({ actor, resource, action: "manage" }).allowed,
        false,
        actor.role + " must not manage " + resource
      );
    }
  }

  assert.equal(authorize({ actor: admin, resource: "admin-users", action: "read" }).allowed, true);
  assert.equal(authorize({ actor: admin, resource: "audit-log", action: "read" }).allowed, true);
});

test("wildcard consent never substitutes for each care resource's explicit scope", () => {
  const cases = [
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

  for (const role of ["caregiver", "parent", "guardian"]) {
    const actor = { id: role + "-wildcard", role, active: true };
    for (const [resource, requiredScope] of cases) {
      assert.notEqual(requiredScope, "*");
      assert.equal(
        authorize({
          actor,
          resource,
          action: "read",
          clientId: "client-1",
          assignedClientIds: ["client-1"],
          grantedScopes: ["*"]
        }).reason,
        "scope-not-consented",
        role + " wildcard consent must not authorize " + resource
      );
    }
  }
});


test("clients can manage consent grants only for their own account", () => {
  assert.equal(
    authorize({ actor: client, resource: "consent-management", action: "read", clientId: "client-1" }).allowed,
    true
  );
  assert.equal(
    authorize({ actor: client, resource: "consent-management", action: "create", clientId: "client-1" }).allowed,
    true
  );
  assert.equal(
    authorize({ actor: client, resource: "consent-management", action: "delete", clientId: "client-1" }).allowed,
    true
  );
  assert.equal(
    authorize({ actor: client, resource: "consent-management", action: "read", clientId: "client-2" }).reason,
    "personal-record-owner-only"
  );
  assert.equal(
    authorize({ actor: caregiver, resource: "consent-management", action: "create", clientId: "worker-1" }).reason,
    "personal-resource-role-not-allowed"
  );
  assert.equal(
    authorize({ actor: client, resource: "consent-management", action: "manage", clientId: "client-1" }).reason,
    "personal-record-manage-not-allowed"
  );
});
