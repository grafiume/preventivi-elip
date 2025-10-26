// intake-edit.js
// Inserisci questo file come PRIMO <script> nello <head> di index.html, PRIMA di qualunque altro JS.
// Scopo: se esiste una richiesta in localStorage, impedisce l'auto-NUOVO e apre il preventivo target.

(function(){
  if (window.__INTAKE_EDIT_INSTALLED__) return;
  window.__INTAKE_EDIT_INSTALLED__ = true;

  function readRequest(){
    try {
      var raw = localStorage.getItem('preventivo.open.request');
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.key) return null;
      // scade dopo 5 minuti
      if (Date.now() - (obj.ts||0) > 5*60*1000) return null;
      return obj;
    } catch(e){ return null; }
  }

  var req = readRequest();
  if (req) {
    // Evita la creazione automatica
    window.__URL_INTENT_HAS_TARGET__ = true;
    // Espone anche in sessionStorage per compat
    sessionStorage.setItem('pv.deep.link.key', req.key);
    sessionStorage.setItem('pv.deep.link.kind', req.kind || 'auto');
  }

  // Piccolo helper per i tuoi punti "Nuovo"
  window.shouldAutoNew = function(){
    return !window.__URL_INTENT_HAS_TARGET__;
  };

  // Quando l'app è pronta, apri il record
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
        // carica record e passa oggetto completo
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

    // Pulisci la richiesta per evitare ri-aperture
    try { localStorage.removeItem('preventivo.open.request'); } catch(e){}

    if (!opened) {
      // come fallback, lascia la chiave globale per altri loader
      window.__PVID_TO_OPEN__ = key;
    }
  }

  // Attendi che supabase sia disponibile o che il DOM sia pronto, poi prova
  (function waitReady(){
    if (!req) return;
    if (window.supabase || typeof window.openPreventivoByIdOrNumero === 'function' || typeof window.__openPreventivo === 'function') {
      openNow();
    } else {
      setTimeout(waitReady, 40);
    }
  })();
})();