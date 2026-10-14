import {store} from '../database/storage.js';
export const THEMES=[['ocean','Ocean Blue','#2563EB'],['emerald','Emerald Green','#059669'],['purple','Royal Purple','#7C3AED'],['softpink','Soft Pink','#F9A8D4'],['pink','Pink','#DB2777'],['sunset','Sunset Orange','#C2410C'],['navy','Midnight Navy','#1E3A8A'],['teal','Teal Fresh','#0F766E'],['gray','Minimal Gray','#334155']];
const KEY='chasify.prefs',DEF={theme:'ocean',mode:'system',collapsed:false};
export const getPrefs=()=>{try{const p={...DEF,...JSON.parse(store.get(KEY)||'{}')};if(p.theme==='rose')p.theme='pink';return p}catch{return{...DEF}}};
export const savePrefs=p=>{try{store.set(KEY,JSON.stringify({...getPrefs(),...p}))}catch{}};
const mq=matchMedia('(prefers-color-scheme: dark)');
export function apply({theme,mode}){const r=document.documentElement;r.dataset.theme=theme;r.dataset.scheme=mode==='system'?(mq.matches?'dark':'light'):mode}
export function initTheme(){apply(getPrefs());mq.addEventListener('change',()=>apply(getPrefs()))}
