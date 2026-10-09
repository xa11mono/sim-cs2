// ======================= ЗАКУП КОМАНДЫ: тип раунда и что берёт каждый (аудит п. 5, v217) =======================
// Одно место на «что команда покупает» (docs/PRO_PLAY.md 4; заменило заглушку stubBuy из 12_stub.js).
// Как у про: команда покупает ВМЕСТЕ — решение одно на всех, по деньгам каждого и бонусу за проигрыш:
//   фулл-бай  — 4+ могут взять винтовку, броню со шлемом и утилиту (CT — ещё кит);
//   эко       — не могут, но если сейчас не тратиться, в следующем раунде (с бонусом за проигрыш) 4+ смогут;
//               оружие с прошлого раунда остаётся; AWP-роль, у которой хватает и на AWP сейчас, и на фулл
//               потом, — хиро-бай (ProSettings: редкий, один берёт сильное оружие, остальные сейвят);
//   хаф-бай   — второй раунд после выигранного пистолетного: SMG/дешёвая винтовка + броня (анти-эко);
//   форс      — сейв не поможет (и в следующем раунде на фулл не хватит) или раунд надо выиграть
//               (соперник в шаге от победы в матче / последний раунд половины): лучшее, что по карману.
// AWP — AWP-роль в фулл-бае, если хватает на AWP + броню + утилиту (у про AWP в фулл-бае: CT 73 %, T 47 %).
// Числа сравнения — tools/measure (доли типов у про: фулл CT 65 % / T 63 %, форс/хаф 14 / 13 %, эко 13 / 17 %).
// Гранаты под сценарий и «себе» покупаются потом (scrBuyUtility, stubSelfNades) — не ниже b._buyFloor
// (на эко — чтобы хватило на фулл в следующем раунде).

var BUY = {
  util: 500          // $ на минимум утилиты в фулл-бае (дым + флешка) — проектное число
};
var BUY_RIFLE = {T: "AK", CT: "M4"};
var BUY_CHEAP = {T: ["GALIL", "MAC10"], CT: ["FAMAS", "MP9"]};   // форс / хаф-бай: дешёвая винтовка, иначе ПП
var BUY_LOG = [];

function buyArmorCost(b, helmet){ return (b.armor ? 0 : ARMOR_PRICE) + (helmet && !b.helmet ? HELMET_UPGRADE : 0); }
function buyHasRifle(b){ return !!(b.primary && WEAPONS[b.primary].tier >= 6); }
// сколько нужно игроку на фулл-бай (с тем, что у него уже есть)
function buyFullCost(b){
  return (buyHasRifle(b) ? 0 : WEAPONS[BUY_RIFLE[b.team]].price) + buyArmorCost(b, true) + BUY.util + (b.team === "CT" && !b.kit ? KIT_PRICE : 0);
}
// бонус, если этот раунд проиграем
function buyLossIncome(team){ return LOSS_BONUS[Math.min(4, teamEco[team].lossLevel)]; }
function buyMustWin(team){
  var other = team === "CT" ? "T" : "CT";
  return score[other] >= MATCH_WIN - 1 || roundNum === HALF_ROUNDS || roundNum === regRounds();
}

