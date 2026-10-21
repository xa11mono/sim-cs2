// ======================= v241: КТО КОГО ВИДИТ — ОДНО МЕСТО (из переделки, 10_vision.js) =======================
// Всё, что в игре решает «видно / не видно», идёт сюда: бой (resolveEngagements),
// флешка, HE, звук (слышно через стену или открыто), счётчик контактов на табло,
// таблица простреливаемости зон, проверка владельца «кто кого видит».
// Видимость — в 3D (x, y — радар, z — высота в единицах игры):
//  • высокие стены (стена без измеренного верха) — закрывают всегда (точно по отрезкам);
//  • укрытия (cover.json + правки владельца, covList) — верх укрытия абсолютной высотой z:
//    линия взгляда над этим местом ниже верха — закрыто. Так пол со стороны смотрящего
//    учитывается сам: ящик у Plat снизу выше головы, с Plat — низкий;
//  • пол и уступы (навмеш): линия ниже пола (край уступа, ступени, перепад) — закрыто;
//  • крыши («крыто сверху», heights.json + правки): над крытым полом потолок на
//    VIS_CEIL_H выше пола — линия выше потолка (сквозь крышу) закрыта;
//  • дым — круг на радаре, как раньше (по высоте не считается), ван-вей — с краю дыма.
// Высоты тела — CS2: стоя рост 72, глаза 64, голова 64–72, тело ~20–60; присев рост 54,
// глаза 46, голова 46–54. У цели проверяется голова и тело (несколько точек): ответ —
// что видно: {head, body}. Стрельба целится только в видимую часть (15_combat.js).
// Укрытия, пол и потолки разложены в сетку высот VIS (клетка VIS_CELL px радара) —
// строится один раз и после правки карты (стены, высоты, укрытия — visInvalidate()).
// В снимок игры сетка не попадает (src/build.py, список STATIC).
// (А5, 20.10.2026) У карты есть 3D-геометрия игры (MAP.map3d, 035_map3d.js) — всё выше заменяет она: линия взгляда —
// луч по геометрии столкновений (стены, ящики, перила, крыши, этажи — как в игре, без невидимых стен для игроков), пол под
// точкой — этаж геометрии на высоте бота (visFloorAt с z). Стены радара, укрытия, высоты и крыши набора видимость тогда не
// читает (они остаются для рисования и редактора). Сетка VIS — только у карт без геометрии (Ancient до А6).

var VIS_EYE = {stand: 64, crouch: 46};                 // глаза над полом, ед. игры
var VIS_HEAD = {stand: 68, crouch: 50};                // точка головы (голова 64–72 / 46–54)
var VIS_BODY = {stand: [52, 32], crouch: [38, 22]};    // точки тела: грудь, живот/бёдра
var VIS_CEIL_H = 130;  // проектное число переделки: потолок над «крытым» полом, ед. игры (≈ 1,8 роста: тоннели, Cave, Donut);
                       // точной высоты потолков в данных нет — взято разумное число
var VIS_CELL = 2;      // клетка сетки высот, px радара (= 5 ед. игры)
var VIS_FLOOR_EPS = 6; // допуск пола, ед. игры (неровность навмеша: участок — одна высота); к верху укрытий не применяется
// (М140, В6, ENGINE_AUDIT 20.10) два этажа в одной клетке (балкон Shadow, Underpass под мидом): сетка помнит и нижний пол;
// линия ниже верхнего пола, но над нижним, — по нижнему этажу (стены нижнего этажа — levelBlocked)
var VIS_STACK = 100;   // ед. игры: этажи — если полы в клетке расходятся больше (как в levelBlocked)
var VIS_SLAB = 12;     // проектное число: толщина перекрытия под верхним полом, ед. игры (данных о толщине нет)
var VIS = {walls: null, nav: null, gen: -1, W: 0, floor: null, solid: null, ceil: null, lo: null,
           segs: [], grid: null, G: 64, GN: 0, stamp: null, sn: 0};
