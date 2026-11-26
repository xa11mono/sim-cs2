// [хозяева: buyPhase, coreLoadEnd, endRound, freshMatch, resetRound, runMatch, sideSwapNow, swapSides]
function buyPhase(){
  showEv("buyShow", tick, bots.map(function(b){ return {id: b.id, team: b.team, _knife: b._knife, weapon: b.weapon, helmet: b.helmet, armor: b.armor, kit: b.kit, nades: Object.assign({}, b.nades), primary: b.primary, secondary: b.secondary}; }));   // (17.11) снаряжение до закупа — для показа закупки по одной (scoreboard)
  ["CT","T"].forEach(function(team){
    teamEco[team].antiEcoSmg = false;
    var type = decideRoundType(team);
    teamEco[team].roundType = type;
    if(teamEco[team].ecoWhy) logEvent(team+": "+teamEco[team].ecoWhy);
  });
  // (v428, PRINCIPLES М160) план раунда — до закупа, как у живой команды (IGL называет план, потом закуп): тактика T и расстановка CT
  // зависят только от типа раунда; закуп гранат — под план (plan: гранаты своей зоны на нужный момент). Раньше — после закупа
  chooseTactic();
  ["CT","T"].forEach(function(team){
    var type = teamEco[team].roundType;
    awpSwap(team);   // (v469, п.20) AWP — снайперу, до закупа (тогда он не купит вторую)
    if(type === "full" || type === "force" || type === "half") teamAwp(team, type);   // (В142, v578) и на форсе — по доле про
    if(type === "full") teamDrops(team);
    var spent = 0;
    bots.filter(function(b){ return b.team === team; }).forEach(function(b){ npRoundStart(b); });
    bots.filter(function(b){ return b.team === team; }).forEach(function(b, i){ spent += buyForPlayer(b, type, i); });
    logEvent(team+": "+ROUND_TYPE_LABEL[type]+" (потрачено $"+spent+")");
  });
}

