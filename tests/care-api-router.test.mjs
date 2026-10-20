import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createNovaLifeCareApiRouter } from "../src/server/care-api-router.js";
import { createCareTargetResolver } from "../src/server/care-target-resolver.js";

function fakePool() {
  const calls = [];
  return {
    calls,
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [] };
    },
  };
}

function dependencies(overrides = {}) {
  return {
    pool: fakePool(),
    authAudit: async () => {},
    authorizationAudit: async () => {},
    extractToken: () => null,
    resolveTargetClientId: async () => null,
    ...overrides,
  };
}

test("router requires a configured database and durable audit callbacks", async () => {
  await assert.rejects(createNovaLifeCareApiRouter({}), /configured PostgreSQL pool/);
  await assert.rejects(createNovaLifeCareApiRouter(dependencies({ authorizationAudit: null })), /durable authAudit and authorizationAudit/);
});

test("unknown resources and paths fail closed without database reads", async () => {
  const deps = dependencies();
  const router = await createNovaLifeCareApiRouter(deps);
  assert.equal((await router.handle({ method: "GET", url: "/api/care/admin-users" })).status, 404);
  assert.equal((await router.handle({ method: "GET", url: "/api/not-care/care-note" })).status, 404);
  assert.equal(deps.pool.calls.length, 0);
});

test("client-scoped collection and item routes are recognized but still require authentication", async () => {
  const deps = dependencies();
  const router = await createNovaLifeCareApiRouter(deps);
  const collection = await router.handle({ method: "GET", url: "/api/care/clients/client-1/care-note" });
  const item = await router.handle({ method: "GET", url: "/api/care/clients/client-1/care-note/note-1" });
  assert.equal(collection.status, 401);
  assert.equal(item.status, 401);
  assert.deepEqual(collection.body, { error: "unauthenticated" });
  assert.deepEqual(item.body, { error: "unauthenticated" });
  assert.equal(deps.pool.calls.length, 0, "unauthenticated requests must not query care records");
});

test("unsupported methods and collection/item method mismatches are rejected", async () => {
  const router = await createNovaLifeCareApiRouter(dependencies());
  assert.equal((await router.handle({ method: "TRACE", url: "/api/care/care-note" })).status, 405);
  assert.equal((await router.handle({ method: "POST", url: "/api/care/care-note/note-1", body: { text: "x" } })).status, 405);
  assert.equal((await router.handle({ method: "DELETE", url: "/api/care/care-note" })).status, 400);
});

test("unauthenticated care-data requests return 401 and never query the care repository", async () => {
  const deps = dependencies();
  const router = await createNovaLifeCareApiRouter(deps);
  const response = await router.handle({ method: "GET", url: "/api/care/care-note" });
  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { error: "unauthenticated" });
  assert.equal(deps.pool.calls.length, 0);
});

test("malformed and overlong client selectors fail closed", async () => {
  const router = await createNovaLifeCareApiRouter(dependencies());
  assert.equal((await router.handle({ method: "GET", url: "/api/care/clients//care-note" })).status, 404);
  assert.equal((await router.handle({ method: "GET", url: "/api/care/clients/" + "x".repeat(201) + "/care-note" })).status, 404);
  assert.equal((await router.handle({ method: "GET", url: "/api/care/clients/client-1/care-note/extra/path" })).status, 404);
});


test("encoded unsafe route segments are rejected before authentication or database access", async () => {
  const deps = dependencies();
  const router = await createNovaLifeCareApiRouter(deps);
  for (const segment of ["client%3Fid", "client%23id", "client%5C%5Cid", "%20client", "client%20"]) {
    const response = await router.handle({
      method: "GET",
      url: `/api/care/clients/${segment}/care-note`,
    });
    assert.equal(response.status, 404, `expected unsafe selector ${segment} to be rejected`);
  }
  assert.equal(deps.pool.calls.length, 0);
});