var VIS_GEN = 0;
var VIS_DANGER_TIMER = null;
// карта поменялась (стены, высоты, укрытия): сетка видимости — заново, таблица «откуда простреливается» — следом
function visInvalidate(){
  VIS_GEN++;
  if(typeof zonesById === "undefined" || !zonesById) return;
  if(VIS_DANGER_TIMER) clearTimeout(VIS_DANGER_TIMER);
  VIS_DANGER_TIMER = setTimeout(function(){ VIS_DANGER_TIMER = null; computeZoneDanger(); if(typeof HOLD_CANDS !== "undefined") HOLD_CANDS = {}; }, 300);
}

// ---------- верх укрытия (абсолютная z) ----------
// автоматическое: z верха по навмешу (не измерено — бесконечность, «выше головы»);
// правка владельца числом h — пол рядом + h; категорией — пол рядом + типичная высота
function visCoverTop(c, floorNear){
  if(!c.own) return (c.top === null || c.top === undefined) ? Infinity : c.top;
  var fl = (c.floor !== null && c.floor !== undefined) ? c.floor : floorNear;
  if(c.h !== null && c.h !== undefined) return fl + c.h;
  return c.cat === "chest" ? fl + 60 : (c.cat === "low" ? fl + 36 : Infinity);
}

// ---------- сборка сетки ----------
function visBuild(){
  var C = VIS_CELL, W = Math.ceil(2048 / C), N = W*W;
  var floor = new Float32Array(N).fill(-Infinity), ceil = new Float32Array(N).fill(Infinity), lo = new Float32Array(N).fill(Infinity);
  function cellsOfPoly(pts, fn){   // pts: [{x,y}] — клетки, центр которых внутри
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach(function(p){ if(p.x < x0) x0 = p.x; if(p.y < y0) y0 = p.y; if(p.x > x1) x1 = p.x; if(p.y > y1) y1 = p.y; });
    var i0 = Math.max(0, Math.floor(x0/C)), i1 = Math.min(W-1, Math.floor(x1/C)), j0 = Math.max(0, Math.floor(y0/C)), j1 = Math.min(W-1, Math.floor(y1/C));
    for(var j = j0; j <= j1; j++) for(var i = i0; i <= i1; i++)
      if(pointInPoly((i+0.5)*C, (j+0.5)*C, pts)) fn(j*W + i);
  }
  // пол — навмеш; потолок — над крытыми участками
  NAVAREAS.forEach(function(a){
    var h = typeof hgtInfo === "function" ? hgtInfo(a.id) : null, z = a.z, cv = h && h.cov;
    // (v321) есть крыши многоугольниками (heights.roofs) — крытость участка берётся только из правки владельца
    if(cv && HEIGHTS.roofs && !(HGT_OWN[a.id] && HGT_OWN[a.id].cov !== undefined)) cv = false;
    cellsOfPoly(a.points, function(k){ if(z > floor[k]) floor[k] = z; if(z < lo[k]) lo[k] = z; if(cv) ceil[k] = Math.min(ceil[k], z + VIS_CEIL_H); });
  });
  // нижний этаж: только где полы в клетке расходятся больше VIS_STACK (иначе — один пол: ступени, неровность)
  for(var k0 = 0; k0 < N; k0++) if(!(floor[k0] - lo[k0] > VIS_STACK)) lo[k0] = -Infinity;
  // (v321) крыши — многоугольники штриховки радара (точнее, чем «крыт ли участок навмеша целиком»)
  (HEIGHTS.roofs || []).forEach(function(R){
    cellsOfPoly(R.map(function(p){ return {x:p[0], y:p[1]}; }), function(k){ if(floor[k] > -Infinity) ceil[k] = Math.min(ceil[k], floor[k] + VIS_CEIL_H); });
  });
  // щели между участками навмеша (навмеш отступает от краёв) — заполнить соседним полом
  // (берётся более высокий: край уступа — у верхнего пола)
  for(var pass = 0; pass < 3; pass++){
    var f2 = floor.slice(), c2 = ceil.slice(), l2 = lo.slice();
    for(var j = 1; j < W-1; j++) for(var i = 1; i < W-1; i++){
      var k = j*W + i, nb = [k-1, k+1, k-W, k+W];
      // щель нижнего навмеша под верхним полом — тоже нижний этаж (соседний нижний пол, если верхний пол тот же)
      if(lo[k] === -Infinity && floor[k] !== -Infinity) for(var q2 = 0; q2 < 4; q2++){ var n2 = nb[q2]; if(lo[n2] !== -Infinity && Math.abs(floor[n2] - floor[k]) < VIS_FLOOR_EPS && lo[n2] > l2[k]){ l2[k] = lo[n2]; } }
      if(floor[k] !== -Infinity) continue;
      var best = -Infinity, bc = Infinity;
      for(var q = 0; q < 4; q++){ var v = floor[nb[q]]; if(v > best){ best = v; bc = ceil[nb[q]]; } }
      if(best !== -Infinity){ f2[k] = best; c2[k] = bc; }
    }
    floor = f2; ceil = c2; lo = l2;
  }
  var solid = floor.slice();
  function floorNear(pts){   // самый низкий пол вокруг укрытия
    var lo = Infinity;
    pts.forEach(function(p){ for(var a = 0; a < 8; a++){
      var x = p.x + Math.cos(a*Math.PI/4)*14, y = p.y + Math.sin(a*Math.PI/4)*14;
      var k = Math.floor(y/C)*W + Math.floor(x/C); if(k >= 0 && k < N && floor[k] > -Infinity && floor[k] < lo) lo = floor[k]; } });
    return lo === Infinity ? 0 : lo;
  }
  // укрытия: по стенам — у каждой стены свой верх и куски (ступени) со своим верхом
  var L = typeof covList === "function" ? covList() : [];
  var perWall = WALL_POLYS.map(function(){ return {top: undefined, pieces: []}; }), free = [];
  L.forEach(function(c){
    var pts = c.poly.map(function(q){ return {x: q[0], y: q[1]}; });
    var top = visCoverTop(c, floorNear(pts)), wi = WALL_POLYS.indexOf(c.poly);
    if(wi >= 0){ perWall[wi].top = top; return; }
    var host = -1, ha = Infinity;
    WALL_POLYS.forEach(function(p, i){ if(pointInPoly(c.pt[0], c.pt[1], WALL_SOLID_POLYS[i])){ var a = covPolyArea(p); if(a < ha){ ha = a; host = i; } } });
    var pc = {pts: pts, top: top, cx: c.pt[0], cy: c.pt[1]};
    if(host >= 0) perWall[host].pieces.push(pc); else free.push(pc);
  });
  var segs = [];
  WALL_POLYS.forEach(function(poly, wi){
    var P = perWall[wi], fin = (P.top !== undefined && P.top < Infinity) || P.pieces.some(function(p){ return p.top < Infinity; });
    if(!fin){   // высокая стена — точно по отрезкам
      for(var i = 0; i < poly.length; i++){ var a = poly[i], b = poly[(i+1) % poly.length]; segs.push([a[0], a[1], b[0], b[1]]); }
      return;
    }
    // стена с измеренным верхом — в сетку: клетка куска — его верх, остальное — верх
    // стены, а если его нет — верх ближайшего куска (щели между ступенями ящика)
    cellsOfPoly(WALL_SOLID_POLYS[wi], function(k){
      var x = (k % W + 0.5)*C, y = (Math.floor(k / W) + 0.5)*C, top;
      for(var q = 0; q < P.pieces.length; q++) if(pointInPoly(x, y, P.pieces[q].pts)){ top = P.pieces[q].top; break; }
      if(top === undefined){
        if(P.top !== undefined) top = P.top;
        else { var bd = Infinity; P.pieces.forEach(function(p){ var d = Math.hypot(p.cx - x, p.cy - y); if(d < bd){ bd = d; top = p.top; } }); }
      }
      solid[k] = top + VIS_FLOOR_EPS;   // + допуск: visMarch вычитает его (он — для неровного пола, не для укрытий)
    });
  });
  free.forEach(function(p){ cellsOfPoly(p.pts, function(k){ if(p.top + VIS_FLOOR_EPS > solid[k]) solid[k] = p.top + VIS_FLOOR_EPS; }); });
  // отрезки высоких стен — в крупную сетку (G px), чтобы линия проверяла только стены рядом
  var G = VIS.G, GN = Math.ceil(2048 / G), grid = [];
  for(var g = 0; g < GN*GN; g++) grid.push([]);
  segs.forEach(function(s, si){
    var gi0 = Math.max(0, Math.floor(Math.min(s[0], s[2])/G)), gi1 = Math.min(GN-1, Math.floor(Math.max(s[0], s[2])/G));
    var gj0 = Math.max(0, Math.floor(Math.min(s[1], s[3])/G)), gj1 = Math.min(GN-1, Math.floor(Math.max(s[1], s[3])/G));
    for(var gj = gj0; gj <= gj1; gj++) for(var gi = gi0; gi <= gi1; gi++) grid[gj*GN + gi].push(si);
  });
  VIS.W = W; VIS.floor = floor; VIS.solid = solid; VIS.ceil = ceil; VIS.lo = lo;
  VIS.segs = segs; VIS.grid = grid; VIS.GN = GN; VIS.stamp = new Uint32Array(segs.length); VIS.sn = 0;
  VIS.walls = WALLS_SIG; VIS.nav = NAVAREAS; VIS.gen = VIS_GEN;
}
function visReady(){ if(m3()) return; if(VIS.walls !== WALLS_SIG || VIS.nav !== NAVAREAS || VIS.gen !== VIS_GEN) visBuild(); }

