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
var STACK_K = 0.75;   // В142: шансы выхода на сайт, где CT стакали 2 из 3 прошлых раундов, — у про ×0,75 (демки Mirage, 262 выхода)
function readCT(){
  var last = ctRead.slice(-3), out = {stack:null, n:0, of:last.length};
  // "стак" — видели у сайта 2+ CT и больше, чем у другого, в 2 из 3 последних раундов
  ["A","B"].forEach(function(k){ var o = k === "A" ? "B" : "A"; var n = last.filter(function(r){ return r[k] >= 2 && r[k] > r[o]; }).length; if(n >= 2 && n > out.n){ out.stack = k; out.n = n; } });
  return out;
}
// ---- тактические паузы (v460, владелец 28.10) ----
// Регламент турниров CS2 (SwitzerLAN, docs/PRO_PLAY.md): у команды 3 паузы по 30 с за основное время; в овертайме оставшиеся
// сгорают, на каждый овертайм — 1. Демки Ancient (tools/timeout_demos.py, 92 демки): ~3,65 паузы на карту на обе команды;
// команда, проигравшая раунд перед паузой, берёт следующий в 57 % (190 из 336).
// Берёт проигравшая раунд команда — тренер (чаще) или IGL — по тому, что видела команда: серия поражений, проиграли клатч соперника,
// соперник близко к победе; последнюю паузу держат на конец половины (правила и доли — проектные, timeoutWant).
// Пауза = закупка дольше на TO_SEC и план тренера (coachPlan) на TO_PLAN_ROUNDS раунда — только из того, что видела команда:
// где CT стакают / куда ходят T, какие тактики и расстановки провалились, где мы умираем; заготовка — тактика, которую в этом
// матче ещё не играли, на первый раунд после паузы. Показ паузы — 676_timeout_show.js (только показ).
var TO_SEC = 30, TO_PLAN_ROUNDS = 3;
var TOUT = {CT:{left:3, streak:0, until:0, avoid:[], plan:null}, T:{left:3, streak:0, until:0, avoid:[], plan:null}};
var TO_NOW = null, TO_LAST = null, TO_FORCE = false, TO_DEATHS = {CT:[], T:[]};
function timeoutsReset(){ TOUT = {CT:{left:3, streak:0, until:0, avoid:[], plan:null}, T:{left:3, streak:0, until:0, avoid:[], plan:null}}; TO_NOW = null; TO_DEATHS = {CT:[], T:[]}; }
function timeoutCheck(winner){
  if(!BAL.timeouts) return;
  TO_NOW = null;
  var nx = roundNum + 1;
  // перед первым раундом каждого овертайма — ровно одна пауза у каждой команды (оставшиеся сгорают)
  if(BAL.overtime && nx > regRounds() && (nx - regRounds() - 1) % (OT_HALF*2) === 0) ["CT","T"].forEach(function(s){ TOUT[s].left = 1; });
  // где умирали в этом раунде (зоны) — тренер видит это по своей команде
  ["CT","T"].forEach(function(s){ TO_DEATHS[s].push(bots.filter(function(b){ return b.team === s && !b.alive; }).map(function(b){ var zid = zoneIdAt3(b.x, b.y, b.z); return (zid && zoneMainName(ZONE_NAMES[zid])) || "?"; }));
    if(TO_DEATHS[s].length > 6) TO_DEATHS[s].shift(); });
  ["CT","T"].forEach(function(s){ if(s === winner) TOUT[s].streak = 0; else TOUT[s].streak++; });
  if(!winner || matchOverWith(roundNum, score.CT, score.T) || sideSwapNow(nx)) return;   // конец матча / перерыв между половинами
  var side = winner === "CT" ? "T" : "CT", L = TOUT[side];
  var why = TO_FORCE ? "manual" : timeoutWant(side, winner);
  if(!why) return;
  if(L.left <= 0){ if(TO_FORCE) logEvent("Пауза не взята: у "+TEAM_NAME[side]+" пауз не осталось"); TO_FORCE = false; return; }
  TO_FORCE = false;
  L.left--; L.streak = 0; L.until = roundNum + TO_PLAN_ROUNDS;
  var plan = coachPlan(side);
  L.avoid = plan.avoid; L.plan = plan; plan.first = nx;
  var caller = hashRand(roundNum*31 + matchNum*7 + 5) < 0.75 ? "coach" : "igl";
  TO_NOW = TO_LAST = {side: side, team: SIDE_TEAM[side], name: TEAM_NAME[side], caller: caller, plan: plan, round: nx, why: why, left: L.left,
    score: {CT: score.CT, T: score.T}, m: matchNum};
  logEvent("ТАКТИЧЕСКАЯ ПАУЗА — "+TEAM_NAME[side]+" ("+side+", "+(caller === "coach" ? "тренер" : "IGL")+", осталось "+L.left+"): "+plan.facts.map(function(f){ return f.log; }).join("; "), true);
}
// брать ли паузу проигравшей раунд стороне: причина или null (проектные правила; доля пауз на карту — сверка с демками)
function timeoutWant(side, winner){
  var L = TOUT[side], mine = score[side], theirs = score[winner];
  var u = hashRand(roundNum*7919 + matchNum*131 + (side === "CT" ? 1 : 2));
  var clutchLost = !!(clutchInfo && clutchInfo.team === winner && clutchInfo.n >= 2);
  var reg = roundNum < regRounds(), inHalf = reg ? ((roundNum - 1) % HALF_ROUNDS) + 1 : 0;
  var reserve = reg && L.left === 1 && inHalf < HALF_ROUNDS - 3;          // последнюю — на конец половины
  var danger = reg ? (theirs >= MATCH_WIN - 3 && theirs > mine) : theirs > mine;
  if(L.streak >= 4) return "streak";
  if(reserve) return clutchLost && u < 0.5 ? "clutch" : null;
  if(L.streak >= 3) return "streak";
  if(clutchLost && u < 0.4) return "clutch";
  if(danger && L.streak >= 2 && u < 0.5) return "danger";
  return null;   // (v461) «2 поражения — иногда» убрано: пауз было 4,9 на матч при 3,65 у про
}
function tacUsesZone(t, z){ return (t.groups || []).some(function(g){ return g.stage === z || (g.via || []).indexOf(z) >= 0; }); }
function setupUsesZone(S, z){ return !!S.roles && Object.keys(S.roles).some(function(r){ return (S.roles[r].pos || []).indexOf(z) >= 0; }); }
function tacById(id){ return T_TACTICS.filter(function(x){ return x.id === id; })[0] || null; }
function setupById(id){ return CT_SETUPS.filter(function(x){ return x.id === id; })[0] || null; }
// план тренера: факты (что видела команда) → что делаем. Каждый факт — с числами, из них же строится речь на паузе (676)
function coachPlan(side){
  var P = {side: side, avoid: [], site: null, stack: null, retake: null, excl: null, facts: []};
  var D = TO_DEATHS[side].slice(-4), cnt = {};
  D.forEach(function(r){ r.forEach(function(z){ if(z && z !== "?") cnt[z] = (cnt[z]||0) + 1; }); });
  var dz = Object.keys(cnt).sort(function(a, b){ return cnt[b] - cnt[a]; })[0];
  // (v461) где умираем — эти раунды туда не идём: T — тактики, чей путь или стадия через эту зону, реже; CT — расстановки с позицией там
  if(dz && cnt[dz] >= 3){ P.avoidZone = dz; P.facts.push({k: "deaths", zone: dz, n: cnt[dz], of: D.length, log: "умираем на «"+dz+"» ("+cnt[dz]+" за "+D.length+" р.) — обходим"}); }
  if(side === "T"){
    var failed = tacHist.slice(-3).filter(function(id, i, a){ var M = tacMem[id]; return a.indexOf(id) === i && M && M.n >= 1 && M.w/M.n < 0.5; });
    P.avoid = failed.slice();
    if(failed.length){ var tf = tacById(failed[failed.length-1]); P.facts.push({k: "failed", tac: tf ? tf.name : failed[0], log: "не заходит «"+(tf ? tf.name : failed[0])+"»"}); }
    var rd = readCT();
    // (В142, v576) стак — факт для команды, а не план сайта: про после стака почти не уходят с сайта (см. STACK_K); сайт плана — только «слабый сайт» ниже
    if(rd.stack){ P.stack = rd.stack; P.facts.push({k: "stackRead", S: rd.stack, n: rd.n, of: rd.of, log: "CT стакают "+rd.stack+" ("+rd.n+" из "+rd.of+")"}); }
    else {
      var last = ctRead.slice(-4), seen = {A: 0, B: 0}; last.forEach(function(r){ seen.A += r.A||0; seen.B += r.B||0; });
      // разница в одного — не основание
      if(last.length >= 2 && Math.abs(seen.A - seen.B) >= 2){ P.site = seen.A < seen.B ? "A" : "B"; P.facts.push({k: "weakSite", T: P.site, a: seen.A, b: seen.B, of: last.length, log: "на "+P.site+" видели меньше CT ("+seen.A+" против "+seen.B+" за "+last.length+" р.)"}); }
    }
    // заготовка: тактика на сайт плана (или любой), которую в этом матче ещё не играли
    // (v461) заготовка: тактика на сайт плана, которую в этой половине ещё не играли; из них — та, что против этого соперника
    // заходила в прошлых матчах (tacMem с профилем соперника OPP.by); нет такой — ещё ни разу не игранная
    var played = {}; tacHist.forEach(function(id){ played[id] = 1; });
    var pool = T_TACTICS.filter(function(t){ return t.style !== "fake" && (!P.site || t.site === P.site) && !played[t.id] && P.avoid.indexOf(t.id) < 0 && !(P.avoidZone && tacUsesZone(t, P.avoidZone)); });
    var rate = function(t){ var M = tacMem[t.id]; return M && M.n >= 1 ? (M.w + 1)/(M.n + 2) : 0.5; };
    if(pool.length){ var best = -1, ex = null;
      pool.forEach(function(t, i){ var v = rate(t) + hashRand(roundNum*577 + matchNum*41 + i)*0.01; if(v > best){ best = v; ex = t; } });
      var EM = tacMem[ex.id], prof = !!(EM && EM.n >= 1 && EM.w/EM.n >= 0.5);
      P.excl = ex.id; P.facts.push({k: prof ? "exclProf" : "excl", tac: ex.name, T: ex.site, w: EM ? Math.round(EM.w) : 0, n: EM ? Math.round(EM.n) : 0,
        log: "заготовка «"+ex.name+"»"+(prof ? " (против них заходила: "+Math.round(EM.w)+" из "+Math.round(EM.n)+")" : "")}); }
  } else {
    var H = roundHist.slice(-5), by = {A: 0, B: 0}, lost = {A: 0, B: 0};
    H.forEach(function(r){ if(r.site) by[r.site]++; if(r.site && r.planted && r.winner === "T") lost[r.site]++; });
    var top = by.A >= by.B ? "A" : "B";
    if(H.length >= 3 && by[top] >= 3){ P.stack = top; P.site = top; P.facts.push({k: "tSite", S: top, n: by[top], of: H.length, log: "T ходят на "+top+" ("+by[top]+" из "+H.length+") — больше людей на "+top}); }
    P.avoid = ctSetupHist.slice(-2).filter(function(id, i, a){ return a.indexOf(id) === i; });
    // от ретейка — только если ретейк на этом сайте ещё не играли последние раунды (иначе он и не сработал)
    ["A","B"].forEach(function(k){ if(lost[k] >= 2 && !P.retake && P.avoid.indexOf("retake" + k) < 0){ P.retake = k; P.facts.push({k: "retake", S: k, n: lost[k], log: "на "+k+" проигрываем после планта ("+lost[k]+") — от ретейка"}); } });
    if(P.avoid.length){ var sf = setupById(P.avoid[P.avoid.length-1]); P.facts.push({k: "readSetup", setup: sf ? sf.name : P.avoid[0], log: "расстановку «"+(sf ? sf.name : P.avoid[0])+"» прочитали — меняем"}); }
  }
  // (v469, владелец 29.10: «больше вариантов пауз — интересные раунды, а не только запрет расстановок») ещё виды плана — из того, что
  // команда знает по прошлым раундам (итог, был ли плант, когда вышли — roundHist; где их AWP брал фраги — RMEM.awp), и каждый меняет игру
  var RH = roundHist.slice(-3);
  if(side === "T"){
    var l2 = roundHist.slice(-2);
    if(l2.length === 2 && l2.every(function(r){ return r.winner === "CT"; })){
      if(l2.every(function(r){ return roundTempo(r) === "fast"; })){ P.tempo = "slow"; P.facts.push({k: "tempoSlow", log: "два раунда проиграли быстрым выходом — играем медленно, от дефолта"}); }
      else if(l2.every(function(r){ return roundTempo(r) === "slow"; })){ P.tempo = "fast"; P.facts.push({k: "tempoFast", log: "два раунда проиграли медленно — играем быстро"}); }
    }
    var rtk = RH.filter(function(r){ return r.planted && r.winner === "CT"; }).length;
    if(rtk >= 2){ P.fake = true; P.facts.push({k: "fake", n: rtk, of: RH.length, log: "ставим, но они забирают ретейком ("+rtk+" из "+RH.length+") — быстро ротируют: фейк"}); }
  } else {
    var aw = (RMEM.awp || []).filter(function(q){ return roundNum - q.round <= 3 && GEO.ctMid && Math.hypot(q.x-GEO.ctMid.x, q.y-GEO.ctMid.y) < 600; });
    var hasAwp = bots.some(function(b){ return b.team === "CT" && (b.primary === "AWP" || b.tRole === "mid"); });
    if(aw.length && hasAwp && rmemRecent(RMEM.midDeath, 3).length < 2){ P.midAgg = true; P.facts.push({k: "awpEarly", n: aw.length, log: "наш AWP на миде берёт фраги ("+aw.length+" за 3 р.) — ранний пик AWP"}); }
  }
  if(!P.facts.length) P.facts.push({k: "reset", log: "перезагрузка: спокойно, по своей игре"});
  return P;
}
var DEF_GROUP_R = 450;   // (v450) ед. карты: «район группы» для мест дефолта — проектное число (≈ зона и её соседи)
var DEF_STAGE_SEC = 25;   // (v444) из демок Mirage — см. chooseTactic, need
// доли про по закупу T: трое T на сайте к 25 с / 25–50 с / позже или никогда (демки Ancient, 92 демки, tools/eco_play.py; PRO_PLAY §4;
// Mirage — те же, пока не посчитаны на ПК). «Хаф» в демках не отделён от форса — его доли
var TAC_TEMPO = {pistol:{fast:0.24, mid:0.36, late:0.40}, eco:{fast:0.06, mid:0.20, late:0.74}, force:{fast:0.14, mid:0.21, late:0.65},
                 half:{fast:0.14, mid:0.21, late:0.65}, full:{fast:0.08, mid:0.16, late:0.76}};
