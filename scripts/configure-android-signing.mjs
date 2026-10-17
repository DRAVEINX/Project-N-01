import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const keys = {
  ANDROID_KEYSTORE_BASE64: process.env.ANDROID_KEYSTORE_BASE64 || "",
  ANDROID_KEYSTORE_PASSWORD: process.env.ANDROID_KEYSTORE_PASSWORD || "",
  ANDROID_KEY_ALIAS: process.env.ANDROID_KEY_ALIAS || "",
  ANDROID_KEY_PASSWORD: process.env.ANDROID_KEY_PASSWORD || ""
};
const provided = Object.values(keys).filter(Boolean).length;

if (provided === 0) {
  console.warn("Android signing secrets are not configured. Release APK/AAB will be unsigned test candidates, not Play Store uploads.");
  process.exit(0);
}
if (provided !== Object.keys(keys).length) {
  throw new Error("Android signing requires all four GitHub secrets: ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS and ANDROID_KEY_PASSWORD.");
}

const appDir = resolve("android/app");
const gradlePath = join(appDir, "build.gradle");
const gradle = await readFile(gradlePath, "utf8");
if (!gradle.includes("android {")) {
  throw new Error("Could not find the Android Gradle android { } block; refusing to guess where to insert signing configuration.");
}
if (gradle.includes("signingConfigs {") || gradle.includes("signingConfigs.create")) {
  throw new Error("Android Gradle already defines signing configs; refusing to overwrite existing signing configuration.");
}
const releasePattern = /(buildTypes\s*\{\s*release\s*\{)/;
if (!releasePattern.test(gradle)) {
  throw new Error("Could not find buildTypes { release { } } in the generated app/build.gradle.");
}

const keystorePath = join(appDir, "upload-key.jks");
await writeFile(keystorePath, Buffer.from(keys.ANDROID_KEYSTORE_BASE64, "base64"), { mode: 0o600 });

let updated = gradle.replace(
  "android {",
  `android {
    signingConfigs {
        release {
            storeFile file("upload-key.jks")
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }`
);
updated = updated.replace(releasePattern, "$1\n            signingConfig signingConfigs.release");
await writeFile(gradlePath, updated, "utf8");
console.log("Android release signing is configured using repository secrets; keystore remains outside version control.");
