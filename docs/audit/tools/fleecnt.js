const { chromium } = require('playwright'); const path = require('path');
(async () => { const [sim, M, N] = process.argv.slice(2);
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  const out = await pg.evaluate(([M,N]) => { window.__ev('freshMatch('+M+')'); var bad = 0, df = 0, ad = 0, defs = 0, defOk = 0, last = {};
    for(let i = 0; i < N; i++){ window.__ev('stepTick()'); if(i % 8) continue;
      var r = JSON.parse(window.__ev(`(function(){ var D = bots.some(function(o){ return o.alive && o.defusing; }); if(!D || !bomb || bomb.state !== "planted") return "[0,0,0]";
        var T = bots.filter(function(b){ return b.alive && b.team === "T" && Math.hypot(b.x-bomb.x, b.y-bomb.y) < DEFUSE_HEAR; });
        return JSON.stringify([1, T.filter(function(b){ return b.post && b.post.tag === "flee"; }).length, T.filter(function(b){ return b.post && b.post.tag === "antidefuse"; }).length]); })()`));
      df += r[0]; bad += r[1]; ad += r[2]; }
    return JSON.stringify({тиков_дефуза_x8: df, T_рядом_в_flee: bad, T_рядом_antidefuse: ad}); }, [+M, +N]);
  console.log(M, out); await br.close(); })();
