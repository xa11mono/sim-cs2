// [хозяева: pickSaveSpot, retakeSetRetakeRole, retakeSetSaveSpot, updateRetake]
var SAVE_TOPN = 12;
function pickSaveSpot(b){
  // только то, что команда знает (радар/слышали за 15с), а не настоящие позиции T
  var ts = [], BLs = kvLast("CT");
  for(var eidS in BLs){ var loS = BLs[eidS]; if(tick - loS.tick > 15*TICK_HZ) continue; if(bots.some(function(o){ return o.id === eidS && o.alive; })) ts.push({x:loS.x, y:loS.y}); }
  var best = null, bs = -Infinity, cands = [];
  NAVAREAS.forEach(function(z, i){
    if(i % 3) return; // прореживаем кандидатов — ~650 хватает с запасом
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var c = zoneCentroid(z);
    if(insideSolidWall(c.x, c.y)) return;
    // (v381, М134: по замеру v381 после правки ухода T от бомбы от взрыва гибли только CT на сейве — один в 923 px, где проверки урона
    // не было, второй не успел дойти) сейв — там, куда взрыв не достаёт (на любом расстоянии) и куда успеть дойти до взрыва
    if(bomb.state === "planted" && bombDamageAt(c.x, c.y, bombKnownFor(b)) > 0) return;   // (изоляция) взрыв — от точки по знанию CT
    if(bomb.state === "planted" && DM.hypot(c.x-b.baseX, c.y-b.baseY)*1.3/SPEED > bombTimeLeftTicks()/TICK_HZ - 1) return;   // 1,3 — путь длиннее прямой: проектное число
    var dT = Infinity, seen = false;
    ts.forEach(function(t){ dT = Math.min(dT, DM.hypot(c.x-t.x, c.y-t.y)); if(hasLOS(c.x,c.y,t.x,t.y)) seen = true; });
    if(seen || dT < 500) return;
    if(DM.hypot(c.x-CT_SPAWN.x, c.y-CT_SPAWN.y) < 220) return; // не на самом спавне
    var dSelf = DM.hypot(c.x-b.baseX, c.y-b.baseY);
    var zcC = zoneIdAt(c.x, c.y), openC = zcC ? (ZONE_DANGER[zcC] || []).length : 0;   // (v375) не на виду — как у T
    var sc = Math.min(dT, 1200)*0.6 - dSelf - openC*40; // подальше от T, но не бежать через всю карту, укрыто
    cands.push({c:c, sc:sc, dT:dT, openC:openC});
  });
  // (док 6, п.7: kyousuke р4 сейвил на Vent — 62 ед. по прямой, 1255 по пути через Mid, Ramp, Catwalk — и встретил T на Cross) лучшие
  // SAVE_TOPN мест по прямой пересчитываются по пути: «недалеко бежать» — длина пути, а путь, где команда видела T (≤ 15 с) с его точек, — не
  // сейв. SAVE_TOPN — проектное число (чтобы не искать путь к 600 местам)
  cands.sort(function(a, c){ return c.sc - a.sc; });
  cands.slice(0, SAVE_TOPN).forEach(function(q){
    var pts = pathPts(b.baseX, b.baseY, q.c.x, q.c.y, b.z), L = polyLen(pts), seenP = false;
    for(var k = 0; k < pts.length && !seenP; k++) ts.forEach(function(t){ if(!seenP && hasLOS(pts[k][0], pts[k][1], t.x, t.y)) seenP = true; });
    if(seenP) return;
    var sc2 = Math.min(q.dT, 1200)*0.6 - L - q.openC*40;
    if(sc2 > bs){ bs = sc2; best = q.c; } });
  if(!best && cands.length) best = cands[0].c;
  return best ? {x:best.x, y:best.y} : {x:CT_SPAWN.x, y:CT_SPAWN.y};
}
// укрытие для сейва T: подальше от известных CT и от сайтов, не на виду у живых CT
// (v381, М137) доля раундов, где T в меньшинстве до планта выжили без планта (сейв), у про: [T][CT] → [> 55 с, 30–55 с, < 30 с до конца
// раунда]; демки Ancient + Mirage, среднее двух карт (tools/measure: скрипт в DECISIONS v381), 30–316 раундов на клетку
var T_SAVE_PRO = {1: {2: [0.09, 0.06, 0.18], 3: [0.04, 0.09, 0.18], 4: [0.05, 0.10, 0.27], 5: [0.02, 0.09, 0.21]},
                  2: {3: [0.10, 0.11, 0.20], 4: [0.08, 0.14, 0.27], 5: [0.08, 0.19, 0.35]}};
