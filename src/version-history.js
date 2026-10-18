/* Stores only opaque client-encrypted envelopes; it never decrypts personal records. */
(function () {
  "use strict";
  const DB_NAME = "ProjectN01EncryptedHistory";
  const STORE = "versions";
  const MAX_VERSIONS = 20;
  function openDb() {
    return new Promise((resolve,reject)=>{
      if(!("indexedDB" in window))return reject(new Error("IndexedDB unavailable"));
      const request=indexedDB.open(DB_NAME,1);
      request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE)){const store=db.createObjectStore(STORE,{keyPath:"id",autoIncrement:true});store.createIndex("by-vault-time",["vaultKey","savedAt"]);}};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error("Could not open version history"));
    });
  }
  async function run(mode, operation) {
    const db=await openDb();
    try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode);const store=tx.objectStore(STORE);let result;try{result=operation(store);}catch(e){reject(e);return;}tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||new Error("Version history operation failed"));tx.onabort=()=>reject(tx.error||new Error("Version history operation aborted"));});}
    finally{db.close();}
  }
  async function getVersions(vaultKey) {
    const db=await openDb();
    try {
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,"readonly"),store=tx.objectStore(STORE),req=store.getAll();
        req.onsuccess=()=>resolve(req.result.filter(x=>x.vaultKey===vaultKey).sort((a,b)=>b.id-a.id).slice(0,MAX_VERSIONS).map(({id,savedAt,bytes})=>({id,savedAt,bytes})));
        req.onerror=()=>reject(req.error||new Error("Could not list versions"));
      });
    } finally {db.close();}
  }
  async function archive(vaultKey, raw) {
    if(typeof raw!=="string"||!raw)return null;
    const record={vaultKey,savedAt:new Date().toISOString(),bytes:new TextEncoder().encode(raw).length,raw};
    const id=await run("readwrite",store=>store.add(record));
    const all=await getVersions(vaultKey);
    if(all.length>MAX_VERSIONS){await run("readwrite",store=>all.slice(MAX_VERSIONS).forEach(x=>store.delete(x.id)));}
    return id;
  }
  async function get(vaultKey,id) {
    const db=await openDb();
    try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readonly"),req=tx.objectStore(STORE).get(Number(id));req.onsuccess=()=>resolve(req.result&&req.result.vaultKey===vaultKey?req.result:null);req.onerror=()=>reject(req.error||new Error("Could not restore version"));});}
    finally{db.close();}
  }
  async function clear(vaultKey) {
    const versions=await getVersions(vaultKey);
    await run("readwrite",store=>versions.forEach(x=>store.delete(x.id)));
  }
  window.ProjectN01VersionHistory=Object.freeze({list:getVersions,archive,get,clear});
})();