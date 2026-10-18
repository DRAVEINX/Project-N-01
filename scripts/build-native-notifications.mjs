import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const output = resolve(root,"www/src/native-notifications.bundle.js");
await build({ entryPoints:[resolve(root,"src/native-notifications-entry.js")], outfile:output, bundle:true, minify:true, platform:"browser", format:"iife", target:["es2022"], legalComments:"none" });
const indexPath=resolve(root,"www/index.html");
let html=await readFile(indexPath,"utf8");
if(!html.includes("src/native-notifications.bundle.js")){
  if(!html.includes("</head>")) throw new Error("Cannot add native notification bundle: closing head tag not found.");
  html=html.replace("</head>",'  <script src="src/native-notifications.bundle.js" defer></script>\n</head>');
  await writeFile(indexPath,html,"utf8");
}
const swPath=resolve(root,"www/service-worker.js");
let sw=await readFile(swPath,"utf8");
if(!sw.includes("/src/native-notifications.bundle.js")){
  sw=sw.replace('  "/src/account-portal.js",','  "/src/account-portal.js",\n  "/src/native-notifications.bundle.js",');
  await writeFile(swPath,sw,"utf8");
}
console.log("Native local-notification bridge bundled into www/.");
