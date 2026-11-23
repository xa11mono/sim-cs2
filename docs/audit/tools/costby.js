const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => { const [sim, m, N, outp] = process.argv.slice(2);
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  const out = await pg.evaluate(([m, N]) => {
    window.__ev('freshMatch('+m+')');
    window.__ev(`window.__K = {};
      var SKIP = /^(buildWaypointPath0?|pathPts|pathLenTo|pathQ|polyLen|hasLOS|visLine|visParts|visMarch|m3Line|m3Cast|nearP|byPathCmp|Array|forEach|filter|map|some|every|sort|reduce|eval|window|Object|__ev|stepTick)$/;
      function who(){ var st = (new Error().stack || '').split('\\n').slice(3, 18), out = [];
        for(var i = 0; i < st.length; i++){ var mm = st[i].match(/at ([\\w$.]+) /); if(!mm) continue; var f = mm[1].replace(/^.*\\./, ''); if(SKIP.test(f) || f === '<anonymous>') continue; out.push(f); if(out.length >= 2) break; }
        return out.join('<') || '?'; }
      window.__WHO = who;`);
    ['buildWaypointPath', 'nadeSolve', 'zoneDijkstra'].forEach(function(name){ window.__ev(`if(typeof ${name} === 'function'){ var _o_${name} = ${name}, _d_${name} = 0; ${name} = function(){ var t = performance.now(); _d_${name}++; var r = _o_${name}.apply(this, arguments); _d_${name}--; if(!_d_${name}){ var d = performance.now() - t, k = '${name} | ' + window.__WHO(); var e = window.__K[k] || (window.__K[k] = [0, 0]); e[0]++; e[1] += d; } return r; }; }`); });
    var H = [0,0,0,0,0,0], tt = 0; var t0 = performance.now(); for(let i = 0; i < N; i++){ var a = performance.now(); window.__ev('stepTick()'); var d = performance.now() - a; tt += d; H[d < 2 ? 0 : d < 5 ? 1 : d < 16 ? 2 : d < 50 ? 3 : d < 200 ? 4 : 5]++; } var wall = performance.now() - t0; window.__K.__H = H; window.__K.__NAV = [window.__ev('NAVAREAS.length'), window.__ev('Object.keys(zoneGraph).reduce(function(a,k){ return a + zoneGraph[k].length; }, 0)'), window.__ev('BZ.ids.length')];
    return JSON.stringify({wall: wall, K: window.__ev('JSON.stringify(window.__K)')}); }, [+m, +N]);
  fs.writeFileSync(outp, out); await br.close(); console.log('ok'); })();