// ---------- пол под точкой ----------
// z — высота того, кто стоит (если известна): под балконом — нижний пол, если он ближе к z (М140, Н2)
// (А5) по геометрии: этажи клетки — пол, на котором стоит тот, у кого высота z (самый высокий не выше z + 18; ниже всех — нижний);
// без z — верхний этаж, куда можно дойти пешком. Клетка без этажа (край стены) — ближайшая с этажом в 2 клетках
function visFloorAt(x, y, z){
  var M = m3();
  if(M){
    var c = m3Cell(M, x, y), F = M.floors;
    if(c >= 0 && F.st[c+1] === F.st[c]){
      for(var r = 1, cc = -1; r <= 2 && cc < 0; r++) for(var dj = -r; dj <= r && cc < 0; dj++) for(var di = -r; di <= r; di++){
        var c2 = m3Cell(M, x + di*M.cell, y + dj*M.cell); if(c2 >= 0 && F.st[c2+1] > F.st[c2]){ cc = c2; break; } }
      c = cc;
    }
    if(c < 0) return z != null ? z : 0;
    var best = null, top = null, topW = null;
    for(var q = F.st[c]; q < F.st[c+1]; q++){ var fz = F.z[q];
      top = fz; if(F.kind[q] === 1) topW = fz;
      if(z != null && fz <= z + 18) best = fz; }
    if(z != null) return best !== null ? best : F.z[F.st[c]];
    return topW !== null ? topW : top;
  }
  visReady();
  var i = Math.floor(x / VIS_CELL), j = Math.floor(y / VIS_CELL);
  if(i < 0 || j < 0 || i >= VIS.W || j >= VIS.W) return 0;
  var k = j*VIS.W + i, f = VIS.floor[k], l = VIS.lo[k];
  if(f === -Infinity) return 0;
  if(z != null && l !== -Infinity && Math.abs(z - l) < Math.abs(z - f)) return l;
  return f;
}

