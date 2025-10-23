
/* Preventivi ELIP — app-supabase.js (2025-10-23, return boolean on save) */
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
  async function withRetry(fn, tries=3, base=300){
    let last;
    for (let i=0;i<tries;i++){
      try { return await fn(); }
      catch (e){
        last = e;
        const code = Number(e?.status || e?.code || 0);
        if (code===429 || code>=500) { await sleep(base*(2**i)); continue; }
        break;
      }
    }
    throw last;
  }

  // Helpers tipi --------------------------------------------------------------
  const nz = (v)=> (v===undefined ? null : v);
  const ntext = (s)=> (typeof s==='string' && s.trim()!=='' ? s : null);
  const ndate = (s)=> (typeof s==='string' && s.trim()!=='' ? s : null);
  const nnumber = (n)=> {
    const x = Number(n);
    return Number.isFinite(x) ? x : null;
  };

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
      linee: nz(cur.lines || []),           // gestita nativamente come jsonb
      imponibile: nnumber(imponibile),
      totale: nnumber(totale)
    };
  }

  async function saveCompat(table, payload, where){
    const c = supa();
    // prova unica: assumiamo 'linee' jsonb (schema allineato)
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

  async function uploadPhoto(file, numero){
    const c = supa();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fname = `${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
    const path = `${numero}/${fname}`;

    await withRetry(async () => {
      const { error } = await c.storage.from('photos').upload(path, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
    });

    const { data: pub } = c.storage.from('photos').getPublicUrl(path);
    const url = pub?.publicUrl || null;

    try { await c.from('photos').insert([{ record_num: numero, path, url }]); } catch(_) {}

    return { path, url };
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

    // Upload foto (best-effort)
    const queue = Array.isArray(window.__elipPhotosQueue) ? window.__elipPhotosQueue.slice() : [];
    for (const f of queue) {
      try { await uploadPhoto(f, cur.id); } catch (e) { console.warn('[uploadPhoto]', e); }
    }
    window.__elipPhotosQueue = [];

    await loadArchive();
    if (typeof window.toastSaved === 'function') window.toastSaved();

    // resta sull'editor
    const btn = document.querySelector('[data-bs-target="#tab-editor"]');
    if (btn) { try { new bootstrap.Tab(btn).show(); } catch { btn.click(); } }
    if (archiveAfter) { const t = document.querySelector('[data-bs-target="#tab-archivio"]'); t && t.click(); }

    return true; // <<< SUCCESS
  }

  window.dbApi = { supa, uploadPhoto, loadArchive, subscribeRealtime, saveToSupabase };
})();
