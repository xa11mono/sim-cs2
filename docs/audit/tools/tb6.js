const { chromium } = require('playwright'); const path = require('path');
(async () => { const [sim, fx, fy, fz, tx, ty, tz, N] = process.argv.slice(2);
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  const out = await pg.evaluate(([fx,fy,fz,tx,ty,tz,N]) => { window.__ev('freshMatch(3)'); for(let i = 0; i < 1100; i++) window.__ev('stepTick()');
    var i0 = window.__ev(`(function(){ var B = teamBot("CT3"); SANDBOX.on = true; bots.forEach(function(o){ if(o !== B) sbRemove(o); });
      B.x = B.baseX = ${fx}; B.y = B.baseY = ${fy}; B.z = ${fz}; var a = navAt(${fx},${fy},${fz}); if(a) B._area = a.id; B.path = []; B.pathIdx = 0;
      B._sbGo = {x:${tx}, y:${ty}, z:${tz}, look:null}; return JSON.stringify([a ? a.id : null, a ? a.z : null]); })()`);
    var L = [i0];
    for(let i = 0; i < N; i++){ window.__ev('stepTick()'); if(i % 16 === 0) L.push(window.__ev(`(function(){ var B = teamBot("CT3"); return [tick, B.x.toFixed(1), B.y.toFixed(1), Math.round(B.z), B._area, B.path ? B.path.length+":"+B.pathIdx : "-", B.atPost?1:0, Math.round(B.curSpeed||0), B._fall ? "F" : ""].join(" "); })()`)); }
    return L.join("\n"); }, [+fx,+fy,+fz,+tx,+ty,+tz,+N]);
  console.log(out); await br.close(); })();
