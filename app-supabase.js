// Supabase integration with runtime override + banner
if (!window.__ELIP_SUPA_LOADED) { window.__ELIP_SUPA_LOADED = true;

let supa = null;
function getCfg(){
  return {
    url: localStorage.getItem('elip_supabase_url') || (window.supabaseConfig && window.supabaseConfig.url) || '',
    anon: localStorage.getItem('elip_supabase_anon') || (window.supabaseConfig && window.supabaseConfig.anon) || '',
    bucket: (window.supabaseConfig && window.supabaseConfig.bucket) || 'preventivi-img'
  };
}

window.supaClient = function(){
  if (supa) return supa;
  const cfg = getCfg();
  try{
    if(!cfg.url || !cfg.anon) throw new Error('Config mancante');
    supa = window.supabase.createClient(cfg.url, cfg.anon);
    window.supa = supa;
  }catch(e){
    console.error('[Supabase] Config invalida:', e);
    supa = null;
  }
  return supa;
};

function showBanner(){
  const a = document.getElementById('sbAlert');
  if (a) a.classList.remove('d-none');
}

window.loadArchiveSupabase = async function(){
  const cli = window.supaClient();
  if (!cli) { showBanner(); return []; }
  const { data, error } = await cli.from('preventivi').select('*').order('created_at', { ascending:false });
  if (error) { console.error('[Supabase] Errore caricamento archivio:', error); showBanner(); localStorage.setItem('elip_archive','[]'); return []; }
  localStorage.setItem('elip_archive', JSON.stringify(data||[]));
  return data||[];
};

window.saveToSupabase = async function(archiveAfter){
  const cli = window.supaClient();
  if (!cli) { showBanner(); alert('Supabase non configurato'); return; }
  const cur = JSON.parse(localStorage.getItem('elip_current')||'null'); if(!cur) return;
  const imponibile = (cur.lines||[]).reduce((s,r)=>s+(r.qty||0)*(r.price||0),0);
  const totale = imponibile*1.22;

  const payload = {
    numero: cur.id, cliente: cur.cliente||null, articolo: cur.articolo||null, ddt: cur.ddt||null,
    telefono: cur.telefono||null, email: cur.email||null, data_invio: cur.dataInvio||null,
    data_accettazione: cur.dataAcc||null, data_scadenza: cur.dataScad||null, note: cur.note||null,
    linee: cur.lines||[], images: cur.images||[], totale
  };

  const existing = await cli.from('preventivi').select('id').eq('numero', cur.id).maybeSingle();
  if (existing.error && existing.error.code!=='PGRST116'){ console.error(existing.error); showBanner(); return; }
  if (existing.data){
    const upd = await cli.from('preventivi').update(payload).eq('id', existing.data.id);
    if (upd.error){ console.error(upd.error); showBanner(); return; }
  } else {
    const ins = await cli.from('preventivi').insert(payload);
    if (ins.error){ console.error(ins.error); showBanner(); return; }
  }
  await window.loadArchiveSupabase();
  if (typeof toastSaved==='function') toastSaved();
  if (archiveAfter){ const t=document.querySelector('[data-bs-target="#tab-archivio"]'); if(t) t.click(); }
};

window.subscribeRealtime = function(){
  const cli = window.supaClient(); if(!cli) { showBanner(); return; }
  cli.channel('preventivi_changes')
    .on('postgres_changes', { event:'*', schema:'public', table:'preventivi' }, ()=> window.loadArchiveSupabase().then(()=>{
      if (typeof renderArchiveLocal==='function') renderArchiveLocal();
    }))
    .subscribe();
};

}