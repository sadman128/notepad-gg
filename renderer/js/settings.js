// settings.js
const Settings = (() => {
  const KEY = 'notepad-gg-v1';
  const DEFAULTS = {
    theme:'dark', warmPct:0, fontSize:13.5, editorFont:'DM Mono',
    colWidth:0, colAutoWidth:true, mode:'default', uiScale:'medium',
    customColors:{},
    lastFiles:[],  // [{path, ss, se}] — no scrollTop, computed from ss
  };
  let _data = {};

  function load() {
    try { _data=JSON.parse(localStorage.getItem(KEY)||'{}'); } catch(_){ _data={}; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(_data)); } catch(_){}
  }
  function get(key) { return _data[key]!==undefined ? _data[key] : DEFAULTS[key]; }
  function set(key,val) { _data[key]=val; save(); }

  // Reads ss/se/mode from tab objects. Never overwrites with empty unless allowEmpty=true.
  function saveOpenFiles(tabs, allowEmpty) {
    const data = tabs.filter(t=>t.filePath).map(t=>({
      path:t.filePath, ss:t.ss||0, se:t.se||0, mode:t.mode||'default',
    }));
    if (data.length===0 && !allowEmpty) return;
    set('lastFiles', data);
  }

  return { load, save, get, set, saveOpenFiles };
})();
