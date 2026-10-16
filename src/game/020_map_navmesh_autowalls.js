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
// (v321) участки навмеша под точкой — по сетке; где пол в два этажа (Mirage: Underpass под Short), берётся участок,
// ближайший по высоте к z (бот знает свою высоту — bot.z); иначе, как раньше, первый по порядку
var NAV_GRID = null, NAV_GRID_C = 64;
function navGridBuild(){
  NAV_GRID = {};
  NAVAREAS.forEach(function(zn, idx){
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    zn.points.forEach(function(p){ if(p.x < x0) x0 = p.x; if(p.y < y0) y0 = p.y; if(p.x > x1) x1 = p.x; if(p.y > y1) y1 = p.y; });
    for(var gx = Math.floor(x0/NAV_GRID_C); gx <= Math.floor(x1/NAV_GRID_C); gx++)
      for(var gy = Math.floor(y0/NAV_GRID_C); gy <= Math.floor(y1/NAV_GRID_C); gy++){ var k = gx+","+gy; (NAV_GRID[k] || (NAV_GRID[k] = [])).push(idx); }
  });
}
function navAt(x, y, z){
  if(!NAV_GRID) navGridBuild();
  var L = NAV_GRID[Math.floor(x/NAV_GRID_C)+","+Math.floor(y/NAV_GRID_C)]; if(!L) return null;
  var first = null, best = null, bd = Infinity;
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
function zoneOf(x,y,z){
  // заблокированные (внутри стены) полигоны пропускаем — иначе бот, стоящий
  // на таком, получил бы стартовую зону без единого перехода
  var hit = navAt(x, y, z || z === 0 ? z : null); if(hit) return hit;
  // fallback: point fell in a tiny gap between areas (navmesh doesn't
  // perfectly tile down to the pixel) — snap to nearest area centroid
  // (v333, отметка владельца: magixx застрял на спавне T за перилами) ближайший участок — тот, до которого можно дойти, не
  // проходя сквозь стену (и на своей высоте, если она известна); раньше брался просто ближайший центр — за перилами, и путь
  // шёл сквозь них
  var C = [];
  NAVAREAS.forEach(function(zn){
    if(NAV_BLOCKED[zn.id] || !(zoneGraph[zn.id]||[]).length) return;
    var cx=0,cy=0; zn.points.forEach(function(p){cx+=p.x;cy+=p.y;}); cx/=zn.points.length; cy/=zn.points.length;
    C.push({zn:zn, x:cx, y:cy, d:Math.hypot(cx-x,cy-y) + (z != null ? Math.abs(zn.z - z)*0.5 : 0)});
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
// Same idea as segOverlap but returns the covered RANGE along ea (in ea's own
// [0,length] parameter space) instead of points, and with no minimum-overlap
// floor — used below to find the parts of an area's edge NOT covered by any
// neighbor, which is where an actual wall must be (see buildAutoWalls).
function edgeCoverage(ea, eb){
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
  var b0=proj(eb[0].x,eb[0].y), b1=proj(eb[1].x,eb[1].y);
  var lo=Math.max(0,Math.min(b0,b1)), hi=Math.min(len1,Math.max(b0,b1));
  if(hi-lo < 1) return null;
  return [lo,hi];
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

// ---------- wall segments, auto-derived from the navmesh itself ----------
// An area's edge that ISN'T shared with any of its declared neighbors is, by
// definition, the boundary of walkable space — i.e. a wall (or a map edge/
// cliff, which is fine to treat the same way: bots shouldn't walk off it
// either). Computed both for movement collision and for line-of-sight, so
// routes and walls can never disagree with each other. Two separate builds
// with different tolerances (see rebuildNav below): movement needs walls
// inset a bit so a bot passing through a doorway doesn't clip the wall's
// endpoint every tick; line-of-sight doesn't have that per-tick repetition
// problem, so it uses a tighter build that doesn't leave small gaps a
// bullet could sneak through.
// Step 1 of buildAutoWalls: per polygon edge, find the uncovered (= wall)
// sub-ranges, same coverage math as before, but returns RAW segments with no
// inset and no length filtering yet — that's deliberately deferred to the
// chain-stitching step below, because filtering/insetting edge-by-edge is
// what was breaking real walls: ~400 of the navmesh's 1970 areas are tiny
// (sub-15px²) triangles from fine triangulation at complex corners, so a
// single real wall is often built from many short edges end-to-end. Judged
// one edge at a time, each of those short pieces looks droppable (below
// MIN_KEEP) even though the wall they form together is long and completely
// real — that's exactly the "walls just missing in some places" bug.
function rawWallSegments(){
  var segs = [];
  // Sub-pixel slivers here are floating-point/portal-tolerance jitter, not
  // real wall geometry — coverage math on ~1970 triangulated edges produces
  // a lot of these throughout the mesh, including deep inside open rooms.
  // They must be dropped BEFORE chain-stitching, not after: stitching would
  // otherwise happily link a string of them (they sit at real shared
  // triangle vertices) into a spurious "wall" chain that's long enough to
  // pass MIN_KEEP despite representing nothing but noise.
  var NOISE_EPS = 0.5 * navTransform.scale;
  // Gaps strictly BETWEEN two already-portal-covered intervals on one edge
  // (as opposed to before-the-first/after-the-last) are almost always
  // adjacency tolerance jitter between two neighbors, not a real wall
  // between two doorways — bridge over anything under this width.
  var BRIDGE_TOL = 8 * navTransform.scale;
  NAVAREAS.forEach(function(a){
    var edges = zoneEdges(a);
    var neighborEdges = (a.conn||[]).map(function(id){ return zonesById[id]; }).filter(Boolean).map(zoneEdges);
    edges.forEach(function(ea){
      var elen = dist2(ea[0], ea[1]);
      if(elen < 1e-6) return;
      var intervals = [];
      neighborEdges.forEach(function(nedges){
        nedges.forEach(function(eb){
          var iv = edgeCoverage(ea, eb);
          if(iv) intervals.push(iv);
        });
      });
      intervals.sort(function(x,y){ return x[0]-y[0]; });
      var merged = [];
      intervals.forEach(function(iv){
        if(merged.length && iv[0] <= merged[merged.length-1][1] + 2*navTransform.scale){
          merged[merged.length-1][1] = Math.max(merged[merged.length-1][1], iv[1]);
        } else {
          merged.push(iv.slice());
        }
      });
      var d1x=(ea[1].x-ea[0].x)/elen, d1y=(ea[1].y-ea[0].y)/elen;
      var cursor = 0;
      merged.forEach(function(iv, mi){
        // Two different kinds of "uncovered" here, judged differently:
        //  - before the FIRST covered interval, or after the LAST one (the
        //    tail, handled below): genuinely no neighbor claims this part of
        //    the edge at all — a real candidate wall, kept at any length and
        //    left for the chain step to judge.
        //  - BETWEEN two covered intervals on the same edge: both sides are
        //    already portal-connected to a neighbor, so a sliver here is
        //    virtually always adjacency/tolerance jitter between two
        //    neighbors' coverage, not a deliberate gap — bridge over it
        //    (treat as covered) unless it's wide enough to plausibly be a
        //    real pillar/wall stub sitting between two doorways.
        var gapLen = iv[0]-cursor;
        var isInternalGap = mi > 0;
        var threshold = isInternalGap ? BRIDGE_TOL : NOISE_EPS;
        if(gapLen > threshold){
          segs.push([ea[0].x+d1x*cursor, ea[0].y+d1y*cursor, ea[0].x+d1x*iv[0], ea[0].y+d1y*iv[0]]);
        }
        cursor = Math.max(cursor, iv[1]);
      });
      if(elen - cursor > NOISE_EPS){
        segs.push([ea[0].x+d1x*cursor, ea[0].y+d1y*cursor, ea[1].x, ea[1].y]);
      }
    });
  });
  return segs;
}

// Step 2: stitch raw segments that share an endpoint into chains (a real
// wall is usually many tiny polygon-edge pieces end to end), then decide
// wall-vs-noise and apply the corner inset PER CHAIN rather than per piece —
// so a long real wall made of many short pieces survives as one continuous
// line, only its two true open ends (where it meets a doorway) get inset,
// and the internal joints between pieces stay exactly touching (no gap).
function buildAutoWalls(INSET, MIN_KEEP){
  var raw = rawWallSegments();
  var EP_ROUND = 0.15; // px — snap endpoints this close together into "the same point"
  function key(p){ return Math.round(p.x/EP_ROUND)+","+Math.round(p.y/EP_ROUND); }
  var byPoint = {}; // key -> [{seg, end}] end is 0 or 1 (which endpoint of seg)
  raw.forEach(function(s, idx){
    [{x:s[0],y:s[1]},{x:s[2],y:s[3]}].forEach(function(p, end){
      var k = key(p);
      (byPoint[k] = byPoint[k] || []).push({idx:idx, end:end});
    });
  });
  var visited = new Array(raw.length).fill(false);
  var segs = [];
  raw.forEach(function(s0, startIdx){
    if(visited[startIdx]) return;
    // walk the chain outward from this segment in both directions, stopping
    // at a dead end or a branch point (3+ segments meeting — ambiguous which
    // way "continues" the wall, so treat it as a chain boundary there too)
    var chainSegs = [startIdx];
    visited[startIdx] = true;
    [0,1].forEach(function(dir){
      var curIdx = startIdx, curEnd = dir; // the endpoint of curIdx we're extending from
      for(;;){
        var s = raw[curIdx];
        var p = curEnd===0 ? {x:s[0],y:s[1]} : {x:s[2],y:s[3]};
        var touching = (byPoint[key(p)]||[]).filter(function(t){ return !visited[t.idx]; });
        if(touching.length !== 1) break; // dead end or branch point
        var nextIdx = touching[0].idx;
        chainSegs.push(nextIdx);
        visited[nextIdx] = true;
        // continue from the OTHER endpoint of the segment we just added
        curEnd = touching[0].end===0 ? 1 : 0;
        curIdx = nextIdx;
      }
    });
    var totalLen = chainSegs.reduce(function(sum,i){ var s=raw[i]; return sum+dist2({x:s[0],y:s[1]},{x:s[2],y:s[3]}); }, 0);
    if(totalLen < MIN_KEEP) return;
    // inset only the chain's two true extremities; find them as the two
    // points that appear exactly once across all segments in this chain
    var count = {};
    chainSegs.forEach(function(i){
      var s = raw[i];
      [{x:s[0],y:s[1]},{x:s[2],y:s[3]}].forEach(function(p){
        var k = key(p);
        count[k] = (count[k]||0) + 1;
      });
    });
    chainSegs.forEach(function(i){
      var s = raw[i];
      var p1={x:s[0],y:s[1]}, p2={x:s[2],y:s[3]};
      var len = dist2(p1,p2);
      if(len < 1e-6) return;
      var ux=(p2.x-p1.x)/len, uy=(p2.y-p1.y)/len;
      var lo = 0, hi = len;
      if(count[key(p1)]===1) lo = Math.min(len/2, INSET);
      if(count[key(p2)]===1) hi = Math.max(len/2, len-INSET);
      if(hi<=lo) return;
      segs.push([p1.x+ux*lo, p1.y+uy*lo, p1.x+ux*hi, p1.y+uy*hi]);
    });
  });
  return segs;
}

// The wall set actually used for collision (crossesWall) and shooting/LOS
// (hasLOS) — see the "рисовать стены вручную" UI. Seeded from WALLEDGES_RAW
// below (the pre-navmesh hand-traced solid-prop outlines — much cleaner
// than anything auto-derived from navmesh triangulation ever was), then
// never touched by rebuildNav again; only the align-walls and draw-mode UI
// mutate it from here on.