function startHalf(silent){
  ecoKnowReset();   // (Г1) подсчёт денег соперника — заново: у всех $800
  bots.forEach(function(b){
    economySetMoney(b, START_MONEY); equipmentSetPrimary(b, null); equipmentSetSecondary(b, b.team==="CT" ? "USP" : "GLOCK");
    damageSetArmor(b, false); damageSetHelmet(b, false); damageSetArmorHp(b, 0); equipmentSetKit(b, false); equipmentSetWeapon(b, WEAPONS[b.secondary]); nadeSetNades(b, emptyNades());
  });
  teamEco.CT.lossLevel = 1; teamEco.T.lossLevel = 1;
  if(!silent) logEvent("ВТОРАЯ ПОЛОВИНА — деньги сброшены до $"+START_MONEY, true);
}
// (v270) Смена сторон — как в регламенте (ESL, раздел 2.4–2.4.1): после 12-го раунда;
// в начале каждого овертайма команды остаются на стороне прошлой половины и меняются
// на перерыве внутри овертайма (раунды 28, 34, …).
// (v434) раунд r начинается с нуля по снаряжению: вторая половина, каждая половина овертайма (startHalf). Одно место для resetRound и
// для сейва (saveWorth): сохранять оружие имеет смысл, только если оно перейдёт в следующий раунд
function roundResetsGear(r){ return r === HALF_ROUNDS+1 || (r > regRounds() && (r - regRounds() - 1) % OT_HALF === 0); }
// (v434) окончен ли матч после раунда r при счёте sCT : sT — одно место для endRound и для сейва
function matchOverWith(r, sCT, sT){
  if(r < regRounds()) return sCT >= MATCH_WIN || sT >= MATCH_WIN;
  if(r === regRounds()) return sCT !== sT;
  var tgt = matchWinTarget(); if(sCT >= tgt || sT >= tgt) return true;
  return (r - regRounds()) % (OT_HALF*2) === 0 && otIndex() + 1 >= OT_MAX;   // предохранитель
}
// (v434, М167, владелец: «сейвят на последних раундах половин») есть что сохранять: оружие перейдёт в следующий раунд (он не с нуля) и
// проигрыш этого раунда не кончает матч для команды. Так решает игрок: сейв — это оружие на следующий раунд, а не «выжить»
function saveWorth(team){
  var s = {CT: score.CT, T: score.T}; s[team === "CT" ? "T" : "CT"]++;
  return !roundResetsGear(roundNum+1) && !matchOverWith(roundNum, s.CT, s.T);
}
function sideSwapNow(r){
  if(r === HALF_ROUNDS+1) return true;
  if(r <= regRounds()) return false;
  var k = r - regRounds() - 1; return k % OT_HALF === 0 && (k/OT_HALF) % 2 === 1;
}
function swapSides(){
  var oldT = SIDE_TEAM.T;
  // игроки пересаживаются на место с тем же номером на другой стороне — с собой K/D и счётчик ошибок
  for(var i = 0; i < 5; i++){
    var a = teamBot("CT"+i), b = teamBot("T"+i); if(!a || !b) continue;
    var kills = a.kills; damageSetKills(a, b.kills); damageSetKills(b, kills);
    var deaths = a.deaths; damageSetDeaths(a, b.deaths); damageSetDeaths(b, deaths);
    var mistakes = a._mistakes; setupSetMistakes(a, b._mistakes); setupSetMistakes(b, mistakes);
  }
  SIDE_TEAM = {T: SIDE_TEAM.CT, CT: SIDE_TEAM.T};
  seatPlayers();
  var sc = score.CT; score.CT = score.T; score.T = sc;
  // тайм-ауты — у команды; серия поражений и «чего избегать» — про прошлую сторону, обнуляются
  var to = TOUT.CT; TOUT.CT = TOUT.T; TOUT.T = to;
  ["CT","T"].forEach(function(s){ TOUT[s].streak = 0; TOUT[s].until = 0; TOUT[s].avoid = []; TOUT[s].plan = null; });
  TO_DEATHS = {CT:[], T:[]};   // (v460) смерти по зонам — про прошлую сторону
  // память матча — по раскладу: эту откладываем, другую достаём (или начинаем с нуля)
  MEM_BOX[oldT] = memSnapshot();
  if(MEM_BOX[SIDE_TEAM.T]) memRestore(MEM_BOX[SIDE_TEAM.T]); else memStart();
  logEvent("СМЕНА СТОРОН — "+TEAM_NAME.CT+" за CT, "+TEAM_NAME.T+" за T. Счёт "+TEAM_NAME.CT+" "+score.CT+" : "+score.T+" "+TEAM_NAME.T, true);
  showEv("sideSwap", "Смена сторон · "+TEAM_NAME.CT+" — CT");
}
// (v152) воспроизводимый старт: всё, что влияет на решения ботов, — с нуля.
// Кэши чистим целиком: часть ключей содержит tick, и после сброса tick старые
// записи прошлого матча подставлялись бы в новый.
// (Т-2, 25.11, владелец: изоляция матчей не уничтожает накопленный опыт) новый матч = матч в новой странице с той же долгосрочной
// памятью (I-22). Страница, где матч уже был: сначала всё состояние — как после загрузки (снимок загрузки MK_LOAD, src/marks.js
// mkMatchClean), кроме памяти между матчами (реестр: классы «постоянная память» — OPP, «серия» — SERIES); дальше — как в новой странице.
// Новая страница (первый матч) — без восстановления: путь freshMatch тот же, что до Т-2. pause — пауза страницы (кнопка, инструменты);
// штатный переход к следующему матчу (tick) — без паузы
var MATCH_DIRTY = false;
function freshMatch(n, keepProfile){ matchBegin(n, keepProfile, true); }
function matchBegin(n, keepProfile, pause){
  // (Р3.4, 25.11) и первый матч страницы, если до него игра уже делала шаги по часам страницы (кадры до остановки инструментом, ≈1,2 с:
  // предрасчёт подсказок броска и др.) — состояние перед матчем не должно зависеть от часов страницы и нагрузки браузера
  if((MATCH_DIRTY || tick > 0) && typeof mkMatchClean === "function") mkMatchClean();
  MATCH_DIRTY = true;
  if(typeof WARM !== "undefined" && WARM.on){ WARM = {on:false}; }   // кнопку «пропустить разминку» прячет кадр (app, warmSkipSync)   // (v306) новый матч / перемотка — разминка кончилась
  if(pause) clockPause(true);
  clockSet(0); simTime = 0; roundStartTick = 0;
  if(!keepProfile) OPP = null;
  var clr = function(o){ for(var k in o) delete o[k]; };
  [spotCache, OUTWARD_CACHE, _ED, EWL, APPEAR, HOLD_CANDS, nadeFlags, comboCd, siteHeatPending].forEach(function(o){ if(o) clr(o); });
  nadeLandSet({A:[], B:[]});
  tracers.length = 0; soundPings.length = 0; nadesInAir.length = 0; smokes.length = 0; fires.length = 0; nadeFx.length = 0;
  groundWeapons.length = 0; groundItems.length = 0; events.length = 0; killfeed.length = 0;
  clearzReset(); LAST_CLEAR = {CT:{}, T:{}}; POSCLR = {CT:{}, T:{}};
  if(typeof beliefReset === "function") beliefReset();
  if(typeof lkpReset === "function") lkpReset();
  clutchInfo = null;
  nadeReactReset(); awpSmokeCd = {CT:0, T:0};
  teamEco = { CT: {lossLevel: 1, roundType: "pistol", lastIncome: 0}, T: {lossLevel: 1, roundType: "pistol", lastIncome: 0} };
  // бот — как при загрузке страницы: лишние поля (накопленные за прошлые матчи)
  // удаляем, простые значения возвращаем к исходным
  bots.forEach(function(b, i){
    var I = BOT_INIT[i] || {};
    for(var k in b){ if(!(k in I.keys)) delete b[k]; else if(k in I.vals) b[k] = I.vals[k]; }
  });
  matchNum = n - 1;
  newMatch();
}
function newMatch(){
  matchNum++;
  SIDE_TEAM = {T:"sp", CT:"fa"}; seatPlayers();   // (v270) в начале матча Spirit — T
  resetMatchMemory(); timeoutsReset();
  score.CT = 0; score.T = 0;
  roundNum = 0;
  bots.forEach(function(b){ damageSetKills(b, 0); damageSetDeaths(b, 0); b.assists = 0; });
  startHalf(true);
  logEvent("Новый матч #"+matchNum, true);
  resetRound(); // roundNum → 1, закуп пистолетного
}

