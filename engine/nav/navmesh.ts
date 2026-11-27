// [хозяева: —] ---------- официальный navmesh (.nav, распарсен из de_ancient.nav v36) ----------
// Заменяет ручные зоны как источник геометрии ходьбы: 1970 полигонов,
// официально посчитанных игрой как проходимая поверхность, со связями
// (conn) между соседними полигонами. Раз область существует — значит она
// не пересекает стены (так их вычисляет сама игра), поэтому маршрут,
// построенный по этим полигонам, физически не может пройти сквозь стену —
// в отличие от старого способа (ручные зоны + отдельно нарисованные стены,
// которые могли не совпадать друг с другом).
var zonesById: Record<number, NavArea | undefined>, zoneGraph: NavGraph, portalCount: number, portalMissing: number, wallSegs: WallSegment[];

function pointInPoly(px: number,py: number,points: readonly NavXY[]): boolean{
  var inside = false;
  for(var i=0,j=points.length-1;i<points.length;j=i++){
    var xi=points[i].x, yi=points[i].y, xj=points[j].x, yj=points[j].y;
    var intersect = ((yi>py)!==(yj>py)) && (px < (xj-xi)*(py-yi)/(yj-yi)+xi);
    if(intersect) inside = !inside;
  }
  return inside;
}
// (v321) участки навмеша под точкой — по сетке; где пол в два этажа (Mirage: Underpass под Short), берётся участок,
// ближайший по высоте к z (бот знает свою высоту — bot.z); иначе, как раньше, первый по порядку
var NAV_GRID: Record<string, number[] | undefined> | null = null, NAV_GRID_C = 64;
function navGridBuild(): void{
  NAV_GRID = {};
  NAVAREAS.forEach(function(zn, idx){
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    zn.points.forEach(function(p){ if(p.x < x0) x0 = p.x; if(p.y < y0) y0 = p.y; if(p.x > x1) x1 = p.x; if(p.y > y1) y1 = p.y; });
    for(var gx = Math.floor(x0/NAV_GRID_C); gx <= Math.floor(x1/NAV_GRID_C); gx++)
      for(var gy = Math.floor(y0/NAV_GRID_C); gy <= Math.floor(y1/NAV_GRID_C); gy++){ var k = gx+","+gy; (NAV_GRID![k] || (NAV_GRID![k] = [])).push(idx); } // тип: сетка присвоена перед синхронным обходом NAVAREAS
  });
}
function navAt(x: number, y: number, z?: number | null): NavArea | null{
  if(!NAV_GRID) navGridBuild();
  var L = NAV_GRID![Math.floor(x/NAV_GRID_C)+","+Math.floor(y/NAV_GRID_C)]; if(!L) return null; // тип: navGridBuild синхронно присваивает сетку при её отсутствии
  var first: NavArea | null = null, best: NavArea | null = null, bd = Infinity;
  for(var i=0;i<L.length;i++){
    var zn = NAVAREAS[L[i]];
    if(NAV_BLOCKED[zn.id] || !pointInPoly(x,y,zn.points)) continue;
    if(!first) first = zn;
    if(z == null) break;
    var d = Math.abs(zn.z - z); if(d < bd){ bd = d; best = zn; }
  }
  if(!first) return null;
  return (best && Math.abs(best.z - first.z) > 60) ? best : first;   // разные этажи — по высоте; один этаж — как раньше
}
// (v546, владелец 10.11, Mirage A: «бот хочет запрыгнуть на ящик и не может») высота пола под точкой, если он там один (крыша ящика, уступ):
// у точек поста высоты нет (места про, раскладки — по радару), и путь вёл на пол бота рядом с ящиком. Под точкой несколько этажей
// (больше ступеньки, 18 ед.) — null: «не знаю», как раньше (пол на уровне бота)
function navOnlyZ(x: number, y: number): number | null{
  if(!NAV_GRID) navGridBuild();
  var L = NAV_GRID![Math.floor(x/NAV_GRID_C)+","+Math.floor(y/NAV_GRID_C)]; if(!L) return null; // тип: navGridBuild синхронно присваивает сетку при её отсутствии
  var lo: NavArea | null = null, hi = -Infinity;
  for(var i=0;i<L.length;i++){ var zn = NAVAREAS[L[i]]; if(NAV_BLOCKED[zn.id] || !pointInPoly(x, y, zn.points)) continue; if(!lo || zn.z < lo.z) lo = zn; hi = Math.max(hi, zn.z); }
  return lo && hi - lo.z <= 18 ? navFloorZ(lo, x, y) : null;
}
function zoneOf(x: number,y: number,z?: number | null): NavArea | null{
  // заблокированные (внутри стены) полигоны пропускаем — иначе бот, стоящий
  // на таком, получил бы стартовую зону без единого перехода
  var hit = navAt(x, y, z || z === 0 ? z : null); if(hit) return hit;
  // fallback: point fell in a tiny gap between areas (navmesh doesn't
  // perfectly tile down to the pixel) — snap to nearest area centroid
  // (v333, отметка владельца: magixx застрял на спавне T за перилами) ближайший участок — тот, до которого можно дойти, не
  // проходя сквозь стену (и на своей высоте, если она известна); раньше брался просто ближайший центр — за перилами, и путь
  // шёл сквозь них
  var C: (NavXY & {zn: NavArea; d: number})[] = [];
  NAVAREAS.forEach(function(zn){
    if(NAV_BLOCKED[zn.id] || !(zoneGraph[zn.id]||[]).length) return;
    var cx=0,cy=0; zn.points.forEach(function(p){cx+=p.x;cy+=p.y;}); cx/=zn.points.length; cy/=zn.points.length;
    C.push({zn:zn, x:cx, y:cy, d:DM.hypot(cx-x,cy-y) + (z != null ? Math.abs(zn.z - z)*0.5 : 0)});
  });
  C.sort(function(a,b){ return a.d - b.d; });
  for(var i=0;i<Math.min(12, C.length);i++) if(!segCrossesManualWalls(x, y, C[i].x, C[i].y)) return C[i].zn;
  return C.length ? C[0].zn : null;
}

