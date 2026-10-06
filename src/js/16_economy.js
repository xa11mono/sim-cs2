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
function lastOfHalfNow(){ if(roundNum === HALF_ROUNDS || roundNum === regRounds()) return true; return roundNum > regRounds() && (roundNum - regRounds()) % OT_HALF === 0; }
var matchNum = 1;

// ---------- экономика и закуп (шаг 3, план §4) ----------
// Считается ДО того, как боты начинают двигаться: по деньгам каждого и всей
// команды выбирается тип раунда, из него — что каждый покупает. Правила CS2:
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
var ROUND_TYPE_LABEL = {pistol:"пистолетный", eco:"эко", force:"форс-бай", half:"хаф-бай", full:"фулл-бай"};

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
      foeIncome(team === "CT" ? "T" : "CT", b.id, inc); // доход видно всем: счёт, плант, кто дожил
    });
    te.lastIncome = income;
    if(roundNum === 1 || roundNum === HALF_ROUNDS+1) te.wonPistol = won;
    te.lossLevel = won ? Math.max(0, te.lossLevel-1) : Math.min(4, te.lossLevel+1);
  });
}

function sideOk(w, team){ return w.side === "both" || w.side === team; }
function rifleFor(team, b){
  if(team !== "CT") return WEAPONS.AK;
  // (7) у каждого CT своя винтовка: примерно половина играет с M4A1-S
  if(b && hashRand(pHash(b.id)*7 + 3) < 0.5) return WEAPONS.M4S;
  return WEAPONS.M4;
}
function smgFor(team, b){
  if(b){ var h = hashRand(pHash(b.id)*11 + roundNum*3 + 5);
    if(h < 0.25) return WEAPONS.UMP; if(h < 0.45) return WEAPONS.MP7; }
  return team === "CT" ? WEAPONS.MP9 : WEAPONS.MAC10;
}
function pHash(id){ var h = 0; for(var i=0;i<id.length;i++) h = (h*31 + id.charCodeAt(i)) % 100003; return h; }
// (7) любитель прицела: на фулле с запасом денег берёт AUG/SG вместо M4/AK
function scopedFor(b){
  if(b.tRole === "awp" || (b.team === "CT" && b.tRole === "mid")) return null;
  if(hashRand(pHash(b.id)*13 + 1) >= 0.2) return null;              // ~каждый пятый игрок
  var w = b.team === "CT" ? WEAPONS.AUG : WEAPONS.SG;
  return b.money >= w.price + ARMOR_PRICE + HELMET_UPGRADE + 600 ? w : null;
}
// сколько не хватает до полного закупа (винтовка + кевлар/шлем) с учётом того, что уже есть
function fullNeedU(b){ return fullNeed(b) + (BAL.ecoUtil ? (b.team === "CT" ? 500 : 300) : 0); }
function fullNeed(b){
  var need = 0;
  var cur = b.primary ? WEAPONS[b.primary] : null;
  if(!cur || cur.tier < 6) need += rifleFor(b.team).price;
  if(!b.armor) need += ARMOR_PRICE + HELMET_UPGRADE;
  else if(!b.helmet) need += HELMET_UPGRADE;
  return need;
}
function nextLossIncome(team){ return LOSS_BONUS[Math.min(4, teamEco[team].lossLevel)]; }

