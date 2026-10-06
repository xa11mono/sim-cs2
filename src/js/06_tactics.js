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
// ---- ПАМЯТЬ О СОПЕРНИКЕ (одна на матч; знание о текущем раунде — в картине команды) ----
// Что команды узнали друг о друге за прошлые раунды этого матча:
//   tacMem / tacHist   — IGL T: какие тактики сыграны, победы, планты
//   ctRead             — что T видели в начале раунда: сколько CT на A и на B
//   roundHist / tSiteHist / siteHeat(+Pending) — куда T реально выходили, итоги раундов
//   ctHabit            — любимые углы конкретных CT (где стояли / где убили)
//   ctSetupHist / ctSetupMem — какие расстановки CT играли и что сработало
//   aggrObs            — кто как часто сам лезет в дуэль
//   RMEM               — агрессия CT, раши, ранние смерти мидера
//   TDEATHS            — где умирали T
//   nadeLandHistory    — куда команда кидает молотов/HE по сайту
// Между матчами её половинная копия хранится в браузере (OPP, ниже).
var MEMORY = {tSiteHist:[], siteHeatPending:{}, siteHeat:{A:1, B:1},
  tacMem:{}, ctRead:[], roundHist:[], ctHabit:{}, tacHist:[], ctSetupHist:[], ctSetupMem:{},
  aggrObs:{}, TDEATHS:{m:-1, list:[]}, RMEM:{aggro:[], rush:[], midDeath:[]}, nadeLandHistory:{A:[], B:[]}};
