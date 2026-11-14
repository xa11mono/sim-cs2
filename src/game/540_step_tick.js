// ---------- fixed-tick sim ----------
var TICK_HZ = 64;
var TICK_MS = 1000/TICK_HZ;
var tick = 0;

var paused = false;
var accumulator = 0;
var lastFrame = null;
roundState = BAL.freeze > 0 ? "freeze" : "live";
roundStartTime = BAL.freeze; roundStartTick = Math.round(BAL.freeze*TICK_HZ);
buyPhase(); // закуп первого (пистолетного) раунда — после объявления simTime (logEvent его использует); (v428) тактика выбирается в нём
resetBomb();
beliefBuild(); beliefReset(); // раздел 13: карта вероятностей врага

// (v322, М14) свободный обзор в закупку: каждый смотрит сам по себе — держит взгляд, потом поворачивает мышь.
// Сколько держат и на сколько поворачивают — из демок про Mirage (25 матчей, фризтайм, взгляд раз в 0,25 с; поворот —
// больше 8° за 0,25 с): держат 0,25 / 0,25 / 1 / 2,5 / 5,75 с, поворот 11 / 21 / 50 / 98 / 145° (10/25/50/75/90 %).
var FREEZE_HOLD = [0.25, 0.25, 1, 2.5, 5.75], FREEZE_TURN = [11, 21, 50, 98, 145], FREEZE_TURN_SPEED = 0.25*Math.PI/16;  // скорость — поворот за ~0,25 с (шаг демок)
function freezePick(q, u){ var k = Math.min(3, Math.floor(u*4)), f = u*4 - k; return q[k] + (q[k+1]-q[k])*f; }   // доля u → число по процентилям (упрощение)
function freezeLookTick(){
  bots.forEach(function(b, i){
    if(!b.alive) return;
    if(!isFinite(b.facing)) b.facing = Math.atan2(1024-b.y, 1024-b.x);   // ещё не смотрел никуда — к середине карты
    // (v430, М167, владелец: «на закупке крутятся, троятся; на мини-карте нормально») взгляд на начало тика — для сглаживания
    // рисования (620_draw), как в живом раунде (строка «bot.pfacing» ниже): на закупке не запоминался, и большой радар каждый
    // тик заново проводил взгляд от угла прошлого раунда до нынешнего
    b.pfacing = b.facing;
    var F = b._fz;
    if(!F || F.round !== roundNum){ F = b._fz = {round: roundNum, until: tick, target: b.facing}; }
    if(tick >= F.until){
      var seed = roundNum*7919 + i*104729 + tick;
      var turn = freezePick(FREEZE_TURN, hashRand(seed)) * Math.PI/180 * (hashRand(seed+1) < 0.5 ? -1 : 1);
      F.target = b.facing + turn;
      F.until = tick + Math.round(freezePick(FREEZE_HOLD, hashRand(seed+2)) * TICK_HZ) + Math.ceil(Math.abs(turn)/FREEZE_TURN_SPEED);
    }
    var d = F.target - b.facing;
    b.facing += Math.max(-FREEZE_TURN_SPEED, Math.min(FREEZE_TURN_SPEED, d));
  });
}

// (v322) звук движения — шаги, вода, прыжок (одно место «кто из врагов услышал»): через стену слышно ближе (~75 % радиуса),
// место — пятно, а не точка (hearPos), в уши — hearReal
function moveSoundEmit(bot, soundRadius, kind, label){
  bots.forEach(function(listener){
    if(listener===bot || !listener.alive || listener.team===bot.team) return;
    var dHear = Math.hypot(listener.x-bot.x, listener.y-bot.y);
    if(dHear > soundRadius) return;
    var occS = BAL.soundDir && !hasLOS(listener.x, listener.y, bot.x, bot.y, listener.z, bot.z);
    if(occS && dHear > soundRadius*0.75) return;
    var wasStale = !listener.heardSound || (tick - listener.heardSound.tick) > 90;
    var seed = tick*331 + bot.id.charCodeAt(0)*17 + listener.id.charCodeAt(0)*11 + bot.lastStepTick;
    var jitterMag = 20 + dHear*0.12, jang = hashRand(seed) * Math.PI*2;
    var hpF = hearPos(listener, bot.x, bot.y, seed, occS);
    listener.heardSound = hearReal(listener, hpF ? {x:hpF.x, y:hpF.y, tick:tick, team:bot.team, src:bot.id, kind:kind, occl:occS}
                              : {x:bot.x+Math.cos(jang)*jitterMag, y:bot.y+Math.sin(jang)*jitterMag, tick:tick, team:bot.team, src:bot.id, kind:"steps", occl:occS});
    if(listener.heardSound && /^приземление/.test(label || "")) listener.heardSound.land = true;   // (v343) звук приземления — для ctLandPunish
    if(wasStale) logEvent(listener.id+" услышал "+label+" ("+bot.team+")"+(occS ? " за стеной" : ""));
  });
}
// (v323, М39, владелец) подход к дефузу шифтом. Демки Mirage (196 дефузов, скорость за 1,5 с до начала дефуза): был ближе
// 150 ед. игры (60 ед. карты) — шагом 77 %, 150–300 (60–120) — 34 %, дальше — всегда бегом. Шагом — только если успевает дойти
// и дефузнуть (запас 1,5 с). Кто идёт шагом в этом раунде — жребий на раунд и бота (решение не дёргается каждый тик)
function defuseWalk(bot){
  if(!(bomb && bomb.state === "planted" && bot.team === "CT" && bot.post && taskProp(bot.post.tag, "defuseTask"))) return false;
  var d = Math.hypot(bomb.x-bot.baseX, bomb.y-bot.baseY); if(d >= 120) return false;
  if(bombTimeLeftTicks()/TICK_HZ <= d/(SPEED*WALK_SPEED_FRAC) + (bot.kit ? 5 : 10) + 1.5) return false;
  var u = hashRand(roundNum*389 + matchNum*71 + bot.id.charCodeAt(bot.id.length-1)*13);
  return u < (d < 60 ? 0.77 : 0.34);
}
// (v333, заплатка, отметка владельца: magixx «застрял и дёргается» на спавне T) бот вне навмеша в кармане за тонкой стеной
// (пол навмеша уже настоящего пола) дольше 0,5 с с путём — переносим на ближайший участок навмеша своего этажа (≤ 40 ед. карты).
// Как он туда попадает — не найдено; это заплатка, пока не найдена причина
function navSnap(bot){
  var nb = null, nbd = 40;
  // (v340, отметка владельца: NiKo «пролезает наверх, где не должен» — после двух переносов) перенос не поднимает выше ступеньки
  // (18 ед.): раньше брался пол в ±JUMP_UP, и бота закидывало на уступ, куда не залезть; вниз — как было
  // (v347, отметка владельца: magixx «с Short провалился в Underpass» — перенос с края Short опустил на 196 ед.) вниз — не больше
  // JUMP_UP (v341 разрешало любую высоту — ошибка), вверх — только ступенька (18 ед.)
  NAVAREAS.forEach(function(a){ if(NAV_BLOCKED[a.id] || (bot.z != null && (a.z - bot.z > 18 || bot.z - a.z > JUMP_UP))) return;
    a.points.forEach(function(p, k){ var q = a.points[(k+1)%a.points.length], ex = q.x-p.x, ey = q.y-p.y, L2 = ex*ex+ey*ey || 1;
      var t = Math.max(0, Math.min(1, ((bot.baseX-p.x)*ex + (bot.baseY-p.y)*ey)/L2)), px = p.x+ex*t, py = p.y+ey*t, d = Math.hypot(px-bot.baseX, py-bot.baseY);
      if(d < nbd){ var cx = 0, cy = 0; a.points.forEach(function(r){ cx += r.x; cy += r.y; }); cx /= a.points.length; cy /= a.points.length;
        nbd = d; nb = {x: px + (cx-px)*0.15, y: py + (cy-py)*0.15, a: a}; } }); });
  if(nb){ bot.baseX = bot.x = nb.x; bot.baseY = bot.y = nb.y; bot.z = nb.a.z; bot._area = nb.a.id; bot.path = []; bot.pathIdx = 0; bot._offNav = 0; logEvent(bot.id+": вне навмеша — перенесён на ближайший пол (заплатка)"); }
}
// (v335) звук приземления — одно место: слышат враги (как шаги, громко), на странице — запись приземления там, где он сейчас.
// LAND_DELAY — время полёта при запрыгивании — в 050 (v546: нужно цене пути уже при загрузке)
// (v546, владелец 10.11: «он может подойти вплотную и бесшумно запрыгнуть — должен уметь, когда нельзя палиться; на верхний этаж через
// щель — с шумом») kind: "up" — запрыгнул на уступ / ящик (вплотную, шагом — бесшумно: bot.walking — решение хозяина шага, 535); "gap" — прыжок
// через щель и спрыгивание — всегда слышно
function landSound(bot, quiet, kind){
  bot._landAt = 0;
  if(kind === "up" && bot.walking) return;
  var R = SOUND_RADIUS_RUN*(quiet ? 0.5 : 1);
  soundPings.push({x:bot.baseX, y:bot.baseY, team:bot.team, born:nowTs, radius:R});
  moveSoundEmit(bot, R, "steps", quiet ? "приземление (чек прыжком)" : "приземление");
  if(SND && SND.on) sndBody("land", bot.baseX, bot.baseY);
}
// (v334, М58, владелец: «в CS2 есть места, где прыгают для чека, — у B Apps, где стоит karrigan») чек прыжком. Места и как часто —
// из демок (tools/jumps_bake.py → MAP.pro.jumps: прыжок на месте, rate — прыжков за раунд; Mirage у B Apps — 0,49, у Ticket —
// 0,09). Стоит у такого места своей стороны (≤ 50 ед. карты), без контакта ≥ 2 с — прыгает с вероятностью rate / JUMP_HOLD_SEC
// в секунду (JUMP_HOLD_SEC — сколько про обычно стоят у места, проектное). В прыжке видно поверх укрытий (глаза на JUMP_APEX выше;
// закрывают стены, укрытия выше этого и дым) в конусе ±60° — и его оттуда тоже. Приземление с приседом тише (csdb.gg: «присесть перед приземлением —
// тише»): радиус × 0,5 — проектное число
var JUMP_HOLD_SEC = 30;
// (Б3, З9) верх прыжка: глаза / тело выше пола на 57 ед. — CS2: sv_jump_impulse 301,993 ед./с, sv_gravity 800 → v²/2g ≈ 57.
// «Вижу» с прыжка — как радар: visParts с поднятыми глазами (раньше только высокие стены visWallHit — 98–99 % «видели» без линии)
var JUMP_APEX = 57;
// (v575, В144, владелец 14.11: «почему подсадки нет? мало, но должно быть») подсадки про — MAP.pro.boosts (tools/boosts_bake.py: место, сторона,
// подсадок за раунд, сколько стоит наверху, насколько выше, когда от начала раунда). Решение — один раз за раунд, когда у места (≤ R px) двое своих
// (≤ pair px друг от друга), не в бою, во время, когда это делают про (± tPad с): с вероятностью rate·k — k подобран так, чтобы подсадок за раунд
// было как у про (замер — tools/measure/motion/boost.js.txt). Наверху глаза выше на lift (видит и виден поверх укрытий — visParts)
var BOOST = {R: 25, pair: 120, tPad: 5, k: 1};
function boostLift(b){ return b._boost && b._boost.top ? b._boost.lift : 0; }
function boostEnd(b){
  var BS = b._boost; if(!BS) return; b._boost = null;
  var o = bots.filter(function(x){ return x.id === BS.pair; })[0]; if(o && o._boost && o._boost.pair === b.id) boostEnd(o);
  if(BS.top && b.alive){ b._jump = {t: tick, up: false}; if(roundState === "live") landSound(b, false); }
}
// (v575, В144) прыжок на бегу у про: прыжков на минуту бега по повороту хода за 0,75 с (до 15 / 30 / 60 / 90 / 180°), полёт, с, доля скорости
// после приземления (12 демок Mirage, бег без своих выстрелов ±2 с — 4,15 в мин; pro_runjump_turn.py, pro_jumpspots.py)
// rate — подобрано под исход у про (замер tools/measure/motion/runjump.sh): у ботов пути реже круто поворачивают (поворот впереди > 90° — 2 % бега),
// поэтому частота по поворотам пути выше, чем у про, чтобы доли поворота хода за полёт были как у про (39 / 14 / 16 / 13 / 18 %), а всего —
// 4,15 в мин спокойного бега. Было по про напрямую [3,63, 3,44, 4,03, 7,43, 5,35]: доли 42 / 16 / 29 / 7 / 5 %, 3,3 в мин;
// [4,25, 3,79, 2,8, 17,4, 24,3]: 36 / 18 / 24 / 13 / 8 %, 5,0 в мин.
// keep — скорость через 4 тика после приземления / до отрыва (квантили 10/25/50/75/90, про); в полёте ход гаснет до keep − KEEP_ACC (за 4 тика
// после приземления разгон добавляет ~0,3 — подобрано: при 0,2 медиана вышла 0,86 против 0,76)
var RUN_JUMP = {turn: [15, 30, 60, 90, 180], rate: [3.83, 2.44, 1.55, 14.4, 45.4], air: 0.77, keep: [0.22, 0.53, 0.76, 0.84, 0.98], keepAcc: 0.3, adNone: 0.05,
  // A / D в воздухе (pro_runjump_stats.py, 470 прыжков на бегу): жмут в 95 % прыжков, клавиша зажата — доля полёта (квантили 10/25/50/75/90),
  // обе стороны за полёт — 52 %, при одной стороне и повороте ≥ 15° — в сторону поворота 77 %
  adFrac: [0.23, 0.51, 0.75, 0.91, 1.0], adBoth: 0.52, adToward: 0.77};
