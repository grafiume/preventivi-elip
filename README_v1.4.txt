Preventivi — Patch v1.4 (2025-10-18)

COSA RISOLVE
- "Nuovo" in Archivio ora va in Editor (configurabile con window.__EDITOR_PAGE_ID, opz. window.__ARCHIVE_PAGE_ID).
- In modalità "create" fa SEMPRE INSERT (non aggiorna più il vecchio record).
- Pulisce #numero e #id sul reset per evitare riutilizzi.
- Blocca solo le RPC client-side del numero (niente più blocchi INSERT).

INSTALLAZIONE
1) In index.html PRIMA dei tuoi script (opzionale ma consigliato) definisci l'ID della pagina editor:
   <script>window.__EDITOR_PAGE_ID = 'page-editor'; window.__ARCHIVE_PAGE_ID = 'page-archive';</script>

2) In fondo, DOPO i tuoi script principali, aggiungi:
   <script src="new-flow.v1.4.js"></script>

3) In Supabase (facoltativo ma utile), lancia `sql-verify-gapfill.sql` per verificare che il trigger gap-fill e l'indice unico (anno,progressivo) siano correttamente installati.

TEST
- Premi "NUOVO" (editor/archivio): atterra in Editor pulito, nessun numero mostrato.
- Salva: INSERT con assegnazione numero `PV-YYYY-000001`... riempie il buco più basso disponibile nell'anno.
- Nuovo record successivo: progressivo correttamente successivo o buco riempito.

Se l'Editor non si apre ancora, inviami l'ID reale del container Editor (es. "page-scheda") e lo fisso nel file.