import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, normalize, join, sep } from "node:path";
const root = process.cwd();
const types = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".webmanifest":"application/manifest+json; charset=utf-8",".svg":"image/svg+xml"};
const server = createServer(async (req, res) => {
  try {
    const rawPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const requested = rawPath === "/" ? "index.html" : rawPath.replace(/^\/+/, "");
    const path = normalize(join(root, requested));
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403); res.end("Forbidden"); return; }
    const data = await readFile(path);
    res.writeHead(200, {"content-type":types[extname(path)] || "application/octet-stream","x-content-type-options":"nosniff","referrer-policy":"no-referrer"});
    res.end(data);
  } catch {
    res.writeHead(404, {"content-type":"text/plain; charset=utf-8"});
    res.end("Not found");
  }
});
server.listen(4173, "127.0.0.1", () => console.log("Project N-01 preview: http://localhost:4173"));
