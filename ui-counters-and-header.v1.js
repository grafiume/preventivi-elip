/*! ui-counters-and-header.v1.js
    - Fissa l'header: mostra SEMPRE il numero ufficiale (campo `numero` dal DB)
    - "NUOVO" → header = '—' (hook a startNewFlow se presente)
    - Ascolta il salvataggio e aggiorna l'header (hook a salvaPreventivo + listener evento)
    - Aggiunge contatori "Chiusi" in Archivio e in Editor (vicino a "Accettati" / "Da accettare")
    - "Chiusi" = avanzamento ≥ 10% E data accettazione valorizzata
*/
(function(){
  'use strict';

  // ----------------- UTIL -----------------
  function isVisible(el){ return !!(el && el.offsetParent !== null); }

  // ----------------- HEADER NUMERO -----------------
  function ensureHeaderNumeroSlot() {
    var slot = document.getElementById('headerNumero');
    if (slot) return slot;

    // Preferisci il titolo editor
    var title = document.getElementById('editorTitle');
    if (!title) {
      // cerca un H1/H2 visibile
      var hs = document.querySelectorAll('h1, h2, .page-title');
      for (var i=0;i<hs.length;i++){ if (isVisible(hs[i])) { title = hs[i]; break; } }
    }
    if (!title) return null;

    slot = document.createElement('span');
    slot.id = 'headerNumero';
    slot.style.marginLeft = '0.5rem';
    slot.style.fontWeight = '600';
    slot.style.padding = '2px 8px';
    slot.style.borderRadius = '12px';
    slot.style.background = '#efefef';
    slot.style.fontSize = '0.95em';
    title.appendChild(slot);
    return slot;
  }

  function updateHeaderNumero(val) {
    var slot = ensureHeaderNumeroSlot();
    if (!slot) return;
    var txt = (val && String(val).trim()) ? String(val).trim() : '—';
    slot.textContent = txt;
  }
  window.updateHeaderNumero = updateHeaderNumero;

  // Agganci a #numero (qualsiasi input/campo probabile)
  var numeroSelectors = ['#numero','input[name="numero"]','[data-field="numero"]','[name="numero"]'];
  function getNumeroEl(){
    for (var i=0;i<numeroSelectors.length;i++){
      var el = document.querySelector(numeroSelectors[i]);
      if (el) return el;
    }
    return null;
  }

  // MutationObserver sul campo numero (cattura cambi DOM esterni)
  (function observeNumero(){
    var el = getNumeroEl();
    if (!el) return;
    var last = el.value || '';
    updateHeaderNumero(last);
    var obs = new MutationObserver(function(){
      var v = (el.value || el.textContent || '').trim();
      if (v !== last){ last = v; updateHeaderNumero(v); }
    });
    obs.observe(el, { attributes:true, characterData:true, subtree:true });
    el.addEventListener('input', function(){ var v = (el.value||'').trim(); updateHeaderNumero(v); });
  })();

  // Hook a startNewFlow (se esiste) per mettere '—'
  (function hookNew(){
    if (!window.startNewFlow) return;
    var _orig = window.startNewFlow;
    window.startNewFlow = function(){
      try { updateHeaderNumero('—'); } catch(e){}
      return _orig.apply(this, arguments);
    };
  })();

  // Ascolta evento personalizzato "preventivo-salvato" (se l'app lo emette)
  document.addEventListener('preventivo-salvato', function(e){
    var num = e && e.detail && e.detail.numero;
    if (num) updateHeaderNumero(num);
  });

  // Hook a salvaPreventivo per emettere l'evento e restituire i dati
  (function hookSave(){
    if (!window.salvaPreventivo) return;
    var _origSave = window.salvaPreventivo;
    window.salvaPreventivo = async function(){
      var res = await _origSave.apply(this, arguments);
      try {
        var data = res && (res.data || res).data ? (res.data || res).data : (res && res.data ? res.data : null);
        // fallback: magari _origSave ritorna direttamente {data, error}
        if (!data && res && res.numero) data = res;
        var num = data && data.numero;
        if (!num) {
          var el = getNumeroEl();
          if (el && el.value) num = el.value;
        }
        if (num) {
          updateHeaderNumero(num);
          document.dispatchEvent(new CustomEvent('preventivo-salvato', { detail: { numero: num, id: data && data.id } }));
        }
      } catch(e){}
      return res;
    };
  })();

  // All'avvio header = '—'
  function bootHeader(){ updateHeaderNumero('—'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootHeader);
  else bootHeader();

  // ----------------- CONTATORI "CHIUSI" -----------------
  // Config testi da cercare vicino a cui aggiungere il badge
  var LABELS_NEAR = ['Accettati','Da accettare'];

  function makeBadge(id){
    var b = document.getElementById(id);
    if (b) return b;
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
    b.textContent = 'Chiusi: 0';
    return b;
  }

  function placeBadgeNearText(labelText, badgeId){
    // cerca un nodo con testo corrispondente
    var nodes = document.querySelectorAll('button, a, span, div, h3, h4, li');
    for (var i=0;i<nodes.length;i++){
      var n = nodes[i];
      if (!isVisible(n)) continue;
      var txt = (n.textContent||'').trim().toLowerCase();
      if (!txt) continue;
      if (txt.indexOf(labelText.toLowerCase()) !== -1){
        var b = makeBadge(badgeId);
        if (!b.parentNode) n.parentNode.insertBefore(b, n.nextSibling);
        return b;
      }
    }
    // fallback: appendi in alto a destra della pagina
    var c = document.getElementById('page-archive') || document.body;
    var b2 = makeBadge(badgeId);
    if (!b2.parentNode) c.appendChild(b2);
    return b2;
  }

  // Trova (o crea) i due badge
  function ensureChiusiBadges(){
    placeBadgeNearText(LABELS_NEAR[0], 'countChiusiArchive'); // accettati (archivio)
    placeBadgeNearText(LABELS_NEAR[1], 'countChiusiEditor');  // da accettare (editor/corpo)
  }

  // Strategia conteggio "chiusi":
  // - Preferisce conteggio lato DB con filtri; se i nomi colonna non coincidono, fallback client.
  async function countChiusiDB(){
    if (!window.supabase) return null;
    // Tentativi di colonne per avanzamento e data accettazione
    var advCols = ['avanzamento', 'avanzamento_commessa', 'percentuale', 'progress'];
    var dateCols = ['dataAccettazione', 'data_accettazione', 'accettazione_data'];

    // Prova HEAD count con combinazioni comuni
    for (var a=0;a<advCols.length;a++){
      for (var d=0; d<dateCols.length; d++){
        try {
          var q = window.supabase.from('preventivi').select('*', { count:'exact', head:true });
          q = q.gte(advCols[a], 10).not(dateCols[d], 'is', null);
          var res = await q;
          if (res && typeof res.count === 'number') return res.count;
        } catch(e){ /* tenta la prossima */ }
      }
    }

    // Fallback: prendi pochi campi e conta lato client
    try {
      var res2 = await window.supabase.from('preventivi')
        .select('id,avanzamento,avanzamento_commessa,percentuale,progress,dataAccettazione,data_accettazione,accettazione_data')
        .limit(10000);
      if (res2 && Array.isArray(res2.data)) {
        var cnt = 0;
        res2.data.forEach(function(r){
          var adv = r.avanzamento ?? r.avanzamento_commessa ?? r.percentuale ?? r.progress ?? 0;
          var dt = r.dataAccettazione ?? r.data_accettazione ?? r.accettazione_data ?? null;
          if (Number(adv) >= 10 && dt) cnt++;
        });
        return cnt;
      }
    } catch(e){}
    return null;
  }

  async function refreshChiusiCounters(){
    ensureChiusiBadges();
    var count = await countChiusiDB();
    if (typeof count === 'number'){
      var b1 = document.getElementById('countChiusiArchive'); if (b1) b1.textContent = 'Chiusi: ' + count;
      var b2 = document.getElementById('countChiusiEditor');  if (b2) b2.textContent = 'Chiusi: ' + count;
    }
  }

  // Refresh iniziale e periodico
  function bootCounters(){ refreshChiusiCounters(); setInterval(refreshChiusiCounters, 30000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootCounters);
  else bootCounters();

  // Aggiorna i contatori dopo il salvataggio
  document.addEventListener('preventivo-salvato', function(){ refreshChiusiCounters(); });

})();