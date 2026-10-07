(function(){
"use strict";

// ---------- карта: зоны + точки + порталы (данные из zone_editor.html) ----------
// Карта ещё не достроена (9 точек, ~60 зон) — это первый прогон, чтобы
// проверить сам движок пути "зона -> портал -> зона", не финальная версия.
var ZONEMAP = @@DATA:zonemap.json@@;
// ---------- выравнивание слоя зон (всё сразу: зоны + тактические точки) ----------
// Зоны из Zone Editor рисовались под старые стены и могут быть сдвинуты/не того
// масштаба относительно карты. Как и у стен/навмеша — один общий сдвиг+масштаб
// (центр — середина карты 1024,1024) поверх нетронутой копии ZONEMAP_RAW.
// Сохраняется в браузере; от слоя зависит опасность, спавны, точки патруля,
// сайты (если свои сайты не нарисованы) — всё это пересчитывается.
var ZONEMAP_RAW = JSON.parse(JSON.stringify(ZONEMAP));
var ZONE_LAYER_KEY = "ancient-live-radar-zonelayer-v1";
var ZONE_LAYER_BASELINE = {dx:-17.0, dy:38.8, scale:0.837}; // выровнено вручную по картинке радара и зашито в код
var zoneLayer = {dx:ZONE_LAYER_BASELINE.dx, dy:ZONE_LAYER_BASELINE.dy, scale:ZONE_LAYER_BASELINE.scale};
try{ var _zl = JSON.parse(localStorage.getItem(ZONE_LAYER_KEY)||"null"); if(_zl && isFinite(_zl.dx) && isFinite(_zl.dy) && isFinite(_zl.scale)) zoneLayer = _zl; }catch(e){}
function zlPt(x, y){ return {x: 1024 + (x-1024)*zoneLayer.scale + zoneLayer.dx, y: 1024 + (y-1024)*zoneLayer.scale + zoneLayer.dy}; }
// своя форма зон (перо в слое «зоны»): точки в "сырых" координатах слоя,
// чтобы общее выравнивание слоя продолжало к ним применяться
var ZONE_SHAPES_BAKED = @@DATA:zone_shapes.json@@, ZONE_SHAPES_KEY = "ancient-live-radar-zoneshapes-v1", ZONE_SHAPES = {};
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

var NAVAREAS = @@DATA:navmesh.json@@;

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
var NAV_ANCHORS_KEY = "ancient-live-radar-navanchors-v1";
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
      points: a.points.map(function(p){ return navMapPoint(p.x, p.y); })
    };
  });
}

// ---------- официальный navmesh (.nav, распарсен из de_ancient.nav v36) ----------
// Заменяет ручные зоны как источник геометрии ходьбы: 1970 полигонов,
// официально посчитанных игрой как проходимая поверхность, со связями
// (conn) между соседними полигонами. Раз область существует — значит она
// не пересекает стены (так их вычисляет сама игра), поэтому маршрут,
// построенный по этим полигонам, физически не может пройти сквозь стену —
// в отличие от старого способа (ручные зоны + отдельно нарисованные стены,
// которые могли не совпадать друг с другом).
var zonesById, zoneGraph, portalCount, portalMissing, wallSegs;

function pointInPoly(px,py,points){
  var inside = false;
  for(var i=0,j=points.length-1;i<points.length;j=i++){
    var xi=points[i].x, yi=points[i].y, xj=points[j].x, yj=points[j].y;
    var intersect = ((yi>py)!==(yj>py)) && (px < (xj-xi)*(py-yi)/(yj-yi)+xi);
    if(intersect) inside = !inside;
  }
  return inside;
}
function zoneOf(x,y,z){
  // заблокированные (внутри стены) полигоны пропускаем — иначе бот, стоящий
  // на таком, получил бы стартовую зону без единого перехода
  for(var i=0;i<NAVAREAS.length;i++){
    var zn = NAVAREAS[i];
    if(NAV_BLOCKED[zn.id]) continue;
    if(pointInPoly(x,y,zn.points)) return zn;
  }
  // fallback: point fell in a tiny gap between areas (navmesh doesn't
  // perfectly tile down to the pixel) — snap to nearest area centroid
  var best=null, bd=Infinity;
  NAVAREAS.forEach(function(zn){
    if(NAV_BLOCKED[zn.id] || !(zoneGraph[zn.id]||[]).length) return;
    var cx=0,cy=0; zn.points.forEach(function(p){cx+=p.x;cy+=p.y;}); cx/=zn.points.length; cy/=zn.points.length;
    var d = Math.hypot(cx-x,cy-y);
    if(d<bd){bd=d;best=zn;}
  });
  return best;
}

