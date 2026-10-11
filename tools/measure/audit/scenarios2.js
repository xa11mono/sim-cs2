// Сценарии этапа 2 (регрессия): node src/q.js <сборка.html> "$(cat tools/measure/audit/scenarios2.js)" → JSON {сценарий: {ok, ...}}
// ok = поведение как у живого игрока (цель этапа 2). Сборка до правок этапа 2 часть из них не проходит — это и есть дефект.
(function(){
  var R = {};
  function setup(){ freshMatch(3); for(var i = 0; i < 5000 && roundState !== "live"; i++) stepTick(); for(var j = 0; j < 64; j++) stepTick(); }
  function bot(id){ return bots.filter(function(b){ return b.id === id; })[0]; }
  function park(except){ bots.forEach(function(o){ if(except.indexOf(o) >= 0) return; o.x = o.baseX = (o.team === "CT" ? CT_SPAWN.x : T_SPAWN.x); o.y = o.baseY = (o.team === "CT" ? CT_SPAWN.y : T_SPAWN.y); }); }
  function put(b, p){ b.x = b.baseX = p.x; b.y = b.baseY = p.y; b.px = p.x; b.py = p.y; b.curSpeed = 0; }
  function open(p0, q){ if(insideSolidWall(q.x, q.y) || bzOf(q.x, q.y) < 0 || visWallHit(p0.x, p0.y, q.x, q.y) || !hasLOS(p0.x, p0.y, q.x, q.y)) return false;
    var v = visParts(p0.x, p0.y, false, q.x, q.y, false, false), w = visParts(q.x, q.y, false, p0.x, p0.y, false, false); return v.head && v.body && w.head && w.body && !smokeBlocks(p0.x, p0.y, q.x, q.y); }
  // стрелок, враг A в 380 px, враг B в 160 px чуть в стороне (в поле зрения); все линии открыты
  function triple(){
    for(var k = 0; k < 4000; k++){
      var z = NAVAREAS[Math.floor(hashRand(k*7+11)*NAVAREAS.length)], p0 = zoneCentroid(z), an = hashRand(k*3+1)*Math.PI*2;
      var a = {x: p0.x + Math.cos(an)*380, y: p0.y + Math.sin(an)*380}, b = {x: p0.x + Math.cos(an+0.35)*160, y: p0.y + Math.sin(an+0.35)*160};
      if(!insideSolidWall(p0.x, p0.y) && open(p0, a) && open(p0, b)) return {s: p0, a: a, b: b, an: an};
    }
    throw new Error("нет геометрии");
  }
  function prep(s){ s.decisionTick = tick + 100000; s.state = "hold"; s.holding = true; s.nextShotTick = 0; s.blindUntil = 0; s.throwUntil = 0; s._knife = false; s._drawUntil = 0; s.ammo = 30; s._reloading = false; }
  function shotAt(s, tgt, maxT){ // тиков до первого выстрела по tgt
    var a0 = s.ammo; for(var i = 1; i <= maxT; i++){ resolveEngagements(); tick++; if(s.ammo < a0 && s._tgt === tgt) return i; if(s.ammo < a0) a0 = s.ammo; if(!tgt.alive) return null; } return null; }

  // P0-2 (а) неожиданный первый контакт — см. сценарий 1 первого аудита (scenarios.js)
  // P0-2 (б) неожиданная вторая цель во время перестрелки: по B — полная реакция, не «бесплатно»
  try {
    setup(); var s = bot("CT2"), A = bot("T2"), B = bot("T3"), G = triple(); park([s, A, B]);
    put(s, G.s); put(A, G.a); put(B, {x: G.s.x - Math.cos(G.an)*2000, y: G.s.y - Math.sin(G.an)*2000});   // B пока далеко
    prep(s); s.facing = G.an; s.lastIntel = null; s._intelPre = null; s.contactStreak = 0; s._ts = {};
    A.hp = 100000; B.hp = 100000;                       // никто не умирает — меряем только время
    for(var i = 0; i < 40; i++){ resolveEngagements(); tick++; }   // идёт перестрелка с A
    put(B, G.b); B.facing = Math.atan2(G.s.y-G.b.y, G.s.x-G.b.x);
    var react = Math.round(s.reactionTicks*BAL.holdReact), t2 = shotAt(s, B, 64);
    R.second_target_unexpected = {ok: t2 !== null && t2 >= react - 2, ticksToShotB: t2, reactTicks: react, streakA: s.contactStreak};
  } catch(e){ R.second_target_unexpected = {ok: false, err: String(e).slice(0, 200)}; }

  // P0-2 (в) известная цель на миг пропала (3 тика) и вернулась — без искусственной задержки
  try {
    setup(); var s2 = bot("CT2"), A2 = bot("T2"), G2 = triple(); park([s2, A2]);
    put(s2, G2.s); put(A2, G2.a); prep(s2); s2.facing = G2.an; s2.lastIntel = null; s2._intelPre = null; s2.contactStreak = 0; s2._ts = {}; A2.hp = 100000;
    for(var j = 0; j < 40; j++){ resolveEngagements(); tick++; }
    put(A2, {x: G2.s.x + 3000, y: G2.s.y}); for(var k2 = 0; k2 < 3; k2++){ resolveEngagements(); tick++; }
    put(A2, G2.a); s2.nextShotTick = 0;
    var t3 = shotAt(s2, A2, 64);
    var react2 = Math.round(s2.reactionTicks*BAL.holdReact);
    R.known_target_reappears = {ok: t3 !== null && t3 < react2, ticksToShot: t3, reactTicks: react2};   // быстрее полной реакции (темп стрельбы — отдельно)
  } catch(e){ R.known_target_reappears = {ok: false, err: String(e).slice(0, 200)}; }

  // P0-2 (г) цель потеряна прямо перед контактом (0,3 с назад) — держащий угол стреляет по памяти быстрее полной реакции
  try {
    setup(); var s3 = bot("CT2"), A3 = bot("T2"), G3 = triple(); park([s3, A3]);
    put(s3, G3.s); put(A3, G3.a); prep(s3); s3.facing = G3.an; s3.lastIntel = null; s3._intelPre = null; s3.contactStreak = 0; s3._ts = {}; A3.hp = 100000;
    for(var j3 = 0; j3 < 40; j3++){ resolveEngagements(); tick++; }
    put(A3, {x: G3.s.x + 3000, y: G3.s.y}); for(var k3 = 0; k3 < 20; k3++){ resolveEngagements(); tick++; }
    put(A3, G3.a); s3.nextShotTick = 0; s3.holding = true; s3.state = "hold";
    var react3 = Math.round(s3.reactionTicks*BAL.holdReact), t4 = shotAt(s3, A3, 64);
    R.target_lost_just_before = {ok: t4 !== null && t4 < react3, ticksToShot: t4, reactTicks: react3};
  } catch(e){ R.target_lost_just_before = {ok: false, err: String(e).slice(0, 200)}; }

  // ---------- P1-2: карта команды (belief) — только из того, что команда знает вся ----------
  function mid(){ setup(); for(var w = 0; w < 25*TICK_HZ && roundState === "live"; w++) stepTick(); if(roundState !== "live") throw new Error("раунд кончился"); }
  function hiddenT(){ return bots.filter(function(e){ return e.team === "T" && e.alive && !bots.some(function(m){ return m.team === "CT" && m.alive && (m._visible||[]).indexOf(e) >= 0; }); })[0]; }
  function massAt(eid, x, y){ var zi = bzOf(x, y), Q = belief.CT[eid]; return zi >= 0 && Q ? Q[zi] : 0; }
  function upd(n){ for(var i = 0; i < n; i++){ tick++; knowTick(); beliefTick(); } }
  function voiceSay(h, zone){ var T = teamOf("CT"); teamPropose(h, {kind: "hear", zone: zone, sound: "steps", count: 1});
    for(var i = 0; i < 400; i++){ tick++; teamChannel(T); if(T.threats[zone] && T.threats[zone].by === h.id) return true; } return false; }
  try {
    var run = function(mode){   // mode: "ctl" — ничего, "ear" — слышал и молчит, "voice" — сказал
      mid(); var h = bots.filter(function(b){ return b.team === "CT" && b.alive; })[0], e = hiddenT(); if(!e) throw new Error("все T на радаре");
      var pt = {x: e.x, y: e.y}, z = knowZoneAt(pt.x, pt.y);
      if(mode === "ear") hearReal(h, {x: pt.x, y: pt.y, tick: tick, team: "T", src: e.id, kind: "steps", occl: true});
      if(mode === "voice"){ hearReal(h, {x: pt.x, y: pt.y, tick: tick, team: "T", src: e.id, kind: "steps", occl: true}); knowTick(); voiceSay(h, z); }
      else for(var i = 0; i < 60; i++){ tick++; }
      upd(32); return {m: massAt(e.id, pt.x, pt.y), eid: e.id, Q: Array.prototype.slice.call(belief.CT[e.id] || [])};
    };
    var c = run("ctl"), ear = run("ear"), vo = run("voice");
    var tv = 0; c.Q.forEach(function(v, i){ tv += Math.abs(v - (ear.Q[i] || 0)); });   // насколько изменилась вся карта по этому врагу
    R.belief_heard_not_said = {ok: tv < 1e-6, mapChange: +tv.toFixed(4)};
    R.belief_said_in_voice = {ok: vo.m > c.m + 0.02, control: +c.m.toFixed(3), voiced: +vo.m.toFixed(3)};
  } catch(e){ R.belief_heard_not_said = {ok: false, err: String(e).slice(0, 200)}; }
  try {   // свой видит врага — по радару команда знает точно
    setup(); var ct = bot("CT2"), tt2 = bot("T2"), G5 = triple(); park([ct, tt2]); put(ct, G5.s); put(tt2, G5.a); ct.facing = G5.an; ct.blindUntil = 0;
    while(tick % 16 !== 15) tick++;
    resolveEngagements(); upd(1);
    R.belief_radar_seen = {ok: massAt(tt2.id, tt2.x, tt2.y) > 0.8, mass: +massAt(tt2.id, tt2.x, tt2.y).toFixed(3)};
  } catch(e){ R.belief_radar_seen = {ok: false, err: String(e).slice(0, 200)}; }
  try {   // сказанное со временем «растекается»: вес в названной зоне падает без новой инфы
    mid(); var h6 = bots.filter(function(b){ return b.team === "CT" && b.alive; })[0], e6 = hiddenT(), p6 = {x: e6.x, y: e6.y};
    hearReal(h6, {x: p6.x, y: p6.y, tick: tick, team: "T", src: e6.id, kind: "steps", occl: true}); knowTick(); voiceSay(h6, knowZoneAt(p6.x, p6.y));
    upd(32); var m1 = massAt(e6.id, p6.x, p6.y); upd(20*TICK_HZ); var m2 = massAt(e6.id, p6.x, p6.y);
    // данных о том, как быстро сказанное должно «устаревать», нет — сценарий фиксирует поведение (P1-3), а не требование
    R.belief_stale_decays = {ok: true, info: "только запись", after2s: +m1.toFixed(3), after22s: +m2.toFixed(3)};
  } catch(e){ R.belief_stale_decays = {ok: false, err: String(e).slice(0, 200)}; }

  // ---------- P2-2: своя флешка (только запись: данных про об ослеплении своих нет) ----------
  try {
    setup(); var th = bot("T2"), mt = bot("T3"), en = bot("CT2"), G7 = triple(); park([th, mt, en]);
    put(th, G7.s); var pt = G7.a; put(mt, G7.b); put(en, {x: G7.b.x + 30, y: G7.b.y + 30});
    var face = function(o){ o.facing = Math.atan2(pt.y-o.y, pt.x-o.x); o.blindUntil = 0; };
    face(mt); face(en); face(th);
    detonate({type: "flash", x: pt.x, y: pt.y, team: "T", thrower: th, why: "тест", aware: {}});
    var bl = function(o){ return +Math.max(0, ((o.blindUntil||0) - tick)/TICK_HZ).toFixed(2); };
    R.flash_teammate_record = {ok: true, info: "только запись", mateBlindSec: bl(mt), enemyBlindSec: bl(en), throwerBlindSec: bl(th),
      note: "свой слепнет ×0,18 всегда — колла «флешу» в войсе нет"};
  } catch(e){ R.flash_teammate_record = {ok: false, err: String(e).slice(0, 200)}; }

  // ---------- P1-1: после смены сайта группа не ждёт на точке подготовки старого сайта ----------
  try {
    var found = null; freshMatch(3);
    for(var i9 = 0; i9 < 200000 && !found; i9++){
      stepTick();
      var tt9 = teamTac.T;
      if(roundState === "live" && tick - roundStartTick === 6*TICK_HZ && tt9 && tt9.tac && tt9.tac.groups && tt9.phase === "setup" &&
         tt9.tac.groups.some(function(G){ return G.stage && G.stage !== "TMID"; }) && !tt9.defUntil) found = roundNum;
    }
    if(!found) throw new Error("нет раунда с тактикой групп");
    var T9 = teamTac.T, old9 = T9.site, nw9 = old9 === "A" ? "B" : "A";
    if(typeof tSetSite === "function") tSetSite(T9, nw9); else T9.site = nw9;
    for(var k9 = 0; k9 < 3*TICK_HZ; k9++) stepTick();
    var bad = bots.filter(function(b){ return b.team === "T" && b.alive && b.tRole !== "lurker" && b.post && /^stage/.test(b.post.tag) &&
      Math.hypot(b.post.x-SITES[old9].x, b.post.y-SITES[old9].y) < Math.hypot(b.post.x-SITES[nw9].x, b.post.y-SITES[nw9].y); });
    R.switch_no_old_staging = {ok: bad.length === 0, round: found, oldSite: old9, waitingAtOld: bad.map(function(b){ return b.id + ":" + b.post.tag; })};
  } catch(e){ R.switch_no_old_staging = {ok: false, err: String(e).slice(0, 200)}; }

  return JSON.stringify(R);
})()
