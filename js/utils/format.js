const nf=new Intl.NumberFormat('id-ID');
export const numFmt=n=>nf.format(n);
export const rupiah=n=>n<0?'(Rp'+nf.format(Math.abs(n))+')':'Rp'+nf.format(n);
export const parseRupiah=s=>{s=String(s??'');if(/-/.test(s))return NaN;const d=s.replace(/\D/g,'');return d?parseInt(d,10):NaN};
export const todayStr=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
export const fmtDate=s=>new Date(s+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
export const validDate=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const d=new Date(s+'T00:00:00');return d.getFullYear()==+s.slice(0,4)&&d.getMonth()+1==+s.slice(5,7)&&d.getDate()==+s.slice(8)};
export const rupiahC=n=>{const a=Math.abs(n),w=t=>n<0?'('+t+')':t;return a>=1e12?w('Rp'+(a/1e12).toFixed(2).replace('.',',')+' T'):a>=1e9?w('Rp'+(a/1e9).toFixed(2).replace('.',',')+' M'):rupiah(n)};
