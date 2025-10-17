// v4.2 logic – Avanzamento fix + semaforo + CHIUSO read-only
const WORK_ITEMS=[
  {code:"05",desc:"Smontaggio completo del motore sistematico"},
  {code:"29",desc:"Lavaggio componenti, e trattamento termico avvolgimenti"},
  {code:"06",desc:"Verifiche meccaniche alberi e alloggiamento cuscinetti e verifiche elettriche avvolgimenti"},
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
const EURO=n=>n.toLocaleString('it-IT',{style:'currency',currency:'EUR'});
const qs=s=>document.querySelector(s);
let progressModal,currentProgressIdx=null;

function newSheetId(){
  const d=new Date();
  return `ELIP-${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
}
function getCurrent(){ try{return JSON.parse(localStorage.getItem('preventivo_elip_current')||'null')}catch(_){return null} }
function setCurrent(r){ localStorage.setItem('preventivo_elip_current', JSON.stringify(r)); }

function progressBadge(p){
  if(!p||!p.stato) return '<span class="text-muted small"><span class="progress-dot dot-gray"></span>—</span>';
  const map={DA_ESEGUIRE:['dot-gray','Da eseguire'],IN_LAVORAZIONE:['dot-blue','In lavorazione'],COMPLETATA:['dot-green','Completata']};
  const [cls,label]=map[p.stato]||['dot-gray','—'];
  return `<span class="small"><span class="progress-dot ${cls}"></span>${label}</span>`;
}

function injectRows(){
  const tbody=qs('#workBody'); const rec=getCurrent()||{}; tbody.innerHTML='';
  WORK_ITEMS.forEach((w,i)=>{
    const r=(rec.rows&&rec.rows[i])?rec.rows[i]:{flag:false,price:'',progress:null};
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><span class="badge bg-secondary-subtle text-secondary-emphasis">${w.code}</span></td>
      <td>${w.desc}</td>
      <td class="text-center"><input class="form-check-input item-flag" type="checkbox" data-idx="${i}" ${r.flag?'checked':''}></td>
      <td><div class="input-group"><span class="input-group-text">€</span>
        <input type="number" step="0.01" min="0" class="form-control text-end item-price" data-idx="${i}" placeholder="0,00" ${r.flag?'':'disabled'} value="${r.price||''}"></div></td>
      <td><button class="btn btn-sm btn-outline-secondary btnProgress" data-idx="${i}" ${r.flag?'':'disabled'}>📍 Avanzamento</button>
        <div class="mt-1">${progressBadge(r.progress)}</div>
      </td>`;
    tbody.appendChild(tr);
  });
}

function computeOverallProgress(rec){
  const selected=rec.rows.filter(r=>r.flag);
  if(selected.length===0) return 0;
  const completed=selected.filter(r=>r.progress && r.progress.stato==='COMPLETATA').length;
  return Math.round((completed/selected.length)*100);
}

function updateProgressBadge(rec){
  const badge=qs('#progressBadge');
  const pct=computeOverallProgress(rec);
  badge.textContent=`Avanzamento: ${pct}%`;
  badge.className='badge';
  if(rec.stato==='CHIUSO'){ badge.classList.add('bg-success'); badge.textContent='Chiuso (100%)'; return; }
  if(pct<=50){ badge.classList.add('bg-warning','text-dark'); }
  else if(pct<=99){ badge.classList.add('bg-orange'); }
  else { badge.classList.add('bg-success'); }
}

function recalc(){
  let subtotal=0;
  document.querySelectorAll('.item-price').forEach(inp=>{
    if(!inp.disabled){
      const val=parseFloat(String(inp.value).replace(',', '.'))||0;
      subtotal+=val;
    }
  });
  const vat=subtotal*0.22;
  qs('#subtot').textContent=EURO(subtotal);
  qs('#iva').textContent=EURO(vat);
  qs('#totale').textContent=EURO(subtotal+vat);
  // progress badge
  const rec=collectForm(); updateProgressBadge(rec);
}

