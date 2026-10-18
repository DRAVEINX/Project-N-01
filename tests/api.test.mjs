import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createApiServer } from "../server/api.mjs";

function decodeBase32(input) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0; const out = [];
  for (const char of input) {
    value = (value << 5) | chars.indexOf(char); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function currentTotp(secret, at = Date.now()) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const mac = createHmac("sha1", decodeBase32(secret)).update(msg).digest();
  const offset = mac[mac.length - 1] & 15;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}
async function jsonResponse(response) {
  return { status: response.status, body: await response.json() };
}

test("account API hashes passwords, supports authenticator 2FA and protects encrypted sync revisions", async t => {
  const dir = await mkdtemp(join(tmpdir(), "project-n01-api-"));
  const server = await createApiServer({ dataPath: join(dir, "database.json"), serverSecret: "test-only-secret-of-at-least-32-characters" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  const base = "http://127.0.0.1:" + server.address().port;
  const call = (path, options = {}) => fetch(base + path, Object.assign({
    headers: { "content-type": "application/json" }, cache: "no-store"
  }, options));
  const health = await jsonResponse(await call("/api/health"));
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
  assert.equal(health.body.secureServerSecretConfigured, true);

  const registered = await jsonResponse(await call("/api/auth/register", {
    method: "POST", body: JSON.stringify({ displayName: "Tester", email: "tester@example.test", password: "A-Strong-Password-2026!" })
  }));
  assert.equal(registered.status, 201);
  assert.ok(registered.body.token);
  assert.equal(registered.body.user.email, "tester@example.test");
  assert.equal("passwordHash" in registered.body.user, false);

  const duplicate = await jsonResponse(await call("/api/auth/register", {
    method: "POST", body: JSON.stringify({ displayName: "Tester", email: "tester@example.test", password: "A-Strong-Password-2026!" })
  }));
  assert.equal(duplicate.status, 409);

  const wrongPassword = await jsonResponse(await call("/api/auth/login", {
    method: "POST", body: JSON.stringify({ email: "tester@example.test", password: "wrong-password" })
  }));
  assert.equal(wrongPassword.status, 401);

  const authHeaders = { authorization: "Bearer " + registered.body.token, "content-type": "application/json" };
  const setup = await jsonResponse(await call("/api/auth/2fa/setup", { method: "POST", headers: authHeaders, body: "{}" }));
  assert.equal(setup.status, 200);
  assert.match(setup.body.secret, /^[A-Z2-7]+$/);
  const activated = await jsonResponse(await call("/api/auth/2fa/enable", {
    method: "POST", headers: authHeaders, body: JSON.stringify({ code: currentTotp(setup.body.secret) })
  }));
  assert.equal(activated.status, 200);
  assert.equal(activated.body.user.twoFactorEnabled, true);

  const noCode = await jsonResponse(await call("/api/auth/login", {
    method: "POST", body: JSON.stringify({ email: "tester@example.test", password: "A-Strong-Password-2026!" })
  }));
  assert.equal(noCode.status, 200);
  assert.equal(noCode.body.requiresTwoFactor, true);

  const signedIn = await jsonResponse(await call("/api/auth/login", {
    method: "POST", body: JSON.stringify({ email: "tester@example.test", password: "A-Strong-Password-2026!", code: currentTotp(setup.body.secret) })
  }));
  assert.equal(signedIn.status, 200);
  assert.ok(signedIn.body.token);

  const payload = {
    format: "project-n-01-life-v1", version: 1, kdf: "PBKDF2-SHA-256", iterations: 310000,
    cipher: "AES-256-GCM", salt: randomBytes(16).toString("base64"), iv: randomBytes(12).toString("base64"),
    ciphertext: randomBytes(64).toString("base64")
  };
  const signedHeaders = { authorization: "Bearer " + signedIn.body.token, "content-type": "application/json" };
  const uploaded = await jsonResponse(await call("/api/sync", {
    method: "POST", headers: signedHeaders, body: JSON.stringify({ baseRevision: 0, payload })
  }));
  assert.equal(uploaded.status, 200);
  assert.equal(uploaded.body.revision, 1);

  const conflict = await jsonResponse(await call("/api/sync", {
    method: "POST", headers: signedHeaders, body: JSON.stringify({ baseRevision: 0, payload: Object.assign({}, payload, { ciphertext: randomBytes(48).toString("base64") }) })
  }));
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error, "sync-conflict");
  assert.equal(conflict.body.revision, 1);

  const downloaded = await jsonResponse(await call("/api/sync", { headers: signedHeaders }));
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.body.revision, 1);
  assert.equal(downloaded.body.payload.ciphertext, payload.ciphertext);
});

test("API rejects weak passwords, invalid encrypted payloads and unauthenticated sync writes", async t => {
  const dir = await mkdtemp(join(tmpdir(), "project-n01-api-"));
  const server = await createApiServer({ dataPath: join(dir, "database.json"), serverSecret: "test-only-secret-of-at-least-32-characters" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  const base = "http://127.0.0.1:" + server.address().port;
  const call = (path, options = {}) => fetch(base + path, Object.assign({
    headers: { "content-type": "application/json" }, cache: "no-store"
  }, options));
  const weak = await call("/api/auth/register", {
    method: "POST", body: JSON.stringify({ email: "weak@example.test", password: "short" })
  });
  assert.equal(weak.status, 400);
  const unauthenticated = await call("/api/sync", {
    method: "POST", body: JSON.stringify({ baseRevision: 0, payload: {} })
  });
  assert.equal(unauthenticated.status, 401);
  const registered = await jsonResponse(await call("/api/auth/register", {
    method: "POST", body: JSON.stringify({ email: "strong@example.test", password: "An-Excellent-Password-2026!" })
  }));
  const invalidPayload = await call("/api/sync", {
    method: "POST", headers: { authorization: "Bearer " + registered.body.token, "content-type": "application/json" },
    body: JSON.stringify({ baseRevision: 0, payload: { plainText: "not encrypted" } })
  });
  assert.equal(invalidPayload.status, 400);
});
