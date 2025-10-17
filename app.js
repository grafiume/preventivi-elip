// v5.1 — Catalogo senza prezzi, IVA 22%, WhatsApp, immagini, XLS, archivio
const EURO = n => n.toLocaleString('it-IT',{style:'currency',currency:'EUR'});
const qs = s => document.querySelector(s);

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

function newId(){
  const d=new Date(); return `ELP-${d.getFullYear().toString().slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
}

function getCatalog(){ try{ return JSON.parse(localStorage.getItem('elip51_catalog')||'[]'); } catch(_){ return []; } }
function setCatalog(arr){ localStorage.setItem('elip51_catalog', JSON.stringify(arr)); }
function ensureCatalog(){ if(getCatalog().length===0) setCatalog(DEFAULT_CATALOG); }

function getCurrent(){ try{ return JSON.parse(localStorage.getItem('elip51_current')||'null'); } catch(_){ return null; } }
function setCurrent(obj){ localStorage.setItem('elip51_current', JSON.stringify(obj)); }
function getArchive(){ try{ return JSON.parse(localStorage.getItem('elip51_archive')||'[]'); } catch(_){ return []; } }
function setArchive(arr){ localStorage.setItem('elip51_archive', JSON.stringify(arr)); }

function getOrBootstrap(){
  let cur=getCurrent();
  if(!cur){
    cur={ id:newId(), createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', note:'', ivaPerc:22, lines:[], images:[] };
    setCurrent(cur);
  }
  return cur;
}

function renderCatalog(filter=""){
  const list=qs('#catalogList'); list.innerHTML='';
  const rows=getCatalog().filter(x=> (x.code+x.desc).toLowerCase().includes(filter.toLowerCase()));
  if(rows.length===0){ list.innerHTML='<li class="list-group-item text-muted">Nessuna voce…</li>'; return; }
  rows.forEach(x=>{
    const li=document.createElement('li');
    li.className='list-group-item d-flex align-items-center justify-content-between';
    li.innerHTML=`<div><span class="badge-pill me-2">${x.code}</span>${x.desc}</div>`;
    li.addEventListener('click', ()=> addLine({code:x.code, desc:x.desc, qty:1, price:0}));
    list.appendChild(li);
  });
}

function addLine(line){ const cur=getOrBootstrap(); cur.lines.push(line); setCurrent(cur); renderLines(); recalc(); }
function addCustomLine(){ addLine({code:'', desc:'', qty:1, price:0}); }

function renderLines(){
  const cur=getOrBootstrap();
  const body=qs('#linesBody'); body.innerHTML='';
  cur.lines.forEach((r,idx)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><input class="form-control form-control-sm line-code" data-idx="${idx}" value="${r.code||''}"></td>
      <td><input class="form-control form-control-sm line-desc" data-idx="${idx}" value="${r.desc||''}" placeholder="Descrizione…"></td>
      <td><input type="number" min="0" step="1" class="form-control form-control-sm text-end line-qty" data-idx="${idx}" value="${r.qty||1}"></td>
      <td><input type="number" min="0" step="0.01" class="form-control form-control-sm text-end line-price" data-idx="${idx}" value="${r.price||0}"></td>
      <td class="text-end" id="lineTot${idx}">€ 0,00</td>
      <td><button class="btn btn-sm btn-outline-danger" data-del="${idx}">✕</button></td>`;
    body.appendChild(tr);
  });
  body.oninput = onLineEdit;
  body.onclick = onLineDelete;
}

function onLineEdit(e){
  const cur=getOrBootstrap();
  const id=e.target.dataset.idx;
  if(e.target.classList.contains('line-code')) cur.lines[id].code=e.target.value;
  if(e.target.classList.contains('line-desc')) cur.lines[id].desc=e.target.value;
  if(e.target.classList.contains('line-qty')) cur.lines[id].qty=parseFloat(e.target.value)||0;
  if(e.target.classList.contains('line-price')) cur.lines[id].price=parseFloat(e.target.value)||0;
  setCurrent(cur); recalc();
}
function onLineDelete(e){
  const btn=e.target.closest('button[data-del]'); if(!btn) return;
  const idx=+btn.getAttribute('data-del');
  const cur=getOrBootstrap(); cur.lines.splice(idx,1); setCurrent(cur); renderLines(); recalc();
}

