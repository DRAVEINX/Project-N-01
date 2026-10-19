import test from "node:test";
import assert from "node:assert/strict";
import { authorize } from "../src/authorization-policy.js";

const client = { id: "client-1", role: "client", active: true };
const caregiver = { id: "worker-1", role: "caregiver", active: true };
const admin = { id: "admin-1", role: "developer_admin", active: true, provisioned: true };
const assignment = { assignedClientIds: ["client-1"], grantedScopes: ["care", "careDocuments"] };

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
