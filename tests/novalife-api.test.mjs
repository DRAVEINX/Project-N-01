import test from "node:test";
import assert from "node:assert/strict";
import { createNovaLifeServer } from "../server/api.mjs";

test("NovaLife API health endpoint and bootstrap protection", async t => {
  const server=createNovaLifeServer({dbPath:":memory:",bootstrapToken:"example-bootstrap-key",dataKey:Buffer.alloc(32,9),secureCookies:false});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
  const base="http://127.0.0.1:"+server.address().port;
  const health=await fetch(base+"/api/health");
  assert.equal(health.status,200);
  assert.equal((await health.json()).status,"ok");
  const denied=await fetch(base+"/api/bootstrap",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:"admin@example.com",name:"Developer",password:"sample-password-long-123"})});
  assert.equal(denied.status,403);
  const created=await fetch(base+"/api/bootstrap",{method:"POST",headers:{"content-type":"application/json","x-bootstrap-token":"example-bootstrap-key"},body:JSON.stringify({email:"admin@example.com",name:"Developer",password:"sample-password-long-123"})});
  assert.equal(created.status,201);
  const second=await fetch(base+"/api/bootstrap",{method:"POST",headers:{"content-type":"application/json","x-bootstrap-token":"example-bootstrap-key"},body:JSON.stringify({email:"other@example.com",name:"Other",password:"sample-password-long-123"})});
  assert.equal(second.status,409);
});
