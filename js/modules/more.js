import {put,get,all,batch} from '../database/db.js';
import {formSheet,confirmDialog,toast,esc} from '../components/ui.js';
import {rupiah,rupiahC,todayStr,fmtDate,numFmt,validDate} from '../utils/format.js';
import {donut,barChart,lineChart} from '../components/charts.js';
import * as fin from './finance.js';
import {catMap,walMap,dot,ib,del,saved,sortTx,txForm,txRow,catItems} from './pages.js';
const $=i=>document.getElementById(i),V=()=>$('view'),bad=o=>Object.keys(o).length>0;
const D=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(Date.UTC(y,m-1,d))},S=x=>x.toISOString().slice(0,10),add=(s,n)=>S(new Date(D(s).getTime()+n*864e5));
const opt=(a,v)=>a.map(([x,l])=>`<option value="${esc(x)}" ${x===v?'selected':''}>${esc(l)}</option>`).join('');
const mlbl=ym=>new Date(ym+'-01T00:00:00Z').toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'UTC'});
const shiftM=(ym,n)=>{const[y,m]=ym.split('-').map(Number),x=new Date(Date.UTC(y,m-1+n,1));return x.getUTCFullYear()+'-'+String(x.getUTCMonth()+1).padStart(2,'0')};
const acts=m=>{V().onclick=e=>{const b=e.target.closest('button');if(!b)return;for(const k in m)if(b.dataset[k]!==undefined)return m[k](b.dataset[k],b)}};
const askDel=(t,b,fn)=>confirmDialog({title:t,body:b}).then(y=>y&&fn());
const monthnav=m=>`<div class="monthnav"><button class="btn icon-btn ghost" id="pm" aria-label="Bulan sebelumnya"><i data-lucide="chevron-left"></i></button><b>${mlbl(m)}</b><button class="btn icon-btn ghost" id="nm" aria-label="Bulan berikutnya"><i data-lucide="chevron-right"></i></button></div>`;
const empty=(i,t,p)=>`<div class="card empty"><i data-lucide="${i}"></i><h2>${t}</h2><p>${p}</p></div>`;
const save=async(ctx,p)=>{if(await p){saved(1);ctx.refresh()}};

