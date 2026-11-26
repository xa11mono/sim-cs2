# Мёртвые функции, удалённые в фазе 1 (перестройка, 15.11)

Ни одной ссылки в коде игры (разбор склеенного скрипта целиком, включая разметку), ни одного вызова за 16 матчей (покрытие, прогон 257), не зовут инструменты. Код и комментарий над функцией — дословно.

## `buildAutoWalls` — `src/game/020_map_navmesh_autowalls.js:254`

```js
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
```

## `rawWallSegments` — `src/game/020_map_navmesh_autowalls.js:181`

```js
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
```

## `edgeCoverage` — `src/game/020_map_navmesh_autowalls.js:122`

```js
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
```

## `habitLook` — `src/game/140_named_spots_ct_setup.js:343`

```js
// без свежей инфы — смотрит в любимый угол живого врага (у каждого игрока свой,
// копится за матч и между матчами), если он рядом и виден
function habitLook(b){
  if(!teamTac.T || (b.team === "T" && teamTac.T.phase === "postplant")) return null;
  var best = null, bd = Infinity;
  bots.forEach(function(o){
    if(o.team === b.team || !o.alive) return;
    var h = habitTop(o.id, 2.5); if(!h) return;
    var d = Math.hypot(h.x-b.x, h.y-b.y);
    if(d < 150 || d > 650 || d >= bd) return;
    if(!hasLOS(b.x, b.y, h.x, h.y, b.z)) return;
    bd = d; best = h;
  });
  return best;
}
```

## `teamCallLook` — `src/game/190_team_intel_lkp_calls.js:403`

```js
// префайр по коллу: свежий (≤2с) "вижу" от тиммейта в 150..650px и есть линия — смотреть туда
function teamCallLook(b){
  var sig = teamIntel[b.team].sig, best = null, bd = 650;
  for(var i = sig.length-1; i >= 0; i--){
    var s = sig[i];
    if(tick - s.tick > 2*TICK_HZ) break;
    if(s.type !== "spotted" || s.by === b.id) continue;
    var d = Math.hypot(s.x-b.x, s.y-b.y);
    if(d < 150 || d >= bd) continue;
    if(!hasVision(b.x, b.y, s.x, s.y)) continue;
    best = s; bd = d;
  }
  return best;
}
```

## `lkpLook` — `src/game/190_team_intel_lkp_calls.js:74`

```js
// взгляд без свежей инфы: на угол, за которым последняя известная позиция врага
// Раньше брали просто БЛИЖАЙШУЮ позицию — и бот смотрел на старую инфу про
// одного CT у Cave, хотя 5 секунд назад двое убили троих его тиммейтов на
// миде. Теперь свежесть весит: каждая секунда давности = +40px "расстояния".
// maxAgeT — вариант "только свежая угроза" (выше плана/преэйма в приоритете)
function lkpLook(b, maxAgeT){
  var L = beliefLast[b.team], best = null, bs = Infinity, rMax = maxAgeT ? 850 : 750;
  for(var id in L){ var e = L[id], age = tick - e.tick; if(age < TICK_HZ) continue; if(maxAgeT && age > maxAgeT) continue;
    var d = Math.hypot(e.x-b.x, e.y-b.y); if(d >= rMax) continue;
    var sc = d + 40*age/TICK_HZ; if(sc < bs){ bs = sc; best = e; } }
  return best ? cornerLook(b, best) : null;
}
```

## `hgtUnderCenter` — `src/game/370_fire_nav_levels_ladders.js:492`

```js
function hgtUnderCenter(x, y, U){   // центр игрока под другим полом — для мини-карты и повтора (там кружок целиком)
  var O = HEIGHTS.over || [];
  return (U || []).some(function(i){ return pointInPoly(x, y, O[i].poly.map(function(p){ return {x: p[0], y: p[1]}; })); });
}
```

## `hgtUnder` — `src/game/370_fire_nav_levels_ladders.js:460`

