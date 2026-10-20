import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { createNovaLifeCareApiRouter } from "../src/server/care-api-router.js";
import { createCareTargetResolver } from "../src/server/care-target-resolver.js";
import { extractBearerSessionToken } from "../src/server/bearer-token.js";
import { handleNodeCareApiRequest } from "../src/server/node-care-api-adapter.js";
import { createPostgresAuditRepository } from "../src/server/postgres-audit-repository.js";

const PRODUCTION = process.env.NODE_ENV === "production";
const DEFAULT_POOL_SIZE = 5;
const MAX_REQUEST_BYTES = 64 * 1024;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("missing-required-configuration:" + name);
  return value;
}

function parseIntegerEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  if (!/^\d+$/.test(raw.trim())) throw new Error("invalid-configuration:" + name);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error("invalid-configuration:" + name);
  }
  return value;
}

function validateOrigin(origin) {
  // Capacitor's local WebView origins are exact native-app origins, not an
  // instruction to trust arbitrary HTTP origins.
  if (origin === "capacitor://localhost" || origin === "http://localhost" ||
      origin === "https://localhost") return true;
  let url;
  try { url = new URL(origin); } catch { return false; }
  if (url.origin !== origin || url.username || url.password || url.search || url.hash) return false;
  if (url.protocol === "https:") return true;
  return !PRODUCTION && url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

function parseAllowedOrigins(value) {
  const origins = value.split(",").map((origin) => origin.trim()).filter(Boolean);
  if (origins.length === 0 || origins.includes("*") || origins.some((origin) => !validateOrigin(origin))) {
    throw new Error("invalid-configuration:ALLOWED_ORIGINS");
  }
  return [...new Set(origins)];
}

function secureDatabaseUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error("invalid-configuration:DATABASE_URL"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname ||
      !url.username || !url.password) {
    throw new Error("invalid-configuration:DATABASE_URL");
  }
  // TLS is configured below with certificate verification enabled. Remove
  // connection-string SSL options so they cannot weaken that explicit setting.
  for (const key of [...url.searchParams.keys()]) {
    if (/^ssl(mode|cert|key|rootcert|password)?$/i.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}

function trustedTransport(request, { trustProxy, directTls }) {
  if (request.socket?.encrypted === true) return true;
  if (directTls) return false;
  if (trustProxy) {
    // Only enable this mode when the hosting provider prevents direct access
    // to the application port and overwrites this header at its TLS proxy.
    return request.headers?.["x-forwarded-proto"] === "https";
  }
  if (PRODUCTION) return false;
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket?.remoteAddress);
}

function safeJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-length": Buffer.byteLength(body, "utf8"),
    ...extraHeaders,
  });
  res.end(body);
}

function validateDatabaseRole(row) {
  if (!row || row.current_user !== "novalife_api" ||
      row.rolsuper !== false || row.rolcreatedb !== false ||
      row.rolcreaterole !== false || row.rolbypassrls !== true ||
      row.can_create_public !== false) {
    throw new Error("database role does not match the restricted novalife_api profile");
  }

  const expected = {
    novalife_accounts: [true, false, false, false],
    novalife_sessions: [true, true, false, true],
    novalife_client_assignments: [true, false, false, false],
    novalife_consent_grants: [true, false, false, false],
    novalife_audit_events: [false, true, false, false],
    novalife_care_records: [true, true, true, true],
  };
  for (const [table, privileges] of Object.entries(expected)) {
    const actual = [
      row[`${table}_select`],
      row[`${table}_insert`],
      row[`${table}_update`],
      row[`${table}_delete`],
    ];
    if (actual.some((value, index) => value !== privileges[index])) {
      throw new Error("database role has unexpected privileges on " + table);
    }
  }
}