/* ---- Laporan ---- */
const R={mode:'month',date:todayStr(),from:todayStr().slice(0,8)+'01',to:todayStr()};
const MODES=[['day','Harian'],['week','Mingguan'],['month','Bulanan'],['year','Tahunan'],['custom','Khusus']];
function range(sh){const d=D(R.date);
if(R.mode==='day')return[add(R.date,sh),add(R.date,sh)];
if(R.mode==='week'){const a=add(R.date,-((d.getUTCDay()+6)%7)+7*sh);return[a,add(a,6)]}
if(R.mode==='month'){const y=d.getUTCFullYear(),m=d.getUTCMonth()+sh;return[S(new Date(Date.UTC(y,m,1))),S(new Date(Date.UTC(y,m+1,0)))]}
if(R.mode==='year'){const y=d.getUTCFullYear()+sh;return[y+'-01-01',y+'-12-31']}
const n=Math.round((D(R.to)-D(R.from))/864e5)+1;return[add(R.from,n*sh),add(R.to,n*sh)]}
const tot=(d,[a,b])=>{const s={income:0,expense:0,by:{},list:[]};for(const t of d.transactions)if(t.date>=a&&t.date<=b){s[t.type]+=t.amount;s.list.push(t);if(t.type==='expense')s.by[t.categoryId]=(s.by[t.categoryId]||0)+t.amount}return s};
const pct=(c,p)=>p?`${c>=p?'Naik':'Turun'} ${Math.abs(Math.round((c-p)/p*100))}% dari periode lalu`:'Belum ada data periode lalu';
function reports(u,d){const cm=catMap(d),wm=walMap(d),inv=R.mode==='custom'&&(!validDate(R.from)||!validDate(R.to)||R.from>R.to);let body='<div class="card"><p class="err">Rentang tanggal tidak valid.</p></div>';
if(!inv){const g=range(0),c=tot(d,g),p=tot(d,range(-1)),by=Object.entries(c.by).sort((a,b)=>b[1]-a[1]),big=c.list.filter(t=>t.type==='expense').sort((a,b)=>b.amount-a.amount).slice(0,5);
body=`<p class="note" style="margin-top:.6rem">${fmtDate(g[0])} sampai ${fmtDate(g[1])}</p><div class="stats">${[['Pemasukan',rupiah(c.income),pct(c.income,p.income)],['Pengeluaran',rupiah(c.expense),pct(c.expense,p.expense)],['Selisih arus kas',rupiah(c.income-c.expense),'Periode lalu: '+rupiah(p.income-p.expense)],['Jumlah transaksi',c.list.length,'Periode lalu: '+p.list.length]].map(([l,v,s])=>`<div class="stat"><small>${l}</small><b>${v}</b><small>${s}</small></div>`).join('')}</div>
<div class="card"><h2>Pengeluaran per kategori</h2>${by.length?by.map(([i,v])=>`<div style="margin-bottom:.7rem"><div class="head"><span>${esc(cm[i]?.name||'Tanpa kategori')}</span><b>${rupiah(v)}</b></div><div class="bar"><i style="width:${Math.round(v/c.expense*100)}%"></i></div></div>`).join(''):'<p class="sub">Tidak ada pengeluaran pada periode ini.</p>'}</div>
<div class="card"><h2>Pengeluaran terbesar</h2>${big.length?`<ul class="list">${big.map(t=>txRow(t,cm,wm)).join('')}</ul>`:'<p class="sub">Belum ada data.</p>'}</div>`}
return `<section class="view-enter"><h1>Laporan</h1><div class="toolbar f2"><select id="rmode" aria-label="Periode">${opt(MODES,R.mode)}</select>${R.mode==='custom'?`<input type="date" id="rfrom" value="${R.from}" aria-label="Dari tanggal"><input type="date" id="rto" value="${R.to}" aria-label="Sampai tanggal">`:`<input type="date" id="rdate" value="${R.date}" aria-label="Tanggal acuan">`}</div>${body}</section>`}
function bindR(ctx){const set=(k,v)=>{R[k]=v;if(k==='date'&&!validDate(v))R.date=todayStr();ctx.refresh()};
$('rmode').onchange=e=>set('mode',e.target.value);[['rdate','date'],['rfrom','from'],['rto','to']].forEach(([i,k])=>{if($(i))$(i).onchange=e=>set(k,e.target.value)})}

