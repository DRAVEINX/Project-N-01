import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const js = await readFile(new URL("../src/life-suite.js", import.meta.url), "utf8");
const css = await readFile(new URL("../src/life-suite.css", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const androidWorkflow = await readFile(new URL("../.github/workflows/android.yml", import.meta.url), "utf8");
const androidVariantScript = await readFile(new URL("../scripts/configure-android-build-variants.mjs", import.meta.url), "utf8");
const baseStyles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const desktopMain = await readFile(new URL("../desktop/main.cjs", import.meta.url), "utf8");
const desktopPackage = JSON.parse(await readFile(new URL("../desktop/package.json", import.meta.url), "utf8"));
const windowsWorkflow = await readFile(new URL("../.github/workflows/windows.yml", import.meta.url), "utf8");
const iosWorkflow = await readFile(new URL("../.github/workflows/ios.yml", import.meta.url), "utf8");
const packageConfig = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("life suite is wired into the existing app without replacing its core views", () => {
  assert.match(html, /data-view="life"/);
  assert.match(html, /id="view-life"/);
  assert.match(html, /id="life-suite-root"/);
  assert.match(html, /src\/life-suite\.js/);
  assert.match(html, /src\/life-suite\.css/);
  for (const view of ["home", "routines", "calm", "communicate", "notes", "settings"]) {
    assert.match(html, new RegExp('id="view-' + view + '"'));
  }
});

test("calendar validates times, blocks exact duplicates and asks before overlaps", () => {
  assert.match(js, /function overlap\(a,b\)/);
  assert.match(js, /function appointmentConflict\(candidate/);
  assert.match(js, /exactDuplicate/);
  assert.match(js, /window\.confirm\(t\("overlap"\)/);
  assert.match(js, /calendarMode === "month"/);
  assert.match(js, /mode-week/);
  assert.match(js, /edit-appointment/);
});

test("roster includes support-worker photos and editable dated shifts", () => {
  assert.match(js, /function rosterView\(\)/);
  assert.match(js, /const selectedPhoto=workerForm\.elements\.photo\.files\[0\]/);
  assert.match(js, /function workerCard/);
  assert.match(js, /edit-shift/);
  assert.match(js, /data-guide-step/);
});

test("weekly planner supports weekday schedules, saved completion and profile-scoped access", () => {
  assert.match(js, /function weekPlanView\(\)/);
  assert.match(js, /weeklyPlans/);
  assert.match(js, /data-plan-complete/);
  assert.match(js, /week-plan-prev/);
  assert.match(js, /planAccess/);
  assert.match(js, /modifyScope/);
});

test("mood, journal, drawings, guide photos and audio are kept inside encrypted app data", () => {
  assert.match(js, /function encryptState/);
  assert.match(js, /AES-256-GCM/);
  assert.match(js, /PBKDF2-SHA-256/);
  assert.match(js, /state\.journal\.push/);
  assert.match(js, /state\.moods\.push/);
  assert.match(js, /state\.drawings\.push/);
  assert.match(js, /images\.map\(f=>readImage\(f,350000\)\)/);
  assert.match(js, /readFileData\(audioFile,1024\*1024\)/);
});

test("profiles, revocable consent and local invitation groundwork exist", () => {
  assert.match(js, /consentForm/);
  assert.match(js, /revoke-consent/);
  assert.match(js, /create-invite/);
  assert.match(js, /profileHint/);
  assert.match(js, /function visibleItems/);
  assert.match(js, /name="modifyScope"/);
  assert.match(js, /function canModify/);
  assert.match(js, /function requireModify/);
  assert.match(js, /v.ownerId!==state.currentProfileId/);
});

test("trusted contact actions require confirmation and do not imply an automatic emergency dispatch", () => {
  assert.match(js, /contact-help/);
  assert.match(js, /window\.confirm\(t\("callConfirm"\)\)/);
  assert.match(js, /tel:/);
  assert.match(js, /sms:/);
  assert.match(js, /no emergency service is automatically notified/i);
});

test("reminder handling deduplicates notifications and communicates foreground-only limits", () => {
  assert.match(js, /startReminderMonitor/);
  assert.match(js, /notificationLog/);
  assert.match(js, /Notification\.requestPermission/);
  assert.match(js, /Background notifications need platform support/);
  assert.match(js, /exactDuplicate/);
});

test("backup merge keeps the newest conflicting version and shows a content-free report", () => {
  assert.match(js, /lastConflictReport = \[\]/);
  assert.match(js, /lastConflictReport\.push\(\{category:key,source:incomingWins\?"incoming":"current"/);
  assert.match(js, /conflictTitle/);
  assert.match(js, /currentKept/);
  assert.match(js, /importedKept/);
  assert.match(js, /function mergeStates\(current, incoming\)/);
});

test("encrypted backup merge/replace and destructive deletion are available", () => {
  assert.match(js, /export-backup/);
  assert.match(js, /export-recovery-backup/);
  assert.match(js, /copy-recovery-code/);
  assert.match(js, /novalife-recovery-backup\.json/);
  assert.match(js, /importBackup/);
  assert.match(js, /mergeStates/);
  assert.match(js, /delete-all-data/);
  assert.match(js, /PBKDF2_ITERATIONS = 310000/);
  assert.match(js, /MAX_PLAINTEXT_BYTES = 2500000/);
});

test("mobile-first accessible styling and offline cache include the new module", () => {
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /ls-high-contrast/);
  assert.match(css, /ls-large-text/);
  assert.match(css, /ls-reduced-motion/);
  assert.match(serviceWorker, /project-n-01-prototype-v16/);
  assert.match(serviceWorker, /"\/src\/life-suite\.js"/);
  assert.match(serviceWorker, /"\/src\/life-suite\.css"/);
  assert.match(workflow, /node --check src\/life-suite\.js/);
});

test("sensitive module never writes readable personal records as standalone local storage entries", () => {
  assert.match(js, /localStorage\.setItem\(STORAGE_KEY, raw\)/);
  assert.doesNotMatch(js, /localStorage\.setItem\(["'](?:project-n-01-(?:journal|mood|appointments|contacts))/);
  assert.match(js, /lockVault/);
  assert.match(js, /AUTO_LOCK_MS = 5 \* 60 \* 1000/);
});


test("vault does not relock immediately on a brief background switch and keeps the selected section", () => {
  assert.match(js, /const BACKGROUND_LOCK_GRACE_MS = 60 \* 1000/);
  assert.match(js, /backgroundLockTimer=window\.setTimeout/);
  assert.match(js, /if\(document\.visibilityState==="hidden"&&sessionKey&&!filePickerPending\)lockVault\(true\)/);
  assert.match(js, /if\(backgroundLockTimer\)clearTimeout\(backgroundLockTimer\)/);
  assert.match(js, /backgroundLockTimer=window\.setTimeout\(\(\)=>\{[\s\S]*?lockVault\(true\);[\s\S]*?\},BACKGROUND_LOCK_GRACE_MS\)/);
  assert.match(js, /Keep the last selected section when re-unlocking after an automatic lock/);
  assert.doesNotMatch(js, /activeTab = "dashboard";\s*renderApp\(\);/);
});

test("Android phone and tablet have separate installable build variants and responsive tablet layout", () => {
  assert.match(androidVariantScript, /applicationIdSuffix "\.phone"/);
  assert.match(androidVariantScript, /applicationIdSuffix "\.tablet"/);
  assert.match(androidVariantScript, /Project N-01 Telefoon/);
  assert.match(androidVariantScript, /Project N-01 Tablet/);
  assert.match(androidWorkflow, /assemblePhoneDebug assembleTabletDebug/);
  assert.match(androidWorkflow, /assemblePhoneRelease bundlePhoneRelease assembleTabletRelease bundleTabletRelease/);
  assert.match(androidWorkflow, /project-n-01-phone-release-candidate/);
  assert.match(androidWorkflow, /project-n-01-tablet-release-candidate/);
  assert.match(baseStyles, /@media \(min-width:761px\) and \(max-width:900px\)/);
  assert.match(workflow, /node --check scripts\/configure-android-build-variants\.mjs/);
});

test("Windows desktop MSI and iOS archive pipelines are configured separately", () => {
  assert.match(desktopMain, /nodeIntegration: false/);
  assert.match(desktopMain, /contextIsolation: true/);
  assert.match(desktopMain, /const LOCAL_PORT = 41739/);
  assert.match(desktopMain, /filename.startsWith\(WEB_ROOT \+ path.sep\)/);
  assert.equal(desktopPackage.build.win.target[0].target, "msi");
  assert.equal(desktopPackage.build.win.icon, "build/icon.svg");
  assert.match(windowsWorkflow, /windows-latest/);
  assert.match(windowsWorkflow, /project-n-01-windows-msi-unsigned/);
  assert.match(iosWorkflow, /macos-26/);
  assert.match(iosWorkflow, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(iosWorkflow, /project-n-01-ios-unsigned-archive/);
  assert.equal(packageConfig.devDependencies["@capacitor/ios"], "8.5.3");
});
