// покрытие кода игры: какие функции ни разу не вызвались за N раундов двух матчей (кандидаты в мёртвый код)
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const [,, sim, out, R, MS] = process.argv;   // (15.11) MS — матчи через запятую (по умолчанию 3,17); R ≥ 99 — матч целиком
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.coverage.startJSCoverage({reportAnonymousScripts: true, resetOnNavigation: false});
  await pg.goto(require('url').pathToFileURL(path.resolve(sim)).href); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  await pg.evaluate(([R, MS]) => __ev(`paused=true; [${MS}].forEach(function(M){ freshMatch(M); var R0=roundNum; while(roundNum<R0+${R} && roundState!=='matchover') stepTick(); }); 1`), [+R, MS || '3,17']);
  const cov = await pg.coverage.stopJSCoverage();
  const res = [];
  cov.forEach(e => { (e.functions || []).forEach(f => { if (!f.functionName) return; const cnt = f.ranges[0].count; res.push([f.functionName, cnt, e.url.slice(-30)]); }); });
  fs.writeFileSync(out, JSON.stringify(res)); await br.close(); console.log('функций', res.length);
})();