var TAC_TEMPO_NAME = {fast:"быстро", mid:"обычно", late:"поздно"};
var PLANT_MED = {pistol:42, eco:48, force:59, half:59, full:70};   // (v560) медиана планта T у про по закупу, с (демки Ancient, tools/eco_play.py)
// темп раунда для показа — по запланированному выходу: раш / выход до 25 с — быстро, до 50 с — обычно, позже — поздно (как доли про)
function tacTempoNow(tt){ if(!tt) return "mid"; if(tt.tac && tt.tac.style === "rush") return "fast"; var s = ((tt.execTick || roundStartTick) - roundStartTick)/TICK_HZ; return s <= 25 ? "fast" : (s <= 50 ? "mid" : "late"); }
// (v560, В95: «пауза и перекол не связаны с новой системой закупа») быстро / медленно вышли в прошлом раунде — от обычного для его закупа: пороги
// 32 / 45 с — для фулла (проектные, v469), на эко / форсе / пистолетке — короче во столько же, во сколько у про раньше плант (PLANT_MED).
// Было — одни секунды на всё: поздний выход на эко (как у про) читался «проиграли медленно — на паузе: быстро»
function roundTempo(r){ var k = (PLANT_MED[r.type] || PLANT_MED.full)/PLANT_MED.full;
  return r.execSec != null && r.execSec < 32*k ? "fast" : (r.execSec == null || r.execSec >= 45*k ? "slow" : null); }
