import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

// Package native notifications into the offline web bundle. A dynamic import in
// life-suite.js only loads this module when running inside a native Capacitor shell.
const { build } = await import("esbuild");
await build({
  entryPoints: [join(projectRoot, "src/native-notifications-entry.js")],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  outfile: join(outputDir, "src/native-notifications.bundle.js"),
});
console.log("Mobile web assets and native notification bridge prepared in www/.");