function checkRoundEnd(){
  if(roundState !== "live") return;
  var ctAlive = bots.some(function(b){ return b.team==="CT" && b.alive; });
  var tAlive  = bots.some(function(b){ return b.team==="T" && b.alive; });
  if(bomb && bomb.state === "planted"){
    // после планта смерть всех T раунд НЕ заканчивает — CT ещё должны дефузнуть
    if(!ctAlive){ endRound("T", "elim"); return; }
    if(tick >= bomb.explodeTick){
      bomb.state = "exploded"; soundEv("sndBomb", "boom", bomb.x, bomb.y); showEv("bombBoom");   // (v437) вспышка кромки — только вид
      bots.forEach(function(b){
        if(b.alive) applyDamage(null, b, bombDamageAt(b.x, b.y), "C4", {wkey:"C4", noFeed:true});
      });
      logEvent("БОМБА ВЗОРВАЛАСЬ на "+bomb.site, true);
      feedEvent("boom", "Бомба взорвалась на "+bomb.site);
      endRound("T", "bomb");
    }
    return;
  }
  if(ctAlive && tAlive){
    if(simTime - roundStartTime >= ROUND_TIME_SEC) endRound("CT", "time");
    return;
  }
  endRound(ctAlive ? "CT" : (tAlive ? "T" : null), "elim");
}
function endRound(winner, reason){ var _ev = simEvIn("endRound", arguments);
  if(SANDBOX.on) return simEvOut(_ev);   // (v536) песочница: раунд не кончается (sandbox)
  if(DEMOV.on) return simEvOut(_ev);     // (v571) раунд из демки: кончается по демке (demo)
  for(var shk in siteHeatPending){ siteHeat[shk] = (siteHeat[shk]||0) + 1; } siteHeatPending = {};
  if(winner){ score[winner]++; }
  if(teamTac.T && teamTac.T.tac && teamTac.T.tac.style === "rush"){ RMEM.rush.push({site:teamTac.T.site, round:roundNum}); if(RMEM.rush.length > 6) RMEM.rush.shift(); }
  rememberRound(winner);
  posRoundEnd(winner);
  timeoutCheck(winner);
  roundClutchResult(winner); showEv("roundCard", winner, reason, tick);
  payRoundEconomy(winner, reason);
  roundState = "ending";
  roundEndTime = simTime;
  var why = reason === "time" ? " (время вышло)" : (reason === "bomb" ? " (взрыв)" : (reason === "defuse" ? " (дефуз)" : ""));
  logEvent("Раунд "+roundNum+" завершён"+(winner? " — победа "+winner+" ("+TEAM_NAME[winner]+")"+why : " — обе команды уничтожены")+". Счёт "+TEAM_NAME.CT+" (CT) "+score.CT+" : "+score.T+" "+TEAM_NAME.T+" (T)", true);
  var over = matchOverWith(roundNum, score.CT, score.T);
  if(!over && roundNum >= regRounds() && (roundNum - regRounds()) % (OT_HALF*2) === 0)
    logEvent((roundNum === regRounds() ? "" : "ещё ")+"ОВЕРТАЙМ при "+score.CT+":"+score.T+" — MR3, по $"+OT_MONEY+", до "+(MATCH_WIN + OT_HALF*(otIndex(roundNum+1)+1))+" побед", true);
  if(!over && sideSwapNow(roundNum+1) && SIM_SHOW){
    RC_HALF = "Смена сторон: "+TEAM_NAME.T+" — CT, "+TEAM_NAME.CT+" — T";   // (15.11, перестройка) надпись на карточке ставит кадр (app)
  }
  if(over){
    roundState = "matchover";
    var mw = score.CT > score.T ? "CT" : (score.T > score.CT ? "T" : null);
    if(mw) SERIES.maps[matchNum] = SIDE_TEAM[mw];   // (v304) карта серии — команде-победителю
    logEvent("МАТЧ ОКОНЧЕН — "+(mw ? "победа "+TEAM_NAME[mw] : "ничья")+" "+score.CT+":"+score.T, true);
    saveOppProfile();
  }
 simEvOut(_ev);}

