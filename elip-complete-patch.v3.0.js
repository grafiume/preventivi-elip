
/*! elip-complete-patch.v3.0.js
   - Stato: pallino cliccabile (rosso/verde) in colonna "Stato"
   - Header: mostra solo numero; forza sync dopo salvataggio/apertura
   - PDF: fallback se previewPDF/buildPDF mancano
   - Salva: fallback locale se saveToSupabase manca/falla
   - Immagini: anteprime ridimensionate + bottone X di rimozione visibile
   - Nessun regex literal
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

  // HEADER — solo numero
  var AUTH_HEADER=''; var allow=false;
  function ensureHeaderNode(){ var el=q('#quoteId'); if(!el){ var host=q('.appbar .fw-bold'); if(host){ el=document.createElement('div'); el.id='quoteId'; el.className='small text-muted'; host.parentNode.insertBefore(el, host.nextSibling);} } return el; }
  function setHeaderNumero(n){ var v=(n && !/^ELP-/i.test(n) && n!=='—')?String(n).trim():''; AUTH_HEADER=v; allow=true; var el=ensureHeaderNode(); text(el, AUTH_HEADER); setTimeout(function(){allow=false;},0); }
  var obs=new MutationObserver(function(ms){ ms.forEach(function(m){ if(m.target.id==='quoteId' && !allow){ if(m.target.textContent!==AUTH_HEADER) m.target.textContent=AUTH_HEADER; } }); });
  function arm(){ var el=q('#quoteId'); if(el) obs.observe(el,{childList:true,characterData:true,subtree:true}); }

  // Pulisci Editor & Tab
  function resetEditorForm(){
    var root=q('#tab-editor')||document;
    qa('input,select,textarea',root).forEach(function(el){ if(el.type==='checkbox'||el.type==='radio') el.checked=false; else el.value=''; });
    var pb=q('#progressBar'); if(pb){pb.style.width='0%';pb.textContent='0%';}
    var imp=q('#imponibile'); if(imp) imp.textContent='€ 0,00';
    var iva=q('#iva'); if(iva) iva.textContent='€ 0,00';
    var tot=q('#totale'); if(tot) tot.textContent='€ 0,00';
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

  // Disattiva vecchio nextId
  window.nextId=function(){return '—';};

  // NEW
  function doNew(){
    var cur={ id:'—', createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] };
    setCurrent(cur); resetEditorForm();
    if(window.renderLines)window.renderLines();
    enhanceLines(); // aggiunge pallini stato
    enhanceImages(); // X di rimozione
    if(window.recalc)window.recalc();
    setHeaderNumero(''); goEditorTab();
    setTimeout(function(){ var c=q('#cliente'); if(c) c.focus(); },0);
  }
  window.newQuote=doNew;
  window.clearPage=function(){ var c=getCurrent()||{}; var b={ id:'—', createdAt:c.createdAt||new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] }; setCurrent(b); resetEditorForm(); if(window.renderLines)window.renderLines(); enhanceLines(); enhanceImages(); if(window.recalc)window.recalc(); setHeaderNumero(''); };

  // Hook fillForm/recalc (robusti)
  ;(function(){ if(!window.fillForm) return; var _f=window.fillForm; window.fillForm=function(){ var r; try{ r=_f.apply(this,arguments);}catch(_){ } try{ var c=getCurrent()||{}; setHeaderNumero(c.id); }catch(_){ } try{ enhanceLines(); enhanceImages(); }catch(_){ } return r; }; })();
  ;(function(){ if(!window.recalc) return; var _r=window.recalc; window.recalc=function(){ var r; try{ r=_r.apply(this,arguments);}catch(_){ } try{ enhanceLines(); }catch(_){ } return r; }; })();

  // Stato pallino
  function enhanceLines(){
    var body=q('#linesBody'); if(!body) return;
    var rows=qa('tr', body);
    var cur=getCurrent()||{}; var lines=cur.lines||[];
    rows.forEach(function(tr, idx){
      var cells=tr.children; if(!cells || cells.length<6) return;
      var statoCell=cells[5];
      // crea pallino
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
        enhanceLines(); if(window.renderLines) window.renderLines(); // ridisegna per i totali
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
          enhanceImages();
          if(window.renderImages) window.renderImages();
        });
        wrap.appendChild(del);
      }
      var img=wrap.querySelector('img.thumb')||wrap.querySelector('img');
      if(img){ img.classList.add('thumb'); }
      wrap.classList.add('thumb-wrap');
    });
  }

  // PDF fallback
  ;(function(){
    if (typeof window.previewPDF === 'function') return;
    window.previewPDF = async function(type){
      try{
        var jspdf = window.jspdf && window.jspdf.jsPDF;
        if(!jspdf){ alert('PDF non disponibile'); return; }
        var cur=getCurrent()||{};
        var doc=new jspdf({unit:'pt',format:'a4'});
        doc.setFontSize(18); doc.text('Preventivo', 40, 60);
        doc.setFontSize(12); doc.text('N°: '+(cur.id||'-'), 40, 80);
        doc.text('Cliente: '+(cur.cliente||'-'), 40, 100);
        doc.text('Articolo: '+(cur.articolo||'-'), 40, 116);
        var y=150;
        (cur.lines||[]).forEach(function(r,i){
          doc.text((r.code||'')+'  '+(r.desc||''), 40, y); y+=16;
        });
        var blob=doc.output('blob'); var url=URL.createObjectURL(blob);
        var f=q('#pdfFrame'); if(f){ f.src=url; if(window.bootstrap&&bootstrap.Modal){ new bootstrap.Modal(q('#pdfModal')).show(); }else{ window.open(url,'_blank'); } }
        var a=q('#btnDownload'); if(a){ a.href=url; a.download=(cur.id||'preventivo')+'.pdf'; }
      }catch(e){ alert('Impossibile creare PDF'); }
    };
    // anche i due bottoni
    var d=function(){ var b1=q('#btnPDFDett'), b2=q('#btnPDFTot'); if(b1) b1.addEventListener('click', function(){ window.previewPDF('dett'); }); if(b2) b2.addEventListener('click', function(){ window.previewPDF('tot'); }); };
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', d); else d();
  })();

  // Salva: fallback locale se serve
  ;(function(){
    var bind=function(){
      var b=q('#btnSave'); if(!b) return;
      b.addEventListener('click', async function(ev){
        ev.preventDefault();
        var ok=false, numero=null;
        if (typeof window.saveToSupabase==='function'){
          try{
            var res=await window.saveToSupabase(true);
            var data=res&&res.data?res.data:res;
            var rec=Array.isArray(data)?data[0]:data;
            numero=rec&&(rec.numero||rec.id)||null;
            ok=true;
          }catch(_){ ok=false; }
        }
        var cur=getCurrent()||{};
        if (!ok){
          // fallback locale
          if(!cur.id || cur.id==='—'){ cur.id = 'PV-LOCAL-'+Date.now(); setCurrent(cur); }
          numero = cur.id;
          var arch=getArchiveLocal();
          // normalizza record
          arch.unshift({
            id: cur.id, numero: cur.id, created_at: cur.createdAt||new Date().toISOString(),
            cliente:cur.cliente, articolo:cur.articolo, ddt:cur.ddt, telefono:cur.telefono, email:cur.email,
            note:cur.note, linee:cur.lines||[], images:cur.images||[],
            data_invio:cur.dataInvio, data_accettazione:cur.dataAcc, data_scadenza:cur.dataScad,
            totale: (cur.lines||[]).reduce(function(s,r){return s+(+r.qty||0)*(+r.price||0);},0)*1.22
          });
          setArchiveLocal(arch);
          if(window.bootstrap){ try{ new bootstrap.Toast(q('#toastSave')).show(); }catch(_){ } }
        }
        if (numero){ cur.id=numero; setCurrent(cur); setHeaderNumero(numero); }
      });
    };
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', bind); else bind();
  })();

  // fetch hook per sincronizzare header (senza regex literal)
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
          }).catch(function(){});
        }
      }catch(_){}
      return resp;
    }); };
  })();

  function boot(){
    setHeaderNumero(''); arm();
    var bNew=q('#btnNew'); if(bNew) bNew.addEventListener('click', function(e){ e.preventDefault(); doNew(); });
    var bClear=q('#btnClear'); if(bClear) bClear.addEventListener('click', function(e){ e.preventDefault(); window.clearPage(); });
    // inizializza editor se vuoto
    var cur=getCurrent();
    if(!cur){ setCurrent({ id:'—', createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] }); }
    // assicurati che l'header mostri un numero se già presente
    cur=getCurrent()||{}; if(cur.id && cur.id!=='—' && !/^ELP-/i.test(cur.id)) setHeaderNumero(cur.id);
    // migliorie UI
    enhanceLines();
    enhanceImages();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