var TACT_DBG = null;
function chooseTactic(){
  var type = teamEco.T.roundType;
  // (v557, В76, владелец 11.11: «от закупа зависит тактика — эко почти всегда раш; надо, чтобы при любом закупе игралась разная тактика»)
  // набор тактик — один на все закупы (раньше — свой набор на тип закупа: на эко только 2 раша). Закуп меняет только то, как часто
  // команда играет быстро / обычно / поздно — доли про по этому закупу (TAC_TEMPO, из демок), а не какие тактики есть
  var pool = T_TACTICS.slice();
  var rd = readCT(), readTxt = null;
  var tempoRead = null;
  if(BAL.tempoShift){ var lastT = roundHist.slice(-2);
    if(lastT.length === 2 && lastT.every(function(r){ return r.winner === "CT"; })){
      var fast = lastT.every(function(r){ return roundTempo(r) === "fast"; }), slow = lastT.every(function(r){ return roundTempo(r) === "slow"; });
      tempoRead = fast ? "slow" : (slow ? "fast" : null); } }
  // (v519, пак 09.11 п.12; А-7: «на паузе IGL говорит: медленно, идём A, — а выбирают мид-КТ, Б с двух сторон») сказанное на паузе — исходный план
  // раунда: тактика — из тех, что ему соответствуют (сайт, темп; фейк — если план «фейк»), а не вес ×1,8 / ×0,5. Нет такой в наборе для этого
  // типа раунда — как было (веса ниже). Переколл по ходу раунда — по новой информации, как обычно (160 / 170)
  // (v561, прогон 207: после паузы «быстро, A» — rushA три раунда подряд, до этого «фейк» — фейк три раза подряд) отбор по плану — только в
  // первом раунде после паузы (сказанное на паузе — план этого раунда); дальше до TOUT.T.until — сдвиги весов ниже (×1,3 … ×2,5)
  if(BAL.timeouts && roundNum <= TOUT.T.until && TOUT.T.plan && roundNum === (TOUT.T.plan.first != null ? TOUT.T.plan.first : roundNum)){ var TPf = TOUT.T.plan;
    var fit = pool.filter(function(t){
      if(TPf.fake) return t.style === "fake";
      if(TPf.site && t.site !== TPf.site) return false;
      if(TPf.tempo === "slow" && !(t.style === "default" || (t.setupEnd && t.setupEnd > 44))) return false;
      if(TPf.tempo === "fast" && !(t.style === "rush" || (t.setupEnd && t.setupEnd <= 44))) return false;
      return true; });
    if(fit.length) pool = fit; }
  var weights = pool.map(function(t){
    var M = tacMem[t.id] || {n:0, w:0};
    var w = 0.5 + 1.5*((M.w + 1)/(M.n + 2));             // удачные всплывают, проваленные тонут
    if(t.style === "split") w *= 1.6;                    // заходы с двух сторон — чаще
    if(t.weight) w *= t.weight;                          // своя частота тактики из набора карты (Ancient: кейв на B ×1.5 — не забывать)
    var l1 = tacHist[tacHist.length-1], l2 = tacHist[tacHist.length-2];
    if(l1 === t.id) w *= 0.35;                          // только что играли
    if(l1 === t.id && l2 === t.id) w *= 0.1;            // третий раз подряд — прочитана
    if(BAL.timeouts && roundNum <= TOUT.T.until){ var TP = TOUT.T.plan || {};   // (v460) план тренера после паузы
      if(TOUT.T.avoid.indexOf(t.id) >= 0) w *= 0.15; else w *= 1.3;
      if(TP.site) w *= t.site === TP.site ? 1.8 : 0.5;
      if(TP.avoidZone && tacUsesZone(t, TP.avoidZone)) w *= 0.3;                        // (v461) где умирали — обходим
      if(TP.stack && t.site === TP.site && (t.style === "fast" || t.style === "rush" || t.style === "exec")) w *= 1.3;   // стак прочитан — быстро
      if(TP.excl === t.id && roundNum === TP.first) w *= 8;
      if(TP.tempo === "fast"){ if(t.style === "rush" || (t.setupEnd && t.setupEnd <= 44)) w *= 2.5; if(t.style === "default") w *= 0.3; }   // (v469) план «быстро / медленно»
      if(TP.tempo === "slow"){ if(t.style === "default") w *= 2.5; if(t.style === "rush") w *= 0.3; }
      if(TP.fake && t.style === "fake") w *= 3; }   // (v469) план «фейк»
    // (8) темп по счёту: два проигрыша подряд быстрыми выходами — медленнее
    // (дефолт), два проигрыша медленными — быстрее (раш/ранний выход)
    if(BAL.tempoShift && tempoRead){ if(tempoRead === "slow"){ if(t.style === "default") w *= 2.2; if(t.style === "rush") w *= 0.3; }
      else { if(t.style === "rush" || (t.setupEnd && t.setupEnd <= 44)) w *= 1.8; if(t.style === "default") w *= 0.4; } }
    // (В142, v576: у ботов «уходим от стака» ×0,3 / ×1,4 / фейк ×2,5 давало 73 % выходов на B против 37 % без стака; про почти не уходят: после
    // стака A в 2 из 3 раундов выходы A 55 % против 62 % без стака — шансы ×0,75, 262 выхода, tools/shadow/plans_mirage.json) стак — только этот множитель
    if(rd.stack && t.site === rd.stack && t.style !== "fake") w *= STACK_K;
    return w;
  });
  if(rd.stack) readTxt = "читаем CT: "+rd.stack+" — стак "+rd.n+" из "+rd.of+" раундов → уходим от "+rd.stack+" / фейк на "+rd.stack;
  // (v560, В100/В107, разбор владельца 11.11: «многие тактики перестали играться», пистолетка проваливается) закуп задаёт долю раша
  // (трое T на сайте к 25 с у про — TAC_TEMPO.fast) — раш против остального, по своей частоте тактик; остальное — прежние веса. Было (v557):
  // три группы по стилю (раш / выход / дефолт) с долями «к 25 с / 25–50 с / позже» — «позже» у про — это и поздние выходы, а я отдал её
  // только дефолтам: на Mirage один дефолт шёл в 33 % раундов, на Ancient дефолты — в 56 %. Как рано выходить — решает время выхода ниже
  if(BAL.proTempo){
    var TM = TAC_TEMPO[type] || TAC_TEMPO.full, gW = {fast:0, rest:0};
    pool.forEach(function(t){ gW[t.style === "rush" ? "fast" : "rest"] += t.weight || 1; });
    pool.forEach(function(t, i){ var g = t.style === "rush" ? "fast" : "rest", sh = g === "fast" ? TM.fast : 1 - TM.fast; if(gW[g] > 0) weights[i] *= sh/gW[g]; });
  }
  var tac = pool[weightedChoice(pool, weights, roundNum*7919 + matchNum*104729 + 17)];
  // (v566) для «Разбора команды» (612): варианты тактики с весами, доля раша по закупу, план паузы — игру не меняет
  TACT_DBG = {round: roundNum, type: type, fast: BAL.proTempo ? (TAC_TEMPO[type] || TAC_TEMPO.full).fast : null, read: readTxt, tempoRead: tempoRead,
    plan: BAL.timeouts && roundNum <= TOUT.T.until ? TOUT.T.plan : null, pick: tac.id,
    list: pool.map(function(t, i){ var M = tacMem[t.id]; return {id: t.id, name: t.name, style: t.style, site: t.site, w: weights[i], mem: M ? Math.round(M.w*10)/10+" из "+M.n : ""}; })};
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
    // (v560, В107: «эко ставят на 67 с, пистолетку проигрывают», у про медиана планта: пистолетка 42, эко 48, форс 59, фулл 70 с — демки Ancient,
    // PRO_PLAY §4) распределение выше — фулл-бай; на другом закупе оно сдвигается в той же доле, что медиана планта про на этом закупе
    pT *= (PLANT_MED[type] || PLANT_MED.full)/PLANT_MED.full;
    setupSec = Math.round(Math.max(tac.setupEnd*0.6, Math.min(ROUND_TIME_SEC - 26, pT - 12)));
    tmode = setupSec < tac.setupEnd - 6 ? ", быстрый" : (setupSec > tac.setupEnd + 8 ? ", поздний" : "");
    // длинный сетап: сначала дефолт (контроль карты), свою расстановку тактика
    // занимает за столько же секунд до выхода, сколько ей нужно было с начала раунда
    // (v440, замер группы 3: у «дефолтов» фаза дефолта не включалась — их setupEnd 68–91 с и есть поздний выход, need ≈ весь сетап, и группа
    // с первой секунды стояла на точке выхода: Connector 0,53 игрока против 0,04 у про) у тактики-дефолта своя расстановка — это точка выхода
    // рядом с картой, занимают её за 14 с до выхода (проектное число, как нижняя граница need)
    // (v444, владелец 27.10: «замени числа на числа из демок») у дефолта группа тактики идёт на свою точку за DEF_STAGE_SEC до выхода: демки
    // Mirage, раунды с плантом после 60 с — точку подготовки (Connector у A, B Apartments у B) начинают занимать за ~35 с до планта
    // (Connector 0,09 → 0,52 игрока к 15–20 с), на сайт заходят за ~10 с до планта: 35 − 10 = 25 с до выхода. Было 14 (проектное) —
    // группа доходила к самому выходу. Ancient — то же число (у демок Ancient нет времени по раундам)
    var need = tac.style === "default" ? DEF_STAGE_SEC : Math.max(14, tac.setupEnd - 6);
    if(setupSec - need >= 12) defUntil = roundStartTick + (setupSec - need)*64;
  }
  teamTac.T = {tac:tac, site:tac.site, phase: tac.setupEnd > 0 ? "setup" : "execute", execTick: roundStartTick + setupSec*64, defUntil: defUntil, minExec: (BAL.proTempo && tac.setupEnd > 0) ? Math.min(setupSec, 30) : 0, needT: (BAL.proTempo && tac.setupEnd > 0) ? (tac.style === "default" ? DEF_STAGE_SEC : Math.max(14, tac.setupEnd - 6)) : 0,   // (v443) у дефолта — как need выше: иначе фаза дефолта (170, inDef) не включалась вовсе
               execStart: tac.setupEnd > 0 ? null : tick, // раш: выход сразу — отсчёт задержек ролей с начала раунда
               read: readTxt, seenCT:{A:0, B:0}, setupSec:setupSec};
  var M = tacMem[tac.id];
  var igl = bots.filter(function(b){ return b.team==="T" && b.tRole==="igl"; })[0];
  if(readTxt) logEvent("IGL "+(igl?igl.id:"T")+": "+readTxt);
  logEvent("IGL "+(igl?igl.id:"T")+": тактика «"+tac.name+"» ("+ROUND_TYPE_LABEL[type]+(tac.setupEnd?", выход на "+setupSec+"с"+tmode:", сразу")+
    (M && M.n ? ", в этом матче "+M.w+"/"+M.n : "")+")");
  chooseCtSetup();
}
