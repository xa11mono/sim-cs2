// покрытие кода игры: какие функции ни разу не вызвались за N раундов двух матчей (кандидаты в мёртвый код)
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const [,, sim, out, R] = process.argv;
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.coverage.startJSCoverage({reportAnonymousScripts: true, resetOnNavigation: false});
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  await pg.evaluate((R) => __ev(`paused=true; [3,17].forEach(function(M){ freshMatch(M); var R0=roundNum; while(roundNum<R0+${R} && roundState!=='matchover') stepTick(); }); 1`), +R);
  const cov = await pg.coverage.stopJSCoverage();
  const res = [];
  cov.forEach(e => { (e.functions || []).forEach(f => { if (!f.functionName) return; const cnt = f.ranges[0].count; res.push([f.functionName, cnt, e.url.slice(-30)]); }); });
  fs.writeFileSync(out, JSON.stringify(res)); await br.close(); console.log('функций', res.length);
})();
