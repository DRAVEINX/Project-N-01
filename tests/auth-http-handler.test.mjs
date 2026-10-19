import test from "node:test";
import assert from "node:assert/strict";
import { createAuthHttpHandler } from "../src/server/auth-http-handler.js";

function makeAuth() {
  const sessions = new Map();
  let nextId = 0;
  return {
    async login({ email, password }) {
      if (email !== "client@example.test" || password !== "test password") {
        return { status: 401, body: { error: "invalid-credentials" } };
      }
      const accessToken = String(++nextId).padStart(43, "0");
      sessions.set(accessToken, { actor: { id: "client-1", role: "client" } });
      return { status: 200, body: { accessToken, tokenType: "Bearer", expiresAt: Date.now() + 60000, actor: { id: "client-1", role: "client" } } };
    },
    async authenticate(token) { return sessions.get(token) ?? null; },
    async revoke(token) { return sessions.delete(token); },
  };
}

function jsonRequest(path, body, headers = {}) {
  return new Request(`https://novalife.example${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("HTTP boundary handles login, current actor and logout", async () => {
  const auth = makeAuth();
  const rateLimitCalls = [];
  const handler = createAuthHttpHandler({
    auth,
    rateLimit: async (input) => { rateLimitCalls.push(input.route); return true; },
  });
  const login = await handler(jsonRequest("/auth/login", {
    email: "client@example.test",
    password: "test password",
  }));
  assert.equal(login.status, 200);
  assert.equal(login.headers.get("cache-control"), "no-store");
  const data = await login.json();
  assert.equal(data.actor.role, "client");
  assert.equal(rateLimitCalls.length, 1);
  const authHeader = { authorization: `Bearer ${data.accessToken}` };

  const me = await handler(new Request("https://novalife.example/auth/me", { headers: authHeader }));
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), { actor: { id: "client-1", role: "client" } });

  const logout = await handler(new Request("https://novalife.example/auth/logout", {
    method: "POST",
    headers: authHeader,
  }));
  assert.equal(logout.status, 200);
  assert.deepEqual(await logout.json(), { loggedOut: true });
  const afterLogout = await handler(new Request("https://novalife.example/auth/me", { headers: authHeader }));
  assert.equal(afterLogout.status, 401);
});

test("HTTP boundary rejects malformed requests and rate-limit failures", async () => {
  const auth = makeAuth();
  const handler = createAuthHttpHandler({ auth, rateLimit: async () => false });
  const limited = await handler(jsonRequest("/auth/login", { email: "a", password: "b" }));
  assert.equal(limited.status, 429);

  const wrongMethod = await handler(new Request("https://novalife.example/auth/login"));
  assert.equal(wrongMethod.status, 405);

  const badType = await handler(new Request("https://novalife.example/auth/login", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "not json",
  }));
  assert.equal(badType.status, 415);

  const badJson = await handler(new Request("https://novalife.example/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  }));
  assert.equal(badJson.status, 400);

  const extraFields = await handler(jsonRequest("/auth/login", {
    email: "client@example.test",
    password: "test password",
    role: "developer_admin",
  }));
  assert.equal(extraFields.status, 429, "rate limiting is applied before parsing login body");
});

test("HTTP boundary fails closed if rate limiter is unavailable and requires limiter", async () => {
  assert.throws(() => createAuthHttpHandler({ auth: makeAuth() }), /rateLimit/);
  const handler = createAuthHttpHandler({
    auth: makeAuth(),
    rateLimit: async () => { throw new Error("limiter unavailable"); },
  });
  const response = await handler(jsonRequest("/auth/login", { email: "x", password: "y" }));
  assert.equal(response.status, 503);
});

test("HTTP boundary rejects oversized bodies and malformed bearer tokens", async () => {
  const handler = createAuthHttpHandler({ auth: makeAuth(), rateLimit: async () => true });
  const large = await handler(jsonRequest("/auth/login", {
    email: "x".repeat(9000),
    password: "test",
  }));
  assert.equal(large.status, 413);

  const noToken = await handler(new Request("https://novalife.example/auth/me", {
    headers: { authorization: "Bearer bad" },
  }));
  assert.equal(noToken.status, 401);
});
