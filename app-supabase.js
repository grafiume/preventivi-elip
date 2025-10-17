// Protezione doppio caricamento
if (!window.__ELIP_SUPA_LOADED) {
window.__ELIP_SUPA_LOADED = true;

// ===============================
// Preventivi ELIP - app-supabase.js fixato
// ===============================

// ⚠️ ATTENZIONE ⚠️
// Assicurati che in config.js ci sia un URL Supabase corretto, es:
// window.supabaseConfig = {
//   url: 'https://xxxxx.supabase.co',
//   anon: '....',
//   bucket: 'preventivi-img'
// };

if (!window.__elipSupa) {
  const { createClient } = window.supabase;
  window.__elipSupa = createClient(
    window.supabaseConfig.url,
    window.supabaseConfig.anon
  );
}
const supa = window.__elipSupa;

// Funzione base per salvataggio preventivo
async function saveToSupabase(data) {
  const { data: insertData, error } = await supa
    .from('preventivi')
    .upsert(data)
    .select();
  if (error) console.error('[Supabase] Errore salvataggio:', error);
  else console.log('[Supabase] Salvato', insertData);
}

// Funzione base per caricamento preventivi
async function loadPreventivi() {
  const { data, error } = await supa
    .from('preventivi')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) console.error('[Supabase] Errore caricamento:', error);
  else console.log('[Supabase] Caricati', data);
  return data;
}

} // fine protezione
