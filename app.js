// UI logic v6.1-SB complete
if (!window.__ELIP_APP_LOADED){ window.__ELIP_APP_LOADED=true;

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

function nextId(){
  const d=new Date(); const y=d.getFullYear(); const key='elip_seq_'+y;
  let seq = parseInt(localStorage.getItem(key)||'0',10)+1; localStorage.setItem(key,String(seq));
  return `ELP-${y}-${String(seq).padStart(4,'0')}`;
}
function getCatalog(){ try{ return JSON.parse(localStorage.getItem('elip_catalog')||'[]'); } catch(_){ return []; } }
function setCatalog(arr){ localStorage.setItem('elip_catalog', JSON.stringify(arr)); }
function ensureCatalog(){ if(getCatalog().length===0) setCatalog(DEFAULT_CATALOG); }
function getCurrent(){ try{ return JSON.parse(localStorage.getItem('elip_current')||'null'); } catch(_){ return null; } }
function setCurrent(obj){ localStorage.setItem('elip_current', JSON.stringify(obj)); }
function getArchiveLocal(){ try{ return JSON.parse(localStorage.getItem('elip_archive')||'[]'); } catch(_){ return []; } }
function setArchiveLocal(arr){ localStorage.setItem('elip_archive', JSON.stringify(arr)); }

function appInitData(){
  let cur=getCurrent();
  if(!cur){
    cur={ id:nextId(), createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'',
      dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] };
    setCurrent(cur);
  }
  return cur;
}

function buildDatalist(){
  const dl = qs('#catalogCodes'); dl.innerHTML='';
  getCatalog().forEach(x=>{
    const opt=document.createElement('option');
    opt.value = x.code;
    opt.label = `${x.code} - ${x.desc}`;
    dl.appendChild(opt);
  });
}

function renderCatalog(filter=""){
  const list=qs('#catalogList'); list.innerHTML='';
  const rows=getCatalog().filter(x=> (x.code+x.desc).toLowerCase().includes(filter.toLowerCase()));
  if(rows.length===0){ list.innerHTML='<li class="list-group-item text-muted">Nessuna voce…</li>'; return; }
  rows.forEach(x=>{
    const li=document.createElement('li');
    li.className='list-group-item';
    li.innerHTML=`<div class="rowline"><span class="code-badge">${x.code}</span><span>${x.desc}</span></div>`;
    li.addEventListener('click', ()=> addLine({code:x.code, desc:x.desc, qty:1, price:0, done:false, doneBy:'', doneDate:''}));
    list.appendChild(li);
  });
}

function editCatalog(){
  const arr = getCatalog();
  const text = prompt('Modifica catalogo (JSON):', JSON.stringify(arr, null, 2));
  if (!text) return;
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('Il JSON deve essere un array di voci');
    setCatalog(parsed);
    renderCatalog(qs('#catalogSearch').value || '');
    buildDatalist();
  } catch (e) {
    alert('JSON non valido: ' + e.message);
  }
}

function addLine(line){ const cur=appInitData(); cur.lines.push(line); setCurrent(cur); renderLines(); recalc(); }
function addCustomLine(){ addLine({code:'', desc:'', qty:1, price:0, done:false, doneBy:'', doneDate:''}); }

