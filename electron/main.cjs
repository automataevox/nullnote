// nullnote desktop: runs the built app fully offline on this computer.
// A tiny local server (127.0.0.1 only) serves the files; a fixed port keeps
// the encrypted vault (IndexedDB) at the same address between launches.
const { app, BrowserWindow, shell } = require("electron");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = 47321;
const DIST = path.join(__dirname, "dist");
const CLIENT = path.join(DIST, "client");
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 720, minHeight: 500, title: "nullnote", autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { void shell.openExternal(url); return { action: "deny" }; });
  void win.loadURL(`http://127.0.0.1:${PORT}/`);
}

if (!app.requestSingleInstanceLock()) app.quit();
app.whenReady().then(async () => {
  await startServer();
  createWindow();
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});
app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