// оценка денег соперника — подсчёт по открытому (FOE в 09_knowledge.js:
// доход по итогам раундов, фраги из киллфида, что они, скорее всего, купили),
// а не их настоящие деньги; «сохранили оружие» — дожили с ним, и его видели
function enemyEcoGuess(team){
  var ms = bots.filter(function(b){ return b.team !== team; });
  var avg = ms.reduce(function(a, b){ return a + foeMoney(team, b.id); }, 0) / Math.max(1, ms.length);
  var guns = ms.filter(function(b){ var g = FOE[team].gun[b.id]; return g && WEAPONS[g].tier >= 5; }).length;
  var full = guns >= 3 || avg >= 4200;
  var eco = !full && guns <= 1 && avg < 2300;
  return {avg:avg, full:full, eco:eco, guns:guns};
}
function decideRoundType(team){
  var base = decideRoundType0(team);
  if(base === "pistol") return base;
  var E = enemyEcoGuess(team), te = teamEco[team];
  te.enemyGuess = E; // оценка ДО закупа — по ней CT потом решают "играем против эко"
  foeBuyGuess(team);  // и сразу: что они на это, скорее всего, купили
  var mates = bots.filter(function(b){ return b.team === team; });
  var avg = mates.reduce(function(a, b){ return a + b.money; }, 0) / mates.length;
  var lastOfHalf = lastOfHalfNow();
  te.ecoWhy = "";
  // у них эко, у нас "эко/хаф" — берём SMG: $600 за килл и почти гарантированный раунд
  if(E.eco && (base === "eco" || base === "half") && avg >= 1500){ te.antiEcoSmg = true; te.ecoWhy = "у них эко — берём SMG"; return "force"; }
  // у них полный закуп, мы собирались форсить, а после эко хватит на фулл — не форсим
  var nextInc = nextLossIncome(team);
  var canFullNext = mates.filter(function(b){ return b.money + nextInc >= fullNeed(b); }).length;
  if(E.full && base === "force" && !lastOfHalf && canFullNext >= 4 && !(score[team === "CT" ? "T" : "CT"] === matchWinTarget()-1)){ te.ecoWhy = "у них фулл-бай — эко, копим на полный"; return "eco"; }
  // хаф-бай (SMG + броня) против их винтовок — худшее из двух: и раунд почти
  // не выиграть, и деньги потрачены. Про в таком случае полный эко (кроме
  // бонус-раунда после пистолетки и конца половины)
  if(E.full && base === "half" && !te.bonus && !lastOfHalf){ te.ecoWhy = "у них фулл-бай — хаф-бай не берём, полный эко"; return "eco"; }
  return base;
}
function decideRoundType0(team){
  var mates = bots.filter(function(b){ return b.team === team; });
  if(roundNum === 1 || roundNum === HALF_ROUNDS+1) return "pistol";
  // второй раунд после выигранной пистолетки — классический "бонус": не
  // винтовки на последние деньги, а SMG + броня с запасом на следующий раунд
  teamEco[team].bonus = false;
  if((roundNum === 2 || roundNum === HALF_ROUNDS+2) && teamEco[team].wonPistol){ teamEco[team].bonus = true; return "half"; }
  var canFull = mates.filter(function(b){ return b.money >= fullNeedU(b); }).length;
  // проиграли пистолетку — иногда форсят второй раунд (ПП + броня), а не эко
  var teamMoney0 = mates.reduce(function(a,b){ return a+b.money; }, 0);
  if((roundNum === 2 || roundNum === HALF_ROUNDS+2) && !teamEco[team].wonPistol && teamMoney0/mates.length >= 1700 &&
     hashRand(roundNum*97 + matchNum*13 + (team === "CT" ? 1 : 2)) < 0.45) return "force";
  // с учётом дропа: общая сумма команды покрывает полный закуп всех?
  var teamMoney = mates.reduce(function(a,b){ return a+b.money; }, 0);
  var teamNeed = mates.reduce(function(a,b){ return a+fullNeedU(b); }, 0);
  if(canFull >= 4 || (canFull >= 3 && teamMoney >= teamNeed)) return "full";
  // (v166) на винтовки и броню хватает всем, но без гранат: про всё равно
  // заходят в фулл, если следующий раунд при поражении будет опять бедным
  var canBare = mates.filter(function(b){ return b.money >= fullNeed(b); }).length;
  // если сэкономить сейчас — хватит ли на полный закуп в следующем раунде (даже при поражении)?
  var nextInc = nextLossIncome(team);
  var canFullNext = mates.filter(function(b){ return b.money + nextInc >= fullNeed(b); }).length;
  var lastOfHalf = lastOfHalfNow();
  var enemy = team === "CT" ? "T" : "CT";
  var matchPoint = score[enemy] === matchWinTarget()-1;
  if(lastOfHalf || matchPoint) return "force";          // копить уже незачем
  if(BAL.ecoUtil){ var canFullNextU = mates.filter(function(b){ return b.money + nextInc >= fullNeedU(b); }).length;
    if(canFullNextU >= 4) return canFull >= 2 ? "half" : "eco";
    if(canBare >= 4) return "full"; }
  if(canFullNext >= 4) return canFull >= 2 ? "half" : "eco";
  // даже после эко на полный не хватит — копить бессмысленно, покупаем что можем
  var avg = teamMoney / mates.length;
  return avg >= 2000 ? "force" : "eco";
}

