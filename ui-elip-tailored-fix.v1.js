/*! ui-elip-tailored-fix.v1.js
   Compatibile con l'index fornito (tab Bootstrap: #tab-editor / #tab-archivio)
   - Header: crea <span id="headerNumero"> accanto a ".appbar .fw-bold" e mostra SOLO il numero DB
   - Blocca scritture "ELP-..." legacy nell'header
   - NUOVO (#btnNew): reset completo + passa a TAB Editor + header "—"
   - PULISCI (#btnClear): reset completo + header "—"
   - SALVA: intercetta la risposta Supabase (fetch wrapper) e aggiorna header con data.numero
   - Primo ingresso / refresh: stato pulito + header "—"
*/
(function(){
  'use strict';

  // ---------------- UTIL ----------------
  function q(sel, root){ return (root||document).querySelector(sel); }
  function qa(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
  function isVisible(el){ return !!(el && el.offsetParent !== null); }

  // ---------------- HEADER ----------------
  var AUTH_HEADER = '—'; // valore autoritativo
  var allowExternalHeader = false;

  function ensureHeaderSlot(){
    var slot = document.getElementById('headerNumero');
    if (slot) return slot;
    var host = q('.appbar .fw-bold');
    if (!host) return null;
    slot = document.createElement('span');
    slot.id = 'headerNumero';
    slot.style.marginLeft = '8px';
    slot.style.padding = '2px 8px';
    slot.style.borderRadius = '12px';
    slot.style.background = '#efefef';
    slot.style.fontWeight = '600';
    slot.style.fontSize = '0.95em';
    host.appendChild(slot);
    return slot;
  }

  function renderHeader(val){
    var slot = ensureHeaderSlot();
    if (!slot) return;
    slot.textContent = val;
  }

  function setHeaderNumeroFromServer(val){
    AUTH_HEADER = (val && String(val).trim()) ? String(val).trim() : '—';
    allowExternalHeader = true;
    renderHeader(AUTH_HEADER);
    setTimeout(function(){ allowExternalHeader = false; }, 0);
  }
  window.setHeaderNumeroFromServer = setHeaderNumeroFromServer;

  // Kill-switch su header per bloccare "ELP-..." o altri sovrascrittori
  function looksLegacyFormat(t){ return /^ELP-\d{4}-\d+/i.test(String(t||'').trim()); }
  var headerObs = new MutationObserver(function(muts){
    muts.forEach(function(m){
      var t = m.target;
      if (t && t.id === 'headerNumero'){
        if (!allowExternalHeader){
          var cur = t.textContent;
          if (cur !== AUTH_HEADER || looksLegacyFormat(cur)) {
            t.textContent = AUTH_HEADER;
          }
        }
      }
    });
  });
  function armHeaderObserver(){
    var slot = ensureHeaderSlot();
    if (slot) headerObs.observe(slot, { childList:true, characterData:true, subtree:true });
  }

  // ---------------- RESET FORM (solo dentro TAB Editor) ----------------
  function resetEditorForm(){
    var root = q('#tab-editor') || document;
    qa('input, select, textarea', root).forEach(function(el){
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
      else el.value = '';
    });
    // progress bar
    var pb = q('#progressBar'); if (pb){ pb.style.width = '0%'; pb.textContent = '0%'; }
    // immagini
    var imgPrev = q('#imgPreview'); if (imgPrev) imgPrev.innerHTML = '';
    // totali
    var imp = q('#imponibile'); if (imp) imp.textContent = '€ 0,00';
    var iva = q('#iva'); if (iva) iva.textContent = '€ 0,00';
    var tot = q('#totale'); if (tot) tot.textContent = '€ 0,00';
  }

  // ---------------- TAB SWITCH → Editor ----------------
  function goEditorTab(){
    var btn = q('[data-bs-target="#tab-editor"]');
    if (btn) {
      // click nativo: Bootstrap attiva correttamente la tab
      btn.click();
      return true;
    }
    // fallback manuale
    var tab = q('#tab-editor'); var arch = q('#tab-archivio');
    if (tab && arch){
      tab.classList.add('show','active');
      arch.classList.remove('show','active');
      var b1 = qa('[data-bs-target="#tab-editor"]'); b1.forEach(function(b){ b.classList.add('active'); });
      var b2 = qa('[data-bs-target="#tab-archivio"]'); b2.forEach(function(b){ b.classList.remove('active'); });
      return true;
    }
    return false;
  }

  // ---------------- NEW / CLEAR ----------------
  function startNew(){
    // reset stato
    window.currentRecordId = null;
    window.__mode = 'create';
    resetEditorForm();
    setHeaderNumeroFromServer('—');
    goEditorTab();
    setTimeout(function(){ var c = q('#cliente'); if (c) c.focus(); }, 0);
  }

  function wireButtons(){
    var bNew = q('#btnNew'); if (bNew) bNew.addEventListener('click', function(e){ e.preventDefault(); startNew(); });
    var bClear = q('#btnClear'); if (bClear) bClear.addEventListener('click', function(e){ e.preventDefault(); resetEditorForm(); setHeaderNumeroFromServer('—'); });
  }

  // ---------------- FETCH WRAPPER per catturare numero dal DB ----------------
  // intercetta risposte da Supabase REST su /rest/v1/preventivi
  (function wrapFetch(){
    if (!window.fetch) return;
    var _orig = window.fetch;
    window.fetch = function(input, init){
      return _orig(input, init).then(function(resp){
        try {
          var url = (typeof input === 'string') ? input : (input && input.url ? input.url : '');
          var method = (init && init.method) ? String(init.method).toUpperCase() : 'GET';
          if (/\/rest\/v1\/preventivi/i.test(url) && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
            // clona e leggi JSON
            resp.clone().json().then(function(data){
              var rec = null;
              if (data && Array.isArray(data) && data.length > 0) rec = data[0];
              else if (data && typeof data === 'object') rec = data;
              if (rec && rec.numero) setHeaderNumeroFromServer(rec.numero);
            }).catch(function(){ /* ignora parse fallite */ });
          }
        } catch(e){ /* ignora */ }
        return resp;
      });
    };
  })();

  // ---------------- BOOT ----------------
  function boot(){
    ensureHeaderSlot();
    setHeaderNumeroFromServer('—'); // header pulito all'avvio
    armHeaderObserver();
    wireButtons();
    // se la pagina parte in Editor va bene; se preferisci, resta in Editor
    goEditorTab();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();