// v5.0 Preventivi ELIP Sprint – Catalogo tap-to-add, quantità, sconto, IVA toggle, JSON import/export, PDF
const EURO = n => n.toLocaleString('it-IT',{style:'currency',currency:'EUR'});
const qs = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];

const DEFAULT_CATALOG = [
  {code:"05", desc:"Smontaggio completo del motore sistematico", price: 80},
  {code:"29", desc:"Lavaggio componenti e trattamento termico avvolgimenti", price: 60},
  {code:"06", desc:"Verifiche meccaniche alberi/alloggi cuscinetti + elettriche avvolgimenti", price: 70},
  {code:"07", desc:"Tornitura, smicatura ed equilibratura rotore", price: 110},
  {code:"22", desc:"Sostituzione collettore con recupero avvolgimento", price: 150},
  {code:"01", desc:"Avvolgimento indotto con recupero collettore", price: 220},
  {code:"01C", desc:"Avvolgimento indotto con sostituzione collettore", price: 320},
  {code:"08", desc:"Isolamento statore", price: 95},
  {code:"02", desc:"Avvolgimento statore", price: 280},
  {code:"31", desc:"Lavorazioni meccaniche albero", price: 90},
  {code:"32", desc:"Lavorazioni meccaniche flange", price: 85},
  {code:"19", desc:"Sostituzione spazzole", price: 30},
  {code:"20", desc:"Sostituzione molle premispazzole", price: 25},
  {code:"21", desc:"Sostituzione cuscinetti", price: 60},
  {code:"23", desc:"Sostituzione tenuta meccanica", price: 75},
  {code:"26", desc:"Sostituzione guarnizioni/paraolio", price: 45},
  {code:"30", desc:"Montaggio, collaudo e verniciatura", price: 120},
  {code:"MISC", desc:"Riga libera (personalizzata)", price: 0}
];

