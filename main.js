const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs   = require('fs');

let win, forceQuit = false;

const LOGO_PATH = path.join(__dirname, 'assets', 'logo.png');
let logoDataUrl = null;
if (fs.existsSync(LOGO_PATH)) {
  try { logoDataUrl = 'data:image/png;base64,' + fs.readFileSync(LOGO_PATH).toString('base64'); } catch(e){}
}

function getArgvFile() {
  const args = process.argv.slice(app.isPackaged ? 1 : 2);
  return args.find(a => !a.startsWith('-') && a !== '.' && fs.existsSync(a)) || null;
}

function createWindow() {
  win = new BrowserWindow({
    width:1400, height:880, minWidth:760, minHeight:520,
    frame:false, backgroundColor:'#080808', show:false,
    icon: fs.existsSync(LOGO_PATH) ? LOGO_PATH : undefined,
    webPreferences:{
      preload: path.join(__dirname,'preload.js'),
      contextIsolation:true, nodeIntegration:false,
      additionalArguments: getArgvFile() ? [`--open-file=${getArgvFile()}`] : [],
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname,'renderer','index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('close', e => { if (forceQuit) return; e.preventDefault(); win.webContents.send('app-close-requested'); });
  win.on('maximize',   () => win.webContents.send('win-state','maximized'));
  win.on('unmaximize', () => win.webContents.send('win-state','normal'));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', (_, argv) => {
    const args = argv.slice(app.isPackaged ? 1 : 2);
    const file = args.find(a => !a.startsWith('-') && a !== '.' && fs.existsSync(a));
    if (file && win) win.webContents.send('open-file-path', file);
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}

// ── Window ───────────────────────────────────────────────────
ipcMain.handle('win-min',       () => win.minimize());
ipcMain.handle('win-max',       () => win.isMaximized() ? win.unmaximize() : win.maximize());
ipcMain.handle('win-close',     () => win.close());
ipcMain.handle('win-force',     () => { forceQuit=true; win.close(); });
ipcMain.handle('win-maximized', () => win.isMaximized());
ipcMain.handle('open-external', (_, url) => shell.openExternal(url));
ipcMain.handle('get-logo',      () => logoDataUrl);
ipcMain.handle('get-argv-file', () => getArgvFile());

// ── File I/O ─────────────────────────────────────────────────
ipcMain.handle('file-open', async () => {
  const r = await dialog.showOpenDialog(win, {
    title:'Open File', properties:['openFile'],
    filters:[
      { name:'Text',extensions:['txt','md','markdown','log','csv','ini','cfg','env','text'] },
      { name:'Code',extensions:['js','ts','jsx','tsx','html','css','json','xml','py','java','c','cpp','go','rs','sh'] },
      { name:'All Files',extensions:['*'] },
    ],
  });
  if (r.canceled || !r.filePaths.length) return null;
  try { return { success:true, filePath:r.filePaths[0], content:fs.readFileSync(r.filePaths[0],'utf-8') }; }
  catch(e) { return { success:false, error:e.message }; }
});

ipcMain.handle('file-read', (_, p) => {
  try { return { success:true, content:fs.readFileSync(p,'utf-8') }; }
  catch(e) { return { success:false, error:e.message }; }
});

ipcMain.handle('file-save', (_, { filePath, content }) => {
  try { fs.writeFileSync(filePath, content,'utf-8'); return { success:true }; }
  catch(e) { return { success:false, error:e.message }; }
});

ipcMain.handle('file-save-as', async (_, { content, defaultName }) => {
  const r = await dialog.showSaveDialog(win, {
    title:'Save As', defaultPath:defaultName||'untitled.txt',
    filters:[{name:'Text',extensions:['txt']},{name:'Markdown',extensions:['md']},{name:'All Files',extensions:['*']}],
  });
  if (r.canceled) return { canceled:true };
  try { fs.writeFileSync(r.filePath, content,'utf-8'); return { success:true, filePath:r.filePath }; }
  catch(e) { return { success:false, error:e.message }; }
});

ipcMain.handle('file-delete', (_, p) => {
  try { fs.unlinkSync(p); return { success:true }; } catch(e) { return { success:false, error:e.message }; }
});

ipcMain.handle('file-rename', (_, { oldPath, newName }) => {
  try {
    const newPath = path.join(path.dirname(oldPath), newName);
    fs.renameSync(oldPath, newPath);
    return { success:true, newPath };
  } catch(e) { return { success:false, error:e.message }; }
});

ipcMain.handle('file-copy', async (_, { srcPath, defaultName }) => {
  const r = await dialog.showSaveDialog(win, {
    title:'Copy File As', defaultPath:defaultName,
    filters:[{name:'All Files',extensions:['*']}],
  });
  if (r.canceled) return { canceled:true };
  try { fs.copyFileSync(srcPath, r.filePath); return { success:true }; }
  catch(e) { return { success:false, error:e.message }; }
});

ipcMain.handle('file-show-in-folder', (_, p) => shell.showItemInFolder(p));

// ── File stat (for context menu "last modified") ──────────────
ipcMain.handle('file-stat', (_, p) => {
  try {
    const st = fs.statSync(p);
    return { success:true, mtime:st.mtime.getTime(), size:st.size };
  } catch(e) { return { success:false }; }
});

// ── System stats (CPU + RAM) — polled every ~3s ───────────────
// getCPUUsage() returns percentCPUUsage since the last call to this handler.
ipcMain.handle('get-sys-stats', () => {
  const mem = process.memoryUsage();
  const cpu = process.getCPUUsage();
  return {
    ram: Math.round(mem.rss / 1048576),          // MB
    cpu: Math.round(cpu.percentCPUUsage * 10) / 10,  // %
  };
});
