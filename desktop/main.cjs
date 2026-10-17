const path = require("node:path");
const { relative, resolve, isAbsolute } = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, net, protocol, shell } = require("electron");

protocol.registerSchemesAsPrivileged([{
  scheme: "mivoryntra",
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
}]);

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

function desktopAssetRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "app-web")
    : path.join(__dirname, "app-web");
}

function isInsideRoot(root, target) {
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function createMainWindow() {
  const window = new BrowserWindow({
    title: "Mivoryntra",
    width: 1320,
    height: 900,
    minWidth: 360,
    minHeight: 600,
    backgroundColor: "#0e111c",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("mivoryntra://app/")) event.preventDefault();
  });
  window.once("ready-to-show", () => window.show());
  await window.loadURL("mivoryntra://app/");
  return window;
}

app.whenReady().then(async () => {
  const root = resolve(desktopAssetRoot());
  protocol.handle("mivoryntra", async request => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== "app") return notFound();
      let pathname = decodeURIComponent(url.pathname || "/");
      if (pathname === "/") pathname = "/index.html";
      const target = resolve(root, "." + pathname);
      if (!isInsideRoot(root, target)) return notFound();
      return await net.fetch(pathToFileURL(target).href);
    } catch {
      return notFound();
    }
  });

  await createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
  });
}).catch(error => {
  console.error("Mivoryntra desktop startup failed.", error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
