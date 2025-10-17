// v5.3 — no XLS, operator/date inputs, progressive numbering, email text custom
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

// Progressive numbering per anno: ELP-YYYY-####
function nextId(){
  const d=new Date(); const y=d.getFullYear();
  const key='elip53_seq_'+y;
  let seq = parseInt(localStorage.getItem(key)||'0',10)+1;
  localStorage.setItem(key,String(seq));
  return `ELP-${y}-${String(seq).padStart(4,'0')}`;
}

function getCatalog(){ try{ return JSON.parse(localStorage.getItem('elip53_catalog')||'[]'); } catch(_){ return []; } }
function setCatalog(arr){ localStorage.setItem('elip53_catalog', JSON.stringify(arr)); }
function ensureCatalog(){ if(getCatalog().length===0) setCatalog(DEFAULT_CATALOG); }
function getCurrent(){ try{ return JSON.parse(localStorage.getItem('elip53_current')||'null'); } catch(_){ return null; } }
function setCurrent(obj){ localStorage.setItem('elip53_current', JSON.stringify(obj)); }
function getArchive(){ try{ return JSON.parse(localStorage.getItem('elip53_archive')||'[]'); } catch(_){ return []; } }
function setArchive(arr){ localStorage.setItem('elip53_archive', JSON.stringify(arr)); }

function getOrBootstrap(){
  let cur=getCurrent();
  if(!cur){
    cur={ id:nextId(), createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', note:'', lines:[], images:[] };
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
    li.addEventListener('click', ()=> addLine({code:x.code, desc:x.desc, qty:1, price:0, done:false, doneBy:'', doneDate:''}));
    list.appendChild(li);
  });
}

