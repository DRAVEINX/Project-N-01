import test from "node:test";
import assert from "node:assert/strict";
import { createPostgresSessionRepository } from "../src/server/postgres-session-repository.js";

function fakePool({ rows = [], rowCount = 0, error } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, values) {
      calls.push({ sql, values });
      if (error) throw error;
      return { rows, rowCount };
    }
  };
}

test("requires a query-capable PostgreSQL pool", () => {
  assert.throws(() => createPostgresSessionRepository(), /pool.query is required/);
  assert.throws(() => createPostgresSessionRepository({ pool: {} }), /pool.query is required/);
});

test("stores only the digest and uses parameterized SQL for session creation", async () => {
  const pool = fakePool();
  const repo = createPostgresSessionRepository({ pool });
  const record = { actorId: "account-1", createdAt: 1000, expiresAt: 2000 };
  await repo.put("a".repeat(64), record);
  assert.match(pool.calls[0].sql, /INSERT INTO novalife_sessions/);
  assert.match(pool.calls[0].sql, /\$1[\s\S]*\$2[\s\S]*\$3[\s\S]*\$4/);
  assert.deepEqual(pool.calls[0].values, ["a".repeat(64), "account-1", 1000, 2000]);
  assert.equal(pool.calls[0].values.includes("raw-session-token"), false);
});

test("rejects malformed digest and invalid record before database access", async () => {
  const pool = fakePool();
  const repo = createPostgresSessionRepository({ pool });
  await assert.rejects(repo.put("not-a-digest", { actorId: "a", createdAt: 1, expiresAt: 2 }), /digest/);
  await assert.rejects(repo.put("a".repeat(64), { actorId: "a", createdAt: 2, expiresAt: 1 }), /session record/);
  assert.equal(pool.calls.length, 0);
});

test("maps database rows into session records", async () => {
  const pool = fakePool({ rows: [{ actor_id: "account-1", created_at_ms: "1000", expires_at_ms: "9000" }] });
  const repo = createPostgresSessionRepository({ pool });
  assert.deepEqual(await repo.get("b".repeat(64)), {
    actorId: "account-1",
    createdAt: 1000,
    expiresAt: 9000
  });
  assert.deepEqual(pool.calls[0].values, ["b".repeat(64)]);
});

test("returns null for missing rows or malformed lookup digest", async () => {
  const pool = fakePool();
  const repo = createPostgresSessionRepository({ pool });
  assert.equal(await repo.get("invalid"), null);
  assert.equal(await repo.get("c".repeat(64)), null);
  assert.equal(pool.calls.length, 1);
});

test("deletes one session and reports whether a row was removed", async () => {
  const pool = fakePool({ rowCount: 1 });
  const repo = createPostgresSessionRepository({ pool });
  assert.equal(await repo.delete("d".repeat(64)), true);
  assert.equal(await repo.delete("invalid"), false);
  assert.equal(pool.calls.length, 1);
});

test("deletes all sessions for an actor using a parameterized query", async () => {
  const pool = fakePool({ rowCount: 3 });
  const repo = createPostgresSessionRepository({ pool });
  assert.equal(await repo.deleteByActor("account-1"), 3);
  assert.equal(await repo.deleteByActor(" "), 0);
  assert.deepEqual(pool.calls[0].values, ["account-1"]);
  assert.match(pool.calls[0].sql, /DELETE FROM novalife_sessions WHERE actor_id = \$1/);
});

test("propagates database errors so authentication can fail closed", async () => {
  const pool = fakePool({ error: new Error("database unavailable") });
  const repo = createPostgresSessionRepository({ pool });
  await assert.rejects(repo.get("e".repeat(64)), /database unavailable/);
});
