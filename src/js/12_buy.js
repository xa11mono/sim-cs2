// ======================= ЗАКУП КОМАНДЫ: тип раунда и что берёт каждый (аудит п. 5, v217) =======================
// Одно место на «что команда покупает» (docs/PRO_PLAY.md 4; заменило заглушку stubBuy из 12_stub.js).
// Как у про: команда покупает ВМЕСТЕ — решение одно на всех, по деньгам каждого и бонусу за проигрыш:
//   фулл-бай  — 4+ могут взять винтовку, броню со шлемом и утилиту (CT — ещё кит) — с дропом: богатые
//               покупают оружие бедным, AWP-игроку — первым (v218, csdb economy guide);
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
  // дроп (v218): богатые покупают оружие бедным, AWP-игроку — в первую очередь (csdb: «rich players buy for
  // poor players», «teams usually drop for their AWPer»). План — с AWP, если команда тянет, иначе без
  var plan = buyDropPlan(T, true);
  if(plan.equipped < 4) plan = buyDropPlan(T, false);
  var canFull = plan.equipped;
  var nextFull = T.filter(function(b){ return b.money + loss >= buyFullCost(b); }).length;
  var wonLast = teamEco[team].lossLevel === 0 || teamEco[team].lastWin;
  var type, why;
  if(canFull >= 4){ type = "full"; why = canFull + " из 5 в фулле" + (plan.drops.length ? " (с дропом: " + plan.drops.map(function(d){ return d.from.id + "→" + d.to.id + " " + d.key; }).join(", ") + ")" : ""); }
  else if((roundNum === 2 || roundNum === HALF_ROUNDS + 2) && wonLast){ type = "half"; why = "выиграли пистолетный — анти-эко"; }
  else if(nextFull >= 4 && !buyMustWin(team)){ type = "eco"; why = "сейчас фулл у " + canFull + ", после сейва — у " + nextFull; }
  else { type = "force"; why = buyMustWin(team) ? "раунд надо выиграть" : "сейв не поможет: после сейва фулл только у " + nextFull; }
  var hero = null;
  if(type === "full") buyDrops(plan);   // сначала оружие тем, кому дропают, — потом каждый докупает своё
  T.forEach(function(b){
    if(type === "full") buyFull(b, plan);
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
// оружие, которое игрок хочет в фулл-бае: AWP-роль — AWP (если план с AWP), остальные — винтовка
function buyWant(b, withAwp){ return b.role === "awp" && withAwp ? "AWP" : BUY_RIFLE[b.team]; }
function buyHasWant(b, key){ return key === "AWP" ? b.primary === "AWP" : buyHasRifle(b); }
// план дропа: кому не хватает на своё оружие (и хотя бы кевлар) — оружие покупает тот, у кого после своего
// фулла остаётся больше всех; AWP-игроку — первым. equipped — сколько будет в фулле
function buyDropPlan(T, withAwp){
  var left = {}, drops = [], eq = 0;
  T.forEach(function(b){
    var key = buyWant(b, withAwp), own = (buyHasWant(b, key) ? 0 : WEAPONS[key].price) + buyArmorCost(b, true) + BUY.util + (b.team === "CT" && !b.kit ? KIT_PRICE : 0);
    left[b.id] = b.money - own;
  });
  var need = T.filter(function(b){ return left[b.id] < 0; })
    .sort(function(a, c){ return (c.role === "awp") - (a.role === "awp") || left[c.id] - left[a.id]; });
  need.forEach(function(b){
    var key = buyWant(b, withAwp);
    if(buyHasWant(b, key)) return;
    var price = WEAPONS[key].price;
    if(left[b.id] + price < ARMOR_PRICE - buyArmorCost(b, true) - BUY.util - (b.team === "CT" && !b.kit ? KIT_PRICE : 0)) return;   // и кевлар не потянет
    var giver = null;
    T.forEach(function(g){ if(g !== b && left[g.id] >= price && (!giver || left[g.id] > left[giver.id])) giver = g; });
    if(!giver) return;
    left[giver.id] -= price; left[b.id] += price;
    drops.push({from: giver, to: b, key: key});
  });
  T.forEach(function(b){ if(left[b.id] >= -BUY.util) eq++; });   // оружие, броня со шлемом (CT — и кит); без утилиты — ещё фулл
  return {withAwp: withAwp, drops: drops, equipped: eq};
}
function buyDrops(plan){
  plan.drops.forEach(function(d){
    var w = WEAPONS[d.key];
    if(d.from.money < w.price || d.to.primary === d.key) return;
    d.from.money -= w.price; d.to.primary = d.key;
    logEvent("Дроп: " + nick(d.from.id) + " → " + nick(d.to.id) + " (" + w.name + ")", "info");
  });
}
// фулл: своё оружие по плану (AWP-роль — AWP, если план с AWP), броня со шлемом, CT — кит
function buyFull(b, plan){
  var key = buyWant(b, plan.withAwp);
  if(!buyHasWant(b, key)){
    if(b.money >= WEAPONS[key].price + buyArmorCost(b, false)) buyItem(b, key);
    else if(!buyHasRifle(b) && b.money >= WEAPONS[BUY_RIFLE[b.team]].price + buyArmorCost(b, false)) buyItem(b, BUY_RIFLE[b.team]);
    else if(!b.primary) buyCheap(b, buyArmorCost(b, false));   // и с дропом не хватило — что по карману
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
