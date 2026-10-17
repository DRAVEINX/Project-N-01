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