// ---------- portal segments between adjacent nav areas (same tolerant-overlap
// algorithm previously used for the hand-drawn zones, now applied only to
// pairs the .nav file itself declares adjacent via each area's conn list —
// so we're not doing an all-pairs search over 1970 areas, just the real
// neighbors) ----------
function dist2(a: NavXY,b: NavXY): number{ return DM.hypot(a.x-b.x, a.y-b.y); }
function zoneEdges(z: Pick<NavArea, "points">): NavSegment[]{
  var pts = z.points, out: NavSegment[] = [];
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
function segOverlap(ea: NavSegment, eb: NavSegment): NavSegment | null{
  var d1x=ea[1].x-ea[0].x, d1y=ea[1].y-ea[0].y;
  var len1 = DM.hypot(d1x,d1y);
  if(len1<1e-6) return null;
  d1x/=len1; d1y/=len1;
  var d2x=eb[1].x-eb[0].x, d2y=eb[1].y-eb[0].y;
  var len2 = DM.hypot(d2x,d2y);
  if(len2<1e-6) return null;
  d2x/=len2; d2y/=len2;
  var cross = Math.abs(d1x*d2y - d1y*d2x);
  if(cross > 0.08) return null;
  function perpDist(px: number,py: number): number{ return Math.abs((px-ea[0].x)*d1y - (py-ea[0].y)*d1x); }
  if(perpDist(eb[0].x,eb[0].y) > PORTAL_TOL) return null;
  if(perpDist(eb[1].x,eb[1].y) > PORTAL_TOL) return null;
  function proj(px: number,py: number): number{ return (px-ea[0].x)*d1x + (py-ea[0].y)*d1y; }
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
function computePortal(za: Pick<NavArea, "points">, zb: Pick<NavArea, "points">): NavPortal | null{
  var ei = zoneEdges(za), ej = zoneEdges(zb), segs: NavSegment[] = [];
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



// The wall set actually used for collision (crossesWall) and shooting/LOS
// (hasLOS) — see the "рисовать стены вручную" UI. Seeded from WALLEDGES_RAW
// below (the pre-navmesh hand-traced solid-prop outlines — much cleaner
// than anything auto-derived from navmesh triangulation ever was), then
// never touched by rebuildNav again; only the align-walls and draw-mode UI
// mutate it from here on.
