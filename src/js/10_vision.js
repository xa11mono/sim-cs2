// ======================= v201: КТО КОГО ВИДИТ — ОДНО МЕСТО (10_vision.js) =======================
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
var VIS_CEIL_H = 130;  // потолок над «крытым» полом, ед. игры (≈ 1,8 роста: тоннели, Cave, Donut);
                       // точной высоты потолков в данных нет — взято разумное число
var VIS_CELL = 2;      // клетка сетки высот, px радара (= 5 ед. игры)
var VIS_FLOOR_EPS = 6; // допуск пола, ед. игры (неровность навмеша: участок — одна высота); к верху укрытий не применяется
var CROUCH_SPEED_FRAC = 0.34; // присев — 34 % скорости бега (CS2)
// поле зрения: враг в конусе взгляда (FOV_DEG) или совсем рядом (FOV_NEAR), либо контакт
// уже идёт (не теряет цель, повернувшись к ней). CONE_R — длина конуса на радаре
var FOV_DEG = BAL.fov, FOV_NEAR = 70, CONE_R = 520;

var VIS = {walls: null, nav: null, gen: -1, W: 0, floor: null, solid: null, ceil: null,
           segs: [], grid: null, G: 64, GN: 0, stamp: null, sn: 0};
var VIS_GEN = 0;
function visInvalidate(){ VIS_GEN++; if(typeof ZONE_DANGER_DIRTY !== "undefined") ZONE_DANGER_DIRTY = true; }

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
    cellsOfPoly(a.points, function(k){ if(z > floor[k]) floor[k] = z; if(cv) ceil[k] = Math.min(ceil[k], z + VIS_CEIL_H); });
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

// ---------- дым ----------
function segHitsCircle(x1,y1,x2,y2,cx,cy,r){
  var dx=x2-x1, dy=y2-y1, L2=dx*dx+dy*dy;
  var t = L2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((cx-x1)*dx+(cy-y1)*dy)/L2));
  var px = x1+t*dx - cx, py = y1+t*dy - cy;
  return px*px+py*py < r*r;
}
function smokeBlocks(x1,y1,x2,y2){
  for(var i=0;i<smokes.length;i++){
    var s = smokes[i], r = smokeRadiusNow(s);
    if(r > 8 && segHitsCircle(x1,y1,x2,y2,s.x,s.y,r)) return true;
  }
  return false;
}
function smokeRadiusNow(s){
  var age = tick - s.born, left = s.until - tick;
  var grow = Math.min(1, age/40), fade = Math.min(1, left/64); // раскрывается ~0.6с, в конце рассеивается
  // HE в дыму: на ~1.3с дым разлетается (дыра), потом снова затягивается
  var hole = 1;
  if(s.holeUntil && tick < s.holeUntil){ var hp = (s.holeUntil - tick)/s.holeLen; hole = 0.3 + 0.7*(1 - Math.min(1, hp*1.4)); }
  return NADE.smoke.radius * grow * (0.4 + 0.6*fade) * hole;
}
// ван-вей: смотрящий v в самом краю дыма (глубина ≤30% радиуса) и смотрит НАРУЖУ — видит;
// снаружи в дым видно только того, кто стоит на самой кромке (≤8%). Любой другой дым — закрывает.
function oneWaySees(v, t){
  var ok = true, any = false;
  for(var i=0;i<smokes.length;i++){
    var s = smokes[i], r = smokeRadiusNow(s);
    if(r <= 8 || !segHitsCircle(v.x, v.y, t.x, t.y, s.x, s.y, r)) continue;
    any = true;
    var dv = Math.hypot(v.x-s.x, v.y-s.y), dt = Math.hypot(t.x-s.x, t.y-s.y);
    if(dv < r && dt >= r){
      var depth = (r - dv)/r;
      var ox = v.x-s.x, oy = v.y-s.y, lx = t.x-v.x, ly = t.y-v.y;
      var cosA = (ox*lx + oy*ly)/Math.max(1, Math.hypot(ox, oy)*Math.hypot(lx, ly));
      if(!(depth <= 0.3 && cosA > 0.34)) ok = false;
    } else if(dv >= r && dt < r){
      if((r - dt)/r > 0.08) ok = false;       // цель в дыму глубже кромки — снаружи не видно
    } else ok = false;
  }
  return any && ok;
}

// ---------- поле зрения ----------
function inFov(b, x, y){
  if(b.facing === undefined) return true;
  var d = Math.hypot(x-b.x, y-b.y);
  if(d < FOV_NEAR) return true;
  var a = Math.atan2(y-b.y, x-b.x);
  var off = Math.abs(((a - b.facing + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
  return off <= FOV_DEG*Math.PI/360;
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
function visParts(vx, vy, vC, tx, ty, tC, walls){
  visReady();
  if(walls !== false && visWallHit(vx, vy, tx, ty)) return {head: false, body: false};
  var ez = visFloorAt(vx, vy) + (vC ? VIS_EYE.crouch : VIS_EYE.stand), tf = visFloorAt(tx, ty);
  var head = visMarch(vx, vy, ez, tx, ty, tf + (tC ? VIS_HEAD.crouch : VIS_HEAD.stand));
  var B = tC ? VIS_BODY.crouch : VIS_BODY.stand, body = false;
  for(var i = 0; i < B.length && !body; i++) body = visMarch(vx, vy, ez, tx, ty, tf + B[i]);
  return {head: head, body: body};
}
function visEyeZ(b){ return visFloorAt(b.x, b.y) + (b.crouching ? VIS_EYE.crouch : VIS_EYE.stand); }
function visPartsText(p){ return !p ? "нет" : (p.body ? (p.head ? "голова и тело" : "тело") : (p.head ? "голова" : "нет")); }

// кто кого из пары видит в бою: стены, высоты, дым и ван-вей, ослепление, поле зрения.
// Возвращает {ab, ba} — что видит a у b и b у a ({head, body}) или null — не видит
function visPair(a, b){
  visReady();
  if(visWallHit(a.x, a.y, b.x, b.y)) return null;
  var smk = smokeBlocks(a.x, a.y, b.x, b.y), aOW = false, bOW = false;
  if(smk){ aOW = oneWaySees(a, b); bOW = oneWaySees(b, a); if(!aOW && !bOW) return null; }
  var aCan = (!smk || aOW) && tick >= a.blindUntil && (inFov(a, b.x, b.y) || a.contactStreak > 0);
  var bCan = (!smk || bOW) && tick >= b.blindUntil && (inFov(b, a.x, a.y) || b.contactStreak > 0);
  var ab = null, ba = null;
  if(aCan){ var p = visParts(a.x, a.y, a.crouching, b.x, b.y, b.crouching, false); if(p.head || p.body) ab = p; }
  if(bCan){ var q = visParts(b.x, b.y, b.crouching, a.x, a.y, a.crouching, false); if(q.head || q.body) ba = q; }
  return (ab || ba) ? {ab: ab, ba: ba} : null;
}
