// Core logic for Preventivi ELIP
const WORK_ITEMS = [
  {code:"05",  desc:"Smontaggio completo del motore sistematico"},
  {code:"29",  desc:"Lavaggio componenti, e trattamento termico avvolgimenti"},
  {code:"06",  desc:"Verifiche meccaniche alberi e alloggiamento cuscinetti e verifiche elettriche avvolgimenti"},
  {code:"07",  desc:"Tornitura, smicatura ed equilibratura rotore"},
  {code:"22",  desc:"Sostituzione collettore con recupero avvolgimento"},
  {code:"01",  desc:"Avvolgimento indotto con recupero collettore"},
  {code:"01C", desc:"Avvolgimento indotto con sostituzione collettore"},
  {code:"08",  desc:"Isolamento statore"},
  {code:"02",  desc:"Avvolgimento statore"},
  {code:"31",  desc:"Lavorazioni meccaniche albero"},
  {code:"32",  desc:"Lavorazioni meccaniche flange"},
  {code:"19",  desc:"Sostituzione spazzole"},
  {code:"20",  desc:"Sostituzione molle premispazzole"},
  {code:"21",  desc:"Sostituzione cuscinetti"},
  {code:"23",  desc:"Sostituzione tenuta meccanica"},
  {code:"26",  desc:"Sostituzione guarnizioni/paraolio"},
  {code:"30",  desc:"Montaggio, collaudo e verniciatura"},
  {code:"16",  desc:"Ricambi vari"}
];

const EURO = n => n.toLocaleString('it-IT',{style:'currency',currency:'EUR'});
const qs = sel => document.querySelector(sel);

function newSheetId(){
  const d = new Date();
  const id = d.getFullYear().toString().slice(-2)+
            String(d.getMonth()+1).padStart(2,'0')+
            String(d.getDate()).padStart(2,'0')+'-'+
            String(d.getHours()).padStart(2,'0')+
            String(d.getMinutes()).padStart(2,'0');
  return 'ELIP-' + id;
}

