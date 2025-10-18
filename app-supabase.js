// Supabase integration v6.3-SB (no UI config)
if (!window.__ELIP_SUPA_LOADED) {
  window.__ELIP_SUPA_LOADED = true;
  let supa = null;

  function supaClient() {
    if (supa) return supa;
    try {
      const cfg = window.supabaseConfig || {};
      supa = window.supabase.createClient(cfg.url, cfg.anon);
      window.supa = supa;
    } catch (e) {
      console.error('[Supabase] Errore creazione client:', e);
      supa = null;
    }
    return supa;
  }

  window.saveToSupabase = async function (archiveAfter) {
    const cli = supaClient();
    if (!cli) {
      alert('Supabase non configurato');
      return;
    }

    const cur = JSON.parse(localStorage.getItem('elip_current') || 'null');
    if (!cur) {
      alert('Nessun preventivo corrente');
      return;
    }

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
      totale,
    };

    const existing = await cli.from('preventivi').select('id').eq('numero', cur.id).maybeSingle();

    if (existing.error && existing.error.code !== 'PGRST116') {
      console.error('[Supabase] Read error:', existing.error);
      return;
    }

    if (existing.data) {
      const upd = await cli.from('preventivi').update(payload).eq('id', existing.data.id);
      if (upd.error) {
        console.error('[Supabase] Update error:', upd.error);
        alert('Errore aggiornamento: ' + upd.error.message);
        return;
      }
    } else {
      const ins = await cli.from('preventivi').insert(payload);
      if (ins.error) {
        console.error('[Supabase] Insert error:', ins.error);
        alert(
          "Errore inserimento: " +
            ins.error.message +
            "\\nEsegui lo schema.sql in Supabase per creare le colonne 'linee' e 'images' (JSONB)."
        );
        return;
      }
    }

    if (typeof toastSaved === 'function') toastSaved();
    await window.loadArchiveSupabase();
    if (archiveAfter) {
      const tabBtn = document.querySelector('[data-bs-target="#tab-archivio"]');
      if (tabBtn) tabBtn.click();
    }
  };

  window.loadArchiveSupabase = async function () {
    const cli = supaClient();
    if (!cli) return [];
    const { data, error } = await cli.from('preventivi').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('[Supabase] Errore caricamento archivio:', error);
      localStorage.setItem('elip_archive', '[]');
      return [];
    }
    localStorage.setItem('elip_archive', JSON.stringify(data || []));
    return data || [];
  };

  window.subscribeRealtime = function () {
    const cli = supaClient();
    if (!cli) return;
    cli
      .channel('preventivi_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'preventivi' }, () => {
        window.loadArchiveSupabase().then(() => {
          if (typeof renderArchiveLocal === 'function') renderArchiveLocal();
        });
      })
      .subscribe();
  };
}