/* ---- Kalender ---- */
const C={m:todayStr().slice(0,7),sel:todayStr(),cat:'all'};
function calendar(u,d){const[y,m]=C.m.split('-').map(Number),lead=(new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7,days=new Date(Date.UTC(y,m,0)).getUTCDate(),by={};
for(const t of d.transactions)if(t.date.startsWith(C.m)&&(C.cat==='all'||t.categoryId===C.cat))(by[t.date]??=[]).push(t);
const cells=[...Array(lead).fill('<span></span>'),...Array.from({length:days},(_,i)=>{const dt=C.m+'-'+String(i+1).padStart(2,'0'),a=by[dt]||[];
return `<button class="day ${dt===C.sel?'sel':''} ${dt===todayStr()?'today':''}" data-day="${dt}" aria-label="${fmtDate(dt)}, ${a.length} transaksi"><span>${i+1}</span><span class="dots">${a.some(t=>t.type==='income')?'<i class="dt in"></i>':''}${a.some(t=>t.type==='expense')?'<i class="dt out"></i>':''}</span></button>`})];
const s=by[C.sel]||[],sum=ty=>s.filter(t=>t.type===ty).reduce((a,t)=>a+t.amount,0),cm=catMap(d),wm=walMap(d);
return `<section class="view-enter"><h1>Kalender Keuangan</h1>${monthnav(C.m)}<div class="toolbar"><select id="ccat" aria-label="Kategori">${opt([['all','Semua kategori'],...d.categories.map(c=>[c.id,c.name])],C.cat)}</select></div>
<div class="card"><div class="cal">${['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(x=>`<small>${x}</small>`).join('')}${cells.join('')}</div><p class="note" style="margin-top:.6rem">Lingkaran: ada pemasukan, Kotak: ada pengeluaran</p></div>
<div class="card"><h2>${fmtDate(C.sel)}</h2><div class="split2"><div><small>Pemasukan</small><b>${rupiahC(sum('income'))}</b></div><div><small>Pengeluaran</small><b>${rupiahC(sum('expense'))}</b></div></div>${s.length?`<ul class="list">${s.map(t=>txRow(t,cm,wm)).join('')}</ul>`:'<p class="sub" style="margin-top:.5rem">Tidak ada transaksi.</p>'}<div class="row split"><button class="btn" data-cadd="income"><i data-lucide="plus"></i>Pemasukan</button><button class="btn primary" data-cadd="expense"><i data-lucide="plus"></i>Pengeluaran</button></div></div></section>`}
function bindCal(ctx){const mv=n=>{C.m=shiftM(C.m,n);C.sel=C.m+'-01';ctx.refresh()};$('pm').onclick=()=>mv(-1);$('nm').onclick=()=>mv(1);
$('ccat').onchange=e=>{C.cat=e.target.value;ctx.refresh()};acts({day:v=>{C.sel=v;ctx.refresh()},cadd:t=>txForm(ctx,t,undefined,C.sel)})}

/* ---- Pengingat ---- */
function reminders(u,d){const td=todayStr(),rows=[...d.reminders].sort((a,b)=>a.paid-b.paid||a.due.localeCompare(b.due)),
st=r=>r.paid?['Selesai','circle-check']:r.due<td?['Terlambat','triangle-alert']:r.due===td?['Jatuh tempo hari ini','clock']:['Mendatang','calendar'];
return `<section class="view-enter"><div class="head"><h1>Pengingat Tagihan</h1><button class="btn primary" id="addR"><i data-lucide="plus"></i>Pengingat</button></div>
${rows.length?`<div class="card"><ul class="list">${rows.map(r=>{const[l,i]=st(r);return `<li class="item"><span class="dot" style="background:${r.paid?'var(--ok)':r.due<td?'var(--danger)':'var(--primary)'};color:#fff"><i data-lucide="${i}"></i></span><div class="grow"><b class="${r.paid?'done':''}">${esc(r.title)}</b><small>${fmtDate(r.due)}, ${rupiah(r.amount)}, ${l}</small></div>${ib('data-tg',r.id,r.paid?'Tandai belum selesai':'Tandai selesai',r.paid?'rotate-ccw':'check')}${ib('data-er',r.id,'Ubah pengingat','pencil')}${ib('data-dr',r.id,'Hapus pengingat','trash-2')}</li>`}).join('')}</ul><p class="note">Pengingat tampil di Beranda saat jatuh tempo kurang dari 3 hari atau terlambat. Notifikasi hanya muncul di dalam aplikasi saat dibuka.</p></div>`:empty('bell','Belum ada pengingat','Tambahkan tagihan agar jatuh temponya tidak terlewat.')}</section>`}
async function remForm(ctx,old){const{d,user}=ctx;save(ctx,formSheet({title:old?'Ubah pengingat':'Tambah pengingat',fields:[{id:'title',label:'Nama tagihan',value:old?.title||''},{id:'amount',label:'Nominal (Rp)',money:1,value:old?numFmt(old.amount):''},{id:'categoryId',label:'Kategori',options:[['','Tanpa kategori'],...d.categories.filter(c=>c.type==='expense').map(c=>[c.id,c.name])],value:old?.categoryId||''},{id:'due',label:'Jatuh tempo',type:'date',value:old?.due||todayStr()}],
onSubmit:async v=>{const e={},a=fin.amt(v.amount),t=(v.title||'').trim();if(!t||t.length>60)e.title='Nama 1 sampai 60 karakter.';if(a.err)e.amount=a.err;if(!validDate(v.due))e.due='Tanggal tidak valid.';if(bad(e))return e;
await put('reminders',{id:old?.id||crypto.randomUUID(),userId:user.id,title:t,amount:a.n,categoryId:v.categoryId,due:v.due,paid:old?.paid||false,createdAt:old?.createdAt||Date.now()})}}))}
function bindRem(ctx){const g=id=>ctx.d.reminders.find(r=>r.id===id);$('addR').onclick=()=>remForm(ctx);
acts({tg:async id=>{const r=g(id);try{await put('reminders',{...r,paid:!r.paid});ctx.refresh()}catch{toast('Gagal menyimpan.','error')}},er:id=>remForm(ctx,g(id)),dr:id=>askDel('Hapus pengingat?','Pengingat ini akan dihapus.',()=>del('reminders',id,ctx.refresh))})}

/* ---- Utang & piutang (pencatatan terpisah, tidak mengubah saldo dompet) ---- */
const KD=[['debt','Utang saya'],['recv','Piutang (orang lain berutang)']];
const paidOf=(d,id)=>d.debtPayments.filter(p=>p.debtId===id).reduce((a,p)=>a+p.amount,0);
function debts(u,d){const td=todayStr(),rem=k=>d.debts.filter(x=>x.kind===k).reduce((a,x)=>a+x.total-paidOf(d,x.id),0),dm=Object.fromEntries(d.debts.map(x=>[x.id,x])),hist=[...d.debtPayments].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
return `<section class="view-enter"><div class="head"><h1>Utang &amp; Piutang</h1><button class="btn primary" id="addD"><i data-lucide="plus"></i>Catatan</button></div>
<div class="stats"><div class="stat"><small>Sisa utang saya</small><b>${rupiah(rem('debt'))}</b></div><div class="stat"><small>Sisa piutang</small><b>${rupiah(rem('recv'))}</b></div></div>
${d.debts.length?`<div class="card"><ul class="list">${d.debts.map(x=>{const p=paidOf(d,x.id),r=x.total-p,pc=Math.min(100,Math.round(p/x.total*100)),s=r<=0?'Lunas':x.due&&x.due<td?'Lewat tempo':'Belum lunas';
return `<li class="item" style="flex-wrap:wrap"><div class="grow"><b>${esc(x.party)}</b><small>${x.kind==='debt'?'Utang saya':'Piutang'}, sisa ${rupiah(r)} dari ${rupiah(x.total)}${x.due?', tempo '+fmtDate(x.due):''}</small></div>${ib('data-ed',x.id,'Ubah catatan','pencil')}${ib('data-dd',x.id,'Hapus catatan','trash-2')}<div style="flex-basis:100%"><div class="bar"><i style="width:${pc}%"></i></div><div class="head" style="margin-top:.4rem"><small class="note">${pc}%, ${s}</small>${r>0?`<button class="btn" data-pd="${x.id}" style="min-height:40px;padding:0 .8rem">${x.kind==='debt'?'Bayar cicilan':'Terima cicilan'}</button>`:''}</div></div></li>`}).join('')}</ul><p class="note">Catatan ini terpisah dan tidak mengubah saldo dompet.</p></div>`:empty('handshake','Belum ada catatan','Catat utang atau piutang beserta cicilannya.')}
${hist.length?`<div class="card"><h2>Riwayat cicilan</h2><ul class="list">${hist.map(p=>`<li class="item"><div class="grow"><b>${esc(dm[p.debtId]?.party||'?')}</b><small>${fmtDate(p.date)}</small></div><span class="amt">${rupiah(p.amount)}</span>${ib('data-dp',p.id,'Hapus cicilan','trash-2')}</li>`).join('')}</ul></div>`:''}</section>`}
async function debtForm(ctx,old){const{user}=ctx;save(ctx,formSheet({title:old?'Ubah catatan':'Tambah catatan',fields:[{id:'kind',label:'Jenis',options:KD,value:old?.kind||'debt'},{id:'party',label:'Nama pihak',value:old?.party||''},{id:'total',label:'Nominal awal (Rp)',money:1,value:old?numFmt(old.total):''},{id:'due',label:'Jatuh tempo (opsional)',type:'date',value:old?.due||''}],
onSubmit:async v=>{const e={},a=fin.amt(v.total),p=(v.party||'').trim();if(!p||p.length>60)e.party='Nama 1 sampai 60 karakter.';if(a.err)e.total=a.err;if(v.due&&!validDate(v.due))e.due='Tanggal tidak valid.';if(bad(e))return e;
await put('debts',{id:old?.id||crypto.randomUUID(),userId:user.id,kind:v.kind,party:p,total:a.n,due:v.due||'',createdAt:old?.createdAt||Date.now()})}}))}
async function payForm(ctx,x){const{d,user}=ctx,r=x.total-paidOf(d,x.id);save(ctx,formSheet({title:(x.kind==='debt'?'Bayar cicilan, ':'Terima cicilan, ')+esc(x.party),submitText:'Simpan',fields:[{id:'amount',label:'Nominal (maks '+rupiah(r)+')',money:1},{id:'date',label:'Tanggal',type:'date',value:todayStr()}],
onSubmit:async v=>{const e={},a=fin.amt(v.amount);if(a.err)e.amount=a.err;else if(a.n>r)e.amount='Melebihi sisa saldo.';if(!validDate(v.date))e.date='Tanggal tidak valid.';if(bad(e))return e;
await put('debtPayments',{id:crypto.randomUUID(),userId:user.id,debtId:x.id,amount:a.n,date:v.date,createdAt:Date.now()})}}))}
function bindDebt(ctx){const{d}=ctx,g=id=>d.debts.find(x=>x.id===id);$('addD').onclick=()=>debtForm(ctx);
acts({ed:id=>debtForm(ctx,g(id)),pd:id=>payForm(ctx,g(id)),dp:id=>askDel('Hapus cicilan?','Sisa saldo akan dihitung ulang.',()=>del('debtPayments',id,ctx.refresh)),
dd:id=>askDel('Hapus catatan?','Seluruh riwayat cicilannya ikut dihapus.',async()=>{try{await batch([...d.debtPayments.filter(p=>p.debtId===id).map(p=>['del','debtPayments',p.id]),['del','debts',id]]);toast('Dihapus.','success');ctx.refresh()}catch{toast('Gagal menghapus.','error')}})})}

/* ---- Transaksi berulang (diproses saat aplikasi dibuka) ---- */
const FQ=[['daily','Harian'],['weekly','Mingguan'],['monthly','Bulanan'],['yearly','Tahunan']];
function recurring(u,d){const cm=catMap(d),wm=walMap(d),n=id=>d.transactions.filter(t=>t.recurringId===id).length;
return `<section class="view-enter"><div class="head"><h1>Transaksi Berulang</h1><div class="row"><button class="btn" data-addr="income"><i data-lucide="plus"></i>Pemasukan</button><button class="btn primary" data-addr="expense"><i data-lucide="plus"></i>Pengeluaran</button></div></div>
${d.recurring.length?`<div class="card"><ul class="list">${d.recurring.map(r=>`<li class="item">${dot(cm[r.categoryId])}<div class="grow"><b>${esc(cm[r.categoryId]?.name||'?')}, ${r.type==='income'?'+':''}${rupiah(r.amount)}</b><small>${FQ.find(f=>f[0]===r.frequency)[1]}, mulai ${fmtDate(r.start)}${r.end?', sampai '+fmtDate(r.end):''}, ${esc(wm[r.walletId]?.name||'Tanpa dompet')}, ${r.active?'Aktif':'Nonaktif'}, ${n(r.id)} transaksi dibuat</small></div>${ib('data-tr',r.id,r.active?'Nonaktifkan':'Aktifkan',r.active?'pause':'play')}${ib('data-er',r.id,'Ubah','pencil')}${ib('data-dr',r.id,'Hapus','trash-2')}</li>`).join('')}</ul><p class="note">Jadwal hanya diproses saat Chasify dibuka, transaksi tidak dibuat otomatis saat browser tertutup. Setiap jadwal hanya membuat satu transaksi per tanggal.</p></div>`:empty('repeat','Belum ada transaksi berulang','Atur gaji, langganan, atau cicilan yang terjadi rutin.')}</section>`}
async function recForm(ctx,type,old){const{d,user}=ctx;save(ctx,formSheet({title:(old?'Ubah ':'Tambah ')+(type==='income'?'pemasukan':'pengeluaran')+' berulang',fields:[{id:'amount',label:'Nominal (Rp)',money:1,value:old?numFmt(old.amount):''},{id:'categoryId',label:'Kategori',options:d.categories.filter(c=>c.type===type).map(c=>[c.id,c.name]),value:old?.categoryId},{id:'walletId',label:'Dompet',options:d.wallets.map(w=>[w.id,w.name]),value:old?.walletId},{id:'frequency',label:'Frekuensi',options:FQ,value:old?.frequency||'monthly'},{id:'start',label:'Tanggal mulai',type:'date',value:old?.start||todayStr()},{id:'end',label:'Tanggal berakhir (opsional)',type:'date',value:old?.end||''},{id:'note',label:'Catatan (opsional)',value:old?.note||''}],
onSubmit:async v=>{const e={},a=fin.amt(v.amount);if(a.err)e.amount=a.err;if(!d.categories.some(c=>c.id===v.categoryId&&c.type===type))e.categoryId='Pilih kategori.';if(!d.wallets.some(w=>w.id===v.walletId))e.walletId='Pilih dompet.';
if(!validDate(v.start))e.start='Tanggal tidak valid.';if(v.end&&(!validDate(v.end)||v.end<v.start))e.end='Harus setelah tanggal mulai.';if(bad(e))return e;
await put('recurring',{id:old?.id||crypto.randomUUID(),userId:user.id,type,amount:a.n,categoryId:v.categoryId,walletId:v.walletId,frequency:v.frequency,start:v.start,end:v.end||'',note:(v.note||'').trim().slice(0,200),active:old?.active??true,lastDate:old?.lastDate||'',createdAt:old?.createdAt||Date.now()})}}))}
function bindRec(ctx){const g=id=>ctx.d.recurring.find(r=>r.id===id);document.querySelectorAll('[data-addr]').forEach(b=>b.onclick=()=>recForm(ctx,b.dataset.addr));
acts({addr:()=>{},er:id=>recForm(ctx,g(id).type,g(id)),dr:id=>askDel('Hapus jadwal?','Transaksi yang sudah dibuat tetap tersimpan.',()=>del('recurring',id,ctx.refresh)),
tr:async id=>{const r=g(id),on=!r.active;try{await put('recurring',{...r,active:on,lastDate:on&&r.lastDate<todayStr()?todayStr():r.lastDate});ctx.refresh()}catch{toast('Gagal menyimpan.','error')}}})}

/* ---- Data & Privasi: profil, CSV, backup, restore, hapus data ---- */
export const STORES=['categories','wallets','transactions','transfers','budgets','savingsGoals','savingsContributions','recurring','reminders','debts','debtPayments'];
const LBL={categories:'kategori',wallets:'dompet',transactions:'transaksi',transfers:'transfer',budgets:'anggaran',savingsGoals:'target tabungan',savingsContributions:'setoran',recurring:'jadwal berulang',reminders:'pengingat',debts:'utang/piutang',debtPayments:'cicilan'};
const REFS={transactions:['categoryId','walletId'],transfers:['fromId','toId'],budgets:['categoryId'],savingsContributions:['goalId','walletId'],recurring:['categoryId','walletId'],reminders:['categoryId'],debtPayments:['debtId']};
const NUM=['amount','limit','target','initial','total'];
export function validate(p){if(p?.app!=='chasify'||p.version!==1||!p.data||typeof p.data!=='object')return'Bukan file backup Chasify yang valid.';let n=0;
for(const s of STORES){const a=p.data[s]??[];if(!Array.isArray(a))return`Data "${s}" tidak valid.`;n+=a.length;
for(const r of a){if(!r||typeof r!=='object'||typeof r.id!=='string')return`Ada baris tanpa ID pada "${s}".`;
for(const k of NUM)if(k in r&&!(Number.isSafeInteger(r[k])&&r[k]>=0))return`Nominal tidak valid pada "${s}".`;
if('date' in r&&!validDate(r.date))return`Tanggal tidak valid pada "${s}".`}}
return n>100000?'Backup terlalu besar.':null}
/* Restore atomik. ID yang bentrok dengan akun lain di perangkat dipetakan ke ID baru (beserta referensinya); mode gabung melewati ID yang sudah ada di akun ini. */
export async function restore(uid,p,mode,d){const own=new Set(),foreign=new Set(),map={},ops=[];
for(const s of STORES)for(const r of await all(s))(r.userId===uid?own:foreign).add(r.id);
if(mode==='replace')for(const s of STORES)for(const r of d[s])ops.push(['del',s,r.id]);
const skip=id=>mode==='merge'&&own.has(id);
for(const s of STORES)for(const r of p.data[s]||[])if(!skip(r.id)&&foreign.has(r.id))map[r.id]=crypto.randomUUID();
for(const s of STORES)for(const r of p.data[s]||[]){if(skip(r.id))continue;const o={...r,id:map[r.id]||r.id,userId:uid};for(const k of REFS[s]||[])if(map[o[k]])o[k]=map[o[k]];ops.push(['put',s,o])}
await batch(ops);return ops.filter(o=>o[0]==='put').length}
const cell=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
const csv=(h,rows)=>'\ufeff'+[h,...rows].map(r=>r.map(cell).join(',')).join('\r\n');
const dl=(name,text,type='text/csv;charset=utf-8')=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1e3)};
const data=(u)=>`<section class="view-enter"><h1>Data &amp; Privasi</h1>
<div class="card"><h2>Profil</h2><p class="sub">${esc(u.name)}, @${esc(u.username)}, ${esc(u.email)}</p><div class="row" style="justify-content:flex-start"><button class="btn" id="pname"><i data-lucide="pencil"></i>Ubah nama</button></div></div>
<div class="card"><h2>Ekspor CSV</h2><p class="sub">Unduh data untuk dibuka di spreadsheet.</p><div class="row split"><button class="btn" id="csvT">Transaksi</button><button class="btn" id="csvC">Kategori</button></div></div>
<div class="card"><h2>Backup dan pulihkan</h2><p class="sub">File JSON berisi kategori, dompet, transaksi, transfer, anggaran, target tabungan, setoran, transaksi berulang, pengingat, utang, dan cicilan. Tidak termasuk kata sandi dan pengaturan tema. File tidak dienkripsi, simpan di tempat aman.</p><div class="row split"><button class="btn primary" id="bk"><i data-lucide="download"></i>Backup</button><button class="btn" id="rsb"><i data-lucide="upload"></i>Pulihkan</button></div><input id="rs" type="file" accept="application/json,.json" hidden></div>
<div class="card danger-zone"><h2>Privasi</h2><p class="sub">Semua data hanya tersimpan di browser perangkat ini dan tidak disinkronkan ke perangkat lain. Menghapus data situs browser akan menghapus semuanya, jadi buat backup berkala.</p><div class="row" style="justify-content:flex-start"><button class="btn danger" id="wipe">Hapus semua data keuangan</button></div><p class="note" style="margin-top:.6rem">Untuk menghapus akun, buka <a href="#/settings">Pengaturan</a>.</p></div></section>`;
async function pickRestore(ctx,f){if(f.size>5*1024*1024)return toast('File terlalu besar (maks 5 MB).','error');let p;try{p=JSON.parse(await f.text())}catch{return toast('File bukan JSON yang valid.','error')}
const er=validate(p);if(er)return toast(er,'error');const info=STORES.filter(s=>(p.data[s]||[]).length).map(s=>`${p.data[s].length} ${LBL[s]}`).join(', ')||'tidak ada data';
save(ctx,formSheet({title:'Pulihkan backup',submitText:'Pulihkan',fields:[{id:'mode',label:'Isi file: '+info,options:[['merge','Gabungkan dengan data sekarang'],['replace','Ganti seluruh data sekarang']]}],
onSubmit:async v=>{if(v.mode==='replace'&&!await confirmDialog({title:'Ganti semua data?',body:'Data saat ini akan dihapus dan diganti isi backup.'}))return{_:'Dibatalkan.'};await restore(ctx.user.id,p,v.mode,ctx.d)}}))}
function bindData(ctx){const{user,d}=ctx;
$('pname').onclick=()=>save(ctx,formSheet({title:'Ubah nama',fields:[{id:'name',label:'Nama lengkap',value:user.name}],onSubmit:async v=>{const n=(v.name||'').trim();if(!n||n.length>60)return{name:'Nama 1 sampai 60 karakter.'};await put('users',{...await get('users',user.id),name:n})}}));
$('csvT').onclick=()=>{const cm=catMap(d),wm=walMap(d);dl('chasify-transaksi.csv',csv(['Tanggal','Jenis','Kategori','Dompet','Nominal (Rp)','Catatan'],[...d.transactions].sort(sortTx).map(t=>[t.date,t.type==='income'?'Pemasukan':'Pengeluaran',cm[t.categoryId]?.name,wm[t.walletId]?.name,t.amount,t.note])))};
$('csvC').onclick=()=>dl('chasify-kategori.csv',csv(['Jenis','Nama','Ikon','Warna'],d.categories.map(c=>[c.type==='income'?'Pemasukan':'Pengeluaran',c.name,c.icon,c.color])));
$('bk').onclick=()=>{const o={};for(const s of STORES)o[s]=d[s];dl(`chasify-backup-${todayStr()}.json`,JSON.stringify({app:'chasify',version:1,exportedAt:new Date().toISOString(),data:o},null,1),'application/json');toast('Backup diunduh.','success')};
$('rsb').onclick=()=>$('rs').click();$('rs').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)pickRestore(ctx,f)};
$('wipe').onclick=()=>askDel('Hapus semua data keuangan?','Semua transaksi, dompet, anggaran, dan data lain di akun ini dihapus. Akun tetap ada. Buat backup dulu bila perlu.',async()=>{try{const ops=[];for(const s of STORES)for(const r of d[s])ops.push(['del',s,r.id]);ops.push(['del','preferences','seed:'+user.id]);await batch(ops);fin.resetSeed(user.id);toast('Data dihapus.','success');ctx.refresh()}catch{toast('Gagal menghapus data.','error')}})}

