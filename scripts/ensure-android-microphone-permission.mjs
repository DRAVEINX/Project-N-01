import { readFile, writeFile } from "node:fs/promises";

const manifestPath = "android/app/src/main/AndroidManifest.xml";
let manifest = await readFile(manifestPath, "utf8");
const permission = '<uses-permission android:name="android.permission.RECORD_AUDIO" />';

if (!manifest.includes(permission)) {
  const applicationTag = manifest.indexOf("<application");
  if (applicationTag < 0) {
    throw new Error("Android manifest has no application element; microphone permission was not added.");
  }
  manifest = manifest.slice(0, applicationTag) + permission + "\n    " + manifest.slice(applicationTag);
  await writeFile(manifestPath, manifest, "utf8");
}

if (!manifest.includes(permission)) {
  throw new Error("Android microphone permission is missing.");
}
console.log("Android RECORD_AUDIO permission is present.");
