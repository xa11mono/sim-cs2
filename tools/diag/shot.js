const { chromium } = require('playwright');
(async()=>{ const br=await chromium.launch(); const pg=await br.newPage({viewport:{width:1500,height:1000}}); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.route(/^https?:/, r=>r.abort());
await pg.goto('file://'+require('path').resolve('sim.html')); await pg.waitForTimeout(1200);
await pg.evaluate(n=>__ev('paused=true; document.getElementById("chkWhy").checked=true; document.getElementById("chkWhy").dispatchEvent(new Event("change")); for(var t=0;t<'+n+';t++) stepTick();'), +process.argv[2]);
await pg.waitForTimeout(500); await pg.screenshot({path:'shot.png'});
console.log(errs, await pg.evaluate(()=>__ev('JSON.stringify(bots.filter(function(b){return b.alive}).map(function(b){return b.id+" "+b.team+": "+whyText(b)}))')));
await br.close(); })();
