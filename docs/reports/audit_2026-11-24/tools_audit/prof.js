// Замер: время stepTick, профиль по функциям (CDP), память, состояние ботов вокруг событий сторожа (PROB). Игру не меняет.
// node prof.js <sim.html> <match> <ticks> <out.json>
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), url = require('url');
(async()=>{
  const [,, sim, mt, nt, outp] = process.argv;
  const br = await chromium.launch({args:['--js-flags=--expose-gc']}); const pg = await br.newPage();
  await pg.route(/^https?:/, r=>r.abort());
  await pg.goto(url.pathToFileURL(path.resolve(sim)).href); await pg.waitForTimeout(1500);
  await pg.evaluate(src=>__ev(src), `if(typeof WARM!=="undefined"&&WARM.on){WARM={on:false};} paused=true; freshMatch(${+mt}); "ok"`);
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {interval: 250}); await cdp.send('Profiler.start');
  const res = await pg.evaluate(src=>__ev(src), `
    var N=${+nt}, dur=new Float32Array(N), meta=[], mem=[], hist={}, evs=[], seen=PROB.ev.length, M0=matchNum;
    function snap(b){ var p=b.post; return {t:tick, x:Math.round(b.baseX), y:Math.round(b.baseY), z:b.z==null?null:Math.round(b.z), tag:p?String(p.tag):null, px:p?Math.round(p.x):null, py:p?Math.round(p.y):null,
      atPost:!!b.atPost, pl:b.path?b.path.length:0, pi:b.pathIdx, sp:Math.round(b.curSpeed||0), stop:b._stopWhy||null, walk:b._walkWhy||null, st:b.state, hold:!!b.holding, fc:b._fc?b._fc.ph:null,
      saw:!!b._sawEnemy, nade:b.nadeTask?(b.nadeTask.type+":"+(b.nadeTask.runPh||"")):null, thr:Math.max(0,(b.throwUntil||0)-tick), roam:!!b.roamChecking, mv:b._moveWhy||null,
      stuck:b.stuckTicks||0, net:b._netStuck||0, prog:tick-(b._progTick||tick), task:b._task?b._task.tag:null, phase:teamTac.T?teamTac.T.phase:null, dl:(b._dlog||[]).slice(-3).map(function(d){return [d[0],d[1],String(d[2]).slice(0,120)];}) }; }
    var ring={}; var watch=[];
    var hasMem = !!(performance.memory);
    for(var i=0;i<N;i++){
      var t0=performance.now(); stepTick(); var d=performance.now()-t0; dur[i]=d;
      if(d>16) meta.push([i, tick, roundNum, roundState, Math.round(d*10)/10]);
      if(matchNum!==M0) break;
      if(i%320===0 && hasMem) mem.push([i, performance.memory.usedJSHeapSize]);
      if(tick%16===0) bots.forEach(function(b){ if(!b.alive) return; var r=ring[b.id]||(ring[b.id]=[]); r.push(snap(b)); if(r.length>12) r.shift(); });
      while(seen<PROB.ev.length){ var e=PROB.ev[seen++]; if(e.kind==="nav") { evs.push({e:e}); continue; } var b=bots.find(function(o){return o.id===e.id;});
        var rec={e:e, before:(ring[e.id]||[]).slice(), after:[]}; evs.push(rec); watch.push({b:b, rec:rec, until:tick+6*TICK_HZ}); }
      if(tick%16===0) watch=watch.filter(function(w){ if(tick>w.until) return false; if(w.b&&w.b.alive) w.rec.after.push(snap(w.b)); return true; });
      if(PROB.ev.length>350){ PROB.ev.splice(0,300); seen-=300; }
    }
    var s=Array.from(dur.slice(0,i)).sort(function(a,b){return a-b;});
    function q(p){return s[Math.min(s.length-1,Math.floor(p*s.length))];}
    JSON.stringify({ticks:i, endTick:tick, round:roundNum, total:s.reduce(function(a,b){return a+b;},0), p50:q(.5), p90:q(.9), p99:q(.99), p999:q(.999), max:s[s.length-1],
      over16:s.filter(function(x){return x>16;}).length, over50:s.filter(function(x){return x>50;}).length, slow:meta.slice(0,200), mem:mem, prob:PROB.n, evs:evs, dur:Array.from(dur.slice(0,i)).map(function(x){return Math.round(x*100)/100;})});
  `);
  const {profile} = await cdp.send('Profiler.stop');
  const R = JSON.parse(res);
  // self time by function (name:url:line)
  const self = {}; const byId = new Map(); profile.nodes.forEach(n=>byId.set(n.id,n));
  const dt = profile.timeDeltas; const cnt = {};
  profile.samples.forEach((id,k)=>{ cnt[id]=(cnt[id]||0)+(dt[k]||0); });
  for(const [id,us] of Object.entries(cnt)){ const n=byId.get(+id); const cf=n.callFrame; const key=(cf.functionName||'(anon)')+':'+(cf.lineNumber+1); self[key]=(self[key]||0)+us/1000; }
  // inclusive by function name
  const parent=new Map(); profile.nodes.forEach(n=>(n.children||[]).forEach(c=>parent.set(c,n.id)));
  const incl={};
  for(const [id,us] of Object.entries(cnt)){ const seenN=new Set(); let cur=+id; while(cur!=null){ const n=byId.get(cur); const nm=n.callFrame.functionName||'(anon)'; if(!seenN.has(nm)){ incl[nm]=(incl[nm]||0)+us/1000; seenN.add(nm);} cur=parent.get(cur); } }
  R.self = Object.entries(self).sort((a,b)=>b[1]-a[1]).slice(0,60);
  R.incl = Object.entries(incl).sort((a,b)=>b[1]-a[1]).slice(0,80);
  fs.writeFileSync(outp, JSON.stringify(R));
  console.log(JSON.stringify({ticks:R.ticks, round:R.round, total:Math.round(R.total), p50:R.p50, p90:R.p90, p99:R.p99, p999:R.p999, max:R.max, over16:R.over16, over50:R.over50, prob:R.prob, evs:R.evs.length}));
  await br.close();
})();
