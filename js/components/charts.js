import {rupiah,rupiahC} from '../utils/format.js';
import {esc} from './ui.js';
const short=n=>n>=1e9?+(n/1e9).toFixed(1)+' M':n>=1e6?+(n/1e6).toFixed(1)+' jt':n>=1e3?Math.round(n/1e3)+' rb':String(Math.round(n));
const nice=m=>{if(m<=0)return 1000;const p=10**Math.floor(Math.log10(m)),f=m/p;return(f<=1?1:f<=2?2:f<=5?5:10)*p};
const legend=ss=>`<div class="legend">${ss.map((s,i)=>`<button type="button" class="lg" data-ser="${i}" aria-pressed="true"><i style="background:${s.color}"></i>${s.name}</button>`).join('')}</div>`;
const W=320,H=170,L=36,B=22,T=8,ph=H-B-T;
const grid=mx=>[0,.5,1].map(f=>{const y=T+ph*(1-f);return `<line x1="${L}" x2="${W-4}" y1="${y}" y2="${y}" class="gl"/><text x="${L-4}" y="${y+3}" text-anchor="end" class="ax">${short(mx*f)}</text>`}).join('');
let gid=0;
export function barChart(items,names=['Pemasukan','Pengeluaran']){const mx=Math.max(...items.flatMap(i=>[i.a,i.b]),1);
const rows=items.map((it,i)=>{const net=it.a-it.b;return `<div class="cr"><span class="cl">${it.label}</span><div class="cb"><i class="in s-0" style="--w:${(it.a/mx*100).toFixed(1)}%;transition-delay:${i*70}ms" data-tip="${it.label}, ${names[0]}: ${rupiah(it.a)}"></i><i class="out s-1" style="--w:${(it.b/mx*100).toFixed(1)}%;transition-delay:${i*70+60}ms" data-tip="${it.label}, ${names[1]}: ${rupiah(it.b)}"></i></div><span class="cv ${net<0?'neg':''}">${net<0?'('+short(Math.abs(net))+')':'+'+short(net)}</span></div>`}).join('');
return `<div class="chart cmp" role="img" aria-label="Perbandingan pemasukan dan pengeluaran per bulan">${rows}${legend([{name:names[0],color:'var(--c-in)'},{name:names[1],color:'var(--c-out)'}])}</div>`}
export function lineChart(labels,series){const n=labels.length,pw=W-L-8,mx=nice(Math.max(...series.flatMap(s=>s.values),0)),x=i=>L+(n<2?pw/2:pw*i/(n-1)),y=v=>T+ph*(1-v/mx),step=Math.ceil(n/7),u='g'+(++gid);
const defs=series.map((s,k)=>`<linearGradient id="${u}${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${s.color};stop-opacity:.4"/><stop offset="1" style="stop-color:${s.color};stop-opacity:0"/></linearGradient>`).join('');
const curve=pts=>pts.map((p,i)=>{if(!i)return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;const q=pts[i-1],m=((q[0]+p[0])/2).toFixed(1);return `C${m} ${q[1].toFixed(1)} ${m} ${p[1].toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`}).join('');
const g=series.map((s,k)=>{const pts=s.values.map((v,i)=>[x(i),y(v)]),d=curve(pts),e=pts[n-1];
return `<g class="s-${k}"><path class="area" d="${d}L${x(n-1).toFixed(1)} ${T+ph}L${x(0).toFixed(1)} ${T+ph}Z" fill="url(#${u}${k})"/><path class="ln" pathLength="1" d="${d}" stroke="${s.color}"/><circle class="end" cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="3.6" fill="${s.color}"/>${pts.map((q,i)=>`<circle class="pt" cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="8" data-tip="Tgl ${labels[i]}, ${s.name}: ${rupiah(s.values[i])}"/>`).join('')}</g>`}).join('');
const xs=labels.map((l,i)=>i%step===0?`<text x="${x(i)}" y="${H-6}" text-anchor="middle" class="ax">${l}</text>`:'').join('');
return `<div class="chart" role="img" aria-label="Grafik arus kas harian"><svg viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${grid(mx)}${xs}${g}</svg>${legend(series)}</div>`}
export function donut(items,total){if(!total)return '<p class="sub">Belum ada data.</p>';let cum=0;
const arcs=items.map((it,i)=>{const p=it.value/total*100,a=Math.max(p-.8,.1),s=`<circle class="arc" cx="21" cy="21" r="15.915" pathLength="100" stroke="${it.color}" transform="rotate(-90 21 21)" style="--da:${a} ${100-a};stroke-dashoffset:${-cum};transition-delay:${i*80}ms" data-tip="${esc(it.label)}: ${rupiah(it.value)} (${Math.round(p)}%)"/>`;cum+=p;return s}).join('');
return `<div class="donut chart"><svg viewBox="0 0 42 42" role="img" aria-label="Pengeluaran per kategori"><circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--border)" stroke-width="5"/>${arcs}<text x="21" y="20" text-anchor="middle" class="ax" style="font-size:3px">Total</text><text x="21" y="24.6" text-anchor="middle" style="font:700 3.6px var(--font);fill:var(--text)">${short(total)}</text></svg><ul class="dl">${items.map(it=>`<li class="dli"><i style="background:${it.color}"></i><span>${esc(it.label)}</span><b>${Math.round(it.value/total*100)}%</b></li>`).join('')}</ul></div>`}
let last='';
export function motion(route){const same=route===last;last=route;const els=document.querySelectorAll('.chart');
if(same)els.forEach(e=>e.classList.add('instant','go'));else requestAnimationFrame(()=>requestAnimationFrame(()=>els.forEach(e=>e.classList.add('go'))));
if(same||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
document.querySelectorAll('[data-n]').forEach(el=>{const v=+el.dataset.n,t0=performance.now();const f=t=>{const k=Math.min(1,(t-t0)/800);el.textContent=rupiahC(Math.round(v*(1-(1-k)**3)));if(k<1)requestAnimationFrame(f);else el.textContent=rupiahC(v)};requestAnimationFrame(f)})}
export function initCharts(){const tip=document.createElement('div');tip.id='tip';document.body.append(tip);
const show=e=>{const t=e.target.closest?.('[data-tip]');if(!t){tip.style.opacity=0;return}tip.textContent=t.dataset.tip;tip.style.opacity=1;const w=tip.offsetWidth;tip.style.left=Math.min(Math.max(8,e.clientX-w/2),innerWidth-w-8)+'px';tip.style.top=Math.max(8,e.clientY-44)+'px'};
document.addEventListener('pointermove',show);document.addEventListener('pointerdown',show);
document.addEventListener('click',e=>{const b=e.target.closest?.('.lg');if(!b)return;const on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',on);b.closest('.chart').querySelectorAll('.s-'+b.dataset.ser).forEach(x=>x.classList.toggle('off',!on))})}
