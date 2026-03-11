// tabManager.js  v9
// Tab: { id, fileName, filePath, content, isDirty, ss, se }
// ss/se = selectionStart/End  (scroll computed from ss at restore time)
const TabManager = (() => {
  let tabs = [], activeId = null, uid = 1;
  let _savingEnabled = false;

  const list = document.getElementById('tabs-list');

  // ── Create ────────────────────────────────────────────────
  function create({ fileName='Untitled', filePath=null, content='', mode=null } = {}) {
    // New tabs inherit current editor mode so switching to column and opening new tabs feels natural
    const inheritMode = (mode !== null) ? mode
      : (typeof Editor !== 'undefined' ? Editor.getMode() : 'default');
    const tab = { id:uid++, fileName, filePath, content, isDirty:false, ss:0, se:0, mode:inheritMode };
    tabs.push(tab);
    _renderEl(tab);
    _checkOverflow();
    return tab;
  }

  // ── Activate ──────────────────────────────────────────────
  function activate(idOrTab) {
    const id = (typeof idOrTab === 'object') ? idOrTab.id : idOrTab;

    // Flush outgoing cursor — ONLY after save is enabled (not during restore)
    if (activeId !== null && _savingEnabled) {
      const prev = _byId(activeId);
      if (prev) {
        const ta = document.getElementById('editor-ta');
        if (ta) { prev.content=ta.value; prev.ss=ta.selectionStart; prev.se=ta.selectionEnd; }
      }
    }

    activeId = id;
    const tab = _byId(id);
    if (!tab) return;

    const ta     = document.getElementById('editor-ta');
    const gutter = document.getElementById('ln-gutter');

    // Apply tab's saved mode BEFORE setting content — so the right container is visible
    if (typeof Editor !== 'undefined') {
      const tabMode = tab.mode || 'default';
      // setMode with saveCursor:false — we're loading this tab, not leaving another
      Editor.setMode(tabMode, { saveCursor: false });
    }

    if (ta) {
      ta.value = tab.content;
      // Double rAF: first frame reflows content, second stabilises scrollHeight
      requestAnimationFrame(() => requestAnimationFrame(() => {
        ta.selectionStart = tab.ss;
        ta.selectionEnd   = tab.se;
        // Compute scroll from character offset — font-independent and always exact
        const lh         = parseFloat(getComputedStyle(ta).lineHeight) || 22;
        const lines      = tab.content.substring(0, tab.ss).split('\n').length - 1;
        const scroll     = Math.max(0, (lines - 5) * lh);
        ta.scrollTop     = scroll;
        if (gutter) gutter.scrollTop = scroll;
        if ((tab.mode || 'default') === 'default') ta.focus();
      }));
    }

    list.querySelectorAll('.tab').forEach(el =>
      el.classList.toggle('active', +el.dataset.id === id)
    );
    list.querySelector(`[data-id="${id}"]`)
      ?.scrollIntoView({ block:'nearest', inline:'nearest' });

    _updateTitleBar(tab);
    _updateSaveButtons();
    _saveFiles();

    if (typeof Editor !== 'undefined')      Editor.onTabSwitch(tab);
    if ((tab.mode || 'default') === 'column' && typeof ColumnLayout !== 'undefined') {
      ColumnLayout.scheduleRender('tab-activate');
    }
  }

  // ── Close ─────────────────────────────────────────────────
  async function close(id) {
    const tab = _byId(id);
    if (!tab) return true;
    if (tab.isDirty) {
      const action = await Modal.unsaved(tab.fileName);
      if (!action) return false;
      if (action === 'save') { if (!(await FileManager.saveTab(tab))) return false; }
    }
    const idx = tabs.findIndex(t => t.id === id);
    tabs.splice(idx, 1);
    list.querySelector(`[data-id="${id}"]`)?.remove();
    _checkOverflow();
    activate(tabs.length ? tabs[Math.min(idx, tabs.length-1)].id : create().id);
    Settings.saveOpenFiles(tabs, true);
    return true;
  }

  // ── Update ────────────────────────────────────────────────
  function update(id, patch) {
    const tab = _byId(id);
    if (!tab) return;
    Object.assign(tab, patch);
    const el = list.querySelector(`[data-id="${id}"]`);
    if (el) _updateEl(el, tab);
    if (id === activeId) { _updateTitleBar(tab); _updateSaveButtons(); }
    _saveFiles();
  }

  function syncCursor() {
    const tab = _byId(activeId);
    const ta  = document.getElementById('editor-ta');
    if (!tab || !ta) return;
    tab.ss = ta.selectionStart; tab.se = ta.selectionEnd;
    _saveFiles();
  }

  function enableSaving() { _savingEnabled = true; _saveFiles(); }
  function markDirty()    { const t=getActive(); if(t&&!t.isDirty) update(t.id,{isDirty:true}); }
  function getActive()    { return _byId(activeId); }
  function getAll()       { return tabs; }
  function getActiveId()  { return activeId; }
  function _byId(id)      { return tabs.find(t=>t.id===id)||null; }
  function _saveFiles()   { if (_savingEnabled) Settings.saveOpenFiles(tabs); }

  function _updateSaveButtons() {
    const d = getActive()?.isDirty ?? false;
    document.getElementById('dd-save')  ?.classList.toggle('disabled', !d);
    document.getElementById('dd-saveas')?.classList.toggle('disabled', !d);
  }
  function _updateTitleBar(tab) {
    const el = document.getElementById('tb-filename');
    if (el) el.textContent = tab?.fileName || 'Untitled';
  }

  // ── Overflow arrows ───────────────────────────────────────
  function _checkOverflow() {
    const scroll = document.getElementById('tabs-scroll');
    const lBtn   = document.getElementById('tabs-prev');
    const rBtn   = document.getElementById('tabs-next');
    if (!scroll||!lBtn||!rBtn) return;
    const over = list.scrollWidth > scroll.clientWidth + 2;
    lBtn.style.display = over ? 'flex' : 'none';
    rBtn.style.display = over ? 'flex' : 'none';
  }

  // ── Re-render all tabs (after reorder) ────────────────────
  function _rerenderAll() {
    while (list.firstChild) list.removeChild(list.firstChild);
    tabs.forEach(t => _renderEl(t));
    list.querySelectorAll('.tab').forEach(el =>
      el.classList.toggle('active', +el.dataset.id === activeId)
    );
    _checkOverflow();
  }
  // ── Drag-to-reorder — ghost clone approach ────────────────
  // UX: the grabbed tab lifts up as a floating ghost that follows cursor.
  // The slot (original position) dims to show where it came from.
  // A hairline accent appears between tabs showing the landing position.
  // 8px dead zone prevents accidental reorders on normal clicks.
  let _drag = null;

  function _startDrag(tab, el, startEvent) {
    const tabRect = el.getBoundingClientRect();
    const grabX   = startEvent.clientX - tabRect.left;
    const grabY   = startEvent.clientY - tabRect.top;

    _drag = {
      tabId  : tab.id,
      el,
      startX : startEvent.clientX,
      active : false,
      grabX, grabY,
      clone  : null,
      indicator: null,
    };

    const onMove = (e) => {
      if (!_drag) return;

      if (!_drag.active) {
        if (Math.abs(e.clientX - _drag.startX) < 8) return;
        _drag.active = true;

        // Dim the original tab (slot ghost)
        el.classList.add('dragging');

        // Create floating clone
        const clone = el.cloneNode(true);
        clone.className = 'tab tab-drag-clone';
        clone.style.width  = tabRect.width + 'px';
        clone.style.height = tabRect.height + 'px';
        clone.style.left   = (startEvent.clientX - grabX) + 'px';
        clone.style.top    = (startEvent.clientY - grabY) + 'px';
        document.body.appendChild(clone);
        _drag.clone = clone;

        // Create drop indicator line
        const ind = document.createElement('div');
        ind.className = 'tab-drop-line';
        list.appendChild(ind);
        _drag.indicator = ind;
      }

      // Move clone with cursor
      _drag.clone.style.left = (e.clientX - grabX) + 'px';
      _drag.clone.style.top  = (e.clientY - grabY)  + 'px';

      // Position the drop indicator
      _updateDropPos(e.clientX);
    };

    const onUp = (e) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);

      if (_drag?.active) {
        _drag.clone?.remove();
        _drag.indicator?.remove();
        el.classList.remove('dragging');
        _applyDrop(e.clientX);
      }
      _drag = null;
    };

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseup',   onUp);
  }

  function _updateDropPos(x) {
    if (!_drag?.indicator) return;
    const otherEls = Array.from(list.querySelectorAll('.tab:not(.dragging)'));
    let insertEl = null;  // insert before this; null = append at end
    for (const tabEl of otherEls) {
      const r = tabEl.getBoundingClientRect();
      if (x < r.left + r.width * 0.5) { insertEl = tabEl; break; }
    }

    const listRect = list.getBoundingClientRect();
    let indX;
    if (insertEl) {
      indX = insertEl.getBoundingClientRect().left;
    } else if (otherEls.length) {
      const last = otherEls[otherEls.length - 1].getBoundingClientRect();
      indX = last.right;
    } else {
      indX = listRect.left + 4;
    }
    _drag.indicator.style.left = (indX - listRect.left - 1) + 'px';
  }

  function _applyDrop(x) {
    if (!_drag) return;
    const fromIdx = tabs.findIndex(t => t.id === _drag.tabId);
    if (fromIdx === -1) return;

    const others = Array.from(list.querySelectorAll('.tab:not(.dragging)'));
    let toIdx = tabs.length;
    for (const tabEl of others) {
      const r = tabEl.getBoundingClientRect();
      if (x < r.left + r.width * 0.5) {
        toIdx = tabs.findIndex(t => t.id === +tabEl.dataset.id);
        break;
      }
    }
    // No-op if dropped in same place
    if (toIdx === fromIdx || toIdx === fromIdx + 1) return;

    const [moved] = tabs.splice(fromIdx, 1);
    if (fromIdx < toIdx) toIdx--;
    tabs.splice(toIdx, 0, moved);
    _rerenderAll();
    _saveFiles();
  }


  let _ctxTarget = null;

  function _showCtxMenu(x, y, tab) {
    _ctxTarget = tab;
    const ctx = document.getElementById('tab-ctx');
    if (!ctx) return;

    const hasFile = !!tab.filePath;
    ctx.querySelectorAll('[data-requires-file]').forEach(el =>
      el.classList.toggle('ctx-disabled', !hasFile)
    );

    const fn = ctx.querySelector('#ctx-filename');
    if (fn) { fn.textContent = tab.fileName; fn.title = tab.filePath || ''; }

    const ts = ctx.querySelector('#ctx-timestamp');
    if (ts) {
      ts.textContent = '';
      if (hasFile) {
        window.api.fileStat(tab.filePath).then(stat => {
          if (!stat?.success) return;
          const d   = new Date(stat.mtime);
          const now = Date.now();
          const ago = now - stat.mtime;
          let timeStr;
          if (ago < 60000)       timeStr = 'just now';
          else if (ago < 3600000) timeStr = `${Math.floor(ago/60000)} min ago`;
          else if (ago < 86400000) timeStr = `${Math.floor(ago/3600000)}h ago`;
          else timeStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
          // Only update if this menu is still open for this file
          if (_ctxTarget?.filePath === tab.filePath && ts.isConnected) {
            ts.textContent = `Saved ${timeStr}`;
          }
        }).catch(() => {});
      }
    }

    // Size info
    if (hasFile) {
      window.api.fileStat(tab.filePath).then(stat => {
        const sizeEl = ctx.querySelector('#ctx-filesize');
        if (!sizeEl || !stat?.success || _ctxTarget?.filePath !== tab.filePath) return;
        const kb = (stat.size / 1024).toFixed(1);
        sizeEl.textContent = `${kb} KB`;
      }).catch(() => {});
    } else {
      const sizeEl = ctx.querySelector('#ctx-filesize');
      if (sizeEl) sizeEl.textContent = '';
    }

    ctx.style.visibility = 'hidden';
    ctx.classList.add('open');
    const rect = ctx.getBoundingClientRect();
    ctx.style.left = Math.min(x, window.innerWidth  - rect.width  - 6) + 'px';
    ctx.style.top  = Math.min(y, window.innerHeight - rect.height - 6) + 'px';
    ctx.style.visibility = '';
  }

  function hideCtxMenu() {
    document.getElementById('tab-ctx')?.classList.remove('open');
    _ctxTarget = null;
  }
  function getCtxTarget() { return _ctxTarget; }

  // ── Render one tab element ─────────────────────────────────
  function _renderEl(tab) {
    const el = document.createElement('div');
    el.className  = 'tab';
    el.dataset.id = tab.id;
    el.title      = tab.filePath || tab.fileName;
    el.innerHTML  = `<div class="tab-dot"></div>
      <span class="tab-name">${_esc(tab.fileName)}</span>
      <button class="tab-x" title="Close">
        <svg viewBox="0 0 8 8" fill="none">
          <line x1="1" y1="1" x2="7" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          <line x1="7" y1="1" x2="1" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      </button>`;

    el.addEventListener('click',     e => { if (!e.target.closest('.tab-x')) activate(tab.id); });
    el.querySelector('.tab-x').addEventListener('click', e => { e.stopPropagation(); close(tab.id); });
    el.addEventListener('mousedown', e => {
      if (e.button === 1) { e.preventDefault(); close(tab.id); return; }
      if (e.button === 0 && !e.target.closest('.tab-x')) _startDrag(tab, el, e);
    });
    el.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); _showCtxMenu(e.clientX, e.clientY, tab); });
    list.appendChild(el);
  }

  function _updateEl(el, tab) {
    el.classList.toggle('dirty', tab.isDirty);
    el.querySelector('.tab-name').textContent = tab.fileName;
    el.title = tab.filePath || tab.fileName;
  }
  function _esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    const first = create();
    activate(first.id);
    document.getElementById('btn-newtab')?.addEventListener('click', () => activate(create().id));
    const scroll = document.getElementById('tabs-scroll');
    document.getElementById('tabs-prev')?.addEventListener('click', () => { scroll.scrollLeft -= 160; });
    document.getElementById('tabs-next')?.addEventListener('click', () => { scroll.scrollLeft += 160; });
    new ResizeObserver(_checkOverflow).observe(document.getElementById('tabbar'));
    document.addEventListener('click', e => { if (!e.target.closest('#tab-ctx')) hideCtxMenu(); });
    document.addEventListener('contextmenu', e => { if (!e.target.closest('.tab')&&!e.target.closest('#tab-ctx')) hideCtxMenu(); });
  }

  return {
    init, create, activate, close, update,
    markDirty, getActive, getAll, getActiveId,
    syncCursor, enableSaving, _checkOverflow,
    getCtxTarget, hideCtxMenu,
  };
})();
