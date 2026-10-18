import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const gradlePath = join(root, "android", "app", "build.gradle");
const gradle = await readFile(gradlePath, "utf8");

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === "*" && next === "/") { blockComment = false; i++; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === "/" && next === "/") { lineComment = true; i++; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i++; continue; }
    if (ch === "'" || ch === '"' || ch === "\`") { quote = ch; continue; }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error("Could not find the end of a Gradle block.");
}

const androidStart = gradle.search(/\bandroid\s*\{/);
if (androidStart < 0) throw new Error("The Android Gradle configuration has no android { } block.");
const androidOpen = gradle.indexOf("{", androidStart);
const androidClose = findMatchingBrace(gradle, androidOpen);
const androidBlock = gradle.slice(androidOpen + 1, androidClose);
if (!androidBlock.includes('applicationIdSuffix ".phone"') || !androidBlock.includes('applicationIdSuffix ".tablet"')) {
  const flavors = "\n    // Keep phone and tablet packages installable side-by-side.\n" +
    '    flavorDimensions += "device"\n' +
    "    productFlavors {\n" +
    "        phone {\n" +
    '            dimension "device"\n' +
    '            applicationIdSuffix ".phone"\n' +
    '            versionNameSuffix "-phone"\n' +
    "        }\n" +
    "        tablet {\n" +
    '            dimension "device"\n' +
    '            applicationIdSuffix ".tablet"\n' +
    '            versionNameSuffix "-tablet"\n' +
    "        }\n" +
    "    }\n";
  const updated = gradle.slice(0, androidOpen + 1) + flavors + gradle.slice(androidOpen + 1);
  await writeFile(gradlePath, updated, "utf8");
}

const labels = [
  ["phone", "NovaLife Telefoon"],
  ["tablet", "NovaLife Tablet"]
];
for (const [flavor, label] of labels) {
  const valuesDir = join(root, "android", "app", "src", flavor, "res", "values");
  await mkdir(valuesDir, { recursive: true });
  const xml = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">' +
    label + '</string>\n</resources>\n';
  await writeFile(join(valuesDir, "strings.xml"), xml, "utf8");
}

console.log("Android phone and tablet product flavors are configured.");
