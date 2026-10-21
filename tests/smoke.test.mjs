import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const js = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const lifeSuite = await readFile(new URL("../src/life-suite.js", import.meta.url), "utf8");


test("daily task and built-in routine progress persists locally for the current day", () => {
  assert.match(js, /const dailyProgressKey = "project-n-01-daily-progress-v1"/);
  assert.match(js, /function localDateKey\(date = new Date\(\)\)/);
  assert.match(js, /if \(!parsed \|\| parsed\.date !== localDateKey\(\)\) return null/);
  assert.match(js, /localStorage\.setItem\(dailyProgressKey, JSON\.stringify\(progress\)\)/);
  assert.match(js, /function restoreDailyProgress\(\)/);
  assert.match(js, /saveDailyProgress\(\);/);
  assert.match(js, /encryptedVaultStorageKey, dailyProgressKey/);
  assert.match(js, /Today’s progress and accessibility preferences are stored unencrypted/);
  assert.match(js, /De voortgang van vandaag en toegankelijkheidsvoorkeuren worden onversleuteld/);
});

test("PWA manifest is valid and points to the cached app icon", async () => {
  const manifestText = await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8");
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
  assert.ok(manifest.icons.some(icon => icon.src === "/assets/app-icon.svg" && icon.type === "image/svg+xml"));
});

