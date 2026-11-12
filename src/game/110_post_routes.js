// ---------- посты: "куда встать и куда смотреть" ----------
// Когда у бота в патруле есть пост — он идёт к нему, а дойдя (hold) стоит и
// смотрит в look. Бой (engage/hold/retreat) по-прежнему перебивает всё.
// ---- маршруты по названиям зон ----
// startRoute(b, ["Split","Lower Mid","Mid","Donut"]) — бот сначала проходит эти
// зоны по порядку, а уже потом идёт на пост, который ему выставит мозг роли
// (пост запоминается и применяется в конце маршрута). Бой, ретейк, бомба —
// важнее: маршрут снимается.
// (v408, Б5д, владелец 22.10: «зачем все идут в точку, а потом расходятся — у ботов мэш, а не граф») шаг маршрута — «пройти через
// зону», а не «добежать до её центра»: раньше каждое название было одной точкой (zonePoint — центр зоны), шаг считался пройденным
// ближе 70 к ней, и все на маршруте сходились у одной точки (сгустки в прогоне v406 — в ≈ 70 от центров House, Side Alley, T Apps,
// T Ramp, Water). Теперь цель шага — место зоны, ближайшее к отрезку «бот → следующая цель» (у каждого своё, по его положению), а шаг
// пройден, как только бот вошёл в зону
function routeZones(name, near){
  var ids = zonesByName(name); if(!ids.length) return null;
  var best = null, bd = Infinity;
  ids.forEach(function(id){ var c = BZ.cent[BZ.idx[id]], d = near ? Math.hypot(c.x-near.x, c.y-near.y) : 0; if(d < bd){ bd = d; best = id; } });
  var z = zoneById(best); return z ? {id:best, ids:ids, poly:z.points, c:BZ.cent[BZ.idx[best]]} : null;
}
function routeIn(Z, b){ return Z.ids.indexOf(zoneIdAt3(b.x, b.y, b.z)) >= 0; }   // зона — с этажом (над Underpass — Mid, не Underpass)
// место зоны Z, ближайшее к отрезку (x0,y0)→(x1,y1): пересекает зону — точка входа; нет — ближайшая точка края; чуть внутрь, на пол
function routeAim(Z, x0, y0, x1, y1){
  var P = Z.poly, n = P.length, best = null, bd = Infinity, bt = Infinity;
  for(var i = 0; i < n; i++){ var A = P[i], B = P[(i+1)%n];
    if(segIntersect(x0, y0, x1, y1, A.x, A.y, B.x, B.y)){
      var den = (x1-x0)*(B.y-A.y) - (y1-y0)*(B.x-A.x), t = den ? ((A.x-x0)*(B.y-A.y) - (A.y-y0)*(B.x-A.x))/den : 0;
      if(t < bt){ bt = t; best = {x: x0 + (x1-x0)*t, y: y0 + (y1-y0)*t}; bd = -1; } continue; }
    if(bd < 0) continue;
    for(var k = 0; k <= 8; k++){ var qx = A.x + (B.x-A.x)*k/8, qy = A.y + (B.y-A.y)*k/8;
      var ex = x1-x0, ey = y1-y0, L2 = ex*ex + ey*ey, u = L2 ? Math.max(0, Math.min(1, ((qx-x0)*ex + (qy-y0)*ey)/L2)) : 0;
      var d = Math.hypot(qx - (x0 + ex*u), qy - (y0 + ey*u)); if(d < bd){ bd = d; best = {x:qx, y:qy}; } } }
  if(!best) return walk(Z.c);
  var cx = Z.c.x - best.x, cy = Z.c.y - best.y, dc = Math.hypot(cx, cy), k2 = dc > 0 ? Math.min(1, 24/dc) : 0;   // 24 ед. внутрь — чтобы точка была в зоне
  return walk({x: best.x + cx*k2, y: best.y + cy*k2});
}
// цель текущего шага — от места бота к следующей зоне маршрута (её центр — только направление) или к цели после маршрута
function routeSetAim(b, R){
  var Z = R.zones[R.idx]; if(!Z) return;
  var nx = R.zones[R.idx+1] ? R.zones[R.idx+1].c : (R.want ? R.want[0] : Z.c);
  R.pts[R.idx] = routeAim(Z, b.x, b.y, nx.x, nx.y);
}
function startRoute(b, names, key){
  if(!names || !names.length) return;
  if(b._route && b._route.key === key) return;
  if(b._routeDone === key+"|"+roundNum) return;
  var zones = [], prev = {x:b.x, y:b.y};
  names.forEach(function(n){ var Z = routeZones(n, prev); if(Z){ zones.push(Z); prev = Z.c; } });
  if(!zones.length) return;
  // уже в зоне маршрута — следующий шаг после самой дальней по списку, где стоит
  var bi = 0; zones.forEach(function(Z, i){ if(routeIn(Z, b)) bi = i + 1; });
  if(bi >= zones.length) return;
  b._route = {key:key, zones:zones, pts:zones.map(function(Z){ return Z.c; }), idx:bi, t0:tick, names:names};
  routeSetAim(b, b._route);
}
function routeTick(){
  bots.forEach(function(b){
    var R = b._route; if(!R) return;
    if(!b.alive || roundState !== "live" || tick - R.t0 > 35*TICK_HZ){ b._route = null; return; }
    var Z = R.zones[R.idx];
    // шаг пройден — бот в зоне шага или дошёл до точки шага. (v430, М167, м1 Mirage р3: энтри donk 12 с стоял в 30 ед. от Side Alley:
    // точка шага у края зоны, «дошёл» — в 34 ед. от неё, ещё снаружи, а шаг ждал «внутри зоны»)
    var cpR = R.pts[R.idx], atCp = cpR && b.atPost && b.post && b.post.tag === "route:"+R.names[Math.min(R.idx, R.names.length-1)] && Math.hypot(b.post.x-cpR.x, b.post.y-cpR.y) < 1;
    if(Z && (routeIn(Z, b) || atCp)){ R.idx++; routeSetAim(b, R); }
    if(R.idx >= R.zones.length){
      var W = R.want; b._routeDone = R.key+"|"+roundNum; b._route = null;
      if(b._task && b._task.lv === 2) b._task = null;   // маршрут пройден — его задача кончилась, пост роли ставится сразу
      if(W) setPost(b, W[0], W[1], W[2], W[3], W[4]);
    }
  });
}
// (v162) ПРО-ТОЧКИ: [x, y, раундов, угол1, доля1, угол2?, доля2?] по слоям "сторона|pre/post"
var PRO_SPOTS = MAP.pro.spots;
var PSN = {R:120, occ:45, maxOff:1.05, open:60};   // open — (v530) px открытого вида по направлению угла, проектное число (половина R)
var PSN_TAGS = /^(rebal|anchor|rotator|mid$|set:|clutch|stage|lurkStage|lurk$|awpline|postplant|repos:fallback|repos:back|sitehold|rotateHold|midcover|cts:|stack)/;
function proSnap(b, pt, look, tag){
  if(!PSN_TAGS.test(tag || "")) return null;
  var layer = b.team + "|" + (bomb && bomb.state === "planted" ? "post" : "pre");
  var key = layer+"|"+tag+"|"+Math.round(pt.x/8)+","+Math.round(pt.y/8)+"|"+(look ? Math.round(look.x/40)+","+Math.round(look.y/40) : "");
  if(b._psK === key && b._psR === roundNum && b._psM === matchNum) return b._psV;
  b._psK = key; b._psR = roundNum; b._psM = matchNum; b._psV = null;
  var L = PRO_SPOTS[layer]; if(!L) return null;
  var best = null, bs = -1e9;
  // (v530, отметки владельца 10.11 «игрок 5 не доходит до точки и стоит за стенкой», «якоря позиций бесполезны — с них ничего не видно»: точка про
  // у Window (822,979) — стена в 28 px по направлению своего угла, у ротатора на CT — в 22 px; рядом есть точки про, откуда тот же угол открыт
  // на 370–720 px) игрок встаёт туда, откуда видно то, что он держит: сначала — только точки, откуда угол виден (линия до точки взгляда или
  // открыто по её направлению не меньше PSN.open); таких нет — как раньше, любые
  for(var pass = 0; pass < 2 && !best; pass++)
  for(var i=0;i<L.length;i++){
    var s = L[i], d = Math.hypot(s[0]-pt.x, s[1]-pt.y); if(d > PSN.R) continue;
    if(pass === 0 && look && !hasLOS(s[0], s[1], look.x, look.y)){ var la = Math.atan2(look.y-s[1], look.x-s[0]), rc = rayClipWalls(s[0], s[1], s[0]+Math.cos(la)*PSN.open, s[1]+Math.sin(la)*PSN.open); if(rc.wall) continue; }
    if(!hasLOS(s[0], s[1], pt.x, pt.y) || insideSolidWall(s[0], s[1])) continue;
    if(bots.some(function(o){ return o !== b && o.alive && o.team === b.team && o.post && Math.hypot(o.post.x-s[0], o.post.y-s[1]) < PSN.occ; })) continue;
    var modes = [[s[3], s[4]]]; if(s.length > 5) modes.push([s[5], s[6]]);
    var md = 0;
    if(look){ var wa = Math.atan2(look.y-s[1], look.x-s[0]); md = Math.min.apply(null, modes.map(function(m){ return _angOff(m[0], wa); })); if(md > PSN.maxOff) continue; }
    var mk = 1, qs = posAt(b.team, s[0], s[1]);   // (v246) тут в прошлом раунде не сработало — реже, как у про
    if(qs && !(bomb && bomb.state === "planted")){ var qv = posTable(b.team, nick(b.id), posWeaponClass(b))[qs.id] || 0; if(qv > 0) mk = posPref(b, qs, true)/qv; }
    var sc = Math.log(1 + s[2]*mk) - 1.5*d/PSN.R - 0.8*md;
    if(sc > bs){ bs = sc; best = {pt:{x:s[0], y:s[1]}, sp:{m:modes, r:s[2], k:i}}; }
  }
  b._psV = best;
  return best;
}
// взгляд на про-точке: направление, которое там держат про; из двух — ближайшее
// к тому, что команда поручила смотреть (раскладка углов); свежая инфа важнее
function proSpotLook(b){
  var P = b.post.pro; if(!P) return null;
  if(b._lkPick && b._lkPick.fresh && b._lkPt) return null;
  var M = P.m, ref = b._lkPt ? Math.atan2(b._lkPt.y-b.y, b._lkPt.x-b.x) : (b.post.look ? Math.atan2(b.post.look.y-b.post.y, b.post.look.x-b.post.x) : null);
  var S = b._proM;
  if(!S || S.k !== P.k || S.r !== roundNum || tick - S.t > 3*TICK_HZ){
    var bi = 0, bsc = -1e9;
    M.forEach(function(m, i){ var sc = m[1] - (ref === null ? 0 : _angOff(m[0], ref)/Math.PI*0.6); if(sc > bsc){ bsc = sc; bi = i; } });
    if(S && S.k === P.k && S.r === roundNum && S.i !== bi){ var cur = M[S.i]; var curSc = cur ? cur[1] - (ref === null ? 0 : _angOff(cur[0], ref)/Math.PI*0.6) : -1e9; if(curSc > bsc - 0.15) bi = S.i; }
    S = b._proM = {k:P.k, r:roundNum, i:bi, t:tick};
  }
  var a = M[S.i][0];
  return {x: b.x + Math.cos(a)*300, y: b.y + Math.sin(a)*300};
}
// (v162) отдельно стоящие ящики/колонны — небольшие замкнутые контуры стен
var _WB = null, _WBn = -1;
function wallBoxes(){
  if(_WB && _WBn === MANUAL_WALLS.length) return _WB;
  _WBn = MANUAL_WALLS.length; _WB = [];
  var W = MANUAL_WALLS, par = W.map(function(_, i){ return i; });
  var f = function(i){ while(par[i] !== i){ par[i] = par[par[i]]; i = par[i]; } return i; };
  var K = function(x, y){ return Math.round(x/3)+","+Math.round(y/3); }, idx = {};
  W.forEach(function(w, i){ [[w[0],w[1]],[w[2],w[3]]].forEach(function(p){
    var kx = Math.round(p[0]/3), ky = Math.round(p[1]/3);
    for(var dx=-1;dx<=1;dx++) for(var dy=-1;dy<=1;dy++){ (idx[(kx+dx)+","+(ky+dy)]||[]).forEach(function(j){ par[f(i)] = f(j); }); }
    (idx[kx+","+ky] = idx[kx+","+ky] || []).push(i); }); });
  var comp = {}; W.forEach(function(_, i){ (comp[f(i)] = comp[f(i)] || []).push(i); });
  Object.keys(comp).forEach(function(c){
    var S = comp[c], xs = [], ys = [];
    S.forEach(function(i){ xs.push(W[i][0], W[i][2]); ys.push(W[i][1], W[i][3]); });
    if(Math.max(Math.max.apply(null, xs)-Math.min.apply(null, xs), Math.max.apply(null, ys)-Math.min.apply(null, ys)) >= 90) return;
    // обход контура по сегментам
    var left = S.slice(), poly = [[W[left[0]][0], W[left[0]][1]], [W[left[0]][2], W[left[0]][3]]]; left.shift();
    var guard = 0;
    while(left.length && guard++ < 200){
      var e = poly[poly.length-1], hit = -1, rev = false;
      for(var q=0;q<left.length;q++){ var w = W[left[q]];
        if(Math.hypot(w[0]-e[0], w[1]-e[1]) < 4){ hit = q; break; }
        if(Math.hypot(w[2]-e[0], w[3]-e[1]) < 4){ hit = q; rev = true; break; } }
      if(hit < 0) break;
      var w2 = W[left[hit]]; poly.push(rev ? [w2[0], w2[1]] : [w2[2], w2[3]]); left.splice(hit, 1);
    }
    if(!left.length) _WB.push(poly);
  });
  return _WB;
}
var ENTRY_WAIT = 128;   // (v375) 2 с: напарник на размен у входа на сайт (медиана про) — число, т.к. TICK_HZ объявлен ниже
// ======================= (v527, «одно решение — одно место», №1) СВОЙСТВА ЗАДАЧ — одно место списков «какие это задачи» =======================
// Раньше каждая механика держала у себя свой список имён чужих задач (регулярка по post.tag): 22 списка в 14 файлах, друг с другом не
// сверенные. Теперь списки — здесь, под именем свойства; механика спрашивает taskProp(tag, "свойство"). Перенесены БЕЗ изменений (отпечаток
// бит в бит). ПРАВИЛО: новая задача — пройти по этой таблице и вписать её в нужные свойства; новый список имён в коде механики — нельзя.
// Проверка «это моя собственная задача» по одному имени (post.tag === "lineup" в коде лайнапа) — можно: таких ≈ 70, они остаются в своих файлах. Остался на месте один список —
// /^(earlyPeek|probe)/ в 365_nade_plan (файл входит в отпечаток предрасчёта гранат: перенести вместе со следующим пересчётом nadeguess).
// Следующий шаг (меняет игру): свести похожие свойства (holdsGround / holdsSite / siteDefender / reangleHolder; pieBusy / dangerWalkSkip /
// shiftHoldBusy / holdStrafeSkip / blindCoverBusy) и перенести в строки TASK_LEVEL
var TASK_PROP = {
  // (v547) отклонение вместо отказа (setPost, taskCanTry): короткое действие, которое задача фазы (ретейк, пост-плант, охота, сейв) раньше
  // молча перебивала. «Своё» — уйти от урона / перезарядиться / отойти; «помощь» — своему; «на дуэль» — выйти на врага самому
  detourSelf:       /^repos:(hurt|rlcover|lowhp|back)$/,
  detourHelp:       /^repos:(assist|flank|coverblind)$/,
  detourSeek:       /^repos:(push|swing|land|reload)$/,
  rushFollowable:   /^(rushFollow|utilWait|utilHold|route:|plantspot|bombWait)/,   // раш: задачи, с которых бота можно позвать следом за энтри (170)
  pieCareful:       /^(endhunt|hunt|probe|earlyPeek|flank|lurk|midcover|clear|roam|shift|clutch)/,   // срез угла: задачи, на которых угол режут (250)
  pieBusy:          /^(defuse|plantspot|flee|save|antidefuse|stopplant|retake|tradeR|repos|fetch|pickup|lineup)/,   // срез угла: задачи, на которых углы не режут (некогда) (250)
  lookAlongRetreat: /^(repos|flee|save)/,   // взгляд после планта: отход — исключение из «смотрит, куда идёт» (270)
  planStage:        /^(exec|stage)/,   // откат T: на стадии / выходе по плану не откатывается (300)
  siteDefender:     /^(anchor|rotator|set:|stack|cts:|rebal|rotateHold|sitehold)/,   // ребаланс: кто считается защитником сайта (300)
  reangleHolder:    /^(anchor|stack|set:)/,   // CT: кто меняет угол, слыша врагов вне вида (340)
  teamMove:         /^(rotate|gather|retake)/,
  fightMove:        /^contact:swing/,   // (v560, В82) задача «выйти на врага»: идёт к точке выхода и во время перестрелки, когда врага не видно (510)   // контакт: идёт по задаче команды — на одиночного врага не отвлекается (350)
  fireCommit:       /^(plantspot|defuse|antidefuse|stopplant|retake|gather|flee|fetch)/,   // огонь: задачи бомбы, ради которых идут через огонь (370)
  nadeFight:        /^(contact:swing|tradeR|retakeEntry|retake|clear)/,   // гранаты себе: идёт в бой (420)
  blindCoverBusy:   /^(defuse|plantspot|lineup|flee|save|tradeR)/,   // ослеплён: кого из своих не зовут прикрыть (460)
  holdsGround:      /^(anchor|stack|set:|cts:|clutch|midcover)/,   // мало HP: CT держит позицию (470)
  dangerWalkSkip:   /^(tradeR|flee|fetch|stopplant|antidefuse|repos|plantspot|lineup|defuse|smokeWait|pickup|retake|save|trade)/,   // опасное место: задачи, на которых не идут шагом (470)
  holdsSite:        /^(anchor|stack|set:|cts:|clutch|retake)/,   // дабл-пик: держит сайт — не бросает (480)
  tradeUrgent:      /^(retake|defuse|plantspot|antidefuse|endhunt|tradeR)/,   // размен: задачи, где «есть кому разменять» не проверяется (490)
  shiftHoldBusy:    /^(save|repos|defuse|plantspot|lineup|pickup|endhunt|retake|gather|stopplant|antidefuse)/,   // смена угла на посту: задачи, которые не трогают (500)
  cautiousEnd:      /^(retake|rotate|defuse)$/,   // шаг: последние метры ретейка / ротации / дефуза (535)
  bombSpot:         /^(defuse|plantspot)/,   // бег к бою: задача у бомбы — исключение (535)
  retakeMove:       /^(gather|retake|defuse|rotate)/,   // шаг на ретейке: проверка «успею ли шагом» (535)
  holdStrafeSkip:   /^(gather|retake|defuse|save|stopplant|antidefuse|lineup|pickup)/,   // стрейф на посту: задачи, на которых не стрейфят (540)
  // (v570, владелец 12.11: «и когда переставляет другая механика, и на пост-планте — тоже кроссфайером, а не кучно; маленький сайт — места
  // рядом») стоит и держит угол: место — на своей линии, не ближе OWN_LINE_GAP к месту / посту своего, кто тоже держит (setPost, 110)
  ownLine:          /^(anchor|stack|set:|cts:|mid$|mid:back|rotator|rotateHold|rebal|sitehold|default:|postplant|coverplant|clutch|midcover|retakeCover|endhunt|after:hold|bombwatch|fill|hold)/,
  exactSpot:        /^(plantspot|defuse|lineup|pickup|fetch|stopplant|antidefuse|ladder|smokeWait|route|sbGo)/,   // (v552) приказ песочницы — точно   // точное место: точку не сдвигают от своего (110)
  // (v529) проверки чужой задачи по ОДНОМУ имени (механика смотрит на задачу, которую ставит не она) — 19 мест в 10 файлах, без изменений:
  midTask:          /^tmid$/,        // пробы / «проверено — пусто»: задача мида T (150)
  waitsAhead:       /:ahead$/,       // IGL: стадия «жду впереди» (160)
  lineupTask:       /^lineup$/,      // IGL: смена плана снимает точку лайнапа (160)
  onRoute:          /^route:/,       // раш: идёт по маршруту (170)
  saveTask:         /^save$/,        // взгляд на посту; смена места после фрага: сейв (270, 500)
  plantSpot:        /^plantspot$/,   // эндгейм: носитель у точки планта (330)
  plantGo:          /^plantspot/,    // бой: носитель идёт ставить — перестрелка по памяти кончилась (510)
  pickupTask:       /^pickup$/,      // CT: идёт подбирать — не переставлять (340)
  reposMove:        /^repos/,        // шаг: перестановка в бою — бегом, угол не режет (535)
  flankTask:        /^(flank1|flank2)$/,   // шаг: фланг (535)
  gatherTask:       /^gather/,       // шаг: сбор на ретейк — последние метры (535)
  probeTask:        /^probe/,        // шаг: проба — последние метры (535)
  shiftTask:        /^shift$/,       // шаг: перестановка — последние метры (535)
  lurkTask:         /^lurk/,         // шаг: лёркер (535)
  endhuntTask:      /^endhunt$/,     // шаг: охота на последнего — последние метры (535)
  defuseTask:       /^defuse$/       // шаг: подход к дефузу (540, defuseWalk)
};
// (v560) снимок «Отметить момент» восстанавливает и TASK_PROP: в снимке старой версии нового свойства нет — тогда «нет»
function taskProp(tag, prop){ var R = TASK_PROP[prop]; return !!R && R.test(String(tag == null ? "" : tag)); }
// ======================= (v378, М126 этап 6) АРБИТР МЕСТА — одно место выбора задачи для позиции бота =======================
// Раньше у каждой затеи (контакт, размен, подмена, эндгейм, подбор, ожидание у смока, лайнап, ребаланс, проба, перестановка,
// маршрут) был свой «замок» со своим списком «кому можно меня перебить» — списки не сходились, механики перебивали друг друга
// в обход общего порядка (сторож: «перетягивание», «метания»). Теперь одна таблица важности видов задач и одно правило:
//  · новая задача ставится, если она НЕ НИЖЕ текущей (выше — сразу; того же уровня — не раньше POST_DWELL после прошлой смены,
//    защита от дёрганья); НИЖЕ — только когда текущая кончилась или устарела;
//  · текущая жива, пока её механика её подтверждает (вызывает setPost / postKeep не реже TASK_STALE) или пока не истёк её
//    срок удержания (taskKeepUntil — для задач, которые ставятся один раз: контакт, размен, подмена, перестановка, ребаланс);
//  · setPost возвращает true/false: механика, которой отказали, делает своё сама (лайнап — отменяет бросок, ожидание у смока —
//    снимается, подбор — помнит предмет и вернётся). Роль и ситуация в таблицу не входят — они только порождают задачи.
// Порядок и числа — ПРОЕКТНЫЕ (проектное число / порядок; проверка — situations.py: момент и доля переключения у про и у ботов).
var TASK_LEVEL = [   // сверху — важнее; первая подходящая строка
  {lv:12, kind:"приказ песочницы",   re:/^sbGo$/},   // (v536) только в песочнице (677): владелец сказал боту «иди сюда»
  {lv:11, kind:"бомба",              re:/^(flee|defuse|stopplant|antidefuse|plantspot)$/},
  {lv:10, kind:"выжить",             re:/^save/},
  {lv:9,  kind:"бой",                re:/^(contact|tradeR$|repos:killmove|repos:finish)/},   // (v469, п.25) добить раненого — тоже бой, контакт его не перебивает
  {lv:8,  kind:"ретейк/сбор/ротация",re:/^(retake|gather|rotate$|rotate:|bombwatch|postplant|fetch$)/},
  {lv:7,  kind:"эндгейм/клатч",      re:/^(endhunt|hunt$|clutch)/},   // охота на последних — общий план команды, как и было (замок эндгейма)
  {lv:6,  kind:"перестановка в бою", re:/^repos/},
  {lv:5,  kind:"команда",            re:/^(fill$|rotateHold|fetchCover|bombEscort|bombWait|coverplant|flank\d$)/},   // (п.20 владельца 29.10: фланг CT
  // «из-за частого перебивания путей… нет захода в спину» — был уровнем 1, его перебивало и ожидание у дыма) фланг — задача команды
  {lv:4,  kind:"гранаты/ожидания",   re:/^(lineup|smokeWait|smokeLine|utilWait|utilHold)$/},
  {lv:3,  kind:"личная перестановка",re:/^(pickup$|probe|rebal|shift$|earlyPeek|midcover)/},
  {lv:2,  kind:"маршрут",            re:/^route:/},
  {lv:1,  kind:"пост роли",          re:/(?:)/}
];
var TASK_ROUTE_CANCEL = 8;   // задача этого уровня и выше снимает маршрут; ниже (3–7) — пауза, маршрут продолжится после неё
// задача «устарела», если механика не подтверждала её POST_DWELL (1,5 с; то же проектное число, что защита от дёрганья): так
// механика, которая сама колеблется между своими двумя задачами (ротация ↔ держать, ждать гранаты ↔ зачищать), не дёргает
// бота каждые несколько тиков; задача, которую механика сама сняла (clearPost), кончается сразу
var TASK_STALE = 96;   // проектное число (= POST_DWELL)
// срок удержания задач, которые ставятся один раз (числа — те же, что были у замков своих механик). Функция, а не таблица
// функций: снимок «Отметить момент» копирует все глобальные var (structuredClone функций не умеет)
function taskKeepUntil(b, tag){
  var f = /^(contact|tradeR|fill|repos|rebal)/.exec(String(tag)); if(!f) return 0;
  if(f[1] === "contact") return b._contact && b._contact.lock ? b._contact.until : 0;   // CONTACT_HOLD
  if(f[1] === "tradeR"){ var L = b._tradeLock; if(!L) return 0;   // окно размена 3,5 с; кончилось, а убийцу не сняли — туда же второй раз не лезет
    if(tick >= L.until){ b._avoidPeekUntil = tick + 6*TICK_HZ; b._avoidPeekAt = L.at; b._tradeLock = null; return 0; } return L.until; }
  if(f[1] === "fill"){ var FL = b._fillLock; if(!FL) return 0;   // ≤ 15 с, пока план не сдвинулся (T — смена фазы, CT — «играем ретейк»), бомба
    if(tick >= FL.until || (bomb && bomb.state === "planted") || (FL.team === "T" ? !(teamTac.T && teamTac.T.phase === FL.ph) : !!(teamTac.CT && teamTac.CT.playRetake))){ b._fillLock = null; return 0; }
    return FL.until; }
  if(f[1] === "repos") return b._reposUntil || 0;
  return BAL.siteRebal && b._rebal && b._rebal.round === roundNum ? Infinity : 0;   // ребаланс — до конца раунда
}
function taskTagB(tag){ tag = String(tag); var r = /^repos:\w+/.exec(tag); return r ? r[0] : tag.replace(/[:|].*$/, ""); }
function taskLevel(tag){ tag = String(tag || ""); for(var i=0;i<TASK_LEVEL.length;i++) if(TASK_LEVEL[i].re.test(tag)) return TASK_LEVEL[i].lv; return 1; }
function taskAlive(b){ var T = b._task; return !!T && T.round === roundNum && (tick - T.t <= TASK_STALE || tick < taskKeepUntil(b, T.tag)); }
// можно ли сейчас поставить задачу tag (то же решение, что примет setPost) — для механик, которые решают, затевать ли своё
function taskCanSet(b, tag){
  var D = b._detour;
  if(D && (D.round !== roundNum || tick >= D.until || !b.alive)) D = b._detour = null;
  if(D){ if(taskTagB(tag) === D.tb) return true;   // (v518a) отклонение уточняет свою точку
    if(taskLevel(tag) <= D.lv) return false; }      // главная задача ждёт конца отклонения (не перебивает его каждый тик)
  var T = b._task; if(!taskAlive(b)) return true;
  var lv = taskLevel(tag), tb = taskTagB(tag);
  if(tb === T.tb) return true;                     // та же задача — уточняет точку
  if(lv > T.lv) return true;                       // важнее — сразу
  if(lv < T.lv) return false;                      // ниже — ждёт, пока текущая кончится
  return tick - T.t0 >= POST_DWELL;                // того же уровня — не раньше POST_DWELL (защита от дёрганья)
}
// ---- (v518a, пак владельца 09.11, docs/reports/ARCH_ROOT_CAUSES_2026-11-09.md п.1) ОТКЛОНЕНИЕ С ВОЗВРАТОМ — одно место ----
// Помочь своему в бою, подобрать оружие по пути, уйти от урона — не задача-соперник по лестнице TASK_LEVEL (там помощь 6 и подбор 3 проигрывали
// пост-планту 8, ретейку 8, охоте 7, сейву 10 всегда — «смотрит, но не идёт», «прошёл мимо калаша»), а короткое отклонение от главной задачи:
// можно, если главная задача это время терпит (taskSlackSec), и не дольше DETOUR_MAX; пока идёт — главная задача его не перебивает (taskCanSet),
// кончилось (срок / механика сняла точку) — главная задача ставит свою точку снова, путь — от того места, где бот сейчас.
// Нельзя: ставит / дефузит, задача «бомба» (уровень 11); помогать в бою — и на сейве (сейв от боя и уходит).
var DETOUR_MAX = {help: 4, pickup: 3, hurt: 3, seek: 4};   // (v547) seek — как help   // с — проектные числа (первые кандидаты на замену данными)
// сколько секунд главная задача бота может подождать: CT с бомбой на карте — запас до «не успею дефузнуть» (3 с — как contactCritical);
// T на пост-планте — 0, если дефузят (анти-дефуз важнее); CT на сейве — до «не успею уйти от взрыва к своей точке сейва»; остальное — не срочно
function taskSlackSec(b){
  if(!bomb || bomb.state !== "planted") return Infinity;
  var left = bombTimeLeftTicks()/TICK_HZ;
  if(b.team === "T") return bots.some(function(o){ return o.alive && o.defusing; }) ? 0 : Infinity;
  if(teamTac.CT && teamTac.CT.saving) return b._saveSpot ? left - pathLenTo(b, b._saveSpot.x, b._saveSpot.y)/SPEED - 2 : left - 4;
  return left - defuseEta(b) - 3;
}
// можно ли отклониться (cost — сколько секунд отнимет отклонение от главной задачи)
function detourOk(b, kind, cost){
  if(!b.alive || b.planting || b.defusing) return false;
  if(b._detour && b._detour.round === roundNum && tick < b._detour.until) return false;   // одно отклонение за раз
  var lv = taskAlive(b) ? b._task.lv : 1;
  // (v560, В101) несёт бомбу на точку планта (ещё не ставит), по нему стреляют — шаг за укрытие задача терпит (время — taskSlackSec ниже)
  var plantGo = kind === "hurt" && taskAlive(b) && taskProp(b._task.tag, "plantSpot");
  if((lv >= 11 && !plantGo) || ((kind === "help" || kind === "seek") && lv >= 10)) return false;
  // (v547, ответ владельца 10.11: «T на пост-планте незачем искать дуэли — сидит, ждёт; дефузят — идёт сбивать») выйти на врага самому — не T
  // с поставленной бомбой (сбить дефуз — задача «бомба», уровень 11, сама)
  if(kind === "seek" && b.team === "T" && bomb && bomb.state === "planted") return false;
  cost = cost || 0;
  // (v530, отметка владельца 10.11 «убил, мог подобрать оружие, но ушёл»: сейв с пистолетом, AK в 96 px в стороне от пути — крюк 3,3 с > 3 с)
  // на сейве цель — унести оружие в следующий раунд: подбор лучшего — сама цель, а не отвлечение; предел крюка — только время (taskSlackSec)
  var maxC = (kind === "pickup" && taskAlive(b) && taskProp(b._task.tag, "saveTask")) ? Infinity : DETOUR_MAX[kind];
  return cost <= maxC && cost + (kind === "pickup" ? 0.5 : CONTACT_HOLD) <= taskSlackSec(b);
}
// (v547, владелец 10.11: «в ретейке, пост-планте, сейве, охоте боты игнорируют многое, им запрещается что-либо делать — помогать, подбирать,
// даже когда есть возможность») короткое действие задачи ниже фазы (уровни 3–6) при задаче фазы (7–10) — отклонение, а не отказ: вид
// отклонения по свойству задачи (TASK_PROP: detourSelf / detourHelp / detourSeek); null — отказ, как раньше
function taskDetourKind(b, tag){
  if(!taskAlive(b) || b._task.lv < 7 || b._task.lv > 10 || taskLevel(tag) > 6) return null;
  return taskProp(tag, "detourSelf") ? "hurt" : taskProp(tag, "detourHelp") ? "help" : taskProp(tag, "detourSeek") ? "seek" : null;
}
// можно ли затеять задачу tag (сразу или отклонением) — для механик, которые решают, затевать ли своё, до setPost
function taskCanTry(b, tag){ if(taskCanSet(b, tag)) return true; var dk = taskDetourKind(b, tag); return !!dk && detourOk(b, dk, 0); }
// начать отклонение: задача tag на sec секунд, главная задача (её уровень) ждёт
function detourStart(b, kind, tag, sec){
  var lv = taskAlive(b) ? b._task.lv : 1;
  b._detour = {kind:kind, tb:taskTagB(tag), lv:Math.max(lv, taskLevel(tag)), until: tick + Math.round(sec*TICK_HZ), round:roundNum};
}
// механика держит свою текущую задачу (пост не меняется — подтвердить, что затея ещё идёт)
function postKeep(b){ if(b.post && b._task && b._task.tag === b.post.tag) b._task.t = tick; }
var POST_DWELL = 96;   // (v375) 1,5 с — проектное число
// (v547, владелец 10.11, отметка «поставил ему точку, он не дошёл и перестал идти»: «дошёл» засчитывалось в 34 px (≈ 85 ед. игры) от точки —
// бот вставал раньше точки, приказ песочницы снимался) «дошёл» — в самой точке (≈ 20 ед. игры, меньше ширины игрока); точка, до которой
// не дойти (в углу, за краем), — как раньше: не приближается 1,4 с — встал (arriveNear). Было 34 (у места про — 9) — проектное число
var POST_ARRIVE = 8;
var POST_EXACT = TASK_PROP.exactSpot;   // (v527) список — в таблице свойств задач
var POST_VIEW_R = 120, POST_VIEW = {k: null, m: {}};   // px — насколько можно сдвинуть пост ради обзора (проектное число)
function postViewPoint(pt, look){
  var kk = matchNum+":"+roundNum; if(POST_VIEW.k !== kk){ POST_VIEW.k = kk; POST_VIEW.m = {}; }
  var key = Math.round(pt.x/4)+","+Math.round(pt.y/4)+">"+Math.round(look.x/8)+","+Math.round(look.y/8);
  if(key in POST_VIEW.m) return POST_VIEW.m[key];
  var a0 = navAt(pt.x, pt.y), best = null, bd = 1e9;
  NAVAREAS.forEach(function(z){
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var c = zoneCentroid(z), d = Math.hypot(c.x-pt.x, c.y-pt.y); if(d > POST_VIEW_R || d >= bd || insideSolidWall(c.x, c.y)) return;
    var a = navAt(c.x, c.y); if(!a || (a0 && Math.abs(a.z - a0.z) > JUMP_UP)) return;
    if(!hasLOS(c.x, c.y, look.x, look.y)) return;
    best = {x: c.x, y: c.y}; bd = d; });
  return (POST_VIEW.m[key] = best);
}
var OWN_LINE_GAP = 150, OWN_LINE_RINGS = [90, 130, 170, 210, 260, 310];   // (v570) проектные числа: «своя линия» ≈ 150 px (375 ед.), искать — до ~310 (рядом с сайтом)
var SPREAD_RINGS = [80, 110, 145, 180];   // (v570) проектные числа: шаг ≈ «личное место» 70 + 10; дальше 180 — уже другое место, а не «рядом»
var SPREAD_DIRS = [Math.PI/2, -Math.PI/2, Math.PI*0.75, -Math.PI*0.75, Math.PI/4, -Math.PI/4, Math.PI, 0];
// (v570) точка, которую задача дала посту (до раздвигания и сдвига к виду): «тот же ли пост» сверять с ней, а не со сдвинутым местом —
// иначе сдвинутый пост «далеко» от точки задачи всегда, и задача ставит его заново каждый тик (340 опорник v280, 170 раш / прикрытие)
function postSrc(b){ return b.post ? (b.post.src || b.post) : null; }
function setPost(b, pt, look, hold, tag, spreadIdx){
  var pt0 = pt;   // (v570) точка, как её дала задача (до сдвигов ниже) — у поста src: задача сверяет своё место с ней, а не со сдвинутым
  // сменил позицию после фрага — роль в этом раунде ставит его уже на новую точку
  if(BAL.holdShift && b._hs && b._hs.round === roundNum && b._hs.tag === tag && pt && Math.hypot(pt.x-b._hs.pt.x, pt.y-b._hs.pt.y) < 320) pt = b._hs.pt;
  var lv = taskLevel(tag);
  // маршрут раша — путь к посту роли: пост роли, пока маршрут не пройден, становится его концом (R.want); задача уровня
  // TASK_ROUTE_CANCEL и выше (и у CT — поставленная бомба) маршрут снимает; задачи между ними — пауза маршрута (v349)
  if(b._route && lv !== 2){
    var R = b._route;
    if(lv >= TASK_ROUTE_CANCEL || (bomb && bomb.state === "planted" && b.team === "CT")) b._route = null;
    else if(lv === 1 && R.idx < R.pts.length){
      R.want = [pt, look, hold, tag, spreadIdx];
      var cp = R.pts[R.idx], nx = R.pts[R.idx+1] || pt;
      return setPost(b, cp, nx, true, "route:"+R.names[Math.min(R.idx, R.names.length-1)]);
    }
  }
  if(lv === 1 && !/^after:/.test(String(tag))){ var AF = afterTaskPick(b, pt); if(AF) return setPost(b, AF.pt, AF.look, true, "after:hold"); }
  if(!taskCanSet(b, tag)){ var dk = taskDetourKind(b, tag);   // (v547) задача фазы — не отказ, а отклонение, если она терпит это время
    if(!dk || !pt || !detourOk(b, dk, pathLenTo(b, pt.x, pt.y)/SPEED)) return false;
    detourStart(b, dk, tag, DETOUR_MAX[dk]); }
  var tagB = taskTagB(tag);
  var psn = (BAL.proSpots && hold && pt) ? proSnap(b, pt, look, tag) : null;
  // (v520, отметки владельца 09.11 м200 р1/р3: мидер у Window и NiKo у Hole — точку уводило к месту про, откуда не видно того, что держит пост:
  // (824,857) → (838,867), Mid виден → не виден) место про — только если оттуда точка взгляда поста видна не хуже, чем с выбранной
  if(psn && look && hasLOS(pt.x, pt.y, look.x, look.y) && !hasLOS(psn.pt.x, psn.pt.y, look.x, look.y)) psn = null;
  if(psn){ pt = psn.pt; spreadIdx = 0; }
  // (00_PLAN п.3а, 05.11, прогон 173: Mirage — «держать бомбу» / «мало HP» у Vent на (845, 807), за краем пола, — бот упирался или его
  // переносило по кругу) точка поста — на полу: вне навмеша — ближайшая точка ближайшего участка (в 40 ед., как перенос navSnap)
  if(pt && !navAt(pt.x, pt.y)){ var naP = navFloorNear(pt.x, pt.y, 40, function(a){ return b.z == null || Math.abs(a.z - b.z) <= JUMP_UP; });
    if(naP){ var cqP = navClampInto(naP, pt.x, pt.y); pt = Object.assign({}, pt, {x:cqP.x, y:cqP.y}); } }
  // (v520, отметки владельца 09.11 м200 р1/р3 и вопрос владельца «справится ли правка на другой карте»: точку поста выбирают пять мест — раскладка
  // CT, ветка мида, «держать район», место про, раздвигание — и ни одно не обязано проверять главное: видно ли с точки то, ради чего пост.
  // Мидер вставал за стену Window, NiKo — в Hole, откуда Top Mid не виден) одно место для всех: пост с точкой взгляда, откуда её не видно, —
  // на ближайшую точку рядом (≤ POST_VIEW_R, тот же этаж), откуда видно; нет такой — как выбрано. Точные места (бомба, лайнап, подбор,
  // маршрут) — как есть
  if(hold && look && pt && !POST_EXACT.test(String(tag)) && !hasLOS(pt.x, pt.y, look.x, look.y)){ var pv = postViewPoint(pt, look); if(pv) pt = Object.assign({}, pt, {x:pv.x, y:pv.y}); }
  var id = tag + "|" + Math.round(pt.x) + "," + Math.round(pt.y);
  if(!b._task || b._task.tb !== tagB || b._task.round !== roundNum || !taskAlive(b)) b._task = {tag:String(tag), tb:tagB, lv:lv, t0:tick, t:tick, round:roundNum};
  else { b._task.t = tick; b._task.tag = String(tag); }
  // (v260, В3) та же точка и задача — путь не сбрасываем, но новое направление взгляда принимаем
  // (v570) та же точка — пост держится, но если после сдвига туда же встал свой (его пост поставлен позже — сдвиг считался без него), один
  // из двоих (у кого id больше) считает место заново: было — двое CT на охоте в одной точке (1026, 1493) до конца раунда
  var ownL = BAL.ownLine && hold && taskProp(String(tag), "ownLine") && !POST_EXACT.test(String(tag));
  if(b.post && b.post.id === id && !(ownL && bots.some(function(o){ return o !== b && o.alive && o.team === b.team && o.id < b.id && o.post && Math.hypot(o.post.x-b.post.x, o.post.y-b.post.y) < SPOT_PERSONAL; }))){ b.post.look = look || null; return true; }
  var x = pt.x, y = pt.y;
  // (v370, владелец: «не стоят в толпе») точка, где уже стоит / куда идёт свой (≤ SPOT_PERSONAL), — встаём рядом поперёк взгляда,
  // а не в него. Одно место для всех постов (было: раздвиг на 22 ед. только по spreadIdx). Точные места (бомба, лайнап, подбор) — как есть
  // (v373, отметка владельца: donk стоял на спавне T весь раунд) точка маршрута — не место, где стоять: маршрут засчитывает её, когда
  // бот ближе 70, а сдвиг на 80 не давал дойти — маршрут вставал. Точки маршрута не сдвигаются
  // (v570) держит угол (ownLine) — сначала место не ближе OWN_LINE_GAP к своим, кто держит (кроссфайер, а не плечом к плечу), кольцами
  // дальше — до OWN_LINE_RINGS (за краем сайта — тоже: место рядом, откуда виден тот же угол); нет такого — как было (личное место 70)
  if(ownL && spotTaken(b, {x:x, y:y}, "line")){
    var la1 = look ? Math.atan2(look.y-y, look.x-x) : 0, xa = x, ya = y, losA = look && hasLOS(xa, ya, look.x, look.y), got = false;
    OWN_LINE_RINGS.some(function(r){ return SPREAD_DIRS.some(function(da){
      var nx = xa + Math.cos(la1+da)*r, ny = ya + Math.sin(la1+da)*r;
      if(insideSolidWall(nx, ny) || segCrossesManualWalls(xa, ya, nx, ny) || !navAt(nx, ny) || spotTaken(b, {x:nx, y:ny}, "line") || spotTaken(b, {x:nx, y:ny}, "post")) return false;
      if(!hasLOS(xa, ya, nx, ny)) return false;
      if(losA && !hasLOS(nx, ny, look.x, look.y)) return false;
      x = nx; y = ny; got = true; return true; }); });
  }
  // (v570) держит угол — точку не сдвигает свой, который сейчас проходит мимо (было: точку пост-планта, выбранную в 161 ед. от соседа, сдвигало
  // на 80 к нему — соседи сходились до 81 ед.): только места своих, кто держит (spotTaken «line»); их нет рядом / уже сдвинута — личное место
  if((spreadIdx || (ownL ? !got && spotTaken(b, {x:x, y:y}, "line") && spotTaken(b, {x:x, y:y}, "post") : spotTaken(b, {x:x, y:y}))) && !POST_EXACT.test(String(tag))){
    // (v570, отметки владельца м1 р3 15,7 с и р4 57,3 с: «все по 1-3-1 стоят в одной точке», «слишком кучно стоят снова») — было: только
    // 4 точки на 80 ед.; в тесном месте все 4 заняты / за стеной — бот вставал прямо в точку своего (двое CT в (1014, 1577)). Теперь — кольца
    // дальше (до SPREAD_MAX), сначала поперёк взгляда; та же проверка: пол, без стены, не занято, виден прежний пост, обзор не отнимается
    var la = look ? Math.atan2(look.y-y, look.x-x) : 0, x0 = x, y0 = y, losPost = look && hasLOS(x0, y0, look.x, look.y);
    SPREAD_RINGS.some(function(r){ return SPREAD_DIRS.some(function(da){
      var nx = x0 + Math.cos(la+da)*r, ny = y0 + Math.sin(la+da)*r;
      if(insideSolidWall(nx, ny) || segCrossesManualWalls(x0, y0, nx, ny) || !navAt(nx, ny) || spotTaken(b, {x:nx, y:ny})) return false;
      if(r > SPOT_PERSONAL+10 && !hasLOS(x0, y0, nx, ny)) return false;   // дальше одного шага — та же комната, а не за углом
      if(losPost && !hasLOS(nx, ny, look.x, look.y)) return false;   // (v520) раздвигание не отнимает обзор поста
      x = nx; y = ny; return true; }); });
  }
  // (v570) пересчёт того же поста (свой встал рядом) дал то же место — пост и путь не трогаем (иначе путь сбрасывался бы каждый тик)
  if(b.post && b.post.id === id && Math.hypot(b.post.x-x, b.post.y-y) < 2){ b.post.look = look || null; return true; }
  (b._postSets || (b._postSets = [])).push(tick); if(b._postSets.length > 12) b._postSets.shift();   // (v570) диагностика для 545 (игра не читает)
  b.post = {id:id, x:x, y:y, z:(pt.z != null ? pt.z : navOnlyZ(x, y)), look:look||null, hold:hold, tag:tag, src:{x:pt0.x, y:pt0.y}};   // (v546) z — высота точки, если задана, или пол точки, если он там один (ящик); иначе null
  if(psn) b.post.pro = psn.sp;
  b.atPost = false;
  if(b.state === "patrol"){ b.path = []; b.pathIdx = 0; }
  return true;
}
// (5) после временной задачи (ответ владельца 04.11, `docs/tasks/OWNER_ANSWERS_2026-11-04.md`): не «вернуться на пост», а оценить. Ушёл
// по бою (контакт, перестановка в бою — уровни 9 и 6), задача кончилась, роль зовёт на пост: если враг, известный команде (за SITE_SEEN_SEC),
// простреливает пост, а место, где бот сейчас, — нет, угроза осталась: остаётся, где стоит, смотрит на врага; инфа устарела / враг ушёл —
// назад на пост. На посту свой — пост сдвигается рядом (spotTaken в setPost), команда ротирует — роль даёт новый пост (сама)
function afterTaskPick(b, pt){
  var T = b._task;
  if(T && T.round === roundNum && (T.lv === 9 || T.lv === 6) && !taskAlive(b)) b._aft = {round:roundNum, x:b.baseX, y:b.baseY};
  var A = b._aft; if(!A || A.round !== roundNum || !pt) return null;
  var BL = beliefLast[b.team] || {}, foe = b.team === "T" ? "CT" : "T", th = null;
  bots.some(function(o){ var e = BL[o.id]; if(!o.alive || o.team !== foe || !e || tick - e.tick > SITE_SEEN_SEC*TICK_HZ) return false;
    if(hasLOS(e.x, e.y, pt.x, pt.y) && !hasLOS(e.x, e.y, A.x, A.y)){ th = e; return true; } return false; });
  if(!th){ b._aft = null; return null; }
  if(b._aftSaid !== roundNum && (b._aftSaid = roundNum)) logEvent(b.id+": задача кончилась, но пост простреливается ("+calloutName(th.x, th.y).replace(/^на /,"")+") — остаюсь");
  return {pt:{x:A.x, y:A.y}, look:{x:th.x, y:th.y}};
}
// механика сама сняла свою точку — её задача кончилась (следующая ставится без ожидания)
function clearPost(b){ b._task = null; if(b._detour && b.post && taskTagB(b.post.tag) === b._detour.tb) b._detour = null; if(b.post){ b.post = null; b.atPost = false; if(b.state==="patrol"){ b.path = []; b.pathIdx = 0; } } }
function updatePost(b){
  if(!b.post || b.state !== "patrol"){ b.atPost = false; return; }
  var ep = fireSafe(b.post, b);
  if(ep !== b.post && b.atPost && Math.hypot(ep.x-b.baseX, ep.y-b.baseY) > 34){ b.atPost = false; b.path = []; b.pathIdx = 0; }
  var d = Math.hypot(ep.x-b.baseX, ep.y-b.baseY);
  if(b.post.hold){
    // точка планта: "дошёл" — это именно внутри зоны сайта, а не в 34px от точки
    // (иначе носитель останавливался у края зоны, снаружи, и не мог заложить)
    // (v521, отметки владельца 10.11 м200: kyousuke «не дошёл до якоря» — «дошёл» в 34 px у окна, точка на ступеньке, оттуда Top Mid виден, с места
    // бота — нет; donk 10,6 с не ставил — «дошёл» в 10 px от точки планта, но снаружи зоны сайта, а ставить можно только в ней; sh1ro в обходе встал
    // в 34 px от точки, откуда врага не видно) «дошёл» — когда отсюда можно делать то, ради чего пост: плант — внутри зоны сайта; пост с точкой
    // взгляда, которую видно с точки поста, — когда её видно и с места бота. Нет — идёт дальше, до самой точки
    var canView = function(){ var lk = b.post.look; return !lk || !hasLOS(ep.x, ep.y, lk.x, lk.y) || hasLOS(b.baseX, b.baseY, lk.x, lk.y, b.z); };   // считается только у точки (≤ 34 px)
    var arrived = b.post.tag === "plantspot" && teamTac.T && SITES[teamTac.T.site] ? (onSite(SITES[teamTac.T.site], b.baseX, b.baseY) && d < 60) :
      b.post.tag === "defuse" ? d < DEFUSE_R - 8 :   // (v359, отметка: m0NESY «дошёл» до бомбы в 34 ед., а дефуз — с 30: стоял 12 с до взрыва)
      b.post.tag === "lineup" ? d < LU_AT :   // (v492) лайнап — в саму точку броска: с 34 px подбор отсюда — «свеча» (прогон 143)
      (d < POST_ARRIVE && (b.atPost || canView()) && (b.post.z == null || b.z == null || Math.abs(b.post.z - b.z) <= 40));   // (v546) пост на ящике — «дошёл» только наверху
    // (опорник "не дошёл") точка поста чуть внутри угла/стены: бот доходил на
    // 30–60px и крутился рядом, не "вставая" на пост. Не приближается ~1.5с — встал
    if(BAL.arriveNear && !b.atPost && !arrived && b.post.tag !== "plantspot" && b.post.tag !== "defuse"){
      if(b._apId !== b.post.id){ b._apId = b.post.id; b._apBest = d; b._apT = tick; }
      else if(d < b._apBest - 6){ b._apBest = d; b._apT = tick; }
      // (v519, пак 09.11 п.3; Р-32: bomb-watch «стоял на ступеньках, на точку не пришёл») «не приближается — значит дошёл» — только на этаже точки
      // (последняя точка пути — её пол): под точкой на возвышенности, на лестнице, он в 30–70 px по радару и ближе не подойдёт — это не «дошёл»
      else if(d < (b.post.tag === "lineup" ? RUN_NEAR : 70) && tick - b._apT > 90){ var lp = b.path && b.path.length ? b.path[b.path.length-1] : null;
        if((!lp || lp[2] == null || b.z == null || Math.abs(lp[2] - b.z) <= 40) && (b.post.z == null || b.z == null || Math.abs(b.post.z - b.z) <= 40)) arrived = true; }   // (v546) и не под постом на ящике
    }
    if(!b.atPost && arrived){ b.atPost = true; b.path = []; b.pathIdx = 0;
      // встал с AWP на угол — щелчок зума слышно рядом (≤200 по прямой, ≤120 за стеной)
      if(BAL.soundMore && b.weapon && b.weapon.key === "AWP" && roundState === "live" && tick - (b._zoomTick||-9999) > 3*TICK_HZ){
        b._zoomTick = tick;
        emitSound(b, b.x, b.y, 200, 120, "zoom", tick*53 + (b.id.charCodeAt(b.id.length-1)||0)).forEach(function(o){
          voiceLog(o.team, "zoom"+b.id, o.id, "слышу зум AWP "+calloutName(o.heardSound.x, o.heardSound.y));
        });
      }
    }
    else if(b.atPost && (d > 80 || (b.post.tag === "defuse" && d >= DEFUSE_R - 4))){ b.atPost = false; b.path = []; b.pathIdx = 0; }
  } else b.atPost = false;
}

