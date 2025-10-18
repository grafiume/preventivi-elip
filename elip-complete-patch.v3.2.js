
/*! elip-complete-patch.v3.2.js
   - Solo rosso/verde per tutte le icone
   - Evita doppi salvataggi: niente click handler aggiuntivo, wrap saveToSupabase con mutex
   - Conferma con numero esatto ritornato dal backend
   - Header: badge "Contatore preventivi" (#pvCounter) aggiornato dall'Archivio
   - Guard su toastSaved per evitare crash
*/
(function(){
  'use strict';
  function q(s, r){ return (r||document).querySelector(s); }
  function qa(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
  function text(el, t){ if (el) el.textContent = t; }
  function EURO(n){ try{ return (n||0).toLocaleString('it-IT',{style:'currency',currency:'EUR'}); }catch(e){ return String(n||0); } }
  function getCurrent(){ try{ return JSON.parse(localStorage.getItem('elip_current')||'null'); }catch(_){ return null; } }
  function setCurrent(o){ localStorage.setItem('elip_current', JSON.stringify(o)); }
  function getArchiveLocal(){ try{ return JSON.parse(localStorage.getItem('elip_archive')||'[]'); }catch(_){ return []; } }
  function setArchiveLocal(a){ localStorage.setItem('elip_archive', JSON.stringify(a)); }

  // --- Header: numero + contatore ---
  var AUTH_HEADER=''; var allow=false;
  function ensureHeaderNode(){
    var container=q('.appbar .fw-bold'); if(!container) return null;
    var num=q('#quoteId'); if(!num){ num=document.createElement('div'); num.id='quoteId'; num.className='small text-muted'; container.parentNode.insertBefore(num, container.nextSibling); }
    var cnt=q('#pvCounter'); if(!cnt){ cnt=document.createElement('span'); cnt.id='pvCounter'; container.appendChild(cnt); }
    return num;
  }
  function setHeaderNumero(n){ var v=(n && !/^ELP-/i.test(n) && n!=='—')?String(n).trim():''; AUTH_HEADER=v; allow=true; var el=ensureHeaderNode(); text(el, AUTH_HEADER); setTimeout(function(){allow=false;},0); }
  function setHeaderCount(n){ var c=q('#pvCounter'); if(!c){ ensureHeaderNode(); c=q('#pvCounter'); } if(c) c.textContent='Totale preventivi: '+(n||0); }
  var obs=new MutationObserver(function(ms){ ms.forEach(function(m){ if(m.target.id==='quoteId' && !allow){ if(m.target.textContent!==AUTH_HEADER) m.target.textContent=AUTH_HEADER; } }); });
  function arm(){ var el=q('#quoteId'); if(el) obs.observe(el,{childList:true,characterData:true,subtree:true}); }

  // --- Editor reset ---
  function resetEditorForm(){
    var root=q('#tab-editor')||document;
    qa('input,select,textarea',root).forEach(function(el){ if(el.type==='checkbox'||el.type==='radio') el.checked=false; else el.value=''; });
    ['progressBar','imponibile','iva','totale'].forEach(function(id,idx){
      var el=q('#'+id);
      if(!el) return;
      if(id==='progressBar'){ el.style.width='0%'; el.textContent='0%'; }
      else el.textContent='€ 0,00';
    });
    var ip=q('#imgPreview'); if(ip) ip.innerHTML='';
    var ok=q('#okPill'); if(ok){ ok.classList.remove('acc-ok'); ok.classList.add('acc-no'); ok.textContent='● NO'; }
  }
  function goEditorTab(){
    var btn=q('[data-bs-toggle="tab"][data-bs-target="#tab-editor"]'); if(btn){btn.click();return;}
    var tab=q('#tab-editor'), arch=q('#tab-archivio');
    if(tab&&arch){ tab.classList.add('show','active'); arch.classList.remove('show','active');
      qa('[data-bs-target="#tab-editor"]').forEach(function(b){ b.classList.add('active'); });
      qa('[data-bs-target="#tab-archivio"]').forEach(function(b){ b.classList.remove('active'); });
    }
  }

  // Disattiva legacy nextId
  window.nextId=function(){return '—';};

  // NEW
  function doNew(){
    var cur={ id:'—', createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] };
    setCurrent(cur); resetEditorForm();
    if(window.renderLines)window.renderLines();
    enhanceLines(); enhanceImages(); ensureAccDot(); updateAccUI();
    if(window.recalc)window.recalc();
    setHeaderNumero(''); goEditorTab();
    setTimeout(function(){ var c=q('#cliente'); if(c) c.focus(); },0);
  }
  window.newQuote=doNew;
  window.clearPage=function(){ var c=getCurrent()||{}; var b={ id:'—', createdAt:c.createdAt||new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] }; setCurrent(b); resetEditorForm(); if(window.renderLines)window.renderLines(); enhanceLines(); enhanceImages(); ensureAccDot(); updateAccUI(); if(window.recalc)window.recalc(); setHeaderNumero(''); };

  // fillForm/recalc hooks (robusti)
  ;(function(){ if(!window.fillForm) return; var _f=window.fillForm; window.fillForm=function(){ var r; try{ r=_f.apply(this,arguments);}catch(_){ } try{ var c=getCurrent()||{}; setHeaderNumero(c.id); enhanceLines(); enhanceImages(); ensureAccDot(); updateAccUI(); }catch(_){ } return r; }; })();
  ;(function(){ if(!window.recalc) return; var _r=window.recalc; window.recalc=function(){ var r; try{ r=_r.apply(this,arguments);}catch(_){ } try{ enhanceLines(); ensureAccDot(); updateAccUI(); }catch(_){ } return r; }; })();

  // Stato pallino (righe) - solo rosso/verde
  function enhanceLines(){
    var body=q('#linesBody'); if(!body) return;
    var rows=qa('tr', body);
    var cur=getCurrent()||{}; var lines=cur.lines||[];
    rows.forEach(function(tr, idx){
      var cells=tr.children; if(!cells || cells.length<6) return;
      var statoCell=cells[5];
      var isDone = !!(lines[idx] && lines[idx].doneDate && String(lines[idx].doneDate).trim());
      statoCell.innerHTML='';
      var b=document.createElement('button');
      b.className='btn-state-dot '+(isDone?'green':'red');
      b.title=isDone?'Completato':'Non eseguito';
      b.addEventListener('click', function(){
        var cur=getCurrent()||{}; cur.lines=cur.lines||[]; var L=cur.lines[idx]||{};
        if(L.doneDate && String(L.doneDate).trim()){ L.doneDate=''; }
        else{ var d=new Date(); L.doneDate = d.toISOString().slice(0,10); }
        cur.lines[idx]=L; setCurrent(cur);
        if(window.renderLines) window.renderLines();
        enhanceLines();
      });
      statoCell.appendChild(b);
    });
  }

  // Immagini thumbs + X
  function enhanceImages(){
    var cont=q('#imgPreview'); if(!cont) return;
    qa('.thumb-wrap', cont).forEach(function(wrap){
      if(!wrap.querySelector('.btn-del-img')){
        var i=wrap.querySelector('img'); if(!i) return;
        var del=document.createElement('button');
        del.className='btn-del-img'; del.type='button'; del.textContent='✕';
        del.addEventListener('click', function(e){
          e.preventDefault();
          var cur=getCurrent()||{}; cur.images=cur.images||[];
          var src=i.getAttribute('src');
          var pos=cur.images.indexOf(src);
          if(pos>-1){ cur.images.splice(pos,1); setCurrent(cur); }
          if(window.renderImages) window.renderImages();
          enhanceImages();
        });
        wrap.appendChild(del);
      }
      var img=wrap.querySelector('img.thumb')||wrap.querySelector('img');
      if(img){ img.classList.add('thumb'); }
      wrap.classList.add('thumb-wrap');
    });
  }

  // Data accettazione pallino (toggle)
  function ensureAccDot(){
    var input=q('#dataAcc'); if(!input) return;
    var lab=input.previousElementSibling;
    if(!lab) return;
    var dot=lab.querySelector('#accDot');
    if(!dot){
      dot=document.createElement('span'); dot.id='accDot'; dot.title='Imposta/togli data accettazione (oggi)';
      lab.appendChild(dot);
      dot.addEventListener('click', function(){
        var i=q('#dataAcc'); if(!i) return;
        if(i.value && String(i.value).trim()){ i.value=''; }
        else{ var d=new Date(); i.value=d.toISOString().slice(0,10); }
        var c=getCurrent()||{}; c.dataAcc=i.value||''; setCurrent(c); updateAccUI();
      });
    }
    input.addEventListener('change', function(){
      var c=getCurrent()||{}; c.dataAcc=input.value||''; setCurrent(c); updateAccUI();
    });
  }
  function updateAccUI(){
    var c=getCurrent()||{}; var has=!!(c.dataAcc && String(c.dataAcc).trim());
    var ok=q('#okPill'); if(ok){ ok.classList.toggle('acc-ok',has); ok.classList.toggle('acc-no',!has); ok.textContent=has?'● OK':'● NO'; }
    var d=q('#accDot'); if(d){ d.classList.toggle('green',has); d.classList.toggle('red',!has); }
  }

  // PDF buttons leave to original / fallback present in v3.1 if included

  // SALVA: wrap ONLY, no extra click binding — prevent duplicates
  var savingMutex=false;
  (function(){
    var tryWrap=function(){
      if (typeof window.saveToSupabase!=='function') return false;
      var _orig=window.saveToSupabase;
      window.saveToSupabase=async function(){
        if(savingMutex) return; // blocca salvataggi doppi
        savingMutex=true;
        try{
          var res=await _orig.apply(this, arguments);
          // estrai numero
          try{
            var data=res&&res.data?res.data:res;
            var rec=Array.isArray(data)?data[0]:data;
            var numero=rec&&(rec.numero||rec.id);
            if(numero){ var cur=getCurrent()||{}; cur.id=numero; setCurrent(cur); setHeaderNumero(numero); }
            // conferma
            showConfirm(numero);
            // aggiorna archivio/counters
            if (typeof renderArchive==='function') renderArchive();
          }catch(_){ }
          return res;
        } finally {
          savingMutex=false;
        }
      };
      return true;
    };
    if(!tryWrap()){ document.addEventListener('DOMContentLoaded', tryWrap); setTimeout(tryWrap, 1000); }
  })();

  // Conferma modal utility
  function showConfirm(numero){
    var modalId='saveConfirmModal';
    if(!q('#'+modalId)){
      var html=['<div class="modal fade" id="'+modalId+'" tabindex="-1">',
        '<div class="modal-dialog"><div class="modal-content">',
        '<div class="modal-header"><h5 class="modal-title">Salvato</h5>',
        '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>',
        '<div class="modal-body"><p id="saveConfirmText"></p></div>',
        '<div class="modal-footer"><button type="button" class="btn btn-primary" data-bs-dismiss="modal">OK</button></div>',
        '</div></div></div>'].join('');
      var d=document.createElement('div'); d.innerHTML=html; document.body.appendChild(d.firstChild);
    }
    var msg='Preventivo salvato con successo.'+(numero?(' N°: '+numero):'');
    var t=q('#saveConfirmText'); if(t) t.textContent=msg;
    if(window.bootstrap){ new bootstrap.Modal(q('#saveConfirmModal')).show(); } else alert(msg);
  }

  // Hook fetch per sincronizzare header e contatore
  ;(function(){
    if(!window.fetch) return; var _f=window.fetch;
    var rx=new RegExp("/rest/v1/preventivi","i");
    window.fetch=function(input,init){ return _f(input,init).then(function(resp){
      try{
        var url=(typeof input==='string')?input:(input&&input.url?input.url:'');
        var method=(init&&init.method)?String(init.method).toUpperCase():'GET';
        if(rx.test(url)&&(method==='POST'||method==='PATCH'||method==='PUT')){
          resp.clone().json().then(function(data){
            var rec = Array.isArray(data)?data[0]:data;
            var numero = rec && (rec.numero||rec.id);
            if(numero){ var cur=getCurrent()||{}; cur.id=numero; setCurrent(cur); setHeaderNumero(numero); }
            if (typeof renderArchive==='function') renderArchive();
          }).catch(function(){});
        }
      }catch(_){}
      return resp;
    }); };
  })();

  // Archivio rendering + counters + count badge
  async function loadRows(){
    if (!window.supabase) return getArchiveLocal();
    try{
      var res = await window.supabase.from('preventivi')
        .select('id,numero,created_at,createdAt,cliente,articolo,ddt,telefono,email,note,linee,lines,images,data_invio,dataInvio,data_accettazione,dataAccettazione,dataAcc,data_scadenza,dataScad,avanzamento,avanzamento_commessa,percentuale,progress,totale')
        .order('created_at',{ascending:false});
      return Array.isArray(res.data)?res.data:[];
    }catch(e){
      return getArchiveLocal();
    }
  }

  window.ACC_FILTER=window.ACC_FILTER||'all';
  async function renderArchive(){
    var rows=await loadRows();
    // header count
    setHeaderCount(rows.length||0);

    var acc=0,no=0,chiuse=0;
    var list=rows.map(function(r){
      var numero = r.numero || r.id;
      var created= r.created_at || r.createdAt;
      var accDate= r.data_accettazione || r.dataAccettazione || r.dataAcc;
      var adv = r.avanzamento || r.avanzamento_commessa || r.percentuale || r.progress || 0;
      var lines = r.linee || r.lines || [];
      var tot = (r.totale!=null)?r.totale:(lines.reduce(function(s,l){return s+(+l.qty||0)*(+l.price||0);},0)*1.22);
      var isAcc = !!(accDate && String(accDate).trim());
      var isChiusa = isAcc && Number(adv)>=100;
      if(isAcc) acc++; else no++;
      if(isChiusa) chiuse++;
      return {numero,created,cliente:r.cliente,articolo:r.articolo,ddt:r.ddt,totale:tot,isAcc,isChiusa,adv:Number(adv),data_scadenza:r.data_scadenza||r.dataScad};
    });

    // aggiorna bottoni con contatori
    text(q('#fltAll'),'Tutti');
    text(q('#fltOk'),'Accettati ('+acc+')');
    text(q('#fltNo'),'Non accettati ('+no+')');
    text(q('#fltChiusi'),'Chiusi ('+chiuse+')');

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
    filtered.forEach(function(rec){
      var pct=Number(rec.adv)||0;
      var dot=(pct===100)?'<span class="progress-dot" style="color:#198754">●</span>':'<span class="progress-dot" style="color:#dc3545">●</span>';
      // scadenza badge solo rosso/verde
      var scad='<span class="badge" style="background:#6c757d;color:#fff">—</span>';
      if(rec.data_scadenza){
        var d=new Date(rec.data_scadenza); var now=new Date(); d.setHours(0,0,0,0); now.setHours(0,0,0,0);
        scad = (d<now) ? '<span class="badge" style="background:#dc3545">Scaduto</span>' : '<span class="badge" style="background:#198754">OK</span>';
      }
      var acc = rec.isAcc?'<span class="acc-pill acc-ok">● OK</span>':'<span class="acc-pill acc-no">● NO</span>';
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
  window.renderArchive = renderArchive; // expose

  // Guard su toastSaved (se manca il DOM, non crasha)
  if(typeof window.toastSaved==='function'){
    var _ts=window.toastSaved;
    window.toastSaved=function(){
      try{ _ts.apply(this, arguments); }catch(_){ /* no-op */ }
    };
  }

  // Wire filters una volta sola
  (function wire(){
    var wired = window.__ELIP_FILTERS_WIRED__ || false;
    if(wired) return;
    ['fltAll','fltOk','fltNo','fltChiusi'].forEach(function(id){
      var el=q('#'+id); if(!el) return;
      el.addEventListener('click', function(){
        qa('.btn-group .btn').forEach(function(b){ b.classList.remove('active'); });
        el.classList.add('active');
        window.ACC_FILTER=(id==='fltOk'?'ok':id==='fltNo'?'no':id==='fltChiusi'?'chiusi':'all');
        renderArchive();
      }, {once:false});
    });
    window.__ELIP_FILTERS_WIRED__=true;
  })();

  // Boot
  async function boot(){
    ensureHeaderNode();
    setHeaderNumero('');
    arm();
    var cur=getCurrent();
    if(!cur){ setCurrent({ id:'—', createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] }); }
    cur=getCurrent()||{}; if(cur.id && cur.id!=='—' && !/^ELP-/i.test(cur.id)) setHeaderNumero(cur.id);
    enhanceLines(); enhanceImages(); ensureAccDot(); updateAccUI();
    renderArchive(); // inizializza contatori e tabella
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
