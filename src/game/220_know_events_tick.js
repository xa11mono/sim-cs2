// ---------- войс: что тиммейт договорил в канале (teamChannel) ----------
// Фраза говорит «где (зона) и сколько»; «кто» — только во «меня убил …» (киллфид называет убийцу)
function knowCall(b, msg){
  var K = b.know; if(!K) return;
  var say = "войс " + msg.by + ": «" + msg.text + "»";
  if(msg.kind === "plant"){
    if(!K.planted) K.plantHeard = msg.site;
    else if(!K.plantSite){ K.plantSite = msg.site; knowPlantShift(K, msg.site); }
    return;
  }
  if(msg.kind === "defuse"){ K.defuseT = tick; return; }
  if(!msg.zone) return;
  var g = knowGraph(), c = g.c[msg.zone]; if(!c) return;
  knowApply(b, {x: c.x, y: c.y, kind: "voice"}, g.r[msg.zone] + 60, msg.zone, KNOW.voiceL[msg.kind],
            {say: say, voice: true, mult: msg.count || 1, only: msg.enemy});
}
// «проверил — пусто» тиммейта (войс) или свой взгляд: гипотезы в этой зоне слабеют
function knowClearZone(team, x, y, eidOnly){
  var zid = knowZoneAt(x, y), key = matchNum + ":" + roundNum; if(!zid) return;
  bots.concat(teamAgents()).forEach(function(m){
    if(!m.alive || m.team !== team || !m.know || m.know.key !== key) return;
    for(var id in m.know.enemies){
      if(eidOnly && id !== eidOnly) continue;
      var B = m.know.enemies[id], hit = false; if(B.visible) continue;
      B.hyps.forEach(function(h){ if(h.type !== "moved_unknown" && h.zone === zid){ h.weight *= KNOW.emptyLook; hit = true; } });
      if(hit) knowNorm(B.hyps);
    }
  });
}
// довод «кто-то из врагов вот здесь» — общий для звука и войса
function knowApply(b, s, err, zone, L, opt){
  var K = b.know, g = knowGraph();
  if(zone && K.spots) K.spots.forEach(function(p){ if(p.zone === zone) p.open = true; });
  var vis = 0;
  (b._visible || []).forEach(function(e){ if(Math.hypot(e.x-s.x, e.y-s.y) <= err + 30) vis++; });
  if(vis >= (opt.mult || 1)) return;
  var expl = {}, tot = 0;
  for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible || (opt.only && id !== opt.only)) continue;
    var reach = (tick - B.last.tick)/TICK_HZ*SPEED + err + 60, ex = 0;
    if(Math.hypot(s.x-B.last.x, s.y-B.last.y) > reach){ expl[id] = 0; continue; }
    B.hyps.forEach(function(h){ h._c = knowCompat(h, s, err, g); ex += h.weight*h._c; });
    expl[id] = ex; tot += ex;
  }
  if(tot <= 0) return;
  for(var id2 in expl){
    var r = Math.min(1, expl[id2]/tot*(opt.mult || 1)); if(r < 0.02) continue;
    var B2 = K.enemies[id2], un = knowHyp(B2, "moved_unknown"), specific = false;
    var ls = B2.lastSound, same = !opt.voice && ls && tick - ls.tick <= KNOW.sameSource*TICK_HZ &&
             Math.hypot(ls.x-s.x, ls.y-s.y) <= err + 100 && KNOW.soundL[s.kind] <= KNOW.soundL[ls.kind];
    if(!opt.voice) B2.lastSound = {x: s.x, y: s.y, tick: tick, kind: same ? ls.kind : s.kind};
    var mOk = 0, mNo = 0;
    B2.hyps.forEach(function(h){ if(h._c > 0) mOk += h.weight*h._c; else mNo += h.weight; });
    var move = same ? 0 : r*L;
    B2.hyps.forEach(function(h){
      if(h._c > 0){
        if(mOk > 0) h.weight += move*mNo*(h.weight*h._c/mOk);
        if(h.type !== "moved_unknown") specific = true;
        if(h.heard && zone){ h.x = s.x; h.y = s.y; h.zone = h.route[0] = zone; h.inView = false; h.htick = tick; h.voice = !!opt.voice; }
      } else h.weight *= 1 - move;
    });
    if(same && specific){ knowNorm(B2.hyps); continue; }
    if(!specific && un && zone){
      var take = r*L*(same ? 0.5 : 1);
      B2.hyps.forEach(function(h){ h.weight *= 1 - take; });
      B2.hyps.splice(B2.hyps.length-1, 0, {type: "moved", zone: zone, x: s.x, y: s.y, route: [zone], windows: [], weight: take, heard: true, htick: tick, voice: !!opt.voice});
      knowTrim(B2);
    }
    knowNorm(B2.hyps);
    if(!same) knowTrace(b, id2, opt.say + " (" + knowZoneName(zone) + "), доля " + r.toFixed(2));
  }
}
function knowCompat(h, s, err, g){
  if(h.type === "moved_unknown") return KNOW.unknownCompat;
  if(h.type === "held") return h.x !== undefined && Math.hypot(h.x-s.x, h.y-s.y) <= err + 60 ? 1 : (h.x === undefined && h.zone === knowZoneAt(s.x, s.y) ? 1 : 0);
  if(h.heard) return Math.hypot(h.x-s.x, h.y-s.y) <= err + 80 ? 1 : 0;
  for(var i = 0; i < h.route.length; i++){
    var c = g.c[h.route[i]];
    if(Math.hypot(c.x-s.x, c.y-s.y) <= err + g.r[h.route[i]]) return 1;
  }
  return 0;
}
function knowTrim(B){
  var moved = B.hyps.filter(function(h){ return h.type === "moved"; });
  while(moved.length > KNOW.maxBranches + 1){
    moved.sort(function(a, b){ return a.weight - b.weight; });
    var w = moved.shift();
    B.hyps.splice(B.hyps.indexOf(w), 1);
    knowHyp(B, "moved_unknown").weight += w.weight;
  }
}
// ---------- окна «бегущего было бы слышно на этом участке» ----------
function knowWindowsTick(b){
  var K = b.know, g = knowGraph(), stepsWall = SOUND_RADIUS_RUN*0.75;
  for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible) continue;
    if(B.hyps._next !== undefined && tick < B.hyps._next) continue;
    var next = Infinity;
    B.hyps.forEach(function(h){ (h.windows || []).forEach(function(w){ if(!w.done && w.t1 > tick) next = Math.min(next, w.t1); }); });
    B.hyps._next = next;
    B.hyps.forEach(function(h){
      if(h.type !== "moved" || !h.windows) return;
      h.windows.forEach(function(w){
        if(w.done || tick < w.t1) return;
        w.done = true;
        var c = g.c[w.zone], dist = Math.hypot(c.x-b.x, c.y-b.y) - g.r[w.zone];
        if(dist > stepsWall) return;
        var heard = K.heard.some(function(s){
          return (s.kind === "steps" || s.kind === "water") && s.tick >= w.t0 && s.tick <= w.t1 &&
                 Math.hypot(s.x-c.x, s.y-c.y) <= g.r[w.zone] + s.err;
        });
        if(heard) return;
        var un = knowHyp(B, "moved_unknown"), lost = h.weight*(1 - KNOW.quiet);
        h.weight -= lost; if(un) un.weight += lost;
        knowNorm(B.hyps);
        knowTrace(b, id, "тихо: " + knowZoneName(w.zone) + " — бегущего было бы слышно");
      });
    });
  }
}
// ---------- «посмотрел — пусто» ----------
function knowLook(b){
  var K = b.know;
  if(tick < (b.blindUntil||0) || (tick + (b.id.charCodeAt(b.id.length-1)||0)) % KNOW.lookEvery) return;
  (K.spots || []).forEach(function(p){
    if(!p.open || Math.hypot(p.x-b.x, p.y-b.y) > KNOW.lookRange || !inFov(b, p.x, p.y)) return;
    if(!hasVision(b.x, b.y, p.x, p.y)) return;
    if(!(b._visible || []).some(function(e){ return Math.hypot(e.x-p.x, e.y-p.y) < 120; })) p.open = false;
  });
  for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible) continue;
    B.hyps.forEach(function(h){
      var hx = h.x, hy = h.y, vz = null;
      if(h.type === "moved" && !h.heard){
        // ветка «ушёл туда»: смотрим на зону, где бегущий враг был бы сейчас; своя зона — видна всегда
        vz = knowHypZoneId(h, B); var gc = knowGraph().c[vz]; if(!gc) return;
        if(vz === knowZoneAt(b.x, b.y, b.z)){ hx = b.x; hy = b.y; } else { hx = gc.x; hy = gc.y; }
        if(h.vz !== vz){ h.vz = vz; h.inView = false; }
      }
      if(hx === undefined) return;
      var inView = (hx === b.x && hy === b.y) || Math.hypot(hx-b.x, hy-b.y) <= KNOW.lookRange && inFov(b, hx, hy) && hasVision(b.x, b.y, hx, hy);
      if(inView && !h.inView){
        h.weight *= KNOW.emptyLook; knowNorm(B.hyps);
        knowTrace(b, id, "посмотрел — пусто (" + knowZoneName(vz || h.zone) + ")");
      }
      h.inView = inView;
    });
  }
}
// ---------- плант ----------
function knowPlant(b){
  var K = b.know;
  if(!bomb || bomb.state !== "planted" || K.planted) return;
  K.planted = true;
  K.plantSite = b.team === "T" ? bomb.site : (K.plantSeen || K.plantHeard || null);
  // (v283, владелец 14.10) CT вычисляет сайт, как игрок: «плант» в HUD, а свой (по радару) стоял у сайта X там, где писк
  // планта слышно (те же 520 px / 850 px по прямой, что у звука планта), и не услышал — значит плант на другом сайте
  if(b.team === "CT" && !K.plantSite){
    var left = ["A", "B"].filter(function(X){ var S = SITES[X];
      return !bots.some(function(o){ if(o.team !== "CT" || !o.alive) return false; var dH = Math.hypot(o.x-S.x, o.y-S.y);
        return dH < 520 || (dH < 850 && hasLOS(o.x, o.y, S.x, S.y)); }); });
    if(left.length === 1) K.plantSite = left[0];
  }
  if(b.team === "CT" && K.plantSite) knowPlantShift(K, K.plantSite);
  for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible) continue;
    B.hyps.forEach(function(h){ if(h.type === "moved") h.weight *= knowValue(h.zone, B.side, K); });
    knowNorm(B.hyps);
  }
}
// (v283, владелец 14.10: «вряд ли оставят одного на сайте — все туда пойдут») сайт планта известен — враги, которых не видно,
// скорее у бомбы: у про после планта T в 600 px от бомбы 85 % времени (88 демок, «пост-плант: T дальше 600 px» 15,2 %).
// Старые точки («видели на T Upper») не стираются, а уходят в остаток 15 % — обход остаётся возможным
function knowPlantShift(K, site){
  if(!site || K.plantShift === site || !SITES[site]) return; K.plantShift = site;
  var S = SITES[site], z = knowZoneAt(S.x, S.y);
  for(var id in K.enemies){ var B = K.enemies[id]; if(B.visible) continue;
    B.hyps.forEach(function(h){ h.weight *= 0.152; });
    B.hyps.push({type: "held", zone: z, x: S.x, y: S.y, weight: 0.848, plant: true});
    knowNorm(B.hyps); knowTrim(B); }
}
// CT видит саму бомбу на земле — знает сайт
function knowBombSeen(b){
  var K = b.know;
  if(b.team !== "CT" || !K.planted || K.plantSite || !bomb || bomb.state !== "planted" || tick < (b.blindUntil||0)) return;
  if(Math.hypot(bomb.x-b.x, bomb.y-b.y) > KNOW.lookRange || !inFov(b, bomb.x, bomb.y) || !hasVision(b.x, b.y, bomb.x, bomb.y)) return;
  K.plantSite = bomb.site; knowPlantShift(K, bomb.site);
}
// ---------- киллфид (feedKill) ----------
function knowKill(att, vic){
  if(roundState !== "live") return;
  bots.concat(teamAgents()).forEach(function(b){
    if(!b.alive || !b.know || b === vic) return;
    var K = b.know;
    if(vic.team !== b.team){
      if(K.enemies[vic.id]){ delete K.enemies[vic.id]; K.alive--; }
      // (v273, владелец 14.10) киллфид + колл убившего «убил … на <место>»: свой звук и инфа рядом с местом фрага (≤300 px),
      // полученные до него, — это был он; забываем (иначе бот смотрел на трупы). В других местах помнит, как было. 300 px — проектное число
      if(b.heardSound && b.heardSound.team === vic.team && b.heardSound.tick <= tick && Math.hypot(b.heardSound.x-vic.x, b.heardSound.y-vic.y) <= 300) b.heardSound = null;
      if(b.lastIntel && b.lastIntel.tick <= tick && Math.hypot(b.lastIntel.x-vic.x, b.lastIntel.y-vic.y) <= 300) b.lastIntel = null;
      return;
    }
    if(!att || att.team === b.team) return;
    var last = {x: vic.x, y: vic.y, zone: knowZoneAt(vic.x, vic.y, vic.z), tick: tick, stance: "stand", source: "killfeed", vx: 0, vy: 0};
    var B = K.enemies[att.id];
    if(B && B.visible) return;
    if(!B) B = knowNewBelief(K, b, att, last);
    else { B.last = last; B.hyps = knowBuild(K, B.side, last); }
    // убийца не стоит на месте смерти своего: он там, откуда это место простреливается (ZONE_DANGER — геометрия карты)
    B.hyps[0].x = undefined; B.hyps[0].from = ZONE_DANGER[last.zone] && ZONE_DANGER[last.zone].length ? ZONE_DANGER[last.zone] : null;
    knowTrace(b, att.id, "киллфид: убил " + vic.id + " (" + knowZoneName(last.zone) + ")");
  });
}
// ---------- раз в тик, после teamInfoTick ----------
// (v381, М132, владелец 16.10: «T идёт мид, видит, что на миду двое, и сразу даёт инфу — тиммейты понимают, что может быть 2-2-1 или
// 1-3-1, это тоже микра») расстановку CT читают по тому, сколько CT уже видели в каждом районе (A / мид / B): из расстановок, которые
// CT обычно ставят (MAP.tactics.ctSetups, доли w — из демок), остаются те, что не противоречат увиденному; ожидание числа CT на
// каждом сайте — среднее по ним. Район места — по тому, кем стоят в расстановках (опорник A / мид / опорник B). Только до 40-й с
// раунда и при всех пяти живых (дальше расстановка уже сломана ротациями) — проектные числа
var SETUP_REG = null;
function setupRegions(){
  if(SETUP_REG) return SETUP_REG;
  SETUP_REG = {zones: {}, splits: []};
  ((MAP.tactics && MAP.tactics.ctSetups) || []).forEach(function(S){
    var m = /(\d)(\d)(\d)$/.exec(S.id || ""); if(!m) return;
    SETUP_REG.splits.push({id: S.id, A: +m[1], mid: +m[2], B: +m[3], w: S.w || 1});
    for(var r in (S.roles || {})){ var reg = /^anchorA/.test(r) ? "A" : /^anchorB/.test(r) ? "B" : /^mid/.test(r) ? "mid" : null; if(!reg) continue;
      (S.roles[r].pos || []).forEach(function(n){ var Z = SETUP_REG.zones[n] || (SETUP_REG.zones[n] = {A:0, mid:0, B:0}); Z[reg]++; }); }
  });
  return SETUP_REG;
}
function setupRegionAt(x, y){
  var Z = setupRegions().zones[zoneUserName(zoneIdAt(x, y)) || ""]; if(!Z) return null;
  return Z.A >= Z.mid && Z.A >= Z.B ? "A" : (Z.B >= Z.mid ? "B" : "mid");
}
function knowSetupRead(team){
  if(team !== "T" || roundState !== "live" || (bomb && bomb.state === "planted") || tick - roundStartTick > 40*TICK_HZ) return null;
  var foes = bots.filter(function(o){ return o.team !== team && o.alive; }); if(foes.length !== 5) return null;
  var SR = setupRegions(); if(!SR.splits.length) return null;
  var seen = {A:0, mid:0, B:0}, n = 0, BL = beliefLast[team] || {};
  foes.forEach(function(o){ var l = BL[o.id]; if(!l || l.src !== "spotted" || l.tick < roundStartTick) return; var r = setupRegionAt(l.x, l.y); if(r){ seen[r]++; n++; } });
  if(!n) return null;
  var C = SR.splits.filter(function(S){ return S.A >= seen.A && S.mid >= seen.mid && S.B >= seen.B; }); if(!C.length) return null;
  var W = C.reduce(function(a, S){ return a + S.w; }, 0), E = {A:0, mid:0, B:0};
  C.forEach(function(S){ E.A += S.A*S.w/W; E.mid += S.mid*S.w/W; E.B += S.B*S.w/W; });
  C.sort(function(a, c){ return c.w - a.w; });
  return {seen: seen, n: n, E: E, top: C.slice(0, 2).map(function(S){ return S.A + "-" + S.mid + "-" + S.B; })};
}
function knowTick(){
  if(roundState !== "live") return;
  var key = matchNum + ":" + roundNum;
  bots.forEach(function(b){
    if(!b.alive) return;
    if(!b.know || b.know.key !== key) knowRoundStart(b);
    knowVision(b);
    knowHearing(b);
    knowPlant(b);
    knowBombSeen(b);
    knowWindowsTick(b);
    knowLook(b);
    knowAge(b);
  });
  ["CT", "T"].forEach(function(team){ var A = teamAgent(team); knowVision(A); knowPlant(A); knowTeamLook(A); knowAge(A); });
}
// (v269, решение владельца 12.10) гипотеза «остался, где видели» (held) стареет со временем. У про доля тех, кто через Δt
// после потери из вида всё ещё в 150 px от того места: 2 с — 0,95, 5 — 0,65, 10 — 0,43, 20 — 0,27, 40 — 0,13 (88 демок,
// tools/measure/audit/memory_bake.py → runs/memory_pro.json; от того, стоял или бежал, почти не зависит). Вес held умножается
// на P(Δt)/P(Δt − шаг): шансы held против остальных гипотез к моменту Δt — стартовые × P(Δt); освободившийся вес уходит
// остальным (knowNorm), не ниже KNOW.heldFloor.
// События (тишина в окне, «посмотрел — пусто») по-прежнему меняют вес сверх этого. Стартовые веса held (KNOW.heldStill /
// heldMoving) не менялись. Слух/войс (heard) — не трогаем: для них кривой у про нет
var KNOW_AGE = [[0, 1], [2, 0.95], [5, 0.651], [10, 0.425], [20, 0.268], [40, 0.129]];
function knowAgeP(t){
  if(t <= 0) return 1;
  for(var i = 1; i < KNOW_AGE.length; i++) if(t <= KNOW_AGE[i][0]){ var a = KNOW_AGE[i-1], c = KNOW_AGE[i]; return Math.exp(Math.log(a[1]) + (Math.log(c[1])-Math.log(a[1]))*(t-a[0])/(c[0]-a[0])); }
  var L = KNOW_AGE[KNOW_AGE.length-1], P = KNOW_AGE[KNOW_AGE.length-2];   // дальше 40 с — тот же наклон
  return Math.exp(Math.log(L[1]) + (Math.log(L[1])-Math.log(P[1]))*(t-L[0])/(L[0]-P[0]));
}
function knowAge(b){
  var K = b.know; if(!K || tick % BELIEF_STEP) return;
  for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible || !B.hyps || !B.last || B.last.tick == null) continue;
    var t1 = (tick - B.last.tick)/TICK_HZ, t0 = Math.max(0, t1 - BELIEF_STEP/TICK_HZ), f = knowAgeP(t1)/knowAgeP(t0), hit = false;
    B.hyps.forEach(function(h){ if(h.type === "held" && !h.heard && h.weight > KNOW.heldFloor){ h.weight *= f; hit = true; } });
    if(hit) knowNorm(B.hyps);
  }
}
// ---------- (этап 2, P1-2) знание КОМАНДЫ — отдельный «слушатель» на команду ----------
// Что команда знает вся: радар (враг в поле зрения любого живого своего — knowVision), «смотрел — пусто» по радару
// (свой смотрел туда и никого не засветил — knowTeamLook), войс (knowCall из teamChannel), киллфид (knowKill), плант (HUD).
// Своих ушей и «было бы слышно» у него нет: что слышал один, команда узнаёт только из войса. Карту belief, которую читают
// взгляд, позиция и коллы, собирает beliefTick только отсюда. Раньше — среднее гипотез живых тиммейтов, включая несказанное
var TEAMK = {};
function teamAgent(team){
  var key = matchNum + ":" + roundNum, A = TEAMK[team];
  if(!A || !A.know || A.know.key !== key || A._t > tick){ A = TEAMK[team] = {id: "team" + team, team: team, alive: true, x: 0, y: 0, ears: [], _visible: [], _team: true}; knowRoundStart(A); }
  A._t = tick; return A;
}
function teamAgents(){ return roundState === "live" ? [teamAgent("CT"), teamAgent("T")] : []; }
function knowTeamLook(A){
  var K = A.know, mates = bots.filter(function(m){ return m.alive && m.team === A.team && tick >= (m.blindUntil||0); });
  if(tick % KNOW.lookEvery) return;
  var sees = function(hx, hy){ return mates.some(function(m){ return Math.hypot(hx-m.x, hy-m.y) <= KNOW.lookRange && inFov(m, hx, hy) && hasVision(m.x, m.y, hx, hy); }); };
  var anyVis = []; mates.forEach(function(m){ (m._visible || []).forEach(function(e){ anyVis.push(e); }); });
  (K.spots || []).forEach(function(p){
    if(!p.open || !sees(p.x, p.y)) return;
    if(!anyVis.some(function(e){ return Math.hypot(e.x-p.x, e.y-p.y) < 120; })) p.open = false;
  });
  for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible) continue;
    B.hyps.forEach(function(h){
      var hx = h.x, hy = h.y, vz = null;
      if(h.type === "moved" && !h.heard){ vz = knowHypZoneId(h, B); var gc = knowGraph().c[vz]; if(!gc) return; hx = gc.x; hy = gc.y; if(h.vz !== vz){ h.vz = vz; h.inView = false; } }
      if(hx === undefined) return;
      var inView = sees(hx, hy);
      if(inView && !h.inView){ h.weight *= KNOW.emptyLook; knowNorm(B.hyps); }
      h.inView = inView;
    });
  }
}
// где сейчас враг по гипотезе h (индекс зоны BZ): held — точка; moved — по таймингу бега вдоль маршрута;
// moved_unknown — нигде конкретно (раздаётся по открытым типичным местам в beliefTick)
function knowHypZoneId(h, B){
  var z = h.zone, W = h.windows;
  if(h.type === "moved" && W && W.length){
    if(tick < W[0].t0) z = B.last.zone;
    else for(var i = 0; i < W.length; i++) if(tick >= W[i].t0) z = W[i].zone;
  }
  return z;
}
function knowHypZone(h, B){
  if(h.type === "held" && h.x !== undefined) return bzOf(h.x, h.y);
  var z = knowHypZoneId(h, B);
  return BZ.idx[z] === undefined ? -1 : BZ.idx[z];
}
// гипотеза → доли по зонам BZ: [[индекс, вес]]. Убийца, которого не видели, — по зонам, откуда простреливается
// место смерти, с весами прострела (как в v166: доля прострела / (1 + расстояние/400) — числа v166)
function knowHypSpread(h, B){
  if(h.type === "held" && h.from){
    var Wd = ZONE_DANGER_W[B.last.zone] || {}, out = [], tot = 0;
    h.from.forEach(function(zid){ var j = BZ.idx[zid]; if(j === undefined || !BZ.cent[j]) return;
      var w = (Wd[zid]||0.1) / (1 + Math.hypot(BZ.cent[j].x-B.last.x, BZ.cent[j].y-B.last.y)/400); out.push([j, w]); tot += w; });
    if(tot > 0){ out.forEach(function(q){ q[1] = h.weight*q[1]/tot; }); return out; }
  }
  var zi = knowHypZone(h, B); return zi >= 0 ? [[zi, h.weight]] : [];
}

