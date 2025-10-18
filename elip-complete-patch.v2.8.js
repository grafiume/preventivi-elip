
/*! elip-complete-patch.v2.8.js
   Fix:
   - Evita "Invalid regular expression flags" usando RegExp per match dell'endpoint.
   - Wrap robusto: _orig.apply() in try/catch per fillForm/recalc (se app.js accede a nodi mancanti non crasha).
   - Resta: header solo numero, Nuovo/Editor, filtri eleganti con contatori nei bottoni, accCounters disattivato.
*/
(function(){
  'use strict';
  function q(s, r){ return (r||document).querySelector(s); }
  function qa(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
  function text(el, t){ if (el) el.textContent = t; }
  function EURO(n){ try{ return (n||0).toLocaleString('it-IT',{style:'currency',currency:'EUR'}); }catch(e){ return String(n||0); } }
  function getCurrent(){ try{ return JSON.parse(localStorage.getItem('elip_current')||'null'); }catch(_){ return null; } }
  function setCurrent(o){ localStorage.setItem('elip_current', JSON.stringify(o)); }

  // Header only number
  var AUTH_HEADER=''; var allow=false;
  function ensureHeaderNode(){ var el=q('#quoteId'); if(!el){ var host=q('.appbar .fw-bold'); if(host){ el=document.createElement('div'); el.id='quoteId'; el.className='small text-muted'; host.parentNode.insertBefore(el, host.nextSibling);} } return el; }
  function setHeaderNumero(n){ var v=(n && !/^ELP-/i.test(n) && n!=='—')?String(n).trim():''; AUTH_HEADER=v; allow=true; var el=ensureHeaderNode(); text(el, AUTH_HEADER); setTimeout(function(){allow=false;},0); }
  var obs=new MutationObserver(function(ms){ ms.forEach(function(m){ if(m.target.id==='quoteId' && !allow){ if(m.target.textContent!==AUTH_HEADER) m.target.textContent=AUTH_HEADER; } }); });
  function arm(){ var el=q('#quoteId'); if(el) obs.observe(el,{childList:true,characterData:true,subtree:true}); }

  // Reset editor + tab
  function resetEditorForm(){
    var root=q('#tab-editor')||document;
    qa('input,select,textarea',root).forEach(function(el){ if(el.type==='checkbox'||el.type==='radio') el.checked=false; else el.value=''; });
    var pb=q('#progressBar'); if(pb){pb.style.width='0%';pb.textContent='0%';}
    var imp=q('#imponibile'); if(imp) imp.textContent='€ 0,00';
    var iva=q('#iva'); if(iva) iva.textContent='€ 0,00';
    var tot=q('#totale'); if(tot) tot.textContent='€ 0,00';
    var img=q('#imgPreview'); if(img) img.innerHTML='';
    var ok=q('#okPill'); if(ok){ ok.classList.remove('acc-ok'); ok.classList.add('acc-no'); ok.textContent='● NO'; }
  }
  function goEditorTab(){
    var btn=q('[data-bs-target="#tab-editor"]'); if(btn){btn.click();return;}
    var tab=q('#tab-editor'), arch=q('#tab-archivio');
    if(tab&&arch){ tab.classList.add('show','active'); arch.classList.remove('show','active');
      qa('[data-bs-target="#tab-editor"]').forEach(b=>b.classList.add('active'));
      qa('[data-bs-target="#tab-archivio"]').forEach(b=>b.classList.remove('active')); }
  }

  // Block legacy id
  window.nextId=function(){return '—';};

  function doNew(){
    var cur={id:'—',createdAt:new Date().toISOString(),cliente:'',articolo:'',ddt:'',telefono:'',email:'',dataInvio:'',dataAcc:'',dataScad:'',note:'',lines:[],images:[]};
    setCurrent(cur); resetEditorForm();
    if(window.renderLines)window.renderLines();
    if(window.renderImages)window.renderImages();
    if(window.recalc)window.recalc();
    setHeaderNumero(''); goEditorTab(); setTimeout(function(){var c=q('#cliente'); if(c)c.focus();},0);
  }
  window.newQuote=doNew;
  window.clearPage=function(){ var c=getCurrent()||{}; var b={id:'—',createdAt:c.createdAt||new Date().toISOString(),cliente:'',articolo:'',ddt:'',telefono:'',email:'',dataInvio:'',dataAcc:'',dataScad:'',note:'',lines:[],images:[]}; setCurrent(b); resetEditorForm(); if(window.renderLines)window.renderLines(); if(window.renderImages)window.renderImages(); if(window.recalc)window.recalc(); setHeaderNumero(''); };

  // Patch fillForm/recalc with try/catch around original
  (function(){
    if(!window.fillForm) return;
    var _f=window.fillForm;
    window.fillForm=function(){
      var r;
      try{ r=_f.apply(this,arguments); }catch(e){ /* evita crash da app.js */ }
      try{
        var c=getCurrent()||{};
        setHeaderNumero(c.id);
        var ok=q('#okPill'); if(ok){
          var has=!!(c.dataAcc&&String(c.dataAcc).trim());
          ok.classList.toggle('acc-ok',has); ok.classList.toggle('acc-no',!has); ok.textContent= has?'● OK':'● NO';
        }
      }catch(e){}
      return r;
    };
  })();
  (function(){
    if(!window.recalc) return;
    var _r=window.recalc;
    window.recalc=function(){
      var r;
      try{ r=_r.apply(this,arguments); }catch(e){ /* evita crash da app.js */ }
      try{
        var c=getCurrent()||{};
        var impEl=q('#imponibile'),ivaEl=q('#iva'),totEl=q('#totale');
        if(!(impEl&&ivaEl&&totEl)){
          var lines=c.lines||[]; var imp=lines.reduce((s,rr)=>s+(+rr.qty||0)*(+rr.price||0),0); var iva=imp*0.22, tot=imp+iva;
          if(impEl)impEl.textContent=EURO(imp); if(ivaEl)ivaEl.textContent=EURO(iva); if(totEl)totEl.textContent=EURO(tot);
        }
        var ok=q('#okPill'); if(ok){
          var has=false; var i=q('#dataAcc');
          if(i&&i.value&&String(i.value).trim()) has=true; else if(c.dataAcc&&String(c.dataAcc).trim()) has=true;
          ok.classList.toggle('acc-ok',has); ok.classList.toggle('acc-no',!has); ok.textContent=has?'● OK':'● NO';
        }
      }catch(e){}
      return r;
    };
  })();

  // save/fetch + poll (no regex literal)
  async function pollLastNumero(){ if(!window.supabase) return; try{ var res=await window.supabase.from('preventivi').select('numero, created_at').order('created_at',{ascending:false}).limit(1); var rec=res&&res.data&&res.data[0]; if(rec&&rec.numero){ var cur=getCurrent()||{}; cur.id=rec.numero; setCurrent(cur); setHeaderNumero(rec.numero);} }catch(e){} }
  ;(function(){
    var wrap=function(){ if(!window.saveToSupabase) return false; var _o=window.saveToSupabase; window.saveToSupabase=async function(){ var res=await _o.apply(this,arguments); try{ var data=res&&res.data?res.data:res; var rec=Array.isArray(data)?data[0]:data; var numero=rec&&(rec.numero||rec.id); if(numero){ var cur=getCurrent()||{}; cur.id=numero; setCurrent(cur); setHeaderNumero(numero);} else { setTimeout(pollLastNumero,300); setTimeout(pollLastNumero,1200);} }catch(e){ setTimeout(pollLastNumero,1200);} return res; }; return true; };
    if(!wrap()){ document.addEventListener('DOMContentLoaded',wrap); setTimeout(wrap,1000); }
  })();
  ;(function(){
    if(!window.fetch) return; var _f=window.fetch;
    var rx = new RegExp('/rest/v1/preventivi','i');
    window.fetch=function(input,init){ return _f(input,init).then(function(resp){ try{ var url=(typeof input==='string')?input:(input&&input.url?input.url:''); var method=(init&&init.method)?String(init.method).toUpperCase():'GET'; if(rx.test(url)&&(method==='POST'||method==='PATCH'||method==='PUT')){ resp.clone().json().then(function(data){ var rec=null; if(data&&Array.isArray(data)&&data.length>0) rec=data[0]; else if(data&&typeof data==='object') rec=data; if(rec&&(rec.numero||rec.id)){ var n=rec.numero||rec.id; var cur=getCurrent()||{}; cur.id=n; setCurrent(cur); setHeaderNumero(n);} else { setTimeout(pollLastNumero,300); setTimeout(pollLastNumero,1200);} }).catch(function(){ setTimeout(pollLastNumero,1200);}); } }catch(e){} return resp; }); };
  })();

  // Archivio + filters
  function pick(fields,obj){ for(var i=0;i<fields.length;i++){ var k=fields[i]; if(obj&&obj[k]!=null) return obj[k]; } return null; }
  async function loadRows(){ if(!window.supabase) return []; try{ var res=await window.supabase.from('preventivi').select('id,numero,created_at,createdAt,cliente,articolo,ddt,telefono,email,note,linee,lines,images,data_invio,dataInvio,data_accettazione,dataAccettazione,dataAcc,data_scadenza,dataScad,avanzamento,avanzamento_commessa,percentuale,progress,totale').order('created_at',{ascending:false}); return Array.isArray(res.data)?res.data:[]; }catch(e){ return []; } }

  window.ACC_FILTER=window.ACC_FILTER||'all';

  async function renderArchive(){
    var rows=await loadRows();
    var acc=0,no=0,chiuse=0;
    var list=rows.map(function(r){
      var numero=pick(['numero','id'],r);
      var created=pick(['created_at','createdAt'],r);
      var accDate=pick(['data_accettazione','dataAccettazione','dataAcc'],r);
      var adv=pick(['avanzamento','avanzamento_commessa','percentuale','progress'],r)||0;
      var lines=pick(['linee','lines'],r)||[];
      var tot=(r.totale!=null)?r.totale:(lines.reduce((s,l)=>s+(+l.qty||0)*(+l.price||0),0)*1.22);
      var isAcc=!!(accDate&&String(accDate).trim());
      var isChiusa=isAcc && Number(adv)>=100;
      if(isAcc)acc++; else no++;
      if(isChiusa)chiuse++;
      return {numero,created,cliente:r.cliente,articolo:r.articolo,ddt:r.ddt,totale:tot,isAcc,isChiusa,adv:Number(adv),data_scadenza:pick(['data_scadenza','dataScad'],r)};
    });

    // buttons counters
    var bAll=q('#fltAll'), bOk=q('#fltOk'), bNo=q('#fltNo'), bCh=q('#fltChiusi');
    if(bAll) text(bAll, 'Tutti');
    if(bOk)  text(bOk,  'Accettati ('+acc+')');
    if(bNo)  text(bNo,  'Non accettati ('+no+')');
    if(bCh)  text(bCh,  'Chiusi ('+chiuse+')');

    var qtext=(q('#filterQuery') && q('#filterQuery').value || '').toLowerCase();
    var filtered=list.filter(function(r){
      var keep=true;
      if(window.ACC_FILTER==='ok') keep=r.isAcc;
      else if(window.ACC_FILTER==='no') keep=!r.isAcc;
      else if(window.ACC_FILTER==='chiusi') keep=r.isChiusa;
      if(keep && qtext) keep=String(r.cliente||'').toLowerCase().includes(qtext);
      return keep;
    });

    var body=q('#archBody'); if(!body) return; body.innerHTML='';
    var today=new Date(); today.setHours(0,0,0,0);
    filtered.forEach(function(rec){
      var pct=Number(rec.adv)||0;
      var dot=(pct===100)?'<span class="progress-dot" style="color:#198754">●</span>':(pct>=50?'<span class="progress-dot" style="color:#ffc107">●</span>':'<span class="progress-dot" style="color:#dc3545">●</span>');
      var scad='<span class="text-muted">-</span>';
      if(rec.data_scadenza){
        var d=new Date(rec.data_scadenza); d.setHours(0,0,0,0);
        var diff=Math.round((d-today)/(1000*60*60*24));
        if(diff<=5 && diff>=0) scad='<span class="badge bg-warning-subtle text-dark">Scade in '+diff+' g</span>';
        else if(diff<0) scad='<span class="badge bg-danger">Scaduto</span>';
        else scad=new Date(rec.data_scadenza).toLocaleDateString('it-IT');
      }
      var acc=rec.isAcc?'<span class="acc-pill acc-ok">● OK</span>':'<span class="acc-pill acc-no">● NO</span>';
      var itDate=rec.created?new Date(rec.created).toLocaleDateString('it-IT'):'-';
      var tr=document.createElement('tr');
      tr.innerHTML='<td>'+(rec.numero||'-')+'</td><td>'+itDate+'</td><td>'+(rec.cliente||'')+'</td><td>'+(rec.articolo||'')+'</td><td>'+(rec.ddt||'')+'</td><td>'+EURO(rec.totale||0)+'</td><td>'+acc+'</td><td>'+scad+'</td><td>'+dot+' '+pct+'%'+'</td><td><button class="btn btn-sm btn-outline-primary" data-open="'+(rec.numero||'')+'">Modifica</button></td>';
      body.appendChild(tr);
    });

    body.onclick=function(e){
      var b=e.target.closest('button[data-open]'); if(!b) return;
      var numero=b.getAttribute('data-open');
      var cur=getCurrent()||{}; cur.id=numero; setCurrent(cur); setHeaderNumero(numero);
      if(window.fillForm)window.fillForm();
      if(window.renderLines)window.renderLines();
      if(window.renderImages)window.renderImages();
      if(window.recalc)window.recalc();
      goEditorTab();
    };
  }

  function wireFilters(){
    ['fltAll','fltOk','fltNo','fltChiusi'].forEach(function(id){
      var el=q('#'+id); if(el){ el.classList.add('btn-filter'); el.addEventListener('click', function(){ 
        qa('.btn-group .btn').forEach(function(b){ b.classList.remove('active'); });
        el.classList.add('active');
        window.ACC_FILTER = (id==='fltOk'?'ok':id==='fltNo'?'no':id==='fltChiusi'?'chiusi':'all');
        renderArchive();
      });}
    });
    var input=q('#filterQuery'); if(input) input.addEventListener('input', renderArchive);
    var reload=q('#btnReloadArch'); if(reload) reload.addEventListener('click', renderArchive);
  }

  function boot(){
    setHeaderNumero(''); arm();
    var bNew=q('#btnNew'); if(bNew) bNew.addEventListener('click', function(e){ e.preventDefault(); doNew(); });
    var bClear=q('#btnClear'); if(bClear) bClear.addEventListener('click', function(e){ e.preventDefault(); window.clearPage(); });
    var cur=getCurrent(); if(!cur) setCurrent({id:'—',createdAt:new Date().toISOString(),cliente:'',articolo:'',ddt:'',telefono:'',email:'',dataInvio:'',dataAcc:'',dataScad:'',note:'',lines:[],images:[]});
    goEditorTab(); resetEditorForm();
    wireFilters(); renderArchive();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
