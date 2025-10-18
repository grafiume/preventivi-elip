/*! new-flow.v1.5.js — "Nuovo" → Editor + INSERT garantito + partenza da 1 */
(function () {
  'use strict';

  const getEditorId = () => (window.__EDITOR_PAGE_ID && String(window.__EDITOR_PAGE_ID)) || null;

  // Blocca solo eventuali RPC client-side del numero fuori dal salvataggio
  window.__allowNumberRpc = false;
  try {
    if (window.supabase && typeof window.supabase.rpc === 'function') {
      const _origRpc = window.supabase.rpc.bind(window.supabase);
      window.supabase.rpc = function(name, params, opts) {
        if (String(name || '').toLowerCase() === 'rpc_next_preventivo' && !window.__allowNumberRpc) {
          console.warn('[guard] rpc_next_preventivo BLOCCATA');
          return Promise.resolve({ data: null, error: { message: 'blocked rpc_next_preventivo by guard (v1.5)' } });
        }
        return _origRpc(name, params, opts);
      };
    }
  } catch {}

  // Reset form/editor
  function resetFormCampi(root = document) {
    root.querySelectorAll('input, select, textarea').forEach(el => {
      if (['checkbox','radio'].includes(el.type)) el.checked = false;
      else el.value = '';
    });
    root.querySelectorAll('.flag-lavorazione input[type="checkbox"]').forEach(cb => cb.checked = false);
    root.querySelector('#stato')?.value = 'In attesa';
    const dataFineEl = root.querySelector('#dataFine'); if (dataFineEl) dataFineEl.value = '';
    root.querySelector('#thumbStrip')?.replaceChildren();
    window.__imgBuffer = [];
    root.querySelector('#pdfPreview')?.replaceChildren();
    root.querySelector('#q') && (root.querySelector('#q').value='');
    // importantissimo: pulisci ID e NUMERO
    const numEl = root.querySelector('#numero'); if (numEl) numEl.value = '';
    const idEl  = root.querySelector('#id');     if (idEl)  idEl.value = '';
    root.querySelectorAll('.is-invalid,.is-valid').forEach(el => el.classList.remove('is-invalid','is-valid'));
    root.querySelector('#badgeAvanzamento') && (root.querySelector('#badgeAvanzamento').textContent='0%');
    window.__dirty = false;
  }
  window.resetFormCampi = resetFormCampi;

  function openEditorPage() {
    try { if (typeof window.openPage === 'function') { window.openPage('editor'); return true; } } catch {}
    const cfg = getEditorId();
    if (cfg) {
      const el = document.getElementById(cfg);
      if (el) {
        document.querySelectorAll('[id^="page-"], section[id], main[id]').forEach(p => { if (p!==el) p.classList.add('d-none'); });
        el.classList.remove('d-none');
        return true;
      }
    }
    const anchor = document.querySelector('#cliente, #numero');
    if (anchor) {
      let n = anchor;
      for (let i=0;i<7 && n;i++){ if (n.id){ document.querySelectorAll('[id^="page-"], section[id], main[id]').forEach(p => { if (p!==n) p.classList.add('d-none'); }); n.classList.remove('d-none'); return true; } n=n.parentElement; }
    }
    console.warn('[v1.5] Imposta window.__EDITOR_PAGE_ID (es. "page-editor")');
    return false;
  }

  // Flusso NUOVO: sempre create
  let __newDebounce=false;
  function startNewFlow() {
    if (__newDebounce) return; __newDebounce=true; setTimeout(()=>__newDebounce=false, 400);
    if (window.__dirty === true) { const go = confirm('Ci sono modifiche non salvate. Creare una nuova scheda vuota?'); if (!go) return; }
    window.currentRecordId = null;
    window.__mode = 'create';
    resetFormCampi();
    const head = document.querySelector('#editorTitle'); if (head) head.textContent = 'Nuovo preventivo';
    const ok = openEditorPage();
    if (!ok) alert('Imposta window.__EDITOR_PAGE_ID con l\'ID del container Editor (es. "page-editor").');
    setTimeout(() => document.querySelector('#cliente')?.focus(), 0);
  }
  window.startNewFlow = startNewFlow;

  // Salvataggio: in create => INSERT garantita
  let __saving=false;
  async function salvaPreventivo() {
    if (__saving) return; __saving=true;
    try {
      if (typeof window.raccogliDatiEditor !== 'function') throw new Error('Funzione raccogliDatiEditor() mancante');
      const payload = window.raccogliDatiEditor();

      // Rimuovi eventuali chiavi che non devono essere inviate all'INSERT
      delete payload.id;
      delete payload.numero;
      delete payload.progressivo;
      delete payload.anno;

      window.__allowNumberRpc = true; // eventualmente sblocco per codice legacy

      let res;
      if (window.__mode === 'create') {
        res = await supabase.from('preventivi').insert(payload).select().single();
      } else if (window.currentRecordId) {
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
      window.toast?.success?.('Salvato: '+(data.numero || ''));
    } catch (e) {
      alert('Errore salvataggio: ' + (e?.message || e));
    } finally {
      window.__allowNumberRpc = false;
      __saving=false;
    }
  }
  window.salvaPreventivo = salvaPreventivo;

  // Intercetta "NUOVO" ovunque
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
    if (btn) { try { e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); } catch {} startNewFlow(); }
  }, true);

  // Wiring esplicito
  function wireKnownButtons() {
    ['btnNuovo','btnNewFromArchive','btnSalva'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === 'btnSalva') el.addEventListener('click', (e)=>{ e.preventDefault(); salvaPreventivo(); });
      else el.addEventListener('click', (e)=>{ e.preventDefault(); startNewFlow(); });
    });
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', wireKnownButtons);
  else wireKnownButtons();
})();