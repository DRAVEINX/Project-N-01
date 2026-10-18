/* Project N-01 professional workspace.
 * Personal content is stored through the existing encrypted Life Suite vault bridge.
 * Account and sync features require a separately deployed server/api.mjs.
 */
(function () {
  "use strict";
  const root = document.getElementById("professional-suite-root");
  if (!root) return;

  const metaApi = document.querySelector('meta[name="project-n01-api-base"]');
  const API_BASE = String(window.PROJECT_N01_API_BASE || (metaApi && metaApi.content) || "/api").replace(/\/+$/, "");
  const MAX_FILE_BYTES = 512 * 1024;
  const uid = () => "pn-" + crypto.getRandomValues(new Uint32Array(3)).join("-");
  const clone = value => JSON.parse(JSON.stringify(value));
  const escapeHtml = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const nl = new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium", timeStyle: "short" });
  let activeTab = "goals";
  let accountToken = "";
  let accountUser = null;
  let apiAvailable = false;
  let apiStatus = "API nog niet gecontroleerd";
  let apiFeatures = null;
  let knownServerRevision = null;
  let remoteRecord = null;
  let conflictRecord = null;
  let saveTimer = null;
  let pendingTwoFactorSetup = null;
  let speechRecognition = null;
  let lastStatus = "";
  let lastStatusError = false;

  function vault() { return window.ProjectN01Vault || null; }
  function unlocked() { return Boolean(vault() && vault().isUnlocked()); }
  function getProfessional() { return unlocked() ? (vault().readProfessional() || {}) : null; }
  function getSnapshot() { return unlocked() ? vault().readSnapshot() : null; }
  function blankProfessional() {
    return {goals:[],documents:[],versions:[],handovers:[],absences:[],dailyProgress:null,
      emergencyPlan:{instructions:"",supportNeeds:"",preferredHelp:"",updatedAt:""},
      reportPreferences:{includeMood:true,includeRoutineProgress:true,includeAppointments:true}};
  }
  function normalizeProfessional(value) {
    const blank = blankProfessional();
    if (!value || typeof value !== "object") return blank;
    const copy = Object.assign(blank, value);
    for (const key of ["goals","documents","versions","handovers","absences"]) if (!Array.isArray(copy[key])) copy[key] = [];
    copy.emergencyPlan = Object.assign(blank.emergencyPlan, copy.emergencyPlan || {});
    copy.reportPreferences = Object.assign(blank.reportPreferences, copy.reportPreferences || {});
    return copy;
  }
  async function saveProfessional(value, label) {
    if (!unlocked()) { status("Ontgrendel eerst de persoonlijke kluis om dit veilig op te slaan.", true); return false; }
    const okay = await vault().saveProfessional(normalizeProfessional(value), label);
    status(okay ? "Veilig opgeslagen in de versleutelde persoonlijke kluis." : "Opslaan is mislukt. Controleer de beschikbare opslagruimte.", !okay);
    return okay;
  }
  function status(message, isError) {
    lastStatus = message || "";
    lastStatusError = Boolean(isError);
    const node = root.querySelector("#pn-professional-status");
    if (node) {
      node.textContent = lastStatus;
      node.classList.toggle("is-error", lastStatusError);
    }
  }
  function button(action, label, className) {
    return '<button type="button" class="' + (className || "pn-button") + '" data-pn-action="' + escapeHtml(action) + '">' + label + "</button>";
  }
  function card(title, content, subtitle) {
    return '<section class="pn-card"><div class="pn-card-heading"><div><h3>' + title + '</h3>' + (subtitle ? '<p>' + subtitle + "</p>" : "") + '</div></div>' + content + "</section>";
  }
  function field(label, name, value, type, extras) {
    const tag = type === "textarea" ? '<textarea name="' + name + '" ' + (extras || "") + ">" + escapeHtml(value || "") + "</textarea>" :
      '<input name="' + name + '" type="' + (type || "text") + '" value="' + escapeHtml(value || "") + '" ' + (extras || "") + ">";
    return '<label class="pn-field"><span>' + label + "</span>" + tag + "</label>";
  }
  function stateSummary() {
    const s = getSnapshot();
    if (!s) return null;
    const p = normalizeProfessional(s.professional);
    return {snapshot:s, professional:p, role:(s.profiles || []).find(x => x.id === s.currentProfileId)?.role || "self"};
  }
  function renderLocked() {
    root.innerHTML = '<section class="pn-locked"><div class="pn-heading"><div><p class="eyebrow">PROJECT N-01 · EXTRA HULPMIDDELEN</p><h2>Persoonlijke hulpmiddelen</h2></div></div><p>De extra functies gebruiken dezelfde lokale versleutelde kluis als Mijn leven. Ontgrendel de kluis hierboven om doelen, documenten, noodplan en weekrapporten te bekijken of op te slaan.</p><p class="pn-privacy-note">Accounts en synchronisatie staan los van de lokale kluis en werken pas als de API-server is ingericht.</p></section>';
  }
  function render() {
    if (!unlocked()) { renderLocked(); return; }
    const data = stateSummary();
    const p = data.professional;
    const tabs = [
      ["goals","Doelen & activiteiten"],["emergency","Mijn noodplan"],["support","Begeleidersportaal"],
      ["documents","Documenten"],["reports","Weekrapport"],["accessibility","Toegankelijkheid"],
      ["versions","Herstel & versies"],["accounts","Accounts & synchronisatie"]
    ];
    const tabHtml = tabs.map(t => '<button type="button" class="pn-tab' + (activeTab===t[0]?" active":"") + '" data-pn-tab="' + t[0] + '" aria-pressed="' + (activeTab===t[0]?"true":"false") + '">' + t[1] + "</button>").join("");
    let content = "";
    if (activeTab === "goals") content = goalsView(p);
    else if (activeTab === "emergency") content = emergencyView(p, data.snapshot);
    else if (activeTab === "support") content = supportView(p, data.snapshot, data.role);
    else if (activeTab === "documents") content = documentsView(p);
    else if (activeTab === "reports") content = reportsView(p, data.snapshot);
    else if (activeTab === "accessibility") content = accessibilityView();
    else if (activeTab === "versions") content = versionsView(p);
    else content = accountsView();
    root.innerHTML = '<div class="pn-professional"><header class="pn-heading"><div><p class="eyebrow">PROJECT N-01 · EXTRA HULPMIDDELEN</p><h2>Dagelijkse ondersteuning</h2><p>Doelen, noodinformatie, documenten en rapporten op één plek.</p></div><span class="pn-vault-tag"><span aria-hidden="true">🔒</span> Versleutelde kluis actief</span></header><nav class="pn-tabs" aria-label="Professionele hulpmiddelen">' + tabHtml + '</nav><div id="pn-professional-status" role="status" aria-live="polite" class="' + (lastStatusError?"is-error":"") + '">' + escapeHtml(lastStatus) + '</div><div class="pn-content">' + content + '</div><p class="pn-footnote">Lokale rechten en profielen zijn op zichzelf geen beveiligde online accountrechten. Deel gevoelige gegevens alleen wanneer je begrijpt wie er toegang krijgt.</p></div>';
    if (activeTab === "accounts") refreshApiHealth();
    const saved = root.querySelector("#pn-professional-status");
    if (saved && lastStatus) saved.textContent = lastStatus;
  }
  function goalsView(p) {
    const goals = p.goals.map(g => {
      const done = g.status === "done";
      const percent = Math.max(0,Math.min(100,Number(g.progress)||0));
      return '<article class="pn-item"><div class="pn-item-heading"><div><h4>' + escapeHtml(g.title) + '</h4><p>' + escapeHtml(g.category || "Persoonlijk doel") + (g.dueDate ? " · Doeldatum: " + escapeHtml(g.dueDate) : "") + '</p></div><span class="pn-pill">' + (done ? "Afgerond" : percent + "%") + '</span></div><p>' + escapeHtml(g.description || "") + '</p><div class="pn-progress" aria-label="Voortgang ' + percent + '%"><span style="width:' + percent + '%"></span></div><div class="pn-item-actions">' + button("goal-progress:" + g.id, "Voortgang aanpassen") + button("goal-done:" + g.id, done ? "Opnieuw openen" : "Afronden") + button("goal-delete:" + g.id, "Verwijderen", "pn-button subtle") + '</div></article>';
    }).join("");
    return card("Een stap tegelijk", '<p>Maak een haalbaar doel of activiteit en houd je voortgang bij. Je dagboektekst wordt niet in rapporten opgenomen.</p><form id="pn-goal-form" class="pn-form-grid">' + field("Naam van het doel","title","","text",'required maxlength="120"') + field("Soort","category","Dagelijks leven","text",'maxlength="80"') + field("Doeldatum","dueDate","","date") + field("Voortgang in procent","progress","0","number",'min="0" max="100"') + field("Kleine volgende stap","description","","textarea",'rows="3" maxlength="1200"') + '<div class="pn-form-actions"><button class="pn-button primary" type="submit">Doel bewaren</button></div></form>' + (goals || '<p class="pn-empty">Nog geen doelen. Begin klein, bijvoorbeeld: tas klaarzetten of een wandeling maken.</p>'), "Persoonlijke doelen en geplande activiteiten") + card("Snelle activiteiten", '<p>Ook een activiteit zonder einddoel kan hier worden bewaard. Gebruik een korte omschrijving en kies zelf wanneer je eraan werkt.</p>' + button("goal-quick","Activiteit snel toevoegen","pn-button primary"));
  }
  function emergencyView(p, s) {
    const e = p.emergencyPlan || {};
    const contacts = (s.contacts || []).map(c => '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.name) + (c.phone ? " · " + escapeHtml(c.phone) : "") + "</option>").join("");
    return card("Mijn persoonlijke noodplan", '<p>Leg in eigen woorden vast wat helpt wanneer je in paniek bent, overprikkeld raakt of ondersteuning nodig hebt. Dit plan belt niemand automatisch.</p><form id="pn-emergency-form" class="pn-form-grid">' + field("Wat moet iemand weten?","instructions",e.instructions,"textarea",'rows="4" maxlength="4000"') + field("Wat helpt mij rustig te worden?","supportNeeds",e.supportNeeds,"textarea",'rows="3" maxlength="2500"') + field("Wat is een goede eerste stap?","preferredHelp",e.preferredHelp,"textarea",'rows="3" maxlength="2500"') + '<label class="pn-field"><span>Vertrouwd contact (uit je contacten)</span><select name="contactId"><option value="">Geen selectie</option>' + contacts + "</select></label>" + '<div class="pn-form-actions"><button class="pn-button primary" type="submit">Noodplan veilig bewaren</button>' + button("read-emergency","Lees het noodplan voor") + '</div></form><div class="pn-warning" role="note">Bij direct levensgevaar bel je zelf 112. Deze app verstuurt geen automatische noodoproep en bevestigt niet dat hulp is geregeld.</div>', "Alleen informatie die jij bewust opslaat. Standaard niet opgenomen in het weekrapport.");
  }
  function supportView(p, s, role) {
    const workerList = (s.workers || []).map(w => '<li>' + escapeHtml(w.name || "Begeleider") + ' <span>' + escapeHtml(w.role || "") + "</span></li>").join("");
    const handovers = p.handovers.map(h => '<article class="pn-item"><div class="pn-item-heading"><h4>' + escapeHtml(h.title || "Overdracht") + '</h4><span class="pn-pill">' + escapeHtml(h.date || "") + '</span></div><p>' + escapeHtml(h.note || "") + '</p><div class="pn-item-actions">' + button("handover-delete:" + h.id, "Verwijderen", "pn-button subtle") + '</div></article>').join("");
    const absences = p.absences.map(a => '<article class="pn-item"><div class="pn-item-heading"><h4>' + escapeHtml(a.name || "Afwezigheid") + '</h4><span class="pn-pill">' + escapeHtml(a.date || "") + '</span></div><p>' + escapeHtml(a.reason || "") + '</p><div class="pn-item-actions">' + button("absence-delete:" + a.id, "Verwijderen", "pn-button subtle") + '</div></article>').join("");
    return card("Begeleiders en rooster", '<p>De namen komen uit het bestaande rooster. Wijzigingen in het rooster kun je via de tab <strong>Wie werkt er?</strong> in Mijn leven beheren.</p><ul class="pn-worker-list">' + (workerList || "<li>Nog geen begeleiders ingevoerd.</li>") + "</ul><p>Huidig lokaal profiel: <strong>" + escapeHtml(role) + "</strong>. Dit profiel is een lokale organisatorische keuze, niet een aparte online beveiligingsgrens.</p>") +
      card("Overdracht noteren", '<form id="pn-handover-form" class="pn-form-grid">' + field("Titel","title","","text",'required maxlength="120"') + field("Datum","date",new Date().toISOString().slice(0,10),"date",'required') + field("Overdracht of aandachtspunt","note","","textarea",'rows="4" maxlength="3000" required') + '<div class="pn-form-actions"><button class="pn-button primary" type="submit">Overdracht veilig bewaren</button>' + button("dictate:note","Spreek tekst in") + '</div></form>' + (handovers || '<p class="pn-empty">Nog geen overdrachtsnotities.</p>'), "Alleen toegankelijk in de ontgrendelde kluis") +
      card("Afwezigheid en vervanging", '<form id="pn-absence-form" class="pn-form-grid">' + field("Naam of dienst","name","","text",'required maxlength="120"') + field("Datum","date",new Date().toISOString().slice(0,10),"date",'required') + field("Reden of vervanging","reason","","textarea",'rows="2" maxlength="1000"') + '<div class="pn-form-actions"><button class="pn-button primary" type="submit">Afwezigheid bewaren</button></div></form>' + (absences || '<p class="pn-empty">Nog geen afwezigheden geregistreerd.</p>'));
  }
  function documentsView(p) {
    const items = p.documents.map(d => '<article class="pn-item"><div class="pn-item-heading"><div><h4>' + escapeHtml(d.title) + '</h4><p>' + escapeHtml(d.kind || "Document") + (d.updatedAt ? " · " + escapeHtml(new Date(d.updatedAt).toLocaleDateString()) : "") + '</p></div></div><p>' + escapeHtml(d.description || "") + '</p>' + (d.dataUrl ? '<p>Bestand bewaard in de versleutelde kluis (' + Math.round((d.size || 0)/1024) + " KB).</p>" : "<p>Alleen documentnotitie, geen bestand.</p>") + '<div class="pn-item-actions">' + (d.dataUrl ? button("document-download:" + d.id,"Bestand openen") : "") + button("document-delete:" + d.id,"Verwijderen","pn-button subtle") + '</div></article>').join("");
    return card("Persoonlijke documenten", '<p>Bewaar bijvoorbeeld praktische instructies of een documentverwijzing. Bestanden blijven in de lokale kluis en worden bij synchronisatie alleen als versleutelde kluis verstuurd. Ze worden niet automatisch gedeeld met begeleiders.</p><form id="pn-document-form" class="pn-form-grid">' + field("Titel","title","","text",'required maxlength="120"') + field("Soort document","kind","Instructie","text",'maxlength="80"') + field("Waarvoor is dit document?","description","","textarea",'rows="2" maxlength="1200"') + '<label class="pn-field"><span>Bestand (max. 512 KB)</span><input name="file" type="file"></label><div class="pn-form-actions"><button class="pn-button primary" type="submit">Document veilig bewaren</button></div></form>' + (items || '<p class="pn-empty">Nog geen documenten bewaard.</p>'), "Bewaar alleen bestanden waarvoor je het recht hebt ze op dit apparaat op te slaan.");
  }
  function reportsView(p, s) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const recentMoods = (s.moods || []).filter(m => Date.parse(m.at || m.createdAt || m.date || "") >= start.getTime());
    const recentAppointments = (s.appointments || []).filter(a => a.date >= start.toISOString().slice(0,10) && a.date <= now.toISOString().slice(0,10));
    const recentPlans = (s.weeklyPlans || []).filter(a => a.date >= start.toISOString().slice(0,10) && a.date <= now.toISOString().slice(0,10));
    const donePlans = recentPlans.filter(a => a.done === true || a.status === "done").length;
    return card("Weekoverzicht", '<p>Periode: ' + escapeHtml(start.toLocaleDateString()) + " t/m " + escapeHtml(now.toLocaleDateString()) + '</p><div class="pn-stats"><div><strong>' + recentAppointments.length + '</strong><span>Afspraken</span></div><div><strong>' + donePlans + " / " + recentPlans.length + '</strong><span>Geplande taken afgerond</span></div><div><strong>' + recentMoods.length + '</strong><span>Stemmingsmomenten</span></div></div><form id="pn-report-form" class="pn-checklist"><label><input type="checkbox" name="includeAppointments" ' + (p.reportPreferences.includeAppointments !== false ? "checked" : "") + '> Aantal afspraken opnemen</label><label><input type="checkbox" name="includeRoutineProgress" ' + (p.reportPreferences.includeRoutineProgress !== false ? "checked" : "") + '> Voortgang geplande taken opnemen</label><label><input type="checkbox" name="includeMood" ' + (p.reportPreferences.includeMood !== false ? "checked" : "") + '> Alleen het aantal stemmingsmomenten opnemen (geen gevoelens of dagboektekst)</label><button class="pn-button primary" type="submit">Rapportvoorkeuren bewaren</button></form><div class="pn-form-actions">' + button("print-report","Rapport afdrukken / als PDF bewaren") + button("export-calendar","Agenda exporteren als .ics") + '</div><p class="pn-privacy-note">Voor het printen wordt geen dagboektekst, audio-opname, noodplan, documentinhoud of contactinformatie toegevoegd. Rapporten worden niet automatisch gedeeld.</p>', "Eenvoudig weekrapport zonder dagboekinhoud") +
      card("Wat telt mee?", '<ul class="pn-checklist static"><li>Voltooide taken uit de weekplanning</li><li>Afspraak-aantallen in de gekozen periode</li><li>Aantallen stemmingmomenten, nooit de notities</li><li>Persoonlijke doelen zijn apart zichtbaar op de tab Doelen</li></ul>');
  }
  function accessibilityView() {
    return card("Toegankelijkheid", '<p>Kies hoe de app voor jou prettiger werkt. De instellingen zijn alleen visueel en worden lokaal in deze versleutelde kluis bewaard.</p><form id="pn-accessibility-form" class="pn-checklist"><label><input type="checkbox" name="simpleMode"> Eenvoudige weergave met minder afleiding</label><label><input type="checkbox" name="largeControls"> Extra grote knoppen en velden</label><label><input type="checkbox" name="highContrast"> Extra contrast</label><label><input type="checkbox" name="reducedMotion"> Minder beweging</label><div class="pn-form-actions"><button class="pn-button primary" type="submit">Toegankelijkheid bewaren</button>' + button("read-page","Lees deze pagina voor") + '</div></form><div class="pn-item"><h4>Spraak-naar-tekst</h4><p>Beschikbaar als de browser of het apparaat Web Speech ondersteunt. De spraakherkenning kan internet gebruiken; bespreek geen gevoelige informatie via spraakherkenning als je niet zeker weet hoe het apparaat die verwerkt.</p>' + button("dictate:note","Probeer spraak naar tekst") + '</div><div class="pn-item"><h4>Schermlezer</h4><p>De knoppen hebben labels en statusmeldingen. Volledige TalkBack-validatie moet nog op echte Android-telefoons en -tablets worden uitgevoerd.</p></div>');
  }
  function versionsView(p) {
    const versions = p.versions.slice().reverse().map(v => '<article class="pn-item"><div class="pn-item-heading"><div><h4>' + escapeHtml(v.label || "Herstelpunt") + '</h4><p>' + escapeHtml(v.at ? nl.format(new Date(v.at)) : "") + '</p></div></div>' + button("version-restore:" + v.id,"Deze versie herstellen","pn-button") + '</article>').join("");
    const info = vault().storageOverview();
    return card("Herstelpunten", '<p>De laatste tien versies van deze extra persoonlijke gegevens worden meeversleuteld met je kluis. Herstellen vervangt de extra gegevens met een eerdere versie. De agenda, dagboek en andere onderdelen worden niet teruggezet door deze knop.</p>' + (versions || '<p class="pn-empty">Na de eerste wijziging ontstaat een herstelpunt.</p>'), "Versiegeschiedenis van doelen, documenten, noodplan en overdracht") +
      card("Gegevens op dit apparaat", '<dl class="pn-storage-list"><dt>Status kluis</dt><dd>' + (info.unlocked ? "Ontgrendeld" : "Vergrendeld") + '</dd><dt>Versleutelde kluis aanwezig</dt><dd>' + (info.encryptedVaultPresent ? "Ja" : "Nee") + '</dd><dt>Omvang versleutelde inhoud</dt><dd>' + Math.round(info.encryptedEnvelopeCharacters/1024) + ' KB (tekens, geen bestandsschatting)</dd><dt>Afspraken</dt><dd>' + (info.records ? info.records.appointments : "—") + '</dd><dt>Persoonlijke documenten</dt><dd>' + (info.records ? info.records.documents : "—") + '</dd><dt>Dagelijkse routines en voorkeuren</dt><dd>Controleer ook de legacy-sleutels hieronder; die kunnen nog niet-versleutelde oude gegevens bevatten.</dd></dl><p class="pn-warning">Bekende historische lokale sleutels: ' + escapeHtml(info.legacyPlaintextKeys.join(", ")) + '. Controleer de migratie voordat je de app voor zeer gevoelige gegevens gebruikt.</p>');
  }
  function accountsView() {
    const userView = accountUser ? '<div class="pn-account-signed-in"><p>Aangemeld als <strong>' + escapeHtml(accountUser.displayName || accountUser.email) + '</strong> (' + escapeHtml(accountUser.email) + ')</p><p>Tweestapsverificatie: ' + (accountUser.twoFactorEnabled ? "ingeschakeld" : "niet ingeschakeld") + '</p>' + button("account-2fa-setup","Tweestapsverificatie instellen") + button("account-logout","Uitloggen") + '</div>' : '<div class="pn-account-grid"><form id="pn-register-form" class="pn-form-grid"><h4>Nieuw account</h4>' + field("Naam","displayName","","text",'required maxlength="80"') + field("E-mailadres","email","","email",'required autocomplete="email"') + field("Wachtwoord (minstens 12 tekens)","password","","password",'required minlength="12" maxlength="200" autocomplete="new-password"') + '<div class="pn-form-actions"><button class="pn-button primary" type="submit">Account maken</button></div></form><form id="pn-login-form" class="pn-form-grid"><h4>Inloggen</h4>' + field("E-mailadres","email","","email",'required autocomplete="username"') + field("Wachtwoord","password","","password",'required autocomplete="current-password"') + field("Authenticatorcode (indien ingeschakeld)","code","","text",'inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"') + '<div class="pn-form-actions"><button class="pn-button primary" type="submit">Inloggen</button></div></form><form id="pn-reset-request-form" class="pn-form-grid"><h4>Wachtwoord vergeten?</h4>' + field("E-mailadres","email","","email",'required autocomplete="email"') + '<div class="pn-form-actions"><button class="pn-button" type="submit">Herstelmail aanvragen</button></div><p class="pn-muted">Wachtwoordherstel werkt alleen als de beheerder e-mailbezorging heeft ingesteld.</p></form></div>';
    const twoFactor = pendingTwoFactorSetup ? '<div class="pn-item"><h4>Tweestapsverificatie afmaken</h4><p>Voeg dit geheim toe aan je authenticator-app en bevestig met een actuele zescijferige code.</p><code class="pn-secret">' + escapeHtml(pendingTwoFactorSetup.secret) + '</code><p><a href="' + escapeHtml(pendingTwoFactorSetup.otpauthUri) + '">Open authenticatorlink</a></p><form id="pn-2fa-enable-form" class="pn-form-grid">' + field("Zescijferige code","code","","text",'required inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"') + '<button type="submit" class="pn-button primary">Tweestapsverificatie activeren</button></form></div>' : "";
    const resetToken = new URLSearchParams((location.hash.split("?")[1] || "")).get("token");
    const resetConfirm = resetToken ? '<form id="pn-reset-confirm-form" class="pn-form-grid"><h4>Nieuw wachtwoord instellen</h4><input type="hidden" name="token" value="' + escapeHtml(resetToken) + '">' + field("Nieuw wachtwoord (minstens 12 tekens)","password","","password",'required minlength="12" maxlength="200" autocomplete="new-password"') + '<button class="pn-button primary" type="submit">Wachtwoord wijzigen</button></form>' : "";
    return card("Echte accounts", '<p>Accounts gebruiken een server, geen lokale profielnaam. Wachtwoorden worden op de server als scrypt-hash opgeslagen; de API geeft een tijdelijke sessietoken uit die deze pagina alleen in het geheugen houdt. Accountdata en synchronisatie staan los van je lokale kluiswachtzin.</p><div id="pn-api-health" role="status">' + escapeHtml(apiStatus) + '</div>' + userView + twoFactor + resetConfirm, "Benodigde serverinstellingen staan in docs/ACCOUNT-SYNC-SETUP.md") +
      card("Versleutelde synchronisatie", '<p>De server ontvangt alleen de versleutelde kluisenveloppe. De server kan de dagboektekst niet lezen. Versieconflicten worden expliciet gemeld en niet automatisch overschreven.</p><div class="pn-form-actions">' + button("sync-check","Cloudversie controleren") + button("sync-push","Deze versleutelde kluis uploaden") + button("sync-pull","Cloudversie downloaden en lokaal vervangen") + '</div><p id="pn-sync-status" role="status" aria-live="polite">Nog niet gesynchroniseerd in deze sessie.</p><p class="pn-warning">Downloaden vervangt de lokale kluis en vergrendelt de app. Maak eerst een lokale back-up en gebruik dezelfde kluiswachtzin op al je apparaten. Uitnodigingen geven nog geen toegang tot de versleutelde inhoud van een andere gebruiker.</p>', "Bewust handmatig totdat een veilige conflict- en sleuteluitwisselingsworkflow getest is") +
      card("Begeleiders en toestemming", '<p>Remote uitnodigingen vragen om een bezorgwebhook op de API-server. Rol en scopes worden aan de server gekoppeld. Het delen van de daadwerkelijk versleutelde kluis met genodigden is in deze versie uitgeschakeld; er wordt geen toegang beloofd die nog niet technisch mogelijk is.</p>' + (accountUser ? '<form id="pn-invite-form" class="pn-form-grid">' + field("E-mailadres begeleider/ouder/voogd","email","","email",'required autocomplete="email"') + '<label class="pn-field"><span>Rol</span><select name="role"><option value="caregiver">Begeleider</option><option value="parent">Ouder</option><option value="guardian">Voogd</option></select></label><div class="pn-checklist"><label><input type="checkbox" name="scope" value="calendar" checked> Agenda</label><label><input type="checkbox" name="scope" value="routines"> Routines</label><label><input type="checkbox" name="scope" value="roster" checked> Rooster</label><label><input type="checkbox" name="scope" value="goals"> Doelen</label><label><input type="checkbox" name="scope" value="documents"> Documenten</label><label><input type="checkbox" name="scope" value="reports"> Rapporten</label><label><input type="checkbox" name="scope" value="emergency"> Noodplan</label></div><button type="submit" class="pn-button primary">Uitnodiging aanvragen</button></form>' : "<p>Log eerst in om een uitnodiging voor een account aan te vragen.</p>"), "Toestemming is beperkt, herroepbaar en nooit standaard aan");
  }

  async function api(path, options) {
    const headers = Object.assign({"content-type":"application/json"}, options && options.headers || {});
    if (accountToken) headers.authorization = "Bearer " + accountToken;
    const response = await fetch(API_BASE + path, Object.assign({method:"GET",headers,credentials:"omit",cache:"no-store"}, options || {}, {headers}));
    let result = {};
    try { result = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(result.message || result.error || ("HTTP " + response.status));
      error.status = response.status;
      error.payload = result;
      throw error;
    }
    return result;
  }
  async function refreshApiHealth() {
    try {
      const data = await api("/health");
      apiAvailable = Boolean(data.ok);
      apiFeatures = data;
      apiStatus = "API online · accounts en versleutelde synchronisatie beschikbaar" + (data.accountRecoveryDeliveryConfigured ? "" : " · herstelmail nog niet geconfigureerd");
    } catch {
      apiAvailable = false;
      apiStatus = "API niet bereikbaar. Stel PROJECT_N01_API_BASE in en start/deploy server/api.mjs; de lokale kluis blijft beschikbaar.";
    }
    const node = root.querySelector("#pn-api-health");
    if (node) node.textContent = apiStatus;
  }
  async function updateSyncStatus(message, isError) {
    const node = root.querySelector("#pn-sync-status");
    if (node) {
      node.textContent = message;
      node.classList.toggle("is-error", Boolean(isError));
    } else status(message, isError);
  }
  function saveDownload(filename, text, mime) {
    const url = URL.createObjectURL(new Blob([text],{type:mime || "application/octet-stream"}));
    const a = document.createElement("a");a.href=url;a.download=filename;a.hidden=true;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportCalendar() {
    const s=getSnapshot(); if(!s) return;
    const appointments=(s.appointments||[]).filter(a=>a.date);
    if(!appointments.length){status("Er zijn geen afspraken om te exporteren.");return;}
    const escIcs=v=>String(v||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
    const datePart=(date,time)=>String(date||"").replace(/-/g,"")+"T"+String(time||"0000").replace(/:/g,"").padEnd(6,"0").slice(0,6)+"00";
    const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Project N-01//NL","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
    appointments.forEach(a=>{
      const end=a.end || a.start || "0000";
      lines.push("BEGIN:VEVENT","UID:"+escIcs(a.id||uid())+"@project-n-01","DTSTAMP:"+new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,""),
        "DTSTART:"+datePart(a.date,a.start),"DTEND:"+datePart(a.date,end),"SUMMARY:"+escIcs(a.title),
        "LOCATION:"+escIcs(a.location),"END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    saveDownload("project-n-01-agenda.ics",lines.join("\r\n"),"text/calendar;charset=utf-8");
    status("Agenda-export aangemaakt. Controleer het bestand voordat je het deelt.");
  }
  function printReport() {
    const p=getProfessional(),s=getSnapshot();if(!p||!s)return;
    const start=new Date();start.setDate(start.getDate()-6);
    const startKey=start.toISOString().slice(0,10),endKey=new Date().toISOString().slice(0,10);
    const appts=(s.appointments||[]).filter(a=>a.date>=startKey&&a.date<=endKey);
    const plans=(s.weeklyPlans||[]).filter(a=>a.date>=startKey&&a.date<=endKey);
    const moods=(s.moods||[]).filter(m=>Date.parse(m.at||m.createdAt||m.date||"")>=start.getTime());
    const rows=[];
    rows.push("<h1>Project N-01 — weekrapport</h1><p>Periode "+escapeHtml(start.toLocaleDateString())+" t/m "+escapeHtml(new Date().toLocaleDateString())+"</p>");
    if(p.reportPreferences.includeAppointments!==false)rows.push("<p>Afspraken: "+appts.length+"</p>");
    if(p.reportPreferences.includeRoutineProgress!==false)rows.push("<p>Geplande taken afgerond: "+plans.filter(x=>x.done===true||x.status==="done").length+" van "+plans.length+"</p>");
    if(p.reportPreferences.includeMood!==false)rows.push("<p>Stemmingsmomenten: "+moods.length+"</p>");
    rows.push("<p>Persoonlijke dagboektekst, spraakopnamen en noodplan zijn niet in dit rapport opgenomen.</p>");
    const w=window.open("","_blank","noopener,noreferrer");
    if(!w){status("Pop-up geblokkeerd. Sta afdrukken toe voor deze app.",true);return;}
    w.document.write("<!doctype html><html lang='nl'><meta charset='utf-8'><title>Weekrapport</title><style>body{font:16px system-ui;max-width:760px;margin:3rem auto;padding:0 1rem;line-height:1.6}h1{font-size:1.8rem}@media print{button{display:none}}</style><body>"+rows.join("")+"<button onclick='window.print()'>Afdrukken / PDF</button></body></html>");
    w.document.close();
  }
  async function readFileAsDataUrl(file) {
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Bestand kan niet worden gelezen."));reader.readAsDataURL(file);});
  }
  function startDictation(targetName) {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!Speech){status("Spraak-naar-tekst wordt niet ondersteund in deze browser. Je kunt de tekst ook typen.",true);return;}
    const target=root.querySelector('[name="'+targetName+'"]');
    if(!target){status("Geen tekstveld geselecteerd.",true);return;}
    try {
      speechRecognition=new Speech();speechRecognition.lang=document.documentElement.lang==="en"?"en-US":"nl-NL";speechRecognition.interimResults=false;speechRecognition.maxAlternatives=1;
      speechRecognition.onresult=event=>{target.value=(target.value?target.value+" ":"")+event.results[0][0].transcript;target.dispatchEvent(new Event("input",{bubbles:true}));status("Spraak omgezet naar tekst. Controleer de tekst voordat je deze opslaat.");};
      speechRecognition.onerror=()=>status("Spraakherkenning stopte. Typ de tekst of probeer het opnieuw.",true);
      speechRecognition.start();status("Luisteren gestart. Spreek nu en controleer de tekst voordat je opslaat.");
    }catch{status("Spraakherkenning kon niet starten.",true);}
  }
  function readAloud(text) {
    if(!("speechSynthesis" in window)){status("Voorlezen wordt niet ondersteund door deze browser.",true);return;}
    window.speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(text);utterance.lang=document.documentElement.lang==="en"?"en-US":"nl-NL";
    window.speechSynthesis.speak(utterance);
  }
  async function handleSubmit(event) {
    const form=event.target;
    if(!form.matches("form"))return;
    const fd=new FormData(form);
    if(form.id==="pn-goal-form"){
      event.preventDefault();const p=normalizeProfessional(getProfessional());
      p.goals.unshift({id:uid(),title:String(fd.get("title")||"").trim(),category:String(fd.get("category")||"").trim(),dueDate:String(fd.get("dueDate")||""),progress:Math.max(0,Math.min(100,Number(fd.get("progress"))||0)),description:String(fd.get("description")||"").trim(),status:"open",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      if(await saveProfessional(p,"Doel toegevoegd")){activeTab="goals";render();}return;
    }
    if(form.id==="pn-emergency-form"){
      event.preventDefault();const p=normalizeProfessional(getProfessional());p.emergencyPlan={instructions:String(fd.get("instructions")||"").trim(),supportNeeds:String(fd.get("supportNeeds")||"").trim(),preferredHelp:String(fd.get("preferredHelp")||"").trim(),contactId:String(fd.get("contactId")||""),updatedAt:new Date().toISOString()};
      await saveProfessional(p,"Noodplan bijgewerkt");return;
    }
    if(form.id==="pn-handover-form"){
      event.preventDefault();const p=normalizeProfessional(getProfessional());p.handovers.unshift({id:uid(),title:String(fd.get("title")||"").trim(),date:String(fd.get("date")||""),note:String(fd.get("note")||"").trim(),createdAt:new Date().toISOString()});p.handovers=p.handovers.slice(0,200);
      if(await saveProfessional(p,"Overdracht opgeslagen")){activeTab="support";render();}return;
    }
    if(form.id==="pn-absence-form"){
      event.preventDefault();const p=normalizeProfessional(getProfessional());p.absences.unshift({id:uid(),name:String(fd.get("name")||"").trim(),date:String(fd.get("date")||""),reason:String(fd.get("reason")||"").trim(),createdAt:new Date().toISOString()});p.absences=p.absences.slice(0,200);
      if(await saveProfessional(p,"Afwezigheid opgeslagen")){activeTab="support";render();}return;
    }
    if(form.id==="pn-document-form"){
      event.preventDefault();const file=form.elements.file.files[0];if(file&&file.size>MAX_FILE_BYTES){status("Het bestand is te groot. Gebruik een bestand van maximaal 512 KB.",true);return;}
      const dataUrl=file?await readFileAsDataUrl(file):"";
      const p=normalizeProfessional(getProfessional());p.documents.unshift({id:uid(),title:String(fd.get("title")||"").trim(),kind:String(fd.get("kind")||"").trim(),description:String(fd.get("description")||"").trim(),fileName:file?file.name:"",mimeType:file?file.type:"",size:file?file.size:0,dataUrl:dataUrl,updatedAt:new Date().toISOString()});p.documents=p.documents.slice(0,100);
      if(await saveProfessional(p,"Document toegevoegd")){activeTab="documents";render();}return;
    }
    if(form.id==="pn-report-form"){
      event.preventDefault();const p=normalizeProfessional(getProfessional());p.reportPreferences={includeAppointments:fd.get("includeAppointments")==="on",includeRoutineProgress:fd.get("includeRoutineProgress")==="on",includeMood:fd.get("includeMood")==="on"};
      await saveProfessional(p,"Rapportvoorkeuren bijgewerkt");return;
    }
    if(form.id==="pn-accessibility-form"){
      event.preventDefault();const p=normalizeProfessional(getProfessional());p.accessibility={simpleMode:fd.get("simpleMode")==="on",largeControls:fd.get("largeControls")==="on",highContrast:fd.get("highContrast")==="on",reducedMotion:fd.get("reducedMotion")==="on"};
      if(await saveProfessional(p,"Toegankelijkheidsvoorkeuren bijgewerkt"))applyAccess(p.accessibility);return;
    }
    if(form.id==="pn-register-form"){
      event.preventDefault();try{const result=await api("/auth/register",{method:"POST",body:JSON.stringify({displayName:fd.get("displayName"),email:fd.get("email"),password:fd.get("password")})});setAccount(result);status("Account aangemaakt. Bewaar ook de wachtzin van je lokale kluis apart.");activeTab="accounts";render();}catch(error){status(accountError(error),true);}return;
    }
    if(form.id==="pn-login-form"){
      event.preventDefault();try{const result=await api("/auth/login",{method:"POST",body:JSON.stringify({email:fd.get("email"),password:fd.get("password"),code:fd.get("code")})});
        if(result.requiresTwoFactor){status("Vul de huidige zescijferige code uit je authenticator-app in.",true);form.elements.code.focus();return;}
        setAccount(result);await loadSyncStatus();status("Ingelogd. Controleer eerst of er al een nieuwere cloudversie staat.");activeTab="accounts";render();
      }catch(error){status(accountError(error),true);}return;
    }
    if(form.id==="pn-reset-request-form"){
      event.preventDefault();try{const r=await api("/auth/password-reset/request",{method:"POST",body:JSON.stringify({email:fd.get("email")})});status(r.message || "Als een account bestaat en herstelmail is ingericht, ontvang je instructies.");}catch{status("Herstelaanvraag is niet beschikbaar. Controleer de API en e-mailbezorging.",true);}return;
    }
    if(form.id==="pn-reset-confirm-form"){
      event.preventDefault();try{await api("/auth/password-reset/confirm",{method:"POST",body:JSON.stringify({token:fd.get("token"),password:fd.get("password")})});history.replaceState(null,"",location.pathname+location.search+"#");status("Wachtwoord gewijzigd. Log opnieuw in op elk apparaat.");render();}catch(error){status(accountError(error),true);}return;
    }
    if(form.id==="pn-2fa-enable-form"){
      event.preventDefault();try{const r=await api("/auth/2fa/enable",{method:"POST",body:JSON.stringify({code:fd.get("code")})});accountUser=r.user;pendingTwoFactorSetup=null;render();status("Tweestapsverificatie is ingeschakeld.");}catch(error){status(accountError(error),true);}return;
    }
    if(form.id==="pn-invite-form"){
      event.preventDefault();const scopes=Array.from(form.querySelectorAll('input[name="scope"]:checked')).map(x=>x.value);
      try{await api("/team/invite",{method:"POST",body:JSON.stringify({email:fd.get("email"),role:fd.get("role"),scopes:scopes})});status("Uitnodiging is door de server geaccepteerd voor bezorging. Dit verleent nog geen toegang tot de kluisinhoud.");}catch(error){status(accountError(error),true);}return;
    }
  }
  function accountError(error) {
    if(error && error.status===409) return "Voor dit e-mailadres bestaat al een account. Log in of gebruik wachtwoordherstel.";
    if(error && error.status===503) return "Deze serverfunctie is nog niet geconfigureerd. Controleer docs/ACCOUNT-SYNC-SETUP.md.";
    if(error && error.status===429) return "Te veel pogingen achter elkaar. Wacht even en probeer opnieuw.";
    return error && error.message ? "Actie niet voltooid: " + error.message : "De accountactie is niet voltooid.";
  }
  function setAccount(data) { accountToken=data.token;accountUser=data.user;knownServerRevision=null;remoteRecord=null;conflictRecord=null; }
  async function loadSyncStatus() {
    if(!accountToken)return;
    try {
      remoteRecord=await api("/sync");
      knownServerRevision=remoteRecord.payload ? null : Number(remoteRecord.revision||0);
      await updateSyncStatus(remoteRecord.payload ? "Cloudkluis gevonden (versie "+remoteRecord.revision+"). Kies eerst downloaden of maak bewust een lokale back-up voordat je overschrijft." : "Er staat nog geen kluis in de cloud. De volgende opslag kan versie 1 maken.");
    }catch(error){await updateSyncStatus(accountError(error),true);}
  }
  async function syncCheck() {
    if(!accountToken){await updateSyncStatus("Log eerst in.",true);return;}
    try {
      remoteRecord=await api("/sync");
      knownServerRevision=remoteRecord.payload ? null : Number(remoteRecord.revision||0);
      conflictRecord=null;
      await updateSyncStatus(remoteRecord.payload ? "Cloudversie "+remoteRecord.revision+" gevonden ("+nl.format(new Date(remoteRecord.updatedAt))+"). De lokale kluis is niet aangepast." : "Geen cloudversie gevonden; klaar voor eerste upload.");
    }catch(error){await updateSyncStatus(accountError(error),true);}
  }
  async function syncPush() {
    if(!accountToken){await updateSyncStatus("Log eerst in.",true);return;}
    if(!unlocked()){await updateSyncStatus("Ontgrendel de lokale kluis voordat je synchroniseert.",true);return;}
    try {
      const current=await api("/sync");
      if(current.payload && knownServerRevision===null){
        remoteRecord=current;
        await updateSyncStatus("Veiligheidsstop: de server heeft al gegevens. Download de cloudversie of controleer handmatig en kies pas daarna bewust voor overschrijven.",true);return;
      }
      if(knownServerRevision===null)knownServerRevision=Number(current.revision||0);
      if(Number(current.revision||0)!==knownServerRevision){
        conflictRecord=current;remoteRecord=current;
        await updateSyncStatus("Synchronisatieconflict: cloudversie "+current.revision+" wijkt af van de laatst bevestigde versie "+knownServerRevision+". Er is niets overschreven.",true);return;
      }
      const payload=await vault().exportEncryptedEnvelope();
      const result=await api("/sync",{method:"POST",body:JSON.stringify({baseRevision:knownServerRevision,payload:payload})});
      knownServerRevision=result.revision;remoteRecord={revision:result.revision,payload:payload,updatedAt:result.updatedAt};conflictRecord=null;
      await updateSyncStatus("Versleutelde kluis naar cloudversie "+result.revision+" geüpload.");
    }catch(error){
      if(error && error.status===409){conflictRecord=error.payload;knownServerRevision=null;await updateSyncStatus("Synchronisatieconflict: server heeft nieuwere gegevens. Kies cloud downloaden of maak eerst een back-up.",true);}
      else await updateSyncStatus(accountError(error),true);
    }
  }
  async function syncPull() {
    if(!accountToken){await updateSyncStatus("Log eerst in.",true);return;}
    try {
      const remote=await api("/sync");
      if(!remote.payload){knownServerRevision=0;await updateSyncStatus("Er is nog geen cloudkluis. Maak met Upload de eerste versleutelde kopie.",true);return;}
      if(!window.confirm("Dit vervangt de lokale kluis door de versleutelde cloudversie en vergrendelt de app. Download eerst een lokale back-up als je gegevens wilt bewaren. Doorgaan?"))return;
      if(unlocked()){
        const local=await vault().exportEncryptedEnvelope();
        if(local)saveDownload("project-n-01-lokale-back-up-voor-synchronisatie.json",JSON.stringify(local,null,2),"application/json");
      }
      const okay=await vault().replaceWithEncryptedEnvelope(remote.payload);
      if(!okay){await updateSyncStatus("Cloudbestand is geen geldige Project N-01-kluis.",true);return;}
      knownServerRevision=Number(remote.revision||0);remoteRecord=remote;
      await updateSyncStatus("Cloudkluis lokaal geplaatst en vergrendeld. Ontgrendel met de wachtzin van de cloudkluis.");
    }catch(error){await updateSyncStatus(accountError(error),true);}
  }
  function applyAccess(access) {
    access=access||{};
    document.body.classList.toggle("pn-simple-mode",access.simpleMode===true);
    document.body.classList.toggle("pn-large-controls",access.largeControls===true);
    document.body.classList.toggle("pn-high-contrast",access.highContrast===true);
    document.body.classList.toggle("pn-reduced-motion",access.reducedMotion===true);
  }
  function handleAction(action) {
    const s=getSnapshot(),p=normalizeProfessional(getProfessional());
    if(action==="goal-quick"){const title=window.prompt("Welke kleine activiteit wil je plannen?");if(title&&title.trim()){p.goals.unshift({id:uid(),title:title.trim().slice(0,120),category:"Activiteit",progress:0,status:"open",description:"",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});saveProfessional(p,"Snelle activiteit toegevoegd").then(ok=>{if(ok){activeTab="goals";render();}});}return;}
    if(action.startsWith("goal-progress:")){const item=p.goals.find(g=>g.id===action.slice(14));if(!item)return;const value=window.prompt("Voortgang in procent (0-100)",String(item.progress||0));if(value===null)return;const n=Number(value);if(!Number.isFinite(n)||n<0||n>100){status("Vul een getal van 0 tot 100 in.",true);return;}item.progress=n;item.updatedAt=new Date().toISOString();saveProfessional(p,"Doelvoortgang aangepast").then(()=>{activeTab="goals";render();});return;}
    if(action.startsWith("goal-done:")){const item=p.goals.find(g=>g.id===action.slice(10));if(!item)return;item.status=item.status==="done"?"open":"done";item.progress=item.status==="done"?100:Math.min(99,Number(item.progress)||0);item.updatedAt=new Date().toISOString();saveProfessional(p,"Doelstatus aangepast").then(()=>{activeTab="goals";render();});return;}
    if(action.startsWith("goal-delete:")){if(!window.confirm("Dit doel definitief uit de huidige kluis verwijderen?"))return;p.goals=p.goals.filter(g=>g.id!==action.slice(12));saveProfessional(p,"Doel verwijderd").then(()=>{activeTab="goals";render();});return;}
    if(action.startsWith("handover-delete:")){if(!window.confirm("Deze overdrachtsnotitie verwijderen?"))return;p.handovers=p.handovers.filter(h=>h.id!==action.slice(16));saveProfessional(p,"Overdracht verwijderd").then(()=>{activeTab="support";render();});return;}
    if(action.startsWith("absence-delete:")){if(!window.confirm("Deze afwezigheid verwijderen?"))return;p.absences=p.absences.filter(a=>a.id!==action.slice(15));saveProfessional(p,"Afwezigheid verwijderd").then(()=>{activeTab="support";render();});return;}
    if(action.startsWith("document-delete:")){if(!window.confirm("Dit document en de eventuele bijlage verwijderen?"))return;p.documents=p.documents.filter(d=>d.id!==action.slice(16));saveProfessional(p,"Document verwijderd").then(()=>{activeTab="documents";render();});return;}
    if(action.startsWith("document-download:")){const doc=p.documents.find(d=>d.id===action.slice(18));if(!doc||!doc.dataUrl)return;const a=document.createElement("a");a.href=doc.dataUrl;a.download=doc.fileName||"project-n-01-document";a.click();status("Document geëxporteerd. Het gedownloade bestand staat buiten de beveiligde kluis.");return;}
    if(action.startsWith("version-restore:")){const id=action.slice(15);if(!window.confirm("De extra persoonlijke gegevens herstellen naar deze eerdere versie? De huidige extra gegevens worden als nieuw herstelpunt bewaard."))return;vault().restoreVersion(id).then(ok=>{status(ok?"Eerdere versie hersteld.":"Herstellen is mislukt.",!ok);render();});return;}
    if(action==="read-emergency"){const e=p.emergencyPlan||{};readAloud("Mijn noodplan. "+(e.instructions||"Er zijn geen instructies opgeslagen.")+". Wat helpt mij rustig te worden: "+(e.supportNeeds||"Niet ingevuld")+". Eerste stap: "+(e.preferredHelp||"Niet ingevuld")+".");return;}
    if(action==="read-page"){readAloud(root.querySelector(".pn-content")?.innerText||"");return;}
    if(action==="dictate:note"){startDictation("note");return;}
    if(action==="print-report"){printReport();return;}
    if(action==="export-calendar"){exportCalendar();return;}
    if(action==="account-2fa-setup"){api("/auth/2fa/setup",{method:"POST",body:"{}"}).then(result=>{pendingTwoFactorSetup=result;render();status("Scan of voer de geheime sleutel in je authenticator-app in; bevestig daarna met de code.");}).catch(error=>status(accountError(error),true));return;}
    if(action==="account-logout"){api("/auth/logout",{method:"POST",body:"{}"}).catch(()=>{}).finally(()=>{accountToken="";accountUser=null;knownServerRevision=null;remoteRecord=null;render();status("Je bent uitgelogd.");});return;}
    if(action==="sync-check"){syncCheck();return;}
    if(action==="sync-push"){syncPush();return;}
    if(action==="sync-pull"){syncPull();return;}
  }
  root.addEventListener("click",event=>{
    const tab=event.target.closest("[data-pn-tab]");
    if(tab){activeTab=tab.dataset.pnTab;render();return;}
    const action=event.target.closest("[data-pn-action]");
    if(action){handleAction(action.dataset.pnAction);return;}
  });
  root.addEventListener("submit",handleSubmit);
  root.addEventListener("change",event=>{
    const file=event.target;
    if(file && file.matches('input[type="file"]')&&file.files && file.files[0]&&file.files[0].size>MAX_FILE_BYTES){file.value="";status("Bestand is groter dan 512 KB.",true);}
  });
  window.addEventListener("projectn-vault-state",event=>{
    if(event.detail && event.detail.unlocked){render();const p=getProfessional();if(p&&p.accessibility)applyAccess(p.accessibility);if(accountToken && knownServerRevision!==null) syncPush();}
    else render();
  });
  window.addEventListener("projectn-vault-saved",()=>{
    if(!accountToken||!unlocked()||knownServerRevision===null)return;
    if(saveTimer)clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>syncPush(),1200);
  });
  window.addEventListener("online",()=>{if(accountToken)loadSyncStatus();});
  if(location.hash.includes("reset-password")) activeTab="accounts";
  render();
  refreshApiHealth();
})();
