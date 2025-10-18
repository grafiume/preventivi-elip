/*! new-flow.v1.4.js — Fix definitivo "NUOVO → Editor" + "Sempre INSERT in create"
    Config:
      window.__EDITOR_PAGE_ID  = 'page-editor'   // ID container editor
      window.__ARCHIVE_PAGE_ID = 'page-archive'  // ID container archivio (opzionale)
*/
(function () {
  'use strict';

  // -------------------- CONFIG --------------------
  const getEditorId  = () => (window.__EDITOR_PAGE_ID  && String(window.__EDITOR_PAGE_ID))  || null;
  const getArchiveId = () => (window.__ARCHIVE_PAGE_ID && String(window.__ARCHIVE_PAGE_ID)) || null;

  // -------------------- FLAGS --------------------
  window.__allowNumberRpc = false; // blocchiamo eventuali RPC client-side del numero

  // -------------------- GUARDIE SUPABASE (solo RPC numero) --------------------
  try {
    if (window.supabase && typeof window.supabase.rpc === 'function') {
      const _origRpc = window.supabase.rpc.bind(window.supabase);
      window.supabase.rpc = function(name, params, opts) {
        if (String(name || '').toLowerCase() === 'rpc_next_preventivo' && !window.__allowNumberRpc) {
          console.warn('[guard] rpc_next_preventivo BLOCCATA');
          return Promise.resolve({ data: null, error: { message: 'blocked rpc_next_preventivo by guard (new-flow.v1.4)' } });
        }
        return _origRpc(name, params, opts);
      };
    }
  } catch (e) { console.warn('[guard rpc]', e); }

  // -------------------- RESET UI --------------------
  function resetFormCampi(root = document) {
    root.querySelectorAll('input, select, textarea').forEach(el => {
      if (['checkbox','radio'].includes(el.type)) el.checked = false;
      else el.value = '';
    });
    root.querySelectorAll('.flag-lavorazione input[type="checkbox"]').forEach(cb => cb.checked = false);

    const statoEl = root.querySelector('#stato'); if (statoEl) statoEl.value = 'In attesa';
    const dataFineEl = root.querySelector('#dataFine'); if (dataFineEl) dataFineEl.value = '';

    const strip = root.querySelector('#thumbStrip'); if (strip) strip.innerHTML = '';
    window.__imgBuffer = [];

    const prev = root.querySelector('#pdfPreview'); if (prev) prev.innerHTML = '';

    const q = root.querySelector('#q'); if (q) q.value = '';

    // Pulisci numero/id per evitare riusi
    const numEl = root.querySelector('#numero'); if (numEl) numEl.value = '';
    const idEl = root.querySelector('#id'); if (idEl) idEl.value = '';

    root.querySelectorAll('.is-invalid,.is-valid').forEach(el => el.classList.remove('is-invalid','is-valid'));

    const avanz = root.querySelector('#badgeAvanzamento'); if (avanz) avanz.textContent = '0%';
    window.__dirty = false;
  }
  window.resetFormCampi = resetFormCampi;

  // -------------------- NAVIGAZIONE EDITOR --------------------
  function showOnly(elToShow) {
    if (!elToShow) return false;
    const pages = document.querySelectorAll('[id^="page-"], section[id], main[id]');
    pages.forEach(p => { if (p !== elToShow) p.classList.add('d-none'); });
    elToShow.classList.remove('d-none');
    return true;
  }

  function openEditorPage() {
    // 0) API app
    try {
      if (typeof window.openPage === 'function') {
        window.openPage('editor');
        return true;
      }
    } catch {}
    // 1) Id configurato
    const cfg = getEditorId();
    if (cfg) {
      const el = document.getElementById(cfg);
      if (el && showOnly(el)) return true;
    }
    // 2) Attributo semantico
    const dp = document.querySelector('[data-page="editor"]');
    if (dp && showOnly(dp)) return true;
    // 3) Id candidati
    const candidates = ['page-editor','page_edit','editor','edit','page-form','page-scheda','page-dettaglio'];
    for (const id of candidates) {
      const el = document.getElementById(id);
      if (el && showOnly(el)) return true;
    }
    // 4) Ultimo fallback: risali dal campo #cliente/#numero
    const anchor = document.querySelector('#cliente, #numero');
    if (anchor) {
      let n = anchor;
      for (let i = 0; i < 7 && n; i++) {
        if (n.id && showOnly(n)) return true;
        n = n.parentElement;
      }
    }
    console.warn('[new-flow.v1.4] Non trovo il container Editor. Imposta window.__EDITOR_PAGE_ID.');
    return false;
  }

  // -------------------- FLUSSO NUOVO --------------------
  let __newDebounce = false;
  function startNewFlow() {
    if (__newDebounce) return;
    __newDebounce = true; setTimeout(() => { __newDebounce = false; }, 500);

    if (window.__dirty === true) {
      const go = confirm('Ci sono modifiche non salvate. Creare una nuova scheda vuota?');
      if (!go) return;
    }

    // modalità creazione SEMPRE
    window.currentRecordId = null;
    window.__mode = 'create';
    resetFormCampi();

    const head = document.querySelector('#editorTitle'); if (head) head.textContent = 'Nuovo preventivo';

    const ok = openEditorPage();
    if (!ok) alert('Imposta window.__EDITOR_PAGE_ID con l\'ID del container Editor (es. "page-editor").');

    // focus
    setTimeout(() => document.querySelector('#cliente')?.focus(), 0);
  }
  window.startNewFlow = startNewFlow;

  // -------------------- SALVATAGGIO --------------------
  let __saving = false;
  async function salvaPreventivo() {
    if (__saving) return;
    __saving = true;
    try {
      if (typeof window.raccogliDatiEditor !== 'function') throw new Error('Funzione raccogliDatiEditor() mancante');
      const payload = window.raccogliDatiEditor();

      // Solo qui consentiamo l'eventuale RPC numero (se qualche codice legacy insiste)
      window.__allowNumberRpc = true;

      let res;
      // *** REGOLA CHIARA: se __mode === 'create' => INSERT, altrimenti UPDATE ***
      if (window.__mode === 'create') {
        res = await supabase.from('preventivi').insert(payload).select().single();
      } else if (window.currentRecordId) {
        res = await supabase.from('preventivi').update(payload).eq('id', window.currentRecordId).select().single();
      } else {
        // fallback: se non abbiamo ID ma non siamo in create, comportati da create
        res = await supabase.from('preventivi').insert(payload).select().single();
      }

      const { data, error } = res;
      if (error) throw error;

      // dopo il primo salvataggio, si passa in edit
      window.currentRecordId = data.id;
      window.__mode = 'edit';

      // mostra numero assegnato dal server
      const numEl = document.querySelector('#numero'); if (numEl && data?.numero) numEl.value = data.numero;

      window.__dirty = false;
      if (window.toast?.success) window.toast.success('Salvato: ' + (data.numero || ''));
    } catch (e) {
      alert('Errore salvataggio: ' + (e?.message || e));
    } finally {
      window.__allowNumberRpc = false;
      __saving = false;
    }
  }
  window.salvaPreventivo = salvaPreventivo;

  // -------------------- INTERCETTA "NUOVO" IN ARCHIVIO --------------------
  // Cattura i click su bottoni "Nuovo" e forza il passaggio a editor
  function matchesNew(el) {
    if (!el) return false;
    if (el.id === 'btnNuovo' || el.id === 'btnNewFromArchive') return true;
    if (el.matches?.('[data-action="new"],[data-new],[data-btn="nuovo"],.btn-nuovo,.new-record')) return true;
    if (/^\s*nuovo\s*$/i.test(el.textContent || '')) return true;
    return false;
  }

  document.addEventListener('click', function(e) {
    const path = e.composedPath ? e.composedPath() : [e.target];
    const btn = path.find(n => n?.nodeType === 1 && matchesNew(n));
    if (btn) {
      try { e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); } catch {}
      startNewFlow();
    }
  }, true);

  // Wiring esplicito (IDs comuni)
  function wireKnownButtons() {
    const ids = ['btnNuovo','btnNewFromArchive','btnSalva'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === 'btnSalva') el.addEventListener('click', (e) => { e.preventDefault(); salvaPreventivo(); });
      else el.addEventListener('click', (e) => { e.preventDefault(); startNewFlow(); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireKnownButtons);
  else wireKnownButtons();

  // Se definito l'ID della pagina archivio, reindirizza anche i bottoni interni a quella sezione
  const archId = getArchiveId();
  if (archId) {
    const arch = document.getElementById(archId);
    if (arch) {
      arch.addEventListener('click', (e) => {
        const t = e.target;
        if (matchesNew(t) || matchesNew(t.closest?.('button, a'))) {
          e.preventDefault(); e.stopPropagation();
          startNewFlow();
        }
      });
    }
  }
})();