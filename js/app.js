import {initTheme,getPrefs,savePrefs,apply,THEMES} from './utils/theme.js';
import * as auth from './auth/auth.js';
import {toast,confirmDialog} from './components/ui.js';
import {VIEWS,loadFor} from './modules/pages.js';
import {MORE} from './modules/more.js';
import {initCharts,motion} from './components/charts.js';
import {initBackground} from './components/bg.js';
Object.assign(VIEWS,MORE);
const $=(s,r=document)=>r.querySelector(s),app=$('#app');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons=()=>window.lucide?.createIcons();
const go=h=>{location.hash='#/'+h};
const PUBLIC=['welcome','login','register','recovery'],PAGES={dashboard:['Beranda','home'],transactions:['Transaksi','arrow-left-right'],budgets:['Anggaran','chart-pie'],savings:['Tabungan','target'],wallets:['Dompet','landmark'],categories:['Kategori','tags'],analytics:['Analitik','chart-line'],reports:['Laporan','chart-column'],calendar:['Kalender','calendar'],reminders:['Pengingat','bell'],debts:['Utang','handshake'],recurring:['Berulang','repeat'],data:['Data & Privasi','shield-check'],more:['Lainnya','menu'],settings:['Pengaturan','settings']},MAIN=['dashboard','transactions','budgets','savings'],SEC=['analytics','wallets','categories','reports','calendar','reminders','debts','recurring','data','settings'],SIDE=[...MAIN,...SEC],BOTTOM=[...MAIN,'more'];
const mark='<span class="mark"><i data-lucide="wallet"></i></span>';
const field=(id,label,type='text',x='')=>`<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${id}" type="${type}" ${x} aria-describedby="${id}-err"><p class="err" id="${id}-err" role="alert"></p></div>`;
function showErrors(form,errors){form.querySelectorAll('.err').forEach(p=>p.textContent='');form.querySelectorAll('[aria-invalid]').forEach(i=>i.removeAttribute('aria-invalid'));
for(const[k,m]of Object.entries(errors)){const p=$('#'+k+'-err',form);if(p)p.textContent=m;form.elements[k]?.setAttribute('aria-invalid','true')}form.querySelector('[aria-invalid]')?.focus()}
async function submit(form,fn){const b=$('button[type=submit]',form);b.disabled=true;b.classList.add('loading');
try{await fn()}catch(e){if(e.errors)showErrors(form,e.errors);else toast(e.message==='insecure'?'Fitur keamanan butuh localhost atau HTTPS.':'Penyimpanan lokal gagal. Coba lagi.','error')}finally{b.disabled=false;b.classList.remove('loading')}}
const authPage=(t,s,body)=>`<main class="auth view-enter"><div class="auth-card"><a class="brand" href="#/welcome">${mark}<span>Chasify</span></a><h1>${t}</h1><p class="sub">${s}</p>${body}</div></main>`;

const publicViews={
welcome:()=>authPage('Keuangan pribadi, lebih jelas.','Catat, atur, dan pahami uang Anda dalam satu aplikasi.',`<div class="stack"><a class="btn primary" href="#/register">Buat akun</a><a class="btn" href="#/login">Masuk</a></div><p class="note">Akun dan data disimpan hanya di browser perangkat ini. Tidak ada sinkronisasi antarperangkat, dan keamanannya tidak setara layanan perbankan.</p>`),
login:()=>authPage('Masuk','Gunakan username atau email Anda.',`<form novalidate>${field('identity','Username atau email','text','autocomplete="username"')}${field('password','Kata sandi','password','autocomplete="current-password"')}<button class="btn primary" type="submit">Masuk</button></form><div class="links"><a href="#/recovery">Lupa kata sandi?</a><a href="#/register">Buat akun</a></div>`),
register:()=>authPage('Buat akun','Akun ini hanya berlaku di perangkat ini.',`<form novalidate>${field('name','Nama lengkap','text','autocomplete="name"')}${field('username','Username','text','autocomplete="username"')}${field('email','Email','email','autocomplete="email"')}${field('password','Kata sandi','password','autocomplete="new-password"')}${field('confirm','Konfirmasi kata sandi','password','autocomplete="new-password"')}<div class="check"><input type="checkbox" id="terms" name="terms" aria-describedby="terms-err"><label for="terms">Saya memahami data disimpan lokal di perangkat ini dan menyetujui kebijakan privasi.</label></div><p class="err" id="terms-err" role="alert"></p><button class="btn primary" type="submit">Daftar</button></form><div class="links"><span></span><a href="#/login">Sudah punya akun?</a></div>`),
recovery:()=>authPage('Pemulihan lokal','Tanpa server, email pemulihan tidak dapat dikirim.',`<p>Kata sandi tidak dapat direset dari jarak jauh. Pilihan Anda: ingat kembali kata sandi, atau pulihkan data dari file backup JSON ke akun baru (fitur backup dan restore hadir di Tahap 3).</p><p class="note" style="margin-top:.75rem">Jika backup belum pernah dibuat, data pada akun yang terkunci tidak dapat dipulihkan.</p><div class="stack"><a class="btn" href="#/login">Kembali ke masuk</a></div>`)};
function bindPublic(route){const form=$('form',app);if(!form)return;
if(route==='login')form.onsubmit=e=>{e.preventDefault();submit(form,async()=>{await auth.login(form.elements.identity.value,form.elements.password.value);go('dashboard')})};
if(route==='register')form.onsubmit=e=>{e.preventDefault();submit(form,async()=>{const f=Object.fromEntries(new FormData(form));f.terms=form.elements.terms.checked;await auth.register(f);toast('Akun berhasil dibuat.','success');go('dashboard')})}}

