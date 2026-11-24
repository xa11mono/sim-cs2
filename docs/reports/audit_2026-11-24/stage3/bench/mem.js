const { chromium } = require('playwright'); const path=require('path'), url=require('url');
(async()=>{ const br=await chromium.launch(); const pg=await br.newPage(); await pg.route(/^https?:/, r=>r.abort());
 await pg.goto(url.pathToFileURL(path.resolve(process.argv[2])).href); await pg.waitForTimeout(1500);
 const cdp=await pg.context().newCDPSession(pg); await cdp.send('Performance.enable');
 const m=async()=>{ const r=await cdp.send('Performance.getMetrics'); const o={}; r.metrics.forEach(x=>o[x.name]=x.value); return {heapUsedMB:+(o.JSHeapUsedSize/1e6).toFixed(1), heapTotalMB:+(o.JSHeapTotalSize/1e6).toFixed(1), nodes:o.Nodes}; };
 const a=await m(); await pg.evaluate(s=>__ev(s), 'paused=true; if(typeof WARM!=="undefined"&&WARM.on){WARM={on:false};} freshMatch(3); for(var i=0;i<15000;i++) stepTick(); "ok"');
 await cdp.send('HeapProfiler.collectGarbage'); const b=await m();
 await pg.evaluate(s=>__ev(s), 'for(var i=0;i<15000;i++) stepTick(); "ok"'); await cdp.send('HeapProfiler.collectGarbage'); const c=await m();
 console.log(JSON.stringify({afterLoad:a, after20kTicks:b, after40kTicks:c})); await br.close(); })();
