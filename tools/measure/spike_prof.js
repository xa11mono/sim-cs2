// (док 5, п.6 «зависания») редкие долгие тики игры (без рисования): какие функции съели время именно в долгом тике.
//   node tools/measure/spike_prof.js sim.html <матч> <тиков> <out.json> [--ms=25]
// Оборачивает функции игры верхнего уровня (все function-объявления окна), считает время каждой в тике; тик дольше --ms —
// пишется с разбором (собственное время функций, топ-12) и что шло в игре (раунд, фаза, бомба).
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), url = require('url');
(async()=>{
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const opt = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
  const [sim, mt, nt, outp] = args, lim = +(opt.ms || 25);
  const br = await chromium.launch(); const pg = await br.newPage();
  await pg.route(/^https?:/, r=>r.abort());
  await pg.goto(url.pathToFileURL(path.resolve(sim)).href); await pg.waitForFunction(() => typeof window.__ev === 'function', null, {timeout: 60000});
  const res = await pg.evaluate(([mt, nt, lim]) => window.__ev('(' + function(mt, nt, lim){
    paused = true; freshMatch(mt);
    var names = ["buildWaypointPath","zoneDijkstra","funnel","pathPts","pathLenTo","rebuildNav","throwNade","nadeThrowSpot","nadeArc","lineupTick","updateNadeTasks",
      "nadeBrains","nadeUseTick","teamNadePlan","pickSpots","bombTick","holdSpot","holdCands","computeZoneDanger","visLine","visParts","hasLOS","m3Line","resolveEngagements",
      "tBrain","ctBrain","teamBrains","contactTick","lookArbiter","lookCands","beliefTick","knowTick","teamTick","updatePost","routeTick","assignNewDestination",
      "decideAction","findCover","fightCycleTick","smokeSpamTick","nadesTick","detonate","applyDamage","pickSaveSpot","updateRetake","bombFleePoint","stagePost",
      "tIglReplan","posPickName","chooseTactic","buyPhase","endRound","resetRound","mkCheckpoint","probTick","lurkerBrain","selfNadeTick","nadeReact","ctDelayNade",
      "prePeekTick","cornerLook","smoothLookFilter","lookPlan","threatEntrances","beliefBuild","intelEstimate","knowEnemySpots","updateRoamer","tFallbackTick","navAtLevel",
      "ladderTick","inFire","emitSound","hearReal","itemPickupTick","knifeTick","afterKillMove","updateReload","tryShoot"];
    var T = {}, stack = [];
    names.forEach(function(n){ var f; try{ f = eval(n); }catch(e){ return; } if(typeof f !== "function") return;
      var w = function(){ var t0 = performance.now(); stack.push(0); try{ return f.apply(this, arguments); } finally{ var d = performance.now()-t0, ch = stack.pop(); T[n] = (T[n]||0) + d - ch; if(stack.length) stack[stack.length-1] += d; } };
      try{ eval(n + " = w"); }catch(e){} });
    var slow = [], all = [], tot = {};
    for(var i = 0; i < nt; i++){
      T = {}; var rs = roundState, t0 = performance.now(); stepTick(); var d = performance.now() - t0; all.push(d);
      for(var k in T) tot[k] = (tot[k]||0) + T[k];
      if(d > lim){ var top = Object.keys(T).map(function(k){ return [k, Math.round(T[k]*10)/10]; }).sort(function(a, b){ return b[1]-a[1]; }).slice(0, 12);
        slow.push({ms: Math.round(d), tick: tick, round: roundNum, state: rs + "→" + roundState, bomb: bomb && bomb.state, top: top}); }
      if(roundState === "matchover") break;
    }
    all.sort(function(a, b){ return a-b; });
    var q = function(p){ return Math.round(all[Math.floor(p*(all.length-1))]*100)/100; };
    return {ticks: all.length, p50: q(0.5), p99: q(0.99), p999: q(0.999), max: q(1), nSlow: slow.length,
      tot: Object.keys(tot).map(function(k){ return [k, Math.round(tot[k])]; }).sort(function(a, b){ return b[1]-a[1]; }).slice(0, 25), slow: slow};
  } + ')')(mt, nt, lim), [+mt, +nt, lim]);
  fs.writeFileSync(outp, JSON.stringify(res));
  console.log('тиков', res.ticks, 'p50', res.p50, 'p99', res.p99, 'p99.9', res.p999, 'max', res.max, 'долгих >' + lim + ' мс:', res.nSlow);
  await br.close();
})();