test("encoded unsafe resource and record ID segments are rejected", async () => {
  const deps = dependencies();
  const router = await createNovaLifeCareApiRouter(deps);
  const unsafePaths = [
    "/api/care/clients/client-1/care%3Fnote",
    "/api/care/clients/client-1/care%23note",
    "/api/care/clients/client-1/care-note/note%2Fother",
    "/api/care/clients/client-1/care-note/note%5Cother",
    "/api/care/clients/client-1/care-note/%20note",
    "/api/care/clients/client-1/care-note/note%20",
  ];
  for (const url of unsafePaths) {
    assert.equal((await router.handle({ method: "GET", url })).status, 404, url);
  }
  assert.equal(deps.pool.calls.length, 0, "invalid paths must not query PostgreSQL");
});


test("malformed percent-encoding and encoded path delimiters are rejected", async () => {
  const deps = dependencies();
  const router = await createNovaLifeCareApiRouter(deps);
  const unsafePaths = [
    "/api/care/clients/client%2Fother/care-note",
    "/api/care/clients/client%5Cother/care-note",
    "/api/care/clients/client%ZZ/care-note",
    "/api/care/clients/client-1/care-note/note%ZZ",
  ];
  for (const url of unsafePaths) {
    assert.equal((await router.handle({ method: "GET", url })).status, 404, url);
  }
  assert.equal(deps.pool.calls.length, 0, "malformed routes must not access PostgreSQL");
});
test("control characters in encoded route segments are rejected before authentication or database access", async () => {
  const deps = dependencies();
  const router = await createNovaLifeCareApiRouter(deps);
  const unsafePaths = [
    "/api/care/clients/client%00id/care-note",
    "/api/care/clients/client%0Aid/care-note",
    "/api/care/clients/client%7Fid/care-note",
    "/api/care/clients/client-1/care%0Anote",
    "/api/care/clients/client-1/care-note/note%00id",
  ];

  for (const url of unsafePaths) {
    assert.equal((await router.handle({ method: "GET", url })).status, 404, url);
  }
  assert.equal(deps.pool.calls.length, 0, "control characters must be rejected before database access");
});