var teamTac = { T: null, CT: {call:null} };
var lastTacticId = null;
// ======================= РАЗДЕЛ 13 (п.1–5): АДАПТАЦИЯ ВНУТРИ МАТЧА =======================
// Всё — только по событиям текущего матча, сбрасывается с новым матчем.
//   MEMORY.tacMem   — IGL T: сколько раз сыграна тактика, победы, планты
//   MEMORY.ctRead   — что T видели в начале раунда: сколько CT было на A и на B
//   MEMORY.roundHist— итоги раундов для CT: куда шли T, был ли плант, кто выиграл, когда выход
//   MEMORY.ctHabit  — любимые углы конкретных CT (по нику): где их видели стоящими / где убили
function resetMatchMemory(){ MEMORY.tacMem = {}; MEMORY.ctRead = []; MEMORY.roundHist = []; MEMORY.ctHabit = {}; MEMORY.tacHist = []; MEMORY.ctSetupHist = []; MEMORY.ctSetupMem = {}; MEMORY.aggrObs = {}; bots.forEach(function(b){ b._mistakes = 0; }); loadOppProfile(); }
// Профиль соперника: что команды выучили друг о друге за матч (тактики, что
// сработало у CT, любимые углы каждого игрока, кто как агрессивен) — сохраняется
// в конце матча; следующий матч стартует с этим знанием (вес половинный, дальше
// уточняется уже по новому матчу). Хранится в браузере и в «Экспорт проекта».
var OPP_KEY = "ancient-live-radar-opp-v1", OPP = null;
try{ OPP = JSON.parse(localStorage.getItem(OPP_KEY)||"null"); }catch(e){}
function saveOppProfile(){
  var P = OPP || {matches:0, tacMem:{}, ctSetupMem:{}, habit:{}, aggr:{}};
  var half = function(o, keys){ var r = {}; for(var k in o){ r[k] = {}; keys.forEach(function(f){ r[k][f] = (o[k][f]||0); }); } return r; };
  var mergeCnt = function(dst, src, keys){ for(var k in src){ var d = dst[k] || (dst[k] = {}); keys.forEach(function(f){ d[f] = (d[f]||0)*0.5 + (src[k][f]||0); }); } };
  mergeCnt(P.tacMem, MEMORY.tacMem, ["n","w","plants"]);
  mergeCnt(P.ctSetupMem, MEMORY.ctSetupMem, ["n","w"]);
  mergeCnt(P.aggr, MEMORY.aggrObs, ["e","r"]);
  for(var id in MEMORY.ctHabit){ var H = P.habit[id] || (P.habit[id] = {}); for(var c in MEMORY.ctHabit[id]){ var h = MEMORY.ctHabit[id][c], o = H[c];
    if(o){ o.x = (o.x*o.n*0.5 + h.x*h.n)/(o.n*0.5 + h.n); o.y = (o.y*o.n*0.5 + h.y*h.n)/(o.n*0.5 + h.n); o.n = o.n*0.5 + h.n; } else H[c] = {x:h.x, y:h.y, n:h.n}; } }
  P.matches++;
  OPP = P; try{ localStorage.setItem(OPP_KEY, JSON.stringify(P)); }catch(e){}
  logEvent("Профиль соперника обновлён (матчей: "+P.matches+")");
}
function loadOppProfile(){
  if(!OPP || !OPP.matches) return;
  var cp = function(src, keys, k0){ var r = {}; for(var k in src){ r[k] = {}; keys.forEach(function(f){ r[k][f] = (src[k][f]||0)*k0; }); } return r; };
  MEMORY.tacMem = cp(OPP.tacMem, ["n","w","plants"], 0.5);
  MEMORY.ctSetupMem = cp(OPP.ctSetupMem, ["n","w"], 0.5);
  MEMORY.aggrObs = cp(OPP.aggr, ["e","r"], 0.5);
  MEMORY.ctHabit = {}; for(var id in OPP.habit){ MEMORY.ctHabit[id] = {}; for(var c in OPP.habit[id]){ var h = OPP.habit[id][c]; MEMORY.ctHabit[id][c] = {x:h.x, y:h.y, n:h.n*0.5}; } }
  logEvent("Профиль соперника загружен (матчей: "+OPP.matches+") — IGL и CT стартуют с поправкой на привычки");
}
function weightedChoice(items, weights, seed){
  var tot = weights.reduce(function(a, w){ return a + Math.max(0, w); }, 0), r = hashRand(seed)*tot, acc = 0;
  for(var i=0;i<items.length;i++){ acc += Math.max(0, weights[i]); if(r < acc) return i; }
  return items.length - 1;
}
// ---- IGL: чтение CT по прошлым раундам ----
function readCT(){
  var last = MEMORY.ctRead.slice(-3), out = {stack:null, n:0, of:last.length};
  // "стак" — видели у сайта 2+ CT и больше, чем у другого, в 2 из 3 последних раундов
  ["A","B"].forEach(function(k){ var o = k === "A" ? "B" : "A"; var n = last.filter(function(r){ return r[k] >= 2 && r[k] > r[o]; }).length; if(n >= 2 && n > out.n){ out.stack = k; out.n = n; } });
  return out;
}
// ---- тайм-ауты ----
// Проиграли 3 раунда подряд — IGL берёт тайм-аут (в турнирах их несколько по
// 30с; у нас 3 на матч). После него на 4 раунда: T не повторяют последние
// тактики, которые не сработали; CT уходят от своих последних расстановок.
var TOUT = {CT:{left:3, streak:0, until:0, avoid:[]}, T:{left:3, streak:0, until:0, avoid:[]}};
function timeoutsReset(){ TOUT = {CT:{left:3, streak:0, until:0, avoid:[]}, T:{left:3, streak:0, until:0, avoid:[]}}; }
function timeoutCheck(winner){
  ["CT","T"].forEach(function(team){
    var T0 = TOUT[team];
    if(team === winner){ T0.streak = 0; return; }
    T0.streak++;
    if(T0.streak >= 3 && T0.left > 0 && roundNum !== HALF_ROUNDS && roundState !== "matchover"){
      T0.left--; T0.streak = 0; T0.until = roundNum + 4;
      T0.avoid = team === "T" ? MEMORY.tacHist.slice(-3) : MEMORY.ctSetupHist.slice(-3);
      var names = team === "T" ? T0.avoid.map(function(id){ var t = T_TACTICS.filter(function(x){ return x.id === id; })[0]; return t ? t.name : id; })
                               : T0.avoid.map(function(id){ var t = CT_SETUPS.filter(function(x){ return x.id === id; })[0]; return t ? t.name : id; });
      logEvent("ТАЙМ-АУТ "+team+" — три поражения подряд. "+(team === "T" ? "IGL: не повторяем «"+names.join("», «")+"»" : "CT: меняем расстановку, уходим от «"+names.join("», «")+"»")+" (осталось тайм-аутов: "+T0.left+")", true);
    }
  });
}
// ---- перерыв: выводы по первой половине ----
var HALF_ADJ = {tac:{}, ctSite:null};
function halfReview(){
  HALF_ADJ = {tac:{}, ctSite:null};
  var bad = [], good = [];
  T_TACTICS.forEach(function(t){ var M = MEMORY.tacMem[t.id]; if(!M || M.n < 2) return; var r = M.w/M.n;
    if(r < 0.2){ HALF_ADJ.tac[t.id] = 0.25; bad.push(t.name); } else if(r >= 0.6){ HALF_ADJ.tac[t.id] = 1.4; good.push(t.name); } });
  var hA = 0, hB = 0; MEMORY.roundHist.forEach(function(r){ if(r.site === "A") hA++; else if(r.site === "B") hB++; });
  if(hA + hB >= 6 && Math.max(hA, hB) >= Math.min(hA, hB)*1.6) HALF_ADJ.ctSite = hA > hB ? "A" : "B";
  logEvent("ПЕРЕРЫВ — IGL T: "+(bad.length ? "убираем «"+bad.join("», «")+"»" : "тактики без изменений")+(good.length ? "; чаще «"+good.join("», «")+"»" : "")+
    ". CT: "+(HALF_ADJ.ctSite ? "T ходили на "+HALF_ADJ.ctSite+" "+Math.max(hA, hB)+" раз из "+(hA+hB)+" — усиливаем "+HALF_ADJ.ctSite : "расстановка без изменений"), true);
}
function chooseTactic(){
  var type = teamEco.T.roundType;
  var pool = T_TACTICS.filter(function(t){ return t.pools.indexOf(type) >= 0; });
  var rd = readCT(), readTxt = null;
  var tempoRead = null;
  if(BAL.tempoShift){ var lastT = MEMORY.roundHist.slice(-2);
    if(lastT.length === 2 && lastT.every(function(r){ return r.winner === "CT"; })){
      var fast = lastT.every(function(r){ return r.execSec != null && r.execSec < 32; }), slow = lastT.every(function(r){ return r.execSec == null || r.execSec >= 45; });
      tempoRead = fast ? "slow" : (slow ? "fast" : null); } }
  var weights = pool.map(function(t){
    var M = MEMORY.tacMem[t.id] || {n:0, w:0};
    var w = 0.5 + 1.5*((M.w + 1)/(M.n + 2));             // удачные всплывают, проваленные тонут
    if(t.style === "split") w *= 1.6;                    // заходы с двух сторон — чаще
    if(t.id === "caveB") w *= 1.5;                       // кейв — не забывать
    var l1 = MEMORY.tacHist[MEMORY.tacHist.length-1], l2 = MEMORY.tacHist[MEMORY.tacHist.length-2];
    if(l1 === t.id) w *= 0.35;                          // только что играли
    if(l1 === t.id && l2 === t.id) w *= 0.1;            // третий раз подряд — прочитана
    if(BAL.halfReview && roundNum > HALF_ROUNDS && HALF_ADJ.tac[t.id]) w *= HALF_ADJ.tac[t.id]; // выводы перерыва
    if(roundNum <= TOUT.T.until){ if(TOUT.T.avoid.indexOf(t.id) >= 0) w *= 0.15; else w *= 1.3; } // после тайм-аута
    // (8) темп по счёту: два проигрыша подряд быстрыми выходами — медленнее
    // (дефолт), два проигрыша медленными — быстрее (раш/ранний выход)
    if(BAL.tempoShift && tempoRead){ if(tempoRead === "slow"){ if(t.style === "default") w *= 2.2; if(t.style === "rush") w *= 0.3; }
      else { if(t.style === "rush" || (t.setupEnd && t.setupEnd <= 44)) w *= 1.8; if(t.style === "default") w *= 0.4; } }
    if(rd.stack){                                       // CT стакают сайт — уходим / фейкуем его
      if(t.site === rd.stack && t.style !== "fake") w *= 0.3;
      else if(t.style === "fake" && t.fake === rd.stack) w *= 2.5;
      else if(t.site !== rd.stack) w *= 1.4;
    }
    return w;
  });
  if(rd.stack) readTxt = "читаем CT: "+rd.stack+" — стак "+rd.n+" из "+rd.of+" раундов → уходим от "+rd.stack+" / фейк на "+rd.stack;
  // (v155) у про плант раньше 35с — 13% плантов; у ботов было 26%, раши шли
  // в 19% раундов. Доля рашей теперь задана по типу закупа, остальное — выходы
  var RP = {pistol:0.20, eco:0.25, force:0.08, half:0, full:0}[type] || 0;
    var rW = 0, nW = 0; pool.forEach(function(t, i){ if(t.style === "rush") rW += weights[i]; else nW += weights[i]; });
    if(rW > 0 && nW > 0){ var kR = RP > 0 ? (RP/(1-RP))*nW/rW : 0; pool.forEach(function(t, i){ if(t.style === "rush") weights[i] *= kR; }); }
  var tac = pool[weightedChoice(pool, weights, roundNum*7919 + matchNum*104729 + 17)];
  lastTacticId = tac.id; MEMORY.tacHist.push(tac.id);
  // тайминг выхода гуляет от раунда к раунду (иначе его читают): ~25% —
  // быстрый (на 30% раньше), ~50% — обычный ±4с, ~25% — поздний (+10…18с)
  var setupSec = tac.setupEnd, tmode = "";
  if(tempoRead) logEvent("IGL: два раунда проиграли "+(tempoRead === "slow" ? "быстрыми выходами — сейчас медленно, от дефолта" : "медленно — сейчас быстрее, пока не ждут"));
  if(BAL.timingVar && setupSec > 0){
    var rT = hashRand(roundNum*6271 + matchNum*353 + 29);
    if(tempoRead === "slow") rT = 0.8 + 0.2*rT; else if(tempoRead === "fast") rT = 0.2*rT;   // (8) темп
    if(rT < 0.25){ tmode = ", быстрый"; setupSec = Math.max(16, Math.round(setupSec*0.7)); }
    else if(rT < 0.75){ setupSec = Math.max(12, Math.round(setupSec + (hashRand(roundNum*97 + matchNum*13)-0.5)*8)); }
    else { tmode = ", поздний"; setupSec = Math.min(ROUND_TIME_SEC - 38, setupSec + 10 + Math.round(hashRand(roundNum*131 + matchNum*7)*8)); }
  }
  var defUntil = null;
  if(tac.setupEnd > 0){
    // время планта — из распределения про (квантили 10/25/50/75/90% = 34/44/66/88/103с),
    // выход ~12с до планта (у ботов от выхода до планта 10–15с); стиль тактики сдвигает: выходы раньше, дефолт/фейк позже
    var u = hashRand(roundNum*6271 + matchNum*353 + 29);
    if(tempoRead === "slow") u = 0.5 + 0.5*u; else if(tempoRead === "fast") u = 0.5*u;
    var bias = {exec:[0, 0.8], split:[0.05, 0.9], fake:[0.25, 0.75], "default":[0.3, 0.7]}[tac.style] || [0, 1];
    u = bias[0] + bias[1]*u;
    var QX = [0, 0.10, 0.25, 0.50, 0.75, 0.90, 1], QY = [22, 34, 44, 66, 88, 100, 106], pT = QY[QY.length-1];
    for(var qi = 1; qi < QX.length; qi++){ if(u <= QX[qi]){ pT = QY[qi-1] + (QY[qi]-QY[qi-1])*(u-QX[qi-1])/(QX[qi]-QX[qi-1]); break; } }
    setupSec = Math.round(Math.max(tac.setupEnd*0.6, Math.min(ROUND_TIME_SEC - 26, pT - 12)));
    tmode = setupSec < tac.setupEnd - 6 ? ", быстрый" : (setupSec > tac.setupEnd + 8 ? ", поздний" : "");
    // длинный сетап: сначала дефолт (контроль карты), свою расстановку тактика
    // занимает за столько же секунд до выхода, сколько ей нужно было с начала раунда
    var need = Math.max(14, tac.setupEnd - 6);
    if(setupSec - need >= 12) defUntil = roundStartTick + (setupSec - need)*64;
  }
  teamTac.T = {tac:tac, site:tac.site, phase: tac.setupEnd > 0 ? "setup" : "execute", execTick: roundStartTick + setupSec*64, defUntil: defUntil, minExec: (tac.setupEnd > 0) ? Math.min(setupSec, 30) : 0, needT: (tac.setupEnd > 0) ? Math.max(14, tac.setupEnd - 6) : 0,
               execStart: tac.setupEnd > 0 ? null : tick, // раш: выход сразу — отсчёт задержек ролей с начала раунда
               read: readTxt, seenCT:{A:0, B:0}, setupSec:setupSec};
  var M = MEMORY.tacMem[tac.id];
  var igl = bots.filter(function(b){ return b.team==="T" && b.tRole==="igl"; })[0];
  if(readTxt) logEvent("IGL "+(igl?igl.id:"T")+": "+readTxt);
  logEvent("IGL "+(igl?igl.id:"T")+": тактика «"+tac.name+"» ("+ROUND_TYPE_LABEL[type]+(tac.setupEnd?", выход на "+setupSec+"с"+tmode:", сразу")+
    (M && M.n ? ", в этом матче "+M.w+"/"+M.n : "")+")");
  chooseCtSetup();
}
// ---- позиции по названиям зон: кто где держит, занимает, ставит, ретейкает ----
// Порядок = приоритет (первые выбираются чаще, последние — реже, как офф-углы).
var POS = {
  A: { ctHold:["A Site","Triple Box","Back Site","Temple","Plat","Single","Box","Boost","Def"],
       ctSecond:["Temple","Back Site","Triple Box","Plat","Single"],
       ctRetake:["Temple","CT Lane","Triple Box"],
       tClear:["Back Site","Triple Box","Box","Def","Boost","Temple"],
       tPost:["Long","Short","Boost","Back Site","Box"],
       entries:["Long","Short"] },
  B: { ctHold:["B Site","Site B","90","First Lane","Second Lane","Dark Box","Bonger"],
       ctSecond:["90","First Lane","Second Lane","Site B","Dark Box"],
       ctRetake:["Back Halls","Second Lane","First Lane","90"],
       tClear:["90","Second Lane","Site B","Dark Box","First Lane"],
       tPost:["Ramp","T Lower","Cave","Dark","Rat"],
       entries:["Ramp","Cave"] },
  M: { ctHold:["Top Mid","Sniper Nest","Jungle","Red Room"],
       tHold:["TMID","Xbox","Jungle","Lower Mid"] }
};
// точка на зоне с таким названием: укрытое место внутри/у зоны, откуда видно see
function namedSpot(name, near, o){
  var zp = zonePoint(name, near); if(!zp) return null;
  o = o || {};
  var sp = pickSpots("nm:"+name+":"+(o.key||""), zp, 1, {rMax:o.rMax||110, minGap:40, see:o.see||[], hideFrom:o.hideFrom||[], must:o.must, cross:o.cross})[0];
  return sp || zp;
}
function entryPts(k){ return POS[k].entries.map(function(n){ return zonePoint(n, SITES[k]); }).filter(Boolean); }
// не смотрим "сквозь" своего тиммейта в упор: если по прямой от поста до
// цели взгляда в 15–92% пути стоит живой союзник ближе чем на 70px к этой
// линии — считаем цель загороженной (в реальной игре так не расставляются
// кроссфаером, это выглядит как "уставился на напарника", а не на вход)
function sightBlockedByAlly(b, from, to){
  if(!b || !b.team) return false;
  var dx = to.x-from.x, dy = to.y-from.y, len2 = dx*dx+dy*dy;
  if(len2 < 1) return false;
  return bots.some(function(o){
    if(o === b || !o.alive || o.team !== b.team) return false;
    var t = ((o.x-from.x)*dx + (o.y-from.y)*dy)/len2;
    if(t < 0.15 || t > 0.92) return false;
    return distToSeg(o.x, o.y, [from.x, from.y, to.x, to.y]) < 70;
  });
}
// центр зоны-входа (например, Cave) может оказаться у холда ЗА СПИНОЙ: он
// стоит в дальнем конце коридора, у Dark, а центр Cave — ближе к сайту.
// Тогда "смотреть на вход" = смотреть назад, на свой же сайт. Если по пути
// до T-спавна холд уже ближе, чем центр входа, — смотрим дальше НАРУЖУ по
// этому пути (Dark / Lamp Room / T Upper), а видимый угол найдёт cornerLook
var OUTWARD_CACHE = {};
function outwardLook(p, e){
  // Куда смотреть, стоя В коридоре входа (Cave, Short…): дальше по ЭТОМУ
  // коридору наружу, туда, откуда по нему придут T. Раньше бралось "по пути
  // до T-спавна" — а из верхней части Cave кратчайший путь до T идёт через
  // сайт и Ramp, и холд смотрел на сайт, спиной к Dark. Теперь — по графу
  // зон: из зоны входа — в соседнюю зону, которая ближе всех к T-спавну и не
  // является самим сайтом (для Cave это Dark)
  var key = Math.round(p.x/8)+","+Math.round(p.y/8)+"|"+Math.round(e.x/8)+","+Math.round(e.y/8);
  if(key in OUTWARD_CACHE) return OUTWARD_CACHE[key];
  var res = null;
  if(!BZ.ids.length) beliefBuild();
  var ze = bzOf(e.x, e.y), zp = bzOf(p.x, p.y);
  if(!BZ.DT){ var zs = bzOf(T_SPAWN.x, T_SPAWN.y); BZ.DT = bzDist(zs >= 0 ? [zs] : []); }
  // холд стоит ещё дальше наружу, чем сам вход (опорник "Cave" встал в Dark) —
  // смотрим наружу уже из СВОЕЙ зоны (из Dark — на Lamp Room), а не назад на Cave
  var zb0 = ze;
  if(zp >= 0 && ze >= 0 && zp !== ze && BZ.DT[zp] < BZ.DT[ze] && Math.hypot(p.x-e.x, p.y-e.y) < 350) zb0 = zp;
  if(ze >= 0 && (zp === ze || zb0 === zp || Math.hypot(p.x-e.x, p.y-e.y) < 120)){
    var nearSite = function(i){ var c = BZ.cent[i]; return !c || ["A","B"].some(function(k){ return SITES[k] && Math.hypot(c.x-SITES[k].x, c.y-SITES[k].y) < 200; }); };
    var best = -1, bd = Infinity;
    (BZ.nbr[zb0]||[]).forEach(function(n){ if(nearSite(n)) return; if(BZ.DT[n] < bd){ bd = BZ.DT[n]; best = n; } });
    if(best >= 0 && bd < BZ.DT[zb0]) res = walk(BZ.cent[best]);
  }
  OUTWARD_CACHE[key] = res;
  return res;
}
// куда смотреть из точки: первый видимый вход сайта
function lookFrom(p, list, fb, b){
  // если холд стоит прямо в одном из входов (например, в самом Cave, а не на
  // открытой части сайта) — смотрит дальше в СВОЙ коридор (туда, откуда сам
  // и пришёл бы враг), а не переключается на другой, "главный" вход только
  // потому что он в списке первый и тоже виден — иначе стоял спиной к своему
  // же тоннелю, глядя через сайт на чужой вход
  // не требуем прямой видимости центра зоны-входа — угол к ней всё равно
  // находит cornerLook по пути; тут просто предпочитаем САМЫЙ БЛИЖНИЙ вход,
  // если стоим внутри его коридора, а не первый по списку с видимостью
  var near = null, nd = 350;
  list.forEach(function(e){ if(!e) return; if(sightBlockedByAlly(b, p, e)) return; var d = Math.hypot(e.x-p.x, e.y-p.y); if(d < nd){ nd = d; near = e; } });
  if(near) return outwardLook(p, near) || near;
  for(var i=0;i<list.length;i++){ if(list[i] && !sightBlockedByAlly(b, p, list[i]) && hasLOS(p.x, p.y, list[i].x, list[i].y)) return list[i]; }
  // ничего не подошло по 350px/прямой видимости (это нормально — точную
  // видимость дальше находит cornerLook по пути), но какой-то вход всё же
  // не закрыт союзником — берём ближайший из них, уже без ограничения в 350,
  // лишь бы не смотреть "сквозь" тиммейта
  var near2 = null, nd2 = Infinity;
  list.forEach(function(e){ if(!e || sightBlockedByAlly(b, p, e)) return; var d = Math.hypot(e.x-p.x, e.y-p.y); if(d < nd2){ nd2 = d; near2 = e; } });
  if(near2) return near2;
  // абсолютно все варианты закрыты союзником — лучше смотреть хоть куда-то
  // полезное, чем никуда: берём ближайший вообще, без фильтра по союзнику
  var near3 = null, nd3 = Infinity;
  list.forEach(function(e){ if(!e) return; var d = Math.hypot(e.x-p.x, e.y-p.y); if(d < nd3){ nd3 = d; near3 = e; } });
  return near3 || fb;
}
// ---- пул расстановок CT (раздел 12/13) ----
// roles: позиции по названиям зон; early — куда встать в первые sec секунд
// (выход за инфой), потом — pos. rot: "212" — ротатор вторым на "горячий" сайт,
// "111" — ротатор между сайтами. stack — сайт, на который встаёт роумер.
var CT_SETUPS = [
  {id:"std212", name:"Стандарт 2-1-2", rot:"212"},
  {id:"std111", name:"1-1-1 с ротатором", rot:"111"},
  {id:"stackA", name:"Стак A", rot:"stack", stack:"A",
    roles:{rotator:{pos:["Triple Box","Temple"], look:"A Site"}, roamer:{pos:["Back Site","Plat"], look:"Long"}}},
  {id:"stackB", name:"Стак B", rot:"stack", stack:"B",
    roles:{rotator:{pos:["Site B","90"], look:"Ramp"}, roamer:{pos:["Second Lane","B Site"], look:"Cave"}}},
  {id:"midAggro", name:"Агрессия мидом за инфой", rot:"212",
    roles:{mid:{early:{pos:["Mid","Chamber Lane"], look:"Lower Mid", sec:22}}, roamer:{early:{pos:["Top Mid"], look:"Mid", sec:22}}}},
  {id:"retakeA", name:"Ретейк-сетап A (A отдают, играют ретейк)", rot:"111",
    roles:{anchorA:{pos:["Temple"], look:"A Site"}, rotator:{pos:["CT Lane"], look:"Triple Box"}}},
  {id:"retakeB", name:"Ретейк-сетап B", rot:"111",
    roles:{anchorB:{pos:["Second Lane"], look:"B Site"}, rotator:{pos:["Back Halls"], look:"Second Lane"}}},
  {id:"pickA", name:"Пик мейна A за инфой", rot:"212",
    roles:{anchorA:{early:{pos:["Long"], look:"A Main", sec:12}}}},
  {id:"pickB", name:"Пик рампы B за инфой", rot:"212",
    roles:{anchorB:{early:{pos:["Ramp"], look:"T Lower", sec:12}}}},
  {id:"cavePush", name:"Пуш кейва за инфой (до Lamp Room)", rot:"212",
    // после инфы (20с) роумер не бросает глубокую точку ради дубля кейва —
    // остаётся в Dark/Lamp Room и держит именно этот подход (его напарник
    // anchorB уже смотрит на Dark со стороны кейва — вместе перекрёсток).
    // hideFrom:false — обоим нужно смотреть именно в сторону мида/тоннеля,
    // прятаться от него тут в принципе не нужно
    roles:{roamer:{early:{pos:["Dark","Lamp Room"], look:"T Upper", sec:20}, pos:["Dark","Lamp Room"], look:"T Upper", hideFrom:false},
           anchorB:{pos:["Cave","B Site"], look:"Dark", hideFrom:false}}},
  {id:"redRoom", name:"Контроль Red Room + Short", rot:"212",
    roles:{mid:{pos:["Red Room","Sniper Nest"], look:"Top Mid"}, roamer:{pos:["Short"], look:"Donut"}}}
];
function chooseCtSetup(){
  var last = MEMORY.roundHist.slice(-4), heat = {A:0, B:0}, lost = {A:0, B:0};
  last.forEach(function(r){ heat[r.site]++; if(r.planted && r.winner === "T") lost[r.site]++; });
  var execs = MEMORY.roundHist.slice(-3).map(function(r){ return r.execSec; }).filter(function(x){ return x != null; });
  var avgExec = execs.length ? execs.reduce(function(a,x){ return a+x; }, 0)/execs.length : 45;
  var why = {};
  var weights = CT_SETUPS.map(function(S){
    var w = {std212:4, std111:1.5, midAggro:0.5, pickA:0.4, pickB:0.4, redRoom:0.6, cavePush:0.5, stackA:0.2, stackB:0.2, retakeA:0.2, retakeB:0.2}[S.id] || 1;
    if(S.stack){ var h = heat[S.stack]; if(last.length >= 3 && h >= 3){ w = 1.2; why[S.id] = "T ходили на "+S.stack+" "+h+" из "+last.length; } else if(h >= 2) w = 0.4; }
    if(/^retake/.test(S.id)){ var k = S.id.slice(-1); if(lost[k] >= 2){ w = 1.2; why[S.id] = "на "+k+" проигрываем "+lost[k]+" раунда — играем от ретейка"; } }
    if(S.roles && Object.keys(S.roles).some(function(r){ return S.roles[r].early; })){
      if(avgExec < 25) w *= 0.4; else if(avgExec > 45){ w *= 1.15; why[S.id] = "T выходят поздно (~"+Math.round(avgExec)+"с) — есть время за инфой"; }
    }
    var l1 = MEMORY.ctSetupHist[MEMORY.ctSetupHist.length-1], l2 = MEMORY.ctSetupHist[MEMORY.ctSetupHist.length-2];
    if(l1 === S.id && l2 === S.id) w *= 0.15;
    // (1) мидер рано умирал в 2 из 3 последних раундов — агрессивный мид реже
    if(BAL.roundMem && S.id === "midAggro" && rmemRecent(MEMORY.RMEM.midDeath, 3).length >= 2){ w *= 0.2; why[S.id] = null; }
    // CT тоже помнят, какие расстановки в этом матче сработали, а какие нет
    var CM = MEMORY.ctSetupMem[S.id] || {n:0, w:0};
    w *= 0.3 + 1.7*((CM.w + 1)/(CM.n + 2));
    if(BAL.halfReview && roundNum > HALF_ROUNDS && HALF_ADJ.ctSite && S.stack === HALF_ADJ.ctSite) w *= 2.5; // выводы перерыва
    if(roundNum <= TOUT.CT.until && TOUT.CT.avoid.indexOf(S.id) >= 0) w *= 0.15; // после тайм-аута
    return w;
  });
  var S = BAL.ctSetups ? CT_SETUPS[weightedChoice(CT_SETUPS, weights, roundNum*4217 + matchNum*881 + 5)] : (BAL.ctSetup === "1-1-1" ? CT_SETUPS[1] : CT_SETUPS[0]);
  MEMORY.ctSetupHist.push(S.id);
  teamTac.CT = {call:null, saving:false, stack:S.stack||null, setup:S, setupWhy: why[S.id]||null};
  // против эко: без ранних пиков и доборов — не дарить оружие, держать вместе
  if(BAL.ctAntiEco){ var Ee = teamEco.CT.enemyGuess || enemyEcoGuess("CT"); if(Ee.eco && (teamEco.CT.roundType === "full" || teamEco.CT.roundType === "force")){ teamTac.CT.antiEco = true; logEvent("CT: у T, похоже, эко — играем аккуратно: без ранних пиков, не отдаём оружие"); } }
  logEvent("CT: расстановка «"+S.name+"»"+(why[S.id] ? " — "+why[S.id] : ""));
}
// роль CT по расстановке: позиция по названию зоны (из нескольких — по раунду)
function ctSetupRole(b, role, ct){
  var S = ct.setup; if(!S || !S.roles || !S.roles[role]) return false;
  var R = S.roles[role];
  // мидер с пистолетом/ПП или с AWP на агрессивной расстановке — позиция мида
  // по оружию (ближний угол / дальняя точка), а не вперёд в дуэль на дистанции
  if(BAL.midWeapon && role === "mid" && b.weapon && (b.weapon.tier < 5 || ((b.weapon.key === "AWP" || b.weapon.key === "SSG") && R.early))) return false;
  var early = R.early && tick - roundStartTick < R.early.sec*TICK_HZ;
  var P = early ? R.early : R;
  if(early && b._sawEnemy) b._earlySaw = roundNum;
  if(early && b.atPost) b._earlyAt = {round:roundNum, x:b.x, y:b.y};
  // выход за инфой закончился: никого не увидел и не услышал — отметить "пусто"
  if(!early && R.early && b._earlyDone !== roundNum){
    b._earlyDone = roundNum;
    var ea = b._earlyAt && b._earlyAt.round === roundNum ? b._earlyAt : null;
    if(ea && b._earlySaw !== roundNum && picNear("CT", ea.x, ea.y, 600) === 0) markClear("CT", ea.x, ea.y, b.id);
  }
  if(!P.pos) return false;
  var nm = BAL.proPrior ? P.pos[proPick("CT", P.pos, roundNum*97 + role.length*13 + matchNum)] : P.pos[Math.floor(hashRand(roundNum*97 + role.length*13 + matchNum) * P.pos.length)];
  var ref = role === "anchorA" ? GEO.A.anchor : role === "anchorB" ? GEO.B.anchor : GEO.ctMid;
  var c = zonePoint(nm, ref); if(!c) return false;
  var lk = (P.look && zonePoint(P.look, c)) || ref;
  // прятаться от мида по умолчанию — но не тогда, когда сам взгляд НАПРАВЛЕН
  // в сторону мида/тоннеля (Пуш кейва): иначе позицию тянуло в укромный
  // уголок, откуда "спрятанное от мида" направление и есть тот самый Dark/
  // Lamp Room, который нужно смотреть — в итоге стоял к нему спиной
  var hideMid = R.hideFrom === false ? [] : [GEO.tMid];
  var spots = pickSpots("cts:"+S.id+":"+role+":"+nm, c, 3, {rMax:150, minGap:45, see:[lk], hideFrom:hideMid});
  var tag = (role === "anchorA" || role === "anchorB") ? "anchor" : role === "mid" ? "mid" : "set:"+role;
  var spC = spots[weightedPick(spots.length, roundNum*53 + b.id.charCodeAt(2||1))];
  // встал в той самой зоне, куда велено смотреть (роумер в Cave с взглядом
  // "на Cave") — смотрим дальше НАРУЖУ по пути к T, а не себе под ноги/на сайт
  if(spC && lk && Math.hypot(spC.x-lk.x, spC.y-lk.y) < 150){ var ow = outwardLook(spC, lk); if(ow) lk = ow; }
  setPost(b, spC, lk, true, tag);
  if(early && !b._earlyLog){ b._earlyLog = roundNum; }
  if(early && b._earlyLogged !== roundNum){ b._earlyLogged = roundNum; logEvent(b.id+" ("+ROLE_LABEL_CT(role)+"): выход за инфой — "+nm); }
  return true;
}
function ROLE_LABEL_CT(r){ return {anchorA:"опорник A", anchorB:"опорник B", mid:"мидер", rotator:"ротатор", roamer:"роумер"}[r] || r; }
var events = []; var killfeed = []; // объявлены здесь, до loadOppProfile(), которая пишет в лог сразу при старте
var simTime = 0; // тоже нужен logEvent-у при старте
if(typeof OPP !== "undefined" && OPP && OPP.matches) loadOppProfile();
// итог раунда — в память обеих сторон
function rememberRound(winner){
  bots.forEach(function(b){ var A = MEMORY.aggrObs[b.id] || (MEMORY.aggrObs[b.id] = {e:0, r:0}); A.r++; });
  var tt = teamTac.T; if(!tt) return;
  var M = MEMORY.tacMem[tt.tac.id] || (MEMORY.tacMem[tt.tac.id] = {n:0, w:0, plants:0});
  M.n++; if(winner === "T") M.w++; if(bomb && (bomb.state === "planted" || bomb.state === "exploded" || bomb.state === "defused")) M.plants++;
  MEMORY.ctRead.push({A: tt.seenCT.A, B: tt.seenCT.B});
  var cs = teamTac.CT && teamTac.CT.setup;
  if(cs){ var CM = MEMORY.ctSetupMem[cs.id] || (MEMORY.ctSetupMem[cs.id] = {n:0, w:0}); CM.n++; if(winner === "CT") CM.w++; }
  MEMORY.roundHist.push({site: tt.site, planted: !!(bomb && bomb.plantTick && bomb.plantTick >= roundStartTick), winner: winner,
                  execSec: tt.execStart ? (tt.execStart - roundStartTick)/TICK_HZ : null});
}
// ---- любимые углы CT (для T) ----
// ошибки исполнения — в лог не каждую (чтобы не засорять), но видно, что они есть
function noteMistake(b, what){
  b._mistakes = (b._mistakes||0) + 1;
  if(hashRand(tick*3 + b.id.charCodeAt(1)) < 0.35) logEvent(b.id+": ошибка — "+what);
}
// наблюдённая агрессия игрока: сколько раз за раунд он сам лезет в дуэль (по
// сравнению со средним) — копится у соперника за матч и между матчами
function aggrNote(id){ var A = MEMORY.aggrObs[id] || (MEMORY.aggrObs[id] = {e:0, r:0}); A.e++; }
function aggrRate(id){
  var A = MEMORY.aggrObs[id]; if(!A || A.r < 3) return 1;
  var tot = 0, n = 0; for(var k in MEMORY.aggrObs){ if(MEMORY.aggrObs[k].r >= 3){ tot += MEMORY.aggrObs[k].e/MEMORY.aggrObs[k].r; n++; } }
  var avg = n ? tot/n : 1; return avg > 0 ? (A.e/A.r)/avg : 1;
}
function habitAdd(ctId, x, y, w){
  var H = MEMORY.ctHabit[ctId] || (MEMORY.ctHabit[ctId] = {}), k = Math.round(x/48)+","+Math.round(y/48);
  var c = H[k] || (H[k] = {x:0, y:0, n:0}); c.x = (c.x*c.n + x*w)/(c.n + w); c.y = (c.y*c.n + y*w)/(c.n + w); c.n += w;
}
function habitTop(ctId, minN){
  var H = MEMORY.ctHabit[ctId], best = null; if(!H) return null;
  for(var k in H){ if(H[k].n >= (minN||2) && (!best || H[k].n > best.n)) best = H[k]; }
  return best;
}
var roundStartTick = 0;