function settings(){const p=getPrefs();const mode=[['light','Terang','sun'],['dark','Gelap','moon'],['system','Sistem','monitor']];
return `<section class="view-enter"><h1>Pengaturan</h1><div class="card"><h2>Tema warna</h2><div class="themes" role="radiogroup" aria-label="Tema warna">${THEMES.map(([id,n,c])=>`<button type="button" role="radio" class="swatch" data-theme-id="${id}" aria-checked="${id===p.theme}"><span style="background:${c}"></span>${n}</button>`).join('')}</div><h2>Mode tampilan</h2><div class="seg" role="radiogroup" aria-label="Mode tampilan">${mode.map(([id,n,i])=>`<button type="button" role="radio" data-mode-id="${id}" aria-checked="${id===p.mode}"><i data-lucide="${i}"></i>${n}</button>`).join('')}</div><p class="note" style="margin-top:.5rem">Pilihan tampil sebagai pratinjau sampai Anda menekan Terapkan.</p><div class="row"><button id="cancel" class="btn ghost" disabled>Batal</button><button id="applyTheme" class="btn primary" disabled>Terapkan</button></div></div>
<div class="card"><h2>Penyimpanan lokal</h2><p class="sub">Data disimpan di IndexedDB browser ini. Tidak tersinkronisasi ke perangkat lain dan hilang jika data situs dihapus.</p></div>
<div class="card danger-zone"><h2>Hapus akun lokal</h2><p class="sub">Menghapus akun beserta seluruh datanya dari perangkat ini. Tindakan ini tidak dapat dibatalkan.</p><div class="row" style="justify-content:flex-start"><button id="delAcc" class="btn danger">Hapus akun dan data</button></div></div></section>`}
function bindSettings(user){let d={...getPrefs()};const sync=()=>{apply(d);const s=getPrefs(),dirty=d.theme!==s.theme||d.mode!==s.mode;
app.querySelectorAll('[data-theme-id]').forEach(b=>b.setAttribute('aria-checked',b.dataset.themeId===d.theme));
app.querySelectorAll('[data-mode-id]').forEach(b=>b.setAttribute('aria-checked',b.dataset.modeId===d.mode));
$('#cancel').disabled=$('#applyTheme').disabled=!dirty};
app.querySelectorAll('[data-theme-id]').forEach(b=>b.onclick=()=>{d.theme=b.dataset.themeId;sync()});
app.querySelectorAll('[data-mode-id]').forEach(b=>b.onclick=()=>{d.mode=b.dataset.modeId;sync()});
$('#applyTheme').onclick=()=>{savePrefs({theme:d.theme,mode:d.mode});sync();toast('Tema diterapkan.','success')};
$('#cancel').onclick=()=>{d={...getPrefs()};sync()};
$('#delAcc').onclick=async()=>{if(!await confirmDialog({title:'Hapus akun lokal?',body:'Akun dan semua data keuangan di perangkat ini akan dihapus permanen.'}))return;
try{await auth.deleteAccount(user.id);toast('Akun dihapus.','success');go('welcome')}catch{toast('Gagal menghapus akun.','error')}}}

