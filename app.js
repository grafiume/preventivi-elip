// Protezione caricamento
if (!window.__ELIP_APP_LOADED) {
window.__ELIP_APP_LOADED = true;

document.addEventListener('DOMContentLoaded', () => {
  console.log('[ELIP] UI caricata');

  const kpi = document.getElementById('kpiContainer');
  kpi.innerHTML = `
    <button class="card kpi border-top-orange text-start" type="button"><div class="card-body"><div class="small text-muted">Totali</div><div class="h4 mb-0">0</div></div></button>
    <button class="card kpi border-top-green text-start" type="button"><div class="card-body"><div class="small text-muted">In attesa</div><div class="h4 mb-0">0</div></div></button>
    <button class="card kpi border-top-yellow text-start" type="button"><div class="card-body"><div class="small text-muted">In lavorazione</div><div class="h4 mb-0">0</div></div></button>
    <button class="card kpi border-top-blue text-start" type="button"><div class="card-body"><div class="small text-muted">Completati</div><div class="h4 mb-0">0</div></div></button>
  `;

  const catalog = document.getElementById('catalogContainer');
  catalog.innerHTML = `<div class="card p-3 mb-3"><h5>Catalogo voci lavorazioni</h5>
  <ul class="list-group">
    <li class="list-group-item d-flex justify-content-between align-items-center">Avvolgimento indotto <span>100 €</span></li>
    <li class="list-group-item d-flex justify-content-between align-items-center">Tornitura rotore <span>80 €</span></li>
  </ul></div>`;

  const archive = document.getElementById('archiveContainer');
  archive.innerHTML = `<div class="card p-3"><h5>Archivio preventivi</h5><p class="text-muted">Qui verranno visualizzati i preventivi salvati.</p></div>`;

  document.getElementById('btnSave').addEventListener('click', () => {
    const msg = document.getElementById('toastSaveMsg');
    msg.textContent = `✅ Preventivo salvato con successo — ${new Date().toLocaleString()}`;
    new bootstrap.Toast(document.getElementById('toastSave')).show();
  });

  document.getElementById('btnMail').addEventListener('click', () => alert('Invio Email...'));
  document.getElementById('btnWA').addEventListener('click', () => alert('Invio WhatsApp...'));
});

}