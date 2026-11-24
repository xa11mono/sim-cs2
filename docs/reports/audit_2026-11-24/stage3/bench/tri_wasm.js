const fs=require('fs'); const {gen}=require('./tri.js'); const X=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(__dirname+'/rdj/target/wasm32-unknown-unknown/release/rdj.wasm')),{}).exports;
const {T,S}=gen(); const pT=X.alloc_f64(T.length), pS=X.alloc_f64(S.length), pO=X.alloc_f64(2); new Float64Array(X.memory.buffer,pT,T.length).set(T); new Float64Array(X.memory.buffer,pS,S.length).set(S);
X.tri_bench(pT,256,pS,4000,pO); const t0=process.hrtime.bigint(); for(let k=0;k<5;k++) X.tri_bench(pT,256,pS,4000,pO); const ms=Number(process.hrtime.bigint()-t0)/1e6; const o=new Float64Array(X.memory.buffer,pO,2);
console.log(JSON.stringify({variant:"rust_wasm", ms:+ms.toFixed(1), nsPerTest:+(ms*1e6/(5*4000*256)).toFixed(2), hits:o[0], acc:o[1]}));
