/*! new-flow.v1.5.2.js — "Nuovo" → Editor + INSERT garantito + reset all'avvio
    Fix: niente apostrofi non-escapati nelle stringhe (errore "missing ) after argument list")
*/
(function () {
  'use strict';

  // ---------- CONFIG GETTERS ----------
  function getEditorId()  { return (window.__EDITOR_PAGE_ID  && String(window.__EDITOR_PAGE_ID))  || null; }
  function getHomeId()    { return (window.__HOME_PAGE_ID    && String(window.__HOME_PAGE_ID))    || null; }

  // ---------- BLOCK ONLY BAD RPC (not inserts) ----------
  window.__allowNumberRpc = false;
  try {
    if (window.supabase && typeof window.supabase.rpc === 'function') {
      var _origRpc = window.supabase.rpc.bind(window.supabase);
      window.supabase.rpc = function(name, params, opts) {
        if (String(name || '').toLowerCase() === 'rpc_next_preventivo' && !window.__allowNumberRpc) {
          console.warn('[guard] rpc_next_preventivo BLOCCATA');
          return Promise.resolve({ data: null, error: { message: 'blocked rpc_next_preventivo by guard (v1.5.2)' } });
        }
        return _origRpc(name, params, opts);
      };
    }
  } catch (e) { console.warn('[rpc guard]', e); }

  // ---------- RESET FORM/UI ----------
  function resetFormCampi(root) {
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
    window.__imgBuffer = [];

    var prev = root.querySelector('#pdfPreview'); if (prev) prev.innerHTML = '';

    var q = root.querySelector('#q'); if (q) q.value = '';

    var numEl = root.querySelector('#numero'); if (numEl) numEl.value = '';
    var idEl  = root.querySelector('#id');     if (idEl)  idEl.value = '';

    root.querySelectorAll('.is-invalid,.is-valid').forEach(function(el){ el.classList.remove('is-invalid','is-valid'); });

    var avanz = root.querySelector('#badgeAvanzamento'); if (avanz) avanz.textContent = '0%';

    window.__dirty = false;
  }
  window.resetFormCampi = resetFormCampi;

  // ---------- SHOW ONLY A PAGE CONTAINER ----------
  function showOnly(elToShow) {
    if (!elToShow) return false;
    var pages = document.querySelectorAll('[id^="page-"], section[id], main[id]');
    pages.forEach(function(p){ if (p !== elToShow) p.classList.add('d-none'); });
    elToShow.classList.remove('d-none');
    return true;
  }

  // ---------- OPEN EDITOR PAGE ----------
  function openEditorPage() {
    try {
      if (typeof window.openPage === 'function') {
        window.openPage('editor');
        return true;
      }
    } catch (e) {}
    var cfg = getEditorId();
    if (cfg) {
      var el = document.getElementById(cfg);
      if (el && showOnly(el)) return true;
    }
    var anchor = document.querySelector('#cliente, #numero');
    if (anchor) {
      var n = anchor; var i=0;
      while (n && i<7) { if (n.id && showOnly(n)) return true; n = n.parentElement; i++; }
    }
    console.warn('[v1.5.2] Imposta window.__EDITOR_PAGE_ID (es. "page-editor")');
    return false;
  }

  // ---------- NEW FLOW ----------
  var __newDebounce = false;
  function startNewFlow() {
    if (__newDebounce) return;
    __newDebounce = true; setTimeout(function(){ __newDebounce = false; }, 350);

    if (window.__dirty === true) {
      var go = confirm('Ci sono modifiche non salvate. Creare una nuova scheda vuota?');
      if (!go) return;
    }

    window.currentRecordId = null;
    window.__mode = 'create';
    resetFormCampi();

    var head = document.querySelector('#editorTitle'); if (head) head.textContent = 'Nuovo preventivo';

    var ok = openEditorPage();
    if (!ok) alert("Imposta window.__EDITOR_PAGE_ID con l'ID del container Editor (es. \"page-editor\").");

    setTimeout(function(){ var c = document.querySelector('#cliente'); if (c) c.focus(); }, 0);
  }
  window.startNewFlow = startNewFlow;

  // ---------- SAVE (INSERT in create) ----------
  var __saving = false;
  async function salvaPreventivo() {
    if (__saving) return; __saving = true;
    try {
      if (typeof window.raccogliDatiEditor !== 'function') throw new Error('Funzione raccogliDatiEditor() mancante');
      var payload = window.raccogliDatiEditor();

      delete payload.id; delete payload.numero; delete payload.progressivo; delete payload.anno;

      window.__allowNumberRpc = true;

      var res;
      if (window.__mode === 'create') {
        res = await supabase.from('preventivi').insert(payload).select().single();
      } else if (window.currentRecordId) {
        res = await supabase.from('preventivi').update(payload).eq('id', window.currentRecordId).select().single();
      } else {
        res = await supabase.from('preventivi').insert(payload).select().single();
      }

      var data = res.data, error = res.error;
      if (error) throw error;

      window.currentRecordId = data.id;
      window.__mode = 'edit';
      var numEl = document.querySelector('#numero'); if (numEl && data && data.numero) numEl.value = data.numero;
      window.__dirty = false;
      if (window.toast && typeof window.toast.success === 'function') window.toast.success('Salvato: ' + (data.numero || ''));
    } catch (e) {
      alert('Errore salvataggio: ' + (e && e.message ? e.message : e));
    } finally {
      window.__allowNumberRpc = false;
      __saving = false;
    }
  }
  window.salvaPreventivo = salvaPreventivo;

  // ---------- INTERCEPT "NUOVO" ANYWHERE (capturing) ----------
  function matchesNew(el) {
    if (!el) return false;
    if (el.id === 'btnNuovo' || el.id === 'btnNewFromArchive') return true;
    if (el.matches && el.matches('[data-action="new"],[data-new],[data-btn="nuovo"],.btn-nuovo,.new-record')) return true;
    if (/^\s*nuovo\s*$/i.test(el.textContent || '')) return true;
    return false;
  }
  document.addEventListener('click', function(e){
    var path = e.composedPath ? e.composedPath() : [e.target];
    var btn = null;
    for (var i=0;i<path.length;i++){ var n = path[i]; if (n && n.nodeType===1 && matchesNew(n)) { btn=n; break; } }
    if (btn) { try { e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); } catch (err) {} startNewFlow(); }
  }, true);

  // ---------- WIRING BUTTONS BY ID ----------
  function wireKnownButtons() {
    var ids = ['btnNuovo','btnNewFromArchive','btnSalva'];
    ids.forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      if (id === 'btnSalva') el.addEventListener('click', function(e){ e.preventDefault(); salvaPreventivo(); });
      else el.addEventListener('click', function(e){ e.preventDefault(); startNewFlow(); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireKnownButtons);
  else wireKnownButtons();

  // ---------- CLEAN ON FIRST LOAD (home page pulita) ----------
  function firstBootClean() {
    resetFormCampi(document);
    window.currentRecordId = null;
    window.__mode = 'create';
    var homeId = getHomeId();
    if (homeId) {
      var homeEl = document.getElementById(homeId);
      if (homeEl) showOnly(homeEl);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', firstBootClean);
  else firstBootClean();

})();