// ---------- тактики T (IGL выбирает под тип раунда) ----------
// Тактики T. groups — кто каким маршрутом (названия зон) идёт и где ждёт выхода:
//   via   — зоны по порядку (маршрут), stage — зона сбора (нет — стандартный
//   подход к сайту), look — куда смотреть/выходить оттуда; "TMID" — мид со
//   стороны T. rushVia — маршрут раша. Названия — из слоя «зоны».
var T_TACTICS = MAP.tactics.tTactics;
var tSiteHist = []; // раздел 12: куда T реально выходили по раундам (для стака CT)
var teamTac = { T: null, CT: {call:null} };
var siteHeatPending = {};
var siteHeat = {A:1, B:1}; // CT "запоминают", куда T чаще выходят в этом матче
var lastTacticId = null;
// ======================= РАЗДЕЛ 13 (п.1–5): АДАПТАЦИЯ ВНУТРИ МАТЧА =======================
// Всё — только по событиям текущего матча, сбрасывается с новым матчем.
//   tacMem   — IGL T: сколько раз сыграна тактика, победы, планты
//   ctRead   — что T видели в начале раунда: сколько CT было на A и на B
//   roundHist— итоги раундов для CT: куда шли T, был ли плант, кто выиграл, когда выход
//   ctHabit  — любимые углы конкретных CT (по месту): где их видели стоящими / где убили
// (v270) Это знание о том, как играет ЭТА команда за T против ЭТОЙ за CT. После смены
// сторон расклад другой — память откладывается в MEM_BOX под ключом «кто был за T» и
// достаётся, когда расклад вернётся (овертайм). Во второй половине основного времени
// новый расклад начинается с нуля (+ профиль соперника по этому раскладу) — как у живых
// команд: за эту сторону против этого соперника в матче ещё не играли. Заменяет halfReview.
var tacMem = {}, ctRead = [], roundHist = [], ctHabit = {}, tacHist = [], ctSetupHist = [], ctSetupMem = {};
var MEM_BOX = {};
function memSnapshot(){ return {tacMem:tacMem, ctRead:ctRead, roundHist:roundHist, ctHabit:ctHabit, tacHist:tacHist, ctSetupHist:ctSetupHist, ctSetupMem:ctSetupMem,
  aggrObs:aggrObs, siteHeat:siteHeat, tSiteHist:tSiteHist, RMEM:RMEM, nadeLandHistory:nadeLandHistory, lastTacticId:lastTacticId}; }
function memRestore(M){ tacMem = M.tacMem; ctRead = M.ctRead; roundHist = M.roundHist; ctHabit = M.ctHabit; tacHist = M.tacHist; ctSetupHist = M.ctSetupHist; ctSetupMem = M.ctSetupMem;
  aggrObs = M.aggrObs; siteHeat = M.siteHeat; tSiteHist = M.tSiteHist; RMEM = M.RMEM; nadeLandHistory = M.nadeLandHistory; lastTacticId = M.lastTacticId; }
