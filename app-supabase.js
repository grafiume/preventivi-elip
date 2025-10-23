if(!window.__ELIP_SUPA_LOADED){window.__ELIP_SUPA_LOADED=true;
let supa=null;
function supaClient(){if(supa)return supa;try{const c=window.supabaseConfig||{};supa=window.supabase.createClient(c.url,c.anon);window.supa=supa;}catch(e){console.error('[Supabase] createClient',e);supa=null;}return supa;}
async function uploadPhoto(file, numero){
  const cli=supaClient(); if(!cli) throw new Error('Supabase non configurato');
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
  const fname=`${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
  const path=`${numero}/${fname}`;
  const { error } = await cli.storage.from('photos').upload(path, file, { cacheControl:'3600', upsert:false });
  if(error) throw error;
  const { data: pub } = cli.storage.from('photos').getPublicUrl(path);
  const url = pub?.publicUrl || null;
  try{ await cli.from('photos').insert([{ record_num: numero, path, url }]); }catch(_){}
  return { path, url };
}
window.saveToSupabase=async function(archiveAfter){
  const cli=supaClient();if(!cli){alert('Supabase non configurato');return;}
  const cur=JSON.parse(localStorage.getItem('elip_current')||'null');if(!cur){alert('Nessun preventivo');return;}
  const imp=(cur.lines||[]).reduce((s,r)=>s+(+r.qty||0)*(+r.price||0),0);const totale=imp*1.22;
  const payload={numero:cur.id,cliente:cur.cliente||null,articolo:cur.articolo||null,ddt:cur.ddt||null,telefono:cur.telefono||null,email:cur.email||null,data_invio:cur.dataInvio||null,data_accettazione:cur.dataAcc||null,data_scadenza:cur.dataScad||null,note:cur.note||null,linee:cur.lines||[],totale};
  const ex=await cli.from('preventivi').select('id').eq('numero',cur.id).maybeSingle();
  if(ex.error&&ex.error.code!=='PGRST116'){console.error('[Supabase] read',ex.error);return;}
  if(ex.data){
    const u=await cli.from('preventivi').update(payload).eq('id',ex.data.id);
    if(u.error){ alert('Errore aggiornamento: '+u.error.message); return; }
  } else {
    const ins=await cli.from('preventivi').insert(payload);
    if(ins.error){ alert('Errore inserimento: '+ins.error.message); return; }
  }
  // Upload photos from queue
  const Q = Array.isArray(window.__elipPhotosQueue) ? window.__elipPhotosQueue.slice() : [];
  for (const f of Q) { try{ await uploadPhoto(f, cur.id); } catch(e){ console.warn('upload', e); } }
  }
  // reset current (light)
  try{
    localStorage.setItem('elip_current', JSON.stringify({ id: cur.id, createdAt: cur.createdAt, cliente:'', articolo:'', ddt:'', telefono:'', email:'', dataInvio:'', dataAcc:'', dataScad:'', note:'', lines:[] }));
  }catch(_){}
  window.__elipPhotosQueue = [];
  if(typeof toastSaved==='function')toastSaved();await window.loadArchiveSupabase();if(archiveAfter){const t=document.querySelector('[data-bs-target="#tab-archivio"]');if(t)t.click();}
};
window.loadArchiveSupabase=async function(){const cli=supaClient();if(!cli)return[];const {data,error}=await cli.from('preventivi').select('*').order('created_at',{ascending:false});if(error){console.error('[Supabase] load',error);localStorage.setItem('elip_archive','[]');return[];}localStorage.setItem('elip_archive',JSON.stringify(data||[]));return data||[];};
window.subscribeRealtime=function(){const cli=supaClient();if(!cli)return;cli.channel('preventivi_changes').on('postgres_changes',{event:'*',schema:'public',table:'preventivi'},()=>{window.loadArchiveSupabase().then(()=>{if(typeof renderArchiveLocal==='function')renderArchiveLocal();});}).subscribe();};
}