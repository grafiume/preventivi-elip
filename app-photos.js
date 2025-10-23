
/* Preventivi ELIP — app.js (2025-10-23 photo queue grid + delete)
   - Gestione foto: coda senza duplicati + griglia con X per rimuovere (164x164)
   - Richiede app-supabase.js precedente per upload
*/
(function(){
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const EURO = n => (n||0).toLocaleString('it-IT', { style:'currency', currency:'EUR' });
  const DTIT = s => s ? new Date(s).toLocaleDateString('it-IT') : '';

  /* ===== Photo queue helpers ===== */
  function ensurePhotoQueue(){
    if (!Array.isArray(window.__elipPhotosQueue)) window.__elipPhotosQueue = [];
    if (!window.__elipPhotosIndex) window.__elipPhotosIndex = new Map(); // key -> idx
  }
  function fileKey(f){ return `${f.name}|${f.size}|${f.lastModified}`; }

  function readFileAsDataURL(file){
    return new Promise((res,rej)=>{
      const fr = new FileReader();
      fr.onload = ()=> res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }
  async function makeLocalThumb(file, size=164){
    const url = await readFileAsDataURL(file);
    const img = new Image();
    img.src = url; await img.decode();
    const ratio = Math.max(size / img.width, size / img.height);
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0,0,size,size);
    ctx.drawImage(img, (size - w)/2, (size - h)/2, w, h);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  async function addFilesToQueue(files){
    ensurePhotoQueue();
    for (const f of files){
      const key = fileKey(f);
      if (window.__elipPhotosIndex.has(key)) continue; // evita duplicati
      const thumb = await makeLocalThumb(f, 164);
      const id = crypto.randomUUID ? crypto.randomUUID() : (Date.now()+'_'+Math.random().toString(36).slice(2,8));
      const item = { id, file: f, key, thumb };
      window.__elipPhotosIndex.set(key, window.__elipPhotosQueue.length);
      window.__elipPhotosQueue.push(item);
    }
    renderPhotoPreviewFromQueue();
  }

  function removeFromQueue(id){
    ensurePhotoQueue();
    const arr = window.__elipPhotosQueue;
    const idx = arr.findIndex(x=>x.id===id);
    if (idx>=0){
      const key = arr[idx].key;
      arr.splice(idx,1);
      window.__elipPhotosIndex.delete(key);
      // ricostruisci l'indice
      window.__elipPhotosIndex.clear();
      arr.forEach((it,i)=> window.__elipPhotosIndex.set(it.key,i));
      renderPhotoPreviewFromQueue();
    }
  }

  function renderPhotoPreviewFromQueue(){
    const wrap = $('#imgPreview'); if (!wrap) return;
    ensurePhotoQueue();
    wrap.innerHTML = '';
    for (const it of window.__elipPhotosQueue){
      const card = document.createElement('div');
      card.className = 'photo-card';
      const img = document.createElement('img');
      img.src = it.thumb; img.alt = it.file.name;
      const btn = document.createElement('button');
      btn.className = 'btn-remove'; btn.type='button'; btn.textContent = '×';
      btn.setAttribute('data-remove-id', it.id);
      card.appendChild(img);
      card.appendChild(btn);
      wrap.appendChild(card);
    }
  }

  /* ===== Bind photo UI ===== */
  function bindPhotoUI(){
    $('#imgInput')?.addEventListener('change', async e => {
      const files = Array.from(e.target.files||[]);
      await addFilesToQueue(files);
      // non azzeriamo l'input per permettere più add; per rifare la stessa selezione, l'utente può premere "cancella" e riselezionare
    });
    $('#imgPreview')?.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-remove-id]');
      if (btn) removeFromQueue(btn.getAttribute('data-remove-id'));
    });
  }

  /* ===== Expose queue to app-supabase.js uploader ===== */
  window.__elipGetUploadFiles = function(){
    ensurePhotoQueue();
    // restituisce la lista di File da caricare
    return window.__elipPhotosQueue.map(x=>x.file);
  };
  window.__elipClearUploadQueue = function(){
    window.__elipPhotosQueue = [];
    window.__elipPhotosIndex = new Map();
    renderPhotoPreviewFromQueue();
  };

  /* ===== Minimal existing init glue (only photo part) ===== */
  document.addEventListener('DOMContentLoaded', bindPhotoUI);
})();
