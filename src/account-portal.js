(function () {
  "use strict";
  const root = document.getElementById("account-portal-root");
  if (!root) return;
  const VAULT_KEY = "project-n-01-secure-life-v1";
  const HISTORY_KEY = "project-n-01-life-history-v1";
  const API_KEY = "project-n-01-api-base";
  const VERSION_KEY = "project-n-01-cloud-version";
  let apiBase = localStorage.getItem(API_KEY) || "";
  let token = "";
  let user = null;
  let cloudVersion = null;
  let cloudEnvelope = null;
  let activeHousehold = "";
  let householdMembers = [];
  let idleTimer = 0;
  let mfaPending = false;
  let statusText = "";
  let statusError = false;

  const esc = value => String(value == null ? "" : value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const local = () => location.hostname === "localhost" || location.hostname === "127.0.0.1";
  function setStatus(message, error) { statusText = message || ""; statusError = Boolean(error); const el = root.querySelector("#account-status"); if (el) { el.textContent = statusText; el.classList.toggle("is-error",statusError); } }
  function setApiBase(value) {
    const cleaned=String(value||"").trim().replace(/\/+$/,"");
    let u;
    try { u=new URL(cleaned); } catch { throw new Error("Vul een geldige HTTPS-adres voor de server in."); }
    if (u.protocol!=="https:" && !(local() && u.protocol==="http:" && (u.hostname==="localhost"||u.hostname==="127.0.0.1"))) throw new Error("De server moet HTTPS gebruiken, behalve bij lokale ontwikkeling.");
    if (u.username || u.password || u.search || u.hash) throw new Error("Gebruik alleen het basisadres van de API, zonder inloggegevens of pad.");
    apiBase=cleaned;
    localStorage.setItem(API_KEY,apiBase);
  }
  async function request(path, options = {}) {
    if (!apiBase) throw new Error("Stel eerst het serveradres in.");
    const headers={"Accept":"application/json",...(options.body?{"Content-Type":"application/json"}:{}),...(token?{"Authorization":"Bearer "+token}:{})};
    const response=await fetch(apiBase+path,{...options,headers:{...headers,...(options.headers||{})},cache:"no-store",credentials:"omit"});
    const data=await response.json().catch(()=>({error:"invalid-response",message:"De server gaf geen geldige reactie."}));
    if(!response.ok){const error=new Error(data.message||data.error||("Serverfout ("+response.status+")"));error.status=response.status;error.data=data;throw error;}
    return data;
  }
  function body(value){return JSON.stringify(value);}
  function field(label,name,type="text",attrs=""){const optional=name==="totp";return '<label class="ap-field"><span>'+esc(label)+'</span><input name="'+esc(name)+'" type="'+esc(type)+'" '+attrs+(optional?"":" required")+'></label>';}
  function button(label,action,kind="secondary-button",extra=""){return '<button type="button" class="'+kind+'" data-ap-action="'+esc(action)+'" '+extra+'>'+esc(label)+'</button>';}
  function status(){return '<p id="account-status" class="ap-status'+(statusError?' is-error':'')+'" role="status" aria-live="polite">'+esc(statusText)+'</p>';}
  function serverForm(){return '<form class="ap-form" data-ap-form="server">'+field("API-serveradres","apiBase","url",'value="'+esc(apiBase)+'" placeholder="https://api.example.org" autocomplete="url"')+'<button class="primary-button" type="submit">Serveradres opslaan</button><p class="ap-muted">Laat het adres leeg zolang de online dienst nog niet is gehost. Zet nooit wachtwoorden, API-sleutels of databasegegevens in de app.</p></form>';}
  function authPanel(){
    const params=new URLSearchParams(location.search);
    const verifyToken=params.get("verifyEmail");
    const resetToken=params.get("resetPassword");
    const invitationToken=params.get("acceptInvite");
    if(verifyToken) return '<section class="ap-card"><h3>E-mailadres bevestigen</h3><p>De verificatielink is gevonden. Rond de bevestiging af.</p>'+button("E-mailadres bevestigen","verify-email","primary-button")+'</section>';
    if(resetToken) return '<section class="ap-card"><h3>Nieuw wachtwoord</h3><form class="ap-form" data-ap-form="reset">'+field("Nieuw wachtwoord","password","password",'minlength="14" autocomplete="new-password"')+field("Bevestig wachtwoord","confirmPassword","password",'minlength="14" autocomplete="new-password"')+'<button class="primary-button" type="submit">Wachtwoord wijzigen</button></form></section>';
    if(invitationToken) return '<section class="ap-card"><h3>Uitnodiging accepteren</h3><p>Log in met het uitgenodigde e-mailadres. De server controleert of de uitnodiging bij dit e-mailadres hoort.</p>'+button("Uitnodiging accepteren","accept-invite","primary-button")+'</section><section class="ap-card"><h3>Inloggen om de uitnodiging te accepteren</h3><form class="ap-form" data-ap-form="login">'+field("E-mailadres","email","email",'autocomplete="username"')+field("Wachtwoord","password","password",'autocomplete="current-password"')+field("Authenticatorcode","totp","text",'inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code")+'<button class="primary-button" type="submit">Inloggen</button></form><form class="ap-form" data-ap-form="register">'+field("Naam","displayName","text",'maxlength="80" autocomplete="name"')+field("E-mailadres","email","email",'autocomplete="email"')+field("Nieuw wachtwoord (14+ tekens)","password","password",'minlength="14" autocomplete="new-password"')+'<button class="secondary-button" type="submit">Account aanmaken</button></form></section>';
    return '<div class="ap-auth-grid"><section class="ap-card"><h3>Inloggen</h3><form class="ap-form" data-ap-form="login">'+field("E-mailadres","email","email",'autocomplete="username"')+field("Wachtwoord","password","password",'autocomplete="current-password"')+field("Authenticatorcode (indien ingeschakeld)","totp","text",'inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"')+'<button class="primary-button" type="submit">Inloggen</button></form><form class="ap-form ap-inline-form" data-ap-form="forgot">'+field("Wachtwoord vergeten — e-mailadres","email","email",'autocomplete="email"')+'<button class="secondary-button" type="submit">Herstelmail aanvragen</button></form></section><section class="ap-card"><h3>Nieuw account</h3><form class="ap-form" data-ap-form="register">'+field("Naam","displayName","text",'maxlength="80" autocomplete="name"')+field("E-mailadres","email","email",'autocomplete="email"')+field("Wachtwoord (minimaal 14 tekens)","password","password",'minlength="14" autocomplete="new-password"')+'<p class="ap-muted">Een verificatiemail is vereist. Kies een uniek wachtwoord; gebruik nooit je kluiswachtzin opnieuw.</p><button class="primary-button" type="submit">Account registreren</button></form><form class="ap-form ap-inline-form" data-ap-form="resend">'+field("Verificatiemail opnieuw sturen","email","email",'autocomplete="email"')+'<button class="secondary-button" type="submit">Verificatie opnieuw sturen</button></form></section></div>';
  }
  function localInventory(){
    const entries=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);if(!key||!key.startsWith("project-n-01"))continue;
      const value=localStorage.getItem(key)||"";
      const encrypted=/secure-life|encrypted-vault|life-history/i.test(key);
      const legacy=/daily-progress|custom-routines|accessibility|preferences/i.test(key);
      entries.push({key,bytes:new TextEncoder().encode(value).length,encrypted,legacy});
    }
    if(!entries.length)return '<p class="ap-muted">Geen lokale Project N-01-sleutels gevonden in deze webopslag.</p>';
    return '<div class="ap-inventory"><p class="ap-muted">Alleen sleutelnaam, grootte en technische classificatie worden getoond; opgeslagen inhoud wordt niet weergegeven.</p>'+entries.map(x=>'<div class="ap-inventory-row"><span><strong>'+esc(x.key)+'</strong><small>'+x.bytes.toLocaleString("nl-NL")+' bytes</small></span><span class="ap-tag '+(x.encrypted?'is-encrypted':x.legacy?'is-warning':'')+'">'+(x.encrypted?"Versleutelde envelop"+(x.key===HISTORY_KEY?" / eerdere versies":""):x.legacy?"Controle nodig":"Metadata / onbekend")+'</span></div>').join("")+'</div>';
  }
  function cloudPanel(){
    const localExists=Boolean(localStorage.getItem(VAULT_KEY));
    return '<section class="ap-card"><h3>Versleutelde synchronisatie</h3><p>De server bewaart alleen de versleutelde kluis-envelop. Hij krijgt geen kluiswachtzin en ontsleutelt geen dagboek, foto's of afspraken.</p><div class="ap-actions">'+button("Cloudstatus controleren","sync-check","secondary-button")+' '+button(localExists?"Lokale kluis naar cloud sturen":"Lokale kluis ontbreekt","sync-push","primary-button",localExists?"":"disabled")+' '+button("Cloudkluis naar dit apparaat herstellen","sync-pull","secondary-button")+' '+button("Cloudversies bekijken","cloud-revisions","secondary-button")+' '+button("Agenda exporteren (.ics)","export-calendar","secondary-button")+'</div><p class="ap-muted">Bij een conflict wordt overschrijven niet stilzwijgend uitgevoerd. Synchronisatie geldt voor dezelfde accountkluis; delen van afzonderlijke categorieën met een andere account vereist nog een apart versleutelingsprotocol.</p><div id="cloud-status" class="ap-substatus" role="status" aria-live="polite"></div><div id="cloud-revisions" class="ap-revisions"></div></section>';
  }
  function mfaPanel(){
    return '<section class="ap-card"><h3>Tweestapsverificatie</h3><p>Voeg een authenticator-app toe om na je wachtwoord ook een tijdelijke code te vereisen.</p><div class="ap-actions">'+button("Authenticator instellen","mfa-setup","secondary-button")+' '+button("Tweestapsverificatie uitschakelen","mfa-disable","secondary-button danger-button")+'</div><form class="ap-form ap-inline-form" data-ap-form="mfa-enable">'+field("Code om configuratie te bevestigen","totp","text",'inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"')+'<button class="primary-button" type="submit">Verificatie inschakelen</button></form><form class="ap-form ap-inline-form" data-ap-form="mfa-disable">'+field("Authenticatorcode om uit te schakelen","totp","text",'inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"')+'<button class="secondary-button danger-button" type="submit">Uitschakelen bevestigen</button></form><div id="mfa-setup-panel" class="ap-substatus" role="status"></div></section>';
  }
  function householdsPanel(){
    return '<section class="ap-card"><h3>Begeleiders, ouders en voogden</h3><p>Maak een huishouden aan en nodig een andere account met e-mailuitnodiging uit. Toestemming kan worden beperkt tot categorieën en later worden ingetrokken.</p><form class="ap-form ap-inline-form" data-ap-form="household">'+field("Naam van huishouden","name","text",'maxlength="80" autocomplete="off"')+'<button class="primary-button" type="submit">Huishouden aanmaken</button></form><form class="ap-form ap-inline-form" data-ap-form="invite"><label class="ap-field"><span>Huishouden</span><select name="householdId" id="ap-household-select" required></select></label>'+field("E-mailadres genodigde","email","email",'autocomplete="email"')+'<label class="ap-field"><span>Rol</span><select name="role"><option value="caregiver">Begeleider</option><option value="parent">Ouder</option><option value="guardian">Voogd</option><option value="user">Gebruiker</option></select></label><button class="secondary-button" type="submit">Veilige uitnodiging versturen</button></form><div id="ap-household-members" class="ap-substatus"></div><form class="ap-form ap-inline-form" data-ap-form="consent"><input type="hidden" name="householdId" id="ap-consent-household-id"><label class="ap-field"><span>Toestemming geven aan</span><select name="viewerUserId" id="ap-member-select" required></select></label><fieldset class="ap-scopes"><legend>Mag bekijken</legend>'+["calendar","roster","routine","progress","goals","documents","mood","journal","guides","emergency"].map(s=>'<label><input type="checkbox" name="scopes" value="'+s+'"> '+esc(({calendar:"Agenda",roster:"Begeleidersrooster",routine:"Routines",progress:"Voortgang",goals:"Doelen",documents:"Documenten",mood:"Stemming",journal:"Dagboek",guides:"Handleidingen",emergency:"Noodplan"})[s])+'</label>').join("")+'</fieldset><fieldset class="ap-scopes"><legend>Mag ook wijzigen</legend>'+["calendar","roster","routine","progress","goals","documents","guides"].map(s=>'<label><input type="checkbox" name="editScopes" value="'+s+'"> '+esc(({calendar:"Agenda",roster:"Begeleidersrooster",routine:"Routines",progress:"Voortgang",goals:"Doelen",documents:"Documenten",guides:"Handleidingen"})[s])+'</label>').join("")+'</fieldset><button class="secondary-button" type="submit">Toestemming vastleggen</button></form><div id="ap-consents" class="ap-substatus"></div><p class="ap-warning">Toestemming en rollen worden server-side geregistreerd. Dit maakt de volledige versleutelde kluis van een andere account niet automatisch leesbaar; categorie-voor-categorie delen is bewust nog niet actief zolang dit niet end-to-end versleuteld is uitgewerkt.</p></section>';
  }
  function signedIn(){
    const reportPrefs='<section class="ap-card"><h3>Weekrapport samenstellen</h3><p>Kies zelf welke samenvattingen in het bestand komen. Dagboektekst, geluidsopnames en gevoelige notities worden nooit automatisch toegevoegd.</p><fieldset class="ap-scopes"><legend>Onderdelen opnemen</legend>'+[
      ["appointments","Agenda"],["routines","Afgeronde routines"],["mood","Stemmingsregistraties"],["goals","Persoonlijke doelen"],["documents","Aantal documenten"]
    ].map(([key,label])=>'<label><input type="checkbox" name="reportSection" value="'+key+'"> '+label+'</label>').join("")+'</fieldset><div class="ap-actions">'+button("Weekoverzicht bekijken","weekly-report","secondary-button")+' '+button("Geselecteerd weekrapport exporteren","export-weekly-report","primary-button")+'</div><div id="ap-weekly-report" class="ap-report"></div></section>';
    const deleteAccount='<section class="ap-card"><h3>Account verwijderen</h3><p>Dit verwijdert de online account, de cloudkluis en de gekoppelde servergegevens. Lokale gegevens op deze en andere apparaten en eerder gedownloade back-ups blijven bestaan totdat je die apart wist.</p><form class="ap-form" data-ap-form="delete-account">'+field("Huidig wachtwoord","password","password",'autocomplete="current-password"')+field("Authenticatorcode indien ingeschakeld","totp","text",'inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"')+field("Typ DELETE ter bevestiging","confirmation","text",'autocomplete="off" maxlength="6"')+'<button class="secondary-button danger-button" type="submit">Account en cloudgegevens verwijderen</button></form></section>';
    return '<section class="ap-card ap-account-head"><div><p class="ap-eyebrow">BEVEILIGDE ACCOUNT</p><h3>'+esc(user?.displayName||"Project N-01")+'</h3><p>'+esc(user?.email||"")+'</p></div><div class="ap-actions">'+button("Gegevens verversen","refresh-account","secondary-button")+' '+button("Uitloggen","logout","secondary-button danger-button")+'</div></section><div class="ap-grid">'+cloudPanel()+mfaPanel()+householdsPanel()+reportPrefs+deleteAccount+'</div>';
  }
  function historyPanel(){
    return '<section class="ap-card"><h3>Lokale versiegeschiedenis</h3><p>Eerdere kluisversies bevatten uitsluitend client-versleutelde gegevens. Herstellen vervangt de actieve lokale kluis; de huidige versie wordt eerst bewaard.</p><div id="ap-local-history" class="ap-substatus">Versiegeschiedenis wordt gecontroleerd…</div></section>';
  }
  async function loadLocalHistory(){
    const box=root.querySelector("#ap-local-history");if(!box)return;
    if(!window.ProjectN01VersionHistory){box.textContent="Lokale versiegeschiedenis is niet beschikbaar in deze browser.";return;}
    try{
      const versions=await window.ProjectN01VersionHistory.list("project-n-01-life-v1");
      box.innerHTML=versions.length?versions.map(x=>'<div class="ap-inventory-row"><span><strong>Versie '+x.id+'</strong><small>'+esc(x.savedAt||"Onbekende datum")+' · '+Number(x.bytes||0).toLocaleString("nl-NL")+' bytes</small></span>'+button("Herstellen","restore-local-revision","secondary-button",'data-revision-id="'+x.id+'"')+'</div>').join(""):'<p class="ap-muted">Nog geen lokale versies geregistreerd.</p>';
    }catch{box.textContent="Lokale versiegeschiedenis kon niet worden gelezen.";}
  }
  function render(){
    const html='<div class="section-heading"><div><p class="eyebrow">PROJECT N-01</p><h2>Account, beveiliging en apparaten</h2><p class="section-subtitle">Beheer echte accounts, versleutelde synchronisatie, toegangsrechten en herstel.</p></div></div>'+serverForm()+status()+(user?signedIn():'<div class="ap-card"><p class="ap-muted">Online accountfuncties worden pas actief nadat de API is gehost en ingesteld.</p></div>'+authPanel())+'<section class="ap-card"><h3>Lokale gegevenscontrole</h3><p>Controleer welke Project N-01-gegevens in deze browser zijn opgeslagen. Inhoud wordt niet getoond.</p>'+button("Lokale opslag controleren","inventory","secondary-button")+'<div id="ap-inventory" class="ap-substatus">'+localInventory()+'</div></section>'+historyPanel();
    root.innerHTML=html;
    const apiInput=root.querySelector('[name="apiBase"]');if(apiInput)apiInput.value=apiBase;
    updateHouseholds().catch(()=>{});
    if(user)renderWeeklyReport();
    loadLocalHistory().catch(()=>{});
  }
  async function authAction(formName, data){
    if(formName==="server"){setApiBase(data.apiBase);setStatus("Serveradres opgeslagen.");render();return;}
    if(formName==="register"){if(data.password.length<14)throw new Error("Gebruik minimaal 14 tekens voor het wachtwoord.");const r=await request("/v1/auth/register",{method:"POST",body:body({displayName:data.displayName,email:data.email,password:data.password})});setStatus(r.message||"Registratie verwerkt.");return;}
    if(formName==="login"){const r=await request("/v1/auth/login",{method:"POST",body:body({email:data.email,password:data.password,totp:data.totp})});token=r.accessToken;user=r.user;statusText="Ingelogd. De accountsessie verloopt na 30 minuten en wordt eerder gesloten na 15 minuten inactiviteit.";statusError=false;resetIdle();render();await checkCloud();return;}
    if(formName==="forgot"){const r=await request("/v1/auth/forgot-password",{method:"POST",body:body({email:data.email})});setStatus(r.message);return;}
    if(formName==="resend"){const r=await request("/v1/auth/resend-verification",{method:"POST",body:body({email:data.email})});setStatus(r.message);return;}
    if(formName==="reset"){const params=new URLSearchParams(location.search);if(data.password!==data.confirmPassword)throw new Error("De wachtwoorden komen niet overeen.");const r=await request("/v1/auth/reset-password",{method:"POST",body:body({token:params.get("resetPassword"),password:data.password})});history.replaceState(null,"",location.pathname);setStatus(r.message);render();return;}
    if(formName==="delete-account"){if(data.confirmation!=="DELETE")throw new Error("Typ DELETE precies over om het verwijderen te bevestigen.");if(!confirm("Laatste controle: je online account en de cloudkluis worden verwijderd. Lokale kluizen en gedownloade back-ups blijven op je apparaten totdat je die apart wist. Doorgaan?"))return;const r=await request("/v1/account",{method:"DELETE",body:body({password:data.password,totp:data.totp,confirmation:data.confirmation})});token="";user=null;cloudVersion=null;cloudEnvelope=null;householdMembers=[];localStorage.removeItem(VERSION_KEY);statusText=r.message||"Account verwijderd.";statusError=false;history.replaceState(null,"",location.pathname);render();return;}
    if(formName==="mfa-enable"){const r=await request("/v1/auth/mfa/enable",{method:"POST",body:body({totp:data.totp})});setStatus(r.success?"Tweestapsverificatie is ingeschakeld.": "Instellen mislukt.");user.mfaEnabled=r.mfaEnabled;render();return;}
    if(formName==="mfa-disable"){const r=await request("/v1/auth/mfa/disable",{method:"POST",body:body({totp:data.totp})});user.mfaEnabled=r.mfaEnabled;setStatus("Tweestapsverificatie is uitgeschakeld.");render();return;}
    if(formName==="household"){const r=await request("/v1/households",{method:"POST",body:body({name:data.name})});activeHousehold=r.household.id;setStatus("Huishouden aangemaakt.");await updateHouseholds();return;}
    if(formName==="invite"){const r=await request("/v1/households/"+encodeURIComponent(data.householdId)+"/invitations",{method:"POST",body:body({email:data.email,role:data.role})});setStatus(r.sent?"Uitnodiging per e-mail verstuurd.":"De uitnodiging kon niet worden verstuurd.");await loadMembers(data.householdId);return;}
    if(formName==="consent"){const scopes=data.scopes||[];const editScopes=(data.editScopes||[]).filter(x=>scopes.includes(x));if(!scopes.length)throw new Error("Kies ten minste één categorie.");const r=await request("/v1/households/"+encodeURIComponent(data.householdId)+"/consents",{method:"POST",body:body({viewerUserId:data.viewerUserId,scopes,editScopes})});setStatus("Toestemming is geregistreerd. Je kunt deze later intrekken.");await loadConsents(data.householdId);return;}
  }
  function formValues(form){
    const out={};for(const [key,value] of new FormData(form).entries()){if(Object.prototype.hasOwnProperty.call(out,key)){out[key]=Array.isArray(out[key])?out[key].concat(value):[out[key],value];}else out[key]=value;}return out;
  }
  async function syncCheck(){const r=await request("/v1/sync/vault");cloudVersion=r.version;cloudEnvelope=r.envelope;const v=root.querySelector("#cloud-status");if(v)v.textContent="Cloudversie: "+r.version+(r.updatedAt?" · laatst gewijzigd "+new Date(r.updatedAt).toLocaleString():" · nog geen cloudback-up");}
  async function checkCloud(){try{await syncCheck();}catch(e){setStatus("Account aangemeld, maar cloudstatus niet beschikbaar: "+e.message,true);}}
  async function pushLocal(){
    const raw=localStorage.getItem(VAULT_KEY);
    if(!raw)throw new Error("Er staat geen lokale versleutelde kluis op dit apparaat.");
    let envelope;
    try{envelope=JSON.parse(raw);}catch{throw new Error("De lokale kluis is ongeldig.");}
    await syncCheck();
    const stored=localStorage.getItem(VERSION_KEY)||"";
    const known=stored.startsWith(user.id+":")?Number(stored.slice(user.id.length+1)):null;
    if(known!==null && known!==cloudVersion)throw new Error("Synchronisatieconflict: de cloudversie is gewijzigd sinds dit apparaat de laatste keer synchroniseerde. Controleer eerst de cloudversie of herstel deze expliciet.");
    if(cloudVersion>0 && !confirm("Je staat op het punt de cloudkluis te vervangen door de lokale kluis. De vorige cloudversie blijft herstelbaar. Weet je zeker dat je deze wijziging wilt uploaden?"))return;
    const result=await request("/v1/sync/vault",{method:"PUT",body:body({baseVersion:cloudVersion===null?0:cloudVersion,envelope})});
    cloudVersion=result.version;
    localStorage.setItem(VERSION_KEY,user.id+":"+result.version);
    setStatus("Versleutelde kluis opgeslagen als cloudversie "+result.version+".");
    await syncCheck();
  }
  async function archiveLocal(){
    const raw=localStorage.getItem(VAULT_KEY);
    if(!raw||!window.ProjectN01VersionHistory)return;
    try{await window.ProjectN01VersionHistory.archive("project-n-01-life-v1",raw);}catch{}
  }
  async function pullCloud(){
    const r=await request("/v1/sync/vault");if(!r.envelope)throw new Error("Er staat nog geen cloudkluis. Synchroniseer eerst vanaf het oorspronkelijke apparaat.");
    if(!confirm("Dit vervangt de actieve lokale kluis door de versleutelde cloudversie "+r.version+". De huidige lokale kluis wordt eerst als herstelversie bewaard. Doorgaan?"))return;
    await archiveLocal();localStorage.setItem(VAULT_KEY,JSON.stringify(r.envelope));localStorage.setItem(VERSION_KEY,user.id+":"+r.version);
    setStatus("Cloudkluis teruggezet. De app wordt opnieuw geopend; ontgrendel met dezelfde kluiswachtzin.");location.reload();
  }
  async function showRevisions(){
    const r=await request("/v1/sync/revisions");const box=root.querySelector("#cloud-revisions");
    if(!box)return;box.innerHTML=r.revisions.length?r.revisions.map(x=>'<div class="ap-inventory-row"><span><strong>Cloudversie '+x.version+'</strong><small>'+esc(new Date(x.createdAt).toLocaleString())+'</small></span>'+button("Deze versie herstellen","restore-cloud-revision","secondary-button",'data-version="'+x.version+'"')+'</div>').join(""):'<p class="ap-muted">Nog geen eerdere cloudversies.</p>';
  }
  async function restoreCloudRevision(version){
    const r=await request("/v1/sync/revisions/"+encodeURIComponent(version));
    if(!confirm("Cloudversie "+version+" als lokale actieve kluis herstellen? De huidige lokale kluis wordt als herstelversie bewaard."))return;
    archiveLocal();localStorage.setItem(VAULT_KEY,JSON.stringify(r.envelope));setStatus("Cloudversie opgehaald. De app wordt opnieuw geopend.");location.reload();
  }
  async function updateHouseholds(){
    if(!user)return;
    const r=await request("/v1/households");
    const select=root.querySelector("#ap-household-select");
    if(select){select.innerHTML=r.households.map(h=>'<option value="'+esc(h.id)+'">'+esc(h.name)+' · '+esc(h.role)+'</option>').join("");if(!r.households.length)select.innerHTML='<option value="">Maak eerst een huishouden aan</option>';if(activeHousehold&&r.households.some(h=>h.id===activeHousehold))select.value=activeHousehold;else if(r.households.length)activeHousehold=r.households[0].id;}
    if(activeHousehold)await loadMembers(activeHousehold);const consentHousehold=root.querySelector("#ap-consent-household-id");if(consentHousehold)consentHousehold.value=activeHousehold||"";
  }
  async function loadMembers(householdId){
    activeHousehold=householdId;const consentHousehold=root.querySelector("#ap-consent-household-id");if(consentHousehold)consentHousehold.value=householdId;const r=await request("/v1/households/"+encodeURIComponent(householdId)+"/members");householdMembers=r.members||[];
    const box=root.querySelector("#ap-household-members");if(box)box.innerHTML=householdMembers.map(m=>'<div class="ap-inventory-row"><span><strong>'+esc(m.display_name)+'</strong><small>'+esc(m.role)+'</small></span></div>').join("")||'<p class="ap-muted">Nog geen leden.</p>';
    const select=root.querySelector("#ap-member-select");if(select){select.innerHTML=householdMembers.filter(m=>m.id!==user.id).map(m=>'<option value="'+esc(m.id)+'">'+esc(m.display_name)+' · '+esc(m.role)+'</option>').join("");if(!select.options.length)select.innerHTML='<option value="">Nodig eerst een ander lid uit</option>';}
    await loadConsents(householdId);
  }
  async function loadConsents(householdId){
    const box=root.querySelector("#ap-consents");if(!box)return;
    try{const r=await request("/v1/households/"+encodeURIComponent(householdId)+"/consents");box.innerHTML=(r.consents||[]).map(c=>'<div class="ap-inventory-row"><span><strong>'+esc(c.owner_name)+' → '+esc(c.viewer_name)+'</strong><small>'+esc((c.scopes||[]).join(", "))+(c.revoked_at?" · ingetrokken":" · actief")+'</small></span>'+(c.owner_user_id===user.id&&!c.revoked_at?button("Intrekken","revoke-consent","secondary-button danger-button",'data-consent-id="'+esc(c.id)+'" data-household-id="'+esc(householdId)+'"'):"")+'</div>').join("")||'<p class="ap-muted">Nog geen toestemmingen geregistreerd.</p>';}catch(e){box.textContent=e.message;}
  }
  async function renderWeeklyReport(){
    const box=root.querySelector("#ap-weekly-report");if(!box)return;
    try{
      if(!window.ProjectN01LifeSuite||!window.ProjectN01LifeSuite.getWeeklyReport){box.textContent="Ontgrendel eerst de kluis in Mijn leven om het weekoverzicht lokaal samen te stellen.";return;}
      const report=window.ProjectN01LifeSuite.getWeeklyReport();
      box.innerHTML='<div class="ap-report-grid">'+report.items.map(x=>'<div class="ap-report-stat"><strong>'+esc(x.value)+'</strong><span>'+esc(x.label)+'</span></div>').join("")+'</div><p class="ap-muted">Deze cijfers worden alleen op dit apparaat gemaakt. Er wordt niets automatisch gedeeld.</p>';
    }catch{box.textContent="Ontgrendel de persoonlijke kluis om de samenvatting te maken.";}
  }
  function exportWeeklyReport(){
    if(!window.ProjectN01LifeSuite||!window.ProjectN01LifeSuite.getWeeklyReport)throw new Error("Ontgrendel eerst de persoonlijke kluis.");
    const selected=Array.from(root.querySelectorAll('input[name="reportSection"]:checked')).map(x=>x.value);
    if(!selected.length)throw new Error("Kies zelf minstens één onderdeel voor het weekrapport.");
    const report=window.ProjectN01LifeSuite.getWeeklyReport();
    const rows=report.items.filter(x=>selected.includes(x.key)).map(x=>x.label+": "+x.value);
    const content=["Project N-01 — weekoverzicht",report.start+" t/m "+report.end,"",...rows,"","Alleen geselecteerde totalen. Dagboektekst, geluidsopnames en stemmingsnotities zijn niet opgenomen."].join("\r\n");
    downloadText(content,"text/plain;charset=utf-8","project-n-01-weekoverzicht.txt");
    setStatus("Weekrapport geëxporteerd. Controleer het bestand voordat je het eventueel deelt.");
  }
  function downloadText(content,type,name){const blob=new Blob([content],{type});const href=URL.createObjectURL(blob);const a=document.createElement("a");a.href=href;a.download=name;a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1500);}
  function resetIdle(){clearTimeout(idleTimer);if(token)idleTimer=setTimeout(()=>logout(true),15*60*1000);}
  async function logout(expired=false){
    clearTimeout(idleTimer);if(token)try{await request("/v1/auth/logout",{method:"POST",body:"{}"});}catch{}
    token="";user=null;cloudVersion=null;cloudEnvelope=null;householdMembers=[];mfaPending=false;
    setStatus(expired?"Je bent automatisch uitgelogd na inactiviteit.":"Je bent uitgelogd.");render();
  }
  root.addEventListener("submit",async event=>{
    const form=event.target.closest("[data-ap-form]");if(!form)return;
    event.preventDefault();const name=form.dataset.apForm;const values=formValues(form);
    if(name==="reset"&&values.password!==values.confirmPassword){setStatus("De wachtwoorden komen niet overeen.",true);return;}
    try{await authAction(name,values);if(["register","forgot","resend","reset"].includes(name)){form.reset();}if(name==="reset"||name==="verify-email")history.replaceState(null,"",location.pathname);}catch(error){setStatus(error.message||"De bewerking is mislukt.",true);}
  });
  root.addEventListener("click",async event=>{
    const el=event.target.closest("[data-ap-action]");if(!el)return;
    const action=el.dataset.apAction;
    try{
      if(action==="verify-email"){const params=new URLSearchParams(location.search);const r=await request("/v1/auth/verify-email",{method:"POST",body:body({token:params.get("verifyEmail")})});token=r.accessToken;user=r.user;history.replaceState(null,"",location.pathname);setStatus("E-mailadres bevestigd. Je account is actief.");resetIdle();render();return;}
      if(action==="accept-invite"){if(!user){setStatus("Log eerst in met het uitgenodigde e-mailadres.",true);return;}const params=new URLSearchParams(location.search);const r=await request("/v1/household-invitations/accept",{method:"POST",body:body({token:params.get("acceptInvite")})});history.replaceState(null,"",location.pathname);activeHousehold=r.householdId;setStatus("Uitnodiging geaccepteerd.");render();return;}
      if(action==="logout"){await logout();return;}
      if(action==="refresh-account"){const r=await request("/v1/account");user=r.user;await updateHouseholds();await checkCloud();setStatus("Accountgegevens bijgewerkt.");return;}
      if(action==="sync-check"){await syncCheck();return;}
      if(action==="sync-push"){await syncCheck();await pushLocal();return;}
      if(action==="sync-pull"){await pullCloud();return;}
      if(action==="cloud-revisions"){await showRevisions();return;}
      if(action==="restore-cloud-revision"){await restoreCloudRevision(Number(el.dataset.version));return;}
      if(action==="mfa-setup"){const r=await request("/v1/auth/mfa/setup",{method:"POST",body:"{}"});const panel=root.querySelector("#mfa-setup-panel");if(panel)panel.innerHTML='<p>Voer deze secret handmatig in je authenticator in en bevestig met de code:</p><p><code>'+esc(r.secret)+'</code></p><p class="ap-muted">TOTP-URI</p><p><code class="ap-uri">'+esc(r.otpauthUri)+'</code></p>';mfaPending=true;setStatus("Authenticatorsecret aangemaakt. Laat deze niet aan anderen zien.");return;}
      if(action==="mfa-disable"){root.querySelector('[data-ap-form="mfa-disable"]')?.scrollIntoView({behavior:"smooth",block:"center"});return;}
      if(action==="inventory"){const box=root.querySelector("#ap-inventory");if(box)box.innerHTML=localInventory();return;}
      if(action==="restore-local-revision"){if(!window.ProjectN01VersionHistory)throw new Error("Versiegeschiedenis is niet beschikbaar.");const revision=await window.ProjectN01VersionHistory.get("project-n-01-life-v1",Number(el.dataset.revisionId));if(!revision?.raw)throw new Error("Deze herstelversie is ongeldig.");if(!confirm("Deze versleutelde versie wordt de actieve lokale kluis. De huidige kluis wordt eerst bewaard. Doorgaan?"))return;await archiveLocal();localStorage.setItem(VAULT_KEY,revision.raw);setStatus("Lokale versie teruggezet. De app wordt opnieuw geopend.");location.reload();return;}
      if(action==="revoke-consent"){const id=el.dataset.consentId;const household=el.dataset.householdId;if(!id||!household)throw new Error("Toestemming kon niet worden geselecteerd.");if(!confirm("Deze toestemming intrekken?"))return;await request("/v1/households/"+encodeURIComponent(household)+"/consents/"+encodeURIComponent(id),{method:"DELETE"});setStatus("Toestemming ingetrokken.");await loadConsents(household);return;}
      if(action==="export-calendar"){if(!window.ProjectN01LifeSuite?.getCalendarIcs)throw new Error("Ontgrendel de persoonlijke kluis in Mijn leven om je agenda veilig te exporteren.");downloadText(window.ProjectN01LifeSuite.getCalendarIcs(),"text/calendar;charset=utf-8","project-n-01-agenda.ics");setStatus("Agenda geëxporteerd. Controleer het bestand voordat je het deelt.");return;}
      if(action==="weekly-report"){await renderWeeklyReport();setStatus("Weekoverzicht gemaakt; alleen lokaal weergegeven.");return;}
      if(action==="export-weekly-report"){exportWeeklyReport();return;}
    }catch(error){setStatus(error.message||"De bewerking is mislukt.",true);}
  });
  root.addEventListener("change",event=>{
    if(event.target?.id==="ap-household-select"&&event.target.value)loadMembers(event.target.value).catch(e=>setStatus(e.message,true));
    if(event.target?.name==="scopes"){const edit=root.querySelectorAll('[data-ap-form="consent"] input[name="editScopes"]');edit.forEach(box=>{if(box.value===event.target.value&& !event.target.checked)box.checked=false;});}
  });
  ["pointerdown","keydown","touchstart"].forEach(name=>document.addEventListener(name,()=>resetIdle(),{passive:true}));
  window.addEventListener("pagehide",()=>{clearTimeout(idleTimer);token="";user=null;});
  window.ProjectN01AccountPortal=Object.freeze({clearSession:()=>logout(false)});
  const params=new URLSearchParams(location.search);
  render();
  if(params.get("verifyEmail"))setStatus("Klik op E-mailadres bevestigen om het account te activeren.");
  if(params.get("resetPassword"))setStatus("Stel een nieuw wachtwoord in via de kaart hierboven.");
  if(params.get("acceptInvite"))setStatus("Meld je aan met het e-mailadres waarop de uitnodiging is ontvangen.");
})();