function renderLines(){
  const cur=appInitData();
  const body=qs('#linesBody'); body.innerHTML='';
  cur.lines.forEach((r,idx)=>{
    const tr=document.createElement('tr');
    if(r.done) tr.classList.add('tr-done');
    const stateBtn = `<button class="btn-state-dot ${r.done?'green':'red'}" data-state="${idx}" title="${r.done?'Completato':'Non eseguito'}"></button>`;
    tr.innerHTML=`
      <td><input class="form-control form-control-sm code-input line-code" list="catalogCodes" data-idx="${idx}" value="${r.code||''}" placeholder="Cod."></td>
      <td><input class="form-control form-control-sm line-desc" data-idx="${idx}" value="${r.desc||''}" placeholder="Descrizione…"></td>
      <td><input type="number" min="0" step="1" class="form-control form-control-sm text-end line-qty" data-idx="${idx}" value="${r.qty||1}"></td>
      <td><input type="number" min="0" step="0.01" class="form-control form-control-sm text-end line-price" data-idx="${idx}" value="${r.price||0}"></td>
      <td class="text-end" id="lineTot${idx}">€ 0,00</td>
      <td class="text-center">${stateBtn}</td>
      <td><input class="form-control form-control-sm line-operator" data-idx="${idx}" value="${r.doneBy||''}" placeholder="Nome operatore"></td>
      <td><input type="date" class="form-control form-control-sm line-date" data-idx="${idx}" value="${r.doneDate||''}"></td>
      <td><button class="btn btn-sm btn-outline-danger" data-del="${idx}">✕</button></td>`;
    body.appendChild(tr);
  });
  body.oninput = onLineEdit;
  body.onclick = onLineClick;
}

function onLineEdit(e){
  const cur=appInitData();
  const id=e.target.dataset.idx;
  if(e.target.classList.contains('line-code')) {
    const val = e.target.value.trim();
    cur.lines[id].code=val;
    const hit = getCatalog().find(x=> x.code.toLowerCase()===val.toLowerCase());
    if(hit) {
      cur.lines[id].desc = hit.desc;
      e.target.closest('tr').querySelector('.line-desc').value = hit.desc;
    }
  }
  if(e.target.classList.contains('line-desc')) cur.lines[id].desc=e.target.value;
  if(e.target.classList.contains('line-qty')) cur.lines[id].qty=parseFloat(e.target.value)||0;
  if(e.target.classList.contains('line-price')) cur.lines[id].price=parseFloat(e.target.value)||0;
  if(e.target.classList.contains('line-operator')) cur.lines[id].doneBy=e.target.value;
  if(e.target.classList.contains('line-date')) cur.lines[id].doneDate=e.target.value;
  setCurrent(cur); recalc();
}
function onLineClick(e){
  const btnDel=e.target.closest('button[data-del]'); 
  if(btnDel){ const idx=+btnDel.getAttribute('data-del'); const cur=appInitData(); cur.lines.splice(idx,1); setCurrent(cur); renderLines(); recalc(); return; }
  const btnState=e.target.closest('button[data-state]');
  if(btnState){
    const idx=+btnState.getAttribute('data-state');
    const cur=appInitData();
    cur.lines[idx].done = !cur.lines[idx].done;
    setCurrent(cur);
    renderLines();
    recalc();
    return;
  }
}

function recalc(){
  const cur=appInitData();
  ['cliente','articolo','ddt','telefono','email','dataInvio','dataAcc','dataScad','note'].forEach(id=> cur[id]=qs('#'+id).value);
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
  setCurrent(cur);
}

/* Images */
function h&&leImages(files){
  const cur=appInitData();
  const promises=[...files].map(file=> new Promise(res=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.readAsDataURL(file); }));
  Promise.all(promises).then(datas=>{ cur.images=(cur.images||[]).concat(datas); setCurrent(cur); renderImages(); });
}
function renderImages(){
  const cur=appInitData();
  const wrap=qs('#imgPreview'); wrap.innerHTML='';
  (cur.images||[]).forEach((src,idx)=>{
    const div=document.createElement('div'); div.className='thumb-wrap';
    div.innerHTML=`<img class="thumb" src="${src}" data-zoom="${idx}"><button class="btn btn-sm btn-outline-danger" data-delimg="${idx}">✕</button>`;
    wrap.appendChild(div);
  });
  wrap.onclick = (e)=>{
    const b=e.target.closest('button[data-delimg]'); 
    if(b){ const i=+b.getAttribute('data-delimg'); const cur=appInitData(); cur.images.splice(i,1); setCurrent(cur); renderImages(); return; }
    const img=e.target.closest('img[data-zoom]'); 
    if(img){
      const idx=+img.getAttribute('data-zoom'); const cur=appInitData();
      const modalImg = document.getElementById('imgModalImg'); modalImg.src = cur.images[idx];
      const modal = new bootstrap.Modal(document.getElementById('imgModal')); modal.show();
    }
  };
}

