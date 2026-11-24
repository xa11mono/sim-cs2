// Вариант «sqrt в обоих языках»: JS-формула веса ребра с Math.sqrt(dx²+dy²) против Rust (rdj/src/lib.rs, тоже sqrt). Ожидается 0 расхождений.
const fs=require('fs');
const src=fs.readFileSync(__dirname+'/bench.js','utf8').replace(/run\("A_js_objects"[\s\S]*$/,'module.exports={dijA,dijB,d};')
  .replace('Math.hypot(mx-ax,my-ay)','Math.sqrt((mx-ax)*(mx-ax)+(my-ay)*(my-ay))');
fs.writeFileSync(__dirname+'/bench_lib2.js',src);
const {dijB,d}=require('./bench_lib2.js'); const W=require('./wasm_runner.js');
let neq=0; for(const q of d.queries){ if(dijB(q[0],q[1])!==W.q(q[0],q[1])) neq++; } console.log(JSON.stringify({sqrtBoth_notBitEqual:neq, of:d.queries.length}));
