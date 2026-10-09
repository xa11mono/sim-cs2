var events = []; var killfeed = [];
var simTime = 0; // нужен logEvent-у при старте
var roundStartTick = 0;
// ---------- rounds ----------
var roundNum = 1, score = {CT:0, T:0};
var roundState = "live";
var roundEndTime = -1;
var ROUND_RESTART_DELAY_SEC = 3.5;

var ROUND_TIME_SEC = 115;   // 1:55, как в CS2 (бомбы пока нет — по времени выигрывают CT)
var roundStartTime = 0;
var MATCH_WIN = 13, HALF_ROUNDS = 12; // MR12
// овертайм CS2: MR3 (половины по 3 раунда), $10000 в начале каждой половины,
// побеждает первый до 16 (затем 19, 22…); 15:15 — ещё овертайм
var OT_MONEY = 10000, OT_HALF = 3, OT_MAX = 4;
function regRounds(){ return HALF_ROUNDS*2; }
function otIndex(r){ r = r || roundNum; return r > regRounds() ? Math.floor((r - regRounds() - 1)/(OT_HALF*2)) : -1; }
function matchWinTarget(){ var oi = otIndex(); return oi < 0 ? MATCH_WIN : MATCH_WIN + OT_HALF*(oi+1); }
var matchNum = 1;
assignRoles(); logRoles(); // роли на матч (02_bots.js) — матч 1 при загрузке страницы

// ---------- экономика (правила CS2) ----------
// Что купить — решение команды (buyTeam, 12_buy.js). Правила CS2:
//  • победа — $3250 каждому (по времени у CT тоже 3250);
//  • поражение — loss bonus 1400/1900/2400/2900/3400. Счётчик поражений
//    стартует с 1 (первое поражение сразу даёт 1900, как в CS2), растёт на 1
//    за поражение до 4, а победа уменьшает его на 1, а не обнуляет;
//  • T, проигравшие по времени, которые остались живы — $0 (не пытались
//    выиграть раунд, классическое правило);
//  • килл — награда оружия (SMG 600, винтовки/пистолеты 300, AWP 100);
//  • потолок $16000; погибший теряет оружие и броню, выживший сохраняет.
var LOSS_BONUS = [1400, 1900, 2400, 2900, 3400];
var WIN_REWARD = 3250;
var ARMOR_PRICE = 650, HELMET_UPGRADE = 350; // кевлар 650, кевлар+шлем 1000
var teamEco = {
  CT: {lossLevel: 1, roundType: "pistol", lastIncome: 0},
  T:  {lossLevel: 1, roundType: "pistol", lastIncome: 0}
};
var ROUND_TYPE_LABEL = {pistol:"пистолетный", eco:"эко", force:"форс-бай", half:"хаф-бай", full:"фулл-бай", hero:"хиро-бай"};
var KIT_PRICE = 400;   // кит сапёра (CT): дефуз 5 с вместо 10

function payRoundEconomy(winner, reason){
  ["CT","T"].forEach(function(team){
    var te = teamEco[team];
    var won = team === winner;
    var income = won ? ((reason === "bomb" || reason === "defuse") ? 3500 : WIN_REWARD) : LOSS_BONUS[Math.min(4, te.lossLevel)];
    // T проиграли, но успели заложить бомбу — каждому +$800 к loss bonus
    if(!won && team === "T" && bomb && (bomb.state === "planted" || bomb.state === "defused")) income += 800;
    bots.forEach(function(b){
      if(b.team !== team) return;
      var inc = income;
      if(!won && team === "T" && reason === "time" && b.alive) inc = 0;
      b.money = Math.min(MAX_MONEY, b.money + inc);
    });
    te.lastIncome = income;
    if(roundNum === 1 || roundNum === HALF_ROUNDS+1) te.wonPistol = won;
    te.lossLevel = won ? Math.max(0, te.lossLevel-1) : Math.min(4, te.lossLevel+1);
    te.lastWin = won;
  });
}