const moreView=()=>`<section class="view-enter"><h1>Lainnya</h1><div class="card"><ul class="list">${SEC.map(i=>`<li class="item"><a class="menu-link grow" href="#/${i}"><i data-lucide="${PAGES[i][1]}"></i>${PAGES[i][0]}<i data-lucide="chevron-right" class="chev"></i></a></li>`).join('')}</ul></div><button id="logout2" class="btn danger" style="width:100%;margin-top:1rem"><i data-lucide="log-out"></i>Keluar</button></section>`;
function shell(route,user,inner){const p=getPrefs(),back=MAIN.includes(route)||route==='more'?'':'<button id="back" class="btn icon-btn ghost" aria-label="Kembali ke halaman sebelumnya"><i data-lucide="arrow-left"></i></button>';
const link=(id,a)=>`<a href="#/${id}" class="${a?'active':''}" ${a?'aria-current="page"':''}><i data-lucide="${PAGES[id][1]}"></i><span>${PAGES[id][0]}</span></a>`,nav=SIDE.map(i=>link(i,i===route)).join(''),bnav=BOTTOM.map(i=>link(i,i===route||(i==='more'&&SEC.includes(route)))).join('');
app.innerHTML=`<div class="shell ${p.collapsed?'collapsed':''}"><aside class="sidebar"><a class="brand" href="#/dashboard">${mark}<span>Chasify</span></a><nav aria-label="Navigasi utama">${nav}</nav><button id="collapse" class="btn ghost" aria-label="Ciutkan sidebar" aria-pressed="${p.collapsed}"><i data-lucide="panel-left"></i><span>Ciutkan</span></button></aside>
<div class="main"><header class="top"><div class="topl">${back}<nav class="crumbs" aria-label="Breadcrumb">Chasify / <b>${PAGES[route][0]}</b></nav></div><div class="user"><span class="avatar" aria-hidden="true">${esc(user.name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase())}</span><span class="uname">${esc(user.name)}</span><button id="logout" class="btn icon-btn" aria-label="Keluar"><i data-lucide="log-out"></i></button></div></header><main id="view" tabindex="-1">${inner}</main></div><nav class="bottom" aria-label="Navigasi bawah">${bnav}</nav></div>`;
$('#collapse').onclick=()=>{const c=!getPrefs().collapsed;savePrefs({collapsed:c});$('.shell').classList.toggle('collapsed',c);$('#collapse').setAttribute('aria-pressed',c)};
$('#logout').onclick=()=>{auth.logout();go('welcome')};
$('#back')?.addEventListener('click',()=>navs?history.back():go('dashboard'))}

let tok=0,navs=0;
async function render(){const my=++tok,route=(location.hash.slice(2)||'welcome').split('?')[0];
const user=await auth.currentUser().catch(()=>null);if(my!==tok)return;apply(getPrefs());
if(!(route in PAGES||PUBLIC.includes(route)))return go(user?'dashboard':'welcome');
if(user&&PUBLIC.includes(route))return go('dashboard');
if(!user&&route in PAGES)return go('login');
if(user){let inner,bind=()=>{};
if(route==='settings'){inner=settings();bind=()=>bindSettings(user)}
else if(route==='more'){inner=moreView();bind=()=>{$('#logout2').onclick=()=>{auth.logout();go('welcome')}}}
else try{const d=await loadFor(user.id);if(my!==tok)return;const p=VIEWS[route];inner=p.view(user,d);bind=()=>p.bind?.({user,d,refresh:render})}catch{inner='<p class="err" role="alert">Gagal membaca data lokal. Muat ulang halaman.</p>'}
shell(route,user,inner);bind()}
else{app.innerHTML=publicViews[route]();if(route!=='welcome')$('.auth-card').insertAdjacentHTML('afterbegin',`<a class="back" href="#/${route==='recovery'?'login':'welcome'}"><i data-lucide="chevron-left"></i>Kembali</a>`);bindPublic(route)}
icons();if(user)motion(route)}
initTheme();initCharts();initBackground();addEventListener('hashchange',()=>{navs++;render()});render();
