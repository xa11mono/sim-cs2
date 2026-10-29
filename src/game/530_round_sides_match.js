function buyPhase(){
  if(typeof buyShowStart === "function") buyShowStart();
  ["CT","T"].forEach(function(team){
    teamEco[team].antiEcoSmg = false;
    var type = decideRoundType(team);
    teamEco[team].roundType = type;
    if(teamEco[team].ecoWhy) logEvent(team+": "+teamEco[team].ecoWhy);
  });
  // (v428, PRINCIPLES М160) план раунда — до закупа, как у живой команды (IGL называет план, потом закуп): тактика T и расстановка CT
  // зависят только от типа раунда; закуп гранат — под план (365_nade_plan: гранаты своей зоны на нужный момент). Раньше — после закупа
  chooseTactic();
  ["CT","T"].forEach(function(team){
    var type = teamEco[team].roundType;
    awpSwap(team);   // (v469, п.20) AWP — снайперу, до закупа (тогда он не купит вторую)
    if(type === "full") teamAwp(team);
    if(type === "full") teamDrops(team);
    var spent = 0;
    bots.filter(function(b){ return b.team === team; }).forEach(function(b){ npRoundStart(b); });
    bots.filter(function(b){ return b.team === team; }).forEach(function(b, i){ spent += buyForPlayer(b, type, i); });
    logEvent(team+": "+ROUND_TYPE_LABEL[type]+" (потрачено $"+spent+")");
  });
}

