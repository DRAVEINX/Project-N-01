import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const read = (path) => readFile(resolve(root, path), "utf8");

test("web entry point references existing local assets", async () => {
  const html = await read("index.html");
  const localAssets = [
    "src/styles.css",
    "src/life-suite.css",
    "src/app.js",
    "src/life-suite.js",
    "manifest.webmanifest",
    "assets/app-icon.svg",
  ];
  for (const asset of localAssets) {
    await assert.doesNotReject(() => access(resolve(root, asset)), undefined, `Missing local asset: ${asset}`);
    assert.ok(html.includes(asset), `index.html should reference ${asset}`);
  }
  assert.match(html, /<html lang="(nl|en)">/);
});

test("web manifest is valid and has product identity", async () => {
  const manifest = JSON.parse(await read("manifest.webmanifest"));
  assert.equal(typeof manifest.name, "string");
  assert.ok(manifest.name.trim().length > 0);
  assert.equal(typeof manifest.short_name, "string");
  assert.match(manifest.name, /NovaLife/i);
  assert.ok(Array.isArray(manifest.icons));
  assert.ok(manifest.icons.length > 0);
  const capacitor = JSON.parse(await read("capacitor.config.json"));
  assert.equal(capacitor.appName, "NovaLife");
  assert.equal(capacitor.appId, "com.draveinx.projectn01", "Native app ID must remain stable for upgrades");
});

test("mobile preparation includes all required web assets", async () => {
  const script = await read("scripts/prepare-mobile.mjs");
  for (const file of ["index.html", "offline.html", "manifest.webmanifest", "service-worker.js"]) {
    assert.ok(script.includes(`"${file}"`), `Mobile bundle is missing ${file}`);
  }
  for (const directory of ["src", "assets"]) {
    assert.ok(script.includes(`"${directory}"`), `Mobile bundle is missing ${directory}/`);
  }
});

test("sensitive life-suite storage keeps its established encrypted format", async () => {
  const source = await read("src/life-suite.js");
  assert.match(source, /AES-GCM/i, "Sensitive data should use authenticated encryption");
  assert.match(source, /PBKDF2_ITERATIONS\s*=\s*310000/, "Passphrase derivation work factor changed unexpectedly");
  assert.match(source, /project-n-01-secure-life-v1/, "Existing storage key must remain stable for compatibility");
  assert.match(source, /project-n-01-life-v1/, "Existing data format ID must remain stable for compatibility");
});

test("application JavaScript parses without syntax errors", async () => {
  for (const file of ["src/app.js", "src/life-suite.js", "service-worker.js", "scripts/prepare-mobile.mjs"]) {
    assert.doesNotThrow(
      () => execFileSync(process.execPath, ["--check", file], { cwd: root, stdio: "pipe" }),
      "Syntax error in " + file
    );
  }
});

test("mobile build script creates a complete www bundle", async () => {
  execFileSync(process.execPath, ["scripts/prepare-mobile.mjs"], { cwd: root, stdio: "pipe" });
  for (const file of ["index.html", "offline.html", "manifest.webmanifest", "service-worker.js", "src/app.js", "src/life-suite.js", "src/styles.css", "src/life-suite.css", "assets/app-icon.svg"]) {
    await assert.doesNotReject(() => access(resolve(root, "www", file)), undefined, "Mobile build is missing " + file);
  }
  const bundledHtml = await read("www/index.html");
  assert.match(bundledHtml, /NovaLife/);
  for (const asset of ["src/styles.css", "src/life-suite.css", "src/app.js", "src/life-suite.js", "manifest.webmanifest", "assets/app-icon.svg"]) {
    await assert.doesNotReject(() => access(resolve(root, "www", asset)), undefined, "Bundled HTML dependency missing: " + asset);
    assert.ok(bundledHtml.includes(asset), "Bundled entry point should reference " + asset);
  }
});