function addLine(line){ const cur=getOrBootstrap(); cur.lines.push(line); setCurrent(cur); renderLines(); recalc(); }
function addCustomLine(){ addLine({code:'', desc:'', qty:1, price:0, done:false, doneBy:'', doneDate:''}); }

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
      <td class="text-center">
        <input class="form-check-input line-done" type="checkbox" data-idx="${idx}" ${r.done?'checked':''}>
      </td>
      <td><input class="form-control form-control-sm line-operator" data-idx="${idx}" value="${r.doneBy||''}" placeholder="Nome operatore"></td>
      <td><input type="date" class="form-control form-control-sm line-date" data-idx="${idx}" value="${r.doneDate||''}"></td>
      <td><button class="btn btn-sm btn-outline-danger" data-del="${idx}">✕</button></td>`;
    body.appendChild(tr);
  });
  body.oninput = onLineEdit;
  body.onclick = onLineClick;
}

function onLineEdit(e){
  const cur=getOrBootstrap();
  const id=e.target.dataset.idx;
  if(e.target.classList.contains('line-code')) cur.lines[id].code=e.target.value;
  if(e.target.classList.contains('line-desc')) cur.lines[id].desc=e.target.value;
  if(e.target.classList.contains('line-qty')) cur.lines[id].qty=parseFloat(e.target.value)||0;
  if(e.target.classList.contains('line-price')) cur.lines[id].price=parseFloat(e.target.value)||0;
  if(e.target.classList.contains('line-operator')) cur.lines[id].doneBy=e.target.value;
  if(e.target.classList.contains('line-date')) cur.lines[id].doneDate=e.target.value;
  if(e.target.classList.contains('line-done')) cur.lines[id].done=e.target.checked;
  setCurrent(cur); recalc();
}
function onLineClick(e){
  const btn=e.target.closest('button[data-del]'); 
  if(btn){ const idx=+btn.getAttribute('data-del'); const cur=getOrBootstrap(); cur.lines.splice(idx,1); setCurrent(cur); renderLines(); recalc(); }
}

function recalc(){
  const cur=getOrBootstrap();
  ['cliente','articolo','ddt','telefono','email','note'].forEach(id=> cur[id]=qs('#'+id).value);
  let imponibile=0, toDo=0, done=0;
  cur.lines.forEach((r,i)=>{
    const lt=(r.qty||0)*(r.price||0); imponibile+=lt;
    const isWork = (r.qty||0) > 0 || (r.price||0) > 0 || (r.desc||'').trim()!=='';
    if(isWork){ toDo++; if(r.done) done++; }
    const cell=qs('#lineTot'+i); if(cell) cell.textContent=EURO(lt);
  });
  const iva=imponibile*0.22, total=imponibile+iva;
  qs('#imponibile').textContent=EURO(imponibile);
  qs('#iva').textContent=EURO(iva);
  qs('#totale').textContent=EURO(total);
  const pct = toDo? Math.round((done/toDo)*100):0;
  const bar=qs('#progressBar'); bar.style.width=pct+'%'; bar.innerText=pct+'%'; bar.style.backgroundColor = pct===100 ? 'var(--green)' : 'var(--accent)';
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
  const promises=[...files].map(file=> new Promise(res=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.readAsDataURL(file); }));
  Promise.all(promises).then(datas=>{ cur.images=(cur.images||[]).concat(datas); setCurrent(cur); renderImages(); });
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
    const i=+b.getAttribute('data-delimg'); const cur=getOrBootstrap(); cur.images.splice(i,1); setCurrent(cur); renderImages();
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
function renderArchive(){
  const arr=getArchive();
  const q=(qs('#filterQuery').value||'').toLowerCase();
  const body=document.getElementById('archBody'); body.innerHTML='';
  arr.filter(r=> (r.cliente||'').toLowerCase().includes(q)).forEach(rec=>{
    const tot = rec.lines.reduce((s,r)=>s+(r.qty||0)*(r.price||0),0)*1.22;
    const toDo = rec.lines.filter(r=> (r.qty||0)>0 || (r.price||0)>0 || (r.desc||'').trim()!=='').length;
    const done = rec.lines.filter(r=> r.done).length;
    const pct = toDo? Math.round((done/toDo)*100):0;
    const dot = pct===100 ? '<span style="color:var(--green)">●</span>' : '<span style="color:var(--red)">●</span>';
    const tr=document.createElement('tr');
    const dateIt=new Date(rec.createdAt).toLocaleDateString('it-IT');
    tr.innerHTML=`
      <td>${rec.id}</td><td>${dateIt}</td><td>${rec.cliente||''}</td>
      <td>${rec.articolo||''}</td><td>${rec.ddt||''}</td><td>${EURO(tot)}</td><td>${dot} ${pct}%</td>
      <td><button class="btn btn-sm btn-outline-primary" data-open="${rec.id}">Modifica</button></td>`;
    body.appendChild(tr);
  });
  body.onclick=(e)=>{
    const b=e.target.closest('button[data-open]'); if(!b) return;
    const id=b.getAttribute('data-open');
    const rec=getArchive().find(x=>x.id===id); if(!rec) return;
    localStorage.setItem('elip53_current', JSON.stringify(rec));
    document.querySelector('[data-bs-target="#tab-editor"]').click();
    renderLines(); fillForm(); recalc();
  };
}

/* Catalog edit */
function editCatalog(){
  const arr=getCatalog();
  const text=prompt('Modifica catalogo (JSON):', JSON.stringify(arr,null,2));
  if(!text) return;
  try{ const parsed=JSON.parse(text); if(!Array.isArray(parsed)) throw 0; setCatalog(parsed); renderCatalog(qs('#catalogSearch').value||''); }
  catch(_){ alert('JSON non valido'); }
}

/* PDF + preview + JPG cover */
async function headerPDF(doc,pad,cur){
  try{
    const img = await fetch('logo-elip.jpg').then(r=>r.blob()).then(b=>new Promise(res=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.readAsDataURL(b);}));
    doc.addImage(img,'JPEG',pad,40,160,40);
  }catch(_){}
  doc.setFontSize(18); doc.text('Preventivo', pad, 110);
  doc.setFontSize(12); const dateIT=new Date().toLocaleDateString('it-IT');
  doc.text(`Data: ${dateIT}  •  N°: ${cur.id}`, pad, 128);
  doc.setFontSize(12.5);
  doc.text('Cliente: '+(cur.cliente||'-'), pad, 148);
  doc.text('Articolo: '+(cur.articolo||'-'), pad, 166);
  doc.text('DDT: '+(cur.ddt||'-'), pad, 184);
  doc.text(`Telefono: ${cur.telefono||'-'}   Email: ${cur.email||'-'}`, pad, 202);
}
function totalsPDF(doc,pad,cur,startY){
  let imponibile=cur.lines.reduce((s,r)=>s+(r.qty||0)*(r.price||0),0);
  let iva=imponibile*0.22, total=imponibile+iva;
  let y=startY;
  doc.setFontSize(13); doc.text('Riepilogo', pad, y); y+=12;
  doc.setFontSize(12);
  doc.text('Imponibile: '+EURO(imponibile), pad, y); y+=14;
  doc.text('IVA (22%): '+EURO(iva), pad, y); y+=16;
  doc.setFontSize(14); doc.text('TOTALE: '+EURO(total), pad, y);
  return y+20;
}
async function buildPDF(type){
  const { jsPDF } = window.jspdf||{}; if(!jsPDF){ alert('Libreria PDF non caricata.'); return; }
  const cur=getOrBootstrap(), doc=new jsPDF({unit:'pt',format:'a4'}), pad=40;
  await headerPDF(doc,pad,cur);
  if(type==='dett'){
    const rows=cur.lines.length? cur.lines.map(r=>[r.code||'', r.desc||'', String(r.qty||0), EURO(r.price||0), EURO((r.qty||0)*(r.price||0)), (r.done? '✓':'') , (r.doneBy||''), (r.doneDate||'')]) : [['','','0','€ 0,00','€ 0,00','','','']];
    doc.autoTable({startY:230, head:[['Cod','Descrizione','Q.tà','Prezzo','Totale','OK','Operatore','Data fine']],
      body:rows, styles:{fontSize:11,cellPadding:7}, headStyles:{fillColor:[199,119,59]},
      columnStyles:{0:{cellWidth:55},1:{cellWidth:220},2:{cellWidth:50,halign:'right'},3:{cellWidth:85,halign:'right'},4:{cellWidth:85,halign:'right'},5:{cellWidth:30,halign:'center'},6:{cellWidth:120},7:{cellWidth:80}}});
  }else{
    const rows=cur.lines.length? cur.lines.map(r=>[r.code||'', r.desc||'', (r.done? '✓':'') , (r.doneBy||''), (r.doneDate||'')]) : [['','Nessuna voce','','','']];
    doc.autoTable({startY:230, head:[['Cod','Descrizione incluse','OK','Operatore','Data fine']],
      body:rows, styles:{fontSize:11,cellPadding:7}, headStyles:{fillColor:[199,119,59]},
      columnStyles:{0:{cellWidth:60},1:{cellWidth:300},2:{cellWidth:30,halign:'center'},3:{cellWidth:120},4:{cellWidth:80}}});
  }
  let y=doc.lastAutoTable.finalY+14;
  const note=(cur.note||'').trim(); if(note){ doc.setFontSize(13); doc.text('NOTE', pad, y); y+=10; doc.setFontSize(11.5); const w=doc.splitTextToSize(note,455); doc.text(w, pad, y); y+=w.length*14+8; }
  totalsPDF(doc,pad,cur,y+6);
  for(const src of (cur.images||[])){
    const img=new Image(); img.src=src; await img.decode();
    const ratio = Math.min(500/img.width, 500/img.height);
    const w = Math.round(img.width*ratio), h=Math.round(img.height*ratio);
    doc.addPage(); doc.setFontSize(12); doc.text('Immagine allegata', pad, 80);
    doc.addImage(src, 'JPEG', pad, 100, w, h);
  }
  return doc;
}
async function previewPDF(type){
  const doc=await buildPDF(type);
  const blob=doc.output('blob'); const url=URL.createObjectURL(blob);
  qs('#pdfFrame').src=url;
  const a=qs('#btnDownload'); a.href=url; a.download=(getOrBootstrap().id)+'-'+(type==='dett'?'dettaglio':'totale')+'.pdf';
  const modal = new bootstrap.Modal(document.getElementById('pdfModal')); modal.show();
}
function jpgCover(){
  const cur=getOrBootstrap();
  const c=document.createElement('canvas'); c.width=1200; c.height=800; const g=c.getContext('2d');
  g.fillStyle='#ffffff'; g.fillRect(0,0,c.width,c.height);
  g.fillStyle='#c7773b'; g.fillRect(0,0,c.width,120);
  g.fillStyle='#ffffff'; g.font='bold 52px Arial'; g.fillText('ELIP TAGLIENTE — Preventivo', 40, 80);
  g.fillStyle='#333333'; g.font='30px Arial';
  g.fillText('Cliente: '+(cur.cliente||'-'), 40, 200);
  g.fillText('Articolo: '+(cur.articolo||'-'), 40, 250);
  g.fillText('DDT: '+(cur.ddt||'-'), 40, 300);
  g.fillText('Totale: '+qs('#totale').textContent, 40, 360);
  const url=c.toDataURL('image/jpeg',0.92); const link=qs('#btnJPG'); link.href=url; link.download=cur.id+'-copertina.jpg';
}

/* Email testo istituzionale */
function shareMail(){
  const cur=getOrBootstrap();
  const subject=encodeURIComponent(`ELIP Tagliente — Preventivo ${cur.id}`);
  const corpo = `Spett.le CLIENTE

