// ---------- (re)build everything derived from NAVAREAS: called once at load,
// and again whenever the align-mode UI (further down, near the canvas setup)
// moves/scales the whole navmesh to line it up with the radar image. Cheap
// per-point transform (applyNavTransform) runs on every drag/wheel tick for
// live visual feedback; this heavier rebuild (graph + both wall sets) is
// debounced to run only after the user stops adjusting. ----------
var NAV_BLOCKED = {}, navBlockedCount = 0, navCutPortals = 0, navNarrowPortals = 0;
// WALL_SOLID_POLYS — см. applyWalls выше
// (А5) у карты есть 3D-геометрия игры — «в стене» и «шаг сквозь стену» по ней (035_map3d: клетка без этажа и без навмеша);
// стены радара тогда — только рисование
function insideSolidWall(x, y){
  if(MAP3D) return m3Solid(x, y);
  for(var i=0;i<WALL_SOLID_POLYS.length;i++){
    if(pointInPoly(x, y, WALL_SOLID_POLYS[i])) return true;
  }
  return false;
}
function segCrossesManualWalls(x1,y1,x2,y2){
  if(MAP3D) return !!m3SolidHit(x1, y1, x2, y2);
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
  NAV_GRID = null; NAV_ZONE = null; M3_SOLID = null; LADDERS = null; PATHQ = {}; PATHQ_N = 0;   // (v321) сетка участков под точкой — пересобрать

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
  // (А5) по геометрии — навмеш из того же файла игры главный: участки не выкидываются, переходы не режутся (ниже)
  if(!MAP3D) NAVAREAS.forEach(function(z){
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
        if(!MAP3D && segCrossesManualWalls(pA.x,pA.y,pB.x,pB.y)){
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
        // (v320) связь в навмеше бывает односторонней — «только спрыгнуть» (в .nav есть za→zb, нет zb→za): по ней не
        // залезают обратно (Mirage: окно B Apps). Раньше граф был без направления
        if((za.conn||[]).indexOf(zb.id) >= 0) zoneGraph[za.id].push({to:zb.id, mid:mid, z:zb.z, left:seg[0], right:seg[1]});
        if((zb.conn||[]).indexOf(za.id) >= 0) zoneGraph[zb.id].push({to:za.id, mid:mid, z:za.z, left:seg[1], right:seg[0]});
        portalCount++;
      });
    });
  })();

  // Walls are no longer auto-derived from the navmesh at all — every attempt
  // at that (inset/MIN_KEEP tuning, then chain-stitching) kept trading one
  // failure mode for another (holes vs. chaotic noise vs. stuck-tick
  // regressions), so the user asked to place them by hand instead. wallSegs
  // and wallSegsLOS both point at the SAME array (MANUAL_WALLS, see the
  // manual-wall-editing UI further down) so drawing/deleting a wall there
  // takes effect immediately with no rebuild step needed. rebuildNav() only
  // touches the pathing graph now (zoneGraph/zonesById), never this array.
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
// (v259, В1) сторона карты у каждого куска навмеша: доля пути от спавна T к спавну CT (0 — у T, 1 — у CT).
// CT, когда идут (ротация, сбор, ретейк), обходят сторону T: кусок со стороной < ROUTE_SIDE_LINE (0,55 — спорные места у кейва, Lamp Room, T Upper тоже) дороже в ROUTE_ENEMY_SIDE раз
// (проектное число) — через сторону T пойдут, только если иначе заметно дальше.
var ROUTE_ENEMY_SIDE = 1.6, ROUTE_SIDE_LINE = 0.55, _zoneSide = null;
function zoneSideMap(){
  if(_zoneSide) return _zoneSide;
  var sssp = function(from){ var dist = {}, vis = {}; dist[from] = 0; var h = makeHeap(); h.push(from, 0);
    while(h.size()){ var u = h.pop().id; if(vis[u]) continue; vis[u] = true; var c = zoneCentroid(zonesById[u]);
      (zoneGraph[u]||[]).forEach(function(e){ if(vis[e.to]) return; var a = dist[u] + dist2(c, e.mid) + 40; if(dist[e.to] === undefined || a < dist[e.to]){ dist[e.to] = a; h.push(e.to, a); } }); }
    return dist; };
  var zt = zoneOf(T_SPAWN.x, T_SPAWN.y, 0), zc = zoneOf(CT_SPAWN.x, CT_SPAWN.y, 0);
  if(!zt || !zc) return (_zoneSide = {});
  var DT = sssp(zt.id), DC = sssp(zc.id), out = {};
  Object.keys(zonesById).forEach(function(id){ if(DT[id] !== undefined && DC[id] !== undefined) out[id] = DT[id]/(DT[id] + DC[id] + 1e-9); });
  return (_zoneSide = out);
}
// (v336, владелец: «прыгают на рандом, где не нужно, и палятся») переход с прыжком на уступ или со спрыгиванием громкий
// (приземление слышно далеко) — путь идёт через него, только если обход заметно длиннее. Раньше цена прыжка была 0, и путь
// вёл через каждый ящик и бортик напрямик. NAV_JUMP_COST / NAV_DROP_COST — ед. карты (~2,5 ед. игры), проектные числа:
// прыжок ≈ 1,2 с бега в обход, спрыгнуть ≈ 0,6 с
var NAV_JUMP_COST = 120, NAV_DROP_COST = 60;
function navJumpCost(a, edge){
  if(edge._jcost != null) return edge._jcost;
  var b = zonesById[edge.to]; if(!a || !b || !edge.mid) return (edge._jcost = 0);
  if(navPlane(a).flat || navPlane(b).flat) return (edge._jcost = 0);   // нет высот углов (Ancient) — как раньше
  var dz = navStepDz(a, b, edge.mid.x, edge.mid.y);
  return (edge._jcost = dz > 18 ? NAV_JUMP_COST : dz < -40 ? NAV_DROP_COST : 0);
}
function zoneDijkstra(fromId, toId, team){
  if(fromId===toId) return [fromId];
  var side = team === "CT" ? zoneSideMap() : null;
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
      var w = dist2(fromCentroid, edge.mid) + 40 + navJumpCost(zonesById[u], edge); // small fixed cost per portal crossing
      if(side && side[edge.to] !== undefined && side[edge.to] < ROUTE_SIDE_LINE) w *= ROUTE_ENEMY_SIDE;   // (v259) CT — по своей стороне
      var alt = dist[u] + w;
      if(dist[edge.to]===undefined || alt<dist[edge.to]){
        dist[edge.to] = alt; prev[edge.to] = u; heap.push(edge.to, alt);
      }
    });
  }
  if(dist[toId]===undefined){
    if(!zoneDijkstra.nearest) return null;
    // (v375) цель недостижима — ближайший к ней участок, до которого путь есть (см. buildWaypointPath)
    var tc = zoneCentroid(zonesById[toId]), bestN = null, bd = Infinity;
    Object.keys(visited).forEach(function(k){ var c = zoneCentroid(zonesById[k]); if(!c) return; var d = Math.hypot(c.x-tc.x, c.y-tc.y); if(d < bd){ bd = d; bestN = k; } });
    if(bestN == null) return null; toId = isNaN(+bestN) ? bestN : +bestN;
  }
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
function buildWaypointPath(fromX, fromY, fromZ, toX, toY, toZ, team){
  // (v341, отметка владельца: karrigan в щели у края нижнего пола — путь начинался с верхней полоски (−140) над ним, туда хода
  // нет, бот уходил с пола и его переносило по кругу) начало пути — пол рядом на высоте бота, а не ближайший центр участка
  var fz = fromZ != null ? navAt(fromX, fromY, fromZ) : null;
  if(fromZ != null && (!fz || Math.abs(fz.z - fromZ) > JUMP_UP)) fz = navNearestZ(fromX, fromY, NAV_GAP_TOL, fromZ);   // под точкой чужой этаж — свой рядом
  if(fz && !(zoneGraph[fz.id]||[]).length) fz = null;   // участок без переходов — маршрута от него нет (была прямая сквозь всё)
  if(fz && fromZ != null && Math.abs(fz.z - fromZ) > JUMP_UP) fz = null;
  // (v347) своего пола в щели нет (стоит за краем Short) — свой уровень в 40 ед., а не участок под ним (Underpass): иначе путь
  // начинался внизу, и падение считалось «спуском по пути»
  if(!fz && fromZ != null) fz = navFloorNear(fromX, fromY, 40, function(a){ return Math.abs(a.z - fromZ) <= JUMP_UP && (zoneGraph[a.id]||[]).length; });
  fz = fz || zoneOf(fromX, fromY, fromZ||0);
  // (v347, отметка владельца: magixx шёл к посту (z 0) — под целью брался уступ −50 вместо пола Short −168, маршрута не было, путь
  // выродился в прямую через край, и он «провалился») высота цели не задана — пол цели на уровне бота; маршрута нет — другие
  // этажи под целью, и только потом прямая
  var tLvl = toZ ? toZ : (fz ? fz.z : 0);
  var tz = (navAt(toX, toY, tLvl) && Math.abs(navAt(toX, toY, tLvl).z - tLvl) <= JUMP_UP ? navAt(toX, toY, tLvl) : null) || navNearestZ(toX, toY, NAV_GAP_TOL, tLvl) || zoneOf(toX, toY, tLvl);
  if(!fz || !tz) return [[toX,toY,toZ||0]];
  if(fz.id === tz.id) return [[toX,toY,toZ||0]];
  var route = zoneDijkstra(fz.id, tz.id, team);
  if(!route){ if(!NAV_GRID) navGridBuild();
    var alts = (NAV_GRID[Math.floor(toX/NAV_GRID_C)+","+Math.floor(toY/NAV_GRID_C)]||[]).map(function(i){ return NAVAREAS[i]; })
      .filter(function(a){ return a !== tz && !NAV_BLOCKED[a.id] && pointInPoly(toX, toY, a.points); }).sort(function(a, c){ return Math.abs(a.z - tLvl) - Math.abs(c.z - tLvl); });
    for(var ai=0; ai<alts.length && !route; ai++){ route = zoneDijkstra(fz.id, alts[ai].id, team); if(route) tz = alts[ai]; } }
  // (v375, отметка владельца: T0 на Tetris «застревает, его выкидывает, прыгает» — бомба лежала там, куда пути по навмешу нет;
  // раньше шёл по прямой к цели, в ящик/стену, и бился о него; сторож: «застой» с путём из одной точки) цели не достичь —
  // путь к ближайшему достижимому месту рядом с ней
  if(!route){ zoneDijkstra.nearest = true; route = zoneDijkstra(fz.id, tz.id, team); zoneDijkstra.nearest = false;
    if(route && route[route.length-1] !== tz.id){ var lz = zonesById[route[route.length-1]]; if(lz){ var lc = zoneCentroid(lz); toX = lc.x; toY = lc.y; toZ = lz.z; tz = lz; } } }
  if(!route) return [[toX,toY,toZ||0]]; // disconnected zones — direct line fallback rather than a stuck bot
  var corridor = [], cPair = [];   // cPair — участки по обе стороны перехода (v340)
  for(var i=0;i<route.length-1;i++){
    var edge = (zoneGraph[route[i]]||[]).find(function(e){ return e.to===route[i+1]; });
    if(edge){ corridor.push(edge); cPair.push([route[i], route[i+1]]); }
  }
  if(!corridor.length) return [[toX,toY,toZ||0]];
  // (v340, отметка владельца: sh1ro «пытается запрыгнуть, а его отталкивает») натянутый путь срезал угол мимо ступеньки, по
  // которой только и можно подняться, — под край верхнего пола (+96, выше прыжка), и бот стоял у стены. Теперь на каждом
  // подъёме-прыжке (> 18 ед. у края, navStepDz) путь проходит через середину перехода; нить натягивается между ними.
  // Без высот углов (Ancient) — как раньше
  var start0 = {x:fromX,y:fromY,z:fromZ||0}, end0 = {x:toX,y:toY,z:toZ||0}, cuts = [];
  for(var ci=0;ci<corridor.length;ci++){ var cA = zonesById[cPair[ci][0]], cB = zonesById[cPair[ci][1]], ce = corridor[ci];
    if(cA && cB && ce.mid && !navPlane(cA).flat && !navPlane(cB).flat && navStepDz(cA, cB, ce.mid.x, ce.mid.y) > 18) cuts.push(ci); }
  var path;
  if(!cuts.length) path = funnel(corridor, start0, end0);
  else { path = []; var sP = start0, prevC = 0;
    cuts.concat([corridor.length]).forEach(function(ci2){ var eP = ci2 < corridor.length ? {x:corridor[ci2].mid.x, y:corridor[ci2].mid.y, z:corridor[ci2].z} : end0;
      var seg = funnel(corridor.slice(prevC, ci2), sP, eP); path = path.concat(path.length ? seg.slice(1) : seg); sP = eP; prevC = ci2 + 1; }); }
  // Проверка по стенам: funnel натягивает путь по геометрии НАВМЕША, а она
  // местами не совпадает с нарисованными стенами — натянутый отрезок может
  // срезать угол прямо сквозь стену. Если хоть один отрезок пересекает
  // стену — вместо натянутого пути идём через середины порталов (зигзаг, но
  // каждая точка гарантированно на переходе между проходимыми полигонами).
  var bad = false;
  for(var k=0;k<path.length-1;k++){
    if(segCrossesManualWalls(path[k][0],path[k][1],path[k+1][0],path[k+1][1])){ bad = true; break; }
  }
  // (v373, сторож: «застой» — бот с путём стоит у ящика: натянутый отрезок срезал угол через участок выше (ящик, уступ) вне
  // коридора, а шаг туда не пускает по высоте — путь заново тот же). Отрезок, который уходит с участков коридора на участок
  // другой высоты (> JUMP_UP), — тоже «плохой»: идём через середины переходов
  if(!bad){ if(!NAV_GRID) navGridBuild();
    var inR = {}; route.forEach(function(id){ inR[id] = 1; });
    for(var k2=0;k2<path.length-1 && !bad;k2++){ var A = path[k2], B = path[k2+1], dd = Math.hypot(B[0]-A[0], B[1]-A[1]), ns = Math.ceil(dd/8);
      for(var j=1;j<ns && !bad;j++){ var t = j/ns, x = A[0]+(B[0]-A[0])*t, y = A[1]+(B[1]-A[1])*t, zz = (A[2]||0)+((B[2]||0)-(A[2]||0))*t;
        var L = NAV_GRID[Math.floor(x/NAV_GRID_C)+","+Math.floor(y/NAV_GRID_C)] || [], hit = false, other = false;
        for(var q=0;q<L.length;q++){ var ar = NAVAREAS[L[q]]; if(NAV_BLOCKED[ar.id] || !pointInPoly(x, y, ar.points)) continue; if(inR[ar.id]) hit = true; else if(Math.abs(ar.z - zz) > JUMP_UP) other = true; else hit = true; }
        if(other && !hit) bad = true; } } }
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
// (v241) видимость между двумя точками — глаза стоящего человека с обеих сторон, в 3D (стены, укрытия,
// пол и уступы, крыши — visLine). Раньше — только плоские отрезки стен
// z1, z2 — высоты концов, если известны (бот): пол — его этаж, а не верхний (М140, Н2: под балконом Shadow, в Underpass
// взгляд, позиции и «откуда простреливается» считались с глаз на верхнем полу)
function hasLOS(x1,y1,x2,y2,z1,z2){
  return visLine(x1, y1, visFloorAt(x1, y1, z1) + VIS_EYE.stand, x2, y2, visFloorAt(x2, y2, z2) + VIS_EYE.stand, false);
}