function newId(){
  const d=new Date();
  return `SPR-${d.getFullYear().toString().slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
}

function getCatalog(){ try{ return JSON.parse(localStorage.getItem('elip_catalog')||'[]'); } catch(_){ return []; } }
function setCatalog(arr){ localStorage.setItem('elip_catalog', JSON.stringify(arr)); }
function ensureCatalog(){ if(getCatalog().length===0){ setCatalog(DEFAULT_CATALOG); } }
function getCurrent(){ try{ return JSON.parse(localStorage.getItem('elip_current')||'null'); } catch(_){ return null; } }
function setCurrent(obj){ localStorage.setItem('elip_current', JSON.stringify(obj)); }

function renderCatalog(filter=""){
  const list=qs('#catalogList'); list.innerHTML='';
  const rows=getCatalog().filter(x=> (x.code+x.desc).toLowerCase().includes(filter.toLowerCase()));
  if(rows.length===0){ list.innerHTML=`<li class="list-group-item text-muted">Nessuna voce…</li>`; return; }
  rows.forEach(x=>{
    const li=document.createElement('li');
    li.className='list-group-item d-flex align-items-center justify-content-between';
    li.innerHTML=`<div><span class="badge-pill me-2">${x.code}</span>${x.desc}</div><div class="text-muted">${EURO(x.price)}</div>`;
    li.addEventListener('click', ()=> addLineFromCatalog(x));
    list.appendChild(li);
  });
}

function addLineFromCatalog(x){
  const cur=getOrBootstrap();
  cur.lines.push({ code:x.code, desc:x.desc, qty:1, price:x.price });
  setCurrent(cur);
  renderLines(); recalc();
}

function addCustomLine(){
  const cur=getOrBootstrap();
  cur.lines.push({ code:'', desc:'', qty:1, price:0 });
  setCurrent(cur); renderLines(); recalc();
}

function getOrBootstrap(){
  let cur=getCurrent();
  if(!cur){ cur={ id:newId(), createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', ivaPerc:22, scontoPerc:0, note:'', lines:[] }; setCurrent(cur); }
  return cur;
}

function renderLines(){
  const body=qs('#linesBody'); const cur=getOrBootstrap(); body.innerHTML='';
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
  // bind
  body.addEventListener('input', onLineEdit);
  body.addEventListener('click', onLineDelete);
}

function onLineEdit(e){
  const cur=getOrBootstrap();
  if(e.target.matches('.line-code')){ cur.lines[e.target.dataset.idx].code = e.target.value; }
  if(e.target.matches('.line-desc')){ cur.lines[e.target.dataset.idx].desc = e.target.value; }
  if(e.target.matches('.line-qty')){ cur.lines[e.target.dataset.idx].qty = parseFloat(e.target.value)||0; }
  if(e.target.matches('.line-price')){ cur.lines[e.target.dataset.idx].price = parseFloat(e.target.value)||0; }
  setCurrent(cur); recalc();
}
function onLineDelete(e){
  const btn=e.target.closest('button[data-del]'); if(!btn) return;
  const idx=+btn.getAttribute('data-del');
  const cur=getOrBootstrap(); cur.lines.splice(idx,1); setCurrent(cur); renderLines(); recalc();
}

function recalc(){
  const cur=getOrBootstrap();
  // read header fields
  cur.cliente = qs('#cliente').value.trim();
  cur.articolo = qs('#articolo').value.trim();
  cur.ddt = qs('#ddt').value.trim();
  cur.telefono = qs('#telefono').value.trim();
  cur.email = qs('#email').value.trim();
  cur.ivaPerc = parseFloat(qs('#ivaPerc').value)||22;
  cur.scontoPerc = Math.min(100, Math.max(0, parseFloat(qs('#scontoPerc').value)||0));
  cur.note = qs('#note').value;
  // line totals
  let imponibile=0;
  cur.lines.forEach((r,i)=>{
    const lt=(r.qty||0)*(r.price||0);
    imponibile += lt;
    const cell=qs('#lineTot'+i); if(cell) cell.textContent = EURO(lt);
  });
  const scontoVal = imponibile * (cur.scontoPerc/100);
  const afterSconto = imponibile - scontoVal;
  const ivaVal = afterSconto * (cur.ivaPerc/100);
  const total = afterSconto + ivaVal;
  // render totals
  qs('#imponibile').textContent = EURO(imponibile);
  qs('#scontoVal').textContent = EURO(scontoVal);
  qs('#subtot').textContent = EURO(afterSconto);
  qs('#iva').textContent = EURO(ivaVal);
  qs('#totale').textContent = EURO(total);
  qs('#ivaLabel').textContent = String(cur.ivaPerc);
  // persist
  setCurrent(cur);
}

function fillForm(){
  const cur=getOrBootstrap();
  qs('#quoteId').textContent = cur.id;
  ['cliente','articolo','ddt','telefono','email','note'].forEach(id=> qs('#'+id).value = cur[id]||'');
  qs('#ivaPerc').value = cur.ivaPerc ?? 22;
  qs('#scontoPerc').value = cur.scontoPerc ?? 0;
}

function newQuote(){
  localStorage.removeItem('elip_current'); 
  const cur=getOrBootstrap();
  qs('#quoteId').textContent = cur.id;
  renderLines(); fillForm(); recalc();
}

function saveQuote(){
  const cur=getOrBootstrap();
  const arr=JSON.parse(localStorage.getItem('elip_archive')||'[]');
  const i=arr.findIndex(x=>x.id===cur.id); if(i>=0) arr[i]=cur; else arr.unshift(cur);
  localStorage.setItem('elip_archive', JSON.stringify(arr));
  alert('Preventivo salvato in Archivio.');
}

function exportJSON(){
  const cur=getOrBootstrap();
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(cur,null,2)],{type:'application/json'}));
  a.download=cur.id+'.json'; a.click();
}
function importJSON(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{ const obj=JSON.parse(reader.result); localStorage.setItem('elip_current', JSON.stringify(obj)); }catch(_){ alert('JSON non valido'); return; }
    renderLines(); fillForm(); recalc();
  };
  reader.readAsText(file);
}

function exportCatalog(){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(getCatalog(),null,2)],{type:'application/json'}));
  a.download='catalogo-elip.json'; a.click();
}
function importCatalog(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{ const arr=JSON.parse(reader.result); if(!Array.isArray(arr)) throw new Error(); setCatalog(arr); renderCatalog(qs('#catalogSearch').value||''); }
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

/* --------- PDF ---------- */
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
  let y=startY;
  doc.setFontSize(11);
  doc.text('Riepilogo', pad, y); y+=10;
  const imponibile = cur.lines.reduce((s,r)=>s+(r.qty||0)*(r.price||0),0);
  const sconto = imponibile * ((cur.scontoPerc||0)/100);
  const afterSconto = imponibile - sconto;
  const iva = afterSconto * ((cur.ivaPerc||22)/100);
  const totale = afterSconto + iva;
  doc.setFontSize(10);
  doc.text('Imponibile: '+EURO(imponibile), pad, y); y+=12;
  if ((cur.scontoPerc||0)>0){ doc.text('Sconto: '+EURO(sconto), pad, y); y+=12; }
  doc.text('Subtotale: '+EURO(afterSconto), pad, y); y+=12;
  doc.text(`IVA (${cur.ivaPerc||22}%): `+EURO(iva), pad, y); y+=14;
  doc.setFontSize(12); doc.text('TOTALE: '+EURO(totale), pad, y);
  return y+16;
}
async function pdfDettaglio(){
  const { jsPDF } = window.jspdf||{}; if(!jsPDF){ alert('Libreria PDF non caricata.'); return; }
  const cur=getOrBootstrap(), doc=new jsPDF({unit:'pt',format:'a4'}), pad=40;
  await addHeader(doc,pad,cur);
  const rows=cur.lines.length? cur.lines.map(r=>[r.code||'', r.desc||'', String(r.qty||0), EURO(r.price||0), EURO((r.qty||0)*(r.price||0))]) : [['','','0','€ 0,00','€ 0,00']];
  doc.autoTable({startY:190, head:[['Cod','Descrizione','Q.tà','Prezzo','Totale']], body:rows, styles:{fontSize:10,cellPadding:5}, headStyles:{fillColor:[13,110,253]}, columnStyles:{0:{cellWidth:50},1:{cellWidth:260},2:{cellWidth:60,halign:'right'},3:{cellWidth:80,halign:'right'},4:{cellWidth:90,halign:'right'}}});
  let y=doc.lastAutoTable.finalY+12;
  const note=(cur.note||'').trim(); if(note){ doc.setFontSize(11); doc.text('NOTE', pad, y); y+=10; doc.setFontSize(10); const w=doc.splitTextToSize(note,455); doc.text(w, pad, y); y+=w.length*12+6; }
  y=addTotals(doc,pad,cur,y+4);
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
  const url=URL.createObjectURL(doc.output('blob')); const a=qs('#btnDownload'); a.href=url; a.download=cur.id+'-totale.pdf'; a.classList.remove('d-none'); a.click();
}

/* --------- Share ---------- */
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

/* --------- Theme ---------- */
function toggleTheme(){
  const html=document.documentElement;
  const curr=html.getAttribute('data-theme')==='dark'?'dark':'light';
  const next= curr==='dark'?'light':'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('elip_theme', next);
}
function restoreTheme(){ const t=localStorage.getItem('elip_theme')||'light'; document.documentElement.setAttribute('data-theme',t); }

/* --------- Init ---------- */
function bindHeader(){
  qs('#btnDark').addEventListener('click', toggleTheme);
  qs('#btnNew').addEventListener('click', newQuote);
  qs('#btnSave').addEventListener('click', saveQuote);
  qs('#btnPDFDett').addEventListener('click', pdfDettaglio);
  qs('#btnPDFTot').addEventListener('click', pdfTotale);
  qs('#btnShareMail').addEventListener('click', shareMail);
  qs('#btnShareWA').addEventListener('click', shareWA);
  qs('#btnExport').addEventListener('click', exportJSON);
  qs('#btnImport').addEventListener('click', ()=> qs('#jsonImport').click());
  qs('#jsonImport').addEventListener('change', e=> e.target.files[0] && importJSON(e.target.files[0]));
  // Recalc on header field changes
  ['cliente','articolo','ddt','telefono','email','note','ivaPerc','scontoPerc'].forEach(id=>{
    qs('#'+id).addEventListener('input', recalc);
    qs('#'+id).addEventListener('change', recalc);
  });
}
function bindCatalog(){
  qs('#catalogSearch').addEventListener('input', e=> renderCatalog(e.target.value));
  qs('#btnAddCustom').addEventListener('click', addCustomLine);
  qs('#btnEditCatalog').addEventListener('click', editCatalog);
  qs('#btnExportCatalog').addEventListener('click', exportCatalog);
  qs('#btnImportCatalog').addEventListener('click', ()=> qs('#catalogImport').click());
  qs('#catalogImport').addEventListener('change', e=> e.target.files[0] && importCatalog(e.target.files[0]));
}

function init(){
  restoreTheme();
  ensureCatalog();
  renderCatalog();
  renderLines();
  fillForm();
  recalc();
  bindHeader();
  bindCatalog();
  // first id
  const cur=getOrBootstrap(); qs('#quoteId').textContent=cur.id;
}
document.addEventListener('DOMContentLoaded', init);
