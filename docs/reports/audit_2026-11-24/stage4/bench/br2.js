const {chromium}=require('playwright'),url=require('url'),fs=require('fs'),C=require('./core.js');
(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.goto(url.pathToFileURL(__dirname+'/standalone.html').href);
const n=20000; const arr=await p.evaluate(n=>Array.from(jsFill(n)),n); await b.close();
const nodev=C.runAll(fs.readFileSync(__dirname+'/prec/target/wasm32-unknown-unknown/release/prec.wasm'),n).vecs.js;
const r={}; for(let f=0;f<C.NF;f++){let c=0;for(let i=0;i<n;i++) if(!Object.is(arr[i*C.NF+f],nodev[i*C.NF+f])) c++; r[C.NAMES[f]]=c;} console.log('chromium vs node, из',n,JSON.stringify(r));
fs.writeFileSync(__dirname+'/cmp20k.json',JSON.stringify({chromium:arr,node:Array.from(nodev)}));})();
