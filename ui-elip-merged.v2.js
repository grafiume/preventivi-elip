/*! ui-elip-merged.v2.js
   Specifico per l'index fornito:
   - Usa direttamente #quoteId come slot dell'intestazione (sostituisce la vecchia scritta "ELP-...")
   - Blocca qualunque sovrascrittura legacy su #quoteId (es. timer/client che impostava "ELP-2025-...")
   - NUOVO (#btnNew): reset + tab Editor + header "—"
   - PULISCI (#btnClear): reset + header "—"
   - SALVA: aggiorna #quoteId con numero DB intercettando la risposta Supabase (fetch wrapper)
   - Refresh/primo carico: tab Editor, form pulito, header "—"
   - Contatori "Chiusi" (Archivio/Editor): Chiusi = avanzamento ≥10% e data accettazione valorizzata
*/
(function(){
  'use strict';

  // ---------- Utils ----------
  function q(sel, root){ return (root||document).querySelector(sel); }
  function qa(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
  function isVisible(el){ return !!(el && el.offsetParent !== null); }

  // ---------- Header su #quoteId ----------
  var AUTH_HEADER = '—';
  var allowExternalHeader = false;

  function headerEl(){
    // #quoteId esiste nel tuo index, è la riga sotto "ELIP Tagliente — Preventivi"
    var el = q('#quoteId');
    if (!el) {
      // fallback: crealo subito dopo il brand-title
      var host = q('.appbar .fw-bold');
      if (host){
        el = document.createElement('div');
        el.id = 'quoteId';
        el.className = 'small text-muted';
        host.parentNode.insertBefore(el, host.nextSibling);
      }
    }
    return el;
  }

  function renderHeader(val){
    var el = headerEl();
    if (!el) return;
    el.textContent = val;
  }

  function setHeaderNumeroFromServer(val){
    AUTH_HEADER = (val && String(val).trim()) ? String(val).trim() : '—';
    allowExternalHeader = true;
    renderHeader(AUTH_HEADER);
    setTimeout(function(){ allowExternalHeader = false; }, 0);
  }
  window.setHeaderNumeroFromServer = setHeaderNumeroFromServer;

  function looksLegacyFormat(t){ return /^ELP-\d{4}-\d+/i.test(String(t||'').trim()); }

  var headerObs = new MutationObserver(function(muts){
    muts.forEach(function(m){
      var t = m.target;
      // qualunque tentativo di cambiare #quoteId viene annullato se non autorizzato
      if (t && t.id === 'quoteId'){
        if (!allowExternalHeader){
          var cur = t.textContent;
          if (cur !== AUTH_HEADER || looksLegacyFormat(cur)) {
            t.textContent = AUTH_HEADER;
          }
        }
      }
    });
  });
  function armHeaderObserver(){
    var el = headerEl();
    if (el) headerObs.observe(el, { childList:true, characterData:true, subtree:true });
  }

  // ---------- Reset Editor ----------
  function resetEditorForm(){
    var root = q('#tab-editor') || document;
    qa('input, select, textarea', root).forEach(function(el){
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
      else el.value = '';
    });
    var pb = q('#progressBar'); if (pb){ pb.style.width = '0%'; pb.textContent = '0%'; }
    var imgPrev = q('#imgPreview'); if (imgPrev) imgPrev.innerHTML = '';
    var imp = q('#imponibile'); if (imp) imp.textContent = '€ 0,00';
    var iva = q('#iva'); if (iva) iva.textContent = '€ 0,00';
    var tot = q('#totale'); if (tot) tot.textContent = '€ 0,00';
  }

  // ---------- Tab → Editor ----------
  function goEditorTab(){
    var btn = q('[data-bs-target="#tab-editor"]');
    if (btn) { btn.click(); return true; }
    var tab = q('#tab-editor'); var arch = q('#tab-archivio');
    if (tab && arch){
      tab.classList.add('show','active');
      arch.classList.remove('show','active');
      qa('[data-bs-target="#tab-editor"]').forEach(function(b){ b.classList.add('active'); });
      qa('[data-bs-target="#tab-archivio"]').forEach(function(b){ b.classList.remove('active'); });
      return true;
    }
    return false;
  }

  // ---------- New / Clear ----------
  function startNew(){
    window.currentRecordId = null;
    window.__mode = 'create';
    resetEditorForm();
    setHeaderNumeroFromServer('—');
    goEditorTab();
    setTimeout(function(){ var c = q('#cliente'); if (c) c.focus(); }, 0);
  }
  function wireButtons(){
    var bNew = q('#btnNew'); if (bNew) bNew.addEventListener('click', function(e){ e.preventDefault(); startNew(); });
    var bClear = q('#btnClear'); if (bClear) bClear.addEventListener('click', function(e){ e.preventDefault(); resetEditorForm(); setHeaderNumeroFromServer('—'); });
  }

  // ---------- Fetch wrapper: aggiorna header dopo INSERT/UPDATE ----------
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
              if (rec && rec.numero) setHeaderNumeroFromServer(rec.numero);
            }).catch(function(){});
          }
        } catch(e){}
        return resp;
      });
    };
  })();

  // ---------- Contatori "Chiusi" ----------
  function ensureBadgeAfter(node, id){
    var b = document.getElementById(id);
    if (!b){
      b = document.createElement('span');
      b.id = id;
      b.className = 'badge-chiusi';
      b.style.marginLeft = '6px';
      b.style.padding = '2px 8px';
      b.style.borderRadius = '10px';
      b.style.background = '#d1e7dd';
      b.style.border = '1px solid #badbcc';
      b.style.fontSize = '0.85em';
      b.style.fontWeight = '600';
    }
    b.textContent = 'Chiusi: 0';
    if (node && b.parentNode !== node.parentNode){
      node.parentNode.insertBefore(b, node.nextSibling);
    }
    return b;
  }

  function placeCounters(){
    var fltOk = q('#fltOk');
    var fltNo = q('#fltNo');
    if (fltOk) ensureBadgeAfter(fltOk, 'countChiusiArchive');
    if (fltNo) ensureBadgeAfter(fltNo, 'countChiusiEditor');
  }

  async function countChiusi(){
    if (!window.supabase) return null;
    var advCols = ['avanzamento', 'avanzamento_commessa', 'percentuale', 'progress'];
    var dateCols = ['dataAccettazione', 'data_accettazione', 'accettazione_data', 'dataAcc'];
    for (var a=0;a<advCols.length;a++){
      for (var d=0; d<dateCols.length; d++){
        try {
          var q1 = window.supabase.from('preventivi').select('*', { count:'exact', head:true });
          q1 = q1.gte(advCols[a], 10).not(dateCols[d], 'is', null);
          var res = await q1;
          if (res && typeof res.count === 'number') return res.count;
        } catch(e){}
      }
    }
    try {
      var res2 = await window.supabase.from('preventivi')
        .select('id,avanzamento,avanzamento_commessa,percentuale,progress,dataAccettazione,data_accettazione,accettazione_data,dataAcc')
        .limit(10000);
      if (res2 && Array.isArray(res2.data)){
        var cnt = 0;
        res2.data.forEach(function(r){
          var adv = r.avanzamento ?? r.avanzamento_commessa ?? r.percentuale ?? r.progress ?? 0;
          var dt = r.dataAccettazione ?? r.data_accettazione ?? r.accettazione_data ?? r.dataAcc ?? null;
          if (Number(adv) >= 10 && dt) cnt++;
        });
        return cnt;
      }
    } catch(e){}
    return null;
  }

  async function refreshCounters(){
    placeCounters();
    var count = await countChiusi();
    if (typeof count === 'number'){
      var a = q('#countChiusiArchive'); if (a) a.textContent = 'Chiusi: ' + count;
      var e = q('#countChiusiEditor');  if (e) e.textContent = 'Chiusi: ' + count;
    }
  }

  // ---------- Boot ----------
  function boot(){
    setHeaderNumeroFromServer('—');  // header pulito su #quoteId
    armHeaderObserver();             // blocca scritture legacy "ELP-..."
    wireButtons();                   // Nuovo/Pulisci
    goEditorTab();                   // apri Editor
    resetEditorForm();               // pulisci form
    refreshCounters();               // badge Chiusi
    setInterval(refreshCounters, 30000);
    document.addEventListener('preventivo-salvato', refreshCounters);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();