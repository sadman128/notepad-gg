// fileManager.js
const FileManager = (() => {
  function _base(p) { return p ? p.split(/[\\/]/).pop() : 'Untitled'; }

  async function openFile() {
    const r = await window.api.openFile();
    if (!r || !r.success) return;
    _openIntoTab(r.filePath, r.content);
  }

  async function saveActive() {
    const tab = TabManager.getActive();
    if (!tab || !tab.isDirty) return false;
    return saveTab(tab);
  }

  async function saveTab(tab) {
    if (!tab) return false;
    if (!tab.filePath) return saveTabAs(tab);
    if (Editor.getMode() === 'default') tab.content = Editor.getContent();
    const r = await window.api.saveFile({ filePath:tab.filePath, content:tab.content });
    if (r.success) { TabManager.update(tab.id, { isDirty:false }); return true; }
    await Modal.error(`Could not save:\n${r.error}`);
    return false;
  }

  async function saveTabAs(tab) {
    if (!tab) tab = TabManager.getActive();
    if (!tab) return false;
    if (Editor.getMode() === 'default') tab.content = Editor.getContent();
    const r = await window.api.saveFileAs({ content:tab.content, defaultName:tab.fileName });
    if (!r || r.canceled) return false;
    if (r.success) {
      TabManager.update(tab.id, { fileName:_base(r.filePath), filePath:r.filePath, isDirty:false });
      return true;
    }
    await Modal.error(`Could not save:\n${r.error}`);
    return false;
  }

  async function closeTab(id) {
    const tabId = id ?? TabManager.getActive()?.id;
    if (tabId != null) await TabManager.close(tabId);
  }

  async function handleAppClose() {
    TabManager.syncCursor();
    const dirty = TabManager.getAll().filter(t => t.isDirty);
    if (!dirty.length) { window.api.forceClose(); return; }
    for (const tab of dirty) {
      TabManager.activate(tab.id);
      const action = await Modal.unsaved(tab.fileName);
      if (!action) return;
      if (action === 'save') {
        if (Editor.getMode() === 'default') tab.content = Editor.getContent();
        if (!(await saveTab(tab))) return;
      }
    }
    window.api.forceClose();
  }

  // ── Restore last session ───────────────────────────────────
  // Called BEFORE enableSaving() so init can never wipe lastFiles.
  async function restoreSession() {
    const lastFiles = Settings.get('lastFiles');
    if (!lastFiles || !lastFiles.length) return false;

    let restored = 0, removedBlank = false;

    for (const f of lastFiles) {
      if (!f.path) continue;
      const r = await window.api.readFile(f.path);
      if (!r.success) continue;

      if (!removedBlank) {
        const blank = TabManager.getAll().find(t => !t.filePath && !t.isDirty && t.content === '');
        if (blank) {
          // Remove without calling close() (which prompts) — it's pristine
          const tabs = TabManager.getAll();
          const idx  = tabs.findIndex(t => t.id === blank.id);
          if (idx !== -1) tabs.splice(idx, 1);
          document.querySelector(`[data-id="${blank.id}"]`)?.remove();
        }
        removedBlank = true;
      }

      const nt = TabManager.create({ fileName:_base(f.path), filePath:f.path, content:r.content, mode: f.mode || 'default' });
      // ss/se go straight into the tab object — activate() reads them
      nt.ss = f.ss || 0;
      nt.se = f.se || 0;
      nt.mode = f.mode || 'default';
      TabManager.activate(nt.id);
      restored++;
    }
    return restored > 0;
  }

  // ── Open path directly (argv / "Open with" / second instance) ─
  function _openIntoTab(filePath, content) {
    const tab = TabManager.getActive();
    if (tab && !tab.isDirty && !tab.filePath && tab.content === '') {
      TabManager.update(tab.id, { fileName:_base(filePath), filePath, content, isDirty:false });
      Editor.setContent(content);
      TabManager.activate(tab.id);
    } else {
      const nt = TabManager.create({ fileName:_base(filePath), filePath, content });
      TabManager.activate(nt.id);
    }
  }

  return { openFile, saveActive, saveTab, saveTabAs, closeTab, handleAppClose, restoreSession, _openIntoTab };
})();