function sideOk(w, team){ return w.side === "both" || w.side === team; }
function buyItem(b, key){
  var w = WEAPONS[key];
  if(!sideOk(w, b.team) || b.money < w.price) return false;
  b.money -= w.price;
  if(w.slot === "primary") b.primary = key; else b.secondary = key;
  return true;
}
// гранаты (правила CS2): не больше 1 дыма, 1 молотова, 1 HE, 2 флешек и 4 штук всего.
// Что брать — решает 12_script_runner.js (scrBuyUtility): гранаты под шаги выбранного сценария.
var NADE_LIMIT = {smoke: 1, molly: 1, he: 1, flash: 2}, NADE_LIMIT_ALL = 4;
function nadeCount(b){ var n = 0; for(var k in b.nades) n += b.nades[k]; return n; }
function nadePrice(b, type){ return b.team === "CT" && NADE[type].priceCT ? NADE[type].priceCT : NADE[type].price; }
function nadeCanBuy(b, type){
  // _buyFloor — не тратить ниже (эко/хаф-бай: деньги на фулл в следующем раунде, 12_buy.js)
  return b.alive && b.nades[type] < NADE_LIMIT[type] && nadeCount(b) < NADE_LIMIT_ALL && b.money - nadePrice(b, type) >= (b._buyFloor || 0);
}
function buyNade(b, type){
  if(!nadeCanBuy(b, type)) return false;
  b.money -= nadePrice(b, type); b.nades[type]++;
  return true;
}
function buyArmor(b, withHelmet){
  if(!b.armor && b.money >= ARMOR_PRICE){ b.money -= ARMOR_PRICE; b.armor = true; }
  if(withHelmet && b.armor && !b.helmet && b.money >= HELMET_UPGRADE){ b.money -= HELMET_UPGRADE; b.helmet = true; }
}
// закуп во freeze-тайм: что брать — решение команды (buyTeam, 12_buy.js)
function buyPhase(){
  ["CT","T"].forEach(function(team){
    var T = bots.filter(function(b){ return b.team === team; }), before = 0, after = 0;
    T.forEach(function(b){ before += b.money; if(!b.nades) b.nades = emptyNades(); });
    teamEco[team].roundType = buyTeam(team);
    T.forEach(function(b){ b.weapon = WEAPONS[b.primary || b.secondary]; after += b.money; });
    logEvent(team+": "+ROUND_TYPE_LABEL[teamEco[team].roundType]+" (потрачено $"+(before-after)+")");
  });
}

function startHalf(silent){
  bots.forEach(function(b){
    b.money = START_MONEY; b.primary = null; b.secondary = b.team==="CT" ? "USP" : "GLOCK";
    b.armor = false; b.helmet = false; b.kit = false; b.weapon = WEAPONS[b.secondary]; b.nades = emptyNades();
  });
  teamEco.CT.lossLevel = 1; teamEco.T.lossLevel = 1;
  if(!silent) logEvent("ВТОРАЯ ПОЛОВИНА — деньги сброшены до $"+START_MONEY, "round");
}
// (v152) воспроизводимый старт: всё, что влияет на игру, — с нуля.
function freshMatch(n){
  paused = true;
  tick = 0; simTime = 0; roundStartTick = 0;
  tracers.length = 0; soundPings.length = 0; nadesInAir.length = 0; smokes.length = 0; fires.length = 0; nadeFx.length = 0;
  groundWeapons.length = 0; events.length = 0; killfeed.length = 0;
  clutchInfo = null;
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
  score.CT = 0; score.T = 0;
  roundNum = 0;
  bots.forEach(function(b){ b.kills = 0; b.deaths = 0; });
  startHalf(true);
  logEvent("Новый матч #"+matchNum, "round");
  logRoles();
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
      bomb.state = "exploded";
      bots.forEach(function(b){
        if(b.alive && Math.hypot(b.x-bomb.x, b.y-bomb.y) < BOMB_KILL_RADIUS){
          b.alive = false; b.hp = 0; b.deaths++;
          b.primary = null; b.secondary = b.team==="CT" ? "USP" : "GLOCK"; b.armor = false; b.helmet = false; b.kit = false;
          b.nades = emptyNades();
        }
      });
      logEvent("БОМБА ВЗОРВАЛАСЬ на "+bomb.site, "bomb");
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
  if(winner){ score[winner]++; }
  planRoundEnd(winner);   // память IGL: что играли и чем кончилось (12_team.js)
  showRoundCard(winner, reason);
  payRoundEconomy(winner, reason);
  roundState = "ending";
  roundEndTime = simTime;
  var why = reason === "time" ? " (время вышло)" : (reason === "bomb" ? " (взрыв)" : (reason === "defuse" ? " (дефуз)" : ""));
  logEvent("Раунд "+roundNum+" завершён"+(winner? " — победа "+winner+why : " — обе команды уничтожены")+". Счёт CT:"+score.CT+" T:"+score.T, "round");
  var over;
  var tgt = matchWinTarget();
    if(roundNum < regRounds()) over = score.CT >= MATCH_WIN || score.T >= MATCH_WIN;
    else if(roundNum === regRounds()) over = score.CT !== score.T;
    else {
      over = score.CT >= tgt || score.T >= tgt;
      if(!over && (roundNum - regRounds()) % (OT_HALF*2) === 0 && otIndex() + 1 >= OT_MAX) over = true; // предохранитель
    }
    if(!over && roundNum >= regRounds() && (roundNum - regRounds()) % (OT_HALF*2) === 0)
      logEvent((roundNum === regRounds() ? "" : "ещё ")+"ОВЕРТАЙМ при "+score.CT+":"+score.T+" — MR3, по $"+OT_MONEY+", до "+(MATCH_WIN + OT_HALF*(otIndex(roundNum+1)+1))+" побед", "round");
  if(over){
    roundState = "matchover";
    var mw = score.CT > score.T ? "CT" : (score.T > score.CT ? "T" : null);
    logEvent("МАТЧ ОКОНЧЕН — "+(mw ? "победа "+mw : "ничья")+" "+score.CT+":"+score.T, "round");
  }
}

