// Общее ядро сверки для Node, страницы и Worker. Входы — тот же LCG, что в prec/src/lib.rs.
var NF=9, NAMES=["sin","cos","tan","atan2","exp","log","pow","hypot","sqrt"];
function jsFill(n){ var o=new Float64Array(n*NF), r=12345>>>0; function u(){ r=(Math.imul(r,1664525)+1013904223)>>>0; return r/4294967296; }
  for(var i=0;i<n;i++){ var a=(u()-0.5)*8*Math.PI, x=(u()-0.5)*6000, y=(u()-0.5)*6000, e=u()*25-20, l=u()*1e4+1e-9, pb=u()*10+1e-9, pe=(u()-0.5)*6, k=i*NF;
    o[k]=Math.sin(a);o[k+1]=Math.cos(a);o[k+2]=Math.tan(a);o[k+3]=Math.atan2(y,x);o[k+4]=Math.exp(e);o[k+5]=Math.log(l);o[k+6]=Math.pow(pb,pe);o[k+7]=Math.hypot(x,y);o[k+8]=Math.sqrt(x*x+y*y); }
  return o; }
function wasmFill(inst,mode,n){ var E=inst.exports, p=E.buf(n); E.run(mode,p,n); return new Float64Array(E.memory.buffer,p,n*NF).slice(); }
function hashes(v){ var u=new Uint32Array(v.buffer,v.byteOffset,v.length*2), n=v.length/NF, h={};
  for(var f=0;f<NF;f++){ var x=0x811c9dc5; for(var i=0;i<n;i++){ var k=2*(i*NF+f); x=Math.imul(x^u[k],16777619)>>>0; x=Math.imul(x^u[k+1],16777619)>>>0; } h[NAMES[f]]=x.toString(16); } return h; }
function overhead(inst){ var E=inst.exports, N=1e7, s=0, t, jsInc=function(x){return x+1;};
  for(var w=0;w<2;w++){ s=0; t=performance.now(); for(var i=0;i<N;i++) s=E.inc(s); var tw=performance.now()-t; s=0; t=performance.now(); for(var j=0;j<N;j++) s=jsInc(s); var tj=performance.now()-t; }
  return {calls:N, wasm_ns_per_call:+(tw*1e6/N).toFixed(2), js_ns_per_call:+(tj*1e6/N).toFixed(2)}; }
function runAll(bytes,n){ var inst=new WebAssembly.Instance(new WebAssembly.Module(bytes),{}); var js=jsFill(n), ws=wasmFill(inst,0,n), wl=wasmFill(inst,1,n);
  return {vecs:{js:js,wasm_std:ws,wasm_libm:wl}, hash:{js:hashes(js),wasm_std:hashes(ws),wasm_libm:hashes(wl)}, overhead:overhead(inst)}; }
if(typeof module!=="undefined") module.exports={runAll,hashes,NF,NAMES};
