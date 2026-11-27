// DM против Math движка (Node = V8): сколько из N случайных аргументов отличаются
const fs=require('fs'); const src=fs.readFileSync(''+require('path').join(__dirname,'../../../../')+'engine/core/dmath.ts','utf8');
const strip=require(''+require('path').join(__dirname,'../../../../')+'tools/rebuild/game_src.js').stripTs; const DMX=(new Function(strip(src)+';return DM;'))();
let s=7; const r=()=>{ s=Math.imul(s^(s>>>15),1|s)+0x6D2B79F5>>>0; return (s>>>8)/16777216; };
for(const f of ['sin','cos','atan2','atan','hypot','exp','log']){ let d=0,N=200000; for(let i=0;i<N;i++){ const a=(r()-0.5)*20, b=(r()-0.5)*2000; const x=f==='atan2'||f==='hypot'?DMX[f](a,b):DMX[f](f==='log'?Math.abs(b):a); const y=f==='atan2'||f==='hypot'?Math[f](a,b):Math[f](f==='log'?Math.abs(b):a); if(!Object.is(x,y)) d++; } console.log(f, d+'/'+N); }