function consentApiSetup({
  actorRole = "client",
  recipientRole = "caregiver",
  consents = [],
  additionalAccounts = [],
  now = Date.now(),
} = {}) {
  const actorId = actorRole === "client" ? "client-1" : "caregiver-1";
  const token = "t".repeat(43);
  const tokenDigest = createHash("sha256").update(token).digest("hex");
  const accounts = new Map([
    [actorId, { id: actorId, role: actorRole, active: true }],
    ["caregiver-1", { id: "caregiver-1", role: recipientRole, active: true }],
    ["parent-1", { id: "parent-1", role: "parent", active: true }],
    ["guardian-1", { id: "guardian-1", role: "guardian", active: true }],
    ["inactive-caregiver", { id: "inactive-caregiver", role: "caregiver", active: false }],
    ["client-2", { id: "client-2", role: "client", active: true }],
    ...additionalAccounts.map((account) => [account.id, account]),
  ]);
  const savedConsents = consents.map((item) => ({ ...item }));
  const calls = [];
  const pool = {
    calls,
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes("FROM novalife_sessions") && sql.includes("WHERE token_digest = $1")) {
        if (values[0] !== tokenDigest) return { rows: [] };
        return {
          rows: [{
            actor_id: actorId,
            created_at_ms: String(now - 1000),
            expires_at_ms: String(now + 60 * 60 * 1000),
          }],
        };
      }
      if (sql.includes("SELECT id, role, active FROM novalife_accounts WHERE id = $1 LIMIT 1")) {
        const account = accounts.get(values[0]);
        return { rows: account ? [{ ...account }] : [] };
      }
      if (sql.includes("FROM novalife_client_assignments")) return { rows: [] };
      if (sql.includes("SELECT scope") && sql.includes("FROM novalife_consent_grants")) {
        return { rows: [] };
      }
      if (sql.includes("SELECT id, grantee_id, scope, granted_at, expires_at, revoked_at") &&
          sql.includes("FROM novalife_consent_grants")) {
        return {
          rows: savedConsents
            .filter((grant) => grant.client_id === values[0])
            .map((grant) => ({ ...grant })),
        };
      }
      if (sql.includes("INSERT INTO novalife_consent_grants")) {
        const [id, clientId, granteeId, scope, expiresAt] = values;
        const recipient = accounts.get(granteeId);
        if (!recipient || recipient.active !== true ||
            !["caregiver", "parent", "guardian"].includes(recipient.role)) {
          return { rows: [], rowCount: 0 };
        }
        let row = savedConsents.find((grant) =>
          grant.client_id === clientId && grant.grantee_id === granteeId &&
          grant.scope === scope && grant.revoked_at == null
        );
        if (row) {
          row.granted_by = clientId;
          row.granted_at = new Date(now).toISOString();
          row.expires_at = expiresAt;
        } else {
          row = {
            id,
            client_id: clientId,
            grantee_id: granteeId,
            scope,
            granted_by: clientId,
            granted_at: new Date(now).toISOString(),
            expires_at: expiresAt,
            revoked_at: null,
          };
          savedConsents.push(row);
        }
        return {
          rows: [{
            id: row.id, grantee_id: row.grantee_id, scope: row.scope,
            granted_at: row.granted_at, expires_at: row.expires_at, revoked_at: row.revoked_at,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("UPDATE novalife_consent_grants") && sql.includes("RETURNING id")) {
        const grant = savedConsents.find((item) =>
          item.id === values[0] && item.client_id === values[1] && item.revoked_at == null
        );
        if (!grant) return { rows: [], rowCount: 0 };
        grant.revoked_at = new Date(now).toISOString();
        return { rows: [{ id: grant.id }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  };
  const authorizationEvents = [];
  const routerPromise = createNovaLifeCareApiRouter({
    pool,
    authAudit: async () => {},
    authorizationAudit: async (event) => { authorizationEvents.push(event); },
    extractToken: () => token,
    resolveTargetClientId: createCareTargetResolver(),
    now: () => now,
  });
  return { pool, savedConsents, authorizationEvents, routerPromise, actorId, token };
}

test("clients can list only their own consent grants", async () => {
  const setup = consentApiSetup({
    consents: [
      { id: "grant-1", client_id: "client-1", grantee_id: "caregiver-1", scope: "care_note", granted_at: "2026-10-20T10:00:00.000Z", expires_at: null, revoked_at: null },
      { id: "grant-2", client_id: "client-2", grantee_id: "caregiver-1", scope: "mood", granted_at: "2026-10-20T10:00:00.000Z", expires_at: null, revoked_at: null },
    ],
  });
  const router = await setup.routerPromise;
  const result = await router.handle({ method: "GET", url: "/api/consents", headers: { authorization: `Bearer ${setup.token}` } });

  assert.equal(result.status, 200);
  assert.equal(result.body.consents.length, 1);
  assert.equal(result.body.consents[0].id, "grant-1");
  const listCall = setup.pool.calls.find((call) =>
    call.sql.includes("SELECT id, grantee_id, scope") && call.sql.includes("FROM novalife_consent_grants")
  );
  assert.deepEqual(listCall.values, ["client-1"]);
  assert.ok(setup.authorizationEvents.some((event) =>
    event.resource === "consent-management" && event.action === "read" && event.outcome === "allow"
  ));
});

test("client can grant a valid consent only to an active caregiver, parent or guardian", async () => {
  const setup = consentApiSetup();
  const router = await setup.routerPromise;
  const result = await router.handle({
    method: "POST",
    url: "/api/consents",
    headers: { authorization: `Bearer ${setup.token}` },
    body: {
      granteeId: "caregiver-1",
      scope: "care_note",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.consent.granteeId, "caregiver-1");
  assert.equal(result.body.consent.scope, "care_note");
  const insert = setup.pool.calls.find((call) => call.sql.includes("INSERT INTO novalife_consent_grants"));
  assert.ok(insert);
  assert.deepEqual(insert.values.slice(1, 4), ["client-1", "caregiver-1", "care_note"]);
  assert.equal(insert.values[1], "client-1", "client identity must come from the authenticated context, not request JSON");
  assert.equal(insert.values[3], "care_note");
  assert.ok(setup.authorizationEvents.some((event) =>
    event.resource === "consent-management" && event.action === "create" && event.outcome === "allow"
  ));
});

test("consent grants reject unknown scopes, self-grants, inactive and non-care recipients", async () => {
  const setup = consentApiSetup();
  const router = await setup.routerPromise;
  const cases = [
    { granteeId: "caregiver-1", scope: "*" },
    { granteeId: "client-1", scope: "mood" },
    { granteeId: "inactive-caregiver", scope: "mood" },
    { granteeId: "client-2", scope: "mood" },
    { granteeId: "unknown-recipient", scope: "mood" },
  ];

  for (const body of cases) {
    const result = await router.handle({
      method: "POST",
      url: "/api/consents",
      headers: { authorization: `Bearer ${setup.token}` },
      body,
    });
    assert.equal(result.status, 400);
  }
  assert.equal(setup.pool.calls.filter((call) => call.sql.includes("INSERT INTO novalife_consent_grants")).length, 0);
});

test("caregivers cannot grant client consents or inspect the consent-management API", async () => {
  const setup = consentApiSetup({ actorRole: "caregiver" });
  const router = await setup.routerPromise;
  const result = await router.handle({
    method: "POST",
    url: "/api/consents",
    headers: { authorization: `Bearer ${setup.token}` },
    body: { granteeId: "parent-1", scope: "care_note" },
  });
  assert.equal(result.status, 403);
  assert.equal(setup.pool.calls.some((call) => call.sql.includes("INSERT INTO novalife_consent_grants")), false);
  assert.ok(setup.authorizationEvents.some((event) =>
    event.resource === "consent-management" && event.outcome === "deny"
  ));
});

test("consent revocation is always scoped to the authenticated client's own grant", async () => {
  const setup = consentApiSetup({
    consents: [
      { id: "own-grant", client_id: "client-1", grantee_id: "caregiver-1", scope: "care_note", revoked_at: null },
      { id: "other-grant", client_id: "client-2", grantee_id: "caregiver-1", scope: "mood", revoked_at: null },
    ],
  });
  const router = await setup.routerPromise;

  const denied = await router.handle({
    method: "DELETE", url: "/api/consents/other-grant",
    headers: { authorization: `Bearer ${setup.token}` },
  });
  assert.equal(denied.status, 404);
  const deniedCall = setup.pool.calls.find((call) => call.sql.includes("UPDATE novalife_consent_grants"));
  assert.deepEqual(deniedCall.values, ["other-grant", "client-1"]);

  const revoked = await router.handle({
    method: "DELETE", url: "/api/consents/own-grant",
    headers: { authorization: `Bearer ${setup.token}` },
  });
  assert.equal(revoked.status, 200);
  assert.deepEqual(revoked.body, { revoked: true });
  assert.ok(setup.authorizationEvents.some((event) =>
    event.resource === "consent-management" && event.action === "delete" && event.outcome === "allow"
  ));
});

test("consent routes fail closed without a valid session", async () => {
  const setup = consentApiSetup();
  const router = await setup.routerPromise;
  const response = await router.handle({
    method: "GET", url: "/api/consents",
    headers: { authorization: "Bearer invalid" },
  });
  assert.equal(response.status, 401);
  assert.equal(setup.pool.calls.some((call) => call.sql.includes("FROM novalife_consent_grants")), false);
});