Alleghiamo alla presente il documento in oggetto

Con l'occasione, 

porgiamo distinti saluti


ELIP Tagliente Srl
VIA CONCHIA, 54/E  70043 MONOPOLI (BA)
P.IVA/C.F.: 04386020723
TEL. 080.777090  FAX 080.8876756
MAIL: info@eliptagliente.it  WEB. www.eliptagliente.it
POSTA CERTIFICATA: eliptagliente@pec.it
Codice SDI          M5UXCR1
BANCA POPOLARE DI BARI (FIL. MONOPOLI – BA)
IBAN IT02U0542441570000001006392
BIC/SWIFT CODE: BPBAIT3B`;

  const info = `
Preventivo: ${cur.id}
Cliente: ${cur.cliente||'-'}
Articolo: ${cur.articolo||'-'}
DDT: ${cur.ddt||'-'}
Totale (IVA 22%): ${qs('#totale').textContent}`;

  const body=encodeURIComponent(corpo + "\n\n" + info);
  window.location.href='mailto:'+(cur.email||'')+'?subject='+subject+'&body='+body;

  // Lettera HTML con logo e info centrati per copia/incolla
  const w=window.open('','_blank');
  w.document.write(`
  <html><head><meta charset="utf-8"><title>ELIP Preventivo</title></head>
  <body style="font-family:Arial,Helvetica,sans-serif;line-height:1.6">
    <div style="text-align:center;margin-top:10px">
      <img src="logo-elip.jpg" style="height:70px"><br><br>
      <div style="white-space:pre-wrap;font-size:16px;text-align:left;max-width:720px;margin:0 auto">
