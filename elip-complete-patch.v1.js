
/*! elip-complete-patch.v1.js
   Patch unica per il tuo index + app.js
   - Disattiva contatore locale ELP e usa SOLO numero DB
   - Header (#quoteId): mostra '—' a nuovo/refresh, e numero DB dopo SALVA
   - NUOVO / PULISCI: reset + vai su tab Editor
   - Intercetta saveToSupabase e (in fallback) anche fetch su /rest/v1/preventivi
   - Contatori "Chiusi" (Archivio/Editor): avanzamento ≥10% e data accettazione valorizzata
*/
(function(){
  'use strict';
  function q(sel, root){ return (root||document).querySelector(sel); }
  function qa(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
  function getCurrent(){ try{ return JSON.parse(localStorage.getItem('elip_current')||'null'); }catch(_){ return null; } }
  function setCurrent(o){ localStorage.setItem('elip_current', JSON.stringify(o)); }
  var AUTH_HEADER = '—'; var allowExternalHeader = false;
  function renderHeader(val){
    var el = q('#quoteId');
    if (!el) {
      var host = q('.appbar .fw-bold');
      if (host){ el = document.createElement('div'); el.id='quoteId'; el.className='small text-muted'; host.parentNode.insertBefore(el, host.nextSibling); }
    }
    if (!el) return; el.textContent = val;
  }
  function setHeader(val){ AUTH_HEADER = (val && String(val).trim()) ? String(val).trim() : '—'; allowExternalHeader = true; renderHeader(AUTH_HEADER); setTimeout(function(){ allowExternalHeader = false; }, 0); }
  function looksLegacy(t){ return /^ELP-\d{4}-\d+/i.test(String(t||'').trim()); }
  var headerObs = new MutationObserver(function(muts){ muts.forEach(function(m){ var t=m.target; if (t && t.id==='quoteId'){ if (!allowExternalHeader){ var cur=t.textContent; if (cur!==AUTH_HEADER || looksLegacy(cur)) t.textContent=AUTH_HEADER; } } }); });
  function armHeaderObserver(){ var el=q('#quoteId'); if (el) headerObs.observe(el,{childList:true,characterData:true,subtree:true}); }
  function resetEditorForm(){
    var root=q('#tab-editor')||document;
    qa('input, select, textarea', root).forEach(function(el){ if (el.type==='checkbox'||el.type==='radio') el.checked=false; else el.value=''; });
    var pb=q('#progressBar'); if (pb){ pb.style.width='0%'; pb.textContent='0%'; }
    var imgPrev=q('#imgPreview'); if (imgPrev) imgPrev.innerHTML='';
    var imp=q('#imponibile'); if (imp) imp.textContent='€ 0,00';
    var iva=q('#iva'); if (iva) iva.textContent='€ 0,00';
    var tot=q('#totale'); if (tot) tot.textContent='€ 0,00';
  }
  function goEditorTab(){
    var btn=q('[data-bs-target="#tab-editor"]'); if (btn){ btn.click(); return; }
    var tab=q('#tab-editor'), arch=q('#tab-archivio');
    if (tab && arch){ tab.classList.add('show','active'); arch.classList.remove('show','active'); qa('[data-bs-target="#tab-editor"]').forEach(function(b){ b.classList.add('active'); }); qa('[data-bs-target="#tab-archivio"]').forEach(function(b){ b.classList.remove('active'); }); }
  }
  window.nextId=function(){ return '—'; };
  window.newQuote=function(){
    var cur={ id:'—', createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] };
    setCurrent(cur); resetEditorForm();
    if (typeof window.renderLines==='function') window.renderLines();
    if (typeof window.renderImages==='function') window.renderImages();
    if (typeof window.recalc==='function') window.recalc();
    setHeader('—'); goEditorTab(); setTimeout(function(){ var c=q('#cliente'); if (c) c.focus(); }, 0);
  };
  window.clearPage=function(){
    var c=getCurrent(); if (!c) c={ createdAt:new Date().toISOString() };
    var b={ id:'—', createdAt:c.createdAt||new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] };
    setCurrent(b); resetEditorForm();
    if (typeof window.renderLines==='function') window.renderLines();
    if (typeof window.renderImages==='function') window.renderImages();
    if (typeof window.recalc==='function') window.recalc();
    setHeader('—');
  };
  (function patchFillForm(){ if (!window.fillForm) return; var _orig=window.fillForm; window.fillForm=function(){ var r=_orig.apply(this, arguments); try{ var c=getCurrent()||{}; setHeader((c.id && String(c.id).trim())?c.id:'—'); }catch(e){} return r; }; })();
  (function hookSave(){
    var tryWrap=function(){
      if (!window.saveToSupabase) return false;
      var _orig=window.saveToSupabase;
      window.saveToSupabase=async function(){ var res=await _orig.apply(this, arguments); try{ var data=res&&res.data?res.data:res; var rec=Array.isArray(data)?data[0]:data; var numero=rec&&(rec.numero||rec.id); if (numero){ var cur=getCurrent()||{}; cur.id=numero; setCurrent(cur); setHeader(numero);} }catch(e){} return res; };
      return true;
    };
    if (!tryWrap()){ document.addEventListener('DOMContentLoaded', tryWrap); setTimeout(tryWrap, 1000); }
  })();
  (function wrapFetch(){
    if (!window.fetch) return;
    var _orig=window.fetch;
    window.fetch=function(input, init){
      return _orig(input, init).then(function(resp){
        try{
          var url=(typeof input==='string')?input:(input&&input.url?input.url:'');
          var method=(init&&init.method)?String(init.method).toUpperCase():'GET';
          if (/\/rest\/v1\/preventivi/i.test(url) && (method==='POST'||method==='PATCH'||method==='PUT')){
            resp.clone().json().then(function(data){
              var rec=null; if (data && Array.isArray(data) && data.length>0) rec=data[0]; else if (data && typeof data==='object') rec=data;
              if (rec && (rec.numero||rec.id)){ var numero=rec.numero||rec.id; var cur=getCurrent()||{}; cur.id=numero; setCurrent(cur); setHeader(numero); }
            }).catch(function(){});
          }
        }catch(e){}
        return resp;
      });
    };
  })();
  function ensureBadgeAfter(node, id){
    var b=document.getElementById(id);
    if (!b){ b=document.createElement('span'); b.id=id; b.className='badge-chiusi'; b.style.marginLeft='6px'; b.style.padding='2px 8px'; b.style.borderRadius='10px'; b.style.background='#d1e7dd'; b.style.border='1px solid #badbcc'; b.style.fontSize='0.85em'; b.style.fontWeight='600'; }
    b.textContent='Chiusi: 0';
    if (node && b.parentNode !== node.parentNode){ node.parentNode.insertBefore(b, node.nextSibling); }
    return b;
  }
  function placeCounters(){ var fltOk=q('#fltOk'); var fltNo=q('#fltNo'); if (fltOk) ensureBadgeAfter(fltOk,'countChiusiArchive'); if (fltNo) ensureBadgeAfter(fltNo,'countChiusiEditor'); }
  async function countChiusi(){
    if (!window.supabase) return null;
    var advCols=['avanzamento','avanzamento_commessa','percentuale','progress'];
    var dateCols=['dataAccettazione','data_accettazione','accettazione_data','dataAcc'];
    for (var a=0;a<advCols.length;a++){ for (var d=0; d<dateCols.length; d++){ try{ var q1=window.supabase.from('preventivi').select('*',{count:'exact',head:true}); q1=q1.gte(advCols[a],10).not(dateCols[d],'is',null); var res=await q1; if (res && typeof res.count==='number') return res.count; }catch(e){} } }
    try{
      var res2=await window.supabase.from('preventivi').select('id,avanzamento,avanzamento_commessa,percentuale,progress,dataAccettazione,data_accettazione,accettazione_data,dataAcc').limit(10000);
      if (res2 && Array.isArray(res2.data)){ var cnt=0; res2.data.forEach(function(r){ var adv=r.avanzamento ?? r.avanzamento_commessa ?? r.percentuale ?? r.progress ?? 0; var dt=r.dataAccettazione ?? r.data_accettazione ?? r.accettazione_data ?? r.dataAcc ?? null; if (Number(adv)>=10 && dt) cnt++; }); return cnt; }
    }catch(e){}
    return null;
  }
  async function refreshCounters(){ placeCounters(); var count=await countChiusi(); if (typeof count==='number'){ var a=q('#countChiusiArchive'); if (a) a.textContent='Chiusi: '+count; var e=q('#countChiusiEditor'); if (e) e.textContent='Chiusi: '+count; } }
  function boot(){
    var cur=getCurrent();
    if (!cur){ setCurrent({ id:'—', createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] }); }
    else { cur.id=(cur.id && !/^ELP-/i.test(cur.id))?cur.id:'—'; setCurrent(cur); }
    setHeader('—'); armHeaderObserver(); goEditorTab(); resetEditorForm(); refreshCounters(); setInterval(refreshCounters, 30000);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
