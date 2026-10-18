import http from "node:http";
import { randomUUID } from "node:crypto";
import pg from "pg";
import {
  normalizeEmail, validatePassword, hashPassword, verifyPassword, signToken, verifyToken,
  randomToken, hashToken, newTotpSecret, verifyTotp, totpUri,
  encryptMfaSecret, decryptMfaSecret, validateEncryptedEnvelope
} from "./core.mjs";

const { Pool } = pg;
const PORT = Number(process.env.PORT || 4180);
const HOST = process.env.HOST || "0.0.0.0";
const DATABASE_URL = process.env.DATABASE_URL || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
const ALLOWED_ORIGINS = String(process.env.APP_ORIGINS || process.env.APP_ORIGIN || "").split(",").map(value=>value.trim()).filter(Boolean);
const APP_ORIGIN = ALLOWED_ORIGINS[0] || "";
const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || APP_ORIGIN).replace(/\/$/, "");
const RESET_MAIL_API_KEY = process.env.RESEND_API_KEY || "";
const MAIL_FROM = process.env.MAIL_FROM || "";
const BODY_LIMIT = 4_500_000;
const SESSION_MINUTES = 30;
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: true },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});
const rateBuckets = new Map();

if (!DATABASE_URL) throw new Error("DATABASE_URL must be configured before starting the API.");
if (Buffer.byteLength(JWT_SECRET) < 32) throw new Error("JWT_SECRET must be at least 32 bytes of a unique random secret.");
if (!ALLOWED_ORIGINS.length || ALLOWED_ORIGINS.some(origin=>{try{const parsed=new URL(origin);return parsed.origin!==origin || !(parsed.protocol==="https:" || parsed.protocol==="capacitor:" && parsed.hostname==="localhost" || parsed.protocol==="http:" && ["localhost","127.0.0.1"].includes(parsed.hostname));}catch{return true;}})) throw new Error("APP_ORIGINS must contain exact HTTPS origins (or localhost/capacitor://localhost for development).");
if (!PUBLIC_APP_URL) throw new Error("PUBLIC_APP_URL must point to the app's public URL.");

const dummyHash = await hashPassword("InvalidDummyPasswordForTimingOnly9182");
const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "x-frame-options": "DENY", "permissions-policy": "camera=(), microphone=(), geolocation=()" };