${corpo.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
      </div>
      <hr style="margin:24px auto;max-width:720px">
      <div style="font-size:18px;max-width:720px;margin:0 auto">
        <div><strong>Preventivo:</strong> ${cur.id}</div>
        <div><strong>Cliente:</strong> ${cur.cliente||'-'}</div>
        <div><strong>Articolo:</strong> ${cur.articolo||'-'}</div>
        <div><strong>DDT:</strong> ${cur.ddt||'-'}</div>
        <div><strong>Totale (IVA 22%):</strong> ${qs('#totale').textContent}</div>
      </div>
    </div>
  </body></html>`);
  w.document.close();
}

function shareWA(){
  const cur=getOrBootstrap();
  const lines = cur.lines.map(r=>`• ${r.code||''} ${r.desc||''} x${r.qty||0}`).join('%0A');
  const msg = encodeURIComponent(`ELIP Tagliente — Preventivo ${cur.id}%0ACliente: ${cur.cliente||'-'}%0ATotale: ${qs('#totale').textContent}%0A%0AVoci:%0A`)+lines;
  window.open('https://wa.me/?text='+msg, '_blank');
}

/* Init */
function newQuote(){ localStorage.removeItem('elip53_current'); const cur=getOrBootstrap(); qs('#quoteId').textContent=cur.id; renderLines(); fillForm(); recalc(); }
function bindAll(){
  qs('#btnNew').addEventListener('click', newQuote);
  qs('#btnSave').addEventListener('click', saveQuote);
  qs('#btnArchive').addEventListener('click', archiveQuote);
  qs('#btnPDFDett').addEventListener('click', ()=>previewPDF('dett'));
  qs('#btnPDFTot').addEventListener('click', ()=>previewPDF('tot'));
  qs('#btnJPG').addEventListener('click', jpgCover);
  qs('#btnMail').addEventListener('click', shareMail);
  qs('#btnWA').addEventListener('click', shareWA);
  qs('#catalogSearch').addEventListener('input', e=> renderCatalog(e.target.value));
  qs('#btnAddCustom').addEventListener('click', addCustomLine);
  qs('#btnEditCatalog').addEventListener('click', editCatalog);
  ['cliente','articolo','ddt','telefono','email','note'].forEach(id=>{ qs('#'+id).addEventListener('input', recalc); qs('#'+id).addEventListener('change', recalc); });
  qs('#imgInput').addEventListener('change', e=> e.target.files.length && handleImages(e.target.files));
  qs('#btnReloadArch').addEventListener('click', renderArchive);
  qs('#filterQuery').addEventListener('input', renderArchive);
}

function init(){
  ensureCatalog(); renderCatalog(); renderLines(); fillForm(); recalc(); bindAll(); qs('#quoteId').textContent=getOrBootstrap().id; renderArchive();
}
document.addEventListener('DOMContentLoaded', init);
