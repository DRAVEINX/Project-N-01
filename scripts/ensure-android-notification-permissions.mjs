import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
const manifest = join(process.cwd(), "android", "app", "src", "main", "AndroidManifest.xml");
let content = await readFile(manifest, "utf8");
const permissions = [
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.SCHEDULE_EXACT_ALARM"
];
for (const permission of permissions) {
  const tag = '<uses-permission android:name="' + permission + '" />';
  if (content.includes('android:name="' + permission + '"')) continue;
  const manifestTagEnd = content.indexOf(">");
  if (manifestTagEnd < 0 || !content.slice(0, manifestTagEnd).includes("<manifest")) throw new Error("Android manifest opening tag is missing");
  content = content.slice(0, manifestTagEnd + 1) + "\n    " + tag + content.slice(manifestTagEnd + 1);
}
await writeFile(manifest, content);
console.log("Android notification permission declarations verified.");
