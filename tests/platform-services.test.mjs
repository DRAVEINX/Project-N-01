import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const platform = await readFile(new URL("../src/platform-services.js", import.meta.url), "utf8");
const life = await readFile(new URL("../src/life-suite.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20261018090000_project_n01_cloud.sql", import.meta.url), "utf8");
const mobilePrep = await readFile(new URL("../scripts/prepare-mobile.mjs", import.meta.url), "utf8");
const packageConfig = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const docs = await readFile(new URL("../docs/PLATFORM-ENHANCEMENTS.md", import.meta.url), "utf8");

test("platform services are mounted as a separate area without removing the existing Life Suite", () => {
  assert.match(html, /id="platform-services-root"/);
  assert.match(html, /src\/platform-services\.js/);
  assert.match(html, /src\/platform-services\.css/);
  assert.match(html, /id="life-suite-root"/);
});

test("accounts support sign-up, login, recovery, logout, inactivity timeout and TOTP challenge", () => {
  for (const marker of ["/auth/v1/signup", "/auth/v1/token?grant_type=password", "/auth/v1/recover", "/auth/v1/logout", "requestPasswordReset", "setRecoveredPassword", "mfaPending", "verifyAuthenticator"]) {
    assert.ok(platform.includes(marker), "Missing account behavior: " + marker);
  }
  assert.match(platform, /15\*60\*1000/);
  assert.match(platform, /Second factor verification required|Bevestig eerst de authenticatorcode/);
});

test("remote snapshots contain only the encrypted vault envelope and version conflicts require an explicit choice", () => {
  assert.match(platform, /localEnvelope\(\)/);
  assert.match(platform, /encrypted_snapshot:local\.envelope/);
  assert.match(platform, /snapshot_hash/);
  assert.match(platform, /syncConflict=true/);
  assert.match(platform, /restoreLatestSnapshot/);
  assert.match(platform, /await uploadSnapshot\(\{quiet:true\}\)/);
  assert.match(platform, /LAST_HASH_KEY/);
});

test("cloud schema uses row-level security, revocable scoped links, one-use invitations and MFA policy", () => {
  for (const marker of ["enable row level security", "project_n01_mfa_ok", "create_care_invite", "redeem_care_invite", "token_hash", "read_scopes", "write_scopes", "status='revoked'", "app_sync_snapshots"]) {
    assert.ok(migration.includes(marker), "Missing security/schema marker: " + marker);
  }
  assert.match(migration, /expires_at timestamptz not null default now\(\)\+interval '7 days'/);
  assert.match(migration, /for update;/);
});

test("daily-life extras include encrypted documents, goals, reports, restore points and appointment history", () => {
  for (const marker of ["function enhancementsView", "ls-emergency-form", "ls-goal-form", "ls-document-form", "ls-absence-form", "ls-handover-form", "ls-report-form", "restore-checkpoint", "appointmentHistory", "allDay", "travelMinutes", "data-goal-progress"]) {
    assert.ok(life.includes(marker), "Missing feature: " + marker);
  }
  assert.match(life, /readFileData\(f,1572864\)/);
  assert.match(life, /speechSynthesis/);
  assert.match(life, /SpeechRecognition/);
});

test("native notification bridge is bundled for mobile shells and settings include quiet hours", () => {
  assert.equal(packageConfig.dependencies["@capacitor/local-notifications"], "8.3.1");
  assert.equal(packageConfig.devDependencies.esbuild, "0.28.2");
  assert.match(mobilePrep, /native-notifications-entry\.js/);
  assert.match(mobilePrep, /native-notifications\.bundle\.js/);
  assert.match(life, /scheduleNativeNotifications/);
  assert.match(life, /quietStart/);
  assert.match(life, /quietEnd/);
});

test("docs explicitly state that remote sharing requires setup and is not yet full live record sync", () => {
  assert.match(docs, /does not create a hosted Supabase project/i);
  assert.match(docs, /not a transparent real-time per-record merge/i);
  assert.match(docs, /does not share\/decrypt the owner's main vault/i);
  assert.match(docs, /real-device/i);
});
