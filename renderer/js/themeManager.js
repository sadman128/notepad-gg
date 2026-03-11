// themeManager.js
const ThemeManager = (() => {
  let _theme='dark', _warm=0;

  // Customizable vars: normal hex vars + the special rgb triplet for search highlight
  const COLOR_VARS = ['--ed-bg','--ed-fg','--base','--accent','--search-hl-rgb'];

  function applyTheme(t) {
    _theme = t;
    document.documentElement.setAttribute('data-theme', t);
    document.getElementById('theme-tog')?.classList.toggle('on', t==='light');
    Settings.set('theme', t);
    applyCustomColors(Settings.get('customColors') || {});
  }

  function applyWarm(pct) {
    _warm = Math.max(0, Math.min(100, pct));
    const t = _warm/100;
    document.body.style.filter = t===0 ? '' :
      `sepia(${t.toFixed(3)}) hue-rotate(${(t*-24).toFixed(1)}deg) brightness(${(1-t*0.10).toFixed(3)}) saturate(${(1-t*0.15).toFixed(3)})`;
    const sl=_$('sl-warm'), ip=_$('in-warm');
    if(sl) sl.value=_warm; if(ip) ip.value=_warm;
    Settings.set('warmPct', _warm);
  }

  function applyScale(scale) {
    if (!['small','medium','large','blind'].includes(scale)) scale='medium';
    document.documentElement.setAttribute('data-scale', scale);
    document.querySelectorAll('.scale-btn').forEach(b => b.classList.toggle('active', b.dataset.scale===scale));
    Settings.set('uiScale', scale);
  }

  const MONO_FONTS=['DM Mono','JetBrains Mono','Fira Code','Source Code Pro','IBM Plex Mono','Cascadia Code','Space Mono'];
  function applyFont(name) {
    const stack = MONO_FONTS.includes(name) ? `'${name}','Consolas',monospace` : `'${name}',system-ui,sans-serif`;
    document.documentElement.style.setProperty('--font-ed', stack);
    document.querySelectorAll('.font-btn').forEach(b => b.classList.toggle('active', b.dataset.font===name));
    Settings.set('editorFont', name);
  }

  // ── Custom color overrides ────────────────────────────────
  function applyCustomColors(colors) {
    const root = document.documentElement;
    COLOR_VARS.forEach(v => {
      if (colors[v]) root.style.setProperty(v, colors[v]);
      else           root.style.removeProperty(v);
    });
    _refreshColorPickers(colors);
  }

  function setCustomColor(variable, value) {
    const colors = Settings.get('customColors') || {};
    if (value) colors[variable] = value;
    else delete colors[variable];
    Settings.set('customColors', colors);
    applyCustomColors(colors);
  }

  function _refreshColorPickers(colors) {
    COLOR_VARS.forEach(v => {
      const inp = document.querySelector(`.color-pick[data-var="${v}"]`);
      if (!inp) return;
      if (colors[v]) {
        inp.value = _toHex(v === '--search-hl-rgb' ? `rgb(${colors[v]})` : colors[v]);
      } else {
        const computed = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
        inp.value = _toHex(v === '--search-hl-rgb' ? `rgb(${computed})` : computed);
      }
    });
  }

  // Color picker sends #rrggbb — for rgb-triplet vars we convert to "r,g,b"
  function _hexToRgbStr(hex) {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
  }

  function _toHex(color) {
    if (!color) return '#000000';
    if (color.startsWith('#') && color.length===7) return color;
    if (color.startsWith('#') && color.length===4) return '#'+color[1]+color[1]+color[2]+color[2]+color[3]+color[3];
    try {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.fillStyle = color; const c = ctx.fillStyle;
      return c.length===7 ? c : color;
    } catch(e) { return '#000000'; }
  }

  // ── Slider ↔ number input binder ─────────────────────────
  function bindSliderInput(slId, inId, min, max, step, onChange) {
    const sl=_$(slId), ip=_$(inId); if (!sl||!ip) return;
    const clamp=v=>{ v=parseFloat(v); return isNaN(v)?min:Math.max(min,Math.min(max,v)); };
    sl.addEventListener('input', ()=>{ const v=clamp(sl.value); ip.value=v; onChange(v); });
    ip.addEventListener('input', ()=>{ const v=clamp(ip.value); if(!isNaN(parseFloat(ip.value))){sl.value=v;onChange(v);} });
    ip.addEventListener('blur',  ()=>{ const v=clamp(ip.value); sl.value=v; ip.value=v; onChange(v); });
    ip.addEventListener('keydown', e=>{ if(e.key==='Enter') ip.blur(); });
  }

  function _$(id) { return document.getElementById(id); }

  function init() {
    applyTheme(Settings.get('theme'));
    applyWarm(Settings.get('warmPct'));
    applyScale(Settings.get('uiScale'));
    applyFont(Settings.get('editorFont'));
    applyCustomColors(Settings.get('customColors') || {});

    _$('theme-tog')?.addEventListener('click', () => applyTheme(_theme==='dark' ? 'light' : 'dark'));
    bindSliderInput('sl-warm','in-warm',0,100,1, pct => applyWarm(pct));

    document.querySelectorAll('.color-pick').forEach(inp => {
      inp.addEventListener('input', () => {
        const v = inp.dataset.var;
        // For rgb-triplet variables, convert hex → "r,g,b"
        const val = v === '--search-hl-rgb' ? _hexToRgbStr(inp.value) : inp.value;
        setCustomColor(v, val);
      });
    });
    document.querySelectorAll('.color-reset').forEach(btn => {
      btn.addEventListener('click', () => {
        setCustomColor(btn.dataset.var, null);
        _refreshColorPickers(Settings.get('customColors')||{});
      });
    });

    ThemeManager._bindSliderInput = bindSliderInput;
  }

  return { init, applyTheme, applyWarm, applyScale, applyFont,
           applyCustomColors, setCustomColor,
           get theme(){return _theme;}, get warm(){return _warm;},
           _bindSliderInput:null };
})();
