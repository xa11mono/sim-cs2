function pickSaveSpot(b){
  // только то, что команда знает (радар/слышали за 15с), а не настоящие позиции T
  var ts = [], BLs = beliefLast.CT || {};
  for(var eidS in BLs){ var loS = BLs[eidS]; if(tick - loS.tick > 15*TICK_HZ) continue; if(bots.some(function(o){ return o.id === eidS && o.alive; })) ts.push({x:loS.x, y:loS.y}); }
  var best = null, bs = -Infinity;
  NAVAREAS.forEach(function(z, i){
    if(i % 3) return; // прореживаем кандидатов — ~650 хватает с запасом
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var c = zoneCentroid(z);
    if(insideSolidWall(c.x, c.y)) return;
    // (v381, М134: по замеру v381 после правки ухода T от бомбы от взрыва гибли только CT на сейве — один в 923 px, где проверки урона
    // не было, второй не успел дойти) сейв — там, куда взрыв не достаёт (на любом расстоянии) и куда успеть дойти до взрыва
    if(bomb.state === "planted" && bombDamageAt(c.x, c.y) > 0) return;
    if(bomb.state === "planted" && Math.hypot(c.x-b.baseX, c.y-b.baseY)*1.3/SPEED > bombTimeLeftTicks()/TICK_HZ - 1) return;   // 1,3 — путь длиннее прямой: проектное число
    var dT = Infinity, seen = false;
    ts.forEach(function(t){ dT = Math.min(dT, Math.hypot(c.x-t.x, c.y-t.y)); if(hasLOS(c.x,c.y,t.x,t.y)) seen = true; });
    if(seen || dT < 500) return;
    if(Math.hypot(c.x-CT_SPAWN.x, c.y-CT_SPAWN.y) < 220) return; // не на самом спавне
    var dSelf = Math.hypot(c.x-b.baseX, c.y-b.baseY);
    var zcC = zoneIdAt(c.x, c.y), openC = zcC ? (ZONE_DANGER[zcC] || []).length : 0;   // (v375) не на виду — как у T
    var sc = Math.min(dT, 1200)*0.6 - dSelf - openC*40; // подальше от T, но не бежать через всю карту, укрыто
    if(sc > bs){ bs = sc; best = c; }
  });
  return best ? {x:best.x, y:best.y} : {x:CT_SPAWN.x, y:CT_SPAWN.y};
}
// укрытие для сейва T: подальше от известных CT и от сайтов, не на виду у живых CT
// (v381, М137) доля раундов, где T в меньшинстве до планта выжили без планта (сейв), у про: [T][CT] → [> 55 с, 30–55 с, < 30 с до конца
// раунда]; демки Ancient + Mirage, среднее двух карт (tools/measure: скрипт в DECISIONS v381), 30–316 раундов на клетку
var T_SAVE_PRO = {1: {2: [0.09, 0.06, 0.18], 3: [0.04, 0.09, 0.18], 4: [0.05, 0.10, 0.27], 5: [0.02, 0.09, 0.21]},
                  2: {3: [0.10, 0.11, 0.20], 4: [0.08, 0.14, 0.27], 5: [0.08, 0.19, 0.35]}};
