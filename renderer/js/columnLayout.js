// ─────────────────────────────────────────────────────────────
// columnLayout.js  ·  GG Notepad  v4
//
// DESIGN:
//   • User sets COLUMN WIDTH with a slider only.
//     Column COUNT is auto-calculated: how many columns fit
//     across the editor width.
//
//   • DISTRIBUTION fills columns by VISUAL ROWS (screen lines),
//     NOT by logical line count.
//     - Each logical line occupies ceil(len / charsPerRow) visual rows.
//     - We pack lines into a column until visual rows would overflow.
//     - When overflow would happen we START A NEW COLUMN.
//     - No line is ever dropped. Content keeps going right.
//
//   • LINE NUMBERS reflect the LOGICAL index (same as default mode).
//     A line that wraps to 3 visual rows still shows ONE number.
//     The gutter span for that line is tall enough to match the
//     wrapped .ln div height.
//
//   • WIDTH is "manual" once the user touches the slider.
//     It is ONLY recomputed to auto on: window resize (if still
//     set to auto), colWidth change, or font change.
//     Text edits never reset a manually-set width.
//
//   • Editable: contenteditable divs, each .ln = one logical line.
//     Editing syncs back to the hidden master textarea.
//     Graceful fallback to Default mode on any render error.
// ─────────────────────────────────────────────────────────────
const ColumnLayout = (() => {

  // ── Layout constants ─────────────────────────────────────
  const CONTAINER_H_PAD = 32;   // total horizontal padding of #col-container
  const COL_CONTENT_PAD = 22;   // horizontal padding inside .col-edit
  const COL_DIV_W       = 1;    // border-right on each .col-block
  const EDITOR_V_PAD    = 48;   // top + bottom padding inside editor area
  // DM Mono character width ratio (em units):
  const CHAR_W_RATIO    = 0.601;

  // ── State ────────────────────────────────────────────────
  let _colWidth   = 320;   // px — user slider value
  let _autoWidth  = true;  // true = recompute on resize; false = user-locked

  // Rendered column records (rebuilt each render)
  let _cols = [];  // [{gutter, editable, globalStart}]

  const container  = document.getElementById('col-container');
  const editorArea = document.getElementById('editor-area');

  // ── CSS var helpers ──────────────────────────────────────
  function _lh() {
    return parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--ed-lh')
    ) || 22;
  }
  function _fs() {
    return parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--ed-size')
    ) || 13.5;
  }
  function _gutW() {
    return parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--gutter-w')
    ) || 46;
  }

  // ── Visual rows a single logical line occupies ───────────
  // charsPerRow = how many monospace chars fit in colWidth px
  function _visualRows(text, charsPerRow) {
    if (!text || text.length === 0) return 1;
    return Math.max(1, Math.ceil(text.length / charsPerRow));
  }

  // ── Compute auto column width ────────────────────────────
  // "How wide should each column be so N columns fit?"
  // We don't use this for count; we use it for the default starting width.
  function _autoColWidth() {
    const gutW    = _gutW();
    const colPad  = COL_CONTENT_PAD;
    const areaW   = editorArea.clientWidth - CONTAINER_H_PAD;
    // Start with a width that gives ~3 columns naturally
    return Math.max(160, Math.floor((areaW - 2 * (gutW + colPad + COL_DIV_W)) / 3));
  }

  // ── How many columns fit for a given colWidth ────────────
  function _columnsForWidth(cw) {
    const gutW  = _gutW();
    const unitW = gutW + cw + COL_CONTENT_PAD + COL_DIV_W;
    const areaW = editorArea.clientWidth - CONTAINER_H_PAD;
    return Math.max(1, Math.floor(areaW / unitW));
  }

  // ── Max visual rows per column ───────────────────────────
  function _maxVR() {
    return Math.max(1, Math.floor((editorArea.clientHeight - EDITOR_V_PAD) / _lh()));
  }

  // ── Distribute lines across columns ─────────────────────
  // Returns: [{lines: string[], globalStart: number}, ...]
  // Guarantees: every line appears in exactly one column.
  function _distribute(lines) {
    const lh          = _lh();
    const fs          = _fs();
    const cw          = _colWidth;
    const charsPerRow = Math.max(1, Math.floor(cw / (fs * CHAR_W_RATIO)));
    const maxVR       = _maxVR();

    const columns   = [];
    let colLines    = [];
    let usedVR      = 0;

    for (let i = 0; i < lines.length; i++) {
      const vr = _visualRows(lines[i], charsPerRow);

      // If this line would overflow AND we already have content → new column
      if (usedVR + vr > maxVR && colLines.length > 0) {
        columns.push({ lines: colLines, globalStart: i - colLines.length });
        colLines = [];
        usedVR   = 0;
      }

      colLines.push(lines[i]);
      usedVR += vr;
    }

    // Last partial column (always push, even if empty — so we have at least 1)
    if (colLines.length > 0) {
      columns.push({ lines: colLines, globalStart: lines.length - colLines.length });
    } else if (columns.length === 0) {
      columns.push({ lines: [''], globalStart: 0 });
    }

    return columns;
  }

  // ── Main render ──────────────────────────────────────────
  function render() {
    if (Editor.getMode() !== 'column') return;
    try {
      const text  = Editor.getContent();
      const lines = text.split('\n');

      // Recalc auto width on render if still in auto mode
      if (_autoWidth) {
        _colWidth = _autoColWidth();
        _syncWidthUI(_colWidth);
      }

      const colDefs = _distribute(lines);

      container.innerHTML = '';
      _cols = [];

      colDefs.forEach((def, ci) => {
        const block = _buildBlock(def, ci);
        block.style.animationDelay = `${ci * 16}ms`;
        container.appendChild(block);
      });

      // After paint: sync gutter heights to actual .ln heights
      requestAnimationFrame(_syncAllGutterHeights);

    } catch (err) {
      console.error('[ColumnLayout] render error:', err);
      Editor.setMode('default');
    }
  }

  // ── Build one column block DOM ───────────────────────────
  function _buildBlock(def, colIdx) {
    const block = document.createElement('div');
    block.className = 'col-block';

    const gutter = document.createElement('div');
    gutter.className  = 'col-gutter';
    gutter.style.width = _gutW() + 'px';

    const edit = document.createElement('div');
    edit.className        = 'col-edit';
    edit.contentEditable  = 'true';
    edit.spellcheck       = false;
    edit.style.width      = _colWidth + 'px';
    edit.style.minWidth   = _colWidth + 'px';

    const toRender = def.lines.length > 0 ? def.lines : [''];
    toRender.forEach((lineText, i) => {
      const ln = document.createElement('div');
      ln.className   = 'ln';
      ln.dataset.gln = def.globalStart + i + 1;  // 1-based global line number
      ln.textContent = lineText;
      edit.appendChild(ln);
    });

    _buildGutterSpans(gutter, edit, def.globalStart);
    _bindEvents(edit, gutter, colIdx);

    block.appendChild(gutter);
    block.appendChild(edit);

    _cols.push({ block, gutter, editable: edit, globalStart: def.globalStart });
    return block;
  }

  // ── Build gutter number spans ────────────────────────────
  function _buildGutterSpans(gutter, edit, globalStart) {
    gutter.innerHTML = '';
    const lns = edit.querySelectorAll('.ln');
    lns.forEach((ln, i) => {
      const span = document.createElement('span');
      span.className   = 'col-gn';
      span.textContent = parseInt(ln.dataset.gln) || (globalStart + i + 1);
      // Height will be set by _syncAllGutterHeights after paint
      gutter.appendChild(span);
    });
  }

  // ── Sync every gutter span height to its .ln height ─────
  // Called via requestAnimationFrame after render and after edits.
  // This ensures wrapped lines show the line number at correct height.
  function _syncAllGutterHeights() {
    _cols.forEach(({ gutter, editable }) => {
      const lns   = editable.querySelectorAll('.ln');
      const spans = gutter.querySelectorAll('.col-gn');
      lns.forEach((ln, i) => {
        if (spans[i]) {
          spans[i].style.height     = ln.offsetHeight + 'px';
          spans[i].style.lineHeight = _lh() + 'px';  // number stays at top
        }
      });
    });
  }

  // ── Bind keyboard/input events for one editable ─────────
  function _bindEvents(edit, gutter, colIdx) {
    edit.addEventListener('keydown', e => _keydown(e, edit));
    edit.addEventListener('input',   ()  => {
      _normalize(edit);
      _rebuildGutter(gutter, edit);
      _syncToMaster();
      requestAnimationFrame(_syncAllGutterHeights);
    });
    edit.addEventListener('paste',   e => _paste(e, edit));
    edit.addEventListener('keyup',   _updateStatus);
    edit.addEventListener('click',   _updateStatus);
  }

  // ── Keydown: Enter / Backspace / Delete ──────────────────
  function _keydown(e, edit) {
    if (e.key === 'Enter') {
      e.preventDefault();
      _splitLine(edit);
    } else if (e.key === 'Backspace') {
      const { ln, offset } = _cursorInfo();
      if (ln && offset === 0 && ln.previousElementSibling?.classList.contains('ln')) {
        e.preventDefault();
        _mergePrev(ln, edit);
      }
    } else if (e.key === 'Delete') {
      const { ln, offset } = _cursorInfo();
      if (ln) {
        const next = ln.nextElementSibling;
        if (offset >= ln.textContent.length && next?.classList.contains('ln')) {
          e.preventDefault();
          _mergeNext(ln, next, edit);
        }
      }
    }
  }

  // ── Split at cursor (Enter) ──────────────────────────────
  function _splitLine(edit) {
    const { ln, offset } = _cursorInfo();
    if (!ln) return;
    const before = ln.textContent.slice(0, offset);
    const after  = ln.textContent.slice(offset);
    ln.textContent = before;
    const newLn = document.createElement('div');
    newLn.className = 'ln';
    newLn.textContent = after;
    ln.after(newLn);
    _placeCursor(newLn, 0);
    _normalize(edit);
    _rebuildGutter(ln.closest('.col-block')?.querySelector('.col-gutter'), edit);
    _syncToMaster();
    requestAnimationFrame(_syncAllGutterHeights);
  }

  // ── Merge with previous line (Backspace at start) ────────
  function _mergePrev(ln, edit) {
    const prev   = ln.previousElementSibling;
    const joinAt = prev.textContent.length;
    prev.textContent = prev.textContent + ln.textContent;
    ln.remove();
    _placeCursor(prev, joinAt);
    _rebuildGutter(edit.previousElementSibling, edit);
    _syncToMaster();
    requestAnimationFrame(_syncAllGutterHeights);
  }

  // ── Merge next line into current (Delete at end) ─────────
  function _mergeNext(ln, next, edit) {
    const at = ln.textContent.length;
    ln.textContent = ln.textContent + next.textContent;
    next.remove();
    _placeCursor(ln, at);
    _rebuildGutter(edit.previousElementSibling, edit);
    _syncToMaster();
    requestAnimationFrame(_syncAllGutterHeights);
  }

  // ── Paste ────────────────────────────────────────────────
  function _paste(e, edit) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (!text) return;
    const { ln, offset } = _cursorInfo();
    if (!ln) return;
    const pLines = text.split('\n');
    const before = ln.textContent.slice(0, offset);
    const after  = ln.textContent.slice(offset);
    ln.textContent = before + pLines[0];
    let last = ln;
    for (let i = 1; i < pLines.length; i++) {
      const d = document.createElement('div');
      d.className   = 'ln';
      d.textContent = pLines[i] + (i === pLines.length - 1 ? after : '');
      last.after(d); last = d;
    }
    const endAt = pLines[pLines.length - 1].length + (last === ln ? 0 : 0);
    _placeCursor(last, last.textContent.length - (last === ln ? 0 : after.length));
    _normalize(edit);
    _rebuildGutter(edit.previousElementSibling, edit);
    _syncToMaster();
    requestAnimationFrame(_syncAllGutterHeights);
  }

  // ── Normalize: ensure all children of edit are .ln divs ──
  function _normalize(edit) {
    Array.from(edit.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const d = document.createElement('div');
        d.className = 'ln'; d.textContent = node.textContent;
        edit.insertBefore(d, node); node.remove();
      } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('ln')) {
        const d = document.createElement('div');
        d.className = 'ln'; d.textContent = node.textContent;
        edit.insertBefore(d, node); node.remove();
      }
    });
    if (!edit.querySelector('.ln')) {
      const d = document.createElement('div');
      d.className = 'ln'; edit.appendChild(d);
    }
  }

  // ── Rebuild gutter count after structural change ─────────
  function _rebuildGutter(gutter, edit) {
    if (!gutter) return;
    const lns   = edit.querySelectorAll('.ln');
    const lh    = _lh();
    while (gutter.children.length < lns.length) {
      const s = document.createElement('span');
      s.className = 'col-gn'; s.style.lineHeight = lh + 'px';
      gutter.appendChild(s);
    }
    while (gutter.children.length > lns.length && gutter.children.length > 1) {
      gutter.removeChild(gutter.lastChild);
    }
    // Numbers will be corrected in _renumberAll
  }

  // ── Sync all columns → master textarea ───────────────────
  function _syncToMaster() {
    const allLines = [];
    _cols.forEach(({ editable }) => {
      editable.querySelectorAll('.ln').forEach(ln => allLines.push(ln.textContent));
    });
    const text = allLines.join('\n');
    const ta   = document.getElementById('editor-ta');
    ta.value   = text;
    const tab  = TabManager.getActive();
    if (tab) { tab.content = text; TabManager.markDirty(); }
    _renumberAll();
    _updateStatus();
  }

  // ── Renumber all gutter spans with correct global numbers ─
  function _renumberAll() {
    let n = 1;
    _cols.forEach(({ gutter, editable }) => {
      const lns   = editable.querySelectorAll('.ln');
      const spans = gutter.querySelectorAll('.col-gn');
      lns.forEach((ln, i) => {
        ln.dataset.gln = n;
        if (spans[i]) spans[i].textContent = n;
        n++;
      });
    });
  }

  // ── Update status bar from column cursor ─────────────────
  function _updateStatus() {
    const ta   = document.getElementById('editor-ta');
    const stLs = document.getElementById('st-lines');
    const stCh = document.getElementById('st-chars');
    const stLn = document.getElementById('st-ln');
    const stCl = document.getElementById('st-col');
    if (stLs) stLs.textContent = ta.value.split('\n').length.toLocaleString();
    if (stCh) stCh.textContent = ta.value.length.toLocaleString();
    const sel = window.getSelection();
    if (sel?.rangeCount) {
      const range = sel.getRangeAt(0);
      const ln = _getLn(range.startContainer);
      if (ln) {
        if (stLn) stLn.textContent = parseInt(ln.dataset.gln) || 1;
        if (stCl) stCl.textContent = (range.startOffset || 0) + 1;
      }
    }
  }

  // ── Sync width slider/input to a value ───────────────────
  function _syncWidthUI(w) {
    const sl  = document.getElementById('sl-colw');
    const inp = document.getElementById('in-colw');
    if (sl)  sl.value  = w;
    if (inp) inp.value = w;
  }

  // ── Cursor helpers ────────────────────────────────────────
  function _cursorInfo() {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return { ln: null, offset: 0 };
    const range  = sel.getRangeAt(0);
    const node   = range.startContainer;
    const ln     = _getLn(node);
    const offset = node.nodeType === Node.TEXT_NODE ? range.startOffset : 0;
    return { ln, offset };
  }

  function _getLn(node) {
    if (!node) return null;
    if (node.nodeType === Node.TEXT_NODE) return node.parentElement?.closest('.ln');
    if (node.classList?.contains('ln')) return node;
    return node.closest?.('.ln') || null;
  }

  function _placeCursor(ln, charOffset) {
    const sel   = window.getSelection();
    const range = document.createRange();
    const tn    = ln.firstChild;
    if (tn?.nodeType === Node.TEXT_NODE) {
      range.setStart(tn, Math.min(charOffset, tn.length));
    } else {
      range.setStart(ln, 0);
    }
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // ── Public: set column width (from slider) ────────────────
  function setWidth(w) {
    _colWidth  = Math.max(100, w);
    _autoWidth = false;
    Settings.set('colWidth',    _colWidth);
    Settings.set('colAutoWidth', false);
    const badge = document.getElementById('auto-badge');
    if (badge) badge.classList.remove('on');
    scheduleRender('width');
  }

  // ── Public: reset to auto width ───────────────────────────
  function resetAuto() {
    _autoWidth = true;
    Settings.set('colAutoWidth', true);
    const badge = document.getElementById('auto-badge');
    if (badge) badge.classList.add('on');
    scheduleRender('auto-reset');
  }

  // ── Called by Editor when font size changes ───────────────
  function onFontChange() {
    scheduleRender('font');
  }

  // ── Debounced render ─────────────────────────────────────
  let _rtimer = null;
  function scheduleRender(reason) {
    if (_rtimer) clearTimeout(_rtimer);
    _rtimer = setTimeout(() => { render(); _rtimer = null; }, 30);
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    _autoWidth = Settings.get('colAutoWidth') !== false;
    _colWidth  = Settings.get('colWidth') || 320;

    // If auto, compute initial width after layout settles
    if (_autoWidth) {
      requestAnimationFrame(() => {
        _colWidth = _autoColWidth();
        _syncWidthUI(_colWidth);
      });
    } else {
      _syncWidthUI(_colWidth);
    }

    // Update auto-badge visual state
    const badge = document.getElementById('auto-badge');
    if (badge) badge.classList.toggle('on', _autoWidth);

    // Width slider ↔ number input  (ThemeManager._bindSliderInput available after init)
    ThemeManager._bindSliderInput('sl-colw', 'in-colw', 100, 760, 10, w => setWidth(w));

    // Auto badge click → reset to auto
    badge?.addEventListener('click', resetAuto);

    // Resize observer → rerender (also recomputes auto-width if in auto mode)
    new ResizeObserver(() => scheduleRender('resize')).observe(editorArea);

    // Text changes in default mode → rerender column view
    Editor.onChange(() => {
      if (Editor.getMode() === 'column') scheduleRender('text');
    });
  }

  return { init, render, scheduleRender, onFontChange, resetAuto, setWidth };

})();
