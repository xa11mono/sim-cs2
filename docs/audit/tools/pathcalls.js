const { chromium } = require('playwright'); const path = require('path');
(async () => { const [sim, m, N] = process.argv.slice(2);
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  const out = await pg.evaluate(([m, N]) => {
    window.__ev('freshMatch('+m+')');
    window.__ev(`window.__C = {}; var _bw = buildWaypointPath; buildWaypointPath = function(){ var st = (new Error().stack || '').split('\\n').slice(2, 12).map(function(l){ var mm = l.match(/at ([\\w.]+)/); return mm ? mm[1] : '?'; }).filter(function(n){ return !/^(pathQ|Object|Array|file|eval|Array\\.\\w+|\\?|pathLenTo|pathPts|buildWaypointPath0)$/.test(n); }).slice(0,2).join('<') || '?'; window.__C[st] = (window.__C[st] || 0) + 1; return _bw.apply(this, arguments); };`);
    for(let i = 0; i < N; i++) window.__ev('stepTick()');
    return window.__ev('JSON.stringify(Object.entries(window.__C).sort(function(a,b){ return b[1]-a[1]; }).slice(0,14))');
  }, [+m, +N]);
  console.log(out); await br.close(); })();