function buyItem(b, key){
  var w = WEAPONS[key];
  if(b.money < w.price) return false;
  b.money -= w.price;
  if(w.slot === "primary") b.primary = key; else b.secondary = key;
  return true;
}
function buyArmor(b, withHelmet){
  if(!b.armor && b.money >= ARMOR_PRICE){ b.money -= ARMOR_PRICE; b.armor = true; }
  if(withHelmet && b.armor && !b.helmet && b.money >= HELMET_UPGRADE){ b.money -= HELMET_UPGRADE; b.helmet = true; }
}
// лучшая основная, которую можно купить, оставив `keep` денег; не ниже того, что уже есть
function bestPrimary(b, maxPrice, keep){
  var cur = b.primary ? WEAPONS[b.primary].tier : -1;
  var best = null;
  for(var k in WEAPONS){
    var w = WEAPONS[k];
    if(w.slot !== "primary" || !sideOk(w, b.team) || k === "AWP" || w.special) continue;
    if(w.price > maxPrice || b.money - w.price < keep) continue;
    if(w.tier <= cur) continue;
    if(!best || w.tier > best.tier) best = w;
  }
  return best;
}

function buyForPlayer(b, type, idx){
  var before = b.money;
  if(type === "pistol"){
    // половина берёт броню, половина — пистолет получше
    if(idx % 2 === 0) buyArmor(b, false);
    else buyItem(b, b.team === "T" ? "TEC9" : "P250");
  } else if(type === "full"){
    // один AWP на команду, если позволяет (снайпер — второй бот)
    if(idx === 1 && b.primary !== "AWP" && b.money >= WEAPONS.AWP.price + ARMOR_PRICE + HELMET_UPGRADE) buyItem(b, "AWP");
    var cur = b.primary ? WEAPONS[b.primary].tier : -1;
    var rifle = scopedFor(b) || rifleFor(b.team, b);
    if(cur < 6 && b.money >= rifle.price) buyItem(b, rifle.key);
    buyArmor(b, true);
    if(!b.primary || WEAPONS[b.primary].tier < 6){ var bp = bestPrimary(b, 99999, 0); if(bp) buyItem(b, bp.key); }
    if(b.team === "CT" && !b.kit && b.money >= 400 && (idx % 2 === 0 || b.money >= 400 + 750)){ b.money -= 400; b.kit = true; } // кит — дефуз 5с вместо 10с
  } else if(type === "force" && teamEco[b.team].antiEcoSmg){
    // против эко: броня + SMG ($600 за килл), винтовку — только если и так богат
    buyArmor(b, false);
    var sm = smgFor(b.team, b), cA = b.primary ? WEAPONS[b.primary].tier : -1;
    if(cA < 4){ if(b.money >= rifleFor(b.team, b).price + 1500) buyItem(b, rifleFor(b.team, b).key); else if(b.money >= sm.price) buyItem(b, sm.key); }
    buyArmor(b, true);
  } else if(type === "force"){
    // форс: кевлар + что тянет — винтовка, если хватает; нет — ПП (MAC-10 / MP9:
    // дёшево, $600 за килл, сильны вблизи); совсем мало — дигл
    buyArmor(b, false);
    var cur0 = b.primary ? WEAPONS[b.primary].tier : -1, rf = rifleFor(b.team, b), smg = smgFor(b.team, b);
    // (7) снайпер на форсе — скаут (дёшево, ваншот в голову, точен на ходу)
    var sniperRole = b.tRole === "awp" || (b.team === "CT" && b.tRole === "mid");
    if(cur0 < 5 && sniperRole && b.money < rf.price + 300 && b.money >= WEAPONS.SSG.price + ARMOR_PRICE) buyItem(b, "SSG");
    if(cur0 < 4 && !(b.primary === "SSG")){
      var wantRifle = b.money >= rf.price + 300 || (b.money >= WEAPONS[b.team === "CT" ? "FAMAS" : "GALIL"].price + 200 && hashRand(roundNum*53 + idx*7 + matchNum) < 0.35);
      if(b.money >= rf.price + 300) buyItem(b, rf.key);
      else if(wantRifle) buyItem(b, b.team === "CT" ? "FAMAS" : "GALIL");
      else if(b.money >= smg.price) buyItem(b, smg.key);
    }
    if(!b.primary && b.money >= 700 && (!b.secondary || WEAPONS[b.secondary].tier < 3)) buyItem(b, "DEAGLE");
    buyArmor(b, true);
    if(b.team === "CT" && !b.kit && b.money >= 400 && idx % 2 === 0){ b.money -= 400; b.kit = true; }
  } else if(type === "half"){
    // хаф-бай: броня + SMG/дешёвая винтовка, но оставляем деньги на следующий раунд
    var keep = teamEco[b.team].bonus ? 0 : Math.max(0, fullNeed(b) - nextLossIncome(b.team));
    if(b.money - ARMOR_PRICE >= keep) buyArmor(b, false);
    // хаф-бай — чаще ПП (как в CS: MP9/MAC-10 + броня), иногда дешёвая винтовка
    var smgH = smgFor(b.team, b);
    var hp = (hashRand(roundNum*41 + idx*13 + matchNum*7) < 0.4 && b.money - smgH.price >= keep && (!b.primary || WEAPONS[b.primary].tier < 4)) ? smgH : bestPrimary(b, 2100, keep);
    if(hp) buyItem(b, hp.key);
  } else if(type === "eco"){
    // эко: копим; максимум дешёвый пистолет, если он не ломает следующий закуп
    var keepE = fullNeed(b) - nextLossIncome(b.team);
    if(b.money - 300 >= keepE && WEAPONS[b.secondary].tier < 1) buyItem(b, "P250");
  }
  if(!b.nades) b.nades = emptyNades();
  buyNades(b, type);
  b.weapon = WEAPONS[b.primary || b.secondary];
  return before - b.money;
}

