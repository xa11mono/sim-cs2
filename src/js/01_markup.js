// ---------- разметка карты (B3, шаг 1): укрытия и точки встречи у каждого входа ----------
// Знание карты, которое есть у любого про-игрока: у каждого прохода между
// зонами — откуда его держат (стоишь у стены, проход видно, сам открыт узкой
// щелью) и где из него появится враг. Считается один раз по стенам, навмешу и
// зонам (без демок и без случайности), лениво — при первом обращении.
// Пока (v189) только рисуется слоем «разметка»; мозг ботов её не читает —
// выбор действия по ней — следующий шаг B3.
//
// MARKUP.entries[i] = {id, a, b, nameA, nameB, p:{x,y} середина прохода,
//   seg:[{x,y},{x,y}] края прохода, w ширина px,
//   sides:[{hold: зона держащего (индекс ZONEMAP.zones), from: зона врага,
//     covers:[{x,y, wall: px до стены, vis: доля прохода видна, open: доля
//       точек вражеской стороны, видящих укрытие, dirs: открытых других
//       направлений, meet:{x,y} где враг появится, look: угол взгляда,
//       span: ширина угла (рад) — узко/широко}]}]}
var MARKUP = null;
// запечённая разметка (data/markup.json, tools/markup_bake.js) — для стен и
// навмеша как в репозитории; если в этом браузере стены или навмеш правили
// редактором — считается заново при первом обращении (~9 с)
var MARKUP_BAKED = @@DATA:markup.json@@;
var MK_CFG = {grid:10, wallMin:7, wallMax:22, dMin:70, dMax:550, perSide:3, gap:60, minVis:0.4, maxOpen:0.35, maxDirs:3};

function markupGet(){
  if(!MARKUP) MARKUP = (MARKUP_BAKED && MARKUP_BAKED.entries && MARKUP_BAKED.entries.length && !wallsRestoredFromStorage && !navAnchors.length) ? MARKUP_BAKED : markupBuild();
  return MARKUP;
}

