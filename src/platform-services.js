/* Platform services for Project N-01.
 * Browser-safe Supabase Auth/REST client. The browser key must be an anon/publishable
 * key only; never place a service-role key in this file or in the app.
 */
(() => {
  "use strict";
  const root = document.getElementById("platform-services-root");
  if (!root) return;

  const CONFIG_KEY = "project-n-01-cloud-config-v1";
  const SESSION_KEY = "project-n-01-cloud-session-v1";
  const VAULT_KEY = "project-n-01-secure-life-v1";
  const LAST_HASH_KEY = "project-n-01-cloud-last-hash-v1";
  const DEVICE_KEY = "project-n-01-device-id-v1";
  const $ = (selector) => root.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
  let config = readConfig();
  let session = readSession();
  let mode = "signin";
  let statusText = "";
  let isError = false;
  let busy = false;
  let enrolledFactor = null;
  let mfaPending = false;
  let mfaFactorId = "";
  let latestRemote = null;
  let careLinks = [];
  let lastSeenRemoteHash = "";
  let syncConflict = false;
  let inactivityTimer = null;
  let syncTimer = null;
  let secretCode = "";

  function readConfig() {
    try {
      const value = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
      return value && typeof value.url === "string" && typeof value.anonKey === "string" ? value : {url:"",anonKey:""};
    } catch { return {url:"",anonKey:""}; }
  }
  function readSession() {
    try {
      const value = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      return value && value.access_token && value.user ? value : null;
    } catch { return null; }
  }
  function saveSession(value) {
    session = value;
    try {
      if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {}
    armInactivityTimeout();
  }
  function configured() {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url) ||
      /^http:\/\/(localhost|127\.0\.0\.1):54321\/?$/i.test(config.url);
  }
  function baseUrl() { return config.url.replace(/\/+$/, ""); }
  function setStatus(message, error=false) { statusText=String(message||""); isError=error; render(); }
  async function api(path, options={}) {
    if (!configured() || !config.anonKey) throw new Error("Vul eerst een geldige Supabase-project-URL en anon/publishable key in.");
    const headers = {"apikey":config.anonKey,"Content-Type":"application/json"};
    const bearer = Object.prototype.hasOwnProperty.call(options,"token") ? options.token : session?.access_token;
    if (bearer) headers.Authorization = "Bearer " + bearer;
    if (mfaPending && path.startsWith("/rest/v1/")) throw new Error("Bevestig eerst de authenticatorcode om accountgegevens te openen.");
    if (options.prefer) headers.Prefer = options.prefer;
    const response = await fetch(baseUrl()+path,{method:options.method||"GET",headers,body:options.body===undefined?undefined:JSON.stringify(options.body)});
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) {
      const message = data && (data.msg || data.message || data.error_description || data.error) || ("Serverfout ("+response.status+")");
      if (response.status===401 && session && path.startsWith("/auth/v1/")) saveSession(null);
      throw new Error(String(message));
    }
    return data;
  }
  function authHeaders() { return {headers:{"Authorization":"Bearer "+session.access_token}}; }
  function deviceId() {
    try {
      let id=localStorage.getItem(DEVICE_KEY);
      if(!id){id=crypto.randomUUID();localStorage.setItem(DEVICE_KEY,id);}
      return id;
    } catch { return "device-session"; }
  }
  async function hashText(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256",bytes);
    return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");
  }
  function localEnvelope() {
    let raw;
    try { raw=localStorage.getItem(VAULT_KEY); } catch { return null; }
    if(!raw)return null;
    let envelope;
    try { envelope=JSON.parse(raw); } catch { throw new Error("De lokale versleutelde kluis is beschadigd; er is niets naar de cloud verzonden."); }
    if(!envelope || typeof envelope!=="object" || !envelope.ciphertext || !envelope.iv || !envelope.salt) {
      throw new Error("De lokale kluis heeft geen herkend versleuteld formaat. Er is niets verzonden.");
    }
    return {raw,envelope};
  }
  function setBusy(value) { busy=value; render(); }
  function startInactivityTimer() {
    if(inactivityTimer)clearTimeout(inactivityTimer);
    if(!session)return;
    inactivityTimer=setTimeout(()=>{saveSession(null);statusText="Je account is uitgelogd na 15 minuten inactiviteit. Je lokale kluis blijft versleuteld.";isError=false;render();},15*60*1000);
  }
  function armInactivityTimeout() {
    if(inactivityTimer)clearTimeout(inactivityTimer);
    inactivityTimer=null;
    if(session)startInactivityTimer();
  }
  ["pointerdown","keydown","touchstart"].forEach(name=>document.addEventListener(name,()=>{if(session)armInactivityTimeout();},{passive:true}));
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&session)armInactivityTimeout();});
  function stopAutomaticSync() { if(syncTimer)clearInterval(syncTimer); syncTimer=null; }
  function scheduleAutomaticSync() {
    stopAutomaticSync();
    if(session)syncTimer=setInterval(()=>{if(navigator.onLine && document.visibilityState==="visible")refreshRemoteStatus({quiet:true});},120000);
  }
  async function syncHeaders() {
    const {raw,envelope}=localEnvelope();
    const hash=await hashText(raw);
    return {raw,envelope,hash};
  }
  async function listSnapshots() {
    return await api("/rest/v1/app_sync_snapshots?select=id,created_at,device_label,snapshot_hash,encrypted_snapshot&order=created_at.desc&limit=30");
  }
  async function refreshRemoteStatus({quiet=false}={}) {
    if(!session)return;
    try {
      const local=await syncHeaders();
      const remote=await listSnapshots();
      latestRemote=Array.isArray(remote)?remote[0]||null:null;
      lastSeenRemoteHash=latestRemote?.snapshot_hash||"";
      const baselineKey=LAST_HASH_KEY+":"+session.user.id;
      const baseline=localStorage.getItem(baselineKey)||"";
      const remoteHash=latestRemote?.snapshot_hash||"";
      if(!latestRemote) {
        syncConflict=false;
        if(quiet) await uploadSnapshot({quiet:true});
        else setStatus("Er staat nog geen cloud-back-up. Bewaar je lokale versleutelde versie om te beginnen.");
      } else if(remoteHash===local.hash) {
        syncConflict=false;localStorage.setItem(baselineKey,local.hash);
        if(!quiet)setStatus("Deze telefoon/tablet en de cloud hebben dezelfde versleutelde versie.");
      } else if(baseline && remoteHash===baseline && local.hash!==baseline) {
        // Only this device changed since the last common version: append the encrypted update.
        syncConflict=false;
        if(quiet)await uploadSnapshot({quiet:true});
        else setStatus("Er zijn alleen lokale wijzigingen. Kies ‘Bewaar lokale versie online’ om deze te synchroniseren.");
      } else if(baseline && local.hash===baseline && remoteHash!==baseline) {
        // Only the remote copy changed. Never overwrite local data automatically.
        syncConflict=false;
        if(!quiet)setStatus("Er staat een nieuwere cloudversie. Je kunt die na controle herstellen.");
      } else {
        syncConflict=true;
        if(!quiet)setStatus("Er bestaan verschillende lokale en online versies. Kies bewust welke versie je wilt bewaren of herstellen.",true);
        else render();
      }
    } catch(error) {
      if(!quiet)setStatus(error.message,true);
    }
  }
  async function uploadSnapshot({quiet=false}={}) {
    if(!session)throw new Error("Log eerst in.");
    const local=await syncHeaders();
    const deviceLabel=(navigator.userAgent.match(/Android/i)?"Android":navigator.userAgent.match(/Windows/i)?"Windows":navigator.userAgent.match(/iPhone|iPad/i)?"iPhone/iPad":"Dit apparaat");
    const payload={user_id:session.user.id,device_label:deviceLabel+" · "+deviceId().slice(0,8),snapshot_hash:local.hash,encrypted_snapshot:local.envelope};
    await api("/rest/v1/app_sync_snapshots",{method:"POST",body:payload,prefer:"return=minimal"});
    sessionStorage.setItem(LAST_HASH_KEY,local.hash);
    localStorage.setItem(LAST_HASH_KEY+":"+session.user.id,local.hash);
    latestRemote={snapshot_hash:local.hash,created_at:new Date().toISOString(),device_label:payload.device_label,encrypted_snapshot:local.envelope};
    lastSeenRemoteHash=local.hash;
    syncConflict=false;
    if(!quiet)setStatus("De versleutelde kluisversie is online bewaard. Alleen de versleutelde kluisinhoud is verzonden.");
    render();
  }
  async function restoreLatestSnapshot() {
    if(!session||!latestRemote?.encrypted_snapshot)throw new Error("Er is geen online back-up beschikbaar.");
    const target=latestRemote;
    const local=localEnvelope();
    if(!window.confirm("Herstellen vervangt de lokale versleutelde kluis door de gekozen online versie. Ik maak eerst een veiligheidskopie van de huidige lokale versie. Doorgaan?"))return;
    if(local) await uploadSnapshot({quiet:true});
    const source=target.encrypted_snapshot;
    if(!source || typeof source!=="object" || !source.ciphertext || !source.iv || !source.salt)throw new Error("De online snapshot heeft geen herkend versleuteld formaat.");
    localStorage.setItem(VAULT_KEY,JSON.stringify(source));
    // Publish the restored snapshot after the safety copy so "latest" remains the selected version.
    await uploadSnapshot({quiet:true});
    setStatus("De lokale kluis is vervangen. De app wordt opnieuw geladen; ontgrendel daarna met de oorspronkelijke kluis-wachtzin.");
    window.setTimeout(()=>location.reload(),700);
  }
  async function loadProfile() {
    if(!session)return;
    await api("/rest/v1/user_profiles?on_conflict=user_id",{method:"POST",body:{user_id:session.user.id,email:session.user.email,display_name:session.user.user_metadata?.full_name||session.user.email},prefer:"resolution=merge-duplicates,return=minimal"});
  }
  async function signIn(email,password) {
    const data=await api("/auth/v1/token?grant_type=password",{method:"POST",token:"",body:{email,password}});
    if(!data?.access_token || !data?.user)throw new Error("Inloggen is niet voltooid. Controleer of je e-mailadres is bevestigd.");
    saveSession(data);
    mfaPending=false;mfaFactorId="";
    const factorResponse=await api("/auth/v1/factors");
    const factors=Array.isArray(factorResponse)?factorResponse:[...(factorResponse?.all||[]),...(factorResponse?.totp||[]),...(factorResponse?.phone||[])];
    const verifiedFactor=factors.find(f=>f.status==="verified"&&(f.factor_type==="totp"||f.type==="totp"));
    if(verifiedFactor){mfaPending=true;mfaFactorId=verifiedFactor.id;setStatus("Tweestapsverificatie is ingeschakeld. Bevestig je authenticatorcode om door te gaan.");render();return;}
    await loadProfile();
    await loadCareLinks();
    scheduleAutomaticSync();
    await refreshRemoteStatus({quiet:true});
    setStatus("Je bent ingelogd.");
  }
  async function signUp(email,password,name) {
    const data=await api("/auth/v1/signup",{method:"POST",token:"",body:{email,password,data:{full_name:name}}});
    if(data?.access_token && data?.user) {
      saveSession(data);
      await loadProfile();
      await loadCareLinks();
      scheduleAutomaticSync();
      setStatus("Account aangemaakt. Controleer of je e-mailbevestiging nog nodig is.");
    } else {
      setStatus("Accountaanvraag ontvangen. Bevestig je e-mailadres via de e-mail van de accountdienst om te kunnen inloggen.");
    }
  }
  async function signOut() {
    try { if(session)await api("/auth/v1/logout",{method:"POST"}); } finally {
      saveSession(null); stopAutomaticSync(); latestRemote=null; syncConflict=false; enrolledFactor=null;
      setStatus("Je bent uitgelogd. De lokale versleutelde kluis blijft op dit apparaat staan.");
    }
  }
  async function requestPasswordReset(email) {
    await api("/auth/v1/recover",{method:"POST",token:"",body:{email,redirect_to:location.origin+location.pathname}});
    setStatus("Als dit e-mailadres bij een account hoort, is een herstelbericht aangevraagd. Controleer je e-mail.");
  }
  async function setRecoveredPassword(password) {
    const params=new URLSearchParams(location.hash.replace(/^#/,""));
    const token=params.get("access_token");
    if(token) {
      const data=await api("/auth/v1/user",{method:"PUT",token,body:{password}});
      history.replaceState(null,"",location.pathname+location.search);
      setStatus(data?.id?"Je accountwachtwoord is gewijzigd. Log nu opnieuw in.":"Het wachtwoordherstel is verwerkt.");
      mode="signin";
      return;
    }
    if(!session)throw new Error("Open eerst de link uit de herstel-e-mail op dit apparaat.");
    await api("/auth/v1/user",{method:"PUT",body:{password}});
    setStatus("Je accountwachtwoord is gewijzigd.");
  }
  async function enrollAuthenticator() {
    const factor=await api("/auth/v1/factors",{method:"POST",body:{factor_type:"totp",friendly_name:"Project N-01"}});
    if(!factor?.id || !factor?.totp?.secret)throw new Error("De accountdienst heeft geen TOTP-instelgegevens teruggegeven.");
    enrolledFactor=factor.id;
    secretCode=factor.totp.secret;
    setStatus("Authenticator aangemaakt. Voeg de onderstaande code of provisioning-URI toe in je authenticator-app en bevestig daarna met de actuele code.");
    render();
  }
  async function verifyAuthenticator(code) {
    const factorId=mfaFactorId||enrolledFactor;
    let selected=factorId;
    if(!selected) {
      const response=await api("/auth/v1/factors");
      const factors=Array.isArray(response)?response:[...(response?.all||[]),...(response?.totp||[]),...(response?.phone||[])];
      const factor=factors.find(item=>(item.factor_type==="totp"||item.type==="totp")&&item.status==="verified");
      if(!factor)throw new Error("Stel eerst een authenticator in.");
      selected=factor.id;
    }
    const challenge=await api("/auth/v1/factors/"+encodeURIComponent(selected)+"/challenge",{method:"POST",body:{}});
    const verified=await api("/auth/v1/factors/"+encodeURIComponent(selected)+"/verify",{method:"POST",body:{challenge_id:challenge.id,code:String(code).trim()}});
    if(verified?.access_token)saveSession({...session,...verified,user:verified.user||session?.user,mfaPending:false});
    else if(mfaPending)throw new Error("De server heeft geen verhoogde sessie bevestigd. Controleer de Supabase Auth-configuratie.");
    mfaPending=false;mfaFactorId="";enrolledFactor=null;secretCode="";
    if(session){await loadProfile();await loadCareLinks();scheduleAutomaticSync();await refreshRemoteStatus({quiet:true});}
    setStatus("De authenticatorcode is geverifieerd.");
    render();
  }
  async function loadCareLinks() {
    careLinks = await api("/rest/v1/care_links?select=id,owner_id,caregiver_id,invite_email,role,read_scopes,write_scopes,status,created_at,revoked_at&order=created_at.desc&limit=50");
    return careLinks;
  }
  async function revokeCareLink(id) {
    await api("/rest/v1/care_links?id=eq."+encodeURIComponent(id),{method:"PATCH",body:{status:"revoked",revoked_at:new Date().toISOString()},prefer:"return=minimal"});
    await loadCareLinks();
    setStatus("De toegang is ingetrokken. Deze koppeling deelt nog geen versleutelde dagboekinhoud.");
  }
  async function createCareInvite(form) {
    const email=String(form.elements.email.value||"").trim().toLowerCase();
    const role=form.elements.role.value;
    const readScopes=Array.from(form.querySelectorAll("[name=readScope]:checked")).map(x=>x.value);
    const writeScopes=Array.from(form.querySelectorAll("[name=writeScope]:checked")).map(x=>x.value);
    if(!email.includes("@"))throw new Error("Vul een geldig e-mailadres van de begeleider, ouder of voogd in.");
    if(!readScopes.length)throw new Error("Kies ten minste één soort gegevens.");
    if(writeScopes.some(scope=>!readScopes.includes(scope)))throw new Error("Wijzigrechten mogen alleen worden toegekend voor gegevens die ook zichtbaar zijn.");
    const token=await api("/rest/v1/rpc/create_care_invite",{method:"POST",body:{p_email:email,p_role:role,p_read_scopes:readScopes,p_write_scopes:writeScopes}});
    const code=typeof token==="string"?token:Array.isArray(token)?token[0]:token?.create_care_invite;
    if(!code)throw new Error("De uitnodiging is niet aangemaakt.");
    secretCode=String(code);
    setStatus("Uitnodiging aangemaakt. Deel deze code alleen met de bedoelde persoon; de app verstuurt de e-mail nog niet automatisch.");
    render();
  }
  async function redeemCareInvite(code) {
    const result=await api("/rest/v1/rpc/redeem_care_invite",{method:"POST",body:{p_token:String(code).trim()}});
    await loadCareLinks();
    setStatus("Toegang is gekoppeld aan dit account. De eigenaar bepaalt welke gegevens en wijzigrechten zijn toegekend.");
    return result;
  }
  async function handleSubmit(event) {
    const form=event.target;
    if(!form || !form.id)return;
    event.preventDefault();
    if(busy)return;
    setBusy(true);
    try {
      if(form.id==="ps-config-form") {
        const url=String(form.elements.url.value||"").trim().replace(/\/+$/,"");
        const anonKey=String(form.elements.anonKey.value||"").trim();
        const ok=/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)||/^http:\/\/(localhost|127\.0\.0\.1):54321$/i.test(url);
        if(!ok||!anonKey)throw new Error("Vul een geldige Supabase URL en anon/publishable key in. Gebruik nooit een service_role- of geheime serverkey.");
        config={url,anonKey};
        localStorage.setItem(CONFIG_KEY,JSON.stringify(config));
        setStatus("Projectconfiguratie lokaal opgeslagen. Test nu de verbinding of maak een account aan.");
      } else if(form.id==="ps-signin-form") {
        await signIn(form.elements.email.value.trim(),form.elements.password.value);
      } else if(form.id==="ps-signup-form") {
        if(form.elements.password.value.length<12)throw new Error("Gebruik voor dit account minstens 12 tekens als wachtwoord.");
        await signUp(form.elements.email.value.trim(),form.elements.password.value,form.elements.name.value.trim());
      } else if(form.id==="ps-recover-form") {
        await requestPasswordReset(form.elements.email.value.trim());
      } else if(form.id==="ps-new-password-form") {
        if(form.elements.password.value.length<12)throw new Error("Gebruik minstens 12 tekens voor het nieuwe wachtwoord.");
        await setRecoveredPassword(form.elements.password.value);
      } else if(form.id==="ps-mfa-form") {
        await verifyAuthenticator(form.elements.code.value);
      } else if(form.id==="ps-invite-form") {
        await createCareInvite(form);
      } else if(form.id==="ps-redeem-form") {
        await redeemCareInvite(form.elements.code.value);
      }
    } catch(error) { setStatus(error.message||"De actie is mislukt.",true); }
    finally { setBusy(false); }
  }
  function button(label,action,kind="secondary-button") { return '<button type="button" class="'+kind+'" data-ps-action="'+esc(action)+'" '+(busy?"disabled":"")+'>'+esc(label)+'</button>'; }
  function scopesForm() {
    const options=[["calendar","Agenda"],["planning","Routines en doelen"],["roster","Begeleidersrooster"],["journal","Stemming en dagboek"],["guides","Handleidingen"],["help","Hulpcontacten"]];
    return '<fieldset class="ps-scopes"><legend>Toegang beperken tot</legend>'+options.map(([value,label])=>'<label><input type="checkbox" name="readScope" value="'+value+'"> '+label+'</label>').join("")+'</fieldset><fieldset class="ps-scopes"><legend>Mag ook wijzigen</legend>'+options.map(([value,label])=>'<label><input type="checkbox" name="writeScope" value="'+value+'"> '+label+'</label>').join("")+'</fieldset>';
  }
  function renderAuth() {
    if(!configured())return '<p>Stel eerst een eigen Supabase-project in. Echte accounts en synchronisatie zijn niet actief voordat de database-migratie is toegepast en de projectconfiguratie klopt.</p><form id="ps-config-form" class="ps-form"><label>Supabase-project-URL<input name="url" type="url" required placeholder="https://jouw-project.supabase.co" value="'+esc(config.url)+'"></label><label>Anon/publishable key<input name="anonKey" type="password" autocomplete="off" required value="'+esc(config.anonKey)+'"></label><p class="ps-note">Alleen de publieke anon/publishable key. Zet hier nooit de service_role-key of een wachtwoord neer.</p><button class="primary-button" type="submit" '+(busy?"disabled":"")+'>Project instellen</button></form>';
    if(!session) {
      const params=new URLSearchParams(location.hash.replace(/^#/,""));
      const recovery=params.get("type")==="recovery";
      let out='<div class="ps-config"><small>Backend: '+esc(baseUrl())+'</small> '+button("Project wijzigen","edit-config")+'</div>';
      if(recovery)out+='<form id="ps-new-password-form" class="ps-form"><h4>Nieuw accountwachtwoord</h4><label>Nieuw wachtwoord<input name="password" type="password" required minlength="12" autocomplete="new-password"></label><button class="primary-button" type="submit">Wachtwoord instellen</button></form>';
      else if(mode==="signup")out+='<form id="ps-signup-form" class="ps-form"><h4>Account maken</h4><label>Naam<input name="name" maxlength="100" autocomplete="name" required></label><label>E-mailadres<input name="email" type="email" autocomplete="email" required></label><label>Wachtwoord (minimaal 12 tekens)<input name="password" type="password" minlength="12" autocomplete="new-password" required></label><button class="primary-button" type="submit">Account aanmaken</button>'+button("Ik heb al een account","signin")+'</form>';
      else if(mode==="recover")out+='<form id="ps-recover-form" class="ps-form"><h4>Wachtwoord herstellen</h4><label>E-mailadres<input name="email" type="email" required autocomplete="email"></label><button class="primary-button" type="submit">Herstelbericht aanvragen</button>'+button("Terug naar inloggen","signin")+'</form>';
      else out+='<form id="ps-signin-form" class="ps-form"><h4>Veilig inloggen</h4><label>E-mailadres<input name="email" type="email" autocomplete="username" required></label><label>Wachtwoord<input name="password" type="password" autocomplete="current-password" required></label><button class="primary-button" type="submit">Inloggen</button><div class="ps-actions">'+button("Account aanmaken","signup")+button("Wachtwoord vergeten","recover")+'</div></form>';
      return out;
    }
    if(mfaPending)return '<div class="ps-panel"><h4>Bevestig tweestapsverificatie</h4><p>Open je authenticator-app en voer de huidige code in. Account- en cloudgegevens blijven geblokkeerd totdat de code is geverifieerd.</p><form id="ps-mfa-form" class="ps-form"><label>Actuele 6-cijferige code<input name="code" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="one-time-code" required></label><button class="primary-button" type="submit">Code verifiëren</button></form>'+button("Uitloggen","signout","danger-button")+'</div>';
    const email=esc(session.user.email||"account");
    const mfa= '<div class="ps-panel"><h4>Tweestapsverificatie</h4><p>Gebruik een authenticator-app (TOTP). Bewaar de herstelcodes die de accountdienst aanbiedt veilig.</p><div class="ps-actions">'+button("Authenticator instellen","mfa-enroll")+button("Authenticatorcode bevestigen","mfa-focus")+'</div>'+(secretCode?'<p class="ps-secret"><strong>Instelcode / uitnodigingscode (eenmalig tonen)</strong><code>'+esc(secretCode)+'</code></p>':"")+'<form id="ps-mfa-form" class="ps-form"><label>Actuele 6-cijferige code<input name="code" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="one-time-code" required></label><button class="primary-button" type="submit">Code verifiëren</button></form></div>';
    return '<div class="ps-account-row"><div><strong>'+email+'</strong><p>Ingelogd · automatisch uitloggen na 15 minuten inactiviteit</p></div>'+button("Uitloggen","signout","danger-button")+'</div>'+mfa;
  }
  function renderSync() {
    if(mfaPending)return '<p>Bevestig eerst de authenticatorcode.</p>';
    if(!session)return '<p>Log in om versleutelde kluisback-ups op dit account te bewaren. Cloudinhoud is uitsluitend het bestaande versleutelde kluisbestand, geen leesbare dagboektekst.</p>';
    const label=latestRemote?.created_at?new Date(latestRemote.created_at).toLocaleString():"Nog geen cloudversie";
    const device=latestRemote?.device_label||"";
    return '<div class="ps-sync-status"><strong>Laatste cloudversie:</strong> '+esc(label)+' '+(device?'· '+esc(device):"")+'</div><p>De cloud bewaart alleen een versleutelde momentopname. Verschillende versies worden niet automatisch samengevoegd; herstel of upload vraagt een bewuste keuze. Gebruik op elk apparaat dezelfde kluis-wachtzin.</p><div class="ps-actions">'+button("Controleer versies","refresh-sync")+' '+button("Bewaar lokale versie online","upload-sync","primary-button")+' '+button("Herstel nieuwste online versie","restore-sync")+'</div>'+(syncConflict?'<div class="ps-warning" role="alert"><strong>Versieconflict</strong><p>De versleutelde lokale kluis wijkt af van de nieuwste cloudversie. Vergelijk de tijd en het apparaat hierboven voordat je herstelt.</p></div>':"")+'<div class="ps-actions">'+button("Uitnodig begeleider / ouder / voogd","show-invites")+'</div>';
  }
  function renderCare() {
    if(mfaPending)return '<p>Bevestig eerst de authenticatorcode.</p>';
    if(!session)return '<p>Log in om beveiligde uitnodigingen te beheren.</p>';
    const links=careLinks.map(link=>'<article class="ps-item"><strong>'+esc(link.invite_email)+' · '+esc(link.role)+'</strong><p>Status: '+esc(link.status)+'</p><p>Lezen: '+esc((link.read_scopes||[]).join(", "))+'</p><p>Wijzigen: '+esc((link.write_scopes||[]).join(", ")||"geen")+'</p>'+(link.owner_id===session.user.id&&link.status==="active"?button("Toegang intrekken","revoke-link","danger-button",'data-id="'+esc(link.id)+'"'):"")+'</article>').join("")||'<p>Nog geen toegangs-koppelingen.</p>';
    return '<div class="ps-care-links"><h4>Toegangsrechten</h4>'+links+'</div><form id="ps-invite-form" class="ps-form"><h4>Nieuwe uitnodiging</h4><label>E-mailadres van de persoon<input name="email" type="email" required autocomplete="email"></label><label>Rol<select name="role"><option value="caregiver">Begeleider</option><option value="parent">Ouder</option><option value="guardian">Voogd</option></select></label>'+scopesForm()+'<button class="primary-button" type="submit">Beveiligde uitnodigingscode maken</button><p class="ps-note">De code is eenmalig en verloopt na 7 dagen. De app mailt deze niet automatisch; deel hem alleen met de bedoelde persoon.</p></form><form id="ps-redeem-form" class="ps-form"><h4>Uitnodiging accepteren</h4><label>Uitnodigingscode<input name="code" type="password" minlength="32" required autocomplete="off"></label><button class="primary-button" type="submit">Uitnodiging accepteren</button></form>'+ (secretCode?'<div class="ps-secret"><strong>Eenmalige code — kopieer en deel beveiligd</strong><code>'+esc(secretCode)+'</code>'+button("Code kopiëren","copy-code")+'</div>':"")+'<p class="ps-note">Een uitnodiging geeft alleen de op de server ingestelde categorieën en wijzigrechten. De huidige versleutelde hoofdkluis blijft alleen leesbaar met de kluis-wachtzin; de code deelt die wachtzin niet.</p>';
  }
  function render() {
    if(!root.isConnected)return;
    root.innerHTML='<section class="ps-shell" aria-labelledby="ps-title"><div class="ps-heading"><div><p class="ps-kicker">PROJECT N-01 · BEVEILIGDE DIENSTEN</p><h3 id="ps-title">Accounts, synchronisatie en begeleiderstoegang</h3><p>Accountlogin, wachtwoordherstel, optionele authenticator en versleutelde back-upversies.</p></div><span class="ps-badge">'+(session?"INGELOGD":"LOKAAL")+'</span></div><div class="ps-status '+(isError?"is-error":"")+'" role="status" aria-live="polite">'+esc(statusText || (configured()?"Configureer of log in bij je eigen accountdienst.":"Geen cloudbackend ingesteld."))+'</div><div class="ps-grid"><section class="ps-panel"><h3>1. Account en beveiliging</h3>'+renderAuth()+'</section><section class="ps-panel"><h3>2. Versleutelde synchronisatie en herstel</h3>'+renderSync()+'</section><section class="ps-panel"><h3>3. Begeleidersportaal en toestemming</h3>'+renderCare()+'</section></div><p class="ps-footer">Privacy: de Supabase anon/publishable key is een publieke browserkey en is geen admin-sleutel. Veiligheid wordt afgedwongen met database-RLS. Deel geen service_role-key. Cloudback-ups blijven versleuteld met je bestaande kluis-wachtzin.</p></section>';
    root.querySelectorAll("form").forEach(form=>form.addEventListener("submit",handleSubmit));
    root.querySelectorAll("[data-ps-action]").forEach(el=>el.addEventListener("click",()=>handleAction(el.dataset.psAction)));
  }
  async function handleAction(action,actionId) {
    try {
      if(action==="edit-config"){config={url:"",anonKey:""};mode="signin";saveSession(null);stopAutomaticSync();render();return;}
      if(action==="signin"){mode="signin";render();return;}
      if(action==="signup"){mode="signup";render();return;}
      if(action==="recover"){mode="recover";render();return;}
      if(action==="signout"){setBusy(true);await signOut();return;}
      if(action==="mfa-enroll"){setBusy(true);await enrollAuthenticator();return;}
      if(action==="mfa-focus"){const field=root.querySelector('#ps-mfa-form input[name="code"]');if(field)field.focus();return;}
      if(action==="refresh-sync"){setBusy(true);await refreshRemoteStatus();return;}
      if(action==="upload-sync"){if(syncConflict&&!window.confirm("Er is een andere cloudversie. Uploaden maakt een extra versie maar overschrijft niets. Doorgaan?"))return;setBusy(true);await uploadSnapshot();return;}
      if(action==="restore-sync"){setBusy(true);await refreshRemoteStatus({quiet:true});if(!latestRemote?.encrypted_snapshot)throw new Error("Er is nog geen cloudversie.");await restoreLatestSnapshot();return;}
      if(action==="show-invites"){root.querySelector(".ps-panel:nth-child(3)")?.scrollIntoView({behavior:"smooth",block:"start"});root.querySelector('#ps-invite-form input[name="email"]')?.focus();return;}
      if(action==="revoke-link"){if(!window.confirm("Deze toegangslink intrekken?"))return;setBusy(true);await revokeCareLink(actionId);render();return;}
      if(action==="copy-code"){await navigator.clipboard.writeText(secretCode);setStatus("Code gekopieerd.");return;}
    } catch(error) {setStatus(error.message||"De actie is mislukt.",true);}
    finally {setBusy(false);}
  }
  // Auth tokens are session-scoped, refresh tokens are never written to localStorage.
  async function initialize() {
    if(session && configured()) {
      try {
        const current=await api("/auth/v1/user");
        if(current?.id)session.user=current;
        saveSession(session);
        await loadCareLinks();
        await refreshRemoteStatus({quiet:true});
        scheduleAutomaticSync();
      } catch { saveSession(null); }
    } else {
      const params=new URLSearchParams(location.hash.replace(/^#/,""));
      if(params.get("access_token")&&params.get("type")==="recovery")mode="signin";
    }
    render();
  }
  window.addEventListener("online",()=>{if(session)refreshRemoteStatus({quiet:true});});
  window.addEventListener("storage",event=>{if(event.key===VAULT_KEY && session)refreshRemoteStatus({quiet:true});});
  initialize();
})();