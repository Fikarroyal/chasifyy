import {remove,removeAll} from '../database/db.js';
import {formSheet,confirmDialog,actionSheet,toast,esc} from '../components/ui.js';
import {donut,barChart} from '../components/charts.js';
import {rupiah,rupiahC,todayStr,fmtDate,numFmt} from '../utils/format.js';
import * as fin from './finance.js';
export {loadFor} from './finance.js';
const icons=()=>window.lucide?.createIcons();
const catMap=d=>Object.fromEntries(d.categories.map(c=>[c.id,c])),walMap=d=>Object.fromEntries(d.wallets.map(w=>[w.id,w]));
const sortTx=(a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt;
const dot=c=>`<span class="dot" style="background:${esc(c?.color||'#64748B')}"><i data-lucide="${esc(c?.icon||'circle-ellipsis')}"></i></span>`;
const ib=(a,id,l,i)=>`<button class="btn icon-btn ghost" ${a}="${id}" aria-label="${l}"><i data-lucide="${i}"></i></button>`;
const txRow=(t,cm,wm,act)=>{const c=cm[t.categoryId],inc=t.type==='income',body=`${dot(c)}<div class="grow"><b>${esc(c?.name||'Tanpa kategori')}</b><small>${fmtDate(t.date)}, ${esc(wm[t.walletId]?.name||'Tanpa dompet')}${t.note?', '+esc(t.note):''}</small></div><span class="amt ${inc?'in':''}">${inc?'+':''}${rupiah(t.amount)}</span>`;return `<li class="item">${act?`<button class="rowbtn" data-open="${t.id}" aria-label="Detail transaksi ${esc(c?.name||'')}">${body}</button>`:body}</li>`};
const addBtns='<div class="row"><button class="btn" data-add="income"><i data-lucide="plus"></i>Pemasukan</button><button class="btn primary" data-add="expense"><i data-lucide="plus"></i>Pengeluaran</button></div>';
const fab='<button class="fab" data-add="expense" aria-label="Tambah pengeluaran"><i data-lucide="plus"></i></button>';
const del=async(store,id,refresh)=>{try{await remove(store,id);toast('Dihapus.','success');refresh()}catch{toast('Gagal menghapus.','error')}};
const saved=ok=>ok&&toast('Tersimpan.','success');

async function txForm(ctx,type,old,pre){const{d,user,refresh}=ctx;
const ok=await formSheet({title:(old?'Ubah ':'Tambah ')+(type==='income'?'pemasukan':'pengeluaran'),fields:[
{id:'amount',label:'Nominal (Rp)',money:1,value:old?numFmt(old.amount):''},
{id:'categoryId',label:'Kategori',options:d.categories.filter(c=>c.type===type).map(c=>[c.id,c.name]),value:old?.categoryId},
{id:'walletId',label:'Dompet',options:d.wallets.map(w=>[w.id,w.name]),value:old?.walletId},
{id:'date',label:'Tanggal',type:'date',value:old?.date||pre||todayStr()},
{id:'note',label:'Catatan (opsional)',value:old?.note||''}],onSubmit:v=>fin.saveTx(user.id,type,v,d,old)});
if(ok){saved(ok);refresh()}}
const bindAdd=ctx=>document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>txForm(ctx,b.dataset.add));

