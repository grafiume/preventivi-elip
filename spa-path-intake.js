// spa-path-intake.js
(function(){
  if (window.__SPA_PATH_INTAKE__) return;
  window.__SPA_PATH_INTAKE__ = true;

  function parseHash(){
    var h = location.hash || '';
    var m = h.match(/#\/?(pvid|pvno)\/([^?#]+)/i);
    if (!m) return null;
    return { kind: m[1].toLowerCase(), key: decodeURIComponent(m[2]) };
  }

  function fromSession(){
    var k = sessionStorage.getItem('pv.deep.link.key') || '';
    var kind = sessionStorage.getItem('pv.deep.link.kind') || '';
    if (k && (kind === 'pvid' || kind === 'pvno')) return {kind, key: k};
    return null;
  }

  function isUUID(v){
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
  }

  async function loadRecord(kind, key){
    if (!window.supabase) return console.warn('[spa-path-intake] supabase non pronto');
    let rec = null;
    if (kind === 'pvid' || (kind === 'pvno' && isUUID(key))) {
      const r1 = await window.supabase.from('preventivi').select('*').eq('id', key).maybeSingle();
      if (!r1.error && r1.data) rec = r1.data;
    }
    if (!rec) {
      const r2 = await window.supabase.from('preventivi').select('*').eq('numero', key).maybeSingle();
      if (!r2.error && r2.data) rec = r2.data;
    }
    if (rec) {
      window.__URL_INTENT_HAS_TARGET__ = true;
      if (typeof window.__openPreventivo === 'function') {
        window.__openPreventivo(rec);
      } else if (typeof window.openPreventivoByIdOrNumero === 'function') {
        window.openPreventivoByIdOrNumero(key);
      } else {
        console.log('[spa-path-intake] Preventivo:', rec);
      }
    } else {
      console.warn('[spa-path-intake] Preventivo non trovato per', kind, key);
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    var got = parseHash() || fromSession();
    if (!got) return;
    window.__URL_INTENT_HAS_TARGET__ = true;
    var tryOpen = function(){
      if (window.supabase) loadRecord(got.kind, got.key);
      else setTimeout(tryOpen, 40);
    };
    tryOpen();
  });

})();