function bindRowEvents(){
  document.querySelectorAll('.item-flag').forEach(chk=>{
    chk.addEventListener('change', e=>{
      const idx=+e.target.dataset.idx;
      const price=document.querySelector(`.item-price[data-idx="${idx}"]`);
      const btn=document.querySelector(`.btnProgress[data-idx="${idx}"]`);
      price.disabled=!e.target.checked; btn.disabled=!e.target.checked;
      saveDraft(); recalc();
    });
  });
  document.querySelectorAll('.item-price').forEach(inp=>{
    inp.addEventListener('input', ()=>{ recalc(); saveDraft(); });
  });
  document.querySelectorAll('.btnProgress').forEach(btn=>{
    btn.addEventListener('click', ()=> openProgressModal(+btn.dataset.idx));
  });
}

function loadDraft(){
  const rec=getCurrent(); if(!rec) return;
  ['cliente','articolo','ddt','telefono','email','note','inviatoData','operatoreInvio','operatoreLavorazioni','consegnaData']
    .forEach(id=>{ const el=qs('#'+id); if(el) el.value=rec[id]||''; });
  qs('#stato').value=rec['stato']||'DA_INVIARE';
  if(rec.stato==='CHIUSO'){ setReadOnly(true); } else { setReadOnly(false); }
  updateProgressBadge(rec);
}

function collectForm(){
  const old=getCurrent()||{};
  const rows=WORK_ITEMS.map((w,i)=>{
    const flag=qs(`.item-flag[data-idx="${i}"]`).checked;
    const price=qs(`.item-price[data-idx="${i}"]`).value;
    const oldp=(old.rows&&old.rows[i])?old.rows[i].progress:null;
    return {code:w.code,desc:w.desc,flag,price,progress:oldp};
  });
  const subtotal=[...document.querySelectorAll('.item-price')]
    .reduce((s,i)=>s+(i.disabled?0:(parseFloat(String(i.value).replace(',','.'))||0)),0);
  const vat=subtotal*0.22, total=subtotal+vat;
  return {
    id: qs('#sheetId').textContent || newSheetId(),
    createdAt: old.createdAt || new Date().toISOString(),
    cliente: qs('#cliente').value.trim(),
    articolo: qs('#articolo').value.trim(),
    ddt: qs('#ddt').value.trim(),
    telefono: qs('#telefono').value.trim(),
    email: qs('#email').value.trim(),
    rows, subtotal, vat, total,
    note: qs('#note').value,
    stato: qs('#stato').value,
    inviatoData: qs('#inviatoData').value,
    operatoreInvio: qs('#operatoreInvio').value.trim(),
    operatoreLavorazioni: qs('#operatoreLavorazioni').value.trim(),
    consegnaData: qs('#consegnaData').value
  };
}

function saveDraft(){
  const rec=collectForm();
  setCurrent(rec);
  rec.rows.forEach((r,i)=>{
    const slot=document.querySelectorAll('#workBody tr')[i]?.querySelector('td:last-child div.mt-1');
    if(slot) slot.innerHTML=progressBadge(r.progress);
  });
  updateProgressBadge(rec);
}

function pushToArchive(rec){
  const arr=JSON.parse(localStorage.getItem('preventivo_elip_archive')||'[]');
  const idx=arr.findIndex(x=>x.id===rec.id);
  if(idx>=0) arr[idx]=rec; else arr.unshift(rec);
  localStorage.setItem('preventivo_elip_archive', JSON.stringify(arr));
}

