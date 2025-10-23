
/* Preventivi ELIP — app-supabase.js (2025-10-23)
   - Rimuove 'photos' dal payload (niente errore PGRST204 se la colonna non esiste)
   - Upload foto + generazione thumbnail 164x164 nel bucket 'photos' (path: numero/ e numero/thumbs/)
   - Refresh Archivio dopo salvataggio (con retry)
*/
(function(){
  'use strict';

  let client = null;
  function supa() {
    if (client) return client;
    if (!window.supabase || !window.supabase.createClient) throw new Error('Supabase non caricato');
    const cfg = window.supabaseConfig || {};
    client = window.supabase.createClient(cfg.url, cfg.anon, { auth: { persistSession: false } });
    return client;
  }

  const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));
  async function withRetry(fn, tries=3, base=250){
    let last;
    for (let i=0;i<tries;i++){
      try { return await fn(); }
      catch (e){
        last = e;
        const code = Number(e?.status || e?.code || 0);
        if (code===429 || code>=500 || String(e?.message||'').includes('schema')) {
          await sleep(base*(i+1));
          continue;
        }
        break;
      }
    }
    if (last) throw last;
  }

  const ntext = (s)=> (typeof s==='string' && s.trim()!=='' ? s : null);
  const ndate = (s)=> (typeof s==='string' && s.trim()!=='' ? s : null);
  const nnumber = (n)=> { const x = Number(n); return Number.isFinite(x) ? x : null; };

  function buildPayload(cur){
    const imponibile = (cur.lines || []).reduce((s,r)=> s + (+(r.qty||0))*(+(r.price||0)), 0);
    const totale = +(imponibile*1.22).toFixed(2);
    return {
      numero: ntext(cur.id),
      cliente: ntext(cur.cliente),
      articolo: ntext(cur.articolo),
      ddt: ntext(cur.ddt),
      telefono: ntext(cur.telefono),
      email: ntext(cur.email),
      data_invio: ndate(cur.dataInvio),
      data_accettazione: ndate(cur.dataAcc),
      data_scadenza: ndate(cur.dataScad),
      note: ntext(cur.note),
      linee: (cur.lines || []),
      imponibile: nnumber(imponibile),
      totale: nnumber(totale)
      // Niente 'photos' nel payload → evita PGRST204
    };
  }

  async function saveCompat(table, payload, where){
    const c = supa();
    let q = c.from(table);
    if (where?.id) q = q.update(payload).eq('id', where.id).select().single();
    else q = q.insert(payload).select().single();
    const { data, error } = await q;
    if (error) throw error;
    return { data };
  }

  async function upsertPreventivoByNumero(payload){
    const c = supa();
    const { data: found, error: selErr } = await c.from('preventivi').select('id').eq('numero', payload.numero).maybeSingle();
    if (selErr && selErr.code !== 'PGRST116') return { error: selErr };

    if (found?.id) {
      try {
        const { data } = await saveCompat('preventivi', payload, { id: found.id });
        return { data };
      } catch (e) {
        console.error('[preventivi UPDATE error]', e);
        return { error: e };
      }
    } else {
      try {
        const { data } = await saveCompat('preventivi', payload, null);
        return { data };
      } catch (e) {
        console.error('[preventivi INSERT error]', e);
        return { error: e };
      }
    }
  }

  async function fileToImageBitmap(file){
    const url = URL.createObjectURL(file);
    try {
      const img = await createImageBitmap(await (await fetch(url)).blob());
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async function makeThumb(file, size=164){
    const img = await fileToImageBitmap(file);
    const ratio = Math.max(size / img.width, size / img.height);
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0,0,size,size);
    // center-crop
    ctx.drawImage(img, (size - w)/2, (size - h)/2, w, h);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
    return blob; // 164x164 jpg
  }

  async function uploadPhoto(file, numero){
    const c = supa();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const baseName = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const fname = `${baseName}.${ext}`;
    const path = `${numero}/${fname}`;
    // Upload originale
    await withRetry(async () => {
      const { error } = await c.storage.from('photos').upload(path, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
    });
    // Thumbnail 164x164
    let thumbUrl = null;
    try {
      const thumbBlob = await makeThumb(file, 164);
      const tpath = `${numero}/thumbs/${baseName}.jpg`;
      await withRetry(async () => {
        const { error } = await c.storage.from('photos').upload(tpath, thumbBlob, { cacheControl: '3600', upsert: false, contentType: 'image/jpeg' });
        if (error) throw error;
      });
      const { data: t } = c.storage.from('photos').getPublicUrl(tpath);
      thumbUrl = t?.publicUrl || null;
    } catch (e) {
      console.warn('[thumb upload failed]', e?.message || e);
    }

    // Public URL originale
    const { data: pub } = c.storage.from('photos').getPublicUrl(path);
    const url = pub?.publicUrl || null;

    // Persisti nella tabella photos (se presente)
    try {
      const row = thumbUrl ? [{ record_num: numero, path, url, thumb_url: thumbUrl }] : [{ record_num: numero, path, url }];
      await c.from('photos').insert(row);
    } catch(_) {}

    return { path, url, thumbUrl };
  }

  async function loadArchive(){
    const c = supa();
    const { data, error } = await c.from('preventivi').select('*').order('created_at', { ascending: false });
    if (error) {
      console.warn('[supabase] loadArchive error:', error);
      try { localStorage.setItem('elip_archive', '[]'); } catch {}
      return [];
    }
    try { localStorage.setItem('elip_archive', JSON.stringify(data || [])); } catch {}
    return data || [];
  }

  async function loadArchiveRetry(){
    return await withRetry(async () => await loadArchive(), 3, 300);
  }

  function subscribeRealtime(){
    const c = supa();
    try {
      c.channel('preventivi_changes')
        .on('postgres_changes', { event:'*', schema:'public', table:'preventivi' }, () => {
          loadArchive().then(() => {
            if (typeof window.renderArchiveLocal === 'function') window.renderArchiveLocal();
          });
        })
        .subscribe();
    } catch (e) { console.warn('[supabase] realtime subscribe failed', e); }
  }

  async function saveToSupabase(archiveAfter){
    const cur = (() => { try { return JSON.parse(localStorage.getItem('elip_current') || 'null'); } catch { return null; } })();
    if (!cur) { alert('Nessun preventivo in memoria.'); return false; }

    const payload = buildPayload(cur);
    const { error } = await upsertPreventivoByNumero(payload);
    if (error) {
      const msg = error?.message || JSON.stringify(error);
      console.error('[saveToSupabase] payload:', payload, 'error:', error);
      alert('Errore salvataggio: ' + msg);
      return false;
    }

    // Foto (best-effort)
    const queue = Array.isArray(window.__elipPhotosQueue) ? window.__elipPhotosQueue.slice() : [];
    for (const f of queue) {
      try { await uploadPhoto(f, cur.id); } catch (e) { console.warn('[uploadPhoto]', e); }
    }
    window.__elipPhotosQueue = [];

    await loadArchiveRetry();
    if (typeof window.renderArchiveLocal === 'function') {
      try { window.renderArchiveLocal(); } catch (_) {}
    }

    if (typeof window.toastSaved === 'function') window.toastSaved();

    // Tab Archivio se richiesto
    if (archiveAfter) {
      const t = document.querySelector('[data-bs-target="#tab-archivio"]');
      if (t) { try { new bootstrap.Tab(t).show(); } catch { t.click(); } }
    }

    return true;
  }

  window.dbApi = { supa, uploadPhoto, loadArchive, loadArchiveRetry, subscribeRealtime, saveToSupabase };
})();
