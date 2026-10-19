import test from "node:test";
import assert from "node:assert/strict";
import {
  createNovaLifeCarePortalHandler,
  novaLifeCarePortalResources,
} from "../src/server/care-portal-handler.js";

test("care portal route factory exposes only the explicit care-resource allow-list", () => {
  assert.deepEqual(novaLifeCarePortalResources, [
    "care-portal",
    "care-plan",
    "care-note",
    "care-task",
    "care-report",
    "care-document",
    "medication-overview",
    "care-message",
    "care-roster",
    "care-team",
    "care-consent-record",
  ]);
  assert.equal(Object.isFrozen(novaLifeCarePortalResources), true);
});

test("rejects personal and administrative resources before constructing a handler", async (t) => {
  for (const resource of ["profile", "mood-report", "journal", "admin-users", "audit-log", "unknown"]) {
    await t.test(resource, async () => {
      await assert.rejects(
        createNovaLifeCarePortalHandler({ resource }),
        /not an allow-listed care-portal resource/
      );
    });
  }
});

test("rejects unsupported actions before constructing a handler", async () => {
  await assert.rejects(
    createNovaLifeCarePortalHandler({ resource: "care-plan", action: "export-all" }),
    /unsupported care-portal action/
  );
});

test("requires a trusted target resolver", async () => {
  await assert.rejects(
    createNovaLifeCarePortalHandler({ resource: "care-plan", action: "read" }),
    /trusted resolveTargetClientId callback is required/
  );
});
