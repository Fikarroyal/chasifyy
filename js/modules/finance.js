import {put,get,listByUser,openDB,putAll} from '../database/db.js';
import {parseRupiah,validDate,todayStr} from '../utils/format.js';
export const DEFAULT_CATS=[['income','Gaji','banknote','#10B981'],['income','Bonus','gift','#2563EB'],['income','Lainnya','circle-ellipsis','#64748B'],['expense','Makan & Minum','utensils','#EA580C'],['expense','Transportasi','car','#2563EB'],['expense','Belanja','shopping-bag','#E11D48'],['expense','Tagihan','receipt','#7C3AED'],['expense','Hiburan','film','#0D9488'],['expense','Kesehatan','heart-pulse','#E11D48'],['expense','Lainnya','circle-ellipsis','#64748B']];
const MAX=9999999999999,id=()=>crypto.randomUUID(),bad=o=>Object.keys(o).length>0;
export const amt=v=>{const n=parseRupiah(v);return !Number.isSafeInteger(n)||n<=0?{err:'Nominal harus lebih dari 0.'}:n>MAX?{err:'Nominal terlalu besar.'}:{n}};
const seeding={};
export const ensureDefaults=uid=>seeding[uid]??=(async()=>{if(await get('preferences','seed:'+uid))return;const db=await openDB();
await new Promise((res,rej)=>{const tx=db.transaction(['categories','wallets','preferences'],'readwrite');tx.oncomplete=res;tx.onerror=tx.onabort=()=>rej(tx.error);
for(const[type,name,icon,color]of DEFAULT_CATS)tx.objectStore('categories').put({id:id(),userId:uid,type,name,icon,color});
tx.objectStore('wallets').put({id:id(),userId:uid,name:'Tunai',kind:'cash',initial:0,createdAt:Date.now()});
tx.objectStore('preferences').put({id:'seed:'+uid,userId:uid})})})().catch(e=>{delete seeding[uid];throw e});
/* Aturan: saldo dompet = saldo awal + pemasukan - pengeluaran - transfer keluar + transfer masuk. Transfer bukan pemasukan/pengeluaran. */
export function balances(d){const m={};for(const w of d.wallets)m[w.id]=w.initial;
for(const t of d.transactions)if(t.walletId in m)m[t.walletId]+=t.type==='income'?t.amount:-t.amount;
for(const t of d.transfers){if(t.fromId in m)m[t.fromId]-=t.amount;if(t.toId in m)m[t.toId]+=t.amount}
for(const c of d.savingsContributions)if(c.walletId in m)m[c.walletId]-=c.amount;return m}
export function summary(d,ym){const s={income:0,expense:0,byCat:{}};for(const t of d.transactions){if(!t.date.startsWith(ym))continue;s[t.type]+=t.amount;if(t.type==='expense')s.byCat[t.categoryId]=(s.byCat[t.categoryId]||0)+t.amount}return s}
export const catUse=(d,i)=>d.transactions.filter(t=>t.categoryId===i).length;
export const walletUse=(d,i)=>d.transactions.filter(t=>t.walletId===i).length+d.transfers.filter(t=>t.fromId===i||t.toId===i).length+d.savingsContributions.filter(c=>c.walletId===i).length;
export async function saveTx(uid,type,v,d,old){const e={},a=amt(v.amount);if(a.err)e.amount=a.err;
if(!validDate(v.date))e.date='Tanggal tidak valid.';
if(!d.categories.some(c=>c.id===v.categoryId&&c.type===type))e.categoryId='Pilih kategori.';
if(!d.wallets.some(w=>w.id===v.walletId))e.walletId='Pilih dompet.';
if(bad(e))return e;
await put('transactions',{id:old?.id||id(),userId:uid,type,amount:a.n,categoryId:v.categoryId,walletId:v.walletId,date:v.date,note:(v.note||'').trim().slice(0,200),createdAt:old?.createdAt||Date.now(),updatedAt:Date.now()})}
export async function saveWallet(uid,v,old){const e={},name=(v.name||'').trim(),raw=(v.initial||'').trim(),init=raw===''?0:parseRupiah(raw);
if(!name||name.length>30)e.name='Nama 1 sampai 30 karakter.';
if(!Number.isSafeInteger(init)||init<0||init>MAX)e.initial='Saldo awal tidak valid.';
if(bad(e))return e;
await put('wallets',{id:old?.id||id(),userId:uid,name,kind:v.kind,initial:init,createdAt:old?.createdAt||Date.now()})}
export async function saveTransfer(uid,v,d){const e={},a=amt(v.amount),ws=d.wallets.map(w=>w.id);
if(!ws.includes(v.fromId))e.fromId='Pilih dompet asal.';if(!ws.includes(v.toId))e.toId='Pilih dompet tujuan.';
if(!e.fromId&&!e.toId&&v.fromId===v.toId)e.toId='Dompet tujuan harus berbeda.';
if(a.err)e.amount=a.err;if(!validDate(v.date))e.date='Tanggal tidak valid.';
if(bad(e))return e;
await put('transfers',{id:id(),userId:uid,fromId:v.fromId,toId:v.toId,amount:a.n,date:v.date,note:(v.note||'').trim().slice(0,200),createdAt:Date.now()})}
export async function saveCategory(uid,type,v,d,old){const e={},name=(v.name||'').trim();
if(!name||name.length>30)e.name='Nama 1 sampai 30 karakter.';
else if(d.categories.some(c=>c.type===type&&c.id!==old?.id&&c.name.toLowerCase()===name.toLowerCase()))e.name='Nama kategori sudah ada.';
if(bad(e))return e;
await put('categories',{id:old?.id||id(),userId:uid,type,name,icon:v.icon,color:v.color})}
/* Tabungan: setoran memindahkan saldo dompet ke target (bukan pengeluaran). Saldo bersih = saldo dompet + tabungan terkumpul. */
export const spent=(d,ym,cid)=>d.transactions.reduce((a,t)=>a+(t.type==='expense'&&t.categoryId===cid&&t.date.startsWith(ym)?t.amount:0),0);
export const collected=(d,gid)=>d.savingsContributions.reduce((a,c)=>a+(c.goalId===gid?c.amount:0),0);
export const goalStatus=(g,col,today)=>col>=g.target?'done':g.deadline&&g.deadline<today?'late':'active';
export async function saveBudget(uid,v,d,ym,old){const e={},a=amt(v.limit);if(a.err)e.limit=a.err;
if(!d.categories.some(c=>c.id===v.categoryId&&c.type==='expense'))e.categoryId='Pilih kategori.';
else if(d.budgets.some(b=>b.month===ym&&b.categoryId===v.categoryId&&b.id!==old?.id))e.categoryId='Anggaran kategori ini sudah ada.';
if(bad(e))return e;await put('budgets',{id:old?.id||id(),userId:uid,categoryId:v.categoryId,month:ym,limit:a.n})}
export async function saveGoal(uid,v,old){const e={},a=amt(v.target),name=(v.name||'').trim();if(a.err)e.target=a.err;
if(!name||name.length>40)e.name='Nama 1 sampai 40 karakter.';if(v.deadline&&!validDate(v.deadline))e.deadline='Tanggal tidak valid.';
if(bad(e))return e;await put('savingsGoals',{id:old?.id||id(),userId:uid,name,target:a.n,deadline:v.deadline||'',createdAt:old?.createdAt||Date.now()})}
export async function saveContribution(uid,v,d,goalId){const e={},a=amt(v.amount);if(a.err)e.amount=a.err;
if(!d.wallets.some(w=>w.id===v.walletId))e.walletId='Pilih dompet.';if(!validDate(v.date))e.date='Tanggal tidak valid.';
if(bad(e))return e;await put('savingsContributions',{id:id(),userId:uid,goalId,walletId:v.walletId,amount:a.n,date:v.date,createdAt:Date.now()})}
const LOAD=['categories','wallets','transactions','transfers','budgets','savingsGoals','savingsContributions','recurring','reminders','debts','debtPayments'];
export async function loadFor(uid){await ensureDefaults(uid);const rs=await Promise.all(LOAD.map(n=>listByUser(n,uid))),d=Object.fromEntries(LOAD.map((n,i)=>[n,rs[i]]));
if(await processRecurring(uid,d,todayStr())){d.transactions=await listByUser('transactions',uid);d.recurring=await listByUser('recurring',uid)}return d}
export const resetSeed=uid=>{delete seeding[uid]};
function occ(r,k){const[y,m,d]=r.start.split('-').map(Number),f=r.frequency,ymd=x=>x.toISOString().slice(0,10);
if(f==='daily'||f==='weekly')return ymd(new Date(Date.UTC(y,m-1,d+k*(f==='daily'?1:7))));
const t=new Date(Date.UTC(f==='yearly'?y+k:y,f==='monthly'?m-1+k:m-1,1)),last=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth()+1,0)).getUTCDate();
return ymd(new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),Math.min(d,last))))}
/* ID transaksi deterministik (rec:<jadwal>:<tanggal>) + lastDate mencegah duplikasi dan tidak menghidupkan lagi transaksi yang sudah dihapus. */
export async function processRecurring(uid,d,today){const puts=[];
for(const r of d.recurring){if(!r.active||!d.categories.some(c=>c.id===r.categoryId)||!d.wallets.some(w=>w.id===r.walletId))continue;let last=r.lastDate||'',n=0;
for(let k=0;k<5000&&n<400;k++){const dt=occ(r,k);if(dt>today||(r.end&&dt>r.end))break;if(dt>last){puts.push(['transactions',{id:'rec:'+r.id+':'+dt,userId:uid,type:r.type,amount:r.amount,categoryId:r.categoryId,walletId:r.walletId,date:dt,note:r.note||'Transaksi berulang',createdAt:Date.now(),recurringId:r.id}]);last=dt;n++}}
if(last!==(r.lastDate||''))puts.push(['recurring',{...r,lastDate:last}])}
if(puts.length)await putAll(puts);return puts.length>0}
export function monthSeries(d,endYm,n=6){const out=[],[y,m]=endYm.split('-').map(Number),nm=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
for(let i=n-1;i>=0;i--){const x=new Date(Date.UTC(y,m-1-i,1)),ym=x.getUTCFullYear()+'-'+String(x.getUTCMonth()+1).padStart(2,'0'),s=summary(d,ym);out.push({ym,label:nm[x.getUTCMonth()],a:s.income,b:s.expense})}return out}
export function dailySeries(d,ym){const[y,m]=ym.split('-').map(Number),n=new Date(Date.UTC(y,m,0)).getUTCDate(),inc=Array(n).fill(0),exp=Array(n).fill(0);
for(const t of d.transactions)if(t.date.startsWith(ym))(t.type==='income'?inc:exp)[+t.date.slice(8)-1]+=t.amount;
const cum=a=>{let s=0;return a.map(v=>s+=v)};return{labels:Array.from({length:n},(_,i)=>String(i+1)),inc:cum(inc),exp:cum(exp)}}
