/* Preventivi ELIP — app.js (2025-10-23, safe storage + foto) */
(function(){
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const EURO = n => (n||0).toLocaleString('it-IT', { style:'currency', currency:'EUR' });

  window.__elipPhotosQueue = [];

  // Storage leggero (NO immagini/base64)
  function getCur(){ try { return JSON.parse(localStorage.getItem('elip_current') || 'null'); } catch { return null; } }
  function setCurLight(o){
    try {
      if (!o) { localStorage.removeItem('elip_current'); return; }
      const { images, img, photoData, previewData, ...rest } = o;
      if (typeof rest.note === 'string' && rest.note.length > 4000) rest.note = rest.note.slice(0, 4000);
      localStorage.setItem('elip_current', JSON.stringify(rest));
    } catch (e) {
      console.warn('[setCurLight] skip', e?.name||e);
      try { localStorage.removeItem('elip_current'); } catch {}
    }
  }

  function nextNumero(){
    const d = new Date(), y = d.getFullYear(), k = 'elip_seq_' + y;
    const s = (parseInt(localStorage.getItem(k) || '0', 10) + 1);
    localStorage.setItem(k, String(s));
    return `ELP-${y}-${String(s).padStart(4,'0')}`;
  }

  function initCur(){
    let cur = getCur();
    if (!cur) {
      cur = { id: nextNumero(), createdAt: new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[] };
      setCurLight(cur);
    }
    return cur;
  }

  function fillForm(){
    const c = initCur();
    ['cliente','articolo','ddt','telefono','email','dataInvio','dataAcc','dataScad','note'].forEach(id => { const el = $('#'+id); if (el) el.value = c[id] || ''; });
    const q = $('#quoteId'); if (q) q.textContent = c.id;
    updateProgress(); recalcTotals();
  }

  function clearEditor(){
    const c = initCur();
    const blank = { id: c.id, createdAt: c.createdAt, cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[] };
    setCurLight(blank);
    window.__elipPhotosQueue = [];
    $('#imgInput') && ($('#imgInput').value = '');
    $('#imgPreview') && ($('#imgPreview').innerHTML = '');
    fillForm();
    renderLines();
  }

  function renderLines(){
    const c = initCur();
    const body = $('#linesBody'); if (!body) return;
    body.innerHTML = '';
    (c.lines||[]).forEach((r,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input class="form-control form-control-sm line-code" data-idx="${i}" placeholder="Cod." value="${r.code||''}"></td>
        <td><input class="form-control form-control-sm line-desc" data-idx="${i}" placeholder="Descrizione…" value="${r.desc||''}"></td>
        <td><input type="number" min="0" step="1" class="form-control form-control-sm text-end line-qty" data-idx="${i}" value="${r.qty||1}"></td>
        <td><input type="number" min="0" step="0.01" class="form-control form-control-sm text-end line-price" data-idx="${i}" value="${r.price||0}"></td>
        <td class="text-end" id="lineTot${i}">€ 0,00</td>
        <td class="text-center"><span class="badge bg-secondary">—</span></td>
        <td><input class="form-control form-control-sm line-operator" data-idx="${i}" value="${r.doneBy||''}"></td>
        <td><input type="date" class="form-control form-control-sm line-date" data-idx="${i}" value="${r.doneDate||''}"></td>
        <td><button class="btn btn-sm btn-outline-danger" data-del="${i}">✕</button></td>`;
      body.appendChild(tr);
    });
    body.oninput = onLineEdit;
    body.onclick = onLineClick;
    recalcTotals();
  }

  function onLineEdit(e){
    const c = initCur();
    const i = e.target.dataset.idx;
    if (e.target.classList.contains('line-code')) c.lines[i].code = e.target.value;
    if (e.target.classList.contains('line-desc')) c.lines[i].desc = e.target.value;
    if (e.target.classList.contains('line-qty')) c.lines[i].qty = parseFloat(e.target.value)||0;
    if (e.target.classList.contains('line-price')) c.lines[i].price = parseFloat(e.target.value)||0;
    if (e.target.classList.contains('line-operator')) c.lines[i].doneBy = e.target.value;
    if (e.target.classList.contains('line-date')) c.lines[i].doneDate = e.target.value;
    setCurLight(c);
    recalcTotals();
  }

  function onLineClick(e){
    const btn = e.target.closest('button[data-del]');
    if (btn) {
      const i = +btn.getAttribute('data-del');
      const c = initCur();
      c.lines.splice(i,1);
      setCurLight(c);
      renderLines();
    }
  }

  function updateProgress(){
    const c = initCur();
    let toDo=0, done=0;
    (c.lines||[]).forEach(r => {
      const has = (r.desc||'').trim()!=='' || (+r.qty||0)>0 || (+r.price||0)>0;
      if (has) { toDo++; if (r.doneDate && String(r.doneDate).trim()) done++; }
    });
    const pct = toDo ? Math.round((done/toDo)*100) : 0;
    const bar = $('#progressBar');
    if (bar) { bar.style.width = pct+'%'; bar.textContent = pct+'%'; }
  }

  function recalcTotals(){
    const c = initCur();
    ['cliente','articolo','ddt','telefono','email','dataInvio','dataAcc','dataScad','note'].forEach(id => {
      const el = $('#'+id); if (el) c[id] = el.value;
    });
    let imp=0;
    (c.lines||[]).forEach((r,i)=>{
      const t = (+r.qty||0) * (+r.price||0);
      imp += t;
      const cell = $('#lineTot'+i); if (cell) cell.textContent = EURO(t);
    });
    const iva = imp*0.22, tot = imp+iva;
    $('#imponibile') && ($('#imponibile').textContent = EURO(imp));
    $('#iva') && ($('#iva').textContent = EURO(iva));
    $('#totale') && ($('#totale').textContent = EURO(tot));
    setCurLight(c);
    updateProgress();
  }

  // Foto: anteprima via ObjectURL
  function renderImages(){
    const wrap = $('#imgPreview'); if (!wrap) return;
    wrap.innerHTML = '';
    (window.__elipPhotosQueue||[]).forEach((file,i)=>{
      const url = URL.createObjectURL(file);
      const d = document.createElement('div'); d.className = 'thumb-wrap';
      d.innerHTML = `<img class="thumb" src="${url}" alt="img"><button class="btn btn-sm btn-outline-danger" data-delimg="${i}">✕</button>`;
      wrap.appendChild(d);
      requestAnimationFrame(()=> URL.revokeObjectURL(url));
    });
    wrap.onclick = (e)=>{
      const b = e.target.closest('button[data-delimg]');
      if (b){ const i = +b.getAttribute('data-delimg'); window.__elipPhotosQueue.splice(i,1); renderImages(); }
    };
  }

  function bind(){
    $('#btnNew')?.addEventListener('click', (e)=>{ e.preventDefault();
      const fresh = { id: nextNumero(), createdAt: new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[] };
      setCurLight(fresh); window.__elipPhotosQueue = []; fillForm(); renderLines(); renderImages();
    });
    $('#btnClear')?.addEventListener('click', (e)=>{ e.preventDefault(); clearEditor(); });
    $('#btnSave')?.addEventListener('click', async (e)=>{ e.preventDefault(); try{ await window.dbApi.saveToSupabase(false); }catch(err){ alert('Errore salvataggio: ' + (err?.message||err)); } });
    $('#imgInput')?.addEventListener('change', e => { window.__elipPhotosQueue = Array.from(e.target.files||[]); renderImages(); });

    ['cliente','articolo','ddt','telefono','email','dataInvio','dataAcc','dataScad','note'].forEach(id=>{
      const el = $('#'+id); if (el){ el.addEventListener('input', recalcTotals); el.addEventListener('change', recalcTotals); }
    });
  }

  window.renderArchiveLocal = function() {
    try {
      const arr = JSON.parse(localStorage.getItem('elip_archive') || '[]');
      let ok=0,no=0;
      arr.forEach(r => ((r.data_accettazione||'').toString().trim()? ok++ : no++));
      const el = $('#accCounters'); if (el) el.textContent = `Accettati: ${ok} — Da accettare: ${no}`;
    } catch {}
  };

  window.toastSaved = function(){
    const el = $('#toastSave'); if (!el) return;
    try { new bootstrap.Toast(el).show(); } catch {}
  };

  document.addEventListener('DOMContentLoaded', async () => {
    fillForm();
    renderLines();
    renderImages();
    bind();
    try { await window.dbApi.loadArchive(); } catch {}
    if (typeof window.renderArchiveLocal === 'function') window.renderArchiveLocal();
    try { window.dbApi.subscribeRealtime(); } catch {}
  });
})();
