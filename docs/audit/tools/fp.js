const { chromium } = require('playwright'); const path = require('path');
(async () => { const [sim, M, N] = process.argv.slice(2);
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  const out = await pg.evaluate(([M,N]) => { window.__ev('freshMatch('+M+')'); var t0 = Date.now(); for(let i = 0; i < N; i++) window.__ev('stepTick()');
    return (Date.now()-t0) + " " + window.__ev(`JSON.stringify([tick, roundNum, bots.map(function(b){ return [b.id, b.x, b.y, b.z, b.hp]; })])`); }, [+M, +N]);
  console.log(out); await br.close(); })();
