/* Mivoryntra next features — private data is written only through the encrypted vault. */
(() => {
  "use strict";
  const copy = {
    nl: {
      navAgenda:"Weekplanner", navMood:"Stemming", navPeople:"Vertrouwde mensen",
      agendaEyebrow:"OVERZICHT", agendaTitle:"Mijn weekplanner", agendaIntro:"Leg afspraken vast en bekijk wat er de komende dagen op de planning staat.",
      agendaTitleLabel:"Waar gaat de afspraak over?", agendaDate:"Datum", agendaTime:"Tijd", agendaDetails:"Extra informatie (optioneel)", agendaAdd:"Afspraak opslaan",
      agendaEmpty:"Er staan nog geen afspraken in je planner.", agendaDone:"Afgerond", agendaUndo:"Opnieuw openzetten", agendaDelete:"Afspraak verwijderen",
      weekHeading:"De komende 7 dagen", agendaSaved:"De afspraak is veilig opgeslagen.", agendaError:"Opslaan lukte niet. Controleer of je kluis ontgrendeld is en er genoeg ruimte is.",
      moodEyebrow:"EVEN INCHECKEN", moodTitle:"Hoe voel je je vandaag?", moodIntro:"Kies het gevoel dat het beste past. Je hoeft het niet uit te leggen.",
      moodLabel:"Mijn stemming", moodNote:"Wil je er iets bij vertellen? (optioneel)", moodSave:"Stemming opslaan",
      mood1:"Heel moeilijk", mood2:"Moeilijk", mood3:"Gaat wel", mood4:"Goed", mood5:"Heel goed",
      moodSaved:"Je stemming is veilig opgeslagen.", moodEmpty:"Er zijn nog geen stemmingen opgeslagen.", moodHistory:"Recente check-ins", moodError:"Opslaan lukte niet. Ontgrendel de kluis en probeer opnieuw.",
      peopleEyebrow:"MENSEN OM JE HEEN", peopleTitle:"Vertrouwde mensen", peopleIntro:"Bewaar contactgegevens van mensen bij wie je terechtkunt. Deze gegevens blijven in jouw versleutelde kluis.",
      peopleName:"Naam", peopleRole:"Wie is deze persoon voor jou?", peopleContact:"Telefoon, e-mail of andere contactgegevens", peopleDetails:"Extra informatie (optioneel)", peopleAdd:"Contact opslaan",
      peopleEmpty:"Je hebt nog geen vertrouwde mensen toegevoegd.", peopleDelete:"Contact verwijderen", peopleSaved:"Contact is veilig opgeslagen.", peopleError:"Opslaan lukte niet. Ontgrendel de kluis en probeer opnieuw.",
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
      navAgenda:"Week planner", navMood:"Mood", navPeople:"Trusted people",
      agendaEyebrow:"OVERVIEW", agendaTitle:"My week planner", agendaIntro:"Add appointments and see what is planned for the coming days.",
      agendaTitleLabel:"What is the appointment about?", agendaDate:"Date", agendaTime:"Time", agendaDetails:"Extra details (optional)", agendaAdd:"Save appointment",
      agendaEmpty:"There are no appointments in your planner yet.", agendaDone:"Completed", agendaUndo:"Mark as open", agendaDelete:"Delete appointment",
      weekHeading:"The next 7 days", agendaSaved:"Appointment saved securely.", agendaError:"Could not save. Check that your vault is unlocked and has enough space.",
      moodEyebrow:"CHECKING IN", moodTitle:"How are you feeling today?", moodIntro:"Choose the feeling that fits best. You do not have to explain it.",
      moodLabel:"My mood", moodNote:"Would you like to add a note? (optional)", moodSave:"Save mood",
      mood1:"Very difficult", mood2:"Difficult", mood3:"Okay", mood4:"Good", mood5:"Very good",
      moodSaved:"Your mood was saved securely.", moodEmpty:"No moods have been saved yet.", moodHistory:"Recent check-ins", moodError:"Could not save. Unlock the vault and try again.",
      peopleEyebrow:"YOUR PEOPLE", peopleTitle:"Trusted people", peopleIntro:"Keep contact details for people you can turn to. These details stay in your encrypted vault.",
      peopleName:"Name", peopleRole:"How do you know this person?", peopleContact:"Phone, email or other contact details", peopleDetails:"Extra details (optional)", peopleAdd:"Save contact",
      peopleEmpty:"You have not added any trusted people yet.", peopleDelete:"Delete contact", peopleSaved:"Contact saved securely.", peopleError:"Could not save. Unlock the vault and try again.",
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
  const app = () => window.ProjectNApp;
  const text = key => (copy[language] && copy[language][key]) || copy.nl[key] || key;
  const id = prefix => prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  const localDate = (d) => {
    const date = d || new Date();
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  };
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
      trustedPeople: Array.isArray(data.trustedPeople) ? data.trustedPeople : []
    };
  }
  async function updateSecure(mutator) {
    if (!app() || !app().isVaultUnlocked()) throw new Error("vault-locked");
    return app().updateVaultData(current => {
      const data = current && typeof current === "object" ? current : {};
      for (const key of ["routines","journalEntries","savedDrawings","agendaItems","moodEntries","trustedPeople"]) {
        if (!Array.isArray(data[key])) data[key] = [];
      }
      return mutator(data) || data;
    });
  }
  function secureGate() {
    const gate = make("div", "private-gate");
    const lockMark = make("div", "private-gate-mark", "✦");
    lockMark.setAttribute("aria-hidden", "true");
    gate.append(lockMark, make("h3", "", text("secureGateTitle")), make("p", "", text("secureGateText")));
    const action = button(text("openVault"), "primary-button", () => app().focusVaultSetup());
    gate.append(action, make("p", "privacy-hint", text("privateLocalOnly")));
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
    if (anchor && anchor.nextSibling) nav.insertBefore(navButton, anchor.nextSibling);
    else nav.append(navButton);
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
    const editor = contentBuilder();
    editor.classList.add("feature-editor");
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
    const detailsLabel = make("label", "", text("agendaDetails")); detailsLabel.htmlFor="agenda-details"; detailsLabel.dataset.featureText="agendaDetails";
    const details = make("textarea"); details.id="agenda-details"; details.name="details"; details.rows=3; details.maxLength=600;
    const submit = make("button", "primary-button", text("agendaAdd")); submit.type="submit"; submit.dataset.featureText="agendaAdd";
    const status = make("p", "inline-status"); status.id="agenda-status"; status.setAttribute("role","status"); status.setAttribute("aria-live","polite");
    form.append(nameLabel, name, row, detailsLabel, details, submit, status);
    const gate = secureGate(); gate.hidden=true; gate.dataset.secureGate="";
    const secureContents = make("div", "secure-feature-contents"); secureContents.dataset.secureContents="";
    const week = make("div", "week-strip"); week.id="agenda-week";
    const listHeading=make("h3", "feature-subheading", text("weekHeading")); listHeading.dataset.featureText="weekHeading";
    const list=make("div","feature-list"); list.id="agenda-list";
    secureContents.append(week,listHeading,list);
    fragment.append(form,gate,secureContents);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!app().isVaultUnlocked()) { status.textContent=text("secureGateTitle"); gate.hidden=false; return; }
      const item={ id:id("appointment"), title:name.value.trim().slice(0,80), date:date.value, time:time.value, details:details.value.trim().slice(0,600), done:false, createdAt:new Date().toISOString() };
      if (!item.title || !item.date) return;
      try {
        await updateSecure(data=>{ if(data.agendaItems.length>=100) data.agendaItems=data.agendaItems.slice(-99); data.agendaItems.push(item); return data; });
        form.reset(); date.value=localDate(); date.min=localDate();
        status.textContent=text("agendaSaved"); renderAgenda();
      } catch { status.textContent=text("agendaError"); }
    });
    return fragment;
  });

  const mood = addView("mood", "♡", "navMood", "moodTitle", "moodEyebrow", "moodIntro", () => {
    const fragment=make("div");
    const form=make("form","panel feature-form");
    form.id="mood-form";
    const label=make("label","",text("moodLabel")); label.htmlFor="mood-value"; label.dataset.featureText="moodLabel";
    const select=make("select"); select.id="mood-value"; select.name="mood"; select.required=true;
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
      {id:"person-details",key:"peopleDetails",type:"textarea",max:500,required:false}
    ];
    for(const field of fields){
      const key=field.key.split(",")[0];
      const label=make("label","",text(key));label.htmlFor=field.id;label.dataset.featureText=key;
      const input=field.type==="textarea"?make("textarea"):make("input");
      input.id=field.id;input.name=field.id;input.required=field.required;input.maxLength=field.max;
      if(field.type!=="textarea")input.type=field.type;else input.rows=3;
      form.append(label,input);
    }
    const submit=make("button","primary-button",text("peopleAdd")); submit.type="submit"; submit.dataset.featureText="peopleAdd";
    const status=make("p","inline-status"); status.id="people-status"; status.setAttribute("role","status"); status.setAttribute("aria-live","polite");
    form.append(submit,status);
    const gate=secureGate();gate.hidden=true;gate.dataset.secureGate="";
    const contents=make("div","secure-feature-contents");contents.dataset.secureContents="";
    const list=make("div","feature-list");list.id="people-list";
    contents.append(list);fragment.append(form,gate,contents);
    form.addEventListener("submit",async event=>{
      event.preventDefault();
      if(!app().isVaultUnlocked()){status.textContent=text("secureGateTitle");gate.hidden=false;return;}
      const person={id:id("person"),name:$("#person-name").value.trim().slice(0,80),role:$("#person-role").value.trim().slice(0,80),contact:$("#person-contact").value.trim().slice(0,120),details:$("#person-details").value.trim().slice(0,500),createdAt:new Date().toISOString()};
      if(!person.name || !person.role)return;
      try{
        await updateSecure(data=>{if(data.trustedPeople.length>=50)throw new Error("limit");data.trustedPeople.push(person);return data;});
        form.reset();status.textContent=text("peopleSaved");renderPeople();
      }catch{status.textContent=text("peopleError");}
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
      const meta=[dateLabel(item.date),item.time||""].filter(Boolean).join(" · ");
      const actions=[];
      const toggle=button(item.done?text("agendaUndo"):text("agendaDone"),"secondary-button",async()=>{
        try{await updateSecure(data=>{const found=data.agendaItems.find(v=>v.id===item.id);if(found)found.done=!found.done;return data;});renderAgenda();}
        catch{$("#agenda-status").textContent=text("agendaError");}
      });
      actions.push(toggle,button(text("agendaDelete"),"secondary-button",async()=>{try{await deleteItem("agendaItems",item.id);renderAgenda();}catch{$("#agenda-status").textContent=text("agendaError");}}));
      const card=createItemCard(item.title,meta,item.details,actions);
      if(item.done)card.classList.add("is-complete");
      list.append(card);
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
  function renderPeople(){
    const list=$("#people-list");if(!list)return;list.replaceChildren();
    if(!app().isVaultUnlocked())return;
    let entries=[];try{entries=secureData().trustedPeople;}catch{return;}
    if(!entries.length){list.append(make("p","privacy-hint",text("peopleEmpty")));return;}
    entries.forEach(person=>{
      const body=[person.contact,person.details].filter(Boolean).join("\n");
      const card=createItemCard(person.name,person.role,body,[button(text("peopleDelete"),"secondary-button",async()=>{
        try{await deleteItem("trustedPeople",person.id);renderPeople();}
        catch{$("#people-status").textContent=text("peopleError");}
      })]);
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
      ["agenda-form","mood-form","people-form"].forEach(formId=>{const form=$("#"+formId);if(form)form.reset();});
      ["agenda-status","mood-status","people-status"].forEach(statusId=>{const status=$("#"+statusId);if(status)status.textContent="";});
      setNoteGateVisible(false);
      $$(".drawing-gallery img").forEach(img=>{img.removeAttribute("src");});
      $$(".feature-list,.drawing-gallery").forEach(list=>list.replaceChildren());
    }
    if(unlocked && !lastUnlocked){
      renderAll();
    }
    lastUnlocked=unlocked;
  }
  function renderAll(){
    if(!app()||!app().isVaultUnlocked())return;
    renderAgenda();renderMoods();renderPeople();renderJournal();renderDrawings();
  }
  function applyLanguage(next){
    language=next==="en"?"en":"nl";
    $$("[data-feature-text]").forEach(el=>{const key=el.dataset.featureText;if(text(key))el.textContent=text(key);});
    $$("[data-feature-placeholder]").forEach(el=>{const key=el.dataset.featurePlaceholder;if(copy[language][key])el.placeholder=copy[language][key];});
    if(app()&&app().isVaultUnlocked())renderAll();
    updateGateViews();
  }
  function addSettingsLink(){
    const panel=$(".privacy-panel");
    if(!panel||$("#intro-show-again"))return;
    const b=button(language==="nl"?"Introductie opnieuw bekijken":"View the introduction again","secondary-button",()=>window.MivoryntraIntro?.showIntro());
    b.id="intro-show-again";
    panel.append(b);
  }
  function boot(){
    injectJournalControls();
    addSettingsLink();
    const today=localDate();
    const agendaDate=$("#agenda-date");if(agendaDate){agendaDate.value=today;agendaDate.min=today;}
    window.addEventListener("project-vault-state",()=>updateGateViews());
    applyLanguage(app()?app().getLanguage():"nl");
    updateGateViews();
    if(app()&&app().isVaultUnlocked())renderAll();
  }
  window.ProjectNFeatures={applyLanguage,renderAll,updateGateViews};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();