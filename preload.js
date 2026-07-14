const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  scanSessions: () => ipcRenderer.invoke('scan-sessions'),
  readSessionFile: (filePath) => ipcRenderer.invoke('read-session-file', filePath),
  saveReceivedSession: (args) => ipcRenderer.invoke('save-received-session', args),
  setPresence: (args) => ipcRenderer.invoke('set-presence', args),
  getDiscoveredDevices: () => ipcRenderer.invoke('get-discovered-devices'),
  getFolderSize: (cwd) => ipcRenderer.invoke('get-folder-size', cwd),
  createProjectArchive: (cwd) => ipcRenderer.invoke('create-project-archive', cwd),
  extractProjectArchive: (args) => ipcRenderer.invoke('extract-project-archive', args),
  chooseProjectFolder: (folderName) => ipcRenderer.invoke('choose-project-folder', folderName),

  downloadUpdate: () => ipcRenderer.invoke('update-download'),
  installUpdateNow: () => ipcRenderer.invoke('update-install-now'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_e, info) => cb(info)),
  onUpdateDownloadProgress: (cb) => ipcRenderer.on('update-download-progress', (_e, percent) => cb(percent)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', () => cb()),
  onUpdateError: (cb) => ipcRenderer.on('update-error', (_e, message) => cb(message)),

  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximizeToggle: () => ipcRenderer.send('window-maximize-toggle'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowMaximizedChanged: (cb) => ipcRenderer.on('window-maximized-changed', (_e, isMax) => cb(isMax)),
});
