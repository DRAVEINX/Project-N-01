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
      root.innerHTML = '<section class="panel care-portal-panel" aria-labelledby="care-portal-title"><h3 id="care-portal-title">Mijn persoonlijke ruimte</h3><p>Je bent ingelogd als cliënt/gebruiker. Begeleidersgegevens en zorgdossiers zijn niet zichtbaar in deze ruimte.</p><p>Je stemming kun je rapporteren via de functie <strong>Mijn gevoel</strong> in je persoonlijke module. De online stemmingskoppeling wordt pas ingeschakeld wanneer daarvoor een aparte, geteste API-route beschikbaar is.</p><button class="secondary-button" type="button" data-care-logout>Uitloggen</button><p class="inline-status" role="status" aria-live="polite" data-care-status></p></section>';
      root.querySelector("[data-care-logout]")?.addEventListener("click", async () => {
        setBusy(true);
        try { await session?.logout(); } catch { /* Local session is cleared even if the server is unavailable. */ }
        finally { session = null; setBusy(false); renderLogin("Je bent uitgelogd."); }
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
        <div data-care-records aria-live="polite"><p class="inline-status">Kies een functie om beveiligde gegevens op te vragen.</p></div>
        ${clientRole ? '<form data-care-mood-form hidden><label for="care-mood-text">Hoe voel je je vandaag?</label><textarea id="care-mood-text" maxlength="4000" required rows="3"></textarea><button class="primary-button" type="submit">Stemming veilig versturen</button></form>' : ""}
        <p class="inline-status" role="status" aria-live="polite" data-care-status></p>
      </section>`;
    root.querySelector("[data-care-logout]")?.addEventListener("click", async () => {
      setBusy(true);
      try { await session?.logout(); } catch { /* Local session is cleared even if the server is unavailable. */ }
      finally { session = null; setBusy(false); renderLogin("Je bent uitgelogd."); }
    });
    root.querySelectorAll("[data-care-load]").forEach((button) => button.addEventListener("click", async () => {
      if (busy || !session) return;
      const clientId = clientRole ? actor.id : root.querySelector("#care-client-id")?.value.trim();
      if (!clientId) { statusText("Vul eerst het cliënt-ID in.", true); return; }
      const resource = button.dataset.careLoad;
      setBusy(true);
      try {
        const result = await session.api.list(clientId, resource, { limit: 50 });
        const records = Array.isArray(result?.records) ? result.records : Array.isArray(result) ? result : [];
        const list = root.querySelector("[data-care-records]");
        if (!records.length) list.innerHTML = '<p class="inline-status">Geen gegevens gevonden of beschikbaar.</p>';
        else list.innerHTML = '<ul>' + records.map((record) => '<li><strong>' + escapeHtml(record.title || record.id || resource) + '</strong><p>' + escapeHtml(record.summary || record.text || record.description || "Gegevens beschikbaar") + '</p></li>').join("") + '</ul>';
        statusText("Gegevens opgevraagd. De server bepaalt welke records je mag zien.");
      } catch (error) {
        root.querySelector("[data-care-records]").innerHTML = '<p class="inline-status" data-error="true">De gegevens konden niet worden geladen.</p>';
        statusText(error?.status === 403 ? "Geen toestemming voor deze gegevens." : "De online dienst is niet beschikbaar.", true);
      } finally { setBusy(false); }
    }));
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
