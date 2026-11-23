const { chromium } = require('playwright'); const path = require('path');
(async () => { const [sim, m, N] = process.argv.slice(2);
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  const out = await pg.evaluate(([m, N]) => { window.__ev('freshMatch('+m+')');
    window.__ev(`window.__D = {n:0, newS:0, vis:0, team:0, hist:[0,0,0,0,0]}; var _zd = zoneDijkstra; zoneDijkstra = function(a, b, team){
      var before = ZDJ.tick === tick ? Object.keys(ZDJ.s).length : 0; var v0 = 0; var r = _zd.apply(this, arguments);
      var D = window.__D; D.n++; if(team) D.team++; var after = Object.keys(ZDJ.s).length; if(after > before || ZDJ.tick !== tick) D.newS++;
      var mx = 0; for(var k in ZDJ.s){ var c = Object.keys(ZDJ.s[k].visited).length; if(c > mx) mx = c; }
      D.vis += mx; D.hist[mx < 100 ? 0 : mx < 400 ? 1 : mx < 1000 ? 2 : mx < 2000 ? 3 : 4]++; return r; };
      for(var kk in _zd) zoneDijkstra[kk] = _zd[kk];`);
    for(let i = 0; i < N; i++) window.__ev('stepTick()');
    return window.__ev('JSON.stringify(window.__D)'); }, [+m, +N]);
  console.log(out); await br.close(); })();
