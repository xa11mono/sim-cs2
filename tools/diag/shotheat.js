const { chromium } = require('playwright');
(async()=>{ const br=await chromium.launch(); const pg=await br.newPage({viewport:{width:1400,height:950}}); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.route(/^https?:/, r=>r.abort());
await pg.goto('file://'+'/home/claude/heat/ancient-pro-vs-bots.html'); await pg.waitForTimeout(1500);
await pg.click('#side button[data-v="T"]'); await pg.click('#phase button[data-v="post"]'); await pg.waitForTimeout(300);
await pg.hover('.gap'); await pg.waitForTimeout(300);
await pg.screenshot({path:'/home/claude/heat/shot.png'}); console.log(errs, await pg.evaluate(()=>Object.keys(DATA.zshare).length)); await br.close(); })();
