// Сценарии аудита (регрессия): короткие воспроизводимые проверки отдельных механик на одной сборке.
// node src/q.js <сборка.html> "$(cat tools/measure/audit/scenarios.js)"   → JSON {сценарий: {ok, ...}}
// ok = поведение как у живого игрока (после правок аудита). На сборке до правок часть сценариев даёт ok:false — это и есть дефект.
(function(){
  var R = {};
  function setup(){
    freshMatch(3);
    for(var i = 0; i < 5000 && roundState !== "live"; i++) stepTick();
    for(var j = 0; j < 64; j++) stepTick();                // чуть после старта раунда
  }
  function bot(id){ return bots.filter(function(b){ return b.id === id; })[0]; }
  function park(except){                                     // остальных — далеко и «не в деле»
    bots.forEach(function(o){ if(except.indexOf(o) >= 0) return; o.x = o.baseX = (o.team === "CT" ? CT_SPAWN.x : T_SPAWN.x); o.y = o.baseY = (o.team === "CT" ? CT_SPAWN.y : T_SPAWN.y); });
  }
  // открытая пара точек: видно друг друга целиком, 300–500 px
  function openPair(){
    for(var k = 0; k < 4000; k++){
      var a = NAVAREAS[Math.floor(hashRand(k*7+1)*NAVAREAS.length)], c1 = zoneCentroid(a);
      var ang = hashRand(k*13+5)*Math.PI*2, d = 300 + hashRand(k*17+3)*200;
      var c2 = {x: c1.x + Math.cos(ang)*d, y: c1.y + Math.sin(ang)*d};
      if(insideSolidWall(c1.x, c1.y) || insideSolidWall(c2.x, c2.y)) continue;
      if(bzOf(c2.x, c2.y) < 0 || visWallHit(c1.x, c1.y, c2.x, c2.y) || !hasLOS(c1.x, c1.y, c2.x, c2.y)) continue;
      var v = visParts(c1.x, c1.y, false, c2.x, c2.y, false, false), w = visParts(c2.x, c2.y, false, c1.x, c1.y, false, false);
      if(v.head && v.body && w.head && w.body && !smokeBlocks(c1.x, c1.y, c2.x, c2.y)) return [c1, c2];
    }
    return null;
  }

  // 1. Реакция: «держащий», который до этого врага не видел, не стреляет в первый тик контакта (стрельба 2.6)
  try {
    setup(); var ct = bot("CT2"), t = bot("T2"), P = openPair(); park([ct, t]);
    ct.x = ct.baseX = P[0].x; ct.y = ct.baseY = P[0].y; t.x = t.baseX = P[1].x; t.y = t.baseY = P[1].y;
    ct.facing = Math.atan2(t.y-ct.y, t.x-ct.x); ct.curSpeed = 0; t.curSpeed = 0; ct.state = "hold"; ct.holding = true;
    ct.decisionTick = tick + 100000; ct.lastIntel = null; ct._intelPre = null; ct.contactStreak = 0; ct.nextShotTick = 0; ct.blindUntil = 0; ct.throwUntil = 0; ct._knife = false; ct._drawUntil = 0;
    var a0 = ct.ammo, firstShot = null;
    for(var i = 0; i < 64 && firstShot === null; i++){ resolveEngagements(); if(ct.ammo < a0) firstShot = i + 1; if(!t.alive) break; }
    R.reaction_first_contact = {ok: firstShot !== null && firstShot >= Math.round(ct.reactionTicks*BAL.holdReact) - 1, firstShotTick: firstShot, expectAtLeast: Math.round(ct.reactionTicks*BAL.holdReact), dist: Math.round(Math.hypot(t.x-ct.x, t.y-ct.y))};
  } catch(e){ R.reaction_first_contact = {ok: false, err: String(e).slice(0, 200)}; }

  // 2. Обзор: в контакте с одним врагом второй за спиной не виден (стрельба 2.6)
  try {
    setup(); var c = bot("CT2"), a = bot("T2"), b2 = bot("T3"), P2 = null, back = null;
    for(var kk = 0; kk < 3000 && !back; kk++){
      var z0 = NAVAREAS[Math.floor(hashRand(kk*7+11)*NAVAREAS.length)], p0 = zoneCentroid(z0), an0 = hashRand(kk*3+1)*Math.PI*2;
      var pf = {x: p0.x + Math.cos(an0)*320, y: p0.y + Math.sin(an0)*320}, pb = {x: p0.x - Math.cos(an0)*220, y: p0.y - Math.sin(an0)*220};
      var okp = function(q){ return !insideSolidWall(q.x, q.y) && bzOf(q.x, q.y) >= 0 && !visWallHit(p0.x, p0.y, q.x, q.y) && hasLOS(p0.x, p0.y, q.x, q.y) &&
        (function(v){ return v.head && v.body; })(visParts(p0.x, p0.y, false, q.x, q.y, false, false)); };
      if(!insideSolidWall(p0.x, p0.y) && okp(pf) && okp(pb)){ P2 = [p0, pf]; back = pb; }
    }
    if(!back) throw new Error("нет тройки точек");
    park([c, a, b2]);
    c.x = c.baseX = P2[0].x; c.y = c.baseY = P2[0].y; a.x = a.baseX = P2[1].x; a.y = a.baseY = P2[1].y;
    var vb = visParts(c.x, c.y, false, back.x, back.y, false, false);
    b2.x = b2.baseX = back.x; b2.y = b2.baseY = back.y;
    c.facing = Math.atan2(a.y-c.y, a.x-c.x); c.contactStreak = 30; c.blindUntil = 0; a.blindUntil = 0; b2.blindUntil = 0;
    a.facing = Math.atan2(c.y-a.y, c.x-a.x); b2.facing = Math.atan2(c.y-b2.y, c.x-b2.x);
    resolveEngagements(); resolveEngagements();
    var seesBack = (c._visible || []).indexOf(b2) >= 0;
    R.fov_second_enemy_behind = {ok: !seesBack, seesBehind: seesBack, lineOpen: !!(vb.head || vb.body), seesFront: (c._visible || []).indexOf(a) >= 0};
  } catch(e){ R.fov_second_enemy_behind = {ok: false, err: String(e).slice(0, 200)}; }

  // 3. Утечка: гипотеза «слышал здесь», которую бот не сказал, не попадает в общую точку команды (LKP); сказанная в войс — попадает
  //    (память/коммуникация 2.1/2.8). Гипотеза кладётся так, как её кладёт knowApply (heard, htick; voice — откуда)
  try {
    var one = function(viaVoice){
      setup(); var h = bot("CT2"), e = bot("T2"); knowTick();
      while(tick % 16 !== 0) stepTick();
      var B = h.know.enemies[e.id], pt = {x: h.x + 200, y: h.y + 40};
      B.hyps = [{type: "held", zone: B.last.zone, x: B.last.x, y: B.last.y, weight: 0.3},
                {type: "moved", zone: knowZoneAt(pt.x, pt.y), x: pt.x, y: pt.y, route: [knowZoneAt(pt.x, pt.y)], windows: [], weight: 0.6, heard: true, htick: tick, voice: viaVoice},
                {type: "moved_unknown", zone: null, weight: 0.1}];
      bots.forEach(function(o){ if(o !== h && o.team === "CT" && o.know && o.know.enemies[e.id]) o.know.enemies[e.id].hyps.forEach(function(q){ q.heard = false; }); });
      // сборка этапа 2: сказанное в войс попадает и в знание команды (teamAgent) — кладём туда же, как это делает knowCall
      if(viaVoice && typeof teamAgent === "function"){ var TA = teamAgent("CT"); knowTick(); TA.know.enemies[e.id].hyps = B.hyps.map(function(q){ var c = {}; for(var k in q) c[k] = q[k]; return c; }); }
      LKP.CT = {}; beliefTick();
      var L = LKP.CT[e.id]; return !!(L && Math.hypot(L.x-pt.x, L.y-pt.y) < 5);
    };
    var ear = one(false), voice = one(true);
    R.team_lkp_without_voice = {ok: !ear && voice, earReachesTeam: ear, voiceReachesTeam: voice};
  } catch(e){ R.team_lkp_without_voice = {ok: false, err: String(e).slice(0, 200)}; }

  // 4. Дребезг задач: «сейв» перебил лайнап — лайнап не возвращается на следующем тике (позиция/гранаты 2.3/2.7)
  try {
    setup(); var s = bot("CT3"); s.state = "patrol"; s._lineupLock = 0; s.nades.smoke = Math.max(1, s.nades.smoke|0);
    var far = {x: s.x + 600, y: s.y};
    s.nadeTask = {type: "smoke", x: far.x + 100, y: far.y, from: far, until: tick + 640, start: tick, why: "тест", lob: true, range: 900};
    updateNadeTasks(); var t1 = s.post ? s.post.tag : null;
    setPost(s, {x: s.x - 200, y: s.y}, null, true, "save"); var t2 = s.post ? s.post.tag : null;
    tick++; updateNadeTasks(); var t3 = s.post ? s.post.tag : null;
    R.save_over_lineup = {ok: t1 === "lineup" && t2 === "save" && t3 === "save" && !s.nadeTask, tags: [t1, t2, t3]};
  } catch(e){ R.save_over_lineup = {ok: false, err: String(e).slice(0, 200)}; }

  // 5. Выбор места опорника: не меняется в раунде от того, где встали тиммейты (позиция 2.3)
  try {
    setup(); var an = bot("CT2"), mate = bot("CT3"), names = PRO_ROLE.anchorA, seed = roundNum*131 + matchNum*977 + 1;
    var picks = {};
    for(var k = 0; k < 12; k++){
      var CTP = KNOW_POSITIONS.points.filter(function(q){ return q.side === "CT"; }), cz = CTP[(k*7) % CTP.length];
      mate.post = {id: "test" + k, x: cz.x, y: cz.y, tag: "rotate"};
      picks[posPickName(an, names, seed)] = 1;
    }
    R.anchor_pick_stable = {ok: Object.keys(picks).length === 1, distinctPicks: Object.keys(picks).length};
  } catch(e){ R.anchor_pick_stable = {ok: false, err: String(e).slice(0, 200)}; }

  // 6. Смена сайта T: маршрут к старому сайту и граната туда снимаются (план 2.4)
  try {
    setup(); var tt = teamTac.T, tb = bot("T2"), old = tt.site, nw = old === "A" ? "B" : "A";
    tb._route = {key: "test", pts: [{x: SITES[old].x, y: SITES[old].y}], idx: 0, t0: tick, names: ["test"]};
    tb.nadeTask = {type: "smoke", x: SITES[old].x, y: SITES[old].y, until: tick + 640, start: tick, why: "тест"};
    if(typeof tSetSite === "function") tSetSite(tt, nw); else tt.site = nw;   // сборка до правок: смена сайта «как в путях стак/минус»
    var cleared = !tb._route && !tb.nadeTask;
    startRoute(tb, ["Split", "A Stairs"], "test");                             // тактика зовёт тот же маршрут снова — не запускается
    R.site_switch_clears_old = {ok: cleared && !tb._route, route: !cleared && !!tb._route, nade: !!tb.nadeTask, restarted: cleared && !!tb._route, hasOnePlace: typeof tSetSite === "function"};
  } catch(e){ R.site_switch_clears_old = {ok: false, err: String(e).slice(0, 200)}; }

  // 7. HE / молотов не бросается туда, где стоит свой (гранаты 2.7)
  try {
    setup(); var th = bot("CT2"), mt = bot("CT3"); th.nades.he = 1; th.nades.molly = Math.max(1, th.nades.molly|0);
    var tgt = {x: th.x + 300, y: th.y}; mt.x = mt.baseX = tgt.x + 40; mt.y = mt.baseY = tgt.y;
    var heBefore = th.nades.he; throwNade(th, "he", tgt.x, tgt.y, false, "тест"); var heThrown = th.nades.he < heBefore;
    var mBefore = th.nades.molly; throwNade(th, "molly", tgt.x, tgt.y, false, "тест"); var mThrown = th.nades.molly < mBefore;
    mt.x = mt.baseX = tgt.x + 600; th.nades.he = 1; throwNade(th, "he", tgt.x, tgt.y, false, "тест"); var heFree = th.nades.he < 1;
    R.no_nade_on_teammate = {ok: !heThrown && !mThrown && heFree, heOnMate: heThrown, mollyOnMate: mThrown, heWhenClear: heFree};
  } catch(e){ R.no_nade_on_teammate = {ok: false, err: String(e).slice(0, 200)}; }

  return JSON.stringify(R);
})()