// ---------- высокие стены на линии (2D, точно) ----------
// (А5) по геометрии отдельных «высоких стен» нет — всё делает луч (visMarch)
function visWallHit(ax, ay, bx, by){
  if(m3()) return false;
  var G = VIS.G, GN = VIS.GN, grid = VIS.grid, segs = VIS.segs, st = VIS.stamp;
  var sn = ++VIS.sn; if(sn > 4e9){ st.fill(0); VIS.sn = sn = 1; }
  var gi = Math.min(GN-1, Math.max(0, Math.floor(ax/G))), gj = Math.min(GN-1, Math.max(0, Math.floor(ay/G)));
  var ei = Math.min(GN-1, Math.max(0, Math.floor(bx/G))), ej = Math.min(GN-1, Math.max(0, Math.floor(by/G)));
  var dx = bx - ax, dy = by - ay;
  var sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  var tdx = dx !== 0 ? Math.abs(G/dx) : Infinity, tdy = dy !== 0 ? Math.abs(G/dy) : Infinity;
  var tmx = dx !== 0 ? ((dx > 0 ? (gi+1)*G - ax : ax - gi*G) / Math.abs(dx)) : Infinity;
  var tmy = dy !== 0 ? ((dy > 0 ? (gj+1)*G - ay : ay - gj*G) / Math.abs(dy)) : Infinity;
  for(var guard = 0; guard < 4*GN; guard++){
    var cell = grid[gj*GN + gi];
    for(var q = 0; q < cell.length; q++){
      var si = cell[q]; if(st[si] === sn) continue; st[si] = sn;
      var s = segs[si];
      if(segIntersect(ax, ay, bx, by, s[0], s[1], s[2], s[3])) return true;
    }
    if(gi === ei && gj === ej) break;
    if(tmx < tmy){ tmx += tdx; gi += sx; } else { tmy += tdy; gj += sy; }
    if(gi < 0 || gj < 0 || gi >= GN || gj >= GN) break;
  }
  return false;
}
// ---------- сетка высот на линии: пол/уступы/укрытия снизу, потолок сверху ----------
// (А5) по геометрии — луч m3Line (стены, ящики, полы и потолки сразу)
function visMarch(ax, ay, az, bx, by, bz){
  var M3g = m3(); if(M3g) return m3Line(M3g, ax, ay, az, bx, by, bz, "sight");
  var dx = bx - ax, dy = by - ay, dz = bz - az, n = Math.ceil(Math.hypot(dx, dy) / VIS_CELL);
  if(n < 2) return true;
  var W = VIS.W, S = VIS.solid, Cl = VIS.ceil, Lo = VIS.lo, F = VIS.floor, inv = 1/VIS_CELL, e = VIS_FLOOR_EPS;
  for(var i = 1; i < n; i++){
    var t = i/n, x = (ax + dx*t)*inv, y = (ay + dy*t)*inv;
    if(x < 0 || y < 0 || x >= W || y >= W) continue;
    var k = (y|0)*W + (x|0), z = az + dz*t;
    if(z > Cl[k]) return false;
    // ниже верхнего пола/укрытия: закрыто, если только линия не идёт по нижнему этажу (над его полом, под перекрытием)
    if(z < S[k] - e && !(Lo[k] !== -Infinity && z >= Lo[k] - e && z <= F[k] - VIS_SLAB)) return false;
  }
  return true;
}
// ======================= ОДНА ФУНКЦИЯ: видит ли глаз A точку B =======================
// visLine(ax,ay,az, bx,by,bz, smoke) — true, если линия от A до B свободна:
// высокие стены, укрытия, пол/уступы, потолки; smoke — дым тоже закрывает.
function visLine(ax, ay, az, bx, by, bz, smoke){
  visReady();
  if(visWallHit(ax, ay, bx, by)) return false;
  if(!visMarch(ax, ay, az, bx, by, bz)) return false;
  return !(smoke && smokeBlocks(ax, ay, bx, by));
}
// что у цели t видно из глаз v: {head, body} (стойка — по умолчанию текущая у ботов;
// vC/tC — «присел» для проверки «а если присесть»). Только геометрия, без дыма;
// walls: false — высокие стены уже проверены вызывающим
// (v334, М57, отметка владельца: TeSeS под Palace и TN1R стрелялись сквозь стену нижнего этажа) у нижнего этажа (под другим
// полом) своих стен на радаре нет — стены общие на все этажи. Линия между двумя игроками на высоте az → bz: где она проходит
// ПОД чужим полом (над ней пол выше на 100+ ед.), там должен быть свой пол на её высоте (navAtLevel), иначе это стена этого
// этажа. Под открытым небом (балкон → двор) не проверяется. Шаг 4 ед. карты
function levelBlocked(ax, ay, az, bx, by, bz){
  if(az == null || bz == null || m3()) return false;   // (А5) у геометрии у каждого этажа свои стены и перекрытия
  if(!NAV_GRID) navGridBuild();
  var L = Math.hypot(bx-ax, by-ay), n = Math.max(1, Math.ceil(L/4));
  var ST = NAV_GRID.__stack || (NAV_GRID.__stack = (function(){ var m = {};   // клетки сетки, где есть пол над полом (быстрый отсев)
    for(var key in NAV_GRID){ if(key === "__stack") continue; var lo = Infinity, hi = -Infinity; NAV_GRID[key].forEach(function(ix){ var zz = NAVAREAS[ix].z; if(zz < lo) lo = zz; if(zz > hi) hi = zz; }); if(hi - lo > 100) m[key] = 1; }
    return m; })());
  for(var i=1;i<n;i++){
    var t = i/n, x = ax + (bx-ax)*t, y = ay + (by-ay)*t, z = az + (bz-az)*t, gk = Math.floor(x/NAV_GRID_C)+","+Math.floor(y/NAV_GRID_C);
    if(!ST[gk]) continue;
    var G = NAV_GRID[gk] || [], above = false;
    for(var k=0;k<G.length;k++){ var a = NAVAREAS[G[k]]; if(a.z > z + 100 && pointInPoly(x, y, a.points)){ above = true; break; } }
    if(above && !navAtLevel(x, y, z)) return true;
  }
  return false;
}
// (М140, В4, ENGINE_AUDIT 20.10) тело цели — не одна ось: как в CS2 (видно, если видна любая часть хитбокса), у груди
// проверяются и плечи — ±VIS_SHOULDER поперёк линии взгляда. Глаза — в центре смотрящего (так в игре). Раньше — только
// «центр → центр»: игрок, у которого из-за угла уже видно плечо, был невидим (29 % / 28 % «не видно» в убийствах про)
var VIS_SHOULDER = 14; // ед. игры: полуширина плеч хитбокса CS2 (корпус игрока 32 ед. = ±16; плечо — 14, как в разборе ENGINE_AUDIT)
// (Б3, З9) vLift / tLift — глаза смотрящего / тело цели выше пола на столько ед. игры (прыжок: JUMP_APEX); без них — 0
function visParts(vx, vy, vC, tx, ty, tC, walls, vz, tz, vLift, tLift){
  var no = {head: false, body: false};
  visReady();
  // высокие стены (2D, дёшево — первыми): центр цели и плечи; закрыто всё — не видно
  var L = Math.hypot(tx - vx, ty - vy) || 1, s = VIS_SHOULDER / MAP.pxUnits, px = -(ty - vy) / L * s, py = (tx - vx) / L * s;
  var chk = walls !== false;
  var cw = !chk || !visWallHit(vx, vy, tx, ty), lw = !chk || !visWallHit(vx, vy, tx - px, ty - py), rw = !chk || !visWallHit(vx, vy, tx + px, ty + py);
  if(!cw && !lw && !rw) return no;
  if(levelBlocked(vx, vy, vz, tx, ty, tz)) return no;
  // (v353, отметка владельца: NiKo «видит врага сквозь укрытие и убивает» — стоял на −164 под балконом Palace, а глаза брались с
  // карты высот радара −34: она знает только верхний пол) пол — тот этаж, на котором бот (visFloorAt с его высотой)
  var fv = visFloorAt(vx, vy, vz), ft = visFloorAt(tx, ty, tz);
  if(vz != null && Math.abs(fv - vz) > JUMP_UP) fv = vz;
  if(tz != null && Math.abs(ft - tz) > JUMP_UP) ft = tz;
  var ez = fv + (vC ? VIS_EYE.crouch : VIS_EYE.stand) + (vLift || 0), tf = ft + (tLift || 0), B = tC ? VIS_BODY.crouch : VIS_BODY.stand;
  var head = cw && visMarch(vx, vy, ez, tx, ty, tf + (tC ? VIS_HEAD.crouch : VIS_HEAD.stand)), body = false;
  for(var i = 0; i < B.length && !body; i++) body = cw && visMarch(vx, vy, ez, tx, ty, tf + B[i]);
  // плечи (на высоте груди): край тела может выглядывать из-за угла или ящика, когда центр закрыт
  // (М149) side — какое плечо видно, когда центр закрыт (−1 / +1; 0 — видно голову или середину): пуля летит в него (tryShoot)
  var side = 0;
  if(!body && lw && visMarch(vx, vy, ez, tx - px, ty - py, tf + B[0])){ body = true; side = head ? 0 : -1; }
  if(!body && rw && visMarch(vx, vy, ez, tx + px, ty + py, tf + B[0])){ body = true; side = head ? 0 : 1; }
  return {head: head, body: body, side: side};
}
function visPartsText(p){ return !p ? "нет" : (p.body ? (p.head ? "голова и тело" : "тело") : (p.head ? "голова" : "нет")); }

function zoneCentroid(z){
  var cx=0,cy=0; z.points.forEach(function(p){cx+=p.x;cy+=p.y;}); return {x:cx/z.points.length, y:cy/z.points.length};
}

