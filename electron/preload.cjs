const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nullnoteUpdater", {
  getStatus: () => ipcRenderer.invoke("updater:get-status"),
  check: () => ipcRenderer.invoke("updater:check"),
  download: () => ipcRenderer.invoke("updater:download"),
  install: () => ipcRenderer.invoke("updater:install"),
  openRelease: () => ipcRenderer.invoke("updater:open-release"),
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("updater:status", listener);
    return () => ipcRenderer.removeListener("updater:status", listener);
  },
});