/* Preventivi ELIP — app-supabase.js (2025-10-23, no top-level await) */
(function(){
  'use strict';

  // -- Client singleton -------------------------------------------------------
  let client = null;
  function supa() {
    if (client) return client;
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('Supabase library non caricata');
    }
    const cfg = window.supabaseConfig || {};
    if (!cfg.url || !cfg.anon) {
      console.warn('[supabase] Missing window.supabaseConfig {url, anon}');
    }
    client = window.supabase.createClient(cfg.url, cfg.anon, {
      auth: { persistSession: false },
      global: { headers: { 'x-client-info': 'preventivi-elip/2025-10-23' } }
    });
    return client;
  }

  // -- Retry helper -----------------------------------------------------------
  function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
  async function withRetry(fn, tries=5, base=400){
    let last;
    for (let i=0;i<tries;i++){
      try { return await fn(); }
      catch (err){
        last = err;
        const code = Number(err?.status || err?.code || 0);
        if (code === 429 || code >= 500) {
          await sleep(base * Math.pow(2, i));
          continue;
        }
        break;
      }
    }
    throw last;
  }

  // -- CRUD preventivi --------------------------------------------------------
  async function upsertPreventivoByNumero(payload){
    const c = supa();
    const res = await c.from('preventivi').select('id').eq('numero', payload.numero).maybeSingle();
    if (res.error && res.error.code !== 'PGRST116') return { error: res.error };
    if (res.data) {
      const u = await c.from('preventivi').update(payload).eq('id', res.data.id).select().single();
      return { data: u.data, error: u.error };
    } else {
      const i = await c.from('preventivi').insert(payload).select().single();
      return { data: i.data, error: i.error };
    }
  }

  // -- Upload foto su bucket 'photos' ----------------------------------------
  async function uploadPhoto(file, numero){
    const c = supa();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fname = `${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
    const path = `${numero}/${fname}`;

    await withRetry(async () => {
      const { error } = await c.storage.from('photos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
    });

    const { data: pub } = c.storage.from('photos').getPublicUrl(path);
    const url = pub?.publicUrl || null;

    try { await c.from('photos').insert([{ record_num: numero, path, url }]); } catch(_) {}

    return { path, url };
  }

  // -- Archivio ---------------------------------------------------------------
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
       .on('postgres_changes', { event: '*', schema: 'public', table: 'preventivi' }, () => {
          loadArchive().then(() => {
            if (typeof window.renderArchiveLocal === 'function') window.renderArchiveLocal();
          });
       })
       .subscribe();
    } catch (e) {
      console.warn('[supabase] realtime subscribe failed', e);
    }
  }

  // -- Salva completo (richiamato da app.js) ---------------------------------
  async function saveToSupabase(archiveAfter){
    const cur = (() => { try { return JSON.parse(localStorage.getItem('elip_current') || 'null'); } catch { return null; } })();
    if (!cur) { alert('Nessun preventivo in memoria.'); return; }

    const imponibile = (cur.lines || []).reduce((s, r) => s + (+(r.qty||0)) * (+(r.price||0)), 0);
    const totale = +(imponibile * 1.22).toFixed(2);

    const payload = {
      numero: cur.id,
      cliente: cur.cliente || null,
      articolo: cur.articolo || null,
      ddt: cur.ddt || null,
      telefono: cur.telefono || null,
      email: cur.email || null,
      data_invio: cur.dataInvio || null,
      data_accettazione: cur.dataAcc || null,
      data_scadenza: cur.dataScad || null,
      note: cur.note || null,
      linee: cur.lines || [],
      imponibile, totale
    };

    const { error } = await upsertPreventivoByNumero(payload);
    if (error) { alert('Errore salvataggio: ' + (error.message || error)); return; }

    const queue = Array.isArray(window.__elipPhotosQueue) ? window.__elipPhotosQueue.slice() : [];
    for (const f of queue) {
      try { await uploadPhoto(f, cur.id); } catch (e) { console.warn('[uploadPhoto]', e); }
    }
    window.__elipPhotosQueue = [];

    await loadArchive();
    if (typeof window.toastSaved === 'function') window.toastSaved();

    const btn = document.querySelector('[data-bs-target="#tab-editor"]');
    if (btn) {
      try { new bootstrap.Tab(btn).show(); } catch { btn.click(); }
    }
    if (archiveAfter) {
      const t = document.querySelector('[data-bs-target="#tab-archivio"]');
      t && t.click();
    }
  }

  // -- Esporta API su window --------------------------------------------------
  window.dbApi = {
    supa,
    uploadPhoto,
    loadArchive,
    subscribeRealtime,
    saveToSupabase
  };
})();
