
/* Preventivi ELIP — app-photos.js (2025-10-23 PREVIEW+SERVER)
   - Coda locale senza duplicati (anteprime 164x164, bottone “×” per rimuovere)
   - Visualizzazione foto "server" (sola lettura) in griglia 164x164
   - Clic su qualsiasi miniatura → apre #imgModal con immagine intera
   - API: __elipGetUploadFiles(), __elipClearUploadQueue(), __elipShowServerPhotos(urls[])
*/
(function(){
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);

  // ---------- Internal state for LOCAL uploads ----------
  let items = [];               // [{id,file,key,thumb,dataUrl}]
  const indexByKey = new Map(); // key -> idx

  function fileKey(f){ return `${f?.name||'?' }|${f?.size||0}|${f?.lastModified||0}`; }

  // ---------- Helpers ----------
  function readFileAsDataURL(file){
    return new Promise((res,rej)=>{
      const fr = new FileReader();
      fr.onload = ()=> res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }
  async function makeThumbFromDataURL(dataUrl, size=164){
    const img = new Image();
    img.src = dataUrl; await img.decode();
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

  // ---------- LOCAL queue ops ----------
  async function addFiles(files){
    const list = Array.from(files||[]).filter(Boolean);
    for (const f of list){
      const key = fileKey(f);
      if (indexByKey.has(key)) continue; // no duplicates
      const dataUrl = await readFileAsDataURL(f);
      const thumb = await makeThumbFromDataURL(dataUrl, 164);
      const id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now()+'_'+Math.random().toString(36).slice(2,8));
      const item = { id, file: f, key, dataUrl, thumb, origin:'local' };
      indexByKey.set(key, items.length);
      items.push(item);
    }
    render();
  }

  function removeById(id){
    const i = items.findIndex(x=>x.id===id);
    if (i>=0){
      const key = items[i].key;
      items.splice(i,1);
      indexByKey.delete(key);
      // rebuild index
      indexByKey.clear();
      items.forEach((it,idx)=> indexByKey.set(it.key, idx));
      render();
    }
  }

  // ---------- Render (local + server) ----------
  function ensureContainers(){
    const wrap = $('#imgPreview');
    if (!wrap) return { wrap:null, local:null, server:null };
    if (!$('#imgPreviewLocal')){
      const div = document.createElement('div');
      div.id = 'imgPreviewLocal';
      div.className = 'imgPreviewGrid';
      wrap.appendChild(div);
    }
    if (!$('#imgPreviewServer')){
      const div = document.createElement('div');
      div.id = 'imgPreviewServer';
      div.className = 'imgPreviewGrid mt-2';
      wrap.appendChild(div);
    }
    return { wrap, local: $('#imgPreviewLocal'), server: $('#imgPreviewServer') };
  }

  function render(){
    const { local } = ensureContainers();
    if (!local) return;
    local.innerHTML = '';
    for (const it of items){
      if (!it?.thumb) continue;
      const card = document.createElement('div');
      card.className = 'photo-card';
      const img = document.createElement('img');
      img.src = it.thumb;
      img.alt = it.file?.name || 'Foto';
      img.dataset.full = it.dataUrl || '';
      const btn = document.createElement('button');
      btn.className = 'btn-remove'; btn.type='button'; btn.textContent = '×';
      btn.setAttribute('data-remove-id', it.id);
      btn.title = 'Rimuovi dalla coda (non elimina dal server)';
      card.appendChild(img);
      card.appendChild(btn);
      local.appendChild(card);
    }
  }

  // ---------- Server photos (read-only) ----------
  function showServerPhotos(urls){
    const { server } = ensureContainers();
    if (!server) return;
    server.innerHTML = '';
    const list = Array.isArray(urls) ? urls : [];
    for (const u of list){
      if (!u) continue;
      const card = document.createElement('div');
      card.className = 'photo-card';
      const img = document.createElement('img');
      img.src = u; // may already be a small thumb url
      img.alt = 'Foto server';
      img.dataset.full = u;
      // badge: cloud
      const badge = document.createElement('div');
      badge.className = 'badge-cloud';
      badge.textContent = 'cloud';
      card.appendChild(img);
      card.appendChild(badge);
      server.appendChild(card);
    }
  }

  // ---------- Modal preview ----------
  function openInModal(dataUrl){
    const modal = document.getElementById('imgModal');
    const target = document.getElementById('imgModalImg');
    if (!target) return;
    target.src = dataUrl || '';
    if (modal) {
      try { new bootstrap.Modal(modal).show(); } catch { modal.style.display='block'; }
    }
  }

  // ---------- Bindings ----------
  function bind(){
    const input = document.getElementById('imgInput');
    if (input){
      input.addEventListener('change', async (e)=>{
        await addFiles(e.target.files);
      });
    }
    const wrap = document.getElementById('imgPreview');
    if (wrap){
      wrap.addEventListener('click', (e)=>{
        const btn = e.target.closest('button[data-remove-id]');
        if (btn){ removeById(btn.getAttribute('data-remove-id')); return; }
        const img = e.target.closest('img');
        if (img && img.dataset.full){
          openInModal(img.dataset.full);
        }
      });
    }
  }

  // ---------- Public APIs for uploader ----------
  window.__elipGetUploadFiles = function(){ return items.map(x=>x.file).filter(Boolean); };
  window.__elipClearUploadQueue = function(){ items = []; indexByKey.clear(); render(); };
  window.__elipShowServerPhotos = function(urls){ showServerPhotos(urls); };

  // ---------- Import legacy queue if present ----------
  async function importLegacy(){
    if (Array.isArray(window.__elipPhotosQueue) && window.__elipPhotosQueue.length){
      const onlyFiles = window.__elipPhotosQueue.filter(f => f && typeof f.name === 'string' && typeof f.size === 'number');
      window.__elipPhotosQueue = []; // avoid dup
      if (onlyFiles.length){ await addFiles(onlyFiles); }
    }
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    bind();
    await importLegacy();
    render();
  });
})();
