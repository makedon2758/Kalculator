// electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("KC", {
  getVersion: () => ipcRenderer.invoke("kc:getVersion"),
});
