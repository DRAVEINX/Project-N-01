import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const gradlePath = join(root, "android", "app", "build.gradle");
let gradle = await readFile(gradlePath, "utf8");

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

const defaultConfigMatch = androidBlock.match(/\bdefaultConfig\s*\{/);
if (!defaultConfigMatch) throw new Error("The Android Gradle configuration has no defaultConfig { } block.");
const defaultConfigOpen = gradle.indexOf("{", androidOpen + 1 + defaultConfigMatch.index);
const defaultConfigClose = findMatchingBrace(gradle, defaultConfigOpen);
const defaultConfig = gradle.slice(defaultConfigOpen + 1, defaultConfigClose);
const targetSdkLine = /^([ \t]*)targetSdk(?:Version)?\s+.*$/m;
let updatedDefaultConfig;
if (targetSdkLine.test(defaultConfig)) {
  updatedDefaultConfig = defaultConfig.replace(targetSdkLine, "$1targetSdkVersion 36");
} else {
  updatedDefaultConfig = "\n        targetSdkVersion 36" + defaultConfig;
}
if (updatedDefaultConfig !== defaultConfig) {
  const updatedGradle = gradle.slice(0, defaultConfigOpen + 1) + updatedDefaultConfig + gradle.slice(defaultConfigClose);
  await writeFile(gradlePath, updatedGradle, "utf8");
  gradle = updatedGradle;
}
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


const resourcesRoot = join(root, "android", "app", "src", "main", "res");
const valuesDir = join(resourcesRoot, "values");
const drawableDir = join(resourcesRoot, "drawable");
const mipmapAnyDir = join(resourcesRoot, "mipmap-anydpi");
const mipmapAdaptiveDir = join(resourcesRoot, "mipmap-anydpi-v26");
await Promise.all([valuesDir, drawableDir, mipmapAnyDir, mipmapAdaptiveDir].map(dir => mkdir(dir, { recursive: true })));

await writeFile(join(valuesDir, "novalife_colors.xml"), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="novalife_splash_background">#07152F</color>
    <color name="novalife_icon_background">#07152F</color>
</resources>
`, "utf8");

const iconForeground = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="512" android:viewportHeight="512">
    <path android:fillColor="#00000000" android:pathData="M0,0h512v512h-512z"/>
    <path android:fillColor="#00000000" android:strokeColor="#36D9F4"
        android:strokeWidth="52" android:strokeLineCap="round" android:strokeLineJoin="round"
        android:pathData="M146,358 V155 L360,359 V155"/>
    <path android:fillColor="#43E2D0" android:pathData="M306,158 C310,103 360,72 419,79 C416,137 381,177 322,188 C315,179 310,169 306,158 Z"/>
    <path android:fillColor="#00000000" android:strokeColor="#073C50" android:strokeWidth="8"
        android:strokeLineCap="round" android:pathData="M321,172 L403,96"/>
</vector>
`;
await writeFile(join(drawableDir, "novalife_icon_foreground.xml"), iconForeground, "utf8");
await writeFile(join(drawableDir, "novalife_splash_mark.xml"), iconForeground, "utf8");

const legacyIcon = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="512" android:viewportHeight="512">
    <path android:fillColor="#07152F" android:pathData="M128,26 H384 A102,102 0 0 1 486,128 V384 A102,102 0 0 1 384,486 H128 A102,102 0 0 1 26,384 V128 A102,102 0 0 1 128,26 Z"/>
    <path android:fillColor="#00000000" android:strokeColor="#36D9F4"
        android:strokeWidth="52" android:strokeLineCap="round" android:strokeLineJoin="round"
        android:pathData="M146,358 V155 L360,359 V155"/>
    <path android:fillColor="#43E2D0" android:pathData="M306,158 C310,103 360,72 419,79 C416,137 381,177 322,188 C315,179 310,169 306,158 Z"/>
    <path android:fillColor="#00000000" android:strokeColor="#073C50" android:strokeWidth="8"
        android:strokeLineCap="round" android:pathData="M321,172 L403,96"/>
</vector>
`;
for (const name of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
  await writeFile(join(mipmapAnyDir, name), legacyIcon, "utf8");
  await writeFile(join(mipmapAdaptiveDir, name), `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/novalife_icon_background"/>
    <foreground android:drawable="@drawable/novalife_icon_foreground"/>
</adaptive-icon>
`, "utf8");
}

const splashBackground = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/novalife_splash_background"/>
    <item android:drawable="@drawable/novalife_splash_mark" android:gravity="center"/>
</layer-list>
`;
await writeFile(join(drawableDir, "novalife_splash_background.xml"), splashBackground, "utf8");

const stylesPath = join(valuesDir, "styles.xml");
let stylesXml;
try { stylesXml = await readFile(stylesPath, "utf8"); }
catch { stylesXml = ["<?xml version=\"1.0\" encoding=\"utf-8\"?>", "<resources>", "</resources>", ""].join("\n"); }
const launchStyle = `    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:windowBackground">@drawable/novalife_splash_background</item>
        <item name="windowSplashScreenBackground">@color/novalife_splash_background</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/novalife_splash_mark</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>`;
const launchStart = stylesXml.indexOf('<style name="AppTheme.NoActionBarLaunch"');
if (launchStart >= 0) {
  const launchEnd = stylesXml.indexOf("</style>", launchStart);
  if (launchEnd < 0) throw new Error("The generated Android launch theme is not closed.");
  stylesXml = stylesXml.slice(0, launchStart) + launchStyle + stylesXml.slice(launchEnd + "</style>".length);
} else {
  stylesXml = stylesXml.replace("</resources>", launchStyle + "\n</resources>");
}
await writeFile(stylesPath, stylesXml, "utf8");
console.log("NovaLife branded Android launcher icons and native splash screen configured.");

const finalGradle = await readFile(gradlePath, "utf8");
const finalTargetSdk = finalGradle.match(/\btargetSdk(?:Version)?\s+(\d+)/);
if (!finalTargetSdk || Number(finalTargetSdk[1]) < 36) {
  throw new Error("Google Play submission requires target API level 36 or higher.");
}
console.log("Android phone and tablet variants are configured with target API level " + finalTargetSdk[1] + ".");
