// app.js — GG Notepad coordinator
document.addEventListener('DOMContentLoaded', async () => {

  // 1. Settings first
  Settings.load();

  // 1b. Logo
  try {
    const dataUrl = await window.api.getLogo();
    if (dataUrl) {
      const img = document.getElementById('tb-logo-img');
      const fb  = document.getElementById('tb-logo-fallback');
      if (img&&fb) { img.src=dataUrl; img.style.display='block'; fb.style.display='none'; }
    }
  } catch(e) {}

  // 2. Init modules
  ThemeManager.init();
  TabManager.init();
  Editor.init();
  ColumnLayout.init();
  Search.init();

  // 3. Font-size slider
  ThemeManager._bindSliderInput('sl-font','in-font',10,28,0.5, px => Editor.setFontSize(px));

  // 4. Window controls
  document.getElementById('wc-min')?.addEventListener('click', () => window.api.minimize());
  document.getElementById('wc-max')?.addEventListener('click', () => window.api.maximize());
  document.getElementById('wc-cls')?.addEventListener('click', () => window.api.closeWin());
  window.api.onWinState(state => {
    const btn = document.getElementById('wc-max'); if (!btn) return;
    if (state==='maximized') {
      btn.innerHTML=`<svg viewBox="0 0 10 10" fill="none"><rect x="3" y="1.5" width="5.5" height="5.5" stroke="currentColor" stroke-width="1.1"/><path d="M1.5 3.5v5h5" stroke="currentColor" stroke-width="1.1" fill="none"/></svg>`;
      btn.title='Restore';
    } else {
      btn.innerHTML=`<svg viewBox="0 0 10 10" fill="none"><rect x="1.5" y="1.5" width="7" height="7" stroke="currentColor" stroke-width="1.1" rx=".5"/></svg>`;
      btn.title='Maximize';
    }
  });

  // 5. Dropdown menu
  const menuBtn  = document.getElementById('btn-menu');
  const dropdown = document.getElementById('dropdown');
  const absorber = document.getElementById('absorber');
  function menuOpen() {
    const h=['titlebar','tabbar','toolbar'].reduce((s,id)=>s+(document.getElementById(id)?.offsetHeight||0),0);
    dropdown.style.top=(h-4)+'px'; dropdown.classList.add('open');
    absorber.classList.add('on'); menuBtn.classList.add('open');
  }
  function menuClose() {
    dropdown.classList.remove('open'); absorber.classList.remove('on'); menuBtn.classList.remove('open');
  }
  menuBtn  ?.addEventListener('click', () => dropdown.classList.contains('open') ? menuClose() : menuOpen());
  absorber ?.addEventListener('click', menuClose);
  document.getElementById('dd-new')   ?.addEventListener('click', () => { menuClose(); TabManager.activate(TabManager.create().id); });
  document.getElementById('dd-open')  ?.addEventListener('click', () => { menuClose(); FileManager.openFile(); });
  document.getElementById('dd-save')  ?.addEventListener('click', () => { menuClose(); FileManager.saveActive(); });
  document.getElementById('dd-saveas')?.addEventListener('click', () => { menuClose(); FileManager.saveTabAs(); });
  document.getElementById('dd-close') ?.addEventListener('click', () => { menuClose(); FileManager.closeTab(); });

  // 6. Scale + font
  document.querySelectorAll('.scale-btn').forEach(btn => btn.addEventListener('click', () => ThemeManager.applyScale(btn.dataset.scale)));
  document.querySelectorAll('.font-btn') .forEach(btn => btn.addEventListener('click', () => ThemeManager.applyFont(btn.dataset.font)));

  // 7. Mode — saves per-tab, not globally
  function switchMode(mode) {
    try {
      Editor.setMode(mode);
      // Save to active tab & persist
      const tab = TabManager.getActive();
      if (tab) { tab.mode = mode; }
      if (mode === 'column') ColumnLayout.render();
      TabManager.syncCursor();  // flush ss/se immediately
    } catch(e) { Editor.setMode('default'); }
  }
  document.getElementById('pill-def')?.addEventListener('click', () => switchMode('default'));
  document.getElementById('pill-col')?.addEventListener('click', () => switchMode('column'));

  // 8. Quick-jump
  document.getElementById('quick-jump')?.addEventListener('click', () => {
    if (Editor.getMode()==='default') Editor.jumpToEnd();
    else { const cc=document.getElementById('col-container'); if(cc) cc.scrollLeft=cc.scrollWidth; }
    document.getElementById('quick-jump')?.classList.remove('visible');
  });
  document.getElementById('editor-ta')?.addEventListener('scroll', () => {
    const ta=document.getElementById('editor-ta'), jb=document.getElementById('quick-jump');
    if (!jb||!ta) return;
    jb.classList.toggle('visible', ta.scrollHeight-ta.scrollTop-ta.clientHeight > 40 && ta.scrollTop > 80);
  });

  // 9. Column wheel
  document.getElementById('col-container')?.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY)>Math.abs(e.deltaX)) { e.preventDefault(); document.getElementById('col-container').scrollLeft+=e.deltaY; }
  },{ passive:false });

  // 10. Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey||e.metaKey;
    if (e.key==='Escape') { menuClose(); if (Search.isOpen) Search.close(); return; }
    if (ctrl && e.key.toLowerCase()==='f') { e.preventDefault(); Search.open(); return; }
    if (!ctrl) return;
    switch(e.key.toLowerCase()) {
      case 't': e.preventDefault(); TabManager.activate(TabManager.create().id); break;
      case 'w': e.preventDefault(); FileManager.closeTab(); break;
      case 'o': e.preventDefault(); FileManager.openFile(); break;
      case 's': e.preventDefault(); e.shiftKey ? FileManager.saveTabAs() : FileManager.saveActive(); break;
      case '1': e.preventDefault(); switchMode('default'); break;
      case '2': e.preventDefault(); switchMode('column'); break;
    }
    if (e.key==='Tab') {
      e.preventDefault();
      const all=TabManager.getAll(), cur=TabManager.getActive();
      if (!all.length||!cur) return;
      const i=all.findIndex(t=>t.id===cur.id);
      TabManager.activate(e.shiftKey ? all[(i-1+all.length)%all.length] : all[(i+1)%all.length]);
    }
    if (e.key==='End') { e.preventDefault(); if (Editor.getMode()==='default') Editor.jumpToEnd(); }
  });

  // 11. GitHub link
  document.getElementById('gh-link')?.addEventListener('click', e => {
    e.preventDefault(); window.api.openExternal('https://github.com/sadman128');
  });

  // 12. App close
  window.api.onClose(() => FileManager.handleAppClose());

  // 12b. Second instance "Open with"
  window.api.onOpenFile(async filePath => {
    const r = await window.api.readFile(filePath);
    if (!r.success) return;
    FileManager._openIntoTab(filePath, r.content);
  });

  // 13. Tab context-menu actions
  document.getElementById('ctx-rename')?.addEventListener('click', async () => {
    const tab = TabManager.getCtxTarget(); TabManager.hideCtxMenu();
    if (!tab) return;
    const res = await Modal.prompt('Rename File', 'New filename', tab.fileName);
    if (!res?.ok || !res.value.trim() || res.value.trim()===tab.fileName) return;
    const newName = res.value.trim();
    if (!tab.filePath) { TabManager.update(tab.id, { fileName:newName }); return; }
    const r = await window.api.renameFile({ oldPath:tab.filePath, newName });
    if (r.success) TabManager.update(tab.id, { fileName:newName, filePath:r.newPath });
    else await Modal.error('Could not rename:\n'+r.error);
  });
  document.getElementById('ctx-copy')?.addEventListener('click', async () => {
    const tab = TabManager.getCtxTarget(); TabManager.hideCtxMenu();
    if (!tab||!tab.filePath) return;
    const r = await window.api.copyFile({ srcPath:tab.filePath, defaultName:tab.fileName });
    if (r&&!r.canceled&&!r.success) await Modal.error('Could not copy:\n'+(r.error||''));
  });
  document.getElementById('ctx-delete')?.addEventListener('click', async () => {
    const tab = TabManager.getCtxTarget(); TabManager.hideCtxMenu();
    if (!tab||!tab.filePath) return;
    const ok = await Modal.confirm('Delete File', `Permanently delete "${tab.fileName}" from disk?`);
    if (!ok) return;
    const r = await window.api.deleteFile(tab.filePath);
    if (r.success) TabManager.update(tab.id, { filePath:null, isDirty:true });
    else await Modal.error('Could not delete:\n'+r.error);
  });
  document.getElementById('ctx-location')?.addEventListener('click', async () => {
    const tab = TabManager.getCtxTarget(); TabManager.hideCtxMenu();
    if (!tab||!tab.filePath) return;
    await window.api.showInFolder(tab.filePath);
  });
  document.getElementById('ctx-close')?.addEventListener('click', () => {
    const tab = TabManager.getCtxTarget(); TabManager.hideCtxMenu();
    if (tab) FileManager.closeTab(tab.id);
  });

  // 14. Restore session FIRST, then open argv file alongside existing tabs
  //     Saving disabled during this block so init never wipes lastFiles.
  await FileManager.restoreSession();
  const argvFile = window.api.getArgvFile();
  if (argvFile) {
    // Check it's not already open from session restore
    const alreadyOpen = TabManager.getAll().some(t => t.filePath === argvFile);
    if (!alreadyOpen) {
      const r = await window.api.readFile(argvFile);
      if (r.success) FileManager._openIntoTab(argvFile, r.content);
    } else {
      // Just switch to it
      const tab = TabManager.getAll().find(t => t.filePath === argvFile);
      if (tab) TabManager.activate(tab.id);
    }
  }
  TabManager.enableSaving();

  // 15. (Mode restore is now per-tab — handled in TabManager.activate())

  // 16. Sync UI controls to saved settings
  const savedScale=Settings.get('uiScale');
  document.querySelectorAll('.scale-btn').forEach(b=>b.classList.toggle('active',b.dataset.scale===savedScale));
  const savedFont=Settings.get('editorFont');
  document.querySelectorAll('.font-btn').forEach(b=>b.classList.toggle('active',b.dataset.font===savedFont));

  // 17. Cursor sync on keyup / click
  const _ta = document.getElementById('editor-ta');
  _ta?.addEventListener('keyup',  () => TabManager.syncCursor());
  _ta?.addEventListener('click',  () => TabManager.syncCursor());

  // 18. RAM / CPU in status bar — poll every 3s (negligible overhead)
  const stRam = document.getElementById('st-ram');
  const stCpu = document.getElementById('st-cpu');
  async function _pollSysStats() {
    try {
      const s = await window.api.getSysStats();
      if (stRam) stRam.textContent = s.ram + 'MB';
      if (stCpu) stCpu.textContent = s.cpu + '%';
    } catch(e) {}
  }
  _pollSysStats();
  setInterval(_pollSysStats, 3000);

  // 19. Focus
  Editor.focus();
});
