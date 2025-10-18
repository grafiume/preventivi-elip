/*! new-flow.v1.3.js — Patch "NUOVO" definitiva + rilevamento Editor intelligente
    Novità v1.3:
    - Configurabile: window.__EDITOR_PAGE_ID = 'id-della-pagina-editor'
    - Heuristics: se non trova la pagina, cerca il container che contiene #cliente (o #numero) e lo mostra
    - Supporto [data-page="editor"] e fallback estesi
    - Resta tutto: blocco INSERT/RPC fuori dal salvataggio, gap-fill al save, intercettazione globale di "NUOVO"
*/
(function () {
  'use strict';

  // -------------------- CONFIG --------------------
  // Se conosci l'ID della pagina editor, impostalo PRIMA di caricare questo file:
  //   <script>window.__EDITOR_PAGE_ID = 'page-editor';</script>
  // In alternativa, lo puoi settare a runtime: window.__EDITOR_PAGE_ID = 'tuo-id';
  const getEditorId = () => (window.__EDITOR_PAGE_ID && String(window.__EDITOR_PAGE_ID)) || null;

  // -------------------- FLAGS GLOBALI --------------------
  window.__allowInsertPreventivi = false;
  window.__allowNumberRpc = false;

  // -------------------- GUARDIE SUPABASE --------------------
  try {
    if (window.supabase && typeof window.supabase.rpc === 'function') {
      const _origRpc = window.supabase.rpc.bind(window.supabase);
      window.supabase.rpc = function(name, params, opts) {
        if (String(name || '').toLowerCase() === 'rpc_next_preventivo' && !window.__allowNumberRpc) {
          console.warn('[guard] rpc_next_preventivo BLOCCATA');
          return Promise.resolve({ data: null, error: { message: 'blocked rpc_next_preventivo by guard' } });
        }
        return _origRpc(name, params, opts);
      };
    }
  } catch (e) { console.warn('[guard rpc]', e); }

  try {
    if (window.supabase && typeof window.supabase.from === 'function') {
      const _origFrom = window.supabase.from.bind(window.supabase);
      window.supabase.from = function(table) {
        const qb = _origFrom(table);
        if (String(table).toLowerCase() === 'preventivi' && qb && typeof qb.insert === 'function') {
          const _origInsert = qb.insert.bind(qb);
          qb.insert = function(payload) {
            if (!window.__allowInsertPreventivi) {
              console.warn('[guard] INSERT su preventivi BLOCCATA (fuori da salvaPreventivo)');
              return Promise.resolve({ data: None, error: { message: 'blocked insert by guard (new-flow.v1.3)' } });
            }
            return _origInsert(payload);
          };
        }
        return qb;
      };
    }
  } catch (e) { console.warn('[guard insert]', e); }

  window.rpc_next_preventivo = undefined;

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
    root.querySelectorAll('.is-invalid,.is-valid').forEach(el => el.classList.remove('is-invalid','is-valid'));
    const avanz = root.querySelector('#badgeAvanzamento'); if (avanz) avanz.textContent = '0%';
    window.__dirty = false;
  }
  window.resetFormCampi = resetFormCampi;

  // -------------------- NAVIGAZIONE EDITOR ROBUSTA --------------------
  function showOnly(elToShow) {
    if (!elToShow) return false;
    // Nascondi sezioni pagine comuni
    const pages = document.querySelectorAll('[id^="page-"], section[id], main[id]');
    pages.forEach(p => { if (p !== elToShow) p.classList.add('d-none'); });
    elToShow.classList.remove('d-none');
    return true;
  }

  function findEditorContainerHeuristics() {
    // 1) Preferisci l'ID esplicito
    const cfg = getEditorId();
    if (cfg) {
      const el = document.getElementById(cfg);
      if (el) return el;
    }
    // 2) [data-page="editor"]
    const dp = document.querySelector('[data-page="editor"]');
    if (dp) return dp;
    // 3) Candidate IDs noti
    const candidates = ['page-editor','page_edit','editor','edit','page-form','page-scheda','page-dettaglio'];
    for (const id of candidates) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    // 4) Trova container che contiene il campo #cliente o #numero
    const anchor = document.querySelector('#cliente, #numero');
    if (anchor) {
      // Risali fino a trovare un ascendente con id (sezione pagina)
      let n = anchor;
      for (let i = 0; i < 7 && n; i++) {
        if (n.id) return n;
        n = n.parentElement;
      }
    }
    return null;
  }

  function openEditorPage() {
    // 0) API app (se esiste)
    try {
      if (typeof window.openPage === 'function') {
        window.openPage('editor'); // molte app nostre lo hanno
        return true;
      }
    } catch {}
    // 1) Navigazione via link/hash
    const navEditor = document.querySelector('[data-target="editor"], [href="#editor"]');
    if (navEditor) { navEditor.click(); return true; }
    try { location.hash = '#editor'; } catch {}

    // 2) Heuristics sui container
    const container = findEditorContainerHeuristics();
    if (container && showOnly(container)) return true;

    // 3) Evento custom per router esterno
    document.dispatchEvent(new CustomEvent('go-editor-request'));
    console.warn('[startNewFlow] non ho trovato la pagina editor: imposta window.__EDITOR_PAGE_ID o aggiungi data-page="editor" al container');
    return false;
  }

  // -------------------- FLUSSO NUOVO --------------------
  let __newDebounce = false;
  function startNewFlow() {
    if (__newDebounce) return;
    __newDebounce = true; setTimeout(() => { __newDebounce = false; }, 600);

    if (window.__dirty === true) {
      const go = confirm('Ci sono modifiche non salvate. Creare una nuova scheda vuota?');
      if (!go) return;
    }

    window.currentRecordId = null;
    window.__mode = 'create';
    resetFormCampi();

    const head = document.querySelector('#editorTitle'); if (head) head.textContent = 'Nuovo preventivo';
    openEditorPage();
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

      window.__allowInsertPreventivi = true;
      window.__allowNumberRpc = true;

      let res;
      if (window.currentRecordId) {
        res = await supabase.from('preventivi').update(payload).eq('id', window.currentRecordId).select().single();
      } else {
        res = await supabase.from('preventivi').insert(payload).select().single();
      }
      const { data, error } = res;
      if (error) throw error;

      window.currentRecordId = data.id;
      window.__mode = 'edit';
      const numEl = document.querySelector('#numero'); if (numEl && data?.numero) numEl.value = data.numero;
      window.__dirty = false;
      if (window.toast?.success) window.toast.success('Salvato: ' + (data.numero || ''));
    } catch (e) {
      alert('Errore salvataggio: ' + (e?.message || e));
    } finally {
      window.__allowInsertPreventivi = false;
      window.__allowNumberRpc = false;
      __saving = false;
    }
  }
  window.salvaPreventivo = salvaPreventivo;

  // -------------------- INTERCETTA "NUOVO" OVUNQUE --------------------
  function matchesNew(el) {
    if (!el) return false;
    if (el.id === 'btnNuovo' || el.id === 'btnNewFromArchive') return true;
    if (el.matches?.('[data-action="new"],[data-new],[data-btn="nuovo"],.btn-nuovo')) return true;
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

  // -------------------- WIRING DIRETTO --------------------
  function wireKnownButtons() {
    const map = ['btnNuovo','btnNewFromArchive','btnSalva'];
    map.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === 'btnSalva') el.addEventListener('click', (e) => { e.preventDefault(); salvaPreventivo(); });
      else el.addEventListener('click', (e) => { e.preventDefault(); startNewFlow(); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireKnownButtons);
  else wireKnownButtons();
})();