// дроп (план §4, "решение по команде, не по одному"): в фулл-бай богатый
// тиммейт покупает винтовку тому, кому на неё не хватает
function teamDrops(team){
  var mates = bots.filter(function(b){ return b.team === team; });
  mates.forEach(function(poor){
    var rifle = rifleFor(team, poor);
    var cur = poor.primary ? WEAPONS[poor.primary].tier : -1;
    if(cur >= 6 || poor.money >= rifle.price) return;
    var rich = mates.filter(function(m){ return m !== poor && m.money - rifle.price >= fullNeed(m); })
                    .sort(function(a,b){ return b.money - a.money; })[0];
    if(!rich) return;
    rich.money -= rifle.price; poor.primary = rifle.key;
    logEvent(rich.id+" дропнул "+rifle.name+" → "+poor.id);
  });
}

// AWP: у каждой команды свой снайпер (у T — роль AWP, у CT — мидер). Раньше
// AWP брал только второй по списку и только имея $5750 (AWP + полная броня) —
// у T такие деньги почти не набирались, и T не брали AWP никогда. Теперь:
// снайпер покупает сам, если хватает на AWP + кевлар; не хватает — богатый
// тиммейт покупает и скидывает ему (как в CS)
function teamAwp(team){
  var mates = bots.filter(function(b){ return b.team === team; });
  var awper = team === "T" ? mates.filter(function(b){ return b.tRole === "awp"; })[0] : mates[1];
  if(!awper || awper.primary === "AWP") return;
  var P = WEAPONS.AWP.price;
  if(awper.money >= P + ARMOR_PRICE){ awper.money -= P; awper.primary = "AWP"; return; }
  var rich = mates.filter(function(m){ return m !== awper && m.money - P >= fullNeed(m); })
                  .sort(function(a,b){ return b.money - a.money; })[0];
  if(rich){ rich.money -= P; awper.primary = "AWP"; logEvent(rich.id+" скинул AWP → "+awper.id); }
}
function buyPhase(){
  ["CT","T"].forEach(function(team){
    teamEco[team].antiEcoSmg = false;
    var type = decideRoundType(team);
    teamEco[team].roundType = type;
    if(teamEco[team].ecoWhy) logEvent(team+": "+teamEco[team].ecoWhy);
    if(type === "full") teamAwp(team);
    if(type === "full") teamDrops(team);
    var spent = 0;
    bots.filter(function(b){ return b.team === team; }).forEach(function(b, i){ spent += buyForPlayer(b, type, i); });
    logEvent(team+": "+ROUND_TYPE_LABEL[type]+" (потрачено $"+spent+")");
  });
}