function dashboard(u,d){const ym=todayStr().slice(0,7),s=fin.summary(d,ym),cm=catMap(d),wm=walMap(d);
const sv=d.savingsContributions.reduce((a,c)=>a+c.amount,0),total=Object.values(fin.balances(d)).reduce((a,b)=>a+b,0)+sv,net=s.income-s.expense;
const bl=d.budgets.filter(b=>b.month===ym),bt=bl.reduce((a,b)=>a+b.limit,0),bs=bl.reduce((a,b)=>a+fin.spent(d,ym,b.categoryId),0);
const al=bl.map(b=>({b,p:Math.round(fin.spent(d,ym,b.categoryId)/b.limit*100)})).filter(x=>x.p>=75);
const td=todayStr(),lim=new Date(Date.now()+3*864e5).toISOString().slice(0,10),rm=d.reminders.filter(r=>!r.paid&&r.due<=lim).sort((a,b)=>a.due.localeCompare(b.due)),rmCard=rm.length?`<div class="card"><div class="head"><h2>Pengingat tagihan</h2><a href="#/reminders">Lihat</a></div><ul class="list">${rm.slice(0,3).map(r=>`<li class="item"><div class="grow"><b>${esc(r.title)}</b><small>${r.due<td?'Terlambat':'Jatuh tempo'}, ${fmtDate(r.due)}</small></div><span class="amt">${rupiah(r.amount)}</span></li>`).join('')}</ul></div>`:'';
const st=[['Pemasukan',s.income,'trending-up'],['Pengeluaran',s.expense,'trending-down'],['Sisa anggaran',bl.length?bt-bs:null,'chart-pie'],['Tabungan',sv,'coins']];
const cats=Object.entries(s.byCat).sort((a,b)=>b[1]-a[1]).slice(0,5),recent=[...d.transactions].sort(sortTx).slice(0,5);
return `<section class="view-enter"><div class="head"><div><h1>Halo, ${esc(u.name.split(' ')[0])}</h1><p class="sub">Ringkasan bulan ini</p></div>${addBtns}</div>
<div class="hero"><small>Saldo bersih</small><b data-n="${total}">${rupiahC(total)}</b><small>${net>=0?'Surplus':'Defisit'} bulan ini ${rupiah(Math.abs(net))}</small></div>
<div class="stats">${st.map(([l,v,i])=>`<div class="stat"><small><i data-lucide="${i}"></i>${l}</small><b ${v===null?'':`data-n="${v}"`}>${v===null?'Belum diatur':rupiahC(v)}</b></div>`).join('')}</div>
<div class="grid2">${rmCard}${al.length?`<div class="card"><h2>Peringatan anggaran</h2><ul class="list">${al.map(({b,p})=>`<li class="item"><div class="grow"><b>${esc(cm[b.categoryId]?.name||'?')}</b><small>${p}% terpakai, ${lvl(p)[0]}</small></div></li>`).join('')}</ul></div>`:''}
${recent.length?`<div class="card"><h2>Pengeluaran per kategori</h2>${s.expense?donut(catItems(d,s),s.expense):'<p class="sub">Belum ada pengeluaran bulan ini.</p>'}</div><div class="card"><h2>Arus kas 6 bulan terakhir</h2>${barChart(fin.monthSeries(d,ym))}</div>
<div class="card wide"><div class="head"><h2>Transaksi terbaru</h2><a href="#/transactions">Lihat semua</a></div><ul class="list">${recent.map(t=>txRow(t,cm,wm)).join('')}</ul></div>`
:'<div class="card empty"><i data-lucide="inbox"></i><h2>Belum ada transaksi</h2><p>Catat pemasukan atau pengeluaran pertama Anda. Semua angka dihitung dari transaksi yang dicatat.</p></div>'}</div>${fab}</section>`}

