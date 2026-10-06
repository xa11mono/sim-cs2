var PRO_LINEUPS_RAW = @@DATA:lineups_pro.json@@;
// План IGL у CT (колл, сколько нужно в районах, сейв, ретейк) — здесь; куда
// встать — выбор действия (12_team.js). Сколько CT в каждом районе по расстановке:
var CT_NEED = {std212:{A:2,M:1,B:2}, std111:{A:1,M:1,B:1}, stackA:{A:3,M:1,B:1}, stackB:{A:1,M:1,B:3}, midAggro:{A:2,M:2,B:1},
  retakeA:{A:1,M:1,B:2}, retakeB:{A:2,M:1,B:1}};
// =====================================================================
// (v150) ПРО-ЛАЙНАПЫ ИЗ ДЕМОК: 12 матчей, повторяющиеся броски (одна точка
// броска → одна точка падения, ≥3 раз, ≥2 матча). У каждого — доля раундов,
// в которых про его кидают (prob), и среднее время броска (at, с от начала).
// Каждый раунд лайнап "разыгрывается" с этой вероятностью — так набор гранат
// меняется от раунда к раунду, как у живых команд.
// =====================================================================
if(BAL.nadeMore) PRO_LINEUPS_RAW = PRO_LINEUPS_RAW.concat(@@DATA:lineups_pro_rare.json@@);
var PRO_LINEUPS = null;
function proLineups(){
  if(PRO_LINEUPS) return PRO_LINEUPS;
  if(typeof PRO_LINEUPS_RAW === "undefined") return (PRO_LINEUPS = []);
  PRO_LINEUPS = PRO_LINEUPS_RAW.map(function(L){
    var f = snapToWalkable(L.from.x, L.from.y) || L.from;
    return {id:L.id, team:L.team, type:L.type, trigger:L.trigger, site:L.site, name:L.name, from:{x:f.x, y:f.y}, to:L.to, prob:L.prob, at:L.at, pro:true};
  });
  return PRO_LINEUPS;
}
// встроенная "общая" граната не летит, если про-лайнапы того же типа уже
// покрывают эту ситуацию (сторона, триггер, сайт)
var PRO_COVER = null;
function proCovers(key){
  if(!PRO_COVER){ PRO_COVER = {}; proLineups().forEach(function(L){ PRO_COVER[L.team+"|"+L.trigger+"|"+L.site+"|"+L.type] = 1; if(L.site === "any"){ PRO_COVER[L.team+"|"+L.trigger+"|A|"+L.type] = 1; PRO_COVER[L.team+"|"+L.trigger+"|B|"+L.type] = 1; } }); }
  var p = key.split("."), trig = {insta:"insta", exec:"exec", pp:"postplant", call:"call", retake:"retake"}[p[1]];
  if(!trig) return false;
  var bl = (typeof builtinLineups === "function" ? builtinLineups() : []).filter(function(L){ return L.key === key; })[0];
  if(!bl) return false;
  var site = p[1] === "insta" ? "any" : p[p.length-1];
  return !!(PRO_COVER[p[0]+"|"+trig+"|"+site+"|"+bl.type] || PRO_COVER[p[0]+"|"+trig+"|any|"+bl.type]);
}
function ctBrain(){
  var ct = teamTac.CT;
  var cts = bots.filter(function(b){ return b.team==="CT" && b.alive; });
  // ---- колл по сайтам: раздел 11 (инфа) + раздел 13 (карта вероятностей) ----
  // ПОВОД для колла — только реальная инфа: вижу/слышу/граната/носитель бомбы/
  // погиб опорник и сайт пустой. А "сколько их там" и "держать ли ещё колл" —
  // по карте вероятностей: CT на сайте, которые смотрят и никого не видят, сами
  // её "чистят" — и колл снимается, когда там вероятно уже пусто (раньше колл
  // висел 20с после последней инфы, и ротаторы стояли на пустом сайте).
  var best = null, planted0 = bomb.state === "planted";
  ["A","B"].forEach(function(k){
    var est = intelEstimate("CT", SITES[k].x, SITES[k].y, 400, 5*64);
    var car = teamIntel.CT.carrier;
    var carrierHere = car && tick - car.tick < 5*64 && Math.hypot(car.x-SITES[k].x, car.y-SITES[k].y) < 400;
    // войс: бомбу видели на подходе к этому сайту (заметно ближе к нему, чем к другому)
    var ko2 = k === "A" ? "B" : "A";
    var carrierTo = !carrierHere && car && tick - car.tick < 5*64 &&
      Math.hypot(car.x-SITES[k].x, car.y-SITES[k].y) < 900 &&
      Math.hypot(car.x-SITES[k].x, car.y-SITES[k].y) + 250 < Math.hypot(car.x-SITES[ko2].x, car.y-SITES[ko2].y);
    // войс: "минус на A" — тиммейта убили у сайта за последние 8с
    var deathsHere = intelDeathsNear("CT", SITES[k].x, SITES[k].y, 450, 8*64);
    // слышали плант — T точно на этом сайте, и их там минимум двое
    var PH = teamIntel.CT.plantHeard, plantHere = PH && PH.site === k && tick - PH.tick < 5*TICK_HZ;
    var anchorRole = k==="A" ? "anchorA" : "anchorB";
    var anchorAlive = cts.some(function(b){ return b.tRole===anchorRole; });
    var holdingHere = cts.some(function(b){ return Math.hypot(b.x-SITES[k].x, b.y-SITES[k].y) < 420; });
    var undefended = !anchorAlive && !holdingHere && !planted0;
    // повод для колла — СВЕЖЕЕ наблюдение (видели/слышали за окно), а не
    // "враг где-то тут по памяти": с единым хранилищем est.n постоянный, и колл
    // повторялся каждые 4с по одной и той же старой инфе
    var evN = est.seen + est.heard;
    // (v151) раньше nadeHere использовалась ДО подсчёта (undefined → NaN): ev и
    // score сайта всегда были NaN, колл вечно висел на A, а B не мог его перебить
    var nadeHere = 0;
    // гранаты в первые ~18с — стандартный контроль карты (инсты, молотов на рампу),
    // про не читают их как выход; флешки — не довод (их кидают и в фейках)
    if(BAL.tacRead && tick - roundStartTick > 18*TICK_HZ){
      (teamIntel.CT.nadeSeen||[]).forEach(function(q){ if(tick - q.tick > 6*TICK_HZ || q.type === "flash") return;
        if(Math.hypot(q.x-SITES[k].x, q.y-SITES[k].y) < 600 || Math.hypot(q.x-GEO[k].tEntry.x, q.y-GEO[k].tEntry.y) < 300 || Math.hypot(q.x-GEO[k].ctEntry.x, q.y-GEO[k].ctEntry.y) < 300)
          nadeHere += q.type === "flash" ? 0.5 : 1; });
    }
    var ev = evN + (carrierHere ? 1 : 0) + (carrierTo ? 0.5 : 0) + (undefended ? 1 : 0) + deathsHere + (plantHere ? 2 : 0) + (nadeHere >= 2 ? 1.2 : nadeHere * 0.4);
    var mass = beliefCount("CT", BZ.siteNear[k]||[]);
    // повод — не только реальный контакт РЯДОМ с сайтом, но и когда карта
    // вероятностей (по контакту где-то ещё, например засветили у КТ-спавна на
    // пути к Б) уже уверенно "верит", что враг у этого сайта — иначе колл на
    // такой заход никогда не появляется, пока враг физически не дойдёт до
    // самого сайта, и его встречает только штатный опорник в одиночку
    if(ev <= 0 && mass < 1.7) return;
    // бомбу видели у сайта — это выход, а не один игрок: минимум двое
    var cnt = Math.max(est.seen, est.heard ? 1 : 0, (carrierHere||carrierTo) ? 2 : 0, plantHere ? 2 : 0, undefended ? 1 : 0, Math.min(3, deathsHere), Math.min(5, mass), nadeHere >= 2 ? 2.6 : 0);
    var score = ev + mass;
    if(!best || score > best.score) best = {site:k, score:score, count:cnt, est:est, carrier:carrierHere||carrierTo, undefended:undefended, deaths:deathsHere, plant:plantHere, nades:nadeHere};
  });
  if(best){
    var isNew = !ct.call || ct.call.site !== best.site;
    if(isNew || best.count > ct.call.count + 0.4 || tick - ct.call.tick > 64){
      ct.call = {site:best.site, count:best.count, tick:tick, evTick:tick, since:(!isNew && ct.call.since) || tick, sinceSite:best.site, undefended:best.undefended, bombSeen: best.carrier || best.plant, seen: best.est ? best.est.seen : 0, nades: best.nades || 0};
    } else { ct.call.evTick = tick; ct.call.undefended = best.undefended; if(best.carrier || best.plant) ct.call.bombSeen = true; }
  } else if(ct.call){
    // новой инфы нет — оценка "сколько там" только тает вместе с картой
    ct.call.count = Math.min(ct.call.count, beliefCount("CT", BZ.siteNear[ct.call.site]||[]) + 0.3);
  }
  if(ct.call){
    var quiet = tick - (ct.call.evTick||ct.call.tick);
    var massNow = beliefCount("CT", BZ.siteNear[ct.call.site]||[]);
    var lkpHere = picNear("CT", SITES[ct.call.site].x, SITES[ct.call.site].y, 500);
    if(lkpHere === 0 && ((quiet > 6*64 && massNow < 0.6) || quiet > 18*64)){
      logEvent("CT: по "+ct.call.site+" давно тихо"+(massNow < 0.6 ? " и там вероятно пусто" : "")+" — по местам");
      ct.call = null;
    }
  }
  // ---- план IGL: сколько CT нужно в каждом районе (A / мид / B) ----
  // Расстановка даёт базу; колл по сайту — сколько там нужно сейчас (≈ сколько
  // там врагов по картине команды, на первый звук не дёргаемся). Кто именно
  // пойдёт — решает выбор действия (12_team.js): кому ближе и кто меньше нужен.
  var n = cts.length, need = {};
  var base = CT_NEED[(ct.setup && ct.setup.id) || "std212"] || CT_NEED.std212;
  ["A","M","B"].forEach(function(a){ need[a] = base[a]; });
  var sumN = function(){ return need.A + need.M + need.B; };
  var cut = function(order, floor){ order.forEach(function(a){ while(sumN() > n && need[a] > (floor[a]||0)) need[a]--; }); };
  var weaker = beliefMass("CT", BZ.siteNear.A||[]) < beliefMass("CT", BZ.siteNear.B||[]) ? "A" : "B";
  cut(["M", weaker, weaker === "A" ? "B" : "A"], {M:0, A:1, B:1}); cut(["M","A","B"], {});
  ct.spread = false;
  if(ct.call && !planted0){
    var ks = ct.call.site, ko = ks === "A" ? "B" : "A", sc0 = SITES[ks];
    if(!ct.call.since || ct.call.sinceSite !== ks){ ct.call.since = tick; ct.call.sinceSite = ks; }
    var want = Math.max(1, Math.ceil(ct.call.count - 0.25));
    var confirmed = tick - ct.call.since > 1.5*TICK_HZ;
    // терпение: на слабую инфу не снимаемся, пока она не подтвердилась
    if(BAL.ctPatience && !ct.call.bombSeen && !ct.call.undefended && ct.call.count < 2.5 && !confirmed) want = need[ks];
    // ротация по счёту: все известные T здесь — можно больше; кого-то видели в другом месте — там остаются
    var keepOther = false, keepMid = false;
    if(BAL.countRot){
      var tAliveN = aliveCount("T"), here = Math.min(tAliveN, Math.max(1, Math.round(ct.call.count))), elseO = 0, elseM = 0, elseAny = 0, PK = picKnown("CT");
      for(var eidR in PK){ var eR = PK[eidR]; if(tick - eR.tick > 8*TICK_HZ || Math.hypot(eR.x-sc0.x, eR.y-sc0.y) < 900) continue;
        elseAny++; if(Math.hypot(eR.x-SITES[ko].x, eR.y-SITES[ko].y) < 750) elseO++; else if(Math.hypot(eR.x-GEO.ctMid.x, eR.y-GEO.ctMid.y) < 650) elseM++; }
      var unacc = Math.max(0, tAliveN - here - elseAny); ct.call.unacc = unacc;
      keepOther = elseO > 0 || unacc >= 2; keepMid = elseM > 0;
      if(here >= 2 && tAliveN >= 2 && unacc === 0 && elseAny === 0 && confirmed) want = Math.max(want, here + 1);
    }
    // T разошлись по трём районам — один контакт не выход: максимум +1 на колл
    if(BAL.setup111 && !ct.call.bombSeen && !ct.call.undefended && aliveCount("T") >= 3){
      var zA = 0, zB = 0, zM = 0, PK2 = picKnown("CT");
      for(var eidS in PK2){ var eS = PK2[eidS]; if(tick - eS.tick > 10*TICK_HZ) continue;
        if(Math.hypot(eS.x-SITES.A.x, eS.y-SITES.A.y) < 800) zA++; else if(Math.hypot(eS.x-SITES.B.x, eS.y-SITES.B.y) < 800) zB++; else if(Math.hypot(eS.x-GEO.ctMid.x, eS.y-GEO.ctMid.y) < 700 || Math.hypot(eS.x-GEO.tMid.x, eS.y-GEO.tMid.y) < 500) zM++; }
      var bA = beliefMass("CT", BZ.siteNear.A||[]), bB = beliefMass("CT", BZ.siteNear.B||[]), bM = beliefMass("CT", BZ.midZ);
      ct.spread = ((zA || bA > 0.6) ? 1 : 0) + ((zB || bB > 0.6) ? 1 : 0) + ((zM || bM > 0.6) ? 1 : 0) >= 3 && ct.call.count < 2.5;
      if(ct.spread){ want = Math.min(want, need[ks] + 1); keepOther = true; keepMid = true; }
    }
    need[ks] = Math.max(need[ks], Math.min(n, want));
    cut(keepMid ? [ko, "M"] : ["M", ko], {M: keepMid ? 1 : 0, A: ks === "A" ? need.A : (keepOther ? 1 : 0), B: ks === "B" ? need.B : (keepOther ? 1 : 0)});
    cut(["M", ko], {A: ks === "A" ? need.A : 0, B: ks === "B" ? need.B : 0});
  }
  ct.need = need;
  ctAssign(cts, need);
  var planted = bomb.state === "planted";
  // сколько секунд нужно лучшему CT, чтобы обезвредить бомбу: кто уже дефузит —
  // остаток его дефуза; остальные — реальный путь до бомбы / скорость + дефуз
  // (с китом или без). Одна оценка и для решения «сейв», и для «сейв → ретейк».
  function ctDefuseNeedSecs(){
    var need = Infinity;
    cts.forEach(function(b){
      var t = b.defusing ? (b.defuseUntil - tick)/TICK_HZ : pathLenTo(b, bomb.x, bomb.y)/SPEED + (b.kit ? 5 : 10) + 1.0;
      if(t < need) need = t;
    });
    return need;
  }
  // сейв: ретейк безнадёжен (сильно меньше людей или не успеть дойти+дефузнуть) —
  // CT не идут умирать, а сохраняют оружие на следующий раунд
  if(planted && !ct.saving && !ct._noResave){
    var tsAlive = bots.filter(function(b){ return b.team==="T" && b.alive; }).length;
    var secs = bombTimeLeftTicks()/TICK_HZ;
    var needSecs = ctDefuseNeedSecs();
    // сейвить имеет смысл только то, что стоит денег: с пистолетами и без
    // брони терять нечего — лучше попробовать ретейк
    var equip = cts.reduce(function(a,b){ return a + (b.primary ? WEAPONS[b.primary].price : 0) + (b.armor ? 650 : 0); }, 0) / Math.max(1, cts.length);
    var hopeless = (cts.length === 1 && tsAlive >= BAL.saveGap) || (cts.length <= tsAlive - BAL.saveGap) || needSecs > secs;
    // (v158) у про после взрыва живы 2,1 CT, у ботов было 1,2: сейвят раньше
    if(BAL.groupRetake) hopeless = hopeless || (cts.length >= 2 && cts.length <= tsAlive - 2) || (cts.length === 1 && tsAlive >= 3) ||
      (cts.length === 1 && tsAlive === 2 && !(cts[0].kit && needSecs + 8 < secs)); // 2v4 — ещё пробуем, 1v3/1v4/2v5 — сейв
    if(cts.length && hopeless && (equip >= 1800 || needSecs > secs)){
      ct.saving = true;
      logEvent("CT: сейв — ретейк "+cts.length+"v"+tsAlive+(needSecs > secs ? ", не успеть" : "")+", сохраняем оружие");
    }
  }
  // (8) сейв → ретейк: на сейве сняли T и расклад выровнялся (1v1, 2v2, 1v2 при
  // запасе времени) — сейв отменяется, идём ретейкать/защищать
  if(BAL.saveRetake && ct.saving && cts.length && tick % 16 === 0){
    var tsS = aliveCount("T");
    if(planted){
      var secsS = bombTimeLeftTicks()/TICK_HZ, needS = ctDefuseNeedSecs();
      var evenS = cts.length >= tsS || (cts.length === tsS - 1 && needS + 7 < secsS);
      // врагов не осталось — сейвить не от кого: идём дефузить, если успеваем
      if(evenS && needS + (tsS ? 2 : 0) < secsS){
        ct.saving = false; ct._noResave = true; cts.forEach(function(b){ b._saveSpot = null; });
        logEvent("CT: сейв → ретейк — теперь "+cts.length+"v"+tsS+", успеваем ("+Math.round(secsS)+"с)");
      }
    } else if(ct.preSave && cts.length >= tsS){
      ct.saving = false; ct.preSave = false; ct._noResave = true; cts.forEach(function(b){ b._saveSpot = null; });
      logEvent("CT: сейв → ретейк — теперь "+cts.length+"v"+tsS+", играем раунд");
    }
  }
  // сейв CT до планта: 1v3+/2v5, T уже заходят на сайт, у нас есть что сохранять
  if(BAL.ctPreSave && !planted && !ct.saving && !ct._noResave && ct.call && ct.call.count >= 3 && cts.length){
    var tsA2 = aliveCount("T"), eq2 = cts.reduce(function(a,b){ return a + (b.primary ? WEAPONS[b.primary].price : 0); }, 0)/cts.length;
    var secL2 = ROUND_TIME_SEC - (simTime - roundStartTime);
    if(((cts.length === 1 && tsA2 >= 3) || (cts.length === 2 && tsA2 >= 5)) && eq2 >= 2700 && secL2 > 25){
      ct.saving = true; ct.preSave = true;
      logEvent("CT: сейв до планта — "+cts.length+"v"+tsA2+", выход на "+ct.call.site+" — сохраняем оружие");
    }
  }
  // AWP не несут в почти проигранный ретейк (2 на 3+): снайпер сейвит
  cts.forEach(function(b){ b._awpSave = !!(BAL.awpSave && planted && b.primary === "AWP" && cts.length === 2 && aliveCount("T") >= 3); });
  if(planted && !ct.saving) updateRetake(cts);
  teamActTick("CT", cts);
}

