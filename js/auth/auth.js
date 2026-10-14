import {put,get,byIndex,deleteUserData} from '../database/db.js';
import {hashPassword,verifyPassword} from './crypto.js';
import {store,requestPersist} from '../database/storage.js';
const SKEY='chasify.session',TTL=30*864e5,EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pwOk=p=>typeof p==='string'&&p.length>=8&&/[A-Za-z]/.test(p)&&/\d/.test(p);
export function validateRegister(f){const e={};
if(!f.name?.trim())e.name='Nama lengkap wajib diisi.';
if(!/^[a-z0-9_.]{3,20}$/i.test(f.username?.trim()||''))e.username='Username 3 sampai 20 karakter: huruf, angka, titik, atau garis bawah.';
if(!EMAIL.test(f.email?.trim()||''))e.email='Format email tidak valid.';
if(!pwOk(f.password))e.password='Minimal 8 karakter, mengandung huruf dan angka.';
if(f.password!==f.confirm)e.confirm='Konfirmasi kata sandi tidak cocok.';
if(!f.terms)e.terms='Persetujuan privasi diperlukan.';return e}
/* Sesi disimpan lewat store (aman dari error localStorage) dan masa berlakunya diperpanjang otomatis tiap dipakai. */
const startSession=uid=>{store.set(SKEY,JSON.stringify({uid,exp:Date.now()+TTL}));requestPersist()};
export const logout=()=>store.remove(SKEY);
export async function register(f){let errors=validateRegister(f);if(Object.keys(errors).length)throw{errors};
const username=f.username.trim().toLowerCase(),email=f.email.trim().toLowerCase();errors={};
if(await byIndex('users','username',username))errors.username='Username sudah digunakan.';
if(await byIndex('users','email',email))errors.email='Email sudah terdaftar.';
if(Object.keys(errors).length)throw{errors};
const user={id:crypto.randomUUID(),name:f.name.trim(),username,email,pw:await hashPassword(f.password),createdAt:Date.now()};
try{await put('users',user)}catch{throw{errors:{username:'Username atau email sudah terdaftar.'}}}
startSession(user.id);return user}
export async function login(identity,password){const id=(identity||'').trim().toLowerCase(),errors={};
if(!id)errors.identity='Wajib diisi.';if(!password)errors.password='Wajib diisi.';if(Object.keys(errors).length)throw{errors};
const u=await byIndex('users',id.includes('@')?'email':'username',id);
if(!u||!(await verifyPassword(password,u.pw)))throw{errors:{password:'Username/email atau kata sandi salah.'}};
startSession(u.id);return u}
export async function currentUser(){let s;try{s=JSON.parse(store.get(SKEY))}catch{}
if(!s||s.exp<Date.now()){logout();return null}const u=await get('users',s.uid);if(!u)logout();else if(s.exp-Date.now()<TTL/2)startSession(s.uid);return u||null}
export async function deleteAccount(uid){await deleteUserData(uid);logout()}