// ---------- лёркер (план §5: "держит фланг") ----------
// Раньше: в setup ходил маршрутом роумера, а с выхода и до конца раунда стоял
// на одной точке на миде. Теперь это отдельная линия поведения, всё — тихим
// шагом:
//  • setup — тихо уходит на ДРУГОЙ сайт (не тот, куда выход) и стоит в укрытии
//    у его прохода — собирает инфу и оттягивает на себя внимание;
//  • выход — "режет ротацию": идёт следом за CT, которые побегут с этого сайта
//    на помощь, по маршруту проход → позиция опорника → путь ротации, на каждой
//    точке коротко держит угол;
//  • пост-плант — заходит CT в спину: встаёт за их точкой сбора на ретейк.
// маршруты лёркера по названиям зон: на B — через воду к рампе или через
// мид/лампу к кейву; на A — через лестницу к мейну или через мид к донату
var LURK_PLANS = {
  B: [{via:["T Ramp","Tunnel","Water"]}, {via:["Split","Lower Mid","Mid","Triple","T Upper","Lamp Room"], stage:"Dark", entry:"Cave"}],
  A: [{via:["Split","A Stairs"]}, {via:["Split","Lower Mid","Mid","Chamber Lane"], stage:"Donut", entry:"Short"}]
};
function lurkerBrain(b, tt, other){
  var go = GEO[other];
  if(!b._lurkPlan || b._lurkPlan.round !== roundNum || b._lurkPlan.site !== other){
    var opts = LURK_PLANS[other], pi = hashRand(roundNum*733 + matchNum*19) < 0.5 ? 0 : 1, P = opts[pi];
    var st = P.stage ? zonePoint(P.stage, go.tStage) : null, en = P.entry ? zonePoint(P.entry, st || go.tStage) : null;
    b._lurkPlan = {round:roundNum, site:other, via:P.via, stage: st || go.tStage, entry: en || go.tEntry, name: P.stage || "стандарт"};
    startRoute(b, P.via, "lurk"+other+pi);
  }
  var LP = b._lurkPlan;
  if(tt.phase === "setup"){
    // не стоит столбом весь сетап: чередует укрытие и короткий выгляд на
    // проход сайта ("есть ли кто?") — ~5с в укрытии, ~2.5с на выгляде
    var hide = pickSpots("lurkStage"+other+LP.name, LP.stage, 1, {rMax:200, minGap:40, hideFrom:[SITES[other], go.anchor], see:[LP.entry]})[0];
    var peek = walk({x: LP.stage.x + (LP.entry.x-LP.stage.x)*0.6, y: LP.stage.y + (LP.entry.y-LP.stage.y)*0.6});
    if(b._lurkPh === undefined){ b._lurkPh = 0; b._lurkArr = 0; }
    var atPeek = b._lurkPh === 1;
    setPost(b, atPeek ? peek : hide, LP.entry, true, atPeek ? "lurkPeek" : "lurkStage"+other);
    if(b.atPost){
      if(!b._lurkArr) b._lurkArr = tick;
      if(tick - b._lurkArr > (atPeek ? 160 : 320)){ b._lurkPh = 1 - b._lurkPh; b._lurkArr = 0; }
    }
    b._lurkIdx = 0;
    return;
  }
  if(tt.phase === "execute"){
    var route = [LP.entry, go.anchor, GEO.rotator];
    var i = Math.min(b._lurkIdx||0, route.length-1);
    var look = i < route.length-1 ? route[i+1] : GEO[tt.site].ctEntry;
    setPost(b, route[i], look, true, "lurk"+i);
    if(b.atPost){
      if(!b._lurkArr) b._lurkArr = tick;
      if(tick - b._lurkArr > 150 && i < route.length-1){ b._lurkIdx = i+1; b._lurkArr = 0; }
    }
    return;
  }
  if(tt.phase === "postplant"){
    var R = bomb && bomb.retake;
    if(BAL.noLeaks && GEO[tt.site] && GEO[tt.site].ctEntry){ R = {approaches:[GEO[tt.site].ctEntry]}; }
    if(R && R.approaches && R.approaches.length){
      var a = R.approaches[0];
      // за точкой сбора CT, со стороны их спавна — в спину ретейку
      var back = {x: a.x + (a.x-bomb.x)*0.7, y: a.y + (a.y-bomb.y)*0.7};
      var bp = walk(back);
      setPost(b, bp, a, true, "lurkBack");
    } else setPost(b, GEO.rotator, GEO[tt.site].ctEntry, true, "lurkRot");
  }
}
// ---- раздел 12: пробы и подпуши в сетапе ----
// Раньше сетап = "встали на точки и ждём тайминг выхода". Теперь в каждой
// группе (у A, у B, на миде) один игрок играет за инфу: раз в 6–9с выходит
// вперёд — сначала коротким выглядом, потом глубже, до самого входа, "за
// энтри-фрагом" (с флешкой от тиммейта, если есть); и возвращается. Что он
// увидит/кого снимет — читает IGL (соло / стак / минус → выход или перекол).
// куда перетянуть двоих, если подпуш показал "пусто"
var SHIFT_TO = { A: [{pos:"Donut", look:"Short"}, {pos:"Chamber Lane", look:"Top Mid"}],
                 B: [{pos:"Lamp Room", look:"Cave"}, {pos:"T Upper", look:"Lamp Room"}] };
