// query-to-hash.js — Redirect ?pvid / ?pvno to SPA hash routes and enforce ?config=./config.js
(function(){
  try{
    var q = new URLSearchParams(location.search);
    var pvid = q.get('pvid') || q.get('id') || q.get('pv') || '';
    var pvno = q.get('pvno') || q.get('numero') || '';
    var cfg = q.get('config') || './config.js'; // default
    // Build base with ?config=... BEFORE hash (so the app sees it)
    var base = location.origin + location.pathname.replace(/index\.html?$/i, '');
    var prefix = base + '?config=' + encodeURIComponent(cfg);
    if(pvid){
      location.replace(prefix + '#/pvid/' + encodeURIComponent(pvid));
    }else if(pvno){
      location.replace(prefix + '#/pvno/' + encodeURIComponent(pvno));
    }
  }catch(e){ console && console.warn('[query-to-hash]', e); }
})();