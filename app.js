/* Preventivi ELIP — app.js (2025-10-23, Archivio: % avanzamento + Chiusa + stato accettazione; fix openFromArchive) */
(function(){
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const EURO = n => (n||0).toLocaleString('it-IT', { style:'currency', currency:'EUR' });
  const DTIT = s => s ? new Date(s).toLocaleDateString('it-IT') : '';

  /* ====== Catalogo ====== */
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
      if (!raw) {
        localStorage.setItem('elip_catalog', JSON.stringify(DEFAULT_CATALOG));
      } else {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          localStorage.setItem('elip_catalog', JSON.stringify(DEFAULT_CATALOG));
        }
      }
    } catch {
      localStorage.setItem('elip_catalog', JSON.stringify(DEFAULT_CATALOG));
    }
  }
  function getCatalog(){ try { return JSON.parse(localStorage.getItem('elip_catalog')||'[]'); } catch { return []; } }
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

  /* ====== Stato corrente ====== */
  window.__elipPhotosQueue = [];
  function getCur(){ try { return JSON.parse(localStorage.getItem('elip_current') || 'null'); } catch { return null; } }
  function setCurLight(o){
    try {
      if (!o) { localStorage.removeItem('elip_current'); return; }
      const { images, img, photoData, previewData, ...rest } = o;
      if (typeof rest.note === 'string' && rest.note.length > 4000) rest.note = rest.note.slice(0,4000);
      localStorage.setItem('elip_current', JSON.stringify(rest));
    } catch { try{ localStorage.removeItem('elip_current'); }catch{} }
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

  /* ====== Pill accettazione ====== */
  function updateAccPill(){
    const has = ($('#dataAcc')?.value || '').trim().length > 0;
    const pill = $('#okPill');
    if (!pill) return;
    pill.textContent = has ? '● OK' : '● NO';
    pill.classList.toggle('acc-yes', has);
    pill.classList.toggle('acc-no', !has);
  }

  /* ====== Progress & Totali (Editor) ====== */
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
    updateAccPill();
  }

  /* ====== Editor righe ====== */
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
        <td><input class="form-control form-control-sm line-code" list="catalogCodes" data-idx="${i}" placeholder="Cod." value="${r.code||''}"></td>
        <td><input class="form-control form-control-sm line-desc" data-idx="${i}" placeholder="Descrizione…" value="${r.desc||''}"></td>
        <td><input type="number" min="0" step="1" class="form-control form-control-sm text-end line-qty" data-idx="${i}" value="${r.qty||1}"></td>
        <td><input type="number" min="0" step="0.01" class="form-control form-control-sm text-end line-price" data-idx="${i}" value="${r.price||0}"></td>
        <td class="text-end" id="lineTot${i}">€ 0,00</td>
        <td class="text-center">${statoBadge}</td>
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
    if (e.target.classList.contains('line-code')) {
      const v = e.target.value;
      c.lines[i].code = v;
      const hit = getCatalog().find(x=>x.code.toLowerCase()===String(v||'').toLowerCase());
      if (hit) {
        c.lines[i].desc = hit.desc;
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
    renderLines();
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

  /* ====== Helpers ====== */
  function snapshotFormToCur(){
    const c = initCur();
    c.cliente   = ($('#cliente')?.value || '').trim();
    c.articolo  = ($('#articolo')?.value || '').trim();
    c.ddt       = ($('#ddt')?.value || '').trim();
    c.telefono  = ($('#telefono')?.value || '').trim();
    c.email     = ($('#email')?.value || '').trim();
    c.dataInvio = ($('#dataInvio')?.value || '').trim();
    c.dataAcc   = ($('#dataAcc')?.value || '').trim();
    c.dataScad  = ($('#dataScad')?.value || '').trim();
    c.note      = ($('#note')?.value || '');
    setCurLight(c);
    return c;
  }

  /* ====== Archivio: progress percent + Chiusa + stato accettazione ====== */
  function coerceArray(a){
    if (!a) return [];
    if (Array.isArray(a)) return a;
    try { const p = JSON.parse(a); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  function lineHasWork(e){
    const desc = (e.desc ?? e.descrizione ?? e.DESCRIZIONE ?? '').toString().trim();
    const qty  = Number(e.qty ?? e.qta ?? e.quantita ?? 0) || 0;
    const price= Number(e.price ?? e.prezzo ?? 0) || 0;
    return desc !== '' || qty > 0 || price > 0;
  }
  function progressPctFromLines(linee){
    const arr = coerceArray(linee);
    let toDo=0, done=0;
    for (const e of arr){
      if (lineHasWork(e)) {
        toDo++;
        const doneDate = (e.doneDate ?? e.data_fine ?? '').toString().trim();
        if (doneDate) done++;
      }
    }
    return toDo ? Math.round((done/toDo)*100) : 0;
  }

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
        ? '<span class="badge text-bg-success ms-2">Accettata</span>';
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
    computeAccCounters(rows);
  }

  /* ====== Bind & Init ====== */
  function clearEditorToNew(){
    const fresh = { id: nextNumero(), createdAt: new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[] };
    setCurLight(fresh);
    window.__elipPhotosQueue = [];
    $('#imgInput') && ($('#imgInput').value = '');
    $('#imgPreview') && ($('#imgPreview').innerHTML = '');
    fillForm(); renderLines();
  }

  function bind(){
    $('#btnNew')?.addEventListener('click', (e)=>{ e.preventDefault(); clearEditorToNew(); });
    $('#btnClear')?.addEventListener('click', (e)=>{
      e.preventDefault();
      const c = initCur();
      setCurLight({ id:c.id, createdAt:c.createdAt, cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[] });
      window.__elipPhotosQueue = [];
      $('#imgInput') && ($('#imgInput').value = '');
      $('#imgPreview') && ($('#imgPreview').innerHTML = '');
      fillForm(); renderLines();
    });
    $('#btnSave')?.addEventListener('click', async (e)=>{
      e.preventDefault();
      snapshotFormToCur();
      const ok = await window.dbApi.saveToSupabase(false);
      if (ok) clearEditorToNew();
    });

    $('#archBody')?.addEventListener('click', (e)=>{
      const b = e.target.closest('button[data-open-num]');
      if (b){ openFromArchive(b.getAttribute('data-open-num')); }
    });

    $('#dataAcc')?.addEventListener('input', updateAccPill);
    $('#dataAcc')?.addEventListener('change', updateAccPill);

    // Catalogo quick search
    $('#catalogSearch')?.addEventListener('input', e => {
      const ul = $('#catalogList'); if (!ul) return;
      const q = (e.target.value||'').toLowerCase();
      const rows = getCatalog().filter(x => (x.code+' '+x.desc).toLowerCase().includes(q));
      ul.innerHTML = '';
      if (rows.length===0) { ul.innerHTML = '<li class="list-group-item text-muted">Nessuna voce…</li>'; return; }
      rows.forEach(x => {
        const li = document.createElement('li');
        li.className='list-group-item';
        li.textContent=`${x.code} - ${x.desc}`;
        li.addEventListener('click',()=>{
          const c = initCur();
          c.lines.push({code:x.code,desc:x.desc,qty:1,price:0,done:false,doneBy:'',doneDate:''});
          setCurLight(c); renderLines(); recalcTotals();
        });
        ul.appendChild(li);
      });
    });

    // Filtri archivio
    $('#filterQuery')?.addEventListener('input', renderArchiveTable);
    $('#fltAll')?.addEventListener('click', (e)=>{ e.preventDefault(); $('#fltAll').classList.add('active'); $('#fltOk')?.classList.remove('active'); $('#fltNo')?.classList.remove('active'); renderArchiveTable(); });
    $('#fltOk')?.addEventListener('click', (e)=>{ e.preventDefault(); $('#fltOk').classList.add('active'); $('#fltAll')?.classList.remove('active'); $('#fltNo')?.classList.remove('active'); renderArchiveTable(); });
    $('#fltNo')?.addEventListener('click', (e)=>{ e.preventDefault(); $('#fltNo').classList.add('active'); $('#fltAll')?.classList.remove('active'); $('#fltOk')?.classList.remove('active'); renderArchiveTable(); });
  }

  function renderInitialCatalog(){
    const ul = $('#catalogList'); if (!ul) return;
    const rows = getCatalog();
    ul.innerHTML = '';
    rows.forEach(x => {
      const li = document.createElement('li');
      li.className='list-group-item';
      li.textContent=`${x.code} - ${x.desc}`;
      li.addEventListener('click',()=>{
        const c = initCur();
        c.lines.push({code:x.code,desc:x.desc,qty:1,price:0,done:false,doneBy:'',doneDate:''});
        setCurLight(c); renderLines(); recalcTotals();
      });
      ul.appendChild(li);
    });
  }

  async function init(){
    ensureCatalog();
    buildDatalist();
    renderInitialCatalog();
    fillForm();
    renderLines();
    try { await window.dbApi.loadArchive(); } catch {}
    renderArchiveTable();
    try { window.dbApi.subscribeRealtime(); } catch {}
    bind();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
