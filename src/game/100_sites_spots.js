// ---------- сайты и авто-геометрия (проходы, точки сбора, позиции) ----------
var SITES = {}, GEO = {};
// (v359, отметка владельца р7 «упал FPS»: профиль снимка — 2/3 времени тика в поиске пути, buildWaypointPath из «длина пути
// до …» в мозгах (флажок, эндгейм, пост-плант) — одни и те же пары точек каждый тик) запросы «путь / длина пути» для решений
// помнятся PATHQ_TTL тиков с точностью PATHQ_Q ед. карты (проектные числа); движение ботов строит путь как раньше
var PATHQ = {}, PATHQ_N = 0, PATHQ_TTL = 32, PATHQ_Q = 6;
function pathQ(key, fn){
  var c = PATHQ[key]; if(c && tick - c.t <= PATHQ_TTL && c.t <= tick) return c.v;
  if(PATHQ_N > 6000){ PATHQ = {}; PATHQ_N = 0; }
  var v = fn(); PATHQ[key] = {t: tick, v: v}; PATHQ_N++; return v;
}
function pathPts(ax, ay, bx, by){
  var Q = PATHQ_Q, p = pathQ("p"+Math.round(ax/Q)+","+Math.round(ay/Q)+">"+Math.round(bx/Q)+","+Math.round(by/Q), function(){ return buildWaypointPath(ax, ay, 0, bx, by, 0); });
  return [[ax,ay]].concat(p.map(function(q){ return [q[0], q[1]]; }));
}
function polyLen(pts){ var L=0; for(var i=1;i<pts.length;i++) L += Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]); return L; }
function pointAtDist(pts, d){ // точка на ломаной на расстоянии d от начала
  var acc = 0;
  for(var i=1;i<pts.length;i++){
    var a = pts[i-1], b = pts[i], L = Math.hypot(b[0]-a[0], b[1]-a[1]);
    if(acc + L >= d){ var t = L>0 ? (d-acc)/L : 0; return {x:a[0]+(b[0]-a[0])*t, y:a[1]+(b[1]-a[1])*t}; }
    acc += L;
  }
  var e = pts[pts.length-1]; return {x:e[0], y:e[1]};
}
function pointFromEnd(pts, d){ return pointAtDist(pts, Math.max(0, polyLen(pts)-d)); }
function pointAtFrac(pts, f){ return pointAtDist(pts, polyLen(pts)*f); }
function walk(p){ return snapToWalkable(p.x, p.y); }

