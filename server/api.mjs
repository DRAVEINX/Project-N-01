import { createServer } from "node:http";
import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, rename, chmod } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const scrypt = promisify(scryptCallback);
const MAX_BODY = 5 * 1024 * 1024;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_MS = 30 * 60 * 1000;
const ROLES = new Set(["caregiver", "parent", "guardian"]);
const SCOPES = new Set(["calendar", "routines", "roster", "goals", "documents", "reports", "emergency"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nowIso = () => new Date().toISOString();
const id = () => randomBytes(16).toString("hex");
const token = () => randomBytes(32).toString("base64url");
const hash = value => createHash("sha256").update(String(value)).digest("hex");
const safeEqual = (a, b) => {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
};
const blankDb = () => ({ schema: 1, users: [], sessions: [], resets: [], workspaces: [], invites: [], sync: [] });

function base32(buffer) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0, out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += chars[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) out += chars[(value << (5 - bits)) & 31];
  return out;
}
function decodeBase32(input) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const bytes = [];
  for (const char of String(input).toUpperCase().replace(/=+$/g, "")) {
    const n = chars.indexOf(char);
    if (n < 0) throw new Error("bad-base32");
    value = (value << 5) | n;
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(bytes);
}
function totp(secret, time = Date.now()) {
  const counter = Math.floor(time / 30000);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(msg).digest();
  const offset = digest[digest.length - 1] & 15;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(value).padStart(6, "0");
}
function verifyTotp(secret, code, time = Date.now()) {
  if (!/^\d{6}$/.test(String(code || ""))) return false;
  return [-1, 0, 1].some(step => safeEqual(totp(secret, time + step * 30000), code));
}
function passwordKey(password, salt) {
  return scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}
function serverKey(secret) {
  return scryptSync(secret, "project-n-01-server-key-v1", 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}
function sealSecret(secret, secretKey) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", serverKey(secretKey), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return { iv: iv.toString("base64url"), data: ciphertext.toString("base64url"), tag: cipher.getAuthTag().toString("base64url") };
}
function openSecret(envelope, secretKey) {
  const decipher = createDecipheriv("aes-256-gcm", serverKey(secretKey), Buffer.from(envelope.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64url")), decipher.final()]).toString("utf8");
}
function publicUser(user) {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role, twoFactorEnabled: Boolean(user.twoFactorEnabled), createdAt: user.createdAt };
}
function isEncryptedEnvelope(payload) {
  return payload && payload.format === "project-n-01-life-v1" && payload.cipher === "AES-256-GCM" &&
    typeof payload.salt === "string" && typeof payload.iv === "string" && typeof payload.ciphertext === "string" &&
    payload.ciphertext.length < MAX_BODY * 2 && payload.version === 1;
}

export async function createApiServer(options = {}) {
  const dataPath = options.dataPath || process.env.PROJECT_N01_DB_PATH || join(process.cwd(), "data-private", "project-n-01-db.json");
  const deliveryUrl = options.deliveryUrl ?? process.env.PROJECT_N01_DELIVERY_WEBHOOK_URL ?? "";
  const deliveryToken = options.deliveryToken ?? process.env.PROJECT_N01_DELIVERY_WEBHOOK_TOKEN ?? "";
  const publicAppUrl = options.publicAppUrl ?? process.env.PROJECT_N01_PUBLIC_APP_URL ?? "";
  const secret = options.serverSecret ?? process.env.PROJECT_N01_SERVER_SECRET ?? "";
  const allowedOrigins = new Set(String(options.allowedOrigins ?? process.env.PROJECT_N01_CORS_ORIGINS ?? "").split(",").map(v => v.trim()).filter(Boolean));
  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error("Set PROJECT_N01_SERVER_SECRET to a unique secret of at least 32 characters before production startup.");
  }
  await mkdir(dirname(dataPath), { recursive: true });
  let db;
  try {
    db = JSON.parse(await readFile(dataPath, "utf8"));
    if (!db || db.schema !== 1 || !Array.isArray(db.users) || !Array.isArray(db.sessions)) throw new Error("bad-db");
    for (const key of ["resets", "workspaces", "invites", "sync"]) if (!Array.isArray(db[key])) db[key] = [];
  } catch (error) {
    if (error && error.code !== "ENOENT") throw new Error("The account database is unreadable; refusing to overwrite it.");
    db = blankDb();
  }
  let writeChain = Promise.resolve();
  const persist = () => {
    writeChain = writeChain.then(async () => {
      const temporary = dataPath + ".tmp";
      await writeFile(temporary, JSON.stringify(db), { mode: 0o600 });
      try { await chmod(temporary, 0o600); } catch {}
      await rename(temporary, dataPath);
      try { await chmod(dataPath, 0o600); } catch {}
    });
    return writeChain;
  };
  const limits = new Map();
  const rateAllowed = (key, max = 12, windowMs = 60000) => {
    const now = Date.now();
    const old = limits.get(key);
    if (!old || now - old.start >= windowMs) { limits.set(key, { start: now, count: 1 }); return true; }
    old.count += 1;
    return old.count <= max;
  };
  const send = (res, status, value, extra = {}) => {
    res.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      ...extra
    });
    res.end(JSON.stringify(value));
  };
  const readBody = req => new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (Buffer.byteLength(raw) > MAX_BODY) { reject(Object.assign(new Error("body-too-large"), { status: 413 })); req.destroy(); }
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(Object.assign(new Error("invalid-json"), { status: 400 })); }
    });
    req.on("error", reject);
  });
  const deliver = async payload => {
    if (!deliveryUrl) return false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const headers = { "content-type": "application/json" };
      if (deliveryToken) headers.authorization = "Bearer " + deliveryToken;
      const response = await fetch(deliveryUrl, { method: "POST", headers, body: JSON.stringify(payload), signal: controller.signal });
      return response.ok;
    } catch { return false; }
    finally { clearTimeout(timer); }
  };
  const findSession = req => {
    const header = String(req.headers.authorization || "");
    if (!header.startsWith("Bearer ")) return null;
    const digest = hash(header.slice(7));
    const item = db.sessions.find(s => s.tokenHash === digest && Date.parse(s.expiresAt) > Date.now());
    if (!item) return null;
    const user = db.users.find(u => u.id === item.userId && !u.disabledAt);
    return user ? { session: item, user } : null;
  };
  const requireSelf = (res, auth) => {
    if (!auth) { send(res, 401, { error: "authentication-required" }); return false; }
    if (auth.user.role !== "self") { send(res, 403, { error: "owner-role-required" }); return false; }
    return true;
  };
  const createSession = user => {
    const raw = token();
    db.sessions = db.sessions.filter(s => s.userId !== user.id || Date.parse(s.expiresAt) > Date.now());
    db.sessions.push({ tokenHash: hash(raw), userId: user.id, createdAt: nowIso(), expiresAt: new Date(Date.now() + SESSION_MS).toISOString() });
    return raw;
  };
  const createUser = async ({ email, password, displayName, role = "self" }) => {
    email = String(email || "").trim().toLowerCase();
    displayName = String(displayName || "").trim().slice(0, 80);
    if (!emailPattern.test(email) || email.length > 254) throw Object.assign(new Error("invalid-email"), { status: 400 });
    if (typeof password !== "string" || password.length < 12 || password.length > 200) throw Object.assign(new Error("password-must-be-12-to-200-characters"), { status: 400 });
    if (db.users.some(u => u.email === email)) throw Object.assign(new Error("account-exists"), { status: 409 });
    const salt = randomBytes(16).toString("base64url");
    const derived = await passwordKey(password, Buffer.from(salt, "base64url"));
    const user = { id: id(), email, displayName: displayName || email.split("@")[0], role, salt, passwordHash: derived.toString("base64url"), twoFactorEnabled: false, createdAt: nowIso(), workspaces: [] };
    db.users.push(user);
    if (role === "self") {
      const workspace = { id: user.id, ownerId: user.id, createdAt: nowIso(), members: [{ userId: user.id, role: "self", scopes: Array.from(SCOPES) }] };
      user.workspaces.push(workspace.id);
      db.workspaces.push(workspace);
    }
    return user;
  };
  const server = createServer(async (req, res) => {
    const requestOrigin = req.headers.origin;
    const hostOrigin = (req.socket.encrypted ? "https://" : "http://") + String(req.headers.host || "");
    if (requestOrigin) {
      if (!allowedOrigins.has(requestOrigin) && requestOrigin !== hostOrigin) {
        send(res, 403, { error: "origin-not-allowed" });
        return;
      }
      res.setHeader("access-control-allow-origin", requestOrigin);
      res.setHeader("vary", "Origin");
      res.setHeader("access-control-allow-headers", "authorization, content-type, if-match");
      res.setHeader("access-control-allow-methods", "GET, POST, PUT, OPTIONS");
    }
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url || "/", "http://localhost");
    if (!url.pathname.startsWith("/api/")) { send(res, 404, { error: "not-found" }); return; }
    const remote = req.socket.remoteAddress || "unknown";
    const limitKey = remote + ":" + url.pathname;
    if (!rateAllowed(limitKey, url.pathname.includes("login") || url.pathname.includes("reset") ? 8 : 50)) {
      send(res, 429, { error: "rate-limit-exceeded" }, { "retry-after": "60" });
      return;
    }
    try {
      if (req.method === "GET" && url.pathname === "/api/health") {
        send(res, 200, { ok: true, service: "project-n-01-api", apiVersion: 1, accountRecoveryDeliveryConfigured: Boolean(deliveryUrl), secureServerSecretConfigured: secret.length >= 32, persistence: "single-instance-json-prototype", features: ["accounts", "session-expiry", "totp-2fa", "password-reset-webhook", "encrypted-revisioned-sync", "scoped-team-invitations"] });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/auth/register") {
        const body = await readBody(req);
        const user = await createUser(body);
        const accessToken = createSession(user);
        await persist();
        send(res, 201, { token: accessToken, expiresInSeconds: Math.floor(SESSION_MS / 1000), user: publicUser(user) });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/auth/login") {
        const body = await readBody(req);
        const email = String(body.email || "").trim().toLowerCase();
        const user = db.users.find(u => u.email === email && !u.disabledAt);
        const dummySalt = Buffer.alloc(16);
        const derived = await passwordKey(String(body.password || ""), user ? Buffer.from(user.salt, "base64url") : dummySalt);
        if (!user || !safeEqual(derived.toString("base64url"), user.passwordHash)) {
          send(res, 401, { error: "invalid-credentials" }); return;
        }
        if (user.twoFactorEnabled) {
          let secretValue = "";
          try { secretValue = openSecret(user.twoFactorSecret, secret || ""); } catch {}
          if (!body.code) { send(res, 200, { requiresTwoFactor: true }); return; }
          if (!secretValue || !verifyTotp(secretValue, body.code)) { send(res, 401, { error: "invalid-two-factor-code" }); return; }
        }
        const accessToken = createSession(user);
        await persist();
        send(res, 200, { token: accessToken, expiresInSeconds: Math.floor(SESSION_MS / 1000), user: publicUser(user) });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/auth/password-reset/request") {
        const body = await readBody(req);
        const email = String(body.email || "").trim().toLowerCase();
        const user = db.users.find(u => u.email === email && !u.disabledAt);
        if (user && deliveryUrl && publicAppUrl) {
          const rawToken = token();
          db.resets = db.resets.filter(r => Date.parse(r.expiresAt) > Date.now() && r.userId !== user.id);
          db.resets.push({ id: id(), userId: user.id, tokenHash: hash(rawToken), createdAt: nowIso(), expiresAt: new Date(Date.now() + RESET_MS).toISOString() });
          const delivered = await deliver({ type: "password-reset", to: user.email, displayName: user.displayName, resetUrl: publicAppUrl.replace(/\/+$/, "") + "/#/reset-password?token=" + encodeURIComponent(rawToken), expiresInMinutes: 30 });
          if (!delivered) db.resets = db.resets.filter(r => r.userId !== user.id);
          await persist();
        }
        send(res, 202, { message: "If the account exists and email delivery is configured, reset instructions will be sent." });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/auth/password-reset/confirm") {
        const body = await readBody(req);
        if (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 200) { send(res, 400, { error: "password-must-be-12-to-200-characters" }); return; }
        const reset = db.resets.find(r => r.tokenHash === hash(body.token || "") && Date.parse(r.expiresAt) > Date.now());
        if (!reset) { send(res, 400, { error: "reset-token-invalid-or-expired" }); return; }
        const user = db.users.find(u => u.id === reset.userId);
        if (!user) { send(res, 400, { error: "reset-token-invalid-or-expired" }); return; }
        user.salt = randomBytes(16).toString("base64url");
        user.passwordHash = (await passwordKey(body.password, Buffer.from(user.salt, "base64url"))).toString("base64url");
        db.sessions = db.sessions.filter(s => s.userId !== user.id);
        db.resets = db.resets.filter(r => r.userId !== user.id);
        await persist();
        send(res, 200, { ok: true, message: "Password reset complete. Sign in again on each device." });
        return;
      }
      const auth = findSession(req);
      if (req.method === "GET" && url.pathname === "/api/auth/me") {
        if (!auth) { send(res, 401, { error: "authentication-required" }); return; }
        send(res, 200, { user: publicUser(auth.user), expiresAt: auth.session.expiresAt, workspaces: auth.user.workspaces || [] });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/auth/logout") {
        if (!auth) { send(res, 401, { error: "authentication-required" }); return; }
        db.sessions = db.sessions.filter(s => s.tokenHash !== auth.session.tokenHash);
        await persist();
        send(res, 200, { ok: true });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/auth/2fa/setup") {
        if (!auth) { send(res, 401, { error: "authentication-required" }); return; }
        if (secret.length < 32) { send(res, 503, { error: "server-secret-not-configured" }); return; }
        const rawSecret = base32(randomBytes(20));
        auth.user.twoFactorPending = sealSecret(rawSecret, secret);
        await persist();
        const label = encodeURIComponent("Project N-01:" + auth.user.email);
        const uri = "otpauth://totp/" + label + "?secret=" + rawSecret + "&issuer=Project%20N-01&algorithm=SHA1&digits=6&period=30";
        send(res, 200, { secret: rawSecret, otpauthUri: uri, instructions: "Add this account to an authenticator app, then confirm with a current six-digit code. Keep this setup secret private." });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/auth/2fa/enable") {
        if (!auth) { send(res, 401, { error: "authentication-required" }); return; }
        if (!secret || !auth.user.twoFactorPending) { send(res, 400, { error: "two-factor-setup-not-started" }); return; }
        const body = await readBody(req);
        let pending = "";
        try { pending = openSecret(auth.user.twoFactorPending, secret); } catch {}
        if (!pending || !verifyTotp(pending, body.code)) { send(res, 400, { error: "invalid-two-factor-code" }); return; }
        auth.user.twoFactorSecret = auth.user.twoFactorPending;
        delete auth.user.twoFactorPending;
        auth.user.twoFactorEnabled = true;
        await persist();
        send(res, 200, { ok: true, user: publicUser(auth.user) });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/auth/2fa/disable") {
        if (!auth) { send(res, 401, { error: "authentication-required" }); return; }
        const body = await readBody(req);
        const derived = await passwordKey(String(body.password || ""), Buffer.from(auth.user.salt, "base64url"));
        if (!safeEqual(derived.toString("base64url"), auth.user.passwordHash)) { send(res, 401, { error: "invalid-credentials" }); return; }
        let secretValue = "";
        try { secretValue = openSecret(auth.user.twoFactorSecret, secret || ""); } catch {}
        if (!auth.user.twoFactorEnabled || !secretValue || !verifyTotp(secretValue, body.code)) { send(res, 400, { error: "invalid-two-factor-code" }); return; }
        delete auth.user.twoFactorSecret;
        auth.user.twoFactorEnabled = false;
        await persist();
        send(res, 200, { ok: true, user: publicUser(auth.user) });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/sync") {
        if (!auth || auth.user.role !== "self") { send(res, auth ? 403 : 401, { error: "owner-authentication-required" }); return; }
        const body = await readBody(req);
        if (!isEncryptedEnvelope(body.payload)) { send(res, 400, { error: "encrypted-envelope-required" }); return; }
        const current = db.sync.find(item => item.userId === auth.user.id);
        const currentRevision = current ? current.revision : 0;
        const baseRevision = Number(body.baseRevision);
        if (!Number.isInteger(baseRevision) || baseRevision < 0) { send(res, 400, { error: "base-revision-required" }); return; }
        if (baseRevision !== currentRevision) {
          send(res, 409, { error: "sync-conflict", revision: currentRevision, updatedAt: current && current.updatedAt, payload: current && current.payload });
          return;
        }
        const next = { userId: auth.user.id, revision: currentRevision + 1, updatedAt: nowIso(), payload: body.payload };
        if (current) Object.assign(current, next); else db.sync.push(next);
        await persist();
        send(res, 200, { revision: next.revision, updatedAt: next.updatedAt });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/sync") {
        if (!auth || auth.user.role !== "self") { send(res, auth ? 403 : 401, { error: "owner-authentication-required" }); return; }
        const current = db.sync.find(item => item.userId === auth.user.id);
        send(res, 200, current ? { revision: current.revision, updatedAt: current.updatedAt, payload: current.payload } : { revision: 0, updatedAt: null, payload: null });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/team/invite") {
        if (!requireSelf(res, auth)) return;
        const body = await readBody(req);
        const email = String(body.email || "").trim().toLowerCase();
        const role = String(body.role || "");
        const scopes = Array.isArray(body.scopes) ? [...new Set(body.scopes.filter(v => SCOPES.has(v)))] : [];
        if (!emailPattern.test(email) || !ROLES.has(role) || !scopes.length) { send(res, 400, { error: "valid-email-role-and-scopes-required" }); return; }
        if (!deliveryUrl) { send(res, 503, { error: "invite-delivery-not-configured", message: "Configure PROJECT_N01_DELIVERY_WEBHOOK_URL before creating remote invitations." }); return; }
        const rawToken = token();
        const invite = { id: id(), tokenHash: hash(rawToken), ownerId: auth.user.id, email, role, scopes, createdAt: nowIso(), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), acceptedBy: null };
        db.invites.push(invite);
        const delivered = await deliver({ type: "team-invitation", to: email, role, scopes, invitationUrl: (publicAppUrl || "").replace(/\/+$/, "") + "/#/accept-invitation?token=" + encodeURIComponent(rawToken), expiresInDays: 7 });
        if (!delivered) { db.invites = db.invites.filter(x => x.id !== invite.id); send(res, 502, { error: "invite-delivery-failed" }); return; }
        await persist();
        send(res, 201, { ok: true, invitationId: invite.id, expiresAt: invite.expiresAt });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/team/accept") {
        if (!auth) { send(res, 401, { error: "authentication-required" }); return; }
        const body = await readBody(req);
        const invite = db.invites.find(item => item.tokenHash === hash(body.token || "") && !item.acceptedBy && Date.parse(item.expiresAt) > Date.now() && item.email === auth.user.email);
        if (!invite) { send(res, 400, { error: "invitation-invalid-expired-or-email-mismatch" }); return; }
        invite.acceptedBy = auth.user.id;
        invite.acceptedAt = nowIso();
        const workspace = db.workspaces.find(item => item.id === invite.ownerId);
        if (workspace && !workspace.members.some(m => m.userId === auth.user.id)) {
          workspace.members.push({ userId: auth.user.id, role: invite.role, scopes: invite.scopes });
          auth.user.workspaces = [...new Set([...(auth.user.workspaces || []), workspace.id])];
        }
        await persist();
        send(res, 200, { ok: true, workspaceId: invite.ownerId, role: invite.role, scopes: invite.scopes, sharingLimit: "Encrypted workspace payload is not shared with invited accounts by this endpoint yet." });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/team/members") {
        if (!auth) { send(res, 401, { error: "authentication-required" }); return; }
        const memberships = db.workspaces.filter(w => w.ownerId === auth.user.id || w.members.some(m => m.userId === auth.user.id)).map(w => ({
          workspaceId: w.id,
          ownerId: w.ownerId,
          members: w.members.map(m => {
            const user = db.users.find(u => u.id === m.userId);
            return { userId: m.userId, displayName: user && user.displayName, email: user && user.email, role: m.role, scopes: m.scopes };
          })
        }));
        send(res, 200, { workspaces: memberships });
        return;
      }
      send(res, 404, { error: "not-found" });
    } catch (error) {
      if (error && error.status) { send(res, error.status, { error: error.message }); return; }
      send(res, 500, { error: "server-error" });
    }
  });
  server.apiDatabasePath = dataPath;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createApiServer().then(server => {
    const host = process.env.HOST || "127.0.0.1";
    const port = Number(process.env.PORT || 4180);
    server.listen(port, host, () => console.log("Project N-01 API listening on " + host + ":" + port));
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