// (v519, пак 09.11 п.22; А-19: «бежал ставить в клатче 1в3 и на полпути получил сейв, хотя успевал») решение о сейве — одно на расклад живых в раунде:
// кусок времени (> 55 / 30–55 / < 30 с) берётся тот, когда расклад появился, а не перебрасывается кубик, когда время пересекает 55 и 30 с
var TSAVE_K = {};
function tSaveRoll(aT, aC, secLeft){
  var P = T_SAVE_PRO[aT] && T_SAVE_PRO[aT][Math.min(aC, 5)]; if(!P) return false;
  var key = matchNum+":"+roundNum+":"+aT+"v"+aC;
  if(TSAVE_K[key] == null) TSAVE_K[key] = secLeft > 55 ? 0 : (secLeft > 30 ? 1 : 2);
  var k = TSAVE_K[key];
  return hashRand(roundNum*911 + matchNum*37 + aT*101 + aC*13 + k*7) < P[k];
}
// (v434) сейвить ли T сейчас — одно решение для начала сейва и для пересмотра (brain-t): раунд безнадёжен по доле про для этого расклада
// (tSaveRoll), есть что сохранять (оружие ≥ 1500 в среднем и перейдёт в следующий раунд — saveWorth, 530), носитель не на сайте
function tSaveWant(ts, aT, aC, secLeft, site){
  if(!ts.length) return false;
  // (00_PLAN п.10, ответ владельца 6А: «сейв отменяется, когда известна позиция противников и их можно изолировать») все живые CT замечены
  // командой за SITE_SEEN_SEC (siteAssess: неизвестных 0) — не сейв
  if(siteAssess("T", "A").unknown === 0) return false;
  var gunVal = ts.reduce(function(a, b){ return a + (b.primary ? WEAPONS[b.primary].price : 0); }, 0) / aT;
  var carOn = bomb.state === "carried" && bomb.carrier && bomb.carrier.alive && DM.hypot(bomb.carrier.x-site.x, bomb.carrier.y-site.y) < 380;
  // (v442, док владельца 27.10, р6: сейвили вдвоём при 10 тыс. и 9 тыс. у команды) сохранять оружие стоит, только если без него команда
  // в следующем раунде не купит фулл всем: деньги команды + доход за поражение против фулла каждому и оружия сейвящих (проектная мерка)
  var Ts = bots.filter(function(o){ return o.team === "T"; }), inc = nextLossIncome("T");
  var bank = Ts.reduce(function(a, o){ return a + o.money + inc; }, 0), need = Ts.reduce(function(a, o){ return a + fullNeedU(o); }, 0) + gunVal*aT;
  if(bank >= need) return false;
  return gunVal >= 1500 && !carOn && saveWorth("T") && tSaveRoll(aT, aC, secLeft);
}
// (00_PLAN п.10, ответ владельца 6А, 05.11: «если последний игрок ещё может безопасно забрать бомбу и установить её, он должен оценить
// возможность завершить раунд; прятаться ради оружия при реальной возможности установки — плохое решение») есть ли у T реальный плант по
// тому, что команда знает: бомба у живого T или лежит; сайт, который команда оценивает как пустой (siteAssess «empty» — все живые CT замечены
// далеко за SITE_SEEN_SEC: верно в 95 % Mirage / 91 % Ancient, прогон 141); ближайший к бомбе T доходит до сайта и ставит до конца раунда
function tPlantChance(ts, secLeft){
  if(!bomb || (bomb.state !== "carried" && bomb.state !== "dropped")) return false;
  var src = bomb.state === "carried" ? bomb.carrier : null; if(src && !src.alive) return false;
  return ["A","B"].filter(function(k){
    if(siteAssess("T", k).level !== "empty") return false;
    var S = SITES[k];
    return ts.some(function(b){ var L = src ? (b === src ? pathLenTo(b, S.x, S.y) : Infinity) : pathLenTo(b, bomb.x, bomb.y) + polyLen(pathPts(bomb.x, bomb.y, S.x, S.y, bomb.z));
      return L/SPEED + PLANT_TICKS/TICK_HZ < secLeft; });
  })[0] || null;   // сайт, куда успевают (A раньше B — порядок проверки; оба пусты — редкость)
}
// сейв T: каждый живой — к своему месту сейва (один раз выбранному), бомбу не ставит
function tSaveHold(){
  bots.forEach(function(b){ if(b.team !== "T" || !b.alive) return;
    if(!b._saveSpot) retakeSetSaveSpot(b, pickSaveSpotT(b));
    if(!b.planting) setPost(b, b._saveSpot, null, true, "save"); });
}
function pickSaveSpotT(b){
  var cts = [], BLt = kvLast("T");
  for(var eidT in BLt){ var loT = BLt[eidT]; if(tick - loT.tick > 15*TICK_HZ) continue; if(bots.some(function(o){ return o.id === eidT && o.alive; })) cts.push({x:loT.x, y:loT.y}); }
  var known = []; for(var id in kvLast("T")){ known.push(kvLast("T")[id]); }
  var best = null, bs = -Infinity;
  NAVAREAS.forEach(function(z, i){
    if(i % 3) return;
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var c = zoneCentroid(z);
    if(insideSolidWall(c.x, c.y)) return;
    var dSite = Math.min(DM.hypot(c.x-SITES.A.x, c.y-SITES.A.y), DM.hypot(c.x-SITES.B.x, c.y-SITES.B.y));
    if(dSite < 500) return;
    var dK = Infinity, seen = false;
    known.forEach(function(k){ dK = Math.min(dK, DM.hypot(c.x-k.x, c.y-k.y)); });
    cts.forEach(function(t){ if(hasLOS(c.x, c.y, t.x, t.y)) seen = true; });
    if(seen || dK < 550) return;
    var dSelf = DM.hypot(c.x-b.baseX, c.y-b.baseY);
    var dTS = DM.hypot(c.x-T_SPAWN.x, c.y-T_SPAWN.y);
    // (v375, отметка владельца: «сейвит в открытом месте») место сейва — укрытое: из скольких зон карты оно простреливается
    // (ZONE_DANGER, та же 3D-видимость) — штраф за каждую (40 — проектное число); раньше открытость не учитывалась
    var zc = zoneIdAt(c.x, c.y), open = zc ? (ZONE_DANGER[zc] || []).length : 0;
    var sc = Math.min(dK, 1200)*0.5 - dSelf - dTS*0.15 - open*40; // подальше от CT, недалеко бежать, ближе к своей стороне, не на виду
    if(sc > bs){ bs = sc; best = c; }
  });
  return best ? {x:best.x, y:best.y} : {x:T_SPAWN.x, y:T_SPAWN.y};
}
// ======================= ШАГ 6: ретейк (план §8, §11.1 п.6) =======================
// После планта у CT роли: Defuser (дефузит; предпочтительно с китом) / Cover
// (держит углы с видом на бомбу, пока идёт дефуз) / Flank (заходит с другой
// стороны) / Save (если ретейк безнадёжен — см. выше).
// Синхронизация: сначала каждый идёт к своей ТОЧКЕ СБОРА — укрытию у сайта,
// откуда бомбу не видно (не подставляться по одному под пост-плант позиции
// T); точки сбора выводятся из геометрии сами: кольцо 230-480px вокруг
// бомбы, делится на сектора по направлению, в каждом — ближайшее к CT
// укрытие. Заходят все вместе, когда у точек собралось достаточно людей —
// или раньше, если по честному расчёту иначе не успеть (путь от точки сбора
// до бомбы + дефуз > остаток таймера).
// (п.6/30 владельца 29.10, м1 р8: лайнап выбран по пути 1100, а шёл 2046 — с v469 движение платит за известных врагов, а длина «сколько
// идти» считалась без этого) длина — того же пути, по которому бот пойдёт (цена команды за известных врагов, его полоса)
function pathLenTo(b, x, y){
  var Q = PATHQ_Q, p = pathQ("l"+b.team+"|"+b.id+"|"+Math.round(b.baseX/Q)+","+Math.round(b.baseY/Q)+","+Math.round((b.z||0)/32)+">"+Math.round(x/Q)+","+Math.round(y/Q), function(){ return buildWaypointPath(b.baseX, b.baseY, b.z, x, y, 0, b.team, botLane(b)); });
  var L = 0, px = b.baseX, py = b.baseY;
  p.forEach(function(q){ L += DM.hypot(q[0]-px, q[1]-py); px = q[0]; py = q[1]; });
  return L;
}
// (изоляция, 27.11; аудит Codex № 1–11, C4-A…C) где бомба по знанию CT — одно место для всех решений CT (сейв, ретейк, дефуз, ниндзя,
// взгляд, гранаты): видели (радар команды, датчик knowTeamLook) — точка и время; знают сайт (колл, звук планта, вывод «там не слышали»,
// увиденная бомба) — оценка по местам планта про на этом сайте (данные карты MAP.pro.plants, доли); сайт неизвестен — сайт с большим весом
// гипотез команды о T (знание, не истина); ничего — null (плана ретейка ещё нет). Истинное место бомбы не читается; «заложена» — публичное (HUD)
function ctBombSite(){
  var K = teamAgent("CT").know, cts = bots.filter(function(o){ return o.alive && o.team === "CT" && o.know; });
  if(K.bombPt && !K.bombPt.gone && K.bombPt.site) return K.bombPt.site;
  var sure = cts.filter(function(o){ return o.know.plantSite && !o.know.plantGuess; })[0]; if(sure) return sure.know.plantSite;
  if(K.plantSite) return K.plantSite;
  var g = cts.filter(function(o){ return o.know.plantSite; })[0]; if(g) return g.know.plantSite;
  var B = belief.CT || {}, m = {}; Object.keys(SITES).forEach(function(X){ m[X] = 0; });
  Object.keys(B).forEach(function(eid){ var P = B[eid]; for(var i = 0; i < P.length; i++){ if(!P[i] || !BZ.cent[i]) continue; var X = knowNearestSite(BZ.cent[i].x, BZ.cent[i].y); if(X in m) m[X] += P[i]; } });
  var best = null; Object.keys(m).forEach(function(X){ if(m[X] > 0 && (!best || m[X] > m[best])) best = X; });
  return best;
}
function ctBombKnow(){
  var P = teamAgent("CT").know.bombPt;
  if(P && !P.gone) return {x: P.x, y: P.y, z: P.z, site: P.site, exact: true, state: P.state};
  if(!bomb || bomb.state !== "planted") return null;
  var site = ctBombSite(); if(!site) return null;
  var PP = sitePlantPro(site), sx = 0, sy = 0, sw = 0;
  PP.forEach(function(q){ var w = q.share || 1; sx += q.x*w; sy += q.y*w; sw += w; });
  var c = sw ? walk({x: sx/sw, y: sy/sw}) : {x: SITES[site].x, y: SITES[site].y};
  return {x: c.x, y: c.y, z: null, site: site, exact: false, state: "planted"};
}
// точка для расчётов (путь, укрытие, урон) — по знанию; знания нет — null
function ctBombPos(){ return ctBombKnow(); }
function computeApproaches(){
  var bp = ctBombPos(), site = bp.site;
  // (v348, владелец: kyousuke на сборе ретейка «не в сейв позиции — вышел бы кто-то из Apps, его бы убили») точка сбора укрыта не
  // только от бомбы, но и от входов T на этот сайт (данные карты: pos.entries, GEO.tEntry)
  var tIn = (site && GEO[site] ? [GEO[site].tEntry].concat(entryPts(site) || []) : []).filter(function(q){ return q && q.x != null; });
  // с запасом: укрыты и точки вокруг (14 ед. карты, проектное) — иначе край укрытия: шаг в сторону, и тебя видно
  var hidden1 = function(x, y){ return !hasLOS(x, y, bp.x, bp.y) && !tIn.some(function(q){ return hasLOS(x, y, q.x, q.y); }); };
  var hidden = function(x, y){ return hidden1(x, y) && [[14,0],[-14,0],[0,14],[0,-14]].every(function(o){ return insideSolidWall(x+o[0], y+o[1]) || hidden1(x+o[0], y+o[1]); }); };
  var sectors = {};
  NAVAREAS.forEach(function(z){
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var c = zoneCentroid(z);
    var d = DM.hypot(c.x-bp.x, c.y-bp.y);
    if(d < 230 || d > 480 || insideSolidWall(c.x, c.y)) return;
    if(!hidden(c.x, c.y)) return; // укрытие: отсюда не видно ни бомбу, ни входы T (v348)
    var ang = DM.atan2(c.y-bp.y, c.x-bp.x);
    var sec = Math.floor(((ang + Math.PI) / (Math.PI*2)) * 6) % 6; // 6 секторов по 60°
    var dCT = DM.hypot(c.x-CT_SPAWN.x, c.y-CT_SPAWN.y);
    // предпочитаем то, что ближе к стороне CT и ближе к бомбе
    var sc = dCT*0.6 + d*0.4;
    if(!sectors[sec] || sc < sectors[sec].sc) sectors[sec] = {x:c.x, y:c.y, sc:sc, sec:sec};
  });
  var list = Object.keys(sectors).map(function(k){ return sectors[k]; }).sort(function(a,b){ return a.sc - b.sc; });
  // до 3 точек, не соседние сектора (иначе это один и тот же заход)
  var out = [];
  list.forEach(function(p){
    if(out.length >= 3) return;
    if(out.some(function(q){ var dd = Math.abs(q.sec - p.sec); return Math.min(dd, 6-dd) < 2; })) return;
    out.push(p);
  });
  // сначала — названные точки сбора (Temple, CT Lane, Back Halls, 90…),
  // если от них бомбу не видно (укрытие) и они не дальше ~650
  if(POS[site]){
    var named = [];
    POS[site].ctRetake.forEach(function(n){
      var zp = zonePoint(n, bp); if(!zp) return;
      var d = DM.hypot(zp.x-bp.x, zp.y-bp.y); if(d < 180 || d > 650) return;
      var sp = pickSpots("rt:"+n, zp, 1, {team: "CT", rMax:110, minGap:40, hideFrom:[bp].concat(tIn)})[0] || zp;
      if(!hidden(sp.x, sp.y)) return;
      var ang = DM.atan2(sp.y-bp.y, sp.x-bp.x), sec = Math.floor(((ang + Math.PI) / (Math.PI*2)) * 6) % 6;
      if(named.some(function(q){ var dd = Math.abs(q.sec - sec); return Math.min(dd, 6-dd) < 2; })) return;
      named.push({x:sp.x, y:sp.y, sec:sec, name:n});
    });
    if(named.length){
      out.forEach(function(p){ if(named.length < 3 && !named.some(function(q){ var dd = Math.abs(q.sec - p.sec); return Math.min(dd, 6-dd) < 2; })) named.push(p); });
      out = named.slice(0, 3);
    }
  }
  if(!out.length){ var gs = GEO[site]; out.push({x:gs.ctEntry.x, y:gs.ctEntry.y, sec:0}); }
  return out;
}
// (v347, отметка владельца: kyousuke у бомбы, а пишется «сбор на ретейк») точка сбора ближе 300 ед. к бомбе — «у бомбы»: тот же
// сбор (ждёт своих), только подпись (тег gatherSite… тоже начинается с gather)
// (v359, владелец: «когда игрок один, у него тоже "ждёт своих на ретейк"») один живой CT своих не ждёт — «ретейк в одиночку: подход»
function gTag(b, R){ var i = R.assign[b.id]||0, a = R.approaches[i];
  if(bots.filter(function(o){ return o.team === "CT" && o.alive && !o._saveSpot; }).length <= 1) return "gatherSolo"+i;
  var bp = ctBombPos(); return (a && bp && DM.hypot(a.x-bp.x, a.y-bp.y) < 300 ? "gatherSite" : "gather")+i; }
