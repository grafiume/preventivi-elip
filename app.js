// =====================================================
// APP.JS - Gestione Preventivi ELIP con Supabase v6.1-SB
// =====================================================

// =====================
// GESTIONE DATALIST VOCI
// =====================
function buildDatalist() {
  // Prendo o creo il <datalist id="catalogCodes">
  let dl = document.getElementById('catalogCodes');
  if (!dl) {
    dl = document.createElement('datalist');
    dl.id = 'catalogCodes';
    document.body.appendChild(dl);
  }

  dl.innerHTML = '';
  const catalog = getCatalog(); // Recupera l’elenco voci dal catalogo
  catalog.forEach(x => {
    const opt = document.createElement('option');
    opt.value = x.code;
    opt.label = `${x.code} - ${x.desc}`;
    dl.appendChild(opt);
  });
}

// =====================
// GESTIONE CATALOGO VOCI
// =====================
function getCatalog() {
  const data = localStorage.getItem('elip_catalog');
  if (data) return JSON.parse(data);
  // Catalogo base (puoi modificare)
  return [
    { code: '01', desc: 'Avvolgimento indotto con recupero collettore', price: 0 },
    { code: '07', desc: 'Tornitura, smicatura ed equilibratura rotore', price: 0 },
  ];
}

// =====================
// RENDER ARCHIVIO LOCALE
// =====================
function renderArchiveLocal() {
  const tbody = document.getElementById('archBody');
  if (!tbody) return;
  const archive = JSON.parse(localStorage.getItem('elip_archive') || '[]');
  tbody.innerHTML = '';
  archive.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.numero || ''}</td>
      <td>${r.data_invio || ''}</td>
      <td>${r.cliente || ''}</td>
      <td>${r.articolo || ''}</td>
      <td>${r.ddt || ''}</td>
      <td>${(r.totale || 0).toFixed(2)} €</td>
      <td>${r.data_accettazione ? '✅' : '❌'}</td>
      <td>${r.data_scadenza || ''}</td>
      <td>${r.data_accettazione ? '<span class="badge bg-success">OK</span>' : '<span class="badge bg-danger">NO</span>'}</td>
      <td><button class="btn btn-sm btn-outline-primary" onclick="editPreventivo('${r.numero}')">Apri</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// =====================
// FUNZIONE DI EDIT
// =====================
function editPreventivo(id) {
  console.log('Apertura preventivo', id);
  // Qui puoi implementare la logica di caricamento preventivo specifico
}

// =====================
// INIZIALIZZAZIONE APP
// =====================
document.addEventListener('DOMContentLoaded', () => {
  // Costruisco datalist all'avvio
  buildDatalist();

  // Carica archivio da Supabase o locale
  (window.loadArchiveSupabase ? window.loadArchiveSupabase() : Promise.resolve([]))
    .then(() => {
      if (window.renderArchiveLocal) renderArchiveLocal();
      if (window.subscribeRealtime) subscribeRealtime();
    })
    .catch(err => console.warn('Errore caricamento archivio:', err));
});
