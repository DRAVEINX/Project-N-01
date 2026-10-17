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
  assert.match(js, /vault\.exportEnvelope\(\)/);
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
  assert.match(js, /const merged = \[\.\.\.customRoutines, \.\.\.imported\]\.slice\(0,50\)/);
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
