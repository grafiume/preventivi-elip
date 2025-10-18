Preventivi — RESET DA 1 (pacchetto rapido) — 2025-10-18

1) Esegui su Supabase: sql-reset-gapfill-from-1.sql
   - Pulisce legacy, crea funzione/trigger gap-fill
   - Con DB vuoto, il primo INSERT riceve PV-YYYY-000001

2) In index.html aggiungi:
   <script>window.__EDITOR_PAGE_ID='page-editor';</script>
   <script src="new-flow.v1.5.js"></script>

Note importanti
- Il JS forza "create" dopo NUOVO, svuota #id e #numero, e al salvataggio fa SEMPRE INSERT (se __mode==='create').
- Non invia id/numero/progressivo/anno al server: li calcola il trigger.
- Se premi NUOVO da Archivio o Editor: vai all'Editor pulito.

Test minimo
- NUOVO → compila 2 campi → SALVA ⇒ deve comparire PV-YYYY-000001
- NUOVO → SALVA ⇒ PV-YYYY-000002