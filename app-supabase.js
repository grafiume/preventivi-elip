console.log('app-supabase ready');
(function(){'use strict';
if(!window.SUPABASE_URL||!window.SUPABASE_ANON_KEY){console.warn('[supabase] Missing config.js values');}
const getClient=(()=>{let c=null;return()=>{if(c) return c; c=window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY,{auth:{persistSession:false}}); return c;};})();
async function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function withRetry(fn,tries=5,base=300){let last; for(let i=0;i<tries;i++){try{return await fn();}catch(e){last=e; const code=Number(e?.status||e?.code||0); if(code===429||code>=500){await sleep(base*Math.pow(2,i)); continue;} break;}} throw last;}
async function uploadPhoto(file, recordId){const supa=getClient(); const ext=(file.name.split('.').pop()||'jpg').toLowerCase(); const name=`${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`; const path=`${recordId}/${name}`; await withRetry(async()=>{const {error}=await supa.storage.from('photos').upload(path,file,{cacheControl:'3600',upsert:false}); if(error) throw error;}); const {data:pub}=supa.storage.from('photos').getPublicUrl(path); const url=pub?.publicUrl||null; try{await supa.from('photos').insert([{record_id:recordId,path,url}]);}catch(_){} return {path,url};}
window.dbApi={uploadPhoto};
})();