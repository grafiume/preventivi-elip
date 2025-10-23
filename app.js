
/* Preventivi ELIP — app.js (2025-10-23)
 * - Catalogo voci ripristinato (render, ricerca, modifica, +riga)
 * - "Nuovo" genera numero e pulisce (senza immagini in localStorage)
 * - Foto in coda in-memory + anteprima via ObjectURL
 * - Archivio: contatori locali aggiornati
 */
(function(){
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const EURO = n => (n||0).toLocaleString('it-IT', { style:'currency', currency:'EUR' });

  // ---------------- Catalogo ----------------
  const DEFAULT_CATALOG=[
    {code:"05",desc:"Smontaggio completo del motore sistematico"},
    {code:"29",desc:"Lavaggio componenti e trattamento termico avvolgimenti"},
    {code:"06",desc:"Verifiche meccaniche alberi/alloggi cuscinetti + elettriche avvolgimenti"},
    {code:"07",desc:"Tornitura, smicatura ed equilibratura rotore"},
    {code:"22",desc:"Sostituzione collettore con recupero avvolgimento"},
    {code:"01",desc:"Avvolgimento indotto con recupero collettore"},
    {code:"01C",desc:"Avvolgimento indotto con sostituzione collettore"},
    {code:"08",desc:"Isolamento statore"},
    {code:"02",desc:"Avvolgimento statore"},
    {code:"31",desc:"Lavorazioni meccaniche albero"},
    {code:"32",desc:"Lavorazioni meccaniche flange"},
    {code:"19",desc:"Sostituzione spazzole"},
    {code:"20",desc:"Sostituzione molle premispazzole"},
    {code:"21",desc:"Sostituzione cuscinetti"},
    {code:"23",desc:"Sostituzione tenuta meccanica"},
    {code:"26",desc:"Sostituzione guarnizioni/paraolio"},
    {code:"30",desc:"Montaggio, collaudo e verniciatura"},
    {code:"16",desc:"Ricambi vari"}
  ];
  function ensureCatalog(){
    try {
      const raw = localStorage.getItem('elip_catalog');
      if (!raw) localStorage.setItem('elip_catalog', JSON.stringify(DEFAULT_CATALOG));
      else {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          localStorage.setItem('elip_catalog', JSON.stringify(DEFAULT_CATALOG));
        }
      }
    } catch { localStorage.setItem('elip_catalog', JSON.stringify(DEFAULT_CATALOG)); }
  }
  function getCatalog(){ try { return JSON.parse(localStorage.getItem('elip_catalog')||'[]'); } catch { return []; } }
  function setCatalog(rows){ localStorage.setItem('elip_catalog', JSON.stringify(rows||[])); }

  function buildDatalist(){
    let dl = $('#catalogCodes');
    if (!dl) { dl = document.createElement('datalist'); dl.id = 'catalogCodes'; document.body.appendChild(dl); }
    dl.innerHTML = '';
    getCatalog().forEach(x=>{
      const o=document.createElement('option');
      o.value = x.code;
      o.label = `${x.code} - ${x.desc}`;
      dl.appendChild(o);
    });
  }
  function renderCatalog(filter=''){
    const ul = $('#catalogList'); if (!ul) return;
    const q = (filter||'').toLowerCase();
    const rows = getCatalog().filter(x => (x.code+' '+x.desc).toLowerCase().includes(q));
    ul.innerHTML = '';
    if (rows.length===0) { ul.innerHTML = '<li class="list-group-item text-muted">Nessuna voce…</li>'; return; }
    rows.forEach(x => {
      const li = document.createElement('li');
      li.className = 'list-group-item';
      li.textContent = `${x.code} - ${x.desc}`;
      li.addEventListener('click',()=> addLine({code:x.code,desc:x.desc,qty:1,price:0,done:false,doneBy:'',doneDate:''}));
      ul.appendChild(li);
    });
  }
  function editCatalog(){
    const cur = JSON.stringify(getCatalog(), null, 2);
    const next = prompt('Modifica catalogo (JSON):', cur);
    if (!next) return;
    try {
      const parsed = JSON.parse(next);
      if (!Array.isArray(parsed)) throw new Error('Deve essere un array');
      setCatalog(parsed);
      buildDatalist();
      renderCatalog($('#catalogSearch')?.value||'');
    } catch(e){ alert('JSON non valido: ' + e.message); }
  }

  // --------------- Stato corrente (NO immagini in LS) ---------------
  window.__elipPhotosQueue = []; // solo in memoria

  function getCur(){ try { return JSON.parse(localStorage.getItem('elip_current') || 'null'); } catch { return null; } }
  function setCurLight(o){
    try {
      if (!o) { localStorage.removeItem('elip_current'); return; }
      const { images, img, photoData, previewData, ...rest } = o;
      if (typeof rest.note === 'string' && rest.note.length > 4000) rest.note = rest.note.slice(0,4000);
      localStorage.setItem('elip_current', JSON.stringify(rest));
    } catch (e) {
      console.warn('[setCurLight] skip', e?.name||e);
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
      cur = { id: nextNumero(), createdAt: new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[] };
      setCurLight(cur);
    }
    return cur;
  }

  // ----------------- UI riempimento -----------------
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
        <td><input class="form-control form-control-sm line-code" list="catalogCodes" data-idx="${i}" placeholder="Cod." value="${r.code||''}"></td>
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
  function addLine(r){
    const c = initCur();
    c.lines.push(r);
    setCurLight(c);
    renderLines();
    recalcTotals();
  }
  function addCustomLine(){ addLine({code:'',desc:'',qty:1,price:0,done:false,doneBy:'',doneDate:''}); }
  function onLineEdit(e){
    const c = initCur();
    const i = e.target.dataset.idx;
    if (e.target.classList.contains('line-code')) {
      const v = e.target.value;
      c.lines[i].code = v;
      const hit = getCatalog().find(x=>x.code.toLowerCase()===String(v||'').toLowerCase());
      if (hit) {
        c.lines[i].desc = hit.desc;
        e.target.closest('tr')?.querySelector('.line-desc')?.setAttribute('value', hit.desc);
        const desc = e.target.closest('tr')?.querySelector('.line-desc');
        if (desc) desc.value = hit.desc;
      }
    }
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

  // ------------- Totali & Avanzamento -------------
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

  // ------------- Foto anteprima (ObjectURL) -------------
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

  // ------------- Archivio locale: contatori -------------
  window.renderArchiveLocal = function() {
    try {
      const arr = JSON.parse(localStorage.getItem('elip_archive') || '[]');
      let ok=0,no=0;
      arr.forEach(r => ((r.data_accettazione||'').toString().trim()? ok++ : no++));
      const el = $('#accCounters'); if (el) el.textContent = `Accettati: ${ok} — Da accettare: ${no}`;
    } catch {}
  };

  // ------------- Toast salvataggio -------------
  window.toastSaved = function(){
    const el = $('#toastSave'); if (!el) return;
    try { new bootstrap.Toast(el).show(); } catch {}
  };

  // ------------- Bind UI -------------
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
    $('#btnClear')?.addEventListener('click', (e)=>{ e.preventDefault(); const c=initCur(); setCurLight({ id:c.id, createdAt:c.createdAt, cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[] }); window.__elipPhotosQueue=[]; fillForm(); renderLines(); renderImages(); });
    $('#btnSave')?.addEventListener('click', async (e)=>{ e.preventDefault(); try{ await window.dbApi.saveToSupabase(false); }catch(err){ alert('Errore salvataggio: ' + (err?.message||err)); } });
    $('#imgInput')?.addEventListener('change', e => { window.__elipPhotosQueue = Array.from(e.target.files||[]); renderImages(); });

    // Catalogo
    $('#catalogSearch')?.addEventListener('input', e => renderCatalog(e.target.value));
    $('#btnAddCustom')?.addEventListener('click', addCustomLine);
    $('#btnEditCatalog')?.addEventListener('click', editCatalog);

    // Totali live
    ['cliente','articolo','ddt','telefono','email','dataInvio','dataAcc','dataScad','note'].forEach(id=>{
      const el = $('#'+id); if (el){ el.addEventListener('input', recalcTotals); el.addEventListener('change', recalcTotals); }
    });
  }

  // ------------- Init -------------
  document.addEventListener('DOMContentLoaded', async () => {
    ensureCatalog();
    buildDatalist();
    renderCatalog('');
    fillForm();
    renderLines();
    renderImages();
    bind();
    try { await window.dbApi.loadArchive(); } catch {}
    if (typeof window.renderArchiveLocal === 'function') window.renderArchiveLocal();
    try { window.dbApi.subscribeRealtime(); } catch {}
  });
})();
