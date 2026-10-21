// (v397, М146) замер кадра страницы: время по функциям кадра + профиль Chrome. node tools/measure/frame_prof.js sim.html <сек> <out.json> [матч]; отчёт — python3 tools/measure/frame_rep.py <out.json>
// запуск: <sim.html> <seconds> <out.json> [match]
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), url = require('url');
(async()=>{
  const [,, sim, secs, outp, mt] = process.argv;
  const br = await chromium.launch(); const pg = await br.newPage({viewport:{width:1600, height:900}});
  await pg.route(/^https?:/, r=>r.abort());
  await pg.goto(url.pathToFileURL(path.resolve(sim)).href); await pg.waitForTimeout(1500);
  const setup = `
    if(typeof WARM !== "undefined" && WARM.on){ WARM = {on:false}; }
    freshMatch(${+(mt||7)}); paused = false; lastFrame = null; accumulator = 0;
    var P = window.__P = {fr:[], cur:null};
    window.__wrap = function(f, n){ return function(){ var t0 = performance.now(); try{ return f.apply(this, arguments); } finally{ var d = performance.now()-t0; if(P.cur){ P.cur[n] = (P.cur[n]||0) + d; } } }; };
    ["stepTick","mkAfterTicks","mkCheckpoint","obsFrame","draw","obsOverlay","miniDraw","playersUpdate","scoreboardUpdate","renderEcon","renderVoice","renderFeed","sndFireTick"].forEach(function(n){ try{ if(eval("typeof "+n) === "function") eval(n+" = __wrap("+n+", '"+n+"')"); }catch(e){} });
    P.slow = []; var __st = stepTick; stepTick = function(){ var t0 = performance.now(), rs = roundState, rn = roundNum; var r = __st.apply(this, arguments); var d = performance.now()-t0; if(d > 40 && P.slow.length < 40) P.slow.push([Math.round(d), tick, rn, rs, roundState]); return r; };
    var __of = frame; frame = function(ts){ var t0 = performance.now(); P.cur = {}; try{ return __of(ts); } finally{ P.cur.total = performance.now()-t0; P.cur.ts = ts; P.cur.tick = tick; P.fr.push(P.cur); P.cur = null; } };
    "ok"`;
  console.log(await pg.evaluate(src=>__ev(src), setup));
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {interval: 200}); await cdp.send('Profiler.start');
  await pg.waitForTimeout((+secs||30)*1000);
  const {profile} = await cdp.send('Profiler.stop');
  const fr = await pg.evaluate(()=>window.__P.fr);
  // self time by function
  const byId = new Map(); profile.nodes.forEach(n=>byId.set(n.id, n));
  const self = {}; const dts = profile.timeDeltas; let tot = 0;
  profile.samples.forEach((id, i)=>{ const n = byId.get(id); const k = (n.callFrame.functionName||"(anon)") + ":" + n.callFrame.lineNumber; const d = dts[i]||0; self[k] = (self[k]||0) + d; tot += d; });
  const parent = new Map(); profile.nodes.forEach(n=>(n.children||[]).forEach(c=>parent.set(c, n.id)));
  const nat = {}; profile.samples.forEach((id, i)=>{ const n = byId.get(id); const fn = n.callFrame.functionName; if(!/^(fillText|getBoundingClientRect|measureText|stroke|fill|drawImage|arc)$/.test(fn)) return;
    let p = byId.get(parent.get(id)); const k = fn + " <- " + (p ? (p.callFrame.functionName||"anon")+":"+p.callFrame.lineNumber : "?"); nat[k] = (nat[k]||0) + (dts[i]||0); });
  const natTop = Object.entries(nat).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([k,v])=>[k, +(v/1000).toFixed(1)]);
  const top = Object.entries(self).sort((a,b)=>b[1]-a[1]).slice(0,40).map(([k,v])=>[k, +(v/1000).toFixed(1)]);
  fs.writeFileSync(outp, JSON.stringify({fr, top, natTop, totMs: tot/1000, slow: await pg.evaluate(()=>window.__P.slow)}));
  await br.close();
})();
