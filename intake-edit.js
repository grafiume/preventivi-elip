// intake-edit.js
(function(){
  if (window.__INTAKE_EDIT_INSTALLED__) return;
  window.__INTAKE_EDIT_INSTALLED__ = true;

  function readRequest(){
    try {
      var raw = localStorage.getItem('preventivo.open.request');
      if (raw) {
        var obj = JSON.parse(raw);
        if (obj && obj.key && (Date.now() - (obj.ts||0) < 5*60*1000)) return obj;
      }
    } catch(e){}
    try{
      var qs = new URLSearchParams(location.search);
      var key = qs.get('pvid') || qs.get('pvno') || qs.get('id') || qs.get('pv');
      var kind = qs.get('pvid') ? 'pvid' : (qs.get('pvno') ? 'pvno' : 'auto');
      if (!key && location.hash && location.hash.length > 1) {
        var hp = new URLSearchParams(location.hash.slice(1));
        key = hp.get('pvid') || hp.get('pvno');
        kind = hp.get('pvid') ? 'pvid' : (hp.get('pvno') ? 'pvno' : kind);
      }
      if (key) return { key, kind, ts: Date.now() };
    }catch(e){}
    return null;
  }

  var req = readRequest();
  if (req) {
    window.__URL_INTENT_HAS_TARGET__ = true;
    sessionStorage.setItem('pv.deep.link.key', req.key);
    sessionStorage.setItem('pv.deep.link.kind', req.kind || 'auto');
  }

  var _rs = history.replaceState;
  history.replaceState = function(a,b,u){
    try{
      if (typeof u === 'string') {
        var base = location.pathname, keep = location.search + location.hash;
        if (u === base || u === base + '/' || (u.indexOf('?') < 0 && u.indexOf('#') < 0)) u = base + keep;
      }
    }catch(e){}
    return _rs.apply(this, arguments);
  };

  function isUUID(v){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||'')); }

  async function openNow(){
    var req = readRequest();
    if (!req) return;
    var key = req.key;
    var opened = false;

    try {
      if (typeof window.openPreventivoByIdOrNumero === 'function') {
        window.openPreventivoByIdOrNumero(key);
        opened = true;
      } else if (typeof window.__openPreventivo === 'function' && window.supabase) {
        let rec = null;
        try {
          if (isUUID(key)) {
            var r1 = await window.supabase.from('preventivi').select('*').eq('id', key).maybeSingle();
            if (!r1.error && r1.data) rec = r1.data;
          }
          if (!rec) {
            var r2 = await window.supabase.from('preventivi').select('*').eq('numero', key).maybeSingle();
            if (!r2.error && r2.data) rec = r2.data;
          }
        } catch(e){}
        if (rec) {
          window.__openPreventivo(rec);
          opened = true;
        }
      }
    } catch(e){}

    try { localStorage.removeItem('preventivo.open.request'); } catch(e){}
    if (!opened) {
      window.__PVID_TO_OPEN__ = key;
      console.warn('[intake-edit] Nessun hook trovato per aprire il preventivo. Aggiungi openPreventivoByIdOrNumero(key) o __openPreventivo(record).');
    }
  }

  (function waitReady(){
    var req = readRequest();
    if (!req) return;
    if (window.supabase || typeof window.openPreventivoByIdOrNumero === 'function' || typeof window.__openPreventivo === 'function') {
      openNow();
    } else {
      setTimeout(waitReady, 40);
    }
  })();
})();