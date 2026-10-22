// ---------- бросок ----------
// (В3, 21.10.2026) бросок — как у человека: поворот на цель, наклон и сила (ЛКМ / обе / ПКМ), подобранные НАСТОЯЩИМ полётом
// (385_nades_flight: nadeAim — дуга, стены, крыши, отскоки, запал, качение по геометрии игры, m3NadeTrace). Долетит ли и куда
// упадёт — решает только физика: прежние навес по прямой, «дуги под потолками» (nadeArc), «сквозь стену — только как про»
// (nadeTallWall, MAP.nadelanes как разрешение) удалены; trusted теперь значит «лайнап — кинуть лучшим броском, даже если мимо».
// Своя граната кидается, если физика доводит её к цели ближе NADE_AIM_OK ед. игры. (В4) Лайнап с записанными бросками про
// кидается записанным броском (nadeRecPick / nadeRecRelease ниже); лайнап без записи (у про — бросок «на глаз») и свой лайнап
// владельца — лучшим найденным броском (trusted), до В5.
var NADE_AIM_OK = 100;   // ед. игры (≈ 40 px радара; флешке — вдвое: ей важно хлопнуть на виду, а не точно) — проектное число
var NADE_AIM_DZ = {smoke: 0, molly: 0, flash: 80, he: 20};   // куда целиться по высоте над полом у цели, ед. (проектные числа)
// кэш решений — внутри функции: снимок «Отметить момент» копирует глобальные var, а кэш ему не нужен (и большой)
var nadeAimCache = (function(){ var C = {}, n = 0; return function(k, v){ if(v === undefined) return C[k]; if(++n > 4000){ C = {}; n = 0; } return (C[k] = v); }; })();
function nadePhysType(type){ return type === "molly" ? "molotov" : type; }
function nadeTraceFn(){ var M = m3(); return function(A, B){ return m3NadeTrace(M, A, B); }; }
// (В4) для СВОИХ гранат (не лайнапов): лайнап про кидается записанным броском (nadeRecPick / nadeRecRelease ниже), без подбора.
// Прежняя заплатка «с разбега к цели» (граната получала скорость разбега, а бот стоял) удалена: разбег теперь только записанный,
// и бот его делает сам (nadeRecTick)
// лучший бросок из (x, y) радара, стоя на полу z (ед. игры), в точку (tx, ty) радара → решение nadeAim + det в радаре, или null
// vel — (В5) скорость бойца в миг броска, ед. игры [vx, vy, 0] (nadeVel): бросок с хода, как у про; null — стоя
function nadeSolve(type, x, y, z, tx, ty, duck, vel){
  var M = m3(); if(!M) return null;
  var key = type+"|"+Math.round(x/4)+","+Math.round(y/4)+","+Math.round(z/8)+"|"+Math.round(tx/4)+","+Math.round(ty/4)+(duck ? "d" : "")+
    (vel ? "|"+Math.round(vel[0]/40)+","+Math.round(vel[1]/40) : "");
  var c0 = nadeAimCache(key); if(c0 !== undefined) return c0;
  var F = m3Game(M, x, y), T = m3Game(M, tx, ty), tz = visFloorAt(tx, ty) + (NADE_AIM_DZ[type] || 0);
  var r = nadeAim(nadePhysType(type), [F[0], F[1], z], [T[0], T[1], tz], nadeTraceFn(), {duck: !!duck, vel: vel || null});
  if(r){ var R = m3Radar(M, r.det[0], r.det[1]); r.x = R[0]; r.y = R[1]; r.errPx = r.err * M.cell / M.unit; }
  return nadeAimCache(key, r);
}
// Места, откуда про кидали в точку (MAP.nadelanes, tools/nade_lanes_bake.py — все броски из демок карты): с В3 это только
// кандидаты «откуда кинуть» (nadeThrowSpot) и выбор цели у мозга (420), а не разрешение лететь сквозь стену. Радиусы — проектные числа
var NADE_LANE_FROM = 60, NADE_LANE_TO = 80, NADE_LANE_IDX = null;
function nadeLaneIdx(){
  if(NADE_LANE_IDX) return NADE_LANE_IDX;
  var L = (MAP.nadelanes && MAP.nadelanes.lanes) || [], ix = {};
  for(var i = 0; i + 3 < L.length; i += 4){ var k = Math.floor(L[i+2]/100)+","+Math.floor(L[i+3]/100); (ix[k] || (ix[k] = [])).push(i); }
  return (NADE_LANE_IDX = {L:L, ix:ix});
}
// места, откуда про кидали в точку (ex, ey) — концы бросков в NADE_LANE_TO
function nadeLaneFroms(ex, ey){
  var I = nadeLaneIdx(), L = I.L, out = [], gx = Math.floor(ex/100), gy = Math.floor(ey/100);
  for(var dx = -1; dx <= 1; dx++) for(var dy = -1; dy <= 1; dy++) (I.ix[(gx+dx)+","+(gy+dy)] || []).forEach(function(i){
    if(Math.hypot(L[i+2]-ex, L[i+3]-ey) <= NADE_LANE_TO) out.push({x:L[i], y:L[i+1]}); });
  return out;
}
// (v340, отметка владельца: «две гранаты одновременно» — kyousuke кинул HE и через 0,1 с флешку) между двумя гранатами одного
// игрока — не меньше NADE_GAP с: демки про Mirage, 20 539 пар бросков подряд — минимум 1,1 с (0,5-й процентиль), быстрее 1 с — 0 %
var NADE_GAP = Math.round(1.1*64);
function nadeReady(b){ return tick - (b._nadeT == null ? -1e9 : b._nadeT) >= NADE_GAP; }
var NADE_FAIL = null;   // (v369) почему последний бросок не состоялся — для проверки
// (В5, 22.10) скорость бойца для броска с хода: про стоя кидают только 10–46 % гранат (throws.json: молотовы на бегу ≥ 52 %, HE
// 31–49 %, флешки 22–30 %), бот раньше всегда кидал «стоя». Направление — к следующей точке пути; px/с радара → ед. игры/с
function nadeVel(b){
  var M = m3(), sp = b.curSpeed || 0; if(!M || sp < 5 || !b.path || !b.path.length) return null;
  var q = b.path[Math.min(b.pathIdx||0, b.path.length-1)], dx = q[0]-b.x, dy = q[1]-b.y, d = Math.hypot(dx, dy); if(d < 1) return null;
  var k = M.unit / M.cell * sp / d;
  return [dx*k, -dy*k, 0];   // ось y игры — против радара
}
// rec — (В4) записанный бросок про (nadeRecPick): кинуть ровно его (nadeRecRelease); иначе — свой бросок, подобранный физикой
function throwNade(b, type, tx, ty, lob, why, trusted, rec){
  NADE_FAIL = null;
  if(!b.nades || b.nades[type] <= 0){ NADE_FAIL = "нет гранаты"; return false; }
  if(!nadeReady(b)){ NADE_FAIL = "пауза между гранатами"; return false; }
  if(!m3()){ NADE_FAIL = "нет геометрии карты"; return false; }
  if(rec) return nadeRecRelease(b, type, tx, ty, why, rec);
  // (В3) как кинуть и куда упадёт — физикой из того места, где стоит; долетит ли — по самой цели
  var bz = b.z != null ? b.z : visFloorAt(b.x, b.y), V = nadeVel(b), S = nadeSolve(type, b.x, b.y, bz, tx, ty, b.crouching, V);
  if(!S){ NADE_FAIL = "цель под ногами"; return false; }
  // свой бросок — ближе NADE_AIM_OK (флешке — вдвое); лайнап — кидается и мимо, но не так, что граната падает у ног
  // (ближе к цели чем на NADE_AIM_OK × 4 — иначе отсюда туда не кинуть вовсе)
  if(S.err > NADE_AIM_OK * (trusted ? 4 : type === "flash" ? 2 : 1)){ NADE_FAIL = "не долетит: стена / потолок"; return false; }
  // (аудит 11.10) HE / молотов не летит туда, где стоит свой (в радиусе поражения) — ни у цели, ни там, где граната
  // разорвётся на самом деле (точка физики); бросок отменяется, граната остаётся. И сам бросающий — тоже «свой»
  if((type === "he" || type === "molly") && bots.some(function(o){ return o.alive && o.team === b.team &&
      (Math.hypot(o.x-tx, o.y-ty) < NADE[type].radius || Math.hypot(o.x-S.x, o.y-S.y) < NADE[type].radius); })){ NADE_FAIL = "свой в зоне"; return false; }
  var M = m3(), F = m3Game(M, b.x, b.y);
  var L = nadeLaunch({pos: [F[0], F[1], bz], yaw: S.yaw, pitch: S.pitch, strength: S.strength, duck: !!b.crouching, jump: S.jump, vel: V}, nadeTraceFn());
  if(!trusted) nadeLearn(type, b.x, b.y, tx, ty);   // (В5) свой бросок долетел — запомнить место для этой цели
  return nadeRelease(b, type, L, S.x, S.y, tx, ty, lob, why, null);
}
// (В4) граната вылетела: L — {p, v} физики (ед. игры), (px, py) — где разорвётся по расчёту (радар), (tx, ty) — куда целились;
// pin — только у смоков-лайнапов (заплатка smokePinStep, 400). Общая часть своей гранаты и записанного броска
function nadeRelease(b, type, L, px, py, tx, ty, lob, why, pin){
  b.nades[type]--; b._nadeT = tick; b._lastNade = {type:type, x:tx, y:ty, t:tick};
  var a = Math.atan2(ty-b.y, tx-b.x);
  // в полёте: состояние физики (ед. игры) + где на радаре; tx, ty — где разорвётся по расчёту (другие решения смотрят туда)
  var nd = {type:type, x:b.x, y:b.y, z:L.p[2], st: nadeState(nadePhysType(type), L.p, L.v), tx:px, ty:py, born:tick, thrower:b,
            team:b.team, trail:[], why:why||"", ox:b.x, oy:b.y, lob:!!lob, aimX:tx, aimY:ty};
  if(pin) nd.pin = pin;
  // кто может увернуться от этой флешки: видел бросающего или был рядом (слышит чеку)
  if(type === "flash" && BAL.flashAware){
    nd.aware = {};
    // (этап 3, P2-2) и свои: кто рядом или видел бросок, знает о нём так же, как враг; остальным — колл «флешу!» в войсе
    bots.forEach(function(o){ if(o.alive && o !== b && (Math.hypot(o.x-b.x, o.y-b.y) < 450 || hasVision(o.x, o.y, b.x, b.y))) nd.aware[o.id] = true; });
  }
  nadesInAir.push(nd); if(SND && SND.on) sndNade("throw", b.x, b.y);
  if(type === "flash" && b.voice) teamPropose(b, {kind: "flash", nade: nd});
  b.throwUntil = tick + 18; // ~0.3с стоит на броске
  b.facing = a;
  logEvent(b.id+" кинул "+NADE[type].name+(why ? " — "+why : "")+(lob ? " (лайнап)" : ""));
  // раздел 11.1: бросок гранаты — тоже источник инфы о враге, не только выстрел/
  // шаги. Кто видел бросок — фиксирует позицию бросавшего как обычный "вижу"
  // (на миг открылся); кто не видел, но был достаточно близко — слышит
  // ЧЕКУ/бросок и понимает направление и примерную дистанцию, откуда кинули,
  // даже без визуального контакта.
  if(typeof teamIntel !== "undefined"){
    var enemyTeam = b.team === "CT" ? "T" : "CT";
    bots.forEach(function(o){
      if(!o.alive || o.team !== enemyTeam) return;
      var dd = Math.hypot(o.x-b.x, o.y-b.y);
      // (v242) видит бросок — только если смотрит туда (поле зрения); услышал — знает сам, команде скажет войс
      // (Б3, З9) «видит» — как радар: visParts (стены, укрытия, пол, стойка — 3D-геометрия игры) и дым; раньше hasVision
      // (стены радара + пол, без укрытий и стойки) — 8–19 % «видел бросок» без линии
      var vpN = visParts(o.x, o.y, o.crouching, b.x, b.y, b.crouching, true, o.z, b.z);
      if((vpN.head || vpN.body) && !smokeBlocks(o.x, o.y, b.x, b.y) && inFov(o, b.x, b.y) && tick >= (o.blindUntil||0)){
        intelPush(enemyTeam, {type:"spotted", x:b.x, y:b.y, id:b.id, by:o.id, conf:1});
        o.lastIntel = {x:b.x, y:b.y, tick:tick};
      } else if(dd <= NADE_HEAR_R){
        o.heardSound = hearReal(o, {x:b.x, y:b.y, tick:tick, team:b.team, src:b.id, kind:"nade"});
      }
    });
  }
  return true;
}
// ---------- (В4, 21.10.2026) лайнап = записанный бросок про ----------
// Лайнап набора карты (lineups.json → throws, tools/nades/lineups_rec.py + lineups_fit.js) несёт варианты — один и тот же бросок про,
// записанный ≥ 3 раз: место ног, поворот, наклон, скорость игрока (разбег / прыжок), присед; сила и прыжок на бинде подобраны
// физикой по разрыву у про. Бот берёт вариант ближе к себе (про кидают тот, что под рукой) и один из записанных бросков — разброс
// точки разрыва как у про (у разных про один лайнап ложится по-разному: смоки / молотовы мало, флешки больше). Доходит до места,
// делает записанный разбег и кидает ровно этот бросок той же физикой (385). Выдуманный промах (lobErr / execErr) удалён.
var NADE_RUN_T = 0.4;   // с: разбег до броска — сколько бежит к месту броска (в демке видна только скорость в миг броска) — проектное число
function nadeRecPick(L, b, seed){
  var V = L.throws; if(!V || !V.length || !m3()) return null;
  var v = V.slice().sort(function(a, c){ return Math.hypot(a.from.x-b.x, a.from.y-b.y) - Math.hypot(c.from.x-b.x, c.from.y-b.y); })[0];
  var r = v.rec[Math.floor(hashRand(seed) * v.rec.length) % v.rec.length];
  var M = m3(), k = M.cell / M.unit, P0 = m3Radar(M, r.p[0], r.p[1]), D = m3Radar(M, r.det[0], r.det[1]);
  var rel = {x: P0[0], y: P0[1]}, start = {x: rel.x, y: rel.y}, hs = Math.hypot(r.vel[0], r.vel[1]);
  if(hs >= 10){   // с хода: отойти назад по направлению разбега (ось y радара — вниз), стена на пути — разбег короче
    var ux = r.vel[0]/hs, uy = -r.vel[1]/hs;
    for(var d = hs*NADE_RUN_T*k; d >= 4; d *= 0.5){ var sx = rel.x - ux*d, sy = rel.y - uy*d;
      if(!crossesWall(sx, sy, rel.x, rel.y) && navAt(sx, sy)){ start = {x: sx, y: sy}; break; } }
  }
  return {rec: r, s: v.s, j: v.j, duck: !!v.duck, rel: rel, start: start, run: Math.hypot(start.x-rel.x, start.y-rel.y) > 1, det: {x: D[0], y: D[1]}};
}
// бросок записи (ед. игры) так, как в демке: игрок за задержку вылета сдвигается со своей скоростью (как nadeThrow модуля 385)
function nadeRecLaunch(R){
  var r = R.rec, tau = NADE_P.SPAWN / NADE_P.TICK, air = Math.abs(r.vel[2]) > NADE_P.AIR_VZ;
  var pos = [r.p[0] + r.vel[0]*tau, r.p[1] + r.vel[1]*tau, r.p[2] + (air ? r.vel[2]*tau : 0)];
  return nadeLaunch({pos: pos, yaw: r.yaw, pitch: r.pitch, strength: R.s, duck: R.duck, jump: R.j, vel: r.vel}, nadeTraceFn());
}
var SMOKE_PIN_LEAD = 0.3;   // с: последние доли секунды полёта смока-лайнапа — «доводка» в точку про (заплатка, 400) — проектное число
function nadeRecRelease(b, type, tx, ty, why, R){
  var L = nadeRecLaunch(R), M = m3();
  var f = nadeFly(nadePhysType(type), L.p, L.v, nadeTraceFn()), Pd = m3Radar(M, f.det[0], f.det[1]);
  var px = Pd[0], py = Pd[1], pin = null;
  if(type === "smoke"){   // ЗАПЛАТКА (В4, решение владельца 21.10): смок-лайнап рвётся там и тогда, где у про (smokePinStep, 400)
    pin = {p: R.rec.det.slice(), t: Math.max(SMOKE_PIN_LEAD, R.rec.dt - NADE_P.SPAWN/NADE_P.TICK)}; px = R.det.x; py = R.det.y; }
  if((type === "he" || type === "molly") && bots.some(function(o){ return o.alive && o.team === b.team &&
      (Math.hypot(o.x-tx, o.y-ty) < NADE[type].radius || Math.hypot(o.x-px, o.y-py) < NADE[type].radius); })){ NADE_FAIL = "свой в зоне"; return false; }
  b.facing = -R.rec.yaw * Math.PI/180;   // поворот записи (ось y радара — вниз)
  return nadeRelease(b, type, L, px, py, tx, ty, true, why + " — бросок " + R.rec.who + ", р" + R.rec.r, pin);
}
// бот на месте лайнапа: шаг точно на точку разбега, записанный разбег до места броска, бросок. true — задание закончено
var NADE_STEP_IN = 2;   // px — точнее этого стоит в месте броска
function nadeRecTick(b, t){
  var R = t.rec, step = SPEED * WALK_SPEED_FRAC / TICK_HZ;
  var put = function(x, y){ b.baseX = b.x = x; b.baseY = b.y = y; };
  if(!t._run){
    var d = Math.hypot(R.start.x-b.baseX, R.start.y-b.baseY);
    if(d > NADE_STEP_IN && !crossesWall(b.baseX, b.baseY, R.start.x, R.start.y)){
      var q = Math.min(1, step/d); b.facing = Math.atan2(R.start.y-b.baseY, R.start.x-b.baseX);
      put(b.baseX + (R.start.x-b.baseX)*q, b.baseY + (R.start.y-b.baseY)*q); return false; }
    if(!nadeReady(b)) return false;
    if(R.run){ t._run = tick; return false; }
  } else {
    var k = Math.min(1, (tick - t._run) / (NADE_RUN_T * TICK_HZ));
    b.facing = Math.atan2(R.rel.y-R.start.y, R.rel.x-R.start.x);
    put(R.start.x + (R.rel.x-R.start.x)*k, R.start.y + (R.rel.y-R.start.y)*k);
    if(k < 1) return false;
  }
  if(!throwNade(b, t.type, t.x, t.y, true, t.why, true, t.rec) && NADE_FAIL && /пауза|свой/.test(NADE_FAIL)){ t._run = 0; return false; }
  return true;
}
function smokeCovered(x, y){
  // план §7: "два бота не кидают смок в одну точку, пока один ещё не рассеялся"
  if(smokes.some(function(s){ return Math.hypot(s.x-x, s.y-y) < 60 && s.until - tick > 64; })) return true;
  return nadesInAir.some(function(n){ return n.type === "smoke" && Math.hypot((n.tx||n.x)-x, (n.ty||n.y)-y) < 60; });
}
function assignNade(b, type, target, why, opts){
  if(!b || !b.alive || !b.nades || b.nades[type] <= 0) return false;
  if(opts && opts.bkey && !builtinAllowed(opts.bkey)) return false; // встроенная выключена или заменена своим лайнапом
  if(!(opts && opts.plan) && planReserved(b, type)) return false;   // (Г1) последняя такая граната команды — под план тактики
  if(b.nadeTask && (b.nadeTask.type === type || b.nadeTask.lineup)) return false; // свой лайнап не перебиваем
  if(type === "smoke" && smokeCovered(target.x, target.y)) return false;
  // одна граната одного типа в одну точку: другие механики (комбо, флешка
  // себе, дамп…) не дублируют уже летящую/назначенную туда же
  if(BAL.nadeDedup && type !== "smoke" && (nadesInAir.some(function(n){ return n.team === b.team && n.type === type && Math.hypot((n.tx||n.x)-target.x, (n.ty||n.y)-target.y) < 120; }) ||
     bots.some(function(o){ return o !== b && o.alive && o.team === b.team && o.nadeTask && o.nadeTask.type === type && Math.hypot(o.nadeTask.x-target.x, o.nadeTask.y-target.y) < 120; }))) return false;
  var rng = (opts && opts.range) || NADE_THROW_RANGE, task = {type:type, x:target.x, y:target.y, until: tick + 10*64, why:why||"", start:tick, lob:true, range:rng, now:!!(opts && opts.now)};
  // (В5; идея v383 «граната только тому, у кого долетит», на физике В3) цель в пределах броска — сразу физикой: долетает отсюда — задание;
  // нет — точка рядом, откуда долетает (nadeThrowSpot: выученные, места про, точки вокруг), и арбитр места пускает туда (как к лайнапу);
  // нет и такой — отказ сразу: механика берёт другого / не кидает (раньше задание выдавалось и пропадало «не долетит» — 3 200–3 300
  // заданий на 16 матчей в базе v395, две трети всех потерь). Цель дальше — как было: подходит и проверяется при броске
  if(Math.hypot(target.x-b.x, target.y-b.y) <= rng){
    if(!nadeLands(b, type, b.x, b.y, target.x, target.y)){
      var fs = taskCanSet(b, "lineup") ? nadeThrowSpot(b, task) : null;
      if(!fs){ NADE_FAIL = "отсюда не долетит, точки рядом нет"; return false; }
      task.from = fs; task.gen = !fs.lane; task._spotTried = true;
      task.until = Math.max(task.until, tick + Math.ceil(pathLenTo(b, fs.x, fs.y)/SPEED + 2)*TICK_HZ);
    }
  }
  b.nadeTask = task;
  return true;
}
// (В5) долетит ли граната бойца b из (x, y) в цель — тот же порог, что у своего броска (throwNade): ближе NADE_AIM_OK, флешке — вдвое
function nadeLands(b, type, x, y, tx, ty){
  var S = nadeSolve(type, x, y, (x === b.x && y === b.y && b.z != null) ? b.z : visFloorAt(x, y), tx, ty, false);
  return !!S && S.err <= NADE_AIM_OK * (type === "flash" ? 2 : 1);
}
// (В5) удачный свой бросок запоминается для места: откуда долетело в эту цель (клетка 60 px) — до конца матча, проверяется первым
// (nadeThrowSpot). Размер клетки — проектное число
var NADE_LEARN = {}, NADE_LEARN_CELL = 60;
function nadeLearnKey(type, x, y){ return type+"|"+Math.round(x/NADE_LEARN_CELL)+","+Math.round(y/NADE_LEARN_CELL); }
function nadeLearned(type, x, y){ return (NADE_LEARN[nadeLearnKey(type, x, y)] || []).slice(); }
function nadeLearn(type, fx, fy, tx, ty){
  var k = nadeLearnKey(type, tx, ty), L = NADE_LEARN[k] || (NADE_LEARN[k] = []);
  if(!L.some(function(q){ return Math.hypot(q.x-fx, q.y-fy) < 30; })){ L.push({x:Math.round(fx), y:Math.round(fy)}); if(L.length > 6) L.shift(); }
}
// задание на гранату выполняется, как только точка видна и в пределах броска
function nadeQueueNext(b){
  // (v355) следующая граната из очереди того же бойца: с той же точки броска, срок 6 с (проектное число)
  if(!b.alive || !b.nadeQueue || !b.nadeQueue.length || b.nadeTask) return;
  var q = b.nadeQueue.shift();
  if(!b.nades || b.nades[q.type] <= 0 || roundState !== "live") return nadeQueueNext(b);
  var qSec = Math.max(6, Math.ceil(pathLenTo(b, q.from.x, q.from.y)/SPEED + LU_REACH_PAD));   // (v359) точка следующей — бывает дальше
  b.nadeTask = {type:q.type, x:q.x, y:q.y, from:q.from, rec:q.rec || null, until: tick + qSec*TICK_HZ, why:q.why, start:tick, lob:true, range:4000, now:true, lineup:true, exec:q.exec && q.type === "smoke"};
}
function updateNadeTasks(){
  bots.forEach(function(b){
    if(!b.nadeTask && b.nadeQueue && b.nadeQueue.length) nadeQueueNext(b);
    var t = b.nadeTask; if(!t) return;
    if(!b.alive || tick > t.until || !b.nades || b.nades[t.type] <= 0){
      b.nadeTask = null;
      // задание сгорело, а пост "лайнап" остался — снять, иначе стоит на точке броска весь раунд
      if(b.post && b.post.tag === "lineup") clearPost(b);
      return; }
    if(b.planting || b.defusing) return;
    // (v359, р7) T уже на сайте выхода, а точка броска позади — задание снимается: с взятого сайта назад за гранатой не уходят
    if(t.lineup && t.from && b.team === "T" && teamTac.T && SITES[teamTac.T.site] && bomb.state !== "planted"){
      var Sx = SITES[teamTac.T.site], dB = Math.hypot(b.x-Sx.x, b.y-Sx.y);
      if((onSite(Sx, b.x, b.y) || dB < 450) && Math.hypot(t.from.x-Sx.x, t.from.y-Sx.y) > dB + 200){ b.nadeTask = null; b.nadeQueue = null; if(b.post && b.post.tag === "lineup") clearPost(b); return; }
    }
    var d = Math.hypot(t.x-b.x, t.y-b.y);
    if(t.type === "smoke" && smokeCovered(t.x, t.y)){ b.nadeTask = null; return; }
    if(t.from){ // свой лайнап: сначала встать ровно в точку броска
      // раньше кидал только ближе 22px к точке, а "дошёл до поста" считается
      // уже с 34px — бот вставал в 23–34px и стоял до конца задания, не кидая
      // (v369, владелец: «пишется "идёт кидать гранату", но как будто не успевают кинуть») бот, стоявший на угле (state hold), к
      // точке броска не шёл вовсе — пост ставился только в patrol, и задание сгорало в 40–60 ед. от точки. Теперь угол он
      // оставляет (кроме боя: engage / retreat — сначала бой)
      if(t.rec && t._run){ if(nadeRecTick(b, t)){ b.nadeTask = null; if(b.post && b.post.tag === "lineup") clearPost(b); } return; }   // (В4) идёт разбег
      if(Math.hypot(t.from.x-b.baseX, t.from.y-b.baseY) > 36 && !(b.atPost && b.post && b.post.tag === "lineup")){
        if(b.state === "hold" && !b._sawEnemy) leaveHold(b);
        // (v378) задача важнее броска (арбитр места) — бросок отменён, как живой игрок бросает лайнап ради боя / бомбы / колла.
        // (v399, Г1, вариант А владельца 22.10; сторож v396д: 40 % потерь гранат плана — «снята: перестановка») задача ниже
        // TASK_ROUTE_CANCEL (перестановка, команда, эндгейм) — пауза броска, как пауза маршрута: срок стоит, бросок ждёт, пока та
        // кончится, но не дольше EXEC_WAIT_SEC (то же проектное число — сколько граната выхода ждёт бросающего); бой, ротация,
        // сейв, бомба — отмена, как было
        if(b.state === "patrol" && !setPost(b, t.from, {x:t.x, y:t.y}, true, "lineup")){
          if(taskAlive(b) && b._task.lv < TASK_ROUTE_CANCEL && (t._pause = (t._pause || 0) + 1) <= EXEC_WAIT_SEC*TICK_HZ) t.until++;
          else { b.nadeTask = null; b.nadeQueue = null; }
        }
        return; }
      postKeep(b);   // стоит на точке броска — затея ещё идёт
      if(t.rec){ if(nadeRecTick(b, t)){ b.nadeTask = null; if(b.post && b.post.tag === "lineup") clearPost(b); } return; }   // (В4) записанный бросок про
      if(!nadeReady(b)) return;   // (v340) только что кинул другую — задание ждёт
      // не вышло на время (пауза между гранатами, свой в зоне огня) — задание остаётся, попробует снова; раньше снималось молча
      if(!throwNade(b, t.type, t.x, t.y, true, t.why, !t.gen) && NADE_FAIL && /пауза|свой/.test(NADE_FAIL)) return;   // своя точка (gen) — дуга проверяется
      b.nadeTask = null; if(b.post && b.post.tag === "lineup") clearPost(b); return;
    }
    if(d <= t.range && hasLOS(b.x, b.y, t.x, t.y, b.z)){
      if(!nadeReady(b)) return;   // (v340) только что кинул другую — задание ждёт
      throwNade(b, t.type, t.x, t.y, false, t.why); b.nadeTask = null;
    } else if(t.lob && d <= t.range*0.85 && (t.now || tick - t.start > 64)){
      // навесом — точки не видно. (В3) долетит ли — решает физика (сквозь стены граната не летит, над ними — да);
      // не долетает — идёт на точку рядом, откуда долетает (nadeThrowSpot: безопасную от известных врагов); нет и такой — не кидает
      if(throwNade(b, t.type, t.x, t.y, true, t.why) || !/стена|потолок/.test(NADE_FAIL||"") || t._spotTried){ b.nadeTask = null; return; }   // (В3) не долетает отсюда — на точку, откуда долетит
      t._spotTried = true;
      var fs = nadeThrowSpot(b, t);
      if(!fs){ b.nadeTask = null; return; }
      t.from = fs; t.gen = !fs.lane; t.until = Math.max(t.until, tick + Math.ceil(pathLenTo(b, fs.x, fs.y)/SPEED + 2)*TICK_HZ);
    }
  });
}

