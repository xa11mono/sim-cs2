// Цена границы: пустой вызов и передача Float64Array — JS, WASM (prec.wasm: inc), N-API (nap.node: inc, sum).
const fs=require('fs'); const N=require(__dirname+'/nap/nap.node');
const W=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(__dirname+'/prec/target/wasm32-unknown-unknown/release/prec.wasm')),{}).exports;
function t(f,n){ let s=0; f(0); const t0=process.hrtime.bigint(); for(let i=0;i<n;i++) s=f(s); return Number(process.hrtime.bigint()-t0)/n; }
const jsInc=x=>x+1, out={};
for(let r=0;r<2;r++){ out.js_ns=t(jsInc,1e7); out.wasm_ns=t(W.inc,1e7); out.napi_ns=t(N.inc,1e7); }
for(const len of [8,1024,65536]){ const a=new Float64Array(len).fill(1); let n=len<100?1e6:len<5000?2e5:5000;
  let t0=process.hrtime.bigint(); for(let i=0;i<n;i++) N.sum(a); const nap=Number(process.hrtime.bigint()-t0)/n;
  t0=process.hrtime.bigint(); for(let i=0;i<n;i++){ let s=0; for(let j=0;j<len;j++) s+=a[j]; } const js=Number(process.hrtime.bigint()-t0)/n;
  out['sum_'+len]={napi_ns:+nap.toFixed(1), js_ns:+js.toFixed(1)}; }
for(const k of ['js_ns','wasm_ns','napi_ns']) out[k]=+out[k].toFixed(2);
out.node=process.version; out.cpu=require('os').cpus()[0].model; console.log(JSON.stringify(out)); fs.writeFileSync(__dirname+'/napi_result.json',JSON.stringify(out,null,1));
