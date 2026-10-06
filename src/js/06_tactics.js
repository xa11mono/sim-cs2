// ---------- тактики T (IGL выбирает под тип раунда) ----------
// Тактики T. groups — кто каким маршрутом (названия зон) идёт и где ждёт выхода:
//   via   — зоны по порядку (маршрут), stage — зона сбора (нет — стандартный
//   подход к сайту), look — куда смотреть/выходить оттуда; "TMID" — мид со
//   стороны T. rushVia — маршрут раша. Названия — из слоя «зоны».
var T_TACTICS = [
  {id:"execA",  name:"Выход A через мейн",   site:"A", pools:["full","half","force"], setupEnd:38, style:"exec",
    groups:[{roles:["entry","awp","igl"], via:["T Ramp","Split","A Stairs","A Hall"]}, {roles:["support"], stage:"TMID"}]},
  {id:"execB",  name:"Выход B через рампу",  site:"B", pools:["full","half","force"], setupEnd:38, style:"exec",
    groups:[{roles:["entry","awp","igl"], via:["T Ramp","Tunnel","Water","Ruins"]}, {roles:["support"], stage:"TMID"}]},
  {id:"defB",   name:"Дефолт → B",           site:"B", pools:["full","half"],         setupEnd:66, style:"default"},
  {id:"defA",   name:"Дефолт → A",           site:"A", pools:["full","half","pistol"],setupEnd:64, style:"default"},
  {id:"splitA", name:"Сплит A (мейн + донат)", site:"A", pools:["full","half"],       setupEnd:54, style:"split",
    groups:[{roles:["entry","igl"], via:["Split","A Stairs","A Hall"]},
            {roles:["awp","support"], via:["Split","Lower Mid","Mid","Chamber Lane"], stage:"Donut", look:"Short"}]},
  {id:"rushB",  name:"Раш B через рампу",    site:"B", pools:["eco","pistol","force"],setupEnd:0,  style:"rush", rushVia:["T Ramp","Tunnel","Water","Ruins","T Lower"]},
  {id:"rushA",  name:"Раш A через мейн",     site:"A", pools:["eco","pistol","force"],setupEnd:0,  style:"rush", rushVia:["T Ramp","Split","A Stairs","A Hall","A Main"]},
  {id:"splitB", name:"Сплит B (рампа + кейв)", site:"B", pools:["full","half"],       setupEnd:54, style:"split",
    groups:[{roles:["entry","igl"], via:["T Ramp","Tunnel","Water","Ruins"]},
            {roles:["awp","support"], via:["T Ramp","Tunnel","Water","Ruins","T Lower","T Upper","Lamp Room"], stage:"Dark", look:"Cave"}]},
  {id:"fakeAB", name:"Фейк A → выход B",     site:"B", fake:"A", pools:["full","half"],         setupEnd:62, style:"fake"},
  {id:"fakeBA", name:"Фейк B → выход A",     site:"A", fake:"B", pools:["full","half","force"], setupEnd:62, style:"fake"},
  // по названиям зон: кейв, донат, через CT
  {id:"caveB",  name:"Выход B через кейв",   site:"B", pools:["full","half","force"], setupEnd:44, style:"exec",
    groups:[{roles:["entry","awp","igl"], via:["T Ramp","Tunnel","Water","Ruins","T Lower","T Upper","Lamp Room"], stage:"Dark", look:"Cave"},
            {roles:["support"], via:["T Ramp","Tunnel","Water"], stage:"T Lower", look:"Ramp"}]},
  {id:"donutA", name:"Выход A через донат",  site:"A", pools:["full","half","force"], setupEnd:44, style:"exec",
    groups:[{roles:["entry","awp","igl"], via:["Split","Lower Mid","Mid","Chamber Lane"], stage:"Donut", look:"Short"},
            {roles:["support"], via:["Split","A Stairs"]}]},
  {id:"ctA",    name:"Мид → CT, A с двух сторон", site:"A", pools:["full","half"],   setupEnd:60, style:"split",
    groups:[{roles:["entry","igl"], via:["T Ramp","Split","A Stairs","A Hall"]},
            {roles:["awp","support"], via:["Split","Lower Mid","Mid","Top Mid","Sniper Nest","Red Room","Alley","CT Spawn"], stage:"CT Lane", look:"Triple Box"}]},
  {id:"shortA", name:"A: мейн + Short через донат", site:"A", pools:["full","half","force"], setupEnd:50, style:"split",
    groups:[{roles:["entry","awp"], via:["T Ramp","Split","A Stairs","A Hall","A Main"], stage:"Long", look:"Back Site"},
            {roles:["support","igl"], via:["Split","Lower Mid","Mid","Chamber Lane"], stage:"Donut", look:"Short"}]},
  {id:"ctB",    name:"Мид → CT, B с двух сторон", site:"B", pools:["full","half"],   setupEnd:60, style:"split",
    groups:[{roles:["entry","igl"], via:["T Ramp","Tunnel","Water","Ruins"]},
            {roles:["awp","support"], via:["Split","Lower Mid","Mid","Top Mid","Sniper Nest","Red Room","Alley"], stage:"Back Halls", look:"Second Lane"}]}
];
var teamTac = { T: null, CT: {call:null} };
var lastTacticId = null;
function weightedChoice(items, weights, seed){
  var tot = weights.reduce(function(a, w){ return a + Math.max(0, w); }, 0), r = hashRand(seed)*tot, acc = 0;
  for(var i=0;i<items.length;i++){ acc += Math.max(0, weights[i]); if(r < acc) return i; }
  return items.length - 1;
}
function chooseTactic(){
  var type = teamEco.T.roundType;
  var pool = T_TACTICS.filter(function(t){ return t.pools.indexOf(type) >= 0; });
  var weights = pool.map(function(t){
    var w = 1;
    if(t.style === "split") w *= 1.6;                    // заходы с двух сторон — чаще
    if(t.id === "caveB") w *= 1.5;                       // кейв — не забывать
    return w;
  });
  // (v155) у про плант раньше 35с — 13% плантов; у ботов было 26%, раши шли
  // в 19% раундов. Доля рашей теперь задана по типу закупа, остальное — выходы
  var RP = {pistol:0.20, eco:0.25, force:0.08, half:0, full:0}[type] || 0;
    var rW = 0, nW = 0; pool.forEach(function(t, i){ if(t.style === "rush") rW += weights[i]; else nW += weights[i]; });
    if(rW > 0 && nW > 0){ var kR = RP > 0 ? (RP/(1-RP))*nW/rW : 0; pool.forEach(function(t, i){ if(t.style === "rush") weights[i] *= kR; }); }
  var tac = pool[weightedChoice(pool, weights, roundNum*7919 + matchNum*104729 + 17)];
  lastTacticId = tac.id;
  // тайминг выхода гуляет от раунда к раунду (иначе его читают): ~25% —
  // быстрый (на 30% раньше), ~50% — обычный ±4с, ~25% — поздний (+10…18с)
  var setupSec = tac.setupEnd, tmode = "";
  if(BAL.timingVar && setupSec > 0){
    var rT = hashRand(roundNum*6271 + matchNum*353 + 29);
    if(rT < 0.25){ tmode = ", быстрый"; setupSec = Math.max(16, Math.round(setupSec*0.7)); }
    else if(rT < 0.75){ setupSec = Math.max(12, Math.round(setupSec + (hashRand(roundNum*97 + matchNum*13)-0.5)*8)); }
    else { tmode = ", поздний"; setupSec = Math.min(ROUND_TIME_SEC - 38, setupSec + 10 + Math.round(hashRand(roundNum*131 + matchNum*7)*8)); }
  }
  var defUntil = null;
  if(tac.setupEnd > 0){
    // длинный сетап: сначала дефолт (контроль карты), свою расстановку тактика
    // занимает за столько же секунд до выхода, сколько ей нужно было с начала раунда
    var need = Math.max(14, tac.setupEnd - 6);
    if(setupSec - need >= 12) defUntil = roundStartTick + (setupSec - need)*64;
  }
  teamTac.T = {tac:tac, site:tac.site, phase: tac.setupEnd > 0 ? "setup" : "execute", execTick: roundStartTick + setupSec*64, defUntil: defUntil, minExec: (tac.setupEnd > 0) ? Math.min(setupSec, 30) : 0, needT: (tac.setupEnd > 0) ? Math.max(14, tac.setupEnd - 6) : 0,
               execStart: tac.setupEnd > 0 ? null : tick, // раш: выход сразу — отсчёт задержек ролей с начала раунда
               setupSec:setupSec};
  var igl = bots.filter(function(b){ return b.team==="T" && b.tRole==="igl"; })[0];
  logEvent("IGL "+(igl?igl.id:"T")+": тактика «"+tac.name+"» ("+ROUND_TYPE_LABEL[type]+(tac.setupEnd?", выход на "+setupSec+"с"+tmode:", сразу")+")");
  chooseCtSetup();
}
// ---- позиции по названиям зон: кто где держит, занимает, ставит, ретейкает ----
// Порядок = приоритет (первые выбираются чаще, последние — реже, как офф-углы).
var POS = {
  A: { ctHold:["A Site","Triple Box","Back Site","Temple","Plat","Single","Box","Boost","Def"],
       tClear:["Back Site","Triple Box","Box","Def","Boost","Temple"],
       tPost:["Long","Short","Boost","Back Site","Box"],
       entries:["Long","Short"] },
  B: { ctHold:["B Site","Site B","90","First Lane","Second Lane","Dark Box","Bonger"],
       tClear:["90","Second Lane","Site B","Dark Box","First Lane"],
       tPost:["Ramp","T Lower","Cave","Dark","Rat"],
       entries:["Ramp","Cave"] },
  M: { ctHold:["Top Mid","Sniper Nest","Jungle","Red Room"],
       tHold:["TMID","Xbox","Jungle","Lower Mid"] }
};
// ---- пул расстановок CT: план IGL — сколько людей в каком районе (CT_NEED,
// 12_ct_brain.js); куда именно встать — выбор действия (12_team.js) ----
var CT_SETUPS = [
  {id:"std212", name:"Стандарт 2-1-2"}, {id:"std111", name:"1-1-1 с ротатором"},
  {id:"stackA", name:"Стак A"}, {id:"stackB", name:"Стак B"}, {id:"midAggro", name:"Двое на миде"},
  {id:"retakeA", name:"Ретейк-сетап A (A отдают, играют ретейк)"}, {id:"retakeB", name:"Ретейк-сетап B"},
  {id:"pickA", name:"Стандарт 2-1-2 (A)"}, {id:"pickB", name:"Стандарт 2-1-2 (B)"}, {id:"cavePush", name:"Стандарт 2-1-2 (кейв)"}, {id:"redRoom", name:"Стандарт 2-1-2 (Red Room)"}
];
function chooseCtSetup(){
  var why = {};
  var weights = CT_SETUPS.map(function(S){
    var w = {std212:4, std111:1.5, midAggro:0.5, pickA:0.4, pickB:0.4, redRoom:0.6, cavePush:0.5, stackA:0.2, stackB:0.2, retakeA:0.2, retakeB:0.2}[S.id] || 1;
    return w;
  });
  var S = BAL.ctSetups ? CT_SETUPS[weightedChoice(CT_SETUPS, weights, roundNum*4217 + matchNum*881 + 5)] : (BAL.ctSetup === "1-1-1" ? CT_SETUPS[1] : CT_SETUPS[0]);
  teamTac.CT = {call:null, saving:false, setup:S, setupWhy: why[S.id]||null};
  // против эко: без ранних пиков и доборов — не дарить оружие, держать вместе
  if(BAL.ctAntiEco){ var Ee = teamEco.CT.enemyGuess || enemyEcoGuess("CT"); if(Ee.eco && (teamEco.CT.roundType === "full" || teamEco.CT.roundType === "force")){ teamTac.CT.antiEco = true; logEvent("CT: у T, похоже, эко — играем аккуратно: без ранних пиков, не отдаём оружие"); } }
  logEvent("CT: расстановка «"+S.name+"»"+(why[S.id] ? " — "+why[S.id] : ""));
}
var events = []; var killfeed = [];
var simTime = 0; // нужен logEvent-у при старте
var roundStartTick = 0;