const flt={q:'',type:'all',limit:30,from:'',to:'',cat:'all',sort:'date'};
function listHtml(d){const cm=catMap(d),wm=walMap(d),q=flt.q.toLowerCase(),SORT={date:sortTx,old:(a,b)=>sortTx(b,a),big:(a,b)=>b.amount-a.amount,small:(a,b)=>a.amount-b.amount,cat:(a,b)=>(cm[a.categoryId]?.name||'').localeCompare(cm[b.categoryId]?.name||'')};
const rows=d.transactions.filter(t=>(flt.type==='all'||t.type===flt.type)&&(!q||`${cm[t.categoryId]?.name} ${t.note} ${wm[t.walletId]?.name}`.toLowerCase().includes(q))&&(!flt.from||t.date>=flt.from)&&(!flt.to||t.date<=flt.to)&&(flt.cat==='all'||t.categoryId===flt.cat)).sort(SORT[flt.sort]||sortTx);
if(!rows.length)return `<div class="empty"><i data-lucide="inbox"></i><h2>${d.transactions.length?'Tidak ada hasil':'Belum ada transaksi'}</h2><p>${d.transactions.length?'Ubah kata kunci atau filter.':'Mulai dengan menambah pemasukan atau pengeluaran.'}</p></div>`;
return `<ul class="list">${rows.slice(0,flt.limit).map(t=>txRow(t,cm,wm,1)).join('')}</ul>${rows.length>flt.limit?'<button id="more" class="btn" style="width:100%">Muat lebih banyak</button>':''}`}
const transactions=(u,d)=>`<section class="view-enter"><div class="head"><h1>Transaksi</h1>${addBtns}</div><div class="toolbar"><input type="search" id="q" placeholder="Cari transaksi" aria-label="Cari transaksi" value="${esc(flt.q)}"><select id="ftype" aria-label="Jenis transaksi">${[['all','Semua'],['income','Pemasukan'],['expense','Pengeluaran']].map(([v,l])=>`<option value="${v}" ${v===flt.type?'selected':''}>${l}</option>`).join('')}</select></div><div class="toolbar f2"><select id="fcat" aria-label="Kategori"><option value="all">Semua kategori</option>${d.categories.map(c=>`<option value="${c.id}" ${c.id===flt.cat?'selected':''}>${esc(c.name)}</option>`).join('')}</select><input type="date" id="ffrom" aria-label="Dari tanggal" value="${flt.from}"><input type="date" id="fto" aria-label="Sampai tanggal" value="${flt.to}"><select id="fsort" aria-label="Urutkan">${[['date','Terbaru'],['old','Terlama'],['big','Nominal terbesar'],['small','Nominal terkecil'],['cat','Nama kategori']].map(([v,l])=>`<option value="${v}" ${v===flt.sort?'selected':''}>${l}</option>`).join('')}</select></div><div class="card" id="txlist">${listHtml(d)}</div>${fab}</section>`;
function bindTx(ctx){bindAdd(ctx);const{d}=ctx,list=document.getElementById('txlist'),paint=()=>{list.innerHTML=listHtml(d);icons()};
document.getElementById('q').oninput=e=>{flt.q=e.target.value;flt.limit=30;paint()};
document.getElementById('ftype').onchange=e=>{flt.type=e.target.value;flt.limit=30;paint()};
[['fcat','cat'],['ffrom','from'],['fto','to'],['fsort','sort']].forEach(([i,k])=>document.getElementById(i).onchange=e=>{flt[k]=e.target.value;flt.limit=30;paint()});
list.onclick=async e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='more'){flt.limit+=30;return paint()}
const t=d.transactions.find(x=>x.id===b.dataset.open);if(!t)return;const cm=catMap(d),wm=walMap(d);
const a=await actionSheet({title:esc(cm[t.categoryId]?.name||'Transaksi'),body:`${t.type==='income'?'Pemasukan':'Pengeluaran'} ${rupiah(t.amount)}<br>${fmtDate(t.date)}, ${esc(wm[t.walletId]?.name||'Tanpa dompet')}${t.note?'<br>'+esc(t.note):''}`,actions:[['edit','Ubah','primary'],['del','Hapus','danger'],['','Tutup','ghost']]});
if(a==='edit')return txForm(ctx,t.type,t);
if(a==='del'&&await confirmDialog({title:'Hapus transaksi?',body:'Saldo dan ringkasan akan diperbarui.'}))del('transactions',t.id,ctx.refresh)}}