function resetRound(){
  roundNum++;
  if(roundNum === HALF_ROUNDS+1) startHalf(); // вторая половина: деньги и оружие с нуля
  if(roundNum > regRounds() && (roundNum - regRounds() - 1) % OT_HALF === 0){
    startHalf(true);
    bots.forEach(function(b){ b.money = OT_MONEY; });
    logEvent("Овертайм: половина — по $"+OT_MONEY, "round");
  }
  bots.forEach(function(b){
    var sp = b.spawnPt;
    var spp = spawnPosFor(sp, b.spawnOx, b.spawnOy);
    b.x = spp.x; b.y = spp.y; b.z = sp.z||0;
    b.baseX = b.x; b.baseY = b.y;
    b.px = b.x; b.py = b.y;
    b.path = []; b.pathIdx = 0; b.alive = true; b.hp = 100; b._diedT = undefined; b._micro = null; b._aimOff = 0; b._aimS = null;
    b.pickTick = -999; b.contactStreak = 0; b.nextShotTick = 0;
    b.facing = undefined; b.heading = undefined; b.curSpeed = 0; b.crouching = false; b.onStairs = false;
    b.walking = false; b.lastStepTick = -999; b.heardSound = null; b.ears = [];
    b.burstCount = 0; b._fire = null; b.lastShotTick = -999; b._ammoFor = null; b._reloading = false; b._tagUntil = 0; b.stuckTicks = 0;
    b.lookTarget = null; b._tgt = null; delete b.lookReason;
  });
  tracers.length = 0;
  // freeze-тайм: закуп, никто не двигается. Таймер раунда (1:55) — от его конца.
  var FZ = BAL.freeze;
  roundState = FZ > 0 ? "freeze" : "live";
  roundStartTime = simTime + FZ; roundStartTick = tick + Math.round(FZ*TICK_HZ);
  // киллфид — только текущий раунд
  killfeed.length = 0; renderFeed();
  clutchShown = null; clutchInfo = null;
  bots.forEach(function(b){ b.roundKills = 0; b.roundDmg = 0; b._dmgBy = {}; b._blindBy = null; b.planting = false; b.defusing = false; });
  resetNades();
  buyPhase();
  resetBomb();
  logEvent("Раунд "+roundNum+" начался", "round");
  planRoundStart();  // IGL обеих сторон выбирают план на раунд (12_team.js → 07_t_brain.js, 12_ct_brain.js)
  scriptRoundStart();// гранаты под шаги выбранного сценария на оставшиеся деньги (12_script_runner.js)
  tDefaultRoundStart();// дефолт T: места по полосам из демок, кто куда, у кого бомба (12_t_default.js)
  posRoundStart();   // CT — по слотам активного Setup'а (11_position.js)
  utilRoundStart();  // утилита по времени из демок: кто кидает (по дороге на свою точку/полосу), докупить (13_nades.js, v219)
  stubSelfNades();   // гранаты «себе» на остаток — заплатка-закуп (12_stub.js)
}