function resetRound(){
  voiceLines = []; VOICE_DIRTY = true;   // (v264) войс — только этого раунда
  roundNum++;
  if(sideSwapNow(roundNum)) swapSides();
  if(roundResetsGear(roundNum)){   // вторая половина / половина овертайма: деньги и оружие с нуля
    if(roundNum === HALF_ROUNDS+1) startHalf();
    else { startHalf(true); bots.forEach(function(b){ economySetMoney(b, OT_MONEY); }); logEvent("Овертайм: половина — по $"+OT_MONEY, true); }
  }
  bots.forEach(function(b){
    var sp = b.spawnPt;
    var spp = spawnPosFor(sp, b.spawnOx, b.spawnOy);
    moveSetX(b, spp.x); moveSetY(b, spp.y); navSetZ(b, sp.z||0);
    // (v321, М19) точки спавна из демок (map.json, spawnSpots): каждый раунд игроки случайно (воспроизводимо: матч и раунд)
    // попадают на разные точки своей стороны — как в CS2; от точки зависят ранняя агрессия и тайминги
    var SS = MAP.spawnSpots && MAP.spawnSpots[b.team];
    if(SS && SS.length){
      var mates = bots.filter(function(o){ return o.team === b.team; }), mi = mates.indexOf(b);
      var perm = SS.map(function(_, i){ return i; }).sort(function(p, q){ return hashRand(roundNum*7919 + matchNum*104729 + p*31 + (b.team === "CT" ? 1 : 2)) - hashRand(roundNum*7919 + matchNum*104729 + q*31 + (b.team === "CT" ? 1 : 2)); });
      var spot = SS[perm[mi % perm.length]];
      if(spot && !insideSolidWall(spot[0], spot[1])){ moveSetX(b, spot[0]); moveSetY(b, spot[1]); }
    }
    var nsp = navAt(b.x, b.y, null); navSetArea(b, nsp ? nsp.id : null); if(nsp) navSetZ(b, nsp.z);   // (v321) высота — по навмешу под точкой спавна; (v323) и участок
    jumpSetJump(b, null); jumpSetBoost(b, null); jumpSetJc(b, null); nadeSetNadeT(b, null); nadeSetNadeNo(b, null);   // (v340) интервал гранат — с нового раунда заново; (v489) память отказавших бросков
    // (v375, отметки владельца: «заспавнился на Tetris / на сайте A в начале раунда») подъём по лестнице/ящику, начатый в конце
    // прошлого раунда, продолжался после спавна — бота тянуло обратно туда, где он лез. Всё движение прошлого раунда — сброс
    navSetClimb(b, null); moveSetFireExit(b, null); moveSetFireExitFire(b, null); moveSetUnstickT(b, null); placeResetTask(b); moveSetHold(b, null);
    // (v353, владелец: «тусклость кружка сохраняется после окончания раунда») этаж для рисования — сразу по спавну, а не через 16 тиков движения
    b._underV = null; b._overV = null; navSetFall(b, null); floorViewTick(b);   // (v535) этаж — заново с нового места
    b.baseX = b.x; b.baseY = b.y;
    b.px = b.x; b.py = b.y;
    movePath(b, [], "reset", 0); damageSetAlive(b, true); damageSetHp(b, 100);
    engagementSetPickTick(b, -999); engagementSetContactStreak(b, 0); engagementSetTs(b, {}); shotSetNextShotTick(b, 0);
    fightReset(b); engagementSetDecisionTick(b, -999); engagementSetForcedRetreat(b, false);
    lookReset(b); moveSetHeading(b, undefined); moveSpeed(b, 0, "reset"); placeStance(b, false, "reset"); engagementSetHoldSinceTick(b, -999); moveSetOnStairs(b, false);
    knowIntel(b, null); moveWalk(b, false, "reset"); moveSetLastStepTick(b, -999); knowSound(b, null);
    shotSetBurstCount(b, 0); shotSetLastShotTick(b, -999); reloadSetAmmoFor(b, null); reloadSetReloading(b, false); soundSetOnPistol(b, null); equipmentSetSecAmmo(b, null); soundSetBlind(b, null); fightSetFc(b, null); b._trail = []; shotSetTagUntil(b, 0); equipmentSetKnife(b, false); equipmentSetDrawUntil(b, 0); moveSetStuckTicks(b, 0);
    moveSetPrevOffX(b, 0); moveSetPrevOffY(b, 0); lookSetLookTarget(b, null); lookReasonSet(b, null);
    initRoam(b);
  });
  tracers.length = 0;
  ["CT","T"].forEach(function(t){ ROAM_ROUTES[t].forEach(function(p){ p.cleared = -99999; }); });
  // freeze-тайм (план §8): закуп и расстановка, никто не двигается. Таймер
  // раунда (1:55) и тайминги тактик отсчитываются от его конца.
  var FZ = BAL.freeze + (TO_NOW && TO_NOW.round === roundNum ? TO_SEC : 0);   // (v460) тактическая пауза — закупка дольше на 30 с
  roundState = FZ > 0 ? "freeze" : "live";
  roundStartTime = simTime + FZ; roundStartTick = tick + Math.round(FZ*TICK_HZ);
  // киллфид — только текущий раунд
  killfeed.length = 0; KF_DIRTY = true;
  resetTeamIntel();
  beliefReset();
  clutchShown = null; clutchInfo = null;
  bots.forEach(function(b){ damageSetRoundKills(b, 0); damageSetRoundDmg(b, 0); damageSetDmgBy(b, null); damageSetBlindBy(b, null); placeResetPost(b); taskSetAtPost(b, false); bombActReset(b); retakeSetSaveSpot(b, null); huntSetHuntIdx(b, undefined); huntSetHuntArrive(b, 0); lurkSetLurkIdx(b, 0); lurkSetLurkArr(b, 0); lurkSetLurkPh(b, undefined); });
  spotCache = {};
  resetNades();
  buyPhase();   // (v428) выбор тактики — внутри, до закупа
  resetBomb();
  logEvent("Раунд "+roundNum+" начался");
}
// (17.11, перестройка — модули) время и состояние раунда двигает главный цикл (tick, модуль) — через хозяина раунда
function roundSetState(s){ roundState = s; }
function roundSetStart(time, tk){ roundStartTime = time; roundStartTick = tk; }
function simTimeSet(v){ simTime = v; }
function freezeFxReset(){ FREEZE_FX = []; }
// (Р5, 26.11) конец загрузки ядра — одно место для страницы (view/app.js зовёт на прежнем месте) и для ядра без показа (tools/node):
// начальные поля ботов (BOT_INIT — для freshMatch) и состояние после загрузки (MK_LOAD — для чистого старта следующих матчей, Т-2)
var BOT_INIT = null;
function coreLoadEnd(){
  BOT_INIT = bots.map(function(b){ var o = {keys:{}, vals:{}}; for(var k in b){ o.keys[k] = 1; var v = b[k]; if(v === null || (typeof v !== "object" && typeof v !== "function")) o.vals[k] = v; } return o; });
  // (Т-2) состояние после загрузки — для чистого старта следующих матчей в этой странице (530 matchBegin → mkMatchClean); до разминки
  if(typeof mkSnapshot === "function") MK_LOAD = mkSnapshot();
}
// (Р5.3, 26.11) вход ядра без окна: матч целиком по номеру → итог раундов и события. Для Node (tools/node/core_run.js),
// freshMatch(номер), stepTick до конца матча; события — подпиской simEvOn (только чтение, Р0.4).
var RUN_MATCH = null;        // идущий вызов runMatch: куда складывать события; вне вызова подписки ничего не делают
var RUN_MATCH_SUB = false;   // подписки поставлены (один раз на загрузку ядра)
function runMatch(cfg){
  cfg = cfg || {};
  if(!RUN_MATCH_SUB){ RUN_MATCH_SUB = true;
    simEvOn("endRound", function(ph, A){ if(ph === "in" && RUN_MATCH) RUN_MATCH.rounds.push({round: roundNum, tick: tick, winner: A[0], reason: A[1], bomb: bomb && bomb.state}); });
    simEvOn("feedKill", function(ph, A){ if(ph === "in" && RUN_MATCH) RUN_MATCH.kills.push({tick: tick, round: roundNum, att: A[0] ? A[0].id : null, vic: A[1].id, weapon: String(A[2]), hs: !!A[3]}); });
    simEvOn("throwNade", function(ph, A){ if(ph === "in" && RUN_MATCH) RUN_MATCH.nades.push({tick: tick, round: roundNum, bot: A[0].id, type: A[1]}); }); }
  var max = cfg.maxTicks || 400000, R = RUN_MATCH = {rounds: [], kills: [], nades: []};
  try {
    freshMatch(cfg.match || 1);
    var M0 = matchNum, T1 = tick;
    for(var t = 0; t < max; t++){ stepTick(); if(matchNum !== M0) break; T1 = tick; if(cfg.onTick) cfg.onTick(tick); }
    var won = {T: 0, CT: 0}; R.rounds.forEach(function(r){ if(won[r.winner] != null) won[r.winner]++; });
    return {match: M0, ticks: matchNum !== M0 ? T1 + 1 : tick, finished: matchNum !== M0, score: won, rounds: R.rounds, kills: R.kills, nades: R.nades};
  } finally { RUN_MATCH = null; }
}
