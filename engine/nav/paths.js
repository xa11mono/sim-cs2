// [хозяева: navCutTall, navEdgeDz, navGapsAdd, navJumpCost, rebuildNav] ---------- (re)build everything derived from NAVAREAS: called once at load,
// and again whenever the align-mode UI (further down, near the canvas setup)
// moves/scales the whole navmesh to line it up with the radar image. Cheap
// per-point transform (applyNavTransform) runs on every drag/wheel tick for
// live visual feedback; this heavier rebuild (graph + both wall sets) is
// debounced to run only after the user stops adjusting. ----------
var NAV_DROP_MAX = 200, NAV_DROP_OUT = 6, NAV_DROP_EDGE_STEP = 8, navDropLinks = 0;   // (18.11) спрыгнуть с края: ед. игры / ед. карты / шаг проверки края — проектные числа. (Т-3, 25.11) шаг края — своё имя: было NAV_DROP_STEP, как и порог обрыва (576, = 24) — одна переменная с двумя смыслами; при загрузке граф строился с 8, перестройка из редактора — с 24
var NAV_FLOOR_TOL = 24, NAV_RIDGE_W = 6, NAV_RIDGE_SIDE = 4, NAV_LINK_MIN = 6, NAV_LINK_KNEE = 16, navAutoLinks = 0;   // ед. игры / ед. карты — проектные числа (v405)
var NAV_BLOCKED = {}, navBlockedCount = 0, navCutPortals = 0, navNarrowPortals = 0;
// WALL_SOLID_POLYS — см. applyWalls выше
// (А5) у карты есть 3D-геометрия игры — «в стене» и «шаг сквозь стену» по ней (geometry3d: клетка без этажа и без навмеша);
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
    var d = DM.hypot(c.x-x, c.y-y);
    if(d < bd){ bd = d; best = c; }
  });
  return best ? {x:best.x, y:best.y} : {x:x, y:y};
}
var NAV_JUMP_UP = 64;   // (v533) ед. игры: выше без помощи не запрыгнуть — одно число для графа (нужно уже при загрузке) и движения (JUMP_UP, levels)
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
  NAV_GRID = null; NAV_ZONE = null; M3_SOLID = null; laddersReset(); pathCacheReset();   // (v321) сетка участков под точкой — пересобрать

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
  // (v405, отметка владельца 22.10, Mirage у Palace Entry: путь шёл по верху стены на −42 — «там забор так не перепрыгнуть») с 3D-
  // геометрией: участок .nav, под которым в геометрии нет пола на его высоте (± NAV_FLOOR_TOL) ни в центре, ни в четырёх точках
  // между центром и краями, — верх стены / перил шириной в несколько единиц (генератор навмеша игры ставит участки и туда), не место,
  // где ходят: выкидывается из графа. Mirage — 24 участка из 2544
  // (v549, владелец 11.11: «прыжки в окно и из окна к Ladder — они должны быть в демках») участок, на котором по демкам стоят игроки (конец
  // подъёма или прыжка через щель из демок, climbs.json), не выкидывается, даже если в 3D-геометрии там нет пола: Mirage, ящик −92 у Window —
  // в геометрии его нет, а про прыгают на него и с него (33–91 раз)
  var demoFloor = {}; if(MAP.climbs){ (MAP.climbs.climbs || []).forEach(function(c){ demoFloor[c.lo.area] = demoFloor[c.hi.area] = 1; if(c.mid && c.mid.area != null) demoFloor[c.mid.area] = 1; });
    (MAP.climbs.gaps || []).forEach(function(g){ demoFloor[g.a.area] = demoFloor[g.b.area] = 1; }); }
  if(MAP3D){ var M3b = m3();
    NAVAREAS.forEach(function(z){ if(demoFloor[z.id]) return; var xs = z.points.map(function(p){ return p.x; }), ys = z.points.map(function(p){ return p.y; });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), cx = (x0+x1)/2, cy = (y0+y1)/2;
      var has = [[0,0],[0.3,0],[-0.3,0],[0,0.3],[0,-0.3]].some(function(o){ return m3Floors(M3b, cx + o[0]*(x1-x0), cy + o[1]*(y1-y0)).some(function(fz){ return Math.abs(fz - z.z) <= NAV_FLOOR_TOL; }); });
      if(!has){ NAV_BLOCKED[z.id] = true; navBlockedCount++; return; }
      // гребень — тонкий участок (уже NAV_RIDGE_W ед. карты) на верху стенки / перил: по обе стороны поперёк него (± NAV_RIDGE_SIDE) пол
      // в геометрии ниже его больше чем на ступеньку (18) — человек там не стоит и не идёт (Mirage: стенка между спуском со спавна T
      // и T Ramp, −144: путь шёл по ней, боты вставали на её краю). Ступени и края пола — с одной стороны свой уровень, не гребень
      var wX = x1 - x0, wY = y1 - y0; if(Math.min(wX, wY) >= NAV_RIDGE_W) return;
      var ux = wX < wY ? 1 : 0, uy = 1 - ux, top = function(px, py){ var f = m3Floors(M3b, px, py), b = -1e9; f.forEach(function(fz){ if(fz <= z.z + 18 && fz > b) b = fz; }); return b; };
      var hw = Math.min(wX, wY)/2 + NAV_RIDGE_SIDE;
      if(top(cx + ux*hw, cy + uy*hw) < z.z - 18 && top(cx - ux*hw, cy - uy*hw) < z.z - 18){ NAV_BLOCKED[z.id] = true; navBlockedCount++; } }); }

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
            var d = DM.hypot(p.x-q.x, p.y-q.y);
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
        var la = Math.max(1, DM.hypot(ca.x-mid.x, ca.y-mid.y)), lb = Math.max(1, DM.hypot(cb.x-mid.x, cb.y-mid.y));
        var ea = Math.min(14, la), eb = Math.min(14, lb);
        var pA = {x: mid.x + (ca.x-mid.x)/la*ea, y: mid.y + (ca.y-mid.y)/la*ea};
        var pB = {x: mid.x + (cb.x-mid.x)/lb*eb, y: mid.y + (cb.y-mid.y)/lb*eb};
        if(!MAP3D && segCrossesManualWalls(pA.x,pA.y,pB.x,pB.y)){
          // середина общего края упёрлась в стену (проход сужен выступом —
          // так было в Dark → Lamp Room после калибровки навмеша): ищем
          // открытую часть этого же края и идём через неё, а не рвём связь
          var ok = null;
          if(portal && DM.hypot(seg[1].x-seg[0].x, seg[1].y-seg[0].y) > 8){
            var ex = seg[1].x-seg[0].x, ey = seg[1].y-seg[0].y, eL = DM.hypot(ex, ey), nx = -ey/eL, ny = ex/eL;
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

  // (v406, владелец 22.10: «зачем все идут в одну точку, а не прямо вниз» — спавн T → T Ramp на Mirage) в .nav игры у соседних участков,
  // между которыми ровный пол, связи бывает нет (край спавна, y 864: вниз — только через угловой участок, все пути шли в угол). С 3D-
  // геометрией: соседние участки с общим краем ≥ NAV_LINK_MIN, у которых пол на краю на одной высоте (± 18 — ступенька) и проход на
  // уровне колен (NAV_LINK_KNEE над полом) свободен по геометрии (visLine), — связываются в обе стороны. Числа — проектные
  navAutoLinks = 0;
  if(MAP3D){ if(!NAV_GRID) navGridBuild(); var seenL = {};
    var linkedAB = function(a, b){ return (zoneGraph[a.id]||[]).some(function(e){ return e.to === b.id; }) || (zoneGraph[b.id]||[]).some(function(e){ return e.to === a.id; }); };
    NAVAREAS.forEach(function(za){ if(NAV_BLOCKED[za.id]) return;
      var cand = {}, P = za.points;
      P.forEach(function(p, i){ var q = P[(i+1)%P.length]; [[p.x, p.y], [(p.x+q.x)/2, (p.y+q.y)/2]].forEach(function(s){
        (NAV_GRID[Math.floor(s[0]/NAV_GRID_C)+","+Math.floor(s[1]/NAV_GRID_C)] || []).forEach(function(k){ cand[NAVAREAS[k].id] = NAVAREAS[k]; }); }); });
      for(var kid in cand){ var zb = cand[kid]; if(zb === za || NAV_BLOCKED[zb.id]) continue;
        var key = za.id < zb.id ? za.id+"|"+zb.id : zb.id+"|"+za.id; if(seenL[key]) continue; seenL[key] = 1;
        if(linkedAB(za, zb)) continue;
        var pt = computePortal(za, zb); if(!pt) continue;
        var sg = pt.seg; if(DM.hypot(sg[1].x-sg[0].x, sg[1].y-sg[0].y) < NAV_LINK_MIN) continue;
        var m = pt.mid, zA = navFloorZ(za, m.x, m.y), zB = navFloorZ(zb, m.x, m.y); if(Math.abs(zA - zB) > 18) continue;
        var ca = zoneCentroid(za), cb = zoneCentroid(zb), la = Math.max(1, DM.hypot(ca.x-m.x, ca.y-m.y)), lb = Math.max(1, DM.hypot(cb.x-m.x, cb.y-m.y));
        var ea = Math.min(6, la), eb = Math.min(6, lb), pA = {x: m.x + (ca.x-m.x)/la*ea, y: m.y + (ca.y-m.y)/la*ea}, pB = {x: m.x + (cb.x-m.x)/lb*eb, y: m.y + (cb.y-m.y)/lb*eb};
        if(!visLine(pA.x, pA.y, zA + NAV_LINK_KNEE, pB.x, pB.y, zB + NAV_LINK_KNEE)) continue;
        zoneGraph[za.id].push({to:zb.id, mid:m, z:zb.z, left:sg[0], right:sg[1]});
        zoneGraph[zb.id].push({to:za.id, mid:m, z:za.z, left:sg[1], right:sg[0]});
        navAutoLinks++; } }); }
  // (отметка владельца 18.11, м5 р1, T4 на Balcony: «доходит до края, разворачивается и идёт к месту спрыгивания — зачем, если можно просто
  // шагнуть вперёд и упасть?») в .nav игры спрыгнуть с края верхнего пола можно только там, где Valve поставили связь, и где прыгали про в
  // демках (MAP.climbs.gaps). Теперь — с любого открытого края: за краем участка (NAV_DROP_OUT) своего пола нет, ниже — пол другого участка
  // (перепад от ступеньки до NAV_DROP_MAX), бортика нет (3D-геометрия на уровне колен и груди, visLine) — связь «спрыгнуть» A → B (в одну
  // сторону). Отрезок связи — самый длинный открытый кусок края. Числа — проектные (NAV_DROP_MAX — падение без урона в CS2, порог не проверен)
  navDropLinks = 0;
  if(MAP3D){ var dropBest = {};
    NAVAREAS.forEach(function(za){ if(NAV_BLOCKED[za.id]) return; var P = za.points, c0 = zoneCentroid(za);
      P.forEach(function(p, i){ var q = P[(i+1)%P.length], L = DM.hypot(q.x-p.x, q.y-p.y); if(L < 4) return;
        var ux = (q.x-p.x)/L, uy = (q.y-p.y)/L, nx = uy, ny = -ux; if((c0.x-p.x)*nx + (c0.y-p.y)*ny > 0){ nx = -nx; ny = -ny; }   // наружу
        var run = null, flush = function(){ if(run && run.n >= 2){ var k = za.id + ">" + run.b.id, len = DM.hypot(run.q.x-run.p.x, run.q.y-run.p.y);
            if(!dropBest[k] || dropBest[k].len < len) dropBest[k] = {a: za, b: run.b, p: run.p, q: run.q, len: len}; } run = null; };
        for(var t = 2; t <= L - 2; t += NAV_DROP_EDGE_STEP){ var ex = p.x + ux*t, ey = p.y + uy*t, ox = ex + nx*NAV_DROP_OUT, oy = ey + ny*NAV_DROP_OUT, ix = ex - nx*3, iy = ey - ny*3;
          var zA = navFloorZ(za, ex, ey), own = navAt(ox, oy, zA), zb = navAt(ox, oy, zA - NAV_DROP_MAX), ok = false;
          if(!(own && Math.abs(own.z - zA) <= 18) && zb && zb !== za && !NAV_BLOCKED[zb.id]){ var dz = zA - navFloorZ(zb, ox, oy);
            if(dz > 18 && dz <= NAV_DROP_MAX && visLine(ix, iy, zA + NAV_LINK_KNEE, ox, oy, zA + NAV_LINK_KNEE) && visLine(ix, iy, zA + 40, ox, oy, zA + 40)) ok = true; }
          if(ok && run && run.b === zb){ run.q = {x: ex, y: ey}; run.n++; }
          else { flush(); if(ok) run = {b: zb, p: {x: ex, y: ey}, q: {x: ex, y: ey}, n: 1}; } }
        flush(); }); });
    Object.keys(dropBest).forEach(function(k){ var D = dropBest[k];
      if((zoneGraph[D.a.id]||[]).some(function(e){ return e.to === D.b.id; })) return;
      zoneGraph[D.a.id].push({to: D.b.id, mid: {x: (D.p.x+D.q.x)/2, y: (D.p.y+D.q.y)/2}, z: D.b.z, left: D.p, right: D.q, drop: 1}); navDropLinks++; }); }
  // (v533, владелец 10.11: «залезают на уступ, куда забраться невозможно») в .nav игры есть связи «вверх» выше прыжка (Mirage 13, Ancient 11):
  // путь шёл по ним, и высота менялась сразу. Подняться выше прыжка можно только по лестнице (.nav ladders) или подъёмом из демок (там бот
  // лезет — ladderTick); остальные такие связи из графа убраны
  navTallDone = false;   // (v533) связи выше прыжка снимаются при первом поиске пути (navCutTall): при загрузке 3D-пол ещё не готов

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
    bots.forEach(function(b){ movePath(b, [], "nav-rebuild"); b.pathIdx = 0; });
    // (Т-4, 25.11, У-14) перестройка во время игры (редактор карты): связи выше прыжка снимаются сразу, а не при первом поиске пути —
    // иначе до него граф читали с несрезанными связями. При загрузке (ботов ещё нет, paths:254) — как было: срез при первом поиске пути
    // (laddersBuild нужен файл 370, он ещё не загружен); единственный читатель до среза при загрузке — snapToWalkable (только «есть ли
    // связи у участка»), срез ни один участок связей не лишает (Ancient −11 из 5967, Mirage −22 из 7884) — rebuild/evidence/R3/t4.json
    if(!navTallDone) navCutTall();
  }
}
// при загрузке rebuildNav вызывает mapBoot (zone-danger) — после стен, до таблицы «откуда простреливается» (Р3.4)

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
// LAND_DELAY — время полёта при запрыгивании (CS2: прыжок ~0,6 с вверх-вниз; вверх на уступ — короче) — проектное число. Звук приземления
// через столько после прыжка (tick); с v546 — и цена прыжка в пути (navJumpCost; здесь, потому что путь ищут уже при загрузке)
var LAND_DELAY = 0.35;
// (v469, п.5 владельца 29.10: «спрыгивают со звуком с любого уступа») UNVERIFIED: project heuristic, not confirmed CS2 threshold — проектное
// число. Ответ про-аналитика 29.10: маленькое падение события приземления не даёт (спецификация CS2-демок), порога в единицах Valve не
// публикует; 48 ед. — начальная настройка до проверки по демкам с player_footstep (land). Спуск ниже — тихо и шагом, и бегом (шаги —
// отдельно); выше — звук приземления (слышимость — отдельно, landSound, 370). Раньше порог 40 и «приземление громкое всегда» (v322, csdb.gg)
var LAND_SOUND_DROP = 48;
var navTallCut = 0, navTallDone = false, NAV_LAD = {};   // NAV_LAD — связи лестниц .nav ("a>b"), v546
function navCutTall(){ navTallDone = true; navTallCut = 0;
  (function(){ var lad = NAV_LAD = {}, climbOk = {}; if(!LADDERS) laddersBuild(); LADDERS.forEach(function(L){ if(L.up) climbOk[L.lo.area+">"+L.hi.area] = 1; });
    ((MAP.navmesh && MAP.navmesh.ladders) || []).forEach(function(l){ var S = (l.below||[]).concat(l.above||[]); S.forEach(function(a){ S.forEach(function(b){ lad[a+">"+b] = 1; }); }); });
    for(var id in zoneGraph){ var A = zonesById[id]; if(!A) continue;
      zoneGraph[id] = zoneGraph[id].filter(function(e){ if(NAV_CLIMB_UP[id+">"+e.to] && !climbOk[id+">"+e.to]){ navTallCut++; return false; }   // (v542) подъём из демок, отброшенный по 3D (laddersBuild), — и связи нет
        if(!e.mid || lad[id+">"+e.to] || NAV_CLIMB_UP[id+">"+e.to]) return true;
        if(navEdgeDz(A, e) <= NAV_JUMP_UP) return true; navTallCut++; return false; }); } })();
  navGapsAdd();
}
// (v546, владелец 10.11, Mirage A: «залезает на ящик, на второй и прыгает на верхний этаж — так быстрее») прыжки через щель из демок
// (MAP.climbs.gaps, tools/map/gaps_bake.py): в .nav между участками за щелью связи нет. Связь A → B — в граф пути (edge.gap); путь идёт через
// точку отталкивания и точку приземления, сам прыжок — ladderTick (levels), как подъём из демок. Между точками по 3D-геометрии должен быть
// воздух: над сплошным полом (меньше GAP_AIR_MIN отсчётов из 9 без пола на высоте прыжка) это дыра навмеша, а не щель — связи нет.
// GAP_AIR_MIN — проектное число
var NAV_GAPS = [], NAV_GAP_AT = {}, GAP_AIR_MIN = 3, GAP_WALK_N = 3;   // GAP_WALK_N — сколько прыжков с шага в демках, чтобы считать «можно на шифте» (проектное)
function navGapKey(x, y){ return Math.round(x*2) + "," + Math.round(y*2); }
function navGapsAdd(){
  NAV_GAPS = []; NAV_GAP_AT = {};
  var M = typeof m3 === "function" ? m3() : null;
  ((MAP.climbs && MAP.climbs.gaps) || []).forEach(function(g){
    var A = zonesById[g.a.area], B = zonesById[g.b.area]; if(!A || !B || NAV_BLOCKED[A.id] || NAV_BLOCKED[B.id]) return;
    var pa = pointInPoly(g.a.x, g.a.y, A.points) ? {x: g.a.x, y: g.a.y} : navClampInto(A, g.a.x, g.a.y);
    var pb = pointInPoly(g.b.x, g.b.y, B.points) ? {x: g.b.x, y: g.b.y} : navClampInto(B, g.b.x, g.b.y);
    var za = navFloorZ(A, pa.x, pa.y), zb = navFloorZ(B, pb.x, pb.y);
    if(M){ var air = 0; for(var i = 1; i < 10; i++){ var t = i/10, z = za + (zb - za)*t;
        if(!m3Floors(M, pa.x + (pb.x - pa.x)*t, pa.y + (pb.y - pa.y)*t).some(function(f){ return Math.abs(f - z) <= NAV_FLOOR_TOL; })) air++; }
      if(air < GAP_AIR_MIN) return; }
    // (v548) как летят про (gaps_bake): угол взгляда при отталкивании / приземлении к направлению прыжка (yaw0 / yaw1, °) и прогиб дуги (bow)
    var G = {a: {x: pa.x, y: pa.y, z: za, area: A.id}, b: {x: pb.x, y: pb.y, z: zb, area: B.id}, sec: g.sec, yaw0: g.yaw0 || 0, yaw1: g.yaw1 || 0, bow: g.bow || 0,
      walkOk: (g.walk || 0)*(g.n || 0) >= GAP_WALK_N};   // (v549) углы — на карте; walkOk — про прыгают здесь и с шага (на шифте — тихо)
    zoneGraph[A.id] = (zoneGraph[A.id] || []).filter(function(e){ return e.to !== B.id; });
    zoneGraph[A.id].push({to: B.id, mid: {x: pa.x, y: pa.y}, z: B.z, left: {x: pa.x, y: pa.y}, right: {x: pa.x, y: pa.y}, gap: G});
    NAV_GAPS.push(G); NAV_GAP_AT[navGapKey(pb.x, pb.y)] = G; });
}
// (v546, владелец 10.11: «чтобы бот мог выбирать разные пути: спрыгнуть, спуститься по ящикам, по лестнице — в разных ситуациях») цена
// перехода = время + шум по режиму бота (контекст поиска ctx.quiet — бот идёт шагом, решение хозяина шага 535): прыжок / приземление стоит время
// LAND_DELAY с бега; лестница — время подъёма (шагом — медленнее); громкое (прыжок через щель, спрыгнуть выше LAND_SOUND_DROP) для того,
// кто идёт тихо, — прежние NAV_JUMP_COST / NAV_DROP_COST (обход, только если он заметно длиннее). Запрыгнуть на ящик можно тихо (шагом
// вплотную — landSound, 540), это только время. Раньше у всех прыжок вверх стоил 120 — ящики и прыжки через щель путь не выбирал никогда
function navJumpCost(a, edge, quiet){
  var q = !!quiet, k = q ? "_jcq" : "_jcf";
  if(edge[k] != null) return edge[k];
  var v = navJumpCost0(a, edge, q); if(navTallDone) edge[k] = v;   // до navCutTall лестницы (NAV_LAD) ещё не известны — не запоминать
  return v;
}
function navJumpCost0(a, edge, q){
  var b = zonesById[edge.to]; if(!a || !b || !edge.mid) return 0;
  var tJ = LAND_DELAY*SPEED;
  if(edge.gap) return tJ + (q && !edge.gap.walkOk ? NAV_JUMP_COST : 0);   // (v549) на шифте тихо — только время
  if(NAV_LAD[a.id+">"+edge.to]) return Math.abs(b.z - a.z)/LADDER_SPEED*SPEED/(q ? WALK_SPEED_FRAC : 1);   // лестница
  var dz = navEdgeDz(a, edge);
  if(dz > 18) return tJ;
  if(dz < -LAND_SOUND_DROP) return tJ + (q ? NAV_DROP_COST : 0);
  return 0;   // (v469) тихий спуск (≤ LAND_SOUND_DROP) — без цены
}
// перепад пола по переходу edge из участка a (+ — вверх); одно место для цены прыжка и для «выше прыжка — не пройти» (v533)
function navEdgeDz(a, edge){
  if(edge._dz != null) return edge._dz;
  var b = zonesById[edge.to]; if(!a || !b || !edge.mid) return (edge._dz = 0);
  var dz;
  if(navPlane(a).flat || navPlane(b).flat){
    // (v519, пак 09.11 п.13; А-3: «на Ancient куча мест, где T бегут и постоянно прыгают») у навмеша Ancient нет высот углов — раньше цена
    // прыжка была 0, и путь шёл через каждый уступ. Высота пола по обе стороны прохода — из 3D-геометрии карты (та же, что видимость): в 10 px
    // от середины прохода внутрь каждого участка, этаж — ближайший к высоте участка (пандус так не даёт ложного уступа: пол непрерывный)
    var M = typeof m3 === "function" ? m3() : null; if(!M) return 0;
    var cen = function(A){ var x = 0, y = 0; A.points.forEach(function(q){ x += q.x; y += q.y; }); return {x:x/A.points.length, y:y/A.points.length}; };
    var side = function(A){ var c = cen(A), dx = c.x-edge.mid.x, dy = c.y-edge.mid.y, L = DM.hypot(dx, dy) || 1; return visFloorAt(edge.mid.x + dx/L*10, edge.mid.y + dy/L*10, A.z); };
    dz = side(b) - side(a);
  } else dz = navStepDz(a, b, edge.mid.x, edge.mid.y);
  return (edge._dz = dz);
}
var ROUTE_PORTAL = 0;   // (v406) цена перехода между участками сверх длины (было 40 при длине от центров участков): с длиной от точки входа не нужна — спуск со спавна T по рампе (607) короче бордюра (624), а с ценой 8 выбирался бордюр
// (v446, владелец 28.10: «трое T со спавна идут в точку на Palace Entry и спрыгивают, хотя могли бежать прямо») шум цены переходов
// по полосе бота (v405, ROUTE_NOISE) убран: он менял сам маршрут — у полос 0,3/0,7/0,9 спуск со спавна T Mirage шёл по уступу (−161)
// с прыжком вниз (−215), у 0,1/0,5 — по лестнице. Маршрут у всех один; полоса — только сдвиг точек поворота (laneShift)
// (v416, М151) запрет пути через проходы у́же корпуса (v412) убран: у Kitchen, Hole, TV (Mirage) и T Lower ↔ Ruins (Ancient) других
// проходов нет — путь шёл в обход в 4–15 раз длиннее (надпись «навмеш не связывает напрямую»). Схождение на спуске T разводит полоса (laneShift)
var FIRE_DETOUR = 600;   // (v438) цена перехода через горящий огонь, ед. карты: обход до ~600 длиннее — лучше, чем сквозь огонь (проектное число)
var KNOWN_PATH_R = 300, KNOWN_DETOUR = 500;   // (v450) проектные числа: радиус места врага, цена обхода (× вес гипотезы, док 6)
var ZDJ = {tick: -1, graph: null, s: {}};
// (док 6) места врагов по знанию команды для цены пути (zoneDijkstra) — раз в тик на команду; вес < 0,05 не берётся (проектное число: «почти нет»)
var KPC = {};
function knownPathSpots(team){
  var C = KPC[team]; if(C && C.tick === tick && C.m === matchNum) return C.L;
  var L = [];
  bots.forEach(function(e){ if(!e.alive || e.team === team) return;
    (knowEnemySpots(team, e.id) || []).forEach(function(q){ if(q.w >= 0.05) L.push({x: q.x, y: q.y, w: q.w}); }); });
  KPC[team] = {tick: tick, m: matchNum, L: L}; return L;
}   // (док 6) продолжаемые поиски пути этого тика (zoneDijkstra) — ключ: начало и обстановка
// (v469) штраф отрезка пути за место врага: KNOWN_DETOUR × вес × (длина отрезка внутри круга KNOWN_PATH_R) / диаметр круга
function knownSegCost(a, b, q){
  // (Г6, скорость) отрезок целиком дальше R от места по оси — пересечения нет (тот же 0, что дал бы расчёт ниже)
  var R = KNOWN_PATH_R;
  if((a.x < q.x - R && b.x < q.x - R) || (a.x > q.x + R && b.x > q.x + R) || (a.y < q.y - R && b.y < q.y - R) || (a.y > q.y + R && b.y > q.y + R)) return 0;
  var dx = b.x - a.x, dy = b.y - a.y, L2 = dx*dx + dy*dy; if(L2 < 1e-9) return 0;
  var fx = a.x - q.x, fy = a.y - q.y;
  var B = 2*(fx*dx + fy*dy), C = fx*fx + fy*fy - R*R, D = B*B - 4*L2*C; if(D <= 0) return 0;
  var sq = Math.sqrt(D), t0 = Math.max(0, (-B - sq)/(2*L2)), t1 = Math.min(1, (-B + sq)/(2*L2)); if(t1 <= t0) return 0;
  // (v570, отметка владельца м1 р4 38 с: «подобрав бомбу, построился путь через стак врагов» — путь в Палас шёл через A прямо по CT, которого
  // видели (вес 1): насквозь через круг — 500, обход через спавн T дороже) штраф растёт, чем ближе путь к самому месту врага: по краю
  // круга — как было, через середину — ×(1 + KNOWN_CLOSE_K) — пройти мимо врага в упор почти никогда не дешевле обхода
  var tm = Math.max(0, Math.min(1, -B/(2*L2))), cx = a.x + dx*tm - q.x, cy = a.y + dy*tm - q.y, dmin = Math.sqrt(cx*cx + cy*cy);
  return KNOWN_DETOUR*q.w*(t1 - t0)*Math.sqrt(L2)/(2*R)*(1 + KNOWN_CLOSE_K*Math.max(0, 1 - dmin/R));
}
var KNOWN_CLOSE_K = 2;   // (v570) проектное число