test("document has language, viewport, title and main landmark", () => {
  assert.match(html, /<html lang="nl">/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /<title>.*<\/title>/);
  assert.match(html, /<main id="main"/);
});
test("prototype has Dutch and English language choices", () => {
  assert.match(html, /<option value="nl">Nederlands<\/option>/);
  assert.match(html, /<option value="en">English<\/option>/);
  assert.match(js, /const translations = \{/);
  assert.match(js, /nl: \{/);
  assert.match(js, /en: \{/);
});
test("primary views and daily steps exist", () => {
  for (const view of ["home","routines","calm","communicate","notes","settings"]) {
    assert.ok(html.includes(`id="view-${view}"`), `missing view ${view}`);
  }
  assert.equal((html.match(/data-task="/g) || []).length, 3);
});
test("communication phrases and text-to-speech fallback are present", () => {
  assert.match(html, /data-phrase="break"/);
  assert.match(html, /data-phrase="help"/);
  assert.match(js, /speechSynthesis/);
  assert.match(js, /readUnavailable/);
});
test("accessibility controls and reduced motion support exist", () => {
  assert.match(html, /class="skip-link"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /id="large-text"/);
  assert.match(html, /id="less-motion"/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /:focus-visible/);
});
test("voice notes can be recorded, played and explicitly downloaded without app persistence", () => {
  assert.match(html, /id="start-voice-note"/);
  assert.match(html, /id="stop-voice-note"/);
  assert.match(html, /id="download-voice-note"/);
  assert.match(html, /id="voice-note-playback"/);
  assert.match(js, /navigator\.mediaDevices\?\.getUserMedia/);
  assert.match(js, /new MediaRecorder\(voiceStream\)/);
  assert.match(js, /voiceNotePlayback\.src = voiceObjectUrl/);
  assert.match(js, /link\.download = "spraaknotitie\."/);
  assert.match(js, /voiceNoteIntro:"[^"]*not automatically saved or uploaded/);
  assert.match(js, /voiceNoteIntro:"[^"]*niet automatisch opgeslagen of geüpload/);
});

test("speech-to-text is optional, bilingual, and warns about external processing", () => {
  assert.match(html, /id="start-speech-to-text"/);
  assert.match(html, /id="stop-speech-to-text"/);
  assert.match(html, /id="speech-to-text-status"/);
  assert.match(html, /external service|externe dienst/i);
  assert.match(js, /window\.SpeechRecognition \|\| window\.webkitSpeechRecognition/);
  assert.match(js, /dictationRecognition\.lang = language === "nl" \? "nl-NL" : "en-GB"/);
  assert.match(js, /noteTextField\.dispatchEvent\(new Event\("input"/);
  assert.match(js, /dictationUnsupported/);
  assert.match(js, /dictationPermissionError/);
});

test("notes can be explicitly downloaded as text and have a live character count", () => {
  assert.match(html, /id="download-text-note"/);
  assert.match(html, /id="note-character-count"/);
  assert.match(html, /id="note-status"/);
  assert.match(js, /new Blob\(\[note\], \{type:"text\/plain;charset=utf-8"\}\)/);
  assert.match(js, /noteTextEmpty/);
  assert.match(js, /updateNoteCharacterCount\(\)/);
  assert.match(js, /link\.download = language === "nl" \? "mijn-notitie\.txt" : "my-note\.txt"/);
});

test("notes can be copied to the clipboard with accessible success and failure messages", () => {
  assert.match(html, /id="copy-text-note"/);
  assert.match(js, /navigator\.clipboard\.writeText\(note\)/);
  assert.match(js, /noteCopied/);
  assert.match(js, /noteCopyFallback/);
  assert.match(js, /if \(!note\.trim\(\)\)/);
});

test("note character count refreshes immediately when the language changes", () => {
  assert.match(js, /\$\("#language"\)\.addEventListener\("change", event => \{ applyLanguage\(event\.target\.value\); updateNoteCharacterCount\(\); savePreferences\(\); \}\)/);
  assert.match(js, /\$\("#language-settings"\)\.addEventListener\("change", event => \{ applyLanguage\(event\.target\.value\); updateNoteCharacterCount\(\); savePreferences\(\); \}\)/);
});

test("clipboard failure selects the note for manual copying and has its own empty message", () => {
  assert.match(js, /noteCopyEmpty:"Write or dictate something before copying the note\."/);
  assert.match(js, /noteCopyFallback:"Automatic copying failed\. Your note is selected; copy it manually\."/);
  assert.match(js, /\$\("#note-text"\)\.focus\(\);\s*\$\("#note-text"\)\.select\(\);/);
});

test("notes explicitly warn that the prototype does not save them", () => {
  assert.match(html, /Nothing is saved in this prototype|niets opgeslagen/i);
});
const manifest = await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");
test("service worker cache version is bumped when shipping updated app assets", () => {
  assert.match(serviceWorker, /project-n-01-prototype-v15/);
  assert.doesNotMatch(serviceWorker, /project-n-01-prototype-v9/);
});

test("encrypted import tracks temporary vault unlock in local scope", () => {
  const handlerStart = js.indexOf('$("#import-encrypted-routines").addEventListener("change", async event => {');
  const handlerEnd = js.indexOf("\n});", handlerStart);
  assert.notEqual(handlerStart, -1);
  assert.notEqual(handlerEnd, -1);
  const handler = js.slice(handlerStart, handlerEnd);
  assert.match(handler, /let unlockedForThisImport = false;/);
  assert.match(handler, /unlockedForThisImport = true;/);
  assert.ok(handler.includes("if (unlockedForThisImport && activeVault)"));
});

test("vault startup tolerates unavailable browser storage", () => {
  assert.match(js, /function safeLocalStorageGetItem\(key\)\s*\{\s*try\s*\{\s*return localStorage\.getItem\(key\);\s*\}\s*catch\s*\{\s*return null;\s*\}\s*\}/);
  assert.match(js, /encryptedVaultExists = safeLocalStorageGetItem\(encryptedVaultStorageKey\) !== null/);
  assert.match(js, /safeLocalStorageGetItem\(customRoutineStorageKey\) === null/);
  assert.doesNotMatch(js, /let encryptedVaultExists = localStorage\.getItem/);
});

test("all multi-element event loops use querySelectorAll helper", () => {
  assert.doesNotMatch(js, /(?<!\$)\$\([^\n]*?\)\.forEach/);
  assert.match(js, /\$\$\("\.view"\)\.forEach/);
  assert.match(js, /\$\$\("\.nav-item\[data-view\]"\)\.forEach/);
  assert.match(js, /\$\$\("\.nav-item\[data-view\]"\)\.forEach/);
});

test("routine checkbox and completion listeners use the shared query helper", () => {
  assert.doesNotMatch(js, /\$\$\$\(/);
  assert.match(js, /\$\$\("\[data-routine-step\]"\)\.forEach/);
  assert.match(js, /\$\$\("\[data-complete-routine\]"\)\.forEach/);
  assert.doesNotMatch(js, /(?<!\$)\$\("\[data-routine-step\]"\)\.forEach/);
  assert.doesNotMatch(js, /(?<!\$)\$\("\[data-complete-routine\]"\)\.forEach/);
});

test("document title follows the active view and updates when language changes", () => {
  assert.match(js, /function updateDocumentTitle\(\)/);
  assert.match(js, /document\.title = pageName \? `\$\{pageName\} · Project N-01` : "Project N-01"/);
  assert.match(js, /updateDocumentTitle\(\);/);
});

test("reduced motion follows the operating system until the user chooses a preference", () => {
  assert.match(js, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(js, /typeof preferences\.reducedMotion === "boolean" \? preferences\.reducedMotion : systemPrefersReducedMotion/);
  assert.match(js, /\$\("#less-motion"\)\.checked = reducedMotion/);
});

test("navigation exposes the current page and localizes its accessible label", () => {
  assert.match(html, /data-i18n-aria-label="mainNavigationLabel"/);
  assert.match(html, /data-view="home" aria-current="page"/);
  assert.match(js, /button\.setAttribute\("aria-current", "page"\)/);
  assert.match(js, /button\.removeAttribute\("aria-current"\)/);
  assert.match(js, /mainNavigationLabel:"Main navigation"/);
});

test("prototype does not depend on external runtime scripts or styles", () => {
  assert.doesNotMatch(html, /https?:\/\//);
});

test("install metadata and offline assets are present", () => {
  const parsed = JSON.parse(manifest);
  assert.equal(parsed.name.startsWith("PlanSamen"), true);
  assert.equal(parsed.display, "standalone");
  assert.ok(parsed.icons.some(icon => icon.src === "/assets/app-icon.svg"));
  for (const asset of ["/index.html", "/src/styles.css", "/src/app.js", "/src/secure-storage.js", "/src/encrypted-vault.js", "/src/routine-migration.js", "/offline.html"]) {
    assert.ok(serviceWorker.includes(`"${asset}"`), `offline shell missing ${asset}`);
  }
});
test("service worker limits caching to same-origin GET requests", () => {
  assert.match(serviceWorker, /request\.method !== "GET"/);
  assert.match(serviceWorker, /url\.origin !== self\.location\.origin/);
  assert.match(serviceWorker, /caches\.match\("\/index\.html"\)/);
});

test("preferences persist locally without persisting private notes", () => {
  assert.match(js, /project-n-01-preferences-v1/);
  assert.match(js, /localStorage\.setItem\(preferenceKey/);
  assert.ok(js.includes('largeText: $("#large-text").checked'));
  assert.ok(js.includes('reducedMotion: $("#less-motion").checked'));
  assert.ok(js.includes('quietView: $("#quiet-view").checked'));
  assert.match(html, /voorkeuren worden lokaal in deze browser bewaard/i);
  assert.match(html, /notities worden niet opgeslagen/i);
  assert.doesNotMatch(js, /localStorage\.setItem\([^\n]*note/i);
});

test("drawing pad provides a bilingual PNG export without storing the drawing", () => {
  assert.match(html, /id="export-sketch"/);
  assert.match(js, /\$\("#export-sketch"\)\.addEventListener\("click"/);
  assert.match(js, /sketchCanvas\.toBlob\(blob =>/);
  assert.match(js, /link\.download = "mijn-tekening\.png"/);
  assert.match(js, /sketchEmpty:/);
  assert.match(js, /sketchExportError:/);
  assert.match(js, /sketchExported:/);
  assert.match(js, /De tekening wordt niet opgeslagen/);
  assert.match(js, /The drawing is not saved/);
});

test("drawing pad supports pointer and keyboard input without persistent storage", () => {
  assert.match(html, /id="sketch-canvas"/);
  assert.match(html, /data-i18n="sketchTitle"/);
  assert.match(html, /id="clear-sketch"/);
  assert.match(js, /addEventListener\("pointerdown"/);
  assert.match(js, /addEventListener\("pointermove"/);
  assert.match(js, /addEventListener\("keydown"/);
  assert.match(js, /clearRect\(0, 0, sketchCanvas\.width, sketchCanvas\.height\)/);
  assert.doesNotMatch(js, /localStorage\.setItem\([^\n]*sketch/i);
});

test("language changes update all translated placeholders and accessible labels", () => {
  assert.match(js, /\$\$\("\[data-i18n-placeholder\]"\)/);
  assert.match(js, /\$\$\("\[data-i18n-aria-label\]"\)/);
  assert.match(html, /data-i18n-aria-label="sketchCanvasLabel"/);
});

test("routine completion state is accessible and follows the selected language", () => {
  assert.equal((html.match(/data-complete-routine="/g) || []).length, 3);
  assert.equal((html.match(/aria-pressed="false"/g) || []).length, 3);
  assert.match(js, /button\.setAttribute\("aria-pressed", String\(complete\)\)/);
  assert.match(js, /button\.textContent = done \? t\("routineMarkedDone"\) : t\("routineMarkDone"\)/);
  assert.match(js, /\$\$\("\[data-i18n-placeholder\]"\)\.forEach/);
  assert.match(js, /\$\$\("\[data-i18n-aria-label\]"\)\.forEach/);
});

test("routines can be completed one step at a time", () => {
  for (const routine of ["morning", "afternoon", "evening"]) {
    assert.equal((html.match(new RegExp('data-routine-step="' + routine + '"', "g")) || []).length, 3);
    assert.match(html, new RegExp('data-routine-progress="' + routine + '"'));
  }
  assert.match(js, /function updateRoutineProgress\(routine\)/);
  assert.match(js, /input\.addEventListener\("change", \(\) => \{/);
  assert.match(js, /steps\.forEach\(input => \{ input\.checked = !complete; \}\)/);
  assert.match(js, /\$\$\("\[data-complete-routine\]"\)\.forEach/);
});

test("plain routine imports enforce the routine limit", () => {
  assert.ok(js.includes('if (validCandidateCount > 50) throw new Error("routine-limit");'));
  assert.ok(js.includes('if (customRoutines.length + imported.length > 50) throw new Error("routine-limit");'));
  assert.ok(js.includes('t("routineImportLimit") : t("routineImportError")'));
  assert.ok(!js.includes('customRoutines = [...customRoutines, ...imported].slice(0,50)'));
});

test("routine imports reject over-limit backups without silently truncating existing routines", () => {
  assert.match(js, /if \(validCandidateCount > 50\)/);
  assert.match(js, /if \(customRoutines\.length \+ imported\.length > 50\)/);
  assert.match(js, /error\?\.message === "routine-limit"/);
  assert.match(js, /routineImportLimit:"Deze back-up past niet: maximaal 50 routines zijn toegestaan\. Er is niets gewijzigd\."/);
  assert.match(js, /routineImportLimit:"This backup would exceed the 50-routine limit\. Nothing was changed\."/);
  assert.doesNotMatch(js, /const merged = \[\.\.\.customRoutines, \.\.\.imported\]\.slice\(0,50\)/);
});

test("language controls and phrase close button have translated accessible labels", () => {
  assert.match(html, /id="language"[^>]*data-i18n-aria-label="languageSelectLabel"/);
  assert.match(html, /id="language-settings"[^>]*data-i18n-aria-label="languageSettingsLabel"/);
  assert.match(html, /id="close-phrase"[^>]*data-i18n-aria-label="closePhraseLabel"/);
  assert.match(js, /languageSelectLabel:"Taal kiezen"/);
  assert.match(js, /languageSelectLabel:"Choose language"/);
  assert.match(js, /languageSettingsLabel:"Taalinstelling"/);
  assert.match(js, /languageSettingsLabel:"Language setting"/);
  assert.match(js, /closePhraseLabel:"Sluit de getoonde zin"/);
  assert.match(js, /closePhraseLabel:"Close displayed phrase"/);
});

test("custom routine creation enforces the 50-routine storage limit", () => {
  const start = js.indexOf('$("#custom-routine-form").addEventListener("submit", async event => {');
  const end = js.indexOf("\n});", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = js.slice(start, end);
  assert.match(handler, /customRoutines\.length >= 50/);
  assert.match(handler, /t\("customRoutineLimit"\)/);
  assert.match(js, /customRoutineLimit:"Je kunt maximaal 50 eigen routines bewaren\."/);
  assert.match(js, /customRoutineLimit:"You can save up to 50 custom routines\."/);
});

test("custom routines have bilingual form labels and local-only storage disclosure", () => {
  assert.match(html, /id="custom-routine-form"/);
  assert.match(html, /id="custom-routine-name"/);
  assert.match(html, /id="custom-routine-steps"/);
  assert.match(html, /id="custom-routine-list"/);
  assert.match(html, /customRoutinePrivacy/);
  assert.match(js, /project-n-01-custom-routines-v1/);
  assert.match(js, /function renderCustomRoutines\(\)/);
  assert.match(js, /text\.textContent = step/);
  assert.match(js, /customRoutineStorageError/);
  assert.match(js, /customRoutineTitle:"Create your own routine"/);
});

test("custom routine export and import controls validate files and disclose privacy limits", () => {
  assert.match(html, /id="export-custom-routines"/);
  assert.match(html, /id="import-custom-routines"/);
  assert.match(html, /accept="application\/json,.json"/);
  assert.match(html, /routineBackupPrivacy/);
  assert.match(js, /function normaliseImportedRoutines\(value\)/);
  assert.match(js, /file\.size > 1024 \* 1024/);
  assert.match(js, /URL\.createObjectURL\(blob\)/);
  assert.match(js, /JSON\.parse\(await file\.text\(\)\)/);
  assert.match(js, /\.slice\(0,\s*50\)/);
  assert.match(js, /routineBackupPrivacy:"Export files are not encrypted/);
});

test("custom routines can be cleared with a confirmation and bilingual accessible controls", () => {
  assert.match(html, /id="clear-custom-routines"/);
  assert.match(js, /window\.confirm\(t\("clearRoutinesConfirm"\)\)/);
  assert.match(js, /clearRoutines:"Alle eigen routines wissen"/);
  assert.match(js, /clearRoutines:"Clear all custom routines"/);
  assert.match(js, /customRoutines = \[\]/);
  assert.equal((html.match(/id="export-custom-routines"/g) || []).length, 1);
  assert.equal((html.match(/id="import-custom-routines"/g) || []).length, 1);
});

test("privacy panel explains unencrypted local data and offers confirmed deletion", () => {
  assert.match(html, /id="clear-local-app-data"/);
  assert.match(html, /data-i18n="privacyDetails"/);
  assert.match(js, /window\.confirm\(t\("clearLocalDataConfirm"\)\)/);
  assert.match(js, /localStorage\.removeItem\(customRoutineStorageKey\)/);
  assert.match(js, /for \(const key of \[customRoutineStorageKey, preferenceKey, encryptedVaultStorageKey, dailyProgressKey\]\)/);
  assert.match(js, /clearLocalData:"Wis lokale appgegevens"/);
  assert.match(js, /clearLocalData:"Clear local app data"/);
  assert.match(js, /localDataClearError/);
  assert.match(js, /for \(const key of \[customRoutineStorageKey, preferenceKey, encryptedVaultStorageKey, dailyProgressKey\]\)/);
  assert.match(js, /encryptedVaultExists = localStorage\.getItem\(encryptedVaultStorageKey\) !== null/);
  assert.match(js, /t\(allRemoved \? "localDataCleared" : "localDataClearError"\)/);
});

test("new encrypted vault creation requires a matching confirmation passphrase", () => {
  assert.match(html, /id="confirm-vault-passphrase"/);
  assert.match(html, /for="confirm-vault-passphrase" data-i18n="confirmVaultPassphraseLabel"/);
  assert.match(js, /const confirmPassphrase = \$\("#confirm-vault-passphrase"\)\.value/);
  assert.match(js, /if \(passphrase !== confirmPassphrase\)/);
  assert.match(js, /vaultPassphraseMismatch:"The passphrases do not match/);
  assert.match(js, /\$\("#confirm-vault-passphrase"\)\.value = ""/);
});

test("encrypted vault auto-locks after inactivity and when the tab is hidden", () => {
  assert.match(html, /data-i18n="vaultAutoLock"/);
  assert.match(js, /const VAULT_AUTO_LOCK_MS = 5 \* 60 \* 1000/);
  assert.match(js, /setTimeout\(\(\) => lockVaultSession\(t\("vaultAutoLock"\)\), VAULT_AUTO_LOCK_MS\)/);
  assert.match(js, /document\.addEventListener\("visibilitychange"/);
  assert.match(js, /window\.addEventListener\("pagehide"/);
  assert.match(js, /lockVaultSession\(t\("vaultLockedStatus"\)\)/);
  assert.match(js, /vaultAutoLock:"The vault automatically locks after 5 minutes/);
});

test("encrypted migration UI is explicit, bilingual and preserves legacy routines", () => {
  assert.match(html, /id="migrate-routines-to-vault"/);
  assert.match(html, /id="vault-migration-status"/);
  assert.match(html, /data-i18n="vaultMigrationIntro"/);
  assert.match(js, /import\("\.\/encrypted-vault\.js"\)/);
  assert.match(js, /import\("\.\/routine-migration\.js"\)/);
  assert.match(js, /readLegacyRoutines\(localStorage\)/);
  assert.match(js, /activeVault\.exportEnvelope\(\)/);
  assert.match(js, /vault\.lock\(\)/);
  assert.match(js, /vaultRoutinePrivacy:"Je routines worden versleuteld opgeslagen/);
  assert.match(js, /vaultRoutinePrivacy:"Your routines are encrypted/);
  assert.match(js, /vaultLockedPrivacy:"The encrypted vault is locked/);
  assert.match(js, /routinePrivacy.textContent = encryptedVaultExists && !locked/);
  assert.match(js, /updateVaultControls\(\);/);
  assert.match(js, /if \(!\(await saveCustomRoutines\(\)\)\)/);
  assert.match(js, /vaultMigrationSuccess:"De versleutelde kluis is gemaakt/);
  assert.match(js, /vaultMigrationSuccess:"The encrypted vault was created/);
  assert.match(js, /De oorspronkelijke routines blijven staan en zijn nog steeds onversleuteld/);
});

const secureStorage = await readFile(new URL("../src/secure-storage.js", import.meta.url), "utf8");
test("experimental encryption module uses authenticated AES-GCM and a password KDF", () => {
  assert.match(secureStorage, /PBKDF2/);
  assert.match(secureStorage, /iterations: ITERATIONS/);
  assert.match(secureStorage, /AES-GCM/);
  assert.match(secureStorage, /tagLength: 128/);
  assert.match(secureStorage, /getRandomValues\(new Uint8Array\(SALT_BYTES\)\)/);
  assert.match(secureStorage, /getRandomValues\(new Uint8Array\(IV_BYTES\)\)/);
  assert.doesNotMatch(secureStorage, /localStorage/);
  assert.doesNotMatch(secureStorage, /console\.log/);
});
test("encrypted routine storage has an explicit unlock/lock UI and keeps keys in memory", () => {
  assert.match(html, /id="migrate-routines-to-vault"/);
  assert.match(html, /id="lock-encrypted-vault"/);
  assert.match(html, /id="delete-plaintext-routines"/);
  assert.match(js, /await activeVault\.save\(\{ routines: customRoutines \}\)/);
  assert.match(js, /activeVault\.lock\(\)/);
  assert.match(secureStorage, /openEncryptedJsonSession/);
  assert.match(secureStorage, /fresh random IV for every save/);
  assert.match(js, /const VAULT_AUTO_LOCK_MS = 5 \* 60 \* 1000/);
  assert.match(js, /document\.visibilityState === "hidden"/);
  assert.match(js, /window\.addEventListener\("pagehide"/);
  assert.match(js, /window\.addEventListener\("pageshow"/);
});

import { webcrypto } from "node:crypto";
import { encryptJson, decryptJson } from "../src/secure-storage.js";
import { EncryptedVault } from "../src/encrypted-vault.js";
import { readLegacyRoutines, migrateLegacyRoutines, legacyRoutineStorageKey } from "../src/routine-migration.js";
if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto });

test("authenticated encryption round-trips JSON without serializing the passphrase", async () => {
  const source = { routines: [{ name: "Rustig starten", steps: ["Water drinken", "Tas pakken"] }], version: 1 };
  const passphrase = "een-veilige-testzin-123";
  const envelope = await encryptJson(source, passphrase);
  assert.deepEqual(await decryptJson(envelope, passphrase), source);
  assert.equal(JSON.stringify(envelope).includes(passphrase), false);
  assert.equal(envelope.cipher, "AES-256-GCM");
  assert.notEqual(envelope.salt, envelope.iv);
});

test("authenticated encryption rejects wrong passphrases and modified ciphertext", async () => {
  const envelope = await encryptJson({ private: "test" }, "een-veilige-testzin-123");
  await assert.rejects(() => decryptJson(envelope, "een-andere-testzin-456"));
  const tampered = { ...envelope, ciphertext: envelope.ciphertext.slice(0, -4) + "AAAA" };
  await assert.rejects(() => decryptJson(tampered, "een-veilige-testzin-123"));
});

test("encryption rejects short passphrases and unsupported envelopes", async () => {
  await assert.rejects(() => encryptJson({ ok: true }, "kort"));
  await assert.rejects(() => decryptJson({ format: "unknown" }, "een-veilige-testzin-123"), /Unsupported encrypted data format/);
});

test("encrypted backup controls are present and accessible in Dutch and English", () => {
  assert.match(html, /id="backup-passphrase" type="password"/);
  assert.match(html, /id="export-encrypted-routines"/);
  assert.match(html, /id="import-encrypted-routines"/);
  assert.match(html, /aria-describedby="backup-passphrase-help"/);
  assert.match(js, /exportEncryptedRoutines:"Versleutelde back-up maken"/);
  assert.match(js, /exportEncryptedRoutines:"Create encrypted backup"/);
  assert.match(js, /await import\("\.\/secure-storage\.js"\)/);
  assert.match(js, /file\.size > 1024 \* 1024/);
  assert.match(js, /project-n-01-routines-encrypted\.json/);
  assert.match(css, /\.encrypted-backup-panel/);
});
test("failed encrypted restore relocks a vault opened only for that import", () => {
  assert.match(js, /let unlockedForThisImport = false/);
  assert.match(js, /unlockedForThisImport = true/);
  assert.match(js, /if \(unlockedForThisImport && activeVault\)/);
  assert.match(js, /activeVault\.lock\(\);\s*activeVault = null;\s*customRoutines = \[\]/);
});

test("encrypted restore unlocks an existing locked vault before merging routines", () => {
  assert.match(js, /encryptedVaultExists && \(!activeVault \|\| !activeVault\.isUnlocked\)/);
  assert.match(js, /const existing = await vault\.unlock\(passphrase\)/);
  assert.match(js, /customRoutines = normaliseImportedRoutines\(existing\.routines\)/);
  assert.match(js, /const merged = \[\.\.\.customRoutines, \.\.\.imported\]/);
});

test("encrypted restore validates routine payloads, accepts vault envelopes and clears passphrase input", () => {
  assert.match(js, /parsed\.format === "project-n-01-routines" && parsed\.version === 1 && Array\.isArray\(parsed\.routines\)/);
  assert.match(js, /else if \(parsed && Array\.isArray\(parsed\.routines\)\)/);
  assert.match(js, /const previous = customRoutines/);
  assert.match(js, /customRoutines = previous/);
  assert.match(js, /await vault\.initialize\(passphrase, \{ routines: merged \}\)/);
  assert.match(js, /\$\("#backup-passphrase"\)\.value = ""/);
});

test("encryption rejects non-JSON values and oversized payloads", async () => {
  await assert.rejects(() => encryptJson(undefined, "een-veilige-testzin-123"), /JSON-serializable/);
  await assert.rejects(() => encryptJson({ text: "x".repeat(1_000_001) }, "een-veilige-testzin-123"), /1 MB limit/);
});
test("encrypted envelopes enforce ciphertext size limits before decrypting", async () => {
  const envelope = await encryptJson({ ok: true }, "een-veilige-testzin-123");
  envelope.ciphertext = "A".repeat(1_400_000);
  await assert.rejects(() => decryptJson(envelope, "een-veilige-testzin-123"), /1 MB limit/);
});

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

test("encrypted vault keeps a derived key only in the unlocked session and saves routines encrypted", async () => {
  const storage = createMemoryStorage();
  const vault = new EncryptedVault(storage, "session-vault");
  await vault.initialize("een-veilige-testzin-123", { routines: [{ id: "r1", name: "Start", steps: ["Water"] }] });
  const before = storage.getItem("session-vault");
  assert.equal(before.includes("Start"), false);
  await vault.save({ routines: [{ id: "r2", name: "Nieuwe routine", steps: ["Rust"] }] });
  const after = storage.getItem("session-vault");
  assert.equal(after.includes("Nieuwe routine"), false);
  assert.notEqual(after, before);
  vault.lock();
  assert.throws(() => vault.read(), /Unlock the vault/);
  await vault.unlock("een-veilige-testzin-123");
  assert.equal(vault.read().routines[0].name, "Nieuwe routine");
  vault.lock();
  assert.equal(vault.session, null);
});

test("encrypted vault stores only an envelope and requires unlock to read", async () => {
  const storage = createMemoryStorage();
  const vault = new EncryptedVault(storage, "test-vault");
  const source = { routines: [{ name: "Start", steps: ["Water"] }] };
  await vault.initialize("een-veilige-testzin-123", source);
  const persisted = storage.getItem("test-vault");
  assert.ok(persisted);
  assert.equal(persisted.includes("Start"), false);
  assert.equal(persisted.includes("een-veilige-testzin-123"), false);
  assert.deepEqual(vault.read(), source);
  vault.lock();
  assert.equal(vault.isUnlocked, false);
  assert.throws(() => vault.read(), /Unlock the vault/);
  await assert.rejects(() => vault.unlock("verkeerde-testzin-123"), /OperationError|decrypt/i);
  assert.equal(vault.isUnlocked, false);
  assert.deepEqual(await vault.unlock("een-veilige-testzin-123"), source);
});

test("encrypted vault will not overwrite data when save passphrase is wrong", async () => {
  const storage = createMemoryStorage();
  const vault = new EncryptedVault(storage, "test-vault");
  await vault.initialize("een-veilige-testzin-123", { count: 1 });
  const before = storage.getItem("test-vault");
  await assert.rejects(() => vault.saveWithPassphrase("andere-veilige-testzin-123", { count: 2 }), /OperationError|decrypt/i);
  assert.equal(storage.getItem("test-vault"), before);
  assert.deepEqual(vault.read(), { count: 1 });
  await vault.saveWithPassphrase("een-veilige-testzin-123", { count: 3 });
  vault.lock();
  assert.deepEqual(await vault.unlock("een-veilige-testzin-123"), { count: 3 });
});

test("encrypted vault refuses implicit initialization over an existing record", async () => {
  const storage = createMemoryStorage();
  const vault = new EncryptedVault(storage, "test-vault");
  await vault.initialize("een-veilige-testzin-123", { ok: true });
  await assert.rejects(() => vault.initialize("een-veilige-testzin-123", { ok: false }), /already exists/);
});

test("vault restore authenticates before replacing stored data", async () => {
  const firstStorage = createMemoryStorage();
  const first = new EncryptedVault(firstStorage, "vault-a");
  await first.initialize("een-veilige-testzin-123", { profile: "A" });
  const exported = first.exportEnvelope();
  const secondStorage = createMemoryStorage();
  const second = new EncryptedVault(secondStorage, "vault-b");
  await second.initialize("een-veilige-testzin-123", { profile: "B" });
  const before = secondStorage.getItem("vault-b");
  await assert.rejects(() => second.restoreEnvelope("verkeerde-testzin-123", exported));
  assert.equal(secondStorage.getItem("vault-b"), before);
  assert.deepEqual(await second.restoreEnvelope("een-veilige-testzin-123", exported), { profile: "A" });
});

test("vault save keeps the prior in-memory and persisted data when storage write fails", async () => {
  const storage = createMemoryStorage();
  const vault = new EncryptedVault(storage, "atomic-vault");
  await vault.initialize("een-veilige-testzin-123", { routines: [{ name: "Ochtend" }] });
  const before = storage.getItem("atomic-vault");
  const originalSetItem = storage.setItem.bind(storage);
  storage.setItem = () => { throw new Error("quota exceeded"); };
  await assert.rejects(() => vault.save({ routines: [{ name: "Avond" }] }), /quota exceeded/);
  assert.equal(storage.getItem("atomic-vault"), before);
  assert.deepEqual(vault.read(), { routines: [{ name: "Ochtend" }] });
  storage.setItem = originalSetItem;
  vault.lock();
});

test("vault restore keeps the current vault unchanged when storage write fails", async () => {
  const sourceStorage = createMemoryStorage();
  const source = new EncryptedVault(sourceStorage, "source-vault");
  await source.initialize("een-veilige-testzin-123", { profile: "source" });
  const backup = source.exportEnvelope();
  const targetStorage = createMemoryStorage();
  const target = new EncryptedVault(targetStorage, "target-vault");
  await target.initialize("een-veilige-testzin-123", { profile: "target" });
  const before = targetStorage.getItem("target-vault");
  const originalSetItem = targetStorage.setItem.bind(targetStorage);
  targetStorage.setItem = () => { throw new Error("quota exceeded"); };
  await assert.rejects(() => target.restoreEnvelope("een-veilige-testzin-123", backup), /quota exceeded/);
  assert.equal(targetStorage.getItem("target-vault"), before);
  assert.deepEqual(target.read(), { profile: "target" });
  targetStorage.setItem = originalSetItem;
  target.lock();
  source.lock();
});

test("stale unlocked vault cannot overwrite data saved by another vault instance", async () => {
  const storage = createMemoryStorage();
  const first = new EncryptedVault(storage, "shared-vault");
  await first.initialize("een-veilige-testzin-123", { routines: ["eerste"] });
  const second = new EncryptedVault(storage, "shared-vault");
  await second.unlock("een-veilige-testzin-123");
  await first.save({ routines: ["nieuwste"] });
  const latestRaw = storage.getItem("shared-vault");
  await assert.rejects(
    () => second.save({ routines: ["verouderd"] }),
    /Vault changed in another session/
  );
  assert.equal(storage.getItem("shared-vault"), latestRaw);
  assert.deepEqual(first.read(), { routines: ["nieuwste"] });
  assert.deepEqual(second.read(), { routines: ["eerste"] });
  first.lock();
  second.lock();
});

test("concurrent vault initialization does not overwrite an existing vault", async () => {
  const storage = createMemoryStorage();
  const first = new EncryptedVault(storage, "shared-init-vault");
  const second = new EncryptedVault(storage, "shared-init-vault");
  await first.initialize("een-veilige-testzin-123", { owner: "first" });
  const before = storage.getItem("shared-init-vault");
  await assert.rejects(
    () => second.initialize("een-andere-veilige-zin-456", { owner: "second" }),
    /Vault already exists/
  );
  assert.equal(storage.getItem("shared-init-vault"), before);
  first.lock();
});

test("legacy routine preview validates and normalizes data without changing the source", () => {
  const storage = createMemoryStorage();
  const original = JSON.stringify([
    { id: "routine-1", name: "  Ochtend  ", steps: [" Water ", "Tas pakken"] },
    { name: "", steps: ["skip"] },
    { name: "Onjuist", steps: [42, "Geldig"] }
  ]);
  storage.setItem(legacyRoutineStorageKey, original);
  const preview = readLegacyRoutines(storage);
  assert.equal(preview.found, true);
  assert.equal(preview.routines.length, 2);
  assert.equal(preview.routines[0].name, "Ochtend");
  assert.deepEqual(preview.routines[0].steps, ["Water", "Tas pakken"]);
  assert.ok(preview.warnings.length > 0);
  assert.equal(storage.getItem(legacyRoutineStorageKey), original);
});
test("legacy routine migration writes a verified encrypted copy and preserves plaintext source", async () => {
  const storage = createMemoryStorage();
  const source = [{ id: "r-1", name: "Rustig starten", steps: ["Ademhalen", "Water drinken"] }];
  const original = JSON.stringify(source);
  storage.setItem(legacyRoutineStorageKey, original);
  const vault = new EncryptedVault(storage, "encrypted-vault");
  const result = await migrateLegacyRoutines({ storage, vault, passphrase: "een-veilige-testzin-123" });
  assert.equal(result.routineCount, 1);
  assert.equal(result.legacyDataPreserved, true);
  assert.equal(storage.getItem(legacyRoutineStorageKey), original);
  assert.deepEqual(vault.read().routines, source);
  assert.equal(storage.getItem("encrypted-vault").includes("Rustig starten"), false);
});
test("legacy migration refuses invalid source data and keeps the original intact", async () => {
  const storage = createMemoryStorage();
  const original = "{not valid json";
  storage.setItem(legacyRoutineStorageKey, original);
  const vault = new EncryptedVault(storage, "encrypted-vault");
  await assert.rejects(() => migrateLegacyRoutines({ storage, vault, passphrase: "een-veilige-testzin-123" }), /invalid/);
  assert.equal(storage.getItem(legacyRoutineStorageKey), original);
  assert.equal(storage.getItem("encrypted-vault"), null);
});
test("legacy migration refuses to initialize over an existing encrypted vault", async () => {
  const storage = createMemoryStorage();
  storage.setItem(legacyRoutineStorageKey, JSON.stringify([{ name: "Routine", steps: ["Stap"] }]));
  const vault = new EncryptedVault(storage, "encrypted-vault");
  await vault.initialize("een-veilige-testzin-123", { existing: true });
  await assert.rejects(() => migrateLegacyRoutines({ storage, vault, passphrase: "een-veilige-testzin-123" }), /already exists/);
  assert.deepEqual(vault.read(), { existing: true });
});

test("tablet routine cards use two columns while phone layouts stay single-column", () => {
  assert.match(css, /@media\(max-width:1100px\)[\s\S]*?\.routine-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.routine-grid\{grid-template-columns:1fr;gap:12px\}/);
});

test("offline app shell cache version is refreshed and includes core app assets", async () => {
  const serviceWorker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");
  assert.match(serviceWorker, /project-n-01-prototype-v15/);
  for (const asset of ["/index.html", "/src/styles.css", "/src/app.js", "/src/secure-storage.js", "/src/encrypted-vault.js", "/src/routine-migration.js", "/manifest.webmanifest", "/assets/app-icon.svg", "/offline.html"]) {
    assert.ok(serviceWorker.includes(JSON.stringify(asset)), `offline shell missing ${asset}`);
  }
  assert.match(serviceWorker, /key !== CACHE_NAME/);
});

test("offline page marks Dutch and English text with the correct language", async () => {
  const offlinePage = await readFile(new URL("../offline.html", import.meta.url), "utf8");
  assert.match(offlinePage, /<h1><span lang="nl">Je bent even offline<\/span> \/ <span lang="en">You're offline<\/span><\/h1>/);
  assert.match(offlinePage, /<p lang="nl">Deze pagina is niet beschikbaar/);
  assert.match(offlinePage, /<p lang="en">This page isn't available/);
  assert.match(offlinePage, /<span lang="nl">Terug naar de startpagina<\/span> \/ <span lang="en">Back to home<\/span>/);
});

test("local preview server rejects paths outside the project directory", async () => {
  const server = await readFile(new URL("../scripts/serve.mjs", import.meta.url), "utf8");
  assert.match(server, /import \{ extname, normalize, join, sep \} from "node:path"/);
  assert.match(server, /path !== root && !path\.startsWith\(root \+ sep\)/);
  assert.match(server, /res\.writeHead\(403\)/);
});

test("local preview server serves web manifest and SVG with explicit MIME types", async () => {
  const server = await readFile(new URL("../scripts/serve.mjs", import.meta.url), "utf8");
  assert.match(server, /"\.webmanifest":"application\/manifest\+json; charset=utf-8"/);
  assert.match(server, /"\.svg":"image\/svg\+xml"/);
});


test("leaving the calm view stops the breathing timer", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(app, /function setView\(view\)\s*\{[\s\S]*?if \(view !== "calm" && breathInterval !== null\) stopBreathing\(false\);/);
});


test("leaving the notes view stops microphone recording and speech recognition", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(app, /if \(view !== "notes"\) \{[\s\S]*?if \(voiceRecorder && voiceRecorder\.state !== "inactive"\) voiceRecorder\.stop\(\);[\s\S]*?if \(dictationRecognition\) \{[\s\S]*?dictationRecognition\.stop\(\)/);
});


test("backgrounding the app stops active exercise and microphone features", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(app, /document\.addEventListener\("visibilitychange", \(\) => \{[\s\S]*?document\.visibilityState (?:!==|===) "hidden"[\s\S]*?stopBreathing\(false\)[\s\S]*?voiceRecorder\.stop\(\)[\s\S]*?dictationRecognition\.stop\(\)[\s\S]*?lockVaultSession\(t\("vaultAutoLock"\)\)/);
});


test("drawing canvas supports keyboard movement and non-drawing repositioning", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="sketch-canvas"[^>]*tabindex="0"[^>]*role="img"/);
  assert.match(app, /const deltas = \{ArrowUp:\[0,-8\],ArrowDown:\[0,8\],ArrowLeft:\[-8,0\],ArrowRight:\[8,0\]\}/);
  assert.match(app, /if \(!event\.shiftKey\) drawSketchLine\(sketchPointer, next\)/);
  assert.match(app, /Math\.max\(0, Math\.min\(sketchCanvas\.width/);
  assert.match(app, /Math\.max\(0, Math\.min\(sketchCanvas\.height/);
});


test("language switching updates document language, translated labels and placeholders", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(app, /function applyLanguage\(next\) \{[\s\S]*?document\.documentElement\.lang = language/);
  assert.match(app, /\$\$\("\[data-i18n\]"\)\.forEach/);
  assert.match(app, /\$\$\("\[data-i18n-placeholder\]"\)\.forEach/);
  assert.match(app, /\$\$\("\[data-i18n-aria-label\]"\)\.forEach/);
  assert.match(app, /\$\("#language"\)\.value = language/);
  assert.match(app, /\$\("#language-settings"\)\.value = language/);
  assert.match(app, /\$\("#language"\)\.setAttribute\("aria-label", t\("language"\)\)/);
});


test("backgrounding the app clears temporary toast notifications safely", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(app, /let toastTimeout/);
  assert.match(app, /toastTimeout = setTimeout\(\(\) => toast\.classList\.remove\("show"\), 2800\)/);
  assert.match(app, /function showToast\(message\) \{[\s\S]*?clearTimeout\(toastTimeout\)/);
  assert.match(app, /window\.addEventListener\("pagehide", \(\) => \{[\s\S]*?clearTimeout\(toastTimeout\)/);
});


test("reduced-motion preference also disables smooth scrolling", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(app, /document\.body\.classList\.toggle\("reduced-motion", \$\("#less-motion"\)\.checked\)/);
  assert.match(css, /body\.reduced-motion\s+\*[^{}]*\{[^}]*scroll-behavior:\s*auto\s*!important/s);
  assert.match(css, /body\.reduced-motion\s+\*[^{}]*\{[^}]*animation-duration:\s*\.01ms\s*!important/s);
  assert.match(css, /body\.reduced-motion\s+\*[^{}]*\{[^}]*transition-duration:\s*\.01ms\s*!important/s);
});

test("keyboard skip link targets the main content and becomes visible on focus", () => {
  assert.match(html, /<a[^>]*class="skip-link"[^>]*href="#main"/);
  assert.match(html, /<main id="main"/);
  assert.match(css, /\.skip-link:focus\s*\{[^}]*top:\s*1rem/s);
});

test("reduced-motion preference respects the system default unless the user saved a choice", () => {
  assert.match(js, /const systemPrefersReducedMotion = typeof window\.matchMedia === "function" && window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches/);
  assert.match(js, /typeof preferences\.reducedMotion === "boolean" \? preferences\.reducedMotion : systemPrefersReducedMotion/);
  assert.match(js, /reducedMotion: \$\("#less-motion"\)\.checked/);
  assert.match(js, /\$\("#less-motion"\)\.addEventListener\("change", event => \{[\s\S]*?savePreferences\(\)/);
});

test("voice recording permission failures release the microphone and restore controls", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const start = app.indexOf('voiceNoteStart.addEventListener("click", async () => {');
  const end = app.indexOf('\n});', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = app.slice(start, end);
  assert.match(handler, /catch \{[\s\S]*?releaseVoiceStream\(\);[\s\S]*?voiceNoteStart\.disabled = false;[\s\S]*?voiceNoteStop\.disabled = true;[\s\S]*?recordingPermissionError/);
  assert.match(app, /function releaseVoiceStream\(\) \{\s*if \(voiceStream\) voiceStream\.getTracks\(\)\.forEach\(track => track\.stop\(\)\);\s*voiceStream = null;/);
});

test("voice recorder runtime errors stop microphone tracks and restore recording controls", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const start = app.indexOf('voiceNoteStart.addEventListener("click", async () => {');
  const end = app.indexOf('\n});', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = app.slice(start, end);
  assert.match(handler, /voiceRecorder\.addEventListener\("error", \(\) => \{[\s\S]*?recordingError[\s\S]*?voiceNoteStart\.disabled = false;[\s\S]*?voiceNoteStop\.disabled = true;[\s\S]*?releaseVoiceStream\(\)/);
  assert.match(app, /function releaseVoiceStream\(\) \{\s*if \(voiceStream\) voiceStream\.getTracks\(\)\.forEach\(track => track\.stop\(\)\);\s*voiceStream = null;/);
});

test("leaving the app stops microphone tracks and revokes temporary voice audio", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const handler = app.slice(app.indexOf('window.addEventListener("pagehide", () => {', app.indexOf("// Explicit, in-memory voice notes")), app.indexOf('\n});', app.indexOf('window.addEventListener("pagehide", () => {', app.indexOf("// Explicit, in-memory voice notes"))));
  assert.match(handler, /voiceRecorder && voiceRecorder\.state !== "inactive"[\s\S]*?voiceRecorder\.stop\(\)/);
  assert.match(handler, /releaseVoiceStream\(\)/);
  assert.match(handler, /clearVoiceObjectUrl\(\)/);
  assert.match(app, /function clearVoiceObjectUrl\(\) \{\s*if \(voiceObjectUrl\) URL\.revokeObjectURL\(voiceObjectUrl\);\s*voiceObjectUrl = null;/);
});

test("speech recognition errors show feedback and restore dictation controls when ended", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const start = app.indexOf('dictationStart.addEventListener("click", () => {');
  const end = app.indexOf('\n});', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = app.slice(start, end);
  assert.match(handler, /dictationRecognition\.addEventListener\("error", event => \{[\s\S]*?dictationPermissionError[\s\S]*?dictationError/);
  assert.match(handler, /dictationRecognition\.addEventListener\("end", \(\) => \{\s*setDictationButtons\(false\)/);
  assert.match(app, /function setDictationButtons\(listening\) \{\s*dictationStart\.disabled = listening \|\| !SpeechRecognitionAPI;\s*dictationStop\.disabled = !listening;/);
});

test("starting a new voice note clears the previous temporary recording first", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const start = app.indexOf('voiceNoteStart.addEventListener("click", async () => {');
  const end = app.indexOf('\n});', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = app.slice(start, end);
  assert.match(handler, /voiceChunks = \[\];\s*voiceBlob = null;\s*clearVoiceObjectUrl\(\);\s*voiceNotePlayback\.pause\(\);\s*voiceNotePlayback\.removeAttribute\("src"\);\s*voiceNotePlayback\.hidden = true;\s*voiceNoteDownload\.disabled = true;/);
  assert.match(app, /function clearVoiceObjectUrl\(\) \{\s*if \(voiceObjectUrl\) URL\.revokeObjectURL\(voiceObjectUrl\);\s*voiceObjectUrl = null;/);
});

test("leaving the app aborts speech recognition and releases its reference", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const start = app.indexOf('window.addEventListener("pagehide", () => {', app.indexOf("// Optional browser speech recognition"));
  const end = app.indexOf('\n});', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = app.slice(start, end);
  assert.match(handler, /if \(dictationRecognition\) \{\s*try \{ dictationRecognition\.abort\(\); \} catch \{\}\s*dictationRecognition = null;/);
  assert.match(handler, /\{once:true\}/);
});

test("view navigation moves keyboard focus to the destination heading", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const start = app.indexOf("function setView(view) {");
  const end = app.indexOf("\n}", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const handler = app.slice(start, end);
  assert.match(handler, /const heading = \$\(`#view-\$\{view\} h2`\);\s*if \(heading\) heading\.setAttribute\("tabindex", "-1"\);\s*if \(heading\) heading\.focus\(\{preventScroll:true\}\);/);
  assert.match(handler, /if \(isCurrent\) button\.setAttribute\("aria-current", "page"\);\s*else button\.removeAttribute\("aria-current"\);/);
});

test("daily progress safely ignores corrupt or outdated local data", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const start = app.indexOf("function readDailyProgress() {");
  const end = app.indexOf("\n}", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const reader = app.slice(start, end);
  assert.match(reader, /const parsed = JSON\.parse\(raw\);\s*if \(!parsed \|\| parsed\.date !== localDateKey\(\)\) return null;\s*return parsed;/);
  assert.match(reader, /catch \{\s*return null;\s*\}/);
  assert.match(app, /function restoreDailyProgress\(\) \{\s*const progress = readDailyProgress\(\);\s*if \(!progress\) return;/);
});

test("daily progress restoration accepts only explicit completed booleans", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const start = app.indexOf("function restoreDailyProgress() {");
  const end = app.indexOf("\n}", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const restore = app.slice(start, end);
  assert.match(restore, /input\.checked = progress\.tasks\[index\] === true/);
  assert.match(restore, /if \(!Array\.isArray\(saved\)\) continue/);
  assert.match(restore, /input\.checked = saved\[index\] === true/);
});


test("PlanSamen homepage offers accessible client and caregiver shortcuts without claiming real accounts", () => {
  assert.match(html, /class="[^"]*\brole-entry-panel\b[^"]*"/);
  assert.match(html, /id="role-entry-title"/);
  assert.match(html, /Ik ben cliënt/);
  assert.match(html, /Ik ben begeleider/);
  assert.match(html, /class="role-entry-card"[^>]*data-view="life"/);
  assert.match(html, /beide knoppen openen dezelfde lokale omgeving/i);
  assert.match(css, /\.role-entry-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:600px\)\{\.role-entry-grid\{grid-template-columns:1fr\}/);
  assert.match(css, /\.role-entry-card:focus-visible|button:focus-visible/);
});

test("PlanSamen blocks appointment overlaps per profile but allows back-to-back appointments", () => {
  const minutesStart = lifeSuite.indexOf("  function minutes(value) {");
  const conflictStart = lifeSuite.indexOf("  function appointmentConflict(candidate, pool) {", minutesStart);
  const conflictEnd = lifeSuite.indexOf("\n    function formData", conflictStart);
  assert.notEqual(minutesStart, -1, "missing time-to-minutes helper");
  assert.notEqual(conflictStart, -1, "missing appointment conflict helper");
  assert.ok(conflictEnd > conflictStart, "appointment conflict helper should have a complete body");
  const overlapHelper = lifeSuite.slice(minutesStart, conflictStart);
  const conflictHelper = lifeSuite.slice(conflictStart, conflictEnd);
  assert.match(overlapHelper, /appointmentStartMinutes\(a\) < appointmentEndMinutes\(b\)/);
  assert.match(overlapHelper, /appointmentStartMinutes\(b\) < appointmentEndMinutes\(a\)/);
  assert.match(conflictHelper, /if \(a\.id === candidate\.id\) return false/);
  assert.match(conflictHelper, /a\.profileId \|\| "self"/);
  assert.match(conflictHelper, /\(a\.date === candidate\.date && a\.start === candidate\.start\) \|\| overlap\(a,candidate\)/);

  const createHelpers = new Function("state", "visibleItems", `${overlapHelper}\n${conflictHelper}\nreturn { overlap, appointmentConflict };`);
  const helpers = createHelpers({ currentProfileId: "client-1" }, () => []);
  const base = { id: "candidate", profileId: "client-1", date: "2026-10-22", start: "10:30", end: "11:30" };
  const existing = { id: "existing", profileId: "client-1", date: "2026-10-22", start: "10:00", end: "11:00" };
  assert.equal(helpers.appointmentConflict(base, [existing])?.id, "existing", "overlapping appointments for the same profile must conflict");
  assert.equal(helpers.appointmentConflict({ ...base, start: "11:00", end: "12:00" }, [existing]), null, "appointments that touch at the end time must be allowed");
  assert.equal(helpers.appointmentConflict({ ...base, profileId: "client-2" }, [existing]), null, "appointments belonging to another profile must not conflict");
  assert.equal(helpers.appointmentConflict({ ...base, start: "10:00", end: "10:45" }, [existing])?.id, "existing", "identical start times must conflict");

  const buffered = { ...existing, id: "buffered", start: "10:00", end: "10:30", bufferMins: 15 };
  const afterBuffer = { ...base, id: "after-buffer", start: "10:40", end: "11:00" };
  assert.equal(helpers.appointmentConflict(afterBuffer, [buffered])?.id, "buffered", "an appointment must be blocked during another appointment's transition buffer");
  assert.equal(helpers.appointmentConflict({ ...afterBuffer, start: "10:45" }, [buffered]), null, "the exact end of a transition buffer must be available");
  const withOwnBuffer = { ...base, start: "10:00", end: "10:30", bufferMins: 15 };
  const laterAppointment = { ...existing, id: "later", start: "10:40", end: "11:00" };
  assert.equal(helpers.appointmentConflict(withOwnBuffer, [laterAppointment])?.id, "later", "a new appointment's own transition buffer must also reserve time");

  const late = { ...existing, id: "late", date: "2026-10-22", start: "23:30", end: "23:45", bufferMins: 30 };
  const nextDay = { ...base, id: "next-day", date: "2026-10-23", start: "00:10", end: "00:30" };
  assert.equal(helpers.appointmentConflict(nextDay, [late])?.id, "late", "a buffer that runs past midnight must block a too-early next-day appointment");
  assert.equal(helpers.appointmentConflict({ ...nextDay, start: "00:15" }, [late]), null, "the exact next-day buffer boundary must remain available");
  assert.match(lifeSuite, /select\(t\("bufferAfter"\),"bufferMins"/, "the appointment form should expose the accessible buffer choice");
  assert.match(lifeSuite, /bufferMins:Number\(v\.bufferMins\)\|\|0/, "the chosen transition buffer must be saved with the appointment");
});


test("weekly appointment series clearly explains edit and deletion scope", () => {
  const noticeStart = lifeSuite.indexOf("  function appointmentSeriesNotice(a) {");
  const noticeEnd = lifeSuite.indexOf("\\n  function agendaView()", noticeStart);
  assert.notEqual(noticeStart, -1, "missing appointment series notice");
  assert.ok(noticeEnd > noticeStart, "appointment series notice should have a complete body");
  const noticeSource = lifeSuite.slice(noticeStart, noticeEnd);
  const createNotice = new Function("t", "esc", `${noticeSource}\\nreturn appointmentSeriesNotice;`);
  const notice = createNotice(
    key => key === "seriesRootHint" ? "Whole series" : "Only this appointment",
    value => String(value)
  );
  assert.match(notice({ id: "weekly-root", seriesId: "weekly-root", repeat: "weekly" }), /Whole series/);
  assert.match(notice({ id: "occurrence", seriesId: "weekly-root", repeat: "none" }), /Only this appointment/);
  assert.equal(notice(null), "");
  assert.ok(lifeSuite.includes('esc(t("seriesOccurrence"))'), "series occurrences should be identified in the appointment list");
  assert.ok(lifeSuite.includes('window.confirm(seriesRoot?t("deleteWholeSeriesConfirm"):t("deleteItem"))'), "deleting the series root should ask for explicit whole-series confirmation");
  assert.ok(lifeSuite.includes("Dit is één afspraak uit een wekelijkse reeks."), "Dutch editing guidance should be available");
  assert.ok(lifeSuite.includes("This is one appointment in a weekly series."), "English editing guidance should be available");
});