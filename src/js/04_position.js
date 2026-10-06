// (3) "слишком спешат": скорость была 150px/с = 375 юнитов/с (1px ≈ 2.5 юнита),
// в 1.5 раза быстрее CS2 (M4 225 ю/с, нож 250). Отсюда первый фраг на 7-й
// секунде и плант на 34-й. Реальная: M4 225 ю/с = 90px/с, шифт ~0.5 от неё
var SPD_K = 1;
if(BAL.realSpeed){ SPEED = 90; SPD_K = SPEED/150; ACCEL = 700*SPD_K; }

var ROLE_LABEL = {anchorA:"опорник A", anchorB:"опорник B", mid:"мидер", rotator:"ротатор", roamer:"роумер",
                  entry:"энтри", awp:"снайпер", support:"второй (размен)", igl:"саппорт · IGL", lurker:"лёркер"};
// ники игроков и номера 0–9 (T — 0…4, CT — 5…9); внутри кода id остаются T0…CT4
var NICKS = {T0:"donk", T1:"sh1ro", T2:"TN1R", T3:"magixx", T4:"zont1x", CT0:"kyousuke", CT1:"m0NESY", CT2:"TeSeS", CT3:"karrigan", CT4:"NiKo"};
function pnum(id){ var m = /^(CT|T)(\d)$/.exec(id||""); return m ? (m[1] === "T" ? +m[2] : 5 + (+m[2])) : ""; }
function nick(id){ return NICKS[id] || id; }
function nickify(t){ return String(t).replace(/\b(CT|T)([0-4])\b/g, function(m){ return NICKS[m] || m; }); }
var TEAM_ROLES = {
  CT: ["anchorA", "mid", "anchorB", "rotator", "roamer"],   // CT1 — мидер с AWP (AWP покупает второй бот)
  T:  ["entry", "awp", "support", "igl", "lurker"]           // T4 — лёркер (в setup ходит маршрутом роумера)
};
bots.forEach(function(b){
  var idx = parseInt(b.id.replace(/\D/g,""),10);
  b.tRole = TEAM_ROLES[b.team][idx];
});
// ======================= РАЗДЕЛ 13 (п.6–7): ПРОФИЛИ ИГРОКОВ =======================
// Личный стиль поверх роли (0…1): aggr — агрессия (первым лезет в дуэли, широкие
// пики), disc — дисциплина (держит угол, не суетится, реже ошибается), risk —
// склонность к риску (не отходит на низком HP), util — гранаты (точность
// лайнапов), clutch — игра в клатчах. aim — навык стрельбы, react — реакция (тики).
// Средние по командам одинаковые — профили меняют стиль, а не силу команды.
var PROFILES = {
  T0:  {aim:1.18, react:16, aggr:0.95, disc:0.45, risk:0.85, util:0.45, clutch:0.70, style:"агрессивный энтри, лезет первым"},
  T1:  {aim:1.08, react:18, aggr:0.25, disc:0.95, risk:0.25, util:0.60, clutch:0.90, style:"терпеливый снайпер, ждёт ошибку"},
  T2:  {aim:0.96, react:22, aggr:0.50, disc:0.70, risk:0.50, util:0.80, clutch:0.55, style:"саппорт, гранаты и трейды"},
  T3:  {aim:0.92, react:23, aggr:0.40, disc:0.80, risk:0.40, util:0.90, clutch:0.60, style:"IGL, играет от инфы"},
  T4:  {aim:0.96, react:22, aggr:0.55, disc:0.60, risk:0.60, util:0.60, clutch:0.75, style:"лёркер, тихие обходы"},
  CT0: {aim:1.05, react:18, aggr:0.80, disc:0.50, risk:0.75, util:0.50, clutch:0.70, style:"агрессивный опорник, пикает первым"},
  CT1: {aim:1.14, react:17, aggr:0.75, disc:0.55, risk:0.80, util:0.55, clutch:0.80, style:"рискованный AWP, агрессивные пики"},
  CT2: {aim:0.95, react:23, aggr:0.45, disc:0.75, risk:0.45, util:0.70, clutch:0.60, style:"надёжный опорник, держит сайт"},
  CT3: {aim:0.82, react:27, aggr:0.40, disc:0.85, risk:0.50, util:0.95, clutch:0.55, style:"IGL, гранаты и коллы"},
  CT4: {aim:1.06, react:19, aggr:0.70, disc:0.60, risk:0.65, util:0.60, clutch:0.75, style:"роумер, ищет фраг и инфу"}
};
bots.forEach(function(b){
  var P = PROFILES[b.id]; if(!P) return;
  b.prof = P; b.skill = P.aim; b.reactionTicks = P.react;
});
function prof(b, k, def){ return b && b.prof && b.prof[k] != null ? b.prof[k] : (def == null ? 0.5 : def); }