function markupBuild(){
  var t0 = Date.now(), C = MK_CFG, Z = ZONEMAP.zones, NZ = Z.length;
  var name = function(i){ return (typeof ZONE_NAMES !== "undefined" && ZONE_NAMES[Z[i].id]) || Z[i].id; };
  // --- стены: корзины 64 px для расстояния и для прямой видимости ---
  var W = wallSegsLOS, CELL = 64, WB = {};
  W.forEach(function(s, k){
    var x0 = Math.floor(Math.min(s[0], s[2])/CELL), x1 = Math.floor(Math.max(s[0], s[2])/CELL);
    var y0 = Math.floor(Math.min(s[1], s[3])/CELL), y1 = Math.floor(Math.max(s[1], s[3])/CELL);
    for(var x=x0;x<=x1;x++) for(var y=y0;y<=y1;y++){ var key = x+","+y; (WB[key] || (WB[key] = [])).push(k); }
  });
  var segD = function(px, py, s){ var vx = s[2]-s[0], vy = s[3]-s[1], L = vx*vx+vy*vy, t = L ? Math.max(0, Math.min(1, ((px-s[0])*vx+(py-s[1])*vy)/L)) : 0; return Math.hypot(px-(s[0]+vx*t), py-(s[1]+vy*t)); };
  var wallDist = function(x, y, lim){
    var best = lim, cx = Math.floor(x/CELL), cy = Math.floor(y/CELL), seen = {};
    for(var i=-1;i<=1;i++) for(var j=-1;j<=1;j++){ var L = WB[(cx+i)+","+(cy+j)]; if(!L) continue;
      for(var k=0;k<L.length;k++){ if(seen[L[k]]) continue; seen[L[k]] = 1; var d = segD(x, y, W[L[k]]); if(d < best) best = d; } }
    return best;
  };
  var los = hasLOS;   // прямая видимость — та же, что у игры

  // --- зона карты точки (без кэшей игры) ---
  var ZBB = Z.map(function(z){ var a = {x0:1e9, y0:1e9, x1:-1e9, y1:-1e9}; z.points.forEach(function(p){ a.x0 = Math.min(a.x0, p.x); a.y0 = Math.min(a.y0, p.y); a.x1 = Math.max(a.x1, p.x); a.y1 = Math.max(a.y1, p.y); }); return a; });
  var zoneAt = function(x, y){ for(var i=0;i<NZ;i++){ var b = ZBB[i]; if(x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue; if(pointInPoly(x, y, Z[i].points)) return i; } return -1; };
  // --- граф зон и расстояния по нему ---
  var idx = {}; Z.forEach(function(z, i){ idx[z.id] = i; });
  var cent = Z.map(function(z){ return ZONE_CENTROIDS[z.id] || zoneMapCentroid(z); });
  var nbr = Z.map(function(){ return []; });
  ZONEMAP.portals.forEach(function(p){ var a = idx[p.a], b = idx[p.b]; if(a === undefined || b === undefined || a === b) return;
    if(nbr[a].indexOf(b) < 0) nbr[a].push(b); if(nbr[b].indexOf(a) < 0) nbr[b].push(a); });
  var GD = Z.map(function(_, s){
    var D = new Array(NZ).fill(1e9), done = new Array(NZ).fill(false); D[s] = 0;
    for(var it=0; it<NZ; it++){ var u = -1, bd = 1e9; for(var i=0;i<NZ;i++) if(!done[i] && D[i] < bd){ bd = D[i]; u = i; }
      if(u < 0) break; done[u] = true;
      nbr[u].forEach(function(v){ var w = Math.hypot(cent[u].x-cent[v].x, cent[u].y-cent[v].y); if(D[u]+w < D[v]) D[v] = D[u]+w; }); }
    return D;
  });
  // --- точки у стен: сетка по проходимому навмешу ---
  var navOk = NAVAREAS.filter(function(a){ return !NAV_BLOCKED[a.id] && (zoneGraph[a.id]||[]).length; }).map(function(a){
    var b = {x0:1e9, y0:1e9, x1:-1e9, y1:-1e9}; a.points.forEach(function(p){ b.x0 = Math.min(b.x0, p.x); b.y0 = Math.min(b.y0, p.y); b.x1 = Math.max(b.x1, p.x); b.y1 = Math.max(b.y1, p.y); });
    return {pts:a.points, b:b}; });
  var NB = {}, NC = 48;
  navOk.forEach(function(a, k){ for(var x=Math.floor(a.b.x0/NC); x<=Math.floor(a.b.x1/NC); x++) for(var y=Math.floor(a.b.y0/NC); y<=Math.floor(a.b.y1/NC); y++){ var key = x+","+y; (NB[key] || (NB[key] = [])).push(k); } });
  var walkable = function(x, y){ var L = NB[Math.floor(x/NC)+","+Math.floor(y/NC)]; if(!L) return false;
    for(var i=0;i<L.length;i++){ var a = navOk[L[i]]; if(x < a.b.x0 || x > a.b.x1 || y < a.b.y0 || y > a.b.y1) continue; if(pointInPoly(x, y, a.pts)) return !insideSolidWall(x, y); }
    return false; };
  var X0 = 1e9, Y0 = 1e9, X1 = -1e9, Y1 = -1e9;
  navOk.forEach(function(a){ X0 = Math.min(X0, a.b.x0); Y0 = Math.min(Y0, a.b.y0); X1 = Math.max(X1, a.b.x1); Y1 = Math.max(Y1, a.b.y1); });
  var nearWall = [];
  for(var gx = X0 + C.grid/2; gx < X1; gx += C.grid) for(var gy = Y0 + C.grid/2; gy < Y1; gy += C.grid){
    var wd = wallDist(gx, gy, C.wallMax + 1); if(wd < C.wallMin || wd > C.wallMax) continue;
    if(!walkable(gx, gy)) continue;
    var zi = zoneAt(gx, gy); if(zi < 0) continue;
    nearWall.push({x:gx, y:gy, z:zi, wall:wd});
  }
  // --- точки зон для «кто видит укрытие» ---
  // видимость «точка у стены ↔ точка зоны» считается один раз и запоминается:
  // одна и та же точка — кандидат для многих входов рядом
  var tGrid = Date.now() - t0;
  var samp = Z.map(function(z){ return (ZONE_SAMPLES[z.id] || [cent[idx[z.id]]]); });
  var sOff = [], NS = 0; samp.forEach(function(L){ sOff.push(NS); NS += L.length; });
  nearWall.forEach(function(c, i){ c.i = i; });
  var VC = new Uint8Array(nearWall.length * NS);
  var seesS = function(c, zi, k){ var key = c.i*NS + sOff[zi] + k, v = VC[key];
    if(!v){ var q = samp[zi][k]; v = VC[key] = los(c.x, c.y, q.x, q.y) ? 2 : 1; } return v === 2; };
  // --- входы: проходы между зонами с разными названиями ---
  var entries = [];
  ZONEMAP.portals.forEach(function(p){
    var a = idx[p.a], b = idx[p.b]; if(a === undefined || b === undefined || a === b) return;
    if(name(a) === name(b)) return;                    // одна зона, разрезанная на две, — не вход
    var g = markupPortalSeg(Z[a], Z[b]); if(!g) return;
    var dup = entries.find(function(e){ return ((e.a === a && e.b === b) || (e.a === b && e.b === a)) || (Math.hypot(e.p.x-g.p.x, e.p.y-g.p.y) < 40 && ((name(e.a) === name(a) && name(e.b) === name(b)) || (name(e.a) === name(b) && name(e.b) === name(a)))); });
    if(dup) return;
    entries.push({id:entries.length, a:a, b:b, nameA:name(a), nameB:name(b), p:g.p, seg:g.seg, w:g.w, sides:[]});
  });
  // --- укрытия и точки встречи для каждой стороны входа ---
  entries.forEach(function(E){
    [[E.a, E.b], [E.b, E.a]].forEach(function(hf){
      var hold = hf[0], from = hf[1], cands = [];
      var ps = []; for(var s=0;s<5;s++){ var f = 0.1 + 0.8*s/4; ps.push({x:E.seg[0].x+(E.seg[1].x-E.seg[0].x)*f, y:E.seg[0].y+(E.seg[1].y-E.seg[0].y)*f}); }
      // откуда придёт враг: его зона и соседние с ней на его стороне прохода
      var foeZ = [from]; nbr[from].forEach(function(i){ if(i !== hold && GD[from][i] < GD[hold][i]) foeZ.push(i); });
      // сначала дешёвое: видит ли проход; дорогое (кто видит укрытие) — только
      // для лучших 60 по дешёвой оценке
      var pre = [];
      nearWall.forEach(function(c){
        if(c.z === from || !(c.z === hold || GD[hold][c.z] < GD[from][c.z])) return;
        var d = Math.hypot(c.x-E.p.x, c.y-E.p.y); if(d < C.dMin || d > C.dMax) return;
        var vis = 0, va = []; ps.forEach(function(q){ if(los(c.x, c.y, q.x, q.y)){ vis++; va.push(Math.atan2(q.y-c.y, q.x-c.x)); } });
        vis /= ps.length; if(vis < C.minVis) return;
        pre.push({c:c, d:d, vis:vis, va:va, sc0:1.5*vis + 0.3*(C.wallMax - c.wall)/(C.wallMax - C.wallMin) - Math.abs(d - 260)/600});
      });
      pre.sort(function(p, q){ return q.sc0 - p.sc0; });
      pre.slice(0, 60).forEach(function(P){
        var c = P.c, d = P.d, vis = P.vis, va = P.va;
        // сам почти закрыт: какая доля точек вражеской стороны (в 900 px) его видит
        var seen = 0, tot = 0;
        foeZ.forEach(function(zi){ samp[zi].forEach(function(q, k){ var dq = Math.hypot(q.x-c.x, q.y-c.y); if(dq < 40 || dq > 900) return; tot++; if(seesS(c, zi, k)) seen++; }); });
        var open = tot ? seen/tot : 0;
        // открыт ли с других направлений (кроме этого прохода): любые зоны, кроме своей
        var ang0 = Math.atan2(E.p.y-c.y, E.p.x-c.x), bins = {}, dirs = 0;
        for(var zi=0; zi<NZ; zi++){ if(zi === c.z || zi === hold) continue;
          var sm = samp[zi]; for(var k=0;k<sm.length && k<5;k++){ var q = sm[k], dq = Math.hypot(q.x-c.x, q.y-c.y); if(dq < 60 || dq > 1000) continue;
            var aq = Math.atan2(q.y-c.y, q.x-c.x); if(_mkAng(aq, ang0) < 0.6) break;
            if(!seesS(c, zi, k)) continue;
            var bi = Math.round(aq/0.55); if(bi === -6) bi = 6; if(!bins[bi]){ bins[bi] = 1; dirs++; } break; } }
        if(open > C.maxOpen || dirs > C.maxDirs) return;   // не укрытие: открыт врагу или под несколькими углами
        var sc = 1.5*vis - 2.0*open - 0.35*dirs + 0.3*(C.wallMax - c.wall)/(C.wallMax - C.wallMin) - Math.abs(d - 260)/600;
        var span = 0; for(var u=0;u<va.length;u++) for(var v=u+1; v<va.length; v++) span = Math.max(span, _mkAng(va[u], va[v]));
        cands.push({x:c.x, y:c.y, wall:+c.wall.toFixed(1), vis:vis, open:+open.toFixed(2), dirs:dirs, span:+span.toFixed(2), sc:sc});
      });
      cands.sort(function(p, q){ return q.sc - p.sc; });
      var out = [];
      for(var i=0;i<cands.length && out.length < C.perSide;i++){ var c = cands[i];
        if(out.some(function(o){ return Math.hypot(o.x-c.x, o.y-c.y) < C.gap; })) continue;
        c.meet = markupMeet(c, cent[from], E.p, los); c.look = Math.atan2(c.meet.y-c.y, c.meet.x-c.x);
        c.sc = +c.sc.toFixed(2); out.push(c); }
      if(out.length) E.sides.push({hold:hold, from:from, covers:out});
    });
  });
  // проход, который ни с одной стороны нельзя держать из укрытия (открытая
  // граница внутри одного места: Деф ↔ сайт), — не вход
  entries = entries.filter(function(E){ return E.sides.length; });
  entries.forEach(function(E, i){ E.id = i; });
  return {entries:entries, nearWall:nearWall.length, ms:Date.now()-t0, msGrid:tGrid};
}
function _mkAng(a, b){ return Math.abs(((a-b+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI); }
// края общего прохода двух зон (точки границы A ближе 10 px к границе B)
function markupPortalSeg(za, zb){
  var A = za.points, B = zb.points, pts = [];
  var dSeg = function(px, py, a, b){ var vx=b.x-a.x, vy=b.y-a.y, L=vx*vx+vy*vy, t = L ? Math.max(0, Math.min(1, ((px-a.x)*vx+(py-a.y)*vy)/L)) : 0; return Math.hypot(px-(a.x+vx*t), py-(a.y+vy*t)); };
  for(var i=0;i<A.length;i++){ var a = A[i], a2 = A[(i+1)%A.length];
    for(var s=0;s<=8;s++){ var px = a.x+(a2.x-a.x)*s/8, py = a.y+(a2.y-a.y)*s/8;
      for(var k=0;k<B.length;k++){ if(dSeg(px, py, B[k], B[(k+1)%B.length]) < 10){ pts.push({x:px, y:py}); break; } } } }
  if(!pts.length) return null;
  var best = [pts[0], pts[0]], bd = -1;
  for(var i=0;i<pts.length;i++) for(var j=i+1;j<pts.length;j++){ var d = Math.hypot(pts[i].x-pts[j].x, pts[i].y-pts[j].y); if(d > bd){ bd = d; best = [pts[i], pts[j]]; } }
  var p = {x:(best[0].x+best[1].x)/2, y:(best[0].y+best[1].y)/2};
  if(!walkableish(p)){ var sx = 0, sy = 0; pts.forEach(function(q){ sx += q.x; sy += q.y; }); p = {x:sx/pts.length, y:sy/pts.length}; }
  return {p:{x:+p.x.toFixed(1), y:+p.y.toFixed(1)}, seg:best, w:Math.round(Math.max(bd, 0))};
}
function walkableish(p){ return !insideSolidWall(p.x, p.y); }
// где враг появится для этого укрытия: идём по его пути (из глубины его зоны
// через проход ко мне) — первая точка, которую видно из укрытия
function markupMeet(c, from, portal, los){
  var wp = [[from.x, from.y]].concat(buildWaypointPath(from.x, from.y, 0, c.x, c.y, 0).map(function(q){ return [q[0], q[1]]; }));
  for(var i=0;i<wp.length-1;i++){ var a = wp[i], b = wp[i+1], n = Math.max(1, Math.ceil(Math.hypot(b[0]-a[0], b[1]-a[1])/8));
    for(var s=0;s<=n;s++){ var x = a[0]+(b[0]-a[0])*s/n, y = a[1]+(b[1]-a[1])*s/n;
      if(Math.hypot(x-c.x, y-c.y) < 40) return {x:portal.x, y:portal.y};
      if(los(c.x, c.y, x, y)) return {x:+x.toFixed(1), y:+y.toFixed(1)}; } }
  return {x:portal.x, y:portal.y};
}
