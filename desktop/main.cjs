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
const LOCAL_PORT = 41739;

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
    title: "Project N-01",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  window.once("ready-to-show", () => window.show());
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
  console.error("Project N-01 startup failed:", error);
  app.quit();
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (localServer) localServer.close();
});
