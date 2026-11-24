const fs=require('fs'),C=require('./core.js'); const D=__dirname+'/prec/'; const n=200000;
const R=C.runAll(fs.readFileSync(D+'target/wasm32-unknown-unknown/release/prec.wasm'),n);
const rd=f=>{const b=fs.readFileSync(D+f);return new Float64Array(b.buffer,b.byteOffset,b.length/8);};
const V=Object.assign({},R.vecs,{native_std:rd('native_std.bin'),native_libm:rd('native_libm.bin')});
const pairs=[["js","native_std"],["js","native_libm"],["js","wasm_std"],["js","wasm_libm"],["native_std","native_libm"],["native_libm","wasm_libm"],["native_std","wasm_std"],["wasm_std","wasm_libm"]];
const out={n,diff:{}};
for(const [a,b] of pairs){ const r={}; for(let f=0;f<C.NF;f++){ let c=0,mu=0; for(let i=0;i<n;i++){ const x=V[a][i*C.NF+f],y=V[b][i*C.NF+f]; if(!Object.is(x,y)){ c++; } } r[C.NAMES[f]]=c; } out.diff[a+" vs "+b]=r; }
out.hash=Object.assign({},R.hash,{native_std:C.hashes(V.native_std),native_libm:C.hashes(V.native_libm)}); out.overhead_node=R.overhead; out.node=process.version;
fs.writeFileSync(__dirname+'/node_result.json',JSON.stringify(out,null,1));
for(const [k,v] of Object.entries(out.diff)) console.log(k.padEnd(26), Object.entries(v).map(([f,c])=>f+":"+c).join(" "));
console.log("overhead node", JSON.stringify(R.overhead));
