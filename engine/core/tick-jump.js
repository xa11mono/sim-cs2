// [хозяева: landSound] (v335) звук приземления — одно место: слышат враги (как шаги, громко), на странице — запись приземления там, где он сейчас.
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
  soundEv("sndBody", "land", bot.baseX, bot.baseY);
}
// (v334, М58, владелец: «в CS2 есть места, где прыгают для чека, — у B Apps, где стоит karrigan») чек прыжком. Места и как часто —
// из демок (tools/map/jumps_bake.py → MAP.pro.jumps: прыжок на месте, rate — прыжков за раунд; Mirage у B Apps — 0,49, у Ticket —
// 0,09). Стоит у такого места своей стороны (≤ 50 ед. карты), без контакта ≥ 2 с — прыгает с вероятностью rate / JUMP_HOLD_SEC
// в секунду (JUMP_HOLD_SEC — сколько про обычно стоят у места, проектное). В прыжке видно поверх укрытий (глаза на JUMP_APEX выше;
// закрывают стены, укрытия выше этого и дым) в конусе ±60° — и его оттуда тоже. Приземление с приседом тише (csdb.gg: «присесть перед приземлением —
// тише»): радиус × 0,5 — проектное число
var JUMP_HOLD_SEC = 30;
// (Б3, З9) верх прыжка: глаза / тело выше пола на 57 ед. — CS2: sv_jump_impulse 301,993 ед./с, sv_gravity 800 → v²/2g ≈ 57.
// «Вижу» с прыжка — как радар: visParts с поднятыми глазами (раньше только высокие стены visWallHit — 98–99 % «видели» без линии)
var JUMP_APEX = 57;
// (v575, В144, владелец 14.11: «почему подсадки нет? мало, но должно быть») подсадки про — MAP.pro.boosts (tools/map/boosts_bake.py: место, сторона,
// подсадок за раунд, сколько стоит наверху, насколько выше, когда от начала раунда). Решение — один раз за раунд, когда у места (≤ R px) двое своих
// (≤ pair px друг от друга), не в бою, во время, когда это делают про (± tPad с): с вероятностью rate·k — k подобран так, чтобы подсадок за раунд
// было как у про (замер — tools/measure/motion/boost.js.txt). Наверху глаза выше на lift (видит и виден поверх укрытий — visParts)
var BOOST = {R: 40, pair: 120, tPad: 5, k: 1};   // R — как сетка мест в boosts_bake (40 px); pair, tPad — проектные
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
// [4,25, 3,79, 2,8, 17,4, 24,3]: 36 / 18 / 24 / 13 / 8 %, 5,0 в мин. Матрица «поворот впереди → поворот за полёт» (runjump.sh): разворот
// за полёт > 90° у ботов выходит только в 25 % прыжков перед крутым поворотом пути (пути сглажены) — 18 % таких, как у про, не набрать без
// 5+ прыжков в мин. Частоты — решение по матрице замера (направление хода по сдвигу за 4 тика): ожидаемо по исходу 1,55 / 0,71 / 0,76 / 0,49 /
// 0,73 прыжка в мин против 1,62 / 0,58 / 0,66 / 0,54 / 0,75 у про (4,24 против 4,15). Прыжков перед поворотом 15–60° почти нет: такой поворот
// хода за полёт у ботов и так выходит из прямых участков (дрожание шага по навмешу).
// keep — скорость через 4 тика после приземления / до отрыва (квантили 10/25/50/75/90, про); в полёте ход гаснет до keep − KEEP_ACC (за 4 тика
// после приземления разгон добавляет ~0,3 — подобрано: при 0,2 медиана вышла 0,86 против 0,76)
var RUN_JUMP = {turn: [15, 30, 60, 90, 180], rate: [4.4, 0.2, 0.2, 5.74, 70.8], air: 0.77, keep: [0.22, 0.53, 0.76, 0.84, 0.98], keepAcc: 0.3, adNone: 0.05,
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
  for(var i = b.pathIdx; i < b.path.length; i++){ var w = b.path[i], d = DM.hypot(w[0]-x, w[1]-y); if(d < 1e-6) continue;
    var a = DM.atan2(w[1]-y, w[0]-x); if(a0 === null) a0 = a; a1 = a; if(d >= dist) break; dist -= d; x = w[0]; y = w[1]; }
  return a0 === null ? 0 : DM.atan2(DM.sin(a1 - a0), DM.cos(a1 - a0))*180/Math.PI;   // со знаком
}
// (v583a, Д3 / Д8, владелец 17.11: «бежит и смотрит то влево, то вправо», «когда цели нет — смотрит по ходу, а ход виляет») куда смотреть
// «по ходу»: направление пути впереди, от проекции бота на текущий отрезок пути — у живого игрока мышь не связана с клавишами: качание A / D
// (strafeKeysTick) и снос мимо точки пути прицел не тянут. MOVE_LOOK_AHEAD — проектное число (≈ 120 ед. — полсекунды шагом)
var MOVE_LOOK_AHEAD = 48;
function pathAheadDir(b, D){
  var P = b.path, i = b.pathIdx; if(!P || i == null || i >= P.length) return null;
  var x = b.baseX, y = b.baseY;
  if(i > 0){ var p0 = P[i-1], p1 = P[i], dx = p1[0]-p0[0], dy = p1[1]-p0[1], l2 = dx*dx + dy*dy;
    if(l2 > 1e-6){ var t = Math.max(0, Math.min(1, ((x-p0[0])*dx + (y-p0[1])*dy)/l2)); x = p0[0] + dx*t; y = p0[1] + dy*t; } }
  var qx = x, qy = y;
  for(var k = i; k < P.length; k++){ var w = P[k], d = DM.hypot(w[0]-x, w[1]-y); if(d < 1e-6) continue;
    if(d >= D){ x += (w[0]-x)*D/d; y += (w[1]-y)*D/d; break; } D -= d; x = w[0]; y = w[1]; }
  return DM.hypot(x-qx, y-qy) < 1 ? null : DM.atan2(y-qy, x-qx);
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
      if(q.side !== b.team || rtB < q.t[0] - BOOST.tPad || rtB > q.t[4] + BOOST.tPad || DM.hypot(q.x - b.x, q.y - b.y) > BOOST.R) continue;
      var bt = b._boostTry || (b._boostTry = {}); if(bt[bi] === roundNum + "|" + matchNum) continue;
      var mate = bots.filter(function(o){ return o !== b && o.alive && o.team === b.team && !o._boost && !o._fc && !o._sawEnemy && !o._jc && !o._climb && !o.onLadder &&
        DM.hypot(o.x - b.x, o.y - b.y) <= BOOST.pair; })[0];
      if(!mate) continue;
      bt[bi] = roundNum + "|" + matchNum;   // одно решение на место за раунд — когда пара впервые у места
      // вероятность: подсадок у про за раунд / сколько раз за раунд у ботов складывается такой момент (botE — замер boost.sh, вписан в данные
      // tools/measure/motion/boost_calib.py); без замера — rate·k
      if(hashRand(tick*331 + b.id.charCodeAt(b.id.length-1)*17 + bi*7) >= Math.min(1, q.botE ? q.rate/q.botE : q.rate*BOOST.k)) continue;
      var dn = DM.hypot(q.x - b.x, q.y - b.y) <= DM.hypot(q.x - mate.x, q.y - mate.y) ? b : mate, up = dn === b ? mate : b;
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
      bots.forEach(function(o){ if(!o.alive || o.team === b.team) return; var d = DM.hypot(o.x-b.x, o.y-b.y); if(d > 1100) return;
        if(smokeBlocks(b.x, b.y, o.x, o.y)) return;
        var bS = visParts(b.x, b.y, false, o.x, o.y, o.crouching, true, b.z, o.z, JUMP_APEX, 0), oS = visParts(o.x, o.y, o.crouching, b.x, b.y, false, true, o.z, b.z, 0, JUMP_APEX);
        if((bS.head || bS.body) && tick >= (b.blindUntil||0) && _angOff(DM.atan2(o.y-b.y, o.x-b.x), b.facing) < 1.05){ intelPush(b.team, {type:"spotted", x:o.x, y:o.y, id:o.id, by:b.id, conf:1});
          voiceLog(b.team, "jc"+o.id+Math.floor(tick/(4*TICK_HZ)), b.id, "чек прыжком: вижу "+nick(o.id)+" — "+calloutName(o.x, o.y)); }
        if((oS.head || oS.body) && tick >= (o.blindUntil||0) && o.facing !== undefined && _angOff(DM.atan2(b.y-o.y, b.x-o.x), o.facing) < 1.05) intelPush(o.team, {type:"spotted", x:b.x, y:b.y, id:b.id, by:o.id, conf:1}); });
    }
    if(J.run && age >= Math.round(RUN_JUMP.air*TICK_HZ)){   // (v575, В144) приземление с бега — громко, ход теряет долю (у про ×0,65)
      landSound(b, false); b._jc = null; landLook(b); return;
    }
    if(!J.run && age === 38){   // приземление, с приседом
      landSound(b, true); b._jc = null; landLook(b);
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
  var sp = null; for(var i=0;i<JS.length;i++){ var q = JS[i]; if(q.side === b.team && DM.hypot(q.x-b.x, q.y-b.y) < 50){ sp = q; break; } }
  if(!sp) return;
  if(hashRand(tick*977 + b.id.charCodeAt(b.id.length-1)*31 + roundNum*7) < sp.rate/(JUMP_HOLD_SEC*TICK_HZ)){ b._jc = {t:tick}; b._jump = {t:tick, up:true}; }
}
