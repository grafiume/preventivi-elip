/*! new-flow.v1.js — Preventivi: flusso "NUOVO" sicuro (no buchi) + salvataggio
    Requisiti: finestra globale `supabase`, funzioni `openPage(id)` e `raccogliDatiEditor()` già presenti nel tuo progetto.
    Inserisci questo file DOPO app-supabase.js / app-core.js.
*/
(function () {
  'use strict';

  // --- Utility di reset (idempotente) ---
  window.resetFormCampi = function resetFormCampi(root = document) {
    // input/select/textarea
    root.querySelectorAll('input, select, textarea').forEach(el => {
      if (['checkbox','radio'].includes(el.type)) el.checked = false;
      else el.value = '';
    });

    // flag lavorazioni (adatta la classe se diversa)
    root.querySelectorAll('.flag-lavorazione input[type="checkbox"]').forEach(cb => cb.checked = false);

    // stato e date
    const statoEl = root.querySelector('#stato'); if (statoEl) statoEl.value = 'In attesa';
    const dataFineEl = root.querySelector('#dataFine'); if (dataFineEl) dataFineEl.value = '';

    // immagini
    const strip = root.querySelector('#thumbStrip'); if (strip) strip.innerHTML = '';
    window.__imgBuffer = [];

    // anteprima PDF
    const prev = root.querySelector('#pdfPreview'); if (prev) prev.innerHTML = '';

    // ricerca
    const q = root.querySelector('#q'); if (q) q.value = '';

    // validazioni
    root.querySelectorAll('.is-invalid,.is-valid').forEach(el => el.classList.remove('is-invalid','is-valid'));

    // badge avanzamento (se presente)
    const avanz = root.querySelector('#badgeAvanzamento'); if (avanz) avanz.textContent = '0%';

    // stato sporco
    window.__dirty = false;
  };

  // --- Apertura editor ---
  function openEditorPage() {
    if (typeof window.openPage === 'function') {
      window.openPage('editor');
    } else {
      // fallback: mostra #page-editor, nascondi le altre
      document.querySelectorAll('[id^="page-"]').forEach(s => s.classList.add('d-none'));
      document.getElementById('page-editor')?.classList.remove('d-none');
    }
  }

  // --- Flusso NUOVO: mai chiamate al DB qui! ---
  let __newDebounce = false;
  async function startNewFlow() {
    if (__newDebounce) return;
    __newDebounce = true; setTimeout(() => { __newDebounce = false; }, 600);

    if (window.__dirty === true) {
      const go = confirm('Ci sono modifiche non salvate. Creare una nuova scheda vuota?');
      if (!go) return;
    }

    // azzera contesto
    window.currentRecordId = null;
    window.__mode = 'create';
    window.resetFormCampi();

    const head = document.querySelector('#editorTitle');
    if (head) head.textContent = 'Nuovo preventivo';

    openEditorPage();
    setTimeout(() => document.querySelector('#cliente')?.focus(), 0);
  }
  window.startNewFlow = startNewFlow;

  // --- Salvataggio: unico punto in cui si tocca il DB ---
  let __saving = false;
  async function salvaPreventivo() {
    if (__saving) return;
    __saving = true;
    try {
      if (typeof window.raccogliDatiEditor !== 'function') {
        throw new Error('Funzione raccogliDatiEditor() mancante');
      }
      const payload = window.raccogliDatiEditor();
      // NON impostare: payload.numero / payload.anno / payload.progressivo

      let res;
      if (window.currentRecordId) {
        res = await supabase.from('preventivi')
          .update(payload)
          .eq('id', window.currentRecordId)
          .select()
          .single();
      } else {
        res = await supabase.from('preventivi')
          .insert(payload)      // trigger server genererà numero/anno/progressivo (gap-fill)
          .select()
          .single();
      }

      const { data, error } = res;
      if (error) throw error;

      // aggiorna stato locale
      window.currentRecordId = data.id;
      window.__mode = 'edit';

      // mostra numero assegnato
      const numEl = document.querySelector('#numero');
      if (numEl && data?.numero) numEl.value = data.numero;

      window.__dirty = false;

      // feedback
      if (window.toast?.success) window.toast.success('Salvato: ' + (data.numero || ''));
    } catch (e) {
      alert('Errore salvataggio: ' + (e?.message || e));
    } finally {
      __saving = false;
    }
  }
  window.salvaPreventivo = salvaPreventivo;

  // --- Wiring pulsanti (se presenti) ---
  function wireNewButtons() {
    document.getElementById('btnNuovo')?.addEventListener('click', startNewFlow);
    document.getElementById('btnNewFromArchive')?.addEventListener('click', startNewFlow);
    document.getElementById('btnSalva')?.addEventListener('click', salvaPreventivo);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireNewButtons);
  } else {
    wireNewButtons();
  }

  // --- Hardening: disattiva accidentalmente vecchie logiche RPC su "nuovo" se presenti ---
  // (non possiamo rimuoverle senza conoscere il tuo codice; ma impediamo side effects comuni)
  window.rpc_next_preventivo = undefined; // evita usi legacy client-side
})();