/* ---- Analitik ---- */
const A={m:todayStr().slice(0,7)};
function analytics(u,d){const s=fin.summary(d,A.m),p=fin.summary(d,shiftM(A.m,-1)),ds=fin.dailySeries(d,A.m),net=s.income-s.expense,rate=s.income?Math.round(net/s.income*100):null,dl=(c,v)=>v?`${c>=v?'Naik':'Turun'} ${Math.abs(Math.round((c-v)/v*100))}% dari bulan lalu`:'Belum ada pembanding';
return `<section class="view-enter"><h1>Analitik</h1>${monthnav(A.m)}<div class="stats"><div class="stat"><small>Pemasukan</small><b>${rupiahC(s.income)}</b><small>${dl(s.income,p.income)}</small></div><div class="stat"><small>Pengeluaran</small><b>${rupiahC(s.expense)}</b><small>${dl(s.expense,p.expense)}</small></div><div class="stat"><small>Selisih arus kas</small><b>${rupiahC(net)}</b><small>Bulan lalu: ${rupiahC(p.income-p.expense)}</small></div><div class="stat"><small>Rasio tabungan</small><b>${rate===null?'Belum ada':rate+'%'}</b><small>Selisih ÷ pemasukan</small></div></div>
<div class="grid2"><div class="card"><h2>Arus kas harian (kumulatif)</h2>${s.income||s.expense?lineChart(ds.labels,[{name:'Pemasukan',color:'var(--c-in)',values:ds.inc},{name:'Pengeluaran',color:'var(--c-out)',values:ds.exp}]):'<p class="sub">Belum ada transaksi bulan ini.</p>'}</div>
<div class="card"><h2>Perbandingan 6 bulan</h2>${barChart(fin.monthSeries(d,A.m))}</div>
<div class="card wide"><h2>Pengeluaran per kategori</h2>${donut(catItems(d,s),s.expense)}</div></div></section>`}
function bindAn(ctx){$('pm').onclick=()=>{A.m=shiftM(A.m,-1);ctx.refresh()};$('nm').onclick=()=>{A.m=shiftM(A.m,1);ctx.refresh()}}
export const MORE={analytics:{view:analytics,bind:bindAn},reports:{view:reports,bind:bindR},calendar:{view:calendar,bind:bindCal},reminders:{view:reminders,bind:bindRem},debts:{view:debts,bind:bindDebt},recurring:{view:recurring,bind:bindRec},data:{view:data,bind:bindData}};
