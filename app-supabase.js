
// app-supabase.js — v4.0
(() => {
  'use strict';
  const supabaseUrl = window.SUPABASE_URL;
  const supabaseKey = window.SUPABASE_KEY;
  if (!supabaseUrl || !supabaseKey) { console.warn('Supabase config mancante'); return; }
  const { createClient } = window.supabase;
  const sb = createClient(supabaseUrl, supabaseKey);
  window.supabase = sb;

  function EURO(n){ try{ return (n||0).toLocaleString('it-IT',{style:'currency',currency:'EUR'});}catch(e){return String(n||0);} }

  function computeProgress(lines){
    let toDo=0,done=0;
    (lines||[]).forEach(r=>{
      const has=(r.desc||'').trim()!=='' || (+r.qty||0)>0 || (+r.price||0)>0;
      if(has){ toDo++; if(r.doneDate && String(r.doneDate).trim()) done++; }
    });
    return toDo ? Math.round((done/toDo)*100) : 0;
  }

  function serializeCurrent(){
    let cur=null;
    try{ cur = JSON.parse(localStorage.getItem('elip_current')||'null'); }catch(_){ cur=null; }
    if(!cur) return null;
    const imponibile = (cur.lines||[]).reduce((s,r)=>s+(+r.qty||0)*(+r.price||0),0);
    const totale = imponibile*1.22;
    const progress = computeProgress(cur.lines||[]);

    return {
      // numero: NON lo mandiamo all'insert per lasciare fare al trigger
      cliente: cur.cliente||null,
      articolo: cur.articolo||null,
      ddt: cur.ddt||null,
      telefono: cur.telefono||null,
      email: cur.email||null,
      data_invio: cur.dataInvio||null,
      data_accettazione: cur.dataAcc||null,
      data_scadenza: cur.dataScad||null,
      note: cur.note||null,
      linee: cur.lines||[],
      images: cur.images||[],
      totale,
      avanzamento_commessa: progress, // se esiste la colonna
    };
  }

  async function saveToSupabase(forceInsert=false){
    const rec = serializeCurrent();
    if(!rec){ throw new Error('Nessun record da salvare'); }

    // Se il current ha già un numero ELP-..., aggiorniamo; altrimenti inseriamo
    let current = null;
    try{ current = JSON.parse(localStorage.getItem('elip_current')||'null'); }catch(_){}
    const hasNumero = current && current.id && /^ELP-/.test(current.id);

    if(hasNumero){
      const { data, error } = await sb
        .from('preventivi')
        .update(rec)
        .eq('numero', current.id)
        .select()
        .single();
      if(error) throw error;
      return { data };
    }else{
      const { data, error } = await sb
        .from('preventivi')
        .insert(rec)
        .select()
        .single();
      if(error) throw error;
      return { data };
    }
  }

  async function loadArchiveSupabase(){
    const { data, error } = await sb
      .from('preventivi')
      .select('numero, created_at, cliente, articolo, ddt, totale, data_accettazione, data_scadenza, avanzamento_commessa, is_chiusa')
      .order('created_at',{ascending:false});
    if(error){ console.warn(error); return []; }
    return data || [];
  }

  window.saveToSupabase = saveToSupabase;
  window.loadArchiveSupabase = loadArchiveSupabase;
})();
