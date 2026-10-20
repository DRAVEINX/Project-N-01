import test from "node:test";
import assert from "node:assert/strict";
import { createPostgresCareRecordRepository } from "../src/server/postgres-care-record-repository.js";

function makePool(rows = []) {
  const calls = [];
  return {
    calls,
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows };
    },
  };
}

test("care record reads always scope SQL by authorized client, resource and record id", async () => {
  const pool = makePool([]);
  const repository = createPostgresCareRecordRepository({ pool });

  assert.equal(await repository.get({ clientId: "client-A", resource: "care-note", id: "note-1" }), null);
  assert.equal(await repository.get({ clientId: "client-A", resource: "care-note", id: "note-1" }), null);

  assert.match(pool.calls[0].sql, /WHERE client_id = \\$1 AND resource = \\$2 AND record_id = \\$3/);
  assert.deepEqual(pool.calls[0].values, ["client-A", "care-note", "note-1"]);
  assert.match(pool.calls[1].sql, /WHERE client_id = \\$1 AND resource = \\$2 AND record_id = \\$3/);
  assert.deepEqual(pool.calls[1].values, ["client-A", "care-note", "note-1"]);
});

test("list is tenant-scoped and has a bounded page size", async () => {
  const pool = makePool([]);
  const repository = createPostgresCareRecordRepository({ pool });

  assert.deepEqual(await repository.list({ clientId: "client-B", resource: "care-plan", limit: 25 }), []);
  assert.match(pool.calls[0].sql, /WHERE client_id = \$1 AND resource = \$2/);
  assert.deepEqual(pool.calls[0].values, ["client-B", "care-plan", 25]);
  await assert.rejects(repository.list({ clientId: "client-B", resource: "care-plan", limit: 101 }), /limit must be an integer/);
});

test("create serializes record data and binds all values as query parameters", async () => {
  const pool = makePool([{
    client_id: "client-A",
    resource: "care-note",
    record_id: "generated-1",
    data: { summary: "daily note" },
    created_by: "caregiver-A",
    updated_by: "caregiver-A",
    created_at: "2026-10-19T10:00:00.000Z",
    updated_at: "2026-10-19T10:00:00.000Z",
  }]);
  const repository = createPostgresCareRecordRepository({ pool, idFactory: () => "generated-1" });

  const result = await repository.create({
    clientId: "client-A",
    resource: "care-note",
    actorId: "caregiver-A",
    data: { summary: "daily note" },
  });
  assert.equal(result.id, "generated-1");
  assert.deepEqual(result.data, { summary: "daily note" });
  assert.match(pool.calls[0].sql, /INSERT INTO novalife_care_records/);
  assert.deepEqual(pool.calls[0].values, [
    "client-A", "care-note", "generated-1", JSON.stringify({ summary: "daily note" }), "caregiver-A",
  ]);
});

test("update cannot omit tenant scope and binds actor/data separately", async () => {
  const pool = makePool([]);
  const repository = createPostgresCareRecordRepository({ pool });

  assert.equal(await repository.update({
    clientId: "client-A", resource: "care-note", id: "note-1",
    actorId: "caregiver-A", data: { summary: "updated" },
  }), null);
  assert.match(pool.calls[0].sql, /WHERE client_id = \$1 AND resource = \$2 AND record_id = \$3/);
  assert.deepEqual(pool.calls[0].values, [
    "client-A", "care-note", "note-1", JSON.stringify({ summary: "updated" }), "caregiver-A",
  ]);
});

test("rejects unknown resources, invalid record data, and missing tenant identifiers", async () => {
  const repository = createPostgresCareRecordRepository({ pool: makePool([]) });
  await assert.rejects(repository.list({ clientId: "client-A", resource: "admin-users" }), /unsupported care record resource/);
  await assert.rejects(repository.create({
    clientId: "client-A", resource: "care-note", actorId: "caregiver-A", data: ["not", "an", "object"],
  }), /plain object/);
  await assert.rejects(repository.get({ clientId: "", resource: "care-note", id: "note-1" }), /clientId must be a safe identifier/);
});

test("repository rejects unsafe tenant, actor, and record identifiers before querying", async () => {
  const pool = makePool([]);
  const repository = createPostgresCareRecordRepository({ pool });
  const unsafe = [" client-A", "client-A ", "client/A", "client\\A", "client?A", "client#A", "client\u000aA", "x".repeat(201)];

  for (const clientId of unsafe) {
    await assert.rejects(
      repository.list({ clientId, resource: "care-note" }),
      /safe identifier/
    );
  }
  await assert.rejects(
    repository.get({ clientId: "client-A", resource: "care-note", id: "note\u0000-1" }),
    /safe identifier/
  );
  await assert.rejects(
    repository.create({ clientId: "client-A", resource: "care-note", actorId: "staff/other", data: { summary: "x" } }),
    /safe identifier/
  );
  assert.equal(pool.calls.length, 0);
});