// ---------- portal segments between adjacent nav areas (same tolerant-overlap
// algorithm previously used for the hand-drawn zones, now applied only to
// pairs the .nav file itself declares adjacent via each area's conn list —
// so we're not doing an all-pairs search over 1970 areas, just the real
// neighbors) ----------
function dist2(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
function zoneEdges(z){
  var pts = z.points, out = [];
  for(var i=0;i<pts.length;i++) out.push([pts[i], pts[(i+1)%pts.length]]);
  return out;
}
// These are pixel tolerances tuned for the navmesh at its original (.nav
// file's own) scale. Align mode lets you resize the whole navmesh relative
// to the radar image (navTransform.scale) — if these stayed fixed absolute
// pixel values, shrinking the navmesh would make real gaps between separate
// walls fall inside the tolerance (walls wrongly vanish, bots walk/see
// through them), and growing it would make genuinely-shared edges fall
// outside the tolerance (real doorways wrongly become walls). rebuildNav()
// rescales these to navTransform.scale on every rebuild so detection stays
// correct at any zoom level.
var PORTAL_TOL = 10, PORTAL_MIN_OVERLAP = 4;
function segOverlap(ea, eb){
  var d1x=ea[1].x-ea[0].x, d1y=ea[1].y-ea[0].y;
  var len1 = Math.hypot(d1x,d1y);
  if(len1<1e-6) return null;
  d1x/=len1; d1y/=len1;
  var d2x=eb[1].x-eb[0].x, d2y=eb[1].y-eb[0].y;
  var len2 = Math.hypot(d2x,d2y);
  if(len2<1e-6) return null;
  d2x/=len2; d2y/=len2;
  var cross = Math.abs(d1x*d2y - d1y*d2x);
  if(cross > 0.08) return null;
  function perpDist(px,py){ return Math.abs((px-ea[0].x)*d1y - (py-ea[0].y)*d1x); }
  if(perpDist(eb[0].x,eb[0].y) > PORTAL_TOL) return null;
  if(perpDist(eb[1].x,eb[1].y) > PORTAL_TOL) return null;
  function proj(px,py){ return (px-ea[0].x)*d1x + (py-ea[0].y)*d1y; }
  var a0=0, a1=len1, b0=proj(eb[0].x,eb[0].y), b1=proj(eb[1].x,eb[1].y);
  var bMin=Math.min(b0,b1), bMax=Math.max(b0,b1);
  var lo=Math.max(a0,bMin), hi=Math.min(a1,bMax);
  if(hi-lo < PORTAL_MIN_OVERLAP) return null;
  return [ {x:ea[0].x+d1x*lo, y:ea[0].y+d1y*lo}, {x:ea[0].x+d1x*hi, y:ea[0].y+d1y*hi} ];
}
// Returns BOTH a display midpoint (weighted average of every overlapping
// sub-segment) AND the single LONGEST overlapping segment, oriented along
// za's own edge direction — that's what the funnel algorithm needs: the real
// physical "doorway" a bot can cross anywhere along, not just at one point.
function computePortal(za, zb){
  var ei = zoneEdges(za), ej = zoneEdges(zb), segs = [];
  ei.forEach(function(ea){ ej.forEach(function(eb){ var ov = segOverlap(ea,eb); if(ov) segs.push(ov); }); });
  if(!segs.length) return null;
  var sx=0, sy=0, totalLen=0, longest=segs[0], longestLen=-1;
  segs.forEach(function(s){
    var len = dist2(s[0],s[1]);
    sx += (s[0].x+s[1].x)/2*len; sy += (s[0].y+s[1].y)/2*len; totalLen += len;
    if(len>longestLen){ longestLen=len; longest=s; }
  });
  var mid = totalLen>0 ? {x:sx/totalLen, y:sy/totalLen} : {x:segs[0][0].x, y:segs[0][0].y};
  return {mid:mid, seg:longest};
}

// ---------- стены (v198) ----------
// Одно место хранения стен: WALL_POLYS — список замкнутых многоугольников
// [[x,y],...] в координатах радара 0..2048, ровно в формате src/data/walls.json.
// Из кода берётся walls.json; если владелец правил стены редактором карты
// (вкладка «стены», 21_map_editor.js), его правка из базы страницы заменяет их.
// После любой правки вызывается applyWalls() — пересобирает всё, что игра
// строит из стен (отрезки для видимости и движения, сплошные многоугольники,
// граф навмеша, спавны, сайты, таблицу простреливаемости зон).
var WALL_POLYS_CODE = @@DATA:walls.json@@;
var WALL_POLYS = JSON.parse(JSON.stringify(WALL_POLYS_CODE));
// отрезки стен [x1,y1,x2,y2] — по ним движение (crossesWall), гранаты, трассеры;
// видимость — 10_vision.js (высокие стены — отрезками, низкие — по высоте).
// wallSegs ссылается на тот же массив.
var MANUAL_WALLS = [];
var WALL_SOLID_POLYS = []; // те же стены как многоугольники {x,y} — «точка внутри стены»
var WALLS_SIG = "";         // подпись набора стен (отметки: снимок с другими стенами не годится)
function applyWalls(full){
  MANUAL_WALLS.length = 0;
  WALL_SOLID_POLYS = WALL_POLYS.map(function(poly){ return poly.map(function(p){ return {x:p[0], y:p[1]}; }); });
  var h = 0;
  WALL_POLYS.forEach(function(poly){
    for(var i=0;i<poly.length;i++){
      var a = poly[i], b = poly[(i+1)%poly.length];
      MANUAL_WALLS.push([a[0],a[1],b[0],b[1]]);
      h = (h*31 + Math.round(a[0]*10)*7 + Math.round(a[1]*10)) % 2147483647;
    }
  });
  WALLS_SIG = MANUAL_WALLS.length + ":" + h;
  // при загрузке (full не задан) остальное строится дальше по коду само
  if(!full || typeof zonesById === "undefined" || !zonesById) return;
  rebuildNav();
  if(typeof resnapSpawns === "function") resnapSpawns();
  if(typeof SITES_READY !== "undefined" && SITES_READY) buildSites();
  if(typeof PRO_LINEUPS !== "undefined") PRO_LINEUPS = null;
  if(typeof visInvalidate === "function") visInvalidate();   // видимость и таблица опасности — заново
}
applyWalls();

function zoneCentroid(z){
  var cx=0,cy=0; z.points.forEach(function(p){cx+=p.x;cy+=p.y;}); return {x:cx/z.points.length, y:cy/z.points.length};
}

// ---------- (re)build everything derived from NAVAREAS: called once at load,
// and again whenever the align-mode UI (further down, near the canvas setup)
// moves/scales the whole navmesh to line it up with the radar image. Cheap
// per-point transform (applyNavTransform) runs on every drag/wheel tick for
// live visual feedback; this heavier rebuild (graph + both wall sets) is
// debounced to run only after the user stops adjusting. ----------
var NAV_BLOCKED = {}, navBlockedCount = 0, navCutPortals = 0, navNarrowPortals = 0;
function insideSolidWall(x, y){
  for(var i=0;i<WALL_SOLID_POLYS.length;i++){
    if(pointInPoly(x, y, WALL_SOLID_POLYS[i])) return true;
  }
  return false;
}
function segCrossesManualWalls(x1,y1,x2,y2){
  for(var i=0;i<MANUAL_WALLS.length;i++){
    var s = MANUAL_WALLS[i];
    if(segIntersect(x1,y1,x2,y2,s[0],s[1],s[2],s[3])) return true;
  }
  return false;
}
// ближайшая проходимая точка: если (x,y) внутри стены — центр ближайшего
// незаблокированного полигона навмеша, у которого есть хоть один переход
function snapToWalkable(x, y){
  if(!insideSolidWall(x, y)) return {x:x, y:y};
  var best = null, bd = Infinity;
  NAVAREAS.forEach(function(z){
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var c = zoneCentroid(z);
    var d = Math.hypot(c.x-x, c.y-y);
    if(d < bd){ bd = d; best = c; }
  });
  return best ? {x:best.x, y:best.y} : {x:x, y:y};
}
function rebuildNav(){
  applyNavTransform();
  // rescale edge-matching tolerances to the current navmesh scale (see the
  // comment above PORTAL_TOL's declaration) — must happen before anything
  // below that calls segOverlap/edgeCoverage/computePortal/buildAutoWalls.
  PORTAL_TOL = 10 * navTransform.scale;
  PORTAL_MIN_OVERLAP = 4 * navTransform.scale;

  // Funnel/string-pull pathing needs each area's own polygon winding to be
  // consistent (CCW), otherwise "left"/"right" of a shared portal edge get
  // swapped and the funnel algorithm degenerates.
  NAVAREAS.forEach(function(z){
    var area = 0, pts = z.points;
    for(var i=0;i<pts.length;i++){
      var a = pts[i], b = pts[(i+1)%pts.length];
      area += a.x*b.y - b.x*a.y;
    }
    if(area < 0) pts.reverse();
  });

  zonesById = {};
  NAVAREAS.forEach(function(z){ zonesById[z.id] = z; });

  // ---------- граф с учётом стен ----------
  // navmesh и стены — два независимых слоя, и после выравнивания/калибровки
  // часть полигонов навмеша оказывается ВНУТРИ нарисованных стен, а часть
  // порталов (переходов между соседними полигонами) — поперёк линии стены.
  // Раньше граф строился только по conn из .nav и про стены ничего не знал:
  // Дейкстра спокойно вела маршрут через такой полигон/портал, и бот упирался
  // в стену (крутился/скользил). Теперь:
  //  1) полигон, центр которого внутри замкнутой стены, выкидывается из графа;
  //  2) портал, переход через который (короткий отрезок с одной стороны
  //     портала на другую) пересекает стену, тоже выкидывается.
  NAV_BLOCKED = {};
  navBlockedCount = 0; navCutPortals = 0; navNarrowPortals = 0;
  // Выкидываем полигон, только если он в стене БОЛЬШЕЙ частью, а не когда
  // в стену попал один его центр: после калибровки навмеша (опорные точки)
  // маленький полигон в узком проходе Dark сдвигался на 3px, центр оказывался
  // в выступе стены — и весь проход Cave → Dark → Lamp Room исчезал из графа.
  // Боты считали Cave тупиком: не ходили через него и стояли в нём спиной к Dark.
  NAVAREAS.forEach(function(z){
    var c = zoneCentroid(z), n = 0, inn = 0;
    if(insideSolidWall(c.x, c.y)) inn++; n++;
    z.points.forEach(function(p){ var q = {x: p.x + (c.x-p.x)*0.35, y: p.y + (c.y-p.y)*0.35}; n++; if(insideSolidWall(q.x, q.y)) inn++; });
    if(inn >= Math.max(1, Math.ceil(n*0.6))){ NAV_BLOCKED[z.id] = true; navBlockedCount++; }
  });

  // ---------- nav-area adjacency graph (built straight from each area's own
  // `conn` list — the game's own computed adjacency, not a geometry guess) ----------
  zoneGraph = {}; // areaId -> [{to, mid, z, left, right}]
  NAVAREAS.forEach(function(z){ zoneGraph[z.id] = []; });
  portalCount = 0; portalMissing = 0;
  (function(){
    var done = {};
    NAVAREAS.forEach(function(za){
      (za.conn||[]).forEach(function(bid){
        var zb = zonesById[bid];
        if(!zb) return;
        if(NAV_BLOCKED[za.id] || NAV_BLOCKED[bid]) return;
        var key = za.id < bid ? (za.id+"|"+bid) : (bid+"|"+za.id);
        if(done[key]) return; done[key] = true;
        var portal = computePortal(za, zb);
        var mid, seg;
        if(!portal){
          // ~11% of the .nav file's declared adjacencies are corner-touching
          // triangle slivers (two polygons meeting at essentially one point,
          // not along a shared straight edge) rather than a real doorway —
          // segOverlap correctly finds nothing there. The old centroid-average
          // fallback used for the hand-drawn zones was WRONG here: it produces
          // an arbitrary interior point that isn't actually on either
          // polygon's boundary, so the funnel algorithm would happily route a
          // "taut" path straight through empty space outside both areas.
          // Ground it in real geometry instead: use the nearest pair of
          // vertices between the two polygons — that point is guaranteed to
          // lie on (or immediately next to) both polygons' actual boundary.
          var nearest = null, nd = Infinity;
          za.points.forEach(function(p){ zb.points.forEach(function(q){
            var d = Math.hypot(p.x-q.x, p.y-q.y);
            if(d < nd){ nd = d; nearest = {x:(p.x+q.x)/2, y:(p.y+q.y)/2}; }
          }); });
          mid = nearest;
          seg = [mid, mid];
          portalMissing++;
        } else {
          mid = portal.mid; seg = portal.seg;
        }
        // seg is ordered along za's own CCW winding: walking FROM za INTO zb,
        // seg[0] is LEFT and seg[1] is RIGHT; the reverse direction flips them.
        // переход через портал: от точки чуть внутри za до точки чуть внутри zb
        var ca = zoneCentroid(za), cb = zoneCentroid(zb);
        var la = Math.max(1, Math.hypot(ca.x-mid.x, ca.y-mid.y)), lb = Math.max(1, Math.hypot(cb.x-mid.x, cb.y-mid.y));
        var ea = Math.min(14, la), eb = Math.min(14, lb);
        var pA = {x: mid.x + (ca.x-mid.x)/la*ea, y: mid.y + (ca.y-mid.y)/la*ea};
        var pB = {x: mid.x + (cb.x-mid.x)/lb*eb, y: mid.y + (cb.y-mid.y)/lb*eb};
        if(segCrossesManualWalls(pA.x,pA.y,pB.x,pB.y)){
          // середина общего края упёрлась в стену (проход сужен выступом —
          // так было в Dark → Lamp Room после калибровки навмеша): ищем
          // открытую часть этого же края и идём через неё, а не рвём связь
          var ok = null;
          if(portal && Math.hypot(seg[1].x-seg[0].x, seg[1].y-seg[0].y) > 8){
            var ex = seg[1].x-seg[0].x, ey = seg[1].y-seg[0].y, eL = Math.hypot(ex, ey), nx = -ey/eL, ny = ex/eL;
            if((ca.x-mid.x)*nx + (ca.y-mid.y)*ny < 0){ nx = -nx; ny = -ny; }   // n смотрит в za
            [0.12,0.25,0.38,0.62,0.75,0.88].some(function(t){
              var m = {x: seg[0].x + ex*t, y: seg[0].y + ey*t};
              var qa = {x: m.x + nx*10, y: m.y + ny*10}, qb = {x: m.x - nx*10, y: m.y - ny*10};
              if(insideSolidWall(qa.x, qa.y) || insideSolidWall(qb.x, qb.y) || segCrossesManualWalls(qa.x, qa.y, qb.x, qb.y)) return false;
              ok = m; return true;
            });
          }
          if(!ok){ navCutPortals++; return; }
          mid = ok; seg = [ok, ok]; navNarrowPortals++;
        }
        zoneGraph[za.id].push({to:zb.id, mid:mid, z:zb.z, left:seg[0], right:seg[1]});
        zoneGraph[zb.id].push({to:za.id, mid:mid, z:za.z, left:seg[1], right:seg[0]});
        portalCount++;
      });
    });
  })();

  // стены — от руки (WALL_POLYS, см. applyWalls); wallSegs —
  // тот же массив MANUAL_WALLS, rebuildNav его не меняет
  wallSegs = MANUAL_WALLS;

  // any in-flight bot paths were computed against the previous geometry —
  // drop them so bots re-path against the new one instead of walking a now
  // possibly-wrong line (only matters once bots actually exist, i.e. on a
  // re-alignment, not the very first call at load).
  if(typeof bots !== "undefined"){
    bots.forEach(function(b){ b.path = []; b.pathIdx = 0; });
  }
}
rebuildNav();

// Binary min-heap priority queue — with ~2000 nav-area nodes (vs. ~60 hand
// zones before), the old "sort the whole array every pop" approach gets
// noticeably slow; a heap keeps each push/pop at O(log n).
function makeHeap(){
  var h = [];
  function less(i,j){ return h[i].d < h[j].d; }
  function up(i){ while(i>0){ var p=(i-1)>>1; if(!less(i,p)) break; var t=h[p];h[p]=h[i];h[i]=t; i=p; } }
  function down(i){
    for(;;){
      var l=2*i+1, r=2*i+2, s=i;
      if(l<h.length && less(l,s)) s=l;
      if(r<h.length && less(r,s)) s=r;
      if(s===i) break;
      var t=h[s];h[s]=h[i];h[i]=t; i=s;
    }
  }
  return {
    push: function(id,d){ h.push({id:id,d:d}); up(h.length-1); },
    pop: function(){ if(!h.length) return null; var top=h[0], last=h.pop(); if(h.length){ h[0]=last; down(0); } return top; },
    size: function(){ return h.length; }
  };
}
function zoneDijkstra(fromId, toId){
  if(fromId===toId) return [fromId];
  var dist = {}, prev = {}, visited = {};
  dist[fromId] = 0;
  var heap = makeHeap();
  heap.push(fromId, 0);
  while(heap.size()){
    var top = heap.pop();
    var u = top.id;
    if(visited[u]) continue;
    visited[u] = true;
    if(u===toId) break;
    var fromCentroid = zoneCentroid(zonesById[u]);
    (zoneGraph[u]||[]).forEach(function(edge){
      if(visited[edge.to]) return;
      var w = dist2(fromCentroid, edge.mid) + 40; // small fixed cost per portal crossing
      var alt = dist[u] + w;
      if(dist[edge.to]===undefined || alt<dist[edge.to]){
        dist[edge.to] = alt; prev[edge.to] = u; heap.push(edge.to, alt);
      }
    });
  }
  if(dist[toId]===undefined) return null;
  var path=[toId], cur=toId;
  while(cur!==fromId){ cur=prev[cur]; if(cur===undefined) return null; path.push(cur); }
  path.reverse();
  return path;
}

// ---------- funnel / string-pull (Simple Stupid Funnel Algorithm) ----------
// Turns the crude "walk through every portal midpoint" zigzag into a taut
// path that only bends where the corridor geometry actually forces it to —
// the standard technique for smoothing a navmesh corridor into a real path.
// Reference: the well-known "funnel algorithm" writeups (Mikko Mononen /
// Recast-Detour, originally Hertel & Mehlhorn's approach), reimplemented
// here directly against our portal segments rather than triangles.
function triarea2(a,b,c){ return (b.x-a.x)*(c.y-a.y) - (c.x-a.x)*(b.y-a.y); }
function vEq(a,b){ return Math.abs(a.x-b.x)<1e-6 && Math.abs(a.y-b.y)<1e-6; }
function funnel(corridor, start, end){
  // corridor: [{left:{x,y}, right:{x,y}, z}, ...] in travel order, one entry
  // per portal crossed — NOT including start/end themselves. Classic
  // Simple Stupid Funnel Algorithm; the `continue` after each restart is
  // load-bearing (skips re-testing the other side against a now-stale
  // portal index) — flattening this into an if/else without it silently
  // produces wrong paths, so it's kept as a while+continue rather than a
  // for loop.
  var n = corridor.length;
  var path = [{x:start.x,y:start.y}], pathZ = [start.z];
  var apex = start, left = start, right = start;
  var apexIdx = 0, leftIdx = 0, rightIdx = 0;
  function zAt(i){ return i<=0 ? start.z : (i>n ? end.z : corridor[i-1].z); }

  var i = 1;
  var guard = (n+2)*3 + 8; // hard cap so a malformed/self-crossing corridor can't hang the sim
  while(i <= n+1){
    if(guard-- <= 0) break;
    var L = (i>n) ? end : corridor[i-1].left;
    var R = (i>n) ? end : corridor[i-1].right;

    // funnel the right side
    if(triarea2(apex, right, R) <= 0){
      if(vEq(apex,right) || triarea2(apex, left, R) > 0){
        right = R; rightIdx = i;
      } else {
        path.push({x:left.x,y:left.y}); pathZ.push(zAt(leftIdx));
        apex = left; apexIdx = leftIdx;
        left = apex; right = apex; leftIdx = apexIdx; rightIdx = apexIdx;
        i = apexIdx + 1;
        continue;
      }
    }
    // funnel the left side
    if(triarea2(apex, left, L) >= 0){
      if(vEq(apex,left) || triarea2(apex, right, L) < 0){
        left = L; leftIdx = i;
      } else {
        path.push({x:right.x,y:right.y}); pathZ.push(zAt(rightIdx));
        apex = right; apexIdx = rightIdx;
        left = apex; right = apex; leftIdx = apexIdx; rightIdx = apexIdx;
        i = apexIdx + 1;
        continue;
      }
    }
    i++;
  }
  path.push({x:end.x,y:end.y}); pathZ.push(end.z);
  var out = [];
  for(var k=0;k<path.length;k++) out.push([path[k].x, path[k].y, pathZ[k]]);
  return out;
}

// waypoint path for a bot: zone-to-zone route -> funneled taut path through
// the shared portal edges -> final destination. Replaces the old "walk
// through every portal's exact midpoint" zigzag (that's what made movement
// look like it was snapping between fixed lines) with a proper corridor
// pull that only turns where the walls actually force a turn.
function buildWaypointPath(fromX, fromY, fromZ, toX, toY, toZ){
  var fz = zoneOf(fromX, fromY, fromZ||0), tz = zoneOf(toX, toY, toZ||0);
  if(!fz || !tz) return [[toX,toY,toZ||0]];
  if(fz.id === tz.id) return [[toX,toY,toZ||0]];
  var route = zoneDijkstra(fz.id, tz.id);
  if(!route) return [[toX,toY,toZ||0]]; // disconnected zones — direct line fallback rather than a stuck bot
  var corridor = [];
  for(var i=0;i<route.length-1;i++){
    var edge = (zoneGraph[route[i]]||[]).find(function(e){ return e.to===route[i+1]; });
    if(edge) corridor.push(edge);
  }
  if(!corridor.length) return [[toX,toY,toZ||0]];
  var path = funnel(corridor, {x:fromX,y:fromY,z:fromZ||0}, {x:toX,y:toY,z:toZ||0});
  // Проверка по стенам: funnel натягивает путь по геометрии НАВМЕША, а она
  // местами не совпадает с нарисованными стенами — натянутый отрезок может
  // срезать угол прямо сквозь стену. Если хоть один отрезок пересекает
  // стену — вместо натянутого пути идём через середины порталов (зигзаг, но
  // каждая точка гарантированно на переходе между проходимыми полигонами).
  var bad = false;
  for(var k=0;k<path.length-1;k++){
    if(segCrossesManualWalls(path[k][0],path[k][1],path[k+1][0],path[k+1][1])){ bad = true; break; }
  }
  if(bad){
    var mids = [];
    corridor.forEach(function(e){ mids.push([e.mid.x, e.mid.y, e.z]); });
    mids.push([toX, toY, toZ||0]);
    return mids;
  }
  // drop the leading point (== bot's current position, not a real waypoint)
  return path.slice(1);
}

function ccw(ax,ay,bx,by,cx,cy){ return (cy-ay)*(bx-ax) > (cx-ax)*(by-ay); }
function segIntersect(ax,ay,bx,by,cx,cy,dx,dy){
  return ccw(ax,ay,cx,cy,dx,dy) !== ccw(bx,by,cx,cy,dx,dy) && ccw(ax,ay,bx,by,cx,cy) !== ccw(ax,ay,bx,by,dx,dy);
}

// ---------- предрасчёт опасности (план §2) ----------
// "для каждой точки считаем множество других точек, которые её простреливают,
// один раз при загрузке карты (не каждый тик)". Гранулярность — именованные
// зоны из ZONEMAP (~60), а не ~2000 микро-областей навмеша: боты и будущие
// коллы (план §11) всё равно думают зонами ("вижу врага на zone31"), так что
// таблица опасности нужна на этом же уровне, не мельче.
// Известное упрощение: одна точка на зону (центроид) — у зон с вогнутой
// формой (например буквой Г вокруг угла) центроид иногда лежит не совсем
// точно, и такая зона может недосчитать пару LOS-связей у самой границы.
// Для целей взвешивания риска в слое 4/6 этого достаточно; если понадобится
// точнее — берём несколько сэмпл-точек на зону вместо одной.
function zoneMapCentroid(z){
  var cx=0, cy=0;
  z.points.forEach(function(p){ cx+=p.x; cy+=p.y; });
  return { x: cx/z.points.length, y: cy/z.points.length };
}
var ZONE_CENTROIDS = {};
ZONEMAP.zones.forEach(function(z){ ZONE_CENTROIDS[z.id] = zoneMapCentroid(z); });

var ZONE_DANGER = {}; // zoneId -> [zoneId, ...] — из каких зон простреливается данная (симметрично)
// Несколько точек на зону (а не один центр): у длинной или изогнутой зоны
// центр мог стоять за углом, и реальные прострелы с её края не находились.
// Точки — сетка внутри полигона зоны (шаг подстраивается под размер, до
// DANGER_SAMPLES штук), плюс центр. Зона A простреливается из B, если хотя бы
// одна пара точек (a из A, b из B) видит друг друга. Заодно считается "сила"
// — доля видящих пар (0..1): зона, которая видна почти целиком, опаснее той,
// у которой виден только край. Для наведения мышью сохраняется пара точек,
// через которую нашли прострел, — её и рисуем линией.
var DANGER_SAMPLES = 10;
var ZONE_SAMPLES = {}, ZONE_DANGER_W = {}, ZONE_DANGER_LINE = {};
function sampleZone(z){
  var pts = z.points, minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  pts.forEach(function(p){ if(p.x<minX)minX=p.x; if(p.y<minY)minY=p.y; if(p.x>maxX)maxX=p.x; if(p.y>maxY)maxY=p.y; });
  var c = zoneMapCentroid(z), out = [];
  if(pointInPoly(c.x, c.y, pts) && !insideSolidWall(c.x, c.y)) out.push(c);
  var area = (maxX-minX)*(maxY-minY);
  var step = Math.max(22, Math.sqrt(area/DANGER_SAMPLES));
  var grid = [];
  for(var x=minX+step/2; x<maxX; x+=step) for(var y=minY+step/2; y<maxY; y+=step){
    if(pointInPoly(x, y, pts) && !insideSolidWall(x, y)) grid.push({x:x, y:y});
  }
  // равномерно прореживаем до лимита
  var need = DANGER_SAMPLES - out.length;
  if(grid.length <= need) out = out.concat(grid);
  else for(var i=0;i<need;i++) out.push(grid[Math.floor(i*grid.length/need)]);
  if(!out.length) out.push(c);
  return out;
}
// v201: видимость — одно место (visParts, 10_vision.js): стоящий в точке a видит
// голову или тело стоящего в точке b (стены, укрытия, пол, потолки). Считается
// лениво — при первом показе слоя «опасность» и после правки карты/зон.
var ZONE_DANGER_DIRTY = true;
function computeZoneDanger(){ ZONE_DANGER_DIRTY = true; }
function zoneDangerReady(){
  if(!ZONE_DANGER_DIRTY) return;
  ZONE_DANGER_DIRTY = false;
  var zs = ZONEMAP.zones, ids = zs.map(function(z){ return z.id; });
  ids.forEach(function(id){ ZONE_DANGER[id] = []; ZONE_DANGER_W[id] = {}; ZONE_DANGER_LINE[id] = {}; });
  zs.forEach(function(z){ ZONE_SAMPLES[z.id] = sampleZone(z); });
  for(var i=0;i<ids.length;i++){
    for(var j=i+1;j<ids.length;j++){
      var A = ZONE_SAMPLES[ids[i]], B = ZONE_SAMPLES[ids[j]];
      var seen = 0, first = null;
      for(var a=0;a<A.length;a++) for(var b=0;b<B.length;b++){
        var pa = A[a], pb = B[b], v = visParts(pa.x, pa.y, false, pb.x, pb.y, false);
        if(v.head || v.body){ seen++; if(!first) first = [pa, pb]; }
      }
      if(seen > 0){
        var wgt = seen/(A.length*B.length);
        ZONE_DANGER[ids[i]].push(ids[j]); ZONE_DANGER[ids[j]].push(ids[i]);
        ZONE_DANGER_W[ids[i]][ids[j]] = wgt; ZONE_DANGER_W[ids[j]][ids[i]] = wgt;
        ZONE_DANGER_LINE[ids[i]][ids[j]] = [first[0], first[1]]; ZONE_DANGER_LINE[ids[j]][ids[i]] = [first[1], first[0]];
      }
    }
  }
}
var zoneLayerRebuildTimer = null;
function applyZoneLayer(heavy){
  applyZoneLayerToData();
  try{ localStorage.setItem(ZONE_LAYER_KEY, JSON.stringify(zoneLayer)); }catch(e){}
  // спавны: база — точки слоя (CT — сама точка ZONEMAP, T — исправленная)
  CT_SPAWN._baseX = CT_SPAWN.x; CT_SPAWN._baseY = CT_SPAWN.y;
  var tq = zlPt(T_SPAWN_FIX_RAW.x, T_SPAWN_FIX_RAW.y); T_SPAWN._baseX = tq.x; T_SPAWN._baseY = tq.y;
  if(!heavy){
    // тяжёлое (таблица опасности, сайты, маршруты) — с задержкой, пока тянешь мышью
    if(zoneLayerRebuildTimer) clearTimeout(zoneLayerRebuildTimer);
    zoneLayerRebuildTimer = setTimeout(function(){ zoneLayerRebuildTimer = null; applyZoneLayer(true); }, 300);
    return;
  }
  ZONEMAP.zones.forEach(function(z){ ZONE_CENTROIDS[z.id] = zoneMapCentroid(z); });
  computeZoneDanger();
  applyUserZones(); // пул точек, спавны (resnap), сайты
}
// стены — препятствие для движения (видимость — 10_vision.js); те же отрезки стен,
// что рисуются на радаре (см. стену-слайд в stepTick).
function crossesWall(x1,y1,x2,y2){
  for(var i=0;i<wallSegs.length;i++){
    var s = wallSegs[i];
    if(segIntersect(x1,y1,x2,y2,s[0],s[1],s[2],s[3])) return true;
  }
  return false;
}

// ---------- deterministic PRNG (no Math.random in sim) ----------
function hashRand(seed){
  var t = seed += 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------- tactical points ----------
var pointsByName = {};
ZONEMAP.points.forEach(function(p){ pointsByName[p.name] = p; });
var CT_SPAWN = pointsByName["CTspawn_6"];
var T_SPAWN = pointsByName["Tspawn_7"];
// Tspawn_7's stored point (1006,1892, from the Zone Editor) sits just past
// the traced map boundary near that corner — it was placed against the OLD
// wall trace, before the pen-tool correction pass, and never got moved with
// it (this confirms the earlier suspicion that the hand-drawn Zone Editor
// layer can drift out of sync with the walls once those get fixed up). Bots
// were spawning technically off the playable footprint. Re-anchored here to
// the centroid of the nearest actual navmesh polygon (id 1945) instead of
// trusting the stale hand-placed point — that's guaranteed-walkable ground
// truth, only ~32 units from the original, well inside the "Tspawn" zone.
var T_SPAWN_FIX_RAW = {x:1001.95, y:1860};
T_SPAWN = (function(){ var q = zlPt(T_SPAWN_FIX_RAW.x, T_SPAWN_FIX_RAW.y); return { x: q.x, y: q.y, z: T_SPAWN.z||0, name: T_SPAWN.name }; })();
// pool = every placed tactical point except the two spawns — sparse right now
// (9 points total), grows as you place more in the editor; nothing else to change here.
var POINT_POOL = ZONEMAP.points.filter(function(p){ return p!==CT_SPAWN && p!==T_SPAWN; });

// ---------- user-drawn zones (спавны/сайты, рисуются прямо здесь, пером) ----------
// Больше не полагаемся на отдельный артефакт Zone Editor — его данные (ZONEMAP)
// оказались рассинхронизированы со стенами (см. историю T_SPAWN выше) и
// правятся отдельно от того, что реально видно на этом радаре. Вместо
// повторного экспорта/импорта между артефактами — зоны спавнов и сайтов
// теперь можно рисовать прямо тут, тем же Photoshop-style инструментом, что
// и стены (клик — выделить, тащи тело — двигать, тащи уголок/колесо —
// масштаб, "перо" — редактировать точки). CT/T-спавн зоны автоматически
// подставляют CT_SPAWN/T_SPAWN (мутируя объект НА МЕСТЕ — боты держат ссылку
// на него, поэтому подхватывают новую позицию без пересоздания), сайты и
// прочие именованные зоны добавляются в POINT_POOL как тактические точки.
var USER_ZONES = []; // {id, name, kind:'ctspawn'|'tspawn'|'sitea'|'siteb'|'custom', basePoints:[{x,y}], closed:true, dx,dy,scale}
var USER_ZONES_KEY = "ancient-live-radar-userzones-v1";
var userZonesSaveTimer = null;
function saveUserZonesDebounced(){
  if(userZonesSaveTimer) clearTimeout(userZonesSaveTimer);
  userZonesSaveTimer = setTimeout(function(){
    try{ localStorage.setItem(USER_ZONES_KEY, JSON.stringify(USER_ZONES)); }catch(e){}
  }, 250);
}
function loadUserZones(){
  try{
    var raw = localStorage.getItem(USER_ZONES_KEY);
    if(!raw) return;
    var arr = JSON.parse(raw);
    if(Array.isArray(arr)) USER_ZONES = arr;
  }catch(e){}
}
loadUserZones();
// исправление данных из браузера: зона сайта A была нарисована с типом "сайт B"
// (две зоны "сайт B", ни одной "сайт A") — та, что на левой половине карты, это A
(function(){
  if(USER_ZONES.some(function(z){ return z.kind === "sitea"; })) return;
  var fixed = false;
  USER_ZONES.forEach(function(z){
    if(z.kind !== "siteb" || !z.basePoints || !z.basePoints.length) return;
    var cx = 0; z.basePoints.forEach(function(p){ cx += p.x; }); cx /= z.basePoints.length;
    if(cx < 1000){ z.kind = "sitea"; fixed = true; }
  });
  if(fixed){ try{ localStorage.setItem(USER_ZONES_KEY, JSON.stringify(USER_ZONES)); }catch(e){} }
})();

// у зоны свой dx/dy/scale вокруг собственного центра
function zoneObjAbsPoints(obj){
  var src = obj.basePoints;
  var cx=0, cy=0;
  src.forEach(function(p){ cx+=p.x; cy+=p.y; });
  cx/=src.length; cy/=src.length;
  return src.map(function(p){
    return { x:(p.x-cx)*obj.scale+cx+obj.dx, y:(p.y-cy)*obj.scale+cy+obj.dy };
  });
}
function zoneObjCentroid(obj){
  var pts = zoneObjAbsPoints(obj);
  var cx=0, cy=0;
  pts.forEach(function(p){ cx+=p.x; cy+=p.y; });
  return {x:cx/pts.length, y:cy/pts.length};
}
function zoneObjHandlePos(obj){
  var pts = zoneObjAbsPoints(obj);
  var maxX=-Infinity, maxY=-Infinity;
  pts.forEach(function(p){ if(p.x>maxX)maxX=p.x; if(p.y>maxY)maxY=p.y; });
  return {x:maxX, y:maxY};
}
function zoneBakeObjectTransform(obj){
  if(obj.dx!==0 || obj.dy!==0 || obj.scale!==1){
    obj.basePoints = zoneObjAbsPoints(obj);
    obj.dx = 0; obj.dy = 0; obj.scale = 1;
  }
}
var ZONE_KIND_LABELS = { ctspawn:"CT-спавн", tspawn:"T-спавн", sitea:"Сайт A", siteb:"Сайт B", roam_ct:"роум CT", roam_t:"роум T", custom:"своя точка" };
var ZONE_KIND_COLORS = {
  roam_ct: "rgba(120,200,255,0.9)", roam_t: "rgba(255,200,110,0.9)",
  ctspawn: "rgba(90,155,217,0.9)", tspawn: "rgba(232,150,70,0.9)",
  sitea: "rgba(232,90,90,0.9)", siteb: "rgba(200,90,232,0.9)", custom: "rgba(148,180,73,0.9)"
};
// применяет текущие USER_ZONES к игровому состоянию: спавны мутируются НА
// МЕСТЕ (см. комментарий выше), остальные (сайты/своё) — дописываются в
// POINT_POOL после исходных ZONEMAP.points, не трогая их.
var POINT_POOL_ZONEMAP_LEN = POINT_POOL.length;
function applyUserZones(){
  POINT_POOL.length = POINT_POOL_ZONEMAP_LEN;
  [CT_SPAWN, T_SPAWN].forEach(function(sp){
    if(sp._baseX === undefined){ sp._baseX = sp.x; sp._baseY = sp.y; }
    sp._wantX = sp._baseX; sp._wantY = sp._baseY;
  });
  USER_ZONES.forEach(function(z){
    if(!z.basePoints.length) return;
    var c = zoneObjCentroid(z);
    if(z.kind === "ctspawn"){ CT_SPAWN._wantX = c.x; CT_SPAWN._wantY = c.y; }
    else if(z.kind === "tspawn"){ T_SPAWN._wantX = c.x; T_SPAWN._wantY = c.y; }
    else if(z.kind === "roam_ct" || z.kind === "roam_t"){ /* маршрут роумера — не в общий пул, см. buildRoamRoutes */ }
    else { POINT_POOL.push({ name: z.name || ZONE_KIND_LABELS[z.kind], x: c.x, y: c.y, z: 0 }); }
  });
  resnapSpawns();
  if(SITES_READY) buildSites();
}
var SITES_READY = false; // true после первой сборки сайтов (04_sites.js): правка зон пересобирает сайты
// спавн внутри стены → ближайшее проходимое место. Желаемая точка хранится
// отдельно (_baseX — исходная, _wantX — с учётом нарисованной зоны спавна),
// чтобы при следующей правке стен пересчитывать от неё, а не от уже сдвинутой.
function resnapSpawns(){
  [CT_SPAWN, T_SPAWN].forEach(function(sp){
    var s2 = snapToWalkable(sp._wantX, sp._wantY);
    sp.x = s2.x; sp.y = s2.y;
  });
}
function spawnPosFor(sp, ox, oy){
  // разброс ботов вокруг точки спавна не должен выталкивать их за стену
  var x = sp.x+ox, y = sp.y+oy;
  if(insideSolidWall(x,y) || segCrossesManualWalls(sp.x,sp.y,x,y)) return {x:sp.x, y:sp.y};
  return {x:x, y:y};
}
applyUserZones();

