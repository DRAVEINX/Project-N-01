import test from "node:test";
import vm from "node:vm";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const appStyles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const appIcon = await readFile(new URL("../assets/app-icon.svg", import.meta.url), "utf8");
const windowsIconScript = await readFile(new URL("../scripts/generate-windows-icon.mjs", import.meta.url), "utf8");
const portal = await readFile(new URL("../src/account-portal.js", import.meta.url), "utf8");
const history = await readFile(new URL("../src/version-history.js", import.meta.url), "utf8");
const nativeBridge = await readFile(new URL("../src/native-notifications-entry.js", import.meta.url), "utf8");
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
const dataProtection = await readFile(new URL("../docs/DATA-PROTECTION.md", import.meta.url), "utf8");

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


test("calendar conflict logic blocks same-start duplicates for the same profile", () => {
  const helpers = getCalendarHelpers();
  const existing = { id: "a", profileId: "self", date: "2026-10-20", start: "10:00", end: "10:30" };
  const candidate = { id: "b", profileId: "self", date: "2026-10-20", start: "10:00", end: "11:00" };
  assert.equal(helpers.appointmentConflict(candidate, [existing]).id, "a");
});

test("calendar conflict logic ignores the edited appointment and other profiles", () => {
  const helpers = getCalendarHelpers();
  const existing = { id: "a", profileId: "self", date: "2026-10-20", start: "10:00", end: "10:30" };
  assert.equal(helpers.appointmentConflict({ ...existing }, [existing]), null);
  assert.equal(
    helpers.appointmentConflict({ ...existing, id: "b", profileId: "profile-2" }, [existing]),
    null,
  );
});

test("calendar conflict logic detects partial overlaps but permits back-to-back appointments", () => {
  const helpers = getCalendarHelpers();
  const existing = { id: "a", profileId: "self", date: "2026-10-20", start: "10:00", end: "10:30" };
  assert.equal(
    helpers.appointmentConflict({ id: "b", profileId: "self", date: existing.date, start: "10:20", end: "10:45" }, [existing]).id,
    "a",
  );
  assert.equal(
    helpers.appointmentConflict({ id: "c", profileId: "self", date: existing.date, start: "10:30", end: "11:00" }, [existing]),
    null,
  );
});

test("calendar conflict logic treats all-day appointments as conflicts", () => {
  const helpers = getCalendarHelpers();
  const existing = { id: "a", profileId: "self", date: "2026-10-20", start: "00:00", end: "23:59", allDay: true };
  assert.equal(
    helpers.appointmentConflict({ id: "b", profileId: "self", date: existing.date, start: "13:00", end: "14:00" }, [existing]).id,
    "a",
  );
});

function getCalendarHelpers() {
  const start = js.indexOf("  function minutes(value) {");
  const end = js.indexOf("  function formData(form)", start);
  assert.notEqual(start, -1, "calendar time helper should exist");
  assert.notEqual(end, -1, "calendar helper boundary should exist");
  const source = js.slice(start, end);
  return vm.runInNewContext(`${source}; ({ minutes, overlap, appointmentConflict });`, {
    state: { currentProfileId: "self" },
    visibleItems: () => [],
  });
}

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