function reply(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { ...jsonHeaders, "content-length": Buffer.byteLength(body) });
  res.end(body);
}
function rateLimit(req, res, name, max = 12, windowMs = 15 * 60_000) {
  const ip = String(req.socket.remoteAddress || "unknown");
  const key = name + ":" + ip;
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.until) bucket = { count: 0, until: now + windowMs };
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (rateBuckets.size > 5000) for (const [k, v] of rateBuckets) if (now >= v.until) rateBuckets.delete(k);
  if (bucket.count > max) {
    reply(res, 429, { error: "rate-limit", message: "Too many attempts. Try again later." });
    return false;
  }
  return true;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > BODY_LIMIT) { reject(Object.assign(new Error("body-too-large"), { status: 413 })); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        if (!chunks.length) return resolve({});
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid-json");
        resolve(parsed);
      } catch { reject(Object.assign(new Error("invalid-json"), { status: 400 })); }
    });
    req.on("error", reject);
  });
}
function validateLabel(value, max = 100) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new Error("invalid-input");
  return value.trim();
}
function authToken(req) {
  const raw = req.headers.authorization || "";
  return raw.startsWith("Bearer ") ? raw.slice(7) : "";
}
async function requireUser(req) {
  const token = verifyToken(authToken(req), JWT_SECRET);
  if (!token || !token.sub || !token.sid) throw Object.assign(new Error("unauthorized"), { status: 401 });
  const result = await pool.query(
    "SELECT s.id, s.user_id, s.expires_at, s.revoked_at, u.email, u.display_name, u.mfa_enabled, u.email_verified_at FROM n01_sessions s JOIN n01_users u ON u.id=s.user_id WHERE s.id=$1 AND s.user_id=$2 AND s.revoked_at IS NULL AND s.expires_at>NOW()",
    [token.sid, token.sub]
  );
  if (!result.rowCount) throw Object.assign(new Error("session-expired"), { status: 401 });
  if (!result.rows[0].email_verified_at) throw Object.assign(new Error("email-not-verified"), { status: 403 });
  return result.rows[0];
}
async function createSession(user, res) {
  const id = randomUUID();
  await pool.query("INSERT INTO n01_sessions(id,user_id,expires_at) VALUES($1,$2,NOW()+($3::text || ' minutes')::interval)", [id, user.id, SESSION_MINUTES]);
  const token = signToken({ sub: user.id, sid: id }, JWT_SECRET, SESSION_MINUTES * 60);
  return { accessToken: token, tokenType: "Bearer", expiresIn: SESSION_MINUTES * 60, user: { id: user.id, email: user.email, displayName: user.display_name, mfaEnabled: user.mfa_enabled } };
}
async function sendEmail(to, subject, html) {
  if (!RESET_MAIL_API_KEY || !MAIL_FROM) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESET_MAIL_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html })
  });
  if (!response.ok) throw new Error("email-provider-failed");
  return true;
}
async function createMailToken(user, table, ttlHours, urlParam, subject, intro) {
  const token = randomToken(32);
  await pool.query("INSERT INTO " + table + "(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+($3::text || ' hours')::interval)", [user.id, hashToken(token), ttlHours]);
  const url = PUBLIC_APP_URL + "/?" + urlParam + "=" + encodeURIComponent(token);
  const html = '<p>' + intro + '</p><p><a href="' + url + '">Open Project N-01</a></p><p>Deze link is tijdelijk en eenmalig te gebruiken. If you did not request this, ignore this email.</p>';
  try {
    const delivered = await sendEmail(user.email, subject, html);
    if (!delivered) {
      // Keep the token only as a hash; without mail configuration it cannot be recovered.
      await pool.query("DELETE FROM " + table + " WHERE token_hash=$1", [hashToken(token)]);
      return false;
    }
    return true;
  } catch {
    await pool.query("DELETE FROM " + table + " WHERE token_hash=$1", [hashToken(token)]);
    return false;
  }
}
async function householdRole(householdId, userId) {
  const result = await pool.query("SELECT role FROM n01_household_members WHERE household_id=$1 AND user_id=$2", [householdId, userId]);
  return result.rows[0]?.role || "";
}
function requireRole(role, allowed) {
  if (!allowed.includes(role)) throw Object.assign(new Error("forbidden"), { status: 403 });
}
async function runRoute(req, res, url) {
  const path = url.pathname;
  const method = req.method || "GET";
  if (method === "OPTIONS") { const origin=req.headers.origin;res.writeHead(204, { "access-control-allow-origin": origin&&ALLOWED_ORIGINS.includes(origin)?origin:APP_ORIGIN, "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "access-control-allow-headers": "Content-Type, Authorization, If-Match", "access-control-max-age": "600", "vary": "Origin" }); return res.end(); }
  if (path === "/health" && method === "GET") {
    try { await pool.query("SELECT 1"); return reply(res, 200, { status: "ok", service: "project-n-01-cloud-api" }); }
    catch { return reply(res, 503, { status: "unavailable" }); }
  }
  if (path === "/v1/auth/register" && method === "POST") {
    if (!rateLimit(req, res, "register", 5)) return;
    const body = await readBody(req);
    let email, name, password;
    try { email = normalizeEmail(body.email); name = validateLabel(body.displayName, 80); password = body.password; validatePassword(password); }
    catch (err) { return reply(res, 400, { error: err.message === "password-policy" ? "password-policy" : "invalid-input", message: "Check the email, name and password requirements (14+ characters including lower-case, upper-case and a number)." }); }
    const passwordHash = await hashPassword(password);
    let inserted;
    try {
      inserted = await pool.query("INSERT INTO n01_users(email,display_name,password_hash) VALUES($1,$2,$3) RETURNING id,email,display_name,mfa_enabled", [email,name,passwordHash]);
    } catch (err) {
      if (err.code === "23505") return reply(res, 409, { error: "email-unavailable", message: "This address cannot be registered. Try signing in or use password recovery." });
      throw err;
    }
    const user = inserted.rows[0];
    const emailed = await createMailToken(user,"n01_email_verifications",24,"verifyEmail","Verify your Project N-01 account","Confirm your email address to activate the account.");
    return reply(res, 201, { verificationRequired: true, emailDeliveryConfigured: emailed, message: emailed ? "Check your email to verify the account." : "The account was created but mail delivery is not configured or failed; configure RESEND_API_KEY and MAIL_FROM before use." });
  }
  if (path === "/v1/auth/verify-email" && method === "POST") {
    if (!rateLimit(req, res, "verify-email", 10)) return;
    const body = await readBody(req);
    if (typeof body.token !== "string" || body.token.length > 200) return reply(res, 400, { error: "invalid-token" });
    const row = await pool.query("SELECT v.id,u.id AS user_id,u.email,u.display_name,u.mfa_enabled FROM n01_email_verifications v JOIN n01_users u ON u.id=v.user_id WHERE v.token_hash=$1 AND v.used_at IS NULL AND v.expires_at>NOW()", [hashToken(body.token)]);
    if (!row.rowCount) return reply(res, 400, { error: "invalid-or-expired-token" });
    const user = row.rows[0];
    await pool.query("BEGIN");
    try {
      await pool.query("UPDATE n01_email_verifications SET used_at=NOW() WHERE id=$1", [row.rows[0].id]);
      await pool.query("UPDATE n01_users SET email_verified_at=COALESCE(email_verified_at,NOW()),updated_at=NOW() WHERE id=$1", [user.user_id]);
      await pool.query("COMMIT");
    } catch(e) { await pool.query("ROLLBACK"); throw e; }
    return reply(res, 200, await createSession({ id:user.user_id,email:user.email,display_name:user.display_name,mfa_enabled:user.mfa_enabled },res));
  }
  if (path === "/v1/auth/resend-verification" && method === "POST") {
    if (!rateLimit(req, res, "resend-verification", 5)) return;
    const body = await readBody(req);
    try {
      const email = normalizeEmail(body.email);
      const found = await pool.query("SELECT id,email,display_name,mfa_enabled FROM n01_users WHERE email=$1 AND email_verified_at IS NULL", [email]);
      if (found.rowCount) await createMailToken(found.rows[0],"n01_email_verifications",24,"verifyEmail","Verify your Project N-01 account","Confirm your email address to activate the account.");
    } catch {}
    return reply(res, 200, { message: "If the account needs verification, a new link has been sent when email delivery is configured." });
  }
  if (path === "/v1/auth/login" && method === "POST") {
    if (!rateLimit(req, res, "login", 8)) return;
    const body = await readBody(req);
    let email;
    try { email = normalizeEmail(body.email); } catch { return reply(res, 401, { error: "invalid-credentials", message: "Email or password is incorrect." }); }
    const found = await pool.query("SELECT id,email,display_name,password_hash,mfa_enabled,mfa_secret_encrypted,email_verified_at FROM n01_users WHERE email=$1", [email]);
    const user = found.rows[0];
    const passOK = await verifyPassword(body.password, user?.password_hash || dummyHash);
    if (!user || !passOK) return reply(res, 401, { error: "invalid-credentials", message: "Email or password is incorrect." });
    if (!user.email_verified_at) return reply(res, 403, { error: "email-not-verified", message: "Verify your email address first." });
    if (user.mfa_enabled) {
      let valid = false;
      try { valid = verifyTotp(decryptMfaSecret(user.mfa_secret_encrypted, JWT_SECRET), body.totp); } catch {}
      if (!valid) return reply(res, 401, { error: "mfa-required-or-invalid", message: "Enter the current six-digit code from your authenticator app." });
    }
    return reply(res, 200, await createSession(user,res));
  }
  if (path === "/v1/auth/forgot-password" && method === "POST") {
    if (!rateLimit(req, res, "forgot-password", 5)) return;
    const body = await readBody(req);
    try {
      const email = normalizeEmail(body.email);
      const found = await pool.query("SELECT id,email,display_name FROM n01_users WHERE email=$1 AND email_verified_at IS NOT NULL", [email]);
      if (found.rowCount) await createMailToken(found.rows[0],"n01_password_resets",1,"resetPassword","Reset your Project N-01 password","A password reset was requested for your account.");
    } catch {}
    return reply(res, 200, { message: "If an eligible account exists, a reset link will be sent when mail delivery is configured." });
  }
  if (path === "/v1/auth/reset-password" && method === "POST") {
    if (!rateLimit(req, res, "reset-password", 8)) return;
    const body = await readBody(req);
    let newHash;
    try { newHash = await hashPassword(body.password); } catch { return reply(res, 400, { error: "password-policy", message: "Use at least 14 characters with lower-case, upper-case and a number." }); }
    if (typeof body.token !== "string" || body.token.length > 200) return reply(res, 400, { error: "invalid-or-expired-token" });
    const found = await pool.query("SELECT id,user_id FROM n01_password_resets WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW()", [hashToken(body.token)]);
    if (!found.rowCount) return reply(res, 400, { error: "invalid-or-expired-token", message: "The link is invalid or has expired." });
    await pool.query("BEGIN");
    try {
      await pool.query("UPDATE n01_password_resets SET used_at=NOW() WHERE id=$1", [found.rows[0].id]);
      await pool.query("UPDATE n01_users SET password_hash=$1,updated_at=NOW() WHERE id=$2", [newHash,found.rows[0].user_id]);
      await pool.query("UPDATE n01_sessions SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL", [found.rows[0].user_id]);
      await pool.query("DELETE FROM n01_password_resets WHERE user_id=$1 AND id<>$2", [found.rows[0].user_id,found.rows[0].id]);
      await pool.query("COMMIT");
    } catch(e) { await pool.query("ROLLBACK"); throw e; }
    return reply(res, 200, { message: "Password changed. Sign in again on each device." });
  }
  if (path === "/v1/auth/logout" && method === "POST") {
    const user = await requireUser(req);
    await pool.query("UPDATE n01_sessions SET revoked_at=NOW() WHERE id=$1", [user.id]);
    return reply(res, 200, { success: true });
  }
  const user = await requireUser(req);
  if (path === "/v1/account" && method === "GET") return reply(res, 200, { user: { id:user.user_id,email:user.email,displayName:user.display_name,mfaEnabled:user.mfa_enabled } });
  if (path === "/v1/account" && method === "PATCH") {
    const body = await readBody(req);
    const name = validateLabel(body.displayName,80);
    const updated = await pool.query("UPDATE n01_users SET display_name=$1,updated_at=NOW() WHERE id=$2 RETURNING id,email,display_name,mfa_enabled", [name,user.user_id]);
    return reply(res, 200, { user: { id:updated.rows[0].id,email:updated.rows[0].email,displayName:updated.rows[0].display_name,mfaEnabled:updated.rows[0].mfa_enabled } });
  }
  if (path === "/v1/account" && method === "DELETE") {
    if(!rateLimit(req,res,"delete-account",5))return;
    const body=await readBody(req);
    if(body.confirmation!=="DELETE")return reply(res,400,{error:"confirmation-required",message:"Type DELETE to confirm account deletion."});
    const found=await pool.query("SELECT password_hash,mfa_enabled,mfa_secret_encrypted FROM n01_users WHERE id=$1",[user.user_id]);
    if(!found.rowCount||!(await verifyPassword(body.password,found.rows[0].password_hash)))return reply(res,401,{error:"invalid-credentials",message:"Password is incorrect."});
    if(found.rows[0].mfa_enabled){let valid=false;try{valid=verifyTotp(decryptMfaSecret(found.rows[0].mfa_secret_encrypted,JWT_SECRET),body.totp);}catch{}if(!valid)return reply(res,401,{error:"mfa-required-or-invalid",message:"Enter the current authenticator code."});}
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      await client.query("DELETE FROM n01_household_invites WHERE created_by=$1",[user.user_id]);
      await client.query("DELETE FROM n01_households WHERE created_by=$1",[user.user_id]);
      await client.query("DELETE FROM n01_users WHERE id=$1",[user.user_id]);
      await client.query("COMMIT");
    }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
    return reply(res,200,{deleted:true,message:"Account and encrypted cloud data deleted. Local device data and downloaded exports must be cleared separately."});
  }
  if (path === "/v1/auth/mfa/setup" && method === "POST") {
    if (!rateLimit(req,res,"mfa-setup",5)) return;
    const secret = newTotpSecret();
    const encrypted = encryptMfaSecret(secret,JWT_SECRET);
    await pool.query("UPDATE n01_users SET mfa_pending_secret_encrypted=$1 WHERE id=$2",[encrypted,user.user_id]);
    return reply(res,200,{ secret, otpauthUri:totpUri(secret,user.email), instructions:"Add this account to an authenticator app, then verify it with the current six-digit code. This secret is shown only during setup." });
  }
  if (path === "/v1/auth/mfa/enable" && method === "POST") {
    if (!rateLimit(req,res,"mfa-enable",8)) return;
    const body=await readBody(req);
    const q=await pool.query("SELECT mfa_pending_secret_encrypted FROM n01_users WHERE id=$1",[user.user_id]);
    if(!q.rows[0]?.mfa_pending_secret_encrypted)return reply(res,400,{error:"mfa-setup-not-started"});
    const secret=decryptMfaSecret(q.rows[0].mfa_pending_secret_encrypted,JWT_SECRET);
    if(!verifyTotp(secret,body.totp))return reply(res,400,{error:"invalid-totp",message:"Code did not match."});
    await pool.query("UPDATE n01_users SET mfa_secret_encrypted=$1,mfa_pending_secret_encrypted=NULL,mfa_enabled=TRUE,updated_at=NOW() WHERE id=$2",[q.rows[0].mfa_pending_secret_encrypted,user.user_id]);
    return reply(res,200,{success:true,mfaEnabled:true});
  }
  if (path === "/v1/auth/mfa/disable" && method === "POST") {
    if (!rateLimit(req,res,"mfa-disable",8)) return;
    const body=await readBody(req);
    const q=await pool.query("SELECT mfa_secret_encrypted,mfa_enabled FROM n01_users WHERE id=$1",[user.user_id]);
    let valid=false; try{valid=q.rows[0].mfa_enabled&&verifyTotp(decryptMfaSecret(q.rows[0].mfa_secret_encrypted,JWT_SECRET),body.totp);}catch{}
    if(!valid)return reply(res,401,{error:"invalid-totp"});
    await pool.query("UPDATE n01_users SET mfa_secret_encrypted=NULL,mfa_enabled=FALSE,updated_at=NOW() WHERE id=$1",[user.user_id]);
    return reply(res,200,{success:true,mfaEnabled:false});
  }
  if (path === "/v1/sync/vault" && method === "GET") {
    const result=await pool.query("SELECT version,envelope,updated_at FROM n01_vaults WHERE user_id=$1",[user.user_id]);
    if(!result.rowCount)return reply(res,200,{version:0,envelope:null,updatedAt:null});
    return reply(res,200,{version:Number(result.rows[0].version),envelope:result.rows[0].envelope,updatedAt:result.rows[0].updated_at});
  }
  if (path === "/v1/sync/vault" && method === "PUT") {
    const body=await readBody(req);
    if(!validateEncryptedEnvelope(body.envelope))return reply(res,400,{error:"invalid-encrypted-envelope",message:"Only supported AES-256-GCM client-encrypted vaults are accepted."});
    const baseVersion=Number(body.baseVersion);
    if(!Number.isSafeInteger(baseVersion)||baseVersion<0)return reply(res,400,{error:"invalid-base-version"});
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      const found=await client.query("SELECT version,envelope,updated_at FROM n01_vaults WHERE user_id=$1 FOR UPDATE",[user.user_id]);
      const current=found.rowCount?Number(found.rows[0].version):0;
      if(current!==baseVersion){
        await client.query("ROLLBACK");
        return reply(res,409,{error:"sync-conflict",currentVersion:current,updatedAt:found.rows[0]?.updated_at||null,currentEnvelope:found.rows[0]?.envelope||null,message:"The cloud copy changed on another device. Review the versions before choosing a copy."});
      }
      const next=current+1;
      if(found.rowCount){
        await client.query("INSERT INTO n01_vault_revisions(user_id,version,envelope) VALUES($1,$2,$3::jsonb)",[user.user_id,current,JSON.stringify(found.rows[0].envelope)]);
        await client.query("UPDATE n01_vaults SET version=$1,envelope=$2::jsonb,updated_at=NOW() WHERE user_id=$3",[next,JSON.stringify(body.envelope),user.user_id]);
      } else {
        await client.query("INSERT INTO n01_vaults(user_id,version,envelope) VALUES($1,$2,$3::jsonb)",[user.user_id,next,JSON.stringify(body.envelope)]);
      }
      await client.query("DELETE FROM n01_vault_revisions WHERE user_id=$1 AND version < $2",[user.user_id,Math.max(1,next-20)]);
      await client.query("COMMIT");
      return reply(res,200,{version:next,updatedAt:new Date().toISOString()});
    } catch(e){try{await client.query("ROLLBACK");}catch{};throw e;} finally{client.release();}
  }
  if (path === "/v1/sync/revisions" && method === "GET") {
    const result=await pool.query("SELECT version,created_at FROM n01_vault_revisions WHERE user_id=$1 ORDER BY version DESC LIMIT 20",[user.user_id]);
    return reply(res,200,{revisions:result.rows.map(x=>({version:Number(x.version),createdAt:x.created_at}))});
  }
  const revisionMatch=path.match(/^\/v1\/sync\/revisions\/(\d+)$/);
  if(revisionMatch&&method==="GET"){
    const version=Number(revisionMatch[1]);
    const result=await pool.query("SELECT version,envelope,created_at FROM n01_vault_revisions WHERE user_id=$1 AND version=$2",[user.user_id,version]);
    if(!result.rowCount)return reply(res,404,{error:"revision-not-found"});
    return reply(res,200,{version:Number(result.rows[0].version),envelope:result.rows[0].envelope,createdAt:result.rows[0].created_at});
  }
  if(path==="/v1/households"&&method==="POST"){
    const body=await readBody(req);const name=validateLabel(body.name,80);
    const result=await pool.query("INSERT INTO n01_households(name,created_by) VALUES($1,$2) RETURNING id,name,created_at",[name,user.user_id]);
    await pool.query("INSERT INTO n01_household_members(household_id,user_id,role) VALUES($1,$2,'owner')",[result.rows[0].id,user.user_id]);
    return reply(res,201,{household:result.rows[0]});
  }
  if(path==="/v1/households"&&method==="GET"){
    const result=await pool.query("SELECT h.id,h.name,m.role,m.joined_at FROM n01_households h JOIN n01_household_members m ON m.household_id=h.id WHERE m.user_id=$1 ORDER BY h.created_at DESC",[user.user_id]);
    return reply(res,200,{households:result.rows});
  }
  const membersMatch=path.match(/^\/v1\/households\/([0-9a-f-]+)\/members$/i);
  if(membersMatch&&method==="GET"){
    const role=await householdRole(membersMatch[1],user.user_id);if(!role)return reply(res,404,{error:"household-not-found"});
    const result=await pool.query("SELECT u.id,u.display_name,m.role,m.joined_at FROM n01_household_members m JOIN n01_users u ON u.id=m.user_id WHERE m.household_id=$1 ORDER BY m.joined_at",[membersMatch[1]]);
    return reply(res,200,{members:result.rows});
  }
  const inviteMatch=path.match(/^\/v1\/households\/([0-9a-f-]+)\/invitations$/i);
  if(inviteMatch&&method==="POST"){
    if(!rateLimit(req,res,"household-invite",10))return;
    const body=await readBody(req);const role=String(body.role||"caregiver");
    if(!["user","parent","guardian","caregiver"].includes(role))return reply(res,400,{error:"invalid-role"});
    const email=normalizeEmail(body.email);const membership=await householdRole(inviteMatch[1],user.user_id);
    requireRole(membership,["owner","parent","guardian"]);
    const household=await pool.query("SELECT id,name FROM n01_households WHERE id=$1",[inviteMatch[1]]);
    if(!household.rowCount)return reply(res,404,{error:"household-not-found"});
    const token=randomToken(32);
    await pool.query("INSERT INTO n01_household_invites(household_id,invited_email,role,token_hash,expires_at,created_by) VALUES($1,$2,$3,$4,NOW()+INTERVAL '72 hours',$5)",[inviteMatch[1],email,role,hashToken(token),user.user_id]);
    const inviteUrl=PUBLIC_APP_URL+"/?acceptInvite="+encodeURIComponent(token);
    let delivered=false;
    try{delivered=await sendEmail(email,"Project N-01 invitation",'<p>You have been invited to join '+household.rows[0].name.replace(/[&<>"]/g,"")+'.</p><p><a href="'+inviteUrl+'">Review invitation</a></p><p>This invitation expires after 72 hours.</p>');}catch{}
    if(!delivered){await pool.query("DELETE FROM n01_household_invites WHERE token_hash=$1",[hashToken(token)]);return reply(res,503,{error:"email-delivery-unavailable",message:"Invitation was not created because secure email delivery is not configured."});}
    return reply(res,201,{sent:true,expiresInHours:72});
  }
  if(path==="/v1/household-invitations/accept"&&method==="POST"){
    const body=await readBody(req);if(typeof body.token!=="string")return reply(res,400,{error:"invalid-token"});
    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      const found=await client.query("SELECT i.*,u.email FROM n01_household_invites i JOIN n01_users u ON u.id=$2 WHERE i.token_hash=$1 AND i.accepted_by IS NULL AND i.expires_at>NOW() FOR UPDATE",[hashToken(body.token),user.user_id]);
      if(!found.rowCount){await client.query("ROLLBACK");return reply(res,400,{error:"invalid-or-expired-invitation"});}
      if(found.rows[0].invited_email!==user.email){await client.query("ROLLBACK");return reply(res,403,{error:"invitation-email-mismatch"});}
      const inv=found.rows[0];
      await client.query("INSERT INTO n01_household_members(household_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[inv.household_id,user.user_id,inv.role]);
      await client.query("UPDATE n01_household_invites SET accepted_by=$1 WHERE id=$2",[user.user_id,inv.id]);
      await client.query("COMMIT");return reply(res,200,{accepted:true,householdId:inv.household_id,role:inv.role});
    }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
  }
  const consentsMatch=path.match(/^\/v1\/households\/([0-9a-f-]+)\/consents$/i);
  if(consentsMatch&&method==="GET"){
    const membership=await householdRole(consentsMatch[1],user.user_id);if(!membership)return reply(res,404,{error:"household-not-found"});
    const rows=await pool.query("SELECT c.id,c.owner_user_id,c.viewer_user_id,c.scopes,c.edit_scopes,c.created_at,c.revoked_at,owner.display_name AS owner_name,viewer.display_name AS viewer_name FROM n01_consents c JOIN n01_users owner ON owner.id=c.owner_user_id JOIN n01_users viewer ON viewer.id=c.viewer_user_id WHERE c.household_id=$1 AND (c.owner_user_id=$2 OR c.viewer_user_id=$2) ORDER BY c.created_at DESC",[consentsMatch[1],user.user_id]);
    return reply(res,200,{consents:rows.rows});
  }
  if(consentsMatch&&method==="POST"){
    const body=await readBody(req);const viewerId=String(body.viewerUserId||"");
    const scopes=Array.isArray(body.scopes)?[...new Set(body.scopes.filter(x=>["calendar","roster","routine","progress","goals","documents","mood","journal","guides","emergency"].includes(x)))]:[];
    const editScopes=Array.isArray(body.editScopes)?[...new Set(body.editScopes.filter(x=>scopes.includes(x)))]:[];
    if(!viewerId||viewerId===user.user_id||!scopes.length)return reply(res,400,{error:"invalid-consent"});
    const householdId=consentsMatch[1];
    const members=await pool.query("SELECT user_id FROM n01_household_members WHERE household_id=$1 AND user_id=ANY($2::uuid[])",[householdId,[user.user_id,viewerId]]);
    if(members.rowCount!==2)return reply(res,403,{error:"both-users-must-be-members"});
    const existing=await pool.query("SELECT id FROM n01_consents WHERE household_id=$1 AND owner_user_id=$2 AND viewer_user_id=$3 AND revoked_at IS NULL",[householdId,user.user_id,viewerId]);
    let result;
    if(existing.rowCount)result=await pool.query("UPDATE n01_consents SET scopes=$1::jsonb,edit_scopes=$2::jsonb,created_at=NOW() WHERE id=$3 RETURNING id,created_at",[JSON.stringify(scopes),JSON.stringify(editScopes),existing.rows[0].id]);
    else result=await pool.query("INSERT INTO n01_consents(household_id,owner_user_id,viewer_user_id,scopes,edit_scopes) VALUES($1,$2,$3,$4::jsonb,$5::jsonb) RETURNING id,created_at",[householdId,user.user_id,viewerId,JSON.stringify(scopes),JSON.stringify(editScopes)]);
    return reply(res,201,{consent:result.rows[0],scopes,editScopes});
  }
  const revokeMatch=path.match(/^\/v1\/households\/([0-9a-f-]+)\/consents\/([0-9a-f-]+)$/i);
  if(revokeMatch&&method==="DELETE"){
    const result=await pool.query("UPDATE n01_consents SET revoked_at=NOW() WHERE id=$1 AND household_id=$2 AND owner_user_id=$3 AND revoked_at IS NULL",[revokeMatch[2],revokeMatch[1],user.user_id]);
    return reply(res,result.rowCount?200:404,{revoked:result.rowCount===1});
  }
  return reply(res,404,{error:"not-found"});
}
const server = http.createServer(async (req,res)=>{
  res.setHeader("x-content-type-options","nosniff");
  const origin=req.headers.origin;
  if(origin&&ALLOWED_ORIGINS.includes(origin)){
    res.setHeader("access-control-allow-origin",origin);
    res.setHeader("vary","Origin");
  }else if(origin){
    return reply(res,403,{error:"origin-not-allowed"});
  }
  try {
    const url=new URL(req.url||"/","http://localhost");
    await runRoute(req,res,url);
  } catch(error) {
    const status=Number(error?.status)||500;
    if(status>=500) process.stderr.write("[api] request failed: "+String(error?.message||"unknown-error")+"\n");
    if(!res.headersSent) reply(res,status,{error:status===500?"server-error":String(error.message||"request-error"),message:status>=500?"The request could not be completed.":undefined});
    else res.end();
  }
});
server.listen(PORT,HOST,()=>process.stdout.write("Project N-01 Cloud API listening on "+HOST+":"+PORT+"\n"));
for (const signal of ["SIGINT","SIGTERM"]) process.on(signal,()=>server.close(async()=>{await pool.end();process.exit(0);}));
