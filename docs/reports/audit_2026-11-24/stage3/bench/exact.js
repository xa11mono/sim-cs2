process.argv[2]="none"; const fs=require('fs');
const src=fs.readFileSync(__dirname+'/bench.js','utf8').replace(/run\("A_js_objects"[\s\S]*$/,'module.exports={dijA,dijB,d};');
fs.writeFileSync(__dirname+'/bench_lib.js',src); const {dijA,dijB,d}=require('./bench_lib.js'); const W=require('./wasm_runner.js');
let neqAB=0, neqBW=0, maxd=0; for(const q of d.queries){ const a=dijA(q[0],q[1]), b=dijB(q[0],q[1]), w=W.q(q[0],q[1]); if(a!==b) neqAB++; if(b!==w){ neqBW++; maxd=Math.max(maxd,Math.abs(b-w)); } }
console.log(JSON.stringify({queries:d.queries.length, notBitEqual_A_vs_B:neqAB, notBitEqual_JS_vs_RustWasm:neqBW, maxAbsDiff:maxd}));
