// Supabase integration v6.1-SB
let supa = null;

function supaClient(){
  if(supa) return supa;
  const cfg = window.supabaseConfig;
  supa = supabase.createClient(cfg.url, cfg.anon);
  return supa;
}

async function uploadImagesIfNeeded(idPreventivo, images){
  // images are data URLs; upload each as jpg
  const cli = supaClient();
  const uploaded = [];
  for(const src of (images||[])){
    if(typeof src === 'string' && src.startsWith('http')) { uploaded.push(src); continue; } // already URL
    const base64 = src.split(',')[1];
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], {type:'image/jpeg'});
    const key = `${idPreventivo}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { data, error } = await cli.storage.from(window.supabaseConfig.bucket).upload(key, blob, { upsert: false });
    if(error){ console.error('Upload image error', error); continue; }
    const { data:pub } = cli.storage.from(window.supabaseConfig.bucket).getPublicUrl(key);
    uploaded.push(pub.publicUrl);
  }
  return uploaded;
}

async function saveToSupabase(archiveAfter){
  const cli = supaClient();
  const cur = JSON.parse(localStorage.getItem('elip_current'));
  // compute totals
  const imponibile = (cur.lines||[]).reduce((s,r)=> s + (r.qty||0)*(r.price||0), 0);
  const totale = imponibile*1.22;

  // ensure record id number
  let numero = cur.id;
  // upload images first
  const uploadedUrls = await uploadImagesIfNeeded(numero, cur.images||[]);
  cur.images = uploadedUrls; // replace with URLs
  localStorage.setItem('elip_current', JSON.stringify(cur));

  const payload = {
    numero: numero,
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
    totale: totale
  };

  // upsert by unique numero: if exists update, else insert
  // We'll search first
  const { data:existing, error:e1 } = await cli.from('preventivi').select('id, numero').eq('numero', numero).maybeSingle();
  if(e1){ console.error(e1); alert('Errore lettura: '+e1.message); return; }

  if(existing){
    const { error } = await cli.from('preventivi').update(payload).eq('id', existing.id);
    if(error){ console.error(error); alert('Errore aggiornamento: '+error.message); return; }
  }else{
    const { error } = await cli.from('preventivi').insert(payload);
    if(error){ console.error(error); alert('Errore inserimento: '+error.message); return; }
  }

  // refresh archive
  await loadArchiveSupabase();
  renderArchiveLocal();
  toastSaved();
  if(archiveAfter){
    document.querySelector('[data-bs-target="#tab-archivio"]').click();
  }
}

async function loadArchiveSupabase(){
  const cli = supaClient();
  const { data, error } = await cli.from('preventivi').select('*').order('created_at', { ascending:false });
  if(error){ console.error(error); return []; }
  localStorage.setItem('elip_archive', JSON.stringify(data || []));
  return data || [];
}

function subscribeRealtime(){
  const cli = supaClient();
  cli.channel('public:preventivi')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'preventivi' }, (payload) => {
      // reload archive and keep UI in sync
      loadArchiveSupabase().then(renderArchiveLocal);
    })
    .subscribe();
}