function injectRows(){
  const tbody = qs('#workBody');
  tbody.innerHTML = '';
  WORK_ITEMS.forEach((w,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge bg-secondary-subtle text-secondary-emphasis">${w.code}</span></td>
      <td>${w.desc}</td>
      <td class="text-center">
        <input class="form-check-input item-flag" type="checkbox" data-idx="${i}" aria-label="flag ${w.code}">
      </td>
      <td>
        <div class="input-group">
          <span class="input-group-text">€</span>
          <input type="number" step="0.01" min="0" class="form-control text-end item-price" data-idx="${i}" placeholder="0,00" disabled>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

function recalc(){
  let subtotal = 0;
  document.querySelectorAll('.item-price').forEach(inp=>{
    if(!inp.disabled){
      const val = parseFloat(inp.value.replace(',', '.')) || 0;
      subtotal += val;
    }
  });
  const vat = subtotal * 0.22;
  qs('#subtot').textContent = EURO(subtotal);
  qs('#iva').textContent = EURO(vat);
  qs('#totale').textContent = EURO(subtotal + vat);
}

function bindRowEvents(){
  document.querySelectorAll('.item-flag').forEach(chk=>{
    chk.addEventListener('change', e=>{
      const idx = e.target.dataset.idx;
      const priceInput = document.querySelector('.item-price[data-idx="'+idx+'"]');
      priceInput.disabled = !e.target.checked;
      if(e.target.checked && !priceInput.value){ priceInput.focus(); }
      recalc(); saveDraft();
    });
  });
  document.querySelectorAll('.item-price').forEach(inp=>{
    inp.addEventListener('input', ()=>{ recalc(); saveDraft(); });
  });
}

function loadDraft(){
  const raw = localStorage.getItem('preventivo_elip_current');
  if(!raw) return;
  try{
    const data = JSON.parse(raw);
    ['cliente','articolo','ddt','telefono','email','note','inviatoData','operatoreInvio','operatoreLavorazioni','consegnaData']
      .forEach(id=>{ const el = qs('#'+id); if(el) el.value = data[id] || ''; });
    const stato = data['stato'] || 'DA_INVIARE';
    qs('#stato').value = stato;

    if(Array.isArray(data.rows)){
      data.rows.forEach((r, i)=>{
        const flag = qs('.item-flag[data-idx="'+i+'"]');
        const price = qs('.item-price[data-idx="'+i+'"]');
        if(flag && price){
          flag.checked = !!r.flag;
          price.disabled = !r.flag;
          price.value = r.price ?? '';
        }
      });
    }
  }catch(_){}
}

function collectForm(){
  const rows = WORK_ITEMS.map((w,i)=>{
    const flag = qs('.item-flag[data-idx="'+i+'"]').checked;
    const priceInp = qs('.item-price[data-idx="'+i+'"]');
    return {code:w.code, desc:w.desc, flag, price: priceInp.value};
  });
  const subtotal = Array.from(document.querySelectorAll('.item-price'))
    .reduce((sum, inp)=> sum + (inp.disabled ? 0 : (parseFloat(inp.value.replace(',', '.'))||0)), 0);
  const vat = subtotal * 0.22;
  const total = subtotal + vat;

  return {
    id: qs('#sheetId').textContent,
    createdAt: new Date().toISOString(),
    cliente: qs('#cliente').value.trim(),
    articolo: qs('#articolo').value.trim(),
    ddt: qs('#ddt').value.trim(),
    telefono: qs('#telefono').value.trim(),
    email: qs('#email').value.trim(),
    rows,
    subtotal, vat, total,
    note: qs('#note').value,
    stato: qs('#stato').value,
    inviatoData: qs('#inviatoData').value,
    operatoreInvio: qs('#operatoreInvio').value.trim(),
    operatoreLavorazioni: qs('#operatoreLavorazioni').value.trim(),
    consegnaData: qs('#consegnaData').value
  };
}

function saveDraft(){
  const data = collectForm();
  localStorage.setItem('preventivo_elip_current', JSON.stringify(data));
}

function pushToArchive(rec){
  const raw = localStorage.getItem('preventivo_elip_archive');
  const arr = raw ? JSON.parse(raw) : [];
  // replace if same id exists
  const idx = arr.findIndex(x => x.id === rec.id);
  if(idx >= 0) arr[idx] = rec; else arr.unshift(rec);
  localStorage.setItem('preventivo_elip_archive', JSON.stringify(arr));
}

async function generatePDF(){
  const { jsPDF } = window.jspdf || {};
  if(!jsPDF){ alert('Libreria PDF non caricata.'); return; }
  const rec = collectForm();
  const doc = new jsPDF({unit:'pt', format:'a4'});
  const pad = 40;
  const today = new Date();
  const dateIT = today.toLocaleDateString('it-IT');

  // logo
  try{
    const img = new Image();
    img.src = 'logo-elip.jpg';
    await img.decode();
    const c = document.createElement('canvas');
    const ratio = 420 / img.width;
    c.width = 420; c.height = Math.round(img.height * ratio);
    const ctx = c.getContext('2d'); ctx.drawImage(img,0,0,c.width,c.height);
    const dataURL = c.toDataURL('image/jpeg',0.92);
    doc.addImage(dataURL,'JPEG',pad,34,180,60);
  }catch(_){}

  doc.setFontSize(16);
  doc.text('Scheda Lavorazioni', pad, 110);
  doc.setFontSize(10);
  doc.text('Data: '+dateIT+'  •  N°: '+rec.id, pad, 126);
  doc.setFontSize(11);
  doc.text('Cliente: '+(rec.cliente||'-'), pad, 146);
  doc.text('Articolo: '+(rec.articolo||'-'), pad, 162);
  doc.text('DDT: '+(rec.ddt||'-'), pad, 178);
  doc.text('Telefono: '+(rec.telefono||'-')+'   Email: '+(rec.email||'-'), pad, 194);

  const rows = rec.rows.filter(r=>r.flag).map(r=>[r.code, r.desc, EURO(parseFloat((r.price||'0').replace(',', '.'))||0)]);
  if(rows.length === 0) rows.push(['—','Nessuna voce selezionata','€ 0,00']);

  doc.autoTable({
    startY: 210,
    head: [['Cod', 'Descrizione lavori', 'Importo']],
    body: rows,
    styles: {fontSize: 10, cellPadding: 5},
    headStyles: {fillColor: [224,123,57]},
    columnStyles: {0:{cellWidth:50},1:{cellWidth:360},2:{cellWidth:100, halign:'right'}}
  });

  let y = doc.lastAutoTable.finalY + 12;
  const noteText = (rec.note||'').trim();
  if(noteText){
    doc.setFontSize(11);
    doc.text('NOTE', pad, y); y+=8;
    doc.setFontSize(10);
    const wrapped = doc.splitTextToSize(noteText, 455);
    doc.text(wrapped, pad, y);
    y += (wrapped.length*12)+6;
  }

  doc.setFontSize(11);
  doc.text('Riepilogo', pad, y); y += 8;
  doc.setFontSize(10);
  doc.text('Subtotale: '+EURO(rec.subtotal), pad, y); y+=14;
  doc.text('IVA (22%): '+EURO(rec.vat), pad, y); y+=18;
  doc.setFontSize(12);
  doc.text('TOTALE: '+EURO(rec.total), pad, y); y+=22;

  // Stato
  const statoMap = {DA_INVIARE:'Da inviare', INVIATO:'Inviato', CONFERMATO:'Confermato'};
  y += 8;
  doc.setFontSize(11);
  doc.text('Stato preventivo', pad, y); y+=10;
  doc.setFontSize(10);
  doc.text('Stato: ' + (statoMap[rec.stato]||'-'), pad, y); y+=12;
  if(rec.inviatoData){ doc.text('Inviato il: ' + rec.inviatoData, pad, y); y+=12; }
  if(rec.operatoreInvio){ doc.text('Operatore invio: ' + rec.operatoreInvio, pad, y); y+=12; }
  if(rec.operatoreLavorazioni){ doc.text('Operatore lavorazioni: ' + rec.operatoreLavorazioni, pad, y); y+=12; }
  if(rec.consegnaData){ doc.text('Data presunta consegna: ' + rec.consegnaData, pad, y); y+=12; }

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = qs('#btnScarica');
  a.href = url;
  a.classList.remove('d-none');
  a.click();
}

function prepareMail(){
  const rec = collectForm();
  const subject = encodeURIComponent('Preventivo ELIP - ' + (rec.cliente||''));
  const body = encodeURIComponent(
    'Buongiorno,\n\nIn allegato il preventivo in PDF.\n' +
    'Cliente: ' + (rec.cliente||'-') + '\n' +
    'Articolo: ' + (rec.articolo||'-') + '\n' +
    'Totale: ' + EURO(rec.total) + '\n\n' +
    'Cordiali saluti.'
  );
  window.location.href = 'mailto:' + (rec.email||'') + '?subject='+subject+'&body='+body;
}

function renderArchive(){
  const raw = localStorage.getItem('preventivo_elip_archive');
  const arr = raw ? JSON.parse(raw) : [];
  const fStato = qs('#filterStato').value;
  const fQuery = (qs('#filterQuery').value||'').toLowerCase();
  const body = qs('#archBody');
  body.innerHTML = '';

  const now = new Date();
  const in7 = new Date(now.getTime() + 7*24*60*60*1000);

  arr.filter(r=>{
    const k = (r.cliente+' '+r.articolo+' '+(r.ddt||'')).toLowerCase();
    const okStato = !fStato || r.stato === fStato;
    const okQuery = !fQuery || k.includes(fQuery);
    return okStato && okQuery;
  }).forEach(rec=>{
    const tr = document.createElement('tr');
    // Alert if confirmed and consegna within 7 days
    let alert = false;
    if(rec.stato === 'CONFERMATO' && rec.consegnaData){
      const d = new Date(rec.consegnaData+'T00:00:00');
      if(d >= now && d <= in7) alert = true;
    }
    if(alert) tr.classList.add('alert-row');

    const dateIt = new Date(rec.createdAt).toLocaleDateString('it-IT');
    tr.innerHTML = `
      <td>${rec.id}</td>
      <td>${dateIt}</td>
      <td>${rec.cliente||''}</td>
      <td>${rec.articolo||''}</td>
      <td>${rec.ddt||''}</td>
      <td>${rec.stato||''}</td>
      <td>${rec.consegnaData||''}</td>
      <td>${EURO(rec.total||0)}</td>
      <td><button class="btn btn-sm btn-outline-primary" data-open="${rec.id}">Apri</button></td>
    `;
    body.appendChild(tr);
  });

  // open handler
  body.querySelectorAll('button[data-open]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-open');
      const arr = JSON.parse(localStorage.getItem('preventivo_elip_archive')||'[]');
      const rec = arr.find(x=>x.id===id);
      if(!rec) return;
      localStorage.setItem('preventivo_elip_current', JSON.stringify(rec));
      // switch tab to new and reload form
      const tab = new bootstrap.Tab(document.querySelector('#tab-new'));
      tab.show();
      injectRows(); bindRowEvents(); loadDraft(); recalc();
      qs('#sheetId').textContent = rec.id;
      window.scrollTo({top:0, behavior:'smooth'});
    });
  });
}