function startHalf(silent){
  foeEcoHalf();
  bots.forEach(function(b){
    b.money = START_MONEY; b.primary = null; b.secondary = b.team==="CT" ? "USP" : "GLOCK";
    b.armor = false; b.helmet = false; b.kit = false; b.weapon = WEAPONS[b.secondary]; b.nades = emptyNades();
  });
  teamEco.CT.lossLevel = 1; teamEco.T.lossLevel = 1;
  if(!silent) logEvent("ВТОРАЯ ПОЛОВИНА — деньги сброшены до $"+START_MONEY, "round");
}
// (v152) воспроизводимый старт: всё, что влияет на решения ботов, — с нуля.
// Кэши чистим целиком: часть ключей содержит tick, и после сброса tick старые
// записи прошлого матча подставлялись бы в новый.
function freshMatch(n){
  paused = true;
  tick = 0; simTime = 0; roundStartTick = 0;
  var clr = function(o){ for(var k in o) delete o[k]; };
  [_ED, EWL, APPEAR, nadeFlags, comboCd].forEach(function(o){ if(o) clr(o); });
  tracers.length = 0; soundPings.length = 0; nadesInAir.length = 0; smokes.length = 0; fires.length = 0; nadeFx.length = 0;
  groundWeapons.length = 0; events.length = 0; killfeed.length = 0;
  LAST_CLEAR = {CT:{}, T:{}};
  if(typeof beliefReset === "function") beliefReset();
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
  foeReset();
  score.CT = 0; score.T = 0;
  roundNum = 0;
  bots.forEach(function(b){ b.kills = 0; b.deaths = 0; });
  startHalf(true);
  logEvent("Новый матч #"+matchNum, "round");
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
    b.path = []; b.pathIdx = 0; b.alive = true; b.hp = 100;
    b.pickTick = -999; b.contactStreak = 0; b.nextShotTick = 0;
    b.state = "patrol"; b.decisionTick = -999; b.holding = false; b.forcedRetreat = false;
    b.facing = undefined; b.heading = undefined; b.curSpeed = 0; b.crouching = false; b.holdSinceTick = -999; b.onStairs = false;
    b.lastIntel = null; b.walking = false; b.lastStepTick = -999; b.heardSound = null; b.ears = []; b._heardReload = null;
    b.burstCount = 0; b._fire = null; b.lastShotTick = -999; b._ammoFor = null; b._reloading = false; b._onPistol = null; b._secAmmo = null; b._blind = null; b._ds = null; b._trail = []; b._tagUntil = 0; b._knife = false; b._drawUntil = 0; b.peekType = null; b.peekSinceTick = 0; b.stuckTicks = 0; b._flashAway = null; b._actCd = null;
    b._prevOffX = 0; b._prevOffY = 0; b.lookTarget = null; b.lookReason = null;
    initRoam(b);
  });
  tracers.length = 0;
  ["CT","T"].forEach(function(t){ ROAM_ROUTES[t].forEach(function(p){ p.cleared = -99999; }); });
  // freeze-тайм (план §8): закуп и расстановка, никто не двигается. Таймер
  // раунда (1:55) и тайминги тактик отсчитываются от его конца.
  var FZ = BAL.freeze;
  roundState = FZ > 0 ? "freeze" : "live";
  roundStartTime = simTime + FZ; roundStartTick = tick + Math.round(FZ*TICK_HZ);
  // киллфид — только текущий раунд
  killfeed.length = 0; renderFeed();
  resetTeamIntel();
  pointsApplyPending();   // точки углов, поправленные на странице, — с нового раунда
  beliefReset();
  clutchShown = null; clutchInfo = null;
  bots.forEach(function(b){ b.roundKills = 0; b.roundDmg = 0; b._dmgBy = {}; b._blindBy = null; b.post = null; b.atPost = false; b.planting = false; b.defusing = false; b._saveSpot = null; b._huntIdx = undefined; b._huntArrive = 0; b._lurkIdx = 0; b._lurkArr = 0; b._lurkPh = undefined; });
  resetNades();
  buyPhase();
  resetBomb();
  chooseTactic();
  logEvent("Раунд "+roundNum+" начался", "round");
}

