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

console.log("Mobile web assets prepared in www/.");
