// Protezione caricamento
if (!window.__ELIP_SUPA_LOADED) {
window.__ELIP_SUPA_LOADED = true;

if (!window.__elipSupa) {
  const { createClient } = window.supabase;
  window.__elipSupa = createClient(window.supabaseConfig.url, window.supabaseConfig.anon);
}
const supa = window.__elipSupa;

async function saveToSupabase(data) {
  const { data: d, error } = await supa.from('preventivi').upsert(data).select();
  if (error) console.error(error);
  else console.log('[Supabase] Salvato', d);
}

async function loadPreventivi() {
  const { data, error } = await supa.from('preventivi').select('*').order('created_at',{ascending:false});
  if (error) console.error(error);
  else console.log('[Supabase] Caricati', data);
  return data;
}

}