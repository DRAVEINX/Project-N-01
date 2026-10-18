const { app, BrowserWindow, shell, session } = require("electron");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const WEB_ROOT = path.resolve(__dirname, "web");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};
let localServer;
let splashWindow;
const LOCAL_PORT = 41739;
const ICON_PATH = path.join(__dirname, "build", "icon.ico");

function createLocalServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      if (!["GET", "HEAD"].includes(request.method || "")) {
        response.writeHead(405, { Allow: "GET, HEAD", "X-Content-Type-Options": "nosniff" });
        response.end("Method not allowed");
        return;
      }

      let pathname;
      try {
        pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname);
      } catch {
        response.writeHead(400, { "X-Content-Type-Options": "nosniff" });
        response.end("Bad request");
        return;
      }

      const relative = pathname.replace(/^\/+/, "") || "index.html";
      const filename = path.resolve(WEB_ROOT, relative);
      if (filename !== WEB_ROOT && !filename.startsWith(WEB_ROOT + path.sep)) {
        response.writeHead(403, { "X-Content-Type-Options": "nosniff" });
        response.end("Forbidden");
        return;
      }

      fs.stat(filename, (statError, stat) => {
        const target = !statError && stat.isDirectory() ? path.join(filename, "index.html") : filename;
        fs.readFile(target, (error, content) => {
          if (error) {
            response.writeHead(error.code === "ENOENT" ? 404 : 500, {
              "Content-Type": "text/plain; charset=utf-8",
              "X-Content-Type-Options": "nosniff"
            });
            response.end(error.code === "ENOENT" ? "Not found" : "Unable to read app asset");
            return;
          }

          const headers = {
            "Content-Type": MIME[path.extname(target).toLowerCase()] || "application/octet-stream",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
            "Cache-Control": path.basename(target) === "service-worker.js" ? "no-cache" : "private, max-age=0"
          };
          if (path.basename(target) === "service-worker.js") headers["Service-Worker-Allowed"] = "/";
          response.writeHead(200, headers);
          if (request.method === "HEAD") response.end();
          else response.end(content);
        });
      });
    });

    server.once("error", reject);
    server.listen(LOCAL_PORT, "127.0.0.1", () => {
      localServer = server;
      resolve("http://127.0.0.1:" + LOCAL_PORT);
    });
  });
}

async function createWindow() {
  if (!fs.existsSync(path.join(WEB_ROOT, "index.html"))) {
    throw new Error("The application web assets are missing. Rebuild the desktop package.");
  }

  const origin = await createLocalServer();
  splashWindow = new BrowserWindow({
    width: 560,
    height: 420,
    minWidth: 560,
    minHeight: 420,
    maxWidth: 560,
    maxHeight: 420,
    resizable: false,
    frame: false,
    show: false,
    center: true,
    skipTaskbar: true,
    backgroundColor: "#07152f",
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });
  const splashMarkup = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NovaLife</title><style>
    *{box-sizing:border-box}html,body{width:100%;height:100%;margin:0}body{display:grid;place-items:center;overflow:hidden;color:#f5fbff;background:radial-gradient(ellipse at 50% 34%,#0d3b75 0%,#081d40 42%,#07152f 78%);font-family:Segoe UI,system-ui,sans-serif;text-align:center}
    main{display:flex;align-items:center;flex-direction:column;padding:28px}svg{width:100px;height:100px;filter:drop-shadow(0 12px 26px #168bff45);animation:rise .7s ease both}
    h1{margin:20px 0 0;font-size:42px;letter-spacing:-2.8px;line-height:1.05}h1 span{color:#43e2d0}p{margin:12px 0 0;color:#c2d7f4;letter-spacing:2px;font-size:12px}
    .track{width:112px;height:3px;margin-top:31px;border-radius:99px;background:#ffffff20;overflow:hidden}.track i{display:block;width:38%;height:100%;background:linear-gradient(90deg,#2bbdff,#43f0c6);animation:move 1.2s ease-in-out infinite}
    small{position:absolute;bottom:24px;color:#8eaed7;font-size:9px;letter-spacing:3px}small b{color:#43e2d0}
    @keyframes rise{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}@keyframes move{from{transform:translateX(-110%)}to{transform:translateX(300%)}}
    @media(prefers-reduced-motion:reduce){svg,.track i{animation:none}}
    </style></head><body><main>
    <svg viewBox="0 0 512 512" aria-label="NovaLife pictogram"><defs><linearGradient id="r" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#36e5f4"/><stop offset=".55" stop-color="#168bff"/><stop offset="1" stop-color="#9a5cff"/></linearGradient></defs><rect x="22" y="22" width="468" height="468" rx="116" fill="#071a3b" stroke="#2a80d9" stroke-opacity=".55" stroke-width="3"/><path d="M146 358V155L360 359V155" fill="none" stroke="url(#r)" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/><path d="M306 158C310 103 360 72 419 79C416 137 381 177 322 188C315 179 310 169 306 158Z" fill="#43e2d0"/><path d="M321 172L403 96" fill="none" stroke="#073c50" stroke-width="8" stroke-linecap="round"/></svg>
    <h1>Nova<span>Life</span></h1><p>RUIMTE VOOR JOUW DAG</p><div class="track"><i></i></div></main><small>GEZONDER <b>•</b> SIMPEL <b>•</b> SAMEN</small></body></html>`;
  splashWindow.loadURL("data:text/html;charset=UTF-8," + encodeURIComponent(splashMarkup));
  splashWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.show();
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    // Chromium only requests microphone permission when the app invokes the media API.
    callback(permission === "media" || permission === "notifications");
  });

  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 760,
    minHeight: 600,
    show: false,
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    title: "NovaLife",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  window.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    splashWindow = null;
    window.show();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(tel|sms):/i.test(url)) shell.openExternal(url).catch(() => {});
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (url === origin || url.startsWith(origin + "/")) return;
    event.preventDefault();
    if (/^(tel|sms):/i.test(url)) shell.openExternal(url).catch(() => {});
  });

  await window.loadURL(origin);
}

app.whenReady().then(() => createWindow()).catch(error => {
  console.error("NovaLife startup failed:", error);
  app.quit();
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (localServer) localServer.close();
});