function buildSites(){
  ["A","B"].forEach(function(k){
    var uz = USER_ZONES.filter(function(z){ return z.kind === (k==="A" ? "sitea" : "siteb") && z.basePoints.length >= 3; })[0];
    var poly = uz ? zoneObjAbsPoints(uz) : null;
    // (v321) граница сайта из набора карты (zones.sites — по местам плантов про из демок, как в игре), иначе — зона с ролью сайта
    if(!poly && MAP.zones.sites && MAP.zones.sites[k]) poly = MAP.zones.sites[k].map(function(p){ return zlPt(p[0], p[1]); });
    if(!poly){ var zz = ZONEMAP.zones.filter(function(z){ return z.name === k+"site"; })[0]; if(zz) poly = zz.points; }
    var c = poly ? centroidOf(poly) : {x:1024, y:1024};
    var sp = walk(c);
    SITES[k] = {key:k, x:sp.x, y:sp.y, poly:poly};
    var ps = sitePlantSpot(SITES[k]); SITES[k].plant = ps;
  });
  spotCache = {}; OUTWARD_CACHE = {}; EXP_CACHE = {}; ED_CACHE = {CT:null, T:null};
  ["A","B"].forEach(function(k){
    var s = SITES[k];
    var tp = pathPts(T_SPAWN.x, T_SPAWN.y, s.x, s.y);
    var cp = pathPts(CT_SPAWN.x, CT_SPAWN.y, s.x, s.y);
    var g = {};
    g.tEntry  = walk(pointFromEnd(tp, 230));  // проход, через который T заходят на сайт
    g.tStage  = walk(pointFromEnd(tp, 560));  // где T собираются перед выходом
    g.ctEntry = walk(pointFromEnd(cp, 230));  // откуда на сайт прибегают CT
    // опорник — между центром сайта и CT-входом (со стороны "своих"), смотрит на T-вход
    g.anchor  = walk({x: s.x*0.55 + g.ctEntry.x*0.45, y: s.y*0.55 + g.ctEntry.y*0.45});
    GEO[k] = g;
  });
  var mp = pathPts(CT_SPAWN.x, CT_SPAWN.y, T_SPAWN.x, T_SPAWN.y);
  GEO.ctMid = walk(pointAtFrac(mp, 0.40));  GEO.ctMidLook = walk(pointAtFrac(mp, 0.62));
  GEO.tMid  = walk(pointAtFrac(mp, 0.66));  GEO.tMidLook  = walk(pointAtFrac(mp, 0.45));
  // (v319) мид из набора карты (tactics.geoMid — где мидер CT и T в миде стоят чаще всего по демкам и куда смотрят):
  // на Mirage путь между спавнами идёт через A, и «мид» по нему оказывался на сайте A (Default) и на T Roof. Нет поля — как раньше
  var GM = MAP.tactics.geoMid;
  if(GM){ GEO.ctMid = walk(GM.ct); GEO.ctMidLook = walk(GM.ctLook); GEO.tMid = walk(GM.t); GEO.tMidLook = walk(GM.tLook); }
  var ab = pathPts(SITES.A.x, SITES.A.y, SITES.B.x, SITES.B.y);
  GEO.rotator = walk(pointAtFrac(ab, 0.5));
}
// бомбу можно ставить только ВНУТРИ зоны сайта (если она есть); раньше
// хватало быть в 110px от центра — и плант получался рядом с сайтом, а не на нём
function onSite(site, x, y){
  if(site.poly) return pointInPoly(x, y, site.poly);
  return Math.hypot(x-site.x, y-site.y) < 110;
}
// точка планта — центр проходимого полигона навмеша внутри зоны сайта,
// ближайший к её центру (центроид вогнутой зоны может лежать вне её)
// раздел 12: варианты планта на сайте — "дефолт" (центр), "безопасный" (не
// виден со входа CT — дефузить придётся, заходя под огонь с точек T снаружи/
// на сайте) и "открытый" (виден с T-входа — пост-плант можно держать снаружи)
function sitePlantOptions(k){
  var site = SITES[k], g = GEO[k];
  if(site._plantOpts) return site._plantOpts;
  var def = site.plant || sitePlantSpot(site), safe = null, open = null, bs = -Infinity, bo = -Infinity;
  // (v381, М135, владелец 16.10: «бомба ставится на укрытии») варианты — только места, где ставили про (MAP.pro.plants из демок):
  // центры участков навмеша на сайте включали верх ящиков и укрытий. Мест про нет — как раньше, участки навмеша
  var PP = sitePlantPro(k);
  (PP.length ? PP : (site.poly ? NAVAREAS.filter(function(z){ return !NAV_BLOCKED[z.id] && (zoneGraph[z.id]||[]).length; }).map(zoneCentroid) : [])).forEach(function(c){
    if(!PP.length && (!pointInPoly(c.x, c.y, site.poly) || insideSolidWall(c.x, c.y))) return;
    var dd = Math.hypot(c.x-def.x, c.y-def.y);
    var sS = (hasLOS(c.x, c.y, g.ctEntry.x, g.ctEntry.y) ? 0 : 2) + (hasLOS(c.x, c.y, g.anchor.x, g.anchor.y) ? 0 : 0.5) - dd/400;
    var sO = (hasLOS(c.x, c.y, g.tEntry.x, g.tEntry.y) ? 2 : 0) + (hasLOS(c.x, c.y, g.tStage.x, g.tStage.y) ? 1 : 0) - dd/400;
    if(sS > bs){ bs = sS; safe = {x:c.x, y:c.y}; }
    if(sO > bo){ bo = sO; open = {x:c.x, y:c.y}; }
  });
  // под молотов: точка на сайте, которую видно с одной из позиций пост-планта
  // (или со своего лайнапа на пост-плант) в пределах броска
  var molly = null;
  var ul = allLineups().filter(function(L){ return L.team === "T" && L.trigger === "postplant" && L.type === "molly" && (L.site === k || L.site === "any"); })[0];
  if(ul && pointInPoly(ul.to.x, ul.to.y, site.poly || [])) molly = {x:ul.to.x, y:ul.to.y};
  if(!molly && site.poly && POS[k]){
    var bm = -Infinity;
    POS[k].tPost.forEach(function(n){ var zp = zonePoint(n, def); if(!zp) return;
      (PP.length ? PP : NAVAREAS.filter(function(z){ return !NAV_BLOCKED[z.id] && (zoneGraph[z.id]||[]).length; }).map(zoneCentroid)).forEach(function(c){
        if(!PP.length && !pointInPoly(c.x, c.y, site.poly)) return; var d = Math.hypot(c.x-zp.x, c.y-zp.y); if(d > NADE_THROW_RANGE*0.8) return;
        var sc = (hasLOS(zp.x, zp.y, c.x, c.y) ? 2 : 0) + (hasLOS(c.x, c.y, g.ctEntry.x, g.ctEntry.y) ? 0 : 1) - Math.hypot(c.x-def.x, c.y-def.y)/300;
        if(sc > bm){ bm = sc; molly = {x:c.x, y:c.y}; } }); });
  }
  site._plantOpts = {def:def, safe:safe||def, open:open||def, molly:molly};
  return site._plantOpts;
}
function choosePlant(tt){
  if(tt.plantPick) return tt.plantPick;
  var O = sitePlantOptions(tt.site);
  var ctA = aliveCount("CT"), tA = aliveCount("T");
  // CT не меньше, чем нас — прячем бомбу от их входа (дефуз под наш огонь);
  // нас заметно больше — открытый плант, держим снаружи; иначе дефолт
  var kind = (ctA >= tA && ctA >= 2) ? "safe" : (tA >= ctA + 2) ? "open" : "def";
  // под молотов: у команды есть молотов на пост-плант, а живых хватает, чтобы
  // держать снаружи — ставим туда, куда долетит молотов с позиции пост-планта
  var hasMol = bots.some(function(b){ return b.team === "T" && b.alive && b.nades && b.nades.molly > 0; });
  if(hasMol && tA >= 2 && O.molly && hashRand(roundNum*61 + matchNum) < 0.5) kind = "molly";
  tt.plantPick = {pt:O[kind], kind:kind};
  logEvent("T: плант "+({safe:"в безопасную точку (не видно со входа CT)", open:"открытый — держим снаружи", def:"дефолтный", molly:"под молотов — сбить дефуз с пост-планта"})[kind]+" на "+tt.site);
  return tt.plantPick;
}
// (v381, М135) места планта про на этом сайте (MAP.pro.plants, tools/plants_bake.py), сначала частые
// (v409, владелец 22.10: «почему он не ставит первые 10 секунд») место планта выбирается только из мест про (sitePlantPro), а начать
// плант можно было только внутри границы сайта (onSite). Граница — красный квадрат радара (Mirage) / зона «Asite» (Ancient) — не
// покрывает места, где ставили про: вне её 13 из 22 мест A Mirage (66 % плантов), 11 из 14 мест A Ancient (96 %). Носитель доходил до
// точки, стоял и топтался, пока случайно не шагнёт внутрь (м1 р1 Mirage: на точке с 44,5 с, плант — в 60,0). Теперь ставить можно и
// в клетке места про (PLANT_CELL — сетка кластера в tools/plants_bake.py: там про ставили ≥ 3 раз), а не только внутри границы
var PLANT_CELL = 24;
function canPlantAt(k, x, y){
  var S = SITES[k]; if(!S) return false;
  if(onSite(S, x, y)) return true;
  return sitePlantPro(k).some(function(p){ return Math.abs(p.x-x) <= PLANT_CELL/2 && Math.abs(p.y-y) <= PLANT_CELL/2; });
}
function sitePlantPro(k){
  return ((MAP.pro && MAP.pro.plants) || []).filter(function(p){ return p.site === k; }).sort(function(a, c){ return c.share - a.share; })
    .map(function(p){ return {x: p.x, y: p.y, share: p.share}; });
}
function sitePlantSpot(site){
  var PP = sitePlantPro(site.key); if(PP.length) return {x: PP[0].x, y: PP[0].y};   // (v381, М135) самое частое место планта про
  if(!site.poly) return {x:site.x, y:site.y};
  var c = centroidOf(site.poly), best = null, bd = Infinity;
  NAVAREAS.forEach(function(z){
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var zc = zoneCentroid(z);
    if(!pointInPoly(zc.x, zc.y, site.poly)) return;
    var d = Math.hypot(zc.x-c.x, zc.y-c.y);
    if(d < bd){ bd = d; best = zc; }
  });
  return best ? {x:best.x, y:best.y} : {x:site.x, y:site.y};
}