function recalc(){
  const cur=getOrBootstrap();
  ['cliente','articolo','ddt','telefono','email','note'].forEach(id=> cur[id]=qs('#'+id).value);
  let imponibile=0;
  cur.lines.forEach((r,i)=>{
    const lt=(r.qty||0)*(r.price||0); imponibile+=lt;
    const cell=qs('#lineTot'+i); if(cell) cell.textContent=EURO(lt);
  });
  const iva=imponibile*0.22, total=imponibile+iva;
  qs('#imponibile').textContent=EURO(imponibile);
  qs('#iva').textContent=EURO(iva);
  qs('#totale').textContent=EURO(total);
  setCurrent(cur);
}

function fillForm(){
  const cur=getOrBootstrap();
  qs('#quoteId').textContent=cur.id;
  ['cliente','articolo','ddt','telefono','email','note'].forEach(id=> qs('#'+id).value = cur[id]||'');
  renderImages();
}

/* Images */
function handleImages(files){
  const cur=getOrBootstrap();
  const promises=[...files].map(file=> new Promise(res=>{
    const reader=new FileReader();
    reader.onload=()=> res(reader.result);
    reader.readAsDataURL(file);
  }));
  Promise.all(promises).then(datas=>{
    cur.images = (cur.images||[]).concat(datas);
    setCurrent(cur); renderImages();
  });
}
function renderImages(){
  const cur=getOrBootstrap();
  const wrap=qs('#imgPreview'); wrap.innerHTML='';
  (cur.images||[]).forEach((src,idx)=>{
    const div=document.createElement('div'); div.className='thumb-wrap';
    div.innerHTML=`<img class="thumb" src="${src}"><button class="btn btn-sm btn-outline-danger" data-delimg="${idx}">✕</button>`;
    wrap.appendChild(div);
  });
  wrap.onclick = (e)=>{
    const b=e.target.closest('button[data-delimg]'); if(!b) return;
    const i=+b.getAttribute('data-delimg');
    const cur=getOrBootstrap(); cur.images.splice(i,1); setCurrent(cur); renderImages();
  };
}

/* Save / Archive */
function saveQuote(){
  const cur=getOrBootstrap();
  const arr=getArchive();
  const i=arr.findIndex(x=>x.id===cur.id); if(i>=0) arr[i]=cur; else arr.unshift(cur);
  setArchive(arr); alert('Preventivo salvato.');
}
function archiveQuote(){ saveQuote(); document.querySelector('[data-bs-target="#tab-archivio"]').click(); renderArchive(); }

/* JSON import/export */
function exportJSON(){
  const cur=getOrBootstrap();
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(cur,null,2)],{type:'application/json'}));
  a.download=cur.id+'.json'; a.click();
}
function importJSON(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{ const obj=JSON.parse(reader.result); localStorage.setItem('elip51_current', JSON.stringify(obj)); }
    catch(_){ alert('JSON non valido'); return; }
    renderLines(); fillForm(); recalc();
  };
  reader.readAsText(file);
}

/* Catalogo import/export/edit */
function exportCatalog(){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(getCatalog(),null,2)],{type:'application/json'}));
  a.download='catalogo-elip.json'; a.click();
}
function importCatalog(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{ const arr=JSON.parse(reader.result); if(!Array.isArray(arr)) throw 0; setCatalog(arr); renderCatalog(qs('#catalogSearch').value||''); }
    catch(_){ alert('Catalogo JSON non valido'); }
  };
  reader.readAsText(file);
}
function editCatalog(){
  const arr=getCatalog();
  const text=prompt('Modifica catalogo (JSON):', JSON.stringify(arr,null,2));
  if(!text) return;
  try{ const parsed=JSON.parse(text); if(!Array.isArray(parsed)) throw 0; setCatalog(parsed); renderCatalog(qs('#catalogSearch').value||''); }
  catch(_){ alert('JSON non valido'); }
}

