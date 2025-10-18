/*! header-numero-hook.js — aggancia l'intestazione al numero ufficiale dal DB
    - Mostra sempre il numero "vero" (campo `numero` restituito dal DB) nell'header
    - NUOVO (anche da Archivio): header = '—' e pagina pulita (si appoggia al tuo startNewFlow)
    - Refresh/Home: header = '—'
    - Non richiede modifiche ai tuoi file: basta includerlo in fondo a index.html
*/
(function(){
  'use strict';

  // Crea/recupera lo slot nell'intestazione
  function ensureHeaderNumeroSlot() {
    var slot = document.getElementById('headerNumero');
    if (slot) return slot;

    // Preferisci un titolo noto
    var title = document.getElementById('editorTitle');
    if (!title) {
      // fallback: primo H1/H2 visibile
      var headings = document.querySelectorAll('h1, h2');
      for (var i=0;i<headings.length;i++) {
        var h = headings[i];
        if (h && h.offsetParent !== null) { title = h; break; }
      }
    }
    if (!title) return null;

    slot = document.createElement('span');
    slot.id = 'headerNumero';
    slot.style.marginLeft = '0.5rem';
    slot.style.fontWeight = '600';
    slot.style.padding = '2px 8px';
    slot.style.borderRadius = '12px';
    slot.style.background = '#efefef';
    slot.style.fontSize = '0.95em';
    title.appendChild(slot);
    return slot;
  }

  // Aggiorna il testo nell'intestazione
  function updateHeaderNumero(val) {
    var slot = ensureHeaderNumeroSlot();
    if (!slot) return;
    var txt = (val && String(val).trim()) ? String(val).trim() : '—';
    slot.textContent = txt;
  }
  window.updateHeaderNumero = updateHeaderNumero; // opzionale per usi esterni

  // Sincronizza l’header con l’input #numero (se/quando cambia)
  var __lastNumVal = null;
  function syncFromNumeroField() {
    var numEl = document.getElementById('numero');
    if (!numEl) return;
    var v = (numEl.value || '').trim();
    if (v !== __lastNumVal) {
      __lastNumVal = v;
      updateHeaderNumero(v);
    }
  }

  // Hooka NUOVO (se esiste) per impostare '—'
  (function hookStartNew() {
    if (!window.startNewFlow) return;
    var _orig = window.startNewFlow;
    window.startNewFlow = function(){
      try { updateHeaderNumero('—'); } catch(e){}
      return _orig.apply(this, arguments);
    };
  })();

  // Polling leggero per captare cambiamenti dopo SALVA/caricamenti record
  setInterval(syncFromNumeroField, 300);

  // All'avvio: header a '—'
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ updateHeaderNumero('—'); });
  } else {
    updateHeaderNumero('—');
  }
})();