function centroidOf(pts){ var cx=0, cy=0; pts.forEach(function(p){ cx+=p.x; cy+=p.y; }); return {x:cx/pts.length, y:cy/pts.length}; }

// ---------- сайты и авто-геометрия (проходы, точки сбора, позиции) ----------
var SITES = {}, GEO = {};
function pathPts(ax, ay, bx, by){
  var p = buildWaypointPath(ax, ay, 0, bx, by, 0);
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
  if(site.poly) NAVAREAS.forEach(function(z){
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var c = zoneCentroid(z);
    if(!pointInPoly(c.x, c.y, site.poly) || insideSolidWall(c.x, c.y)) return;
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
      NAVAREAS.forEach(function(z){ if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return; var c = zoneCentroid(z);
        if(!pointInPoly(c.x, c.y, site.poly)) return; var d = Math.hypot(c.x-zp.x, c.y-zp.y); if(d > NADE_THROW_RANGE*0.8) return;
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
function sitePlantSpot(site){
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

// ---------- посты: "куда встать и куда смотреть" ----------
// Когда у бота в патруле есть пост — он идёт к нему, а дойдя (hold) стоит и
// смотрит в look. Бой (engage/hold/retreat) по-прежнему перебивает всё.
// ---- маршруты по названиям зон ----
// startRoute(b, ["Split","Lower Mid","Mid","Donut"]) — бот сначала проходит эти
// зоны по порядку, а уже потом идёт на пост, который ему выставит мозг роли
// (пост запоминается и применяется в конце маршрута). Бой, ретейк, бомба —
// важнее: маршрут снимается.
function startRoute(b, names, key){
  if(!names || !names.length) return;
  if(b._route && b._route.key === key) return;
  if(b._routeDone === key+"|"+roundNum) return;
  var pts = [], prev = {x:b.x, y:b.y};
  names.forEach(function(n){ var p = zonePoint(n, prev); if(p){ pts.push(p); prev = p; } });
  if(!pts.length) return;
  var bi = 0, bd = Infinity;
  pts.forEach(function(p, i){ var d = Math.hypot(p.x-b.x, p.y-b.y); if(d < bd){ bd = d; bi = i; } });
  if(bd < 90) bi++;
  if(bi >= pts.length) return;
  b._route = {key:key, pts:pts, idx:bi, t0:tick, names:names};
}
function routeTick(){
  bots.forEach(function(b){
    var R = b._route; if(!R) return;
    if(!b.alive || roundState !== "live" || tick - R.t0 > 35*TICK_HZ){ b._route = null; return; }
    var cp = R.pts[R.idx];
    if(cp && Math.hypot(cp.x-b.x, cp.y-b.y) < 70) R.idx++;
    if(R.idx >= R.pts.length){
      var W = R.want; b._routeDone = R.key+"|"+roundNum; b._route = null;
      if(W) setPost(b, W[0], W[1], W[2], W[3], W[4]);
    }
  });
}
// (v162) ПРО-ТОЧКИ: [x, y, раундов, угол1, доля1, угол2?, доля2?] по слоям "сторона|pre/post"
var PRO_SPOTS = @@DATA:pro_spots.json@@;
var PSN = {R:120, occ:45, maxOff:1.05};
var PSN_TAGS = /^(rebal|anchor|rotator|mid$|set:|clutch|stage|lurkStage|lurk$|awpline|postplant|repos:fallback|repos:back|sitehold|rotateHold|midcover|cts:|stack)/;
function proSnap(b, pt, look, tag){
  if(!PSN_TAGS.test(tag || "")) return null;
  var layer = b.team + "|" + (bomb && bomb.state === "planted" ? "post" : "pre");
  var key = layer+"|"+tag+"|"+Math.round(pt.x/8)+","+Math.round(pt.y/8)+"|"+(look ? Math.round(look.x/40)+","+Math.round(look.y/40) : "");
  if(b._psK === key && b._psR === roundNum && b._psM === matchNum) return b._psV;
  b._psK = key; b._psR = roundNum; b._psM = matchNum; b._psV = null;
  var L = PRO_SPOTS[layer]; if(!L) return null;
  var best = null, bs = -1e9;
  for(var i=0;i<L.length;i++){
    var s = L[i], d = Math.hypot(s[0]-pt.x, s[1]-pt.y); if(d > PSN.R) continue;
    if(!hasLOS(s[0], s[1], pt.x, pt.y) || insideSolidWall(s[0], s[1])) continue;
    if(bots.some(function(o){ return o !== b && o.alive && o.team === b.team && o.post && Math.hypot(o.post.x-s[0], o.post.y-s[1]) < PSN.occ; })) continue;
    var modes = [[s[3], s[4]]]; if(s.length > 5) modes.push([s[5], s[6]]);
    var md = 0;
    if(look){ var wa = Math.atan2(look.y-s[1], look.x-s[0]); md = Math.min.apply(null, modes.map(function(m){ return _angOff(m[0], wa); })); if(md > PSN.maxOff) continue; }
    var sc = Math.log(1 + s[2]) - 1.5*d/PSN.R - 0.8*md;
    if(sc > bs){ bs = sc; best = {pt:{x:s[0], y:s[1]}, sp:{m:modes, r:s[2], k:i}}; }
  }
  b._psV = best;
  return best;
}
// «как у про» — один источник для дележа углов: на про-точке — направления,
// которые держат про именно с этой точки (доля каждого), иначе — сетка
// взглядов из демок по месту. Это вес кандидата, а не приказ: угол, который
// поручила команда, или свежая угроза важнее.
function proDirs(b, moving){
  var P = !moving && b.atPost && b.post && b.post.pro;
  if(P && P.m && P.m.length) return P.m.map(function(m){ return {a:m[0], w:m[1]}; });
  var PL = proLookAt(b.team, b.x, b.y); if(!PL) return [];
  return [{a:Math.atan2(PL.dy, PL.dx), w:PL.R}];
}
// (v162) отдельно стоящие ящики/колонны — небольшие замкнутые контуры стен
var _WB = null, _WBn = -1;
function wallBoxes(){
  if(_WB && _WBn === MANUAL_WALLS.length) return _WB;
  _WBn = MANUAL_WALLS.length; _WB = [];
  var W = MANUAL_WALLS, par = W.map(function(_, i){ return i; });
  var f = function(i){ while(par[i] !== i){ par[i] = par[par[i]]; i = par[i]; } return i; };
  var K = function(x, y){ return Math.round(x/3)+","+Math.round(y/3); }, idx = {};
  W.forEach(function(w, i){ [[w[0],w[1]],[w[2],w[3]]].forEach(function(p){
    var kx = Math.round(p[0]/3), ky = Math.round(p[1]/3);
    for(var dx=-1;dx<=1;dx++) for(var dy=-1;dy<=1;dy++){ (idx[(kx+dx)+","+(ky+dy)]||[]).forEach(function(j){ par[f(i)] = f(j); }); }
    (idx[kx+","+ky] = idx[kx+","+ky] || []).push(i); }); });
  var comp = {}; W.forEach(function(_, i){ (comp[f(i)] = comp[f(i)] || []).push(i); });
  Object.keys(comp).forEach(function(c){
    var S = comp[c], xs = [], ys = [];
    S.forEach(function(i){ xs.push(W[i][0], W[i][2]); ys.push(W[i][1], W[i][3]); });
    if(Math.max(Math.max.apply(null, xs)-Math.min.apply(null, xs), Math.max.apply(null, ys)-Math.min.apply(null, ys)) >= 90) return;
    // обход контура по сегментам
    var left = S.slice(), poly = [[W[left[0]][0], W[left[0]][1]], [W[left[0]][2], W[left[0]][3]]]; left.shift();
    var guard = 0;
    while(left.length && guard++ < 200){
      var e = poly[poly.length-1], hit = -1, rev = false;
      for(var q=0;q<left.length;q++){ var w = W[left[q]];
        if(Math.hypot(w[0]-e[0], w[1]-e[1]) < 4){ hit = q; break; }
        if(Math.hypot(w[2]-e[0], w[3]-e[1]) < 4){ hit = q; rev = true; break; } }
      if(hit < 0) break;
      var w2 = W[left[hit]]; poly.push(rev ? [w2[0], w2[1]] : [w2[2], w2[3]]); left.splice(hit, 1);
    }
    if(!left.length) _WB.push(poly);
  });
  return _WB;
}
// (v173) одна задача бота и её важность: кто кого перебивает при выборе позиции.
// Выше — важнее; пост без задачи (роль, план) — 1.
var TASK_PRIO = [[/^(defuse|flee|plantspot|stopplant|antidefuse)/, 10], [/^tradeR/, 9], [/^(save|fetch)/, 8],
  [/^(retake|postplant)/, 7], [/^lineup/, 6], [/^(smokeWait|pickup)/, 5], [/^repos/, 4], [/^endhunt/, 3], [/^probe/, 2]];
function taskPrio(tag){ for(var i=0;i<TASK_PRIO.length;i++) if(TASK_PRIO[i][0].test(tag || "")) return TASK_PRIO[i][1]; return 1; }
function taskOn(b, kind){ var T = b._task; return !!(T && tick <= T.until && (!kind || T.k === kind)); }
// занять задачу до тика until; более важную текущую задачу не перебивает
function holdTask(b, kind, until, data){ var T = b._task, p = taskPrio(kind);
  if(T && tick <= T.until && T.k !== kind && T.p > p) return;
  b._task = {k:kind, p:p, until:until, d:data || null}; }
function dropTask(b, kind){ if(b._task && b._task.k === kind) b._task = null; }
function setPost(b, pt, look, hold, tag, spreadIdx){
  // сменил позицию после фрага — роль в этом раунде ставит его уже на новую точку
  if(BAL.holdShift && b._hs && b._hs.round === roundNum && b._hs.tag === tag && pt && Math.hypot(pt.x-b._hs.pt.x, pt.y-b._hs.pt.y) < 320) pt = b._hs.pt;
  // (v173) кто кого перебивает — один приоритет задач вместо 9 замков: у бота
  // одна текущая задача (важность + срок); пост с меньшей важностью её не
  // перебивает. Таблица важности — TASK_PRIO.
  var T = b._task;
  if(T && T.k === "tradeR" && tick > T.until){ b._avoidPeekUntil = tick + 6*TICK_HZ; b._avoidPeekAt = T.d.at; b._task = T = null; }
  if(T && tick <= T.until && T.p > taskPrio(tag)){
    if(T.k === "smokeWait" && b._smokeWait) b._smokeWait.want = [pt, look, hold, tag];
    return;
  }
  if(tag === "lineup") b._route = null;
  if(b._route && !/^route/.test(tag)){
    var R = b._route;
    if(/^(retake|defuse|flee|save|fetch|postplant|hunt|repos|stopplant|antidefuse|endhunt)/.test(tag) || (bomb && bomb.state === "planted" && b.team === "CT")){ b._route = null; }
    else if(R.idx < R.pts.length){
      R.want = [pt, look, hold, tag, spreadIdx];
      var cp = R.pts[R.idx], nx = R.pts[R.idx+1] || pt;
      return setPost(b, cp, nx, true, "route:"+R.names[Math.min(R.idx, R.names.length-1)]);
    }
  }
  if(b._rebal && b._rebal.round === roundNum && !/^(rebal|retake|defuse|flee|save|fetch|stopplant|antidefuse|tradeR|repos|clutch|rotate|endhunt|gather|midcover|lineup|smokeWait|pickup)/.test(tag)) return;
  var psn = (BAL.proSpots && hold && pt) ? proSnap(b, pt, look, tag) : null;
  if(psn){ pt = psn.pt; spreadIdx = 0; }
  var id = tag + "|" + Math.round(pt.x) + "," + Math.round(pt.y);
  if(b.post && b.post.id === id) return;
  var x = pt.x, y = pt.y;
  if(spreadIdx){ // несколько ботов на одну точку — раздвигаем поперёк взгляда
    var la = look ? Math.atan2(look.y-y, look.x-x) : 0;
    var off = spreadIdx * 22;
    var nx = x + Math.cos(la+Math.PI/2)*off, ny = y + Math.sin(la+Math.PI/2)*off;
    if(!insideSolidWall(nx, ny) && !segCrossesManualWalls(x, y, nx, ny)){ x = nx; y = ny; }
  }
  b.post = {id:id, x:x, y:y, look:look||null, hold:hold, tag:tag};
  if(psn) b.post.pro = psn.sp;
  b.atPost = false;
  if(b.state === "patrol"){ b.path = []; b.pathIdx = 0; }
}
function clearPost(b){ if(b.post){ b.post = null; b.atPost = false; if(b.state==="patrol"){ b.path = []; b.pathIdx = 0; } } }
function updatePost(b){
  if(!b.post || b.state !== "patrol"){ b.atPost = false; return; }
  var ep = fireSafe(b.post, b);
  if(ep !== b.post && b.atPost && Math.hypot(ep.x-b.baseX, ep.y-b.baseY) > 34){ b.atPost = false; b.path = []; b.pathIdx = 0; }
  var d = Math.hypot(ep.x-b.baseX, ep.y-b.baseY);
  if(b.post.hold){
    // точка планта: "дошёл" — это именно внутри зоны сайта, а не в 34px от точки
    // (иначе носитель останавливался у края зоны, снаружи, и не мог заложить)
    var arrived = b.post.tag === "plantspot" && teamTac.T && SITES[teamTac.T.site] ? (d < 10 || onSite(SITES[teamTac.T.site], b.baseX, b.baseY) && d < 60) : d < ((BAL.proSpots && b.post.pro) ? 9 : 34);
    // (опорник "не дошёл") точка поста чуть внутри угла/стены: бот доходил на
    // 30–60px и крутился рядом, не "вставая" на пост. Не приближается ~1.5с — встал
    if(BAL.arriveNear && !b.atPost && !arrived && b.post.tag !== "plantspot"){
      if(b._apId !== b.post.id){ b._apId = b.post.id; b._apBest = d; b._apT = tick; }
      else if(d < b._apBest - 6){ b._apBest = d; b._apT = tick; }
      else if(d < 70 && tick - b._apT > 90) arrived = true;
    }
    if(!b.atPost && arrived){ b.atPost = true; b.path = []; b.pathIdx = 0;
      // встал с AWP на угол — щелчок зума слышно рядом (≤200 по прямой, ≤120 за стеной)
      if(b.weapon && b.weapon.key === "AWP" && roundState === "live" && tick - (b._zoomTick||-9999) > 3*TICK_HZ){
        b._zoomTick = tick;
        emitSound(b, b.x, b.y, 200, 120, "zoom", tick*53 + (b.id.charCodeAt(b.id.length-1)||0)).forEach(function(o){
          voiceLog(o.team, "zoom"+b.id, o.id, "слышу зум AWP "+calloutName(o.heardSound.x, o.heardSound.y));
        });
      }
    }
    else if(b.atPost && d > 80) b.atPost = false;
  } else b.atPost = false;
}

