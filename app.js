
// app.js — minimal helpers used by the patch (keeps your current behavior)
if(!window.__ELIP_APP_LOADED){window.__ELIP_APP_LOADED=true;
const qs=s=>document.querySelector(s);
const EURO=n=>(n||0).toLocaleString('it-IT',{style:'currency',currency:'EUR'});
function getCurrent(){try{return JSON.parse(localStorage.getItem('elip_current')||'null')}catch(_){return null}}
function setCurrent(o){localStorage.setItem('elip_current',JSON.stringify(o))}

window.renderLines=function(){
  const c=getCurrent()||{lines:[]};
  const b=document.getElementById('linesBody'); if(!b) return;
  b.innerHTML='';
  (c.lines||[]).forEach((r,i)=>{
    const isDone=!!(r.doneDate&&String(r.doneDate).trim());
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><input class="form-control form-control-sm line-code" data-idx="${i}" value="${r.code||''}" placeholder="Cod."></td>
      <td><input class="form-control form-control-sm line-desc" data-idx="${i}" value="${r.desc||''}" placeholder="Descrizione…"></td>
      <td><input type="number" min="0" step="1" class="form-control form-control-sm text-end line-qty" data-idx="${i}" value="${r.qty||1}"></td>
      <td><input type="number" min="0" step="0.01" class="form-control form-control-sm text-end line-price" data-idx="${i}" value="${r.price||0}"></td>
      <td class="text-end" id="lineTot${i}">€ 0,00</td>
      <td class="text-center"><span class="btn-state-dot ${isDone?'green':''}"></span></td>
      <td><input class="form-control form-control-sm line-operator" data-idx="${i}" value="${r.doneBy||''}" placeholder="Nome operatore"></td>
      <td><input type="date" class="form-control form-control-sm line-date" data-idx="${i}" value="${r.doneDate||''}"></td>
      <td><button class="btn btn-sm btn-outline-danger" data-del="${i}">✕</button></td>`;
    b.appendChild(tr);
  });
  recalc();
};
window.renderImages=function(){
  const c=getCurrent()||{}; const w=document.getElementById('imgPreview'); if(!w) return;
  w.innerHTML='';
  (c.images||[]).forEach((src,i)=>{
    const d=document.createElement('div'); d.className='thumb-wrap';
    d.innerHTML=`<img class="thumb" src="${src}"><button class="btn-del-img" data-delimg="${i}">✕</button>`;
    w.appendChild(d);
  });
  w.onclick=e=>{
    const b=e.target.closest('button[data-delimg]'); if(b){ const i=+b.getAttribute('data-delimg'); const c=getCurrent(); c.images.splice(i,1); setCurrent(c); window.renderImages(); }
  };
};
window.recalc=function(){
  const c=getCurrent()||{lines:[]};
  ['cliente','articolo','ddt','telefono','email','dataInvio','dataAcc','dataScad','note'].forEach(id=>{
    const el=document.getElementById(id); if(el) c[id]=el.value||'';
  });
  let imp=0;
  (c.lines||[]).forEach((r,i)=>{
    const t=(+r.qty||0)*(+r.price||0); imp+=t;
    const cell=document.getElementById('lineTot'+i); if(cell) cell.textContent=EURO(t);
  });
  const iva=imp*0.22, tot=imp+iva;
  const bar=document.getElementById('progressBar');
  // progress by doneDate presence
  let toDo=0, done=0;
  (c.lines||[]).forEach(r=>{ const has=(r.desc||'').trim()!==''||(+r.qty||0)>0||(+r.price||0)>0; if(has){toDo++; if(r.doneDate&&String(r.doneDate).trim())done++;} });
  const pct=toDo?Math.round((done/toDo)*100):0;
  if(bar){ bar.style.width=pct+'%'; bar.textContent=pct+'%'; }

  const ok=document.getElementById('okPill'); const hasAcc=(c.dataAcc||'').trim().length>0;
  if(ok){ ok.classList.toggle('acc-ok',hasAcc); ok.classList.toggle('acc-no',!hasAcc); ok.textContent=hasAcc?'● OK':'● NO'; }

  document.getElementById('imponibile')?.textContent=EURO(imp);
  document.getElementById('iva')?.textContent=EURO(iva);
  document.getElementById('totale')?.textContent=EURO(tot);
  setCurrent(c);
};

document.addEventListener('DOMContentLoaded',()=>{
  if(!getCurrent()){
    setCurrent({ id:'—', createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] });
  }
  renderLines(); renderImages(); recalc();
  // bind inputs
  ['cliente','articolo','ddt','telefono','email','dataInvio','dataAcc','dataScad','note'].forEach(id=>{
    const el=document.getElementById(id); if(el){ el.addEventListener('input',recalc); el.addEventListener('change',recalc); }
  });
});
}