// клавиши A / D в полёте: расписание на прыжок [[с тика, до тика, сторона]] (сторона +1 — к повороту пути влево по карте), airKey — что зажато сейчас
function airKeysPlan(b, tn){
  var T = Math.round(RUN_JUMP.air*TICK_HZ), r = function(s){ return hashRand(tick*97 + b.id.charCodeAt(b.id.length-1)*13 + s); };
  var s0 = Math.abs(tn) >= 15 ? (r(1) < RUN_JUMP.adToward ? 1 : -1)*(tn > 0 ? 1 : -1) : (r(1) < 0.5 ? 1 : -1);
  if(r(4) < RUN_JUMP.adNone) return [];   // 5 % прыжков — без A / D
  var on = Math.round(peekQ(RUN_JUMP.adFrac, r(2))*T);
  if(r(3) < RUN_JUMP.adBoth){ var a = Math.round(on*0.6); return [[0, a, s0], [a, on, -s0]]; }
  return [[0, on, s0]];
}
function airKey(b){ var J = b._jc; if(!J || !J.keys) return 0; var a = tick - J.t; for(var i = 0; i < J.keys.length; i++) if(a >= J.keys[i][0] && a < J.keys[i][1]) return J.keys[i][2]; return 0; }
function pathTurnAhead(b, dist){   // насколько повернёт путь через dist px (°, со знаком): направление сейчас → направление участка пути там
  var x = b.baseX, y = b.baseY, a0 = null, a1 = null;
  for(var i = b.pathIdx; i < b.path.length; i++){ var w = b.path[i], d = Math.hypot(w[0]-x, w[1]-y); if(d < 1e-6) continue;
    var a = Math.atan2(w[1]-y, w[0]-x); if(a0 === null) a0 = a; a1 = a; if(d >= dist) break; dist -= d; x = w[0]; y = w[1]; }
  return a0 === null ? 0 : Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0))*180/Math.PI;   // со знаком
}
function jumpCheckTick(b){
  if(b._landAt && tick >= b._landAt && b.alive && roundState === "live") landSound(b, false, "up");   // (v335) запрыгнул — приземлился
  if(b._boost && (roundState !== "live" || !b.alive)){ boostEnd(b); return; }
  if(roundState !== "live" || !b.alive) return;
  // (v575, В144) подсадка: наверху — на тиммейте (его место, глаза выше на lift), пока не кончится время; кто-то из двоих погиб — конец
  var BS = b._boost;
  if(BS){
    var bo = bots.filter(function(o){ return o.id === BS.pair; })[0];
    if(!bo || !bo.alive || !bo._boost || tick >= BS.until) boostEnd(b);
    else if(BS.top){ b.baseX = bo.baseX; b.baseY = bo.baseY; }
    return;
  }
  var BO = MAP.pro && MAP.pro.boosts, rtB = simTime - roundStartTime;
  if(BO && BO.length && !b._jc && !b._fc && !b._sawEnemy && !b.planting && !b.defusing && !b._climb && !b.onLadder && !b.nadeTask &&
     tick - (b.lastShotTick||-1e9) >= 2*TICK_HZ && tick - (b._shotAtT||-1e9) >= 2*TICK_HZ){
    for(var bi = 0; bi < BO.length; bi++){ var q = BO[bi];
      if(q.side !== b.team || rtB < q.t[0] - BOOST.tPad || rtB > q.t[4] + BOOST.tPad || Math.hypot(q.x - b.x, q.y - b.y) > BOOST.R) continue;
      var bt = b._boostTry || (b._boostTry = {}); if(bt[bi] === roundNum + "|" + matchNum) continue;
      var mate = bots.filter(function(o){ return o !== b && o.alive && o.team === b.team && !o._boost && !o._fc && !o._sawEnemy && !o._jc && !o._climb && !o.onLadder &&
        Math.hypot(o.x - b.x, o.y - b.y) <= BOOST.pair; })[0];
      if(!mate) continue;
      bt[bi] = roundNum + "|" + matchNum;   // одно решение на место за раунд — когда пара впервые у места
      if(hashRand(tick*331 + b.id.charCodeAt(b.id.length-1)*17 + bi*7) >= Math.min(1, q.rate*BOOST.k)) continue;
      var dn = Math.hypot(q.x - b.x, q.y - b.y) <= Math.hypot(q.x - mate.x, q.y - mate.y) ? b : mate, up = dn === b ? mate : b;
      var until = tick + Math.round(peekQ(q.dur, hashRand(tick*53 + bi))*TICK_HZ);
      dn._boost = {pair: up.id, top: false, until: until, lift: 0}; up._boost = {pair: dn.id, top: true, until: until, lift: q.lift};
      up.baseX = dn.baseX; up.baseY = dn.baseY; up._jump = {t: tick, up: true};
      logEvent(up.id + ": подсадка на " + dn.id + " — " + calloutName(dn.x, dn.y));
      return;
    }
  }
  var JS = MAP.pro && MAP.pro.jumps;
  var J = b._jc;
  if(J){
    var age = tick - J.t;
    if(age === (J.run ? Math.round(RUN_JUMP.air*TICK_HZ/2) : 20)){   // верх прыжка — видно поверх укрытий
      bots.forEach(function(o){ if(!o.alive || o.team === b.team) return; var d = Math.hypot(o.x-b.x, o.y-b.y); if(d > 1100) return;
        if(smokeBlocks(b.x, b.y, o.x, o.y)) return;
        var bS = visParts(b.x, b.y, false, o.x, o.y, o.crouching, true, b.z, o.z, JUMP_APEX, 0), oS = visParts(o.x, o.y, o.crouching, b.x, b.y, false, true, o.z, b.z, 0, JUMP_APEX);
        if((bS.head || bS.body) && tick >= (b.blindUntil||0) && _angOff(Math.atan2(o.y-b.y, o.x-b.x), b.facing) < 1.05){ intelPush(b.team, {type:"spotted", x:o.x, y:o.y, id:o.id, by:b.id, conf:1});
          voiceLog(b.team, "jc"+o.id+Math.floor(tick/(4*TICK_HZ)), b.id, "чек прыжком: вижу "+nick(o.id)+" — "+calloutName(o.x, o.y)); }
        if((oS.head || oS.body) && tick >= (o.blindUntil||0) && o.facing !== undefined && _angOff(Math.atan2(b.y-o.y, b.x-o.x), o.facing) < 1.05) intelPush(o.team, {type:"spotted", x:b.x, y:b.y, id:b.id, by:o.id, conf:1}); });
    }
    if(J.run && age >= Math.round(RUN_JUMP.air*TICK_HZ)){   // (v575, В144) приземление с бега — громко, ход теряет долю (у про ×0,65)
      landSound(b, false); b._jc = null; return;
    }
    if(!J.run && age === 38){   // приземление, с приседом
      landSound(b, true); b._jc = null;
    }
    return;
  }
  // (v575, В144, владелец 13.11: «как про сокращают углы — у стенки прыгает и в воздухе поворачивает») прыжок на бегу: у про (12 демок Mirage,
  // tools/measure/motion/pro_runjump_turn.py) — 3,9 прыжка на минуту бега по земле (≥ 200 ед./с), почти не зависит от поворота хода впереди
  // (на 60–90° — вдвое чаще); ход в полёте поворачивает (медиана 37°) — по пути, как у бота; полёт 0,77 с; после приземления скорость ×0,65.
  // Не в бою: вижу врага / стрелял / в меня стреляли ≤ 2 с — не прыгает (у про 12 % прыжков рядом с выстрелами)
  var sp = (b.curSpeed || 0)*PX_UNITS;
  if(sp >= 200 && !b.walking && !b._fc && !b._sawEnemy && !b._climb && !b.onLadder && !b.planting && !b.defusing && !(b.nadeTask && b.nadeTask.runPh) &&
     tick >= (b.throwUntil || 0) && tick - (b._shotAtT||-1e9) >= 2*TICK_HZ && tick - (b.lastShotTick||-1e9) >= 2*TICK_HZ && b.path && b.pathIdx < b.path.length){
    var tn = pathTurnAhead(b, (b.curSpeed || 0)*RUN_JUMP.air), k = 0; while(k < RUN_JUMP.turn.length - 1 && Math.abs(tn) > RUN_JUMP.turn[k]) k++;
    if(hashRand(tick*613 + b.id.charCodeAt(b.id.length-1)*41 + roundNum*11) < RUN_JUMP.rate[k]/(60*TICK_HZ)){ b._jc = {t: tick, run: true, tn: tn, keys: airKeysPlan(b, tn), v0: b.curSpeed, kt: Math.max(0.1, peekQ(RUN_JUMP.keep, hashRand(tick*71 + b.id.charCodeAt(0)*5)) - RUN_JUMP.keepAcc)}; b._jump = {t: tick, up: true}; return; }
  }
  if(!JS || !JS.length) return;
  if(b.curSpeed > 20 || b._sawEnemy || b.planting || b.defusing || tick - (b._shotAtT||-1e9) < 2*TICK_HZ || tick - (b.lastShotTick||-1e9) < 2*TICK_HZ) return;
  var sp = null; for(var i=0;i<JS.length;i++){ var q = JS[i]; if(q.side === b.team && Math.hypot(q.x-b.x, q.y-b.y) < 50){ sp = q; break; } }
  if(!sp) return;
  if(hashRand(tick*977 + b.id.charCodeAt(b.id.length-1)*31 + roundNum*7) < sp.rate/(JUMP_HOLD_SEC*TICK_HZ)){ b._jc = {t:tick}; b._jump = {t:tick, up:true}; }
}
// (v575, В140, владелец 13.11: «повтори движение игроков полностью — контрстрейфы, джиглы»; выгрузка каждого тика, 12 демок Mirage,
// tools/motion_ctx.py) вне перестрелки про почти всё время «нажимают» A / D: стоя на угле — 52 смены в минуту, нажатие ~0,11 с, сдвиг ~3 ед.;
// шагом — 46 в минуту, ~0,23 с, ~12 ед.; боты не качались (5,5 смен в минуту всего). Клавиши стрейфа — одно место: бот жмёт сторону по
// расписанию из распределений про (нажатие / пауза, квантили 10/25/50/75/90 %), ход — физикой CS2 (разгон CS_ACCEL, трение CS_FRIC,
// встречная клавиша гасит ход — как стрейф в перестрелке, 470); стоя — не уходит с точки (отъехал дальше KEYS_DRIFT — жмёт обратно).
// Перестрелку ведёт 470 (fightStrafe); бег (≥ 200 ед./с) — без качания (у про 10 в минуту)
// (12 демок Mirage, tools/motion_ctx.py; пауза — вся, включая длинные; same — доля нажатий в ту же сторону, что прошлое)
var KEYS_PRO = {hold: {press: [0.047, 0.078, 0.109, 0.188, 0.422], gap: [0.0, 0.016, 0.078, 0.219, 0.625], same: 0.35},
                walk: {press: [0.094, 0.141, 0.234, 0.375, 0.781], gap: [0.0, 0.016, 0.062, 0.203, 0.516], same: 0.35}};
