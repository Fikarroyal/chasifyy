/* Latar animasi: gelembung melayang + jaring titik yang terhubung (mengikuti warna tema dan pointer). */
export function initBackground(){const c=document.createElement('canvas');c.id='bg';c.setAttribute('aria-hidden','true');document.body.prepend(c);
const x=c.getContext?.('2d');if(!x)return;const rm=matchMedia('(prefers-reduced-motion: reduce)');
let w=0,h=0,col=[37,99,235],P=[],B=[],m={x:-999,y:-999},t0=performance.now();
const rgb=()=>{const v=getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),r=/^#([0-9a-f]{6})$/i.exec(v);if(r){const n=parseInt(r[1],16);col=[n>>16,n>>8&255,n&255]}};
const size=()=>{const d=Math.min(devicePixelRatio||1,2);w=innerWidth;h=innerHeight;c.width=w*d;c.height=h*d;x.setTransform(d,0,0,d,0,0);
P=Array.from({length:Math.round(Math.min(60,Math.max(22,w*h/26000)))},()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35}));
B=Array.from({length:9},()=>({x:Math.random()*w,y:Math.random()*h,r:18+Math.random()*60,vy:.15+Math.random()*.35,ph:Math.random()*6.28,a:.05+Math.random()*.08}))};
function frame(t){const dt=Math.min(32,t-t0)/16;t0=t;x.clearRect(0,0,w,h);const[r,g,b]=col,k=document.documentElement.dataset.scheme==='dark'?1.5:1,D=Math.min(130,w/3);
for(const o of B){o.y-=o.vy*dt;o.ph+=.01*dt;o.x+=Math.sin(o.ph)*.3*dt;if(o.y<-o.r*2){o.y=h+o.r;o.x=Math.random()*w}
const gr=x.createRadialGradient(o.x-o.r/3,o.y-o.r/3,o.r*.1,o.x,o.y,o.r);gr.addColorStop(0,`rgba(${r},${g},${b},${o.a*k*1.6})`);gr.addColorStop(1,`rgba(${r},${g},${b},${o.a*.3*k})`);
x.fillStyle=gr;x.beginPath();x.arc(o.x,o.y,o.r,0,6.283);x.fill();x.strokeStyle=`rgba(${r},${g},${b},${o.a*k*1.8})`;x.lineWidth=1;x.stroke()}
for(const p of P){p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.x<0||p.x>w)p.vx*=-1;if(p.y<0||p.y>h)p.vy*=-1}
const line=(a,q,al)=>{x.strokeStyle=`rgba(${r},${g},${b},${al*k})`;x.beginPath();x.moveTo(a.x,a.y);x.lineTo(q.x,q.y);x.stroke()};
for(let i=0;i<P.length;i++){const a=P[i];for(let j=i+1;j<P.length;j++){const q=P[j],d=Math.hypot(a.x-q.x,a.y-q.y);if(d<D)line(a,q,(1-d/D)*.22)}
const dm=Math.hypot(a.x-m.x,a.y-m.y);if(dm<D*1.3)line(a,m,(1-dm/(D*1.3))*.35);x.fillStyle=`rgba(${r},${g},${b},${.35*k})`;x.beginPath();x.arc(a.x,a.y,1.8,0,6.283);x.fill()}
if(!rm.matches)requestAnimationFrame(frame)}
let rt;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{size();if(rm.matches)frame(performance.now())},150)});
addEventListener('pointermove',e=>{m.x=e.clientX;m.y=e.clientY});addEventListener('pointerleave',()=>{m.x=m.y=-999});
setInterval(rgb,1000);rgb();size();requestAnimationFrame(frame)}