// план IGL: кто в каком районе. Сначала по роли (опорники — свои сайты, мидер —
// мид), лишние снимаются, нехватку закрывает ближайший из тех, кто нужен меньше
// всех (сказано всем — это и есть «ротатор, иди на B»)
function ctAssign(cts, need){
  var ct = teamTac.CT, A = ct.assign || (ct.assign = {}), RA = {anchorA:"A", anchorB:"B", mid:"M"};
  var anchorOf = function(a){ return a === "M" ? GEO.ctMid : GEO[a].anchor; };
  Object.keys(A).forEach(function(id){ if(!cts.some(function(o){ return o.id === id; })) delete A[id]; });
  cts.forEach(function(b){ if(!A[b.id] && RA[b.tRole] && need[RA[b.tRole]] > 0) A[b.id] = RA[b.tRole]; });
  var inA = function(a){ return cts.filter(function(o){ return A[o.id] === a; }); };
  // лишние в районе — снять дальних от него
  ["A","M","B"].forEach(function(a){ var L = inA(a), ap = anchorOf(a);
    L.sort(function(p, q){ return Math.hypot(q.x-ap.x, q.y-ap.y) - Math.hypot(p.x-ap.x, p.y-ap.y); });
    while(L.length > (need[a]||0)){ delete A[L.shift().id]; } });
  // нехватка — ближайший свободный
  ["A","B","M"].sort(function(p, q){ return (need[q]||0) - (need[p]||0); }).forEach(function(a){ var ap = anchorOf(a);
    while(inA(a).length < (need[a]||0)){
      var free = cts.filter(function(o){ return !A[o.id]; }).sort(function(p, q){ return Math.hypot(p.x-ap.x, p.y-ap.y) - Math.hypot(q.x-ap.x, q.y-ap.y); })[0];
      if(!free) break; A[free.id] = a; } });
  // свободные (сверх плана) — к сайту, где по картине команды вероятнее T
  var lean = beliefMass("CT", BZ.siteNear.A||[]) >= beliefMass("CT", BZ.siteNear.B||[]) ? "A" : "B";
  cts.forEach(function(b){ if(!A[b.id]) A[b.id] = lean; });
}
function teamBrains(){
  if(roundState !== "live" || !teamTac.T) return;
  bombTick();
  if(roundState !== "live") return; // дефуз мог только что закончить раунд
  routeTick();
  tBrain(); ctBrain(); lineupTick(); weaponPickupTick(); picCheckTick();
  smokeFadeTick(); awpSmokeTick(); bombPassTick();
}