var KEYS_WALK_ON = 0.55;
var KEYS_DRIFT = 22/PX_UNITS;   // ед. → px: стоя дольше 2 с про отходят от середины места не дальше 22 ед. (медиана наибольшего отхода, 1127 отрезков, 12 демок) — дальше жмёт обратно
function keysRand(b, salt){ return hashRand(tick*37 + b.id.charCodeAt(0)*13 + b.id.charCodeAt(b.id.length-1)*29 + salt); }
function strafeKeysTick(b, dt){
  var J = b._keys || (b._keys = {key: 0, until: 0, v: 0, last: 1, ax: null, ay: null, ctx: null});
  var sp = (b.curSpeed || 0)*PX_UNITS, ctx = null;
  // на ходу (100–200 ед./с) про качаются не всё время: без качания 15 смен в минуту, с качанием на каждом отрезке — 70, у про 46 —
  // качается примерно в половине отрезков ходьбы (доля подобрана под цифру про — KEYS_WALK_ON)
  var wseg = sp >= 100 && sp < 200; if(wseg && !J.wseg) J.walkOn = keysRand(b, 4) < KEYS_WALK_ON; J.wseg = wseg;
  if(roundState === "live" && b.alive && !b._fc && !b._boost && !b.planting && !b.defusing && tick >= (b.throwUntil || 0) && !b._climb && !b.onLadder && !b._sbOff){
    // (v575, замер 8 матчей: переносов 21 → 62 на 48 раундов) стоя — только когда дошёл (пути нет): качание у конца пути сбивало бота с края пола
    if(sp < 100 && !(b.path && b.pathIdx < b.path.length) && !b._sawEnemy && !(b.post && taskProp(b.post.tag, "holdStrafeSkip")) && !(b.fakeHoldUntil && tick < b.fakeHoldUntil) && !(tick < (b.blindUntil||0))) ctx = "hold"; else if(sp >= 100 && sp < 200 && !b.atPost && J.walkOn) ctx = "walk"; }
  if(ctx !== J.ctx){ J.ctx = ctx; J.key = 0; J.until = tick; J.ax = b.baseX; J.ay = b.baseY; }
  // (v575, прогон 233: «застрял (plantspot): шаг проходит, а стоит» 0 → 12) точка, от которой качание держит (стоя и на ходу — снос от линии
  // пути тоже не больше KEYS_DRIFT; было: на ходу без предела — нажатия в ту же сторону копили снос), сдвигается вместе с остальным
  // ходом (путь, торможение у конца пути): иначе бот, идущий медленно к точке, отходил от неё дальше KEYS_DRIFT — и качание тянуло назад
  else if(ctx && J.px != null){ J.ax += b.baseX - J.px; J.ay += b.baseY - J.py; }
  J.px = b.baseX; J.py = b.baseY;
  // качание кончилось (увидел врага, задача, бросок) — клавиша отпущена, ход гасит трение (CS2), а не пропадает мгновенно;
  // перестрелку ведёт 470 — она берёт этот ход себе (fightStrafe, начальная скорость)
  if(!ctx && b._fc) return;   // ход качания забрала перестрелка (fightStrafe обнуляет J.v, когда берёт)
  if(!ctx && (!b.alive || roundState !== "live" || b._climb || b.onLadder)){ J.v = 0; return; }
  if(ctx){   // ось — поперёк взгляда (стоя) / хода (идёт); после конца качания — та же ось, пока ход не погаснет
    var a = ctx === "walk" ? (b.heading !== undefined ? b.heading : 0) : (b.facing !== undefined ? b.facing : 0); J.ux = -Math.sin(a); J.uy = Math.cos(a);
    if(tick >= J.until){
      if(J.key){ J.key = 0; J.until = tick + Math.max(1, Math.round(peekQ(KEYS_PRO[ctx].gap, keysRand(b, 1))*TICK_HZ)); }
      else { var s = keysRand(b, 3) < KEYS_PRO[ctx].same ? J.last : -J.last;
        if(J.ax != null){ var off = (b.baseX - J.ax)*J.ux + (b.baseY - J.ay)*J.uy; if(Math.abs(off) > KEYS_DRIFT) s = off > 0 ? -1 : 1; }
        J.key = s; J.last = s; J.until = tick + Math.max(1, Math.round(peekQ(KEYS_PRO[ctx].press, keysRand(b, 2))*TICK_HZ)); } }
  } else { if(!J.v) return; J.key = 0; }
  var ux = J.ux, uy = J.uy;
  var vmax = SPEED*weaponSpeedMul(b), v = J.v, av = Math.abs(v);
  if(J.key && v*J.key >= 0) v = J.key*Math.min(vmax, av + Math.max(0, CS_ACCEL*vmax - CS_FRIC*av)*dt);
  else { var dec = (J.key ? csDecel(av, vmax) : CS_FRIC*Math.max(av, CS_STOP/PX_UNITS))*dt; v = av <= dec ? 0 : v - (v < 0 ? -1 : 1)*dec; }
  J.v = v;
  if(Math.abs(v) < 1e-3) return;
  var nx = b.baseX + ux*v*dt, ny = b.baseY + uy*v*dt;
  // (v575, прогон 233: переносов 59 → 156 на 100 раундов Mirage — качание уводило за край навмеша, где стены нет, потом бота возвращало рывком)
  // шаг качания — только внутрь пола навмеша своего уровня, без допуска у края: с края (допуск 3 ед., у связанных участков до 10) новый путь
  // уводил за край (Mirage B Apps, 454,433: участки 1940 / 1960 кончаются на y 426, бот с 428 шёл на 433 — «вне навмеша», перенос)
  var lvK = navArea(b._area) ? navArea(b._area).z : b.z;
  if(stepBlocked(b.baseX, b.baseY, nx, ny, b) || !navNearLevel(nx, ny, 0, lvK)){ J.v = 0; return; }   // упёрся — клавишу не отпускает (у про длинные нажатия на малой скорости — в стену)
  b.baseX = nx; b.baseY = ny; J.px = nx; J.py = ny;
}
function stepTick(){
  tick++;
  simTime = tick * TICK_MS / 1000;
  // (v564, В89, владелец 11.11: «после конца раунда игроки бегают ещё ~5 с, плашку MVP не убирать») после конца раунда идёт только движение:
  // боты доходят по своим путям; мозги, гранаты, стрельба и проверка конца раунда стоят (убийств и второго конца раунда нет)
  var postRun = false;
  if(roundState === "ending"){
    if(simTime - roundEndTime >= ROUND_RESTART_DELAY_SEC){ resetRound(); return; }
    postRun = true;
  }
  if(roundState === "matchover"){
    if(simTime - roundEndTime >= 7) newMatch();
    return;
  }
  if(roundState === "freeze"){
    freezeLookTick(); nadePrecalcTick();   // (физика гранат, этап 3) решения лайнапов — заранее, пока стоят
    if(simTime >= roundStartTime){ roundState = "live"; FREEZE_FX = []; logEvent("Freeze-тайм окончен — раунд пошёл"); }
    return;
  }
  if(SANDBOX.on) sbTick();   // (v536) песочница: часы раунда и бомбы стоят (677)
  if(DEMOV.on) dvTick();     // (v571) раунд из демки: события и места игроков — из демки (678)
  if(postRun){ weaponPickupTick(); itemPickupTick(); }   // (v564, В89) после раунда — подбирают оружие и предметы (как в CS2 до рестарта)
  if(!postRun){
  teamBrains(); // шаг 4: тактика T / расстановка и ротации CT / бомба
  if(roundState !== "live") return;
  nadeBrains(); updateNadeTasks(); nadesTick(); // шаг 5: гранаты
  if(roundState === "live" && tick % 16 === 0) tClearCalls();
  bombBeepTick();   // (v323, М40; v437 — и кромка экрана) пиканье бомбы   // (v321, М24) «B чисто» — T увидел пустую зону у сайта
  if(roundState !== "live") return;
  }
  var dtSec = TICK_MS/1000, maxDelta = ACCEL*dtSec;
  // movement tuning (plan-driven "natural, not robotic" pass):
  // ARRIVE_RADIUS = corner-rounding radius — a waypoint counts as "passed"
  //   once the bot is this close, instead of demanding pixel-exact arrival,
  //   so the bot curves through a corner rather than stopping dead at it.
  // BRAKE_RADIUS = braking point — start easing off full speed this far from
  //   the true final destination, so a patrol stop looks like deceleration,
  //   not a hard freeze.
  // TURN_RATE = max heading change per second — movement direction eases
  //   toward the target direction instead of snapping instantly, which is
  //   what actually produces a curved, natural-looking turn (the funnel path
  //   above already cut the corner geometrically; this is what makes the
  //   bot's own motion trace that curve smoothly instead of in dead-straight
  //   segments with instant pivots at each vertex).
  var ARRIVE_RADIUS = 40, BRAKE_RADIUS = 90, TURN_RATE = BAL.turnRate || 6.0; // (10) на повороте бот шёл дугой и тёрся о угол
  // slope = |Δz|/расстояние по отрезку пути; 0.35 отсекает обычные пологие
  // перепады этажей и ловит именно лестницы/рампы (плюс любой резкий обрыв,
  // что по факту тоже честная "точность падает, не задерживайся" ситуация)
  var STAIRS_SLOPE_THRESHOLD = 0.35;
  bots.forEach(function(bot){
    if(!bot.alive) return;
    bot.px = bot.x; bot.py = bot.y; bot.pfacing = bot.facing;
    if(bot._sbOff && !bot._sbGo && !bot._climb){ bot.curSpeed = 0; return; }   // (v543) начатый подъём / прыжок доводится до конца   // (v536) песочница: ИИ выключен — стоит; (v538) но идёт по приказу владельца, ИИ при этом не включается (677)   // (v414, М154) взгляд на начало тика — только для рисования (сглаживание, 620_draw)
    updatePost(bot);
    updateReload(bot);
    if(!bot.post) updateRoamer(bot);
    // (v530, отметка владельца 10.11 «застрял в фазе роумер проверяет точку»: флаг чека остался на 98 с — его снимает только updateRoamer,
    // а он не зовётся, пока у бота есть задача; скорость при этом 0) получил задачу — чек роумера кончился
    else if(bot.roamChecking) bot.roamChecking = false;
    // этаж под ботом (раздел 9: метка уровня на радаре) — раз в 16 тиков хватает
    floorViewTick(bot);   // (v535) под / над другим этажом — по 3D-геометрии, каждый тик (370)
    // "на лестнице" пересчитывается только в ветке движения — если бот
    // остановился (держит угол, стоит на посту), флаг раньше оставался от
    // последнего отрезка пути навсегда: бот, дошедший до поста по лестнице,
    // весь раунд стрелял со штрафом лестницы 0.35 и не мог выбрать "держать
    // угол". Сбрасываем каждый тик; движение ниже выставит заново, если надо.
    bot.onStairs = false;
    moveWalkTick(bot);   // шагом / бегом — одно место (535_move_mode)
    knifeTick(bot); prePeekTick(bot); exposedShiftTick(bot); jumpCheckTick(bot);
    var runSpeed = (bot.walking ? SPEED*WALK_SPEED_FRAC : SPEED) * weaponSpeedMul(bot);
    // атакующий, который прямо сейчас видит врага, останавливается и
    // стреляет (контр-страф), а не продолжает бежать по патрульному пути —
    // иначе он сам уходил из линии огня посреди перестрелки. Уйти с линии
    // за укрытие и выглянуть снова — fightCycleTick (по данным про).
    moveSpeedTick(bot, runSpeed, BRAKE_RADIUS, maxDelta); runSpeed = MOVE.run;   // стоять / идти / огонь / торможение — одно место (535_move_mode)
    var burn = MOVE.burn;
    if(tick % 16 === 0){ var TR = bot._trail || (bot._trail = []); TR.push({x:bot.baseX, y:bot.baseY}); if(TR.length > 8) TR.shift(); }
    // перестрелка по данным: уйти с линии за укрытие и выглянуть снова
    fightCycleTick(bot, dtSec, bot.planting || bot.defusing || burn || tick < (bot.blindUntil||0));
    if(bot._fc && bot._fc.ph !== "line"){ bot.curSpeed = bot._fc.moving ? (bot._fc.mv || 0) : 0; bot._stopWhy = bot._fc.moving ? "перестрелка — идёт за укрытие / на линию" : "перестрелка — стоит за укрытием"; }

    // ---------- держит угол "живьём" ----------
    // (v575, В140) было: переминание шагом ±24 px с паузами 1–2,5 с (ручные числа). У про стоя на угле — частые мелкие касания A / D (52 в минуту,
    // нажатие ~0,11 с, сдвиг ~3 ед.) — теперь это клавиши стрейфа (strafeKeysTick ниже, данные демок); задачи без переминания — те же
    // (holdStrafeSkip, фейк-холд — условия в strafeKeysTick)
    if(bot._fc) bot._hold = null;

    // ---------- эмиссия звука шагов (план §13, минимальная версия для §3) ----------
    // Дискретные "шаги" с интервалом, не сплошное поле — бег громче и чаще,
    // тихий шаг тише и реже. Без затухания через стены (упрощение v1 — если
    // понадобится точнее, тут же место, где учитывать hasLOS/дистанцию до стены).
    // вода (зоны со свойством water в наборе карты) — всплески слышно громче, и даже шифтом
    var wet = BAL.soundMore && bot.curSpeed > 5 && inWater(bot.baseX, bot.baseY);
    if(bot.curSpeed > 5 && (!(BAL.silentWalk && bot.walking) || wet)){ // шифт (тихий шаг) не слышно, как в CS
      // (v332, М50, владелец: «скорость шагов не соответствует скорости игрока») шаг — по пройденному пути, а не по времени:
      // длина шага такая, что на полной скорости (225 ед./с, винтовка) — раз в FOOTSTEP_INTERVAL_RUN тиков, как было; с AWP реже,
      // с ножом чаще, при разгоне и торможении — в такт скорости
      var stride = SPEED*(bot.walking ? WALK_SPEED_FRAC*FOOTSTEP_INTERVAL_WALK : FOOTSTEP_INTERVAL_RUN)/TICK_HZ;
      var mv = bot._stepP ? Math.min(Math.hypot(bot.baseX-bot._stepP.x, bot.baseY-bot._stepP.y), 3*SPEED/TICK_HZ) : 0;   // реально пройдено за тик (упёрся в стену — не шагает)
      // (v546, владелец 10.11: «добавь звук лестнице, когда он спускается и поднимается»; бег по лестнице слышно как бег, шагом — бесшумно)
      // на лестнице шаг — и по высоте (ед. игры → ед. карты, pxUnits); в прыжке (подъём из демок, щель) шагов нет — звучит только приземление
      var CL = bot._climb; if(CL && CL.jump) mv = 0; else if(CL && bot._stepP && bot._stepP.z != null && bot.z != null) mv = Math.hypot(mv, (bot.z - bot._stepP.z)/(MAP.pxUnits || 2.5));
      bot._stepP = {x:bot.baseX, y:bot.baseY, z:bot.z}; bot._stepDist = (bot._stepDist||0) + mv;
      if(bot._stepDist >= stride){
        bot._stepDist -= stride; if(bot._stepDist > stride) bot._stepDist = 0;
        bot.lastStepTick = tick;
        var soundRadius = (wet ? (bot.walking ? 220 : 460) : (bot.walking ? SOUND_RADIUS_WALK : SOUND_RADIUS_RUN)) * (BAL.stepHearMul || 1);
        soundPings.push({x:bot.baseX, y:bot.baseY, team:bot.team, born:nowTs, radius:soundRadius}); if(SND && SND.on){ if(CL) sndLadder(bot.baseX, bot.baseY); else sndStep(bot.baseX, bot.baseY); }   // (v552) на лестнице — звук лестницы
        // (4) сам знает, что шумит: бежал в пределах слышимости места, где враг вероятен
        if(BAL.heardMe && roundState === "live"){ var zN = bzOf(bot.x, bot.y); if(zN >= 0){ var nearZ = [zN].concat(BZ.nbr[zN]||[]);
          if(nearZ.some(function(j){ var cj = BZ.cent[j]; return cj && Math.hypot(cj.x-bot.x, cj.y-bot.y) < soundRadius && reachPossible(bot.team, j) && beliefZoneKnown(bot.team, j) >= 0.2; })) bot._noisyT = tick; } }
        if(soundPings.length > 40) soundPings.shift();
        moveSoundEmit(bot, soundRadius, wet ? "water" : "steps", (wet ? "всплески в воде" : CL ? "лестница" : "шаги")+(bot.walking ? " (тихо)" : ""));
      }
    }

    // (v415, Б5к шаг 3, М154) в живой перестрелке (_fc) по маршруту не идёт. Раньше на линии шёл, когда «не держит» врага (_fc.own гаснет
    // ≈ 0,25 с после контакта): при мигающей видимости бот чередовал стрейф и шаг по маршруту (подпись v414 на м3: 116 снимков за 45 с).
    // Перестрелка кончается как раньше — врага не видно дольше паузы про (470, PEEK_PRO.pause)
    if(!ladderTick(bot) && !((bot.holding && !bot._burning) || bot.curSpeed <= 0.5 || bot._fc)){
      if(bot.path.length === 0 || bot.pathIdx >= bot.path.length){
        if(bot.forcedRetreat) bot.forcedRetreat = false;
        assignNewDestination(bot, tick);
      } else {
        // corner rounding: skip ahead past any waypoint already within
        // ARRIVE_RADIUS (except the last — that one must be actually reached)
        // ...но только если от текущей позиции до СЛЕДУЮЩЕЙ точки прямая
        // свободна. Раньше точка у угла стены пропускалась "досрочно" за 40px,
        // и бот срезал прямо в угол — вершины пути как раз стоят вплотную к
        // углам, так что это была главная причина "упёрся и трётся об стену".
        // (вплотную, <6px, точка считается пройденной в любом случае — иначе
        // бот, стоящий ровно в вершине у угла, так бы в ней и остался)
        while(bot.pathIdx < bot.path.length-1){
          var wdCur = Math.hypot(bot.path[bot.pathIdx][0]-bot.baseX, bot.path[bot.pathIdx][1]-bot.baseY);
          // (v341, отметка владельца: karrigan по кругу у Catwalk) точку подъёма/спуска (> 40 ед. от своей высоты, проектное число) и
          // следующую за ней досрочно не пропускать: раньше подъём «срезался», и бот шёл к следующей точке понизу, под верхний этаж
          var wpA = bot.path[bot.pathIdx], wpB = bot.path[bot.pathIdx+1], lvlOk = bot.z == null || ((wpA[2] == null || Math.abs(wpA[2] - bot.z) <= 40) && (wpB[2] == null || Math.abs(wpB[2] - bot.z) <= 40));
          // (v555, отметка владельца м300 р5: путь обходил молотов на Cross по краю, а срезанный угол вёл прямо в огонь — бот 4,5 с ждал у края)
          // и не срезать, если прямая до следующей точки идёт через огонь (а до этой — нет)
          if(wdCur < 6 || (lvlOk && wdCur < ARRIVE_RADIUS && !crossesWall(bot.baseX, bot.baseY, wpB[0], wpB[1]) && navSegOnLevel(bot.baseX, bot.baseY, bot.z, wpB[0], wpB[1], wpB[2]) &&
              !(fires.length && fireOnSeg(bot.baseX, bot.baseY, wpB[0], wpB[1], bot.z) && !fireOnSeg(bot.baseX, bot.baseY, wpA[0], wpA[1], bot.z)))) bot.pathIdx++;
          else break;
        }
        var target = bot.path[bot.pathIdx];
        var dx = target[0]-bot.baseX, dy = target[1]-bot.baseY;
        var dist = Math.hypot(dx,dy);
        var isLastLeg = bot.pathIdx === bot.path.length-1;
        var step = bot.curSpeed * dtSec;
        // (v370, владелец: «не стоят в толпе») идём за своим, который идёт туда же, — держим дистанцию, а не наступаем ему на пятки:
        // у про на выходе ближайший свой ближе 60 ед. карты только 11–13 % времени (tools: демки Mirage / Ancient), у ботов — 25 %
        // (v448, док владельца 28.10 №4: «когда бегут по склону, сильно замедляются») раньше задний плёлся за своим на 25–36 % скорости
        // (матч 1 р1: T1 за T3 на спавне — 10–12 ед. за 16 тиков вместо 24; у про в первые 10 с середина скорости 95, у ботов 85). Теперь
        // сначала обходит сбоку (шаг в сторону от своего, если там пол своего уровня без обрыва и не стена), и только если некуда — тормозит
        var folK = 1, folSide = 0;
        if(dist > FOLLOW_GAP){
          var fx = dx/Math.max(dist, 0.01), fy = dy/Math.max(dist, 0.01);
          for(var fi = 0; fi < bots.length; fi++){ var fo = bots[fi]; if(fo === bot || !fo.alive || fo.team !== bot.team || !(fo.curSpeed > 40) || fo.heading === undefined) continue;
            var ox = fo.x-bot.x, oy = fo.y-bot.y, fwd = ox*fx + oy*fy, crs = ox*fy - oy*fx, lat = Math.abs(crs);
            if(fwd > 0 && fwd < FOLLOW_GAP && lat < 40 && Math.cos(fo.heading)*fx + Math.sin(fo.heading)*fy > 0.5){ var kf = Math.max(0.25, (fwd - 20) / (FOLLOW_GAP - 20));
              if(kf < folK){ folK = kf; folSide = crs > 0 ? -1 : 1; } } }   // folSide — в сторону, противоположную своему
          if(folK < 1){
            var sdx = fx*0.8 + fy*folSide*0.6, sdy = fy*0.8 - fx*folSide*0.6, sqx = bot.baseX + sdx*30, sqy = bot.baseY + sdy*30;
            if(!stepBlocked(bot.baseX, bot.baseY, sqx, sqy, bot) && navSegOnLevel(bot.baseX, bot.baseY, bot.z, sqx, sqy, bot.z) && navSegNoDrop(bot.baseX, bot.baseY, bot.z, sqx, sqy, bot.z)){ dx = sdx*dist; dy = sdy*dist; }
            else step *= folK;
          }
        }

        // "лестницы" (план §3): нет отдельного типа портала на навмеше, зато
        // funnel() уже даёт высоту (z) каждой точки пути (elevation, не этаж-
        // индекс) — крутой подъём/спуск на коротком отрезке ЭТО и есть лестница/
        // рампа. Считаем прямо по текущему отрезку пути, каждый тик — дёшево,
        // всего одна точка сравнения, а не отдельная предрасчитанная разметка.
        var legFromZ = bot.pathIdx > 0 ? bot.path[bot.pathIdx-1][2] : bot.z;
        var legToZ = target[2];
        var legLen = Math.max(1, Math.hypot(target[0]-(bot.pathIdx>0?bot.path[bot.pathIdx-1][0]:bot.baseX), target[1]-(bot.pathIdx>0?bot.path[bot.pathIdx-1][1]:bot.baseY)));
        bot.onStairs = Math.abs(legToZ - legFromZ) / legLen > STAIRS_SLOPE_THRESHOLD;

        // smooth turning: ease the actual movement heading toward the
        // direction to target, capped at TURN_RATE — this is what replaces
        // the old instant-snap "walk in dead-straight lines" motion
        var desiredHeading = dist > 0.01 ? Math.atan2(dy,dx) : (bot.heading!==undefined ? bot.heading : 0);
        if(bot.heading === undefined) bot.heading = desiredHeading;
        var da = desiredHeading - bot.heading;
        da = ((da + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI; // shortest signed angle
        // при отходе разворачиваемся сразу, а не плавной дугой: иначе бот по
        // инерции ещё несколько шагов бежал туда же, куда бежал — то есть на врага
        var maxTurn = TURN_RATE * dtSec * (bot.state === "retreat" ? 5 : 1);
        bot.heading += Math.max(-maxTurn, Math.min(maxTurn, da));
        if(bot.facing === undefined) bot.facing = bot.heading; // first tick / just respawned — nothing to derive an actual-movement facing from yet
        // NOTE: bot.facing (the rendered/visual direction) is otherwise set
        // further down from the ACTUAL movement this tick, not from
        // bot.heading — see the comment there for why.

        var moveX, moveY;
        if(isLastLeg && dist <= step){
          moveX = dx; moveY = dy; // final approach: snap exactly onto the true destination, don't overshoot or orbit it
        } else {
          // (10) крутой поворот: сбросить скорость, а не бежать дугой по старому
          // направлению в угол стены (там бот тёрся и "залипал")
          var daLeft = Math.abs(((desiredHeading - bot.heading + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
          if(BAL.cornerSlow && daLeft > 0.5){ var cs = Math.max(0.3, 1 - (daLeft-0.5)/1.6); step *= cs; bot.curSpeed = Math.min(bot.curSpeed, Math.max(bot.curSpeed*0.9, runSpeed*cs)); }
          moveX = Math.cos(bot.heading) * step;
          moveY = Math.sin(bot.heading) * step;
        }
        var nx = bot.baseX+moveX, ny = bot.baseY+moveY;
        var startX = bot.baseX, startY = bot.baseY;
        // walls are a physical obstacle for movement (not just LOS) — a
        // straight zone-to-portal-to-zone line can still clip a wall corner
        // on a hand-drawn map, so check before committing the step.
        // (v450г) путь идёт сквозь огонь (обход длиннее, 050), а заходить в огонь боту не по делу (fireCommit) — ждёт у края, пока не
        // погаснет (fireGoneRepath, 370). Раньше упирался в край: веер проб, «застрял» → отталкивание, сброс пути, тот же путь заново —
        // переносы у огня на Ancient 58 → 128 на 100 раундов (замер 28.10)
        var fireWait = !inFire(bot.baseX, bot.baseY, bot.z) && inFire(nx, ny, bot.z) && !fireCommit(bot) && fireOnSeg(bot.baseX, bot.baseY, target[0], target[1], bot.z);
        // (v555) упёрся в огонь, путь которого строился без него, — один раз на этот огонь путь заново (обход, если он не длиннее FIRE_DETOUR, 050)
        var fwF = fireWait ? inFire(nx, ny, bot.z) : null, fwSkip = false;
        if(fwF && bot._fireRp !== fwF){ bot._fireRp = fwF; bot.path = []; bot.pathIdx = 0; fireWait = false; fwSkip = true; bot.curSpeed = 0; }
        if(fwSkip){}
        else if(fireWait){ bot.curSpeed = 0; bot.walking = false; bot._fireWaitT = tick; }
        else if(!stepBlocked(bot.baseX,bot.baseY,nx,ny,bot)){ // стены + в огонь без причины не заходим
          bot.baseX = nx; bot.baseY = ny;
          if(isLastLeg && dist <= step){ bot.baseX = target[0]; bot.baseY = target[1]; bot.pathIdx++; }   // (v323) высота — только по навмешу (ниже), не по точке пути
        } else {
          // blocked — first try the basic wall-slide (each axis alone),
          // then, if that ALSO fails (both axes blocked — a corner, or a
          // local navmesh/wall mismatch pinning the bot right against
          // something), probe a fan of directions around the desired
          // heading and take the first that's actually clear. This is what
          // stops the "faces the wall and does nothing for half a second"
          // look: instead of freezing until stuckTicks forces a repath, the
          // bot immediately sidesteps around whatever it hit, the same tick.
          // Слайд засчитывается, только если он реально двигает бота: когда
          // бот смотрит почти перпендикулярно в стену, составляющая вдоль стены
          // крошечная (доли пикселя) — раньше такой "слайд" считался успехом,
          // веер проб не запускался, и бот тёрся об стену до сброса пути.
          var minSlide = step*0.3;
          var nx1 = bot.baseX+moveX;
          var slid = false;
          if(Math.abs(moveX) >= minSlide && !stepBlocked(bot.baseX,bot.baseY,nx1,bot.baseY,bot)){
            bot.baseX = nx1; slid = true;
          } else {
            var ny2 = bot.baseY+moveY;
            if(Math.abs(moveY) >= minSlide && !stepBlocked(bot.baseX,bot.baseY,bot.baseX,ny2,bot)){
              bot.baseY = ny2; slid = true;
            }
          }
          if(!slid){
            var probeAngles = [30,-30,60,-60,90,-90,120,-120,150,-150,180];
            for(var pa=0; pa<probeAngles.length; pa++){
              var pang = bot.heading + probeAngles[pa]*Math.PI/180;
              var pstep = step*0.7; // shorter step while feeling around a corner — less likely to clip something else
              var pnx = bot.baseX + Math.cos(pang)*pstep, pny = bot.baseY + Math.sin(pang)*pstep;
              if(!stepBlocked(bot.baseX,bot.baseY,pnx,pny,bot)){
                bot.baseX = pnx; bot.baseY = pny;
                break;
              }
            }
          }
        }
        // stuck detection uses REAL distance covered this tick, not which
        // branch ran — a wall-slide that only inches forward (e.g. the path
        // runs almost flush along a jagged wall) must still count as stuck,
        // otherwise the bot "moves" by fractions of a pixel forever instead
        // of ever giving up on a bad straight-line path.
        var actuallyMoved = Math.hypot(bot.baseX-startX, bot.baseY-startY);
        // (v403) высота бота — одно место navFollowFloor (370): после шага здесь и после любого другого движения за тик (конец цикла)
        if(actuallyMoved > 0) navFollowFloor(bot);
        if(fireWait){ bot.stuckTicks = 0; bot._np = null; bot._netStuck = 0; bot._progTick = tick; bot._progBest = Infinity; bot._idleT = tick; bot._trail = []; }
        else {
        // "топчется": каждый тик куда-то сдвигается (веер проб у угла туда-сюда),
        // но за 1.5с никуда не ушёл — раньше это не считалось застреванием
        // (движение в тике было), и бот стоял у угла с кругами шагов
        if(!bot._np || Math.hypot(bot.baseX-bot._np.x, bot.baseY-bot._np.y) > 14){ bot._np = {x:bot.baseX, y:bot.baseY, t:tick}; }
        else if(tick - bot._np.t > 96){
          bot._netStuck = (bot._netStuck||0) + 1;
          var wpN = bot.path[bot.pathIdx];
          if(bot._netStuck >= 3 && wpN){
            // упорно не проходит — шаг прямо к следующей точке пути по навмешу
            var toward = snapToWalkable(bot.baseX + (wpN[0]-bot.baseX)*0.35, bot.baseY + (wpN[1]-bot.baseY)*0.35);
            // (этап 3, P1-4) не через огонь: путь шёл сквозь свой/чужой молотов, обычный шаг его не пускал (stepBlocked), бот
            // 1,5 с стоял у края — и этот рывок переносил его на 30+ px прямо в огонь (матч 3, тик 23335, T1 в молотов T2).
            // Теперь у огня — ждёт у края, как при обычном шаге (зайти можно только по делу — fireCommit)
            if(toward && inFire(toward.x, toward.y, bot.z) && !inFire(bot.baseX, bot.baseY, bot.z) && !fireCommit(bot)) toward = null;
            if(toward && !navFloorNear(toward.x, toward.y, NAV_STEP_TOL)) toward = null;   // (v336) рывок — только на пол навмеша
            // (v341, отметка владельца: TeSeS «застрял и его тпшнуло» — на 380 ед.) snapToWalkable из стены ставит в центр ближайшего
            // участка, иногда далеко; рывок — не дальше 12 ед. (проектное число), иначе нет
            if(toward && Math.hypot(toward.x-bot.baseX, toward.y-bot.baseY) > 12) toward = null;
            if(toward && Math.hypot(toward.x-bot.baseX, toward.y-bot.baseY) > 4){ bot.baseX = toward.x; bot.baseY = toward.y; bot.x = toward.x; bot.y = toward.y; }
            if(bot.pathIdx < bot.path.length-1) bot.pathIdx++;
            bot._netStuck = 0;
          } else { escapeWallLine(bot); bot.path = []; bot.pathIdx = 0; }
          bot._np = {x:bot.baseX, y:bot.baseY, t:tick};
        }
        // facing follows where the bot ACTUALLY went this tick, not where it
        // wanted to go — this is what kills the "spins in place while stuck"
        // look: bot.heading (the steering target above) keeps chasing the
        // blocked destination every tick, but the rendered facing now only
        // turns when the bot is really moving somewhere.
        // (v575, В144) в прыжке на бегу взгляд за ходом не тянется: у про камера за полёт поворачивает меньше хода (медиана 20° против 26°)
        if(actuallyMoved > 0.15 && !bot.lookTarget && !(bot._jc && bot._jc.run)){
          // плавно, а не рывком — иначе после того как бот перестал смотреть
          // на звук/врага, взгляд мгновенно щёлкал бы обратно по ходу движения
          // (v575, В140) поправка — порцией: ход ушёл от взгляда больше чем на 3° — доворот до конца (≤ 0,6°); мелкие сдвиги хода (шаги по навмешу)
          // прицел не тянут. Было: доворот каждый тик — на бегу прицел неподвижен 36 % (у про 52 %)
          var mvA = Math.atan2(bot.baseY-startY, bot.baseX-startX);
          var mvD = ((mvA - bot.facing + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI;
          if(Math.abs(mvD) >= 0.05) bot._aimFix = true; else if(Math.abs(mvD) <= 0.01) bot._aimFix = false;
          if(bot._aimFix){ var mvStep = TURN_RATE * dtSec; bot.facing += Math.max(-mvStep, Math.min(mvStep, mvD)); }
        }
        // (Б1, Х1, сторож 21.10) «не сдвинулся» — меньше 15 % своего шага, без порога 0,3 ед.: при скорости < 19 ед./с (тормозит у
        // точки, шифт с тяжёлым оружием) целый шаг меньше 0,3, и бот, честно идущий медленно, через 40 тиков «застревал» → перенос
        if(actuallyMoved > step*0.15){
          bot.stuckTicks = 0;
          if(actuallyMoved > step*0.6) bot._stuckResets = 0;
        } else {
          bot.stuckTicks = (bot.stuckTicks||0) + 1;
          if(bot.stuckTicks > 40){
            // второй подряд "совсем не двигается" без нормального движения между
            // ними — бот, скорее всего, стоит ровно НА линии стены (тогда любое
            // движение формально её пересекает). Сдвигаем на несколько px в
            // свободную сторону, иначе он так и будет стоять до конца раунда.
            bot._stuckResets = (bot._stuckResets||0) + 1;
            if(bot._stuckResets >= 2) escapeWallLine(bot);
            if(bot._stuckResets >= 2 || !navOnFloor(bot.baseX, bot.baseY, bot)){ bot._stuckResets = 0;
              navSnap(bot);
            } // was 90 (~1.4s) — with local navmesh/wall mismatches near doorways more likely right now (calibration mid-progress), a bot pinned there should give up and re-path faster (~0.6s) instead of visibly grinding against the corner
            // this straight-line path is bad (cuts through wall geometry a
            // hand-drawn zone shouldn't have allowed) — drop it and pick a
            // fresh destination rather than crawl forever
            bot.path = []; bot.pathIdx = 0; bot.stuckTicks = 0;
          }
        }
        // Второй детектор — по ПРОГРЕССУ, а не по скорости: бот может
        // двигаться каждый тик (веер проб толкает его то влево, то вправо), но
        // топтаться на месте бесконечно — детектор выше такое не ловит, потому
        // что формально он "двигается". Если за ~1.5с он не приблизился к
        // следующей точке пути хотя бы на 8px — путь плохой, берём новый.
        if(bot._progPath !== bot.path || bot._progIdx !== bot.pathIdx){
          bot._progPath = bot.path; bot._progIdx = bot.pathIdx;
          bot._progBest = Infinity; bot._progTick = tick;
        }
        // (v373, заплатка; сторож: «застой» — бот с путём и скоростью стоит на месте: на ящике/уступе, которого нет в графе, путь
        // начинается с пола ниже рядом, а шаг туда по прямой не пускает) за 2 с сдвинулся < 4 px — спрыгивает на начало свежего
        // пути, если оно ниже и рядом (≤ 40 px, без стены); раз в 2 с
        var TRl = bot._trail || [];
        if(TRl.length >= 8 && tick - (bot._unstickT||-1e9) > 2*TICK_HZ && tick - (bot._idleT||-1e9) > 2*TICK_HZ && bot.z != null && bot.path.length && bot.pathIdx < bot.path.length &&
           TRl.every(function(q){ return Math.hypot(q.x-TRl[0].x, q.y-TRl[0].y) < 4; })){
          bot._unstickT = tick;
          var pe = bot.path[bot.path.length-1], fr = buildWaypointPath(bot.baseX, bot.baseY, bot.z, pe[0], pe[1], pe[2], bot.team, botLane(bot), bot.walking), p0 = fr && fr[0];
          if(p0 && p0[2] != null && p0[2] <= bot.z + 18 && Math.hypot(p0[0]-bot.baseX, p0[1]-bot.baseY) <= 40 && Math.hypot(p0[0]-bot.baseX, p0[1]-bot.baseY) > 2 && !crossesWall(bot.baseX, bot.baseY, p0[0], p0[1])){
            bot.baseX = bot.x = p0[0]; bot.baseY = bot.y = p0[1]; bot.z = p0[2]; var a0 = navAt(p0[0], p0[1], p0[2]); if(a0) bot._area = a0.id;
            bot.path = fr; bot.pathIdx = 1; bot._trail = [];
            logEvent(bot.id+": не может сойти с уступа по пути — спрыгнул на начало пути (заплатка)"); }
        }
        // (v333) вне навмеша с путём дольше 0,5 с — на ближайший пол (заплатка, navSnap)
        // (v340) «вне пола» — тем же допуском, что и шаг (offNavStep, NAV_STEP_TOL): у края пола (1–3 ед.) бот стоит законно, а
        // перенос его выкидывал (9 раз за 7 с в отметке владельца)
        // (Б1, Х1) «вне пола» — тем же navOnFloor, что пускает шаг: законная щель между связанными участками — пол (шов, вдоль которого
        // идёт путь, — 73 % переносов на Mirage)
        if(bot.path.length && bot.pathIdx < bot.path.length && !navOnFloor(bot.baseX, bot.baseY, bot)){ if(++bot._offNav > 32) navSnap(bot); } else bot._offNav = 0;
        if(bot.path.length && bot.pathIdx < bot.path.length){
          var pw = bot.path[bot.pathIdx];
          var pd = Math.hypot(pw[0]-bot.baseX, pw[1]-bot.baseY);
          if(pd < bot._progBest - 8){ bot._progBest = pd; bot._progTick = tick; }
          else if(tick - bot._progTick > 96){
            navUnlinkBlocked(bot, pw);
            bot.path = []; bot.pathIdx = 0; bot.stuckTicks = 0;
          }
        }
        }
      }
    } else {
      // (Б1, Х1, сторож 21.10) бот не идёт (держит угол, на посту, ждёт, остановился в бою, бросает, лестница) — застревание считается
      // заново, с момента, когда он снова пошёл. Раньше «топчется» (_np), «нет продвижения» (_progTick), «стоит» (stuckTicks) и «на
      // уступе» (след _trail) засчитывали и время стоянки по делу: тронулся после 1,5 с на месте — сразу рывок / отталкивание от стены
      // / перенос со сбросом пути (85–90 % этих заплаток срабатывали без единого отказа шага)
      bot.stuckTicks = 0; bot._np = null; bot._netStuck = 0; bot._progTick = tick; bot._progBest = Infinity; bot._idleT = tick;
    }

    var offX = 0, offY = 0;
    if(bot.roamChecking && bot.state === "patrol" && bot.roamLookPt){
      // на чеке роумер не стоит столбом, а джиглит угол — короткие выглядывания
      var rla = Math.atan2(bot.roamLookPt.y-bot.baseY, bot.roamLookPt.x-bot.baseX) + Math.PI/2;
      var ramp;
      if(BAL.roamSmooth){
        // цикл ~2,1с: выглянуть 0,35с → постоять 0,5с → назад 0,35с → пауза
        var cyc = (tick - bot.roamCheckStart) % 136, e3 = function(u){ u = Math.max(0, Math.min(1, u)); return u*u*(3-2*u); };
        var sgn = (Math.floor((tick - bot.roamCheckStart)/136) % 2) ? -1 : 1;
        ramp = sgn*12*(cyc < 22 ? e3(cyc/22) : cyc < 54 ? 1 : cyc < 76 ? 1-e3((cyc-54)/22) : 0);
      } else ramp = 14*Math.sin((tick - bot.roamCheckStart)*0.3);
      offX = Math.cos(rla)*ramp; offY = Math.sin(rla)*ramp;
      // (v503) смещение в стену — до стены (наибольшая доля без пересечения, 5 делений пополам), а не 0: обнуление при плавном росте
      // смещения давало скачок на 8–10 px дважды за выглядывание (сторож nav, прогон 153: Mirage, роумер CT у лайнапа prx88 —
      // 63 из 183 «переносов», (982, 1566) ↔ (976, 1560))
      if(crossesWall(bot.baseX,bot.baseY,bot.baseX+offX,bot.baseY+offY)){ var wLo = 0, wHi = 1;
        for(var wi = 0; wi < 5; wi++){ var wm = (wLo + wHi)/2; if(crossesWall(bot.baseX,bot.baseY,bot.baseX+offX*wm,bot.baseY+offY*wm)) wHi = wm; else wLo = wm; }
        offX *= wLo; offY *= wLo; }
    }
    // Пик закончился (или бот перешёл из "атакует" в "держит угол"), пока он
    // всё ещё видит врага: раньше смещение пика просто обнулялось, и бот
    // мгновенно "телепортировался" на 30-85px обратно за угол — терял
    // линию обзора, и стрельба с обеих сторон обрывалась. Теперь позиция,
    // где он стоял в момент пика, становится его реальной позицией.
    if(offX === 0 && offY === 0 && (bot._prevOffX || bot._prevOffY) && bot._sawEnemy){
      var cX = bot.baseX + bot._prevOffX, cY = bot.baseY + bot._prevOffY;
      if(!crossesWall(bot.baseX, bot.baseY, cX, cY)){ bot.baseX = cX; bot.baseY = cY; }
    }
    bot._prevOffX = offX; bot._prevOffY = offY;
    // (v403, отметка владельца 22.10, Mirage A Default: CT4 «прошёл сквозь два укрытия») высота пересчитывалась только после шага
    // пути: в бою (стрейф, уход за укрытие — fightCycleTick), у угла и после пика бот сходил с ящика и шёл дальше на высоте ящика
    strafeKeysTick(bot, dtSec);   // (v575, В140) клавиши стрейфа вне перестрелки — качание стоя / на ходу, как у про
    if(!bot._climb) navFollowFloor(bot);
    bot.x = bot.baseX + offX;
    bot.y = bot.baseY + offY;
  });
  if(postRun) return;   // (v564, В89) после конца раунда — только шаги
  resolveEngagements(); ecoKnowSeeTick();   // (Г1) с каким оружием видели врагов — для подсчёта их денег
  smokeSpamTick();
  infoFallbackTick();
  if(BAL.smokeReact) smokeHeTick();
  teamInfoTick(); // раздел 11: коллы из восприятия этого тика → командная память
  posTick();      // где бот стоит (память «не сработало — меняю место»)
  knowTick();     // знание каждого бота о врагах (гипотезы) — из того, что он увидел/услышал/узнал
  teamTick();     // войс: каждый говорит, что узнал; тиммейты узнают, когда фраза договорена
  beliefTick();   // раздел 13: карта вероятностей врага
  checkRoundEnd();
  probTick();     // (v407) счёт ошибок движения — только наблюдает (545)
}

