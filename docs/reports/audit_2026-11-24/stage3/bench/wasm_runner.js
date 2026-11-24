const fs=require('fs'); const d=JSON.parse(fs.readFileSync(__dirname+'/graph.json'));
const mod=new WebAssembly.Module(fs.readFileSync(__dirname+'/rdj/target/wasm32-unknown-unknown/release/rdj.wasm'));
const inst=new WebAssembly.Instance(mod,{}); const X=inst.exports;
function put(arr){ const p=X.alloc_f64(arr.length); new Float64Array(X.memory.buffer,p,arr.length).set(arr); return p; }
const nodes=put(d.nodes.flat()), edges=put(d.edges.flat()), kp=put(d.kp.flat());
X.init(nodes,d.nodes.length,edges,d.edges.length,kp,d.kp.length,d.R,d.DET,d.CK);
module.exports={ q:(a,b)=>X.query(a,b), X };
if(require.main===module){
  // пакет: все запросы одним вызовом (u32 пары)
  const n=d.queries.length; const p=X.alloc_f64(n); const u=new Uint32Array(X.memory.buffer,p,n*2); d.queries.forEach((q,i)=>{u[2*i]=q[0]; u[2*i+1]=q[1];});
  X.query_batch(p,300); const t0=process.hrtime.bigint(); let s=0; for(let r=0;r<3;r++) s+=X.query_batch(p,n); const ms=Number(process.hrtime.bigint()-t0)/1e6;
  console.log(JSON.stringify({variant:"D_rust_wasm_batch", queries:3*n, totalMs:+ms.toFixed(1), usPerQuery:+(ms*1000/(3*n)).toFixed(2), checksum:+s.toFixed(3)}));
  // стоимость пересечения границы JS ↔ WASM: пустой по смыслу вызов (запрос «из узла в себя» — сразу выход)
  const K=2e6; const t1=process.hrtime.bigint(); let z=0; for(let i=0;i<K;i++) z+=X.query(5,5); const ns=Number(process.hrtime.bigint()-t1)/K;
  console.log(JSON.stringify({boundaryCall_ns_incl_reset_of_2544_nodes:+ns.toFixed(0)}));
}