function bindTopButtons(){
  qs('#btnNuova').addEventListener('click', ()=>{
    if(confirm('Iniziare una nuova scheda? I dati correnti verranno azzerati.')){
      localStorage.removeItem('preventivo_elip_current');
      location.reload();
    }
  });
  qs('#btnSalvaBozza').addEventListener('click', ()=>{
    saveDraft();
    const a = document.createElement('a');
    const data = localStorage.getItem('preventivo_elip_current') || '{}';
    const blob = new Blob([data], {type:'application/json'});
    a.href = URL.createObjectURL(blob);
    a.download = 'preventivo-elip-bozza.json';
    a.click();
  });
  qs('#btnPDF').addEventListener('click', generatePDF);
  qs('#btnMail').addEventListener('click', prepareMail);
  qs('#btnArchivia').addEventListener('click', ()=>{
    const rec = collectForm();
    pushToArchive(rec);
    alert('Preventivo archiviato.');
  });
  qs('#btnReloadArch').addEventListener('click', renderArchive);
  qs('#filterStato').addEventListener('change', renderArchive);
  qs('#filterQuery').addEventListener('input', renderArchive);
}

function bindOtherFields(){
  ['cliente','articolo','ddt','telefono','email','note','stato','inviatoData','operatoreInvio','operatoreLavorazioni','consegnaData']
    .forEach(id=>{
      const el = qs('#'+id);
      el.addEventListener('input', saveDraft);
      el.addEventListener('change', saveDraft);
    });
}

function init(){
  injectRows();
  bindRowEvents();
  bindTopButtons();
  bindOtherFields();
  loadDraft();
  recalc();
  if(!qs('#sheetId').textContent) qs('#sheetId').textContent = newSheetId();
  renderArchive();
}
document.addEventListener('DOMContentLoaded', init);
