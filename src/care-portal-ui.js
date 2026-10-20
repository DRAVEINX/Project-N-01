import { createCareApiSession } from "./care-api-client.js";

const root = document.getElementById("care-portal-root");
if (root) {
  const config = window.NOVALIFE_CONFIG || {};
  const baseUrl = typeof config.careApiBaseUrl === "string" ? config.careApiBaseUrl : "";
  let session = null;
  let selectedClientId = "";
  let busy = false;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const statusText = (message, error = false) => {
    const status = root.querySelector("[data-care-status]");
    if (status) {
      status.textContent = message;
      status.setAttribute("data-error", error ? "true" : "false");
    }
  };
  const setBusy = (value) => {
    busy = value;
    root.querySelectorAll("button, input, select, textarea").forEach((node) => {
      node.disabled = value || node.hasAttribute("data-always-disabled");
    });
  };

  function renderLogin(message = "") {
    session = null;
    selectedClientId = "";
    root.innerHTML = `
      <section class="panel care-portal-panel" aria-labelledby="care-portal-title">
        <h3 id="care-portal-title">Begeleidersportaal en online zorg</h3>
        <p>Log in met een persoonlijk NovaLife-account. Je rol en toegang worden door de server gecontroleerd.</p>
        ${baseUrl ? "" : '<p class="inline-status" data-error="true">Online toegang is nog niet ingesteld. Er is geen serveradres geconfigureerd; inloggen is uitgeschakeld.</p>'}
        <form data-care-login>
          <label for="care-login-email">E-mailadres</label>
          <input id="care-login-email" name="email" type="email" autocomplete="username" required maxlength="320">
          <label for="care-login-password">Wachtwoord</label>
          <input id="care-login-password" name="password" type="password" autocomplete="current-password" required maxlength="1024">
          <button class="primary-button" type="submit" ${baseUrl ? "" : "disabled"}>Inloggen</button>
        </form>
        <p class="inline-status" role="status" aria-live="polite" data-care-status>${escapeHtml(message)}</p>
        <p class="privacy-note">Geen openbaar account aanmaken via dit scherm. De organisatie moet accounts en toegangsrechten veilig verstrekken.</p>
      </section>`;
    const form = root.querySelector("[data-care-login]");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy || !baseUrl) return;
      const data = new FormData(form);
      setBusy(true);
      try {
        session = createCareApiSession({ baseUrl });
        const result = await session.login(String(data.get("email") || ""), String(data.get("password") || ""));
        renderPortal(result.actor);
      } catch (error) {
        session = null;
        statusText(error?.status === 401 ? "Inloggen mislukt. Controleer je gegevens." : "Inloggen is momenteel niet mogelijk. Probeer het later opnieuw.", true);
      } finally {
        setBusy(false);
      }
    });
  }

  function renderPortal(actor) {
    const role = actor.role;
    const clientRole = role === "client";
    const caregiverRole = ["caregiver", "parent", "guardian"].includes(role);
    if (!clientRole && !caregiverRole) {
      renderLogin("Dit account heeft geen toegang tot het zorgportaal.");
      statusText("Dit account heeft geen toegang tot het zorgportaal.", true);
      return;
    }
    if (clientRole) {
      root.innerHTML = `
        <section class="panel care-portal-panel" aria-labelledby="care-portal-title">
          <h3 id="care-portal-title">Mijn persoonlijke ruimte</h3>
          <p>Je kunt hier zelf doorgeven hoe je je voelt. Begeleidersgegevens en zorgdossiers zijn niet zichtbaar in deze ruimte.</p>
          <form data-care-mood-form>
            <label for="care-mood-text">Hoe voel je je vandaag?</label>
            <textarea id="care-mood-text" maxlength="4000" required rows="4" aria-describedby="care-mood-help"></textarea>
            <p id="care-mood-help" class="section-subtitle">Schrijf in je eigen woorden. Deel alleen wat je wilt delen.</p>
            <button class="primary-button" type="submit">Stemming veilig versturen</button>
          </form>
          <button class="secondary-button" type="button" data-care-mood-history>Mijn eerdere stemmingsrapportages bekijken</button>
          <div data-care-mood-records aria-live="polite"><p class="section-subtitle">Je eerdere rapportages verschijnen hier wanneer je ze opvraagt.</p></div>
          <hr>
          <h4>Mijn toestemmingen</h4>
          <p class="section-subtitle">Bekijk welke gegevens je met je toegewezen begeleiding deelt. Je kunt toestemming geven of later intrekken. Dit maakt geen nieuwe begeleidingsrelatie aan.</p>
          <button class="secondary-button" type="button" data-care-consent-manage>Mijn toestemmingen beheren</button>
          <section class="care-record-editor" data-care-consent-panel hidden aria-labelledby="care-consent-title">
            <h4 id="care-consent-title">Toestemmingen voor mijn begeleiding</h4>
            <form data-care-consent-form hidden>
              <label for="care-consent-recipient">Begeleider, ouder of voogd</label>
              <select id="care-consent-recipient" name="granteeId" required>
                <option value="">Kies iemand uit je toegewezen begeleiding</option>
              </select>
              <label for="care-consent-scope">Welke gegevens mag die persoon bekijken?</label>
              <select id="care-consent-scope" name="scope" required>
                <option value="mood">Mijn stemming</option>
                <option value="journal">Dagboek en notities</option>
                <option value="care_plan">Zorgplan</option>
                <option value="care_note">Rapportages en notities</option>
                <option value="care_task">Zorgtaken</option>
                <option value="care_report">Zorgverslagen</option>
                <option value="care_document">Documenten</option>
                <option value="medication_overview">Medicatieoverzicht</option>
                <option value="care_message">Zorgberichten</option>
                <option value="roster">Rooster</option>
                <option value="team">Begeleidingsteam</option>
                <option value="care_consents">Toestemmingsregistraties</option>
              </select>
              <label for="care-consent-expiry">Toestemming geldig tot (optioneel)</label>
              <input id="care-consent-expiry" name="expiresAt" type="datetime-local">
              <p class="section-subtitle">Laat dit veld leeg voor toestemming zonder einddatum. Je kunt toestemming altijd intrekken.</p>
              <button class="primary-button" type="submit">Toestemming geven</button>
            </form>
            <div data-care-consents-list aria-live="polite"><p class="section-subtitle">Je toestemmingen worden geladen wanneer je dit onderdeel opent.</p></div>
            <p class="inline-status" role="status" aria-live="polite" data-care-consent-status></p>
          </section>
          <button class="secondary-button" type="button" data-care-logout>Uitloggen</button>
          <p class="inline-status" role="status" aria-live="polite" data-care-status></p>
        </section>`;

      const consentLabels = {
        mood: "Mijn stemming",
        journal: "Dagboek en notities",
        care_plan: "Zorgplan",
        care_note: "Rapportages en notities",
        care_task: "Zorgtaken",
        care_report: "Zorgverslagen",
        care_document: "Documenten",
        medication_overview: "Medicatieoverzicht",
        care_message: "Zorgberichten",
        roster: "Rooster",
        team: "Begeleidingsteam",
        care_consents: "Toestemmingsregistraties",
      };
      const roleLabels = { caregiver: "begeleider", parent: "ouder", guardian: "voogd" };
      const consentStatus = (message, error = false) => {
        const status = root.querySelector("[data-care-consent-status]");
        if (status) {
          status.textContent = message;
          status.setAttribute("data-error", error ? "true" : "false");
        }
      };

      async function loadConsentData() {
        const [consentResult, recipientResult] = await Promise.all([
          session.api.listMyConsents(),
          session.api.listMyConsentRecipients(),
        ]);
        const consents = Array.isArray(consentResult?.consents) ? consentResult.consents : [];
        const recipients = Array.isArray(recipientResult?.recipients) ? recipientResult.recipients : [];
        const select = root.querySelector("#care-consent-recipient");
        const form = root.querySelector("[data-care-consent-form]");
        const previousRecipient = select?.value || "";
        if (select) {
          select.innerHTML = '<option value="">Kies iemand uit je toegewezen begeleiding</option>' +
            recipients.map((recipient) =>
              '<option value="' + escapeHtml(recipient.id) + '">' +
              escapeHtml(roleLabels[recipient.role] || "begeleider") + ' — ' + escapeHtml(recipient.id) +
              '</option>'
            ).join("");
          if (recipients.some((recipient) => recipient.id === previousRecipient)) select.value = previousRecipient;
        }
        if (form) form.hidden = recipients.length === 0;
        const list = root.querySelector("[data-care-consents-list]");
        if (list) {
          if (!consents.length) {
            list.innerHTML = '<p class="section-subtitle">Er zijn nog geen toestemmingen geregistreerd.</p>';
          } else {
            const now = Date.now();
            list.innerHTML = '<ul>' + consents.map((consent) => {
              const expired = consent.expiresAt && Date.parse(consent.expiresAt) <= now;
              const revoked = Boolean(consent.revokedAt);
              const status = revoked ? "ingetrokken" : expired ? "verlopen" : "actief";
              const date = consent.expiresAt ? ' — geldig tot ' + escapeHtml(consent.expiresAt) : "";
              const revoke = !revoked && !expired
                ? '<button class="secondary-button" type="button" data-care-consent-revoke="' + escapeHtml(consent.id) + '">Intrekken</button>'
                : "";
              return '<li><strong>' + escapeHtml(consentLabels[consent.scope] || consent.scope) +
                '</strong><p class="section-subtitle">' + escapeHtml(status) + ' — ' +
                escapeHtml(consent.granteeId) + date + '</p>' + revoke + '</li>';
            }).join("") + '</ul>';
          }
        }
        if (!recipients.length) {
          consentStatus("Er is nog geen actieve begeleiding aan je profiel gekoppeld. Vraag de organisatiebeheerder eerst je begeleiding te koppelen.");
        } else {
          consentStatus("Je toestemmingen zijn opgehaald. Alleen je eigen toegewezen begeleiding verschijnt in deze lijst.");
        }
      }

      root.querySelector("[data-care-logout]")?.addEventListener("click", async () => {
        setBusy(true);
        try { await session?.logout(); } catch { /* Local session is cleared even if the server is unavailable. */ }
        finally { session = null; setBusy(false); renderLogin("Je bent uitgelogd."); }
      });
      root.querySelector("[data-care-consent-manage]")?.addEventListener("click", async () => {
        if (busy || !session) return;
        const panel = root.querySelector("[data-care-consent-panel]");
        if (!panel) return;
        panel.hidden = false;
        setBusy(true);
        consentStatus("Toestemmingen laden...");
        try {
          await loadConsentData();
        } catch {
          consentStatus("Je toestemmingen konden niet worden geladen. Probeer het later opnieuw.", true);
        } finally { setBusy(false); }
      });
      root.querySelector("[data-care-consent-form]")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (busy || !session) return;
        const recipient = root.querySelector("#care-consent-recipient")?.value;
        const scope = root.querySelector("#care-consent-scope")?.value;
        const expiryField = root.querySelector("#care-consent-expiry");
        if (!recipient || !scope) {
          consentStatus("Kies een toegewezen begeleider en de gegevens waarvoor je toestemming geeft.", true);
          return;
        }
        const body = { granteeId: recipient, scope };
        if (expiryField?.value) {
          const expiry = new Date(expiryField.value);
          if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now()) {
            consentStatus("Kies een einddatum die in de toekomst ligt.", true);
            return;
          }
          body.expiresAt = expiry.toISOString();
        }
        setBusy(true);
        try {
          await session.api.grantConsent(body);
          if (expiryField) expiryField.value = "";
          await loadConsentData();
          consentStatus("Toestemming opgeslagen. Je kunt deze later weer intrekken.");
        } catch (error) {
          consentStatus(error?.status === 400
            ? "Deze toestemming kan niet worden opgeslagen. Controleer je selectie en of de begeleider nog aan je profiel is gekoppeld."
            : "De toestemming kon niet worden opgeslagen. Probeer het later opnieuw.", true);
        } finally { setBusy(false); }
      });
      root.querySelector("[data-care-consents-list]")?.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-care-consent-revoke]");
        if (!button || busy || !session) return;
        setBusy(true);
        try {
          await session.api.revokeConsent(button.dataset.careConsentRevoke);
          await loadConsentData();
          consentStatus("Toestemming ingetrokken.");
        } catch (error) {
          consentStatus(error?.status === 404
            ? "Deze toestemming is al ingetrokken of niet meer beschikbaar."
            : "Toestemming intrekken is niet gelukt. Probeer het later opnieuw.", true);
        } finally { setBusy(false); }
      });

      root.querySelector("[data-care-mood-history]")?.addEventListener("click", async () => {
        if (busy || !session) return;
        setBusy(true);
        try {
          const result = await session.api.list(actor.id, "mood-report", { limit: 50 });
          const records = Array.isArray(result?.records) ? result.records : Array.isArray(result) ? result : [];
          const container = root.querySelector("[data-care-mood-records]");
          if (!records.length) {
            container.innerHTML = '<p class="section-subtitle">Je hebt nog geen stemmingsrapportages opgeslagen.</p>';
          } else {
            container.innerHTML = '<ul>' + records.map((record) => {
              const data = record?.data && typeof record.data === "object" ? record.data : record;
              const title = escapeHtml(data.title || "Stemmingsrapportage");
              const detail = escapeHtml(data.text || data.summary || "");
              const date = escapeHtml(data.createdAt || record.createdAt || "");
              return '<li><strong>' + title + '</strong>' + (date ? '<p class="section-subtitle">' + date + '</p>' : '') + '<p>' + detail + '</p></li>';
            }).join("") + '</ul>';
          }
          statusText("Je eigen stemmingsrapportages zijn opgehaald.");
        } catch (error) {
          statusText(error?.status === 403 ? "Je hebt geen toestemming om deze gegevens te bekijken." : "Je stemmingsrapportages konden niet worden geladen.", true);
        } finally { setBusy(false); }
      });
      root.querySelector("[data-care-mood-form]")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (busy || !session) return;
        const field = root.querySelector("#care-mood-text");
        const text = field.value.trim();
        if (!text) { statusText("Vul in hoe je je voelt voordat je verstuurt.", true); return; }
        setBusy(true);
        try {
          await session.api.create(actor.id, "mood-report", {
            title: "Stemmingsrapportage",
            text,
            source: "client-self-report",
            createdAt: new Date().toISOString()
          });
          field.value = "";
          statusText("Je stemming is veilig verstuurd.");
        } catch (error) {
          statusText(error?.status === 403 ? "Je hebt geen toestemming om dit te versturen." : "Je stemming is niet verstuurd. Probeer het later opnieuw.", true);
        } finally { setBusy(false); }
      });
      return;
    }
    root.innerHTML = `
      <section class="panel care-portal-panel" aria-labelledby="care-portal-title">
        <div class="section-heading">
          <div><h3 id="care-portal-title">${clientRole ? "Mijn online zorg" : "Begeleidersportaal"}</h3>
          <p class="section-subtitle">Ingelogd als ${clientRole ? "cliënt/gebruiker" : role === "caregiver" ? "begeleider" : role === "parent" ? "ouder" : "voogd"}.</p></div>
          <button class="secondary-button" type="button" data-care-logout>Uitloggen</button>
        </div>
        ${caregiverRole ? '<label for="care-client-id">Cliënt-ID waarvoor je toegang hebt</label><input id="care-client-id" maxlength="200" autocomplete="off" required><p class="section-subtitle">Dit ID is alleen een selectie. De server moet toewijzing en toestemming onafhankelijk controleren.</p>' : ""}
        <div class="care-portal-actions" aria-label="Cliëntgegevens en begeleidersfuncties">
          <button class="secondary-button" type="button" data-care-load="care-plan">Zorgplan</button>
          <button class="secondary-button" type="button" data-care-load="care-note">Rapportages en notities</button>
          <button class="secondary-button" type="button" data-care-load="care-task">Zorgtaken</button>
          <button class="secondary-button" type="button" data-care-load="care-report">Zorgverslagen</button>
          <button class="secondary-button" type="button" data-care-load="care-document">Documenten</button>
          <button class="secondary-button" type="button" data-care-load="medication-overview">Medicatieoverzicht</button>
          <button class="secondary-button" type="button" data-care-load="care-message">Zorgberichten</button>
          <button class="secondary-button" type="button" data-care-load="care-roster">Rooster</button>
          <button class="secondary-button" type="button" data-care-load="care-team">Begeleidingsteam</button>
          <button class="secondary-button" type="button" data-care-load="care-consent-record">Toestemmingen</button>
          ${clientRole ? '<button class="secondary-button" type="button" data-care-mood>Mijn stemming rapporteren</button>' : ""}
        </div>
        <p class="section-subtitle">Alleen gegevens waarvoor dit account toegang heeft, worden door de server teruggegeven. Een functie kan leeg zijn wanneer de organisatie die nog niet heeft ingericht.</p>
        ${caregiverRole ? '<details class="care-record-editor"><summary>Nieuwe rapportage of zorgtaak toevoegen</summary><form data-care-create-form><label for="care-create-resource">Soort registratie</label><select id="care-create-resource" name="resource" required><option value="care-note">Rapportage / notitie</option><option value="care-task">Zorgtaak</option><option value="care-report">Zorgverslag</option><option value="care-plan">Zorgplan-item</option></select><label for="care-create-title">Titel</label><input id="care-create-title" name="title" maxlength="200" required><label for="care-create-text">Beschrijving / rapportage</label><textarea id="care-create-text" name="text" maxlength="8000" rows="4" required></textarea><button class="primary-button" type="submit">Beveiligd opslaan</button></form></details>' : ""}
        <div data-care-records aria-live="polite"><p class="inline-status">Kies een functie om beveiligde gegevens op te vragen.</p></div>
        ${clientRole ? '<form data-care-mood-form hidden><label for="care-mood-text">Hoe voel je je vandaag?</label><textarea id="care-mood-text" maxlength="4000" required rows="3"></textarea><button class="primary-button" type="submit">Stemming veilig versturen</button></form>' : ""}
        <p class="inline-status" role="status" aria-live="polite" data-care-status></p>
      </section>`;
    root.querySelector("[data-care-logout]")?.addEventListener("click", async () => {
      setBusy(true);
      try { await session?.logout(); } catch { /* Local session is cleared even if the server is unavailable. */ }
      finally { session = null; setBusy(false); renderLogin("Je bent uitgelogd."); }
    });
    let currentResource = null;
    const renderRecords = (result, resource) => {
      currentResource = resource;
      const records = Array.isArray(result?.records) ? result.records : Array.isArray(result) ? result : [];
      const list = root.querySelector("[data-care-records]");
      if (!list) return;
      if (!records.length) {
        list.innerHTML = '<p class="inline-status">Geen gegevens gevonden of beschikbaar.</p>';
        return;
      }
      list.innerHTML = '<ul>' + records.map((record) => {
        const data = record?.data && typeof record.data === "object" ? record.data : record;
        const title = data.title || record.id || resource;
        const detail = data.summary || data.text || data.description || "Gegevens beschikbaar";
        const editButton = caregiverRole && record.id
          ? '<button class="secondary-button" type="button" data-care-edit-id="' + escapeHtml(record.id) + '" data-care-edit-title="' + escapeHtml(data.title || "") + '" data-care-edit-text="' + escapeHtml(data.text || data.summary || data.description || "") + '">Bewerken</button>'
          : "";
        return '<li><strong>' + escapeHtml(title) + '</strong><p>' + escapeHtml(detail) + '</p>' + editButton + '</li>';
      }).join("") + '</ul>';
    };
    root.querySelectorAll("[data-care-load]").forEach((button) => button.addEventListener("click", async () => {
      if (busy || !session) return;
      const clientId = clientRole ? actor.id : root.querySelector("#care-client-id")?.value.trim();
      if (!clientId) { statusText("Vul eerst het cliënt-ID in.", true); return; }
      const resource = button.dataset.careLoad;
      setBusy(true);
      try {
        const result = await session.api.list(clientId, resource, { limit: 50 });
        renderRecords(result, resource);
        statusText("Gegevens opgevraagd. De server bepaalt welke records je mag zien.");
      } catch (error) {
        root.querySelector("[data-care-records]").innerHTML = '<p class="inline-status" data-error="true">De gegevens konden niet worden geladen.</p>';
        statusText(error?.status === 403 ? "Geen toestemming voor deze gegevens." : "De online dienst is niet beschikbaar.", true);
      } finally { setBusy(false); }
    }));
    root.querySelector("[data-care-records]")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-care-edit-id]");
      if (!button || !caregiverRole || busy || !currentResource) return;
      const list = root.querySelector("[data-care-records]");
      list.querySelector("[data-care-edit-form]")?.remove();
      const form = document.createElement("form");
      form.setAttribute("data-care-edit-form", "");
      form.innerHTML = '<h4>Registratie bewerken</h4><label for="care-edit-title">Titel</label><input id="care-edit-title" name="title" maxlength="200" required value="' + escapeHtml(button.dataset.careEditTitle || "") + '"><label for="care-edit-text">Beschrijving / rapportage</label><textarea id="care-edit-text" name="text" maxlength="8000" rows="4" required>' + escapeHtml(button.dataset.careEditText || "") + '</textarea><button class="primary-button" type="submit">Wijzigingen opslaan</button><button class="secondary-button" type="button" data-care-edit-cancel>Annuleren</button>';
      form.dataset.recordId = button.dataset.careEditId;
      list.prepend(form);
      form.querySelector("[data-care-edit-cancel]")?.addEventListener("click", () => form.remove());
    });
    root.querySelector("[data-care-records]")?.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-care-edit-form]");
      if (!form) return;
      event.preventDefault();
      if (busy || !session || !caregiverRole || !currentResource) return;
      const clientId = root.querySelector("#care-client-id")?.value.trim();
      const title = form.elements.title.value.trim();
      const text = form.elements.text.value.trim();
      if (!clientId || !title || !text) {
        statusText("Vul een cliënt-ID, titel en beschrijving in.", true);
        return;
      }
      setBusy(true);
      try {
        await session.api.update(clientId, currentResource, form.dataset.recordId, {
          title,
          text,
          updatedAt: new Date().toISOString()
        });
        const result = await session.api.list(clientId, currentResource, { limit: 50 });
        renderRecords(result, currentResource);
        statusText("Registratie bijgewerkt.");
      } catch (error) {
        statusText(error?.status === 403 ? "Geen toestemming om deze registratie te wijzigen." : "Wijzigen is niet gelukt. Probeer het later opnieuw.", true);
      } finally { setBusy(false); }
    });
    root.querySelector("[data-care-create-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy || !session || !caregiverRole) return;
      const clientId = root.querySelector("#care-client-id")?.value.trim();
      if (!clientId) { statusText("Vul eerst het cliënt-ID in.", true); return; }
      const form = event.currentTarget;
      const data = new FormData(form);
      const resource = String(data.get("resource") || "");
      const allowedCreateResources = new Set(["care-note", "care-task", "care-report", "care-plan"]);
      if (!allowedCreateResources.has(resource)) { statusText("Deze registratie is niet toegestaan.", true); return; }
      const title = String(data.get("title") || "").trim();
      const text = String(data.get("text") || "").trim();
      if (!title || !text) { statusText("Vul zowel een titel als een beschrijving in.", true); return; }
      setBusy(true);
      try {
        await session.api.create(clientId, resource, {
          title,
          text,
          createdAt: new Date().toISOString()
        });
        form.reset();
        // Refresh directly while the form is busy; do not simulate a button click,
        // because busy-state guards intentionally ignore user-triggered actions.
        try {
          const result = await session.api.list(clientId, resource, { limit: 50 });
          renderRecords(result, resource);
        } catch {
          // The record was saved successfully; a failed refresh must not report save failure.
        }
        statusText("Registratie opgeslagen. De lijst is bijgewerkt als de dienst bereikbaar was.");
      } catch (error) {
        statusText(error?.status === 403 ? "Geen toestemming om deze registratie voor deze cliënt op te slaan." : "Opslaan is niet gelukt. Probeer het later opnieuw.", true);
      } finally { setBusy(false); }
    });
    root.querySelector("[data-care-mood]")?.addEventListener("click", () => {
      const form = root.querySelector("[data-care-mood-form]");
      if (form) form.hidden = !form.hidden;
    });
    root.querySelector("[data-care-mood-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy || !session) return;
      const text = root.querySelector("#care-mood-text").value.trim();
      if (!text) { statusText("Vul je stemming in voordat je verstuurt.", true); return; }
      setBusy(true);
      try {
        await session.api.create(actor.id, "care-note", {
          title: "Stemmingsrapportage",
          text,
          source: "client-self-report",
          createdAt: new Date().toISOString()
        });
        root.querySelector("#care-mood-text").value = "";
        root.querySelector("[data-care-mood-form]").hidden = true;
        statusText("Je stemming is veilig verstuurd.");
      } catch {
        statusText("Je stemming is niet verstuurd. Probeer het later opnieuw.", true);
      } finally { setBusy(false); }
    });
  }

  renderLogin();
}
