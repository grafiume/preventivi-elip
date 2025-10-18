ELIP — Pacchetto completo (data: 2025-10-18)

CONTENUTO
- elip-complete-patch.v1.js  → patch unica (blocca ELP-..., usa numero DB, Nuovo/Clear/Salva, badge "Chiusi")
- index_patched.html         → il tuo index già pronto con gli script corretti
  
INSTALLAZIONE (scegli A o B)
A) Sostituisci direttamente il tuo index con "index_patched.html".
   (Rinomina il file in "index.html" al posto dell'originale.)

B) Se vuoi tenere il tuo index:
   1) In fondo, rimuovi TUTTE le vecchie patch che avevi aggiunto.
   2) Lascia SOLO queste due righe, in quest'ordine:
      <script src="app.js"></script>
      <script src="elip-complete-patch.v1.js"></script>

DOPO L'INSTALLAZIONE
- Hard refresh (Ctrl/Cmd + F5)
- Test rapidi:
  1) Refresh → Editor pulito, header (#quoteId) = "—"
  2) Archivio → Nuovo → Editor pulito, header "—"
  3) Salva → header mostra il numero DB (PV-YYYY-...)
  4) Vedi "Chiusi: N" vicino ai bottoni Accettati / Da accettare