/* PDF */
async function addHeader(doc,pad,cur){
  doc.setFontSize(16); doc.text('Preventivo', pad, 80);
  doc.setFontSize(10); const dateIT=new Date().toLocaleDateString('it-IT');
  doc.text(`Data: ${dateIT}  •  N°: ${cur.id}`, pad, 96);
  doc.setFontSize(11);
  doc.text('Cliente: '+(cur.cliente||'-'), pad, 116);
  doc.text('Articolo: '+(cur.articolo||'-'), pad, 132);
  doc.text('DDT: '+(cur.ddt||'-'), pad, 148);
  doc.text(`Telefono: ${cur.telefono||'-'}   Email: ${cur.email||'-'}`, pad, 164);
}
function addTotals(doc,pad,cur,startY){
  let imponibile=cur.lines.reduce((s,r)=>s+(r.qty||0)*(r.price||0),0);
  let iva=imponibile*0.22, total=imponibile+iva;
  let y=startY;
  doc.setFontSize(11); doc.text('Riepilogo', pad, y); y+=10;
  doc.setFontSize(10);
  doc.text('Imponibile: '+EURO(imponibile), pad, y); y+=12;
  doc.text('IVA (22%): '+EURO(iva), pad, y); y+=14;
  doc.setFontSize(12); doc.text('TOTALE: '+EURO(total), pad, y);
  return y+16;
}
async function pdfDettaglio(){
  const { jsPDF } = window.jspdf||{}; if(!jsPDF){ alert('Libreria PDF non caricata.'); return; }
  const cur=getOrBootstrap(), doc=new jsPDF({unit:'pt',format:'a4'}), pad=40;
  await addHeader(doc,pad,cur);
  const rows=cur.lines.length? cur.lines.map(r=>[r.code||'', r.desc||'', String(r.qty||0), EURO(r.price||0), EURO((r.qty||0)*(r.price||0))]) : [['','','0','€ 0,00','€ 0,00']];
  doc.autoTable({startY:190, head:[['Cod','Descrizione','Q.tà','Prezzo','Totale']], body:rows, styles:{fontSize:10,cellPadding:5}, headStyles:{fillColor:[13,110,253]},
    columnStyles:{0:{cellWidth:50},1:{cellWidth:260},2:{cellWidth:60,halign:'right'},3:{cellWidth:80,halign:'right'},4:{cellWidth:90,halign:'right'}}});
  let y=doc.lastAutoTable.finalY+12;
  const note=(cur.note||'').trim(); if(note){ doc.setFontSize(11); doc.text('NOTE', pad, y); y+=10; doc.setFontSize(10); const w=doc.splitTextToSize(note,455); doc.text(w, pad, y); y+=w.length*12+6; }
  y=addTotals(doc,pad,cur,y+4);
  for(const src of (cur.images||[])){
    const img=new Image(); img.src=src; await img.decode();
    const ratio = Math.min(500/img.width, 500/img.height);
    const w = Math.round(img.width*ratio), h=Math.round(img.height*ratio);
    doc.addPage(); doc.setFontSize(12); doc.text('Immagine allegata', pad, 80);
    doc.addImage(src, 'JPEG', pad, 100, w, h);
  }
  const url=URL.createObjectURL(doc.output('blob')); const a=qs('#btnDownload'); a.href=url; a.download=cur.id+'-dettaglio.pdf'; a.classList.remove('d-none'); a.click();
}
async function pdfTotale(){
  const { jsPDF } = window.jspdf||{}; if(!jsPDF){ alert('Libreria PDF non caricata.'); return; }
  const cur=getOrBootstrap(), doc=new jsPDF({unit:'pt',format:'a4'}), pad=40;
  await addHeader(doc,pad,cur);
  const rows=cur.lines.length? cur.lines.map(r=>[r.code||'', r.desc||'']) : [['','Nessuna voce']];
  doc.autoTable({startY:190, head:[['Cod','Descrizione incluse']], body:rows, styles:{fontSize:10,cellPadding:5}, headStyles:{fillColor:[13,110,253]}, columnStyles:{0:{cellWidth:60},1:{cellWidth:380}}});
  let y=doc.lastAutoTable.finalY+12;
  const note=(cur.note||'').trim(); if(note){ doc.setFontSize(11); doc.text('NOTE', pad, y); y+=10; doc.setFontSize(10); const w=doc.splitTextToSize(note,455); doc.text(w, pad, y); y+=w.length*12+6; }
  y=addTotals(doc,pad,cur,y+4);
  for(const src of (cur.images||[])){
    const img=new Image(); img.src=src; await img.decode();
    const ratio = Math.min(500/img.width, 500/img.height);
    const w = Math.round(img.width*ratio), h=Math.round(img.height*ratio);
    doc.addPage(); doc.setFontSize(12); doc.text('Immagine allegata', pad, 80);
    doc.addImage(src, 'JPEG', pad, 100, w, h);
  }
  const url=URL.createObjectURL(doc.output('blob')); const a=qs('#btnDownload'); a.href=url; a.download=cur.id+'-totale.pdf'; a.classList.remove('d-none'); a.click();
}