async function addLogo(doc,pad){
  try{
    const img=new Image(); img.src='logo-elip.jpg'; await img.decode();
    const c=document.createElement('canvas'); const ratio=420/img.width;
    c.width=420; c.height=Math.round(img.height*ratio);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    doc.addImage(c.toDataURL('image/jpeg',0.92),'JPEG',pad,34,180,60);
  }catch(_){}
}
function pdfHeader(doc,pad,rec){
  doc.setFontSize(16); doc.text('Scheda Lavorazioni', pad, 110);
  doc.setFontSize(10); const dateIT=new Date().toLocaleDateString('it-IT');
  doc.text('Data: '+dateIT+'  •  N°: '+rec.id, pad, 126);
  doc.setFontSize(11);
  doc.text('Cliente: '+(rec.cliente||'-'), pad, 146);
  doc.text('Articolo: '+(rec.articolo||'-'), pad, 162);
  doc.text('DDT: '+(rec.ddt||'-'), pad, 178);
  doc.text('Telefono: '+(rec.telefono||'-')+'   Email: '+(rec.email||'-'), pad, 194);
}
function pdfFooter(doc){ doc.setFontSize(8); doc.text('Documento generato con Preventivi ELIP', 40, 820); }
function pdfStato(doc,pad,y,rec){
  const map={DA_INVIARE:'Da inviare',INVIATO:'Inviato',CONFERMATO:'Confermato',CHIUSO:'Chiuso'};
  doc.setFontSize(11); doc.text('Stato preventivo', pad, y); y+=10;
  doc.setFontSize(10);
  doc.text('Stato: '+(map[rec.stato]||'-'), pad, y); y+=12;
  if(rec.inviatoData){ doc.text('Inviato il: '+rec.inviatoData, pad, y); y+=12; }
  if(rec.operatoreInvio){ doc.text('Operatore invio: '+rec.operatoreInvio, pad, y); y+=12; }
  if(rec.operatoreLavorazioni){ doc.text('Operatore lavorazioni: '+rec.operatoreLavorazioni, pad, y); y+=12; }
  if(rec.consegnaData){ doc.text('Data presunta consegna: '+rec.consegnaData, pad, y); y+=12; }
  return y;
}

async function generatePDFDetailed(){
  const { jsPDF } = window.jspdf||{}; if(!jsPDF){ alert('Libreria PDF non caricata.'); return; }
  const rec=collectForm(), doc=new jsPDF({unit:'pt',format:'a4'}), pad=40;
  await addLogo(doc,pad); pdfHeader(doc,pad,rec);
  const rows=rec.rows.filter(r=>r.flag).map(r=>[r.code,r.desc,EURO(parseFloat(String(r.price||'0').replace(',','.'))||0)]);
  if(rows.length===0) rows.push(['—','Nessuna voce selezionata','€ 0,00']);
  doc.autoTable({startY:210,head:[['Cod','Descrizione lavori','Importo']],body:rows,
    styles:{fontSize:10,cellPadding:5},headStyles:{fillColor:[224,123,57]},columnStyles:{0:{cellWidth:50},1:{cellWidth:360},2:{cellWidth:100,halign:'right'}}});
  let y=doc.lastAutoTable.finalY+12;
  const note=(rec.note||'').trim(); if(note){ doc.setFontSize(11); doc.text('NOTE', pad, y); y+=8; doc.setFontSize(10); const w=doc.splitTextToSize(note,455); doc.text(w,pad,y); y+=(w.length*12)+6; }
  doc.setFontSize(11); doc.text('Riepilogo', pad, y); y+=8;
  doc.setFontSize(10); doc.text('Subtotale: '+EURO(rec.subtotal), pad, y); y+=14;
  doc.text('IVA (22%): '+EURO(rec.vat), pad, y); y+=18;
  doc.setFontSize(12); doc.text('TOTALE: '+EURO(rec.total), pad, y); y+=22;
  y=pdfStato(doc,pad,y+8,rec); pdfFooter(doc);
  const url=URL.createObjectURL(doc.output('blob')); const a=qs('#btnScarica'); a.href=url; a.download='preventivo-elip-dettaglio.pdf'; a.classList.remove('d-none'); a.click();
}
async function generatePDFTotalOnly(){
  const { jsPDF } = window.jspdf||{}; if(!jsPDF){ alert('Libreria PDF non caricata.'); return; }
  const rec=collectForm(), doc=new jsPDF({unit:'pt',format:'a4'}), pad=40;
  await addLogo(doc,pad); pdfHeader(doc,pad,rec);
  const rows=rec.rows.filter(r=>r.flag).map(r=>[r.code,r.desc]);
  if(rows.length===0) rows.push(['—','Nessuna voce selezionata']);
  doc.autoTable({startY:210,head:[['Cod','Descrizione lavori inclusi']],body:rows,
    styles:{fontSize:10,cellPadding:5},headStyles:{fillColor:[224,123,57]},columnStyles:{0:{cellWidth:60},1:{cellWidth:450}}});
  let y=doc.lastAutoTable.finalY+12;
  const note=(rec.note||'').trim(); if(note){ doc.setFontSize(11); doc.text('NOTE', pad, y); y+=8; doc.setFontSize(10); const w=doc.splitTextToSize(note,455); doc.text(w,pad,y); y+=(w.length*12)+6; }
  doc.setFontSize(12); doc.text('TOTALE: '+EURO(rec.total), pad, y); y+=22;
  y=pdfStato(doc,pad,y+8,rec); pdfFooter(doc);
  const url=URL.createObjectURL(doc.output('blob')); const a=qs('#btnScarica'); a.href=url; a.download='preventivo-elip-totale.pdf'; a.classList.remove('d-none'); a.click();
}

