function fireDamageFor(sec){ var n = Math.floor(sec/FIRE_HIT_SEC), d = 0; for(var k=1;k<=n;k++) d += Math.min(FIRE_HIT_MAX, k); return d; }
// (v438) загорелся молотов — у кого оставшийся путь проходит через огонь (точка пути или отрезок ближе радиуса огня), путь строится
// заново (buildWaypointPath обходит огонь, FIRE_DETOUR, 050): раньше путь, построенный до огня, вёл прямо в него
// (v450, док владельца 28.10 №5: «раш через Рампу, а идут через Палас»; м19 р1: CT кинули молотов на T Ramp, путь T0 к Tetris построился
// в обход через Palace Entry и после того, как огонь погас, остался тем же — T0 вернулся на спавн и пошёл через Палас) огонь погас / потушен
// — пути, построенные, пока он горел (обход, v438), строятся заново: обход больше не нужен
var FIRE_GONE_R = 1500;   // (v450) ед. карты: кто мог идти в обход этого огня — проектное число
function fireGoneRepath(fr){
  // (путь, построенный при огне, отметить нельзя: маршрут тактики склеивает свои куски) — пути всех, кто в FIRE_GONE_R от огня
  bots.forEach(function(b){ if(!b.alive || !b.path || !b.path.length || b.planting || b.defusing || Math.hypot(b.baseX-fr.x, b.baseY-fr.y) > FIRE_GONE_R) return;
    b.path = []; b.pathIdx = 0; });
}
function fireRepath(fx, fy){
  var R = NADE.molly.radius + FIRE_BODY;
  bots.forEach(function(b){ if(!b.alive || !b.path || b.pathIdx >= b.path.length || b.planting || b.defusing) return;
    if(Math.hypot(b.baseX-fx, b.baseY-fy) <= R) return;   // уже в огне — выходит своим ходом (540)
    var px = b.baseX, py = b.baseY;
    for(var i = b.pathIdx; i < b.path.length; i++){ var q = b.path[i];
      var dx = q[0]-px, dy = q[1]-py, L2 = dx*dx + dy*dy, t = L2 > 0 ? Math.max(0, Math.min(1, ((fx-px)*dx + (fy-py)*dy)/L2)) : 0;
      if(Math.hypot(px + dx*t - fx, py + dy*t - fy) <= R){ b.path = []; b.pathIdx = 0; return; }
      px = q[0]; py = q[1]; } });
}
function fireCommit(b){
  if(!b) return false;
  if(b.planting || b.defusing) return b.hp > fireDamageFor(((b.planting ? b.plantUntil : b.defuseUntil) - tick)/TICK_HZ) + 10;
  var going = b.path && b.pathIdx < b.path.length;
  if(!going || b.holding || (b.post && inFire(b.post.x, b.post.y))) return false;   // держит угол — не идёт насквозь, а стоит в огне
  // (v438, док владельца 27.10: «боты часто идут в молик»; замер: 224 захода «сам» на 8 матчей) сквозь огонь — только задача, которая
  // не ждёт, пока он прогорит: бомба (плант, дефуз, сбить плант / дефуз, ретейк и сбор под него, убежать от взрыва, поднять бомбу).
  // Остальные ждут у края (fireSafe) или идут в обход (путь, FIRE_DETOUR). Было — любой, у кого хватало HP
  if(!(b.post && /^(plantspot|defuse|antidefuse|stopplant|retake|gather|flee|fetch)/.test(b.post.tag || ""))) return false;
  return b.hp > fireDamageFor(2*NADE.molly.radius/(SPEED*weaponSpeedMul(b))) + FIRE_MARGIN;
}
// (v321) высота шага: без связи в навмеше нельзя подняться выше прыжка (JUMP_UP), и нельзя залезть туда, откуда есть
// только спуск (связь «только спрыгнуть» — окно B Apps на Mirage). Спрыгнуть — можно
var JUMP_UP = 64;   // ед. игры: выше без помощи не запрыгнуть (CS2 ~ 66 с приседом; как JUMP_UP в tools/heights_bake.py)
var NAV_ID = null;
function navArea(id){ if(id == null) return null; if(!NAV_ID || NAV_ID.src !== NAVAREAS){ NAV_ID = {src: NAVAREAS, m: {}}; NAVAREAS.forEach(function(a){ NAV_ID.m[a.id] = a; }); } return NAV_ID.m[id] || null; }
// (v333) участок навмеша под точкой на уровне lvl (±JUMP_UP; в 12 ед. от края — тоже свой пол: щели навмеша, Ladder Room над Underpass)
function navAtLevel(x, y, lvl){
  if(!NAV_GRID) navGridBuild();
  var best = null, bd = Infinity;
  [[0,0],[6,0],[-6,0],[0,6],[0,-6],[12,0],[-12,0],[0,12],[0,-12]].forEach(function(o){ if(best && (o[0] || o[1])) return;
    var L = NAV_GRID[Math.floor((x+o[0])/NAV_GRID_C)+","+Math.floor((y+o[1])/NAV_GRID_C)] || [];
    for(var i=0;i<L.length;i++){ var a = NAVAREAS[L[i]]; if(NAV_BLOCKED[a.id] || Math.abs(a.z - lvl) > JUMP_UP || !pointInPoly(x+o[0], y+o[1], a.points)) continue;
      var d = Math.abs(a.z - lvl); if(d < bd){ bd = d; best = a; } } });
  return best;
}
function navLinked2(a, b){   // связь в сторону движения напрямую или через один участок (мелкие ступени за тик)
  if(navLinked(a, b)) return true;
  var E = zoneGraph[a.id] || [];
  for(var i=0;i<E.length;i++){ var m = navArea(E[i].to); if(m && navLinked(m, b)) return true; }
  return false;
}
function navLinked(a, b){ var E = zoneGraph[a.id] || []; for(var i=0;i<E.length;i++) if(E[i].to === b.id) return true; return false; }
// (v359, владелец: «сделать систему лестниц, чтобы не было проблем с Palace») лестница — отдельный переход: концы лестницы —
// участки .nav (MAP.navmesh.ladders), низ и верх — ближайшая пара участков разной высоты. Путь ведёт на другой этаж через
// лестницу — бот идёт к её концу на своём этаже (точка вставляется в путь), там лезет: позиция и высота плавно меняются за
// время подъёма (LADDER_SPEED ед. игры/с — проектное число, в CS2 по лестнице ~ шагом), без проверок стен и пола, в конце —
// участок другого конца и путь заново. Раньше этаж у лестницы угадывался по полу под ногами (оба этажа рядом) — бота
// перекидывало между этажами и он «трясся»
var CLIMB_FLOOR_TOL = 24;   // ед. игры — проектное число (как допуск пола участка в проверке набора)
var LADDERS = null, LADDER_SPEED = 150, LADDER_NEAR = 40, LADDER_SEEK = 260, LADDER_FAR = 150;
function laddersBuild(){
  LADDERS = [];
  var byId = {}; NAVAREAS.forEach(function(a){ byId[a.id] = a; });
  var cen = function(a){ var x = 0, y = 0; a.points.forEach(function(p){ x += p.x; y += p.y; }); return {x: x/a.points.length, y: y/a.points.length}; };
  ((MAP.navmesh && MAP.navmesh.ladders) || []).forEach(function(l){
    var S = (l.below||[]).concat(l.above||[]).map(function(id){ return byId[id]; }).filter(Boolean); if(S.length < 2) return;
    var zMin = Math.min.apply(null, S.map(function(a){ return a.z; })), zMax = Math.max.apply(null, S.map(function(a){ return a.z; }));
    var lo = S.filter(function(a){ return a.z - zMin < (zMax - zMin)/2; }), hi = S.filter(function(a){ return a.z - zMin >= (zMax - zMin)/2; });
    var best = null, bd = Infinity;
    lo.forEach(function(a){ hi.forEach(function(b){ var ca = cen(a), cb = cen(b), d = Math.hypot(ca.x-cb.x, ca.y-cb.y); if(d < bd){ bd = d; best = {lo:{x:ca.x, y:ca.y, z:a.z, area:a.id}, hi:{x:cb.x, y:cb.y, z:b.z, area:b.id}}; } }); });
    if(best) LADDERS.push(best);
  });
  // (v372) подъёмы из демок: точки низа и верха — где лезли про, время — медиана из демок; только вверх (вниз — спрыгнуть)
  ((MAP.climbs && MAP.climbs.climbs) || []).forEach(function(c){
    if(LADDERS.some(function(L){ return L.up && Math.hypot(L.lo.x-c.lo.x, L.lo.y-c.lo.y) < 15 && Math.hypot(L.hi.x-c.hi.x, L.hi.y-c.hi.y) < 15 && Math.abs(L.hi.z-c.hi.z) < 20; })) return;
    // (v375, отметка владельца: CT0 «застряли, не следуют расстановке» — лез на ящик и падал по кругу) точка верха из демок бывает
    // на краю участка, не внутри: бот «залезал» и тут же падал на пол под ним. Концы подъёма — внутрь своих участков
    var inside = function(e){ var a = byId[e.area]; if(!a || pointInPoly(e.x, e.y, a.points)) return {x:e.x, y:e.y, z:e.z, area:e.area};
      var c = cen(a), d = Math.hypot(c.x-e.x, c.y-e.y), k = d > 1 ? Math.min(1, 12/d) : 0, q = {x:e.x+(c.x-e.x)*k, y:e.y+(c.y-e.y)*k};
      for(var i = 0; i < 6 && !pointInPoly(q.x, q.y, a.points); i++){ k = Math.min(1, k*2); q = {x:e.x+(c.x-e.x)*k, y:e.y+(c.y-e.y)*k}; }
      return {x:q.x, y:q.y, z:e.z, area:e.area}; };
    // (v405, отметка владельца 22.10, Mirage у Palace Entry: «там забор так не перепрыгнуть») верх подъёма, где в 3D-геометрии нет пола
    // на его высоте (± CLIMB_FLOOR_TOL) — узкий верх стены, на котором стоит участок .nav, — не подъём: путь вёл через него на −42
    var hi = inside(c.hi), M3 = m3();
    if(M3 && !m3Floors(M3, hi.x, hi.y).some(function(z){ return Math.abs(z - hi.z) <= CLIMB_FLOOR_TOL; })) return;
    LADDERS.push({lo:inside(c.lo), hi:hi, up:true, sec:c.sec});
  });
}
// лестница, по которой бот с этажа z попадает на этаж zTo: конец на своём этаже в пределах r
function ladderFor(x, y, z, zTo, r){
  if(!LADDERS) laddersBuild();
  var best = null, bd = r;
  LADDERS.forEach(function(L){ (L.up ? [[L.lo, L.hi]] : [[L.lo, L.hi], [L.hi, L.lo]]).forEach(function(e){
    if(Math.abs(e[0].z - z) > JUMP_UP || Math.abs(e[1].z - zTo) > JUMP_UP) return;
    var d = Math.hypot(e[0].x - x, e[0].y - y); if(d < bd){ bd = d; best = {near: e[0], far: e[1], sec: L.sec}; } }); });
  return best;
}
// true — бот в этот тик на лестнице (обычный шаг не делается)
function ladderTick(bot){
  var C = bot._climb;
  if(C){
    if(!bot.alive){ bot._climb = null; return false; }
    var p = Math.min(1, (tick - C.t0)/C.dur);
    bot.baseX = bot.x = C.from.x + (C.to.x - C.from.x)*p; bot.baseY = bot.y = C.from.y + (C.to.y - C.from.y)*p; bot.z = C.from.z + (C.to.z - C.from.z)*p;
    bot.curSpeed = LADDER_SPEED/2.5;
    if(p >= 1){ bot.z = C.to.z; bot._area = C.to.area; bot._climb = null; bot.path = []; bot.pathIdx = 0; }
    return true;
  }
  if(bot.z == null || !bot.path || bot.pathIdx >= bot.path.length) return false;
  var wp = bot.path[bot.pathIdx]; if(!wp || wp[2] == null || Math.abs(wp[2] - bot.z) <= JUMP_UP) return false;
  var L = ladderFor(bot.baseX, bot.baseY, bot.z, wp[2], LADDER_SEEK); if(!L) return false;
  // путь действительно идёт через лестницу: эта точка (или следующая за точкой у лестницы) — у другого конца лестницы. Высота
  // конечной точки пути бывает «не знаю» (0) — по ней одной на лестницу не лезть (бот лез вверх-вниз)
  var nx = bot.path[bot.pathIdx+1], atNear = Math.hypot(wp[0]-L.near.x, wp[1]-L.near.y) < 4;
  var viaFar = Math.hypot(wp[0]-L.far.x, wp[1]-L.far.y) < LADDER_FAR || (atNear && nx && nx[2] != null && Math.abs(nx[2]-L.far.z) <= JUMP_UP && Math.hypot(nx[0]-L.far.x, nx[1]-L.far.y) < LADDER_FAR);
  if(!viaFar) return false;
  var d = Math.hypot(L.near.x - bot.baseX, L.near.y - bot.baseY);
  if(d > LADDER_NEAR){
    // до лестницы — по своему этажу: точка низа/верха лестницы вставляется в путь перед подъёмом (один раз)
    if(!(Math.hypot(wp[0]-L.near.x, wp[1]-L.near.y) < 4 && Math.abs(wp[2]-L.near.z) < 4)) bot.path.splice(bot.pathIdx, 0, [L.near.x, L.near.y, L.near.z]);
    return false;
  }
  var dz = Math.abs(L.far.z - L.near.z);
  bot._climb = {t0: tick, dur: Math.max(8, Math.round((L.sec || dz/LADDER_SPEED)*TICK_HZ)), from: {x: bot.baseX, y: bot.baseY, z: bot.z}, to: L.far};
  if(bot.path[bot.pathIdx] && Math.hypot(bot.path[bot.pathIdx][0]-L.near.x, bot.path[bot.pathIdx][1]-L.near.y) < 4) bot.pathIdx++;
  return ladderTick(bot);
}
// (v336) пол участка — плоскость по высотам углов из .nav (p.z, ед. игры): у лестницы и пандуса участки наклонные, высота
// центров у соседей разная (до 60 ед.), а на общем ребре одна. Раньше по центрам каждая ступень Mirage считалась прыжком
// (звук приземления, враги слышат), а у края наклонного участка уступ мерился неверно. Нет высот углов — пол плоский на a.z
function navPlane(a){
  if(a._pl) return a._pl;
  var P = a.points, n = P.length, sx=0, sy=0, sz=0, ok = true;
  for(var i=0;i<n;i++){ if(P[i].z == null){ ok = false; break; } sx += P[i].x; sy += P[i].y; sz += P[i].z; }
  if(!ok || n < 3) return (a._pl = {a:0, b:0, c:a.z, flat:true});
  var mx = sx/n, my = sy/n, mz = sz/n, xx=0, xy=0, yy=0, xz=0, yz=0;
  for(var k=0;k<n;k++){ var dx = P[k].x-mx, dy = P[k].y-my, dz = P[k].z-mz; xx += dx*dx; xy += dx*dy; yy += dy*dy; xz += dx*dz; yz += dy*dz; }
  var det = xx*yy - xy*xy; if(Math.abs(det) < 1e-6) return (a._pl = {a:0, b:0, c:mz});
  var A = (xz*yy - yz*xy)/det, B = (yz*xx - xz*xy)/det;
  return (a._pl = {a:A, b:B, c:mz - A*mx - B*my});
}
function navFloorZ(a, x, y){ var P = navPlane(a); return P.a*x + P.b*y + P.c; }
// разница высоты пола между участками в точке (x, y): > 18 — уступ (прыжок), ступени и пандус — около 0
function navStepDz(a1, a2, x, y){ return navFloorZ(a2, x, y) - navFloorZ(a1, x, y); }
// (v336) участок навмеша под точкой или в tol ед. карты от неё (любой этаж; заблокированные внутри стен — нет)
var NAV_NEAR_DIRS = [[1,0],[-1,0],[0,1],[0,-1],[0.7,0.7],[-0.7,0.7],[0.7,-0.7],[-0.7,-0.7]];
function navFloorNear(x, y, tol, pred){
  if(!NAV_GRID) navGridBuild();
  for(var r=0; r<=tol; r += Math.max(1, tol/3)){
    var D = r ? NAV_NEAR_DIRS : [[0,0]];
    for(var k=0;k<D.length;k++){ var px = x+D[k][0]*r, py = y+D[k][1]*r;
      var L = NAV_GRID[Math.floor(px/NAV_GRID_C)+","+Math.floor(py/NAV_GRID_C)]; if(!L) continue;
      for(var i=0;i<L.length;i++){ var a = NAVAREAS[L[i]]; if(NAV_BLOCKED[a.id] || (pred && !pred(a)) || !pointInPoly(px, py, a.points)) continue; return a; } }
    if(!tol) break;
  }
  return null;
}
// (v336) шаг с пола навмеша туда, где пола нет. Навмеш — где может стоять игрок (его считает сама игра), а стены радара
// местами с дырами: через них боты заходили в ящики и щели у стен, «застревали в стене», а через 0,5 с navSnap выкидывал
// их на ближайший пол. Теперь с пола уходить нельзя — кроме щели к связанному участку (прыжок на уступ, спрыгнуть:
// между такими участками в .nav Mirage зазор ~20 ед. игры = 8 ед. карты). NAV_STEP_TOL / NAV_GAP_TOL — проектные числа
var NAV_STEP_TOL = 3, NAV_GAP_TOL = 10;
// (v341, отметка владельца: sh1ro и magixx «снова застряли там же») пол «рядом» — только своего уровня (± JUMP_UP от своего
// участка): верх перил (−140) над спуском (−254) засчитывался как пол, и бот сползал с края в щель
function navNearLevel(x, y, tol, lvl){ return navFloorNear(x, y, tol, lvl == null ? null : function(a){ return Math.abs(a.z - lvl) <= JUMP_UP; }); }
// (v381, М67, отметка владельца: Mirage, раунд 9, тик 55140 — donk у B Stairs «не может запрыгнуть, во что-то упирается») срезать путь
// к дальней точке можно, только если по прямой под ногами всё время пол своего уровня (± 40 ед., как lvlOk пути): раньше бот, запрыгнув
// на ступень (106), сразу шёл к точке на верхнем полу (171) по прямой через щель — падал на нижний (150), и так по кругу 5 с
function navSegOnLevel(x0, y0, z0, x1, y1, z1){
  if(z0 == null) return true;
  var L = Math.hypot(x1-x0, y1-y0), n = Math.ceil(L/10);
  for(var i = 1; i <= n; i++){ var t = i/n, zi = z1 == null ? z0 : z0 + (z1-z0)*t;
    if(!navFloorNear(x0 + (x1-x0)*t, y0 + (y1-y0)*t, NAV_STEP_TOL, function(a){ return Math.abs(a.z - zi) <= 40; })) return false; }
  return true;
}
// ближайший по высоте участок в tol от точки (для щели между участками: высота и участок не «замерзают»)
function navNearestZ(x, y, tol, z){
  if(!NAV_GRID) navGridBuild();
  var best = null, bd = Infinity;
  for(var r=0; r<=tol; r += Math.max(1, tol/3)){
    var D = r ? NAV_NEAR_DIRS : [[0,0]];
    for(var k=0;k<D.length;k++){ var px = x+D[k][0]*r, py = y+D[k][1]*r, L = NAV_GRID[Math.floor(px/NAV_GRID_C)+","+Math.floor(py/NAV_GRID_C)]; if(!L) continue;
      for(var i=0;i<L.length;i++){ var a = NAVAREAS[L[i]]; if(NAV_BLOCKED[a.id] || !pointInPoly(px, py, a.points)) continue; var d = z == null ? 0 : Math.abs(a.z - z); if(d < bd){ bd = d; best = a; } } }
    if(best || !tol) break;
  }
  return best;
}
// (Б1, Х1) «бот на полу» — одно место для шага (offNavStep) и для проверки «вне навмеша» (stepTick → navSnap): пол своего уровня в
// NAV_STEP_TOL или щель к связанному участку в NAV_GAP_TOL. Раньше шаг пускал в щель, а проверка считала пол по NAV_STEP_TOL и на
// своей высоте bot.z: бот, идущий по шву между участками, через 0,5 с «вне навмеша — перенесён» со сбросом пути
function navOnFloor(x, y, b, cur){
  var lvl0 = navArea(b._area) ? navArea(b._area).z : b.z;
  if(navNearLevel(x, y, NAV_STEP_TOL, lvl0)) return true;
  cur = cur || navArea(b._area); if(!cur) return false;
  // (v403, отметка владельца 22.10, A Default: «прошёл сквозь укрытия») щель к участку, связанному только обратной связью (с него
  // можно спрыгнуть сюда), — не шаг туда, если он выше ступеньки: с пола в ящик высотой 70 бот «входил» по связи «спрыгнуть с ящика»
  return !!navFloorNear(x, y, NAV_GAP_TOL, function(a){ return a !== cur && (navLinked(cur, a) || (navLinked(a, cur) && a.z <= cur.z + 18)); });
}
// (v403) высота бота — одно место: после любого движения за тик (шаг пути, бой — fightCycleTick, у угла, пик; stepTick зовёт в конце
// цикла бота и после шага пути). Раньше — только после шага пути: в бою бот сходил с ящика и шёл на высоте ящика (отметка владельца
// 22.10, Mirage A Default — «прошёл сквозь два укрытия»), а потом «залезал» на стопку ящиков в +62.
// Пол под точкой — участок навмеша своей высоты (navAt); в щели между участками (navAt нет) — сначала пол на своей высоте или ниже
// (navNearestFall: шагнул с края — падает), выше — только если ниже ничего нет (раньше — ближайший по высоте: стопка +62 «ближе»,
// чем пол −67). Дальше — как было (v323–v353): чужой этаж без связи навмеша — остаётся на своём, прыжок / приземление — звук.
function navNearestFall(x, y, tol, z){
  if(!NAV_GRID) navGridBuild();
  var best = null, bs = -Infinity;
  for(var r=0; r<=tol; r += Math.max(1, tol/3)){
    var D = r ? NAV_NEAR_DIRS : [[0,0]];
    for(var k=0;k<D.length;k++){ var px = x+D[k][0]*r, py = y+D[k][1]*r, L = NAV_GRID[Math.floor(px/NAV_GRID_C)+","+Math.floor(py/NAV_GRID_C)]; if(!L) continue;
      for(var i=0;i<L.length;i++){ var a = NAVAREAS[L[i]]; if(NAV_BLOCKED[a.id] || !pointInPoly(px, py, a.points)) continue;
        // счёт: пол на своей высоте или ниже (до ступеньки 18 выше) — чем выше, тем лучше; выше ступеньки — хуже любого нижнего
        var s = z == null ? 0 : (a.z <= z + 18 ? a.z : -1e6 - (a.z - z)); if(s > bs){ bs = s; best = a; } } }
    if(best || !tol) break;
  }
  return best;
}
function navFollowFloor(bot){
  if(bot._flx === bot.baseX && bot._fly === bot.baseY) return;
  bot._flx = bot.baseX; bot._fly = bot.baseY;
  var naz = navAt(bot.baseX, bot.baseY, bot.z) || navNearestFall(bot.baseX, bot.baseY, NAV_STEP_TOL, bot.z);
  // (v323, М38) в щели своего этажа под точкой бывает только чужой этаж (под Palace — пол Palace): это не подъём —
  // этаж меняется только по связи навмеша (лестница, ступени, спуск), иначе бот остаётся на своём
  var a0z = navArea(bot._area);
  // (v333) пол своего этажа под ногами есть — остаётся на нём (щель в верхнем полу больше не «роняет» вниз — donk под
  // Palace); своего пола нет — падает на нижний (zont1x с B Apps — раньше «висел» на высоте Apps над сайтом, без звука)
  // (v353, отметка владельца: NiKo «застревает под Palace, выкидывает на Palace, трясётся») лестница: путь ведёт на другой конец
  // лестницы (участки связаны лестницей в .nav) — этаж меняется, даже если свой пол под ногами тоже есть (у лестницы оба)
  // (v359) этаж по лестнице меняет только подъём (ladderTick); здесь лестница — как любой пол другого этажа
  if(naz && a0z && naz !== a0z && Math.abs(naz.z - a0z.z) > JUMP_UP){
    var own = navAtLevel(bot.baseX, bot.baseY, a0z.z);
    if(own) naz = own;
    // (v403) своего пола под ногами нет: вверх на чужой этаж — только по связи навмеша; вниз — падает всегда (раньше без связи и
    // без пути вниз оставался «висеть» на высоте ящика / уступа над полом)
    // (v430, М167, владелец: «застревают у #780, прыгают постоянно» — м1 Mirage р5 donk, р12 magixx) связь только из подъёма демок
    // (NAV_CLIMB_UP; Underpath → Under Window, 75 ед.) — не шагом: лезут по ней как по лестнице (ladderTick, конец подъёма ставит участок
    // сам). Раньше бот, идя вдоль края, «залезал» на 75 ед. в любом месте края и падал обратно
    else if(naz.z > a0z.z && (!navLinked2(a0z, naz) || NAV_CLIMB_UP[a0z.id+">"+naz.id])) naz = null;   // без связи навмеша / подъём — остаётся на своём этаже
  }
  if(naz){ var dzz = naz.z - (bot.z == null ? naz.z : bot.z);
    // (v336, владелец: «прыгают на рандом, где не нужно, и палятся») прыжок и приземление — по полу у края (navStepDz),
    // а не по центрам участков: ступени и пандусы Mirage (Stairs, Palace, рампы) больше не «прыжок» со звуком
    var djz = (a0z && naz !== a0z) ? navStepDz(a0z, naz, bot.baseX, bot.baseY) : (naz === a0z ? 0 : dzz);
    if(djz > 18) bot._jump = {t:tick, up:true}; else if(djz < -40) bot._jump = {t:tick, up:false};
    // (v322, М29) прыжок / приземление слышно и при тихом шаге, далеко (csdb.gg: «громкий звук приземления, слышно
    // издалека», без числа) — радиус как у бега: проектное число
    // (v335, владелец: «звук прыжка в одном месте, а он в другом; приземление должно его перебивать») звучит только
    // приземление — там, где игрок приземлился: спрыгнул вниз — сразу; запрыгнул вверх — через LAND_DELAY с (полёт)
    if(roundState === "live" && djz < -40) landSound(bot);
    else if(roundState === "live" && djz > 18) bot._landAt = tick + Math.round(LAND_DELAY*TICK_HZ);
    // (v333) сменил этаж (спуск, лестница) — путь, построенный с прежнего этажа, пересчитывается с нового
    if(Math.abs(dzz) > JUMP_UP && bot.path && bot.pathIdx < bot.path.length){ bot.path = []; bot.pathIdx = 0; }
    bot.z = naz.z; bot._area = naz.id; }
}
// (v403) как далеко от пола своего уровня (± JUMP_UP) точка: 0 — на полу, дальше NAV_OFF_R — NAV_OFF_R+1 (шаг 2 ед. карты)
var NAV_OFF_R = 24;   // проектное число: дальше бот вне пола не бывает (перенос navSnap — через 0,5 с)
function navFloorDist(x, y, lvl){ for(var r = 0; r <= NAV_OFF_R; r += 2) if(navNearLevel(x, y, r, lvl)) return r; return NAV_OFF_R + 1; }
// шаг идёт к следующей точке пути (угол меньше ~25°) — задуманный путём переход (спуск, щель к связанному участку)
function navStepAlongPath(x1, y1, x2, y2, b){
  var wp = b.path && b.path[b.pathIdx]; if(!wp) return false;
  var dx = wp[0]-x1, dy = wp[1]-y1, sx = x2-x1, sy = y2-y1, L = Math.hypot(dx, dy)*Math.hypot(sx, sy);
  return L > 0 && (dx*sx + dy*sy)/L > 0.9;
}
function offNavStep(x1, y1, x2, y2, b){
  var lvl0 = navArea(b._area) ? navArea(b._area).z : b.z;
  if(navNearLevel(x2, y2, NAV_STEP_TOL, lvl0)) return false;
  // уже вне пола — пусть возвращается; (v403, отметка владельца 22.10, A Default: бот, ступивший в щель у ящика, дальше уходил внутрь
  // ящика — любой шаг вне пола пропускался) — но не дальше от пола своего уровня, чем был
  // (v405) шаг по пути к следующей точке (спрыгнуть с края стенки на рампу — отметка владельца 22.10, T Ramp: T вставали на краю) — можно
  var a1 = navNearLevel(x1, y1, NAV_STEP_TOL, lvl0); if(!a1) return !navStepAlongPath(x1, y1, x2, y2, b) && navFloorDist(x2, y2, lvl0) > navFloorDist(x1, y1, lvl0);
  var cur = navArea(b._area) || a1;
  if(navOnFloor(x2, y2, b, cur)) return false;
  // (v341, отметка владельца: sh1ro и magixx «снова застряли там же» — спуск со спавна T, −166 → −258) щель спрыгивания бывает
  // шире NAV_GAP_TOL: шаг по пути прямо к следующей точке, под которой пол связанного участка, — это задуманный переход
  var wp = b.path && b.path[b.pathIdx];
  if(wp){ var dx = wp[0]-x1, dy = wp[1]-y1, sx = x2-x1, sy = y2-y1, L = Math.hypot(dx, dy)*Math.hypot(sx, sy);
    if(L > 0 && (dx*sx + dy*sy)/L > 0.9){ var aw = navFloorNear(wp[0], wp[1], NAV_STEP_TOL, function(a){ return a !== cur && navLinked2(cur, a); });
      if(aw) return false; } }
  return true;
}
function heightBlocked(x1, y1, x2, y2, b){
  if(!b || b.z == null) return false;
  // (v323, М38) стоит в щели между участками навмеша — берётся участок, где был (bot._area); раньше щель пропускала проверку,
  // и бот «залезал» на этаж выше без лестницы (102 раза за 6 раундов Mirage, отметка владельца: из-под Palace на Palace)
  var a1 = navAt(x1, y1, b.z) || navArea(b._area); if(!a1) return false;
  // (v333, владелец: «через Ladder Room спускаются в Underpass», «застрял в Palace», стрельба сквозь стену нижнего этажа) у
  // этажа под другим этажом своих стен на радаре нет (стены — по всем этажам сразу): шаг туда, где своего пола нет, а ниже
  // есть чужой, — со стены вниз; можно только по связи навмеша (спуск, лестница), иначе это стена своего этажа
  if(!navAtLevel(x2, y2, a1.z)){ var lo = navAt(x2, y2, a1.z - 400);
    // спуск, который задуман путём (следующая точка пути ниже — путь строится по связям навмеша), — можно (Catwalk → Mid)
    var wpz2 = b.path && b.path[b.pathIdx] ? b.path[b.pathIdx][2] : null, planned = wpz2 != null && wpz2 < a1.z - JUMP_UP;
    if(lo && lo.z < a1.z - JUMP_UP && !planned && !navLinked2(a1, lo)) return true; }
  // (v336) высота уступа — по полу у края (navStepDz), а не по центрам участков: у наклонного участка центр ниже края
  var a2 = navAt(x2, y2, b.z); if(!a2 || a2 === a1) return false;
  var up = navStepDz(a1, a2, x2, y2); if(up <= 18) return false;   // 18 — ступенька, шагом
  if(navLinked(a1, a2)) return false;
  return up > JUMP_UP || navLinked(a2, a1);
}
var HGT_TOP = null, HGT_BOT = null;
function hgtLevelOf(id){   // 1 — пол над другим полом, -1 — под другим полом (heights.over), 0 — обычный
  if(!HGT_TOP){ HGT_TOP = {}; HGT_BOT = {}; (HEIGHTS.over || []).forEach(function(o){ HGT_TOP[o.top] = 1; HGT_BOT[o.bottom] = 1; }); }
  return HGT_BOT[id] ? -1 : HGT_TOP[id] ? 1 : 0;
}
// (v373, сторож: «застой» — 20 раз за раунд на Ancient; бот с путём упирается в уступ, и новый путь — тот же) путь строится по
// связям навмеша, а шаг проверяет высоту уступа (heightBlocked) — если они расходятся, бот стоит до конца раунда. Самоисправление:
// связь, по которой шаг не пускает (уступ выше прыжка без связи «вверх»), убирается из графа для всех, путь — заново (кэш путей
// сбрасывается). Одна связь — один раз за матч, в консоль
var NAV_UNLINKED = [];
function navUnlinkBlocked(bot, pw){
  if(bot.z == null || !pw) return;
  var a1 = navAt(bot.baseX, bot.baseY, bot.z) || navArea(bot._area); if(!a1) return;
  var d = Math.hypot(pw[0]-bot.baseX, pw[1]-bot.baseY); if(d < 1) return;
  var px = bot.baseX + (pw[0]-bot.baseX)/d*6, py = bot.baseY + (pw[1]-bot.baseY)/d*6;
  if(!heightBlocked(bot.baseX, bot.baseY, px, py, bot)) return;
  var E = zoneGraph[a1.id] || [], best = -1, bd = Infinity;
  E.forEach(function(e, i){ var to = navArea(e.to); if(!to) return; var dd = pointInPoly(px, py, to.points) ? 0 : Math.hypot(e.mid.x-px, e.mid.y-py); if(dd < bd){ bd = dd; best = i; } });
  if(best < 0 || bd > 40) return;
  var e = E[best]; E.splice(best, 1); NAV_UNLINKED.push([a1.id, e.to]);
  PATHQ = {}; PATHQ_N = 0;
  logEvent("навмеш: связь "+a1.id+" → "+e.to+" непроходима (уступ) — убрана, путь заново (самоисправление)");
}
function stepBlocked(x1,y1,x2,y2,b){
  if(crossesWall(x1,y1,x2,y2)) return true;
  if(heightBlocked(x1, y1, x2, y2, b)) return true;
  if(b && b.baseX != null && offNavStep(x1, y1, x2, y2, b)) return true;   // (v336) с пола навмеша — в стену/ящик нельзя
  if(!inFire(x1,y1) && inFire(x2,y2)) return !fireCommit(b);
  return false;
}
// точка поста в огне → ждём у края огня (с той же стороны), а не лезем внутрь
function fireSafe(p, b){
  if(b && fireCommit(b)) return p; // идёт по делу — через огонь
  var f = inFire(p.x, p.y); if(!f) return p;
  var a = Math.atan2(p.y-f.y, p.x-f.x); if(!isFinite(a)) a = 0;
  var r = NADE.molly.radius + 26;
  var q = {x:f.x + Math.cos(a)*r, y:f.y + Math.sin(a)*r};
  if(insideSolidWall(q.x, q.y) || segCrossesManualWalls(f.x, f.y, q.x, q.y)){ q = {x:f.x - Math.cos(a)*r, y:f.y - Math.sin(a)*r}; }
  return q;
}
// (v323, М36) где жжёт — ровно нарисованный огонь: разгорается за 14 тиков от 0,35 радиуса, не проходит сквозь стены; игрок
// горит, если касается краем (полуширина игрока 16 ед. игры = 6,4 ед. карты)
var FIRE_BODY = 6.4;
function fireRadiusNow(f){ return NADE.molly.radius*Math.min(1, 0.35 + (tick - f.born)/14); }
function fireTouches(f, x, y){ return areaHas(f, fireRadiusNow(f) + FIRE_BODY, x, y); }
function inFire(x, y){
  for(var i=0;i<fires.length;i++){ if(fireTouches(fires[i], x, y)) return fires[i]; }
  return null;
}

