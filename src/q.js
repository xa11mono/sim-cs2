const { chromium } = require('playwright');
(async()=>{ const br=await chromium.launch(); const pg=await br.newPage(); await pg.route(/^https?:/, r=>r.abort());
await pg.goto(require('url').pathToFileURL(require('path').resolve(process.argv[2])).href); await pg.waitForTimeout(1200);
let code=process.argv[3]; if(code.startsWith('@')) code=require('fs').readFileSync(code.slice(1),'utf8');   // (Б2) «@файл»: на Windows длина командной строки ≤ 32 767 знаков
console.log(await pg.evaluate(src=>__ev(src), code)); await br.close(); })();
