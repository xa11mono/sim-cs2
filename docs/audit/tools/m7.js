const { chromium } = require('playwright'); const path = require('path');
(async () => { const [sim, M, T0, T1] = process.argv.slice(2);
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  const out = await pg.evaluate(([M,T0,T1]) => { window.__ev('freshMatch('+M+')'); while(window.__ev('tick') < T0) window.__ev('stepTick()');
    var L = []; while(window.__ev('tick') < T1){ window.__ev('stepTick()'); var t = window.__ev('tick'); if(t % 16 === 0) L.push(window.__ev(`(function(){ var B = teamBot("T2"); return [tick, B.x.toFixed(1), B.y.toFixed(1), Math.round(B.z), B.alive?1:0, B.post ? B.post.tag+"@"+Math.round(B.post.x)+","+Math.round(B.post.y)+","+B.post.z : "-", B.path ? B.path.length + ":" + B.pathIdx : "-", B._fall ? "F"+(B._fall.v0?"up":"dn")+B._fall.zt : "", B._area, B.primary, Math.round(B.curSpeed||0), B._walkWhy||""].join(" "); })()`)); }
    return L.join("\n"); }, [+M, +T0, +T1]);
  console.log(out); await br.close(); })();
