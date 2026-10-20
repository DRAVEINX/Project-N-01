const DEFAULTS = Object.freeze({
  generalLimit: 300,
  generalWindowMs: 60_000,
  loginLimit: 10,
  loginWindowMs: 15 * 60_000,
  mutationLimit: 60,
  mutationWindowMs: 60_000,
  maxBuckets: 50_000,
});

function positiveInteger(value, label, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new TypeError(label + " must be a positive safe integer");
  }
  return value;
}

function normalizedRequest(request) {
  const method = String(request?.method ?? "GET").toUpperCase();
  let url;
  try {
    url = new URL(request?.url ?? request?.path ?? "/", "http://novalife.internal");
  } catch {
    return { method, pathname: null };
  }
  return { method, pathname: url.pathname };
}

function retrySeconds(resetAt, timestamp) {
  return Math.max(1, Math.ceil((resetAt - timestamp) / 1000));
}

/**
 * Bounded per-process request limiter. It is defense in depth and is intended
 * for a single API replica; use a trusted ingress/distributed limiter as well
 * before production. Keys are limited to normalized client IP values and
 * endpoint classes, and no raw request body or credential is retained.
 */
export function createHttpRateLimiter(options = {}) {
  const settings = {
    generalLimit: positiveInteger(options.generalLimit ?? DEFAULTS.generalLimit, "generalLimit"),
    generalWindowMs: positiveInteger(options.generalWindowMs ?? DEFAULTS.generalWindowMs, "generalWindowMs"),
    loginLimit: positiveInteger(options.loginLimit ?? DEFAULTS.loginLimit, "loginLimit"),
    loginWindowMs: positiveInteger(options.loginWindowMs ?? DEFAULTS.loginWindowMs, "loginWindowMs"),
    mutationLimit: positiveInteger(options.mutationLimit ?? DEFAULTS.mutationLimit, "mutationLimit"),
    mutationWindowMs: positiveInteger(options.mutationWindowMs ?? DEFAULTS.mutationWindowMs, "mutationWindowMs"),
    maxBuckets: positiveInteger(options.maxBuckets ?? DEFAULTS.maxBuckets, "maxBuckets", 1_000_000),
  };
  const now = options.now ?? (() => Date.now());
  if (typeof now !== "function") throw new TypeError("now must be a function");

  const buckets = new Map();

  function pruneExpired(timestamp) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= timestamp) buckets.delete(key);
    }
  }

  function consume(key, limit, windowMs, timestamp) {
    let bucket = buckets.get(key);
    if (bucket && bucket.resetAt <= timestamp) {
      buckets.delete(key);
      bucket = undefined;
    }

    if (!bucket) {
      if (buckets.size >= settings.maxBuckets) pruneExpired(timestamp);
      if (buckets.size >= settings.maxBuckets) {
        return {
          allowed: false,
          status: 429,
          limit,
          remaining: 0,
          retryAfterSeconds: 60,
        };
      }
      bucket = { count: 0, resetAt: timestamp + windowMs };
      buckets.set(key, bucket);
    } else {
      // Refresh insertion order for predictable bounded cleanup, without
      // extending the active time window.
      buckets.delete(key);
      buckets.set(key, bucket);
    }

    if (bucket.count >= limit) {
      return {
        allowed: false,
        status: 429,
        limit,
        remaining: 0,
        retryAfterSeconds: retrySeconds(bucket.resetAt, timestamp),
      };
    }

    bucket.count += 1;
    return {
      allowed: true,
      status: 200,
      limit,
      remaining: limit - bucket.count,
      retryAfterSeconds: 0,
    };
  }

  function check(request, clientIp) {
    const { method, pathname } = normalizedRequest(request);
    if (pathname === "/healthz" && method === "GET") {
      return Object.freeze({ allowed: true, status: 200, exempt: true });
    }
    if (typeof clientIp !== "string" || !clientIp || clientIp.length > 64 ||
        clientIp.trim() !== clientIp || /[\u0000-\u0020\u007f]/.test(clientIp)) {
      return Object.freeze({
        allowed: false,
        status: 503,
        error: "request-security-unavailable",
      });
    }

    const timestamp = now();
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
      throw new Error("invalid-rate-limiter-clock");
    }

    const checks = [
      ["all", settings.generalLimit, settings.generalWindowMs],
    ];
    if (pathname === "/api/auth/login" && method === "POST") {
      checks.push(["login", settings.loginLimit, settings.loginWindowMs]);
    }
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
        pathname?.startsWith("/api/")) {
      checks.push(["mutation", settings.mutationLimit, settings.mutationWindowMs]);
    }

    for (const [kind, limit, windowMs] of checks) {
      const result = consume(kind + ":" + clientIp, limit, windowMs, timestamp);
      if (!result.allowed) {
        return Object.freeze({
          allowed: false,
          status: result.status,
          error: "rate-limit-exceeded",
          limit: result.limit,
          remaining: result.remaining,
          retryAfterSeconds: result.retryAfterSeconds,
        });
      }
    }

    return Object.freeze({ allowed: true, status: 200 });
  }

  return Object.freeze({
    check,
    get bucketCount() { return buckets.size; },
  });
}