```js
function hgtUnder(x, y, z, a){
  var O = HEIGHTS.over || [], out = []; if(!a || z == null) return out;
  for(var i = 0; i < O.length; i++){ var o = O[i]; if(o.bottom !== a.id || !o.poly || o.poly.length < 3) continue;
    var t = navArea(o.top); if(!t || t.z < z + 40) continue;   // 40 — выше ступеньки: игрок стоит на верхнем полу или над ним
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    o.poly.forEach(function(p){ if(p[0] < x0) x0 = p[0]; if(p[0] > x1) x1 = p[0]; if(p[1] < y0) y0 = p[1]; if(p[1] > y1) y1 = p[1]; });
    if(x < x0 - HGT_NEAR || x > x1 + HGT_NEAR || y < y0 - HGT_NEAR || y > y1 + HGT_NEAR) continue;
    out.push(i);
  }
  return out;
}
```

## `hgtLevelOf` — `src/game/370_fire_nav_levels_ladders.js:456`

```js
function hgtLevelOf(id){   // 1 — пол над другим полом (светлый ободок), 0 — обычный
  if(!HGT_TOP){ HGT_TOP = {}; (HEIGHTS.over || []).forEach(function(o){ HGT_TOP[o.top] = 1; }); }
  return HGT_TOP[id] ? 1 : 0;
}
```

## `stepNeedsJump` — `src/game/370_fire_nav_levels_ladders.js:420`

```js
// (п.19 владельца 29.10, м1 р5 т34629: TeSeS переминался на посту и шагнул на ящик в Ticket, 62 ед. выше пола) шаг без прыжка: выше
// ступеньки (18, как в heightBlocked) — только прыжком; переминание на месте не прыгает
function stepNeedsJump(x1, y1, x2, y2, b){
  if(!b || b.z == null) return false;
  var a1 = navAt(x1, y1, b.z) || navArea(b._area); if(!a1) return false;
  var a2 = navAt(x2, y2, b.z) || navAtLevel(x2, y2, a1.z);   // (снимок п.19: уступ +63 navAt своего уровня не отдаёт — берётся пол в пределах прыжка)
  if(!a2 || a2 === a1) return false;
  var up = navStepDz(a1, a2, x2, y2);
  return up > 18 && !(up > 72 && a2.z - b.z > 72);   // выше роста над головой — потолок, не уступ (как в heightBlocked)
}
```

## `rpLerpAng` — `src/game/675_replay.js:352`

```js
function rpLerpAng(a, b, f){ if(isNaN(a)) return b; if(isNaN(b)) return a; var d = ((b - a + Math.PI*3) % (Math.PI*2)) - Math.PI; return a + d*f; }
```

# Дубли, сведённые в фазе 1 (15.11): одинаковый код слово в слово (тело и параметры) — вызовы переведены на одну функцию

- `medWArea` (`src/game/570_maped_core_walls.js:171`) → `covPolyArea`:

```js
function medWArea(p){ var a = 0; for(var i=0;i<p.length;i++){ var b = p[(i+1)%p.length]; a += p[i][0]*b[1] - b[0]*p[i][1]; } return Math.abs(a)/2; }
```

- `sbBot` (`src/game/677_sandbox.js:12`) → `teamBot`:

```js
function sbBot(id){ for(var i = 0; i < bots.length; i++) if(bots[i].id === id) return bots[i]; return null; }
```

- `smokeOnLine` (`src/game/360_nades_buy_smoke_vision.js:100`) → `smokeBlocks`:

```js
function smokeOnLine(x1,y1,x2,y2){
  for(var i=0;i<smokes.length;i++){ var s = smokes[i], r = smokeRadiusNow(s); if(r > 8 && areaSegHits(s, r, x1,y1,x2,y2)) return true; }
  return false;
}
```

- `medBR` (`src/game/600_maped_wallbang.js:5`) → `medWR`:

```js
function medBR(v){ return Math.round(v*10)/10; }
```

- `dvEsc` (`src/game/678_demo_view.js:81`) → `sbEsc`:

```js
function dvEsc(s){ return String(s == null ? "" : s).replace(/[&<>]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c]; }); }
```
