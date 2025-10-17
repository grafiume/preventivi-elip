// Protezione caricamento
if (!window.__ELIP_APP_LOADED) {
window.__ELIP_APP_LOADED = true;

// Placeholder app.js con UI completa simulata
document.addEventListener('DOMContentLoaded', ()=>{
  console.log('[ELIP] UI pronta');
  document.getElementById('btnSave').addEventListener('click',()=>{
    const msg = document.getElementById('toastSaveMsg');
    msg.textContent = `✅ Preventivo salvato con successo — ${new Date().toLocaleString()}`;
    new bootstrap.Toast(document.getElementById('toastSave')).show();
  });
  document.getElementById('btnMail').addEventListener('click',()=>alert('Invio Email...'));
  document.getElementById('btnWA').addEventListener('click',()=>alert('Invio WhatsApp...'));
});

}