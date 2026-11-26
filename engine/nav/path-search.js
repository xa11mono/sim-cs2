// (Р3.2, канал «ход») параметры поиска — явный контекст ctx {from, toPt, fire, nearest, quiet} (был: свойства функции zoneDijkstra.*,
// их задавал и сбрасывал buildWaypointPath0); без ctx — как в покое (всё выключено)
function zoneDijkstra(fromId, toId, team, ctx){
  ctx = ctx || {};
  if(fromId===toId) return [fromId];
  var side = team === "CT" ? zoneSideMap() : null;
  // (v450, док владельца 28.10 №5: игрокам 2 и 4 после контакта на миде «дали путь через врагов» — к лайнапу и в Палас) путь движения
  // обходит места, где по знанию команды может быть живой враг. (док 6, п.2/7: р3 kyousuke шёл к посту через мид — T там видели 33 с назад,
  // а v450 брала только «видели/слышали ≤ 6 с»; сейв р4 — через мид и Ramp) места — гипотезы знания команды (knowEnemySpots: виден — там,
  // стоит — где был, ушёл — куда мог дойти) с их весом: переход ближе KNOWN_PATH_R к месту дороже на KNOWN_DETOUR × вес. Только путь движения
  // (v469, п.1/7/19 владельца 29.10: обход через весь мид вместо прямого пути — штраф копился на каждом переходе: у сайта участки мелкие,
  // прямой путь (925) набирал 24 штрафа, обход (1855) — 15; снимки м1 р2, р4, р8) места врагов рядом с целью (≤ KNOWN_PATH_R) не штрафуются —
  // к цели идти всё равно туда, и все пути кончаются у них (ретейк, плант); штраф — по длине пути внутри круга места (knownSegCost), а не
  // за переход: сколько ни нарезано участков, пройти круг насквозь стоит KNOWN_DETOUR × вес
  var tp0 = ctx.toPt;
  var KP = ctx.fire && team ? knownPathSpots(team).filter(function(q){ return !tp0 || DM.hypot(q.x-tp0.x, q.y-tp0.y) > KNOWN_PATH_R; }) : [];
  // (док 6, п.6 «зависания»: в тике планта — 1069 поисков пути, 1,08 с; 707 из них — от бомбы к местам-кандидатам сейва, 349 — от бойца к
  // зонам ухода) поиск из одного начала в одной обстановке (тот же тик, команда, точка старта, огонь, известные враги, граф) продолжается
  // с места, где остановился прошлый, а не начинается заново: порядок обхода тот же, что у отдельного поиска до цели, — путь бит в бит
  var fx0 = ctx.from, fireOn = !!(ctx.fire && fires.length);
  var key = fromId + "|" + (team||"") + (ctx.quiet ? "|q" : "") + "|" + (fx0 ? fx0.x + "," + fx0.y : "") + "|" + (fireOn ? fires.map(function(f){ return f.x + "," + f.y + "," + f.born; }).join(";") : "") + "|" +
            KP.map(function(q){ return q.x + "," + q.y + "," + q.w; }).join(";");
  var DJ = ZDJ.tick === tick && ZDJ.m === matchNum && ZDJ.graph === zoneGraph ? ZDJ.s : (ZDJ.tick = tick, ZDJ.m = matchNum, ZDJ.graph = zoneGraph, ZDJ.s = {});
  var S = DJ[key];
  if(!S){ S = DJ[key] = {dist: {}, prev: {}, visited: {}, entry: {}, heap: makeHeap(), relax: null}; S.dist[fromId] = 0; if(fx0) S.entry[fromId] = fx0; S.heap.push(fromId, 0); }
  var dist = S.dist, prev = S.prev, visited = S.visited, entry = S.entry, heap = S.heap;
  var relax = function(u){
    // (v406, владелец 22.10: «зачем все идут в одну точку, а не прямо вниз» — спавн T → T Ramp) длина — от точки, через которую в участок
    // вошли (середина перехода; у начала — сама точка старта, ctx.from), а не от центра участка: по центрам мелко нарезанная
    // рампа «стоила» дороже бордюра того же пути. Переход между участками — ROUTE_PORTAL (было 40 — проектное число)
    var fromCentroid = entry[u] || zoneCentroid(zonesById[u]);
    var EL = zoneGraph[u] || [], nKP = KP.length;
    for(var ei = 0; ei < EL.length; ei++){ var edge = EL[ei];
      if(visited[edge.to]) continue;
      var w = dist2(fromCentroid, edge.mid) + ROUTE_PORTAL + navJumpCost(zonesById[u], edge, ctx.quiet); // small fixed cost per portal crossing
      if(side && side[edge.to] !== undefined && side[edge.to] < ROUTE_SIDE_LINE) w *= ROUTE_ENEMY_SIDE;   // (v259) CT — по своей стороне
      // (v438, док владельца 27.10: «боты часто идут в молик») переход в горящем огне — дороже на FIRE_DETOUR: путь обходит молотов, если обход
      // не длиннее; иначе идёт через огонь (как и раньше — fireCommit / ждёт у края). Только путь движения (buildWaypointPath)
      if(fireOn && inFire(edge.mid.x, edge.mid.y, edge.z)) w += FIRE_DETOUR;
      // (Д3, скорость; облако м7: 60 млн вызовов knownSegCost за 8000 тиков) отсев по оси — тот же, что первой строкой knownSegCost
      // (места дальше R от отрезка по оси — 0), но без вызова функции; порядок сложения и сами слагаемые те же — результат бит в бит
      if(nKP){ var sax = fromCentroid.x, say = fromCentroid.y, sbx = edge.mid.x, sby = edge.mid.y;
        var mnx = sax < sbx ? sax : sbx, mxx = sax < sbx ? sbx : sax, mny = say < sby ? say : sby, mxy = say < sby ? sby : say, KR = KNOWN_PATH_R;
        for(var kq = 0; kq < nKP; kq++){ var kqp = KP[kq];
          if(mxx < kqp.x - KR || mnx > kqp.x + KR || mxy < kqp.y - KR || mny > kqp.y + KR) continue;
          w += knownSegCost(fromCentroid, edge.mid, kqp); } }
      var alt = dist[u] + w;
      if(dist[edge.to]===undefined || alt<dist[edge.to]){
        dist[edge.to] = alt; prev[edge.to] = u; entry[edge.to] = edge.mid; heap.push(edge.to, alt);
      }
    }
  };
  if(!visited[toId]){
    if(S.relax != null){ relax(S.relax); S.relax = null; }   // прошлый поиск остановился на своей цели, не раскрыв её переходы
    while(heap.size()){
      var u = heap.pop().id;
      if(visited[u]) continue;
      visited[u] = true;
      if(u===toId){ S.relax = u; break; }
      relax(u);
    }
  }
  if(dist[toId]===undefined){
    if(!ctx.nearest) return null;
    // (v375) цель недостижима — ближайший к ней участок, до которого путь есть (см. buildWaypointPath)
    var tc = zoneCentroid(zonesById[toId]), bestN = null, bd = Infinity;
    Object.keys(visited).forEach(function(k){ var c = zoneCentroid(zonesById[k]); if(!c) return; var d = DM.hypot(c.x-tc.x, c.y-tc.y); if(d < bd){ bd = d; bestN = k; } });
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
// (v403) ближайшая к (x, y) точка внутри участка a: проекция на ближайшее ребро, на 2 ед. карты внутрь (к центру участка)
function navClampInto(a, x, y){
  var P = a.points, n = P.length, bx = P[0].x, by = P[0].y, bd = Infinity, cx = 0, cy = 0;
  for(var i=0;i<n;i++){ var A = P[i], B = P[(i+1)%n], ex = B.x-A.x, ey = B.y-A.y, L2 = ex*ex + ey*ey; cx += A.x; cy += A.y;
    var t = L2 ? Math.max(0, Math.min(1, ((x-A.x)*ex + (y-A.y)*ey)/L2)) : 0, px = A.x + ex*t, py = A.y + ey*t, d = DM.hypot(px-x, py-y);
    if(d < bd){ bd = d; bx = px; by = py; } }
  cx /= n; cy /= n; var dc = DM.hypot(cx-bx, cy-by), k = dc > 0 ? Math.min(1, 2/dc) : 0;
  return {x: bx + (cx-bx)*k, y: by + (cy-by)*k};
}
// (v405, владелец 22.10: «зачем они все идут по одному пути») натянутый путь (funnel) у всех один — по одним и тем же углам. У каждого
// бота своя полоса (lane 0…1): каждая точка поворота пути сдвигается (с v412 — наружу от угла на lane·2·LANE_W), если новая точка и
// отрезки к ней — на полу своего уровня (navSegOnLevel), иначе на половину, иначе остаётся. Числа — проектные (разброс у про — проверить
// по демкам)
var LANE_W = 14;   // ед. карты (≈ 35 ед. игры)
function botLane(b){ var m = /(\d)$/.exec(b && b.id || ""); return m ? 0.1 + 0.2*(+m[1] % 5) : 0.5; }
// (v408, Б5д, владелец 22.10: «идут в точку на спуске, потом расходятся») точка не сдвигалась, если высота от прошлой точки менялась
// больше чем на 18 — на спуске со спавна T (−215 → −257) полоса не работала ни у кого, все огибали один угол. Теперь не сдвигаются
// только точки подъёма-прыжка (fixed — середины переходов, через которые путь обязан пройти, см. cuts в buildWaypointPath); пол и стены
// проверяет navSegOnLevel / crossesWall, как раньше
// (v412, Б5д-1 / М151) точка поворота натянутого пути — всегда угол препятствия на внутренней стороне поворота; сдвиг был поперёк на
// ±(lane − 0,5)·2·LANE_W — у полос > 0,5 он шёл в этот угол и не проходил проверку пола (выход T Mirage: полосы 0,7 / 0,9 сдвигались на
// 0–6 из 11, полоса 0,5 — никогда), трое из пяти огибали угол впритык. Теперь — наружу от угла (из угла по биссектрисе) на lane·2·LANE_W
// (v446) сдвинутый отрезок не должен идти через обрыв: пол под ним (каждые 8 ед.) меняется не больше чем на ступеньку (NAV_DROP_STEP).
// navSegOnLevel сверяет пол с прямой по высоте ±40 — на спуске со спавна T (−161 → −257) обрыв уступа −161 → −215 она пропускала
var NAV_DROP_STEP = 24;   // ед. игры: ступени лестниц на навмеше Mirage — до 18; обрыв уступа — 54 (проектное число между ними)
function navSegNoDrop(x0, y0, z0, x1, y1, z1){
  if(z0 == null) return true;
  var L = DM.hypot(x1-x0, y1-y0), n = Math.max(1, Math.ceil(L/8)), last = null;
  for(var i = 0; i <= n; i++){ var t = i/n, a = navAt(x0 + (x1-x0)*t, y0 + (y1-y0)*t, z0 + ((z1 == null ? z0 : z1) - z0)*t);
    if(!a) continue; if(last != null && Math.abs(a.z - last) > NAV_DROP_STEP) return false; last = a.z; }
  return true;
}
function laneShift(path, lane, x0, y0, z0, fixed){
  var d0 = lane*2*LANE_W; if(!d0 || path.length < 2) return path;
  // угол и сторона «наружу» — по исходному пути (rx, ry — прежняя точка до сдвига): от сдвинутой прежней точки поворот мог сменить
  // сторону, и «наружу» смотрело в угол; пол и стены проверяются по сдвинутым (px, py)
  var out = path.slice(), px = x0, py = y0, pz = z0, rx = x0, ry = y0;
  for(var i = 0; i < out.length - 1; i++){ var P = path[i], N = path[i+1];
    var ax = P[0]-rx, ay = P[1]-ry, bx = N[0]-P[0], by = N[1]-P[1], la = DM.hypot(ax, ay), lb = DM.hypot(bx, by);
    rx = P[0]; ry = P[1];
    if(la < 1 || lb < 1 || (fixed || []).some(function(f){ return Math.abs(f.x-P[0]) < 0.5 && Math.abs(f.y-P[1]) < 0.5; })){ px = P[0]; py = P[1]; pz = P[2]; continue; }
    var nx = ax/la - bx/lb, ny = ay/la - by/lb, ln = DM.hypot(nx, ny); if(ln < 0.1){ px = P[0]; py = P[1]; pz = P[2]; continue; }   // наружу от угла; почти прямо (< ~6°) — не угол
    nx /= ln; ny /= ln;
    for(var k = 1; k >= 0.5; k -= 0.5){ var qx = P[0] + nx*d0*k, qy = P[1] + ny*d0*k;
      if(navSegOnLevel(px, py, pz, qx, qy, P[2]) && navSegOnLevel(qx, qy, P[2], N[0], N[1], N[2]) && !crossesWall(px, py, qx, qy) && !crossesWall(qx, qy, N[0], N[1]) &&
         navSegNoDrop(px, py, pz, qx, qy, P[2]) && navSegNoDrop(qx, qy, P[2], N[0], N[1], N[2])){ out[i] = [qx, qy, P[2]]; break; } }
    px = out[i][0]; py = out[i][1]; pz = out[i][2]; }
  return out;
}
// (Г6, скорость, 04.11) путь без команды (team не задан) зависит только от карты (граф, закрытые участки, стены) и огня — не от
// времени и знаний: тот же запрос с теми же точными аргументами при том же графе и том же огне даёт тот же путь. Такие пути
// запоминаются (копией: вызывающие правят точки). Замер м1 р6: 59 % вызовов — без команды, повторы — точные. Игра бит в бит та же
var WPM = {graph: null, m: -1, n: 0, s: {}};
// quiet (v546) — путь для того, кто идёт шагом (bot.walking): громкие переходы дороже (navJumpCost)
function buildWaypointPath(fromX, fromY, fromZ, toX, toY, toZ, team, lane, quiet){
  if(quiet) return buildWaypointPath0(fromX, fromY, fromZ, toX, toY, toZ, team, lane, true);
  if(team) return buildWaypointPath0(fromX, fromY, fromZ, toX, toY, toZ, team, lane);
  if(WPM.graph !== zoneGraph || WPM.m !== matchNum || WPM.n > 20000){ WPM.graph = zoneGraph; WPM.m = matchNum; WPM.n = 0; WPM.s = {}; }
  var key = fromX+","+fromY+","+fromZ+">"+toX+","+toY+","+toZ+"|"+lane+"|"+(fires.length ? tick+":"+fires.map(function(f){ return f.x+","+f.y+","+f.born; }).join(";") : "");   // огонь растёт со временем — с огнём только в том же тике
  var v = WPM.s[key];
  if(!v){ v = WPM.s[key] = buildWaypointPath0(fromX, fromY, fromZ, toX, toY, toZ, team, lane); WPM.n++; }
  return v.map(function(q){ return q.slice(); });
}
function buildWaypointPath0(fromX, fromY, fromZ, toX, toY, toZ, team, lane, quiet){
  // (v341, отметка владельца: karrigan в щели у края нижнего пола — путь начинался с верхней полоски (−140) над ним, туда хода
  // нет, бот уходил с пола и его переносило по кругу) начало пути — пол рядом на высоте бота, а не ближайший центр участка
  if(!navTallDone) navCutTall();
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
  // (v403, отметка владельца 22.10, Mirage Window: CT0 «застрял в стене») точка поста бывает вне навмеша — в щели между этажами;
  // путь кончался самой точкой с высотой 0 («не знаю»), лестница принимала 0 за высоту (подъём на −46 рядом) и вставляла в путь
  // подъём за стеной — бот бежал к нему по прямой в стену. Теперь конец пути — ближайшая точка участка цели и его пол
  if(!pointInPoly(toX, toY, tz.points)){ var cq = navClampInto(tz, toX, toY); toX = cq.x; toY = cq.y; }
  if(!toZ) toZ = navFloorZ(tz, toX, toY);
  if(fz.id === tz.id) return [[toX,toY,toZ||0]];
  var ctx = {from: {x: fromX, y: fromY}, toPt: {x: toX, y: toY}, fire: true, nearest: false, quiet: !!quiet};
  var route = zoneDijkstra(fz.id, tz.id, team, ctx);
  // (v450, м19 р1: путь T0 к Tetris из-за молотова на T Ramp ушёл через спавн и Палас — ~1500 ед. обхода) цена огня копится по каждому
  // переходу внутри него, и обход через пол-карты выходил «дешевле». Обход берётся, только если он не длиннее пути через огонь больше чем
  // на FIRE_DETOUR (как и задумано в v438); иначе — путь через огонь: у края огня бот ждёт, пока погаснет (fireSafe, 540)
  if(route && fires.length){ var r0 = zoneDijkstra(fz.id, tz.id, team, Object.assign({}, ctx, {fire: false}));
    var rLen = function(R){ var L = 0, px = fromX, py = fromY; for(var ri = 0; ri < R.length-1; ri++){ var e = (zoneGraph[R[ri]]||[]).find(function(x){ return x.to === R[ri+1]; }); if(e && e.mid){ L += DM.hypot(e.mid.x-px, e.mid.y-py); px = e.mid.x; py = e.mid.y; } } return L + DM.hypot(toX-px, toY-py); };
    if(r0 && rLen(route) > rLen(r0) + FIRE_DETOUR) route = r0; }
  if(!route){ if(!NAV_GRID) navGridBuild();
    var alts = (NAV_GRID[Math.floor(toX/NAV_GRID_C)+","+Math.floor(toY/NAV_GRID_C)]||[]).map(function(i){ return NAVAREAS[i]; })
      .filter(function(a){ return a !== tz && !NAV_BLOCKED[a.id] && pointInPoly(toX, toY, a.points); }).sort(function(a, c){ return Math.abs(a.z - tLvl) - Math.abs(c.z - tLvl); });
    for(var ai=0; ai<alts.length && !route; ai++){ route = zoneDijkstra(fz.id, alts[ai].id, team, ctx); if(route) tz = alts[ai]; } }
  // (v375, отметка владельца: T0 на Tetris «застревает, его выкидывает, прыгает» — бомба лежала там, куда пути по навмешу нет;
  // раньше шёл по прямой к цели, в ящик/стену, и бился о него; сторож: «застой» с путём из одной точки) цели не достичь —
  // путь к ближайшему достижимому месту рядом с ней
  if(!route){ route = zoneDijkstra(fz.id, tz.id, team, Object.assign({}, ctx, {nearest: true}));
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
  var start0 = {x:fromX,y:fromY,z:fromZ||0}, end0 = {x:toX,y:toY,z:toZ||0}, cuts = [], gapFix = [];
  for(var ci=0;ci<corridor.length;ci++){ var cA = zonesById[cPair[ci][0]], cB = zonesById[cPair[ci][1]], ce = corridor[ci];
    if(ce.gap){ cuts.push(ci); gapFix.push(ce.gap.a, ce.gap.b); continue; }   // (v546) прыжок через щель: путь — через точку отталкивания и приземления
    // (v551) подъём из демок по этой связи (CLIMB_BY_EDGE, 370) — то же: путь через его точку отталкивания и верх, прыгает ladderTick именно по нему
    var CLc = NAV_CLIMB_UP[cPair[ci][0]+">"+cPair[ci][1]] && CLIMB_BY_EDGE[cPair[ci][0]+">"+cPair[ci][1]];
    if(CLc){ cuts.push(ci); gapFix.push(CLc.lo, CLc.hi); CLIMB_AT[navGapKey(CLc.hi.x, CLc.hi.y)] = CLc; continue; }
    if(cA && cB && ce.mid && !navPlane(cA).flat && !navPlane(cB).flat && navStepDz(cA, cB, ce.mid.x, ce.mid.y) > 18) cuts.push(ci); }
  var path;
  if(!cuts.length) path = funnel(corridor, start0, end0);
  else { path = []; var sP = start0, prevC = 0;
    cuts.concat([corridor.length]).forEach(function(ci2){ var G = ci2 < corridor.length ? corridor[ci2].gap : null;
      if(!G && ci2 < corridor.length){ var CLk = NAV_CLIMB_UP[cPair[ci2][0]+">"+cPair[ci2][1]] && CLIMB_BY_EDGE[cPair[ci2][0]+">"+cPair[ci2][1]]; if(CLk) G = {a: CLk.lo, b: CLk.hi}; }   // (v551) подъём — как щель
      var eP = G ? {x:G.a.x, y:G.a.y, z:G.a.z} : ci2 < corridor.length ? {x:corridor[ci2].mid.x, y:corridor[ci2].mid.y, z:corridor[ci2].z} : end0;
      var seg = funnel(corridor.slice(prevC, ci2), sP, eP); path = path.concat(path.length ? seg.slice(1) : seg); sP = eP; prevC = ci2 + 1;
      if(G){ path.push([G.b.x, G.b.y, G.b.z]); sP = {x:G.b.x, y:G.b.y, z:G.b.z}; } }); }
  // Проверка по стенам: funnel натягивает путь по геометрии НАВМЕША, а она
  // местами не совпадает с нарисованными стенами — натянутый отрезок может
  // срезать угол прямо сквозь стену. Если хоть один отрезок пересекает
  // стену — вместо натянутого пути идём через середины порталов (зигзаг, но
  // каждая точка гарантированно на переходе между проходимыми полигонами).
  var bad = false;
  var gapSeg = function(A, B){ var k = navGapKey(B[0], B[1]), G = NAV_GAP_AT[k], CL = CLIMB_AT[k]; return (!!G && Math.abs(G.a.x - A[0]) < 0.5 && Math.abs(G.a.y - A[1]) < 0.5) || (!!CL && Math.abs(CL.lo.x - A[0]) < 0.5 && Math.abs(CL.lo.y - A[1]) < 0.5); };   // (v551) и подъём из демок   // (v546) прыжок через щель — над пустотой, это не «плохой» отрезок
  for(var k=0;k<path.length-1;k++){
    if(gapSeg(path[k], path[k+1])) continue;
    if(segCrossesManualWalls(path[k][0],path[k][1],path[k+1][0],path[k+1][1])){ bad = true; break; }
  }
  // (v373, сторож: «застой» — бот с путём стоит у ящика: натянутый отрезок срезал угол через участок выше (ящик, уступ) вне
  // коридора, а шаг туда не пускает по высоте — путь заново тот же). Отрезок, который уходит с участков коридора на участок
  // другой высоты (> JUMP_UP), — тоже «плохой»: идём через середины переходов
  if(!bad){ if(!NAV_GRID) navGridBuild();
    var inR = {}; route.forEach(function(id){ inR[id] = 1; });
    for(var k2=0;k2<path.length-1 && !bad;k2++){ if(gapSeg(path[k2], path[k2+1])) continue; var A = path[k2], B = path[k2+1], dd = DM.hypot(B[0]-A[0], B[1]-A[1]), ns = Math.ceil(dd/8);
      for(var j=1;j<ns && !bad;j++){ var t = j/ns, x = A[0]+(B[0]-A[0])*t, y = A[1]+(B[1]-A[1])*t, zz = (A[2]||0)+((B[2]||0)-(A[2]||0))*t;
        var L = NAV_GRID[Math.floor(x/NAV_GRID_C)+","+Math.floor(y/NAV_GRID_C)] || [], hit = false, other = false;
        for(var q=0;q<L.length;q++){ var ar = NAVAREAS[L[q]]; if(NAV_BLOCKED[ar.id] || !pointInPoly(x, y, ar.points)) continue; if(inR[ar.id]) hit = true; else if(Math.abs(ar.z - zz) > JUMP_UP) other = true; else hit = true; }
        if(other && !hit) bad = true; } } }
  if(bad){
    var mids = [];
    corridor.forEach(function(e, ie){ var CLm = NAV_CLIMB_UP[cPair[ie][0]+">"+cPair[ie][1]] && CLIMB_BY_EDGE[cPair[ie][0]+">"+cPair[ie][1]]; if(CLm){ mids.push([CLm.lo.x, CLm.lo.y, CLm.lo.z], [CLm.hi.x, CLm.hi.y, CLm.hi.z]); return; } if(e.gap) mids.push([e.gap.a.x, e.gap.a.y, e.gap.a.z], [e.gap.b.x, e.gap.b.y, e.gap.b.z]); else mids.push([e.mid.x, e.mid.y, e.z]); });
    mids.push([toX, toY, toZ||0]);
    return mids;
  }
  // drop the leading point (== bot's current position, not a real waypoint)
  var outP = lane != null ? laneShift(path.slice(1), lane, fromX, fromY, fromZ, cuts.map(function(ci){ return corridor[ci].mid; }).concat(gapFix)) : path.slice(1);
  return outP;
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
// (17.11, перестройка) расстояние от точки до отрезка — перенесено из 550 (файл показа): им пользуются бомба (120) и места (140)
function distToSeg(px,py, s){
  var x1=s[0],y1=s[1],x2=s[2],y2=s[3];
  var dx=x2-x1, dy=y2-y1;
  var len2 = dx*dx+dy*dy;
  var t = len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((px-x1)*dx+(py-y1)*dy)/len2));
  var cx = x1+t*dx, cy = y1+t*dy;
  return DM.hypot(px-cx, py-cy);
}