// (v370) откуда докинуть свою гранату: точка в NADE_SPOT_R от бойца, откуда так кидают про (или без стены на пути), цель в
// пределах броска; не на виду у врагов, которых команда знает (≤ 8 с), и ближе по пути. Владелец: «главное, чтобы не дохли, пока
// шли до точки». Радиус — проектное число
var NADE_SPOT_R = 450;
function nadeThrowSpot(b, t){
  var bl = (typeof beliefLast !== "undefined" && beliefLast[b.team]) || {}, foes = [];
  for(var e in bl){ var q = bl[e]; if(q && tick - q.tick <= 8*TICK_HZ && bots.some(function(o){ return o.id === e && o.alive; })) foes.push({x:q.x, y:q.y}); }
  // кандидаты — места, откуда про кидали в эту точку (MAP.nadelanes), и точки рядом; (В3) с любого — граната должна долететь
  // по физике (nadeSolve ближе NADE_AIM_OK); с места про — тоже (лайнап кидается и при большей ошибке, но место выбирается то, откуда долетает)
  var reach = function(q){ return nadeLands(b, t.type, q.x, q.y, t.x, t.y); };
  var c = nadeLearned(t.type, t.x, t.y).concat(nadeLaneFroms(t.x, t.y)).filter(function(q){ return Math.hypot(q.x-b.x, q.y-b.y) <= NADE_SPOT_R && navAt(q.x, q.y); }).map(function(q){ return {x:q.x, y:q.y, lane:true}; })
    .concat(pickSpots("nthr"+b.id+"_"+Math.round(t.x)+","+Math.round(t.y), {x:b.x, y:b.y}, 8, {rMax:NADE_SPOT_R, minGap:40, hideFrom:foes})
      .filter(function(q){ return Math.hypot(q.x-t.x, q.y-t.y) <= t.range*0.85; }))
    .filter(function(q){ return !foes.some(function(f){ return hasLOS(q.x, q.y, f.x, f.y); }); });
  if(c.length > 12) c = c.sort(function(a, d){ return Math.hypot(a.x-b.x, a.y-b.y) - Math.hypot(d.x-b.x, d.y-b.y); }).slice(0, 12);
  c = c.filter(reach);
  var best = null, bL = Infinity;
  c.forEach(function(q){ var L = pathLenTo(b, q.x, q.y); if(L < bL){ bL = L; best = q; } });
  return best && bL <= NADE_SPOT_R*1.5 ? best : null;
}
