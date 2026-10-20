// ---------- бросок ----------
// (v323, М33) сверху сюда граната не упадёт: над полом крыша (штриховка радара → потолок видимости) или другой этаж навмеша
// выше больше чем на 100 ед. карты (под Palace, Underpass). Навесом сюда не кинуть — только низом, через вход
// (v370, владелец: «в игре есть крыша, но гранаты кидают вперёд, а траектория идёт будто через крышу») навес — дуга по высоте:
// от руки (пол + NADE_HAND) до пола у цели, высота над прямой — h. Бот примеряет дуги NADE_ARCS от высокой к низкой (как игрок:
// сильный навес, слабый, снизу) и берёт первую, что по всему пути проходит ниже потолков (потолок крытого пола —
// VIS.ceil, тот же, что для видимости). under — цель под крышей и дуга заходит под неё: граната падает под крышу, а не на неё.
// Нет такой — низом (если цель видна) или не кидает. Высоты — ед. игры; дуги — проектные числа
var NADE_HAND = 60, NADE_ARCS = [380, 220, 120, 60];
// (А5) по геометрии: дуга — ломаная из NADE_ARC_SEG отрезков, каждый — луч гранаты m3Line(…, 'nade'): крыши, стены, ящики,
// решётки как в игре (полёт по настоящей физике — шаг В2)
var NADE_ARC_SEG = 12;
function nadeArc(b, tx, ty){
  var M = m3();
  if(M){
    var za = visFloorAt(b.x, b.y, b.z) + NADE_HAND, zb = visFloorAt(tx, ty) + 10, cov = nadeCovered(tx, ty);
    for(var a3 = 0; a3 < NADE_ARCS.length; a3++){
      var h3 = NADE_ARCS[a3], ok3 = true, px3 = b.x, py3 = b.y, pz3 = za;
      for(var k3 = 1; k3 <= NADE_ARC_SEG && ok3; k3++){ var t3 = k3/NADE_ARC_SEG, x3 = b.x + (tx-b.x)*t3, y3 = b.y + (ty-b.y)*t3, z3 = za + (zb-za)*t3 + 4*h3*t3*(1-t3);
        if(!m3Line(M, px3, py3, pz3, x3, y3, z3, "nade")) ok3 = false; px3 = x3; py3 = y3; pz3 = z3; }
      if(ok3) return {h: h3, under: cov};
    }
    return null;
  }
  visReady();
  var z0 = (b.z != null ? b.z : visFloorAt(b.x, b.y)) + NADE_HAND, z1 = visFloorAt(tx, ty) + 10;
  var d = Math.hypot(tx-b.x, ty-b.y), n = Math.max(2, Math.ceil(d / VIS_CELL)), W = VIS.W, Cl = VIS.ceil, S = VIS.solid;
  var tCov = nadeCovered(tx, ty);
  for(var a = 0; a < NADE_ARCS.length; a++){
    var h = NADE_ARCS[a], ok = true;
    for(var k = 1; k < n && ok; k++){ var t = k/n, x = b.x + (tx-b.x)*t, y = b.y + (ty-b.y)*t;
      var i = Math.floor(x / VIS_CELL), j = Math.floor(y / VIS_CELL); if(i < 0 || j < 0 || i >= W || j >= W) continue;
      var z = z0 + (z1-z0)*t + 4*h*t*(1-t), c = Cl[j*W + i];
      if(c !== Infinity && z > c - 12) ok = false;            // крыша
      if(S[j*W + i] > z - 6) ok = false; }                     // (v370) стена / укрытие с известным верхом — граната над ним, не сквозь
    if(ok) return {h: h, under: tCov};
  }
  return null;
}
// (v373) своя граната через стену — только так, как кидают про. Замер (tools/nade_walls_pro.py, Mirage, 35 592 броска): у про 79 %
// бросков прямая «рука → разрыв» проходит сквозь стену радара (через крыши, над ящиками), толщиной — до 290 px у 10 % смоков;
// толщиной стены «можно / нельзя» не отличить (v370 — порог 100 px — резал броски: «стена на пути» — первая причина пропавших
// гранат у сторожа). Теперь: прямая без стен — можно; сквозь стену — если про кидали отсюда (≤ NADE_LANE_FROM) почти туда же
// (≤ NADE_LANE_TO): MAP.nadelanes (tools/nade_lanes_bake.py — все броски из демок карты). Радиусы — проектные числа
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
// флешку, HE и молотов в точку, куда про не кидали, — можно через стену не толще, чем у 90 % бросков про этого типа
// (MAP.pro.nadeWallP90, tools/nade_walls_pro.py: Mirage — флешка 233, HE 96, молотов 142 px); смок — только как про (лайнапы)
function nadeTallWall(x1, y1, x2, y2, type){
  if(!crossesWall(x1, y1, x2, y2)) return false;
  if(nadeLaneFroms(x2, y2).some(function(q){ return Math.hypot(q.x-x1, q.y-y1) <= NADE_LANE_FROM; })) return false;
  var P = (MAP.pro && MAP.pro.nadeWallP90) || {}, lim = type && type !== "smoke" ? P[type] : 0;
  if(!lim) return true;
  // (v375, отметка владельца: «кинул гранату в стену, она залетела внутрь помещения») через стену навесом — только под открытое
  // небо: в помещение (крыша над целью) — через проход или как кидали про
  if(nadeCovered(x2, y2)) return true;
  var d = Math.hypot(x2-x1, y2-y1), n = Math.ceil(d/2), run = 0;
  for(var k = 1; k < n; k++){ var t = k/n; if(insideSolidWall(x1 + (x2-x1)*t, y1 + (y2-y1)*t)){ run += d/n; if(run > lim) return true; } else run = 0; }
  return false;
}
// (А5) по геометрии: над полом точки (верхний этаж, куда дойти пешком) есть преграда для гранат выше роста — крыша, балкон
function nadeCovered(x, y){
  var M = m3();
  if(M){ var c = m3Cell(M, x, y); if(c < 0) return false;
    var C = m3Col(M, "nade"), fz = visFloorAt(x, y);
    for(var q = C.st[c]; q < C.st[c+1]; q++) if(C.lo[q] > fz + 80) return true;
    return false; }
  visReady();
  var i = Math.floor(x / VIS_CELL), j = Math.floor(y / VIS_CELL);
  if(i >= 0 && j >= 0 && i < VIS.W && j < VIS.W && VIS.ceil[j*VIS.W + i] < Infinity) return true;
  if(!NAV_GRID) navGridBuild();
  var L = NAV_GRID[Math.floor(x/NAV_GRID_C)+","+Math.floor(y/NAV_GRID_C)] || [], lo = Infinity, hi = -Infinity;
  for(var k=0;k<L.length;k++){ var zn = NAVAREAS[L[k]]; if(NAV_BLOCKED[zn.id] || !pointInPoly(x, y, zn.points)) continue; if(zn.z < lo) lo = zn.z; if(zn.z > hi) hi = zn.z; }
  return hi - lo > 100;
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
  // (аудит 11.10) проверка прямо перед броском: HE / молотов не летит туда, где стоит свой (в радиусе поражения) —
  // бросок отменяется, граната остаётся. Раньше не проверялось: 37 % HE падали в 300 px от своего, урон по своим от
  // гранат — 88 случаев на 12 матчей (у про из 33 тимкиллов 30 — пули, docs/PRO_PLAY.md 6г)
  // (этап 4, P1) проверяется и точка, где молотов реально загорится: прямой бросок вспыхивает, когда скорость падает ниже 70
  // (полёт ниже), т. е. на 70/64/(1−0,96) ≈ 27 px ближе цели. И сам бросающий — тоже «свой». Раньше: опорник CT кидал
  // «задержать выход» в точку в 79 px (радиус 72), огонь вспыхивал в 52 px — горел сам (5–10 раз на 12 матчей)
  var dL = Math.max(60, Math.hypot(tx-b.x, ty-b.y)); if(!lob) dL = Math.min(NADE_THROW_RANGE, dL);
  var aL = Math.atan2(ty-b.y, tx-b.x), shortL = (type === "molly" && !lob) ? 70/TICK_HZ/(1-0.96) : 0;
  var lx = b.x + Math.cos(aL)*Math.max(0, dL - shortL), ly = b.y + Math.sin(aL)*Math.max(0, dL - shortL);
  if((type === "he" || type === "molly") && bots.some(function(o){ return o.alive && o.team === b.team &&
      (Math.hypot(o.x-tx, o.y-ty) < NADE[type].radius || Math.hypot(o.x-lx, o.y-ly) < NADE[type].radius); })){ NADE_FAIL = "свой в зоне"; return false; }
  // (v323, М33) цель под крышей / под другим этажом — навесом не долетит: кидает низом (прямо, с отскоком от стен), если
  // точка видна; иначе не кидает
  // (v369) лайнап из набора (точка броска и цель — из демок про / свой лайнап): брошен так в игре — дуга не проверяется
  // (v370) остальное — дугой по высоте (nadeArc): навес, что проходит под потолками; нет — низом, если цель видна
  if(lob && !trusted && nadeTallWall(b.x, b.y, tx, ty, type)){ NADE_FAIL = "стена на пути"; return false; }   // (v373) сквозь стену — только как кидают про (MAP.nadelanes)
  var ARC = lob ? (trusted ? {h: NADE_ARCS[0], under: nadeCovered(tx, ty)} : nadeArc(b, tx, ty)) : null;   // (v375, отметка: молотов лайнапа про в T Ramp «пропадал» — падал «на крышу») лайнап про попадает под крышу, как у про
  if(lob && !ARC){ if(!hasLOS(b.x, b.y, tx, ty, b.z)){ NADE_FAIL = "дуга упирается в потолок, цель не видна"; return false; } lob = false; }
  // (v340, отметка владельца: «кидает через крытую зону» — kyousuke из-под крыши B Apps навесом через стену) сам под крышей /
  // под другим этажом — навесом нельзя (дуга упрётся в потолок): только низом, если цель видна (окно, проход)
  b.nades[type]--; b._nadeT = tick; b._lastNade = {type:type, x:tx, y:ty, t:tick};
  var d = Math.max(60, Math.hypot(tx-b.x, ty-b.y)); if(!lob) d = Math.min(NADE_THROW_RANGE, d);
  var a = Math.atan2(ty-b.y, tx-b.x);
  var v0 = d * (1-0.96) * TICK_HZ; // при затухании 0.96/тик пролетит примерно d
  var nd = {type:type, x:b.x, y:b.y, vx:Math.cos(a)*v0, vy:Math.sin(a)*v0, born:tick, thrower:b, team:b.team, trail:[], why:why||"", ox:b.x, oy:b.y};
  if(lob){
    // лайнап не идеален: небольшой разброс точки падения
    var leMul = b.prof ? (1.5 - prof(b, "util")) : 1;
    if(BAL.execErr && b.prof && hashRand(tick*43 + b.id.charCodeAt(1)*3) < (1-prof(b, "util"))*0.08){ leMul *= 3; noteMistake(b, "промахнулся гранатой ("+NADE[type].name+")"); }
    var le = BAL.lobErr * leMul * hashRand(tick*71 + b.id.charCodeAt(0)*5), la2 = hashRand(tick*13 + b.id.length*97)*Math.PI*2;
    nd.lob = true; nd.arcH = ARC ? ARC.h : NADE_ARCS[0]; nd.under = !!(ARC && ARC.under); nd.sx = b.x; nd.sy = b.y; nd.aimX = tx; nd.aimY = ty; nd.tx = tx + Math.cos(la2)*le; nd.ty = ty + Math.sin(la2)*le; nd.flight = Math.max(30, Math.round(d/650*TICK_HZ));
  }
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
      if(hasVision(o.x, o.y, b.x, b.y) && inFov(o, b.x, b.y) && tick >= (o.blindUntil||0)){
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
      // навесом — точки не видно. (v370, отметка владельца: magixx кинул смок из T Ramp в Window сквозь здания) раньше «стены
      // по пути не мешают» для любого броска; теперь сквозь стены летят только лайнапы про (из демок, так кидали на самом деле).
      // Свой бросок — над открытым местом (проходы, окна, укрытия); нет пути — идёт на точку рядом, откуда граната долетает
      // (nadeThrowSpot: безопасную от известных врагов); нет и такой — не кидает
      if(throwNade(b, t.type, t.x, t.y, true, t.why) || !/стена|потолок/.test(NADE_FAIL||"") || t._spotTried){ b.nadeTask = null; return; }   // (v373) и под крышей — на точку, откуда долетит
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
  // (v373) кандидаты — места, откуда про кидали в эту точку (MAP.nadelanes), и точки рядом без стены на пути
  // бросок с места про — как у про (без проверки дуги); своё место — дуга должна пройти под потолками (nadeArc)
  var c = nadeLaneFroms(t.x, t.y).filter(function(q){ return Math.hypot(q.x-b.x, q.y-b.y) <= NADE_SPOT_R && navAt(q.x, q.y); }).map(function(q){ return {x:q.x, y:q.y, lane:true}; })
    .concat(pickSpots("nthr"+b.id+"_"+Math.round(t.x)+","+Math.round(t.y), {x:b.x, y:b.y}, 8, {rMax:NADE_SPOT_R, minGap:40, hideFrom:foes})
      .filter(function(q){ return Math.hypot(q.x-t.x, q.y-t.y) <= t.range*0.85 && !crossesWall(q.x, q.y, t.x, t.y) && nadeArc({x:q.x, y:q.y, z:null}, t.x, t.y); }))
    .filter(function(q){ return !foes.some(function(f){ return hasLOS(q.x, q.y, f.x, f.y); }); });
  if(c.length > 12) c = c.sort(function(a, d){ return Math.hypot(a.x-b.x, a.y-b.y) - Math.hypot(d.x-b.x, d.y-b.y); }).slice(0, 12);
  var best = null, bL = Infinity;
  c.forEach(function(q){ var L = pathLenTo(b, q.x, q.y); if(L < bL){ bL = L; best = q; } });
  return best && bL <= NADE_SPOT_R*1.5 ? best : null;
}