var RT_WAIT = 3, RT_GAP = 400;   // RT_GAP, ед.: второй CT от первого при заходе у про — медиана 411 (322 ретейка Mirage)
var _rtw = 0;   // с — у про второй заходит через ~3 с после первого (комментарий «need» ниже; демки)
function updateRetake(cts){
  // (изоляция, 27.11) план — по знанию CT о бомбе (ctBombKnow): не знают ни сайта, ни гипотезы — плана нет; знание уточнилось (оценка →
  // увидели, другой сайт) — точки сбора заново, назначения и фаза сохраняются (аудит Codex № 7)
  var kn = ctBombKnow(); if(!kn) return;
  var kv = kn.site + (kn.exact ? "@" + kn.x + "," + kn.y : ""), R = bomb.retake;
  if(R && R.kv !== kv){ R.approaches = computeApproaches(); R.kv = kv;
    Object.keys(R.assign).forEach(function(id){ if(R.assign[id] >= R.approaches.length) delete R.assign[id]; });
    logEvent("CT: ретейк — уточнили, где бомба (" + kn.site + (kn.exact ? ", видели" : ", оценка") + "): точки сбора заново"); }
  if(!R){
    R = bomb.retake = {approaches: computeApproaches(), assign:{}, phase:"gather", goTick:-1, kv: kv};
    logEvent("CT: ретейк "+kn.site+" — "+R.approaches.length+" точк"+(R.approaches.length===1?"а":"и")+" сбора"+
      (R.approaches.some(function(a){ return a.name; }) ? " ("+R.approaches.map(function(a){ return a.name || "укрытие"; }).join(", ")+")" : ""));
  }
  // роли: дефузер — с китом и ближе всех; фланг — самый дальний от основной точки,
  // если людей 3+ и точек сбора больше одной; остальные — прикрытие
  var alive = cts.filter(function(b){ return !b._saveSpot; });
  if(!alive.length) return;
  var main = R.approaches[0];
  alive.forEach(function(b){
    if(R.assign[b.id] !== undefined) return;
    var bi = 0, bd = Infinity;
    // (v518c, пак 09.11 п.8; владелец Р-31: «могли пройти в Маркет … зачем перебивать, когда уже почти дошли» — точка сбора была ближайшей по прямой,
    // путь к ней — через Geyser, мид и Short) ближайшая по пути от того места, где бот сейчас (путь на пару «бот — точка» — один раз, при назначении)
    R.approaches.forEach(function(a, i){ var d = pathLenTo(b, a.x, a.y); if(d < bd){ bd = d; bi = i; } });
    R.assign[b.id] = bi;
  });
  if(alive.length >= 3 && R.approaches.length > 1 && !R.flankSet){
    R.flankSet = true;
    var onMain = alive.filter(function(b){ return R.assign[b.id] === 0; });
    if(onMain.length === alive.length){
      var far = onMain.slice().sort(function(a,b){ return DM.hypot(b.baseX-main.x,b.baseY-main.y) - DM.hypot(a.baseX-main.x,a.baseY-main.y); })[0];
      R.assign[far.id] = 1;
    }
  }
  // (v464, владелец: «почему дефузит не ближайший?») дефузер — тот, кто раньше всех снимет бомбу: время дойти по карте
  // (по зонам, а не по прямой — сквозь стены «близко» не считается) + сам дефуз 5 с с китом / 10 без. Раньше выбирался
  // один раз в начале ретейка и оставался, пока жив: в m17 р27 (облако) sh1ro стоял в 100 ед. от бомбы с китом, а дефузер
  // magixx ушёл на CT-спавн — бомба взорвалась. Теперь пересмотр каждый тик, но смена — только если другой успеет
  // заметно раньше (на 2 с — проектное число, чтобы двое не перекидывали роль туда-сюда) и дефузер ещё не сел дефузить.
  var defT = function(b){ return defuseEta(b); };   // (Г1) путь по навмешу; дефузит — остаток
  var def = null, tBest = Infinity;
  alive.forEach(function(b){ var t = defT(b); if(t < tBest){ tBest = t; def = b; } });
  var prevDef = R.defId && alive.filter(function(b){ return b.id === R.defId; })[0];
  if(prevDef && def !== prevDef && (prevDef.defusing || defT(prevDef) - tBest < 2)) def = prevDef;
  if(def && prevDef && def !== prevDef && R.phase === "go") voiceLog("CT", "rtdef", def.id, "я ближе — дефужу я");
  if(def) R.defId = def.id;
  alive.forEach(function(b){ retakeSetRetakeRole(b, (b === def) ? "defuser" : (R.assign[b.id] !== 0 ? "flank" : "cover")); });
  if((R.phase === "gather" || R.phase === "util") && def && ninjaOk()){
    var tLeftN = bombTimeLeftTicks()/TICK_HZ;
    if(tLeftN > defuseEta(def) + 1){
      R.phase = "go"; R.goTick = tick; R.ninja = tick; R.entryId = "-";
      voiceLog("CT", "ninja", def.id, "их нет у бомбы — тихо дефузю, прикройте");
      logEvent("CT: ниндзя-дефуз — все T известны далеко от бомбы");
    }
  }
  // (v257, К3) живых T нет (по табло знает любой) — собираться не от кого: все сразу к бомбе, дефузер дефузит
  if(aliveCount("T") === 0 && R.phase !== "go"){
    R.phase = "go"; R.goTick = tick; R.entryId = "-"; R.allDead = true;
    if(def) voiceLog("CT", "alldead", def.id, "их больше нет — бегу дефузить, остальные к бомбе");
    logEvent("CT: ретейк — живых T нет, сразу на бомбу");
  }
  if(R.phase === "gather"){
    // (док 6, п.9: р5 CT убили троих на сайте, стояли в 36–220 от бомбы — и ушли на точки сбора за 200–390, потом обратно; у про от смерти
    // последнего T у бомбы до конца дефуза — 6,6 с, медиана) точка сбора — чтобы зайти вместе, а не по одному; кто уже ближе к бомбе, чем его
    // точка сбора, — уже зашёл: он «на месте»
    var atAp = function(b, a){ return a && (DM.hypot(a.x-b.baseX, a.y-b.baseY) < 70 || DM.hypot(b.baseX-kn.x, b.baseY-kn.y) < DM.hypot(a.x-kn.x, a.y-kn.y)); };
    var ready = alive.filter(function(b){ return atAp(b, R.approaches[R.assign[b.id]]); }).length;
    // (v583a, владелец 17.11: «сделай нормальный ретейк — посмотри, как ретейкают про»; 322 ретейка Mirage, CT ≥ 2: когда первый у бомбы, второй
    // от него — медиана 411 ед., заходят с одной стороны (разница 21°, зажим 15 %), а стоял ли первый перед заходом ≥ 2 с — 7 %: про не ждут
    // на точке, а сходятся на ходу) путь каждого CT до своей точки — раз в 8 тиков (R.apDist, читает и ход — 535: кто впереди, идёт шагом);
    // «рядом» — на точке или не дальше RT_GAP по пути: заход, когда рядом все, кто успевает (было: все стоят на точках)
    if(!R.apDist || tick % 8 === 0){ R.apDist = {}; alive.forEach(function(b){ var ap = R.approaches[R.assign[b.id]]; if(ap) R.apDist[b.id] = atAp(b, ap) ? 0 : pathLenTo(b, ap.x, ap.y); }); }
    var near = alive.filter(function(b){ var d = R.apDist[b.id]; return d != null && d <= RT_GAP/PX_UNITS; }).length;
    var need = Math.min(alive.length, alive.length >= 3 ? 3 : alive.length);
    // у про второй заходит через ~3с после первого, у ботов было 5с: ждём
    // каждого, кто успевает дойти до своей точки сбора и ещё зайти на дефуз
    var sL = bombTimeLeftTicks()/TICK_HZ, aD = R.approaches[R.assign[def.id]] || R.approaches[0];
    var gN = defuseEta(def, aD) + 1.5;
    need = alive.filter(function(b){ var ap = R.approaches[R.assign[b.id]] || aD; return pathLenTo(b, ap.x, ap.y)/SPEED <= sL - gN - 2; }).length;
    need = Math.max(1, need);
    if(!R.gStart) R.gStart = tick;
    var secsLeft = bombTimeLeftTicks()/TICK_HZ;
    // сколько нужно на заход: от точки сбора до бомбы + дефуз
    var a0 = R.approaches[R.assign[def.id]];
    var goNeed = defuseEta(def, a0) + 1.5;
    var late = secsLeft - goNeed < 3;
    // (v370, владелец: «kyousuke после фрага стоит на сборе и ждёт, хотя может играть сам» — снимок р3: 12 с на Bench, T один с 46 HP)
    // инициатива: ждём своих, только пока нас на точках меньше, чем живых T (киллфид — это знает и живой игрок); на точке —
    // только здоровые (HP > LOW_HP). Временное правило владельца (16.10) — потом заменить на числа из демок (сколько про ждут на сборе)
    var readyFit = alive.filter(function(b){ return atAp(b, R.approaches[R.assign[b.id]]) && b.hp > LOW_HP; }).length;
    var initiative = readyFit >= 1 && readyFit >= aliveCount("T") && ready < need;
    // (v583a, владелец 17.11: «долго ретейкают»; поровну — 2 против 2: первый у бомбы 20,1 с у ботов против 11,6 у про) первый на точке ждёт
    // остальных не дольше RT_WAIT — у про второй заходит через ~3 с после первого (тот же замер, что выше в «need»); дольше — заходит
    if(ready >= 1 && !R.firstAt) R.firstAt = tick; else if(!ready) R.firstAt = 0;   // на точках никого (первый погиб / ушёл) — отсчёт заново
    var waited = R.firstAt && tick - R.firstAt >= RT_WAIT*TICK_HZ;
    if(waited && ready < need) logEvent("CT: ретейк — ждали остальных " + RT_WAIT + " с — заходим");
    if((ready >= 1 && near >= need) || late || initiative || waited){
      if(initiative) logEvent("CT: ретейк — нас на точках "+readyFit+", живых T "+aliveCount("T")+" — заходим, не дожидаясь остальных");
      // ретейк как команда: сначала утилита (флешка на сайт/на известного T,
      // смок на подход T), заход — под хлопок; если гранат нет или время
      // поджимает — сразу
      if(!R.entryId) retakeEntryPick(R, alive, def);
      var util = !late && alive.length >= 2 && retakeUtil(R, alive);
      if(util){ R.phase = "util"; R.utilTick = tick;
        logEvent("CT: ретейк — все на точках ("+ready+"/"+alive.length+"), "+util+" — заход под флешку"); }
      else { R.phase = "go"; R.goTick = tick;
        logEvent("CT: ретейк — заходим! ("+ready+"/"+alive.length+" на точках"+(late ? ", время поджимает" : "")+")"); }
    }
    R.ready = ready; R.need = need;
  }
  if(R.phase === "util"){
    var popped = nadeFlags["pop:ретейк"] !== undefined && tick - nadeFlags["pop:ретейк"] >= 6;
    var lateU = bombTimeLeftTicks()/TICK_HZ - ((def ? defuseEta(def) : 400/SPEED*1.3 + 10) + 1.5) < 3;
    if(popped || tick - R.utilTick > 2.2*TICK_HZ || lateU){
      R.phase = "go"; R.goTick = tick;
      logEvent("CT: ретейк — заходим"+(popped ? " под флешку!" : "!"));
    }
  }
  // дефуз под смоком: дефузер подходит к бомбе — смок на неё (его или тиммейта),
  // T с пост-плант позиций не видят того, кто дефузит
  if(R.phase === "go" && !nadeFlags.defSmoke && def && aliveCount("T") > 0){
    var bpS = ctBombPos(), dDef = DM.hypot(def.x-bpS.x, def.y-bpS.y);
    if(dDef < 420 && !smokeCovered(bpS.x, bpS.y)){
      var smk = [def].concat(alive.filter(function(b){ return b !== def; })).filter(function(b){ return b.nades && b.nades.smoke > 0 && !b.nadeTask && DM.hypot(b.x-bpS.x, b.y-bpS.y) < NADE_THROW_RANGE; })[0];
      if(smk && assignNade(smk, "smoke", bpS, "смок на бомбу — дефуз под ним", {now:true}).ok){ nadeFlags.defSmoke = tick;
        voiceLog("CT", "defsmk", smk.id, smk === def ? "кидаю смок на бомбу, дефужу под ним" : "смок на бомбу — "+def.id+", дефузь под ним"); }
    }
  }
  // первый входящий: не дефузер, из основной точки захода, ближе всех к бомбе
  if(R.phase === "go" && !R.entryId) retakeEntryPick(R, alive, def);
}
// первый входящий: не дефузер, из основной точки захода, ближе всех к бомбе. (00_PLAN, ответы владельца 3 и 7А, 05.11) выбирается до
// флешки: флешку кидает не он — «под флешку выходит не тот, кто кидает» (раньше оба — ближайший к бомбе, обычно один и тот же бот)
function retakeEntryPick(R, alive, def){
  var bp = ctBombPos();   // (изоляция, 27.11) где бомба — по знанию CT
  var ents = alive.filter(function(b){ return b !== def; });
  ents.sort(function(a, c){ return ((R.assign[a.id] === 0 ? 0 : 300) + DM.hypot(a.x-bp.x, a.y-bp.y)) - ((R.assign[c.id] === 0 ? 0 : 300) + DM.hypot(c.x-bp.x, c.y-bp.y)); });
  R.entryId = ents[0] ? ents[0].id : "-";
  if(ents[0]) voiceLog("CT", "rtentry", ents[0].id, "захожу первым, "+(def ? def.id+" дефузит за мной" : "прикрывайте"));
}
// утилита перед заходом на ретейк: кто кидает флешку — не первый входящий (под флешку выходит другой, ответ 7А), по возможности и не
// дефузер; куда — на известного T у бомбы (свежая инфа), иначе на саму бомбу
function retakeUtil(R, alive){
  if(nadeFlags.retakeFlash) return null;
  var bp = ctBombPos(), def = alive.filter(function(b){ return b.id === R.defId; })[0];
  var rank = function(b){ return b.id === R.entryId ? 2 : b === def ? 1 : 0; };
  var fls = alive.filter(function(b){ return b.nades && b.nades.flash > 0; })
    .sort(function(a, c){ return rank(a) - rank(c) || DM.hypot(a.x-bp.x, a.y-bp.y) - DM.hypot(c.x-bp.x, c.y-bp.y); });
  var fl = fls[0]; if(!fl) return null;
  var tgt = bp, L = kvLast("CT"), bestA = Infinity;
  for(var id in L){ var e = L[id]; if(tick - e.tick > 10*TICK_HZ) continue; if(DM.hypot(e.x-bp.x, e.y-bp.y) > 650) continue;
    var dd = DM.hypot(e.x-fl.x, e.y-fl.y); if(dd < bestA){ bestA = dd; tgt = {x:e.x, y:e.y}; } }
  if(!assignNade(fl, "flash", tgt, "ретейк", {bkey:"CT.retake.flash."+bp.site, now:true, range:900}).ok) return null;
  nadeFlags.retakeFlash = true;
  var gs = GEO[bp.site];
  var smr = alive.filter(function(b){ return b !== fl && b.nades && b.nades.smoke > 0; })[0];
  if(smr && !nadeFlags.retakeSmoke && retakeCutUseful()){ nadeFlags.retakeSmoke = true; assignNade(smr, "smoke", gs.tEntry, "отрезать вход T", {bkey:"CT.retake.smoke."+bp.site, now:true}); }
  if(!nadeFlags.retakeAwpSmoke){
    var BLr = kvLast("CT"), awpT = null;
    for(var eidR in BLr){ var loR = BLr[eidR]; if(loR.src !== "spotted" || tick - loR.tick > 10*TICK_HZ) continue; var eR = bots.filter(function(o){ return o.id === eidR; })[0];
      if(eR && eR.alive && eR.primary === "AWP" && DM.hypot(loR.x-bp.x, loR.y-bp.y) < 1000){ awpT = loR; break; } }
    if(awpT){
      var ap0 = R.approaches[0] || bp;
      var smA = alive.filter(function(b){ return b !== fl && b.nades && b.nades.smoke > 0 && !b.nadeTask; })[0];
      var spA = {x: awpT.x + (ap0.x-awpT.x)*0.4, y: awpT.y + (ap0.y-awpT.y)*0.4};
      if(smA && assignNade(smA, "smoke", spA, "ретейк: смок на AWP", {now:true}).ok){ nadeFlags.retakeAwpSmoke = true;
        voiceLog("CT", "rtawp", smA.id, "у них AWP "+calloutName(awpT.x, awpT.y)+" — смок на его линию"); }
    }
  }
  voiceLog("CT", "rtflash", fl.id, "даю флешку "+(tgt === bp ? "на бомбу" : "на "+calloutName(tgt.x, tgt.y))+" — заходим на хлопок");
  return fl.id+" кидает флешку"+(smr ? ", "+smr.id+" — смок" : "");
}
function retakePost(b, cts){
  var R = bomb.retake; if(!R){ return; }
  var bp = ctBombPos();
  var a = R.approaches[R.assign[b.id] || 0];
  if(R.phase === "gather" || R.phase === "util"){
    // стоим в укрытии и смотрим туда, откуда будет заход
    // один из собирающихся смотрит не на бомбу, а в спину — туда, откуда может
    // прийти лёркер (проход между сайтами), пока T ещё хватает на люрк.
    // (v260, В3) Спину держит замыкающий — кто дальше всех от бомбы; передний держит
    // вход со стороны сайта. Пересмотр — только если «смотрящий» оказался впереди всех
    // (проектное правило: прямого источника нет, docs/DECISIONS.md v260)
    if(aliveCount("T") >= 2){
      var dBp = function(o){ return DM.hypot(o.x-bp.x, o.y-bp.y); };
      var bwc = cts.filter(function(o){ return o.id === R.backWatch && o.alive; })[0];
      // (v518c, пак 09.11 п.8; Р-31: «смотрю спину» ×3) смотрящий спину закреплён, пока жив (раньше роль передавалась, когда он оказывался ближе
      // всех к бомбе, и каждая передача заново шла в войс); колл — один раз за раунд на игрока
      if(!bwc){
        var bwb = null; cts.forEach(function(o){ if(o.alive && (!bwb || dBp(o) > dBp(bwb))) bwb = o; });
        var nbw = bwb ? bwb.id : "-";
        if(nbw !== R.backWatch){ R.backWatch = nbw; if(bwb) voiceLog("CT", "back"+bwb.id+"@"+roundNum, bwb.id, "смотрю спину"); } }
      if(R.backWatch === b.id){ setPost(b, a, GEO.rotator, true, gTag(b, R), 0); return; }
    }
    // (док 6) уже ближе к бомбе, чем своя точка сбора, — назад на сбор не идёт: ждёт своих там, где стоит
    // (v560, В102, м1794418230042 р11 93,7 с CT1: точка сбора менялась каждые 0,1–0,3 с — бот в 484 от бомбы, его точка в 480: «ближе / дальше»
    // переключалось на каждом шаге, а «где стою» ехало вместе с ним) решение «жду здесь» — одно на ретейк, в плане ретейка, с местом, где решил
    var WS = R.waitAt || (R.waitAt = {});
    if(!WS[b.id] && DM.hypot(b.baseX-bp.x, b.baseY-bp.y) < DM.hypot(a.x-bp.x, a.y-bp.y)) WS[b.id] = {x:b.baseX, y:b.baseY};
    if(WS[b.id]){ setPost(b, WS[b.id], bp, true, gTag(b, R), 0); return; }
    setPost(b, a, bp, true, gTag(b, R), 0);
    return;
  }
  if(b.retakeRole === "defuser"){
    // (v469, п.17 владельца 29.10: «чтобы искали дефузы — 10 секунд, но успевают добежать до кита и раздефузить») дефузер без кита: кит
    // своего убитого лежит рядом с дорогой — сначала за ним, если так снимет бомбу раньше (дефуз 5 с вместо 10) и успевает до взрыва
    if(!b.kit){ var KT = retakeKitFor(b, bp); if(KT){ setPost(b, {x:KT.x, y:KT.y}, bp, true, "retakeKit"); return; } }
    // дефузер не тапает бомбу сразу на заходе (под пост-плант позиции T):
    // сначала первый входящий чистит, дефузер — за ним. Сразу — если время
    // поджимает, он один или первый уже на сайте/погиб
    if(!R.allDead && !retakeDefGo(b, R, cts)){
      // (v370) заходить первым некому (один или первый погиб) — сам чистит сайт, как первый, а не стоит у бомбы
      var entB = R.entryId && R.entryId !== b.id && bots.filter(function(o){ return o.id === R.entryId && o.alive; })[0];
      if(!entB) return retakeClear(b, R, cts, a, bp);
      var dsp = pickSpots("retakeD"+bp.site+"_"+(R.assign[b.id]||0), bp, 1, {team: "CT", rMin:120, rMax:320, minGap:60, must:[bp], see:[a]})[0];
      setPost(b, dsp || a, bp, true, "retakeCover"); return;
    }
    setPost(b, bp, null, true, "defuse"); return;
  }
  // остальные заходят за первым с задержкой ~0.5с (не толпой в один проход)
  if(R.goTick >= 0 && !R.allDead){
    if(!R.delay){
      R.delay = {}; var dm = 0;
      R.approaches.forEach(function(ap){ dm = Math.max(dm, DM.hypot(ap.x-bp.x, ap.y-bp.y)); });
      R.approaches.forEach(function(ap, i){ R.delay[i] = Math.min(2.5*TICK_HZ, Math.max(0, (dm - DM.hypot(ap.x-bp.x, ap.y-bp.y))/SPEED*TICK_HZ)); });
    }
    var dl = R.delay[R.assign[b.id]||0] || 0;
    if(tick - R.goTick < dl){ setPost(b, a, bp, true, gTag(b, R), 0); return; }
  }
  if(R.entryId && R.entryId !== "-" && b.id !== R.entryId && tick - R.goTick < 0.5*TICK_HZ){
    setPost(b, a, bp, true, gTag(b, R), 0); return;
  }
  retakeClear(b, R, cts, a, bp);
}
function retakeKitFor(b, bp){
  var left = bombTimeLeftTicks()/TICK_HZ, tNo = pathLenTo(b, bp.x, bp.y)/SPEED + 10, best = null, bt = tNo;
  groundItems.forEach(function(G){ if(G.kind !== "kit") return;
    var t = (pathLenTo(b, G.x, G.y) + DM.hypot(G.x-bp.x, G.y-bp.y)*1.3)/SPEED + 5;   // 1,3 — путь длиннее прямой, как в ретейке выше
    if(t < bt && t + 1.5 < left){ bt = t; best = G; } });
  return best;
}
function retakeClear(b, R, cts, a, bp){
  // прикрытие/фланг — места с видом на бомбу, со своей стороны захода
  var others = cts.filter(function(c){ return c.retakeRole !== "defuser" && !c.defusing && R.assign[c.id] === R.assign[b.id]; });
  var spots = pickSpots("retake"+bp.site+"_"+(R.assign[b.id]||0), bp, others.length, {team: "CT", rMin:80, rMax:300, minGap:90, must:[bp], see:[a]});
  var oi = Math.max(0, others.indexOf(b));
  setPost(b, spots[oi] || bp, bp, true, (b.id === R.entryId) ? "retakeEntry" : "retake");
}
function retakeDefGo(b, R, cts){
  var bp = ctBombPos();   // (изоляция, 27.11) где бомба — по знанию CT
  var secsLeft = bombTimeLeftTicks()/TICK_HZ;
  var late2 = secsLeft - (defuseEta(b) + 1) < 2.5;
  if(late2) return true;
  // (v370, снимок р3: kyousuke один против одного T на сайте сразу сел дефузить и умер) один на ретейке или один T — дефузит
  // сразу, только если сайт уже проверен: сам у бомбы (≤ 320 — точки зачистки) ≥ 1,5 с и никого не видит, или где последний T — знаем (≤ 5 с) и он далеко
  // от бомбы (> 600). Иначе сначала чистит сайт (retakeClear). Числа 1,5 с и 600 — проектные
  var solo = cts.filter(function(o){ return !o._saveSpot; }).length <= 1, oneT = aliveCount("T") <= 1;
  if(solo || oneT){
    if(DM.hypot(b.x-bp.x, b.y-bp.y) < 320 && !b._sawEnemy && tick - (b._lastSawT||-1e9) > 1.5*TICK_HZ){ if((b._nearBombT = b._nearBombT || tick) && tick - b._nearBombT > 1.5*TICK_HZ) return true; }
    else b._nearBombT = 0;
    var BLd = kvLast("CT"), farT = Object.keys(BLd).some(function(e){ var q = BLd[e]; return q && tick - q.tick <= 5*TICK_HZ && bots.some(function(o){ return o.id === e && o.alive; }) && DM.hypot(q.x-bp.x, q.y-bp.y) > 600; });
    if(oneT && farT) return true;
    if(solo) return false;
  }
  var ent = R.entryId && bots.filter(function(o){ return o.id === R.entryId; })[0];
  if(!ent || !ent.alive || ent.hp <= LOW_HP) return true;
  if(DM.hypot(ent.x-bp.x, ent.y-bp.y) < 280) return true;
  return tick - R.goTick > 2.5*TICK_HZ;
}
// (17.11, перестройка) перенесено из 630 (файл показа) — решения сейва команды
// (v247) сейв — решение команды: личные размены и пики отменяются, в дуэли никто не выходит
function saveCancelTrades(team){
  bots.forEach(function(b){ if(b.team !== team || !b.alive) return;
    tradeEnd(b, true); taskSetFillLock(b, null); moveWaitPop(b, 0, undefined, "save");
    if(b.post && b.post.tag === "tradeR") clearPost(b); });
}
function teamSaving(team){ var t = team === "CT" ? teamTac.CT : teamTac.T; return !!(t && t.saving); }
function cl0save(){ return teamTac.CT && teamTac.CT.saving; }

// Запись состояния канала. Вызовы выполняются в исходной точке тика.
function retakeSetSaveSpot(bot, value){ return bot._saveSpot = value; }
function retakeSetRetakeRole(bot, value){ return bot.retakeRole = value; }
