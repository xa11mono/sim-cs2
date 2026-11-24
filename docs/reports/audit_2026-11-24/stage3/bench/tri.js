// Отрезок × треугольник (Мёллер–Трумбор, только + − × ÷): 4000 отрезков × 256 треугольников × 5 повторов. Данные — детерминированный LCG.
function gen(){ let s=12345>>>0; const r=()=>{ s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; };
  const T=new Float64Array(256*9), S=new Float64Array(4000*6); for(let i=0;i<T.length;i++) T[i]=r()*100; for(let i=0;i<S.length;i++) S[i]=r()*100; return {T,S}; }
function hits(T,S){ let h=0, acc=0; const nT=T.length/9, nS=S.length/6;
  for(let i=0;i<nS;i++){ const ox=S[6*i],oy=S[6*i+1],oz=S[6*i+2], dx=S[6*i+3]-ox, dy=S[6*i+4]-oy, dz=S[6*i+5]-oz;
    for(let j=0;j<nT;j++){ const o=9*j, ax=T[o],ay=T[o+1],az=T[o+2], e1x=T[o+3]-ax,e1y=T[o+4]-ay,e1z=T[o+5]-az, e2x=T[o+6]-ax,e2y=T[o+7]-ay,e2z=T[o+8]-az;
      const px=dy*e2z-dz*e2y, py=dz*e2x-dx*e2z, pz=dx*e2y-dy*e2x, det=e1x*px+e1y*py+e1z*pz; if(det>-1e-12&&det<1e-12) continue; const inv=1/det;
      const tx=ox-ax,ty=oy-ay,tz=oz-az, u=(tx*px+ty*py+tz*pz)*inv; if(u<0||u>1) continue; const qx=ty*e1z-tz*e1y, qy=tz*e1x-tx*e1z, qz=tx*e1y-ty*e1x;
      const v=(dx*qx+dy*qy+dz*qz)*inv; if(v<0||u+v>1) continue; const t=(e2x*qx+e2y*qy+e2z*qz)*inv; if(t<0||t>1) continue; h++; acc+=t; } } return [h,acc]; }
module.exports={gen,hits};
if(require.main===module){ const {T,S}=gen(); hits(T,S); const t0=process.hrtime.bigint(); let r; for(let k=0;k<5;k++) r=hits(T,S); const ms=Number(process.hrtime.bigint()-t0)/1e6;
  console.log(JSON.stringify({variant:"js_typed", tests:5*4000*256, ms:+ms.toFixed(1), nsPerTest:+(ms*1e6/(5*4000*256)).toFixed(2), hits:r[0], acc:r[1]})); }