async function main() {
  const databaseUrl = secureDatabaseUrl(requiredEnv("DATABASE_URL"));
  const allowedOrigins = parseAllowedOrigins(requiredEnv("ALLOWED_ORIGINS"));
  const port = parseIntegerEnv("PORT", 8080, 1, 65535);
  const host = process.env.HOST?.trim() || (PRODUCTION ? "0.0.0.0" : "127.0.0.1");
  const poolSize = parseIntegerEnv("DATABASE_POOL_SIZE", DEFAULT_POOL_SIZE, 1, 20);
  const trustProxy = process.env.NOVALIFE_TRUST_PROXY === "true";
  const tlsKeyPath = process.env.TLS_KEY_PATH?.trim();
  const tlsCertPath = process.env.TLS_CERT_PATH?.trim();
  const directTls = Boolean(tlsKeyPath && tlsCertPath);

  if (Boolean(tlsKeyPath) !== Boolean(tlsCertPath)) {
    throw new Error("TLS_KEY_PATH and TLS_CERT_PATH must be configured together");
  }
  if (directTls && trustProxy) {
    throw new Error("configure either direct TLS or a trusted TLS proxy, not both");
  }
  if (PRODUCTION && !directTls && !trustProxy) {
    throw new Error("production requires direct TLS or NOVALIFE_TRUST_PROXY=true");
  }
  if (PRODUCTION && process.env.NOVALIFE_EXTERNAL_RATE_LIMIT_CONFIRMED !== "true") {
    throw new Error("production requires verified host-level rate limiting before startup");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: true },
    max: poolSize,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    allowExitOnIdle: false,
    application_name: "novalife-care-api",
    options: "-c statement_timeout=10000 -c idle_in_transaction_session_timeout=15000",
  });
  pool.on("error", () => {
    // Never log database connection strings, query parameters, or driver errors.
    console.error("NovaLife database pool reported an idle-client error.");
  });

  let server;
  try {
    await pool.query("SELECT 1");
    const roleResult = await pool.query(`
      SELECT current_user,
             r.rolsuper,
             r.rolcreatedb,
             r.rolcreaterole,
             r.rolbypassrls,
             has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_public,
             has_table_privilege(current_user, 'public.novalife_accounts', 'SELECT') AS novalife_accounts_select,
             has_table_privilege(current_user, 'public.novalife_accounts', 'INSERT') AS novalife_accounts_insert,
             has_table_privilege(current_user, 'public.novalife_accounts', 'UPDATE') AS novalife_accounts_update,
             has_table_privilege(current_user, 'public.novalife_accounts', 'DELETE') AS novalife_accounts_delete,
             has_table_privilege(current_user, 'public.novalife_sessions', 'SELECT') AS novalife_sessions_select,
             has_table_privilege(current_user, 'public.novalife_sessions', 'INSERT') AS novalife_sessions_insert,
             has_table_privilege(current_user, 'public.novalife_sessions', 'UPDATE') AS novalife_sessions_update,
             has_table_privilege(current_user, 'public.novalife_sessions', 'DELETE') AS novalife_sessions_delete,
             has_table_privilege(current_user, 'public.novalife_client_assignments', 'SELECT') AS novalife_client_assignments_select,
             has_table_privilege(current_user, 'public.novalife_client_assignments', 'INSERT') AS novalife_client_assignments_insert,
             has_table_privilege(current_user, 'public.novalife_client_assignments', 'UPDATE') AS novalife_client_assignments_update,
             has_table_privilege(current_user, 'public.novalife_client_assignments', 'DELETE') AS novalife_client_assignments_delete,
             has_table_privilege(current_user, 'public.novalife_consent_grants', 'SELECT') AS novalife_consent_grants_select,
             has_table_privilege(current_user, 'public.novalife_consent_grants', 'INSERT') AS novalife_consent_grants_insert,
             has_table_privilege(current_user, 'public.novalife_consent_grants', 'UPDATE') AS novalife_consent_grants_update,
             has_table_privilege(current_user, 'public.novalife_consent_grants', 'DELETE') AS novalife_consent_grants_delete,
             has_table_privilege(current_user, 'public.novalife_audit_events', 'SELECT') AS novalife_audit_events_select,
             has_table_privilege(current_user, 'public.novalife_audit_events', 'INSERT') AS novalife_audit_events_insert,
             has_table_privilege(current_user, 'public.novalife_audit_events', 'UPDATE') AS novalife_audit_events_update,
             has_table_privilege(current_user, 'public.novalife_audit_events', 'DELETE') AS novalife_audit_events_delete,
             has_table_privilege(current_user, 'public.novalife_care_records', 'SELECT') AS novalife_care_records_select,
             has_table_privilege(current_user, 'public.novalife_care_records', 'INSERT') AS novalife_care_records_insert,
             has_table_privilege(current_user, 'public.novalife_care_records', 'UPDATE') AS novalife_care_records_update,
             has_table_privilege(current_user, 'public.novalife_care_records', 'DELETE') AS novalife_care_records_delete
        FROM pg_catalog.pg_roles r
       WHERE r.rolname = current_user
    `);
    validateDatabaseRole(roleResult.rows[0]);

    const audit = createPostgresAuditRepository({ pool });
    const router = await createNovaLifeCareApiRouter({
      pool,
      authAudit: audit.authAudit,
      authorizationAudit: audit.authorizationAudit,
      extractToken: extractBearerSessionToken,
      resolveTargetClientId: createCareTargetResolver(),
    });
    const adapterOptions = {
      maxBodyBytes: MAX_REQUEST_BYTES,
      allowedOrigins,
      allowMissingOrigin: false,
      isSecureRequest: (request) => trustedTransport(request, { trustProxy, directTls }),
    };
    const handler = async (req, res) => {
      if (req.url === "/healthz" && req.method === "GET") {
        if (!trustedTransport(req, { trustProxy, directTls })) {
          safeJson(res, 400, { error: "secure-transport-required" });
          return;
        }
        safeJson(res, 200, { status: "ok" });
        return;
      }
      await handleNodeCareApiRequest(req, res, router, adapterOptions);
    };

    if (directTls) {
      const [key, cert] = await Promise.all([readFile(tlsKeyPath), readFile(tlsCertPath)]);
      server = createHttpsServer({ key, cert, minVersion: "TLSv1.2" }, handler);
    } else {
      server = createHttpServer(handler);
    }

    server.headersTimeout = 10000;
    server.requestTimeout = 20000;
    server.keepAliveTimeout = 5000;
    server.maxHeadersCount = 50;
    server.maxRequestsPerSocket = 1000;
    server.on("clientError", (_error, socket) => {
      if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    });

    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, resolve);
    });
    console.log("NovaLife API server started on the configured host and port.");
  } catch (error) {
    await pool.end().catch(() => {});
    if (server) server.close();
    const safeMessage = error?.message?.startsWith("missing-required-configuration:") ||
      error?.message?.startsWith("invalid-configuration:") ||
      error?.message?.startsWith("production requires ") ||
      error?.message?.startsWith("configure either ") ||
      error?.message?.startsWith("database role has ")
      ? error.message
      : "NovaLife API startup checks failed; review the restricted role, privileges, TLS and host settings.";
    console.error(safeMessage);
    process.exitCode = 1;
    return;
  }

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(async () => {
      await pool.end().catch(() => {});
      process.exit(0);
    });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

await main();
