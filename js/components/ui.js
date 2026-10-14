export function toast(msg,type='info'){const t=document.createElement('div');t.className='toast '+type;t.textContent=msg;document.getElementById('toasts').append(t);setTimeout(()=>t.remove(),4000)}
export function confirmDialog({title,body,confirmText='Hapus',danger=true}){return new Promise(res=>{
const prev=document.activeElement,d=document.createElement('dialog');d.className='sheet';d.setAttribute('aria-labelledby','dlg-t');
d.innerHTML=`<form method="dialog"><h2 id="dlg-t">${title}</h2><p>${body}</p><div class="row"><button class="btn ghost" value="no">Batal</button><button class="btn ${danger?'danger':'primary'}" value="yes">${confirmText}</button></div></form>`;
d.addEventListener('click',e=>{if(e.target===d)d.close('no')});
d.addEventListener('close',()=>{res(d.returnValue==='yes');d.remove();prev?.focus?.()});
document.body.append(d);d.showModal()})}
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function formSheet({title,fields,submitText='Simpan',onSubmit}){return new Promise(res=>{
const prev=document.activeElement,d=document.createElement('dialog');d.className='sheet';d.setAttribute('aria-labelledby','dlg-t');
const fld=x=>{const i='f-'+x.id,v=x.value??'';const inp=x.options?`<select id="${i}" name="${x.id}">${x.options.map(([o,l])=>`<option value="${esc(o)}" ${o===v?'selected':''}>${esc(l)}</option>`).join('')}</select>`:`<input id="${i}" name="${x.id}" type="${x.type||'text'}" value="${esc(v)}" ${x.money?'inputmode="numeric" data-money':''} autocomplete="off">`;
return `<div class="field"><label for="${i}">${x.label}</label>${inp}<p class="err" id="${x.id}-err" role="alert"></p></div>`};
d.innerHTML=`<form novalidate><h2 id="dlg-t">${title}</h2>${fields.map(fld).join('')}<p class="err" id="_-err" role="alert"></p><div class="row"><button type="button" class="btn ghost" data-x>Batal</button><button type="submit" class="btn primary">${submitText}</button></div></form>`;
const f=d.firstChild;
d.querySelectorAll('[data-money]').forEach(i=>i.addEventListener('input',()=>{const n=i.value.replace(/\D/g,'');i.value=n?new Intl.NumberFormat('id-ID').format(+n):''}));
d.querySelector('[data-x]').onclick=()=>d.close('no');
d.addEventListener('click',e=>{if(e.target===d)d.close('no')});
f.addEventListener('submit',async e=>{e.preventDefault();const b=f.querySelector('[type=submit]');b.disabled=true;b.classList.add('loading');let er;
try{er=await onSubmit(Object.fromEntries(new FormData(f)))}catch{er={_:'Penyimpanan gagal. Coba lagi.'}}
b.disabled=false;b.classList.remove('loading');f.querySelectorAll('.err').forEach(p=>p.textContent='');
if(er&&Object.keys(er).length){for(const[k,m]of Object.entries(er)){const p=f.querySelector('#'+k+'-err');if(p)p.textContent=m}f.querySelector('.err:not(:empty)')?.previousElementSibling?.focus?.()}else d.close('ok')});
d.addEventListener('close',()=>{res(d.returnValue==='ok');d.remove();prev?.focus?.()});
document.body.append(d);d.showModal();f.querySelector('input,select')?.focus()})}
export function actionSheet({title,body,actions}){return new Promise(res=>{const prev=document.activeElement,d=document.createElement('dialog');d.className='sheet';d.setAttribute('aria-labelledby','dlg-t');
d.innerHTML=`<form method="dialog"><h2 id="dlg-t">${title}</h2><p>${body}</p><div class="stack">${actions.map(([v,l,c])=>`<button class="btn ${c||''}" value="${v}">${l}</button>`).join('')}</div></form>`;
d.addEventListener('click',e=>{if(e.target===d)d.close('')});d.addEventListener('close',()=>{res(d.returnValue);d.remove();prev?.focus?.()});document.body.append(d);d.showModal()})}
