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

var VIS_EYE = {stand: 64, crouch: 46};                 // глаза над полом, ед. игры
var VIS_HEAD = {stand: 68, crouch: 50};                // точка головы (голова 64–72 / 46–54)
var VIS_BODY = {stand: [52, 32], crouch: [38, 22]};    // точки тела: грудь, живот/бёдра
var VIS_CEIL_H = 130;  // проектное число переделки: потолок над «крытым» полом, ед. игры (≈ 1,8 роста: тоннели, Cave, Donut);
                       // точной высоты потолков в данных нет — взято разумное число
var VIS_CELL = 2;      // клетка сетки высот, px радара (= 5 ед. игры)
var VIS_FLOOR_EPS = 6; // допуск пола, ед. игры (неровность навмеша: участок — одна высота); к верху укрытий не применяется
var VIS = {walls: null, nav: null, gen: -1, W: 0, floor: null, solid: null, ceil: null,
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
  var floor = new Float32Array(N).fill(-Infinity), ceil = new Float32Array(N).fill(Infinity);
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
    cellsOfPoly(a.points, function(k){ if(z > floor[k]) floor[k] = z; if(cv) ceil[k] = Math.min(ceil[k], z + VIS_CEIL_H); });
  });
  // (v321) крыши — многоугольники штриховки радара (точнее, чем «крыт ли участок навмеша целиком»)
  (HEIGHTS.roofs || []).forEach(function(R){
    cellsOfPoly(R.map(function(p){ return {x:p[0], y:p[1]}; }), function(k){ if(floor[k] > -Infinity) ceil[k] = Math.min(ceil[k], floor[k] + VIS_CEIL_H); });
  });
  // щели между участками навмеша (навмеш отступает от краёв) — заполнить соседним полом
  // (берётся более высокий: край уступа — у верхнего пола)
  for(var pass = 0; pass < 3; pass++){
    var f2 = floor.slice(), c2 = ceil.slice();
    for(var j = 1; j < W-1; j++) for(var i = 1; i < W-1; i++){
      var k = j*W + i; if(floor[k] !== -Infinity) continue;
      var best = -Infinity, bc = Infinity, nb = [k-1, k+1, k-W, k+W];
      for(var q = 0; q < 4; q++){ var v = floor[nb[q]]; if(v > best){ best = v; bc = ceil[nb[q]]; } }
      if(best !== -Infinity){ f2[k] = best; c2[k] = bc; }
    }
    floor = f2; ceil = c2;
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
  VIS.W = W; VIS.floor = floor; VIS.solid = solid; VIS.ceil = ceil;
  VIS.segs = segs; VIS.grid = grid; VIS.GN = GN; VIS.stamp = new Uint32Array(segs.length); VIS.sn = 0;
  VIS.walls = WALLS_SIG; VIS.nav = NAVAREAS; VIS.gen = VIS_GEN;
}
function visReady(){ if(VIS.walls !== WALLS_SIG || VIS.nav !== NAVAREAS || VIS.gen !== VIS_GEN) visBuild(); }
function visHighWalls(){ visReady(); return VIS.segs; }

// ---------- пол под точкой ----------
function visFloorAt(x, y){
  visReady();
  var i = Math.floor(x / VIS_CELL), j = Math.floor(y / VIS_CELL);
  if(i < 0 || j < 0 || i >= VIS.W || j >= VIS.W) return 0;
  var z = VIS.floor[j*VIS.W + i];
  return z === -Infinity ? 0 : z;
}

// ---------- высокие стены на линии (2D, точно) ----------
function visWallHit(ax, ay, bx, by){
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
function visMarch(ax, ay, az, bx, by, bz){
  var dx = bx - ax, dy = by - ay, dz = bz - az, n = Math.ceil(Math.hypot(dx, dy) / VIS_CELL);
  if(n < 2) return true;
  var W = VIS.W, S = VIS.solid, Cl = VIS.ceil, inv = 1/VIS_CELL, e = VIS_FLOOR_EPS;
  for(var i = 1; i < n; i++){
    var t = i/n, x = (ax + dx*t)*inv, y = (ay + dy*t)*inv;
    if(x < 0 || y < 0 || x >= W || y >= W) continue;
    var k = (y|0)*W + (x|0), z = az + dz*t;
    if(z < S[k] - e || z > Cl[k]) return false;
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
  if(az == null || bz == null) return false;
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
function visParts(vx, vy, vC, tx, ty, tC, walls, vz, tz){
  if(levelBlocked(vx, vy, vz, tx, ty, tz)) return {head: false, body: false};
  visReady();
  if(walls !== false && visWallHit(vx, vy, tx, ty)) return {head: false, body: false};
  // (v353, отметка владельца: NiKo «видит врага сквозь укрытие и убивает» — стоял на −164 под балконом Palace, а глаза брались с
  // карты высот радара −34: она знает только верхний пол) высота бота сильно расходится с картой — глаза и цель от его высоты
  var fv = visFloorAt(vx, vy), ft = visFloorAt(tx, ty);
  if(vz != null && Math.abs(fv - vz) > JUMP_UP) fv = vz;
  if(tz != null && Math.abs(ft - tz) > JUMP_UP) ft = tz;
  var ez = fv + (vC ? VIS_EYE.crouch : VIS_EYE.stand), tf = ft;
  var head = visMarch(vx, vy, ez, tx, ty, tf + (tC ? VIS_HEAD.crouch : VIS_HEAD.stand));
  var B = tC ? VIS_BODY.crouch : VIS_BODY.stand, body = false;
  for(var i = 0; i < B.length && !body; i++) body = visMarch(vx, vy, ez, tx, ty, tf + B[i]);
  return {head: head, body: body};
}
function visEyeZ(b){ return visFloorAt(b.x, b.y) + (b.crouching ? VIS_EYE.crouch : VIS_EYE.stand); }
function visPartsText(p){ return !p ? "нет" : (p.body ? (p.head ? "голова и тело" : "тело") : (p.head ? "голова" : "нет")); }

function zoneCentroid(z){
  var cx=0,cy=0; z.points.forEach(function(p){cx+=p.x;cy+=p.y;}); return {x:cx/z.points.length, y:cy/z.points.length};
}

