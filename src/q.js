const { chromium } = require('playwright');
(async()=>{ const br=await chromium.launch(); const pg=await br.newPage(); await pg.route(/^https?:/, r=>r.abort());
await pg.goto('file://'+require('path').resolve(process.argv[2])); await pg.waitForTimeout(1200);
console.log(await pg.evaluate(src=>__ev(src), process.argv[3])); await br.close(); })();
