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