// ---------- выбор позиций: не "в ряд у одной точки", а разные укрытые места ----------
// Кандидаты — центры проходимых полигонов навмеша в кольце [rMin, rMax] вокруг
// центра. Оценка: must — обязательная видимость (например, бомбы для пост-планта),
// hideFrom — точки, откуда НЕ должно быть видно (укрытие от CT), see — точки,
// которые хорошо бы видеть (проход). Жадно набираем count мест с отступом
// minGap друг от друга. Кэш на раунд — чтобы позиции не прыгали каждый тик.
var spotCache = {};
// (2) открытые углы: сколько РАЗНЫХ направлений со стороны врага (зоны ближе
// к его спавну, чем моя) видят точку. Про встаёт так, чтобы его видели с
// одного выхода за раз; точка под 3–4 выходами — смерть от первого же захода
var SPOT_TEAM = null, ED_CACHE = {CT:null, T:null}, EXP_CACHE = {};
function spotExposure(team, x, y){
  if(!BZ.ids.length || !team) return 0;
  var ck = team+Math.round(x/12)+","+Math.round(y/12); if(EXP_CACHE[ck] !== undefined) return EXP_CACHE[ck];
  var ED = ED_CACHE[team];
  if(!ED){ var sp = team === "CT" ? T_SPAWN : CT_SPAWN, z0 = bzOf(sp.x, sp.y); ED = ED_CACHE[team] = bzDist(z0 >= 0 ? [z0] : []); }
  var zc = bzOf(x, y), bins = {}, n = 0;
  if(zc >= 0){
    var my = ED[zc];
    for(var j=0;j<BZ.ids.length;j++){
      if(j === zc || !(ED[j] < my - 80)) continue;
      var smp = ZONE_SAMPLES[BZ.ids[j]] || (BZ.cent[j] ? [BZ.cent[j]] : []);
      for(var k=0;k<smp.length && k<5;k++){
        var q = smp[k], d = Math.hypot(q.x-x, q.y-y); if(d < 60 || d > 1000) continue;
        if(!hasLOS(x, y, q.x, q.y)) continue;
        var bi = Math.round(Math.atan2(q.y-y, q.x-x)/0.55); if(bi === -6) bi = 6;
        if(!bins[bi]){ bins[bi] = 1; n++; }
        break;
      }
    }
  }
  EXP_CACHE[ck] = n;
  return n;
}
function pickSpots(key, center, count, o){
  var expT = BAL.openAngles ? ((o && o.team) || SPOT_TEAM) : null;
  var ppTeam = BAL.proPrior ? ((o && o.team) || SPOT_TEAM) : null, ppL = ppTeam ? ppLayer(ppTeam) : null;
  var ck = key+"|"+count+"|"+Math.round(center.x)+","+Math.round(center.y) + (expT ? "|e"+expT : "") +
    (o && o.cross ? "|x"+Math.round(o.cross.from.x/40)+","+Math.round(o.cross.from.y/40) : "") + (ppL ? "|p"+ppL : "");
  if(spotCache[ck]) return spotCache[ck];
  o = o || {};
  var rMin = o.rMin||0, rMax = o.rMax||170, gap = o.minGap||55;
  var cands = [];
  NAVAREAS.forEach(function(z){
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var c = zoneCentroid(z);
    var d = Math.hypot(c.x-center.x, c.y-center.y);
    if(d < rMin || d > rMax) return;
    if(insideSolidWall(c.x, c.y)) return;
    if(o.must && !o.must.every(function(m){ return hasLOS(c.x, c.y, m.x, m.y); })) return;
    if(o.reach && segCrossesManualWalls(center.x, center.y, c.x, c.y) && d < 60) return;
    var sc = 0;
    (o.hideFrom||[]).forEach(function(h){ if(!hasLOS(c.x, c.y, h.x, h.y)) sc += 2; });
    (o.see||[]).forEach(function(h){ if(hasLOS(c.x, c.y, h.x, h.y)) sc += 1; });
    // раздел 11.1: двойное покрытие — точка ценна не только видимостью основного
    // подхода, но и тем, что попутно простреливает второе направление (коннектор)
    (o.seeW||[]).forEach(function(h){ if(hasLOS(c.x, c.y, h.pt.x, h.pt.y)) sc += h.w; });
    // раздел 11.1: "занимают под раскид" — держат точку с поправкой на то, куда
    // враг обычно кидает молотов/HE в этом матче, а не только от пуль
    (o.avoidNades||[]).forEach(function(h){ var hd = Math.hypot(c.x-h.x, c.y-h.y); if(hd < 220) sc -= 1.4*(1 - hd/220); });
    // раздел 12: кроссфаер — вторая точка смотрит на тот же вход под другим
    // углом, чем первый защитник (50–120°): у кого-то из двоих всегда есть выстрел,
    // и заходящий не может взять обоих одним пиком
    if(o.cross){
      var X = o.cross, pt = X.pt;
      if(hasLOS(c.x, c.y, pt.x, pt.y) && Math.hypot(c.x-X.from.x, c.y-X.from.y) > 90){
        var a1 = Math.atan2(c.y-pt.y, c.x-pt.x), a2 = Math.atan2(X.from.y-pt.y, X.from.x-pt.x);
        var da = Math.abs(((a1-a2+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
        if(da > 0.87 && da < 2.1) sc += 1.5; else if(da > 0.5) sc += 0.6;
      }
    }
    sc -= d/(rMax*3); // при прочих равных — ближе к центру
    if(ppL) sc += BAL.proW * proAt(ppTeam, c.x, c.y, ppL);
    if(expT){ var ex = spotExposure(expT, c.x, c.y); if(ex > 1) sc -= 0.8*(ex - 1); }
    cands.push({x:c.x, y:c.y, sc:sc});
  });
  cands.sort(function(a,b){ return b.sc - a.sc; });
  var out = [];
  for(var i=0;i<cands.length && out.length<count;i++){
    var c = cands[i];
    if(out.some(function(q){ return Math.hypot(q.x-c.x, q.y-c.y) < gap; })) continue;
    out.push(c);
  }
  while(out.length < count) out.push({x:center.x, y:center.y}); // запас, если места не нашлось
  spotCache[ck] = out;
  return out;
}
// раздел 11.1: не строго лучший вариант, но лучший — чаще; сохраняет
// непредсказуемость выбора позиции (её не должны "читать" по одному прогону),
// но мягко тянет к точкам с лучшим покрытием / меньшей историей вражеских гранат
function weightedPick(n, seed){
  if(n <= 1) return 0;
  var total = n*(n+1)/2, r = hashRand(seed)*total, acc = 0;
  for(var i=0;i<n;i++){ acc += (n-i); if(r < acc) return i; }
  return n-1;
}
// поставить группу ботов на разные позиции вокруг точки
function groupPost(members, center, look, tag, o){
  if(!members.length) return;
  var spots = pickSpots(tag, center, members.length, o);
  members.forEach(function(b, i){ setPost(b, spots[i], look, true, tag); });
}