function soloMayWalk(b){
  var secLeft = ROUND_TIME_SEC - (simTime - roundStartTime);
  if(secLeft < 22) return false;
  var site = teamTac.T && SITES[teamTac.T.site]; if(!site) return false;
  // время на шаг до точки: скорость шифта ~ SPEED*WALK_SPEED_FRAC
  var d = Math.hypot(site.x-b.x, site.y-b.y) * 1.3;
  if(d / (SPEED*WALK_SPEED_FRAC) > secLeft - 12) return false;
  var cts = bots.filter(function(o){ return o.team === "CT" && o.alive; });
  var allKnownFar = cts.every(function(o){ var e = picKnown("T")[o.id]; return e && tick - e.tick < 5*TICK_HZ && Math.hypot(e.x-site.x, e.y-site.y) > 1100; });
  return !allKnownFar;
}
// ---- IGL: перестройка плана по ходу раунда ----
// Раньше IGL менял план в двух случаях (стак на сайте / минус опорника), а в
// остальном играл "по бумажке": потеряли человека на миде — всё равно ждём
// тайминга; энтри и поддержку сняли на входе — оставшиеся двое по одному
// лезли в тот же прострелянный угол. Теперь:
//  1) минус в сетапе, а убийца далеко от нашего сайта — их человек не там,
//     заходим раньше, пока он не вернулся;
//  2) минус двое без размена в сетапе — лёркер возвращается к группе, заход
//     всеми вместе (не распыляемся 3 против 5);
//  3) выход провалился (на входе потеряли двоих больше, чем убили) — не
//     добиваем себя, отходим; если на другом сайте по инфе пусто и время есть —
//     переходим туда, иначе перегруппировка и повторный заход вместе.
// (6) бомба уже на сайте (носитель в ~4м от точки) — никаких переколов:
// раньше колл уводил носителя, и он пробегал сайт, не поставив
function carrierAtSite(tt){
  if(bomb.state !== "carried" || !bomb.carrier || !bomb.carrier.alive) return false;
  var S = SITES[tt.site]; return Math.hypot(bomb.carrier.x-S.x, bomb.carrier.y-S.y) < 330 || onSite(S, bomb.carrier.x, bomb.carrier.y);
}
function tIglReplan(tt, site, other, secLeft){
  var DL = tt._dl || [], aliveT = aliveCount("T"), aliveCT = aliveCount("CT");
  if(bomb.state === "planted" || aliveT <= 1) return false;
  if(carrierAtSite(tt)) return false;
  if(tt.phase === "setup"){
    var sd = DL.filter(function(e){ return e.t === "T" && e.phase === "setup"; });
    var last = sd[sd.length-1];
    // (1) убийца далеко от нашего сайта
    if(last && !tt._rpFast && tick - last.tick > 1.5*TICK_HZ && tick - last.tick < 4*TICK_HZ && last.kx !== null &&
       aliveT >= 3 && tt.execTick - tick > 6*TICK_HZ && !last.traded){
      var dS = Math.hypot(last.kx-site.x, last.ky-site.y);
      if(dS > 1100){
        tt._rpFast = true;
        tt.execTick = Math.max(tick + 4*TICK_HZ, Math.min(tt.execTick, tick + 6*TICK_HZ));
        logEvent("IGL: минус в сетапе, но CT далеко от "+tt.site+" — выход раньше");
      }
    }
    // (0) сняли CT в сетапе, мы в большинстве — не спешим: контроль карты и
    // выход всей группой (не дарить размен, заходя по одному в спешке)
    if(BAL.numbersPlay && !tt._upSlow && aliveT >= aliveCT + 1 && secLeft > 50){
      var cdS = DL.filter(function(e){ return e.t === "CT" && e.phase === "setup"; });
      var lastC = cdS[cdS.length-1];
      if(lastC && tick - lastC.tick < 2*TICK_HZ){
        tt._upSlow = tick; tt._rpFast = true; // и не ускоряемся на следующий минус
        if(tt.execTick - tick < 8*TICK_HZ) tt.execTick = tick + 8*TICK_HZ;
        logEvent("IGL: численный перевес "+aliveT+"v"+aliveCT+" — без спешки, выход всей группой");
      }
    }
    // (2) двое без размена — лёркер к нам
    var untraded = sd.filter(function(e){ return !e.traded; }).length;
    if(!tt.regroup && untraded >= 2 && aliveT <= 3 && aliveCT >= aliveT){
      var lk = bots.filter(function(b){ return b.team === "T" && b.alive && b.tRole === "lurker"; })[0];
      tt.regroup = tick;
      if(lk){ lk._route = null; lk._routeDone = null; }
      tt.execTick = Math.max(tt.execTick, tick + 5*TICK_HZ); // дать дойти
      logEvent("IGL: потеряли двоих без размена — перегруппировка"+(lk ? " (лёркер "+lk.id+" к основной группе)" : ""));
    }
    // (S8) слышим ротацию CT на наш сайт — можно перейти на другой. Но это
    // только чтение, не гарантия: IGL верит ему не всегда (~60%), и другой сайт
    // НЕ считается пустым — заходим туда обычным выходом, с гранатами и чеком углов
    if(BAL.rotRead && !tt.rebound && !tt._rotDone && aliveT >= 3 && secLeft > 45 && tick % 16 === 0){
      var RH = tt._rotH || (tt._rotH = {});
      picEvents("T").forEach(function(sg){ if((sg.type !== "spotted" && sg.type !== "sound") || !sg.id || sg.id === "?" || tick - sg.tick > 16) return;
        var h = RH[sg.id] || (RH[sg.id] = []); if(!h.length || sg.tick - h[h.length-1].tick >= TICK_HZ){ h.push({x:sg.x, y:sg.y, tick:sg.tick}); if(h.length > 3) h.shift(); } });
      var toward = [];
      for(var rid in RH){ var h = RH[rid]; if(h.length < 2) continue; var a0 = h[0], a1 = h[h.length-1]; if(tick - a1.tick > 6*TICK_HZ) continue;
        var dS0 = Math.hypot(a0.x-site.x, a0.y-site.y), dS1 = Math.hypot(a1.x-site.x, a1.y-site.y);
        var dO0 = Math.hypot(a0.x-SITES[other].x, a0.y-SITES[other].y), dO1 = Math.hypot(a1.x-SITES[other].x, a1.y-SITES[other].y);
        if(dS0 - dS1 > 120 && dO1 - dO0 > 80 && dS1 < 1400) toward.push(rid); }
      if(toward.length >= (aliveCT <= 3 ? 1 : 2)){
        tt._rotDone = tick;
        if(hashRand(roundNum*389 + matchNum*23 + 7) < 0.6){
          tt.rebound = true;
          var ctrR = {x:0, y:0}, tsR = bots.filter(function(b){ return b.team === "T" && b.alive; });
          tsR.forEach(function(b){ ctrR.x += b.x/tsR.length; ctrR.y += b.y/tsR.length; });
          var trvR = Math.hypot(ctrR.x-SITES[other].x, ctrR.y-SITES[other].y)*1.4/SPEED;
          logEvent("IGL: слышим ротацию CT на "+tt.site+" → перекол на "+other+" (не значит, что там пусто)");
          tt.site = other; tt.phase = "setup"; tt.execStart = null; tt.plantPick = null; tt.takeAssign = null;
          tt.execTick = tick + Math.round(Math.min(Math.max(4, trvR*0.7), 12)*TICK_HZ);
          nadeFlags.tExec = false; nadeFlags.tExecSm = false; nadeFlags.peekFlashPlanned = false;
          bots.forEach(function(b){ if(b.team === "T"){ b._route = null; b._routeDone = null; b._stageInfo = null; } });
          return true;
        } else logEvent("IGL: слышим ротацию CT на "+tt.site+", но это может быть фейк — играем по плану");
      }
    }
    return false;
  }
  if(tt.phase === "execute" && !tt.aborted && tt.execStart && tick - tt.execStart < 10*TICK_HZ && secLeft > 40){
    var tD = DL.filter(function(e){ return e.t === "T" && e.tick >= tt.execStart; }).length;
    var cD = DL.filter(function(e){ return e.t === "CT" && e.tick >= tt.execStart; }).length;
    if(tD - cD >= 2 && aliveT <= 3 && aliveCT >= aliveT){
      tt.aborted = tick;
      var otherB = infoCount("T", BZ.siteNear[other]||[], 10);
      var ctr = {x:0, y:0}, tsA = bots.filter(function(b){ return b.team === "T" && b.alive; });
      tsA.forEach(function(b){ ctr.x += b.x/tsA.length; ctr.y += b.y/tsA.length; });
      var travel = Math.hypot(ctr.x-SITES[other].x, ctr.y-SITES[other].y)*1.4/SPEED;
      var goOther = otherB < 1.2 && secLeft > travel + 15;
      tsA.forEach(function(b){ b._route = null; b._routeDone = null; b._stageInfo = null; });
      tt.takeAssign = null; tt.plantPick = null; tt.wave2 = null; tt.w1Contact = null; tt._popDone = false; tt._waitLog = false;
      nadeFlags.tExec = false; nadeFlags.tExecSm = false; nadeFlags.peekFlashPlanned = false;
      if(goOther){
        tt.site = other; tt.phase = "setup"; tt.execStart = null; tt.execTick = tick + Math.round(Math.min(travel*0.8, 14)*TICK_HZ);
        logEvent("IGL: выход провалился ("+tD+" наших против "+cD+") — отход, перекол на "+other);
      } else {
        tt.phase = "setup"; tt.execStart = null; tt.execTick = tick + 6*TICK_HZ;
        logEvent("IGL: выход провалился ("+tD+" наших против "+cD+") — отход и повторный заход на "+tt.site);
      }
      return true;
    }
  }
  return false;
}
