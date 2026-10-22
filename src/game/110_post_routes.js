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
    if(Z && routeIn(Z, b)){ R.idx++; routeSetAim(b, R); }
    if(R.idx >= R.zones.length){
      var W = R.want; b._routeDone = R.key+"|"+roundNum; b._route = null;
      if(b._task && b._task.lv === 2) b._task = null;   // маршрут пройден — его задача кончилась, пост роли ставится сразу
      if(W) setPost(b, W[0], W[1], W[2], W[3], W[4]);
    }
  });
}
// (v162) ПРО-ТОЧКИ: [x, y, раундов, угол1, доля1, угол2?, доля2?] по слоям "сторона|pre/post"
var PRO_SPOTS = MAP.pro.spots;
var PSN = {R:120, occ:45, maxOff:1.05};
var PSN_TAGS = /^(rebal|anchor|rotator|mid$|set:|clutch|stage|lurkStage|lurk$|awpline|postplant|repos:fallback|repos:back|sitehold|rotateHold|midcover|cts:|stack)/;
function proSnap(b, pt, look, tag){
  if(!PSN_TAGS.test(tag || "")) return null;
  var layer = b.team + "|" + (bomb && bomb.state === "planted" ? "post" : "pre");
  var key = layer+"|"+tag+"|"+Math.round(pt.x/8)+","+Math.round(pt.y/8)+"|"+(look ? Math.round(look.x/40)+","+Math.round(look.y/40) : "");
  if(b._psK === key && b._psR === roundNum && b._psM === matchNum) return b._psV;
  b._psK = key; b._psR = roundNum; b._psM = matchNum; b._psV = null;
  var L = PRO_SPOTS[layer]; if(!L) return null;
  var best = null, bs = -1e9;
  for(var i=0;i<L.length;i++){
    var s = L[i], d = Math.hypot(s[0]-pt.x, s[1]-pt.y); if(d > PSN.R) continue;
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
  {lv:11, kind:"бомба",              re:/^(flee|defuse|stopplant|antidefuse|plantspot)$/},
  {lv:10, kind:"выжить",             re:/^save/},
  {lv:9,  kind:"бой",                re:/^(contact|tradeR$|repos:killmove)/},
  {lv:8,  kind:"ретейк/сбор/ротация",re:/^(retake|gather|rotate$|rotate:|bombwatch|postplant|fetch$)/},
  {lv:7,  kind:"эндгейм/клатч",      re:/^(endhunt|hunt$|clutch)/},   // охота на последних — общий план команды, как и было (замок эндгейма)
  {lv:6,  kind:"перестановка в бою", re:/^repos/},
  {lv:5,  kind:"команда",            re:/^(fill$|rotateHold|fetchCover|bombEscort|bombWait|coverplant)/},
  {lv:4,  kind:"гранаты/ожидания",   re:/^(lineup|smokeWait|utilWait|utilHold)$/},
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
  var T = b._task; if(!taskAlive(b)) return true;
  var lv = taskLevel(tag), tb = taskTagB(tag);
  if(tb === T.tb) return true;                     // та же задача — уточняет точку
  if(lv > T.lv) return true;                       // важнее — сразу
  if(lv < T.lv) return false;                      // ниже — ждёт, пока текущая кончится
  return tick - T.t0 >= POST_DWELL;                // того же уровня — не раньше POST_DWELL (защита от дёрганья)
}
// механика держит свою текущую задачу (пост не меняется — подтвердить, что затея ещё идёт)
function postKeep(b){ if(b.post && b._task && b._task.tag === b.post.tag) b._task.t = tick; }
var POST_DWELL = 96;   // (v375) 1,5 с — проектное число
function setPost(b, pt, look, hold, tag, spreadIdx){
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
  if(!taskCanSet(b, tag)) return false;
  var tagB = taskTagB(tag);
  var psn = (BAL.proSpots && hold && pt) ? proSnap(b, pt, look, tag) : null;
  if(psn){ pt = psn.pt; spreadIdx = 0; }
  var id = tag + "|" + Math.round(pt.x) + "," + Math.round(pt.y);
  if(!b._task || b._task.tb !== tagB || b._task.round !== roundNum || !taskAlive(b)) b._task = {tag:String(tag), tb:tagB, lv:lv, t0:tick, t:tick, round:roundNum};
  else { b._task.t = tick; b._task.tag = String(tag); }
  // (v260, В3) та же точка и задача — путь не сбрасываем, но новое направление взгляда принимаем
  if(b.post && b.post.id === id){ b.post.look = look || null; return true; }
  var x = pt.x, y = pt.y;
  // (v370, владелец: «не стоят в толпе») точка, где уже стоит / куда идёт свой (≤ SPOT_PERSONAL), — встаём рядом поперёк взгляда,
  // а не в него. Одно место для всех постов (было: раздвиг на 22 ед. только по spreadIdx). Точные места (бомба, лайнап, подбор) — как есть
  // (v373, отметка владельца: donk стоял на спавне T весь раунд) точка маршрута — не место, где стоять: маршрут засчитывает её, когда
  // бот ближе 70, а сдвиг на 80 не давал дойти — маршрут вставал. Точки маршрута не сдвигаются
  if((spreadIdx || spotTaken(b, {x:x, y:y})) && !/^(plantspot|defuse|lineup|pickup|fetch|stopplant|antidefuse|ladder|smokeWait|route)/.test(tag)){
    var la = look ? Math.atan2(look.y-y, look.x-x) : 0, x0 = x, y0 = y;
    [Math.PI/2, -Math.PI/2, Math.PI*0.75, -Math.PI*0.75].some(function(da){
      var nx = x0 + Math.cos(la+da)*(SPOT_PERSONAL+10), ny = y0 + Math.sin(la+da)*(SPOT_PERSONAL+10);
      if(insideSolidWall(nx, ny) || segCrossesManualWalls(x0, y0, nx, ny) || !navAt(nx, ny) || spotTaken(b, {x:nx, y:ny})) return false;
      x = nx; y = ny; return true; });
  }
  b.post = {id:id, x:x, y:y, look:look||null, hold:hold, tag:tag};
  if(psn) b.post.pro = psn.sp;
  b.atPost = false;
  if(b.state === "patrol"){ b.path = []; b.pathIdx = 0; }
  return true;
}
// механика сама сняла свою точку — её задача кончилась (следующая ставится без ожидания)
function clearPost(b){ b._task = null; if(b.post){ b.post = null; b.atPost = false; if(b.state==="patrol"){ b.path = []; b.pathIdx = 0; } } }
function updatePost(b){
  if(!b.post || b.state !== "patrol"){ b.atPost = false; return; }
  var ep = fireSafe(b.post, b);
  if(ep !== b.post && b.atPost && Math.hypot(ep.x-b.baseX, ep.y-b.baseY) > 34){ b.atPost = false; b.path = []; b.pathIdx = 0; }
  var d = Math.hypot(ep.x-b.baseX, ep.y-b.baseY);
  if(b.post.hold){
    // точка планта: "дошёл" — это именно внутри зоны сайта, а не в 34px от точки
    // (иначе носитель останавливался у края зоны, снаружи, и не мог заложить)
    var arrived = b.post.tag === "plantspot" && teamTac.T && SITES[teamTac.T.site] ? (d < 10 || onSite(SITES[teamTac.T.site], b.baseX, b.baseY) && d < 60) :
      b.post.tag === "defuse" ? d < DEFUSE_R - 8 :   // (v359, отметка: m0NESY «дошёл» до бомбы в 34 ед., а дефуз — с 30: стоял 12 с до взрыва)
      d < ((BAL.proSpots && b.post.pro) ? 9 : 34);
    // (опорник "не дошёл") точка поста чуть внутри угла/стены: бот доходил на
    // 30–60px и крутился рядом, не "вставая" на пост. Не приближается ~1.5с — встал
    if(BAL.arriveNear && !b.atPost && !arrived && b.post.tag !== "plantspot" && b.post.tag !== "defuse"){
      if(b._apId !== b.post.id){ b._apId = b.post.id; b._apBest = d; b._apT = tick; }
      else if(d < b._apBest - 6){ b._apBest = d; b._apT = tick; }
      else if(d < 70 && tick - b._apT > 90) arrived = true;
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

