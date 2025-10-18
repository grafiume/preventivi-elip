
/*! elip-complete-patch.v2.5.js
   - Header (#quoteId) mostra SOLO il numero preventivo.
   - Niente testo "Nuovo (non numerato)". Prima del salvataggio l'header resta vuoto.
   - Mantiene: Nuovo forzato, fix recalc/okPill, filtri Archivio e contatori, hook save/fetch/poll.
*/
(function(){
  'use strict';

  function q(s, r){ return (r||document).querySelector(s); }
  function qa(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
  function text(el, t){ if (el) el.textContent = t; }
  function EURO(n){ try{ return (n||0).toLocaleString('it-IT',{style:'currency',currency:'EUR'}); }catch(e){ return String(n||0); } }
  function getCurrent(){ try{ return JSON.parse(localStorage.getItem('elip_current')||'null'); }catch(_){ return null; } }
  function setCurrent(o){ localStorage.setItem('elip_current', JSON.stringify(o)); }

  // ---------- Header control: SOLO numero ----------
  var AUTH_HEADER = '';
  var allowExternalHeader = false;
  function ensureHeaderNode(){
    var el = q('#quoteId');
    if (!el){
      var host = q('.appbar .fw-bold');
      if (host){
        el = document.createElement('div'); el.id='quoteId'; el.className='small text-muted';
        host.parentNode.insertBefore(el, host.nextSibling);
      }
    }
    return el;
  }
  function setHeaderNumero(numero){
    var val = (numero && !/^ELP-/i.test(numero) && numero !== '—') ? String(numero).trim() : '';
    AUTH_HEADER = val;
    allowExternalHeader = true;
    var el = ensureHeaderNode();
    text(el, AUTH_HEADER);
    setTimeout(function(){ allowExternalHeader = false; }, 0);
  }
  var headerObs = new MutationObserver(function(muts){
    muts.forEach(function(m){
      var t = m.target;
      if (t && t.id === 'quoteId' && !allowExternalHeader){
        if (t.textContent !== AUTH_HEADER) t.textContent = AUTH_HEADER;
      }
    });
  });
  function armHeaderObserver(){ var el=q('#quoteId'); if (el) headerObs.observe(el,{childList:true,characterData:true,subtree:true}); }

  // ---------- Reset editor + tab ----------
  function resetEditorForm(){
    var root = q('#tab-editor') || document;
    qa('input, select, textarea', root).forEach(function(el){
      if (el.type==='checkbox'||el.type==='radio') el.checked=false; else el.value='';
    });
    var pb=q('#progressBar'); if (pb){ pb.style.width='0%'; pb.textContent='0%'; }
    var imp=q('#imponibile'); if (imp) imp.textContent='€ 0,00';
    var iva=q('#iva'); if (iva) iva.textContent='€ 0,00';
    var tot=q('#totale'); if (tot) tot.textContent='€ 0,00';
    var imgPrev=q('#imgPreview'); if (imgPrev) imgPrev.innerHTML='';
    var ok=q('#okPill'); if (ok){ ok.classList.remove('acc-ok'); ok.classList.add('acc-no'); ok.textContent='● NO'; }
  }
  function goEditorTab(){
    var btn=q('[data-bs-target="#tab-editor"]'); if (btn){ btn.click(); return; }
    var tab=q('#tab-editor'), arch=q('#tab-archivio');
    if (tab && arch){
      tab.classList.add('show','active');
      arch.classList.remove('show','active');
      qa('[data-bs-target="#tab-editor"]').forEach(function(b){ b.classList.add('active'); });
      qa('[data-bs-target="#tab-archivio"]').forEach(function(b){ b.classList.remove('active'); });
    }
  }

  // ---------- Disattiva contatore ELP + override ----------
  window.nextId = function(){ return '—'; };

  function doNew(){
    var cur={ id:'—', createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] };
    setCurrent(cur);
    resetEditorForm();
    if (typeof window.renderLines==='function') window.renderLines();
    if (typeof window.renderImages==='function') window.renderImages();
    if (typeof window.recalc==='function') window.recalc();
    setHeaderNumero(''); // header vuoto finché non si salva
    goEditorTab();
    setTimeout(function(){ var c=q('#cliente'); if (c) c.focus(); }, 0);
  }
  window.newQuote = doNew;
  window.clearPage = function(){
    var c=getCurrent()||{};
    var b={ id:'—', createdAt:c.createdAt||new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] };
    setCurrent(b); resetEditorForm();
    if (typeof window.renderLines==='function') window.renderLines();
    if (typeof window.renderImages==='function') window.renderImages();
    if (typeof window.recalc==='function') window.recalc();
    setHeaderNumero('');
  };

  // Patch fillForm: sincronizza header
  (function patchFillForm(){
    if (!window.fillForm) return;
    var _orig = window.fillForm;
    window.fillForm = function(){
      var r = _orig.apply(this, arguments);
      try{
        var c=getCurrent()||{};
        setHeaderNumero(c.id);
        var ok=q('#okPill');
        var has = !!(c.dataAcc && String(c.dataAcc).trim());
        if (ok){ ok.classList.toggle('acc-ok', has); ok.classList.toggle('acc-no', !has); ok.textContent = has ? '● OK' : '● NO'; }
      }catch(e){}
      return r;
    };
  })();

  // Wrap recalc: guardie + okPill live update
  ;(function guardRecalc(){
    if (!window.recalc) return;
    var _orig = window.recalc;
    window.recalc = function(){
      var r = _orig.apply(this, arguments);
      try {
        var c=getCurrent()||{};
        var impEl=q('#imponibile'), ivaEl=q('#iva'), totEl=q('#totale');
        if (!(impEl && ivaEl && totEl)){
          var lines = c.lines || [];
          var imp = lines.reduce(function(s, rr){ return s + (+rr.qty||0)*(+rr.price||0); }, 0);
          var iva = imp*0.22, tot = imp+iva;
          if (impEl) impEl.textContent = EURO(imp);
          if (ivaEl) ivaEl.textContent = EURO(iva);
          if (totEl) totEl.textContent = EURO(tot);
        }
        var ok=q('#okPill');
        var dataAccInput = q('#dataAcc');
        var has = false;
        if (dataAccInput && dataAccInput.value && String(dataAccInput.value).trim()) has = true;
        else if (c.dataAcc && String(c.dataAcc).trim()) has = true;
        if (ok){ ok.classList.toggle('acc-ok', has); ok.classList.toggle('acc-no', !has); ok.textContent = has ? '● OK' : '● NO'; }
      } catch(e){}
      return r;
    };
  })();

  // ---------- Hook save/fetch + fallback poll ----------
  async function pollLastNumero(){
    if (!window.supabase) return;
    try{
      var res = await window.supabase.from('preventivi').select('numero, created_at').order('created_at', { ascending:false }).limit(1);
      var rec = res && res.data && res.data[0];
      if (rec && rec.numero){
        var cur=getCurrent()||{}; cur.id=rec.numero; setCurrent(cur); setHeaderNumero(rec.numero);
      }
    }catch(e){}
  }
  ;(function hookSave(){
    var tryWrap=function(){
      if (!window.saveToSupabase) return false;
      var _orig=window.saveToSupabase;
      window.saveToSupabase=async function(){
        var res=await _orig.apply(this, arguments);
        try{
          var data=res && res.data ? res.data : res;
          var rec=Array.isArray(data)?data[0]:data;
          var numero=rec && (rec.numero || rec.id);
          if (numero){ var cur=getCurrent()||{}; cur.id=numero; setCurrent(cur); setHeaderNumero(numero); }
          else { setTimeout(pollLastNumero, 300); setTimeout(pollLastNumero, 1200); }
        }catch(e){ setTimeout(pollLastNumero, 1200); }
        return res;
      };
      return true;
    };
    if (!tryWrap()){ document.addEventListener('DOMContentLoaded', tryWrap); setTimeout(tryWrap, 1000); }
  })();

  ;(function wrapFetch(){
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
              if (rec && (rec.numero||rec.id)){ var numero=rec.numero||rec.id; var cur=getCurrent()||{}; cur.id=numero; setCurrent(cur); setHeaderNumero(numero); }
              else { setTimeout(pollLastNumero, 300); setTimeout(pollLastNumero, 1200); }
            }).catch(function(){ setTimeout(pollLastNumero, 1200); });
          }
        }catch(e){}
        return resp;
      });
    };
  })();

  // ---------- Archivio: filtri e contatori ----------
  function pick(fields, obj){
    for (var i=0;i<fields.length;i++){ var k=fields[i]; if (obj && obj[k]!=null) return obj[k]; }
    return null;
  }
  async function loadRows(){
    if (!window.supabase) return [];
    try{
      var res = await window.supabase.from('preventivi')
        .select('id, numero, created_at, createdAt, cliente, articolo, ddt, telefono, email, note, linee, lines, images, data_invio, dataInvio, data_accettazione, dataAccettazione, dataAcc, data_scadenza, dataScad, avanzamento, avanzamento_commessa, percentuale, progress, totale')
        .order('created_at', { ascending:false });
      return Array.isArray(res.data)?res.data:[];
    }catch(e){ return []; }
  }

  window.ACC_FILTER = window.ACC_FILTER || 'all';

  async function renderArchive(){
    var rows = await loadRows();
    var acc=0, no=0, chiuse=0;
    var enriched = rows.map(function(r){
      var numero = pick(['numero','id'], r);
      var created = pick(['created_at','createdAt'], r);
      var accDate = pick(['data_accettazione','dataAccettazione','dataAcc'], r);
      var adv = pick(['avanzamento','avanzamento_commessa','percentuale','progress'], r) || 0;
      var tolines = pick(['linee','lines'], r) || [];
      var tot = r.totale != null ? r.totale : (tolines.reduce(function(s,l){ return s + (+l.qty||0)*(+l.price||0); },0) * 1.22);
      var isAcc = !!(accDate && String(accDate).trim());
      var isChiusa = isAcc && Number(adv) >= 100;
      if (isAcc) acc++; else no++;
      if (isChiusa) chiuse++;
      return { numero, created, cliente:r.cliente, articolo:r.articolo, ddt:r.ddt, totale:tot, isAcc, isChiusa, adv: Number(adv), data_scadenza: pick(['data_scadenza','dataScad'], r) };
    });

    var bOk=q('#fltOk'), bNo=q('#fltNo'), bCh=q('#fltChiusi');
    if (bOk) text(bOk, 'Accettati ('+acc+')');
    if (bNo) text(bNo, 'Non accettati ('+no+')');
    if (bCh) text(bCh, 'Chiusi ('+chiuse+')');
    var cc=q('#accCounters'); if (cc) cc.textContent = 'Accettati: '+acc+' — Non accettati: '+no+' — Chiusi: '+chiuse;

    var qtext = (q('#filterQuery') && q('#filterQuery').value || '').toLowerCase();
    var filtered = enriched.filter(function(r){
      var keep = true;
      if (window.ACC_FILTER==='ok') keep = r.isAcc;
      else if (window.ACC_FILTER==='no') keep = !r.isAcc;
      else if (window.ACC_FILTER==='chiusi') keep = r.isChiusa;
      if (keep && qtext) keep = (String(r.cliente||'').toLowerCase().includes(qtext));
      return keep;
    });

    var body=q('#archBody'); if (!body) return; body.innerHTML='';
    var today=new Date(); today.setHours(0,0,0,0);
    filtered.forEach(function(rec){
      var pct = Number(rec.adv)||0;
      var dot = (pct===100) ? '<span class="progress-dot" style="color:var(--green)">●</span>' : (pct>=50?'<span class="progress-dot" style="color:var(--warn)">●</span>':'<span class="progress-dot" style="color:var(--red)">●</span>');
      var scad = '<span class="text-muted">-</span>';
      if (rec.data_scadenza){
        var d = new Date(rec.data_scadenza); d.setHours(0,0,0,0);
        var diff = Math.round((d - today)/(1000*60*60*24));
        if (diff<=5 && diff>=0) scad = '<span class="badge bg-warning-subtle text-dark">Scade in '+diff+' g</span>';
        else if (diff<0) scad = '<span class="badge bg-danger">Scaduto</span>';
        else scad = new Date(rec.data_scadenza).toLocaleDateString('it-IT');
      }
      var acc = rec.isAcc ? '<span class="acc-pill acc-ok">● OK</span>' : '<span class="acc-pill acc-no">● NO</span>';
      var itDate = rec.created ? new Date(rec.created).toLocaleDateString('it-IT') : '-';
      var tr=document.createElement('tr');
      tr.innerHTML = '<td>'+ (rec.numero||'-') +'</td><td>'+ itDate +'</td><td>'+ (rec.cliente||'') +'</td><td>'+ (rec.articolo||'') +'</td><td>'+ (rec.ddt||'') +'</td><td>'+ EURO(rec.totale||0) +'</td><td>'+ acc +'</td><td>'+ scad +'</td><td>'+ dot+' '+pct+'%' +'</td><td><button class="btn btn-sm btn-outline-primary" data-open="'+(rec.numero||'')+'">Modifica</button></td>';
      body.appendChild(tr);
    });

    body.onclick = function(e){
      var b = e.target.closest('button[data-open]'); if (!b) return;
      var numero = b.getAttribute('data-open');
      var cur = getCurrent() || {};
      cur.id = numero; setCurrent(cur);
      setHeaderNumero(numero);
      if (window.fillForm) window.fillForm();
      if (window.renderLines) window.renderLines();
      if (window.renderImages) window.renderImages();
      if (window.recalc) window.recalc();
      goEditorTab();
    };
  }

  function wireArchiveFilters(){
    var fltAll=q('#fltAll'), fltOk=q('#fltOk'), fltNo=q('#fltNo'), fltChiusi=q('#fltChiusi');
    function setActive(btn){ qa('.btn-group .btn').forEach(function(b){ b.classList.remove('active'); }); btn.classList.add('active'); }
    if (fltAll) fltAll.addEventListener('click', function(){ window.ACC_FILTER='all'; renderArchive(); setActive(this); });
    if (fltOk) fltOk.addEventListener('click', function(){ window.ACC_FILTER='ok'; renderArchive(); setActive(this); });
    if (fltNo) fltNo.addEventListener('click', function(){ window.ACC_FILTER='no'; renderArchive(); setActive(this); });
    if (fltChiusi) fltChiusi.addEventListener('click', function(){ window.ACC_FILTER='chiusi'; renderArchive(); setActive(this); });
    var input=q('#filterQuery'); if (input) input.addEventListener('input', renderArchive);
    var reload=q('#btnReloadArch'); if (reload) reload.addEventListener('click', renderArchive);
  }

  function boot(){
    setHeaderNumero('');
    armHeaderObserver();
    var bNew=q('#btnNew'); if (bNew) bNew.addEventListener('click', function(e){ e.preventDefault(); doNew(); });
    var bClear=q('#btnClear'); if (bClear) bClear.addEventListener('click', function(e){ e.preventDefault(); window.clearPage(); });
    var cur=getCurrent(); if (!cur) setCurrent({ id:'—', createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] });
    goEditorTab();
    resetEditorForm();
    wireArchiveFilters();
    renderArchive();
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
