
/* === ELIP TAGLIENTE • app.js (photo+save fix 2025-10-23) ===
 * - Foto: preview via ObjectURL (no base64 in localStorage)
 * - Upload foto su Supabase con retry/backoff (anti 429/5xx)
 * - Salva: chiude la finestra/modale e torna in Home
 * - LocalStorage: elip_current salva SOLO campi leggeri (no blob/base64) per evitare QuotaExceededError
 */

(function () {
  'use strict';

  // ---------- State (in-memory, not persisted) ----------
  let currentRecord = null;
  let photosQueue = []; // File[] da caricare al salvataggio
  let isSaving = false;

  // ---------- Helpers UI ----------
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const show = (id) => { $$('#page-home, #page-search, #page-new, #page-detail').forEach(el=>el && el.classList.add('d-none')); const el=$(id); if(el) el.classList.remove('d-none'); };
  const hideModal = (id) => {
    const el = $(id);
    if (!el) return;
    // support Bootstrap modal if present
    if (window.bootstrap && bootstrap.Modal.getInstance) {
      const inst = bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el);
      inst.hide();
    }
    el.classList.add('d-none');
  };

  // ---------- LocalStorage safe write ----------
  function setCurrentLight(record) {
    try {
      if (!record) {
        localStorage.removeItem('elip_current');
        return;
      }
      // Copia "leggera": togli campi pesanti/temporanei
      const { photoData, previewData, img, image, images, photos, ...rest } = record;
      // Trimmare descrizioni lunghissime
      if (typeof rest.descrizione === 'string' && rest.descrizione.length > 2000) {
        rest.descrizione = rest.descrizione.slice(0, 2000);
      }
      const safe = JSON.stringify(rest);
      localStorage.setItem('elip_current', safe);
    } catch (err) {
      // Se superiamo la quota, puliamo e non blocchiamo l'app
      try { localStorage.removeItem('elip_current'); } catch(_) {}
      console.warn('[setCurrentLight] storage skipped:', err?.name || err);
    }
  }

  function getCurrentLight() {
    try {
      const raw = localStorage.getItem('elip_current');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // ---------- Foto: gestione input e preview (no base64) ----------
  const photoInput = $('#newPhotoInput');
  const photoPreview = $('#newPhotoPreview'); // <div> o <img> container
  if (photoInput) {
    photoInput.addEventListener('change', (ev) => {
      const files = Array.from(ev.target.files || []);
      photosQueue = files;
      // Preview: mostra solo la prima foto
      if (photoPreview) {
        photoPreview.innerHTML = '';
        if (files[0]) {
          const url = URL.createObjectURL(files[0]);
          const img = document.createElement('img');
          img.src = url;
          img.alt = 'Anteprima foto';
          img.style.maxWidth = '160px';
          img.style.height = 'auto';
          img.onload = () => URL.revokeObjectURL(url);
          photoPreview.appendChild(img);
        }
      }
    });
  }

  // ---------- Nuova scheda: reset completo ----------
  function resetNewForm() {
    const form = $('#form-new');
    if (form) form.reset();
    photosQueue = [];
    if (photoPreview) photoPreview.innerHTML = '';
    currentRecord = null;
    setCurrentLight(null);
  }

  // ---------- Salva (nuova o modifica) ----------
  async function doSave(ev) {
    ev?.preventDefault?.();
    if (isSaving) return;
    isSaving = true;

    try {
      const form = $('#form-new') || $('#form-edit') || document.forms[0];
      const fd = new FormData(form);

      // Costruisci record base
      const rec = {};
      for (const [k, v] of fd.entries()) rec[k] = v;

      // Normalizza date vuote
      ['dataApertura','dataArrivo','dataAccettazione','dataScadenza','dataFine']
        .forEach(k => { if (rec[k] === '') rec[k] = null; });

      // Determina azione: insert o update
      const isUpdate = Boolean(rec.id && String(rec.id).length > 0);
      let recordId = rec.id || null;

      if (isUpdate) {
        const { data, error } = await window.dbApi.updateRecord(rec);
        if (error) throw error;
        recordId = data?.id || rec.id;
      } else {
        const { data, error } = await window.dbApi.saveRecord(rec);
        if (error) throw error;
        recordId = data?.id;
      }

      // Upload foto se presenti
      if (photosQueue.length > 0 && recordId) {
        for (const file of photosQueue) {
          const up = await window.dbApi.uploadPhoto(file, recordId);
          if (up?.error) throw up.error;
        }
      }

      // Dopo salvataggio: reset form, chiudi modale (se esiste) e torna a Home
      resetNewForm();
      hideModal('#preventivoModal'); // se viene usato un modal
      show('#page-home');

      // Trigger refresh lista/home se esiste
      if (typeof window.refreshDashboard === 'function') {
        try { await window.refreshDashboard(); } catch {}
      }
      if (typeof window.lista === 'function') {
        try { await window.lista(); } catch {}
      }
    } catch (err) {
      console.error('Errore salvataggio:', err);
      alert('Errore durante il salvataggio: ' + (err?.message || err));
    } finally {
      isSaving = false;
    }
  }

  // ---------- Bind pulsanti ----------
  const btnSave = $('#btnSave, #btnDoSave');
  if (btnSave) {
    // Seleziona il primo bottone se query multipl
    const btn = Array.isArray(btnSave) ? btnSave[0] : btnSave;
    btn?.addEventListener('click', doSave);
    // Se vuoi che "Salva" equivalga ad "Archivia", basta questo handler unico
  }

  // "Nuovo": deve pulire i campi
  const btnNew = $('#btnNew, #btnNuovaScheda');
  if (btnNew) {
    const el = Array.isArray(btnNew) ? btnNew[0] : btnNew;
    el?.addEventListener('click', (e) => {
      e?.preventDefault?.();
      resetNewForm();
      show('#page-new');
    });
  }

  // ---------- Restore stato leggero (se serve) ----------
  document.addEventListener('DOMContentLoaded', () => {
    const saved = getCurrentLight();
    if (saved && $('#form-new')) {
      // Ripopola alcuni campi base
      Object.entries(saved).forEach(([k, v]) => {
        const input = document.querySelector(`[name="${k}"]`);
        if (input && typeof v !== 'object') input.value = v ?? '';
      });
    }
  });

  // ---------- Espone alcune API utili ----------
  window.elip = {
    setCurrentLight,
    resetNewForm,
    doSave,
  };

  // Event delegation precedente che causava QuotaExceeded? Proteggiamola:
  document.body.onclick = (e) => {
    try {
      // ... eventuale logica già presente ...
      // NON salvare grandi payload in localStorage!
    } catch (err) {
      console.warn('body.onclick handler error:', err);
    }
  };
})();
