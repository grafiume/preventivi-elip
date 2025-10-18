/*! ui-hard-guard.v2.js
  - Forza header a mostrare SOLO il numero ufficiale del DB (blocca vecchio "ELP-..." client-side)
  - "NUOVO" (anche da Archivio) => reset completo + vai in Editor + header '—'
  - All'avvio/refresh => pagina pulita + header '—'
  - In SALVA (hook) => header = data.numero (server)
  Config (consigliata prima di includere questo file):
    <script>
      window.__EDITOR_PAGE_ID='page-editor';   // ID container editor
      window.__HOME_PAGE_ID='page-home';       // opzionale
    </script>
*/
(function(){
  'use strict';

  // ---------- CONFIG ----------
  function getEditorId(){ return (window.__EDITOR_PAGE_ID && String(window.__EDITOR_PAGE_ID)) || null; }
  function getHomeId(){ return (window.__HOME_PAGE_ID && String(window.__HOME_PAGE_ID)) || null; }

  // ---------- STATE ----------
  var AUTH_VALUE = '—';   // Valore autoritativo dell'header (parte da —)
  var ALLOW_EXTERNAL_HEADER = false; // solo setHeaderNumeroFromServer può cambiare AUTH_VALUE

  // ---------- HEADER SLOT ----------
  function isVisible(el){ return !!(el && el.offsetParent !== null); }
  function ensureHeaderSlot(){
    var slot = document.getElementById('headerNumero');
    if (slot) return slot;
    var title = document.getElementById('editorTitle');
    if (!title){
      var hs = document.querySelectorAll('h1, h2, .page-title');
      for (var i=0;i<hs.length;i++){ if (isVisible(hs[i])){ title = hs[i]; break; } }
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

  function renderHeader(val){
    var slot = ensureHeaderSlot();
    if (!slot) return;
    slot.textContent = val;
  }

  function setHeaderNumeroFromServer(val){
    AUTH_VALUE = (val && String(val).trim()) ? String(val).trim() : '—';
    ALLOW_EXTERNAL_HEADER = true;
    renderHeader(AUTH_VALUE);
    // dopo un tick, blocca di nuovo scritture esterne
    setTimeout(function(){ ALLOW_EXTERNAL_HEADER = false; }, 0);
  }
  window.setHeaderNumeroFromServer = setHeaderNumeroFromServer;

  // ---------- KILL-SWITCH "ELP-..." ----------
  // Osserva qualsiasi tentativo di scrivere "ELP-..." o cambiare header senza passare da setHeaderNumeroFromServer
  function looksLikeOld(el){
    var t = (el.textContent || '').trim();
    return /^ELP-\d{4}-\d+$/i.test(t);
  }
  var headerObserver = new MutationObserver(function(muts){
    muts.forEach(function(m){
      var target = m.target;
      // Se qualcuno tenta di scrivere nell'header (o in un H1/H2) un "ELP-..."
      if (target && (target.id === 'headerNumero' || /^(H1|H2)$/i.test(target.tagName))) {
        if (!ALLOW_EXTERNAL_HEADER) {
          if (looksLikeOld(target) || target.textContent !== AUTH_VALUE) {
            target.textContent = AUTH_VALUE; // ripristina il valore autoritativo
          }
        }
      }
    });
  });
  function armHeaderObserver(){
    var slot = ensureHeaderSlot();
    if (slot) headerObserver.observe(slot, { characterData:true, childList:true, subtree:true });
    // Osserva anche il main H1/H2 corrente per hard-block "ELP-..."
    var h = document.querySelector('h1, h2');
    if (h) headerObserver.observe(h, { characterData:true, childList:true, subtree:true });
  }

  // ---------- RESET UI ----------
  function resetFormCampi(root){
    root = root || document;
    var els = root.querySelectorAll('input, select, textarea');
    els.forEach(function(el){
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
      else el.value = '';
    });
    var flags = root.querySelectorAll('.flag-lavorazione input[type="checkbox"]');
    flags.forEach(function(cb){ cb.checked = false; });
    var statoEl = root.querySelector('#stato'); if (statoEl) statoEl.value = 'In attesa';
    var dataFineEl = root.querySelector('#dataFine'); if (dataFineEl) dataFineEl.value = '';
    var strip = root.querySelector('#thumbStrip'); if (strip) strip.innerHTML = '';
    var prev = root.querySelector('#pdfPreview'); if (prev) prev.innerHTML = '';
    var q = root.querySelector('#q'); if (q) q.value = '';
    var numEl = root.querySelector('#numero'); if (numEl) numEl.value = '';
    var idEl  = root.querySelector('#id');     if (idEl)  idEl.value = '';
    root.querySelectorAll('.is-invalid,.is-valid').forEach(function(el){ el.classList.remove('is-invalid','is-valid'); });
    var avanz = root.querySelector('#badgeAvanzamento'); if (avanz) avanz.textContent = '0%';
    window.__dirty = false;
  }

  // ---------- NAVIGAZIONE ----------
  function showOnly(el){
    if (!el) return false;
    var sections = document.querySelectorAll('[id^="page-"], section[id], main[id]');
    sections.forEach(function(p){ if (p !== el) p.classList.add('d-none'); });
    el.classList.remove('d-none');
    return true;
  }
  function openEditorPage(){
    try{ if (typeof window.openPage === 'function'){ window.openPage('editor'); return true; } }catch(e){}
    var cfg = getEditorId();
    if (cfg){
      var el = document.getElementById(cfg);
      if (el && showOnly(el)) return true;
    }
    // fallback: risali da #cliente/#numero
    var anchor = document.querySelector('#cliente, #numero');
    if (anchor){
      var n = anchor, i=0;
      while(n && i<7){ if (n.id && showOnly(n)) return true; n = n.parentElement; i++; }
    }
    console.warn('[ui-hard-guard] Imposta window.__EDITOR_PAGE_ID (es. "page-editor")');
    return false;
  }

  // ---------- NEW FLOW (hard) ----------
  var __newDebounce = false;
  function startNewHard(){
    if (__newDebounce) return; __newDebounce = true; setTimeout(function(){ __newDebounce=false; }, 300);
    // reset stato create
    window.currentRecordId = null;
    window.__mode = 'create';
    resetFormCampi(document);
    setHeaderNumeroFromServer('—'); // header a trattino autoritativo
    var ok = openEditorPage();
    if (!ok) alert("Imposta window.__EDITOR_PAGE_ID con l'ID del container Editor (es. \"page-editor\").");
    setTimeout(function(){ var c = document.querySelector('#cliente'); if (c) c.focus(); }, 0);
  }

  // ---------- INTERCETTA "NUOVO" OVUNQUE (e blocca altri handler) ----------
  function matchesNew(el){
    if (!el) return false;
    if (el.id === 'btnNuovo' || el.id === 'btnNewFromArchive') return true;
    if (el.matches && el.matches('[data-action="new"],[data-new],[data-btn="nuovo"],.btn-nuovo,.new-record')) return true;
    if (/^\s*nuovo\s*$/i.test(el.textContent || '')) return true;
    return false;
  }
  document.addEventListener('click', function(e){
    var path = e.composedPath ? e.composedPath() : [e.target];
    var btn = null;
    for (var i=0;i<path.length;i++){ var n = path[i]; if (n && n.nodeType===1 && matchesNew(n)){ btn = n; break; } }
    if (btn){
      try{ e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); }catch(err){}
      startNewHard();
    }
  }, true); // capturing

  // ---------- HOOK SALVATAGGIO: imposta header con numero DB ----------
  (function hookSave(){
    if (!window.salvaPreventivo) return;
    var _orig = window.salvaPreventivo;
    window.salvaPreventivo = async function(){
      var res = await _orig.apply(this, arguments);
      try{
        var data = res && res.data ? res.data : (res && res.numero ? res : null);
        var num = data && data.numero;
        if (!num){
          var el = document.getElementById('numero');
          if (el && el.value) num = el.value;
        }
        if (num) setHeaderNumeroFromServer(num);
      }catch(e){}
      return res;
    };
  })();

  // ---------- BOOT: pulizia e armo l'osservatore ----------
  function firstBoot(){
    // pagina pulita
    window.currentRecordId = null;
    window.__mode = 'create';
    resetFormCampi(document);
    setHeaderNumeroFromServer('—');
    var homeId = getHomeId();
    if (homeId){
      var home = document.getElementById(homeId);
      if (home) showOnly(home);
    }
    armHeaderObserver();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', firstBoot);
  else firstBoot();

})();