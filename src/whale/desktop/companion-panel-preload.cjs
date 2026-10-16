const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('whalePanel', {
  ready: () => ipcRenderer.send('whale-panel-ready'),
  minimize: () => ipcRenderer.send('whale-panel-minimize'),
});
ipcRenderer.on('whale-panel-open', () => window.dispatchEvent(new Event('whale-open-companion')));
