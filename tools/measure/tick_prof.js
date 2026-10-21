// (v397, М146) профиль тиков игры без рисования: доли функций (включительно / собственное). node tools/measure/tick_prof.js sim.html <матч> <тиков> <out.json>
// запуск: <sim.html> <match> <ticks> <out.json>
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), url = require('url');
(async()=>{
  const [,, sim, mt, nt, outp] = process.argv;
  const br = await chromium.launch(); const pg = await br.newPage();
  await pg.route(/^https?:/, r=>r.abort());
  await pg.goto(url.pathToFileURL(path.resolve(sim)).href); await pg.waitForTimeout(1200);
  await pg.evaluate(src=>__ev(src), `paused = true; freshMatch(${mt}); while(roundState !== "live") stepTick(); "ok"`);
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {interval: 250}); await cdp.send('Profiler.start');
  const ms = await pg.evaluate(src=>__ev(src), `var t0 = performance.now(); for(var i = 0; i < ${nt}; i++) stepTick(); performance.now() - t0`);
  const {profile} = await cdp.send('Profiler.stop');
  const byId = new Map(); profile.nodes.forEach(n=>byId.set(n.id, n));
  const parent = new Map(); profile.nodes.forEach(n=>(n.children||[]).forEach(c=>parent.set(c, n.id)));
  const incl = {}, self = {}; let tot = 0;
  profile.samples.forEach((id, i)=>{ const d = profile.timeDeltas[i]||0; tot += d; const seen = new Set(); let cur = id, first = true;
    while(cur != null){ const n = byId.get(cur); const k = (n.callFrame.functionName||"anon")+":"+n.callFrame.lineNumber;
      if(first){ self[k] = (self[k]||0) + d; first = false; }
      if(!seen.has(k)){ incl[k] = (incl[k]||0) + d; seen.add(k); } cur = parent.get(cur); } });
  const f = o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,45).map(([k,v])=>[k, +(100*v/tot).toFixed(1)]);
  fs.writeFileSync(outp, JSON.stringify({ms, perTick: ms/nt, incl: f(incl), self: f(self)}, null, 0));
  await br.close();
})();
