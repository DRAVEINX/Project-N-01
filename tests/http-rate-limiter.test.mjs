import test from "node:test";
import assert from "node:assert/strict";
import { createHttpRateLimiter } from "../src/server/http-rate-limiter.js";

test("requires positive safe settings and a valid clock callback", () => {
  assert.throws(() => createHttpRateLimiter({ generalLimit: 0 }), /generalLimit/);
  assert.throws(() => createHttpRateLimiter({ maxBuckets: 0 }), /maxBuckets/);
  assert.throws(() => createHttpRateLimiter({ now: 5 }), /now must be a function/);
});

test("rate limits general requests per trusted client IP and resets at the window boundary", () => {
  let current = 1_000;
  const limiter = createHttpRateLimiter({
    now: () => current,
    generalLimit: 2,
    generalWindowMs: 10_000,
    maxBuckets: 10,
  });

  assert.equal(limiter.check({ method: "GET", url: "/api/consents" }, "192.0.2.1").allowed, true);
  assert.equal(limiter.check({ method: "GET", url: "/api/consents" }, "192.0.2.1").allowed, true);
  const denied = limiter.check({ method: "GET", url: "/api/consents" }, "192.0.2.1");
  assert.deepEqual(
    { allowed: denied.allowed, status: denied.status, error: denied.error, retryAfterSeconds: denied.retryAfterSeconds },
    { allowed: false, status: 429, error: "rate-limit-exceeded", retryAfterSeconds: 10 }
  );
  assert.equal(limiter.check({ method: "GET", url: "/api/consents" }, "192.0.2.2").allowed, true);

  current += 10_000;
  assert.equal(limiter.check({ method: "GET", url: "/api/consents" }, "192.0.2.1").allowed, true);
});

test("login and mutation routes have stricter per-IP limits in addition to the general limit", () => {
  const limiter = createHttpRateLimiter({
    now: () => 1_000,
    generalLimit: 100,
    loginLimit: 1,
    loginWindowMs: 60_000,
    mutationLimit: 1,
    mutationWindowMs: 60_000,
    maxBuckets: 20,
  });

  assert.equal(limiter.check({ method: "POST", url: "/api/auth/login" }, "192.0.2.1").allowed, true);
  assert.equal(
    limiter.check({ method: "POST", url: "/api/auth/login" }, "192.0.2.1").status,
    429
  );

  assert.equal(limiter.check({ method: "POST", url: "/api/care/mood-report" }, "192.0.2.2").allowed, true);
  const blockedMutation = limiter.check({ method: "PATCH", url: "/api/care/mood-report/report-1" }, "192.0.2.2");
  assert.equal(blockedMutation.status, 429);
  assert.equal(blockedMutation.error, "rate-limit-exceeded");
  assert.equal(limiter.check({ method: "GET", url: "/api/care/mood-report" }, "192.0.2.2").allowed, true);
});

test("untrusted or missing client identity fails closed and healthcheck remains lightweight", () => {
  const limiter = createHttpRateLimiter({ now: () => 1_000 });
  assert.deepEqual(
    limiter.check({ method: "POST", url: "/api/auth/login" }, null),
    { allowed: false, status: 503, error: "request-security-unavailable" }
  );
  assert.equal(limiter.check({ method: "GET", url: "/healthz" }, null).allowed, true);
  assert.equal(limiter.bucketCount, 0);
});

test("refuses new client buckets instead of evicting active rate limits when full", () => {
  const limiter = createHttpRateLimiter({
    now: () => 1_000,
    generalLimit: 10,
    generalWindowMs: 60_000,
    maxBuckets: 1,
  });
  assert.equal(limiter.check({ method: "GET", url: "/api/consents" }, "192.0.2.1").allowed, true);
  assert.equal(limiter.bucketCount, 1);

  const other = limiter.check({ method: "GET", url: "/api/consents" }, "192.0.2.2");
  assert.equal(other.allowed, false);
  assert.equal(other.status, 429);
  assert.equal(limiter.bucketCount, 1);
});


test("leaves CORS preflight to the origin-aware HTTP adapter", () => {
  const limiter = createHttpRateLimiter({ now: () => 1_000 });
  const result = limiter.check({
    method: "OPTIONS",
    url: "/api/auth/login",
    headers: {
      origin: "https://app.example",
      "access-control-request-method": "POST",
    },
  }, null);
  assert.equal(result.allowed, true);
  assert.equal(result.exempt, true);
  assert.equal(limiter.bucketCount, 0);
});
