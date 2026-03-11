// search.js — Find & Replace with highlight overlay
// TYPING → only updates count, NEVER moves cursor.
// Enter / ↑↓ buttons → navigate to matches.
const Search = (() => {
  let _matches = [], _cur = -1, _open = false, _savedSS = 0;

  const $   = id => document.getElementById(id);
  const ta  = () => document.getElementById('editor-ta');
  const hlDiv = () => document.getElementById('search-hl');

  // ── Open ─────────────────────────────────────────────────
  function open() {
    if (Editor.getMode() === 'column') Editor.setMode('default');
    _open    = true;
    _savedSS = ta().selectionStart;

    const sel = ta().value.substring(ta().selectionStart, ta().selectionEnd);
    if (sel && sel.length < 120 && !sel.includes('\n')) $('sp-query').value = sel;
    $('search-panel').classList.add('on');
    $('sp-query').focus();
    $('sp-query').select();
    _scan();
  }

  // ── Close ────────────────────────────────────────────────
  function close() {
    _open = false;
    $('search-panel').classList.remove('on');
    _matches = []; _cur = -1;
    _setCount('');
    _clearHL();
    ta().setSelectionRange(_savedSS, _savedSS);
    ta().focus();
  }

  // ── Options ──────────────────────────────────────────────
  function _opts() {
    return { q:$('sp-query').value, cs:$('sp-case').checked, ww:$('sp-whole').checked, rx:$('sp-regex').checked };
  }
  function _makeRx(o) {
    if (!o.q) return null;
    let pat = o.rx ? o.q : o.q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    if (o.ww) pat = `\\b${pat}\\b`;
    try { return new RegExp(pat, 'g'+(o.cs?'':'i')); } catch(e){ return null; }
  }

  // ── Scan: find all matches, render highlights, update count
  //         — NEVER moves editor cursor ─────────────────────
  function _scan() {
    const o = _opts(), text = ta().value;
    _matches = []; _cur = -1;
    const rx = _makeRx(o);
    if (rx && o.q) {
      let m;
      while ((m = rx.exec(text)) !== null) {
        _matches.push({ s:m.index, e:m.index+m[0].length });
        if (m[0].length===0) rx.lastIndex++;
      }
      if (_matches.length) {
        // Pre-set _cur to nearest so first Enter goes there, but DON'T jump yet
        let nearest = _matches.findIndex(m => m.s >= _savedSS);
        if (nearest === -1) nearest = 0;
        _cur = nearest - 1; // next() increments before using
      }
    }
    _renderHL();
    _setCount();
  }

  // ── Navigate to match (only on explicit user action) ─────
  function _goTo(idx) {
    if (!_matches.length) return;
    _cur = ((idx % _matches.length) + _matches.length) % _matches.length;
    const m = _matches[_cur];
    // Move the editor cursor now (user pressed Enter/arrow)
    ta().focus();
    ta().setSelectionRange(m.s, m.e);
    const lh         = parseFloat(getComputedStyle(ta()).lineHeight) || 22;
    const linesBefore = ta().value.substring(0, m.s).split('\n').length - 1;
    ta().scrollTop   = Math.max(0, (linesBefore - 5) * lh);
    _savedSS = m.s;
    _renderHL();
    _syncHL();
    _setCount();
  }

  function next() { if (!_matches.length) _scan(); _goTo(_cur + 1); }
  function prev() { if (!_matches.length) _scan(); _goTo(_cur - 1); }

  // ── Replace ───────────────────────────────────────────────
  function replaceOne() {
    if (!_matches.length) { _scan(); if (!_matches.length) return; }
    if (_cur < 0) { _goTo(0); return; }
    const m = _matches[_cur], rep = $('sp-replace').value;
    const val = ta().value;
    ta().value = val.slice(0,m.s)+rep+val.slice(m.e);
    ta().dispatchEvent(new Event('input'));
    const np = m.s+rep.length;
    ta().setSelectionRange(np,np); _savedSS = np;
    _scan();
  }
  function replaceAll() {
    const rx = _makeRx(_opts());
    if (!rx || !_matches.length) return;
    const count = _matches.length, rep = $('sp-replace').value;
    ta().value = ta().value.replace(rx, rep);
    ta().dispatchEvent(new Event('input'));
    _scan();
    _setCount(`Replaced ${count}`);
    setTimeout(_setCount, 2200);
  }

  // ── Highlight overlay ─────────────────────────────────────
  // The #search-hl div sits exactly behind the textarea. We write
  // the full text into it with <mark> tags at match positions.
  // The textarea gets background:transparent so marks show through.
  function _esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function _renderHL() {
    const h = hlDiv(); if (!h) return;
    if (!_matches.length || !_opts().q) { _clearHL(); return; }

    ta().classList.add('search-active');
    const text = ta().value;
    let html = '', last = 0;
    _matches.forEach((m, i) => {
      if (m.s > last) html += _esc(text.slice(last, m.s));
      const cls = i === _cur ? 'hl-cur' : '';
      html += `<mark${cls ? ` class="${cls}"` : ''}>${_esc(text.slice(m.s, m.e))}</mark>`;
      last = m.e;
    });
    if (last < text.length) html += _esc(text.slice(last));
    h.innerHTML = html;
    _syncHL();
  }

  function _syncHL() {
    const h = hlDiv(); if (!h || !_open) return;
    h.scrollTop  = ta().scrollTop;
    h.scrollLeft = ta().scrollLeft;
  }

  function _clearHL() {
    const h = hlDiv(); if (!h) return;
    h.innerHTML = '';
    ta().classList.remove('search-active');
  }

  // ── Count label ───────────────────────────────────────────
  function _setCount(msg) {
    const el = $('sp-count'); if (!el) return;
    if (msg !== undefined) { el.textContent=msg; el.dataset.state='info'; return; }
    const q = _opts().q;
    if (!q)               { el.textContent='';           el.dataset.state=''; }
    else if (!_matches.length) { el.textContent='No results'; el.dataset.state='none'; }
    else {
      el.textContent = (_cur>=0) ? `${_cur+1} / ${_matches.length}` : `${_matches.length}`;
      el.dataset.state = 'found';
    }
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    // Debounce typing: run _scan after 80ms idle so fast typing doesn't
    // cause a re-render on every single keystroke
    let _scanTimer = null;
    const _debounceScan = () => { clearTimeout(_scanTimer); _scanTimer = setTimeout(_scan, 80); };

    $('sp-query') ?.addEventListener('input', _debounceScan);
    $('sp-query') ?.addEventListener('keydown', e => {
      if (e.key==='Enter')  { e.preventDefault(); e.shiftKey ? prev() : next(); }
      if (e.key==='Escape') { e.preventDefault(); close(); }
    });
    $('sp-replace')?.addEventListener('keydown', e => {
      if (e.key==='Enter')  { e.preventDefault(); replaceOne(); }
      if (e.key==='Escape') { e.preventDefault(); close(); }
    });
    $('sp-close')  ?.addEventListener('click', close);
    $('sp-prev')   ?.addEventListener('click', prev);
    $('sp-next')   ?.addEventListener('click', next);
    $('sp-rep-one')?.addEventListener('click', replaceOne);
    $('sp-rep-all')?.addEventListener('click', replaceAll);
    $('sp-case')   ?.addEventListener('change', _scan);
    $('sp-whole')  ?.addEventListener('change', _scan);
    $('sp-regex')  ?.addEventListener('change', _scan);

    // Keep highlight overlay synced to textarea scroll
    document.getElementById('editor-ta')?.addEventListener('scroll', _syncHL);
  }

  return { init, open, close, get isOpen() { return _open; } };
})();
