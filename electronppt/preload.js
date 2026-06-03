const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pptApi', {
  pickPptFile: () => ipcRenderer.invoke('pick-ppt-file'),
  importPpt: (pptPath) => ipcRenderer.invoke('import-ppt', pptPath),
  getRecentImports: () => ipcRenderer.invoke('get-recent-imports'),
  openRecentImport: (recentId) => ipcRenderer.invoke('open-recent-import', recentId),
});