const KINDS=[['cash','Tunai'],['bank','Rekening bank'],['ewallet','E-wallet'],['savings','Tabungan']];
function wallets(u,d){const bal=fin.balances(d),wm=walMap(d),tr=[...d.transfers].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt).slice(0,10);
return `<section class="view-enter"><div class="head"><h1>Dompet</h1><div class="row"><button class="btn" id="xfer" ${d.wallets.length<2?'disabled':''}><i data-lucide="arrow-left-right"></i>Transfer</button><button class="btn primary" id="addW"><i data-lucide="plus"></i>Dompet</button></div></div>
<div class="card"><ul class="list">${d.wallets.map(w=>`<li class="item"><span class="dot" style="background:var(--primary)"><i data-lucide="landmark"></i></span><div class="grow"><b>${esc(w.name)}</b><small>${KINDS.find(k=>k[0]===w.kind)?.[1]||''}</small></div><span class="amt">${rupiah(bal[w.id])}</span>${ib('data-ew',w.id,'Ubah dompet','pencil')}${ib('data-dw',w.id,'Hapus dompet','trash-2')}</li>`).join('')}</ul></div>
${tr.length?`<div class="card"><h2>Riwayat transfer</h2><ul class="list">${tr.map(t=>`<li class="item"><div class="grow"><b>${esc(wm[t.fromId]?.name||'?')} → ${esc(wm[t.toId]?.name||'?')}</b><small>${fmtDate(t.date)}${t.note?', '+esc(t.note):''}</small></div><span class="amt">${rupiah(t.amount)}</span>${ib('data-dt',t.id,'Hapus transfer','trash-2')}</li>`).join('')}</ul><p class="note">Transfer tidak dihitung sebagai pemasukan atau pengeluaran.</p></div>`:''}</section>`}
async function walletForm(ctx,old){const{user,refresh}=ctx;const ok=await formSheet({title:old?'Ubah dompet':'Tambah dompet',fields:[{id:'name',label:'Nama dompet',value:old?.name||''},{id:'kind',label:'Jenis',options:KINDS,value:old?.kind||'cash'},{id:'initial',label:'Saldo awal (Rp)',money:1,value:old?numFmt(old.initial):''}],onSubmit:v=>fin.saveWallet(user.id,v,old)});if(ok){saved(ok);refresh()}}
async function transferForm(ctx){const{d,user,refresh}=ctx,o=d.wallets.map(w=>[w.id,w.name]);
const ok=await formSheet({title:'Transfer antardompet',submitText:'Transfer',fields:[{id:'fromId',label:'Dari',options:o,value:o[0][0]},{id:'toId',label:'Ke',options:o,value:o[1][0]},{id:'amount',label:'Nominal (Rp)',money:1},{id:'date',label:'Tanggal',type:'date',value:todayStr()},{id:'note',label:'Catatan (opsional)'}],onSubmit:v=>fin.saveTransfer(user.id,v,d)});if(ok){saved(ok);refresh()}}
function bindW(ctx){const{d,refresh}=ctx;document.getElementById('addW').onclick=()=>walletForm(ctx);document.getElementById('xfer').onclick=()=>transferForm(ctx);
document.getElementById('view').onclick=async e=>{const b=e.target.closest('[data-ew],[data-dw],[data-dt]');if(!b)return;
if(b.dataset.ew)return walletForm(ctx,d.wallets.find(w=>w.id===b.dataset.ew));
if(b.dataset.dt){if(await confirmDialog({title:'Hapus transfer?',body:'Saldo kedua dompet akan dikembalikan.'}))del('transfers',b.dataset.dt,refresh);return}
const id=b.dataset.dw,n=fin.walletUse(d,id);if(d.wallets.length<2)return toast('Minimal satu dompet diperlukan.','error');
if(n)return toast(`Dompet masih dipakai ${n} transaksi/transfer. Hapus atau pindahkan dulu.`,'error');
if(await confirmDialog({title:'Hapus dompet?',body:'Dompet ini akan dihapus permanen.'}))del('wallets',id,refresh)}}