function prepareMail(){
  const rec=collectForm();
  const subject=encodeURIComponent('Preventivo ELIP - '+(rec.cliente||''));
  const body=encodeURIComponent('Buongiorno,\n\nIn allegato il preventivo in PDF.\nCliente: '+(rec.cliente||'-')+'\nArticolo: '+(rec.articolo||'-')+'\nTotale: '+EURO(rec.total)+'\n\nCordiali saluti.');
  window.location.href='mailto:'+(rec.email||'')+'?subject='+subject+'&body='+body;
}

function renderArchive(){
  const arr=JSON.parse(localStorage.getItem('preventivo_elip_archive')||'[]');
  const fStato=qs('#filterStato').value;
  const fQuery=(qs('#filterQuery').value||'').toLowerCase();
  const body=qs('#archBody'); body.innerHTML='';
  const now=new Date(); const in7=new Date(now.getTime()+7*24*60*60*1000);
  arr.filter(r=>{
    const k=(r.cliente+' '+r.articolo+' '+(r.ddt||'')).toLowerCase();
    return (!fStato||r.stato===fStato)&&(!fQuery||k.includes(fQuery));
  }).forEach(rec=>{
    const tr=document.createElement('tr');
    // alert consegna
    if(rec.stato==='CONFERMATO'&&rec.consegnaData){
      const d=new Date(rec.consegnaData+'T00:00:00'); if(d>=now && d<=in7) tr.classList.add('alert-row');
    }
    // semaforo
    const pct=computeOverallProgress(rec);
    let semaf=`<span class="badge bg-warning text-dark">${pct}%</span>`;
    if(rec.stato==='CHIUSO') semaf='<span class="badge bg-success">verde</span>';
    else if(pct>50 && pct<100) semaf='<span class="badge bg-orange">arancione</span>';
    else if(pct<=50) semaf='<span class="badge bg-warning text-dark">giallo</span>';
    const dateIt=new Date(rec.createdAt).toLocaleDateString('it-IT');
    tr.innerHTML=`
      <td>${rec.id}</td><td>${dateIt}</td><td>${rec.cliente||''}</td>
      <td>${rec.articolo||''}</td><td>${rec.ddt||''}</td><td>${rec.stato||''}</td>
      <td>${rec.consegnaData||''}</td><td>${sema} ${pct}%</td><td>${EURO(rec.total||0)}</td>
      <td><button class="btn btn-sm btn-outline-primary" data-open="${rec.id}">Apri</button></td>`;
    body.appendChild(tr);
  });
  body.querySelectorAll('button[data-open]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id=btn.getAttribute('data-open');
      const arr=JSON.parse(localStorage.getItem('preventivo_elip_archive')||'[]');
      const rec=arr.find(x=>x.id===id); if(!rec) return;
      localStorage.setItem('preventivo_elip_current', JSON.stringify(rec));
      new bootstrap.Tab(document.getElementById('tab-new')).show();
      injectRows(); bindRowEvents(); loadDraft(); recalc();
      qs('#sheetId').textContent=rec.id;
      window.scrollTo({top:0,behavior:'smooth'});
    });
  });
}