// ---- память смертей T за матч (про меняют паттерн: умер дважды в A Main —
// в третий раз туда иначе или не идут) ----
function tDeathAdd(v){ if(MEMORY.TDEATHS.m !== matchNum) MEMORY.TDEATHS = {m:matchNum, list:[]};
  MEMORY.TDEATHS.list.push({x:v.x, y:v.y, round:roundNum, id:v.id, tag: v.post ? v.post.tag : ""}); }
function tDeathsNear(x, y, r, id){ if(MEMORY.TDEATHS.m !== matchNum) return 0;
  return MEMORY.TDEATHS.list.filter(function(d){ return d.round < roundNum && Math.hypot(d.x-x, d.y-y) < r && (!id || d.id === id); }).length; }
function tDeathSpots(){ return MEMORY.TDEATHS.m === matchNum ? MEMORY.TDEATHS.list.filter(function(d){ return d.round < roundNum; }) : []; }
function tProbes(tt, ts){
  if(tick - roundStartTick < 10*TICK_HZ) return;
  if(tick > tt.execTick - 3*TICK_HZ) return;          // перед выходом — все на местах
  var groups = {};
  ts.forEach(function(b){
    if(!b.post || b.planting || (bomb.state === "carried" && bomb.carrier === b)) return;
    if(/^probePair/.test(b.post.tag)) return; // напарник пробы — не сам проба
    if(b._midFlank && b._midFlank.round === roundNum) return; // заходит через Red Room — не проба
    var m = /^stage(A|B)(:.*)?$/.exec(b.post.tag) || /^probe(.+)$/.exec(b.post.tag);
    var key = b.post.tag === "tmid" ? "M" : m ? (b.post.tag.indexOf("stage") === 0 ? b.post.tag.slice(5) : m[1]) : null;
    if(b._probe && b._probe.key) key = b._probe.key;
    if(!key) return;
    (groups[key] = groups[key] || []).push(b);
  });
  var PRI = {entry:0, support:1, igl:2, awp:3};
  Object.keys(groups).forEach(function(key){
    var gr = groups[key].filter(function(b){ return b.tRole !== "awp" || key !== "M"; }); // AWP на миде держит линию
    if(!gr.length) return;
    // кто пробует — не всегда один и тот же (иначе CT читают "4-й всегда первый
    // на мид"): роль + случайная добавка на раунд; кто уже умирал на этой пробе
    // в этом матче — реже
    var ordK = function(o){ return (PRI[o.tRole]||9) + (BAL.tAdapt ? 1.3*hashRand(roundNum*97 + matchNum*13 + o.id.charCodeAt(1)*7) : 0) + (BAL.tAdapt ? 1.5*tDeathsNear(o.x, o.y, 700, o.id) : 0); };
    gr.sort(function(a,b2){ return ordK(a) - ordK(b2); });
    var pb = gr[0];
    var from, to, look, SI = pb._stageInfo;
    if(key === "M"){ from = GEO.tMid; to = GEO.ctMid; look = GEO.ctMid; }
    else if(SI && key.indexOf(":") > 0){ from = SI.from; to = SI.to; look = SI.look; }  // своя зона сбора (донат, дарк…)
    else { var kk = key.charAt(0); from = GEO[kk].tStage; to = GEO[kk].tEntry; look = GEO[kk].anchor; }
    var P = pb._probe;
    if(!P || P.key !== key || P.round !== roundNum){
      P = pb._probe = {key:key, round:roundNum, ph:0, n:0, until: tick + (4 + 5*hashRand(roundNum*31 + pb.id.charCodeAt(1)))*TICK_HZ, home:{x:pb.post.x, y:pb.post.y}};
    }
    if(P.ph === 0){ // ждёт в укрытии (пост группы уже стоит)
      // на этом выходе только что убили своего — не пикать туда же ещё раз
      if(tick >= P.until && picEvents("T").some(function(sg){ return sg.type === "died" && tick - sg.tick < 10*TICK_HZ && Math.hypot(sg.x-to.x, sg.y-to.y) < 400; })){ P.until = tick + 6*TICK_HZ; return; }
      // адаптация: здесь в этом матче уже умирали ≥2 раз — на сухую не пикаем
      if(tick >= P.until && BAL.tAdapt && tDeathsNear(to.x, to.y, 450) >= 2){
        var hasU = ts.some(function(o){ return Math.hypot(o.x-pb.x, o.y-pb.y) < 500 && o.nades && (o.nades.flash > 0 || o.nades.smoke > 0); });
        if(!hasU){ P.until = tick + 30*TICK_HZ; if(!tt["_ad"+key]){ tt["_ad"+key] = true; logEvent("T: на «"+(zoneUserName(zoneIdAt(to.x, to.y)) || key)+"» уже умирали "+tDeathsNear(to.x, to.y, 450)+" раза — без гранат туда не пикаем"); } return; }
        P.needUtil = true;
      }
      if(tick >= P.until){ P.ph = 1; P.n++; P.since = tick;
        // напарник: второй встаёт в 1–2с позади и держит тот же угол — если
        // пробу снимут, он первый на размен
        if(BAL.pairs){
          var bud = ts.filter(function(o){ return o !== pb && o.alive && o.tRole !== "lurker" && !(bomb.state === "carried" && bomb.carrier === o) &&
            !taskOn(o, "probe") && Math.hypot(o.x-pb.x, o.y-pb.y) < 500; })
            .sort(function(a, c){ return Math.hypot(a.x-pb.x, a.y-pb.y) - Math.hypot(c.x-pb.x, c.y-pb.y); })[0];
          P.buddy = bud ? bud.id : null;
        }
        // гранаты под пробу: флешка от напарника/тиммейта (на мид — смок на линию
        // CT, если флешки нет); раньше — только на глубокую пробу, чаще на сухую
        if(BAL.probeUtil && !antiEco("T")){
          var uFp = {x: to.x + (look.x-to.x)*0.3, y: to.y + (look.y-to.y)*0.3};
          var uFl = ts.filter(function(o){ return o !== pb && !o.nadeTask && o.nades && o.nades.flash > 0 && Math.hypot(o.x-pb.x, o.y-pb.y) < 500; })[0];
          var uSm = ts.filter(function(o){ return !o.nadeTask && o.nades && o.nades.smoke > 0 && Math.hypot(o.x-pb.x, o.y-pb.y) < 600; })[0];
          if(uFl && (P.needUtil || P.n === 1 || hashRand(tick + 3) < 0.6)){ assignNade(uFl, "flash", uFp, "под пробу", {now:true}); P.util = "flash"; }
          else if(uSm && (key === "M" || P.needUtil) && tSmokeReserveOk()){ var smP = {x: to.x + (look.x-to.x)*0.5, y: to.y + (look.y-to.y)*0.5}; if(assignNade(uSm, "smoke", smP, "смок под пробу", {now:true})) P.util = "smoke"; }
        }
        // со второго раза — глубже, за фрагом, но только парой (есть кому
        // разменять) и если по инфе там не стак
        var mate = ts.some(function(o){ return o !== pb && Math.hypot(o.x-pb.x, o.y-pb.y) < 380; });
        var eP = intelEstimate("T", to.x, to.y, 450, 6*TICK_HZ);
        P.deep = P.n >= 2 && mate && eP.n <= 1;
        var f = P.deep ? 0.95 : 0.6;
        P.pt = walk({x: from.x + (to.x-from.x)*f, y: from.y + (to.y-from.y)*f});
        // не "60% пути", а до первого места, откуда ВИДНО, что там дальше
        // (опорника/вход) — иначе подпуш кончался за углом и колл был "пусто"
        if(!P.deep){ var vp = probeViewPoint(from, to, look); if(vp) P.pt = vp; }
        if(P.deep){
          voiceLog("T", "probe"+key+pb.id, pb.id, "подпушу "+(key === "M" ? "мид" : (zoneUserName(zoneIdAt(to.x, to.y)) || key.charAt(0)))+", посмотрю, сколько их там");
          // флешка под подпуш от ближайшего тиммейта (не вся раскидка — одна)
          var fl = ts.filter(function(o){ return o !== pb && !o.nadeTask && o.nades && o.nades.flash > 0 && Math.hypot(o.x-pb.x, o.y-pb.y) < 500; })[0];
          if(fl && BAL.tUtil && !antiEco("T")){ var fp = {x: to.x + (look.x-to.x)*0.3, y: to.y + (look.y-to.y)*0.3}; assignNade(fl, "flash", fp, "под подпуш", {now:true}); }
        }
      }
      return;
    }
    // выход вперёд / на вход
    setPost(pb, P.pt, look, true, "probe"+key);
    holdTask(pb, "probe", tick+1);
    // напарник — ~150px позади пробы по той же линии, смотрит туда же
    if(BAL.pairs && P.buddy){
      var bu = ts.filter(function(o){ return o.id === P.buddy; })[0];
      if(bu && !bu._sawEnemy && !taskOn(bu, "tradeR")){
        var ln = Math.hypot(P.pt.x-from.x, P.pt.y-from.y) || 1, back = Math.min(150, ln*0.6);
        var bp = walk({x: P.pt.x + (from.x-P.pt.x)/ln*back, y: P.pt.y + (from.y-P.pt.y)/ln*back});
        setPost(bu, bp, look, true, "probePair"+key); holdTask(bu, "probe", tick+1);
      }
    }
    // выглянул — и назад: проба не стоит в открытую (джиггл, а не холд)
    var stay = P.deep ? 1.5*TICK_HZ : 0.8*TICK_HZ;
    if(pb._sawEnemy && !P.saw){ P.saw = tick; }
    if(P.saw && tick - P.saw > 0.6*TICK_HZ && !pb._sawEnemy) stay = 0; // увидел, дал инфу — уходит
    if(pb.atPost && !P.saw && !P.cleared && tick - (P.at || tick) > stay){
      P.cleared = true;
      var enN = intelEstimate("T", to.x, to.y, 450, 6*TICK_HZ).n;
      if(enN === 0){
        markClear("T", P.pt.x, P.pt.y, pb.id);
        // там пусто — двое из этой группы идут брать контроль в другом месте,
        // пока до выхода есть время (потом зайдут на сайт уже оттуда)
        var tt2 = teamTac.T, SH = SHIFT_TO[key.charAt(0)];
        if(BAL.shiftOnClear && SH && tt2 && tt2.phase === "setup" && tt2.execTick - tick > 10*TICK_HZ && !tt2["_sh"+key]){
          tt2["_sh"+key] = true;
          var movers = ts.filter(function(o){ return o !== pb && o.alive && o.post && o.post.tag.indexOf("stage"+key.charAt(0)) === 0 &&
            !(bomb.state === "carried" && bomb.carrier === o) && o.tRole !== "awp"; }).slice(0, 2);
          movers.forEach(function(o, oi){
            var zn = SH[oi % SH.length], pt = zonePoint(zn.pos, o), lk = zonePoint(zn.look, pt);
            if(!pt) return;
            o._shift = {round:roundNum, pt:pt, look:lk || GEO[key.charAt(0)].anchor, name:zn.pos};
            voiceLog("T", "sh"+o.id, o.id, "там пусто — иду на "+zn.pos);
          });
        }
      }
    }
    if((pb.atPost && tick - (P.at || (P.at = tick)) > stay) || tick - P.since > 9*TICK_HZ){
      P.ph = 0; P.cleared = false; P.at = 0; P.saw = 0; P.until = tick + (6 + 3*hashRand(tick + pb.id.charCodeAt(1)))*TICK_HZ;
      dropTask(pb, "probe"); pb.post = null; // вернётся на пост группы со следующего тика
    }
    if(!pb.atPost) P.at = 0;
  });
}
function probeViewPoint(from, to, look){
  // точки пути from→to; выглядываем не раньше ~55% пути и только там, откуда
  // видно и вход, и дальнюю точку (опорника/сайт) — "дошёл до угла, где видно"
  var wp = buildWaypointPath(from.x, from.y, 0, to.x, to.y, 0), pts = [{x:from.x, y:from.y}];
  wp.forEach(function(w){ pts.push({x:w[0], y:w[1]}); });
  var tot = 0; for(var i=1;i<pts.length;i++) tot += Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y);
  if(tot < 60) return null;
  var cum = 0;
  for(var j=1;j<pts.length;j++){
    var A = pts[j-1], B = pts[j], L = Math.hypot(B.x-A.x, B.y-A.y), n = Math.max(1, Math.ceil(L/35));
    for(var k=1;k<=n;k++){
      var p = {x: A.x + (B.x-A.x)*k/n, y: A.y + (B.y-A.y)*k/n}, c = cum + L*k/n;
      if(c < 0.55*tot) continue;
      if(hasVision(p.x, p.y, look.x, look.y) && hasVision(p.x, p.y, to.x, to.y))
        return walk({x: p.x + (B.x-A.x)/Math.max(1,L)*30, y: p.y + (B.y-A.y)/Math.max(1,L)*30});
    }
    cum += L;
  }
  return walk({x: from.x + (to.x-from.x)*0.9, y: from.y + (to.y-from.y)*0.9});
}
// ---- "проверено — пусто": пишется в картину команды (LAST_CLEAR + карта вероятностей) ----
function markClear(team, x, y, who){
  var zid = zoneIdAt(x, y); if(!zid) return null;
  var zi = bzOf(x, y); if(zi >= 0) (LAST_CLEAR[team] || (LAST_CLEAR[team] = {}))[zi] = tick;
  beliefClearAt(team, x, y);
  voiceLog(team, "clz"+zid, who, "чекнул "+(zoneUserName(zid) || calloutName(x, y))+" — пусто");
  return zid;
}
// IGL не идеален: примерно в четверти случаев повод для колла (соло, пустой
// сайт, стак) он пропускает — решение принимается один раз на повод за раунд
function iglReads(tt, kind){
  var k = "_ir"+kind; if(tt[k] === undefined) tt[k] = hashRand(roundNum*131 + matchNum*17 + kind.charCodeAt(0)*7) >= (BAL.iglErr||0);
  if(!tt[k] && !tt[k+"log"]){ tt[k+"log"] = true; logEvent("IGL: не среагировал на инфу ("+({po:"пустой сайт", st:"стак", so:"соло"})[kind]+") — играем по плану"); }
  return tt[k];
}
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
        voiceLog("T", "rpfast", "IGL", "их игрок "+calloutName(last.kx, last.ky)+" — на "+tt.site+" без него, заходим раньше!");
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
        voiceLog("T", "upslow", "IGL", aliveT+" на "+aliveCT+" — не спешим, берём карту и заходим все вместе");
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
      voiceLog("T", "regroup", "IGL", "минус два — "+(lk ? lk.id+" к нам, " : "")+"заходим все вместе");
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
          voiceLog("T", "rotread", "IGL", toward.length+" CT ротируют на "+tt.site+" — идём на "+other+", но углы чекаем, там может кто-то остаться");
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
      var otherB = beliefCount("T", BZ.siteNear[other]||[]);
      var ctr = {x:0, y:0}, tsA = bots.filter(function(b){ return b.team === "T" && b.alive; });
      tsA.forEach(function(b){ ctr.x += b.x/tsA.length; ctr.y += b.y/tsA.length; });
      var travel = Math.hypot(ctr.x-SITES[other].x, ctr.y-SITES[other].y)*1.4/SPEED;
      var goOther = otherB < 1.2 && secLeft > travel + 15;
      tsA.forEach(function(b){ b._route = null; b._routeDone = null; b._stageInfo = null; });
      tt.takeAssign = null; tt.plantPick = null; tt.wave2 = null; tt.w1Contact = null; tt._popDone = false; tt._waitLog = false;
      nadeFlags.tExec = false; nadeFlags.tExecSm = false; nadeFlags.peekFlashPlanned = false;
      if(goOther){
        tt.site = other; tt.phase = "setup"; tt.execStart = null; tt.execTick = tick + Math.round(Math.min(travel*0.8, 14)*TICK_HZ);
        voiceLog("T", "abort", "IGL", "выход не прошёл — отходим, все на "+other+"!");
        logEvent("IGL: выход провалился ("+tD+" наших против "+cD+") — отход, перекол на "+other);
      } else {
        tt.phase = "setup"; tt.execStart = null; tt.execTick = tick + 6*TICK_HZ;
        voiceLog("T", "abort", "IGL", "стоп, отходим — перегруппируемся и заходим вместе");
        logEvent("IGL: выход провалился ("+tD+" наших против "+cD+") — отход и повторный заход на "+tt.site);
      }
      return true;
    }
  }
  return false;
}
