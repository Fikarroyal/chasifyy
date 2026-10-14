const ITER=210000,enc=new TextEncoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function derive(pw,salt,iterations){if(!globalThis.crypto?.subtle)throw new Error('insecure');const k=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveBits']);return crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},k,256)}
export async function hashPassword(pw){const salt=crypto.getRandomValues(new Uint8Array(16));return{salt:b64(salt),iter:ITER,hash:b64(await derive(pw,salt,ITER))}}
export async function verifyPassword(pw,{salt,iter,hash}){const h=new Uint8Array(await derive(pw,unb64(salt),iter)),e=unb64(hash);let d=h.length^e.length;for(let i=0;i<h.length;i++)d|=h[i]^(e[i]??0);return d===0}
