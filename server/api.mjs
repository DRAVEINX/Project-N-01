import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, createHash, scryptSync, timingSafeEqual, createCipheriv, createDecipheriv } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const stamp=()=>new Date().toISOString();
const uid=p=>p+"_"+randomBytes(16).toString("hex");
const sha=s=>createHash("sha256").update(s).digest("hex");
const roles=new Set(["client","caregiver","parent","guardian"]);
const moods=new Set(["green","orange","red"]);
const clean=(v,n=2000)=>typeof v==="string"?v.trim().slice(0,n):"";
const same=(a,b)=>{a=Buffer.from(String(a));b=Buffer.from(String(b));return a.length===b.length&&timingSafeEqual(a,b);};
function passHash(password,salt=randomBytes(16).toString("hex")){return {salt,hash:scryptSync(password,salt,64).toString("hex")};}
function passOK(password,salt,expected){const a=scryptSync(password,salt,64),b=Buffer.from(expected,"hex");return a.length===b.length&&timingSafeEqual(a,b);}
function encrypt(value,key){const iv=randomBytes(12),c=createCipheriv("aes-256-gcm",key,iv),data=Buffer.concat([c.update(JSON.stringify(value)),c.final()]);return JSON.stringify({iv:iv.toString("base64"),tag:c.getAuthTag().toString("base64"),data:data.toString("base64")});}
function decrypt(value,key){const e=JSON.parse(value),d=createDecipheriv("aes-256-gcm",key,Buffer.from(e.iv,"base64"));d.setAuthTag(Buffer.from(e.tag,"base64"));return JSON.parse(Buffer.concat([d.update(Buffer.from(e.data,"base64")),d.final()]).toString());}
function send(res,status,value,headers={}){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer",...headers});res.end(JSON.stringify(value));}
function cookie(token,secure){return "novalife_session="+token+"; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200"+(secure?"; Secure":"");}
function tokenFrom(req){const c=(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("novalife_session="));return c?decodeURIComponent(c.slice(17)):(req.headers.authorization||"").replace(/^Bearer\s+/i,"");}
async function readBody(req){const parts=[];let n=0;for await(const p of req){n+=p.length;if(n>262144)throw Object.assign(new Error("body_too_large"),{status:413});parts.push(p);}if(!n)return {};try{return JSON.parse(Buffer.concat(parts).toString("utf8"));}catch{throw Object.assign(new Error("invalid_json"),{status:400});}}

export function createNovaLifeServer(opts={}){
  const path=opts.dbPath||process.env.NOVALIFE_DB_PATH||"./data/novalife.sqlite";
  const bootstrap=opts.bootstrapToken??process.env.NOVALIFE_BOOTSTRAP_TOKEN??"";
  const encoded=opts.dataKey??process.env.NOVALIFE_DATA_KEY??"";
  const key=Buffer.isBuffer(encoded)?encoded:Buffer.from(encoded,"base64");
  if(key.length!==32)throw new Error("NOVALIFE_DATA_KEY must be a base64-encoded 32-byte key");
  if(path!==":memory:")mkdirSync(dirname(resolve(path)),{recursive:true});
  const db=new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('developer_admin','client','caregiver','parent','guardian')),salt TEXT NOT NULL,password_hash TEXT NOT NULL,created_at TEXT NOT NULL,disabled INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS invites(token_hash TEXT PRIMARY KEY,role TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL,used_at TEXT);
    CREATE TABLE IF NOT EXISTS assignments(caregiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,client_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at TEXT NOT NULL,PRIMARY KEY(caregiver_id,client_id));
    CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,client_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,actor_id TEXT,action TEXT NOT NULL,target_id TEXT,details TEXT NOT NULL,at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_records_owner ON records(client_id,kind,created_at);
  `);
  const audit=(u,action,target="",details="")=>db.prepare("INSERT INTO audit VALUES(?,?,?,?,?,?)").run(uid("aud"),u?.id||null,action,target||null,clean(details,300),stamp());
  const userRow=id=>db.prepare("SELECT * FROM users WHERE id=? AND disabled=0").get(id);
  const publicUser=u=>({id:u.id,email:u.email,name:u.name,role:u.role,createdAt:u.created_at});
  const auth=req=>{const token=tokenFrom(req);if(!token)return null;const s=db.prepare("SELECT * FROM sessions WHERE token_hash=?").get(sha(token));if(!s||s.expires_at<=stamp()){if(s)db.prepare("DELETE FROM sessions WHERE token_hash=?").run(sha(token));return null;}return userRow(s.user_id)||null;};
  const assigned=(caregiver,client)=>!!db.prepare("SELECT 1 FROM assignments WHERE caregiver_id=? AND client_id=?").get(caregiver,client);
  const canSee=(u,client)=>!!u&&(u.role==="developer_admin"||(u.role==="client"&&u.id===client)||(["caregiver","parent","guardian"].includes(u.role)&&assigned(u.id,client)));
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url||"/","http://localhost"),path=url.pathname;
    if(!path.startsWith("/api/"))return send(res,404,{error:"not_found"});
    try{
      if(req.method==="GET"&&path==="/api/health")return send(res,200,{status:"ok",service:"NovaLife API"});
      if(req.method==="POST"&&path==="/api/bootstrap"){
        if(!bootstrap||!same(req.headers["x-bootstrap-token"]||"",bootstrap))return send(res,403,{error:"bootstrap_forbidden"});
        if(db.prepare("SELECT count(*) n FROM users").get().n)return send(res,409,{error:"bootstrap_used"});
        const b=await readBody(req),email=clean(b.email,254).toLowerCase(),name=clean(b.name,100),password=typeof b.password==="string"?b.password:"";
        if(!/^\S+@\S+\.\S+$/.test(email)||!name||password.length<14)return send(res,400,{error:"invalid_account"});
        const p=passHash(password),u={id:uid("usr"),email,name,role:"developer_admin",salt:p.salt,password_hash:p.hash,created_at:stamp()};
        db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?,?,0)").run(u.id,u.email,u.name,u.role,u.salt,u.password_hash,u.created_at);audit(u,"bootstrap_admin_created",u.id);
        return send(res,201,{user:publicUser(u)});
      }
      if(req.method==="POST"&&path==="/api/auth/register"){
        const b=await readBody(req),token=clean(b.invitationToken,200),inv=db.prepare("SELECT * FROM invites WHERE token_hash=? AND used_at IS NULL AND expires_at>?").get(sha(token),stamp());
        if(!inv)return send(res,403,{error:"invalid_invitation"});
        const email=clean(b.email,254).toLowerCase(),name=clean(b.name,100),password=typeof b.password==="string"?b.password:"";
        if(!/^\S+@\S+\.\S+$/.test(email)||!name||password.length<14)return send(res,400,{error:"invalid_account"});
        const p=passHash(password),u={id:uid("usr"),email,name,role:inv.role,salt:p.salt,password_hash:p.hash,created_at:stamp()};
        try{db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?,?,0)").run(u.id,u.email,u.name,u.role,u.salt,u.password_hash,u.created_at);db.prepare("UPDATE invites SET used_at=? WHERE token_hash=?").run(stamp(),sha(token));}
        catch(e){if(String(e.message).includes("UNIQUE"))return send(res,409,{error:"email_exists"});throw e;}
        audit(u,"account_registered",u.id,u.role);return send(res,201,{user:publicUser(u)});
      }
      if(req.method==="POST"&&path==="/api/auth/login"){
        const b=await readBody(req),email=clean(b.email,254).toLowerCase(),password=typeof b.password==="string"?b.password:"",u=db.prepare("SELECT * FROM users WHERE email=?").get(email);
        const valid=u?passOK(password,u.salt,u.password_hash):passOK(password,"novalife-fake-salt",passHash("not-a-real-password","novalife-fake-salt").hash);
        if(!u||!valid||u.disabled){audit(u||null,"login_failed",u?.id||"");return send(res,401,{error:"invalid_credentials"});}
        const token=randomBytes(32).toString("base64url"),expires=new Date(Date.now()+12*60*60*1000).toISOString();
        db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(sha(token),u.id,expires);audit(u,"login_success",u.id);
        return send(res,200,{user:publicUser(u),token,expiresAt:expires},{"set-cookie":cookie(token,opts.secureCookies!==false)});
      }
      const u=auth(req);
      if(req.method==="POST"&&path==="/api/auth/logout"){
        const token=tokenFrom(req);if(token)db.prepare("DELETE FROM sessions WHERE token_hash=?").run(sha(token));if(u)audit(u,"logout",u.id);
        return send(res,200,{ok:true},{"set-cookie":"novalife_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"+(opts.secureCookies===false?"":"; Secure")});
      }
      if(!u)return send(res,401,{error:"authentication_required"});
      if(req.method==="GET"&&path==="/api/me")return send(res,200,{user:publicUser(u)});
      if(req.method==="POST"&&path==="/api/invitations"){
        if(u.role!=="developer_admin")return send(res,403,{error:"admin_required"});
        const b=await readBody(req),role=clean(b.role,30);if(!roles.has(role))return send(res,400,{error:"invalid_role"});
        const token=randomBytes(32).toString("base64url"),expires=new Date(Date.now()+48*60*60*1000).toISOString();
        db.prepare("INSERT INTO invites VALUES(?,?,?,?,NULL)").run(sha(token),role,u.id,expires);audit(u,"invitation_created","",role);
        return send(res,201,{invitationToken:token,role,expiresAt:expires});
      }
      if(req.method==="POST"&&path==="/api/assignments"){
        if(u.role!=="developer_admin")return send(res,403,{error:"admin_required"});
        const b=await readBody(req),client=userRow(clean(b.clientId,100)),caregiver=userRow(clean(b.caregiverId,100));
        if(!client||client.role!=="client"||!caregiver||!["caregiver","parent","guardian"].includes(caregiver.role))return send(res,400,{error:"invalid_assignment"});
        db.prepare("INSERT OR IGNORE INTO assignments VALUES(?,?,?)").run(caregiver.id,client.id,stamp());audit(u,"client_assigned",client.id,caregiver.id);
        return send(res,201,{clientId:client.id,caregiverId:caregiver.id});
      }
      if(req.method==="GET"&&path==="/api/clients"){
        if(u.role==="developer_admin")return send(res,200,{clients:db.prepare("SELECT * FROM users WHERE role='client' AND disabled=0 ORDER BY name").all().map(publicUser)});
        if(["caregiver","parent","guardian"].includes(u.role))return send(res,200,{clients:db.prepare("SELECT users.* FROM users JOIN assignments ON assignments.client_id=users.id WHERE assignments.caregiver_id=? AND users.disabled=0 ORDER BY users.name").all(u.id).map(publicUser)});
        return send(res,200,{clients:u.role==="client"?[publicUser(u)]:[]});
      }
      const mood=path.match(/^\/api\/clients\/([^/]+)\/mood$/);
      if(mood&&["GET","POST"].includes(req.method)){
        const client=decodeURIComponent(mood[1]);if(!canSee(u,client))return send(res,403,{error:"client_access_denied"});
        if(req.method==="POST"){
          if(u.id!==client&&!["developer_admin","caregiver","parent","guardian"].includes(u.role))return send(res,403,{error:"mood_write_denied"});
          if(u.id!==client&&u.role!=="developer_admin"&&!assigned(u.id,client))return send(res,403,{error:"client_access_denied"});
          const b=await readBody(req);if(!moods.has(b.trafficLight))return send(res,400,{error:"invalid_mood"});
          const report={id:uid("mood"),trafficLight:b.trafficLight,note:clean(b.note,1000),createdAt:stamp(),reportedBy:u.id};
          db.prepare("INSERT INTO records VALUES(?,?,?,?,?,?)").run(report.id,client,"mood",encrypt(report,key),report.createdAt,report.createdAt);audit(u,"mood_reported",client,report.trafficLight);
          return send(res,201,{report});
        }
        const rows=db.prepare("SELECT payload FROM records WHERE client_id=? AND kind='mood' ORDER BY created_at DESC LIMIT 100").all(client);
        return send(res,200,{reports:rows.map(r=>decrypt(r.payload,key))});
      }
      const records=path.match(/^\/api\/clients\/([^/]+)\/records$/);
      if(records&&["GET","POST"].includes(req.method)){
        const client=decodeURIComponent(records[1]);if(!canSee(u,client))return send(res,403,{error:"client_access_denied"});
        if(req.method==="GET"){
          const kind=clean(url.searchParams.get("kind"),60),rows=kind?db.prepare("SELECT * FROM records WHERE client_id=? AND kind=? ORDER BY updated_at DESC LIMIT 500").all(client,kind):db.prepare("SELECT * FROM records WHERE client_id=? ORDER BY updated_at DESC LIMIT 500").all(client);
          return send(res,200,{records:rows.map(r=>({id:r.id,clientId:client,kind:r.kind,data:decrypt(r.payload,key),createdAt:r.created_at,updatedAt:r.updated_at}))});
        }
        if(u.id!==client&&u.role!=="developer_admin"&&!(["caregiver","parent","guardian"].includes(u.role)&&assigned(u.id,client)))return send(res,403,{error:"record_write_denied"});
        const b=await readBody(req),kind=clean(b.kind,60);if(!/^[a-z][a-z0-9_-]{1,59}$/.test(kind)||!b.data||typeof b.data!=="object"||Array.isArray(b.data))return send(res,400,{error:"invalid_record"});
        const recordId=clean(b.id,100)||uid("rec"),old=db.prepare("SELECT created_at FROM records WHERE id=? AND client_id=?").get(recordId,client),t=stamp(),payload=encrypt(b.data,key);
        if(old)db.prepare("UPDATE records SET kind=?,payload=?,updated_at=? WHERE id=? AND client_id=?").run(kind,payload,t,recordId,client);else db.prepare("INSERT INTO records VALUES(?,?,?,?,?,?)").run(recordId,client,kind,payload,t,t);
        audit(u,old?"record_updated":"record_created",client,kind);return send(res,old?200:201,{id:recordId,clientId:client,kind,createdAt:old.created_at||t,updatedAt:t});
      }
      if(req.method==="GET"&&path==="/api/admin/users"){
        if(u.role!=="developer_admin")return send(res,403,{error:"admin_required"});
        return send(res,200,{users:db.prepare("SELECT * FROM users ORDER BY created_at DESC").all().map(x=>({...publicUser(x),disabled:!!x.disabled}))});
      }
      if(req.method==="GET"&&path==="/api/admin/audit"){
        if(u.role!=="developer_admin")return send(res,403,{error:"admin_required"});
        return send(res,200,{events:db.prepare("SELECT * FROM audit ORDER BY at DESC LIMIT 500").all()});
      }
      return send(res,404,{error:"not_found"});
    }catch(e){const status=Number.isInteger(e.status)?e.status:500;if(status>=500)console.error("[NovaLife API]",e.message);return send(res,status,{error:status===500?"internal_error":e.message});}
  });
  server.on("close",()=>db.close());return server;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  const server=createNovaLifeServer();const port=Number(process.env.PORT||8787);
  server.listen(port,"127.0.0.1",()=>console.log("NovaLife API listening on 127.0.0.1:"+port+"; use a TLS reverse proxy in production."));
}
