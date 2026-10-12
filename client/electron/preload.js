const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  showNotification: (payload) => ipcRenderer.invoke('show-notification', { title: payload.title, body: payload.body }),
  discoverServer: (timeoutMs = 3500) => ipcRenderer.invoke('discover-server', timeoutMs)
});

