/* Mivoryntra next features — private data is written only through the encrypted vault. */
(() => {
  "use strict";
  const copy = {
    nl: {
      navAgenda:"Agenda", navMood:"Stemming", navPeople:"Vertrouwde mensen", navWork:"Wie werkt er?", introAgain:"Introductie opnieuw bekijken",
      agendaEyebrow:"OVERZICHT", agendaTitle:"Mijn agenda", agendaIntro:"Beheer afspraken, voorkom dubbele boekingen en bekijk wat er de komende dagen op de planning staat.",
      agendaTitleLabel:"Waar gaat de afspraak over?", agendaDate:"Datum", agendaTime:"Tijd", agendaDuration:"Duur", duration15:"15 minuten", duration30:"30 minuten", duration45:"45 minuten", duration60:"1 uur", duration90:"1,5 uur", duration120:"2 uur",
      agendaRepeat:"Herhalen", repeat1:"Eenmalig", repeat2:"Elke week · 2 keer totaal", repeat4:"Elke week · 4 keer totaal", repeat8:"Elke week · 8 keer totaal",
      agendaReminder:"Herinnering", reminderNone:"Geen herinnering", reminder5:"5 minuten vooraf", reminder15:"15 minuten vooraf", reminder30:"30 minuten vooraf",
      agendaEnableReminders:"Meldingen inschakelen", reminderEnabledStatus:"Meldingen zijn ingeschakeld. Herinneringen werken zolang Mivoryntra open is en meldingen zijn toegestaan.", reminderUnsupported:"Deze browser ondersteunt geen meldingen.", reminderDenied:"Meldingen zijn niet toegestaan. Controleer de browserinstellingen.",
      agendaRepeatHint:"Wekelijkse herhalingen worden als losse afspraken aangemaakt; wijzigingen gelden per afspraak.", agendaRecurringSaved:"{count} wekelijkse afspraken zijn opgeslagen.",
      agendaAdd:"Afspraak opslaan",
      agendaEmpty:"Er staan nog geen afspraken in je planner.", agendaDone:"Afgerond", agendaUndo:"Opnieuw openzetten", agendaDelete:"Afspraak verwijderen", agendaEdit:"Afspraak bewerken", agendaCancelEdit:"Bewerken annuleren", agendaUpdate:"Wijzigingen opslaan", agendaUpdated:"De afspraak is bijgewerkt.", agendaEditStarted:"Je kunt de afspraak nu aanpassen.",
      weekHeading:"De komende 7 dagen", agendaSaved:"De afspraak is veilig opgeslagen.", agendaDuplicate:"Deze afspraak botst mogelijk met een andere afspraak of laat minder dan 30 minuten wisseltijd over. Kies een ander tijdstip of bewerk de bestaande afspraak.", agendaError:"Opslaan lukte niet. Controleer of je kluis ontgrendeld is en voldoende ruimte heeft.",
      moodEyebrow:"EVEN INCHECKEN", moodTitle:"Hoe voel je je vandaag?", moodIntro:"Kies het gevoel dat het beste past. Je hoeft het niet uit te leggen.",
      moodLabel:"Mijn stemming", chooseMood:"Kies een stemming…", moodNote:"Wil je er iets bij vertellen? (optioneel)", moodSave:"Stemming opslaan",
      mood1:"Heel moeilijk", mood2:"Moeilijk", mood3:"Gaat wel", mood4:"Goed", mood5:"Heel goed",
      moodSaved:"Je stemming is veilig opgeslagen.", moodEmpty:"Er zijn nog geen stemmingen opgeslagen.", moodHistory:"Recente check-ins", moodError:"Opslaan lukte niet. Ontgrendel de kluis en controleer of er voldoende ruimte is.",
      peopleEyebrow:"MENSEN OM JE HEEN", peopleTitle:"Vertrouwde mensen", peopleIntro:"Bewaar contactgegevens van mensen bij wie je terechtkunt. Deze gegevens blijven in jouw versleutelde kluis.",
      peopleName:"Naam", peoplePhoto:"Foto (optioneel, maximaal 120 KB)", peoplePhotoTooLarge:"Kies een PNG-, JPG- of WebP-foto van maximaal 120 KB.", peopleRole:"Wie is deze persoon voor jou?", peopleContact:"Telefoon, e-mail of andere contactgegevens", peopleDetails:"Extra informatie (optioneel)", peopleAdd:"Contact opslaan",
      peopleEmpty:"Je hebt nog geen vertrouwde mensen toegevoegd.", peopleDelete:"Contact verwijderen", peopleEdit:"Contact bewerken", peopleCancelEdit:"Bewerken annuleren", peopleUpdate:"Wijzigingen opslaan", peopleUpdated:"Contact is bijgewerkt.", peopleEditStarted:"Je kunt het contact nu aanpassen.", peopleSaved:"Contact is veilig opgeslagen.", peopleError:"Opslaan lukte niet. Ontgrendel de kluis en controleer of er voldoende ruimte is.",
      workEyebrow:"DAG- EN WEEKPLANNING", workTitle:"Wie werkt er vandaag?", workIntro:"Bewaar per dag wie er werkt. Kies een datum, voeg een naam en foto toe en pas de planning op elk moment aan.",
      workDate:"Voor welke datum?", workName:"Naam medewerker of begeleider", workRole:"Functie of rol (optioneel)", workPhoto:"Foto (optioneel, maximaal 120 KB)", workPhotoAlt:"Foto van", workPhotoTooLarge:"Kies een PNG-, JPG- of WebP-foto van maximaal 120 KB.", workNotes:"Opmerking (optioneel)", workSave:"Dienst opslaan",
      workWeekHeading:"Weekplanning", workPreviousWeek:"Vorige week", workNextWeek:"Volgende week", workCopyPrevious:"Kopieer vorige week", workCopySuccess:"{count} diensten uit de vorige week gekopieerd.", workCopyNone:"Er zijn geen nieuwe diensten gekopieerd; de week is leeg of medewerkers stonden al ingepland.", workCopyError:"De vorige week kon niet worden gekopieerd. Controleer of er ruimte is in de kluis.", workEmpty:"Voor deze dag is nog niemand ingepland.", workWeekEmpty:"Er zijn deze week nog geen medewerkers ingepland.",
      workEdit:"Planning bewerken", workDelete:"Planning verwijderen", workCancelEdit:"Bewerken annuleren", workUpdate:"Wijzigingen opslaan", workSaved:"De planning is opgeslagen.", workUpdated:"De planning is bijgewerkt.", workEditStarted:"Je kunt deze planning nu aanpassen.", workDuplicate:"Deze persoon staat op deze datum al ingepland. Bewerk de bestaande planning om dubbele vermeldingen te voorkomen.", workError:"Opslaan lukte niet. Controleer of de kluis ontgrendeld is en voldoende ruimte heeft.",
      secureGateTitle:"Je persoonlijke gegevens zijn vergrendeld", secureGateText:"Dagboek, stemming, afspraken, contacten en tekeningen worden alleen opgeslagen in je versleutelde kluis op dit apparaat. Ontgrendel de kluis via Routines om verder te gaan.",
      openVault:"Naar de kluisinstellingen", privateLocalOnly:"Alleen op dit apparaat · versleutelde opslag · geen cloud-synchronisatie",
      journalSave:"Notitie veilig opslaan", journalSaveStatus:"Je notitie is veilig opgeslagen in de kluis.", journalEmpty:"Schrijf eerst iets voordat je het opslaat.",
      journalListTitle:"Bewaarde notities", journalEmptyList:"Er zijn nog geen notities veilig opgeslagen.", journalDelete:"Notitie verwijderen", journalDeleteConfirm:"Wil je deze bewaarde notitie verwijderen?",
      journalStorageHint:"Een notitie wordt niet automatisch opgeslagen. Gebruik de knop om de tekst bewust in je versleutelde kluis te bewaren.",
      drawingSave:"Tekening veilig opslaan", drawingsTitle:"Bewaarde tekeningen", drawingsEmpty:"Er zijn nog geen tekeningen opgeslagen.", drawingDelete:"Tekening verwijderen",
      drawingSaved:"Je tekening is veilig opgeslagen.", drawingEmpty:"De tekening kon niet worden opgeslagen. Teken eerst iets, ontgrendel de kluis en probeer opnieuw.",
      drawingTooLarge:"Deze tekening is te groot om veilig op te slaan. Maak de tekening kleiner en probeer opnieuw.",
      secureDeleteConfirm:"Wil je dit item definitief verwijderen?", deleting:"Verwijderen…", today:"Vandaag", done:"Klaar", cancel:"Annuleren"
    },
    en: {
      navAgenda:"Agenda", navMood:"Mood", navPeople:"Trusted people", navWork:"Staff on duty", introAgain:"View the introduction again",
      agendaEyebrow:"OVERVIEW", agendaTitle:"My agenda", agendaIntro:"Manage appointments, prevent duplicates, and see what is planned for the coming days.",
      agendaTitleLabel:"What is the appointment about?", agendaDate:"Date", agendaTime:"Time", agendaDuration:"Duration", duration15:"15 minutes", duration30:"30 minutes", duration45:"45 minutes", duration60:"1 hour", duration90:"1.5 hours", duration120:"2 hours",
      agendaRepeat:"Repeat", repeat1:"One time", repeat2:"Weekly · 2 occurrences total", repeat4:"Weekly · 4 occurrences total", repeat8:"Weekly · 8 occurrences total",
      agendaReminder:"Reminder", reminderNone:"No reminder", reminder5:"5 minutes before", reminder15:"15 minutes before", reminder30:"30 minutes before",
      agendaEnableReminders:"Enable notifications", reminderEnabledStatus:"Notifications are enabled. Reminders work while Mivoryntra is open and notifications are allowed.", reminderUnsupported:"This browser does not support notifications.", reminderDenied:"Notifications are not allowed. Check your browser settings.",
      agendaRepeatHint:"Weekly repetitions are created as separate appointments; edit each occurrence individually.", agendaRecurringSaved:"{count} weekly appointments were saved.",
      agendaAdd:"Save appointment",
      agendaEmpty:"There are no appointments in your planner yet.", agendaDone:"Completed", agendaUndo:"Mark as open", agendaDelete:"Delete appointment", agendaEdit:"Edit appointment", agendaCancelEdit:"Cancel editing", agendaUpdate:"Save changes", agendaUpdated:"Appointment updated.", agendaEditStarted:"You can edit this appointment now.",
      weekHeading:"The next 7 days", agendaSaved:"Appointment saved securely.", agendaDuplicate:"This appointment overlaps another one or leaves less than 30 minutes between appointments. Choose another time or edit the existing appointment.", agendaError:"Could not save. Check that your vault is unlocked and has enough free space.",
      moodEyebrow:"CHECKING IN", moodTitle:"How are you feeling today?", moodIntro:"Choose the feeling that fits best. You do not have to explain it.",
      moodLabel:"My mood", chooseMood:"Choose a mood…", moodNote:"Would you like to add a note? (optional)", moodSave:"Save mood",
      mood1:"Very difficult", mood2:"Difficult", mood3:"Okay", mood4:"Good", mood5:"Very good",
      moodSaved:"Your mood was saved securely.", moodEmpty:"No moods have been saved yet.", moodHistory:"Recent check-ins", moodError:"Could not save. Unlock the vault and check that there is enough free space.",
      peopleEyebrow:"YOUR PEOPLE", peopleTitle:"Trusted people", peopleIntro:"Keep contact details for people you can turn to. These details stay in your encrypted vault.",
      peopleName:"Name", peoplePhoto:"Photo (optional, maximum 120 KB)", peoplePhotoTooLarge:"Choose a PNG, JPG or WebP photo of 120 KB or less.", peopleRole:"How do you know this person?", peopleContact:"Phone, email or other contact details", peopleDetails:"Extra details (optional)", peopleAdd:"Save contact",
      peopleEmpty:"You have not added any trusted people yet.", peopleDelete:"Delete contact", peopleEdit:"Edit contact", peopleCancelEdit:"Cancel editing", peopleUpdate:"Save changes", peopleUpdated:"Contact updated.", peopleEditStarted:"You can edit this contact now.", peopleSaved:"Contact saved securely.", peopleError:"Could not save. Unlock the vault and check that there is enough free space.",
      workEyebrow:"DAY AND WEEK PLANNING", workTitle:"Who is working today?", workIntro:"Keep a schedule of who is working each day. Choose a date, add a name and photo, and update the plan at any time.",
      workDate:"Date", workName:"Staff member or support worker name", workRole:"Role (optional)", workPhoto:"Photo (optional, maximum 120 KB)", workPhotoAlt:"Photo of", workPhotoTooLarge:"Choose a PNG, JPG or WebP photo of 120 KB or less.", workNotes:"Notes (optional)", workSave:"Save shift",
      workWeekHeading:"Weekly roster", workPreviousWeek:"Previous week", workNextWeek:"Next week", workCopyPrevious:"Copy previous week", workCopySuccess:"Copied {count} shifts from the previous week.", workCopyNone:"No new shifts were copied; the week is empty or staff were already scheduled.", workCopyError:"Could not copy last week's roster. Check that the vault has enough space.", workEmpty:"No one is scheduled for this day yet.", workWeekEmpty:"No staff are scheduled for this week yet.",
      workEdit:"Edit shift", workDelete:"Delete shift", workCancelEdit:"Cancel editing", workUpdate:"Save changes", workSaved:"The schedule was saved.", workUpdated:"The schedule was updated.", workEditStarted:"You can edit this schedule now.", workDuplicate:"This person is already scheduled for this date. Edit the existing entry to avoid a duplicate.", workError:"Could not save. Check that the vault is unlocked and has enough free space.",
      secureGateTitle:"Your personal information is locked", secureGateText:"Journal, mood, appointments, contacts and drawings are saved only in your encrypted vault on this device. Unlock the vault under Routines to continue.",
      openVault:"Open vault settings", privateLocalOnly:"This device only · encrypted storage · no cloud sync",
      journalSave:"Save note securely", journalSaveStatus:"Your note was saved securely in the vault.", journalEmpty:"Write something before saving it.",
      journalListTitle:"Saved notes", journalEmptyList:"There are no securely saved notes yet.", journalDelete:"Delete note", journalDeleteConfirm:"Delete this saved note?",
      journalStorageHint:"A note is not saved automatically. Use this button to deliberately keep the text in your encrypted vault.",
      drawingSave:"Save drawing securely", drawingsTitle:"Saved drawings", drawingsEmpty:"No drawings have been saved yet.", drawingDelete:"Delete drawing",
      drawingSaved:"Your drawing was saved securely.", drawingEmpty:"The drawing could not be saved. Draw something, unlock the vault and try again.",
      drawingTooLarge:"This drawing is too large to store securely. Make it smaller and try again.",
      secureDeleteConfirm:"Permanently delete this item?", deleting:"Deleting…", today:"Today", done:"Done", cancel:"Cancel"
    }
  };
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  let language = "nl";
  let lastUnlocked = false;
  let editingAppointmentId = null;
  let editingPersonId = null;
  let editingPersonPhoto = "";
  let editingWorkScheduleId = null;
  let editingWorkSchedulePhoto = "";
  let workWeekStart = null;
  const app = () => window.ProjectNApp;
  const text = key => (copy[language] && copy[language][key]) || copy.nl[key] || key;
  const id = prefix => prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  const localDate = (d) => {
    const date = d || new Date();
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  };
  const mondayOf = value => {
    const date = new Date(value);
    date.setHours(12,0,0,0);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return date;
  };
  const addDays = (value, count) => { const date = new Date(value); date.setDate(date.getDate()+count); return date; };
  const dateLabel = value => {
    if (!value) return "";
    const date = new Date(value.length === 10 ? value + "T12:00:00" : value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", { day:"numeric", month:"short", year:"numeric" }).format(date);
  };
  function make(tag, className, label) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (label !== undefined && label !== null) node.textContent = String(label);
    return node;
  }
  function button(label, className, action) {
    const node = make("button", className || "secondary-button", label);
    node.type = "button";
    if (action) node.addEventListener("click", action);
    return node;
  }
  function secureData() {
    if (!app() || !app().isVaultUnlocked()) throw new Error("vault-locked");
    const data = app().readVaultData() || {};
    return {
      ...data,
      routines: Array.isArray(data.routines) ? data.routines : [],
      journalEntries: Array.isArray(data.journalEntries) ? data.journalEntries : [],
      savedDrawings: Array.isArray(data.savedDrawings) ? data.savedDrawings : [],
      agendaItems: Array.isArray(data.agendaItems) ? data.agendaItems : [],
      moodEntries: Array.isArray(data.moodEntries) ? data.moodEntries : [],
      trustedPeople: Array.isArray(data.trustedPeople) ? data.trustedPeople : [],
      workStaff: Array.isArray(data.workStaff) ? data.workStaff : [],
      workSchedules: Array.isArray(data.workSchedules) ? data.workSchedules : []
    };
  }
  async function updateSecure(mutator) {
    if (!app() || !app().isVaultUnlocked()) throw new Error("vault-locked");
    return app().updateVaultData(current => {
      const data = current && typeof current === "object" ? current : {};
      for (const key of ["routines","journalEntries","savedDrawings","agendaItems","moodEntries","trustedPeople","workStaff","workSchedules"]) {
        if (!Array.isArray(data[key])) data[key] = [];
      }
      const nextData = mutator(data) || data;
      // Stay below the encryption helper's 1 MB hard limit so a failed save never silently replaces valid vault data.
      const encodedSize = new TextEncoder().encode(JSON.stringify(nextData)).byteLength;
      if (encodedSize > 900_000) throw new Error("vault-data-too-large");
      return nextData;
    });
  }
  function secureGate() {
    const gate = make("div", "private-gate");
    const lockMark = make("div", "private-gate-mark", "✦");
    lockMark.setAttribute("aria-hidden", "true");
    const heading = make("h3", "", text("secureGateTitle")); heading.dataset.featureText = "secureGateTitle";
    const explain = make("p", "", text("secureGateText")); explain.dataset.featureText = "secureGateText";
    gate.append(lockMark, heading, explain);
    const action = button(text("openVault"), "primary-button", () => app().focusVaultSetup());
    action.dataset.featureText = "openVault";
    const hint = make("p", "privacy-hint", text("privateLocalOnly")); hint.dataset.featureText = "privateLocalOnly";
    gate.append(action, hint);
    return gate;
  }
  function addView(viewId, icon, navKey, viewTitleKey, eyebrowKey, introKey, contentBuilder) {
    const nav = $(".nav-list");
    const anchor = $('[data-view="notes"]', nav);
    const navButton = make("button", "nav-item");
    navButton.type = "button";
    navButton.dataset.view = viewId;
    const glyph = make("span", "", icon);
    glyph.setAttribute("aria-hidden", "true");
    const caption = make("span", "", text(navKey));
    caption.dataset.featureText = navKey;
    navButton.append(glyph, caption);
    nav.append(navButton);
    navButton.addEventListener("click", () => app().setView(viewId));

    const view = make("section", "view");
    view.id = "view-" + viewId;
    view.setAttribute("aria-labelledby", viewId + "-title");
    const heading = make("div", "section-heading");
    const headingInner = make("div");
    const eyebrow = make("p", "eyebrow", text(eyebrowKey));
    eyebrow.dataset.featureText = eyebrowKey;
    const h2 = make("h2", "", text(viewTitleKey));
    h2.id = viewId + "-title";
    h2.dataset.featureText = viewTitleKey;
    const intro = make("p", "section-subtitle", text(introKey));
    intro.dataset.featureText = introKey;
    headingInner.append(eyebrow, h2, intro);
    heading.append(headingInner);
    view.append(heading);
    const area = make("div", "feature-area");
    const editor = make("div", "feature-editor");
    editor.append(contentBuilder());
    area.append(editor);
    view.append(area);
    const footer = $(".app-footer");
    if (footer) footer.before(view);
    else $("#main").append(view);
    return { view, navButton, editor, area };
  }

  const agenda = addView("agenda", "◷", "navAgenda", "agendaTitle", "agendaEyebrow", "agendaIntro", () => {
    const fragment = make("div");
    const form = make("form", "panel feature-form");
    form.id = "agenda-form";
    const nameLabel = make("label", "", text("agendaTitleLabel")); nameLabel.htmlFor = "agenda-title"; nameLabel.dataset.featureText = "agendaTitleLabel";
    const name = make("input"); name.id="agenda-title"; name.name="title"; name.required=true; name.maxLength=80; name.autocomplete="off";
    const row = make("div", "feature-form-grid");
    const dateBox = make("div");
    const dateLabelEl = make("label", "", text("agendaDate")); dateLabelEl.htmlFor="agenda-date"; dateLabelEl.dataset.featureText="agendaDate";
    const date = make("input"); date.type="date"; date.id="agenda-date"; date.name="date"; date.required=true; date.min=localDate(); date.value=localDate();
    dateBox.append(dateLabelEl, date);
    const timeBox = make("div");
    const timeLabelEl = make("label", "", text("agendaTime")); timeLabelEl.htmlFor="agenda-time"; timeLabelEl.dataset.featureText="agendaTime";
    const time = make("input"); time.type="time"; time.id="agenda-time"; time.name="time";
    timeBox.append(timeLabelEl, time);
    row.append(dateBox, timeBox);
    const optionsRow=make("div","feature-form-grid agenda-options-grid");
    const durationBox=make("div");
    const durationLabel=make("label","",text("agendaDuration"));durationLabel.htmlFor="agenda-duration";durationLabel.dataset.featureText="agendaDuration";
    const duration=make("select");duration.id="agenda-duration";duration.name="durationMinutes";
    for(const [value,key] of [["15","duration15"],["30","duration30"],["45","duration45"],["60","duration60"],["90","duration90"],["120","duration120"]]){
      const option=make("option","",text(key));option.value=value;option.dataset.featureText=key;duration.append(option);
    }
    duration.value="30";durationBox.append(durationLabel,duration);
    const repeatBox=make("div");
    const repeatLabel=make("label","",text("agendaRepeat"));repeatLabel.htmlFor="agenda-repeat";repeatLabel.dataset.featureText="agendaRepeat";
    const repeat=make("select");repeat.id="agenda-repeat";repeat.name="repeat";
    for(const [value,key] of [["1","repeat1"],["2","repeat2"],["4","repeat4"],["8","repeat8"]]){
      const option=make("option","",text(key));option.value=value;option.dataset.featureText=key;repeat.append(option);
    }
    repeat.value="1";repeatBox.append(repeatLabel,repeat);
    const reminderBox=make("div");
    const reminderLabel=make("label","",text("agendaReminder"));reminderLabel.htmlFor="agenda-reminder";reminderLabel.dataset.featureText="agendaReminder";
    const reminder=make("select");reminder.id="agenda-reminder";reminder.name="reminderMinutes";
    for(const [value,key] of [["0","reminderNone"],["5","reminder5"],["15","reminder15"],["30","reminder30"]]){
      const option=make("option","",text(key));option.value=value;option.dataset.featureText=key;reminder.append(option);
    }
    reminder.value="0";reminderBox.append(reminderLabel,reminder);
    optionsRow.append(durationBox,repeatBox,reminderBox);
    const repeatHint=make("p","privacy-hint",text("agendaRepeatHint"));repeatHint.dataset.featureText="agendaRepeatHint";
    const detailsLabel = make("label", "", text("agendaDetails")); detailsLabel.htmlFor="agenda-details"; detailsLabel.dataset.featureText="agendaDetails";
    const details = make("textarea"); details.id="agenda-details"; details.name="details"; details.rows=3; details.maxLength=600;
    const submit = make("button", "primary-button", text("agendaAdd")); submit.type="submit"; submit.id="agenda-submit"; submit.dataset.featureText="agendaAdd";
    const cancel = make("button", "secondary-button", text("agendaCancelEdit")); cancel.type="button"; cancel.id="agenda-cancel-edit"; cancel.hidden=true; cancel.dataset.featureText="agendaCancelEdit";
    const status = make("p", "inline-status"); status.id="agenda-status"; status.setAttribute("role","status"); status.setAttribute("aria-live","polite");
    form.append(nameLabel, name, row, optionsRow, repeatHint, detailsLabel, details, submit, cancel, status);
    cancel.addEventListener("click", () => {
      editingAppointmentId=null; form.reset(); date.min=localDate(); date.value=localDate();duration.value="30";repeat.value="1";reminder.value="0";
      submit.textContent=text("agendaAdd"); cancel.hidden=true; status.textContent="";
    });
    const gate = secureGate(); gate.hidden=true; gate.dataset.secureGate="";
    const secureContents = make("div", "secure-feature-contents"); secureContents.dataset.secureContents="";
    const reminderTools=make("div","agenda-reminder-tools");
    const enableReminders=button(text("agendaEnableReminders"),"secondary-button",async()=>{
      const reminderStatus=$("#agenda-reminder-status");
      if(!("Notification" in window)){reminderStatus.textContent=text("reminderUnsupported");return;}
      try{
        const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
        reminderStatus.textContent=permission==="granted"?text("reminderEnabledStatus"):text("reminderDenied");
        if(permission==="granted")void checkAppointmentReminders();
      }catch{reminderStatus.textContent=text("reminderDenied");}
    });
    enableReminders.id="agenda-enable-reminders";enableReminders.dataset.featureText="agendaEnableReminders";
    const reminderStatus=make("p","inline-status");reminderStatus.id="agenda-reminder-status";reminderStatus.setAttribute("role","status");reminderStatus.setAttribute("aria-live","polite");
    reminderTools.append(enableReminders,reminderStatus);
    const week = make("div", "week-strip"); week.id="agenda-week";
    const listHeading=make("h3", "feature-subheading", text("weekHeading")); listHeading.dataset.featureText="weekHeading";
    const list=make("div","feature-list"); list.id="agenda-list";
    secureContents.append(reminderTools,week,listHeading,list);
    fragment.append(form,gate,secureContents);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!app().isVaultUnlocked()) { status.textContent=text("secureGateTitle"); gate.hidden=false; return; }
      const targetId=editingAppointmentId;
      const values={title:name.value.trim().slice(0,80),date:date.value,time:time.value,durationMinutes:Number(duration.value),reminderMinutes:Number(reminder.value),details:details.value.trim().slice(0,600)};
      const occurrenceCount=targetId?1:Math.max(1,Math.min(8,Number(repeat.value)||1));
      if (!values.title || !values.date) return;
      let savedCount=0;
      try {
        const { findDuplicateAppointment, findAppointmentConflict, generateWeeklyOccurrences } = await import("./appointment-rules.js");
        await updateSecure(data=>{
          if(targetId){
            const conflict=findDuplicateAppointment(values,data.agendaItems,targetId,30)||findAppointmentConflict(values,data.agendaItems,targetId,30);
            if(conflict) throw new Error("duplicate-appointment");
            const found=data.agendaItems.find(item=>item && item.id===targetId);
            if(!found) throw new Error("appointment-not-found");
            Object.assign(found, values, {updatedAt:new Date().toISOString()});
            delete found.reminderSentAt;
            savedCount=1;
          }else{
            const dates=generateWeeklyOccurrences(values.date,occurrenceCount);
            if(!dates.length)throw new Error("invalid-appointment-date");
            if(data.agendaItems.length+dates.length>100)throw new Error("appointment-limit");
            const pending=[];
            const seriesId=dates.length>1?id("series"):undefined;
            for(let index=0;index<dates.length;index++){
              const occurrence={...values,date:dates[index]};
              const existing=[...data.agendaItems,...pending];
              if(findDuplicateAppointment(occurrence,existing,null,30)||findAppointmentConflict(occurrence,existing,null,30))throw new Error("duplicate-appointment");
              pending.push({id:id("appointment"),...occurrence,done:false,createdAt:new Date().toISOString(),...(seriesId?{seriesId,seriesIndex:index+1,seriesCount:dates.length}:{})});
            }
            data.agendaItems.push(...pending);
            savedCount=pending.length;
          }
          return data;
        });
        editingAppointmentId=null; form.reset(); date.value=localDate(); date.min=localDate();duration.value="30";repeat.value="1";reminder.value="0";
        submit.textContent=text("agendaAdd"); cancel.hidden=true;
        status.textContent=targetId?text("agendaUpdated"):(savedCount>1?text("agendaRecurringSaved").replace("{count}",String(savedCount)):text("agendaSaved")); renderAgenda();
      } catch (error) {
        status.textContent=error && error.message==="duplicate-appointment" ? text("agendaDuplicate") : text("agendaError");
      }
    });
    return fragment;
  });

  const mood = addView("mood", "♡", "navMood", "moodTitle", "moodEyebrow", "moodIntro", () => {
    const fragment=make("div");
    const form=make("form","panel feature-form");
    form.id="mood-form";
    const label=make("label","",text("moodLabel")); label.htmlFor="mood-value"; label.dataset.featureText="moodLabel";
    const select=make("select"); select.id="mood-value"; select.name="mood"; select.required=true;
    const placeholder=make("option","",text("chooseMood")); placeholder.value=""; placeholder.disabled=true; placeholder.selected=true; placeholder.dataset.featureText="chooseMood"; select.append(placeholder);
    for(let n=1;n<=5;n++){ const option=make("option","",text("mood"+n)); option.value=String(n); option.dataset.featureText="mood"+n; select.append(option); }
    const noteLabel=make("label","",text("moodNote")); noteLabel.htmlFor="mood-note"; noteLabel.dataset.featureText="moodNote";
    const note=make("textarea"); note.id="mood-note"; note.name="note"; note.rows=3; note.maxLength=300;
    const submit=make("button","primary-button",text("moodSave")); submit.type="submit"; submit.dataset.featureText="moodSave";
    const status=make("p","inline-status"); status.id="mood-status"; status.setAttribute("role","status"); status.setAttribute("aria-live","polite");
    form.append(label,select,noteLabel,note,submit,status);
    const gate=secureGate(); gate.hidden=true; gate.dataset.secureGate="";
    const contents=make("div","secure-feature-contents"); contents.dataset.secureContents="";
    const histHeading=make("h3","feature-subheading",text("moodHistory")); histHeading.dataset.featureText="moodHistory";
    const list=make("div","feature-list"); list.id="mood-list";
    contents.append(histHeading,list); fragment.append(form,gate,contents);
    form.addEventListener("submit",async event=>{
      event.preventDefault();
      if(!app().isVaultUnlocked()){status.textContent=text("secureGateTitle");gate.hidden=false;return;}
      const today=localDate();
      const entry={id:id("mood"),date:today,mood:Number(select.value),note:note.value.trim().slice(0,300),updatedAt:new Date().toISOString()};
      try{
        await updateSecure(data=>{
          const index=data.moodEntries.findIndex(item=>item && item.date===today);
          if(index>=0) data.moodEntries[index]=entry;
          else data.moodEntries.push(entry);
          data.moodEntries.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
          data.moodEntries=data.moodEntries.slice(0,365);
          return data;
        });
        note.value="";status.textContent=text("moodSaved");renderMoods();
      }catch{status.textContent=text("moodError");}
    });
    return fragment;
  });

  const people = addView("people", "♧", "navPeople", "peopleTitle", "peopleEyebrow", "peopleIntro", () => {
    const fragment=make("div");
    const form=make("form","panel feature-form");
    form.id="people-form";
    const fields=[
      {id:"person-name",key:"peopleName,name",type:"text",max:80,required:true},
      {id:"person-role",key:"peopleRole",type:"text",max:80,required:true},
      {id:"person-contact",key:"peopleContact",type:"text",max:120,required:false},
      {id:"person-photo",key:"peoplePhoto",type:"file",max:0,required:false},
      {id:"person-details",key:"peopleDetails",type:"textarea",max:500,required:false}
    ];
    for(const field of fields){
      const key=field.key.split(",")[0];
      const label=make("label","",text(key));label.htmlFor=field.id;label.dataset.featureText=key;
      const input=field.type==="textarea"?make("textarea"):make("input");
      input.id=field.id;input.name=field.id;input.required=field.required;input.maxLength=field.max;
      if(field.type!=="textarea")input.type=field.type;else input.rows=3;
      if(field.type==="file")input.accept="image/png,image/jpeg,image/webp";
      form.append(label,input);
    }
    const submit=make("button","primary-button",text("peopleAdd")); submit.type="submit"; submit.id="person-submit"; submit.dataset.featureText="peopleAdd";
    const cancel=make("button","secondary-button",text("peopleCancelEdit")); cancel.type="button"; cancel.id="person-cancel-edit"; cancel.hidden=true; cancel.dataset.featureText="peopleCancelEdit";
    const status=make("p","inline-status"); status.id="people-status"; status.setAttribute("role","status"); status.setAttribute("aria-live","polite");
    form.append(submit,cancel,status);
    cancel.addEventListener("click",()=>{
      editingPersonId=null; editingPersonPhoto=""; form.reset(); submit.textContent=text("peopleAdd"); cancel.hidden=true; status.textContent="";
    });
    const gate=secureGate();gate.hidden=true;gate.dataset.secureGate="";
    const contents=make("div","secure-feature-contents");contents.dataset.secureContents="";
    const list=make("div","feature-list");list.id="people-list";
    contents.append(list);fragment.append(form,gate,contents);
    form.addEventListener("submit",async event=>{
      event.preventDefault();
      if(!app().isVaultUnlocked()){status.textContent=text("secureGateTitle");gate.hidden=false;return;}
      const targetId=editingPersonId;
      const photoFile=$("#person-photo").files && $("#person-photo").files[0];
      let photo=targetId?editingPersonPhoto:"";
      if(photoFile){
        if(!["image/png","image/jpeg","image/webp"].includes(photoFile.type)||photoFile.size>120*1024){status.textContent=text("peoplePhotoTooLarge");return;}
        photo=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.addEventListener("load",()=>resolve(typeof reader.result==="string"?reader.result:""));reader.addEventListener("error",reject);reader.readAsDataURL(photoFile);});
        if(!/^data:image\/(png|jpeg|webp);base64,/.test(photo)||photo.length>180000){status.textContent=text("peoplePhotoTooLarge");return;}
      }
      const values={name:$("#person-name").value.trim().slice(0,80),role:$("#person-role").value.trim().slice(0,80),contact:$("#person-contact").value.trim().slice(0,120),details:$("#person-details").value.trim().slice(0,500),photo};
      if(!values.name || !values.role)return;
      try{
        await updateSecure(data=>{
          if(targetId){
            const index=data.trustedPeople.findIndex(person=>person && person.id===targetId);
            if(index<0)throw new Error("person-not-found");
            data.trustedPeople[index]={...data.trustedPeople[index],...values,updatedAt:new Date().toISOString()};
          }else{
            if(data.trustedPeople.length>=50)throw new Error("limit");
            data.trustedPeople.push({id:id("person"),...values,createdAt:new Date().toISOString()});
          }
          return data;
        });
        editingPersonId=null; editingPersonPhoto=""; form.reset(); submit.textContent=text("peopleAdd"); cancel.hidden=true;
        status.textContent=text(targetId?"peopleUpdated":"peopleSaved");renderPeople();
      }catch{status.textContent=text("peopleError");}
    });
    return fragment;
  });

  const workRoster = addView("work", "▦", "navWork", "workTitle", "workEyebrow", "workIntro", () => {
    const fragment=make("div");
    const form=make("form","panel feature-form");
    form.id="work-schedule-form";

    const dateLabelEl=make("label","",text("workDate"));dateLabelEl.htmlFor="work-date";dateLabelEl.dataset.featureText="workDate";
    const date=make("input");date.type="date";date.id="work-date";date.name="date";date.required=true;date.value=localDate();

    const nameLabel=make("label","",text("workName"));nameLabel.htmlFor="work-name";nameLabel.dataset.featureText="workName";
    const name=make("input");name.id="work-name";name.name="name";name.required=true;name.maxLength=80;name.autocomplete="off";

    const roleLabel=make("label","",text("workRole"));roleLabel.htmlFor="work-role";roleLabel.dataset.featureText="workRole";
    const role=make("input");role.id="work-role";role.name="role";role.maxLength=80;role.autocomplete="organization-title";

    const photoLabel=make("label","",text("workPhoto"));photoLabel.htmlFor="work-photo";photoLabel.dataset.featureText="workPhoto";
    const photoInput=make("input");photoInput.type="file";photoInput.id="work-photo";photoInput.name="photo";photoInput.accept="image/png,image/jpeg,image/webp";

    const notesLabel=make("label","",text("workNotes"));notesLabel.htmlFor="work-notes";notesLabel.dataset.featureText="workNotes";
    const notes=make("textarea");notes.id="work-notes";notes.name="notes";notes.rows=2;notes.maxLength=400;

    const submit=make("button","primary-button",text("workSave"));submit.type="submit";submit.id="work-submit";submit.dataset.featureText="workSave";
    const cancel=make("button","secondary-button",text("workCancelEdit"));cancel.type="button";cancel.id="work-cancel-edit";cancel.hidden=true;cancel.dataset.featureText="workCancelEdit";
    const status=make("p","inline-status");status.id="work-status";status.setAttribute("role","status");status.setAttribute("aria-live","polite");
    form.append(dateLabelEl,date,nameLabel,name,roleLabel,role,photoLabel,photoInput,notesLabel,notes,submit,cancel,status);

    cancel.addEventListener("click",()=>{
      editingWorkScheduleId=null;editingWorkSchedulePhoto="";form.reset();date.value=localDate();
      submit.textContent=text("workSave");cancel.hidden=true;status.textContent="";
    });

    const gate=secureGate();gate.hidden=true;gate.dataset.secureGate="";
    const contents=make("div","secure-feature-contents");contents.dataset.secureContents="";
    const weekHeading=make("h3","feature-subheading",text("workWeekHeading"));weekHeading.dataset.featureText="workWeekHeading";
    const toolbar=make("div","work-week-toolbar");
    const prev=button(text("workPreviousWeek"),"secondary-button",()=>{
      workWeekStart=addDays(workWeekStart||mondayOf(new Date()),-7);renderWorkSchedule();
    });
    prev.id="work-previous-week";prev.dataset.featureText="workPreviousWeek";
    const range=make("p","work-week-range");range.id="work-week-range";range.setAttribute("aria-live","polite");
    const next=button(text("workNextWeek"),"secondary-button",()=>{
      workWeekStart=addDays(workWeekStart||mondayOf(new Date()),7);renderWorkSchedule();
    });
    next.id="work-next-week";next.dataset.featureText="workNextWeek";
    toolbar.append(prev,range,next);
    const copyWeek=button(text("workCopyPrevious"),"secondary-button",async()=>{
      const status=$("#work-status");
      if(!app()||!app().isVaultUnlocked()){status.textContent=text("secureGateTitle");gate.hidden=false;return;}
      try{
        const {getWorkWeekCopies}=await import("./appointment-rules.js");
        const targetMonday=localDate(workWeekStart||mondayOf(new Date()));
        let count=0;
        await updateSecure(data=>{
          const copies=getWorkWeekCopies(data.workSchedules,targetMonday);
          const available=Math.max(0,500-data.workSchedules.length);
          const picked=copies.slice(0,available);
          const now=new Date().toISOString();
          for(const copy of picked){
            const item={...copy,id:id("work"),createdAt:now};
            delete item.updatedAt;
            data.workSchedules.push(item);
            count++;
          }
          const referencedStaff=new Set(data.workSchedules.map(item=>item&&item.staffId).filter(Boolean));
          data.workStaff=data.workStaff.filter(person=>person&&referencedStaff.has(person.id));
          return data;
        });
        status.textContent=count?text("workCopySuccess").replace("{count}",String(count)):text("workCopyNone");
        renderWorkSchedule();
      }catch{status.textContent=text("workCopyError");}
    });
    copyWeek.id="work-copy-previous-week";copyWeek.dataset.featureText="workCopyPrevious";
    const week=make("div","work-week-grid");week.id="work-week-grid";
    contents.append(weekHeading,toolbar,copyWeek,week);
    fragment.append(form,gate,contents);

    form.addEventListener("submit",async event=>{
      event.preventDefault();
      if(!app().isVaultUnlocked()){status.textContent=text("secureGateTitle");gate.hidden=false;return;}
      const targetId=editingWorkScheduleId;
      let photo="";
      const selectedFile=photoInput.files&&photoInput.files[0];
      if(selectedFile){
        if(!["image/png","image/jpeg","image/webp"].includes(selectedFile.type)||selectedFile.size>120*1024){
          status.textContent=text("workPhotoTooLarge");return;
        }
        try{
          photo=await new Promise((resolve,reject)=>{
            const reader=new FileReader();
            reader.addEventListener("load",()=>resolve(typeof reader.result==="string"?reader.result:""));
            reader.addEventListener("error",reject);
            reader.readAsDataURL(selectedFile);
          });
        }catch{status.textContent=text("workPhotoTooLarge");return;}
        if(!/^data:image\/(png|jpeg|webp);base64,/.test(photo)||photo.length>180000){
          status.textContent=text("workPhotoTooLarge");return;
        }
      }
      const values={date:date.value,name:name.value.trim().slice(0,80),role:role.value.trim().slice(0,80),photo,notes:notes.value.trim().slice(0,400)};
      if(!values.date||!values.name)return;
      try{
        const {findDuplicateWorkAssignment,normaliseAppointmentTitle}=await import("./appointment-rules.js");
        await updateSecure(data=>{
          if(findDuplicateWorkAssignment(values,data.workSchedules,targetId))throw new Error("duplicate-work");
          let profile=data.workStaff.find(person=>person&&normaliseAppointmentTitle(person.name)===normaliseAppointmentTitle(values.name));
          if(!profile){
            if(data.workStaff.length>=100)throw new Error("work-limit");
            profile={id:id("work-person"),name:values.name,role:values.role,photo:photo||"",createdAt:new Date().toISOString()};
            data.workStaff.push(profile);
          }else{
            profile.name=values.name;
            profile.role=values.role;
            if(photo)profile.photo=photo;
            profile.updatedAt=new Date().toISOString();
          }
          const assignment={date:values.date,name:values.name,role:values.role,notes:values.notes,staffId:profile.id};
          if(targetId){
            const index=data.workSchedules.findIndex(item=>item&&item.id===targetId);
            if(index<0)throw new Error("work-not-found");
            data.workSchedules[index]={...data.workSchedules[index],...assignment,updatedAt:new Date().toISOString()};
          }else{
            if(data.workSchedules.length>=500)throw new Error("work-limit");
            data.workSchedules.push({id:id("work"),...assignment,createdAt:new Date().toISOString()});
          }
          const referencedStaff=new Set(data.workSchedules.map(item=>item&&item.staffId).filter(Boolean));
          data.workStaff=data.workStaff.filter(person=>person&&referencedStaff.has(person.id));
          return data;
        });
        editingWorkScheduleId=null;editingWorkSchedulePhoto="";form.reset();date.value=localDate();
        submit.textContent=text("workSave");cancel.hidden=true;
        workWeekStart=mondayOf(new Date(values.date+"T12:00:00"));
        status.textContent=text(targetId?"workUpdated":"workSaved");
        renderWorkSchedule();
      }catch(error){
        status.textContent=error&&error.message==="duplicate-work"?text("workDuplicate"):text("workError");
      }
    });
    return fragment;
  });

  function deleteItem(arrayKey, itemId) {
    const confirms = text("secureDeleteConfirm");
    if (!window.confirm(confirms)) return Promise.resolve(false);
    return updateSecure(data=>{data[arrayKey]=data[arrayKey].filter(item=>item && item.id!==itemId);return data;});
  }
  function createItemCard(titleText, subText, bodyText, actionNodes) {
    const card=make("article","feature-item");
    const head=make("div","feature-item-head");
    const h=make("h4","",titleText);head.append(h);
    if(subText)head.append(make("time","",subText));
    card.append(head);
    if(bodyText){const body=make("p","feature-item-body",bodyText);card.append(body);}
    if(actionNodes && actionNodes.length){const actions=make("div","feature-item-actions");actionNodes.forEach(node=>actions.append(node));card.append(actions);}
    return card;
  }
  function beginAppointmentEdit(item){
    editingAppointmentId=item.id;
    $("#agenda-title").value=item.title||"";
    $("#agenda-date").min="";
    $("#agenda-date").value=item.date||localDate();
    $("#agenda-time").value=item.time||"";
    $("#agenda-details").value=item.details||"";
    $("#agenda-duration").value=String([15,30,45,60,90,120].includes(item.durationMinutes)?item.durationMinutes:30);
    $("#agenda-repeat").value="1";
    $("#agenda-reminder").value=String([0,5,15,30].includes(item.reminderMinutes)?item.reminderMinutes:0);
    const submit=$("#agenda-submit"),cancel=$("#agenda-cancel-edit"),status=$("#agenda-status");
    if(submit)submit.textContent=text("agendaUpdate");
    if(cancel)cancel.hidden=false;
    if(status)status.textContent=text("agendaEditStarted");
    app().setView("agenda");
    $("#agenda-title").focus();
  }
  function renderAgenda(){
    const list=$("#agenda-list"),week=$("#agenda-week");
    if(!list||!week)return;
    list.replaceChildren();week.replaceChildren();
    if(!app().isVaultUnlocked()){return;}
    let items=[];
    try{items=secureData().agendaItems;}catch{return;}
    const today=localDate();
    for(let offset=0;offset<7;offset++){
      const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()+offset);
      const key=localDate(date);
      const day=make("div","week-day");
      const count=items.filter(item=>item.date===key&&!item.done).length;
      day.append(make("span","week-day-name",new Intl.DateTimeFormat(language==="nl"?"nl-NL":"en-GB",{weekday:"short"}).format(date)));
      day.append(make("strong","week-day-date",String(date.getDate())));
      day.append(make("small","week-day-count",String(count)));
      if(key===today)day.classList.add("is-today");
      week.append(day);
    }
    items.sort((a,b)=>(String(a.date)+" "+String(a.time||"")).localeCompare(String(b.date)+" "+String(b.time||"")));
    if(!items.length){list.append(make("p","privacy-hint",text("agendaEmpty")));return;}
    for(const item of items){
      if(!item||typeof item.title!=="string"||typeof item.date!=="string")continue;
      const durationText=item.durationMinutes?String(item.durationMinutes)+" min":"";
      const reminderText=Number(item.reminderMinutes)>0?(language==="nl"?"herinnering ":"reminder ")+String(item.reminderMinutes)+" min":"";
      const meta=[dateLabel(item.date),item.time||"",durationText,reminderText].filter(Boolean).join(" · ");
      const actions=[];
      const toggle=button(item.done?text("agendaUndo"):text("agendaDone"),"secondary-button",async()=>{
        try{await updateSecure(data=>{const found=data.agendaItems.find(v=>v.id===item.id);if(found)found.done=!found.done;return data;});renderAgenda();}
        catch{$("#agenda-status").textContent=text("agendaError");}
      });
      actions.push(toggle,button(text("agendaEdit"),"secondary-button",()=>beginAppointmentEdit(item)),button(text("agendaDelete"),"secondary-button",async()=>{try{await deleteItem("agendaItems",item.id);renderAgenda();}catch{$("#agenda-status").textContent=text("agendaError");}}));
      const card=createItemCard(item.title,meta,item.details,actions);
      if(item.done)card.classList.add("is-complete");
      list.append(card);
    }
  }
  async function checkAppointmentReminders(){
    if(!app()||!app().isVaultUnlocked()||!("Notification" in window)||Notification.permission!=="granted")return;
    const now=new Date();
    let due=[];
    try{
      const {timeToMinutes}=await import("./appointment-rules.js");
      const items=secureData().agendaItems;
      due=items.filter(item=>{
        if(!item||item.done||item.reminderSentAt||!(Number(item.reminderMinutes)>0)||typeof item.date!=="string")return false;
        if(timeToMinutes(item.time)===null)return false;
        const appointmentAt=new Date(item.date+"T"+String(item.time)+":00");
        if(Number.isNaN(appointmentAt.getTime())||appointmentAt<=now)return false;
        const notifyAt=new Date(appointmentAt.getTime()-Number(item.reminderMinutes)*60000);
        return now>=notifyAt&&now<appointmentAt;
      });
    }catch{return;}
    if(!due.length)return;
    const dueIds=new Set(due.map(item=>item.id));
    try{
      await updateSecure(data=>{
        for(const item of data.agendaItems){
          if(dueIds.has(item&&item.id)&&!item.reminderSentAt)item.reminderSentAt=now.toISOString();
        }
        return data;
      });
    }catch{return;}
    for(const item of due){
      try{
        const notification=new Notification("Mivoryntra",{body:(language==="nl"?"Afspraak: ":"Appointment: ")+item.title+" · "+item.time,tag:"mivoryntra-"+item.id});
        notification.onclick=()=>{window.focus();app().setView("agenda");notification.close();};
      }catch{}
    }
  }

  function renderMoods(){
    const list=$("#mood-list");if(!list)return;list.replaceChildren();
    if(!app().isVaultUnlocked())return;
    let entries=[];try{entries=secureData().moodEntries;}catch{return;}
    if(!entries.length){list.append(make("p","privacy-hint",text("moodEmpty")));return;}
    entries.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,14).forEach(entry=>{
      const moodLabel=text("mood"+entry.mood);
      const card=createItemCard("● "+moodLabel,dateLabel(entry.date),entry.note||"");
      list.append(card);
    });
  }
  function beginPersonEdit(person){
    editingPersonId=person.id;
    editingPersonPhoto=typeof person.photo==="string"?person.photo:"";
    const form=$("#people-form");if(form)form.reset();
    $("#person-name").value=person.name||"";
    $("#person-role").value=person.role||"";
    $("#person-contact").value=person.contact||"";
    $("#person-details").value=person.details||"";
    const submit=$("#person-submit"),cancel=$("#person-cancel-edit"),status=$("#people-status");
    if(submit)submit.textContent=text("peopleUpdate");
    if(cancel)cancel.hidden=false;
    if(status)status.textContent=text("peopleEditStarted");
    app().setView("people");
    $("#person-name").focus();
  }
  function renderPeople(){
    const list=$("#people-list");if(!list)return;list.replaceChildren();
    if(!app().isVaultUnlocked())return;
    let entries=[];try{entries=secureData().trustedPeople;}catch{return;}
    if(!entries.length){list.append(make("p","privacy-hint",text("peopleEmpty")));return;}
    entries.forEach(person=>{
      const body=[person.contact,person.details].filter(Boolean).join("\n");
      const card=createItemCard(person.name,person.role,body,[button(text("peopleEdit"),"secondary-button",()=>beginPersonEdit(person)),button(text("peopleDelete"),"secondary-button",async()=>{
        try{await deleteItem("trustedPeople",person.id);renderPeople();}
        catch{$("#people-status").textContent=text("peopleError");}
      })]);
      if(typeof person.photo==="string"&&/^data:image\/(png|jpeg|webp);base64,/.test(person.photo)&&person.photo.length<=180000){const photo=make("img","trusted-photo");photo.src=person.photo;photo.alt=person.name;photo.loading="lazy";card.prepend(photo);}
      list.append(card);
    });
  }
  function injectJournalControls(){
    const noteTools=$(".note-tools");
    if(noteTools&&!$("#save-journal-entry")){
      const save=button(text("journalSave"),"primary-button",saveJournal);
      save.id="save-journal-entry";
      noteTools.append(save);
    }
    const notePanel=$(".notes-panel");
    if(notePanel&&!$("#journal-secure-area")){
      const area=make("section","secure-archive");area.id="journal-secure-area";
      const h=make("h3","",text("journalListTitle"));h.dataset.featureText="journalListTitle";
      const hint=make("p","privacy-hint",text("journalStorageHint"));hint.dataset.featureText="journalStorageHint";
      const gate=secureGate();gate.hidden=true;gate.dataset.secureGate="";
      const contents=make("div","secure-feature-contents");contents.dataset.secureContents="";
      const list=make("div","feature-list");list.id="journal-list";
      contents.append(list);area.append(h,hint,gate,contents);
      const drawingPanel=$(".sketch-panel",notePanel);
      if(drawingPanel) drawingPanel.after(area); else notePanel.append(area);
    }
    const sketchActions=$(".sketch-actions");
    if(sketchActions&&!$("#save-sketch-secure")){
      const saveDrawing=button(text("drawingSave"),"secondary-button",saveDrawingSecure);
      saveDrawing.id="save-sketch-secure";
      sketchActions.append(saveDrawing);
    }
    if(notePanel&&!$("#drawing-secure-area")){
      const area=make("section","secure-archive");area.id="drawing-secure-area";
      const h=make("h3","",text("drawingsTitle"));h.dataset.featureText="drawingsTitle";
      const gate=secureGate();gate.hidden=true;gate.dataset.secureGate="";
      const contents=make("div","secure-feature-contents");contents.dataset.secureContents="";
      const list=make("div","drawing-gallery");list.id="drawing-list";
      contents.append(list);area.append(h,gate,contents);notePanel.append(area);
    }
  }
  async function saveJournal(){
    const field=$("#note-text"),status=$("#note-status");
    if(!field||!field.value.trim()){if(status)status.textContent=text("journalEmpty");return;}
    if(!app().isVaultUnlocked()){setNoteGateVisible(true);if(status)status.textContent=text("secureGateTitle");return;}
    const entry={id:id("note"),text:field.value.trim().slice(0,5000),createdAt:new Date().toISOString()};
    try{
      await updateSecure(data=>{if(data.journalEntries.length>=100)data.journalEntries=data.journalEntries.slice(-99);data.journalEntries.push(entry);return data;});
      field.value="";field.dispatchEvent(new Event("input",{bubbles:true}));
      if(status)status.textContent=text("journalSaveStatus");renderJournal();
    }catch{if(status)status.textContent=text("agendaError");}
  }
  function setNoteGateVisible(visible){
    const area=$("#journal-secure-area"),drawArea=$("#drawing-secure-area");
    [area,drawArea].filter(Boolean).forEach(node=>{const gate=$("[data-secure-gate]",node);if(gate)gate.hidden=!visible;});
  }
  function renderJournal(){
    const list=$("#journal-list");if(!list)return;list.replaceChildren();
    if(!app().isVaultUnlocked())return;
    let entries=[];try{entries=secureData().journalEntries;}catch{return;}
    if(!entries.length){list.append(make("p","privacy-hint",text("journalEmptyList")));return;}
    entries.slice().reverse().slice(0,20).forEach(entry=>{
      const actions=[button(text("journalDelete"),"secondary-button",async()=>{
        if(!window.confirm(text("journalDeleteConfirm")))return;
        try{await updateSecure(data=>{data.journalEntries=data.journalEntries.filter(item=>item.id!==entry.id);return data;});renderJournal();}
        catch{$("#note-status").textContent=text("agendaError");}
      })];
      list.append(createItemCard(text("journalListTitle"),dateLabel(entry.createdAt),entry.text,actions));
    });
  }
  async function saveDrawingSecure(){
    const status=$("#sketch-status"),canvas=$("#sketch-canvas");
    if(!canvas||!app().isVaultUnlocked()){setNoteGateVisible(true);if(status)status.textContent=text("secureGateTitle");return;}
    let dataUrl="";
    try{dataUrl=canvas.toDataURL("image/png");}catch{if(status)status.textContent=text("drawingEmpty");return;}
    if(!dataUrl.startsWith("data:image/png;base64,")||dataUrl.length>200000){
      if(status)status.textContent=text("drawingTooLarge");return;
    }
    const drawing={id:id("drawing"),dataUrl,createdAt:new Date().toISOString()};
    try{
      await updateSecure(data=>{if(data.savedDrawings.length>=8)data.savedDrawings=data.savedDrawings.slice(-7);data.savedDrawings.push(drawing);return data;});
      if(status)status.textContent=text("drawingSaved");renderDrawings();
    }catch{if(status)status.textContent=text("agendaError");}
  }
  function renderDrawings(){
    const list=$("#drawing-list");if(!list)return;list.replaceChildren();
    if(!app().isVaultUnlocked())return;
    let entries=[];try{entries=secureData().savedDrawings;}catch{return;}
    if(!entries.length){list.append(make("p","privacy-hint",text("drawingsEmpty")));return;}
    entries.slice().reverse().forEach(entry=>{
      if(!entry.dataUrl||!entry.dataUrl.startsWith("data:image/png;base64,"))return;
      const card=make("article","drawing-card");
      const image=make("img");image.src=entry.dataUrl;image.alt=text("drawingsTitle");image.loading="lazy";
      const meta=make("p","privacy-hint",dateLabel(entry.createdAt));
      const remove=button(text("drawingDelete"),"secondary-button",async()=>{
        if(!window.confirm(text("secureDeleteConfirm")))return;
        try{await updateSecure(data=>{data.savedDrawings=data.savedDrawings.filter(item=>item.id!==entry.id);return data;});renderDrawings();}
        catch{$("#sketch-status").textContent=text("agendaError");}
      });
      card.append(image,meta,remove);list.append(card);
    });
  }
  function updateGateViews(){
    const unlocked=Boolean(app()&&app().isVaultUnlocked());
    $$(".secure-feature-contents").forEach(el=>{el.hidden=!unlocked;});
    $$(".feature-editor").forEach(editor=>{
      $$("[data-secure-gate]",editor).forEach(gate=>{gate.hidden=unlocked;});
    });
    if(!unlocked){
      editingAppointmentId=null; editingPersonId=null; editingPersonPhoto=""; editingWorkScheduleId=null; editingWorkSchedulePhoto="";
      const agendaSubmit=$("#agenda-submit"),agendaCancel=$("#agenda-cancel-edit");
      if(agendaSubmit)agendaSubmit.textContent=text("agendaAdd");if(agendaCancel)agendaCancel.hidden=true;
      const peopleSubmit=$("#person-submit"),peopleCancel=$("#person-cancel-edit");
      if(peopleSubmit)peopleSubmit.textContent=text("peopleAdd");if(peopleCancel)peopleCancel.hidden=true;
      const workSubmit=$("#work-submit"),workCancel=$("#work-cancel-edit");
      if(workSubmit)workSubmit.textContent=text("workSave");if(workCancel)workCancel.hidden=true;
      ["agenda-form","mood-form","people-form","work-schedule-form"].forEach(formId=>{const form=$("#"+formId);if(form)form.reset();});
      ["agenda-status","mood-status","people-status","work-status"].forEach(statusId=>{const status=$("#"+statusId);if(status)status.textContent="";});
      $$(".drawing-gallery img").forEach(img=>{img.removeAttribute("src");});
      $$(".feature-list,.drawing-gallery,.work-week-grid").forEach(list=>list.replaceChildren());
    }
    ["agenda-form","mood-form","people-form","work-schedule-form"].forEach(formId=>{
      const form=$("#"+formId);
      if(form) $$("input,select,textarea,button",form).forEach(control=>{control.disabled=!unlocked;});
    });
    setNoteGateVisible(!unlocked);
    if(unlocked && !lastUnlocked){
      renderAll();
    }
    lastUnlocked=unlocked;
  }
  function beginWorkScheduleEdit(item){
    editingWorkScheduleId=item.id;
    const stored=secureData();
    const profile=stored.workStaff.find(person=>person&&person.id===item.staffId);
    editingWorkSchedulePhoto=profile&&typeof profile.photo==="string"?profile.photo:"";
    const form=$("#work-schedule-form");if(form)form.reset();
    $("#work-date").value=item.date||localDate();
    $("#work-name").value=item.name||"";
    $("#work-role").value=item.role||"";
    $("#work-notes").value=item.notes||"";
    const submit=$("#work-submit"),cancel=$("#work-cancel-edit"),status=$("#work-status");
    if(submit)submit.textContent=text("workUpdate");
    if(cancel)cancel.hidden=false;
    if(status)status.textContent=text("workEditStarted");
    workWeekStart=mondayOf(new Date((item.date||localDate())+"T12:00:00"));
    renderWorkSchedule();
    app().setView("work");
    $("#work-name").focus();
  }

  function renderWorkSchedule(){
    const week=$("#work-week-grid"),range=$("#work-week-range");
    if(!week||!range)return;
    week.replaceChildren();
    if(!app()||!app().isVaultUnlocked())return;
    if(!workWeekStart)workWeekStart=mondayOf(new Date());
    const first=workWeekStart;
    const last=addDays(first,6);
    range.textContent=dateLabel(localDate(first))+" – "+dateLabel(localDate(last));
    let records=[],profiles=[];
    try{const data=secureData();records=data.workSchedules;profiles=data.workStaff;}catch{return;}
    const today=localDate();
    for(let offset=0;offset<7;offset++){
      const dayDate=addDays(first,offset);
      const key=localDate(dayDate);
      const day=make("section","work-day");
      if(key===today)day.classList.add("is-today");
      const heading=make("h4","work-day-heading",new Intl.DateTimeFormat(language==="nl"?"nl-NL":"en-GB",{weekday:"long",day:"numeric",month:"short"}).format(dayDate));
      day.append(heading);
      const dayItems=records.filter(item=>item&&item.date===key).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),language==="nl"?"nl":"en"));
      if(!dayItems.length){
        day.append(make("p","work-day-empty",text("workEmpty")));
      }else{
        for(const item of dayItems){
          const actions=[
            button(text("workEdit"),"secondary-button",()=>beginWorkScheduleEdit(item)),
            button(text("workDelete"),"secondary-button",async()=>{
              try{
                await updateSecure(data=>{
                  data.workSchedules=data.workSchedules.filter(entry=>entry&&entry.id!==item.id);
                  const referencedStaff=new Set(data.workSchedules.map(entry=>entry&&entry.staffId).filter(Boolean));
                  data.workStaff=data.workStaff.filter(person=>person&&referencedStaff.has(person.id));
                  return data;
                });
                if(editingWorkScheduleId===item.id){
                  editingWorkScheduleId=null;editingWorkSchedulePhoto="";
                  const form=$("#work-schedule-form");if(form)form.reset();
                  $("#work-date").value=localDate();$("#work-submit").textContent=text("workSave");$("#work-cancel-edit").hidden=true;
                }
                renderWorkSchedule();
              }catch{$("#work-status").textContent=text("workError");}
            })
          ];
          const card=createItemCard(item.name,item.role||"",item.notes||"",actions);
          const profile=profiles.find(person=>person&&person.id===item.staffId);
          const staffPhoto=profile&&typeof profile.photo==="string"?profile.photo:"";
          if(/^data:image\/(png|jpeg|webp);base64,/.test(staffPhoto)&&staffPhoto.length<=180000){
            const img=make("img","work-assignment-photo");img.src=staffPhoto;img.alt=text("workPhotoAlt")+" "+item.name;img.loading="lazy";card.prepend(img);
          }
          day.append(card);
        }
      }
      week.append(day);
    }
  }

  function renderAll(){
    if(!app()||!app().isVaultUnlocked())return;
    renderAgenda();renderMoods();renderPeople();renderWorkSchedule();renderJournal();renderDrawings();
  }
  function applyLanguage(next){
    language=next==="en"?"en":"nl";
    $$("[data-feature-text]").forEach(el=>{const key=el.dataset.featureText;el.textContent=text(key);});
    const agendaSubmit=$("#agenda-submit");if(agendaSubmit)agendaSubmit.textContent=text(editingAppointmentId?"agendaUpdate":"agendaAdd");
    const peopleSubmit=$("#person-submit");if(peopleSubmit)peopleSubmit.textContent=text(editingPersonId?"peopleUpdate":"peopleAdd");
    $$("[data-feature-placeholder]").forEach(el=>{const key=el.dataset.featurePlaceholder;if(copy[language][key])el.placeholder=copy[language][key];});
    if(app()&&app().isVaultUnlocked())renderAll();
    updateGateViews();
  }
  function addSettingsLink(){
    const panel=$(".privacy-panel");
    if(!panel||$("#intro-show-again"))return;
    const b=button(language==="nl"?"Introductie opnieuw bekijken":"View the introduction again","secondary-button",()=>window.MivoryntraIntro?.showIntro());
    b.id="intro-show-again"; b.dataset.featureText="introAgain";
    panel.append(b);
  }
  function boot(){
    injectJournalControls();
    addSettingsLink();
    const today=localDate();
    workWeekStart=mondayOf(new Date());
    const agendaDate=$("#agenda-date");if(agendaDate){agendaDate.value=today;agendaDate.min=today;}
    window.addEventListener("project-vault-state",()=>{updateGateViews();void checkAppointmentReminders();});
    applyLanguage(app()?app().getLanguage():"nl");
    updateGateViews();
    if(app()&&app().isVaultUnlocked())renderAll();
    void checkAppointmentReminders();
    window.setInterval(()=>void checkAppointmentReminders(),30000);
  }
  window.ProjectNFeatures={applyLanguage,renderAll,updateGateViews,checkAppointmentReminders};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();