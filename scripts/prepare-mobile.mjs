import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";
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

// Bundle a mobile-only entry so the native Capacitor plugin is available in Android WebView.
await build({
  entryPoints: [join(projectRoot, "src", "app-mobile-entry.js")],
  outfile: join(outputDir, "src", "app.bundle.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"]
});
const mobileIndexPath = join(outputDir, "index.html");
const mobileIndex = await readFile(mobileIndexPath, "utf8");
const bundledIndex = mobileIndex.replace(
  '<script src="src/app.js" defer></script>',
  '<script type="module" src="src/app.bundle.js"></script>'
);
if (bundledIndex === mobileIndex) {
  throw new Error("Could not find the expected app.js script tag in the mobile index.html.");
}
await writeFile(mobileIndexPath, bundledIndex, "utf8");
console.log("Mobile web assets prepared and native speech recognition bundled in www/.");
