// nullnote desktop: runs the built app fully offline on this computer.
// A tiny local server (127.0.0.1 only) serves the files; a fixed port keeps
// the encrypted vault (IndexedDB) at the same address between launches.
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = 47321;
const DIST = path.join(__dirname, "dist");
const CLIENT = path.join(DIST, "client");
let updateStatus = { state: app.isPackaged ? "checking" : "unsupported", currentVersion: app.getVersion() };
const TYPES = { ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png",
  ".ico": "image/x-icon", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2", ".txt": "text/plain" };

async function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
      const file = path.normalize(path.join(CLIENT, decodeURIComponent(url.pathname)));
      if ((file === CLIENT || file.startsWith(CLIENT + path.sep)) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
        return fs.createReadStream(file).pipe(res);
      }
      if (url.pathname !== "/") { res.writeHead(404); return res.end("Not found"); }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      fs.createReadStream(path.join(CLIENT, "client.html")).pipe(res);
    } catch (e) {
      res.writeHead(500); res.end(String(e));
    }
  });
  await new Promise((ok, fail) => server.once("error", fail).listen(PORT, "127.0.0.1", ok));
}

function setUpdateStatus(status) {
  updateStatus = { ...updateStatus, ...status, currentVersion: app.getVersion() };
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("updater:status", updateStatus);
  }
}

function compareVersions(left, right) {
  const parse = (value) => {
    const match = value.match(/^v?(\d+)\.(\d+)\.(\d+)/);
    if (!match) throw new Error(`Unsupported release version: ${value}`);
    return match.slice(1).map(Number);
  };
  const a = parse(left);
  const b = parse(right);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  }
  return 0;
}

async function checkForUpdates() {
  if (!app.isPackaged) {
    setUpdateStatus({ state: "unsupported" });
    return updateStatus;
  }

  setUpdateStatus({ state: "checking", error: undefined });
  try {
    if (process.platform === "darwin") {
      const response = await fetch("https://api.github.com/repos/automataevox/nullnote/releases/latest", {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "nullnote-desktop" },
      });
      if (!response.ok) throw new Error(`GitHub release check failed (${response.status})`);
      const release = await response.json();
      const latestVersion = String(release.tag_name || "").replace(/^v/, "");
      const hasUpdate = compareVersions(latestVersion, app.getVersion()) > 0;
      setUpdateStatus({ state: hasUpdate ? "manual" : "current", latestVersion });
      return updateStatus;
    }

    await autoUpdater.checkForUpdates();
  } catch (error) {
    setUpdateStatus({ state: "error", error: error instanceof Error ? error.message : String(error) });
  }
  return updateStatus;
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.allowPrerelease = /-dev(?:\.|-)/i.test(app.getVersion());
autoUpdater.on("checking-for-update", () => setUpdateStatus({ state: "checking" }));
autoUpdater.on("update-available", (info) => setUpdateStatus({ state: "available", latestVersion: info.version }));
autoUpdater.on("update-not-available", (info) => setUpdateStatus({ state: "current", latestVersion: info.version }));
autoUpdater.on("download-progress", (progress) => setUpdateStatus({ state: "downloading", percent: progress.percent }));
autoUpdater.on("update-downloaded", (info) => setUpdateStatus({ state: "downloaded", latestVersion: info.version }));
autoUpdater.on("error", (error) => setUpdateStatus({ state: "error", error: error.message }));

function assertAppSender(event) {
  const senderUrl = event.senderFrame?.url || "";
  if (!senderUrl.startsWith(`http://127.0.0.1:${PORT}/`)) throw new Error("Untrusted updater request");
}

ipcMain.handle("updater:get-status", (event) => {
  assertAppSender(event);
  return updateStatus;
});
ipcMain.handle("updater:check", (event) => {
  assertAppSender(event);
  return checkForUpdates();
});
ipcMain.handle("updater:download", async (event) => {
  assertAppSender(event);
  if (updateStatus.state === "available") await autoUpdater.downloadUpdate();
  return updateStatus;
});
ipcMain.handle("updater:install", (event) => {
  assertAppSender(event);
  if (updateStatus.state === "downloaded") autoUpdater.quitAndInstall(false, true);
});
ipcMain.handle("updater:open-release", (event) => {
  assertAppSender(event);
  return shell.openExternal("https://github.com/automataevox/nullnote/releases/latest");
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 720, minHeight: 500, title: "nullnote", autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { void shell.openExternal(url); return { action: "deny" }; });
  void win.loadURL(`http://127.0.0.1:${PORT}/`);
}

if (!app.requestSingleInstanceLock()) app.quit();
app.whenReady().then(async () => {
  await startServer();
  createWindow();
  if (app.isPackaged) void checkForUpdates();
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});
app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
