
/*! elip-complete-patch.v2.4.js
   Fix: 
   - wrap recalc() per evitare errori su elementi null (imponibile/iva/totale/okPill)
   - okPill aggiorna correttamente con dataAcc
   - header aggiorna il numero anche con fallback: poll ultimo record dal DB dopo SALVA
   - apertura da Archivio forza header=numero
   - mantiene: Nuovo forzato, contatori, filtri uniformi
*/
(function(){
  'use strict';

  // ---------- Utils ----------
  function q(s, r){ return (r||document).querySelector(s); }
  function qa(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
  function text(el, t){ if (el) el.textContent = t; }
  function EURO(n){ try{ return (n||0).toLocaleString('it-IT',{style:'currency',currency:'EUR'}); }catch(e){ return String(n||0); } }
  function log(){ try{ console.log.apply(console, ['[elip-patch v2.4]'].concat([].slice.call(arguments))); }catch(e){} }

  // ---------- Storage helpers ----------
  function getCurrent(){ try{ return JSON.parse(localStorage.getItem('elip_current')||'null'); }catch(_){ return null; } }
  function setCurrent(o){ localStorage.setItem('elip_current', JSON.stringify(o)); }

  // ---------- Header control ----------
  var AUTH_HEADER = 'Nuovo (non numerato)';
  var allowExternalHeader = false;
  function setHeader(val, isNumero){
    var v = (isNumero && val) ? String(val).trim() : 'Nuovo (non numerato)';
    AUTH_HEADER = v; allowExternalHeader = true;
    var el = q('#quoteId');
    if (!el){
      var host = q('.appbar .fw-bold');
      if (host){
        el = document.createElement('div'); el.id='quoteId'; el.className='small text-muted';
        host.parentNode.insertBefore(el, host.nextSibling);
      }
    }
    text(el, AUTH_HEADER);
    setTimeout(function(){ allowExternalHeader = false; }, 0);
  }
  function looksLegacy(t){ return /^ELP-\d{4}-\d+/i.test(String(t||'').trim()); }
  var headerObs = new MutationObserver(function(muts){
    muts.forEach(function(m){
      var t = m.target;
      if (t && t.id === 'quoteId' && !allowExternalHeader){
        if (t.textContent !== AUTH_HEADER || looksLegacy(t.textContent)) t.textContent = AUTH_HEADER;
      }
    });
  });
  function armHeaderObserver(){ var el=q('#quoteId'); if (el) headerObs.observe(el,{childList:true,characterData:true,subtree:true}); }

  // ---------- Reset editor + tab switch ----------
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
    // okPill reset
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

  // ---------- Disattiva contatore ELP + override funzioni ----------
  window.nextId = function(){ return '—'; };

  function doNew(){
    var cur={ id:'—', createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] };
    setCurrent(cur);
    resetEditorForm();
    if (typeof window.renderLines==='function') window.renderLines();
    if (typeof window.renderImages==='function') window.renderImages();
    if (typeof window.recalc==='function') window.recalc();
    setHeader(null, false);
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
    setHeader(null, false);
  };

  // Patch fillForm per allineare header e okPill
  (function patchFillForm(){
    if (!window.fillForm) return;
    var _orig = window.fillForm;
    window.fillForm = function(){
      var r = _orig.apply(this, arguments);
      try{
        var c=getCurrent()||{};
        var isNumero = !!(c.id && !/^ELP-/i.test(c.id) && c.id !== '—');
        setHeader(isNumero ? c.id : null, isNumero);
        // okPill
        var ok=q('#okPill');
        var has = !!(c.dataAcc && String(c.dataAcc).trim());
        if (ok){ ok.classList.toggle('acc-ok', has); ok.classList.toggle('acc-no', !has); ok.textContent = has ? '● OK' : '● NO'; }
      }catch(e){}
      return r;
    };
  })();

  // ---------- Wrap recalc con guardie DOM ----------
  (function guardRecalc(){
    if (!window.recalc) return;
    var _orig = window.recalc;
    window.recalc = function(){
      var r = _orig.apply(this, arguments);
      try {
        var c = getCurrent() || {};
        // Totali
        var impEl=q('#imponibile'), ivaEl=q('#iva'), totEl=q('#totale');
        if (impEl && ivaEl && totEl){
          // assume app.js già calcola, qui nulla
        } else {
          // calcolo minimo di emergenza
          var lines = c.lines || [];
          var imp = lines.reduce(function(s, r){ return s + (+r.qty||0)*(+r.price||0); }, 0);
          var iva = imp * 0.22, tot = imp + iva;
          if (impEl) impEl.textContent = EURO(imp);
          if (ivaEl) ivaEl.textContent = EURO(iva);
          if (totEl) totEl.textContent = EURO(tot);
        }
        // okPill da dataAcc input corrente
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

  // ---------- Hook save / fetch + Fallback Poll ----------
  async function pollLastNumero(){
    if (!window.supabase) return;
    try{
      var res = await window.supabase.from('preventivi').select('numero, created_at').order('created_at', { ascending:false }).limit(1);
      var rec = res && res.data && res.data[0];
      if (rec && rec.numero){
        var cur=getCurrent()||{}; cur.id=rec.numero; setCurrent(cur); setHeader(rec.numero, true);
        log('pollLastNumero →', rec.numero);
      }
    }catch(e){}
  }

  (function hookSave(){
    var tryWrap=function(){
      if (!window.saveToSupabase) return false;
      var _orig=window.saveToSupabase;
      window.saveToSupabase=async function(){
        var res=await _orig.apply(this, arguments);
        try{
          var data=res && res.data ? res.data : res;
          var rec=Array.isArray(data)?data[0]:data;
          var numero=rec && (rec.numero || rec.id);
          if (numero){
            var cur=getCurrent()||{}; cur.id=numero; setCurrent(cur);
            setHeader(numero, true);
          } else {
            // fallback poll (in caso la risposta non ritorna 'numero')
            setTimeout(pollLastNumero, 300);
            setTimeout(pollLastNumero, 1200);
          }
        }catch(e){ setTimeout(pollLastNumero, 1200); }
        return res;
      };
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
              if (rec && (rec.numero||rec.id)){ var numero=rec.numero||rec.id; var cur=getCurrent()||{}; cur.id=numero; setCurrent(cur); setHeader(numero, true); }
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

    // update counters UI
    var bOk=q('#fltOk'), bNo=q('#fltNo'), bCh=q('#fltChiusi');
    if (bOk) text(bOk, 'Accettati ('+acc+')');
    if (bNo) text(bNo, 'Non accettati ('+no+')');
    if (bCh) text(bCh, 'Chiusi ('+chiuse+')');
    var cc=q('#accCounters'); if (cc) cc.textContent = 'Accettati: '+acc+' — Non accettati: '+no+' — Chiusi: '+chiuse;

    // filter
    var qtext = (q('#filterQuery') && q('#filterQuery').value || '').toLowerCase();
    var filtered = enriched.filter(function(r){
      var keep = true;
      if (window.ACC_FILTER==='ok') keep = r.isAcc;
      else if (window.ACC_FILTER==='no') keep = !r.isAcc;
      else if (window.ACC_FILTER==='chiusi') keep = r.isChiusa;
      if (keep && qtext) keep = (String(r.cliente||'').toLowerCase().includes(qtext));
      return keep;
    });

    // table
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

    // open → header = numero
    body.onclick = function(e){
      var b = e.target.closest('button[data-open]'); if (!b) return;
      var numero = b.getAttribute('data-open');
      var cur = getCurrent() || {};
      cur.id = numero; setCurrent(cur);
      setHeader(numero, true);
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

  // ---------- Boot ----------
  function boot(){
    setHeader(null, false);
    armHeaderObserver();
    // force-wire new/clear
    var bNew=q('#btnNew'); if (bNew) bNew.addEventListener('click', function(e){ e.preventDefault(); doNew(); });
    var bClear=q('#btnClear'); if (bClear) bClear.addEventListener('click', function(e){ e.preventDefault(); window.clearPage(); });
    // init editor state
    var cur=getCurrent();
    if (!cur) setCurrent({ id:'—', createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] });
    goEditorTab();
    resetEditorForm();
    // archive
    wireArchiveFilters();
    renderArchive();
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
