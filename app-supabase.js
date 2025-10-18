// Supabase integration v6.1-SB (global + safe init)
if (!window.__ELIP_SUPA_LOADED) { window.__ELIP_SUPA_LOADED = true;

let supa = null;

// Create/get singleton client
window.supaClient = function () {
  if (supa) { return supa; }
  const cfg = window.supabaseConfig || {};
  if (!cfg.url || !cfg.anon) {
    console.error('[Supabase] Config mancante o invalida:', cfg);
    return null;
  }
  try {
    supa = window.supabase.createClient(cfg.url, cfg.anon);
    window.supa = supa;
    return supa;
  } catch (e) {
    console.error('[Supabase] Errore creazione client:', e);
    return null;
  }
};

// Upload immagini (ritorna array di URL pubblici)
window.uploadImagesIfNeeded = async function (idPreventivo, images) {
  const cli = window.supaClient();
  if (!cli) throw new Error('Supabase non inizializzato');
  const out = [];
  for (const src of (images || [])) {
    if (typeof src === 'string' && src.startsWith('http')) { out.push(src); continue; }
    // base64 -> blob
    const base64 = (src.split(',')[1] || '');
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const key = `${idPreventivo}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const up = await cli.storage.from(window.supabaseConfig.bucket).upload(key, blob, { upsert: false });
    if (up.error) { console.error('[Supabase] Upload img:', up.error); continue; }
    const { data: pub } = cli.storage.from(window.supabaseConfig.bucket).getPublicUrl(key);
    out.push(pub.publicUrl);
  }
  return out;
};

// Salvataggio preventivo (manuale o archiviazione)
window.saveToSupabase = async function (archiveAfter) {
  const cli = window.supaClient();
  if (!cli) { alert('Supabase non inizializzato'); return; }

  const cur = JSON.parse(localStorage.getItem('elip_current') || 'null');
  if (!cur) { alert('Nessun preventivo corrente'); return; }

  // carica immagini su storage se servono
  const uploaded = await window.uploadImagesIfNeeded(cur.id, cur.images || []);
  cur.images = uploaded;
  localStorage.setItem('elip_current', JSON.stringify(cur));

  const imponibile = (cur.lines || []).reduce((s, r) => s + (r.qty || 0) * (r.price || 0), 0);
  const totale = imponibile * 1.22;

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
    images: cur.images || [],
    totale
  };

  // upsert by numero
  const existing = await cli.from('preventivi').select('id').eq('numero', cur.id).maybeSingle();
  if (existing.error && existing.error.code !== 'PGRST116') { // ignore "no rows"
    console.error('[Supabase] Read error:', existing.error);
    alert('Errore lettura preventivo'); return;
  }

  if (existing.data) {
    const upd = await cli.from('preventivi').update(payload).eq('id', existing.data.id);
    if (upd.error) { console.error('[Supabase] Update error:', upd.error); alert('Errore aggiornamento'); return; }
  } else {
    const ins = await cli.from('preventivi').insert(payload);
    if (ins.error) { console.error('[Supabase] Insert error:', ins.error); alert('Errore inserimento'); return; }
  }

  await window.loadArchiveSupabase();
  if (typeof toastSaved === 'function') toastSaved();
  if (archiveAfter) {
    const tabBtn = document.querySelector('[data-bs-target="#tab-archivio"]');
    if (tabBtn) tabBtn.click();
  }
};

// Carica archivio e salva in localStorage 'elip_archive'
window.loadArchiveSupabase = async function () {
  const cli = window.supaClient();
  if (!cli) throw new Error('Supabase non inizializzato');
  const { data, error } = await cli
    .from('preventivi')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[Supabase] Errore caricamento archivio:', error);
    localStorage.setItem('elip_archive', '[]');
    return [];
  }
  localStorage.setItem('elip_archive', JSON.stringify(data || []));
  return data || [];
};

// Realtime per aggiornare l’archivio
window.subscribeRealtime = function () {
  const cli = window.supaClient();
  if (!cli) { console.warn('Supabase non inizializzato (realtime)'); return; }
  cli.channel('preventivi_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'preventivi' }, () => {
      window.loadArchiveSupabase().then(() => {
        if (typeof renderArchiveLocal === 'function') renderArchiveLocal();
      });
    })
    .subscribe();
};

} // end guard