function tSaveRoll(aT, aC, secLeft){
  var P = T_SAVE_PRO[aT] && T_SAVE_PRO[aT][Math.min(aC, 5)]; if(!P) return false;
  var k = secLeft > 55 ? 0 : (secLeft > 30 ? 1 : 2);
  return hashRand(roundNum*911 + matchNum*37 + aT*101 + aC*13 + k*7) < P[k];
}
// (v434) сейвить ли T сейчас — одно решение для начала сейва и для пересмотра (170): раунд безнадёжен по доле про для этого расклада
// (tSaveRoll), есть что сохранять (оружие ≥ 1500 в среднем и перейдёт в следующий раунд — saveWorth, 530), носитель не на сайте
function tSaveWant(ts, aT, aC, secLeft, site){
  if(!ts.length) return false;
  var gunVal = ts.reduce(function(a, b){ return a + (b.primary ? WEAPONS[b.primary].price : 0); }, 0) / aT;
  var carOn = bomb.state === "carried" && bomb.carrier && bomb.carrier.alive && Math.hypot(bomb.carrier.x-site.x, bomb.carrier.y-site.y) < 380;
  return gunVal >= 1500 && !carOn && saveWorth("T") && tSaveRoll(aT, aC, secLeft);
}
// сейв T: каждый живой — к своему месту сейва (один раз выбранному), бомбу не ставит
function tSaveHold(){
  bots.forEach(function(b){ if(b.team !== "T" || !b.alive) return;
    if(!b._saveSpot) b._saveSpot = pickSaveSpotT(b);
    if(!b.planting) setPost(b, b._saveSpot, null, true, "save"); });
}
function pickSaveSpotT(b){
  var cts = [], BLt = beliefLast.T || {};
  for(var eidT in BLt){ var loT = BLt[eidT]; if(tick - loT.tick > 15*TICK_HZ) continue; if(bots.some(function(o){ return o.id === eidT && o.alive; })) cts.push({x:loT.x, y:loT.y}); }
  var known = []; for(var id in beliefLast.T){ known.push(beliefLast.T[id]); }
  var best = null, bs = -Infinity;
  NAVAREAS.forEach(function(z, i){
    if(i % 3) return;
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var c = zoneCentroid(z);
    if(insideSolidWall(c.x, c.y)) return;
    var dSite = Math.min(Math.hypot(c.x-SITES.A.x, c.y-SITES.A.y), Math.hypot(c.x-SITES.B.x, c.y-SITES.B.y));
    if(dSite < 500) return;
    var dK = Infinity, seen = false;
    known.forEach(function(k){ dK = Math.min(dK, Math.hypot(c.x-k.x, c.y-k.y)); });
    cts.forEach(function(t){ if(hasLOS(c.x, c.y, t.x, t.y)) seen = true; });
    if(seen || dK < 550) return;
    var dSelf = Math.hypot(c.x-b.baseX, c.y-b.baseY);
    var dTS = Math.hypot(c.x-T_SPAWN.x, c.y-T_SPAWN.y);
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
function pathLenTo(b, x, y){
  var Q = PATHQ_Q, p = pathQ("l"+Math.round(b.baseX/Q)+","+Math.round(b.baseY/Q)+","+Math.round((b.z||0)/32)+">"+Math.round(x/Q)+","+Math.round(y/Q), function(){ return buildWaypointPath(b.baseX, b.baseY, b.z, x, y, 0); });
  var L = 0, px = b.baseX, py = b.baseY;
  p.forEach(function(q){ L += Math.hypot(q[0]-px, q[1]-py); px = q[0]; py = q[1]; });
  return L;
}
// где бомба по мнению CT: пока её никто не видел и не подошёл — по писку
// примерно (±140px в начале, к концу таймера писк частый — почти точно)
function ctBombPos(){
  if(!BAL.bombBeep || !bomb || bomb.state !== "planted") return {x:bomb.x, y:bomb.y};
  if(!bomb.ctSeen){
    var seen = bots.some(function(o){ return o.alive && o.team === "CT" && (Math.hypot(o.x-bomb.x, o.y-bomb.y) < 300 || (Math.hypot(o.x-bomb.x, o.y-bomb.y) < 1100 && hasVision(o.x, o.y, bomb.x, bomb.y))); });
    if(seen){ bomb.ctSeen = tick; voiceLog("CT", "bombseen", "CT", "вижу бомбу — "+calloutName(bomb.x, bomb.y)); }
  }
  if(bomb.ctSeen) return {x:bomb.x, y:bomb.y};
  if(!bomb.ctNoise){ var a = hashRand(bomb.plantTick*7 + 3)*Math.PI*2, r = 60 + hashRand(bomb.plantTick*11 + 5)*80; bomb.ctNoise = {dx:Math.cos(a)*r, dy:Math.sin(a)*r}; }
  var k = Math.max(0.15, bombTimeLeftTicks()/BOMB_TICKS);
  return walk({x: bomb.x + bomb.ctNoise.dx*k, y: bomb.y + bomb.ctNoise.dy*k});
}
function computeApproaches(){
  var bp = ctBombPos();
  // (v348, владелец: kyousuke на сборе ретейка «не в сейв позиции — вышел бы кто-то из Apps, его бы убили») точка сбора укрыта не
  // только от бомбы, но и от входов T на этот сайт (данные карты: pos.entries, GEO.tEntry)
  var tIn = (bomb && bomb.site && GEO[bomb.site] ? [GEO[bomb.site].tEntry].concat(entryPts(bomb.site) || []) : []).filter(function(q){ return q && q.x != null; });
  // с запасом: укрыты и точки вокруг (14 ед. карты, проектное) — иначе край укрытия: шаг в сторону, и тебя видно
  var hidden1 = function(x, y){ return !hasLOS(x, y, bp.x, bp.y) && !tIn.some(function(q){ return hasLOS(x, y, q.x, q.y); }); };
  var hidden = function(x, y){ return hidden1(x, y) && [[14,0],[-14,0],[0,14],[0,-14]].every(function(o){ return insideSolidWall(x+o[0], y+o[1]) || hidden1(x+o[0], y+o[1]); }); };
  var sectors = {};
  NAVAREAS.forEach(function(z){
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var c = zoneCentroid(z);
    var d = Math.hypot(c.x-bp.x, c.y-bp.y);
    if(d < 230 || d > 480 || insideSolidWall(c.x, c.y)) return;
    if(!hidden(c.x, c.y)) return; // укрытие: отсюда не видно ни бомбу, ни входы T (v348)
    var ang = Math.atan2(c.y-bp.y, c.x-bp.x);
    var sec = Math.floor(((ang + Math.PI) / (Math.PI*2)) * 6) % 6; // 6 секторов по 60°
    var dCT = Math.hypot(c.x-CT_SPAWN.x, c.y-CT_SPAWN.y);
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
  if(BAL.namedPos && POS[bomb.site]){
    var named = [];
    POS[bomb.site].ctRetake.forEach(function(n){
      var zp = zonePoint(n, bp); if(!zp) return;
      var d = Math.hypot(zp.x-bp.x, zp.y-bp.y); if(d < 180 || d > 650) return;
      var sp = pickSpots("rt:"+n, zp, 1, {rMax:110, minGap:40, hideFrom:[bp].concat(tIn)})[0] || zp;
      if(!hidden(sp.x, sp.y)) return;
      var ang = Math.atan2(sp.y-bp.y, sp.x-bp.x), sec = Math.floor(((ang + Math.PI) / (Math.PI*2)) * 6) % 6;
      if(named.some(function(q){ var dd = Math.abs(q.sec - sec); return Math.min(dd, 6-dd) < 2; })) return;
      named.push({x:sp.x, y:sp.y, sec:sec, name:n});
    });
    if(named.length){
      out.forEach(function(p){ if(named.length < 3 && !named.some(function(q){ var dd = Math.abs(q.sec - p.sec); return Math.min(dd, 6-dd) < 2; })) named.push(p); });
      out = named.slice(0, 3);
    }
  }
  if(!out.length){ var gs = GEO[bomb.site]; out.push({x:gs.ctEntry.x, y:gs.ctEntry.y, sec:0}); }
  return out;
}
// (v347, отметка владельца: kyousuke у бомбы, а пишется «сбор на ретейк») точка сбора ближе 300 ед. к бомбе — «у бомбы»: тот же
// сбор (ждёт своих), только подпись (тег gatherSite… тоже начинается с gather)
// (v359, владелец: «когда игрок один, у него тоже "ждёт своих на ретейк"») один живой CT своих не ждёт — «ретейк в одиночку: подход»
function gTag(b, R){ var i = R.assign[b.id]||0, a = R.approaches[i];
  if(bots.filter(function(o){ return o.team === "CT" && o.alive && !o._saveSpot; }).length <= 1) return "gatherSolo"+i;
  return (a && bomb && Math.hypot(a.x-bomb.x, a.y-bomb.y) < 300 ? "gatherSite" : "gather")+i; }
function updateRetake(cts){
  var R = bomb.retake;
  if(!R){
    R = bomb.retake = {approaches: computeApproaches(), assign:{}, phase:"gather", goTick:-1};
    logEvent("CT: ретейк "+bomb.site+" — "+R.approaches.length+" точк"+(R.approaches.length===1?"а":"и")+" сбора"+
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
    R.approaches.forEach(function(a, i){ var d = Math.hypot(a.x-b.baseX, a.y-b.baseY); if(d < bd){ bd = d; bi = i; } });
    R.assign[b.id] = bi;
  });
  if(alive.length >= 3 && R.approaches.length > 1 && !R.flankSet){
    R.flankSet = true;
    var onMain = alive.filter(function(b){ return R.assign[b.id] === 0; });
    if(onMain.length === alive.length){
      var far = onMain.slice().sort(function(a,b){ return Math.hypot(b.baseX-main.x,b.baseY-main.y) - Math.hypot(a.baseX-main.x,a.baseY-main.y); })[0];
      R.assign[far.id] = 1;
    }
  }
  var def = null, dBest = Infinity;
  // дефузер выбран — остаётся им, пока жив (раньше выбирался каждый тик заново:
  // двое по очереди получали "дефузить"/"прикрывать" и дёргались на месте)
  var prevDef = R.defId && alive.filter(function(b){ return b.id === R.defId; })[0];
  if(prevDef) def = prevDef;
  else alive.forEach(function(b){
    var d = Math.hypot(b.baseX-bomb.x, b.baseY-bomb.y) - (b.kit ? 400 : 0); // кит важнее пары метров
    if(d < dBest){ dBest = d; def = b; }
  });
  if(def) R.defId = def.id;
  alive.forEach(function(b){ b.retakeRole = (b === def) ? "defuser" : (R.assign[b.id] !== 0 ? "flank" : "cover"); });
  if(BAL.ninjaDefuse && (R.phase === "gather" || R.phase === "util") && def && ninjaOk()){
    var tLeftN = bombTimeLeftTicks()/TICK_HZ, dN = Math.hypot(def.x-bomb.x, def.y-bomb.y);
    if(tLeftN > dN/SPEED*1.3 + (def.kit ? 5 : 10) + 1){
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
    var ready = alive.filter(function(b){ var a = R.approaches[R.assign[b.id]]; return Math.hypot(a.x-b.baseX, a.y-b.baseY) < 70; }).length;
    var need = Math.min(alive.length, alive.length >= 3 ? 3 : alive.length);
    if(BAL.groupRetake){
      // у про второй заходит через ~3с после первого, у ботов было 5с: ждём
      // каждого, кто успевает дойти до своей точки сбора и ещё зайти на дефуз
      var sL = bombTimeLeftTicks()/TICK_HZ, aD = R.approaches[R.assign[def.id]] || R.approaches[0];
      var gN = Math.hypot(aD.x-bomb.x, aD.y-bomb.y)/SPEED*1.3 + (def.kit ? 5 : 10) + 1.5;
      need = alive.filter(function(b){ var ap = R.approaches[R.assign[b.id]] || aD; return pathLenTo(b, ap.x, ap.y)/SPEED <= sL - gN - 2; }).length;
      need = Math.max(1, need);
      if(!R.gStart) R.gStart = tick;
    }
    var secsLeft = bombTimeLeftTicks()/TICK_HZ;
    // сколько нужно на заход: от точки сбора до бомбы + дефуз
    var a0 = R.approaches[R.assign[def.id]];
    var goNeed = Math.hypot(a0.x-bomb.x, a0.y-bomb.y)/SPEED*1.3 + (def.kit ? 5 : 10) + 1.5;
    var late = secsLeft - goNeed < 3;
    // (v370, владелец: «kyousuke после фрага стоит на сборе и ждёт, хотя может играть сам» — снимок р3: 12 с на Bench, T один с 46 HP)
    // инициатива: ждём своих, только пока нас на точках меньше, чем живых T (киллфид — это знает и живой игрок); на точке —
    // только здоровые (HP > LOW_HP). Временное правило владельца (16.10) — потом заменить на числа из демок (сколько про ждут на сборе)
    var readyFit = alive.filter(function(b){ var ap = R.approaches[R.assign[b.id]]; return ap && Math.hypot(ap.x-b.baseX, ap.y-b.baseY) < 70 && b.hp > LOW_HP; }).length;
    var initiative = readyFit >= 1 && readyFit >= aliveCount("T") && ready < need;
    if(ready >= need || late || initiative){
      if(initiative) logEvent("CT: ретейк — нас на точках "+readyFit+", живых T "+aliveCount("T")+" — заходим, не дожидаясь остальных");
      // ретейк как команда: сначала утилита (флешка на сайт/на известного T,
      // смок на подход T), заход — под хлопок; если гранат нет или время
      // поджимает — сразу
      var util = BAL.retakeRoles && !late && alive.length >= 2 && retakeUtil(R, alive);
      if(util){ R.phase = "util"; R.utilTick = tick;
        logEvent("CT: ретейк — все на точках ("+ready+"/"+alive.length+"), "+util+" — заход под флешку"); }
      else { R.phase = "go"; R.goTick = tick;
        logEvent("CT: ретейк — заходим! ("+ready+"/"+alive.length+" на точках"+(late ? ", время поджимает" : "")+")"); }
    }
    R.ready = ready; R.need = need;
  }
  if(R.phase === "util"){
    var popped = nadeFlags["pop:ретейк"] !== undefined && tick - nadeFlags["pop:ретейк"] >= 6;
    var lateU = bombTimeLeftTicks()/TICK_HZ - ((def ? Math.hypot(def.x-bomb.x, def.y-bomb.y) : 400)/SPEED*1.3 + (def && def.kit ? 5 : 10) + 1.5) < 3;
    if(popped || tick - R.utilTick > 2.2*TICK_HZ || lateU){
      R.phase = "go"; R.goTick = tick;
      logEvent("CT: ретейк — заходим"+(popped ? " под флешку!" : "!"));
    }
  }
  // дефуз под смоком: дефузер подходит к бомбе — смок на неё (его или тиммейта),
  // T с пост-плант позиций не видят того, кто дефузит
  if(BAL.defuseSmoke && R.phase === "go" && !nadeFlags.defSmoke && def && aliveCount("T") > 0){
    var bpS = ctBombPos(), dDef = Math.hypot(def.x-bpS.x, def.y-bpS.y);
    if(dDef < 420 && !smokeCovered(bpS.x, bpS.y)){
      var smk = [def].concat(alive.filter(function(b){ return b !== def; })).filter(function(b){ return b.nades && b.nades.smoke > 0 && !b.nadeTask && Math.hypot(b.x-bpS.x, b.y-bpS.y) < NADE_THROW_RANGE; })[0];
      if(smk && assignNade(smk, "smoke", bpS, "смок на бомбу — дефуз под ним", {now:true})){ nadeFlags.defSmoke = tick;
        voiceLog("CT", "defsmk", smk.id, smk === def ? "кидаю смок на бомбу, дефужу под ним" : "смок на бомбу — "+def.id+", дефузь под ним"); }
    }
  }
  // первый входящий: не дефузер, из основной точки захода, ближе всех к бомбе
  if(R.phase === "go" && BAL.retakeRoles && !R.entryId){
    var ents = alive.filter(function(b){ return b !== def; });
    ents.sort(function(a, c){ return ((R.assign[a.id] === 0 ? 0 : 300) + Math.hypot(a.x-bomb.x, a.y-bomb.y)) - ((R.assign[c.id] === 0 ? 0 : 300) + Math.hypot(c.x-bomb.x, c.y-bomb.y)); });
    R.entryId = ents[0] ? ents[0].id : "-";
    if(ents[0]) voiceLog("CT", "rtentry", ents[0].id, "захожу первым, "+(def ? def.id+" дефузит за мной" : "прикрывайте"));
  }
}
// утилита перед заходом на ретейк: кто кидает флешку (не дефузер, если можно)
// и куда — на известного T у бомбы (свежая инфа), иначе на саму бомбу
function retakeUtil(R, alive){
  if(nadeFlags.retakeFlash) return null;
  var bp = ctBombPos(), def = alive.filter(function(b){ return b.id === R.defId; })[0];
  var fls = alive.filter(function(b){ return b.nades && b.nades.flash > 0; })
    .sort(function(a, c){ return ((a === def) ? 500 : 0) + Math.hypot(a.x-bp.x, a.y-bp.y) - (((c === def) ? 500 : 0) + Math.hypot(c.x-bp.x, c.y-bp.y)); });
  var fl = fls[0]; if(!fl) return null;
  var tgt = bp, L = beliefLast.CT, bestA = Infinity;
  for(var id in L){ var e = L[id]; if(tick - e.tick > 10*TICK_HZ) continue; if(Math.hypot(e.x-bp.x, e.y-bp.y) > 650) continue;
    var dd = Math.hypot(e.x-fl.x, e.y-fl.y); if(dd < bestA){ bestA = dd; tgt = {x:e.x, y:e.y}; } }
  if(!assignNade(fl, "flash", tgt, "ретейк", {bkey:"CT.retake.flash."+bomb.site, now:true, range:900})) return null;
  nadeFlags.retakeFlash = true;
  var gs = GEO[bomb.site];
  var smr = alive.filter(function(b){ return b !== fl && b.nades && b.nades.smoke > 0; })[0];
  if(smr && !nadeFlags.retakeSmoke && retakeCutUseful()){ nadeFlags.retakeSmoke = true; assignNade(smr, "smoke", gs.tEntry, "отрезать вход T", {bkey:"CT.retake.smoke."+bomb.site, now:true}); }
  if(BAL.retakeAwpSmoke && !nadeFlags.retakeAwpSmoke){
    var BLr = beliefLast.CT || {}, awpT = null;
    for(var eidR in BLr){ var loR = BLr[eidR]; if(loR.src !== "spotted" || tick - loR.tick > 10*TICK_HZ) continue; var eR = bots.filter(function(o){ return o.id === eidR; })[0];
      if(eR && eR.alive && eR.primary === "AWP" && Math.hypot(loR.x-bp.x, loR.y-bp.y) < 1000){ awpT = loR; break; } }
    if(awpT){
      var ap0 = R.approaches[0] || bp;
      var smA = alive.filter(function(b){ return b !== fl && b.nades && b.nades.smoke > 0 && !b.nadeTask; })[0];
      var spA = {x: awpT.x + (ap0.x-awpT.x)*0.4, y: awpT.y + (ap0.y-awpT.y)*0.4};
      if(smA && assignNade(smA, "smoke", spA, "ретейк: смок на AWP", {now:true})){ nadeFlags.retakeAwpSmoke = true;
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
    if(BAL.lurkCheck && aliveCount("T") >= 2){
      var dBp = function(o){ return Math.hypot(o.x-bp.x, o.y-bp.y); };
      var bwc = cts.filter(function(o){ return o.id === R.backWatch && o.alive; })[0];
      if(!bwc || (cts.length > 1 && cts.every(function(o){ return o === bwc || !o.alive || dBp(o) > dBp(bwc); }))){
        var bwb = null; cts.forEach(function(o){ if(o.alive && (!bwb || dBp(o) > dBp(bwb))) bwb = o; });
        var nbw = bwb ? bwb.id : "-";
        if(nbw !== R.backWatch){ R.backWatch = nbw; if(bwb) voiceLog("CT", "back", bwb.id, "смотрю спину — может прийти люрк"); } }
      if(R.backWatch === b.id){ setPost(b, a, GEO.rotator, true, gTag(b, R), 0); return; }
    }
    setPost(b, a, bp, true, gTag(b, R), 0);
    return;
  }
  if(b.retakeRole === "defuser"){
    // дефузер не тапает бомбу сразу на заходе (под пост-плант позиции T):
    // сначала первый входящий чистит, дефузер — за ним. Сразу — если время
    // поджимает, он один или первый уже на сайте/погиб
    if(BAL.retakeRoles && !R.allDead && !retakeDefGo(b, R, cts)){
      // (v370) заходить первым некому (один или первый погиб) — сам чистит сайт, как первый, а не стоит у бомбы
      var entB = R.entryId && R.entryId !== b.id && bots.filter(function(o){ return o.id === R.entryId && o.alive; })[0];
      if(!entB) return retakeClear(b, R, cts, a, bp);
      var dsp = pickSpots("retakeD"+bomb.site+"_"+(R.assign[b.id]||0), bp, 1, {rMin:120, rMax:320, minGap:60, must:[bp], see:[a]})[0];
      setPost(b, dsp || a, bp, true, "retakeCover"); return;
    }
    setPost(b, bp, null, true, "defuse"); return;
  }
  // остальные заходят за первым с задержкой ~0.5с (не толпой в один проход)
  if(BAL.groupRetake && R.goTick >= 0 && !R.allDead){
    if(!R.delay){
      R.delay = {}; var dm = 0;
      R.approaches.forEach(function(ap){ dm = Math.max(dm, Math.hypot(ap.x-bomb.x, ap.y-bomb.y)); });
      R.approaches.forEach(function(ap, i){ R.delay[i] = Math.min(2.5*TICK_HZ, Math.max(0, (dm - Math.hypot(ap.x-bomb.x, ap.y-bomb.y))/SPEED*TICK_HZ)); });
    }
    var dl = R.delay[R.assign[b.id]||0] || 0;
    if(tick - R.goTick < dl){ setPost(b, a, bp, true, gTag(b, R), 0); return; }
  }
  if(BAL.retakeRoles && R.entryId && R.entryId !== "-" && b.id !== R.entryId && tick - R.goTick < 0.5*TICK_HZ){
    setPost(b, a, bp, true, gTag(b, R), 0); return;
  }
  retakeClear(b, R, cts, a, bp);
}
function retakeClear(b, R, cts, a, bp){
  // прикрытие/фланг — места с видом на бомбу, со своей стороны захода
  var others = cts.filter(function(c){ return c.retakeRole !== "defuser" && !c.defusing && R.assign[c.id] === R.assign[b.id]; });
  var spots = pickSpots("retake"+bomb.site+"_"+(R.assign[b.id]||0), bp, others.length, {rMin:80, rMax:300, minGap:90, must:[bp], see:[a]});
  var oi = Math.max(0, others.indexOf(b));
  setPost(b, spots[oi] || bp, bp, true, (BAL.retakeRoles && b.id === R.entryId) ? "retakeEntry" : "retake");
}
function retakeDefGo(b, R, cts){
  var secsLeft = bombTimeLeftTicks()/TICK_HZ;
  var late2 = secsLeft - (Math.hypot(b.x-bomb.x, b.y-bomb.y)/SPEED*1.2 + (b.kit ? 5 : 10) + 1) < 2.5;
  if(late2) return true;
  // (v370, снимок р3: kyousuke один против одного T на сайте сразу сел дефузить и умер) один на ретейке или один T — дефузит
  // сразу, только если сайт уже проверен: сам у бомбы (≤ 320 — точки зачистки) ≥ 1,5 с и никого не видит, или где последний T — знаем (≤ 5 с) и он далеко
  // от бомбы (> 600). Иначе сначала чистит сайт (retakeClear). Числа 1,5 с и 600 — проектные
  var solo = cts.filter(function(o){ return !o._saveSpot; }).length <= 1, oneT = aliveCount("T") <= 1;
  if(solo || oneT){
    if(Math.hypot(b.x-bomb.x, b.y-bomb.y) < 320 && !b._sawEnemy && tick - (b._lastSawT||-1e9) > 1.5*TICK_HZ){ if((b._nearBombT = b._nearBombT || tick) && tick - b._nearBombT > 1.5*TICK_HZ) return true; }
    else b._nearBombT = 0;
    var BLd = beliefLast.CT || {}, farT = Object.keys(BLd).some(function(e){ var q = BLd[e]; return q && tick - q.tick <= 5*TICK_HZ && bots.some(function(o){ return o.id === e && o.alive; }) && Math.hypot(q.x-bomb.x, q.y-bomb.y) > 600; });
    if(oneT && farT) return true;
    if(solo) return false;
  }
  var ent = R.entryId && bots.filter(function(o){ return o.id === R.entryId; })[0];
  if(!ent || !ent.alive || ent.hp <= LOW_HP) return true;
  if(Math.hypot(ent.x-bomb.x, ent.y-bomb.y) < 280) return true;
  return tick - R.goTick > 2.5*TICK_HZ;
}
