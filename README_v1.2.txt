Preventivi — Patch v1.2 "NUOVO senza buchi + Forza Editor + Block legacy" (2025-10-18)

CONTENUTO
- new-flow.v1.2.js
  * Blocca qualsiasi INSERT su 'preventivi' al di fuori di salvaPreventivo()
  * Blocca rpc_next_preventivo se chiamato fuori dal salvataggio
  * Intercetta qualsiasi bottone "NUOVO" e forza l'apertura dell'Editor, anche da Archivio
  * Numero assegnato solo al Salva (trigger gap-fill)
- sql-cleanup-legacy-numbering.sql
  * Disinstalla trigger/funzioni/sequenze legacy che fanno avanzare il contatore

INSTALLAZIONE
1) In Supabase > SQL, esegui `sql-cleanup-legacy-numbering.sql` per pulire vecchie logiche.
2) Assicurati di avere già installato il trigger "gap-fill" corretto.
3) In index.html, in fondo, aggiungi:
   <script src="new-flow.v1.2.js"></script>

TEST
- Premi "NUOVO" più volte (editor/archivio): il DB non deve ricevere INSERT/RPC → nessun avanzamento del numero.
- Salva: viene assegnato PV-YYYY-000xxx riempiendo il più piccolo buco disponibile.
- "NUOVO" da Archivio: ti porta sempre all'Editor pulito.