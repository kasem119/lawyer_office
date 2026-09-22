const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  discoverServer: (timeoutMs = 3500) => ipcRenderer.invoke('discover-server', timeoutMs)
});

