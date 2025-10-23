
# Fix salvataggio foto + ritorno Home + QuotaExceeded (2025‑10‑23)

**Cosa cambia**
- La foto non viene più messa in `localStorage` (niente base64): anteprima con `URL.createObjectURL` e file in coda per upload.
- Al click su **Salva**: inserisce/aggiorna il record, carica le foto su **Supabase Storage** (`photos/recordId/…`), poi **chiude** la finestra/modale e **torna in Home**. Pulisce anche il form.
- `elip_current` ora salva solo una copia **leggera** del record (senza immagini e campi pesanti), evitando l'errore:
  `QuotaExceededError: Failed to execute 'setItem' on 'Storage'`.

**File inclusi (da sostituire nel repo)**
- `app.js`
- `app-supabase.js`

> Non è incluso `config.js` (usa il tuo). Assicurati che `window.SUPABASE_URL` e `window.SUPABASE_ANON_KEY` siano corretti e che esista il bucket **photos** (pubblico) più la tabella **photos** con colonne: `id (uuid)`, `record_id (uuid/text conforme)`, `path (text)`, `url (text)`.

**Hook UI richiesti**
- Un input file con id `newPhotoInput` e un contenitore anteprima con id `newPhotoPreview`.
- Un form con id `form-new` (e/o `form-edit`) e un bottone `#btnSave` (o `#btnDoSave`).
- Un bottone "Nuova scheda" con id `#btnNuovaScheda` (o `#btnNew`).
- Se usi un modal per la scheda: id `#preventivoModal` (verrà chiuso automaticamente).

**Note su errori 429/544**
- L’upload usa retry/backoff esponenziale per gestire `429 Too Many Requests` e 5xx.
