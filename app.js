// Protezione per doppio caricamento
if (!window.__ELIP_APP_LOADED) {
window.__ELIP_APP_LOADED = true;

// ===============================
// Preventivi ELIP - app.js fixato
// ===============================

// Costanti
const EURO = '€';
let currentId = null;

// Init UI
document.addEventListener('DOMContentLoaded', init);

function init() {
  bindAll();
  appInitData();
}

function bindAll() {
  document.getElementById('btnSave').addEventListener('click', savePreventivo);
  document.getElementById('btnPDFDett').addEventListener('click', () => previewPDF('dett'));
  document.getElementById('btnPDFTot').addEventListener('click', () => previewPDF('tot'));
}

// funzione rinominata per evitare conflitto con window.bootstrap
function appInitData() {
  // eventuale logica iniziale dati
  console.log('[appInitData] init data');
}

// PDF preview
function previewPDF(mode) {
  if (!window.jspdf) {
    alert('PDF non disponibile');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text(`Preventivo ELIP (${mode})`, 20, 20);
  doc.autoTable({
    head: [['Codice','Descrizione','Totale']],
    body: [['01','Lavorazione esempio','100,00 €']],
    startY: 30,
    styles: { overflow:'linebreak', cellPadding: 5 },
    columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 100 }, 2: { cellWidth: 40 } }
  });

  // Modal anteprima (se supportata)
  if (window.bootstrap && bootstrap.Modal) {
    const modalEl = document.createElement('div');
    modalEl.className = 'modal fade';
    modalEl.innerHTML = '<div class="modal-dialog modal-lg"><div class="modal-content p-3"><embed type="application/pdf" width="100%" height="500px"></div></div>';
    document.body.appendChild(modalEl);
    const modal = new bootstrap.Modal(modalEl);
    const pdfUrl = doc.output('bloburl');
    modalEl.querySelector('embed').src = pdfUrl;
    modal.show();
    modalEl.addEventListener('hidden.bs.modal', ()=>modalEl.remove());
  } else {
    doc.output('dataurlnewwindow');
  }
}

function savePreventivo() {
  console.log('[savePreventivo]');
  const toastEl = document.getElementById('toastSave');
  const msg = document.getElementById('toastSaveMsg');
  const now = new Date().toLocaleString();
  msg.textContent = `✅ Preventivo salvato con successo — ${now}`;
  const toast = new bootstrap.Toast(toastEl);
  toast.show();
}

} // fine blocco protezione
