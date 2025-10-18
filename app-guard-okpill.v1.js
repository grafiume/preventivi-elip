
/*! app-guard-okpill.v1.js */
(function(){
  'use strict';
  function q(s, r){ return (r||document).querySelector(s); }
  function getCurrent(){ try{ return JSON.parse(localStorage.getItem('elip_current')||'null'); }catch(_){ return null; } }
  function applyOk(){
    var ok=q('#okPill'); if(!ok) return;
    var c=getCurrent()||{};
    var has = !!(c && c.dataAcc && String(c.dataAcc).trim());
    try{
      ok.classList.toggle('acc-ok', has);
      ok.classList.toggle('acc-no', !has);
      ok.textContent = has ? '● OK' : '● NO';
    }catch(_){}
  }
  function wrap(name){
    if (!window[name]) return;
    var _o = window[name];
    window[name] = function(){
      var r; try{ r=_o.apply(this, arguments); }catch(_){}
      try{ applyOk(); }catch(_){}
      return r;
    };
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ wrap('fillForm'); wrap('recalc'); });
  else { wrap('fillForm'); wrap('recalc'); }
})();