function openProgressModal(idx){
  currentProgressIdx=idx;
  // ensure modal instance
  if(!progressModal){ progressModal=new bootstrap.Modal(document.getElementById('progressModal')); }
  const rec=getCurrent()||collectForm();
  const r=rec.rows[idx]||{}; const p=r.progress||{};
  qs('#pmCode').textContent='('+(r.code||'')+')';
  qs('#pmStato').value=p.stato||'DA_ESEGUIRE';
  qs('#pmReparto').value=p.reparto||'';
  qs('#pmOperatore').value=p.operatore||'';
  qs('#pmPresa').value=p.presa||'';
  qs('#pmConcluso').value=p.concluso||'';
  progressModal.show();
}
function saveProgressFromModal(){
  if(currentProgressIdx===null) return;
  const rec=collectForm();
  const r=rec.rows[currentProgressIdx];
  r.progress={
    stato: qs('#pmStato').value,
    reparto: qs('#pmReparto').value,
    operatore: qs('#pmOperatore').value.trim(),
    presa: qs('#pmPresa').value,
    concluso: qs('#pmConcluso').value
  };
  setCurrent(rec); injectRows(); bindRowEvents(); recalc();
  if(progressModal) progressModal.hide();
}

function setReadOnly(lock){
  const form=qs('#jobForm');
  if(lock) form.classList.add('readonly'); else form.classList.remove('readonly');
}

function bindTopButtons(){
  qs('#btnNuova').addEventListener('click', ()=>{
    if(confirm('Iniziare una nuova scheda? I dati correnti verranno azzerati.')){
      localStorage.removeItem('preventivo_elip_current'); location.reload();
    }
  });
  qs('#btnSalvaBozza').addEventListener('click', ()=>{
    saveDraft();
    const a=document.createElement('a');
    const data=localStorage.getItem('preventivo_elip_current')||'{}';
    a.href=URL.createObjectURL(new Blob([data],{type:'application/json'}));
    a.download='preventivo-elip-bozza.json'; a.click();
  });
  qs('#btnPDFDett').addEventListener('click', generatePDFDetailed);
  qs('#btnPDFTot').addEventListener('click', generatePDFTotalOnly);
  qs('#btnMail').addEventListener('click', prepareMail);
  qs('#btnArchivia').addEventListener('click', ()=>{ const rec=collectForm(); pushToArchive(rec); alert('Preventivo archiviato.'); });
  qs('#btnReloadArch').addEventListener('click', renderArchive);
  qs('#filterStato').addEventListener('change', renderArchive);
  qs('#filterQuery').addEventListener('input', renderArchive);
  qs('#pmSave').addEventListener('click', saveProgressFromModal);
  // stato lock
  qs('#stato').addEventListener('change', ()=>{
    const rec=collectForm(); setCurrent(rec);
    setReadOnly(rec.stato==='CHIUSO'); updateProgressBadge(rec);
  });
}
function bindOtherFields(){
  ['cliente','articolo','ddt','telefono','email','note','inviatoData','operatoreInvio','operatoreLavorazioni','consegnaData']
    .forEach(id=>{ const el=qs('#'+id); el.addEventListener('input', saveDraft); el.addEventListener('change', saveDraft); });
}

function init(){
  injectRows(); bindRowEvents(); bindTopButtons(); bindOtherFields(); loadDraft(); recalc();
  if(!qs('#sheetId').textContent) qs('#sheetId').textContent=newSheetId();
  renderArchive();
}
document.addEventListener('DOMContentLoaded', init);
