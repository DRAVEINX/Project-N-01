import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const js = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
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
test("notes explicitly warn that the prototype does not save them", () => {
  assert.match(html, /Nothing is saved in this prototype|niets opgeslagen/i);
});
test("prototype does not depend on external runtime scripts or styles", () => {
  assert.doesNotMatch(html, /https?:\/\//);
});

const manifest = await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");
test("install metadata and offline assets are present", () => {
  const parsed = JSON.parse(manifest);
  assert.equal(parsed.name.startsWith("Project N-01"), true);
  assert.equal(parsed.display, "standalone");
  assert.ok(parsed.icons.some(icon => icon.src === "/assets/app-icon.svg"));
  for (const asset of ["/index.html", "/src/styles.css", "/src/app.js", "/offline.html"]) {
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
  assert.match(js, /button\.setAttribute\("aria-pressed", String\(done\)\)/);
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
  assert.match(js, /localStorage\.removeItem\(preferenceKey\)/);
  assert.match(js, /clearLocalData:"Wis lokale appgegevens"/);
  assert.match(js, /clearLocalData:"Clear local app data"/);
  assert.match(js, /localDataClearError/);
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
test("encryption helper is clearly marked experimental and not yet integrated", () => {
  assert.match(secureStorage, /not wired into app data persistence yet/i);
  assert.doesNotMatch(html, /secure-storage\.js/);
});

import { webcrypto } from "node:crypto";
import { encryptJson, decryptJson } from "../src/secure-storage.js";
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
test("encrypted restore validates format before adding routines and clears passphrase input", () => {
  assert.match(js, /parsed\.format !== "project-n-01-routines"/);
  assert.match(js, /const previous = customRoutines/);
  assert.match(js, /customRoutines = previous/);
  assert.match(js, /\$\("#backup-passphrase"\)\.value = ""/);
});