/* Share */
function shareMail(){
  const cur=getOrBootstrap();
  const subject=encodeURIComponent('Preventivo '+cur.id+' - '+(cur.cliente||''));
  const lines = cur.lines.map(r=>`- ${r.code||''} ${r.desc||''} x${r.qty||0}`).join('%0A');
  const body=encodeURIComponent(`Buongiorno,%0A%0Ain allegato il preventivo.%0ACliente: ${cur.cliente||'-'}%0AArticolo: ${cur.articolo||'-'}%0ATotale: ${qs('#totale').textContent}%0A%0AVoci:%0A`)+lines;
  window.location.href='mailto:'+(cur.email||'')+'?subject='+subject+'&body='+body;
}
function shareWA(){
  const cur=getOrBootstrap();
  const lines = cur.lines.map(r=>`• ${r.code||''} ${r.desc||''} x${r.qty||0}`).join('%0A');
  const msg = encodeURIComponent(`Preventivo ${cur.id}%0ACliente: ${cur.cliente||'-'}%0ATotale: ${qs('#totale').textContent}%0A%0AVoci:%0A`)+lines;
  window.open('https://wa.me/?text='+msg, '_blank');
}

/* XLS */
function exportXLS(){
  const cur=getOrBootstrap();
  const data=[["Codice","Descrizione","Quantità","Prezzo","Totale riga"]];
  cur.lines.forEach(r=> data.push([r.code||"", r.desc||"", r.qty||0, r.price||0, (r.qty||0)*(r.price||0)]));
  const ws = XLSX.utils.aoa_to_sheet(data);
  const meta=[["ID Preventivo", cur.id],["Cliente",cur.cliente],["Articolo",cur.articolo],["DDT",cur.ddt],["Telefono",cur.telefono],["Email",cur.email],["Imponibile", qs('#imponibile').textContent],["IVA (22%)", qs('#iva').textContent],["Totale", qs('#totale').textContent]];
  const wsMeta = XLSX.utils.aoa_to_sheet(meta);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsMeta, "Dati");
  XLSX.utils.book_append_sheet(wb, ws, "Righe");
  const wbout = XLSX.write(wb, {type:'array', bookType:'xlsx'});
  const blob = new Blob([wbout], {type:"application/octet-stream"});
  const url=URL.createObjectURL(blob); const a=qs('#btnDownload'); a.href=url; a.download=cur.id+'.xlsx'; a.classList.remove('d-none'); a.click();
}