const ICONS=[['utensils','Makan'],['car','Transportasi'],['shopping-bag','Belanja'],['receipt','Tagihan'],['film','Hiburan'],['heart-pulse','Kesehatan'],['banknote','Uang'],['gift','Hadiah'],['home','Rumah'],['graduation-cap','Pendidikan'],['plane','Perjalanan'],['circle-ellipsis','Lainnya']];
const COLORS=[['#2563EB','Biru'],['#10B981','Hijau'],['#7C3AED','Ungu'],['#E11D48','Merah muda'],['#EA580C','Oranye'],['#0D9488','Teal'],['#64748B','Abu-abu']];
function categories(u,d){const sec=(type,t)=>`<div class="card"><div class="head"><h2>${t}</h2><button class="btn" data-addc="${type}"><i data-lucide="plus"></i>Tambah</button></div><ul class="list">${d.categories.filter(c=>c.type===type).map(c=>`<li class="item">${dot(c)}<div class="grow"><b>${esc(c.name)}</b><small>${fin.catUse(d,c.id)} transaksi</small></div>${ib('data-ec',c.id,'Ubah kategori','pencil')}${ib('data-dc',c.id,'Hapus kategori','trash-2')}</li>`).join('')}</ul></div>`;
return `<section class="view-enter"><h1>Kategori</h1>${sec('income','Pemasukan')}${sec('expense','Pengeluaran')}</section>`}
async function catForm(ctx,type,old){const ok=await formSheet({title:old?'Ubah kategori':'Tambah kategori',fields:[{id:'name',label:'Nama kategori',value:old?.name||''},{id:'icon',label:'Ikon',options:ICONS,value:old?.icon||'circle-ellipsis'},{id:'color',label:'Warna',options:COLORS,value:old?.color||'#2563EB'}],onSubmit:v=>fin.saveCategory(ctx.user.id,type,v,ctx.d,old)});if(ok){saved(ok);ctx.refresh()}}
function bindC(ctx){const{d,refresh}=ctx;document.getElementById('view').onclick=async e=>{const b=e.target.closest('[data-addc],[data-ec],[data-dc]');if(!b)return;
if(b.dataset.addc)return catForm(ctx,b.dataset.addc);
const c=d.categories.find(x=>x.id===(b.dataset.ec||b.dataset.dc));if(!c)return;if(b.dataset.ec)return catForm(ctx,c.type,c);
const n=fin.catUse(d,c.id);if(n)return toast(`Kategori masih dipakai ${n} transaksi. Ubah atau hapus transaksinya dulu.`,'error');
if(await confirmDialog({title:'Hapus kategori?',body:`Kategori "${esc(c.name)}" akan dihapus.`}))del('categories',c.id,refresh)}}

