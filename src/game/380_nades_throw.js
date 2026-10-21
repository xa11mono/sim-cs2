// ---------- бросок ----------
// (В3, 21.10.2026) бросок — как у человека: поворот на цель, наклон и сила (ЛКМ / обе / ПКМ), подобранные НАСТОЯЩИМ полётом
// (385_nades_flight: nadeAim — дуга, стены, крыши, отскоки, запал, качение по геометрии игры, m3NadeTrace). Долетит ли и куда
// упадёт — решает только физика: прежние навес по прямой, «дуги под потолками» (nadeArc), «сквозь стену — только как про»
// (nadeTallWall, MAP.nadelanes как разрешение) удалены; trusted теперь значит «лайнап — кинуть лучшим броском, даже если мимо».
// Своя граната кидается, если физика доводит её к цели ближе NADE_AIM_OK ед. игры; лайнап (точка и цель из демок про / свой
// лайнап) кидается всегда — лучшим найденным броском.
var NADE_AIM_OK = 100;   // ед. игры (≈ 40 px радара; флешке — вдвое: ей важно хлопнуть на виду, а не точно) — проектное число
var NADE_AIM_DZ = {smoke: 0, molly: 0, flash: 80, he: 20};   // куда целиться по высоте над полом у цели, ед. (проектные числа)
// кэш решений — внутри функции: снимок «Отметить момент» копирует глобальные var, а кэш ему не нужен (и большой)
var nadeAimCache = (function(){ var C = {}, n = 0; return function(k, v){ if(v === undefined) return C[k]; if(++n > 4000){ C = {}; n = 0; } return (C[k] = v); }; })();
var NADE_RUN_V = 215;   // разбег перед броском, ед/с — скорость бега с винтовкой в CS2 (AK 215); бот бросает с места, граната — как с разбега
function nadePhysType(type){ return type === "molly" ? "molotov" : type; }
function nadeTraceFn(){ var M = m3(); return function(A, B){ return m3NadeTrace(M, A, B); }; }
// лучший бросок из (x, y) радара, стоя на полу z (ед. игры), в точку (tx, ty) радара → решение nadeAim + det в радаре, или null
function nadeSolve(type, x, y, z, tx, ty, duck){
  var M = m3(); if(!M) return null;
  var key = type+"|"+Math.round(x/4)+","+Math.round(y/4)+","+Math.round(z/8)+"|"+Math.round(tx/4)+","+Math.round(ty/4)+(duck ? "d" : "");
  var c0 = nadeAimCache(key); if(c0 !== undefined) return c0;
  var F = m3Game(M, x, y), T = m3Game(M, tx, ty), tz = visFloorAt(tx, ty) + (NADE_AIM_DZ[type] || 0);
  var r = nadeAim(nadePhysType(type), [F[0], F[1], z], [T[0], T[1], tz], nadeTraceFn(), {duck: !!duck, runV: NADE_RUN_V});
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
function throwNade(b, type, tx, ty, lob, why, trusted){
  NADE_FAIL = null;
  if(!b.nades || b.nades[type] <= 0){ NADE_FAIL = "нет гранаты"; return false; }
  if(!nadeReady(b)){ NADE_FAIL = "пауза между гранатами"; return false; }
  if(!m3()){ NADE_FAIL = "нет геометрии карты"; return false; }
  // (В3) как кинуть и куда упадёт — физикой из того места, где стоит; долетит ли — по самой цели
  var bz = b.z != null ? b.z : visFloorAt(b.x, b.y), S = nadeSolve(type, b.x, b.y, bz, tx, ty, b.crouching);
  if(!S){ NADE_FAIL = "цель под ногами"; return false; }
  // свой бросок — ближе NADE_AIM_OK (флешке — вдвое); лайнап — кидается и мимо, но не так, что граната падает у ног
  // (ближе к цели чем на NADE_AIM_OK × 4 — иначе отсюда туда не кинуть вовсе)
  if(S.err > NADE_AIM_OK * (trusted ? 4 : type === "flash" ? 2 : 1)){ NADE_FAIL = "не долетит: стена / потолок"; return false; }
  // лайнап не идеален: небольшой разброс точки, куда целится (до В4: «лайнап = записанный бросок про» — тогда уйдёт); бросок в
  // сдвинутую точку — если физика туда долетает, иначе тот же бросок с поворотом на сдвиг вбок (промах мимо, а не «не кинул»)
  if(lob){
    var leMul = b.prof ? (1.5 - prof(b, "util")) : 1;
    if(BAL.execErr && b.prof && hashRand(tick*43 + b.id.charCodeAt(1)*3) < (1-prof(b, "util"))*0.08){ leMul *= 3; noteMistake(b, "промахнулся гранатой ("+NADE[type].name+")"); }
    var le = BAL.lobErr * leMul * hashRand(tick*71 + b.id.charCodeAt(0)*5), la2 = hashRand(tick*13 + b.id.length*97)*Math.PI*2;
    var S2 = le > 1 ? nadeSolve(type, b.x, b.y, bz, tx + Math.cos(la2)*le, ty + Math.sin(la2)*le, b.crouching) : null;
    if(S2 && S2.err <= S.err + NADE_AIM_OK) S = S2;
    else if(le > 1){ var aT = Math.atan2(ty-b.y, tx-b.x), dT = Math.max(1, Math.hypot(tx-b.x, ty-b.y));
      S = Object.assign({}, S, {yaw: S.yaw - Math.asin(Math.max(-1, Math.min(1, le*Math.sin(la2 - aT)/dT))) * 180/Math.PI}); }   // y радара вниз — поворот с обратным знаком
  }
  // (аудит 11.10) HE / молотов не летит туда, где стоит свой (в радиусе поражения) — ни у цели, ни там, где граната
  // разорвётся на самом деле (точка физики); бросок отменяется, граната остаётся. И сам бросающий — тоже «свой»
  if((type === "he" || type === "molly") && bots.some(function(o){ return o.alive && o.team === b.team &&
      (Math.hypot(o.x-tx, o.y-ty) < NADE[type].radius || Math.hypot(o.x-S.x, o.y-S.y) < NADE[type].radius); })){ NADE_FAIL = "свой в зоне"; return false; }
  b.nades[type]--; b._nadeT = tick; b._lastNade = {type:type, x:tx, y:ty, t:tick};
  var M = m3(), F = m3Game(M, b.x, b.y);
  var runV = S.run ? [Math.cos(S.yaw*Math.PI/180)*NADE_RUN_V, Math.sin(S.yaw*Math.PI/180)*NADE_RUN_V, 0] : null;
  var L = nadeLaunch({pos: [F[0], F[1], bz], yaw: S.yaw, pitch: S.pitch, strength: S.strength, duck: !!b.crouching, jump: S.jump, vel: runV}, nadeTraceFn());
  var a = Math.atan2(ty-b.y, tx-b.x);
  // в полёте: состояние физики (ед. игры) + где на радаре; tx, ty — где разорвётся по расчёту (другие решения смотрят туда)
  var nd = {type:type, x:b.x, y:b.y, z:L.p[2], st: nadeState(nadePhysType(type), L.p, L.v), tx:S.x, ty:S.y, born:tick, thrower:b,
            team:b.team, trail:[], why:why||"", ox:b.x, oy:b.y, lob:!!lob, aimX:tx, aimY:ty};
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
function smokeCovered(x, y){
  // план §7: "два бота не кидают смок в одну точку, пока один ещё не рассеялся"
  if(smokes.some(function(s){ return Math.hypot(s.x-x, s.y-y) < 60 && s.until - tick > 64; })) return true;
  return nadesInAir.some(function(n){ return n.type === "smoke" && Math.hypot((n.tx||n.x)-x, (n.ty||n.y)-y) < 60; });
}
function assignNade(b, type, target, why, opts){
  if(!b || !b.alive || !b.nades || b.nades[type] <= 0) return false;
  if(opts && opts.bkey && !builtinAllowed(opts.bkey)) return false; // встроенная выключена или заменена своим лайнапом
  if(b.nadeTask && (b.nadeTask.type === type || b.nadeTask.lineup)) return false; // свой лайнап не перебиваем
  if(type === "smoke" && smokeCovered(target.x, target.y)) return false;
  // одна граната одного типа в одну точку: другие механики (комбо, флешка
  // себе, дамп…) не дублируют уже летящую/назначенную туда же
  if(BAL.nadeDedup && type !== "smoke" && (nadesInAir.some(function(n){ return n.team === b.team && n.type === type && Math.hypot((n.tx||n.x)-target.x, (n.ty||n.y)-target.y) < 120; }) ||
     bots.some(function(o){ return o !== b && o.alive && o.team === b.team && o.nadeTask && o.nadeTask.type === type && Math.hypot(o.nadeTask.x-target.x, o.nadeTask.y-target.y) < 120; }))) return false;
  b.nadeTask = {type:type, x:target.x, y:target.y, until: tick + 10*64, why:why||"", start:tick, lob:true, range:(opts && opts.range) || NADE_THROW_RANGE, now:!!(opts && opts.now)};
  return true;
}
// задание на гранату выполняется, как только точка видна и в пределах броска
function nadeQueueNext(b){
  // (v355) следующая граната из очереди того же бойца: с той же точки броска, срок 6 с (проектное число)
  if(!b.alive || !b.nadeQueue || !b.nadeQueue.length || b.nadeTask) return;
  var q = b.nadeQueue.shift();
  if(!b.nades || b.nades[q.type] <= 0 || roundState !== "live") return nadeQueueNext(b);
  var qSec = Math.max(6, Math.ceil(pathLenTo(b, q.from.x, q.from.y)/SPEED + LU_REACH_PAD));   // (v359) точка следующей — бывает дальше
  b.nadeTask = {type:q.type, x:q.x, y:q.y, from:q.from, until: tick + qSec*TICK_HZ, why:q.why, start:tick, lob:true, range:4000, now:true, lineup:true, exec:q.exec && q.type === "smoke"};
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
      if(Math.hypot(t.from.x-b.baseX, t.from.y-b.baseY) > 36 && !(b.atPost && b.post && b.post.tag === "lineup")){
        if(b.state === "hold" && !b._sawEnemy) leaveHold(b);
        // (v378) задача важнее броска (арбитр места) — бросок отменён, как живой игрок бросает лайнап ради боя / бомбы / колла
        if(b.state === "patrol" && !setPost(b, t.from, {x:t.x, y:t.y}, true, "lineup")){ b.nadeTask = null; b.nadeQueue = null; }
        return; }
      postKeep(b);   // стоит на точке броска — затея ещё идёт
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
  var reach = function(q){ var S = nadeSolve(t.type, q.x, q.y, visFloorAt(q.x, q.y), t.x, t.y, false); return S && S.err <= NADE_AIM_OK; };
  var c = nadeLaneFroms(t.x, t.y).filter(function(q){ return Math.hypot(q.x-b.x, q.y-b.y) <= NADE_SPOT_R && navAt(q.x, q.y); }).map(function(q){ return {x:q.x, y:q.y, lane:true}; })
    .concat(pickSpots("nthr"+b.id+"_"+Math.round(t.x)+","+Math.round(t.y), {x:b.x, y:b.y}, 8, {rMax:NADE_SPOT_R, minGap:40, hideFrom:foes})
      .filter(function(q){ return Math.hypot(q.x-t.x, q.y-t.y) <= t.range*0.85; }))
    .filter(function(q){ return !foes.some(function(f){ return hasLOS(q.x, q.y, f.x, f.y); }); });
  if(c.length > 12) c = c.sort(function(a, d){ return Math.hypot(a.x-b.x, a.y-b.y) - Math.hypot(d.x-b.x, d.y-b.y); }).slice(0, 12);
  c = c.filter(reach);
  var best = null, bL = Infinity;
  c.forEach(function(q){ var L = pathLenTo(b, q.x, q.y); if(L < bL){ bL = L; best = q; } });
  return best && bL <= NADE_SPOT_R*1.5 ? best : null;
}