function startHalf(silent){
  bots.forEach(function(b){
    b.money = START_MONEY; b.primary = null; b.secondary = b.team==="CT" ? "USP" : "GLOCK";
    b.armor = false; b.helmet = false; b.armorHp = 0; b.kit = false; b.weapon = WEAPONS[b.secondary]; b.nades = emptyNades();
  });
  teamEco.CT.lossLevel = 1; teamEco.T.lossLevel = 1;
  if(!silent) logEvent("ВТОРАЯ ПОЛОВИНА — деньги сброшены до $"+START_MONEY, true);
}
// (v270) Смена сторон — как в регламенте (ESL, раздел 2.4–2.4.1): после 12-го раунда;
// в начале каждого овертайма команды остаются на стороне прошлой половины и меняются
// на перерыве внутри овертайма (раунды 28, 34, …).
// (v434) раунд r начинается с нуля по снаряжению: вторая половина, каждая половина овертайма (startHalf). Одно место для resetRound и
// для сейва (saveWorth): сохранять оружие имеет смысл, только если оно перейдёт в следующий раунд
function roundResetsGear(r){ return r === HALF_ROUNDS+1 || (!!BAL.overtime && r > regRounds() && (r - regRounds() - 1) % OT_HALF === 0); }
// (v434) окончен ли матч после раунда r при счёте sCT : sT — одно место для endRound и для сейва
function matchOverWith(r, sCT, sT){
  if(!BAL.overtime) return sCT >= MATCH_WIN || sT >= MATCH_WIN || r >= regRounds();
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
  if(!BAL.overtime || r <= regRounds()) return false;
  var k = r - regRounds() - 1; return k % OT_HALF === 0 && (k/OT_HALF) % 2 === 1;
}
function swapSides(){
  var oldT = SIDE_TEAM.T;
  // игроки пересаживаются на место с тем же номером на другой стороне — с собой K/D и счётчик ошибок
  for(var i = 0; i < 5; i++){
    var a = teamBot("CT"+i), b = teamBot("T"+i); if(!a || !b) continue;
    ["kills","deaths","_mistakes"].forEach(function(k){ var v = a[k]; a[k] = b[k]; b[k] = v; });
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
  if(typeof document !== "undefined"){ plSelected = null; showBanner("Смена сторон · "+TEAM_NAME.CT+" — CT", null, 3000); }
}
// (v152) воспроизводимый старт: всё, что влияет на решения ботов, — с нуля.
// Кэши чистим целиком: часть ключей содержит tick, и после сброса tick старые
// записи прошлого матча подставлялись бы в новый.
function freshMatch(n, keepProfile){
  if(typeof WARM !== "undefined" && WARM.on){ WARM = {on:false}; var wsk0 = typeof document !== "undefined" && document.getElementById("btnWarmSkip"); if(wsk0) wsk0.style.display = "none"; }   // (v306) новый матч / перемотка — разминка кончилась
  paused = true;
  tick = 0; simTime = 0; roundStartTick = 0;
  if(!keepProfile) OPP = null;
  var clr = function(o){ for(var k in o) delete o[k]; };
  [spotCache, OUTWARD_CACHE, _ED, EWL, APPEAR, HOLD_CANDS, nadeFlags, comboCd, siteHeatPending].forEach(function(o){ if(o) clr(o); });
  nadeLandHistory = {A:[], B:[]};
  tracers.length = 0; soundPings.length = 0; nadesInAir.length = 0; smokes.length = 0; fires.length = 0; nadeFx.length = 0;
  groundWeapons.length = 0; groundItems.length = 0; events.length = 0; killfeed.length = 0;
  CLEARZ = {CT:{}, T:{}}; LAST_CLEAR = {CT:{}, T:{}}; POSCLR = {CT:{}, T:{}};
  if(typeof beliefReset === "function") beliefReset();
  if(typeof lkpReset === "function") lkpReset();
  clutchInfo = null;
  nadeReactCd = {CT:0, T:0}; awpSmokeCd = {CT:0, T:0};
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
  bots.forEach(function(b){ b.kills = 0; b.deaths = 0; });
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
      bomb.state = "exploded"; if(SND && SND.on) sndBomb("boom", bomb.x, bomb.y); hudBombBoom();   // (v437) вспышка кромки — только вид
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
function endRound(winner, reason){
  for(var shk in siteHeatPending){ siteHeat[shk] = (siteHeat[shk]||0) + 1; } siteHeatPending = {};
  if(winner){ score[winner]++; }
  if(BAL.roundMem && teamTac.T && teamTac.T.tac && teamTac.T.tac.style === "rush"){ RMEM.rush.push({site:teamTac.T.site, round:roundNum}); if(RMEM.rush.length > 6) RMEM.rush.shift(); }
  rememberRound(winner);
  posRoundEnd(winner);
  timeoutCheck(winner);
  showRoundCard(winner, reason);
  payRoundEconomy(winner, reason);
  roundState = "ending";
  roundEndTime = simTime;
  var why = reason === "time" ? " (время вышло)" : (reason === "bomb" ? " (взрыв)" : (reason === "defuse" ? " (дефуз)" : ""));
  logEvent("Раунд "+roundNum+" завершён"+(winner? " — победа "+winner+" ("+TEAM_NAME[winner]+")"+why : " — обе команды уничтожены")+". Счёт "+TEAM_NAME.CT+" (CT) "+score.CT+" : "+score.T+" "+TEAM_NAME.T+" (T)", true);
  var over = matchOverWith(roundNum, score.CT, score.T);
  if(BAL.overtime){
    if(!over && roundNum >= regRounds() && (roundNum - regRounds()) % (OT_HALF*2) === 0)
      logEvent((roundNum === regRounds() ? "" : "ещё ")+"ОВЕРТАЙМ при "+score.CT+":"+score.T+" — MR3, по $"+OT_MONEY+", до "+(MATCH_WIN + OT_HALF*(otIndex(roundNum+1)+1))+" побед", true);
  }
  if(!over && sideSwapNow(roundNum+1) && typeof document !== "undefined"){
    var rh = document.getElementById("rcHalf"); if(rh) rh.textContent = "Смена сторон: "+TEAM_NAME.T+" — CT, "+TEAM_NAME.CT+" — T";
  }
  if(over){
    roundState = "matchover";
    var mw = score.CT > score.T ? "CT" : (score.T > score.CT ? "T" : null);
    if(mw) SERIES.maps[matchNum] = SIDE_TEAM[mw];   // (v304) карта серии — команде-победителю
    logEvent("МАТЧ ОКОНЧЕН — "+(mw ? "победа "+TEAM_NAME[mw] : "ничья")+" "+score.CT+":"+score.T, true);
    saveOppProfile();
  }
}

function resetRound(){
  voiceLines = []; if(typeof document !== "undefined") renderVoice();   // (v264) войс — только этого раунда
  roundNum++;
  if(sideSwapNow(roundNum)) swapSides();
  if(roundResetsGear(roundNum)){   // вторая половина / половина овертайма: деньги и оружие с нуля
    if(roundNum === HALF_ROUNDS+1) startHalf();
    else { startHalf(true); bots.forEach(function(b){ b.money = OT_MONEY; }); logEvent("Овертайм: половина — по $"+OT_MONEY, true); }
  }
  bots.forEach(function(b){
    var sp = b.spawnPt;
    var spp = spawnPosFor(sp, b.spawnOx, b.spawnOy);
    b.x = spp.x; b.y = spp.y; b.z = sp.z||0;
    // (v321, М19) точки спавна из демок (map.json, spawnSpots): каждый раунд игроки случайно (воспроизводимо: матч и раунд)
    // попадают на разные точки своей стороны — как в CS2; от точки зависят ранняя агрессия и тайминги
    var SS = MAP.spawnSpots && MAP.spawnSpots[b.team];
    if(SS && SS.length){
      var mates = bots.filter(function(o){ return o.team === b.team; }), mi = mates.indexOf(b);
      var perm = SS.map(function(_, i){ return i; }).sort(function(p, q){ return hashRand(roundNum*7919 + matchNum*104729 + p*31 + (b.team === "CT" ? 1 : 2)) - hashRand(roundNum*7919 + matchNum*104729 + q*31 + (b.team === "CT" ? 1 : 2)); });
      var spot = SS[perm[mi % perm.length]];
      if(spot && !insideSolidWall(spot[0], spot[1])){ b.x = spot[0]; b.y = spot[1]; }
    }
    var nsp = navAt(b.x, b.y, null); b._area = nsp ? nsp.id : null; if(nsp) b.z = nsp.z;   // (v321) высота — по навмешу под точкой спавна; (v323) и участок
    b._jump = null; b._nadeT = null;   // (v340) интервал гранат — с нового раунда заново
    // (v375, отметки владельца: «заспавнился на Tetris / на сайте A в начале раунда») подъём по лестнице/ящику, начатый в конце
    // прошлого раунда, продолжался после спавна — бота тянуло обратно туда, где он лез. Всё движение прошлого раунда — сброс
    b._climb = null; b._fireExit = null; b._fireExitFire = null; b._unstickT = null; b._task = null; b._hold = null;
    // (v353, владелец: «тусклость кружка сохраняется после окончания раунда») этаж для рисования — сразу по спавну, а не через 16 тиков движения
    var za0 = navArea(b._area); b._zArea = za0 ? za0.z : 0; b._under = hgtUnder(b.x, b.y, b.z, za0); b._lvl = hgtUnderCenter(b.x, b.y, b._under) ? -1 : za0 ? hgtLevelOf(za0.id) : 0;
    b.baseX = b.x; b.baseY = b.y;
    b.px = b.x; b.py = b.y;
    b.path = []; b.pathIdx = 0; b.alive = true; b.hp = 100;
    b.pickTick = -999; b.contactStreak = 0; b._ts = {}; b.nextShotTick = 0;
    b.state = "patrol"; b.decisionTick = -999; b.holding = false; b.forcedRetreat = false;
    b.facing = undefined; b.heading = undefined; b.curSpeed = 0; b.crouching = false; b.holdSinceTick = -999; b.onStairs = false;
    b.lastIntel = null; b.walking = false; b.lastStepTick = -999; b.heardSound = null;
    b.burstCount = 0; b.lastShotTick = -999; b._ammoFor = null; b._reloading = false; b._onPistol = null; b._secAmmo = null; b._blind = null; b._fc = null; b._trail = []; b._tagUntil = 0; b._knife = false; b._drawUntil = 0; b.stuckTicks = 0;
    b._prevOffX = 0; b._prevOffY = 0; b.lookTarget = null; b.lookReason = null;
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
  killfeed.length = 0; renderFeed();
  resetTeamIntel();
  beliefReset();
  clutchShown = null; clutchInfo = null;
  bots.forEach(function(b){ b.roundKills = 0; b.roundDmg = 0; b._dmgBy = null; b._blindBy = null; b.post = null; b.atPost = false; b.planting = false; b.defusing = false; b._saveSpot = null; b._huntIdx = undefined; b._huntArrive = 0; b._lurkIdx = 0; b._lurkArr = 0; b._lurkPh = undefined; });
  spotCache = {};
  resetNades();
  buyPhase();   // (v428) выбор тактики — внутри, до закупа
  resetBomb();
  logEvent("Раунд "+roundNum+" начался");
}

