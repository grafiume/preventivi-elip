
/* Preventivi ELIP — app.js (quickfix 2025-10-23)
   - Carica Archivio da Supabase all'avvio e lo renderizza subito
   - Inizializza e mostra il Catalogo (voci riparazione) all'avvio
   - Espone window.openFromArchive
*/
(function(){
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const EURO = n => (n||0).toLocaleString('it-IT', { style:'currency', currency:'EUR' });
  const DTIT = s => s ? new Date(s).toLocaleDateString('it-IT') : '';

  /* ===== Catalogo ===== */
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
  function getCatalog(){
    try {
      const raw = localStorage.getItem('elip_catalog');
      if (!raw) return DEFAULT_CATALOG.slice();
      const arr = JSON.parse(raw);
      return Array.isArray(arr) && arr.length ? arr : DEFAULT_CATALOG.slice();
    } catch { return DEFAULT_CATALOG.slice(); }
  }
  function setCatalog(rows){ try { localStorage.setItem('elip_catalog', JSON.stringify(rows||[])); } catch {} }
  function ensureCatalog(){ const arr = getCatalog(); if (!arr.length) setCatalog(DEFAULT_CATALOG); }
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

  /* ===== Stato corrente minimal ===== */
  function getCur(){ try { return JSON.parse(localStorage.getItem('elip_current') || 'null'); } catch { return null; } }
  function setCurLight(o){ try { localStorage.setItem('elip_current', JSON.stringify(o||{})); } catch {} }
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

  /* ===== Editor righe ===== */
  function addLine(r){
    const c = initCur();
    c.lines.push(r);
    setCurLight(c);
    renderLines();
    recalcTotals();
  }
  function renderLines(){
    const c = initCur();
    const body = $('#linesBody'); if (!body) return;
    body.innerHTML = '';
    (c.lines||[]).forEach((r,i) => {
      const statoBadge = r.doneDate && String(r.doneDate).trim()
        ? '<span class="badge text-bg-success">OK</span>'
        : '<span class="badge text-bg-danger">NO</span>';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input class="form-control form-control-sm line-code" data-idx="${i}" value="${r.code||''}"></td>
        <td><input class="form-control form-control-sm line-desc" data-idx="${i}" value="${r.desc||''}"></td>
        <td><input type="number" min="0" step="1" class="form-control form-control-sm text-end line-qty" data-idx="${i}" value="${r.qty||1}"></td>
        <td><input type="number" min="0" step="0.01" class="form-control form-control-sm text-end line-price" data-idx="${i}" value="${r.price||0}"></td>
        <td class="text-end" id="lineTot${i}">€ 0,00</td>
        <td class="text-center">${statoBadge}</td>
        <td><input class="form-control form-control-sm line-operator" data-idx="${i}" value="${r.doneBy||''}"></td>
        <td><input type="date" class="form-control form-control-sm line-date" data-idx="${i}" value="${r.doneDate||''}"></td>
        <td><button class="btn btn-sm btn-outline-danger" data-del="${i}">✕</button></td>`;
      body.appendChild(tr);
    });
    body.oninput = (e)=>{
      const c = initCur();
      const i = e.target.dataset.idx;
      if (e.target.classList.contains('line-desc')) c.lines[i].desc = e.target.value;
      if (e.target.classList.contains('line-code')) c.lines[i].code = e.target.value;
      if (e.target.classList.contains('line-qty')) c.lines[i].qty = parseFloat(e.target.value)||0;
      if (e.target.classList.contains('line-price')) c.lines[i].price = parseFloat(e.target.value)||0;
      if (e.target.classList.contains('line-operator')) c.lines[i].doneBy = e.target.value;
      if (e.target.classList.contains('line-date')) c.lines[i].doneDate = e.target.value;
      setCurLight(c);
      renderLines(); recalcTotals();
    };
    body.onclick = (e)=>{
      const btn = e.target.closest('button[data-del]');
      if (btn) {
        const c = initCur();
        const i = +btn.getAttribute('data-del');
        c.lines.splice(i,1);
        setCurLight(c);
        renderLines();
      }
    };
    recalcTotals();
  }
  function recalcTotals(){
    const c = initCur();
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
  }

  /* ===== Archivio ===== */
  function passFilter(r, mode, q){
    const hitTxt = (txt) => (String(txt||'').toLowerCase().includes(q));
    const accepted = !!(r.data_accettazione);
    if (mode==='ok' && !accepted) return false;
    if (mode==='no' && accepted) return false;
    if (q && !(hitTxt(r.cliente)||hitTxt(r.articolo)||hitTxt(r.numero)||hitTxt(r.ddt))) return false;
    return true;
  }
  function progressPctFromLines(linee){
    const arr = Array.isArray(linee) ? linee : [];
    let toDo=0, done=0;
    for (const e of arr){
      const has = (e.desc||'').trim()!=='' || (+e.qty||0)>0 || (+e.price||0)>0;
      if (has) { toDo++; if ((e.doneDate||'').trim()) done++; }
    }
    return toDo ? Math.round((done/toDo)*100) : 0;
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
      const pct = progressPctFromLines(r.linee);
      const isAccepted = !!(r.data_accettazione);
      const accBadge = isAccepted
        ? '<span class="badge text-bg-success ms-2">Accettata</span>'
        : '<span class="badge text-bg-danger ms-2">Non accettata</span>';

      const statoHtml = (pct === 100)
        ? `<span class="badge text-bg-primary">Chiusa</span> <span class="small text-muted ms-1">${pct}%</span>`
        : `<span class="badge text-bg-secondary">${pct}%</span>${accBadge}`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.numero||''}</td>
        <td>${DTIT(r.created_at||r.data_invio)}</td>
        <td>${r.cliente||''}</td>
        <td>${r.articolo||''}</td>
        <td>${r.ddt||''}</td>
        <td class="text-end">${EURO(r.imponibile||0)}</td>
        <td>${DTIT(r.data_accettazione)}</td>
        <td>${DTIT(r.data_scadenza)}</td>
        <td>${statoHtml}</td>
        <td><button class="btn btn-sm btn-outline-primary" data-open-num="${r.numero}">Apri</button></td>`;
      tbody.appendChild(tr);
    });
  }
  window.renderArchiveLocal = function(){ try { renderArchiveTable(); } catch{} };

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
    const btn = document.querySelector('[data-bs-target="#tab-editor"]');
    if (btn) { try { new bootstrap.Tab(btn).show(); } catch { btn.click(); } }
  }
  window.openFromArchive = openFromArchive;

  /* ===== Init ===== */
  async function init(){
    // Catalogo
    ensureCatalog();
    buildDatalist();
    renderCatalog('');

    // Editor base
    initCur();
    renderLines();

    // Archivio: carica dal DB e renderizza
    try {
      if (window.dbApi?.loadArchive) {
        await window.dbApi.loadArchive();
      }
    } catch(e){ console.warn('[loadArchive]', e); }
    renderArchiveTable();

    // Filtri archivio
    $('#filterQuery')?.addEventListener('input', renderArchiveTable);
    $('#fltAll')?.addEventListener('click', (e)=>{ e.preventDefault(); $('#fltAll').classList.add('active'); $('#fltOk')?.classList.remove('active'); $('#fltNo')?.classList.remove('active'); renderArchiveTable(); });
    $('#fltOk')?.addEventListener('click', (e)=>{ e.preventDefault(); $('#fltOk').classList.add('active'); $('#fltAll')?.classList.remove('active'); $('#fltNo')?.classList.remove('active'); renderArchiveTable(); });
    $('#fltNo')?.addEventListener('click', (e)=>{ e.preventDefault(); $('#fltNo').classList.add('active'); $('#fltAll')?.classList.remove('active'); $('#fltOk')?.classList.remove('active'); renderArchiveTable(); });

    $('#archBody')?.addEventListener('click', (e)=>{
      const b = e.target.closest('button[data-open-num]');
      if (b){ openFromArchive(b.getAttribute('data-open-num')); }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
