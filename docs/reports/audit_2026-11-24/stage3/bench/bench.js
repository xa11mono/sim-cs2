// Эталон: Дейкстра по графу навмеша Mirage (стоимость как в zoneDijkstra + knownSegCost). A — объекты/строки (как в игре), B — типизированные массивы.
const fs=require('fs'); const d=JSON.parse(fs.readFileSync(__dirname+'/graph.json'));
const N=d.nodes.length, E=d.edges.length, R=d.R, DET=d.DET, CK=d.CK, KP=d.kp;
function ksc(ax,ay,bx,by,qx,qy,qw){ if((ax<qx-R&&bx<qx-R)||(ax>qx+R&&bx>qx+R)||(ay<qy-R&&by<qy-R)||(ay>qy+R&&by>qy+R)) return 0;
  const dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy; if(L2<1e-9) return 0; const fx=ax-qx,fy=ay-qy; const B=2*(fx*dx+fy*dy),C=fx*fx+fy*fy-R*R,D=B*B-4*L2*C; if(D<=0) return 0;
  const sq=Math.sqrt(D), t0=Math.max(0,(-B-sq)/(2*L2)), t1=Math.min(1,(-B+sq)/(2*L2)); if(t1<=t0) return 0;
  const tm=Math.max(0,Math.min(1,-B/(2*L2))), cx=ax+dx*tm-qx, cy=ay+dy*tm-qy, dmin=Math.sqrt(cx*cx+cy*cy);
  return DET*qw*(t1-t0)*Math.sqrt(L2)/(2*R)*(1+CK*Math.max(0,1-dmin/R)); }
function wEdge(ax,ay,mx,my,wb){ let w=Math.hypot(mx-ax,my-ay)+wb; const mnx=Math.min(ax,mx),mxx=Math.max(ax,mx),mny=Math.min(ay,my),mxy=Math.max(ay,my);
  for(let k=0;k<KP.length;k++){ const q=KP[k]; if(mxx<q[0]-R||mnx>q[0]+R||mxy<q[1]-R||mny>q[1]+R) continue; w+=ksc(ax,ay,mx,my,q[0],q[1],q[2]); } return w; }
// --- A: как в игре: граф — объект id → [{to, mid}], dist/visited/entry — объекты, куча с объектами
const ids=d.nodes.map((_,i)=>"z"+i); const G={}; ids.forEach(id=>G[id]=[]); const CEN={}; d.nodes.forEach((c,i)=>CEN[ids[i]]={x:c[0],y:c[1]});
d.edges.forEach(e=>G[ids[e[0]]].push({to:ids[e[1]], mid:{x:e[2],y:e[3]}, wb:e[4]}));
function heapA(){ const h=[]; return {push(id,p){ h.push({id,p}); let i=h.length-1; while(i>0){ const j=(i-1)>>1; if(h[j].p<=h[i].p) break; [h[i],h[j]]=[h[j],h[i]]; i=j; } },
  pop(){ const t=h[0], l=h.pop(); if(h.length){ h[0]=l; let i=0; for(;;){ const a=2*i+1,b=a+1; let m=i; if(a<h.length&&h[a].p<h[m].p) m=a; if(b<h.length&&h[b].p<h[m].p) m=b; if(m===i) break; [h[i],h[m]]=[h[m],h[i]]; i=m; } } return t; }, size(){ return h.length; } }; }
function dijA(fi,ti){ const from=ids[fi],to=ids[ti]; const dist={},visited={},entry={},prev={}; const H=heapA(); dist[from]=0; H.push(from,0);
  while(H.size()){ const u=H.pop().id; if(visited[u]) continue; visited[u]=true; if(u===to) break; const fc=entry[u]||CEN[u], EL=G[u];
    for(let k=0;k<EL.length;k++){ const e=EL[k]; if(visited[e.to]) continue; const alt=dist[u]+wEdge(fc.x,fc.y,e.mid.x,e.mid.y,e.wb);
      if(dist[e.to]===undefined||alt<dist[e.to]){ dist[e.to]=alt; prev[e.to]=u; entry[e.to]=e.mid; H.push(e.to,alt); } } }
  return dist[to]===undefined?-1:dist[to]; }
// --- B: плотные массивы
const off=new Int32Array(N+1), et=new Int32Array(E), emx=new Float64Array(E), emy=new Float64Array(E), ewb=new Float64Array(E);
{ const cnt=new Int32Array(N); d.edges.forEach(e=>cnt[e[0]]++); for(let i=0;i<N;i++) off[i+1]=off[i]+cnt[i]; const pos=off.slice(0,N); d.edges.forEach(e=>{ const p=pos[e[0]]++; et[p]=e[1]; emx[p]=e[2]; emy[p]=e[3]; ewb[p]=e[4]; }); }
const cx=new Float64Array(N), cy=new Float64Array(N); d.nodes.forEach((c,i)=>{cx[i]=c[0]; cy[i]=c[1];});
const dist=new Float64Array(N), enx=new Float64Array(N), eny=new Float64Array(N), vis=new Uint8Array(N), hasE=new Uint8Array(N);
let hp=new Float64Array(16), hi=new Int32Array(16), hn=0;
function hpush(i,p){ if(hn>=hp.length){ const a=new Float64Array(hp.length*2); a.set(hp); hp=a; const b=new Int32Array(hi.length*2); b.set(hi); hi=b; } let k=hn++; while(k>0){ const j=(k-1)>>1; if(hp[j]<=p) break; hp[k]=hp[j]; hi[k]=hi[j]; k=j; } hp[k]=p; hi[k]=i; }
function hpop(){ const top=hi[0]; const lp=hp[--hn], li=hi[hn]; let k=0; for(;;){ const a=2*k+1,b=a+1; if(a>=hn) break; let m=(b<hn&&hp[b]<hp[a])?b:a; if(hp[m]>=lp) break; hp[k]=hp[m]; hi[k]=hi[m]; k=m; } hp[k]=lp; hi[k]=li; return top; }
function dijB(f,t){ dist.fill(Infinity); vis.fill(0); hasE.fill(0); hn=0; dist[f]=0; hpush(f,0);
  while(hn){ const u=hpop(); if(vis[u]) continue; vis[u]=1; if(u===t) break; const ax=hasE[u]?enx[u]:cx[u], ay=hasE[u]?eny[u]:cy[u];
    for(let k=off[u];k<off[u+1];k++){ const v=et[k]; if(vis[v]) continue; const alt=dist[u]+wEdge(ax,ay,emx[k],emy[k],ewb[k]); if(alt<dist[v]){ dist[v]=alt; enx[v]=emx[k]; eny[v]=emy[k]; hasE[v]=1; hpush(v,alt); } } }
  return dist[t]===Infinity?-1:dist[t]; }
function run(name,fn){ for(let r=0;r<2;r++) for(const q of d.queries.slice(0,300)) fn(q[0],q[1]); // прогрев
  let s=0; const t0=process.hrtime.bigint(); for(let r=0;r<3;r++) for(const q of d.queries) s+=fn(q[0],q[1]); const ms=Number(process.hrtime.bigint()-t0)/1e6;
  const n=3*d.queries.length; console.log(JSON.stringify({variant:name, queries:n, totalMs:+ms.toFixed(1), usPerQuery:+(ms*1000/n).toFixed(2), checksum:+s.toFixed(3)})); }
run("A_js_objects",dijA); run("B_js_typed",dijB);
if(process.argv[2]==="wasm"){ const W=require('./wasm_runner.js'); run("D_rust_wasm", W.q); run("D_rust_wasm_batch_like", W.q); }
