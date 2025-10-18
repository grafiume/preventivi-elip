/*! new-flow.v1.1.js — Patch definitiva "NUOVO" (no buchi, forzatura editor)
   - Blocca QUALSIASI vecchio handler su NUOVO (capturing + stopImmediatePropagation)
   - Non chiama MAI il DB su NUOVO
   - Forza la navigazione all'editor anche se sei su Archivio
   - Mostra il numero SOLO al salvataggio (trigger server gap-fill)
*/
(function () {
  'use strict';

  // --------- GUARDIE LEGACY (anti-contatore) ---------
  // 1) Blocca l'eventuale funzione RPC client-side del numero
  try {
    if (window.supabase && typeof window.supabase.rpc === 'function') {
      const __origRpc = window.supabase.rpc.bind(window.supabase);
      window.__allowNumberRpc = false;
      window.supabase.rpc = function(name, params, opts) {
        if (String(name).toLowerCase() === 'rpc_next_preventivo' && !window.__allowNumberRpc) {
          console.warn('[guard] blocco rpc_next_preventivo su NUOVO');
          return Promise.resolve({ data: null, error: { message: 'blocked rpc_next_preventivo by guard' } });
        }
        return __origRpc(name, params, opts);
      };
    }
  } catch (e) { console.warn('[guard rpc patch]', e); }

  // 2) Hard-disable di simboli legacy (se richiamati da vecchio codice)
  window.rpc_next_preventivo = undefined;

  // --------- RESET UI ---------
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

  // --------- NAVIGAZIONE EDITOR (robusta) ---------
  function openEditorPage() {
    // prova API app, se esiste
    if (typeof window.openPage === 'function') {
      try { window.openPage('editor'); return; } catch {}
    }
    // fallback: cerca la pagina giusta e mostra quella
    const candidates = ['page-editor','page_edit','editor','edit'];
    let shown = false;
    document.querySelectorAll('[id^="page"]').forEach(s => s.classList.add('d-none'));
    for (const id of candidates) {
      const el = document.getElementById(id);
      if (el) { el.classList.remove('d-none'); shown = true; break; }
    }
    if (!shown) {
      // se non trovi nulla, non fare nulla: la tua app potrebbe gestire routing diversamente
      console.warn('[openEditorPage] nessun container pagina trovato; verifica l\'ID della pagina editor');
    }
  }

  // --------- FLUSSO NUOVO ---------
  let __newDebounce = false;
  async function startNewFlow() {
    if (__newDebounce) return;
    __newDebounce = true; setTimeout(() => { __newDebounce = false; }, 600);

    if (window.__dirty === true) {
      const go = confirm('Ci sono modifiche non salvate. Creare una nuova scheda vuota?');
      if (!go) return;
    }

    window.currentRecordId = null;
    window.__mode = 'create';
    resetFormCampi();

    const head = document.querySelector('#editorTitle');
    if (head) head.textContent = 'Nuovo preventivo';

    openEditorPage();
    setTimeout(() => document.querySelector('#cliente')?.focus(), 0);
  }
  window.startNewFlow = startNewFlow;

  // --------- SALVATAGGIO (unico punto DB) ---------
  let __saving = false;
  async function salvaPreventivo() {
    if (__saving) return;
    __saving = true;
    try {
      if (typeof window.raccogliDatiEditor !== 'function') {
        throw new Error('Funzione raccogliDatiEditor() mancante');
      }
      const payload = window.raccogliDatiEditor();

      // Abilita eventuale RPC del numero SOLO nel contesto salvataggio (non serve con trigger, ma safe)
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
      window.__allowNumberRpc = false;
      __saving = false;
    }
  }
  window.salvaPreventivo = salvaPreventivo;

  // --------- EVENT DELEGATION: intercetta TUTTI i "NUOVO" ---------
  // Cattura a monte e impedisce propagazione a vecchi handler
  function isNewButton(el) {
    if (!el) return false;
    if (el.id === 'btnNuovo' || el.id === 'btnNewFromArchive') return true;
    if (el.matches?.('[data-action="new"],[data-new],[data-btn="nuovo"]')) return true;
    if (/nuovo/i.test(el.textContent || '')) return true;
    return false;
  }

  document.addEventListener('click', function(e) {
    const path = e.composedPath ? e.composedPath() : [e.target];
    const target = path.find(n => n?.nodeType === 1); // primo elemento
    if (!target) return;

    if (isNewButton(target)) {
      // blocca QUALSIASI altro handler legacy su questo click
      try { e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); } catch {}
      startNewFlow();
    }
  }, true); // capturing!

  // Wiring aggiuntivo (nel caso gli ID ci siano davvero)
  function wireKnownButtons() {
    document.getElementById('btnNuovo')?.addEventListener('click', (e) => { e.preventDefault(); startNewFlow(); });
    document.getElementById('btnNewFromArchive')?.addEventListener('click', (e) => { e.preventDefault(); startNewFlow(); });
    document.getElementById('btnSalva')?.addEventListener('click', (e) => { e.preventDefault(); salvaPreventivo(); });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireKnownButtons);
  } else {
    wireKnownButtons();
  }
})();