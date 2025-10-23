/* Preventivi ELIP — app.js (2025-10-23, Archivio table + filters + Open) */
(function(){
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const EURO = n => (n||0).toLocaleString('it-IT', { style:'currency', currency:'EUR' });
  const DTIT = s => s ? new Date(s).toLocaleDateString('it-IT') : '';

  window.__elipPhotosQueue = [];
  function getCur(){ try { return JSON.parse(localStorage.getItem('elip_current') || 'null'); } catch { return null; } }
  function setCurLight(o){
    try {
      if (!o) { localStorage.removeItem('elip_current'); return; }
      const { images, img, photoData, previewData, ...rest } = o;
      if (typeof rest.note === 'string' && rest.note.length > 4000) rest.note = rest.note.slice(0,4000);
      localStorage.setItem('elip_current', JSON.stringify(rest));
    } catch (e) {
      try { localStorage.removeItem('elip_current'); } catch {}
    }
  }
  function nextNumero(){
    const y = new Date().getFullYear();
    const k = 'elip_seq_'+y;
    const s = (parseInt(localStorage.getItem(k)||'0',10) + 1);
    localStorage.setItem(k, String(s));
    return `ELP-${y}-${String(s).padStart(4,'0')}`;
  }
  function initCur(){
    let cur = getCur();
    if (!cur) {
      cur = { id: nextNumero(), createdAt: new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'' , dataAcc:'', dataScad:'', note:'', lines:[] };
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

  // ---- FOTO preview ---------------------------------------------------------
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

  // ---- ARCHIVIO table -------------------------------------------------------
  function computeAccCounters(arr){
    let ok=0,no=0;
    (arr||[]).forEach(r => ((r.data_accettazione||'').toString().trim()? ok++ : no++));
    const el = $('#accCounters'); if (el) el.textContent = `Accettati: ${ok} — Da accettare: ${no}`;
  }
  function passFilter(r, mode, q){
    const hitTxt = (txt) => (String(txt||'').toLowerCase().includes(q));
    const accepted = !!(r.data_accettazione);
    if (mode==='ok' && !accepted) return false;
    if (mode==='no' && accepted) return false;
    if (q && !(hitTxt(r.cliente)||hitTxt(r.articolo)||hitTxt(r.numero)||hitTxt(r.ddt))) return false;
    return true;
  }
  function renderArchiveTable(){
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem('elip_archive') || '[]') || []; } catch {}
    const tbody = $('#archBody'); if (!tbody) return;
    const q = ($('#filterQuery')?.value||'').trim().toLowerCase();
    const mode = ($('#fltOk')?.classList.contains('active') ? 'ok' :
                  $('#fltNo')?.classList.contains('active') ? 'no' : 'all');
    const rows = arr.filter(r => passFilter(r, mode, q));

    tbody.innerHTML = '';
    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.numero||''}</td>
        <td>${DTIT(r.created_at||r.data_invio)}</td>
        <td>${r.cliente||''}</td>
        <td>${r.articolo||''}</td>
        <td>${r.ddt||''}</td>
        <td class="text-end">${EURO(r.totale||0)}</td>
        <td>${DTIT(r.data_accettazione)}</td>
        <td>${DTIT(r.data_scadenza)}</td>
        <td>${r.data_accettazione ? '<span class="badge text-bg-success">Accettato</span>' : '<span class="badge text-bg-danger">Da accettare</span>'}</td>
        <td><button class="btn btn-sm btn-outline-primary" data-open-num="${r.numero}">Apri</button></td>`;
      tbody.appendChild(tr);
    });
    computeAccCounters(rows);
  }
  function openFromArchive(num){
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem('elip_archive') || '[]') || []; } catch {}
    const r = arr.find(x => x.numero === num);
    if (!r) return;
    const cur = {
      id: r.numero || nextNumero(),
      createdAt: r.created_at || new Date().toISOString(),
      cliente: r.cliente || '',
      articolo: r.articolo || '',
      ddt: r.ddt || '',
      telefono: r.telefono || '',
      email: r.email || '',
      dataInvio: r.data_invio || '',
      dataAcc: r.data_accettazione || '',
      dataScad: r.data_scadenza || '',
      note: r.note || '',
      lines: r.linee || []
    };
    setCurLight(cur);
    fillForm();
    renderLines();
    const btn = document.querySelector('[data-bs-target="#tab-editor"]');
    if (btn) { try { new bootstrap.Tab(btn).show(); } catch { btn.click(); } }
  }

  window.toastSaved = function(){
    const el = $('#toastSave'); if (!el) return;
    try { new bootstrap.Toast(el).show(); } catch {}
  };
  window.renderArchiveLocal = function(){ renderArchiveTable(); };

  function bind(){
    $('#btnNew')?.addEventListener('click', (e)=>{
      e.preventDefault();
      const fresh = { id: nextNumero(), createdAt: new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[] };
      setCurLight(fresh);
      window.__elipPhotosQueue = [];
      $('#imgInput') && ($('#imgInput').value = '');
      $('#imgPreview') && ($('#imgPreview').innerHTML = '');
      fillForm(); renderLines(); renderImages();
    });
    $('#btnClear')?.addEventListener('click', (e)=>{
      e.preventDefault();
      const c = initCur();
      setCurLight({ id:c.id, createdAt:c.createdAt, cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[] });
      window.__elipPhotosQueue = [];
      $('#imgInput') && ($('#imgInput').value = '');
      $('#imgPreview') && ($('#imgPreview').innerHTML = '');
      fillForm(); renderLines(); renderImages();
    });
    $('#btnSave')?.addEventListener('click', async (e)=>{
      e.preventDefault();
      try { await window.dbApi.saveToSupabase(false); } catch(err){ alert('Errore salvataggio: ' + (err?.message||err)); }
    });
    $('#imgInput')?.addEventListener('change', e => { window.__elipPhotosQueue = Array.from(e.target.files||[]); renderImages(); });

    $('#filterQuery')?.addEventListener('input', renderArchiveTable);
    $('#fltAll')?.addEventListener('click', (e)=>{ e.preventDefault(); $('#fltAll').classList.add('active'); $('#fltOk')?.classList.remove('active'); $('#fltNo')?.classList.remove('active'); renderArchiveTable(); });
    $('#fltOk')?.addEventListener('click', (e)=>{ e.preventDefault(); $('#fltOk').classList.add('active'); $('#fltAll')?.classList.remove('active'); $('#fltNo')?.classList.remove('active'); renderArchiveTable(); });
    $('#fltNo')?.addEventListener('click', (e)=>{ e.preventDefault(); $('#fltNo').classList.add('active'); $('#fltAll')?.classList.remove('active'); $('#fltOk')?.classList.remove('active'); renderArchiveTable(); });

    $('#archBody')?.addEventListener('click', (e)=>{
      const b = e.target.closest('button[data-open-num]');
      if (b){ openFromArchive(b.getAttribute('data-open-num')); }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    fillForm();
    renderLines();
    renderImages();
    bind();
    try { await window.dbApi.loadArchive(); } catch {}
    renderArchiveTable();
    try { window.dbApi.subscribeRealtime(); } catch {}
  });
})();
