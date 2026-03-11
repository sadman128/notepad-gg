// editor.js — Default mode editor
const Editor = (() => {
  const ta     = document.getElementById('editor-ta');
  const gutter = document.getElementById('ln-gutter');
  const stLn   = document.getElementById('st-ln');
  const stCol  = document.getElementById('st-col');
  const stLns  = document.getElementById('st-lines');
  const stChs  = document.getElementById('st-chars');
  const stMode = document.getElementById('st-mode');

  let _mode = 'default';
  let _listeners = [];
  let _lastLineCount = 0;  // optimization: only rebuild gutter when count changes

  function init() {
    ta.addEventListener('input',  _onInput);
    ta.addEventListener('keyup',  _onMove);
    ta.addEventListener('click',  _onMove);
    ta.addEventListener('scroll', () => { gutter.scrollTop = ta.scrollTop; });
    setFontSize(Settings.get('fontSize'));
    _buildGutter();
    _updateStatus();
  }

  function _onInput() {
    const tab = TabManager.getActive();
    if (tab) { tab.content = ta.value; TabManager.markDirty(); }
    _buildGutter();
    _updateStatus();
    _listeners.forEach(fn => fn());
  }

  function _onMove() { _markActiveLine(); _updateStatus(); _checkJumpBtn(); }

  // ── Gutter — only rebuilds spans when line count changes ──
  function _buildGutter() {
    const n = ta.value.split('\n').length;
    if (n === _lastLineCount) { _markActiveLine(); return; }  // fast path
    _lastLineCount = n;
    // Reuse existing spans, only add/remove the delta
    while (gutter.children.length < n) {
      const s = document.createElement('span');
      s.className   = 'gn';
      s.textContent = gutter.children.length + 1;
      gutter.appendChild(s);
    }
    while (gutter.children.length > n) gutter.removeChild(gutter.lastChild);
    _markActiveLine();
  }

  function _markActiveLine() {
    const cur = ta.value.substring(0, ta.selectionStart || 0).split('\n').length;
    Array.from(gutter.children).forEach((el, i) => el.classList.toggle('act', i+1===cur));
  }

  // ── Font size ─────────────────────────────────────────────
  function setFontSize(px) {
    px = parseFloat(px) || 13.5;
    const lh = Math.round(px * 1.65);
    document.documentElement.style.setProperty('--ed-size', px+'px');
    document.documentElement.style.setProperty('--ed-lh',   lh+'px');
    const sl=document.getElementById('sl-font'), ip=document.getElementById('in-font');
    if (sl) sl.value=px; if (ip) ip.value=px;
    Settings.set('fontSize', px);
    requestAnimationFrame(() => {
      _lastLineCount = 0;  // force gutter rebuild after font change
      _buildGutter();
      if (typeof ColumnLayout !== 'undefined') ColumnLayout.onFontChange();
    });
  }

  // ── Status bar ────────────────────────────────────────────
  function _updateStatus() {
    const pos  = ta.selectionStart || 0;
    const text = ta.value;
    const rows = text.substring(0, pos).split('\n');
    if (stLn)  stLn.textContent  = rows.length;
    if (stCol) stCol.textContent = rows[rows.length-1].length + 1;
    if (stLns) stLns.textContent = text.split('\n').length.toLocaleString();
    if (stChs) stChs.textContent = text.length.toLocaleString();
    if (stMode) {
      stMode.textContent = _mode==='column' ? 'Column' : 'Default';
      stMode.className   = 'st-badge' + (_mode==='column' ? ' col' : '');
    }
  }
  function updateStatus() { _updateStatus(); }

  function _checkJumpBtn() {
    const jb    = document.getElementById('quick-jump');
    if (!jb) return;
    const lines = ta.value.split('\n').length;
    const curLn = ta.value.substring(0, ta.selectionStart||0).split('\n').length;
    jb.classList.toggle('visible', lines > 30 && curLn < lines - 5);
  }

  // ── Mode switch ───────────────────────────────────────────
  function setMode(mode, { saveCursor = true } = {}) {
    _mode = mode;
    const dw   = document.getElementById('default-wrap');
    const cc   = document.getElementById('col-container');
    const ctrls= document.getElementById('col-ctrls');

    if (mode === 'column') {
      // Save cursor position of outgoing default view (only on manual switch)
      if (saveCursor) {
        const tab = TabManager.getActive();
        if (tab) { tab.ss=ta.selectionStart; tab.se=ta.selectionEnd; }
      }
      dw.style.display = 'none';
      cc.classList.add('on');
    } else {
      dw.style.display = '';
      cc.classList.remove('on');
      if (saveCursor) {
        requestAnimationFrame(() => {
          const tab = TabManager.getActive();
          if (tab) {
            ta.selectionStart = tab.ss||0;
            ta.selectionEnd   = tab.se||0;
            const lh    = parseFloat(getComputedStyle(ta).lineHeight) || 22;
            const lines = (tab.content||'').substring(0, tab.ss||0).split('\n').length - 1;
            ta.scrollTop = Math.max(0, (lines-5)*lh);
            gutter.scrollTop = ta.scrollTop;
          }
          ta.focus();
        });
      }
    }

    // Save mode to active tab
    if (typeof TabManager !== 'undefined') {
      const tab = TabManager.getActive();
      if (tab) tab.mode = mode;
    }

    document.querySelectorAll('.mpill').forEach(p =>
      p.classList.toggle('active', p.dataset.mode===mode)
    );
    ctrls.classList.toggle('on', mode==='column');
    _updateStatus();
  }

  function jumpToEnd() {
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    ta.scrollTop = ta.scrollHeight;
    _buildGutter();
    _updateStatus();
  }

  function getContent()     { return ta.value; }
  function setContent(text) { ta.value=text; _lastLineCount=0; _buildGutter(); _updateStatus(); _listeners.forEach(fn=>fn()); }
  function onTabSwitch(tab) { ta.value=tab?tab.content:''; _lastLineCount=0; _buildGutter(); _updateStatus(); }
  function focus()          { if (_mode==='default') ta.focus(); }
  function getMode()        { return _mode; }
  function onChange(fn)     { _listeners.push(fn); }

  return {
    init, setFontSize, setMode, getMode, getContent, setContent,
    jumpToEnd, onTabSwitch, focus, onChange, updateStatus,
    get textarea() { return ta; },
  };
})();
