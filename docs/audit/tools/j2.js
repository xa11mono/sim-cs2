const { chromium } = require('playwright'); const path = require('path');
(async () => { const [sim, fx, fy, fz, tx, ty, tz, N] = process.argv.slice(2);
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  const out = await pg.evaluate(([fx, fy, fz, tx, ty, tz, N]) => {
    window.__ev('freshMatch(3)'); for(let i = 0; i < 1100; i++) window.__ev('stepTick()');   // до живого раунда
    window.__ev(`var B = teamBot("CT3"); bots.forEach(function(o){ if(o !== B){ o.alive = false; } });
      B.x = B.baseX = ${fx}; B.y = B.baseY = ${fy}; B.z = ${fz}; var a = navAt(${fx}, ${fy}, ${fz}); B._area = a ? a.id : B._area; B.path = []; B.pathIdx = 0;
      window.__TG = {x:${tx}, y:${ty}, z:${tz}};`);
    var L = [];
    for(let i = 0; i < N; i++){ window.__ev(`setPost(teamBot("CT3"), window.__TG, window.__TG, true, "backstab"); stepTick();`);
      if(i % 8 === 0) L.push(window.__ev(`(function(){ var B = teamBot("CT3"); return [tick, Math.round(B.x), Math.round(B.y), Math.round(B.z), B._area, B.path ? B.path.length + ":" + B.pathIdx : "-", B.post ? B.post.tag : "-", B.atPost ? 1 : 0, Math.round(B.curSpeed||0)].join(" "); })()`)); }
    return L.join("\n"); }, [fx, fy, fz, tx, ty, tz, +N]);
  console.log(out); await br.close(); })();
