// ---------- войс: что тиммейт договорил в канале (teamChannel) ----------
// Фраза говорит «где (зона) и сколько»; «кто» — только во «меня убил …» (киллфид называет убийцу)
function knowCall(b, msg){
  var K = b.know; if(!K) return;
  var say = "войс " + msg.by + ": «" + msg.text + "»";
  if(msg.kind === "plant"){
    if(!K.planted) K.plantHeard = msg.site;
    else if(!K.plantSite || K.plantGuess){ K.plantSite = msg.site; K.plantGuess = false; K.plantShift = null; knowPlantShift(K, msg.site); }   // (v409) колл главнее своей догадки
    return;
  }
  if(msg.kind === "defuse"){ K.defuseT = tick; return; }
  if(!msg.zone) return;
  var g = knowGraph(), c = g.c[msg.zone]; if(!c) return;
  // (Б3, З7–З8) войс — о тех врагах, о ком он: «вижу» называет увиденных (msg.ids), «меня убил» — убийцу. Кого сказавший видел, тот
  // был и на радаре у всей команды (knowVision) — с той же или более свежей точкой: войс о нём нового не говорит. Раньше «вижу»
  // раскладывался по всем врагам, кто мог быть в зоне, и ложился новой веткой рядом с увиденным (два места на одного врага)
  var only = msg.enemy ? [msg.enemy] : (msg.ids || null);
  if(only && msg.kind === "see") only = only.filter(function(id){ var B = K.enemies[id]; return !(B && B.last && B.last.tick >= msg.made); });
  knowApply(b, {x: c.x, y: c.y, kind: "voice"}, g.r[msg.zone] + 60, msg.zone, KNOW.voiceL[msg.kind],
            {say: say, voice: true, mult: msg.count || 1, only: only});
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
  if(opt.only && !opt.only.length) return;
  var vis = 0;
  (b._visible || []).forEach(function(e){ if(DM.hypot(e.x-s.x, e.y-s.y) <= err + 30) vis++; });
  if(vis >= (opt.mult || 1)) return;
  var expl = {}, tot = 0;
  for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible || (opt.only && opt.only.indexOf(id) < 0)) continue;
    var reach = (tick - B.last.tick)/TICK_HZ*SPEED + err + 60, ex = 0;
    if(DM.hypot(s.x-B.last.x, s.y-B.last.y) > reach){ expl[id] = 0; continue; }
    B.hyps.forEach(function(h){ h._c = knowCompat(h, s, err, g); ex += h.weight*h._c; });
    expl[id] = ex; tot += ex;
  }
  if(tot <= 0) return;
  for(var id2 in expl){
    var r = Math.min(1, expl[id2]/tot*(opt.mult || 1)); if(r < 0.02) continue;
    var B2 = K.enemies[id2], un = knowHyp(B2, "moved_unknown"), specific = false;
    var ls = B2.lastSound, same = !opt.voice && ls && tick - ls.tick <= KNOW.sameSource*TICK_HZ &&
             DM.hypot(ls.x-s.x, ls.y-s.y) <= err + 100 && KNOW.soundL[s.kind] <= KNOW.soundL[ls.kind];
    if(!opt.voice) B2.lastSound = {x: s.x, y: s.y, tick: tick, kind: same ? ls.kind : s.kind};
    // (отметка владельца 18.11, м33 р1 т4055, magixx: «отворачивается от Kitchen, хотя оттуда только что граната и шаги») звук «объясняет» и
    // прогноз «идёт по маршруту» (ретейк, «ушёл туда») — раньше такой прогноз только набирал вес, а место оставалось прогнозным (шаги Kitchen
    // → «ретейк, Hole» 0,45 → 0,79), и «слышали здесь» не появлялось: событие должно обновить картину мира — враг там, где его слышали.
    // Теперь вес набирает только ветка «слышали» (её точка — на звук); прогнозы, которые звук объясняет, держат свой вес, а новый вес —
    // новой веткой «слышали здесь»
    var mOk = 0, mNo = 0;
    B2.hyps.forEach(function(h){ if(h._c > 0 && h.heard) mOk += h.weight*h._c; else if(!(h._c > 0)) mNo += h.weight; });
    var move = same ? 0 : r*L;
    B2.hyps.forEach(function(h){
      if(h._c > 0){
        if(!h.heard) return;
        if(mOk > 0) h.weight += move*mNo*(h.weight*h._c/mOk);
        specific = true;
        if(zone){ h.x = s.x; h.y = s.y; h.zone = h.route[0] = zone; h.inView = false; h.htick = tick; h.voice = !!opt.voice; }
      } else h.weight *= 1 - move;
    });
    if(same && specific){ knowNorm(B2.hyps); continue; }
    if(!specific && zone){
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
  if(h.type === "held") return h.x !== undefined && DM.hypot(h.x-s.x, h.y-s.y) <= err + 60 ? 1 : (h.x === undefined && h.zone === knowZoneAt(s.x, s.y) ? 1 : 0);
  if(h.heard) return DM.hypot(h.x-s.x, h.y-s.y) <= err + 80 ? 1 : 0;
  if(h.type === "retake") return DM.hypot(h.x-s.x, h.y-s.y) <= err + 120 ? 1 : 0;   // (v583a) идёт на ретейк — рядом с его точкой на пути
  for(var i = 0; i < h.route.length; i++){
    var c = g.c[h.route[i]];
    if(DM.hypot(c.x-s.x, c.y-s.y) <= err + g.r[h.route[i]]) return 1;
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
        var c = g.c[w.zone], dist = DM.hypot(c.x-b.x, c.y-b.y) - g.r[w.zone];
        if(dist > stepsWall) return;
        var heard = K.heard.some(function(s){
          return (s.kind === "steps" || s.kind === "water") && s.tick >= w.t0 && s.tick <= w.t1 &&
                 DM.hypot(s.x-c.x, s.y-c.y) <= g.r[w.zone] + s.err;
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
    if(!p.open || DM.hypot(p.x-b.x, p.y-b.y) > KNOW.lookRange || !inFov(b, p.x, p.y)) return;
    if(!hasVision(b.x, b.y, p.x, p.y)) return;
    if(!(b._visible || []).some(function(e){ return DM.hypot(e.x-p.x, e.y-p.y) < 120; })) p.open = false;
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
      var inView = (hx === b.x && hy === b.y) || DM.hypot(hx-b.x, hy-b.y) <= KNOW.lookRange && inFov(b, hx, hy) && hasVision(b.x, b.y, hx, hy);
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
  // (v409, владелец 22.10: «TeSeS говорит "ставят B", а бомба на A») «стоял бы рядом — услышал бы» считалось до ЦЕНТРА сайта, а писк
  // слышно до ставящего (120_bomb): TeSeS стоял у центра A, писк с места планта не услышал — вывод «на B» — и говорил его в войс как
  // услышанное. Теперь сайт исключается, только если свой слышал бы плант на любом месте про этого сайта (sitePlantPro), а вывод —
  // догадка (plantGuess): в войс не идёт, увидел бомбу / услышал колл — заменяется
  K.plantGuess = false;
  if(b.team === "CT" && !K.plantSite){
    var hears = function(o, q){ var dH = DM.hypot(o.x-q.x, o.y-q.y); return dH < 520 || (dH < 850 && hasLOS(o.x, o.y, q.x, q.y, o.z)); };
    var left = ["A", "B"].filter(function(X){ var PP = sitePlantPro(X); if(!PP.length) PP = [SITES[X]];
      return !bots.some(function(o){ return o.team === "CT" && o.alive && PP.every(function(q){ return hears(o, q); }); }); });
    if(left.length === 1){ K.plantSite = left[0]; K.plantGuess = true; }
  }
  if(b.team === "CT" && K.plantSite) knowPlantShift(K, K.plantSite);
  for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible) continue;
    // (Б3) прогноз «ушёл туда» — к сайтам (knowValue); ветка из звука / войса (heard) — инфа, её место фаза не двигает
    B.hyps.forEach(function(h){ if(h.type === "moved" && !h.heard) h.weight *= knowValue(h.zone, B.side, K); });
    knowNorm(B.hyps);
  }
}
// (v283, владелец 14.10: «вряд ли оставят одного на сайте — все туда пойдут») сайт планта известен — враги, которых не видно,
// скорее у бомбы: у про после планта T в 600 px от бомбы 85 % времени (88 демок, «пост-плант: T дальше 600 px» 15,2 %).
// (Б3, З4–З5) 85 % — средняя по всем T, а не для того, о ком свежая инфа: к бомбе сдвигается только прогноз — ветки «ушёл туда»
// и «ушёл тихо» (их вес × 0,152, остальное — «у бомбы»). Инфа остаётся, где была: «видели» (held) — уже со старением по кривой
// про (knowAge, 88 демок), «слышали / войс» (heard) — та доля, что по той же кривой ещё на месте (knowAgeP от времени звука),
// остальное — как прогноз. Раньше × 0,152 всем: вес места, где видели ≤ 5 с назад, 0,43 → 0,07, а враг там в 84–94 % (v388, прогон ПК 20)
function knowPlantShift(K, site){
  if(!site || K.plantShift === site || !SITES[site]) return; K.plantShift = site;
  var S = SITES[site], z = knowZoneAt(S.x, S.y);
  for(var id in K.enemies){ var B = K.enemies[id]; if(B.visible) continue;
    var toBomb = 0, seen = B.last && B.last.source !== "spawn";   // «стоит на своём спавне» с начала раунда — прогноз, не инфа
    B.hyps.forEach(function(h){
      var keep = h.type === "held" && !h.plant ? (seen ? 1 : 0) : (h.heard && h.htick != null ? knowAgeP((tick - h.htick)/TICK_HZ) : 0);
      var w = h.weight*(1 - keep)*0.848; toBomb += w; h.weight -= w; });
    // (владелец 18.11: «чинить механику целиком») «у бомбы» — не точка бомбы, а места, где про стоят после планта при такой бомбе (MAP.postplant,
    // доли про); нет данных — точка сайта, как было. Та же раскладка, что у сдвига после смерти на сайте (knowShiftPut)
    var bp = bomb && bomb.state === "planted" ? {x: bomb.x, y: bomb.y} : S, PZ = typeof ppProZone === "function" ? ppProZone(bp, site) : null;
    knowShiftPut(B, toBomb, z, S, PZ ? PZ.spots.map(function(p){ return {x: p.x, y: p.y, zone: knowZoneAt(p.x, p.y), w: p.share}; }).filter(function(p){ return p.zone; }) : null, 0);
    knowNorm(B.hyps); knowTrim(B); }
}
// сдвинутую к сайту долю moved — на точку сайта (доля on) и по местам P ({x, y, zone, w}, вес w); мест нет — всё на точку сайта
function knowShiftPut(B, moved, z, S, P, on){
  if(!(moved > 0)) return;
  if(!P || !P.length){ B.hyps.push({type: "held", zone: z, x: S.x, y: S.y, weight: moved, plant: true}); return; }
  var a = moved*on, W = P.reduce(function(t, p){ return t + (p.w || 1); }, 0) || 1;
  if(a > 0) B.hyps.push({type: "held", zone: z, x: S.x, y: S.y, weight: a, plant: true});
  P.forEach(function(p){ B.hyps.push({type: "held", zone: p.zone, x: p.x, y: p.y, weight: (moved - a)*(p.w || 1)/W, plant: true}); });
}
// (v583a, Д2.2) сдвиг невидимых врагов к сайту с долей share: «видели» (held, не плант) — остаются (инфа), слышали — по кривой про
// (knowAgeP), прогнозы — доля share уходит в «у сайта». KILL_SITE_R — 240 px ≈ 600 ед. от центра сайта (тот же радиус, что в замере)
var KILL_SITE_SHARE = 0.72, KILL_SITE_R = 240, KILL_NEAR_R = 480, KILL_SITE_ON = 0.36;   // KILL_SITE_ON = 0,25 / 0,70 (на сайте / в 480, kill_site_pro.py)
function knowSiteShift(K, site, share, skipId){
  var S = SITES[site]; if(!S) return; var z = knowZoneAt(S.x, S.y);
  for(var id in K.enemies){ if(id === skipId) continue; var B = K.enemies[id]; if(B.visible) continue;
    var moved = 0, seen = B.last && B.last.source !== "spawn";
    B.hyps.forEach(function(h){
      var keep = h.type === "held" && !h.plant ? (seen ? 1 : 0) : (h.heard && h.htick != null ? knowAgeP((tick - h.htick)/TICK_HZ) : 0);
      var w = h.weight*(1 - keep)*share; moved += w; h.weight -= w; });
    // (отметка владельца 18.11, м33 р1: «у игроков 5 и 7 растёт угроза в Jungle») было: вся доля — «стоит на самом сайте»; одиночный выход T4
    // с T Ramp убил CT4 на A — команда CT решила «на A ~2,85», и это растекалось в соседние зоны. У про в момент такой смерти остальные T на
    // самом сайте (≤ 240) — 24–30 %, в 480 (подходы) — 68–74 % (tools/pro/kill_site_pro.py, Mirage, 663 смерти): на сайт — KILL_SITE_ON
    // сдвинутого, остальное — поровну по местам про у подходов (240–480 от сайта), куда враг уже мог дойти
    knowShiftPut(B, moved, z, S, K.spots.filter(function(p){ var dS = DM.hypot(p.x-S.x, p.y-S.y); return dS > KILL_SITE_R && dS <= KILL_NEAR_R && knowSpotReach(p); }), KILL_SITE_ON);
    knowNorm(B.hyps); knowTrim(B); }
}
// CT видит саму бомбу на земле — знает сайт
function knowBombSeen(b){
  var K = b.know;
  if(b.team !== "CT" || !K.planted || (K.plantSite && !K.plantGuess) || !bomb || bomb.state !== "planted" || tick < (b.blindUntil||0)) return;
  if(DM.hypot(bomb.x-b.x, bomb.y-b.y) > KNOW.lookRange || !inFov(b, bomb.x, bomb.y) || !hasVision(b.x, b.y, bomb.x, bomb.y)) return;
  K.plantSite = bomb.site; if(K.plantGuess){ K.plantGuess = false; K.plantShift = null; } knowPlantShift(K, bomb.site);
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
      if(b.heardSound && b.heardSound.team === vic.team && b.heardSound.tick <= tick && DM.hypot(b.heardSound.x-vic.x, b.heardSound.y-vic.y) <= 300) b.heardSound = null;
      if(b.lastIntel && b.lastIntel.tick <= tick && DM.hypot(b.lastIntel.x-vic.x, b.lastIntel.y-vic.y) <= 300) b.lastIntel = null;
      return;
    }
    // (v583a, Д2.2, владелец 17.11: «опорника B убили — понятно, где остальные враги, и плант будет там же») свой CT погиб на сайте до планта
    // (киллфид + радар) — невидимые T сдвигаются к этому сайту с долей KILL_SITE_SHARE: у про (1300 смертей CT на сайте до планта, Mirage)
    // остальные живые T в этот момент в 1200 ед. от сайта — в среднем 72 %, плант потом на этом сайте — 90–93 %
    if(b.team === "CT" && !(bomb && bomb.state === "planted")){ var ks = null;
      ["A", "B"].forEach(function(X){ if(SITES[X] && DM.hypot(vic.x-SITES[X].x, vic.y-SITES[X].y) <= KILL_SITE_R) ks = X; });
      if(ks) knowSiteShift(K, ks, KILL_SITE_SHARE, att && att.id); }
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
    knowRetakeDrift(b);
  });
  ["CT", "T"].forEach(function(team){ var A = teamAgent(team); knowVision(A); knowPlant(A); knowTeamLook(A); knowAge(A); knowRetakeDrift(A); });
}
// (v269, решение владельца 12.10) гипотеза «остался, где видели» (held) стареет со временем. У про доля тех, кто через Δt
// после потери из вида всё ещё в 150 px от того места: 2 с — 0,95, 5 — 0,65, 10 — 0,43, 20 — 0,27, 40 — 0,13 (88 демок,
// tools/measure/audit/memory_bake.py → runs/memory_pro.json; от того, стоял или бежал, почти не зависит). Вес held умножается
// на P(Δt)/P(Δt − шаг): шансы held против остальных гипотез к моменту Δt — стартовые × P(Δt); освободившийся вес уходит
// остальным (knowNorm), не ниже KNOW.heldFloor.
// События (тишина в окне, «посмотрел — пусто») по-прежнему меняют вес сверх этого. Стартовые веса held (KNOW.heldStill /
// heldMoving) не менялись. Ветки «ушёл туда» и «слышали здесь» (с 22.11) стареют по той же кривой — ниже, в knowAge
var KNOW_AGE = [[0, 1], [2, 0.95], [5, 0.651], [10, 0.425], [20, 0.268], [40, 0.129]];
function knowAgeP(t){
  if(t <= 0) return 1;
  for(var i = 1; i < KNOW_AGE.length; i++) if(t <= KNOW_AGE[i][0]){ var a = KNOW_AGE[i-1], c = KNOW_AGE[i]; return DM.exp(Math.log(a[1]) + (Math.log(c[1])-Math.log(a[1]))*(t-a[0])/(c[0]-a[0])); }
  var L = KNOW_AGE[KNOW_AGE.length-1], P = KNOW_AGE[KNOW_AGE.length-2];   // дальше 40 с — тот же наклон
  return DM.exp(Math.log(L[1]) + (Math.log(L[1])-Math.log(P[1]))*(t-L[0])/(L[0]-P[0]));
}
function knowAge(b){
  var K = b.know; if(!K || tick % BELIEF_STEP) return;
  for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible || !B.hyps || !B.last || B.last.tick == null) continue;
    var t1 = (tick - B.last.tick)/TICK_HZ, t0 = Math.max(0, t1 - BELIEF_STEP/TICK_HZ), f = knowAgeP(t1)/knowAgeP(t0), hit = false;
    B.hyps.forEach(function(h){ if(h.type === "held" && !h.heard && h.weight > KNOW.heldFloor){ h.weight *= f; hit = true; } });
    // (22.11, Ж23, разбор м271222 р6: «носитель на T Ramp 0,95» 24 с — проверенные зоны отпадали, весь вес собрался на последней ветке
    // и не старел) место без подтверждения стареет одинаково, чем бы оно ни было: ветка «ушёл туда» — с момента, когда он бы туда дошёл
    // (конец окна последней зоны маршрута), ветка «слышали здесь» — с момента звука. Та же кривая про KNOW_AGE (доля тех, кто через Δt
    // ещё в 150 px от места; к таким веткам перенесена без своей выборки — кандидат на замер). Освободившийся вес — в «ушёл, куда —
    // неизвестно» (moved_unknown), а не соседним названным местам: иначе последняя непроверенная ветка набирает ложную уверенность
    var un = knowHyp(B, "moved_unknown");
    if(un) B.hyps.forEach(function(h){
      if(h.type !== "moved") return;
      var tp = h.heard ? h.htick : (h.windows && h.windows.length ? h.windows[h.windows.length-1].t1 : null);
      if(tp == null || tick <= tp) return;
      var a1 = (tick - tp)/TICK_HZ, a0 = Math.max(0, a1 - BELIEF_STEP/TICK_HZ), dw = h.weight*(1 - knowAgeP(a1)/knowAgeP(a0));
      if(dw > 0){ h.weight -= dw; un.weight += dw; hit = true; }
    });
    if(hit) knowNorm(B.hyps);
  }
}
// (22.11, Ж23-П4, разбор м271222 р6: karrigan, о котором T не знали, раскрылся флешкой, потом молотовом) «знает ли враг обо мне» —
// по тому, что знает сам бот: я стрелял, меня ранили, я кинул гранату (бросок слышно), я видел врага (значит, мог видеть и он). Засвечен,
// пока по кривой памяти про KNOW_AGE больше половины шансов, что меня ещё помнят (≈ 7,6 с). Не читает, что враг видит на самом деле
function knowMeRevealed(b){
  var t = Math.max(b.lastShotTick || -1e9, b._hurtT || -1e9, b._thrownT || -1e9, b._lastSawT || -1e9);
  return t >= roundStartTick && knowAgeP((tick - t)/TICK_HZ) > 0.5;
}
// (22.11, Ж23, владелец: «разберись с утечкой») «враг меня видит» — только то, что видно самому: я вижу его, и он смотрит в мою сторону
// (его взгляд виден, раз виден он), или он только что стрелял в меня (попадание / пуля рядом — heardSound «hit» от него, 490). Было (480
// ambSeenBy, 490 saveShootOk): чтение того, кого враг видит на самом деле (o._visible), — знание, которого у игрока нет
function knowSeenByFoe(b, o){
  if(!o || !o.alive || o.team === b.team) return false;
  if(b._visible && b._visible.indexOf(o) >= 0 && inFov(o, b.x, b.y)) return true;
  var hs = b.heardSound; return !!(hs && hs.kind === "hit" && hs.src === o.id && tick - hs.tick <= TICK_HZ);
}
function knowSeenByAny(b){ return bots.some(function(o){ return knowSeenByFoe(b, o); }); }
// (22.11, Ж18, владелец: «гранаты на труп кидают»; журнал бросков, 2 матча: 6 из 130 — «задержать», лайнап «по времени / выход»,
// «по инфе — выкурить»: враг, ради которого граната, убит там за 0–2 с до броска, живых рядом нет) бросок в труп: рядом с точкой
// (KNOW_CORPSE_R) свои убили врага (киллфид / сам видел — sig «kill»), после этого там никого не видели и не слышали, и по знанию
// команды живых там нет — там только труп. Одно место (знание): гранаты (380: перед броском и в самом броске), «шагом — враг рядом» (535)
var KNOW_CORPSE_R = 150;   // проектное число: «то же место», ед. карты
function knowCorpseOnly(team, pt){
  var sig = (teamIntel[team] && teamIntel[team].sig) || [], kt = -1, R = KNOW_CORPSE_R;
  for(var i = sig.length - 1; i >= 0; i--){ var sg = sig[i]; if(sg.tick < roundStartTick) break;
    if(sg.type === "kill" && DM.hypot(sg.x-pt.x, sg.y-pt.y) < R){ kt = sg.tick; break; } }
  if(kt < 0) return false;
  if(sig.some(function(sg){ return sg.tick > kt && (sg.type === "spotted" || sg.type === "sound") && sg.id && sg.id !== "?" && DM.hypot(sg.x-pt.x, sg.y-pt.y) < R; })) return false;
  return !bots.some(function(o){ return o.alive && o.team !== team && (knowEnemySpots(team, o.id) || []).some(function(q){ return q.w >= 0.05 && DM.hypot(q.x-pt.x, q.y-pt.y) < R; }); });
}
// (v583a, Д15, владелец 17.11: «никто не смотрит Short, хотя была инфа, что CT на Mid») T после планта знает, как играют CT: идут к бомбе
// ближайшим путём. CT, которого не видно: та доля, на которую он уже ушёл с места, где видели (вес «стоит, где видели» стареет по кривой
// про — knowAge), — гипотеза «идёт на ретейк» на его пути к бомбе; она движется по пути со скоростью подхода про (RETAKE_V: первый CT у бомбы
// при медиане 950 ед. — через 11,5 с, (950 − 250)/11,5 ≈ 60 ед./с; 813 плантов Mirage, tools/measure/retake_cmp.py) и встаёт у бомбы (RETAKE_STOP).
// Было: после планта гипотезы CT оставались там, где их видели 30 с назад (Window, A Site, Mid), у Short — 0,01
var RETAKE_V = 60, RETAKE_STOP = 150;
function knowRetakeDrift(b){
  var K = b.know; if(!K || b.team !== "T" || !K.planted || !bomb || bomb.state !== "planted" || tick % BELIEF_STEP) return;
  for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible || !B.last || B.last.x == null) continue;
    var from = Math.max(bomb.plantTick || tick, B.last.tick || 0);
    if(!B._rt || B._rt.from !== from){ var P = pathPts(B.last.x, B.last.y, bomb.x, bomb.y, B.last.z, bomb.z); B._rt = {from: from, P: P && P.length ? P : [[B.last.x, B.last.y], [bomb.x, bomb.y]]}; }
    var d = RETAKE_V/PX_UNITS*Math.max(0, (tick - from)/TICK_HZ), P = B._rt.P, L = polyLen(P), x = P[0][0], y = P[0][1];
    d = Math.min(d, Math.max(0, L - RETAKE_STOP));
    for(var i = 1; i < P.length; i++){ var sl = DM.hypot(P[i][0]-P[i-1][0], P[i][1]-P[i-1][1]); if(d <= sl){ x = P[i-1][0] + (P[i][0]-P[i-1][0])*d/(sl || 1); y = P[i-1][1] + (P[i][1]-P[i-1][1])*d/(sl || 1); break; } d -= sl; x = P[i][0]; y = P[i][1]; }
    var h = knowHyp(B, "retake");
    if(!h){
      var tSeen = (tick - (B.last.tick || tick))/TICK_HZ, w = 0;
      B.hyps.forEach(function(q){ if(q.type === "held" && !q.heard) return; var m = q.weight*0.5; q.weight -= m; w += m; });   // прогнозы — пополам (CT могут и сейвить)
      h = {type: "retake", zone: knowZoneAt(x, y), x: x, y: y, weight: Math.max(w, 1 - knowAgeP(tSeen))}; B.hyps.push(h);
    } else { h.x = x; h.y = y; h.zone = knowZoneAt(x, y); }
    knowNorm(B.hyps);
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
  var sees = function(hx, hy){ return mates.some(function(m){ return DM.hypot(hx-m.x, hy-m.y) <= KNOW.lookRange && inFov(m, hx, hy) && hasVision(m.x, m.y, hx, hy); }); };
  var anyVis = []; mates.forEach(function(m){ (m._visible || []).forEach(function(e){ anyVis.push(e); }); });
  (K.spots || []).forEach(function(p){
    if(!p.open || !sees(p.x, p.y)) return;
    if(!anyVis.some(function(e){ return DM.hypot(e.x-p.x, e.y-p.y) < 120; })) p.open = false;
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
      var w = (Wd[zid]||0.1) / (1 + DM.hypot(BZ.cent[j].x-B.last.x, BZ.cent[j].y-B.last.y)/400); out.push([j, w]); tot += w; });
    if(tot > 0){ out.forEach(function(q){ q[1] = h.weight*q[1]/tot; }); return out; }
  }
  var zi = knowHypZone(h, B); return zi >= 0 ? [[zi, h.weight]] : [];
}
// (17.11, перестройка, дубль 7) «туда не выглядывать: там убили своего / размен не вышел / только что стрелялся» — одно знание бота, одно
// место (было: замок _avoidPeekUntil / _avoidPeekAt писали 110, 190 ×2, 500, читали 250, 500). 450 — проектное число, как было
function knowAvoidPeek(b, at, sec){ b._avoidPeekUntil = tick + sec*TICK_HZ; b._avoidPeekAt = at; }
function knowAvoidPeekNear(b, pt){ return !!(b._avoidPeekUntil > tick && b._avoidPeekAt && DM.hypot(b._avoidPeekAt.x-pt.x, b._avoidPeekAt.y-pt.y) < 450); }