let bm=todayStr().slice(0,7);
const shiftM=(ym,n)=>{const[y,m]=ym.split('-').map(Number),x=new Date(y,m-1+n,1);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')};
const monthLbl=ym=>new Date(ym+'-01T00:00:00').toLocaleDateString('id-ID',{month:'long',year:'numeric'});
const lvl=p=>p>=100?['Melebihi anggaran','var(--danger)']:p>=90?['Hampir habis (90%+)','var(--danger)']:p>=75?['Waspada (75%+)','var(--warn)']:['Aman','var(--ok)'];
function budgets(u,d){const list=d.budgets.filter(b=>b.month===bm),cm=catMap(d),tl=list.reduce((a,b)=>a+b.limit,0),ts=list.reduce((a,b)=>a+fin.spent(d,bm,b.categoryId),0);
return `<section class="view-enter"><div class="head"><h1>Anggaran</h1><button class="btn primary" id="addB"><i data-lucide="plus"></i>Anggaran</button></div>
<div class="monthnav"><button class="btn icon-btn ghost" id="pm" aria-label="Bulan sebelumnya"><i data-lucide="chevron-left"></i></button><b>${monthLbl(bm)}</b><button class="btn icon-btn ghost" id="nm" aria-label="Bulan berikutnya"><i data-lucide="chevron-right"></i></button></div>
${list.length?`<div class="card"><div class="split3"><div><small>Terpakai</small><b>${rupiahC(ts)}</b></div><div><small>Batas</small><b>${rupiahC(tl)}</b></div><div><small>Sisa</small><b>${rupiahC(tl-ts)}</b></div></div><div class="bar"><i style="width:${Math.min(100,Math.round(ts/tl*100))}%;background:${lvl(Math.round(ts/tl*100))[1]}"></i></div></div><div class="card"><ul class="list">${list.map(b=>{const s=fin.spent(d,bm,b.categoryId),p=Math.round(s/b.limit*100),[t,col]=lvl(p);
return `<li class="item" style="flex-wrap:wrap">${dot(cm[b.categoryId])}<div class="grow"><b>${esc(cm[b.categoryId]?.name||'?')}</b><small>${rupiah(s)} dari ${rupiah(b.limit)}</small></div>${ib('data-eb',b.id,'Ubah anggaran','pencil')}${ib('data-db',b.id,'Hapus anggaran','trash-2')}<div style="flex-basis:100%"><div class="bar"><i style="width:${Math.min(p,100)}%;background:${col}"></i></div><small class="note">${p}%, ${t}</small></div></li>`}).join('')}</ul></div>`
:'<div class="card empty"><i data-lucide="chart-pie"></i><h2>Belum ada anggaran bulan ini</h2><p>Tetapkan batas pengeluaran per kategori untuk memantau sisa anggaran.</p></div>'}</section>`}
async function budgetForm(ctx,old){const{d,user,refresh}=ctx,used=new Set(d.budgets.filter(b=>b.month===bm&&b.id!==old?.id).map(b=>b.categoryId)),opts=d.categories.filter(c=>c.type==='expense'&&!used.has(c.id)).map(c=>[c.id,c.name]);
if(!opts.length)return toast('Semua kategori pengeluaran sudah punya anggaran bulan ini.','error');
const ok=await formSheet({title:(old?'Ubah':'Tambah')+' anggaran, '+monthLbl(bm),fields:[{id:'categoryId',label:'Kategori',options:opts,value:old?.categoryId},{id:'limit',label:'Batas anggaran (Rp)',money:1,value:old?numFmt(old.limit):''}],onSubmit:v=>fin.saveBudget(user.id,v,d,bm,old)});if(ok){saved(ok);refresh()}}
function bindB(ctx){const{d,refresh}=ctx;document.getElementById('pm').onclick=()=>{bm=shiftM(bm,-1);refresh()};document.getElementById('nm').onclick=()=>{bm=shiftM(bm,1);refresh()};
document.getElementById('addB').onclick=()=>budgetForm(ctx);
document.getElementById('view').onclick=async e=>{const b=e.target.closest('[data-eb],[data-db]');if(!b)return;const x=d.budgets.find(y=>y.id===(b.dataset.eb||b.dataset.db));if(!x)return;
if(b.dataset.eb)return budgetForm(ctx,x);if(await confirmDialog({title:'Hapus anggaran?',body:'Transaksi tidak ikut terhapus.'}))del('budgets',x.id,refresh)}}

const GS={done:'Tercapai',late:'Lewat tenggat',active:'Aktif'};
function savings(u,d){const today=todayStr(),wm=walMap(d),gm=Object.fromEntries(d.savingsGoals.map(g=>[g.id,g])),hist=[...d.savingsContributions].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt).slice(0,10);
return `<section class="view-enter"><div class="head"><h1>Target Tabungan</h1><button class="btn primary" id="addG"><i data-lucide="plus"></i>Target</button></div>
${d.savingsGoals.length?`<div class="card"><ul class="list">${d.savingsGoals.map(g=>{const c=fin.collected(d,g.id),p=Math.min(100,Math.round(c/g.target*100)),st=fin.goalStatus(g,c,today);
return `<li class="item" style="flex-wrap:wrap"><span class="dot" style="background:var(--primary);color:var(--on-primary)"><i data-lucide="target"></i></span><div class="grow"><b>${esc(g.name)}</b><small>${rupiah(c)} dari ${rupiah(g.target)}${g.deadline?', tenggat '+fmtDate(g.deadline):''}</small></div>${ib('data-eg',g.id,'Ubah target','pencil')}${ib('data-dg',g.id,'Hapus target','trash-2')}<div style="flex-basis:100%"><div class="bar"><i style="width:${p}%"></i></div><div class="head" style="margin-top:.4rem"><small class="note">${p}%, ${GS[st]}</small><button class="btn" data-cg="${g.id}" style="min-height:40px;padding:0 .8rem"><i data-lucide="plus"></i>Setor</button></div></div></li>`}).join('')}</ul><p class="note">Setoran memindahkan saldo dompet ke target, bukan pengeluaran.</p></div>`
:'<div class="card empty"><i data-lucide="target"></i><h2>Belum ada target</h2><p>Buat target tabungan lalu setor dari dompet Anda.</p></div>'}
${hist.length?`<div class="card"><h2>Riwayat setoran</h2><ul class="list">${hist.map(c=>`<li class="item"><div class="grow"><b>${esc(gm[c.goalId]?.name||'?')}</b><small>${fmtDate(c.date)}, ${esc(wm[c.walletId]?.name||'Tanpa dompet')}</small></div><span class="amt">${rupiah(c.amount)}</span>${ib('data-dc2',c.id,'Hapus setoran','trash-2')}</li>`).join('')}</ul></div>`:''}</section>`}
async function goalForm(ctx,old){const ok=await formSheet({title:old?'Ubah target':'Tambah target',fields:[{id:'name',label:'Nama target',value:old?.name||''},{id:'target',label:'Nominal target (Rp)',money:1,value:old?numFmt(old.target):''},{id:'deadline',label:'Tenggat (opsional)',type:'date',value:old?.deadline||''}],onSubmit:v=>fin.saveGoal(ctx.user.id,v,old)});if(ok){saved(ok);ctx.refresh()}}
async function contribForm(ctx,g){const{d}=ctx,ok=await formSheet({title:'Setor ke '+esc(g.name),submitText:'Setor',fields:[{id:'amount',label:'Nominal (Rp)',money:1},{id:'walletId',label:'Dari dompet',options:d.wallets.map(w=>[w.id,w.name])},{id:'date',label:'Tanggal',type:'date',value:todayStr()}],onSubmit:v=>fin.saveContribution(ctx.user.id,v,d,g.id)});if(ok){saved(ok);ctx.refresh()}}
function bindS(ctx){const{d,refresh}=ctx;document.getElementById('addG').onclick=()=>goalForm(ctx);
document.getElementById('view').onclick=async e=>{const b=e.target.closest('[data-eg],[data-dg],[data-cg],[data-dc2]');if(!b)return;
if(b.dataset.dc2){if(await confirmDialog({title:'Hapus setoran?',body:'Saldo dompet akan dikembalikan.'}))del('savingsContributions',b.dataset.dc2,refresh);return}
const g=d.savingsGoals.find(x=>x.id===(b.dataset.eg||b.dataset.dg||b.dataset.cg));if(!g)return;
if(b.dataset.eg)return goalForm(ctx,g);if(b.dataset.cg)return contribForm(ctx,g);
if(await confirmDialog({title:'Hapus target?',body:'Semua setoran target ini ikut dihapus dan saldo dikembalikan ke dompet.'})){try{await removeAll([...d.savingsContributions.filter(c=>c.goalId===g.id).map(c=>['savingsContributions',c.id]),['savingsGoals',g.id]]);toast('Dihapus.','success');refresh()}catch{toast('Gagal menghapus.','error')}}}}

export const VIEWS={budgets:{view:budgets,bind:bindB},savings:{view:savings,bind:bindS},dashboard:{view:dashboard,bind:bindAdd},transactions:{view:transactions,bind:bindTx},wallets:{view:wallets,bind:bindW},categories:{view:categories,bind:bindC}};
export {catMap,walMap,dot,ib,del,saved,sortTx,txForm,txRow};
const catItems=(d,s)=>{const cm=catMap(d),a=Object.entries(s.byCat).sort((x,y)=>y[1]-x[1]).map(([i,v])=>({label:cm[i]?.name||'Tanpa kategori',value:v,color:cm[i]?.color||'#64748B'}));return a.length>6?[...a.slice(0,5),{label:'Lainnya',value:a.slice(5).reduce((t,x)=>t+x.value,0),color:'#94A3B8'}]:a};
export {catItems};
