const {chromium}=require('playwright'),url=require('url'),fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.goto(url.pathToFileURL(__dirname+'/standalone.html').href);
await p.waitForFunction(()=>window.__done,null,{timeout:120000});const r=await p.evaluate(()=>window.__done);r.browser=b.version();
const nd=JSON.parse(fs.readFileSync(__dirname+'/node_result.json'));const same=(a,c)=>JSON.stringify(a)===JSON.stringify(c);
r.cmp={main_js_eq_node_js:same(r.main.hash&&r.main.hash.js,nd.hash.js),worker_js_eq_node_js:same(r.worker.hash&&r.worker.hash.js,nd.hash.js),
 main_wasm_libm_eq_native_libm:same(r.main.hash&&r.main.hash.wasm_libm,nd.hash.native_libm),worker_wasm_libm_eq_native_libm:same(r.worker.hash&&r.worker.hash.wasm_libm,nd.hash.native_libm),
 main_wasm_std_eq_node_wasm_std:same(r.main.hash&&r.main.hash.wasm_std,nd.hash.wasm_std)};
fs.writeFileSync(__dirname+'/browser_result.json',JSON.stringify(r,null,1));console.log(JSON.stringify({browser:r.browser,cmp:r.cmp,ov_main:r.main.overhead,ov_worker:r.worker.overhead,err:[r.main.err,r.worker.err]}));await b.close();})();
