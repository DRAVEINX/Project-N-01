import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(projectRoot, "www");
const files = ["index.html", "offline.html", "manifest.webmanifest", "service-worker.js"];
const directories = ["src", "assets"];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const file of files) {
  await cp(join(projectRoot, file), join(outputDir, file));
}

for (const directory of directories) {
  await cp(join(projectRoot, directory), join(outputDir, directory), { recursive: true });
}

await build({
  entryPoints: [join(projectRoot, "src", "native-bridge-entry.js")],
  bundle: true,
  platform: "browser",
  format: "iife",
  target: ["es2022"],
  outfile: join(outputDir, "native-notifications.bundle.js")
});

console.log("Mobile web assets and native notification bundle prepared in www/.");
