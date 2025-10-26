// query-to-hash.js — Redirect ?pvid / ?pvno to SPA hash routes before app boots
(function(){
  try{
    var q = new URLSearchParams(location.search);
    var pvid = q.get('pvid') || q.get('id') || q.get('pv') || '';
    var pvno = q.get('pvno') || q.get('numero') || '';
    if(pvid || pvno){
      var base = location.origin + location.pathname.replace(/index\.html?$/i, '');
      var target = pvid ? base + '#/pvid/' + encodeURIComponent(pvid)
                        : base + '#/pvno/' + encodeURIComponent(pvno);
      // Clean redirect (no back button ping-pong)
      location.replace(target);
    }
  }catch(e){ console && console.warn('[query-to-hash]', e); }
})();