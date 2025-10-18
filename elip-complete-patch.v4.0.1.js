
/*! elip-complete-patch.v4.0.1.js
   - Guard se saveToSupabase non esiste
   - Messaggi chiari per config mancante
*/
(() => {
  'use strict';
  const q=(s,r)=>(r||document).querySelector(s);
  const qa=(s,r)=>Array.prototype.slice.call((r||document).querySelectorAll(s));
  const getCurrent=()=>{try{return JSON.parse(localStorage.getItem('elip_current')||'null')}catch(_){return null}};
  const setCurrent=(o)=>localStorage.setItem('elip_current',JSON.stringify(o||null));

  function setHeaderNumero(n){
    const el=q('#pvCurrent'); if(el) el.textContent = n?('N°: '+n):'';
    const id=q('#quoteId');   if(id) id.textContent = n||'';
  }

  function doNew(e){
    e?.preventDefault();
    setCurrent({ id:'—', createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] });
    // pulizia form
    const root=q('#tab-editor')||document;
    qa('input,select,textarea',root).forEach(el=>{ if(el.type==='checkbox'||el.type==='radio') el.checked=false; else el.value=''; });
    const pb=q('#progressBar'); if(pb){pb.style.width='0%';pb.textContent='0%';}
    ['imponibile','iva','totale'].forEach(id=>{ const x=q('#'+id); if(x) x.textContent='€ 0,00'; });
    const ok=q('#okPill'); if(ok){ ok.classList.remove('acc-ok'); ok.classList.add('acc-no'); ok.textContent='● NO'; }
    const prev=q('#imgPreview'); if(prev) prev.innerHTML='';
    if(window.renderLines) window.renderLines();
    if(window.renderImages) window.renderImages();
    if(window.recalc) window.recalc();
    setHeaderNumero('');
    const b=q('[data-bs-toggle="tab"][data-bs-target="#tab-editor"]'); if(b) b.click();
  }
  document.addEventListener('DOMContentLoaded',()=>{
    q('#btnNew')?.addEventListener('click',doNew);
    q('#btnClear')?.addEventListener('click',doNew);
  });

  async function renderArchive(){
    const loader = (typeof window.loadArchiveSupabase==='function') ? window.loadArchiveSupabase : async()=>[];
    const rows = await loader();
    let acc=0,no=0,chiuse=0;
    rows.forEach(r=>{
      const isAcc = !!(r.data_accettazione && String(r.data_accettazione).trim());
      const adv   = Number(r.avanzamento_commessa||0);
      const isChiusa = (r.is_chiusa!=null) ? !!r.is_chiusa : (isAcc && adv>=100);
      if(isAcc) acc++; else no++;
      if(isChiusa) chiuse++;
    });
    const fAll=q('#fltAll'), fOk=q('#fltOk'), fNo=q('#fltNo'), fCh=q('#fltChiusi');
    if(fAll) fAll.textContent='Tutti';
    if(fOk) fOk.textContent='Accettati ('+acc+')';
    if(fNo) fNo.textContent='Non accettati ('+no+')';
    if(fCh) fCh.textContent='Chiusi ('+chiuse+')';

    const body=q('#archBody'); if(!body) return; body.innerHTML='';
    const query=(q('#filterQuery')?.value||'').toLowerCase();
    const filter=window.ACC_FILTER||'all';
    rows.filter(r=>{
      const isAcc = !!(r.data_accettazione && String(r.data_accettazione).trim());
      const adv = Number(r.avanzamento_commessa||0);
      const isChiusa = (r.is_chiusa!=null) ? !!r.is_chiusa : (isAcc && adv>=100);
      let keep=true;
      if(filter==='ok') keep=isAcc; else if(filter==='no') keep=!isAcc; else if(filter==='chiusi') keep=isChiusa;
      if(keep && query) keep=(r.cliente||'').toLowerCase().includes(query);
      return keep;
    }).forEach(r=>{
      const isAcc = !!(r.data_accettazione && String(r.data_accettazione).trim());
      const adv = Number(r.avanzamento_commessa||0);
      const itDate=r.created_at?new Date(r.created_at).toLocaleDateString('it-IT'):'-';
      const dot=(adv>=100)?'<span style="color:#198754">●</span>':'<span style="color:#dc3545">●</span>';
      const acc=isAcc?'<span class="acc-ok">● OK</span>':'<span class="acc-no">● NO</span>';
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${r.numero||'-'}</td><td>${itDate}</td><td>${r.cliente||''}</td><td>${r.articolo||''}</td><td>${r.ddt||''}</td><td>${(r.totale||0).toLocaleString('it-IT',{style:'currency',currency:'EUR'})}</td><td>${acc}</td><td>—</td><td>${dot} ${adv}%</td><td><button class="btn btn-sm btn-outline-primary" data-open="${r.numero||''}">Modifica</button></td>`;
      body.appendChild(tr);
    });
  }
  window.renderArchive=renderArchive;
  document.addEventListener('DOMContentLoaded',()=>{
    q('#fltAll')?.addEventListener('click',()=>{window.ACC_FILTER='all';renderArchive();});
    q('#fltOk')?.addEventListener('click',()=>{window.ACC_FILTER='ok';renderArchive();});
    q('#fltNo')?.addEventListener('click',()=>{window.ACC_FILTER='no';renderArchive();});
    q('#fltChiusi')?.addEventListener('click',()=>{window.ACC_FILTER='chiusi';renderArchive();});
    q('#btnReloadArch')?.addEventListener('click',renderArchive);
  });

  function showConfirm(numero){
    let id='saveConfirmModal';
    if(!q('#'+id)){
      const html=['<div class="modal fade" id="'+id+'" tabindex="-1"><div class="modal-dialog"><div class="modal-content">',
        '<div class="modal-header"><h5 class="modal-title">Salvato</h5>',
        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>',
        '<div class="modal-body"><p id="saveConfirmText"></p></div>',
        '<div class="modal-footer"><button type="button" class="btn btn-primary" data-bs-dismiss="modal">OK</button></div>',
        '</div></div></div>'].join('');
      const d=document.createElement('div'); d.innerHTML=html; document.body.appendChild(d.firstChild);
    }
    const t=q('#saveConfirmText'); if(t) t.textContent='Preventivo salvato con successo. N°: '+(numero||'-');
    if(window.bootstrap){ new bootstrap.Modal(q('#saveConfirmModal')).show(); } else alert(t.textContent);
  }

  let saving=false;
  async function doSave(e){
    e?.preventDefault();
    if(saving) return; saving=true;
    try{
      if(typeof window.saveToSupabase!=='function'){
        throw new Error('Supabase non configurato: crea config.js (vedi config.sample.js)');
      }
      const res=await window.saveToSupabase();
      const data=res && res.data ? res.data : res;
      const numero=(data && (data.numero||data.id))||'';
      if(numero){ const cur=getCurrent()||{}; cur.id=numero; setCurrent(cur); setHeaderNumero(numero); }
      showConfirm(numero);
      renderArchive();
    }catch(err){
      console.error(err);
      alert(err.message||String(err));
    }finally{ saving=false; }
  }
  document.addEventListener('DOMContentLoaded',()=>{ q('#btnSave')?.addEventListener('click',doSave); });

  document.addEventListener('DOMContentLoaded',()=>{
    const cur=getCurrent();
    if(cur && cur.id && /^ELP-/.test(cur.id)) setHeaderNumero(cur.id);
    renderArchive();
  });
})();
