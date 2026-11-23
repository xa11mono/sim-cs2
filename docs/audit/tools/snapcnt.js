const { chromium } = require('playwright'); const path = require('path');
(async () => { const [sim, M, N] = process.argv.slice(2);
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  const out = await pg.evaluate(([M,N]) => { window.__ev('freshMatch('+M+')');
    window.__ev(`window.__S = {n:0, mv:0, at:{}}; var _ns = navSnap; navSnap = function(b){ var x = b.baseX, y = b.baseY; _ns.apply(this, arguments); window.__S.n++; if(Math.abs(b.baseX-x)+Math.abs(b.baseY-y) > 1) window.__S.mv++; else { var k = Math.round(x/25)*25+","+Math.round(y/25)*25+","+Math.round(b.z||0); window.__S.at[k] = (window.__S.at[k]||0)+1; } };`);
    for(let i = 0; i < N; i++) window.__ev('stepTick()');
    return window.__ev(`JSON.stringify([__S.n, __S.mv, Object.entries(__S.at).sort(function(a,b){return b[1]-a[1];}).slice(0,5)])`); }, [+M, +N]);
  console.log(out); await br.close(); })();
