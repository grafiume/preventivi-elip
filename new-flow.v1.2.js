/*! new-flow.v1.2.js — Patch "NUOVO" definitiva
    - Blocca QUALSIASI INSERT su 'preventivi' e QUALSIASI rpc_next_preventivo fuori da salvaPreventivo()
    - Forza passaggio a Editor da Archivio (DOM fallback + URL hash + custom event)
    - Numero assegnato SOLO al salvataggio (trigger gap-fill server)
*/
(function () {
  'use strict';

  // -------------------- FLAGS GLOBALI --------------------
  // Consentiamo INSERT solo durante il salvataggio
  window.__allowInsertPreventivi = false;
  // Consenti eventuali RPC del numero solo durante salvataggio (non dovrebbe servire, ma difendiamo)
  window.__allowNumberRpc = false;

  // -------------------- GUARDIE SUPABASE --------------------
  // Patch di supabase.rpc per bloccare rpc_next_preventivo quando non consentito
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

  // Patch di supabase.from(...).insert(...) per bloccare INSERT fuori dal salvataggio
  try {
    if (window.supabase && typeof window.supabase.from === 'function') {
      const _origFrom = window.supabase.from.bind(window.supabase);
      window.supabase.from = function(table) {
        const qb = _origFrom(table);
        // Proxy solo per la tabella preventivi
        if (String(table).toLowerCase() === 'preventivi' && qb && typeof qb.insert === 'function') {
          const _origInsert = qb.insert.bind(qb);
          qb.insert = function(payload) {
            if (!window.__allowInsertPreventivi) {
              console.warn('[guard] INSERT su preventivi BLOCCATA (fuori da salvaPreventivo)');
              // Simula risposta d'errore compatibile
              return Promise.resolve({ data: None, error: { message: 'blocked insert by guard (new-flow.v1.2)' } });
            }
            return _origInsert(payload);
          };
        }
        return qb;
      };
    }
  } catch (e) { console.warn('[guard insert]', e); }

  // Disattiva simboli legacy se presenti
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
  function openEditorPage() {
    // 1) API app
    try {
      if (typeof window.openPage === 'function') {
        window.openPage('editor');
        return true;
      }
    } catch {}
    // 2) Link/nav con data-target
    const navEditor = document.querySelector('[data-target="editor"], [href="#editor"]');
    if (navEditor) { navEditor.click(); return true; }
    // 3) Hash routing
    try { location.hash = '#editor'; } catch {}
    // 4) Show/hide manuale (fallback)
    const candidates = ['page-editor','page_edit','editor','edit'];
    document.querySelectorAll('[id^="page"]').forEach(s => s.classList.add('d-none'));
    for (const id of candidates) {
      const el = document.getElementById(id);
      if (el) { el.classList.remove('d-none'); return true; }
    }
    // 5) Custom event per router custom
    document.dispatchEvent(new CustomEvent('go-editor-request'));
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

    // Zero DB qui!
    window.currentRecordId = null;
    window.__mode = 'create';
    resetFormCampi();
    const head = document.querySelector('#editorTitle'); if (head) head.textContent = 'Nuovo preventivo';
    const ok = openEditorPage();
    if (!ok) console.warn('[startNewFlow] verifica ID pagina editor.');

    setTimeout(() => document.querySelector('#cliente')?.focus(), 0);
  }
  window.startNewFlow = startNewFlow;

  // -------------------- SALVATAGGIO (unico DB point) --------------------
  let __saving = false;
  async function salvaPreventivo() {
    if (__saving) return;
    __saving = true;
    try {
      if (typeof window.raccogliDatiEditor !== 'function') throw new Error('Funzione raccogliDatiEditor() mancante');
      const payload = window.raccogliDatiEditor();

      // abilita inserimenti (solo ora)
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

  // -------------------- INTERCETTA QUALSIASI "NUOVO" (capturing) --------------------
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
  }, true); // capturing

  // Wiring diretto (se gli ID esistono)
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