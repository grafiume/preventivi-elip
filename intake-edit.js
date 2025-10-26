// intake-edit.js
// Inserisci questo file come PRIMO <script> nello <head> di preventivi-elip/index.html.
//
// Effetto: se troviamo una richiesta in localStorage (impostata da open-edit.html),
// blocchiamo l'auto-NUOVO e apriamo direttamente il preventivo (per id o per numero).

(function(){
  if (window.__INTAKE_EDIT_INSTALLED__) return;
  window.__INTAKE_EDIT_INSTALLED__ = true;

  function readRequest(){
    try {
      var raw = localStorage.getItem('preventivo.open.request');
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.key) return null;
      if (Date.now() - (obj.ts||0) > 5*60*1000) return null; // 5 minuti
      return obj;
    } catch(e){ return null; }
  }

  var req = readRequest();
  if (req) {
    // Evita la creazione automatica
    window.__URL_INTENT_HAS_TARGET__ = true;
    // Espone anche in sessionStorage per compatibilità
    sessionStorage.setItem('pv.deep.link.key', req.key);
    sessionStorage.setItem('pv.deep.link.kind', req.kind || 'auto');
  }

  function isUUID(v){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||'')); }

  async function openNow(){
    if (!req) return;
    var key = req.key;
    var opened = false;

    try {
      if (typeof window.openPreventivoByIdOrNumero === 'function') {
        window.openPreventivoByIdOrNumero(key);
        opened = true;
      } else if (typeof window.__openPreventivo === 'function' && window.supabase) {
        let rec = null;
        if (isUUID(key)) {
          var r1 = await window.supabase.from('preventivi').select('*').eq('id', key).maybeSingle();
          if (!r1.error && r1.data) rec = r1.data;
        }
        if (!rec) {
          var r2 = await window.supabase.from('preventivi').select('*').eq('numero', key).maybeSingle();
          if (!r2.error && r2.data) rec = r2.data;
        }
        if (rec) {
          window.__openPreventivo(rec);
          opened = true;
        }
      }
    } catch(e){ /* ignore */ }

    try { localStorage.removeItem('preventivo.open.request'); } catch(e){}
    if (!opened) {
      window.__PVID_TO_OPEN__ = key; // fallback per loader custom
    }
  }

  (function waitReady(){
    if (!req) return;
    if (window.supabase || typeof window.openPreventivoByIdOrNumero === 'function' || typeof window.__openPreventivo === 'function') {
      openNow();
    } else {
      setTimeout(waitReady, 40);
    }
  })();
})();