v1.5.2 — Fix "missing ) after argument list" + requisiti richiesti (2025-10-18)

- Corretto l'apostrofo in una stringa JS: ora le stringhe usano doppi apici per evitare l'errore.
- "NUOVO" da Archivio porta all'Editor e pulisce i campi.
- All'avvio/refresh: stato pulito (home pulita).
- In create: SALVA esegue INSERT; numero assegnato dal trigger.

Installazione:
1) In index.html prima dei tuoi script (opzionale):
   <script>window.__EDITOR_PAGE_ID='page-editor'; window.__HOME_PAGE_ID='page-home';</script>
2) In fondo al body:
   <script src="new-flow.v1.5.2.js"></script>