/* PDF / JPG / E-mail */
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
  const cur=appInitData(), doc=new jsPDF({unit:'pt',format:'a4'}), pad=40;
  await headerPDF(doc,pad,cur);
  if(type==='dett'){
    const rows=cur.lines.length? cur.lines.map(r=>[r.code||'', r.desc||'', String(r.qty||0), EURO(r.price||0), EURO((r.qty||0)*(r.price||0))]) : [['','','0','€ 0,00','€ 0,00']];
    doc.autoTable({startY:230, head:[['Cod','Descrizione','Q.tà','Prezzo','Totale']],
      body:rows, margin:{left:pad,right:pad},
      styles:{fontSize:11,cellPadding:7, overflow:'linebreak'}, bodyStyles:{valign:'top'},
      headStyles:{fillColor:[199,119,59]},
      columnStyles:{0:{cellWidth:55},1:{cellWidth:255},2:{cellWidth:60,halign:'right'},3:{cellWidth:85,halign:'right'},4:{cellWidth:95,halign:'right'}}});
  }else{
    const rows=cur.lines.length? cur.lines.map(r=>[r.code||'', r.desc||'']) : [['','Nessuna voce']];
    doc.autoTable({startY:230, head:[['Cod','Descrizione incluse']],
      body:rows, margin:{left:pad,right:pad},
      styles:{fontSize:11,cellPadding:7, overflow:'linebreak'}, bodyStyles:{valign:'top'},
      headStyles:{fillColor:[199,119,59]},
      columnStyles:{0:{cellWidth:60},1:{cellWidth:380}}});
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
  const a=qs('#btnDownload'); a.href=url; a.download=(appInitData().id)+'-'+(type==='dett'?'dettaglio':'totale')+'.pdf';
  if (window.bootstrap && bootstrap.Modal) { const modal = new bootstrap.Modal(document.getElementById('pdfModal')); modal.show(); } else { window.open(url, '_blank'); }
}
function jpgCover(){
  const cur=appInitData();
  const c=document.createElement('canvas'); c.width=1200; c.height=900; const g=c.getContext('2d');
  g.fillStyle='#ffffff'; g.fillRect(0,0,c.width,c.height);
  g.fillStyle='#c7773b'; g.fillRect(0,0,c.width,120);
  g.fillStyle='#ffffff'; g.font='bold 52px Arial'; g.fillText('ELIP TAGLIENTE — Preventivo', 40, 80);
  g.fillStyle='#333333'; g.font='28px Arial';
  g.fillText('N°: '+(cur.id), 40, 160);
  g.fillText('Cliente: '+(cur.cliente||'-'), 40, 200);
  g.fillText('Articolo: '+(cur.articolo||'-'), 40, 240);
  g.fillText('DDT: '+(cur.ddt||'-'), 40, 280);
  g.fillText('Totale (IVA 22%): '+document.getElementById('totale').textContent, 40, 320);
  g.font='bold 24px Arial'; g.fillText('Voci incluse', 40, 370);
  g.font='20px Arial';
  let y=410; const step=28, maxRows=12;
  appInitData().lines.slice(0,maxRows).forEach(r=>{ g.fillText(`${r.code||''} — ${r.desc||''}`, 40, y); y+=step; });
  const url=c.toDataURL('image/jpeg',0.92); const link=qs('#btnJPG'); link.href=url; link.download=cur.id+'-anteprima.jpg';
}
function shareMail(){
  const cur=appInitData();
  const subject=encodeURIComponent(`ELIP Tagliente — Preventivo ${cur.id}`);
  const linesTxt = cur.lines.map(r=>`• ${r.code||''} - ${r.desc||''}`).join('\\n');
  const corpoTxt = `Spett.le CLIENTE

Alleghiamo alla presente il documento in oggetto

Di seguito il riepilogo dei lavori preventivati:
${linesTxt}

Con l'occasione, 

porgiamo distinti saluti.


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
  window.location.href='mailto:'+(cur.email||'')+'?subject='+subject+'&body='+encodeURIComponent(corpoTxt);
}
function shareWA(){
  const cur=appInitData();
  const lines = cur.lines.map(r=>`• ${r.code||''} ${r.desc||''}`).join('%0A');
  const msg = encodeURIComponent(`ELIP Tagliente — Preventivo ${cur.id}%0ACliente: ${cur.cliente||'-'}%0ATotale: ${document.getElementById('totale').textContent}%0A%0AVoci:%0A`)+lines;
  window.open('https://wa.me/?text='+msg, '_blank');
}

/* Archivio */
window.ACC_FILTER='all';
function computeAccCounters(arr){
  let ok=0,no=0; arr.forEach(r=> ((r.data_accettazione||'').toString().trim()? ok++: no++)); 
  const el=qs('#accCounters'); if(el) el.textContent = `Accettati: ${ok} — Da accettare: ${no}`;
}
function renderArchiveLocal(){
  const arr = getArchiveLocal();
  computeAccCounters(arr);
  const q=(qs('#filterQuery').value||'').toLowerCase();
  const body=document.getElementById('archBody'); body.innerHTML='';
  const today = new Date(); today.setHours(0,0,0,0);
  arr
    .filter(r=> (r.cliente||'').toLowerCase().includes(q))
    .filter(r=> (window.ACC_FILTER==='all') || (window.ACC_FILTER==='ok' && (r.data_accettazione||'').toString().trim()) || (window.ACC_FILTER==='no' && !(r.data_accettazione||'').toString().trim()))
    .forEach(rec=>{
      const tot = (rec.totale!=null)? rec.totale : ( (rec.linee||[]).reduce((s,r)=>s+(r.qty||0)*(r.price||0),0)*1.22 );
      const toDo = (rec.linee||[]).filter(r=> (r.qty||0)>0 || (r.price||0)>0 || (r.desc||'').trim()!=='').length;
      const done = (rec.linee||[]).filter(r=> r.done).length;
      const pct = toDo? Math.round((done/toDo)*100):0;
      const dot = pct===100 ? '<span style="color:var(--green)">●</span>' : '<span style="color:var(--red)">●</span>';
      let scadTd = '<span class="text-muted">-</span>';
      if(rec.data_scadenza){
        const d=new Date(rec.data_scadenza); d.setHours(0,0,0,0);
        const diff = Math.round((d - today)/(1000*60*60*24));
        if(diff <= 5 && diff >= 0) scadTd = `<span class="badge badge-deadline">Scade in ${diff} g</span>`;
        else if(diff < 0) scadTd = `<span class="badge bg-danger">Scaduto</span>`;
        else scadTd = new Date(rec.data_scadenza).toLocaleDateString('it-IT');
      }
      const accBadge = (rec.data_accettazione||'').toString().trim() ? '<span class="acc-pill acc-ok">● OK</span>' : '<span class="acc-pill acc-no">● NO</span>';
      const tr=document.createElement('tr');
      const dateIt=new Date(rec.created_at||rec.createdAt||Date.now()).toLocaleDateString('it-IT');
      tr.innerHTML=`
        <td>${rec.numero||rec.id}</td><td>${dateIt}</td><td>${rec.cliente||''}</td>
        <td>${rec.articolo||''}</td><td>${rec.ddt||''}</td><td>${EURO(tot||0)}</td>
        <td>${accBadge}</td>
        <td>${scadTd}</td><td>${dot} ${pct}%</td>
        <td><button class="btn btn-sm btn-outline-primary" data-open="${rec.id}">Modifica</button></td>`;
      body.appendChild(tr);
    });
  body.onclick=(e)=>{
    const b=e.target.closest('button[data-open]'); if(!b) return;
    const id=b.getAttribute('data-open');
    const rec= getArchiveLocal().find(x=>x.id===id); if(!rec) return;
    const cur = {
      id: rec.numero || rec.id,
      createdAt: rec.created_at,
      cliente: rec.cliente, articolo: rec.articolo, ddt: rec.ddt, telefono: rec.telefono, email: rec.email,
      dataInvio: rec.data_invio, dataAcc: rec.data_accettazione, dataScad: rec.data_scadenza,
      note: rec.note, lines: rec.linee || [], images: rec.images || []
    };
    setCurrent(cur);
    document.querySelector('[data-bs-target="#tab-editor"]').click();
    renderLines(); fillForm(); renderImages(); recalc();
  };
}

/* Toast */
function toastSaved(){
  const t = new bootstrap.Toast(document.getElementById('toastSave'), { delay: 3500 });
  const now = new Date();
  const stamp = now.toLocaleDateString('it-IT')+' '+now.toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'});
  document.getElementById('toastSaveMsg').textContent = `✅ Preventivo salvato con successo — ${stamp}`;
  t.show();
}

/* Bind & init */
function newQuote(){ localStorage.removeItem('elip_current'); const cur=appInitData(); qs('#quoteId').textContent=cur.id; renderLines(); renderImages(); recalc(); }
function bindAll(){
  qs('#btnNew').addEventListener('click', newQuote);
  qs('#btnSave').addEventListener('click', () => saveToSupabase(false));
  qs('#btnArchive').addEventListener('click', () => saveToSupabase(true));
  qs('#btnPDFDett').addEventListener('click', ()=>previewPDF('dett'));
  qs('#btnPDFTot').addEventListener('click', ()=>previewPDF('tot'));
  qs('#btnJPG').addEventListener('click', jpgCover);
  qs('#btnMail').addEventListener('click', shareMail);
  qs('#btnWA').addEventListener('click', shareWA);
  qs('#catalogSearch').addEventListener('input', e=> renderCatalog(e.target.value));
  qs('#btnAddCustom').addEventListener('click', addCustomLine);
  qs('#btnEditCatalog').addEventListener('click', editCatalog);
  ['cliente','articolo','ddt','telefono','email','dataInvio','dataAcc','dataScad','note'].forEach(id=>{ qs('#'+id).addEventListener('input', recalc); qs('#'+id).addEventListener('change', recalc); });
  qs('#imgInput').addEventListener('change', e=> e.target.files.length && h&&leImages(e.target.files));
  qs('#btnReloadArch').addEventListener('click', () => loadArchiveSupabase());
  qs('#filterQuery').addEventListener('input', renderArchiveLocal);
  qs('#fltAll').addEventListener('click', ()=> {window.ACC_FILTER='all'; renderArchiveLocal(); setFilterButtons();});
  qs('#fltOk').addEventListener('click', ()=> {window.ACC_FILTER='ok'; renderArchiveLocal(); setFilterButtons();});
  qs('#fltNo').addEventListener('click', ()=> {window.ACC_FILTER='no'; renderArchiveLocal(); setFilterButtons();});
}
function setFilterButtons(){
  qs('#fltAll').classList.toggle('active', window.ACC_FILTER==='all');
  qs('#fltOk').classList.toggle('active', window.ACC_FILTER==='ok');
  qs('#fltNo').classList.toggle('active', window.ACC_FILTER==='no');
}
function fillForm(){
  const cur=appInitData();
  qs('#quoteId').textContent=cur.id;
  ['cliente','articolo','ddt','telefono','email','dataInvio','dataAcc','dataScad','note'].forEach(id=> qs('#'+id).value = cur[id]||'');
}

function init(){
  ensureCatalog(); buildDatalist(); renderCatalog(); renderLines(); fillForm(); renderImages(); recalc(); bindAll();
  loadArchiveSupabase().then(()=>{ renderArchiveLocal(); subscribeRealtime(); });
}
document.addEventListener('DOMContentLoaded', init);

} // guard end
