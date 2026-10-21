(function(){
"use strict";
// v317: набор карты — всё, что относится к карте, приходит отсюда (data/maps/<карта>/, вшивает src/mapset.py при сборке).
// Игра не знает ни одной карты: названия мест, координаты, тактики, гранаты, радар — только из MAP.
var MAP = @@MAP@@;

// ---------- карта: зоны + точки + порталы (данные из zone_editor.html) ----------
// Карта ещё не достроена (9 точек, ~60 зон) — это первый прогон, чтобы
// проверить сам движок пути "зона -> портал -> зона", не финальная версия.
var ZONEMAP = MAP.zones.zonemap;
// ---------- выравнивание слоя зон (всё сразу: зоны + тактические точки) ----------
// Зоны из Zone Editor рисовались под старые стены и могут быть сдвинуты/не того
// масштаба относительно карты. Как и у стен/навмеша — один общий сдвиг+масштаб
// (центр — середина карты 1024,1024) поверх нетронутой копии ZONEMAP_RAW.
// Сохраняется в браузере; от слоя зависит опасность, спавны, точки патруля,
// сайты (если свои сайты не нарисованы) — всё это пересчитывается.
var ZONEMAP_RAW = JSON.parse(JSON.stringify(ZONEMAP));
var ZONE_LAYER_KEY = MAP.store + "-zonelayer-v1";
var ZONE_LAYER_BASELINE = MAP.zoneLayer; // выровнено вручную по картинке радара (набор карты, map.json)
var zoneLayer = {dx:ZONE_LAYER_BASELINE.dx, dy:ZONE_LAYER_BASELINE.dy, scale:ZONE_LAYER_BASELINE.scale};
try{ var _zl = JSON.parse(localStorage.getItem(ZONE_LAYER_KEY)||"null"); if(_zl && isFinite(_zl.dx) && isFinite(_zl.dy) && isFinite(_zl.scale)) zoneLayer = _zl; }catch(e){}
function zlPt(x, y){ return {x: 1024 + (x-1024)*zoneLayer.scale + zoneLayer.dx, y: 1024 + (y-1024)*zoneLayer.scale + zoneLayer.dy}; }
// своя форма зон (перо в слое «зоны»): точки в "сырых" координатах слоя,
// чтобы общее выравнивание слоя продолжало к ним применяться
// (А5) зоны из 3D-геометрии (MAP.zones.navZone) — другие зоны под теми же номерами: правки форм и названий старых зон в браузере к ним не относятся
var ZONES_GEN = MAP.zones.navZone ? "-z3d" : "";
var ZONE_SHAPES_BAKED = MAP.zones.shapes, ZONE_SHAPES_KEY = MAP.store + "-zoneshapes-v1" + ZONES_GEN, ZONE_SHAPES = {};
(function(){ for(var k in ZONE_SHAPES_BAKED) ZONE_SHAPES[k] = ZONE_SHAPES_BAKED[k];
  try{ var o = JSON.parse(localStorage.getItem(ZONE_SHAPES_KEY)||"null"); if(o) for(var k2 in o){ if(Array.isArray(o[k2]) && o[k2].length >= 3) ZONE_SHAPES[k2] = o[k2]; } }catch(e){} })();
function zlInv(x, y){ return {x: 1024 + (x - zoneLayer.dx - 1024)/zoneLayer.scale, y: 1024 + (y - zoneLayer.dy - 1024)/zoneLayer.scale}; }
function applyZoneLayerToData(){
  ZONEMAP.zones.forEach(function(z, zi){
    var src = ZONE_SHAPES[z.id] || ZONEMAP_RAW.zones[zi].points;
    z.points = src.map(function(r){ return zlPt(r.x, r.y); });
  });
  ZONEMAP.points.forEach(function(p, pi){ var r = ZONEMAP_RAW.points[pi]; var q = zlPt(r.x, r.y); p.x = q.x; p.y = q.y; });
}
applyZoneLayerToData();
// зона без переходов (например, нарисованная/исправленная пером) — связываем с
// зонами, к которым она прилегает (край к краю ближе ~14px)
function autoPortals(){
  var conn = {};
  ZONEMAP.portals.forEach(function(p){ conn[p.a] = true; conn[p.b] = true; });
  var sd = function(px, py, a, b){ var dx = b.x-a.x, dy = b.y-a.y, L = dx*dx+dy*dy, t = L ? Math.max(0, Math.min(1, ((px-a.x)*dx+(py-a.y)*dy)/L)) : 0; return Math.hypot(px-(a.x+t*dx), py-(a.y+t*dy)); };
  ZONEMAP.zones.forEach(function(z){
    if(conn[z.id]) return;
    ZONEMAP.zones.forEach(function(o){
      if(o === z) return;
      var near = z.points.some(function(p){ for(var i=0;i<o.points.length;i++){ if(sd(p.x, p.y, o.points[i], o.points[(i+1)%o.points.length]) < 14) return true; } return false; });
      if(near){ ZONEMAP.portals.push({a:z.id, b:o.id, type:"walk", auto:true}); conn[o.id] = true; }
    });
  });
}
autoPortals();

var NAVAREAS = MAP.navmesh.areas;
// (v372) подъёмы из демок (tools/climbs_bake.py → MAP.climbs): уступ, на который .nav даёт только спрыгнуть, а про забираются
// (ящики, выступы; Ancient — Mid → Xbox). Связь «вверх» — в граф навмеша, сам подъём — как по лестнице (laddersBuild)
(function(){ var byId = {}; NAVAREAS.forEach(function(a){ byId[a.id] = a; });
  ((MAP.climbs && MAP.climbs.climbs) || []).forEach(function(c){ var lo = byId[c.lo.area]; if(lo && byId[c.hi.area] && lo.conn.indexOf(c.hi.area) < 0) lo.conn.push(c.hi.area); }); })();

// Pristine copy of the parsed .nav data, kept untouched — everything below
// (winding normalization, in particular) mutates NAVAREAS in place, so a
// live "move/scale the whole navmesh to line it up with the radar image"
// tool (see the align-mode UI further down) needs an original to re-derive
// from on every adjustment, rather than compounding transforms on already-
// transformed data.
var NAVAREAS_RAW = JSON.parse(JSON.stringify(NAVAREAS));
var navTransform = { dx: 0, dy: 0, scale: 1 }; // pivot is the map center (1024,1024) — only used while navAnchors.length < 3, see below

// ---------- multi-anchor warp calibration ----------
// Официальный navmesh не совпадает со стенами ОДИНАКОВО по всей карте — в
// одном углу почти точно, в другом заметно уезжает. Это значит, что
// искажение нелинейное, а navTransform выше — это один общий сдвиг+масштаб
// на всю карту (жёсткий кусок стекла): физически не может выправить сразу
// везде, если ошибка в разных местах разная.
// Вместо этого пользователь кликает мышью по нескольким точкам navmesh, а
// затем — куда каждая из них должна встать на самом деле (см. UI-панель
// "калибровка навмеша" у канваса). По этим опорным точкам (минимум 3)
// строится тонкая пластина (thin-plate spline, TPS) — гладкая деформация,
// которая точно проходит через все опорные точки и плавно ослабевает
// вдали от них, то есть тянет сетку сильнее там, где поставлены точки, и
// слабее в остальных местах — в отличие от аффинного navTransform, который
// одинаково давит на всю карту.
// При 3+ опорных точках navWarp используется ВМЕСТО navTransform (см.
// navMapPoint ниже); при 0-2 точках — как раньше, обычный affine-сдвиг.
// ---------- реальный периметр navmesh (рёбра без соседа с другой стороны) ----------
// Внутренние линии триангуляции navmesh ничего не значат для выравнивания —
// значение имеет только ГРАНИЦА (рёбра, у которых нет второго полигона по
// другую сторону): по построению игры именно она должна лежать вплотную к
// стенам. Сейчас все рёбра рисуются одним цветом, и на глаз не разобрать,
// где реальная граница, а где просто диагональ треугольника внутри комнаты —
// из-за этого невозможно понять, куда именно ставить опорные точки. Список
// строится один раз по СЫРЫМ (недеформированным) координатам — топология не
// меняется ни от navTransform, ни от navWarp, только положение на экране.
var NAV_BOUNDARY_SEGS_RAW = (function(){
  var counts = {};
  var segs = [];
  function key(ax,ay,bx,by){
    // округляем и сортируем концы, чтобы одно и то же ребро, пройденное с
    // разных сторон (два соседних полигона обходят его в разные стороны),
    // давало одинаковый ключ
    var a = Math.round(ax*4)+","+Math.round(ay*4), b = Math.round(bx*4)+","+Math.round(by*4);
    return a < b ? a+"|"+b : b+"|"+a;
  }
  NAVAREAS_RAW.forEach(function(z){
    var pts = z.points;
    for(var i=0;i<pts.length;i++){
      var a = pts[i], b = pts[(i+1)%pts.length];
      var k = key(a.x,a.y,b.x,b.y);
      counts[k] = (counts[k]||0)+1;
      segs.push({k:k, x1:a.x, y1:a.y, x2:b.x, y2:b.y});
    }
  });
  var boundary = [];
  var seen = {};
  segs.forEach(function(s){
    if(counts[s.k]===1 && !seen[s.k]){ seen[s.k]=true; boundary.push(s); }
  });
  return boundary;
})();

var navAnchors = []; // [{sx,sy: сырая (NAVAREAS_RAW) точка, tx,ty: куда её тащили}]
var NAV_ANCHORS_KEY = MAP.store + "-navanchors-v1";
function saveNavAnchors(){ try{ localStorage.setItem(NAV_ANCHORS_KEY, JSON.stringify(navAnchors)); }catch(e){} }
function loadNavAnchors(){
  try{
    var raw = localStorage.getItem(NAV_ANCHORS_KEY);
    if(!raw) return;
    var arr = JSON.parse(raw);
    if(Array.isArray(arr)) navAnchors = arr;
  }catch(e){}
}
loadNavAnchors();

// маленький решатель системы линейных уравнений (метод Гаусса с частичным
// выбором главного элемента) — система TPS ниже крошечная (anchors+3
// неизвестных, реально до 15-20), поэтому ничего быстрее не требуется.
function solveLinear(A, b){
  var n = b.length;
  var M = A.map(function(row,i){ return row.concat([b[i]]); });
  for(var col=0; col<n; col++){
    var piv = col;
    for(var r=col+1;r<n;r++){ if(Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r; }
    var tmp = M[col]; M[col] = M[piv]; M[piv] = tmp;
    if(Math.abs(M[col][col]) < 1e-9) continue; // вырожденный случай (точки на одной линии) — best effort, не роняем расчёт
    for(var r2=0;r2<n;r2++){
      if(r2===col) continue;
      var f = M[r2][col] / M[col][col];
      for(var c=col;c<=n;c++) M[r2][c] -= f*M[col][c];
    }
  }
  var x = new Array(n);
  for(var i2=0;i2<n;i2++) x[i2] = Math.abs(M[i2][i2])<1e-9 ? 0 : M[i2][n]/M[i2][i2];
  return x;
}
function tpsRbf(r2){ return r2 < 1e-9 ? 0 : r2 * Math.log(r2) * 0.5; } // стандартное радиальное базисное ядро TPS: r²·log(r) = r²·log(r²)/2, без sqrt

var navWarp = null; // {n, pts, wx/ax0/ax1/ax2 (поле смещения по X), wy/ay0/ay1/ay2 (по Y)} — пересчитывается rebuildNavWarp()
function rebuildNavWarp(){
  var n = navAnchors.length;
  if(n < 3){ navWarp = null; return; } // TPS корректно определён только от 3 неколлинеарных точек
  var L = [];
  for(var i=0;i<n+3;i++) L.push(new Array(n+3).fill(0));
  var pts = navAnchors.map(function(a){ return {x:a.sx, y:a.sy}; });
  for(i=0;i<n;i++){
    for(var j=0;j<n;j++){
      var dxp = pts[i].x-pts[j].x, dyp = pts[i].y-pts[j].y;
      L[i][j] = tpsRbf(dxp*dxp+dyp*dyp);
    }
    L[i][n]=1; L[i][n+1]=pts[i].x; L[i][n+2]=pts[i].y;
    L[n][i]=1; L[n+1][i]=pts[i].x; L[n+2][i]=pts[i].y;
  }
  var vx = navAnchors.map(function(a){ return a.tx-a.sx; }).concat([0,0,0]);
  var vy = navAnchors.map(function(a){ return a.ty-a.sy; }).concat([0,0,0]);
  var solX = solveLinear(L, vx);
  var solY = solveLinear(L, vy);
  // TPS is only trustworthy near/inside the cloud of anchor points — outside
  // it, the fitted affine part can point in almost any direction and shoot
  // points arbitrarily far (this is what sent T-spawn off the map: no
  // anchors were placed way out there, so it got a raw extrapolation).
  // spreadR = the anchor cloud's own diameter (with a floor so a tight
  // cluster of 3 points doesn't create a razor-thin "trusted" zone) — used
  // below in navMapPoint to fade the warp back to "no movement" past it,
  // instead of trusting the extrapolation forever.
  var spreadR = 150;
  for(i=0;i<n;i++){ for(var j2=i+1;j2<n;j2++){
    var d = Math.hypot(pts[i].x-pts[j2].x, pts[i].y-pts[j2].y);
    if(d > spreadR) spreadR = d;
  } }
  navWarp = {
    n:n, pts:pts, spreadR:spreadR,
    wx: solX.slice(0,n), ax0: solX[n], ax1: solX[n+1], ax2: solX[n+2],
    wy: solY.slice(0,n), ay0: solY[n], ay1: solY[n+1], ay2: solY[n+2]
  };
}
rebuildNavWarp();

// переводит одну СЫРУЮ (NAVAREAS_RAW) точку через активный режим — warp,
// если поставлено 3+ опорных точки, иначе обычный affine navTransform.
// Используется и массово (applyNavTransform, ~1970 областей), и точечно
// (отрисовка маркеров опорных точек — "где эта точка сейчас на самом деле").
function navMapPoint(x, y){
  if(navWarp){
    var dx=0, dy=0;
    for(var i=0;i<navWarp.n;i++){
      var ddx = x-navWarp.pts[i].x, ddy = y-navWarp.pts[i].y;
      var u = tpsRbf(ddx*ddx+ddy*ddy);
      dx += navWarp.wx[i]*u; dy += navWarp.wy[i]*u;
    }
    dx += navWarp.ax0 + navWarp.ax1*x + navWarp.ax2*y;
    dy += navWarp.ay0 + navWarp.ay1*x + navWarp.ay2*y;
    // fade the whole displacement back to zero the further this point is
    // from the anchor cloud. NOTE: the affine part (ax1*x + ax2*y etc.) grows
    // roughly linearly with distance, so a 1/dist falloff only bounds the
    // result at a constant offset, it never actually reaches zero — that's
    // why a 1/dist version of this still left T-spawn off-map. A 1/dist²
    // falloff (spreadR² / (spreadR² + dmin²)) decays fast enough to actually
    // cancel that linear growth, so far-away geometry (a spawn nobody put
    // anchors near) settles back to its original, untouched position.
    var dmin = Infinity;
    for(var k=0;k<navWarp.n;k++){
      var kd = Math.hypot(x-navWarp.pts[k].x, y-navWarp.pts[k].y);
      if(kd < dmin) dmin = kd;
    }
    var R2 = navWarp.spreadR*navWarp.spreadR;
    var w = R2 / (R2 + dmin*dmin);
    return { x: x+dx*w, y: y+dy*w };
  }
  var t = navTransform;
  return { x: 1024 + (x-1024)*t.scale + t.dx, y: 1024 + (y-1024)*t.scale + t.dy };
}

function applyNavTransform(){
  NAVAREAS = NAVAREAS_RAW.map(function(a){
    return {
      id: a.id, z: a.z, conn: a.conn,
      points: a.points.map(function(p){ var q = navMapPoint(p.x, p.y); if(p.z != null) q.z = p.z; return q; })   // (v336) высота угла
    };
  });
}