/* Archivio */
function renderArchive(){
  const arr=getArchive();
  const q=(qs('#filterQuery').value||'').toLowerCase();
  const body=qs('#archBody'); body.innerHTML='';
  arr.filter(r=> (r.cliente||'').toLowerCase().includes(q)).forEach(rec=>{
    const tr=document.createElement('tr');
    const dateIt=new Date(rec.createdAt).toLocaleDateString('it-IT');
    const tot = rec.lines.reduce((s,r)=>s+(r.qty||0)*(r.price||0),0)*1.22;
    tr.innerHTML=`
      <td>${rec.id}</td><td>${dateIt}</td><td>${rec.cliente||''}</td>
      <td>${rec.articolo||''}</td><td>${rec.ddt||''}</td><td>${EURO(tot)}</td>
      <td><button class="btn btn-sm btn-outline-primary" data-open="${rec.id}">Apri</button></td>`;
    body.appendChild(tr);
  });
  body.onclick=(e)=>{
    const btn=e.target.closest('button[data-open]'); if(!btn) return;
    const id=btn.getAttribute('data-open');
    const rec=getArchive().find(x=>x.id===id); if(!rec) return;
    localStorage.setItem('elip51_current', JSON.stringify(rec));
    document.querySelector('[data-bs-target=\"#tab-editor\"]').click();
    renderLines(); fillForm(); recalc(); qs('#quoteId').textContent=rec.id; window.scrollTo({top:0,behavior:'smooth'});
  };
}

/* Init */
function newQuote(){
  localStorage.removeItem('elip51_current'); const cur=getOrBootstrap();
  qs('#quoteId').textContent=cur.id; renderLines(); fillForm(); recalc();
}

function bindAll(){
  qs('#btnNew').addEventListener('click', newQuote);
  qs('#btnSave').addEventListener('click', saveQuote);
  qs('#btnArchive').addEventListener('click', archiveQuote);
  qs('#btnPDFDett').addEventListener('click', pdfDettaglio);
  qs('#btnPDFTot').addEventListener('click', pdfTotale);
  qs('#btnXLS').addEventListener('click', exportXLS);
  qs('#btnMail').addEventListener('click', shareMail);
  qs('#btnWA').addEventListener('click', shareWA);
  qs('#btnExport').addEventListener('click', exportJSON);
  qs('#btnImport').addEventListener('click', ()=> qs('#jsonImport').click());
  qs('#jsonImport').addEventListener('change', e=> e.target.files[0] && importJSON(e.target.files[0]));

  qs('#catalogSearch').addEventListener('input', e=> renderCatalog(e.target.value));
  qs('#btnAddCustom').addEventListener('click', addCustomLine);
  qs('#btnEditCatalog').addEventListener('click', editCatalog);
  qs('#btnExportCatalog').addEventListener('click', exportCatalog);
  qs('#btnImportCatalog').addEventListener('click', ()=> qs('#catalogImport').click());
  qs('#catalogImport').addEventListener('change', e=> e.target.files[0] && importCatalog(e.target.files[0]));

  ['cliente','articolo','ddt','telefono','email','note'].forEach(id=>{
    qs('#'+id).addEventListener('input', recalc);
    qs('#'+id).addEventListener('change', recalc);
  });

  qs('#imgInput').addEventListener('change', e=> e.target.files.length && handleImages(e.target.files));

  qs('#btnReloadArch').addEventListener('click', renderArchive);
  qs('#filterQuery').addEventListener('input', renderArchive);
}

function init(){
  ensureCatalog();
  renderCatalog();
  renderLines();
  fillForm();
  recalc();
  bindAll();
  qs('#quoteId').textContent=getOrBootstrap().id;
  renderArchive();
}
document.addEventListener('DOMContentLoaded', init);
