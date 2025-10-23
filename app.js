console.log('app.js ready');
(function(){'use strict';
const $=s=>document.querySelector(s);
let photosQueue=[];
const imgInput=$('#imgInput'), imgPreview=$('#imgPreview');
if(imgInput){imgInput.addEventListener('change',e=>{const files=Array.from(e.target.files||[]);photosQueue=files; if(imgPreview){imgPreview.innerHTML=''; files.slice(0,8).forEach(f=>{const url=URL.createObjectURL(f); const im=new Image(); im.src=url; im.className='thumb'; im.onload=()=>URL.revokeObjectURL(url); imgPreview.appendChild(im);});}});}
$('#btnSave')?.addEventListener('click',async()=>{try{let id='temp-'+Date.now(); for(const f of photosQueue){await window.dbApi.uploadPhoto(f,id);} if(imgPreview) imgPreview.innerHTML=''; if(imgInput) imgInput.value=''; new bootstrap.Toast(document.getElementById('toastSave')).show(); }catch(e){alert('Errore: '+(e.message||e));}});
})();