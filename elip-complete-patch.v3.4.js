
/*! elip-complete-patch.v3.4.js
   - Frontend relies ONLY on DB numero (ELP-YYYY-XXXX)
   - New: always navigates to Editor and clears
   - Archive: "chiusi" uses DB is_chiusa if available, else (acc && progress>=100)
   - Header shows current numero boldly
*/
(function(){
  'use strict';
  function q(s, r){ return (r||document).querySelector(s); }
  function qa(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
  function text(el, t){ if (el) el.textContent = t; }
  function EURO(n){ try{ return (n||0).toLocaleString('it-IT',{style:'currency',currency:'EUR'}); }catch(e){ return String(n||0); } }
  function getCurrent(){ try{ return JSON.parse(localStorage.getItem('elip_current')||'null'); }catch(_){ return null; } }
  function setCurrent(o){ localStorage.setItem('elip_current', JSON.stringify(o)); }

  // --- Header current number badge ---
  function ensureBadges(){
    var container=q('.appbar .fw-bold'); if(!container) return;
    var num=q('#quoteId'); if(!num){ num=document.createElement('div'); num.id='quoteId'; num.className='small text-muted'; container.parentNode.insertBefore(num, container.nextSibling); }
    var cur=q('#pvCurrent'); if(!cur){ cur=document.createElement('span'); cur.id='pvCurrent'; cur.style.cssText='display:inline-block;margin-left:10px;padding:2px 10px;border-radius:12px;background:#fff;border:2px solid #333;color:#111;font-size:12px;font-weight:700;'; container.appendChild(cur); }
  }
  function setHeaderNumero(n){
    ensureBadges();
    var v=(n && n.indexOf('ELP-')===0)?n:'';
    text(q('#quoteId'), v);
    var cur=q('#pvCurrent'); if(cur) cur.textContent = v ? ('N°: '+v) : '—';
  }

  // --- New & Clear ---
  function goEditorTab(){
    var btn=q('[data-bs-toggle="tab"][data-bs-target="#tab-editor"]');
    if(btn){ btn.click(); return; }
    var tab=q('#tab-editor'), arch=q('#tab-archivio');
    if(tab&&arch){ tab.classList.add('show','active'); arch.classList.remove('show','active'); }
  }
  function hardClear(){
    var cur={ id:'—', createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] };
    setCurrent(cur);
    // reset UI fields
    var root=q('#tab-editor')||document;
    qa('input,select,textarea',root).forEach(function(el){ if(el.type==='checkbox'||el.type==='radio') el.checked=false; else el.value=''; });
    var pb=q('#progressBar'); if(pb){pb.style.width='0%';pb.textContent='0%';}
    ['imponibile','iva','totale'].forEach(function(id){ var el=q('#'+id); if(el) el.textContent='€ 0,00'; });
    var ip=q('#imgPreview'); if(ip) ip.innerHTML='';
    var ok=q('#okPill'); if(ok){ ok.classList.remove('acc-ok'); ok.classList.add('acc-no'); ok.textContent='● NO'; }
    if(window.renderLines) window.renderLines();
    if(window.renderImages) window.renderImages();
    if(window.recalc) window.recalc();
    setHeaderNumero(''); // vuoto finché non salvi
  }
  function wireNew(){
    var b=q('#btnNew'); if(!b) return;
    b.addEventListener('click', function(e){ e.preventDefault(); goEditorTab(); hardClear(); });
  }

  // --- Save hook: extract numero from response or poll last ---
  async function pollLastNumero(){
    if(!window.supabase) return;
    try{
      var r=await window.supabase.from('preventivi').select('numero').order('created_at',{ascending:false}).limit(1);
      var rec = r && r.data && r.data[0];
      if(rec && rec.numero){ setHeaderNumero(rec.numero); var c=getCurrent()||{}; c.id=rec.numero; setCurrent(c); }
    }catch(_){}
  }
  (function(){
    var tryWrap=function(){
      if (typeof window.saveToSupabase!=='function') return false;
      var _orig=window.saveToSupabase;
      var busy=false;
      window.saveToSupabase=async function(){
        if(busy) return;
        busy=true;
        try{
          var res=await _orig.apply(this, arguments);
          // prefer numero from response
          try{
            var data=res&&res.data?res.data:res;
            var rec=Array.isArray(data)?data[0]:data;
            var numero = rec && rec.numero;
            if(numero){ setHeaderNumero(numero); var c=getCurrent()||{}; c.id=numero; setCurrent(c); }
            else { setTimeout(pollLastNumero, 250); setTimeout(pollLastNumero, 1200); }
          }catch(_){ setTimeout(pollLastNumero, 1200); }
          // refresh archive
          if (typeof renderArchive==='function') renderArchive();
          return res;
        } finally { busy=false; }
      };
      return true;
    };
    if(!tryWrap()){ document.addEventListener('DOMContentLoaded', tryWrap); setTimeout(tryWrap, 1000); }
  })();

  // --- Archive / counters (use DB is_chiusa if present) ---
  async function loadRows(){
    if (!window.supabase) return [];
    try{
      var res = await window.supabase.from('preventivi')
        .select('numero, created_at, cliente, articolo, ddt, totale, data_accettazione, data_scadenza, avanzamento, is_chiusa')
        .order('created_at',{ascending:false});
      return Array.isArray(res.data)?res.data:[];
    }catch(_){ return []; }
  }
  window.ACC_FILTER=window.ACC_FILTER||'all';
  async function renderArchive(){
    var rows=await loadRows();
    // badge counter
    var cnt=q('#pvCounter'); if(cnt) cnt.textContent='Totale preventivi: '+rows.length;

    var acc=0,no=0,chiuse=0;
    var normalized=rows.map(function(r){
      var adv = Number((r.avanzamento!=null && r.avanzamento!==''? r.avanzamento: 0)) || 0;
      var isAcc = !!(r.data_accettazione && String(r.data_accettazione).trim());
      var isChiusa = r.is_chiusa!=null ? !!r.is_chiusa : (isAcc && adv>=100);
      if(isAcc) acc++; else no++;
      if(isChiusa) chiuse++;
      return {numero:r.numero, created:r.created_at, cliente:r.cliente, articolo:r.articolo, ddt:r.ddt, totale:r.totale, isAcc, isChiusa, adv, data_scadenza:r.data_scadenza};
    });

    text(q('#fltAll'),'Tutti');
    text(q('#fltOk'),'Accettati ('+acc+')');
    text(q('#fltNo'),'Non accettati ('+no+')');
    text(q('#fltChiusi'),'Chiusi ('+chiuse+')');

    var qtext=(q('#filterQuery') && q('#filterQuery').value || '').toLowerCase();
    var filtered=normalized.filter(function(r){
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
      // vai in editor
      goEditorTab();
    };
  }
  window.renderArchive=renderArchive;

  // Wire filters
  (function wire(){
    if(window.__ELIP_FILTERS_WIRED__) return;
    ['fltAll','fltOk','fltNo','fltChiusi'].forEach(function(id){
      var el=q('#'+id); if(!el) return;
      el.addEventListener('click', function(){
        qa('.btn-group .btn').forEach(function(b){ b.classList.remove('active'); });
        el.classList.add('active');
        window.ACC_FILTER=(id==='fltOk'?'ok':id==='fltNo'?'no':id==='fltChiusi'?'chiusi':'all');
        renderArchive();
      });
    });
    window.__ELIP_FILTERS_WIRED__=true;
  })();

  // Boot
  function boot(){
    ensureBadges();
    setHeaderNumero('');
    wireNew();
    renderArchive();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
