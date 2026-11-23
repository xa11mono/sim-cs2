const { chromium } = require('playwright'); const path = require('path');
(async () => { const [sim, N] = process.argv.slice(2);
  const br = await chromium.launch(); const pg = await br.newPage(); await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + path.resolve(sim)); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  const out = await pg.evaluate((N) => {
    window.__ev('freshMatch(3)'); for(let i = 0; i < 1100; i++) window.__ev('stepTick()');
    var info = window.__ev(`(function(){ var B = teamBot("T2"); SANDBOX.on = true;  bots.forEach(function(o){ if(o !== B) sbRemove(o); });
      var plantPt = null;
      var zc = {x:1733,y:574}; B._sbWalk = null; B.crouching = false; B.x = B.baseX = zc.x; B.y = B.baseY = zc.y; var a = navAt(zc.x, zc.y); B.z = a ? navFloorZ(a,zc.x,zc.y) : B.z; B._area = a ? a.id : B._area; B.path = []; B.pathIdx = 0;
      var fp = {x:1778, y:692}; window.__FP = fp; window.__PP = plantPt; B._sbGo = {x: 1778, y: 692, z: -162, look: null};
      return JSON.stringify([fp, plantPt, B.z]); })()`);
    var L = [info];
    for(let i = 0; i < N; i++){ window.__ev(`stepTick();`);
      if(i % 8 === 0) L.push(window.__ev(`(function(){ var B = teamBot("T2"); return [tick, B.x.toFixed(1), B.y.toFixed(1), Math.round(B.z), B.path ? B.path.length + ":" + B.pathIdx : "-", B.atPost ? 1 : 0, Math.round(B.curSpeed||0), B.post ? B.post.tag+"@"+Math.round(B.post.x)+","+Math.round(B.post.y) : "-", B._walkWhy||"", B.path && B.path.length ? Math.round(B.path[B.path.length-1].x)+","+Math.round(B.path[B.path.length-1].y) : ""].join(" "); })()`)); }
    return L.join("\n"); }, +N);
  console.log(out); await br.close(); })();
