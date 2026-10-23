/* Project N-01 Daily Life Suite
 * Sensitive module data is stored only as an AES-GCM encrypted local envelope.
 * Browser-only prototype: no server identity, cross-device sync or guaranteed background alarms.
 */
(function () {
  "use strict";
  const root = document.getElementById("life-suite-root");
  if (!root) return;

  const STORAGE_KEY = "project-n-01-secure-life-v1";
  const FORMAT = "project-n-01-life-v1";
  const PBKDF2_ITERATIONS = 310000;
  const MAX_PLAINTEXT_BYTES = 2500000;
  const AUTO_LOCK_MS = 5 * 60 * 1000;
  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => Array.from(r.querySelectorAll(s));
  let lang = document.documentElement.lang === "en" ? "en" : "nl";
  let state = null;
  let sessionKey = null;
  let saltB64 = null;
  let lockTimer = null;
  let activeTab = "dashboard";
  let editingAppointmentId = "";
  let editingJournalId = "";
  let editingDrawingId = "";
  let editingGuideId = "";
  let editingContactId = "";
  let editingPlanId = "";
  let recordingTarget = "journal";
  let selectedDate = localDate(new Date());
  let calendarMode = "week";
  let draftPhoto = "";
  let draftGuideAudio = "";
  let draftJournalAudio = "";
  let mediaRecorder = null;
  let recordingChunks = [];
  let reminderTimer = null;
  let toastTimer = null;
  let pendingInviteCode = "";
  let pendingRecoveryCode = "";
  let lastConflictReport = [];
  let filePickerPending = false;

  const WORDS = {
    nl: {
      lockedTitle:"Persoonlijke ruimte", lockedIntro:"Je agenda, stemming, dagboek, contacten en handleidingen worden in een lokale versleutelde kluis bewaard.", createVault:"Maak mijn kluis", unlock:"Ontgrendel kluis", passphrase:"Wachtzin (minstens 12 tekens)", confirmPass:"Bevestig wachtzin", setupHint:"Kies een wachtzin die je veilig bewaart. Zonder wachtzin kan de kluis niet worden hersteld.", lockedHint:"Je gegevens blijven versleuteld totdat je de juiste wachtzin invoert.", mismatch:"De wachtzinnen komen niet overeen.", badPass:"Ontgrendelen is mislukt. Controleer de wachtzin of het back-upbestand.", storageError:"Opslaan is mislukt. Mogelijk is de lokale opslag vol; verklein foto's/audio en probeer opnieuw.", tooLarge:"Deze gegevensset is te groot voor de lokale kluis. Verklein bijlagen en probeer opnieuw.", unsupported:"Veilige versleuteling is niet beschikbaar. Open de app via HTTPS of localhost.", unlockNeeded:"Ontgrendel eerst de persoonlijke kluis.", appTitle:"PlanSamen", appIntro:"Jouw planning, afspraken en persoonlijke hulpmiddelen op één overzichtelijke plek.", dashboard:"Overzicht", weekplan:"Weekplanning", agenda:"Agenda", roster:"Wie werkt er?", mood:"Mijn gevoel", roles:"Profielen & toestemming", help:"Hulp", guides:"Handleidingen", reminders:"Herinneringen", data:"Zoeken & gegevens", lock:"Vergrendel", today:"Vandaag", upcoming:"Aankomende afspraken", noAppointments:"Geen afspraken op deze datum.", addAppointment:"Afspraak toevoegen", editAppointment:"Afspraak bewerken", title:"Titel", date:"Datum", start:"Begint om", end:"Eindigt om", bufferAfter:"Ruimte na afspraak", bufferHint:"Houd ruimte vrij na afloop voor reistijd of rust.", bufferNone:"Geen extra tijd", bufferFive:"5 minuten", bufferTen:"10 minuten", bufferFifteen:"15 minuten", bufferThirty:"30 minuten", location:"Locatie", notes:"Notities", preparation:"Wat wil ik voorbereiden?", reminder:"Herinner mij", none:"Geen", fiveMin:"5 minuten vooraf", tenMin:"10 minuten vooraf", thirtyMin:"30 minuten vooraf", oneHour:"1 uur vooraf", repeat:"Herhalen", noRepeat:"Eenmalig", weekly:"Elke week", daily:"Elke dag", seriesOccurrence:"Onderdeel van weekreeks", seriesOccurrenceHint:"Dit is één afspraak uit een wekelijkse reeks. Aanpassen of verwijderen geldt alleen voor deze afspraak.", seriesRootHint:"Je bewerkt de weekreeks. Opslaan past alle afspraken in deze reeks aan.", deleteWholeSeriesConfirm:"Weet je zeker dat je alle afspraken uit deze wekelijkse reeks wilt verwijderen?", deleteSeriesOccurrenceConfirm:"Weet je zeker dat je alleen deze afspraak wilt verwijderen? De rest van de weekreeks blijft staan.", save:"Opslaan", cancel:"Annuleren", delete:"Verwijderen", edit:"Bewerken", exactDuplicate:"Er staat al een afspraak op die datum en begintijd. Kies een andere tijd of bewerk de bestaande afspraak.", overlap:"Deze afspraak overlapt met een andere afspraak.", dayView:"Dag", weekView:"Week", monthView:"Maand", selectDate:"Kies datum", schedule:"Weekrooster", workerName:"Naam begeleider", workerRole:"Rol/functie", photo:"Foto", addWorker:"Begeleider toevoegen", shiftDate:"Werkt op", shiftStart:"Van", shiftEnd:"Tot", shiftOverlap:"Deze begeleider heeft op deze datum al een dienst die overlapt. Kies een andere tijd of begeleider.", deleteWorkerConfirm:"Deze begeleider wordt verwijderd en diens roosterdiensten verdwijnen. Bestaande afspraken blijven bestaan, maar de koppeling met deze begeleider wordt verwijderd. Doorgaan?", deleteWorkerLinksPermission:"Deze begeleider is gekoppeld aan afspraken of diensten waarvoor je geen wijzigtoestemming hebt. Vraag de eigenaar om de koppeling eerst aan te passen.", appointmentWorker:"Begeleider voor deze afspraak", unassigned:"Geen begeleider toegewezen", assignedTo:"Begeleider", assignWorker:"Begeleider", todayWorkers:"Wie werkt er vandaag?", noWorkers:"Er zijn nog geen begeleiders ingevoerd.", noShifts:"Geen roosteritems in deze periode.", moodTitle:"Hoe voel je je vandaag?", journalTitle:"Mijn dagboek", moodNote:"Wat wil je over vandaag onthouden?", journalPlaceholder:"Schrijf, spreek of teken iets voor jezelf.", saveEntry:"Bewaar dagboekmoment", history:"Eerdere momenten", noEntries:"Nog geen dagboekmomenten.", drawingTitle:"Mijn tekeningen", drawingName:"Naam van de tekening", saveDrawing:"Tekening bewaren", noDrawings:"Nog geen tekeningen bewaard.", clearCanvas:"Wis tekenvlak", audioRecord:"Neem audio op", stopRecord:"Stop opname", audioReady:"Opname klaar en wordt pas bewaard als je opslaat.", audioTooLarge:"De opname is te groot. Neem korter op.", roleTitle:"Profielen en toestemming", profileName:"Naam van profiel", profileRole:"Profielrol", self:"Gebruiker", caregiver:"Begeleider", parent:"Ouder", guardian:"Voogd", addProfile:"Profiel toevoegen", activeProfile:"Actief profiel", permissions:"Toegestane gegevens voor dit profiel", viewData:"Mag bekijken", modifyData:"Mag wijzigen", calendarAccess:"Agenda", rosterAccess:"Begeleiders/rooster", moodAccess:"Stemming", journalAccess:"Dagboek", guidesAccess:"Handleidingen", saveConsent:"Toestemming opslaan", revoke:"Toegang intrekken", noConsents:"Er zijn geen gedeelde toegangsrechten ingesteld.", consentSaved:"Toestemming opgeslagen. Je kunt deze later intrekken.", consentHint:"Delen staat standaard uit. Deze toestemming wordt lokaal geregistreerd; dit prototype biedt nog geen beveiligde online accounts.", invite:"Maak uitnodigingscode", inviteCopy:"Kopieer code", inviteHint:"De code legt alleen een lokaal uitnodigingsverzoek vast. Echte acceptatie op een ander apparaat vereist nog een beveiligde accounts/serverfunctie.", helpTitle:"Hulp nodig?", helpDescription:"Stel een vertrouwd contact in. De knop opent je bel- of berichtenapp na bevestiging; er wordt geen hulpdienst automatisch gewaarschuwd.", contactName:"Naam contactpersoon", phone:"Telefoonnummer", email:"E-mailadres", emergencyInfo:"Belangrijke informatie voor hulp", saveContact:"Contact opslaan", noContact:"Er is nog geen vertrouwd contact ingesteld.", callContact:"Bel vertrouwd contact", smsContact:"Stuur bericht", callConfirm:"Wil je de bel-app openen voor dit contact?", smsConfirm:"Wil je de berichten-app openen voor dit contact?", helpAccess:"Hulpcontact", noPhone:"Voeg eerst een geldig telefoonnummer toe.", guideTitle:"Stap-voor-stap handleidingen", guideName:"Naam handleiding", guideDescription:"Waar helpt deze handleiding bij?", guideSteps:"Stappen (één per regel)", guideImage:"Foto's toevoegen (max. 3 MB per afbeelding)", guideAudio:"Gesproken uitleg toevoegen (audio, max. 1 MB)", addGuide:"Handleiding bewaren", noGuides:"Nog geen handleidingen gemaakt.", markStep:"Stap klaar", reminderTitle:"Herinnering", reminderWhen:"Datum en tijd", reminderRepeat:"Herhaling", addReminder:"Herinnering toevoegen", noReminders:"Geen extra herinneringen ingesteld.", snooze:"Stel 10 minuten uit", notificationPermission:"Meldingen toestaan", notificationHint:"Herinneringen werken in deze webversie alleen terwijl de app geopend en ontgrendeld is. Achtergrondmeldingen vragen platformondersteuning.", searchTitle:"Zoeken in je gegevens", searchPlaceholder:"Zoek in afspraken, handleidingen, begeleiders en dagboek...", search:"Zoeken", noResults:"Geen resultaten gevonden.", backupTitle:"Back-up en herstel", exportBackup:"Download versleutelde back-up", recoveryBackup:"Herstelback-up met een aparte herstelcode maken", recoveryCode:"Bewaar deze herstelcode apart", recoveryHint:"Maak een herstelbestand en bewaar de getoonde code apart op een veilige plek. Zonder beide kun je dit bestand niet openen.", recoveryCreated:"Herstelbestand gemaakt. Bewaar de code apart.", copyRecovery:"Herstelcode kopiëren", recoveryCopied:"Herstelcode gekopieerd.", conflictTitle:"Samenvatting van samenvoegconflicten", conflictHint:"Bij twee verschillende versies met hetzelfde ID is de laatst gewijzigde versie automatisch behouden. Er zijn geen inhoudelijke notities in dit rapport opgenomen.", currentKept:"Bestaande versie behouden", importedKept:"Versie uit back-up behouden", importBackup:"Herstel/voeg back-up toe", importMode:"Herstelwijze", merge:"Samenvoegen (nieuwste versie per item)", replace:"Vervang huidige gegevens", chooseFile:"Kies versleuteld back-upbestand", backupPass:"Wachtzin van de back-up", importHint:"Bewaar de wachtzin apart. Een back-up bevat alleen versleutelde gegevens. Bij samenvoegen blijven unieke items behouden; conflicten gebruiken de laatst gewijzigde versie.", deleteData:"Alle gegevens wissen", deleteConfirm:"Weet je zeker dat je alle gegevens en de versleutelde kluis van dit project op dit apparaat wilt wissen? Dit kan niet ongedaan worden gemaakt.", deleted:"Alle lokale projectgegevens zijn gewist.", exportDone:"Versleutelde back-up gedownload.", importDone:"Back-up verwerkt.", profile:"Profiel", searchResults:"Zoekresultaten", noPermission:"Voor dit profiel is geen toestemming voor deze gegevens geregistreerd.", localOnly:"Alle gegevens blijven op dit apparaat in een versleutelde kluis. Er is nog geen echte online synchronisatie.", dayPlanner:"Jouw planning voor deze week", planTitle:"Plan je week", planDay:"Dag", planTime:"Tijd", planTask:"Taak of routine", planNotes:"Notities", addPlan:"Taak plannen", editPlan:"Planning bewerken", noPlans:"Nog geen taken in deze weekplanning.", done:"Afgerond", planAccess:"Weekplanning", routines:"Routines", taskTitle:"Taak/reminder", status:"Status", online:"Online", offline:"Offline: opgeslagen gegevens blijven beschikbaar; bellen kan alleen als het toestel verbinding kan maken.", saved:"Opgeslagen.", ready:"Gereed.", closed:"Kluis vergrendeld.", close:"Sluiten", openAgenda:"Open agenda", openRoster:"Bekijk rooster", openMood:"Check mijn gevoel", openGuides:"Open handleidingen", noData:"Nog niets toegevoegd.", invalid:"Controleer de ingevulde gegevens.", photoTooLarge:"Foto kon niet veilig verkleind worden.", guideAudioTooLarge:"Audio is groter dan 1 MB.", permissionNeeded:"Geef eerst toestemming voor meldingen via de knop.", permissionGranted:"Meldingen zijn toegestaan.", noNotification:"Dit apparaat ondersteunt geen browsermeldingen.", reminderFired:"Je hebt een herinnering.", futureOnly:"Kies een tijd in de toekomst.", updated:"Gewijzigd.", deleteItem:"Weet je zeker dat je dit item wilt verwijderen?", exportUnavailable:"Exporteren is niet gelukt.", profileHint:"Profielen houden informatie overzichtelijk gescheiden, maar zijn geen aparte beveiligde accounts. Alle gegevens in deze lokale versie worden beschermd door dezelfde kluiswachtzin.", accessibilitySettings:"Toegankelijkheid", largeTextSetting:"Grotere tekst", highContrastSetting:"Hoog contrast", reducedMotionSetting:"Minder beweging", profileDataExists:"Dit profiel bevat nog gegevens. Verwijder of exporteer die gegevens eerst voordat je het profiel verwijdert.", overlapInfo:"PlanSamen slaat afspraken die overlappen of in gereserveerde reistijd/rust vallen niet op. Kies een andere tijd of pas de bestaande afspraak aan.", overlapBlocked:"Deze afspraak botst met een andere afspraak of gereserveerde vrije tijd. De afspraak is niet opgeslagen. Kies een andere tijd of pas de bestaande afspraak aan.", conflictWith:"Botsing met", workerBusyConflict:"Deze begeleider heeft in die tijd al een andere afspraak. De gegevens van die afspraak worden niet getoond.", pictogram:"Pictogram voor deze afspraak", pictogramHint:"Kies een herkenbaar plaatje voor je afspraak.", activityDoctor:"Huisarts of ziekenhuis", activityWork:"Werk of dagbesteding", activitySupport:"Begeleiding", activityTravel:"Reizen of vervoer", activityFood:"Eten of drinken", activitySport:"Sport of bewegen", activityHome:"Thuis of rust", activityShopping:"Winkelen", activityOther:"Anders"
    },
    en: {
      lockedTitle:"Personal space", lockedIntro:"Your calendar, mood, journal, contacts and guides are stored in a locally encrypted vault.", createVault:"Create my vault", unlock:"Unlock vault", passphrase:"Passphrase (at least 12 characters)", confirmPass:"Confirm passphrase", setupHint:"Choose a passphrase and keep it safe. Without it, the vault cannot be recovered.", lockedHint:"Your data stays encrypted until the correct passphrase is entered.", mismatch:"The passphrases do not match.", badPass:"Unlock failed. Check the passphrase or backup file.", storageError:"Saving failed. Local storage may be full; reduce photo/audio attachments and try again.", tooLarge:"This dataset is too large for local storage. Reduce attachments and try again.", unsupported:"Secure encryption is unavailable. Open the app over HTTPS or localhost.", unlockNeeded:"Unlock the personal vault first.", appTitle:"PlanSamen", appIntro:"Your planning, support and appointments in one clear place.", dashboard:"Overview", weekplan:"Weekly plan", agenda:"Calendar", roster:"Who is working?", mood:"My feelings", roles:"Profiles & consent", help:"Help", guides:"Guides", reminders:"Reminders", data:"Search & data", lock:"Lock", today:"Today", upcoming:"Upcoming appointments", noAppointments:"No appointments on this date.", addAppointment:"Add appointment", editAppointment:"Edit appointment", title:"Title", date:"Date", start:"Starts", end:"Ends", bufferAfter:"Buffer after appointment", bufferHint:"Keep time free after the appointment for travel or a break.", bufferNone:"No extra time", bufferFive:"5 minutes", bufferTen:"10 minutes", bufferFifteen:"15 minutes", bufferThirty:"30 minutes", location:"Location", notes:"Notes", preparation:"What would I like to prepare?", reminder:"Remind me", none:"None", fiveMin:"5 minutes before", tenMin:"10 minutes before", thirtyMin:"30 minutes before", oneHour:"1 hour before", repeat:"Repeat", noRepeat:"Once", weekly:"Every week", daily:"Every day", seriesOccurrence:"Part of weekly series", seriesOccurrenceHint:"This is one appointment in a weekly series. Editing or deleting it affects only this appointment.", seriesRootHint:"You are editing the weekly series. Saving changes all appointments in this series.", deleteWholeSeriesConfirm:"Are you sure you want to delete every appointment in this weekly series?", deleteSeriesOccurrenceConfirm:"Are you sure you want to delete only this appointment? The rest of the weekly series will stay.", save:"Save", cancel:"Cancel", delete:"Delete", edit:"Edit", dayView:"Day", weekView:"Week", monthView:"Month", selectDate:"Choose date", schedule:"Weekly roster", workerName:"Support worker name", workerRole:"Role", photo:"Photo", addWorker:"Add support worker", shiftDate:"Working on", shiftStart:"From", shiftEnd:"Until", shiftOverlap:"This support worker already has an overlapping shift on this date. Choose another time or support worker.", deleteWorkerConfirm:"This support worker will be deleted and their shifts removed. Existing appointments will remain, but their assignment to this support worker will be cleared. Continue?", deleteWorkerLinksPermission:"This support worker is linked to appointments or shifts you do not have permission to change. Ask the owner to update the links first.", appointmentWorker:"Support worker for this appointment", unassigned:"No support worker assigned", assignedTo:"Support worker", assignWorker:"Support worker", todayWorkers:"Who is working today?", noWorkers:"No support workers added yet.", noShifts:"No shifts in this period.", moodTitle:"How are you feeling today?", journalTitle:"My journal", moodNote:"What would you like to remember about today?", journalPlaceholder:"Write, speak or draw something for yourself.", saveEntry:"Save journal entry", history:"Earlier entries", noEntries:"No journal entries yet.", drawingTitle:"My drawings", drawingName:"Drawing title", saveDrawing:"Save drawing", noDrawings:"No drawings saved yet.", clearCanvas:"Clear drawing area", audioRecord:"Record audio", stopRecord:"Stop recording", audioReady:"Recording ready; it is saved only when you save the entry.", audioTooLarge:"Recording is too large. Record a shorter clip.", roleTitle:"Profiles and consent", profileName:"Profile name", profileRole:"Profile role", self:"User", caregiver:"Support worker", parent:"Parent", guardian:"Guardian", addProfile:"Add profile", activeProfile:"Active profile", permissions:"Data this profile may access", viewData:"May view", modifyData:"May edit", calendarAccess:"Calendar", rosterAccess:"Roster", moodAccess:"Mood", journalAccess:"Journal", guidesAccess:"Guides", saveConsent:"Save consent", revoke:"Revoke access", noConsents:"No shared access permissions are configured.", consentSaved:"Consent saved. You can revoke it later.", consentHint:"Sharing is off by default. This consent is recorded locally; secure online accounts are not available in this prototype.", invite:"Create invitation code", inviteCopy:"Copy code", inviteHint:"The code records a local invitation request only. Acceptance on another device requires a secure account/server feature.", helpTitle:"Need help?", helpDescription:"Set a trusted contact. The button opens your phone or messaging app after confirmation; no emergency service is automatically notified.", contactName:"Contact name", phone:"Phone number", email:"Email address", emergencyInfo:"Important information for helpers", saveContact:"Save contact", noContact:"No trusted contact configured yet.", callContact:"Call trusted contact", smsContact:"Send message", callConfirm:"Open the calling app for this contact?", smsConfirm:"Open the messaging app for this contact?", helpAccess:"Help contact", noPhone:"Add a valid phone number first.", guideTitle:"Step-by-step guides", guideName:"Guide name", guideDescription:"What does this guide help with?", guideSteps:"Steps (one per line)", guideImage:"Add photos (max 3 MB per image)", guideAudio:"Add spoken instructions (audio, max 1 MB)", addGuide:"Save guide", noGuides:"No guides created yet.", markStep:"Step done", reminderTitle:"Reminder", reminderWhen:"Date and time", reminderRepeat:"Repeat", addReminder:"Add reminder", noReminders:"No extra reminders set.", snooze:"Snooze 10 minutes", notificationPermission:"Allow notifications", notificationHint:"In this web version, reminders work only while the app is open and unlocked. Background notifications need platform support.", searchTitle:"Search your data", searchPlaceholder:"Search appointments, guides, helpers and journal...", search:"Search", noResults:"No results found.", backupTitle:"Backup and restore", exportBackup:"Download encrypted backup", recoveryBackup:"Create recovery backup with a separate recovery code", recoveryCode:"Keep this recovery code separately", recoveryHint:"Create a recovery file and keep the displayed code separately in a safe place. You need both to open the file.", recoveryCreated:"Recovery file created. Keep its code separately.", copyRecovery:"Copy recovery code", recoveryCopied:"Recovery code copied.", conflictTitle:"Merge conflict summary", conflictHint:"When two different versions shared the same ID, the most recently edited version was kept automatically. This report does not include note contents.", currentKept:"Existing version kept", importedKept:"Backup version kept", importBackup:"Restore/merge backup", importMode:"Restore mode", merge:"Merge (latest version per item)", replace:"Replace current data", chooseFile:"Choose encrypted backup file", backupPass:"Backup passphrase", importHint:"Keep the passphrase separately. A backup contains encrypted data only. Merge preserves unique items; conflicts use the latest edited version.", deleteData:"Erase all data", deleteConfirm:"Are you sure you want to erase all project data and its encrypted vault on this device? This cannot be undone.", deleted:"All local project data has been erased.", exportDone:"Encrypted backup downloaded.", importDone:"Backup processed.", profile:"Profile", searchResults:"Search results", noPermission:"This profile does not have consent to access this data.", localOnly:"All data remains on this device in an encrypted vault. True online sync is not available yet.", dayPlanner:"Your plan for this week", planTitle:"Plan your week", planDay:"Day", planTime:"Time", planTask:"Task or routine", planNotes:"Notes", addPlan:"Plan task", editPlan:"Edit plan", noPlans:"No tasks in this weekly plan yet.", done:"Completed", planAccess:"Weekly plan", routines:"Routines", taskTitle:"Task/reminder", status:"Status", online:"Online", offline:"Offline: saved data remains available; calling only works if the device can connect.", saved:"Saved.", ready:"Ready.", closed:"Vault locked.", close:"Close", openAgenda:"Open calendar", openRoster:"View roster", openMood:"Check in with myself", openGuides:"Open guides", noData:"Nothing added yet.", invalid:"Please check the form.", photoTooLarge:"Photo could not be resized safely.", guideAudioTooLarge:"Audio is larger than 1 MB.", permissionNeeded:"Allow notifications using the button first.", permissionGranted:"Notifications are allowed.", noNotification:"This device does not support browser notifications.", reminderFired:"You have a reminder.", futureOnly:"Choose a time in the future.", updated:"Updated.", deleteItem:"Are you sure you want to delete this item?", exportUnavailable:"Export failed.", profileHint:"Profiles help keep information organized, but they are not separate secured accounts. All data in this local version is protected by the same vault passphrase.", accessibilitySettings:"Accessibility", largeTextSetting:"Larger text", highContrastSetting:"High contrast", reducedMotionSetting:"Reduced motion", profileDataExists:"This profile still has data. Export or remove that data before deleting the profile.", overlapInfo:"PlanSamen does not save appointments that overlap or fall within reserved travel/rest time. Choose another time or edit the existing appointment.", overlapBlocked:"This appointment conflicts with another appointment or reserved buffer time. It was not saved. Choose another time or edit the existing appointment.", conflictWith:"Conflicts with", workerBusyConflict:"This support worker already has another appointment at that time. Details of that appointment are hidden.", pictogram:"Appointment pictogram", pictogramHint:"Choose a picture that makes your appointment easy to recognise.", activityDoctor:"Doctor or hospital", activityWork:"Work or day service", activitySupport:"Support", activityTravel:"Travel or transport", activityFood:"Food or drink", activitySport:"Sport or exercise", activityHome:"Home or rest", activityShopping:"Shopping", activityOther:"Other"
    }
  };
  const t = key => (WORDS[lang] && WORDS[lang][key]) || WORDS.nl[key] || key;

  function uid(prefix) {
    return (prefix || "item") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }
  function localDate(value) {
    const d = value instanceof Date ? value : new Date(value || Date.now());
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function dateAt(value, hour) {
    const d = new Date(value + "T00:00:00");
    if (hour) d.setHours(hour, 0, 0, 0);
    return d;
  }
  function shiftDate(value, days) {
    const d = dateAt(value);
    d.setDate(d.getDate() + days);
    return localDate(d);
  }
  function monthTitle(value) {
    return new Intl.DateTimeFormat(lang === "nl" ? "nl-NL" : "en-GB", {month:"long", year:"numeric"}).format(dateAt(value));
  }
  function prettyDate(value, opts) {
    if (!value) return "";
    return new Intl.DateTimeFormat(lang === "nl" ? "nl-NL" : "en-GB", opts || {weekday:"short", day:"numeric", month:"short"}).format(dateAt(value));
  }
  function esc(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function bytesToB64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }
  function b64ToBytes(text) {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  function bytesLength(text) { return new TextEncoder().encode(text).length; }
  async function deriveKey(passphrase, salt) {
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2", salt:salt, iterations:PBKDF2_ITERATIONS, hash:"SHA-256"}, material, {name:"AES-GCM", length:256}, false, ["encrypt", "decrypt"]);
  }
  async function encryptState(value, key, salt) {
    const plain = JSON.stringify(value);
    if (bytesLength(plain) > MAX_PLAINTEXT_BYTES) throw new Error("too-large");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({name:"AES-GCM", iv:iv}, key, new TextEncoder().encode(plain));
    return {format:FORMAT, version:1, kdf:"PBKDF2-SHA-256", iterations:PBKDF2_ITERATIONS, cipher:"AES-256-GCM", salt:bytesToB64(salt), iv:bytesToB64(iv), ciphertext:bytesToB64(new Uint8Array(cipher))};
  }
  async function decryptEnvelope(envelope, passphrase) {
    if (!envelope || envelope.format !== FORMAT || envelope.version !== 1 || envelope.cipher !== "AES-256-GCM" || envelope.kdf !== "PBKDF2-SHA-256" || envelope.iterations !== PBKDF2_ITERATIONS) throw new Error("invalid-envelope");
    const salt = b64ToBytes(envelope.salt);
    const iv = b64ToBytes(envelope.iv);
    const cipher = b64ToBytes(envelope.ciphertext);
    if (salt.length !== 16 || iv.length !== 12 || cipher.length > MAX_PLAINTEXT_BYTES + 16) throw new Error("invalid-envelope");
    const key = await deriveKey(passphrase, salt);
    const data = await crypto.subtle.decrypt({name:"AES-GCM", iv:iv}, key, cipher);
    const plain = new TextDecoder().decode(data);
    if (bytesLength(plain) > MAX_PLAINTEXT_BYTES) throw new Error("too-large");
    const parsed = JSON.parse(plain);
    return {key:key, salt:salt, state:normalizeState(parsed)};
  }
  function defaultState() {
    return {
      schema:1, createdAt:new Date().toISOString(), currentProfileId:"self",
      profiles:[{id:"self",name:lang === "nl" ? "Mijn profiel" : "My profile",role:"self",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}],
      appointments:[], workers:[], shifts:[], weeklyPlans:[], moods:[], journal:[], drawings:[], guides:[], contacts:[], reminders:[], consents:[], invites:[], audit:[], notificationLog:[], preferences:{largeText:false,highContrast:false,reducedMotion:false}
    };
  }
  function normalizeState(raw) {
    const blank = defaultState();
    if (!raw || typeof raw !== "object") return blank;
    const arrKeys = ["profiles","appointments","workers","shifts","weeklyPlans","moods","journal","drawings","guides","contacts","reminders","consents","invites","audit","notificationLog"];
    arrKeys.forEach(key => { blank[key] = Array.isArray(raw[key]) ? raw[key].filter(x => x && typeof x === "object") : []; });
    blank.schema = 1;
    blank.createdAt = typeof raw.createdAt === "string" ? raw.createdAt : blank.createdAt;
    blank.currentProfileId = typeof raw.currentProfileId === "string" ? raw.currentProfileId : "self";
    blank.preferences = Object.assign(blank.preferences, raw.preferences && typeof raw.preferences === "object" ? raw.preferences : {});
    if (!blank.profiles.length) blank.profiles.push({id:"self",name:"My profile",role:"self",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    if (!blank.profiles.some(p => p.id === blank.currentProfileId)) blank.currentProfileId = blank.profiles[0].id;
    return blank;
  }
  function currentProfile() {
    return state && state.profiles.find(p => p.id === state.currentProfileId) || (state && state.profiles[0]) || null;
  }
  function scopeMatches(item) {
    return !item.profileId || item.profileId === state.currentProfileId;
  }
  function visibleItems(key, scope) {
    const items = state[key] || [];
    const profile = currentProfile();
    if (profile && profile.role !== "self" && scope) {
      const owners = state.consents.filter(c => c.viewerId === profile.id && Array.isArray(c.scopes) && c.scopes.indexOf(scope) >= 0 && c.revoked !== true).map(c => c.ownerId);
      return items.filter(item => (item.profileId || "self") === profile.id || owners.indexOf(item.profileId || "self") >= 0);
    }
    return items.filter(scopeMatches);
  }
  function canModify(scope, item) {
    const profile=currentProfile();
    if(!profile||!state)return false;
    const ownerId=(item&&item.profileId)||profile.id;
    if(ownerId===profile.id)return true;
    return state.consents.some(c=>c.ownerId===ownerId&&c.viewerId===profile.id&&c.revoked!==true&&Array.isArray(c.modifyScopes)&&c.modifyScopes.includes(scope));
  }
  function requireModify(scope, item) {
    if(canModify(scope,item))return true;
    setStatus(t("noPermission"),true);
    return false;
  }
  function recordAudit(action, details) {
    state.audit.unshift({id:uid("audit"),profileId:state.currentProfileId,action:action,details:details || "",at:new Date().toISOString()});
    state.audit = state.audit.slice(0, 200);
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.hidden = true;
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function setStatus(message, isError) {
    const status = $("#ls-status");
    if (status) { status.textContent = message; status.classList.toggle("is-error", Boolean(isError)); }
  }
  async function saveState(message) {
    if (!state || !sessionKey || !saltB64) throw new Error("locked");
    let envelope;
    try {
      envelope = await encryptState(state, sessionKey, b64ToBytes(saltB64));
      const raw = JSON.stringify(envelope);
      localStorage.setItem(STORAGE_KEY, raw);
      if (message !== false) setStatus(message || t("saved"));
      startAutoLock();
      return true;
    } catch (error) {
      setStatus(error && error.message === "too-large" ? t("tooLarge") : t("storageError"), true);
      return false;
    }
  }
  function stopAutoLock() {
    if (lockTimer) clearTimeout(lockTimer);
    lockTimer = null;
  }
  function startAutoLock() {
    stopAutoLock();
    if (!sessionKey) return;
    lockTimer = window.setTimeout(() => lockVault(true), AUTO_LOCK_MS);
  }
  function lockVault(showMessage) {
    stopAutoLock();
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      try { mediaRecorder.stop(); } catch {}
    }
    sessionKey = null; saltB64 = null; state = null; draftPhoto = ""; draftGuideAudio = ""; draftJournalAudio = ""; pendingRecoveryCode = "";
    renderLocked(false, showMessage ? t("closed") : "");
  }
  function renderLocked(createMode, extra) {
    root.innerHTML = '<div class="ls-locked"><div class="ls-lock-mark" aria-hidden="true">🔐</div><p class="ls-kicker">PROJECT N-01</p><h3>' + esc(t("lockedTitle")) + '</h3><p>' + esc(t("lockedIntro")) + '</p><form id="ls-unlock-form" class="ls-form"><label for="ls-pass">' + esc(t("passphrase")) + '</label><input id="ls-pass" type="password" minlength="12" autocomplete="current-password" required><div id="ls-confirm-wrap"' + (createMode ? "" : " hidden") + '><label for="ls-pass-confirm">' + esc(t("confirmPass")) + '</label><input id="ls-pass-confirm" type="password" minlength="12" autocomplete="new-password"' + (createMode ? " required" : "") + '></div><p class="ls-muted">' + esc(createMode ? t("setupHint") : t("lockedHint")) + '</p><button class="primary-button" type="submit">' + esc(createMode ? t("createVault") : t("unlock")) + '</button><p class="ls-status" id="ls-lock-status" role="status" aria-live="polite">' + esc(extra || "") + '</p></form></div>';
    $("#ls-unlock-form").addEventListener("submit", async event => {
      event.preventDefault();
      const pass = $("#ls-pass").value;
      const confirm = $("#ls-pass-confirm");
      const status = $("#ls-lock-status");
      if (pass.length < 12) { status.textContent = t("invalid"); return; }
      if (createMode && pass !== confirm.value) { status.textContent = t("mismatch"); return; }
      if (!window.crypto || !crypto.subtle) { status.textContent = t("unsupported"); return; }
      const button = $('button[type="submit"]');
      button.disabled = true;
      try {
        if (createMode) {
          if (localStorage.getItem(STORAGE_KEY) !== null) throw new Error("already-exists");
          state = defaultState();
          const salt = crypto.getRandomValues(new Uint8Array(16));
          sessionKey = await deriveKey(pass, salt);
          saltB64 = bytesToB64(salt);
          const ok = await saveState(false);
          if (!ok) throw new Error("storage");
        } else {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) throw new Error("missing");
          const unlocked = await decryptEnvelope(JSON.parse(raw), pass);
          state = unlocked.state;
          sessionKey = unlocked.key;
          saltB64 = bytesToB64(unlocked.salt);
        }
        $("#ls-pass").value = "";
        if (confirm) confirm.value = "";
        recordAudit(createMode ? "vault-created" : "vault-unlocked", "");
        await saveState(false);
        activeTab = "dashboard";
        renderApp();
        startAutoLock();
        startReminderMonitor();
      } catch (error) {
        sessionKey = null; saltB64 = null; state = null;
        status.textContent = t("badPass");
        button.disabled = false;
      }
    });
  }

  function badge(text) { return '<span class="ls-badge">' + esc(text) + '</span>'; }
  function panel(title, content, extra) {
    return '<section class="ls-panel ' + (extra || "") + '"><h3>' + esc(title) + '</h3>' + content + '</section>';
  }
  function field(label, name, type, value, extra) {
    return '<label class="ls-field"><span>' + esc(label) + '</span><input name="' + esc(name) + '" type="' + esc(type || "text") + '" value="' + esc(value || "") + '" ' + (extra || "") + '></label>';
  }
  function textarea(label, name, value, rows, extra) {
    return '<label class="ls-field"><span>' + esc(label) + '</span><textarea name="' + esc(name) + '" rows="' + (rows || 3) + '" ' + (extra || "") + '>' + esc(value || "") + '</textarea></label>';
  }
  function select(label, name, options, value) {
    return '<label class="ls-field"><span>' + esc(label) + '</span><select name="' + esc(name) + '">' + options.map(o => '<option value="' + esc(o.value) + '"' + (String(o.value) === String(value) ? " selected" : "") + '>' + esc(o.label) + '</option>').join("") + '</select></label>';
  }
  function button(label, action, cls, extra) {
    return '<button type="button" class="' + (cls || "secondary-button") + '" data-ls-action="' + esc(action) + '" ' + (extra || "") + '>' + esc(label) + '</button>';
  }
  function tabButton(id, label) {
    return '<button type="button" class="ls-tab' + (activeTab === id ? " active" : "") + '" data-ls-tab="' + id + '" aria-pressed="' + (activeTab === id ? "true" : "false") + '">' + esc(label) + '</button>';
  }
  function imageThumb(data, name) {
    return data ? '<img class="ls-photo" src="' + esc(data) + '" alt="' + esc(name || "") + '">' : '<span class="ls-photo ls-photo-empty" aria-hidden="true">👤</span>';
  }
  function topBar() {
    const p = currentProfile();
    return '<div class="ls-app-head"><div><p class="ls-kicker">PLANSAMEN</p><h3>' + esc(t("appTitle")) + '</h3><p>' + esc(t("appIntro")) + '</p></div><div class="ls-head-actions">' + button(t("lock"), "lock", "secondary-button") + '</div></div>';
  }
  function tabBar() {
    const tabs = [["dashboard","dashboard"],["weekplan","weekplan"],["agenda","agenda"],["mood","mood"],["help","help"],["guides","guides"],["reminders","reminders"],["data","data"]];
    return '<div class="ls-tabs" role="tablist" aria-label="' + esc(t("appTitle")) + '">' + tabs.map(x => tabButton(x[0], t(x[1]))).join("") + '</div>';
  }
  function visibleAppointmentList(date) {
    return visibleItems("appointments", "calendar").filter(a => a.date === date).sort((a,b) => a.start.localeCompare(b.start));
  }
  function appointmentCard(a) {
    const worker = a.workerId ? state.workers.find(w => w.id === a.workerId && (w.profileId || "self") === (a.profileId || "self")) : null;
    return '<article class="ls-item ls-appointment-card"><div class="ls-appointment-icon" aria-hidden="true">' + esc(a.pictogram || "📅") + '</div><div class="ls-appointment-content"><div class="ls-item-top"><div><strong>' + esc(a.start + "–" + a.end + " · " + a.title) + '</strong><p>' + esc((a.location || "") + (a.location && a.preparation ? " · " : "") + (a.preparation || "")) + '</p></div><div class="ls-actions">' + button(t("edit"), "edit-appointment", "secondary-button", 'data-id="' + esc(a.id) + '"') + button(t("delete"), "delete-appointment", "secondary-button danger-button", 'data-id="' + esc(a.id) + '"') + '</div></div>' + (a.notes ? '<p class="ls-muted">' + esc(a.notes) + '</p>' : "") + '<small>' + esc(prettyDate(a.date)) + (worker ? " · " + esc(t("assignedTo")) + ": " + esc(worker.name) : "") + (a.reminderMins ? " · " + esc(a.reminderMins) + " min" : "") + (Number(a.bufferMins) > 0 ? " · " + esc(t("bufferAfter")) + ": " + esc(a.bufferMins) + " min" : "") + (a.repeat && a.repeat !== "none" ? " · " + esc(t(a.repeat)) : (a.seriesId ? " · " + esc(t("seriesOccurrence")) : "")) + '</small></div></article>';
  }
  function appointmentForm(a) {
    a = a || {};
    return '<form id="ls-appointment-form" class="ls-form ls-grid">' + '<fieldset class="ls-pictogram-picker"><legend>' + esc(t("pictogram")) + '</legend><p class="ls-muted">' + esc(t("pictogramHint")) + '</p><div class="ls-pictogram-options">' + [{value:"📅",label:t("activityOther")},{value:"🩺",label:t("activityDoctor")},{value:"💼",label:t("activityWork")},{value:"🤝",label:t("activitySupport")},{value:"🚌",label:t("activityTravel")},{value:"🍽️",label:t("activityFood")},{value:"⚽",label:t("activitySport")},{value:"🏠",label:t("activityHome")},{value:"🛒",label:t("activityShopping")}].map(option=>'<label class="ls-pictogram-choice"><input type="radio" name="pictogram" value="' + option.value + '"' + ((a.pictogram || "📅")===option.value ? " checked" : "") + '><span class="ls-pictogram-symbol" aria-hidden="true">' + option.value + '</span><span>' + esc(option.label) + '</span></label>').join("") + '</div></fieldset>' + field(t("title"),"title","text",a.title,"required maxlength='120'") + field(t("date"),"date","date",a.date || selectedDate,"required") + field(t("start"),"start","time",a.start || "09:00","required") + field(t("end"),"end","time",a.end || "09:30","required") + select(t("appointmentWorker"),"workerId",[{value:"",label:t("unassigned")}].concat(visibleItems("workers","roster").map(w=>({value:w.id,label:w.name}))),a.workerId || "") + select(t("bufferAfter"),"bufferMins",[{value:"0",label:t("bufferNone")},{value:"5",label:t("bufferFive")},{value:"10",label:t("bufferTen")},{value:"15",label:t("bufferFifteen")},{value:"30",label:t("bufferThirty")}],String(a.bufferMins === undefined ? 0 : a.bufferMins)) + '<p class="ls-muted">' + esc(t("bufferHint")) + '</p>' + field(t("location"),"location","text",a.location,"maxlength='160'") + select(t("reminder"),"reminderMins",[{value:"0",label:t("none")},{value:"5",label:t("fiveMin")},{value:"10",label:t("tenMin")},{value:"30",label:t("thirtyMin")},{value:"60",label:t("oneHour")}],a.reminderMins || "10") + select(t("repeat"),"repeat",[{value:"none",label:t("noRepeat")},{value:"weekly",label:t("weekly")}],a.repeat || "none") + textarea(t("preparation"),"preparation",a.preparation,2,"maxlength='1200'") + textarea(t("notes"),"notes",a.notes,2,"maxlength='2000'") + '<input type="hidden" name="id" value="' + esc(a.id || "") + '"><div class="ls-form-actions"><button class="primary-button" type="submit">' + esc(t("save")) + '</button>' + (a.id ? button(t("cancel"),"cancel-edit","secondary-button") : "") + '</div><p class="ls-status" id="ls-appointment-status" role="status" aria-live="polite"></p></form>';
  }
  function monthCalendar() {
    const first = dateAt(selectedDate);
    first.setDate(1);
    const startOffset = (first.getDay() + 6) % 7;
    const gridStart = shiftDate(localDate(first), -startOffset);
    const month = first.getMonth();
    const days = [];
    for (let i = 0; i < 42; i++) {
      const date = shiftDate(gridStart, i);
      const d = dateAt(date);
      const has = visibleItems("appointments","calendar").some(a => a.date === date);
      days.push('<button type="button" class="ls-calendar-day' + (date === selectedDate ? " selected" : "") + (d.getMonth() !== month ? " out-month" : "") + '" data-ls-date="' + date + '" aria-label="' + esc(prettyDate(date,{weekday:"long",day:"numeric",month:"long"})) + '">' + d.getDate() + (has ? '<span class="ls-calendar-dot"></span>' : "") + '</button>');
    }
    return '<div class="ls-month-head"><button class="secondary-button" type="button" data-ls-action="month-prev" aria-label="Previous month">‹</button><strong>' + esc(monthTitle(selectedDate)) + '</strong>' + button("›","month-next","secondary-button",'aria-label="Next month"') + '</div><div class="ls-calendar-grid"><span>Ma</span><span>Di</span><span>Wo</span><span>Do</span><span>Vr</span><span>Za</span><span>Zo</span>' + days.join("") + '</div>';
  }
  function appointmentSeriesNotice(a) {
    if (!a || !a.seriesId) return "";
    const key = a.repeat === "weekly" ? "seriesRootHint" : "seriesOccurrenceHint";
    return '<p class="ls-muted ls-series-notice" role="note">' + esc(t(key)) + '</p>';
  }
  function agendaView() {
    const date = selectedDate;
    const actual = visibleAppointmentList(date);
    let list = "";
    if (calendarMode === "month") list = monthCalendar();
    else {
      const count = calendarMode === "week" ? 7 : 1;
      const offset = calendarMode === "week" ? ((dateAt(date).getDay() + 6) % 7) : 0;
      const base = shiftDate(date, -offset);
      const dates = [];
      for (let i=0;i<count;i++) {
        const day = shiftDate(base, i);
        const events = visibleAppointmentList(day);
        dates.push('<div class="ls-day-block"><h4>' + esc(prettyDate(day,{weekday:"long",day:"numeric",month:"short"})) + (day === localDate(new Date()) ? " · " + esc(t("today")) : "") + '</h4>' + (events.length ? events.map(appointmentCard).join("") : '<p class="ls-empty">' + esc(t("noAppointments")) + '</p>') + '</div>');
      }
      list = dates.join("");
    }
    const weeksummary = '<div class="ls-inline"><label class="ls-field"><span>' + esc(t("selectDate")) + '</span><input id="ls-selected-date" type="date" value="' + esc(selectedDate) + '"></label><div class="ls-actions">' + button(t("dayView"),"mode-day",calendarMode === "day" ? "primary-button" : "secondary-button") + button(t("weekView"),"mode-week",calendarMode === "week" ? "primary-button" : "secondary-button") + button(t("monthView"),"mode-month",calendarMode === "month" ? "primary-button" : "secondary-button") + '</div></div>';
    const editing = editingAppointmentId ? state.appointments.find(a => a.id === editingAppointmentId) : null;
    return panel(t("upcoming"), weeksummary + (calendarMode === "month" ? list : '<div class="ls-day-list">' + list + '</div>'), "ls-calendar-panel") + panel(editing ? t("editAppointment") : t("addAppointment"),appointmentSeriesNotice(editing) + appointmentForm(editing), "ls-form-panel");
  }
  function dashboardView() {
    const today = localDate(new Date());
    const appts = visibleAppointmentList(today);
    const future = visibleItems("appointments","calendar").filter(a => a.date >= today).sort((a,b) => (a.date+a.start).localeCompare(b.date+b.start)).slice(0,4);
    const mood = visibleItems("moods","mood").filter(m => m.date === today).slice(-1)[0];
    const todayPlans = visibleItems("weeklyPlans","planning").filter(p=>Number(p.weekday)===new Date().getDay()).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
    return '<div class="ls-dashboard-grid">' +
      panel(t("today"),'<div class="ls-stat-grid"><div class="ls-stat"><strong>' + appts.length + '</strong><span>' + esc(t("agenda")) + '</span></div><div class="ls-stat"><strong>' + (mood ? esc(mood.emoji) : "—") + '</strong><span>' + esc(t("mood")) + '</span></div></div><div class="ls-actions">' + button(t("openAgenda"),"go-agenda","primary-button") + button(t("openMood"),"go-mood","secondary-button") + '</div>') +
      panel(t("upcoming"),(future.length ? future.map(appointmentCard).join("") : '<p class="ls-empty">' + esc(t("noAppointments")) + '</p>') + button(t("openAgenda"),"go-agenda","secondary-button")) +
      panel(t("dayPlanner"),(todayPlans.length?todayPlans.map(p=>'<div class="ls-plan-summary"><span><strong>'+esc(p.time||"")+' · '+esc(p.title)+'</strong><small>'+(Array.isArray(p.completedDates)&&p.completedDates.includes(today)?esc(t("done")):"") +'</small></span>'+button(t("edit"),"edit-plan","secondary-button",'data-id="'+esc(p.id)+'"')+'</div>').join(""):'<p class="ls-empty">'+esc(t("noPlans"))+'</p>')+'<div class="ls-actions">'+button(t("weekplan"),"go-weekplan","primary-button")+button(t("openGuides"),"go-guides","secondary-button")+'</div>') + '</div>';
  }
  function workerCard(w) {
    const shifts = visibleItems("shifts","roster").filter(s=>s.workerId===w.id && s.date>=selectedDate && s.date<=shiftDate(selectedDate,6)).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
    return '<article class="ls-item"><div class="ls-worker-row">' + imageThumb(w.photo,w.name) + '<div class="ls-grow"><strong>' + esc(w.name) + '</strong><small>' + esc(w.role || "") + '</small></div>' + button(t("edit"),"edit-worker","secondary-button",'data-id="' + esc(w.id) + '"') + button(t("delete"),"delete-worker","secondary-button danger-button",'data-id="' + esc(w.id) + '"') + '</div>' + (shifts.length ? shifts.map(s => '<p class="ls-muted">' + esc(prettyDate(s.date) + " · " + s.start + "–" + s.end) + '</p>').join("") : '<p class="ls-muted">' + esc(t("noShifts")) + '</p>') + '</article>';
  }
    function rosterView() {
    const workers = visibleItems("workers","roster");
    const shifts = visibleItems("shifts","roster").filter(s=>s.date>=selectedDate && s.date<=shiftDate(selectedDate,6)).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
    const workerOpts = [{value:"",label:"—"}].concat(workers.map(w=>({value:w.id,label:w.name})));
    const form = '<form id="ls-worker-form" class="ls-form ls-grid">' + field(t("workerName"),"name","text","","required maxlength='100'") + field(t("workerRole"),"role","text","","maxlength='100'") + '<label class="ls-field"><span>' + esc(t("photo")) + '</span><input name="photo" type="file" accept="image/*"></label><button class="primary-button" type="submit">' + esc(t("addWorker")) + '</button></form>';
    const shiftForm = '<form id="ls-shift-form" class="ls-form ls-grid">' + select(t("assignWorker"),"workerId",workerOpts,"") + field(t("shiftDate"),"date","date",selectedDate,"required") + field(t("shiftStart"),"start","time","09:00","required") + field(t("shiftEnd"),"end","time","17:00","required") + '<button class="primary-button" type="submit">' + esc(t("save")) + '</button></form>';
    const weekly = shifts.length ? shifts.map(s=>{const w=workers.find(x=>x.id===s.workerId);return '<article class="ls-item"><div class="ls-worker-row">' + imageThumb(w&&w.photo,w&&w.name) + '<div class="ls-grow"><strong>' + esc(w?w.name:"—") + '</strong><small>' + esc(prettyDate(s.date) + " · " + s.start + "–" + s.end) + '</small></div>' + button(t("edit"),"edit-shift","secondary-button",'data-id="' + esc(s.id) + '"') + button(t("delete"),"delete-shift","secondary-button danger-button",'data-id="' + esc(s.id) + '"') + '</div></article>';}).join("") : '<p class="ls-empty">' + esc(t("noShifts")) + '</p>';
    return panel(t("schedule"),'<div class="ls-inline"><label class="ls-field"><span>' + esc(t("selectDate")) + '</span><input id="ls-selected-date" type="date" value="' + esc(selectedDate) + '"></label><p class="ls-muted">' + esc(t("todayWorkers")) + '</p></div><div class="ls-card-list">' + (workers.length ? workers.map(workerCard).join("") : '<p class="ls-empty">' + esc(t("noWorkers")) + '</p>') + '</div>' + form) + panel(t("schedule"),shiftForm + '<div class="ls-card-list">' + weekly + '</div>');
  }
  function moodView() {
    const moods = [{value:"1",label:"😞",emoji:"😞"},{value:"2",label:"🙁",emoji:"🙁"},{value:"3",label:"😐",emoji:"😐"},{value:"4",label:"🙂",emoji:"🙂"},{value:"5",label:"😄",emoji:"😄"}];
    const editingEntry = editingJournalId ? state.journal.find(e=>e.id===editingJournalId) : null;
    const editingDrawing = editingDrawingId ? state.drawings.find(d=>d.id===editingDrawingId) : null;
    const entries = visibleItems("journal","journal").slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,30);
    const drawings = visibleItems("drawings","journal").slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,30);
    const moodHistory = visibleItems("moods","mood").slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);
    const entryCards = entries.length ? entries.map(e=>'<article class="ls-item"><div class="ls-item-top"><strong>' + esc(prettyDate(e.date) + " · " + e.title) + '</strong><div class="ls-actions">' + button(t("edit"),"edit-journal","secondary-button",'data-id="' + esc(e.id) + '"') + button(t("delete"),"delete-journal","secondary-button danger-button",'data-id="' + esc(e.id) + '"') + '</div></div><p>' + esc(e.text) + '</p>' + (e.audio ? '<audio controls preload="none" src="' + esc(e.audio) + '"></audio>' : "") + (e.drawing ? '<img class="ls-drawing-thumb" src="' + esc(e.drawing) + '" alt="' + esc(e.title) + '">' : "") + '</article>').join("") : '<p class="ls-empty">' + esc(t("noEntries")) + '</p>';
    const drawingCards = drawings.length ? drawings.map(d=>'<article class="ls-item"><div class="ls-item-top"><strong>' + esc(d.title) + '</strong><div class="ls-actions">' + button(t("edit"),"edit-drawing","secondary-button",'data-id="' + esc(d.id) + '"') + button(t("delete"),"delete-drawing","secondary-button danger-button",'data-id="' + esc(d.id) + '"') + '</div></div><img class="ls-drawing-thumb" src="' + esc(d.image) + '" alt="' + esc(d.title) + '"><small>' + esc(prettyDate(d.date)) + '</small></article>').join("") : '<p class="ls-empty">' + esc(t("noDrawings")) + '</p>';
    const activeMood = editingEntry ? state.moods.find(m=>m.journalId===editingEntry.id) : null;
    const moodPicker = moods.map(m=>'<label><input type="radio" name="mood" value="' + m.value + '"' + (activeMood&&activeMood.emoji===m.emoji?" checked":"") + '><span>' + m.label + '</span></label>').join("");
    return panel(t("moodTitle"),'<div class="ls-mood-picker">' + moodPicker + '</div><form id="ls-journal-form" class="ls-form">' + field(t("title"),"title","text",editingEntry?editingEntry.title:"","maxlength='100'") + textarea(t("moodNote"),"text",editingEntry?editingEntry.text:"",4,"maxlength='4000'") + '<div class="ls-actions">' + button(t("audioRecord"),"record-journal","secondary-button") + button(t("stopRecord"),"stop-recording","secondary-button",'disabled') + (editingEntry?button(t("cancel"),"cancel-journal-edit","secondary-button"):"") + '</div><audio id="ls-journal-audio-preview" controls ' + ((draftJournalAudio||(editingEntry&&editingEntry.audio))?'':'hidden') + ' src="' + esc(draftJournalAudio||(editingEntry&&editingEntry.audio)||"") + '"></audio><p class="ls-muted" id="ls-audio-status" role="status" aria-live="polite"></p><button class="primary-button" type="submit">' + esc(editingEntry?t("edit"):t("saveEntry")) + '</button></form>') +
      panel(t("drawingTitle"),field(t("drawingName"),"drawing-title","text",editingDrawing?editingDrawing.title:"","maxlength='100'") + '<canvas id="ls-drawing-canvas" width="900" height="500" aria-label="' + esc(t("drawingTitle")) + '" tabindex="0"></canvas><div class="ls-actions">' + button(t("clearCanvas"),"clear-canvas","secondary-button") + button(t("saveDrawing"),"save-drawing","primary-button") + (editingDrawing?button(t("cancel"),"cancel-drawing-edit","secondary-button"):"") + '</div>' + drawingCards) +
      panel(t("history"),'<div class="ls-card-list">' + entryCards + '</div>') +
      panel(t("history") + " · " + t("mood"),'<div class="ls-card-list">' + (moodHistory.length ? moodHistory.map(m=>'<article class="ls-item"><strong>' + esc(prettyDate(m.date)) + " " + esc(m.emoji) + '</strong><p>' + esc(m.note || "") + '</p></article>').join("") : '<p class="ls-empty">' + esc(t("noEntries")) + '</p>') + '</div>');
  }
    function rolesView() {
    const options = [{value:"self",label:t("self")},{value:"caregiver",label:t("caregiver")},{value:"parent",label:t("parent")},{value:"guardian",label:t("guardian")}];
    const profileForm = '<form id="ls-profile-form" class="ls-form ls-grid">' + field(t("profileName"),"name","text","","required maxlength='100'") + select(t("profileRole"),"role",options,"caregiver") + '<button class="primary-button" type="submit">' + esc(t("addProfile")) + '</button></form>';
    const profileRows = state.profiles.map(p=>'<article class="ls-item"><div class="ls-item-top"><div><strong>' + esc(p.name) + '</strong><small>' + esc(t(p.role)) + '</small></div>' + (p.id !== "self" ? button(t("delete"),"delete-profile","secondary-button danger-button",'data-id="' + esc(p.id) + '"') : badge(t("self"))) + '</div></article>').join("");
    const viewerOptions = state.profiles.filter(p=>p.id!==state.currentProfileId).map(p=>({value:p.id,label:p.name + " · " + t(p.role)}));
    const ownerOptions = state.profiles.filter(p=>p.id===state.currentProfileId).map(p=>({value:p.id,label:p.name}));
    const existing = state.consents.filter(c=>c.revoked!==true);
    const categories = [["calendar",t("calendarAccess")],["planning",t("planAccess")],["roster",t("rosterAccess")],["mood",t("moodAccess")],["journal",t("journalAccess")],["guides",t("guidesAccess")],["help",t("helpAccess")]];
    const consentForm = '<form id="ls-consent-form" class="ls-form">' + select(t("profile"),"viewerId",viewerOptions,viewerOptions[0] && viewerOptions[0].value) + select(t("profile"),"ownerId",ownerOptions,state.currentProfileId) + '<p>' + esc(t("viewData")) + '</p><div class="ls-check-grid">' + categories.map(x=>'<label><input type="checkbox" name="scope" value="' + x[0] + '"> ' + esc(x[1]) + '</label>').join("") + '</div><p>' + esc(t("modifyData")) + '</p><div class="ls-check-grid">' + categories.map(x=>'<label><input type="checkbox" name="modifyScope" value="' + x[0] + '"> ' + esc(x[1]) + '</label>').join("") + '</div><button class="primary-button" type="submit">' + esc(t("saveConsent")) + '</button></form>';
    const consentRows = existing.length ? existing.map(c=>{const v=state.profiles.find(p=>p.id===c.viewerId);const o=state.profiles.find(p=>p.id===c.ownerId);const summary=t("viewData")+": "+(c.scopes||[]).map(s=>t(s+"Access")).join(", ")+" · "+t("modifyData")+": "+(c.modifyScopes||[]).map(s=>t(s+"Access")).join(", ");return '<article class="ls-item"><div class="ls-item-top"><div><strong>' + esc((v?v.name:"") + " → " + (o?o.name:"")) + '</strong><p>' + esc(summary) + '</p></div>' + button(t("revoke"),"revoke-consent","secondary-button danger-button",'data-id="' + esc(c.id) + '"') + '</div></article>';}).join("") : '<p class="ls-empty">' + esc(t("noConsents")) + '</p>';
    return panel(t("roleTitle"),'<p class="ls-muted">' + esc(t("profileHint")) + '</p>' + profileForm + '<div class="ls-card-list">' + profileRows + '</div>') + panel(t("permissions"),'<p class="ls-muted">' + esc(t("consentHint")) + '</p>' + consentForm + '<div class="ls-card-list">' + consentRows + '</div>' + button(t("invite"),"create-invite","secondary-button") + '<p class="ls-muted">' + esc(t("inviteHint")) + '</p><p id="ls-invite-output" role="status">' + esc(pendingInviteCode) + '</p>' + (pendingInviteCode ? button(t("inviteCopy"),"copy-invite","secondary-button") : ""));
  }
  function helpView() {
    const contacts=visibleItems("contacts","help");
    const editing=editingContactId?state.contacts.find(c=>c.id===editingContactId):null;
    const cards=contacts.length?contacts.map(contact=>'<article class="ls-item"><div class="ls-item-top"><div><strong>' + esc(contact.name) + '</strong><p>' + esc(contact.phone || "") + (contact.email ? " · " + esc(contact.email) : "") + '</p></div><div class="ls-actions">' + button(t("edit"),"edit-contact","secondary-button",'data-id="' + esc(contact.id) + '"') + button(t("delete"),"delete-contact","secondary-button danger-button",'data-id="' + esc(contact.id) + '"') + '</div></div><p class="ls-muted">' + esc(contact.emergencyInfo || "") + '</p><div class="ls-actions">' + button(t("callContact"),"call-contact","primary-button",'data-id="' + esc(contact.id) + '"') + button(t("smsContact"),"sms-contact","secondary-button",'data-id="' + esc(contact.id) + '"') + '</div></article>').join("") : '<p class="ls-empty">' + esc(t("noContact")) + '</p>';
    return panel(t("helpTitle"),'<p>' + esc(t("helpDescription")) + '</p><button type="button" class="ls-help-button" data-ls-action="contact-help">🆘 ' + esc(t("helpTitle")) + '</button>' +
      '<form id="ls-contact-form" class="ls-form">' + field(t("contactName"),"name","text",editing?editing.name:"","required maxlength='100'") + field(t("phone"),"phone","tel",editing?editing.phone:"","maxlength='40'") + field(t("email"),"email","email",editing?editing.email:"","maxlength='180'") + textarea(t("emergencyInfo"),"emergencyInfo",editing?editing.emergencyInfo:"",3,"maxlength='1200'") + '<div class="ls-actions"><button class="primary-button" type="submit">' + esc(editing?t("edit"):t("saveContact")) + '</button>' + (editing?button(t("cancel"),"cancel-contact-edit","secondary-button"):"") + '</div></form>' +
      '<div class="ls-card-list">' + cards + '</div><p class="ls-muted" id="ls-connectivity">' + esc(navigator.onLine ? t("online") : t("offline")) + '</p>');
  }
    function guideCard(g) {
    const done = Array.isArray(g.doneSteps) ? g.doneSteps : [];
    const steps = (g.steps||[]).map((s,i)=>'<label class="ls-guide-step"><input type="checkbox" data-guide-step="' + esc(g.id) + '" data-step-index="' + i + '"' + (done.indexOf(i)>=0 ? " checked" : "") + '><span>' + esc(s) + '</span></label>').join("");
    const imgs=Array.isArray(g.images)?g.images:(g.image?[g.image]:[]);
    return '<article class="ls-item">' + imgs.map((img,i)=>'<img class="ls-guide-photo" src="' + esc(img) + '" alt="' + esc(g.name) + " " + (i+1) + '">').join("") + '<div class="ls-item-top"><div><strong>' + esc(g.name) + '</strong><p>' + esc(g.description || "") + '</p></div><div class="ls-actions">' + button(t("edit"),"edit-guide","secondary-button",'data-id="' + esc(g.id) + '"') + button(t("delete"),"delete-guide","secondary-button danger-button",'data-id="' + esc(g.id) + '"') + '</div></div><div class="ls-guide-steps">' + steps + '</div>' + (g.audio ? '<audio controls preload="none" src="' + esc(g.audio) + '"></audio>' : "") + '<p class="ls-muted">' + esc(done.length) + " / " + esc((g.steps||[]).length) + '</p></article>';
  }
  function guidesView() {
    const editing=editingGuideId?state.guides.find(g=>g.id===editingGuideId):null;
    const form = '<form id="ls-guide-form" class="ls-form">' + field(t("guideName"),"name","text",editing?editing.name:"","required maxlength='120'") + textarea(t("guideDescription"),"description",editing?editing.description:"",2,"maxlength='1000'") + textarea(t("guideSteps"),"steps",editing?(editing.steps||[]).join("\n"):"",5,"required maxlength='4000'") + '<label class="ls-field"><span>' + esc(t("guideImage")) + '</span><input type="file" name="image" accept="image/*" multiple></label><label class="ls-field"><span>' + esc(t("guideAudio")) + '</span><input type="file" name="audio" accept="audio/*"></label><div class="ls-actions">' + button(t("audioRecord"),"record-guide","secondary-button") + button(t("stopRecord"),"stop-recording","secondary-button",'disabled') + '</div><audio id="ls-guide-audio-preview" controls ' + ((draftGuideAudio||(editing&&editing.audio))?'':'hidden') + ' src="' + esc(draftGuideAudio||(editing&&editing.audio)||"") + '"></audio><p class="ls-muted" id="ls-guide-audio-status" role="status" aria-live="polite"></p><button class="primary-button" type="submit">' + esc(editing?t("edit"):t("addGuide")) + '</button>' + (editing?button(t("cancel"),"cancel-guide-edit","secondary-button"):"") + '</form>';
    const guides = visibleItems("guides","guides");
    return panel(t("guideTitle"),form) + panel(t("guideTitle"),'<div class="ls-card-list">' + (guides.length ? guides.map(guideCard).join("") : '<p class="ls-empty">' + esc(t("noGuides")) + '</p>') + '</div>');
  }
    function remindersView() {
    const rows = visibleItems("reminders","calendar").slice().sort((a,b)=>a.when.localeCompare(b.when));
    const form = '<form id="ls-reminder-form" class="ls-form ls-grid">' + field(t("taskTitle"),"title","text","","required maxlength='120'") + field(t("reminderWhen"),"when","datetime-local","","required") + select(t("reminderRepeat"),"repeat",[{value:"none",label:t("noRepeat")},{value:"daily",label:t("daily")},{value:"weekly",label:t("weekly")}],"none") + '<button class="primary-button" type="submit">' + esc(t("addReminder")) + '</button></form>';
    const cards = rows.length ? rows.map(r=>'<article class="ls-item"><div class="ls-item-top"><div><strong>' + esc(r.title) + '</strong><p>' + esc(new Date(r.when).toLocaleString(lang==="nl"?"nl-NL":"en-GB")) + '</p></div>' + button(t("delete"),"delete-reminder","secondary-button danger-button",'data-id="' + esc(r.id) + '"') + '</div>' + button(t("snooze"),"snooze-reminder","secondary-button",'data-id="' + esc(r.id) + '"') + '</article>').join("") : '<p class="ls-empty">' + esc(t("noReminders")) + '</p>';
    return panel(t("reminders"),form + '<div class="ls-card-list">' + cards + '</div><p class="ls-muted">' + esc(t("notificationHint")) + '</p>' + button(t("notificationPermission"),"notification-permission","secondary-button"));
  }
  function weekPlanView() {
    const names=lang==="nl"?["maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag","zondag"]:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    const shortNames=lang==="nl"?["ma","di","wo","do","vr","za","zo"]:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const start=shiftDate(selectedDate,-((dateAt(selectedDate).getDay()+6)%7));
    const end=shiftDate(start,6);
    const editing=editingPlanId?state.weeklyPlans.find(p=>p.id===editingPlanId):null;
    const dayOptions=names.map((name,i)=>({value:String(i===6?0:i+1),label:name[0].toLocaleUpperCase()+name.slice(1)}));
    const planForm='<form id="ls-plan-form" class="ls-form ls-grid">'+field(t("planTask"),"title","text",editing?editing.title:"","required maxlength='120'")+select(t("planDay"),"weekday",dayOptions,editing?String(editing.weekday):"1")+field(t("planTime"),"time","time",editing?editing.time:"09:00","required")+textarea(t("planNotes"),"notes",editing?editing.notes:"",2,"maxlength='1200'")+'<input type="hidden" name="id" value="'+esc(editing?editing.id:"")+'"><div class="ls-form-actions"><button class="primary-button" type="submit">'+esc(editing?t("editPlan"):t("addPlan"))+'</button>'+(editing?button(t("cancel"),"cancel-plan-edit","secondary-button"):"")+'</div></form>';
    const plans=visibleItems("weeklyPlans","planning");
    const dayPanels=[];
    for(let index=0;index<7;index++){
      const date=shiftDate(start,index);
      const weekday=dateAt(date).getDay();
      const items=plans.filter(p=>Number(p.weekday)===weekday).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
      const cards=items.length?items.map(p=>{
        const done=Array.isArray(p.completedDates)&&p.completedDates.includes(date);
        return '<article class="ls-item"><div class="ls-item-top"><label class="ls-plan-done"><input type="checkbox" data-plan-complete="'+esc(p.id)+'" data-plan-date="'+date+'" '+(done?"checked":"")+'><span><strong>'+esc(p.time||"")+' · '+esc(p.title)+'</strong></span></label><div class="ls-actions">'+button(t("edit"),"edit-plan","secondary-button",'data-id="'+esc(p.id)+'"')+button(t("delete"),"delete-week-plan","secondary-button danger-button",'data-id="'+esc(p.id)+'"')+'</div></div>'+(p.notes?'<p>'+esc(p.notes)+'</p>':"")+(done?badge(t("done")):"")+'</article>';
      }).join(""):'<p class="ls-empty">'+esc(t("noPlans"))+'</p>';
      dayPanels.push('<section class="ls-plan-day"><h4>'+esc(shortNames[index][0].toLocaleUpperCase()+shortNames[index].slice(1)+' · '+prettyDate(date,{day:"numeric",month:"short"}))+'</h4><div class="ls-card-list">'+cards+'</div></section>');
    }
    return panel(t("weekplan"),'<div class="ls-inline"><label class="ls-field"><span>'+esc(t("selectDate"))+'</span><input id="ls-selected-date" type="date" value="'+esc(selectedDate)+'"></label><div class="ls-actions">'+button("‹","week-plan-prev","secondary-button",'aria-label="Previous week"')+'<strong>'+esc(prettyDate(start,{day:"numeric",month:"short"})+" – "+prettyDate(end,{day:"numeric",month:"short",year:"numeric"}))+'</strong>'+button("›","week-plan-next","secondary-button",'aria-label="Next week"')+'</div></div><p class="ls-muted">'+esc(t("dayPlanner"))+'</p><div class="ls-weekplan-grid">'+dayPanels.join("")+'</div>')+panel(editing?t("editPlan"):t("planTitle"),planForm);
  }
  function dataView() {
    const backupPanel=currentProfile()?.role==="self"
      ? panel(t("backupTitle"),'<p class="ls-muted">' + esc(t("importHint")) + '</p><div class="ls-actions">' + button(t("exportBackup"),"export-backup","primary-button") + button(t("recoveryBackup"),"export-recovery-backup","secondary-button") + '</div><p class="ls-muted">' + esc(t("recoveryHint")) + '</p><div id="ls-recovery-panel" class="ls-item"' + (pendingRecoveryCode?'':' hidden') + '><strong>' + esc(t("recoveryCode")) + '</strong><p><code id="ls-recovery-code">' + esc(pendingRecoveryCode) + '</code></p>' + button(t("copyRecovery"),"copy-recovery-code","secondary-button") + '</div><form id="ls-import-form" class="ls-form"><label class="ls-field"><span>' + esc(t("chooseFile")) + '</span><input type="file" name="file" accept=".json,application/json" required></label>' + field(t("backupPass"),"passphrase","password","","required minlength='12' autocomplete='current-password'") + select(t("importMode"),"mode",[{value:"merge",label:t("merge")},{value:"replace",label:t("replace")}],"merge") + '<button class="secondary-button" type="submit">' + esc(t("importBackup")) + '</button></form>' + '<p class="ls-muted">' + esc(t("localOnly")) + '</p>' + button(t("deleteData"),"delete-all-data","secondary-button danger-button"))
      : panel(t("backupTitle"),'<p class="ls-muted">' + esc(t("noPermission")) + '</p>');
    const conflictPanel=lastConflictReport.length?panel(t("conflictTitle")+" ("+lastConflictReport.length+")",'<p class="ls-muted">' + esc(t("conflictHint")) + '</p><div class="ls-card-list">' + lastConflictReport.map(conflict=>'<article class="ls-item"><strong>' + esc(({appointments:t("agenda"),weeklyPlans:t("weekplan"),workers:t("roster"),shifts:t("roster"),moods:t("mood"),journal:t("journalTitle"),drawings:t("drawingTitle"),guides:t("guides"),contacts:t("help"),reminders:t("reminders"),profiles:t("roles"),consents:t("roles"),invites:t("roles"),audit:t("data"),notificationLog:t("reminders")})[conflict.category]||conflict.category) + '</strong><p>' + esc(t(conflict.source==="incoming"?"importedKept":"currentKept")) + '</p><small>' + esc(conflict.at) + '</small></article>').join("") + '</div>'):"";
    return panel(t("accessibilitySettings"),'<form id="ls-preferences-form" class="ls-form"><div class="ls-check-grid"><label><input type="checkbox" name="largeText"' + (state.preferences.largeText?'checked':'') + '> ' + esc(t("largeTextSetting")) + '</label><label><input type="checkbox" name="highContrast"' + (state.preferences.highContrast?'checked':'') + '> ' + esc(t("highContrastSetting")) + '</label><label><input type="checkbox" name="reducedMotion"' + (state.preferences.reducedMotion?'checked':'') + '> ' + esc(t("reducedMotionSetting")) + '</label></div></form>') + panel(t("searchTitle"),'<form id="ls-search-form" class="ls-form"><label class="ls-field"><span>' + esc(t("searchTitle")) + '</span><input name="query" type="search" placeholder="' + esc(t("searchPlaceholder")) + '" required></label><button class="primary-button" type="submit">' + esc(t("search")) + '</button></form><div id="ls-search-results" class="ls-card-list"></div>') + backupPanel + conflictPanel;
  }
    function renderApp() {
    if (!state || !sessionKey) { renderLocked(localStorage.getItem(STORAGE_KEY) === null, ""); return; }
    lang = document.documentElement.lang === "en" ? "en" : "nl";
    const content = activeTab === "weekplan" ? weekPlanView() : activeTab === "agenda" ? agendaView() : activeTab === "mood" ? moodView() : activeTab === "help" ? helpView() : activeTab === "guides" ? guidesView() : activeTab === "reminders" ? remindersView() : activeTab === "data" ? dataView() : dashboardView();
    root.innerHTML = topBar() + tabBar() + '<div class="ls-status-row"><p id="ls-status" role="status" aria-live="polite">' + esc(t("ready")) + '</p><p class="ls-network">' + esc(navigator.onLine ? t("online") : t("offline")) + '</p></div><div class="ls-content">' + content + '</div>';
    bindEvents();
    applyPreferences();
    startAutoLock();
  }
  function applyPreferences() {
    if (!state) return;
    root.classList.toggle("ls-large-text", state.preferences.largeText === true);
    root.classList.toggle("ls-high-contrast", state.preferences.highContrast === true);
    root.classList.toggle("ls-reduced-motion", state.preferences.reducedMotion === true);
  }
  async function readImage(file, maxBytes) {
    if (!file || !file.type.startsWith("image/")) return "";
    if (file.size > 3 * 1024 * 1024) throw new Error("photo-large");
    const url = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("file"));reader.readAsDataURL(file);});
    const image = await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("image"));img.src=url;});
    const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas"); canvas.width = Math.max(1,Math.round(image.width*scale)); canvas.height = Math.max(1,Math.round(image.height*scale));
    canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);
    let quality = 0.78, result = canvas.toDataURL("image/jpeg",quality);
    while (result.length > maxBytes && quality > 0.4) { quality -= 0.08; result = canvas.toDataURL("image/jpeg",quality); }
    if (result.length > maxBytes) throw new Error("photo-large");
    return result;
  }
  function readFileData(file, limit) {
    if (!file || file.size > limit) return Promise.reject(new Error("file-large"));
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("file"));reader.readAsDataURL(file);});
  }
  function minutes(value) {
    const parts = String(value || "00:00").split(":").map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  function bufferMinutes(a) {
    const value = Number(a && a.bufferMins);
    return Number.isFinite(value) ? Math.max(0, Math.min(120, value)) : 0;
  }
  function dateStartMinutes(value) {
    const dateText = String(value || "");
    const date = new Date(dateText + "T00:00:00.000Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== dateText) return NaN;
    return Math.floor(date.getTime() / 60000);
  }
  function appointmentStartMinutes(item) {
    const start = dateStartMinutes(item.date);
    return Number.isFinite(start) ? start + minutes(item.start) : NaN;
  }
  function appointmentEndMinutes(item) {
    const start = dateStartMinutes(item.date);
    return Number.isFinite(start) ? start + minutes(item.end) + bufferMinutes(item) : NaN;
  }
  function overlap(a,b) {
    return appointmentStartMinutes(a) < appointmentEndMinutes(b) && appointmentStartMinutes(b) < appointmentEndMinutes(a);
  }
  function appointmentConflict(candidate, pool) {
    const candidates = Array.isArray(pool) ? pool : visibleItems("appointments","calendar");
    const candidateProfile = candidate.profileId || state.currentProfileId;
    const conflicting = candidates.filter(a => {
      if (a.id === candidate.id) return false;
      const sameProfile = (a.profileId || "self") === (candidateProfile || "self");
      const sameWorker = Boolean(candidate.workerId && a.workerId && a.workerId === candidate.workerId);
      if (!sameProfile && !sameWorker) return false;
      const candidateSeries = candidate.seriesId || (candidate.repeat === "weekly" ? candidate.id : "");
      const otherSeries = a.seriesId || (a.repeat === "weekly" ? a.id : "");
      if (candidateSeries && otherSeries && candidateSeries === otherSeries) return false;
      return (a.date === candidate.date && a.start === candidate.start) || overlap(a,candidate);
    });
    return conflicting.find(a => a.start === candidate.start) || conflicting[0] || null;
  }
  function appointmentConflictFeedback(candidate, conflict, exactDuplicate) {
    if (!conflict) return "";
    const candidateProfile = candidate.profileId || state.currentProfileId;
    const conflictProfile = conflict.profileId || "self";
    if ((candidateProfile || "self") !== (conflictProfile || "self")) return t("workerBusyConflict");
    const message = t(exactDuplicate ? "exactDuplicate" : "overlapBlocked");
    const title = String(conflict.title || "").trim();
    const details = title ? " " + t("conflictWith") + ": " + title + " (" + prettyDate(conflict.date) + " · " + conflict.start + "–" + conflict.end + ")." : "";
    return message + details;
  }
  function shiftConflict(candidate, pool) {
    const candidates = Array.isArray(pool) ? pool : visibleItems("shifts","roster");
    return candidates.find(shift => {
      if (shift.id === candidate.id) return false;
      if (shift.workerId !== candidate.workerId || shift.date !== candidate.date) return false;
      return minutes(candidate.start) < minutes(shift.end) && minutes(shift.start) < minutes(candidate.end);
    }) || null;
  }
    function formData(form) { return Object.fromEntries(new FormData(form).entries()); }
  function addAppointmentRepeat(appt) {
    const seriesId = appt.repeat === "weekly" ? (appt.seriesId || appt.id) : (appt.seriesId || "");
    const base = Object.assign({}, appt);
    if (seriesId) base.seriesId = seriesId;
    const result = [base];
    if (appt.repeat === "weekly") {
      // Keep a bounded eight-occurrence preview series; copies do not themselves recur.
      for (let i=1;i<8;i++) {
        result.push(Object.assign({}, appt, {
          id:uid("appointment"),
          seriesId:seriesId,
          repeat:"none",
          date:shiftDate(appt.date,i*7),
          createdAt:new Date().toISOString(),
          updatedAt:new Date().toISOString()
        }));
      }
    }
    return result;
  }
    function bindEvents() {
    $$("[data-ls-tab]").forEach(el=>el.addEventListener("click",()=>{activeTab=el.dataset.lsTab;renderApp();}));
    const profileSelect = $('select[name="active-profile"]');
    if (profileSelect) profileSelect.addEventListener("change",async()=>{state.currentProfileId=profileSelect.value;recordAudit("profile-switched",state.currentProfileId);await saveState(false);renderApp();});
    $$("[data-ls-action]").forEach(el=>el.addEventListener("click",()=>handleAction(el.dataset.lsAction,el.dataset.id,el)));
    $$("[data-guide-step]").forEach(el=>el.addEventListener("change",async()=>{const guide=state.guides.find(g=>g.id===el.dataset.guideStep);if(!guide)return;if(!requireModify("guides",guide)){el.checked=!el.checked;return;}const idx=Number(el.dataset.stepIndex);guide.doneSteps=Array.isArray(guide.doneSteps)?guide.doneSteps:[];guide.doneSteps=el.checked?Array.from(new Set(guide.doneSteps.concat(idx))):guide.doneSteps.filter(n=>n!==idx);guide.updatedAt=new Date().toISOString();if(await saveState(false))setStatus(t("saved"));}));
    const selected = $("#ls-selected-date");
    if (selected) selected.addEventListener("change",()=>{selectedDate=selected.value || localDate(new Date());renderApp();});
    $$("[data-ls-date]").forEach(el=>el.addEventListener("click",()=>{selectedDate=el.dataset.lsDate;calendarMode="day";renderApp();}));
    const appointmentFormEl = $("#ls-appointment-form");
    if (appointmentFormEl) appointmentFormEl.addEventListener("submit", async event=>{
      event.preventDefault();
      const v = formData(appointmentFormEl);
      if (!v.title.trim() || !v.date || !v.start || !v.end || minutes(v.end)<=minutes(v.start)) {setStatus(t("invalid"),true);return;}
      const existing = v.id ? state.appointments.find(a=>a.id===v.id) : null;
      if(existing && !requireModify("calendar",existing)) return;
      const now = new Date().toISOString();
      const oldSeries = existing ? (existing.seriesId || (existing.repeat==="weekly" ? existing.id : "")) : "";
      const id = v.id || uid("appointment");
      const repeat = v.repeat || "none";
      const a = {id:id,profileId:existing?existing.profileId:state.currentProfileId,title:v.title.trim(),pictogram:v.pictogram||"📅",workerId:v.workerId||"",date:v.date,start:v.start,end:v.end,location:v.location.trim(),notes:v.notes.trim(),preparation:v.preparation.trim(),reminderMins:Number(v.reminderMins)||0,bufferMins:Number(v.bufferMins)||0,repeat:repeat,createdAt:existing?existing.createdAt:now,updatedAt:now};
      if(repeat==="weekly") {
        const editingSeriesRoot=existing && existing.repeat==="weekly" && (!existing.seriesId || existing.seriesId===existing.id);
        a.seriesId=editingSeriesRoot ? (oldSeries || id) : id;
      } else if(existing && existing.repeat!=="weekly" && existing.seriesId) {
        a.seriesId=existing.seriesId;
      }
      const removeIds = new Set();
      if(existing) {
        if(existing.repeat==="weekly" && (!existing.seriesId || existing.seriesId===existing.id)) {
          state.appointments.filter(x=>x.id===existing.id || x.seriesId===existing.id).forEach(x=>removeIds.add(x.id));
        } else {
          removeIds.add(existing.id);
        }
      }
      const pool = state.appointments.filter(x=>!removeIds.has(x.id));
      const generated = addAppointmentRepeat(a);
      const foundConflicts = generated.map(candidate=>({candidate,conflict:appointmentConflict(candidate,pool)})).filter(item=>item.conflict);
      const exactDuplicate=foundConflicts.find(item=>item.conflict.date===item.candidate.date&&item.conflict.start===item.candidate.start);
      if(exactDuplicate) {
        const status=$("#ls-appointment-status");if(status)status.textContent=appointmentConflictFeedback(exactDuplicate.candidate,exactDuplicate.conflict,true);
        return;
      }
      if(foundConflicts.length) { const first=foundConflicts[0];const status=$("#ls-appointment-status");if(status)status.textContent=appointmentConflictFeedback(first.candidate,first.conflict,false);return; }
      state.appointments = pool.concat(generated);
      editingAppointmentId = "";
      recordAudit(existing?"appointment-updated":"appointment-created",a.title);
      const ok=await saveState(false);if(ok){selectedDate=a.date;renderApp();setStatus(t("saved"));}
    });
        const workerForm = $("#ls-worker-form");
    if (workerForm) workerForm.addEventListener("submit",async event=>{
      event.preventDefault();const v=formData(workerForm);if(!v.name.trim()){setStatus(t("invalid"),true);return;}
      try {
        const editingId=workerForm.dataset.editId;
        const old=editingId?state.workers.find(w=>w.id===editingId):null;
        if(old && !requireModify("roster",old)) return;
        const selectedPhoto=workerForm.elements.photo.files[0];
        const photo=selectedPhoto?await readImage(selectedPhoto,350000):(old?old.photo:"");
        const worker={id:editingId||uid("worker"),profileId:old?old.profileId:state.currentProfileId,name:v.name.trim(),role:v.role.trim(),photo:photo,createdAt:old?old.createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
        state.workers=state.workers.filter(w=>w.id!==worker.id);
        state.workers.push(worker);delete workerForm.dataset.editId;
        recordAudit(old?"worker-updated":"worker-added",worker.name);
        if(await saveState(false))renderApp();
      } catch {setStatus(t("photoTooLarge"),true);}
    });
        const shiftForm = $("#ls-shift-form");
    if (shiftForm) shiftForm.addEventListener("submit",async event=>{event.preventDefault();const v=formData(shiftForm);if(!v.workerId||!v.date||!v.start||!v.end||minutes(v.end)<=minutes(v.start)){setStatus(t("invalid"),true);return;}const editingId=shiftForm.dataset.editId;const old=editingId?state.shifts.find(s=>s.id===editingId):null;if(old&&!requireModify("roster",old))return;const item={id:editingId||uid("shift"),profileId:old?old.profileId:state.currentProfileId,workerId:v.workerId,date:v.date,start:v.start,end:v.end,createdAt:old?old.createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};const shiftOverlap=shiftConflict(item,visibleItems("shifts","roster"));if(shiftOverlap){setStatus(t("shiftOverlap"),true);return;}state.shifts=state.shifts.filter(s=>s.id!==item.id);state.shifts.push(item);delete shiftForm.dataset.editId;recordAudit(old?"shift-updated":"shift-added",v.date);if(await saveState(false))renderApp();});
    const journalForm=$("#ls-journal-form");
    if(journalForm) journalForm.addEventListener("submit",async event=>{
      event.preventDefault();const v=formData(journalForm);const picked=$('input[name="mood"]:checked');
      if(!v.text.trim()&&!draftJournalAudio&&!picked&&!editingJournalId){setStatus(t("invalid"),true);return;}
      const today=localDate(new Date());
      const old=editingJournalId?state.journal.find(e=>e.id===editingJournalId):null;
      if(old&&!requireModify("journal",old))return;
      let entry=null;
      if(old){
        old.title=(v.title||"").trim()||(lang==="nl"?"Dagboekmoment":"Journal entry");
        old.text=(v.text||"").trim();if(draftJournalAudio)old.audio=draftJournalAudio;
        old.updatedAt=new Date().toISOString();entry=old;
      }else if(v.text.trim()||draftJournalAudio){
        entry={id:uid("journal"),profileId:state.currentProfileId,title:(v.title||"").trim()||(lang==="nl"?"Dagboekmoment":"Journal entry"),text:(v.text||"").trim(),audio:draftJournalAudio,date:today,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
        state.journal.push(entry);
      }
      const existingMood=entry?state.moods.find(m=>m.journalId===entry.id):null;
      if(picked){
        const emoji=({"1":"😞","2":"🙁","3":"😐","4":"🙂","5":"😄"})[picked.value];
        if(existingMood){existingMood.emoji=emoji;existingMood.note=entry?entry.text.slice(0,300):"";existingMood.updatedAt=new Date().toISOString();}
        else state.moods.push({id:uid("mood"),profileId:state.currentProfileId,journalId:entry?entry.id:"",date:entry?entry.date:today,emoji:emoji,note:entry?entry.text.slice(0,300):"",createdAt:new Date().toISOString()});
      }else if(entry&&!existingMood&&!old){
        state.moods.push({id:uid("mood"),profileId:state.currentProfileId,journalId:entry.id,date:entry.date,emoji:"😐",note:entry.text.slice(0,300),createdAt:new Date().toISOString()});
      }
      recordAudit(old?"journal-entry-updated":entry?"journal-entry-created":"mood-saved",entry?entry.id:"mood");
      if(await saveState(false)){draftJournalAudio="";editingJournalId="";renderApp();}
    });
    const guideForm=$("#ls-guide-form");
    if(guideForm) guideForm.addEventListener("submit",async event=>{
      event.preventDefault();const v=formData(guideForm);
      if(!v.name.trim()||!v.steps.trim()){setStatus(t("invalid"),true);return;}
      try {
        const editingId=editingGuideId;
        const old=editingId?state.guides.find(g=>g.id===editingId):null;
        if(old&&!requireModify("guides",old))return;
        const images=Array.from(guideForm.elements.image.files||[]);
        if(images.length>3||images.some(f=>f.size>3*1024*1024))throw new Error("photo-large");
        let imageData=old?(Array.isArray(old.images)?old.images:(old.image?[old.image]:[])):[];
        if(images.length)imageData=await Promise.all(images.map(f=>readImage(f,350000)));
        const audioFile=guideForm.elements.audio.files[0];
        const audio=draftGuideAudio||(audioFile?await readFileData(audioFile,1024*1024):(old?old.audio:""));
        const steps=v.steps.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,50);
        if(!steps.length)throw new Error("invalid");
        const doneSteps=old&&Array.isArray(old.doneSteps)?old.doneSteps.filter(n=>n<steps.length):[];
        const guide={id:old?old.id:uid("guide"),profileId:old?old.profileId:state.currentProfileId,name:v.name.trim(),description:v.description.trim(),steps:steps,images:imageData,image:imageData[0]||"",audio:audio,doneSteps:doneSteps,createdAt:old?old.createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
        state.guides=state.guides.filter(g=>g.id!==guide.id);state.guides.push(guide);
        recordAudit(old?"guide-updated":"guide-created",guide.name);editingGuideId="";draftGuideAudio="";
        if(await saveState(false))renderApp();
      } catch(error) {setStatus(error.message==="photo-large"?t("photoTooLarge"):error.message==="file-large"?t("guideAudioTooLarge"):t("storageError"),true);}
    });
        const reminderForm=$("#ls-reminder-form");
    if(reminderForm) reminderForm.addEventListener("submit",async event=>{
      event.preventDefault();const v=formData(reminderForm);const when=new Date(v.when);
      if(!v.title.trim()||!v.when||when.getTime()<=Date.now()){setStatus(t("futureOnly"),true);return;}
      const stamp=when.toISOString();
      if(state.reminders.some(r=>r.when===stamp && r.profileId===state.currentProfileId)){setStatus(t("exactDuplicate"),true);return;}
      state.reminders.push({id:uid("reminder"),profileId:state.currentProfileId,title:v.title.trim(),when:stamp,repeat:v.repeat||"none",notifiedAt:"",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      recordAudit("reminder-created",v.title);if(await saveState(false))renderApp();
    });
    const planForm=$("#ls-plan-form");
    if(planForm) planForm.addEventListener("submit",async event=>{event.preventDefault();const v=formData(planForm);if(!v.title.trim()||v.weekday===""||!v.time){setStatus(t("invalid"),true);return;}const old=editingPlanId?state.weeklyPlans.find(p=>p.id===editingPlanId):null;if(old&&!requireModify("planning",old))return;const item={id:old?old.id:uid("plan"),profileId:old?old.profileId:state.currentProfileId,title:v.title.trim(),weekday:Number(v.weekday),time:v.time,notes:v.notes.trim(),completedDates:old&&Array.isArray(old.completedDates)?old.completedDates:[],createdAt:old?old.createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};state.weeklyPlans=state.weeklyPlans.filter(p=>p.id!==item.id);state.weeklyPlans.push(item);editingPlanId="";recordAudit(old?"week-plan-updated":"week-plan-created",item.title);if(await saveState(false))renderApp();});
    $$("[data-plan-complete]").forEach(el=>el.addEventListener("change",async()=>{const plan=state.weeklyPlans.find(p=>p.id===el.dataset.planComplete);if(!plan||!requireModify("planning",plan)){el.checked=!el.checked;return;}plan.completedDates=Array.isArray(plan.completedDates)?plan.completedDates:[];const date=el.dataset.planDate;if(el.checked&&!plan.completedDates.includes(date))plan.completedDates.push(date);if(!el.checked)plan.completedDates=plan.completedDates.filter(d=>d!==date);plan.updatedAt=new Date().toISOString();if(await saveState(false))setStatus(t("saved"));}));
    const preferencesForm=$("#ls-preferences-form");
    if(preferencesForm) preferencesForm.addEventListener("change",async()=>{state.preferences.largeText=preferencesForm.elements.largeText.checked;state.preferences.highContrast=preferencesForm.elements.highContrast.checked;state.preferences.reducedMotion=preferencesForm.elements.reducedMotion.checked;applyPreferences();if(await saveState(false))setStatus(t("saved"));});
    const profileForm=$("#ls-profile-form");
    if(profileForm) profileForm.addEventListener("submit",async event=>{event.preventDefault();if(currentProfile()?.role!=="self"){setStatus(t("noPermission"),true);return;}const v=formData(profileForm);if(!v.name.trim()){setStatus(t("invalid"),true);return;}state.profiles.push({id:uid("profile"),name:v.name.trim(),role:v.role||"caregiver",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});recordAudit("profile-created",v.name);if(await saveState(false))renderApp();});
    const consentForm=$("#ls-consent-form");
    if(consentForm) consentForm.addEventListener("submit",async event=>{
      event.preventDefault();const v=formData(consentForm);if(!v.viewerId||!v.ownerId){setStatus(t("invalid"),true);return;}
      if(v.ownerId!==state.currentProfileId||currentProfile()?.role!=="self"){setStatus(t("noPermission"),true);return;}
      const scopes=Array.from(consentForm.querySelectorAll('input[name="scope"]:checked')).map(x=>x.value);
      const modifyScopes=Array.from(consentForm.querySelectorAll('input[name="modifyScope"]:checked')).map(x=>x.value);
      modifyScopes.forEach(scope=>{if(!scopes.includes(scope))scopes.push(scope);});
      if(!scopes.length){setStatus(t("invalid"),true);return;}
      state.consents=state.consents.filter(c=>!(c.ownerId===v.ownerId&&c.viewerId===v.viewerId));
      state.consents.push({id:uid("consent"),ownerId:v.ownerId,viewerId:v.viewerId,scopes:scopes,modifyScopes:modifyScopes,revoked:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      recordAudit("consent-granted",v.viewerId);if(await saveState(false)){renderApp();setStatus(t("consentSaved"));}
    });
    const contactForm=$("#ls-contact-form");
    if(contactForm) contactForm.addEventListener("submit",async event=>{event.preventDefault();const v=formData(contactForm);if(!v.name.trim()){setStatus(t("invalid"),true);return;}const old=editingContactId?state.contacts.find(c=>c.id===editingContactId):null;if(old&&!requireModify("help",old))return;const contact={id:old?old.id:uid("contact"),profileId:old?old.profileId:state.currentProfileId,name:v.name.trim(),phone:v.phone.trim(),email:v.email.trim(),emergencyInfo:v.emergencyInfo.trim(),createdAt:old?old.createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};state.contacts=state.contacts.filter(c=>c.id!==contact.id);state.contacts.push(contact);editingContactId="";recordAudit(old?"trusted-contact-updated":"trusted-contact-added",v.name);if(await saveState(false))renderApp();});
    const searchForm=$("#ls-search-form");
    if(searchForm) searchForm.addEventListener("submit",event=>{
      event.preventDefault();const query=formData(searchForm).query.trim().toLocaleLowerCase();const results=[];
      [["appointments","calendar"],["weeklyPlans","planning"],["guides","guides"],["workers","roster"],["journal","journal"],["drawings","journal"],["shifts","roster"]].forEach(pair=>visibleItems(pair[0],pair[1]).forEach(item=>{
        const text=JSON.stringify(item).toLocaleLowerCase();if(text.includes(query))results.push({key:pair[0],item:item,label:item.title||item.name||item.date||item.action||"item"});
      }));
      const out=$("#ls-search-results");out.innerHTML=results.length?results.slice(0,100).map(r=>'<article class="ls-item"><strong>' + esc(t(r.key==="appointments"?"agenda":r.key==="guides"?"guides":r.key==="workers"?"roster":"mood")) + " · " + esc(r.label) + '</strong><p>' + esc((r.item.date||"") + " " + (r.item.start||"") + " " + (r.item.text||r.item.description||r.item.location||"").slice(0,260)) + '</p></article>').join(""):'<p class="ls-empty">' + esc(t("noResults")) + '</p>';
    });
    const importForm=$("#ls-import-form");
    if(importForm) importForm.addEventListener("submit",async event=>{
      event.preventDefault();if(currentProfile()?.role!=="self"){setStatus(t("noPermission"),true);return;}const v=formData(importForm);const file=importForm.elements.file.files[0];if(!file||file.size>8*1024*1024){setStatus(t("badPass"),true);return;}
      try{
        const envelope=JSON.parse(await file.text());const decoded=await decryptEnvelope(envelope,v.passphrase);
        if(v.mode==="replace" && !window.confirm(t("deleteConfirm")))return;
        if(v.mode==="replace")lastConflictReport=[];state=v.mode==="replace"?decoded.state:mergeStates(state,decoded.state);
        recordAudit(v.mode==="replace"?"backup-restored":"backup-merged",file.name);
        if(await saveState(false)){importForm.reset();renderApp();setStatus(t("importDone"));}
      }catch{setStatus(t("badPass"),true);}
    });
    updateDrawingCanvas();
  }

  function mergeStates(current, incoming) {
    const merged = Object.assign({}, current);
    const keys = ["profiles","appointments","workers","shifts","weeklyPlans","moods","journal","drawings","guides","contacts","reminders","consents","invites","audit","notificationLog"];
    lastConflictReport = [];
    keys.forEach(key=>{
      const byId = new Map();
      (current[key]||[]).forEach(item=>{
        const id=item.id || JSON.stringify(item);
        byId.set(id,{item,source:"current"});
      });
      (incoming[key]||[]).forEach(item=>{
        const id=item.id || JSON.stringify(item);
        const old=byId.get(id);
        if(!old){byId.set(id,{item,source:"incoming"});return;}
        if(JSON.stringify(old.item)!==JSON.stringify(item)){
          const currentStamp=String(old.item.updatedAt||old.item.createdAt||"");
          const incomingStamp=String(item.updatedAt||item.createdAt||"");
          const incomingWins=incomingStamp>=currentStamp;
          lastConflictReport.push({category:key,source:incomingWins?"incoming":"current",at:incomingWins?incomingStamp:currentStamp});
          if(incomingWins)byId.set(id,{item,source:"incoming"});
        }
      });
      merged[key]=Array.from(byId.values()).map(entry=>entry.item);
    });
    lastConflictReport=lastConflictReport.slice(0,100);
    merged.preferences=Object.assign({},incoming.preferences||{},current.preferences||{});
    if(!merged.profiles.some(p=>p.id===merged.currentProfileId))merged.currentProfileId=merged.profiles[0]?.id||"self";
    return normalizeState(merged);
  }
    function updateDrawingCanvas() {
    const canvas=$("#ls-drawing-canvas");
    if(!canvas)return;
    const ctx=canvas.getContext("2d");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.lineWidth=5;ctx.lineCap="round";ctx.strokeStyle="#343451";
    if(editingDrawingId){const saved=state.drawings.find(d=>d.id===editingDrawingId);if(saved&&saved.image){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,canvas.width,canvas.height);img.src=saved.image;}}
    let drawing=false,last=null;
    const point=event=>{const rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};};
    canvas.addEventListener("pointerdown",event=>{drawing=true;last=point(event);canvas.setPointerCapture(event.pointerId);});
    canvas.addEventListener("pointermove",event=>{if(!drawing)return;const now=point(event);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(now.x,now.y);ctx.stroke();last=now;});
    const stop=()=>{drawing=false;last=null;};canvas.addEventListener("pointerup",stop);canvas.addEventListener("pointercancel",stop);
    canvas.addEventListener("keydown",event=>{if(!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key))return;event.preventDefault();const x=canvas.width/2+(event.key==="ArrowRight"?10:event.key==="ArrowLeft"?-10:0);const y=canvas.height/2+(event.key==="ArrowDown"?10:event.key==="ArrowUp"?-10:0);ctx.fillRect(x,y,6,6);});
  }
  async function handleAction(action,id,el) {
    if(action==="lock"){lockVault(true);return;}
    if(action==="go-weekplan"){activeTab="weekplan";renderApp();return;}if(action==="go-agenda"){activeTab="agenda";renderApp();return;}if(action==="go-mood"){activeTab="mood";renderApp();return;}if(action==="go-guides"){activeTab="guides";renderApp();return;}
    if(action==="cancel-edit"){editingAppointmentId="";renderApp();return;}
    if(action==="edit-appointment"){const item=state.appointments.find(x=>x.id===id);if(!item||!requireModify("calendar",item))return;editingAppointmentId=id;selectedDate=item.date;activeTab="agenda";renderApp();const title=$("#ls-appointment-form input[name=\"title\"]");if(title)title.focus();return;}
    if(action==="edit-journal"){const item=state.journal.find(x=>x.id===id);if(!item||!requireModify("journal",item))return;editingJournalId=id;draftJournalAudio="";activeTab="mood";renderApp();const title=$("#ls-journal-form input[name=\"title\"]");if(title)title.focus();return;}
    if(action==="cancel-journal-edit"){editingJournalId="";draftJournalAudio="";renderApp();return;}
    if(action==="edit-drawing"){const item=state.drawings.find(x=>x.id===id);if(!item||!requireModify("journal",item))return;editingDrawingId=id;activeTab="mood";renderApp();const title=$('input[name="drawing-title"]');if(title)title.focus();return;}
    if(action==="cancel-drawing-edit"){editingDrawingId="";renderApp();return;}
    if(action==="edit-guide"){const item=state.guides.find(x=>x.id===id);if(!item||!requireModify("guides",item))return;editingGuideId=id;draftGuideAudio="";activeTab="guides";renderApp();const title=$("#ls-guide-form input[name=\"name\"]");if(title)title.focus();return;}
    if(action==="cancel-guide-edit"){editingGuideId="";draftGuideAudio="";renderApp();return;}
    if(action==="edit-contact"){const item=state.contacts.find(x=>x.id===id);if(!item||!requireModify("help",item))return;editingContactId=id;activeTab="help";renderApp();const title=$("#ls-contact-form input[name=\"name\"]");if(title)title.focus();return;}
    if(action==="cancel-contact-edit"){editingContactId="";renderApp();return;}
    if(action==="edit-plan"){const item=state.weeklyPlans.find(p=>p.id===id);if(!item||!requireModify("planning",item))return;editingPlanId=id;activeTab="weekplan";renderApp();const title=$("#ls-plan-form input[name=\"title\"]");if(title)title.focus();return;}
    if(action==="cancel-plan-edit"){editingPlanId="";renderApp();return;}
    if(action==="delete-appointment"){const target=state.appointments.find(x=>x.id===id);if(!target||!requireModify("calendar",target))return;const seriesRoot=target.repeat==="weekly"&&(!target.seriesId||target.seriesId===target.id);const seriesOccurrence=Boolean(target.seriesId&&!seriesRoot);const confirmation=seriesRoot?t("deleteWholeSeriesConfirm"):(seriesOccurrence?t("deleteSeriesOccurrenceConfirm"):t("deleteItem"));if(!window.confirm(confirmation))return;state.appointments=state.appointments.filter(x=>seriesRoot?(x.id!==target.id&&x.seriesId!==target.id):x.id!==id);recordAudit("appointment-deleted",id);if(await saveState(false))renderApp();return;}
    if(action==="edit-worker"){const w=state.workers.find(x=>x.id===id);if(!w||!requireModify("roster",w))return;const f=$("#ls-worker-form");if(w&&f){f.elements.name.value=w.name;f.elements.role.value=w.role||"";f.dataset.editId=w.id;f.querySelector("button[type=submit]").textContent=t("edit");f.scrollIntoView({behavior:"auto",block:"center"});}return;}
    if(action==="delete-worker"){const target=state.workers.find(x=>x.id===id);if(!target||!requireModify("roster",target))return;const linkedAppointments=state.appointments.filter(a=>a.workerId===id);const linkedShifts=state.shifts.filter(s=>s.workerId===id);if(linkedAppointments.some(a=>!canModify("calendar",a))||linkedShifts.some(s=>!canModify("roster",s))){setStatus(t("deleteWorkerLinksPermission"),true);return;}if(!window.confirm(t("deleteWorkerConfirm")))return;const now=new Date().toISOString();state.workers=state.workers.filter(w=>w.id!==id);state.shifts=state.shifts.filter(s=>s.workerId!==id);state.appointments=state.appointments.map(a=>a.workerId===id?Object.assign({},a,{workerId:"",updatedAt:now}):a);recordAudit("worker-deleted",id);if(await saveState(false))renderApp();return;}
    if(action==="edit-shift"){const s=state.shifts.find(x=>x.id===id);if(!s||!requireModify("roster",s))return;const f=$("#ls-shift-form");if(f){f.elements.workerId.value=s.workerId;f.elements.date.value=s.date;f.elements.start.value=s.start;f.elements.end.value=s.end;f.dataset.editId=s.id;f.querySelector("button[type=submit]").textContent=t("edit");f.scrollIntoView({behavior:"auto",block:"center"});}return;}
    if(action==="delete-week-plan"||action==="delete-shift"||action==="delete-reminder"||action==="delete-guide"||action==="delete-journal"||action==="delete-drawing"||action==="delete-contact"||action==="revoke-consent"||action==="delete-profile"){
      const map={"delete-week-plan":"weeklyPlans","delete-shift":"shifts","delete-reminder":"reminders","delete-guide":"guides","delete-journal":"journal","delete-drawing":"drawings","delete-contact":"contacts","revoke-consent":"consents","delete-profile":"profiles"};
      const key=map[action];const target=(state[key]||[]).find(x=>x.id===id);
      const scopeByAction={"delete-week-plan":"planning","delete-shift":"roster","delete-reminder":"calendar","delete-guide":"guides","delete-journal":"journal","delete-drawing":"journal","delete-contact":"help"};
      if(scopeByAction[action]&&(!target||!requireModify(scopeByAction[action],target)))return;
      if(action==="revoke-consent"&&(!target||target.ownerId!==state.currentProfileId||currentProfile()?.role!=="self")){setStatus(t("noPermission"),true);return;}
      if(action==="delete-profile"){if(currentProfile()?.role!=="self"||id==="self"){setStatus(t("noPermission"),true);return;}const hasData=["appointments","workers","shifts","moods","journal","drawings","guides","contacts","reminders"].some(key=>(state[key]||[]).some(item=>item.profileId===id));if(hasData){setStatus(t("profileDataExists"),true);return;}}
      if(!window.confirm(t("deleteItem")))return;
      state[key]=state[key].filter(x=>x.id!==id);
      if(action==="delete-journal")state.moods=state.moods.filter(m=>m.journalId!==id);
      if(action==="delete-profile"){state.consents=state.consents.filter(c=>c.viewerId!==id&&c.ownerId!==id);state.currentProfileId=state.profiles[0]?.id||"self";}
      recordAudit(action,id);if(await saveState(false))renderApp();return;
    }
    if(action==="month-prev"){selectedDate=shiftDate(selectedDate,-new Date(selectedDate+"T00:00:00").getDate()+1);const d=dateAt(selectedDate);d.setMonth(d.getMonth()-1);selectedDate=localDate(d);renderApp();return;}
    if(action==="month-next"){const d=dateAt(selectedDate);d.setMonth(d.getMonth()+1);selectedDate=localDate(d);renderApp();return;}
    if(action==="mode-day"){calendarMode="day";renderApp();return;}if(action==="mode-week"){calendarMode="week";renderApp();return;}if(action==="mode-month"){calendarMode="month";renderApp();return;}
    if(action==="week-plan-prev"){selectedDate=shiftDate(selectedDate,-7);renderApp();return;}if(action==="week-plan-next"){selectedDate=shiftDate(selectedDate,7);renderApp();return;}
    if(action==="clear-canvas"){const c=$("#ls-drawing-canvas");if(c){const ctx=c.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);}return;}
    if(action==="save-drawing"){const c=$("#ls-drawing-canvas");const title=$('input[name="drawing-title"]')?.value.trim();if(!c||!title){setStatus(t("invalid"),true);return;}try{const old=editingDrawingId?state.drawings.find(d=>d.id===editingDrawingId):null;if(old&&!requireModify("journal",old))return;const item={id:old?old.id:uid("drawing"),profileId:old?old.profileId:state.currentProfileId,title:title,image:c.toDataURL("image/jpeg",0.78),date:old?old.date:localDate(new Date()),createdAt:old?old.createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};state.drawings=state.drawings.filter(d=>d.id!==item.id);state.drawings.push(item);recordAudit(old?"drawing-updated":"drawing-saved",title);editingDrawingId="";if(await saveState(false))renderApp();}catch{setStatus(t("storageError"),true);}return;}
    if(action==="record-journal"||action==="record-guide"){recordingTarget=action==="record-guide"?"guide":"journal";const start=root.querySelector('[data-ls-action="'+action+'"]');if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setStatus(t("unsupported"),true);return;}try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});recordingChunks=[];mediaRecorder=new MediaRecorder(stream);mediaRecorder.ondataavailable=event=>{if(event.data&&event.data.size)recordingChunks.push(event.data);};mediaRecorder.onstop=async()=>{stream.getTracks().forEach(track=>track.stop());const blob=new Blob(recordingChunks,{type:mediaRecorder.mimeType||"audio/webm"});if(blob.size>1024*1024){setStatus(t("audioTooLarge"),true);if(recordingTarget==="guide")draftGuideAudio="";else draftJournalAudio="";}else{const data=await readFileData(new File([blob],"life-suite-audio.webm",{type:blob.type}),1024*1024);if(recordingTarget==="guide")draftGuideAudio=data;else draftJournalAudio=data;const audio=$(recordingTarget==="guide"?"#ls-guide-audio-preview":"#ls-journal-audio-preview");if(audio){audio.src=data;audio.hidden=false;}const status=$(recordingTarget==="guide"?"#ls-guide-audio-status":"#ls-audio-status");if(status)status.textContent=t("audioReady");}const stop=$('[data-ls-action="stop-recording"]');if(stop)stop.disabled=true;if(start)start.disabled=false;};mediaRecorder.start();if(start)start.disabled=true;const stop=$('[data-ls-action="stop-recording"]');if(stop)stop.disabled=false;setStatus(t("ready"));}catch{setStatus(t("unsupported"),true);}return;}
    if(action==="stop-recording"){if(mediaRecorder&&mediaRecorder.state!=="inactive")mediaRecorder.stop();return;}
    if(action==="contact-help"){const contact=visibleItems("contacts","help")[0];if(!contact){setStatus(t("noContact"),true);return;}if(!contact.phone){setStatus(t("noPhone"),true);return;}if(window.confirm(t("callConfirm")))window.location.href="tel:"+contact.phone.replace(/[^\d+]/g,"");return;}
    if(action==="call-contact"){const c=state.contacts.find(x=>x.id===id)||visibleItems("contacts","help")[0];if(!c||!c.phone){setStatus(t("noPhone"),true);return;}if(window.confirm(t("callConfirm")))window.location.href="tel:"+c.phone.replace(/[^\d+]/g,"");return;}
    if(action==="sms-contact"){const c=state.contacts.find(x=>x.id===id)||visibleItems("contacts","help")[0];if(!c||!c.phone){setStatus(t("noPhone"),true);return;}if(window.confirm(t("smsConfirm")))window.location.href="sms:"+c.phone.replace(/[^\d+]/g,"");return;}
    if(action==="notification-permission"){if(!("Notification" in window)){setStatus(t("noNotification"),true);return;}const permission=await Notification.requestPermission();setStatus(permission==="granted"?t("permissionGranted"):t("permissionNeeded"),permission!=="granted");return;}
    if(action==="snooze-reminder"){const r=state.reminders.find(x=>x.id===id);if(r&&!requireModify("calendar",r))return;if(r){r.when=new Date(Date.now()+10*60*1000).toISOString();r.notifiedAt="";r.updatedAt=new Date().toISOString();if(await saveState(false))renderApp();}return;}
    if(action==="export-backup"){if(currentProfile()?.role!=="self"){setStatus(t("noPermission"),true);return;}try{const envelope=await encryptState(state,sessionKey,b64ToBytes(saltB64));downloadBlob(new Blob([JSON.stringify(envelope,null,2)],{type:"application/json"}),"project-n-01-encrypted-life-backup.json");recordAudit("backup-exported","");await saveState(false);setStatus(t("exportDone"));}catch{setStatus(t("exportUnavailable"),true);}return;}
    if(action==="export-recovery-backup"){if(currentProfile()?.role!=="self"){setStatus(t("noPermission"),true);return;}try{const random=crypto.getRandomValues(new Uint8Array(24));pendingRecoveryCode=bytesToB64(random).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");const recoverySalt=crypto.getRandomValues(new Uint8Array(16));const recoveryKey=await deriveKey(pendingRecoveryCode,recoverySalt);const envelope=await encryptState(state,recoveryKey,recoverySalt);downloadBlob(new Blob([JSON.stringify(envelope,null,2)],{type:"application/json"}),"project-n-01-recovery-backup.json");const output=$("#ls-recovery-code");const box=$("#ls-recovery-panel");if(output)output.textContent=pendingRecoveryCode;if(box)box.hidden=false;recordAudit("recovery-backup-created","");await saveState(false);setStatus(t("recoveryCreated"));}catch{setStatus(t("exportUnavailable"),true);}return;}
    if(action==="copy-recovery-code"){if(!pendingRecoveryCode){setStatus(t("exportUnavailable"),true);return;}try{await navigator.clipboard.writeText(pendingRecoveryCode);setStatus(t("recoveryCopied"));}catch{setStatus(pendingRecoveryCode);}return;}
    if(action==="delete-all-data"){if(currentProfile()?.role!=="self"){setStatus(t("noPermission"),true);return;}if(!window.confirm(t("deleteConfirm")))return;stopAutoLock();localStorage.removeItem(STORAGE_KEY);state=null;sessionKey=null;saltB64=null;renderLocked(true,t("deleted"));return;}
    if(action==="create-invite"){if(currentProfile()?.role!=="self"){setStatus(t("noPermission"),true);return;}const random=crypto.getRandomValues(new Uint8Array(10));pendingInviteCode=Array.from(random).map(b=>("0"+b.toString(16)).slice(-2)).join("").toUpperCase();state.invites.push({id:uid("invite"),ownerId:state.currentProfileId,code:pendingInviteCode,role:"caregiver",status:"pending",createdAt:new Date().toISOString()});await saveState(false);renderApp();return;}
    if(action==="copy-invite"){try{await navigator.clipboard.writeText(pendingInviteCode);setStatus(t("saved"));}catch{setStatus(pendingInviteCode);}return;}
  }
  function startReminderMonitor() {
    if(reminderTimer)clearInterval(reminderTimer);
    reminderTimer=window.setInterval(async()=>{
      if(!state||!sessionKey||document.visibilityState==="hidden")return;
      const now=Date.now();
      let changed=false;
      for(const a of state.appointments){
        const due=new Date(a.date+"T"+a.start+":00").getTime()-(Number(a.reminderMins)||0)*60000;
        const logId="appointment:"+a.id;
        if(Number(a.reminderMins)>0&&due<=now&&due>now-10*60000&&!state.notificationLog.some(n=>n.id===logId)){
          state.notificationLog.push({id:logId,at:new Date().toISOString()});changed=true;
          if("Notification" in window&&Notification.permission==="granted"){try{new Notification(t("reminderFired"),{body:a.title,tag:logId});}catch{setStatus(t("reminderFired")+": "+a.title);}}
          else{setStatus(t("reminderFired")+": "+a.title);}
        }
      }
      state.notificationLog=state.notificationLog.slice(-1000);
      for(const r of state.reminders){
        if(r.notifiedAt)continue;
        let reminderTime=new Date(r.when).getTime();
        if(!Number.isFinite(reminderTime)||reminderTime>now)continue;
        const repeating=r.repeat==="daily"||r.repeat==="weekly";
        if(now-reminderTime>10*60*1000){
          if(repeating){
            const d=new Date(reminderTime);
            const step=r.repeat==="daily"?1:7;
            while(d.getTime()<=now)d.setDate(d.getDate()+step);
            r.when=d.toISOString();r.updatedAt=new Date().toISOString();changed=true;
          } else {
            // Mark old one-off reminders as missed so they do not remain stuck overdue.
            r.notifiedAt=new Date().toISOString();changed=true;
          }
          continue;
        }
        r.notifiedAt=new Date().toISOString();changed=true;
        const title=t("reminderFired");
        if("Notification" in window && Notification.permission==="granted"){try{new Notification(title,{body:r.title,tag:"project-n-reminder-"+r.id});}catch{setStatus(title+": "+r.title);}}
        else {setStatus(title+": "+r.title);}
        if(repeating){
          const d=new Date(r.when);const step=r.repeat==="daily"?1:7;
          do { d.setDate(d.getDate()+step); } while(d.getTime()<=now);
          r.when=d.toISOString();r.notifiedAt="";
        }
      }
      if(changed)await saveState(false);
    },15000);
  }
  function applyExternalLanguage() {
    const next=document.documentElement.lang==="en"?"en":"nl";
    if(next===lang)return;
    lang=next;
    if(state&&sessionKey)renderApp();
    else renderLocked(localStorage.getItem(STORAGE_KEY)===null,"");
  }
  root.addEventListener("click",event=>{if(event.target && event.target.matches('input[type="file"]'))filePickerPending=true;});
  document.addEventListener("change",event=>{
    if(event.target && event.target.matches && event.target.matches('input[type="file"]'))filePickerPending=false;
    if(event.target && (event.target.id==="language"||event.target.id==="language-settings"))applyExternalLanguage();
  });
  ["pointerdown","keydown","touchstart","scroll"].forEach(eventName=>document.addEventListener(eventName,()=>{if(sessionKey)startAutoLock();},{passive:true}));
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="hidden"&&sessionKey&&!filePickerPending)lockVault(true);
    if(document.visibilityState==="visible")filePickerPending=false;
  });
  window.addEventListener("pagehide",()=>{stopAutoLock();if(reminderTimer)clearInterval(reminderTimer);if(mediaRecorder&&mediaRecorder.state!=="inactive")try{mediaRecorder.stop();}catch{};});
  window.addEventListener("online",()=>{const n=$("#ls-connectivity");if(n)n.textContent=t("online");});
  window.addEventListener("offline",()=>{const n=$("#ls-connectivity");if(n)n.textContent=t("offline");});
  if(!window.crypto||!crypto.subtle){renderLocked(true,t("unsupported"));return;}
  let hasVault=false;try{hasVault=localStorage.getItem(STORAGE_KEY)!==null;}catch{}
  renderLocked(!hasVault,"");
})();