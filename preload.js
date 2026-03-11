const { contextBridge, ipcRenderer } = require('electron');

const argvFile = (() => {
  const flag = (process.argv || []).find(a => a.startsWith('--open-file='));
  return flag ? flag.slice('--open-file='.length) : null;
})();

contextBridge.exposeInMainWorld('api', {
  minimize:      ()  => ipcRenderer.invoke('win-min'),
  maximize:      ()  => ipcRenderer.invoke('win-max'),
  closeWin:      ()  => ipcRenderer.invoke('win-close'),
  forceClose:    ()  => ipcRenderer.invoke('win-force'),
  isMaximized:   ()  => ipcRenderer.invoke('win-maximized'),
  openExternal:  (u) => ipcRenderer.invoke('open-external', u),
  getLogo:       ()  => ipcRenderer.invoke('get-logo'),
  getArgvFile:   ()  => argvFile,
  openFile:      ()  => ipcRenderer.invoke('file-open'),
  readFile:      (p) => ipcRenderer.invoke('file-read', p),
  saveFile:      (d) => ipcRenderer.invoke('file-save', d),
  saveFileAs:    (d) => ipcRenderer.invoke('file-save-as', d),
  deleteFile:    (p) => ipcRenderer.invoke('file-delete', p),
  renameFile:    (d) => ipcRenderer.invoke('file-rename', d),
  copyFile:      (d) => ipcRenderer.invoke('file-copy', d),
  showInFolder:  (p) => ipcRenderer.invoke('file-show-in-folder', p),
  fileStat:      (p) => ipcRenderer.invoke('file-stat', p),
  getSysStats:   ()  => ipcRenderer.invoke('get-sys-stats'),
  onClose:       (cb) => ipcRenderer.on('app-close-requested', cb),
  onWinState:    (cb) => ipcRenderer.on('win-state', (_, s) => cb(s)),
  onOpenFile:    (cb) => ipcRenderer.on('open-file-path', (_, p) => cb(p)),
});
