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
  if (!content.includes("<manifest")) throw new Error("Android manifest opening tag is missing");
  content = content.replace("<manifest", "<manifest\n    " + tag);
}
await writeFile(manifest, content);
console.log("Android notification permission declarations verified.");
