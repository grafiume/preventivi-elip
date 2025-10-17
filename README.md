# Preventivi ELIP

App web responsive per creare, archiviare e stampare in PDF i preventivi ELIP.

## Funzioni
- Lista lavorazioni con flag + importi (totale + IVA 22%).
- Campi cliente: **Cliente, Articolo, DDT, Telefono, Email**.
- **NOTE** (campo libero).
- Stato preventivo: **Da inviare, Inviato, Confermato**.
- **Data presunta consegna** e operatori (invio / lavorazioni).
- Archivio locale con ricerca, filtri per stato e **alert** per confermati con consegna entro 7 giorni.
- Generazione **PDF** con logo incluso.

## Avvio locale
Serve aprire l’app da un **server** (non con `file://`), per evitare errori CORS sul logo.
```bash
cd preventivi-elip
python3 -m http.server 8080
# poi visita http://localhost:8080
```

## Pubblicazione
Il progetto è pronto per **GitHub Pages**. Metti i file nella radice del repo e abilita Pages (branch `main`, root). L’URL sarà ad esempio `https://<utente>.github.io/preventivi-elip/`.
