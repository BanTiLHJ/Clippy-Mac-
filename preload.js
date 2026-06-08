const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("clippy", {
  // History
  getHistory: () => ipcRenderer.invoke("get-history"),
  copyToClipboard: (item) => ipcRenderer.invoke("copy-to-clipboard", item),
  togglePin: (id) => ipcRenderer.invoke("toggle-pin", id),
  deleteItem: (id) => ipcRenderer.invoke("delete-item", id),
  clearUnpinned: () => ipcRenderer.invoke("clear-unpinned"),

  // Clipboard events
  onClipboardUpdated: (callback) => {
    ipcRenderer.on("clipboard-updated", (_event, history) => callback(history));
  },
  removeClipboardListener: () => {
    ipcRenderer.removeAllListeners("clipboard-updated");
  },
  // Legacy alias
  removeListener: () => {
    ipcRenderer.removeAllListeners("clipboard-updated");
  },

  // Settings
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (partial) => ipcRenderer.invoke("save-settings", partial),
  onSettingsChanged: (callback) => {
    ipcRenderer.on("settings-changed", (_event, settings) => callback(settings));
  },
  removeSettingsListener: () => {
    ipcRenderer.removeAllListeners("settings-changed");
  },

  // File drop
  addFileItems: (files) => ipcRenderer.invoke("add-file-items", files),
});