test("trusted contact safety card export and copy actions require explicit user interaction", () => {
  assert.match(js, /downloadSafetyCard/);
  assert.match(js, /button\(t\("downloadSafetyCard"\),"download-safety-card"/);
  assert.match(js, /safetyCardPrivacy/);
  assert.match(js, /safety-card-exported/);
  assert.match(js, /navigator\.clipboard\?\.writeText/);
  assert.match(js, /contact-details-copied/);
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


test("backup merge keeps the newest record and adds non-conflicting records", () => {
  const merge = getMergeStates();
  const current = {
    profiles: [{ id: "self" }],
    currentProfileId: "self",
    preferences: { textSize: "large", contrast: true },
    journal: [
      { id: "entry-1", text: "current", updatedAt: "2026-10-01T10:00:00Z" },
      { id: "entry-2", text: "keep", updatedAt: "2026-10-01T09:00:00Z" },
    ],
  };
  const incoming = {
    profiles: [{ id: "self" }],
    currentProfileId: "self",
    preferences: { textSize: "small", language: "en" },
    journal: [
      { id: "entry-1", text: "newer", updatedAt: "2026-10-02T10:00:00Z" },
      { id: "entry-3", text: "added", updatedAt: "2026-10-03T10:00:00Z" },
    ],
  };
  const merged = merge(current, incoming);
  assert.deepEqual(
    Array.from(merged.journal, item => item.id).sort(),
    ["entry-1", "entry-2", "entry-3"],
  );
  assert.equal(merged.journal.find(item => item.id === "entry-1").text, "newer");
  assert.equal(merged.journal.find(item => item.id === "entry-2").text, "keep");
  assert.equal(merged.preferences.textSize, "large");
  assert.equal(merged.preferences.language, "en");
});

test("backup merge records conflicts without copying record content into the report", () => {
  const { merge, getReport } = getMergeStatesWithReport();
  const current = {
    profiles: [{ id: "self" }],
    currentProfileId: "self",
    journal: [{ id: "entry-1", text: "PRIVATE_CURRENT", updatedAt: "2026-10-01T10:00:00Z" }],
  };
  const incoming = {
    profiles: [{ id: "self" }],
    currentProfileId: "self",
    journal: [{ id: "entry-1", text: "PRIVATE_INCOMING", updatedAt: "2026-10-02T10:00:00Z" }],
  };
  merge(current, incoming);
  const report = getReport();
  assert.equal(report.length, 1);
  assert.equal(report[0].category, "journal");
  assert.equal(report[0].source, "incoming");
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_CURRENT|PRIVATE_INCOMING/);
});

function getMergeStates() {
  return getMergeStatesWithReport().merge;
}

function getMergeStatesWithReport() {
  const start = js.indexOf("  function mergeStates(current, incoming) {");
  const end = js.indexOf("  function updateDrawingCanvas()", start);
  assert.notEqual(start, -1, "backup merge helper should exist");
  assert.notEqual(end, -1, "backup merge helper boundary should exist");
  const source = js.slice(start, end);
  return vm.runInNewContext(
    `let lastConflictReport = [];
     function normalizeState(value) { return value; }
     ${source}
     ({ merge: mergeStates, getReport: () => lastConflictReport });`,
    {},
  );
}

test("encrypted backup merge/replace and destructive deletion are available", () => {
  assert.match(js, /export-backup/);
  assert.match(js, /export-recovery-backup/);
  assert.match(js, /copy-recovery-code/);
  assert.match(js, /project-n-01-recovery-backup\.json/);
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
  assert.match(serviceWorker, /project-n-01-prototype-v25/);
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

test("Android phone and tablet have separate installable build variants and responsive tablet layout", () => {
  assert.match(androidVariantScript, /applicationIdSuffix "\.phone"/);
  assert.match(androidVariantScript, /applicationIdSuffix "\.tablet"/);
  assert.match(androidVariantScript, /NovaLife Telefoon/);
  assert.match(androidVariantScript, /NovaLife Tablet/);
  assert.match(androidWorkflow, /assemblePhoneDebug assembleTabletDebug/);
  assert.match(androidWorkflow, /assemblePhoneRelease bundlePhoneRelease assembleTabletRelease bundleTabletRelease/);
  assert.match(androidWorkflow, /novalife-phone-release-candidate/);
  assert.match(androidWorkflow, /novalife-tablet-release-candidate/);
  assert.match(baseStyles, /@media \(min-width:761px\) and \(max-width:900px\)/);
  assert.match(workflow, /node --check scripts\/configure-android-build-variants\.mjs/);
});

test("Windows desktop MSI and iOS archive pipelines are configured separately", () => {
  assert.match(desktopMain, /nodeIntegration: false/);
  assert.match(desktopMain, /contextIsolation: true/);
  assert.match(desktopMain, /const LOCAL_PORT = 41739/);
  assert.match(desktopMain, /filename.startsWith\(WEB_ROOT \+ path.sep\)/);
  assert.equal(desktopPackage.build.win.target[0].target, "msi");
  assert.equal(desktopPackage.build.win.icon, "build/icon.ico");
  assert.ok(windowsWorkflow.includes("generate-windows-icon.mjs"));
  assert.ok(windowsWorkflow.includes("desktop/build/icon.ico"));
  assert.match(windowsWorkflow, /windows-latest/);
  assert.match(windowsWorkflow, /project-n-01-windows-msi-unsigned/);
  assert.match(iosWorkflow, /macos-26/);
  assert.match(iosWorkflow, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(iosWorkflow, /project-n-01-ios-unsigned-archive/);
  assert.equal(packageConfig.devDependencies["@capacitor/ios"], "8.5.3");
});


test("account portal is wired and includes account recovery, MFA, sync and role consent", () => {
  assert.match(html, /data-view="account"/);
  assert.match(html, /id="view-account"/);
  assert.match(html, /src\/account-portal\.js/);
  assert.match(portal, /\/v1\/auth\/register/);
  assert.match(portal, /\/v1\/auth\/forgot-password/);
  assert.match(portal, /\/v1\/auth\/mfa\/setup/);
  assert.match(portal, /\/v1\/sync\/vault/);
  assert.match(portal, /\/v1\/households/);
  assert.match(portal, /Lokale gegevenscontrole/);
  assert.match(nativeBridge, /LocalNotifications\.schedule/);
  assert.match(nativeBridge, /quietStart/);
});


test("version history stores opaque ciphertext in IndexedDB rather than localStorage", () => {
  assert.match(history, /indexedDB\.open/);
  assert.match(history, /raw/);
  assert.doesNotMatch(history, /decryptEnvelope|crypto\.subtle/);
  assert.match(html, /src\/version-history\.js/);
});



test("NovaLife branded splash and professional app icon are wired for web, Android and Windows", () => {
  assert.match(html, /id="novalife-splash"/);
  assert.match(html, /startup-splash__icon/);
  assert.match(html, /window\.setTimeout\(dismiss, 820\)/);
  assert.match(appIcon, /linearGradient id="ribbon"/);
  assert.match(appIcon, /linearGradient id="leaf"/);
  assert.match(androidVariantScript, /novalife_splash_mark\.xml/);
  assert.match(androidVariantScript, /windowSplashScreenAnimatedIcon/);
  assert.match(androidVariantScript, /mipmap-anydpi-v26/);
  assert.match(desktopMain, /splashMarkup/);
  assert.match(desktopMain, /splashWindow = new BrowserWindow/);
  assert.match(desktopMain, /icon: fs\.existsSync\(ICON_PATH\)/);
  assert.match(windowsIconScript, /paintLine\(77, 184, 77, 75/);
  assert.match(windowsIconScript, /fillPolygon/);
});

test("data-protection documentation matches the encrypted Daily Life Suite implementation", () => {
  assert.match(dataProtection, /Daily Life Suite.*persists appointments, roster, mood check-ins, journal entries, drawings/i);
  assert.match(dataProtection, /inside its local AES-GCM encrypted envelope/i);
  assert.match(dataProtection, /original daily checklist\/routine progress and accessibility preferences remain outside this suite vault/i);
  assert.doesNotMatch(dataProtection, /Notes and drawings are currently temporary and are not persisted/);
  assert.match(dataProtection, /Profiles, consent and invite codes are currently \*\*local workflow scaffolding\*\*/);
});


test("NovaLife Personal Studio offers persistent accessible accent themes in Dutch and English", () => {
  assert.match(html, /id="accent-theme"/);
  for (const theme of ["lilac", "ocean", "rose", "emerald"]) assert.match(html, new RegExp('value="' + theme + '"'));
  assert.match(app, /novalife-accent-theme-v1/);
  assert.match(app, /function applyAccentTheme\(value, persist = false\)/);
  assert.match(app, /accentTheme:"Kleurthema"/);
  assert.match(app, /accentTheme:"Accent theme"/);
  assert.match(appStyles, /body\[data-accent-theme="ocean"\]/);
  assert.match(appStyles, /body\[data-accent-theme="rose"\]/);
  assert.match(appStyles, /body\[data-accent-theme="emerald"\]/);
});

test("NovaLife accent themes update the shared design tokens and key interface elements", () => {
  for (const theme of ["lilac", "ocean", "rose", "emerald"]) {
    assert.match(appStyles, new RegExp('body\\[data-accent-theme="' + theme + '"\\]'));
  }
  assert.match(appStyles, /--theme-primary/);
  assert.ok(appStyles.includes("body[data-accent-theme] .primary-button"));
  assert.ok(appStyles.includes("body[data-accent-theme] .welcome-panel"));
  assert.ok(appStyles.includes("body[data-accent-theme] .ls-tab.active"));
  assert.match(serviceWorker, /project-n-01-prototype-v25/);
});


test("native notifications request permission only after explicit user action", () => {
  const scheduleStart = nativeBridge.indexOf("async function schedule(");
  const permissionActionStart = nativeBridge.indexOf('requestPermission: async () =>');
  assert.notEqual(scheduleStart, -1);
  assert.notEqual(permissionActionStart, -1);
  const scheduleSource = nativeBridge.slice(scheduleStart, permissionActionStart);
  const explicitPermissionSource = nativeBridge.slice(permissionActionStart);
  assert.match(scheduleSource, /LocalNotifications\.checkPermissions\(\)/);
  assert.doesNotMatch(scheduleSource, /LocalNotifications\.requestPermissions\(\)/);
  assert.match(scheduleSource, /permission\.display !== "granted"\) return \{ native: true, permission: permission\.display, count: 0 \}/);
  assert.match(explicitPermissionSource, /LocalNotifications\.requestPermissions\(\)/);
});


test("NovaLife care workspace includes staff portal and care network workflows", () => {
  assert.match(js, /carePortal:"Zorgnetwerk & werkportaal"/);
  assert.match(js, /carePortal:"Care network & staff portal"/);
  assert.match(js, /\["careportal","carePortal"\]/);
  assert.match(js, /id="ls-availability-form"/);
  assert.match(js, /id="ls-workstate-form"/);
  assert.match(js, /id="ls-news-form"/);
  assert.match(js, /id="ls-portal-message-form"/);
  assert.match(js, /id="ls-care-task-form"/);
  assert.match(js, /id="ls-care-note-form"/);
  assert.match(js, /workstate-draft-saved/);
  assert.match(js, /care-task-completed/);
  assert.match(js, /external care platforms/);
});

test("NovaLife command center highlights the next upcoming appointment and provides a timeline shortcut", () => {
  assert.match(js, /nextActivity:"Volgende activiteit"/);
  assert.match(js, /nextActivity:"Next activity"/);
  assert.match(js, /const nowTime = new Date\(\)\.toTimeString\(\)\.slice\(0,5\)/);
  assert.match(js, /panel\(t\("nextActivity"\),\(future\.length \? appointmentCard\(future\[0\]\)/);
  assert.match(js, /button\(t\("timeline"\),"go-timeline"/);
  assert.match(js, /if\(action==="go-timeline"\)\{activeTab="timeline";renderApp\(\);return;\}/);
});

test("NovaLife dashboard lets users complete today's weekly-plan items without opening the planner", () => {
  assert.match(js, /todayPlans\.map\(p=>'<div class="ls-plan-summary"><label class="ls-plan-done"><input type="checkbox" data-plan-complete=/);
  assert.match(js, /data-plan-date=/);
  assert.match(js, /\$\$\("\[data-plan-complete\]"\)\.forEach/);
});

 
test("browser reminder notifications hide private titles unless the user explicitly enables details", () => {
  assert.match(js, /showReminderDetails===true\?a\.title:t\("appointmentPrivate"\)/);
  assert.match(js, /showReminderDetails===true\?r\.title:t\("reminderPrivate"\)/);
  assert.match(js, /appointmentPrivate:"Je hebt een afspraak gepland\."/);
  assert.match(js, /reminderPrivate:"Je hebt een herinnering\."/);
  assert.match(js, /showReminderDetails:false/);
});


test("NovaLife dashboard summarizes completion progress for today's weekly plan", () => {
  assert.match(js, /const completedTodayPlans = todayPlans\.filter/);
  assert.match(js, /class="ls-plan-progress-wrap"/);
  assert.match(js, /<progress class="ls-plan-progress" max=/);
  assert.match(js, /aria-label=.*dayPlanner/);
});


test("NovaLife daily plan progress has visible and accessible progress styling", () => {
  assert.match(css, /\.ls-plan-progress-wrap\s*\{/);
  assert.match(css, /\.ls-plan-progress\s*\{[^}]*width:100%/);
  assert.match(css, /\.ls-plan-progress::-webkit-progress-value/);
  assert.match(css, /\.ls-plan-progress::-moz-progress-bar/);
});


test("NovaLife My Life Timeline is wired in Dutch and English", () => {
  assert.match(js, /timelineView\(\)/);
  assert.match(js, /\["timeline","timeline"\]/);
  assert.match(js, /activeTab === "timeline" \? timelineView\(\)/);
  assert.match(js, /timeline:"Mijn tijdlijn"/);
  assert.match(js, /timeline:"My timeline"/);
  assert.match(js, /timelineEmpty:/);
  assert.match(js, /events\.sort\(/);
  assert.match(js, /slice\(0,60\)/);
  assert.match(js, /esc\(e\.title\)/);
  assert.match(css, /\.ls-timeline\s*\{/);
  assert.match(css, /\.ls-timeline-item:last-child::before/);
});


test("NovaLife Personal Studio persists four selectable color themes", () => {
  assert.match(js, /personalStudio:"Personal Studio"/);
  assert.match(js, /themeSetting:"Kleurthema"/);
  assert.match(js, /themeNova:"Nova paars"/);
  assert.match(js, /themeOcean:"Oceaanblauw"/);
  assert.match(js, /themePink:"Roze"/);
  assert.match(js, /themeEmerald:"Smaragdgroen"/);
  assert.match(js, /id="ls-theme-form"/);
  assert.match(js, /name="theme"/);
  assert.match(js, /allowed=\["nova","ocean","pink","emerald"\]/);
  assert.match(js, /state\.preferences\.theme=allowed\.includes\(selectedTheme\)\?selectedTheme:"nova"/);
  assert.match(js, /recordAudit\("theme-changed"/);
  assert.match(js, /ls-theme-" \+ theme/);
  assert.match(css, /ls-theme-ocean \.ls-tab\.active/);
  assert.match(css, /ls-theme-pink \.ls-tab\.active/);
  assert.match(css, /ls-theme-emerald \.ls-tab\.active/);
});


test("NovaLife Smart Assistant provides local, privacy-conscious daily suggestions", () => {
  assert.match(js, /function assistantView\(\)/);
  assert.match(js, /\["assistant","assistant"\]/);
  assert.match(js, /activeTab === "assistant" \? assistantView\(\)/);
  assert.match(js, /assistant:"Slimme assistent"/);
  assert.match(js, /assistant:"Smart assistant"/);
  assert.match(js, /visibleItems\("appointments","calendar"\)\.filter\(a => a\.date === today\)/);
  assert.match(js, /visibleItems\("moods","mood"\)\.some\(m => m\.date === today\)/);
  assert.match(js, /visibleItems\("weeklyPlans","planning"\)/);
  assert.match(js, /visibleItems\("goals","goals"\)/);
  assert.match(js, /These suggestions are derived locally from your saved data/);
  assert.match(js, /Deze suggesties worden lokaal afgeleid van je opgeslagen gegevens/);
  assert.match(js, /ls-assistant-grid/);
  assert.match(css, /\.ls-assistant-grid\s*\{/);
  assert.match(css, /@media \(max-width:560px\) \{ \.ls-assistant-grid/);
});


test("NovaLife goals support private milestones, completion and status history", () => {
  assert.match(js, /milestones:"Mijlpalen"/);
  assert.match(js, /milestones:"Milestones"/);
  assert.match(js, /data-milestone-form=/);
  assert.match(js, /data-milestone-toggle=/);
  assert.match(js, /goal\.milestones=Array\.isArray\(goal\.milestones\)\?goal\.milestones:\[\]/);
  assert.match(js, /milestone\.completedAt=el\.checked\?new Date\(\)\.toISOString\(\):""/);
  assert.match(js, /recordAudit\("milestone-created"/);
  assert.match(js, /recordAudit\(el\.checked\?"milestone-completed":"milestone-reopened"/);
  assert.match(js, /item\.statusHistory=Array\.isArray\(item\.statusHistory\)\?item\.statusHistory:\[\]/);
  assert.match(js, /goalCelebration:/);
  assert.match(css, /\.ls-milestone-section\s*\{/);
  assert.match(css, /\.ls-milestone-form\s*\{/);
});


test("NovaInsights is opt-in, local-only, and summarizes counts without journal text", () => {
  assert.match(js, /function insightsView\(\)/);
  assert.match(js, /insightsEnabled:false/);
  assert.match(js, /id="ls-insights-form"/);
  assert.match(js, /activeTab === "insights" \? insightsView\(\)/);
  assert.match(js, /visibleItems\("moods","mood"\)/);
  assert.match(js, /visibleItems\("weeklyPlans","planning"\)/);
  assert.match(js, /visibleItems\("goals","goals"\)/);
  assert.match(js, /insights-preference-changed/);
  assert.match(js, /These are counts from your own vault, not a diagnosis or prediction/);
  assert.match(js, /Dit zijn alleen tellingen uit je eigen kluis, geen diagnose of voorspelling/);
  assert.match(css, /\.ls-insights-grid\s*\{/);
  assert.match(css, /@media \(max-width:760px\) \{ \.ls-insights-grid/);
});


test("NovaLife Health Check reports observable local status without overstating security", () => {
  assert.match(js, /function healthCheckView\(\)/);
  assert.match(js, /\["health","healthCheck"\]/);
  assert.match(js, /activeTab === "health" \? healthCheckView\(\)/);
  assert.match(js, /window\.localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(js, /navigator\.onLine/);
  assert.match(js, /typeof window\.Notification !== "undefined"/);
  assert.match(js, /account-linked sync is not configured yet/);
  assert.match(js, /does not run a penetration test/);
  assert.match(js, /voert geen penetratietest uit/);
  assert.match(css, /\.ls-health-list\s*\{/);
  assert.match(css, /\.ls-health-item\s*\{/);
});


test("NovaFlow stores profile-scoped, opt-in manual shortcuts with enable/disable and audit", () => {
  assert.match(js, /function novaFlowView\(\)/);
  assert.match(js, /\[\["dashboard","dashboard"\],\["assistant","assistant"\],\["flow","novaFlow"\]/);
  assert.match(js, /activeTab === "flow" \? novaFlowView\(\)/);
  assert.match(js, /flowRules:\[\]/);
  assert.match(js, /"flowRules"/);
  assert.match(js, /id="ls-flow-form"/);
  assert.match(js, /data-flow-enabled=/);
  assert.match(js, /flowDisableAction/);
  assert.match(js, /flowEnableAction/);
  assert.match(js, /aria-label=.*flowDisableAction/);
  assert.match(js, /data-ls-action="flow-run"/);
  assert.match(js, /data-ls-action="flow-delete"/);
  assert.match(js, /flow-rule-created/);
  assert.match(js, /flow-rule-enabled/);
  assert.match(js, /flow-rule-disabled/);
  assert.match(js, /flow-rule-run/);
  assert.match(js, /flowConfirm/);
  assert.match(js, /window.confirm\(t\("flowConfirm"\)\)/);
  assert.match(js, /flow-rule-deleted/);
  assert.match(js, /const destinations=\{weekplan:"weekplan",agenda:"agenda",mood:"mood",assistant:"assistant"\}/);
  assert.match(js, /No background rules, automatic messages, or data sent to a server/);
  assert.match(js, /Geen achtergrondregels, geen automatische berichten/);
  assert.match(css, /\.ls-flow-rule\s*\{/);
  assert.match(css, /\.ls-flow-toggle\s*\{/);
});


test("Smart Assistant supports a profile-scoped private daily intention", () => {
  assert.match(js, /dailyIntentions:\[\]/);
  assert.match(js, /"dailyIntentions"/);
  assert.match(js, /id="ls-assistant-focus-form"/);
  assert.match(js, /assistantFocusHint/);
  assert.match(js, /daily-intention-saved/);
  assert.match(js, /profileId:state.currentProfileId,date:today,text:textValue/);
  assert.match(js, /textValue\.replace/);
  assert.match(js, /assistantFocusSaved/);
  assert.match(css, /\.ls-assistant-focus\s*\{/);
});


test("My Life Timeline searches event titles, categories and details with a bounded query", () => {
  assert.match(js, /timelineFilters = \{type:"all",from:"",to:"",search:""\}/);
  assert.match(js, /timelineFilterSearch:"Zoek in titel, categorie of details"/);
  assert.match(js, /timelineFilterSearch:"Search titles, categories or details"/);
  assert.match(js, /field\(t\("timelineFilterSearch"\),"search","search",timelineFilters\.search/);
  assert.match(js, /\[e\.title,e\.type,e\.detail,e\.category\]\.some\(value=>String\(value\|\|""\)\.toLocaleLowerCase\(lang\)\.includes\(query\)\)/);
  assert.match(js, /search:String\(values\.search\|\|""\)\.trim\(\)\.slice\(0,100\)/);
  assert.match(js, /timelineFilters=\{type:"all",from:"",to:"",search:""\}/);
});

test("My Life Timeline exports visible filtered events to a safe local CSV", () => {
  assert.match(js, /data-ls-action="timeline-export"/);
  assert.match(js, /timelineExport:"Zichtbare gebeurtenissen exporteren \(CSV\)"/);
  assert.match(js, /timelineExport:"Export visible events \(CSV\)"/);
  assert.match(js, /URL\.createObjectURL\(new Blob\(\[csv\],\{type:"text\/csv;charset=utf-8"\}\)\)/);
  assert.match(js, /textValue\.replace/);
  assert.match(js, /link\.download="novalife-tijdlijn-/);
  assert.match(js, /recordAudit\("timeline-exported"/);
});

test("My Life Timeline filters events by category and inclusive date range", () => {
  assert.match(js, /timelineFilters = \{type:"all",from:"",to:"",search:""\}/);
  assert.match(js, /id="ls-timeline-filter-form"/);
  assert.match(js, /timelineFilters\.type === "all" \|\| e\.category === timelineFilters\.type/);
  assert.match(js, /e\.date >= timelineFilters\.from/);
  assert.match(js, /e\.date <= timelineFilters\.to/);
  assert.match(js, /timeline-reset/);
  assert.match(js, /values\.from>values\.to/);
  assert.match(js, /timelineFilterNoResults/);
  assert.match(css, /\.ls-timeline-filters\s*\{/);
});