// новый расклад: пустая память + профиль соперника по этому раскладу
function memStart(){
  siteHeat = {A:1, B:1}; tSiteHist = []; RMEM = {awp:[], aggro:[], rush:[], midDeath:[]}; nadeLandHistory = {A:[], B:[]}; lastTacticId = null;
  tacMem = {}; ctRead = []; roundHist = []; ctHabit = {}; tacHist = []; ctSetupHist = []; ctSetupMem = {}; aggrObs = {}; loadOppProfile();
}
function resetMatchMemory(){ MEM_BOX = {}; bots.forEach(function(b){ b._mistakes = 0; }); memStart(); }
// Профиль соперника: что команды выучили друг о друге за матч (тактики, что
// сработало у CT, любимые углы каждого игрока, кто как агрессивен) — сохраняется
// в конце матча; следующий матч стартует с этим знанием (вес половинный, дальше
// уточняется уже по новому матчу). Хранится в браузере и в «Экспорт проекта».
// (v270) По раскладам: OPP.by[кто был за T]. Старый профиль (без by) — расклад «Spirit за T».
var OPP_KEY = MAP.store + "-opp-v1", OPP = null;
try{ OPP = JSON.parse(localStorage.getItem(OPP_KEY)||"null"); }catch(e){}
function oppNorm(){ if(OPP && !OPP.by) OPP = OPP.matches ? {by:{sp:OPP}} : null; return OPP; }
function oppFor(key){ oppNorm(); return OPP && OPP.by[key] && OPP.by[key].matches ? OPP.by[key] : null; }
function saveOppProfile(){
  if(!BAL.oppProfile) return;
  oppNorm(); if(!OPP) OPP = {by:{}};
  var mergeCnt = function(dst, src, keys){ for(var k in src){ var d = dst[k] || (dst[k] = {}); keys.forEach(function(f){ d[f] = (d[f]||0)*0.5 + (src[k][f]||0); }); } };
  var saved = [];
  ["sp","fa"].forEach(function(key){
    var M = key === SIDE_TEAM.T ? memSnapshot() : MEM_BOX[key]; if(!M) return;
    var P = OPP.by[key] || (OPP.by[key] = {matches:0, tacMem:{}, ctSetupMem:{}, habit:{}, aggr:{}});
    mergeCnt(P.tacMem, M.tacMem, ["n","w","plants"]);
    mergeCnt(P.ctSetupMem, M.ctSetupMem, ["n","w"]);
    mergeCnt(P.aggr, M.aggrObs, ["e","r"]);
    for(var id in M.ctHabit){ var H = P.habit[id] || (P.habit[id] = {}); for(var c in M.ctHabit[id]){ var h = M.ctHabit[id][c], o = H[c];
      if(o){ o.x = (o.x*o.n*0.5 + h.x*h.n)/(o.n*0.5 + h.n); o.y = (o.y*o.n*0.5 + h.y*h.n)/(o.n*0.5 + h.n); o.n = o.n*0.5 + h.n; } else H[c] = {x:h.x, y:h.y, n:h.n}; } }
    P.matches++; saved.push(LINEUP[key].name+" за T — матчей "+P.matches);
  });
  try{ localStorage.setItem(OPP_KEY, JSON.stringify(OPP)); }catch(e){}
  logEvent("Профиль соперника обновлён ("+saved.join("; ")+")");
}
function loadOppProfile(){
  var P = BAL.oppProfile ? oppFor(SIDE_TEAM.T) : null; if(!P) return;
  var cp = function(src, keys, k0){ var r = {}; for(var k in src){ r[k] = {}; keys.forEach(function(f){ r[k][f] = (src[k][f]||0)*k0; }); } return r; };
  tacMem = cp(P.tacMem, ["n","w","plants"], 0.5);
  ctSetupMem = cp(P.ctSetupMem, ["n","w"], 0.5);
  aggrObs = cp(P.aggr, ["e","r"], 0.5);
  ctHabit = {}; for(var id in P.habit){ ctHabit[id] = {}; for(var c in P.habit[id]){ var h = P.habit[id][c]; ctHabit[id][c] = {x:h.x, y:h.y, n:h.n*0.5}; } }
  logEvent("Профиль соперника загружен ("+LINEUP[SIDE_TEAM.T].name+" за T, матчей: "+P.matches+") — IGL и CT стартуют с поправкой на привычки");
}
function weightedChoice(items, weights, seed){
  var tot = weights.reduce(function(a, w){ return a + Math.max(0, w); }, 0), r = hashRand(seed)*tot, acc = 0;
  for(var i=0;i<items.length;i++){ acc += Math.max(0, weights[i]); if(r < acc) return i; }
  return items.length - 1;
}
// ---- IGL: чтение CT по прошлым раундам ----
function readCT(){
  var last = ctRead.slice(-3), out = {stack:null, n:0, of:last.length};
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
  if(!BAL.timeouts) return;
  ["CT","T"].forEach(function(team){
    var T0 = TOUT[team];
    if(team === winner){ T0.streak = 0; return; }
    T0.streak++;
    if(T0.streak >= 3 && T0.left > 0 && roundNum !== HALF_ROUNDS && roundState !== "matchover"){
      T0.left--; T0.streak = 0; T0.until = roundNum + 4;
      T0.avoid = team === "T" ? tacHist.slice(-3) : ctSetupHist.slice(-3);
      var names = team === "T" ? T0.avoid.map(function(id){ var t = T_TACTICS.filter(function(x){ return x.id === id; })[0]; return t ? t.name : id; })
                               : T0.avoid.map(function(id){ var t = CT_SETUPS.filter(function(x){ return x.id === id; })[0]; return t ? t.name : id; });
      logEvent("ТАЙМ-АУТ "+team+" — три поражения подряд. "+(team === "T" ? "IGL: не повторяем «"+names.join("», «")+"»" : "CT: меняем расстановку, уходим от «"+names.join("», «")+"»")+" (осталось тайм-аутов: "+T0.left+")", true);
    }
  });
}
function chooseTactic(){
  var type = teamEco.T.roundType;
  var pool = T_TACTICS.filter(function(t){ return t.pools.indexOf(type) >= 0; });
  var rd = readCT(), readTxt = null;
  var tempoRead = null;
  if(BAL.tempoShift){ var lastT = roundHist.slice(-2);
    if(lastT.length === 2 && lastT.every(function(r){ return r.winner === "CT"; })){
      var fast = lastT.every(function(r){ return r.execSec != null && r.execSec < 32; }), slow = lastT.every(function(r){ return r.execSec == null || r.execSec >= 45; });
      tempoRead = fast ? "slow" : (slow ? "fast" : null); } }
  var weights = pool.map(function(t){
    var M = tacMem[t.id] || {n:0, w:0};
    var w = 0.5 + 1.5*((M.w + 1)/(M.n + 2));             // удачные всплывают, проваленные тонут
    if(t.style === "split") w *= 1.6;                    // заходы с двух сторон — чаще
    if(t.weight) w *= t.weight;                          // своя частота тактики из набора карты (Ancient: кейв на B ×1.5 — не забывать)
    var l1 = tacHist[tacHist.length-1], l2 = tacHist[tacHist.length-2];
    if(l1 === t.id) w *= 0.35;                          // только что играли
    if(l1 === t.id && l2 === t.id) w *= 0.1;            // третий раз подряд — прочитана
    if(BAL.timeouts && roundNum <= TOUT.T.until){ if(TOUT.T.avoid.indexOf(t.id) >= 0) w *= 0.15; else w *= 1.3; } // после тайм-аута
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
  if(BAL.proTempo){
    var RP = {pistol:0.20, eco:0.25, force:0.08, half:0, full:0}[type] || 0;
    var rW = 0, nW = 0; pool.forEach(function(t, i){ if(t.style === "rush") rW += weights[i]; else nW += weights[i]; });
    if(rW > 0 && nW > 0){ var kR = RP > 0 ? (RP/(1-RP))*nW/rW : 0; pool.forEach(function(t, i){ if(t.style === "rush") weights[i] *= kR; }); }
  }
  var tac = pool[weightedChoice(pool, weights, roundNum*7919 + matchNum*104729 + 17)];
  lastTacticId = tac.id; tacHist.push(tac.id);
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
  if(BAL.proTempo && tac.setupEnd > 0){
    // время планта — из распределения про (QY ниже),
    // выход ~12с до планта (у ботов от выхода до планта 10–15с); стиль тактики сдвигает: выходы раньше, дефолт/фейк позже
    var u = hashRand(roundNum*6271 + matchNum*353 + 29);
    if(tempoRead === "slow") u = 0.5 + 0.5*u; else if(tempoRead === "fast") u = 0.5*u;
    var bias = {exec:[0, 0.8], split:[0.05, 0.9], fake:[0.25, 0.75], "default":[0.3, 0.7], fast:[0, 0.3]}[tac.style] || [0, 1];
    u = bias[0] + bias[1]*u;
    // (v269) план — по раундам про, где до 30-й секунды никого не убили (450 плантов, tools/measure/plan_bake.py): это темп
    // «без помех»; ускоряют его уже события раунда (минус на сайте, соло, ротация — ниже). Раньше бралось распределение
    // всех плантов (34/44/66/88/100 с), где ранние фраги уже ускорили выход, — ускорение считалось дважды: у ботов в тихих
    // раундах плант на 64,6-й с против 75,8-й у про, после 75-й с — 28 % против 51 %
    var QX = [0, 0.10, 0.25, 0.50, 0.75, 0.90, 1], QY = [21, 43, 54, 76, 95, 106, 115], pT = QY[QY.length-1];
    for(var qi = 1; qi < QX.length; qi++){ if(u <= QX[qi]){ pT = QY[qi-1] + (QY[qi]-QY[qi-1])*(u-QX[qi-1])/(QX[qi]-QX[qi-1]); break; } }
    setupSec = Math.round(Math.max(tac.setupEnd*0.6, Math.min(ROUND_TIME_SEC - 26, pT - 12)));
    tmode = setupSec < tac.setupEnd - 6 ? ", быстрый" : (setupSec > tac.setupEnd + 8 ? ", поздний" : "");
    // длинный сетап: сначала дефолт (контроль карты), свою расстановку тактика
    // занимает за столько же секунд до выхода, сколько ей нужно было с начала раунда
    // (v440, замер группы 3: у «дефолтов» фаза дефолта не включалась — их setupEnd 68–91 с и есть поздний выход, need ≈ весь сетап, и группа
    // с первой секунды стояла на точке выхода: Connector 0,53 игрока против 0,04 у про) у тактики-дефолта своя расстановка — это точка выхода
    // рядом с картой, занимают её за 14 с до выхода (проектное число, как нижняя граница need)
    var need = tac.style === "default" ? 14 : Math.max(14, tac.setupEnd - 6);
    if(setupSec - need >= 12) defUntil = roundStartTick + (setupSec - need)*64;
  }
  teamTac.T = {tac:tac, site:tac.site, phase: tac.setupEnd > 0 ? "setup" : "execute", execTick: roundStartTick + setupSec*64, defUntil: defUntil, minExec: (BAL.proTempo && tac.setupEnd > 0) ? Math.min(setupSec, 30) : 0, needT: (BAL.proTempo && tac.setupEnd > 0) ? Math.max(14, tac.setupEnd - 6) : 0,
               execStart: tac.setupEnd > 0 ? null : tick, // раш: выход сразу — отсчёт задержек ролей с начала раунда
               read: readTxt, seenCT:{A:0, B:0}, setupSec:setupSec};
  var M = tacMem[tac.id];
  var igl = bots.filter(function(b){ return b.team==="T" && b.tRole==="igl"; })[0];
  if(readTxt) logEvent("IGL "+(igl?igl.id:"T")+": "+readTxt);
  logEvent("IGL "+(igl?igl.id:"T")+": тактика «"+tac.name+"» ("+ROUND_TYPE_LABEL[type]+(tac.setupEnd?", выход на "+setupSec+"с"+tmode:", сразу")+
    (M && M.n ? ", в этом матче "+M.w+"/"+M.n : "")+")");
  chooseCtSetup();
}
