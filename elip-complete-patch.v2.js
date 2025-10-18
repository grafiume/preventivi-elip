/*! elip-complete-patch.v2.js
   - Header (#quoteId): mostra "Nuovo (non numerato)" se il preventivo non è ancora stato salvato,
     altrimenti mostra il numero DB (es. PV-2025-000001). Blocca il vecchio "ELP-...".
   - Disattiva il contatore locale ELP in app.js (override nextId/newQuote/clearPage/fillForm).
   - NUOVO/PULISCI: pulisce e va alla tab Editor.
   - Hook su saveToSupabase e (fallback) fetch: al ritorno dell'INSERT/UPDATE aggiorna header con numero DB.
   - Contatori Archivio/Editor: mostra Accettati, Non accettati e Chiuse.
     "Chiuse" = data accettazione valorizzata **e** avanzamento = 100%.
*/
(function(){
  'use strict';

  // ---------- Utils ----------
  function q(sel, root){ return (root||document).querySelector(sel); }
  function qa(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }

  // ---------- Storage helpers compatibili con app.js ----------
  function getCurrent(){ try{ return JSON.parse(localStorage.getItem('elip_current')||'null'); }catch(_){ return null; } }
  function setCurrent(o){ localStorage.setItem('elip_current', JSON.stringify(o)); }

  // ---------- Header control su #quoteId ----------
  var AUTH_HEADER = 'Nuovo (non numerato)';
  var allowExternalHeader = false;

  function renderHeader(val){
    var el = q('#quoteId');
    if (!el) {
      var host = q('.appbar .fw-bold');
      if (host){
        el = document.createElement('div');
        el.id = 'quoteId';
        el.className = 'small text-muted';
        host.parentNode.insertBefore(el, host.nextSibling);
      }
    }
    if (!el) return;
    el.textContent = val;
  }
  function setHeader(val, isNumero){
    var text = (isNumero && val) ? String(val).trim() : (String(val||'').trim() || 'Nuovo (non numerato)');
    AUTH_HEADER = text;
    allowExternalHeader = true;
    renderHeader(AUTH_HEADER);
    setTimeout(function(){ allowExternalHeader = false; }, 0);
  }

  // Blocca sovrascritture legacy "ELP-..."
  function looksLegacy(t){ return /^ELP-\d{4}-\d+/i.test(String(t||'').trim()); }
  var headerObs = new MutationObserver(function(muts){
    muts.forEach(function(m){
      var t = m.target;
      if (t && t.id === 'quoteId'){
        if (!allowExternalHeader){
          var cur = t.textContent;
          if (cur !== AUTH_HEADER || looksLegacy(cur)) t.textContent = AUTH_HEADER;
        }
      }
    });
  });
  function armHeaderObserver(){
    var el = q('#quoteId');
    if (el) headerObs.observe(el, { childList:true, characterData:true, subtree:true });
  }

  // ---------- Reset Editor ----------
  function resetEditorForm(){
    var root = q('#tab-editor') || document;
    qa('input, select, textarea', root).forEach(function(el){
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
      else el.value = '';
    });
    var pb = q('#progressBar'); if (pb){ pb.style.width='0%'; pb.textContent='0%'; }
    var imgPrev = q('#imgPreview'); if (imgPrev) imgPrev.innerHTML='';
    var imp = q('#imponibile'); if (imp) imp.textContent='€ 0,00';
    var iva = q('#iva'); if (iva) iva.textContent='€ 0,00';
    var tot = q('#totale'); if (tot) tot.textContent='€ 0,00';
  }

  function goEditorTab(){
    var btn = q('[data-bs-target="#tab-editor"]');
    if (btn) { btn.click(); return; }
    var tab = q('#tab-editor'), arch=q('#tab-archivio');
    if (tab && arch){
      tab.classList.add('show','active');
      arch.classList.remove('show','active');
      qa('[data-bs-target="#tab-editor"]').forEach(function(b){ b.classList.add('active'); });
      qa('[data-bs-target="#tab-archivio"]').forEach(function(b){ b.classList.remove('active'); });
    }
  }

  // ---------- Disattiva contatore ELP e override funzioni chiave ----------
  window.nextId = function(){ return '—'; };

  window.newQuote = function(){
    var cur = { id:'—', createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] };
    setCurrent(cur);
    resetEditorForm();
    if (typeof window.renderLines === 'function') window.renderLines();
    if (typeof window.renderImages === 'function') window.renderImages();
    if (typeof window.recalc === 'function') window.recalc();
    setHeader('Nuovo (non numerato)', false);
    goEditorTab();
    setTimeout(function(){ var c = q('#cliente'); if (c) c.focus(); }, 0);
  };

  window.clearPage = function(){
    var c = getCurrent();
    if (!c) c = { createdAt:new Date().toISOString() };
    var b = { id:'—', createdAt:c.createdAt || new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] };
    setCurrent(b);
    resetEditorForm();
    if (typeof window.renderLines === 'function') window.renderLines();
    if (typeof window.renderImages === 'function') window.renderImages();
    if (typeof window.recalc === 'function') window.recalc();
    setHeader('Nuovo (non numerato)', false);
  };

  // Patch fillForm: se manca id/numero, mostra "Nuovo (non numerato)"
  (function patchFillForm(){
    if (!window.fillForm) return;
    var _orig = window.fillForm;
    window.fillForm = function(){
      var r = _orig.apply(this, arguments);
      try{
        var c = getCurrent() || {};
        var isNumero = !!(c && c.id && !/^ELP-/i.test(c.id) && c.id !== '—');
        setHeader(isNumero ? c.id : 'Nuovo (non numerato)', isNumero);
      }catch(e){}
      return r;
    };
  })();

  // ---------- Hook saveToSupabase e fallback fetch wrapper ----------
  (function hookSave(){
    var tryWrap = function(){
      if (!window.saveToSupabase) return false;
      var _orig = window.saveToSupabase;
      window.saveToSupabase = async function(){
        var res = await _orig.apply(this, arguments);
        try {
          var data = res && res.data ? res.data : res;
          var rec = Array.isArray(data) ? data[0] : data;
          var numero = rec && (rec.numero || rec.id);
          if (numero){
            var cur = getCurrent() || {};
            cur.id = numero;
            setCurrent(cur);
            setHeader(numero, true);
          }
        } catch(e){}
        return res;
      };
      return true;
    };
    if (!tryWrap()){
      document.addEventListener('DOMContentLoaded', tryWrap);
      setTimeout(tryWrap, 1000);
    }
  })();

  (function wrapFetch(){
    if (!window.fetch) return;
    var _orig = window.fetch;
    window.fetch = function(input, init){
      return _orig(input, init).then(function(resp){
        try {
          var url = (typeof input === 'string') ? input : (input && input.url ? input.url : '');
          var method = (init && init.method) ? String(init.method).toUpperCase() : 'GET';
          if (/\/rest\/v1\/preventivi/i.test(url) && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
            resp.clone().json().then(function(data){
              var rec = null;
              if (data && Array.isArray(data) && data.length > 0) rec = data[0];
              else if (data && typeof data === 'object') rec = data;
              if (rec && (rec.numero || rec.id)) {
                var numero = rec.numero || rec.id;
                var cur = getCurrent() || {};
                cur.id = numero;
                setCurrent(cur);
                setHeader(numero, true);
              }
            }).catch(function(){});
          }
        } catch(e){}
        return resp;
      });
    };
  })();

  // ---------- Contatori: Accettati / Non accettati / Chiuse ----------
  function ensureBadgeAfter(node, id, label){
    var b = document.getElementById(id);
    if (!b){
      b = document.createElement('span');
      b.id = id;
      b.className = 'badge-chiusi';
      b.style.marginLeft = '6px';
      b.style.padding = '2px 8px';
      b.style.borderRadius = '10px';
      b.style.background = '#eef2ff';
      b.style.border = '1px solid #c7d2fe';
      b.style.fontSize = '0.85em';
      b.style.fontWeight = '600';
    }
    b.textContent = label + ': 0';
    if (node && b.parentNode !== node.parentNode){
      node.parentNode.insertBefore(b, node.nextSibling);
    }
    return b;
  }

  function placeCounters(){
    var fltOk = q('#fltOk');
    var fltNo = q('#fltNo');
    if (fltOk) ensureBadgeAfter(fltOk, 'countChiuseArchive', 'Chiuse');
    if (fltNo) ensureBadgeAfter(fltNo, 'countChiuseEditor', 'Chiuse');
  }

  async function loadAllForCounts(){
    if (!window.supabase) return [];
    try {
      var res = await window.supabase.from('preventivi')
        .select('id, numero, cliente, data_accettazione, dataAccettazione, dataAcc, avanzamento, avanzamento_commessa, percentuale, progress');
      return Array.isArray(res.data) ? res.data : [];
    } catch(e){ return []; }
  }

  function pick(fieldset, obj){
    for (var i=0;i<fieldset.length;i++){
      var k = fieldset[i];
      if (obj && obj[k] != null) return obj[k];
    }
    return null;
  }

  async function refreshCounters(){
    placeCounters();
    var rows = await loadAllForCounts();
    var acc=0, no=0, chiuse=0;
    rows.forEach(function(r){
      var accDate = pick(['data_accettazione','dataAccettazione','dataAcc'], r);
      var adv = pick(['avanzamento','avanzamento_commessa','percentuale','progress'], r) || 0;
      var isAcc = !!(accDate && String(accDate).trim());
      if (isAcc) acc++; else no++;
      if (isAcc && Number(adv) >= 100) chiuse++;
    });
    // linea riassuntiva nel testo in alto a destra dell'Archivio
    var accCounters = q('#accCounters');
    if (accCounters) accCounters.textContent = 'Accettati: ' + acc + ' — Da accettare: ' + no + ' — Chiuse: ' + chiuse;
    // badge "Chiuse" vicino ai bottoni filtro
    var b1 = q('#countChiuseArchive'); if (b1) b1.textContent = 'Chiuse: ' + chiuse;
    var b2 = q('#countChiuseEditor');  if (b2) b2.textContent = 'Chiuse: ' + chiuse;
  }

  // ---------- Boot ----------
  function boot(){
    // stato iniziale
    var cur = getCurrent();
    if (!cur){
      setCurrent({ id:'—', createdAt:new Date().toISOString(), cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[], images:[] });
    }
    // header "Nuovo (non numerato)" finché non arriva numero DB
    setHeader('Nuovo (non numerato)', false);
    armHeaderObserver();
    goEditorTab();
    resetEditorForm();
    refreshCounters();
    setInterval(refreshCounters, 30000);
    document.addEventListener('preventivo-salvato', refreshCounters);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();