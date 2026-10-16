const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('whaleSettings', {
  read: () => ipcRenderer.invoke('whale-mac-settings-read'),
  save: value => ipcRenderer.invoke('whale-mac-settings-save', value)
});
