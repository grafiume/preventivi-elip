
/* Preventivi ELIP — app.js (2025-10-23 PDF-JPG+LOAD SERVER PHOTOS)
   - Dopo openFromArchive: carica foto da DB e mostra anteprime 164x164 (server)
   - PDF anteprima: aggiunge JPG di anteprima generato via canvas (mostrato nel modal)
*/
(function(){
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const EURO = n => (n||0).toLocaleString('it-IT', { style:'currency', currency:'EUR' });
  const DTIT = s => s ? new Date(s).toLocaleDateString('it-IT') : '';

  /* ===== Minimal pieces reused from previous versions (only what's needed here) ===== */
  function getCur(){ try { return JSON.parse(localStorage.getItem('elip_current') || 'null'); } catch { return null; } }
  function setCurLight(o){ try { localStorage.setItem('elip_current', JSON.stringify(o)); } catch {} }
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

  function updateAccPill(){
    const has = ($('#dataAcc')?.value || '').trim().length > 0;
    const pill = $('#okPill');
    if (!pill) return;
    pill.textContent = has ? '● OK' : '● NO';
    pill.classList.toggle('acc-yes', has);
    pill.classList.toggle('acc-no', !has);
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
    updateProgress();
    updateAccPill();
  }
  function fillForm(){
    const c = initCur();
    const ids = ['cliente','articolo','ddt','telefono','email','dataInvio','dataAcc','dataScad','note'];
    ids.forEach(id => { const el = $('#'+id); if (el) c[id] = el.value = c[id] || ''; });
    const q = $('#quoteId'); if (q) q.textContent = c.id;
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

  /* ===== Archive helpers ===== */
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
    // carica le foto server per questo numero e mostrale
    try {
      window.dbApi?.loadPhotosFor(cur.id).then(urls => {
        if (typeof window.__elipShowServerPhotos === 'function') window.__elipShowServerPhotos(urls);
      });
    } catch(e){ console.warn('[loadPhotosFor]', e); }
    const btn = document.querySelector('[data-bs-target="#tab-editor"]');
    if (btn) { try { new bootstrap.Tab(btn).show(); } catch { btn.click(); } }
  }
  window.openFromArchive = openFromArchive;

  /* ===== PDF + JPG preview ===== */
  function collectFlat(c){
    let imp=0; (c.lines||[]).forEach(r=> imp += (+r.qty||0)*(+r.price||0));
    const iva = imp*0.22, tot = imp+iva;
    return { imp, iva, tot };
  }
  async function makePDF(detail){
    const c = initCur();
    const jsPDF = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : null;
    if (!jsPDF) { alert('jsPDF non disponibile'); return; }
    const doc = new jsPDF({ unit:'pt', format:'a4' });
    const title = `Preventivo ${c.id}`;
    doc.setFontSize(16); doc.text(title, 40, 40);
    doc.setFontSize(11);
    doc.text(`Cliente: ${c.cliente||''}`, 40, 70);
    doc.text(`Articolo: ${c.articolo||''}`, 40, 90);
    doc.text(`DDT: ${c.ddt||''}`, 40, 110);
    doc.text(`Data invio: ${DTIT(c.dataInvio)||''}`, 40, 130);
    doc.text(`Data accettazione: ${DTIT(c.dataAcc)||''}`, 40, 150);
    doc.text(`Scadenza lavori: ${DTIT(c.dataScad)||''}`, 40, 170);
    if (detail && doc.autoTable) {
      const rows = (c.lines||[]).map(r => [r.code||'', r.desc||'', r.qty||0, (r.price||0), ((+r.qty||0)*(+r.price||0))]);
      if (rows.length) {
        doc.autoTable({
          startY: 190,
          head: [['Cod', 'Descrizione', 'Q.tà', 'Prezzo €', 'Tot. €']],
          body: rows,
          styles: { fontSize: 9, halign:'right' },
          columnStyles: { 0:{halign:'left'}, 1:{halign:'left'} }
        });
      }
    }
    const { imp, iva, tot } = collectFlat(c);
    let y = detail && doc.lastAutoTable ? (doc.lastAutoTable.finalY || 190) + 20 : 200;
    doc.setFontSize(12);
    doc.text(`Imponibile: ${EURO(imp)}`, 40, y); y+=18;
    doc.text(`IVA (22%): ${EURO(iva)}`, 40, y); y+=18;
    doc.text(`TOTALE: ${EURO(tot)}`, 40, y);

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const ifr = $('#pdfFrame'); if (ifr) ifr.src = url;

    // Ensure an IMG holder exists inside the modal for JPG preview
    const modalBody = document.querySelector('#pdfModal .modal-body');
    if (modalBody && !document.getElementById('pdfJPGPreview')){
      const img = document.createElement('img');
      img.id = 'pdfJPGPreview';
      img.alt = 'Anteprima JPG';
      img.style.display='block';
      img.style.maxWidth='100%';
      img.style.marginTop='12px';
      modalBody.appendChild(img);
    }

    const jpgDataUrl = await makeJPGPreviewCanvas(detail);
    const imgEl = document.getElementById('pdfJPGPreview');
    if (imgEl) imgEl.src = jpgDataUrl;
    const aJPG = document.getElementById('btnJPG');
    if (aJPG) { aJPG.href = jpgDataUrl; aJPG.download = `${c.id}.jpg`; }

    const a = $('#btnDownload'); if (a) { a.href = url; a.download = `${c.id}.pdf`; }
    const modalEl = $('#pdfModal'); if (modalEl) {
      try { new bootstrap.Modal(modalEl).show(); } catch { modalEl.style.display='block'; }
    }
  }

  async function makeJPGPreviewCanvas(detail){
    // Render semplice su canvas A4 proporzionato (794x1123 ~ 96dpi) per compatibilità
    const c = initCur();
    const { imp, iva, tot } = collectFlat(c);
    const W = 794, H = 1123;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    // bg
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px Arial';
    ctx.fillText(`Preventivo ${c.id}`, 40, 40);
    ctx.font = '14px Arial';
    ctx.fillText(`Cliente: ${c.cliente||''}`, 40, 80);
    ctx.fillText(`Articolo: ${c.articolo||''}`, 40, 100);
    ctx.fillText(`DDT: ${c.ddt||''}`, 40, 120);
    ctx.fillText(`Data invio: ${DTIT(c.dataInvio)||''}`, 40, 140);
    ctx.fillText(`Accettazione: ${DTIT(c.dataAcc)||''}`, 40, 160);
    ctx.fillText(`Scadenza: ${DTIT(c.dataScad)||''}`, 40, 180);
    // righe (preview compatta)
    ctx.font = '12px Arial';
    let y = 210;
    const maxRows = detail ? 12 : 6;
    const lines = (c.lines||[]).slice(0, maxRows);
    if (lines.length){
      ctx.fillText('Righe lavorazione:', 40, y); y+=18;
      for (const r of lines){
        const t = `${r.code||''}  ${String(r.desc||'').slice(0,60)}  x${r.qty||0}  €${(+r.price||0).toFixed(2)}`;
        ctx.fillText(t, 40, y); y+=16;
      }
      if ((c.lines||[]).length > maxRows){
        ctx.fillText(`… altre ${(c.lines.length - maxRows)} righe`, 40, y+4);
        y += 20;
      }
    }
    // totals
    y = Math.max(y+10, H-100);
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`Imponibile: ${EURO(imp)}`, 40, y); y+=20;
    ctx.fillText(`IVA 22%: ${EURO(iva)}`, 40, y); y+=20;
    ctx.fillText(`TOTALE: ${EURO(tot)}`, 40, y);

    return canvas.toDataURL('image/jpeg', 0.85);
  }

  /* ===== Init: hook buttons ===== */
  function bind(){
    document.getElementById('btnPDFDett')?.addEventListener('click', ()=> makePDF(true));
    document.getElementById('btnPDFTot')?.addEventListener('click', ()=> makePDF(false));
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    bind();
    // non tocco altro: il resto della tua logica resta invariata
  });
})();
