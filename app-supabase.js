
/* === ELIP TAGLIENTE • app-supabase.js (singleton + upload retry) ===
 * Richiede finestra globale config.js con:
 *   window.SUPABASE_URL = 'https://...supabase.co';
 *   window.SUPABASE_ANON_KEY = '...';
 */
(function () {
  'use strict';

  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    console.warn('[supabase] Missing config.js values');
  }

  // Singleton
  const getClient = (() => {
    let client = null;
    return () => {
      if (client) return client;
      if (!window.supabase || !window.supabase.createClient) {
        throw new Error('Supabase library non caricata');
      }
      client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
        global: { headers: { 'x-client-info': 'elip-app/2025-10-23' } }
      });
      return client;
    };
  })();

  // Backoff helper
  async function withRetry(fn, { tries = 5, baseMs = 400 } = {}) {
    let lastErr;
    for (let i = 0; i < tries; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        const code = Number(err?.status || err?.code || 0);
        // Ritenta su 429/5xx
        if (code === 429 || code >= 500) {
          await new Promise(r => setTimeout(r, baseMs * Math.pow(2, i)));
          continue;
        }
        break;
      }
    }
    throw lastErr;
  }

  // Salva record (INSERT) su tabella 'records'
  async function saveRecord(rec) {
    const supa = getClient();
    const { data, error } = await supa
      .from('records')
      .insert([rec])
      .select()
      .single();
    return { data, error };
  }

  // Aggiorna record (UPDATE) su tabella 'records'
  async function updateRecord(rec) {
    if (!rec.id) throw new Error('updateRecord: id mancante');
    const supa = getClient();
    const { data, error } = await supa
      .from('records')
      .update(rec)
      .eq('id', rec.id)
      .select()
      .single();
    return { data, error };
  }

  // Upload foto nello Storage "photos" e registra su tabella "photos"
  async function uploadPhoto(file, recordId) {
    const supa = getClient();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fname = `${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
    const path = `${recordId}/${fname}`;

    // 1) Upload su bucket "photos"
    await withRetry(async () => {
      const { error } = await supa.storage.from('photos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      return true;
    });

    // 2) Ottieni URL pubblico (se il bucket è pubblico) o signed URL
    const { data: pub } = supa.storage.from('photos').getPublicUrl(path);
    const url = pub?.publicUrl || null;

    // 3) Registra riga su tabella 'photos' (se la usi)
    let error = null, data = null;
    try {
      const res = await supa
        .from('photos')
        .insert([{
          record_id: recordId,
          path,
          url
        }])
        .select()
        .single();
      data = res.data; error = res.error || null;
    } catch (e) {
      error = e;
    }
    return { data, error, path, url };
  }

  window.dbApi = {
    getClient,
    saveRecord,
    updateRecord,
    uploadPhoto,
  };
})();
