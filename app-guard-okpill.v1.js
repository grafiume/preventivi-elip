
/*! app-guard-okpill.v1.js
   - Rende innocui gli accessi a #okPill in app.js (fillForm/recalc) con null-check.
   - Caricalo DOPO app.js e PRIMA della patch, oppure anche dopo la patch.
*/
(function(){
  'use strict';
  function q(s, r){ return (r||document).querySelector(s); }

  function safeToggleOkPill(c){
    var ok = q('#okPill'); if (!ok) return;
    var has = !!(c && c.dataAcc && String(c.dataAcc).trim());
    try{
      ok.classList.toggle('acc-ok', has);
      ok.classList.toggle('acc-no', !has);
      ok.textContent = has ? '● OK' : '● NO';
    }catch(_){}
  }
  function getCurrent(){ try{ return JSON.parse(localStorage.getItem('elip_current')||'null'); }catch(_){ return null; } }

  function wrap(name){
    if (!window[name]) return;
    var _orig = window[name];
    window[name] = function(){
      var r;
      try{ r = _orig.apply(this, arguments); }catch(_){ /* evita crash di app.js */ }
      try{ safeToggleOkPill(getCurrent()); }catch(_){}
      return r;
    };
  }

  if (document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){ wrap('fillForm'); wrap('recalc'); });
  }else{ wrap('fillForm'); wrap('recalc'); }
})();
