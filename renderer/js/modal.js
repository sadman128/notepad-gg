// modal.js — Custom modal dialogs
const Modal = (() => {
  const overlay = document.getElementById('modal-overlay');
  const titleEl = document.getElementById('modal-title');
  const msgEl   = document.getElementById('modal-msg');
  const btnsEl  = document.getElementById('modal-btns');
  let _resolve  = null;

  function close(val) {
    overlay.classList.remove('on');
    if (_resolve) { _resolve(val); _resolve = null; }
  }
  overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('on')) close(null);
  });

  function show({ title, message, buttons, input }) {
    return new Promise(resolve => {
      _resolve = resolve;
      titleEl.textContent = title || '';

      if (input) {
        // Prompt mode — show an <input> instead of message text
        msgEl.innerHTML = '';
        const inp = document.createElement('input');
        inp.type = 'text'; inp.value = input.value || '';
        inp.placeholder = input.placeholder || '';
        inp.style.cssText = [
          'width:100%','padding:8px 10px','border-radius:5px',
          'border:1px solid var(--b3)','background:var(--s2)',
          'color:var(--t1)','font-family:var(--font-ed)','font-size:13px',
          'outline:none','margin-top:4px',
        ].join(';');
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); close({ ok:true, value:inp.value }); }
          if (e.key === 'Escape') { e.preventDefault(); close(null); }
        });
        msgEl.appendChild(inp);
        requestAnimationFrame(() => { inp.select(); inp.focus(); });
      } else {
        msgEl.textContent = message || '';
      }

      btnsEl.innerHTML = '';
      (buttons || [{ label:'OK', value:0, variant:'primary' }]).forEach(btn => {
        const el = document.createElement('button');
        el.className = 'modal-btn' + (btn.variant ? ' '+btn.variant : '');
        el.textContent = btn.label;
        el.addEventListener('click', () => {
          if (input) {
            const inp = msgEl.querySelector('input');
            close(btn.value === null ? null : { ok:btn.value, value:inp?.value||'' });
          } else {
            close(btn.value);
          }
        });
        btnsEl.appendChild(el);
      });
      overlay.classList.add('on');
      if (!input) requestAnimationFrame(() => {
        const first = btnsEl.querySelector('.modal-btn.primary') || btnsEl.querySelector('.modal-btn');
        first?.focus();
      });
    });
  }

  async function unsaved(fileName) {
    return show({
      title:'Unsaved Changes',
      message:`"${fileName||'Untitled'}" has unsaved changes. Save before closing?`,
      buttons:[
        { label:'Cancel',    value:null,      variant:'' },
        { label:"Don't Save",value:'discard', variant:'danger' },
        { label:'Save',      value:'save',    variant:'primary' },
      ],
    });
  }
  async function error(message)        { return show({ title:'Error', message, buttons:[{label:'OK',value:0,variant:'primary'}] }); }
  async function info(title, message)  { return show({ title, message, buttons:[{label:'OK',value:0,variant:'primary'}] }); }
  async function confirm(title, message) {
    return show({ title, message, buttons:[
      { label:'Cancel', value:false, variant:'' },
      { label:'OK',     value:true,  variant:'primary' },
    ]});
  }
  // prompt: returns { ok:true, value:'...' } or null on cancel
  async function prompt(title, placeholder, defaultValue) {
    return show({ title,
      input:{ placeholder, value:defaultValue||'' },
      buttons:[
        { label:'Cancel', value:null,    variant:'' },
        { label:'OK',     value:true,    variant:'primary' },
      ],
    });
  }

  return { show, unsaved, error, info, confirm, prompt };
})();
