const NAME='chasify',VERSION=1;
export const USER_STORES=['transactions','categories','budgets','savingsGoals','savingsContributions','wallets','transfers','recurring','reminders','debts','debtPayments','preferences'];
let dbp;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
/* Satu kali percobaan membuka database. Skema tetap versi 1, jadi data lama tidak berubah. */
const open1=()=>new Promise((res,rej)=>{const r=indexedDB.open(NAME,VERSION);
r.onupgradeneeded=()=>{const db=r.result;const u=db.createObjectStore('users',{keyPath:'id'});u.createIndex('username','username',{unique:true});u.createIndex('email','email',{unique:true});
for(const s of USER_STORES)db.createObjectStore(s,{keyPath:'id'}).createIndex('userId','userId')};
/* Jika koneksi ditutup browser (Safari kadang melakukannya) atau tab lain meminta upgrade, buka ulang otomatis di akses berikutnya. */
r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{db.close();dbp=null};db.onclose=()=>{dbp=null};res(db)};
r.onerror=()=>rej(r.error);r.onblocked=()=>rej(new Error('IndexedDB diblokir'))});
/* Safari/iOS kadang gagal buka IndexedDB pada percobaan pertama ("Connection to Indexed Database server lost"), jadi dicoba ulang beberapa kali. */
export function openDB(){return dbp??=(async()=>{if(!globalThis.indexedDB)throw new Error('IndexedDB tidak tersedia');let err;
for(let i=0;i<4;i++){try{return await open1()}catch(e){err=e;await sleep(150*(i+1))}}throw err})().catch(e=>{dbp=null;throw e})}
/* Buat transaksi; bila koneksi lama sudah tertutup, buka ulang lalu coba sekali lagi. Penulisan memakai durability 'strict' (Chrome) agar benar-benar tertulis ke disk. */
async function transact(names,mode='readonly'){for(let i=0;;i++){const db=await openDB();
try{return db.transaction(names,mode,mode==='readwrite'?{durability:'strict'}:undefined)}catch(e){if(i>=1||e.name!=='InvalidStateError')throw e;dbp=null}}}
const wrap=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const st=async(n,m='readonly')=>(await transact(n,m)).objectStore(n);
/* Tulis tunggal: promise baru selesai setelah transaksi COMMIT (oncomplete), bukan sekadar request sukses.
   Dengan begitu data sudah pasti tersimpan sebelum UI bilang "Tersimpan", walau halaman langsung di-reload. */
async function write(n,fn){const tx=await transact(n,'readwrite');return new Promise((res,rej)=>{let out;
tx.oncomplete=()=>res(out);tx.onerror=e=>rej(e.target?.error||tx.error);tx.onabort=()=>rej(tx.error||new Error('Transaksi dibatalkan'));
const q=fn(tx.objectStore(n));q.onsuccess=()=>{out=q.result}})}
export const put=(n,v)=>write(n,s=>s.put(v));
export const get=async(n,id)=>wrap((await st(n)).get(id));
export const remove=(n,id)=>write(n,s=>s.delete(id));
export const listByUser=async(n,uid)=>wrap((await st(n)).index('userId').getAll(uid));
export const byIndex=async(n,idx,key)=>wrap((await st(n)).index(idx).get(key));
export async function deleteUserData(uid){const tx=await transact([...USER_STORES,'users'],'readwrite');return new Promise((res,rej)=>{
tx.oncomplete=()=>res();tx.onerror=tx.onabort=()=>rej(tx.error);
tx.objectStore('users').delete(uid);
for(const s of USER_STORES)tx.objectStore(s).index('userId').openKeyCursor(IDBKeyRange.only(uid)).onsuccess=e=>{const c=e.target.result;if(c){tx.objectStore(s).delete(c.primaryKey);c.continue()}}})}
export async function removeAll(pairs){if(!pairs.length)return;const tx=await transact([...new Set(pairs.map(p=>p[0]))],'readwrite');return new Promise((res,rej)=>{tx.oncomplete=()=>res();tx.onerror=tx.onabort=()=>rej(tx.error);for(const[s,i]of pairs)tx.objectStore(s).delete(i)})}
export const all=async n=>wrap((await st(n)).getAll());
export async function batch(ops){const names=[...new Set(ops.map(o=>o[1]))];if(!names.length)return;const tx=await transact(names,'readwrite');return new Promise((res,rej)=>{tx.oncomplete=()=>res();tx.onerror=tx.onabort=()=>rej(tx.error);for(const[k,s,v]of ops){const o=tx.objectStore(s);k==='put'?o.put(v):o.delete(v)}})}
export const putAll=pairs=>batch(pairs.map(([s,o])=>['put',s,o]));
