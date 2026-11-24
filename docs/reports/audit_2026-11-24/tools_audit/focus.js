// Причина медленного окна: доиграть матч до T0 без профиля, профиль и состояние ботов на [T0, T1]. Игру не меняет.
// node focus.js <sim.html> <match> <T0> <T1> <out.json>
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), url = require('url');
(async()=>{
  const [,, sim, mt, t0, t1, outp] = process.argv;
  const br = await chromium.launch(); const pg = await br.newPage();
  await pg.route(/^https?:/, r=>r.abort());
  await pg.goto(url.pathToFileURL(path.resolve(sim)).href); await pg.waitForTimeout(1500);
  await pg.evaluate(src=>__ev(src), `if(typeof WARM!=="undefined"&&WARM.on){WARM={on:false};} paused=true; freshMatch(${+mt}); while(tick < ${+t0}-1) stepTick(); "ok"`);
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {interval: 200}); await cdp.send('Profiler.start');
  const res = await pg.evaluate(src=>__ev(src), `
    var out=[]; 
    function st(b){ var t=b.nadeTask; return {id:b.id, alive:b.alive, tag:b.post?String(b.post.tag):null, nade:t?{type:t.type, why:String(t.why||"").slice(0,80), from:!!t.from, runPh:t.runPh||null, runFail:!!t.runFail, here:!!t.here, hereTried:!!t._hereTried, spotTried:!!t._spotTried, until:t.until-tick}:null, q:b.nadeQueue?b.nadeQueue.length:0, sp:Math.round(b.curSpeed||0), st:b.state, stop:b._stopWhy||null, x:Math.round(b.x), y:Math.round(b.y)}; }
    while(tick < ${+t1}){ var n0=NADE_SOLVE_MS.length, a=performance.now(); stepTick(); var d=performance.now()-a;
      out.push({tick:tick, ms:Math.round(d), solves:NADE_SOLVE_MS.length-n0, solveMs:NADE_SOLVE_MS.slice(n0).map(function(x){return Math.round(x);}), fail:typeof NADE_FAIL!=="undefined"?String(NADE_FAIL||"").slice(0,90):null, rs:roundState, round:roundNum}); }
    JSON.stringify({ticks:out, bots:bots.map(st), phase:teamTac.T&&teamTac.T.phase, site:teamTac.T&&teamTac.T.site, bomb:bomb&&bomb.state});
  `);
  const {profile} = await cdp.send('Profiler.stop');
  const R = JSON.parse(res);
  const byId = new Map(); profile.nodes.forEach(n=>byId.set(n.id,n)); const parent=new Map(); profile.nodes.forEach(n=>(n.children||[]).forEach(c=>parent.set(c,n.id)));
  const cnt={}; profile.samples.forEach((id,k)=>{ cnt[id]=(cnt[id]||0)+(profile.timeDeltas[k]||0); });
  const incl={}, self={};
  for(const [id,us] of Object.entries(cnt)){ const n=byId.get(+id); const nm0=(n.callFrame.functionName||'(anon)')+':'+(n.callFrame.lineNumber+1); self[nm0]=(self[nm0]||0)+us/1000;
    const seen=new Set(); let cur=+id; while(cur!=null){ const m=byId.get(cur); const nm=m.callFrame.functionName||'(anon)'; if(!seen.has(nm)){ incl[nm]=(incl[nm]||0)+us/1000; seen.add(nm);} cur=parent.get(cur); } }
  R.incl=Object.entries(incl).sort((a,b)=>b[1]-a[1]).slice(0,60); R.self=Object.entries(self).sort((a,b)=>b[1]-a[1]).slice(0,25);
  fs.writeFileSync(outp, JSON.stringify(R)); console.log("done", R.ticks.length); await br.close();
})();