// решение команды и закуп каждого; возвращает тип раунда (teamEco.roundType)
function buyTeam(team){
  var T = bots.filter(function(b){ return b.team === team; });
  T.forEach(function(b){ b._buyFloor = 0; });
  if(roundNum === 1 || roundNum === HALF_ROUNDS + 1){ T.forEach(buyPistol); return "pistol"; }
  var loss = buyLossIncome(team);
  var canFull = T.filter(function(b){ return b.money >= buyFullCost(b); }).length;
  var nextFull = T.filter(function(b){ return b.money + loss >= buyFullCost(b); }).length;
  var wonLast = teamEco[team].lossLevel === 0 || teamEco[team].lastWin;
  var type, why;
  if(canFull >= 4){ type = "full"; why = canFull + " из 5 могут фулл"; }
  else if((roundNum === 2 || roundNum === HALF_ROUNDS + 2) && wonLast){ type = "half"; why = "выиграли пистолетный — анти-эко"; }
  else if(nextFull >= 4 && !buyMustWin(team)){ type = "eco"; why = "сейчас фулл у " + canFull + ", после сейва — у " + nextFull; }
  else { type = "force"; why = buyMustWin(team) ? "раунд надо выиграть" : "сейв не поможет: после сейва фулл только у " + nextFull; }
  var hero = null;
  T.forEach(function(b){
    if(type === "full") buyFull(b);
    else if(type === "force") buyForce(b);
    else if(type === "half") buyHalf(b, loss);
    else {   // эко: своё оружие остаётся; AWP-роль, если хватает и сейчас, и на фулл потом, — хиро-бай
      var awp = WEAPONS.AWP.price + buyArmorCost(b, false);
      if(b.role === "awp" && !b.primary && b.money >= awp && b.money - awp + loss >= buyFullCost(b)){
        buyItem(b, "AWP"); buyArmor(b, false); hero = b;
      } else if(buyHasRifle(b) && b.money - buyArmorCost(b, false) + loss >= BUY.util + ARMOR_PRICE) buyArmor(b, false);
      b._buyFloor = Math.max(0, buyFullCost(b) - loss);
    }
  });
  if(hero){ type = "hero"; why += "; " + hero.id + " — AWP"; }
  BUY_LOG.push({round: roundNum, team: team, type: type, why: why});
  logEvent("Закуп " + team + ": " + ROUND_TYPE_LABEL[type] + " — " + why, "info");
  return type;
}
// пистолетный: кевлар (не хватает — P250) — как было в заглушке
function buyPistol(b){
  if(!b.armor && b.money >= ARMOR_PRICE) buyArmor(b, false);
  else if(b.secondary !== "P250") buyItem(b, "P250");
}
// фулл: AWP-роль — AWP, если хватает с бронёй и утилитой; винтовка; броня со шлемом; CT — кит
function buyFull(b){
  var awpCost = WEAPONS.AWP.price + buyArmorCost(b, true) + BUY.util;
  if(b.role === "awp" && b.primary !== "AWP" && b.money >= awpCost) buyItem(b, "AWP");
  else if(!buyHasRifle(b)){
    if(b.money >= WEAPONS[BUY_RIFLE[b.team]].price + buyArmorCost(b, false)) buyItem(b, BUY_RIFLE[b.team]);
    else buyCheap(b, buyArmorCost(b, false));   // не хватает на винтовку — что по карману (тиммейты не дропают — заплатка)
  }
  buyArmor(b, true);
  if(b.team === "CT" && !b.kit && b.money >= KIT_PRICE + BUY.util/2){ b.money -= KIT_PRICE; b.kit = true; }
}
// форс: лучшее, что по карману, с кевларом
function buyForce(b){
  if(!b.primary){
    if(b.money >= WEAPONS[BUY_RIFLE[b.team]].price + ARMOR_PRICE) buyItem(b, BUY_RIFLE[b.team]);
    else buyCheap(b, ARMOR_PRICE);
  }
  buyArmor(b, b.money >= HELMET_UPGRADE + ARMOR_PRICE + BUY.util);
}
// хаф-бай: дешёвое оружие + кевлар, не трогая денег на фулл в следующем раунде
function buyHalf(b, loss){
  b._buyFloor = Math.max(0, buyFullCost(b) - WIN_REWARD);   // если выиграем — фулл; проиграем — как получится
  if(!b.primary){
    var list = BUY_CHEAP[b.team].slice().reverse();   // сначала ПП (дешевле)
    for(var i = 0; i < list.length; i++){
      var w = WEAPONS[list[i]];
      if(b.money - w.price - ARMOR_PRICE >= b._buyFloor){ buyItem(b, list[i]); break; }
    }
  }
  if(b.money - ARMOR_PRICE >= b._buyFloor) buyArmor(b, false);
}
function buyCheap(b, keep){
  var list = BUY_CHEAP[b.team];
  for(var i = 0; i < list.length; i++){
    if(b.money >= WEAPONS[list[i]].price + keep){ buyItem(b, list[i]); return true; }
  }
  return false;
}
