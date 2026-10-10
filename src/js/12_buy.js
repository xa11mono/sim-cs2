// ======================= ЗАКУП КОМАНДЫ: тип раунда и что берёт каждый (аудит п. 5, v217) =======================
// Одно место на «что команда покупает» (docs/PRO_PLAY.md 4; заменило заглушку stubBuy из 12_stub.js).
// Как у про: команда покупает ВМЕСТЕ — решение одно на всех (buyDecide, v237 — правила v166: фулл / хаф / форс / эко,
// бонус после пистолетки, оценка денег соперника), с дропом винтовок бедным и AWP снайперу (buyAwp).
// AWP — снайпер в фулл-бае, сам или дропом (у про AWP в фулл-бае: CT 73 %, T 47 %).
// Числа сравнения — tools/measure (доли типов у про: фулл CT 65 % / T 63 %, форс/хаф 14 / 13 %, эко 13 / 17 %).
// Гранаты под сценарий покупаются потом (scrBuyUtility), «себе» — buySelfNades (v237, из v166) — не ниже b._buyFloor
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
  // дроп (v218): богатые покупают винтовки бедным (csdb: «rich players buy for poor players»); AWP — buyAwp (v237, как в v166)
  var plan = buyDropPlan(T, false);
  var d = buyDecide(team, T, plan, loss), type = d.type, why = d.why;
  var hero = null;
  if(type === "full"){ buyAwp(T); buyDrops(plan); }   // AWP снайперу (сам или дроп), оружие тем, кому дропают, — потом каждый докупает своё
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
// ---------- тип раунда (v237, перенос из v166: decideRoundType + оценка денег соперника) ----------
// Как в v166 (там экономика по замерам ближе к про: фулл CT 62 %, гранат CT 9,5 за раунд):
//  • второй раунд после выигранного пистолетного — хаф (бонус); после проигранного — иногда форс (ПП + броня);
//  • фулл — 4+ тянут винтовку, броню и гранаты, или 3+ и денег команды хватает на всех (с дропом);
//  • последний раунд половины / соперник в шаге от победы — форс (копить незачем);
//  • после сейва 4+ смогут фулл с гранатами — хаф (если 2+ тянут сейчас) или эко; 4+ тянут без гранат — всё равно фулл;
//  • иначе: в среднем ≥ $2000 — форс, меньше — эко.
// Деньги соперника — как считают про: по лосс-бонусу и сохранённому оружию; у нас — реальная средняя ±$500 (v166):
// у них эко, а мы на эко/хафе — SMG (форс против эко); у них фулл, а мы собирались форсить и после эко хватит — эко.
// Вероятности и суммы — из v166 (проектные числа)
var BUY_ECO = {lostPistolForce: 0.45, lostPistolAvg: 1700, forceAvg: 2000, guessErr: 1000, eFullAvg: 4200, eEcoAvg: 2300};
function buyBare(b){ return (buyHasRifle(b) ? 0 : WEAPONS[BUY_RIFLE[b.team]].price) + buyArmorCost(b, true); }
function buyEnemyGuess(team){
  var en = team === "CT" ? "T" : "CT", ms = bots.filter(function(b){ return b.team === en; });
  var avg = ms.reduce(function(a, b){ return a + b.money; }, 0)/Math.max(1, ms.length);
  var guns = ms.filter(function(b){ return b.primary && WEAPONS[b.primary].tier >= 5; }).length;
  avg += (hashRand(roundNum*557 + matchNum*19 + (team === "CT" ? 1 : 2)) - 0.5)*BUY_ECO.guessErr;
  var full = guns >= 3 || avg >= BUY_ECO.eFullAvg;
  return {full: full, eco: !full && guns <= 1 && avg < BUY_ECO.eEcoAvg};
}
function buyDecide(team, T, plan, loss){
  var n = T.length || 1, money = T.reduce(function(a, b){ return a + b.money; }, 0), avg = money/n;
  var canFull = plan.equipped, need = T.reduce(function(a, b){ return a + buyFullCost(b); }, 0);
  var canBare = T.filter(function(b){ return b.money >= buyBare(b); }).length;
  var nextFull = T.filter(function(b){ return b.money + loss >= buyFullCost(b); }).length;
  var second = roundNum === 2 || roundNum === HALF_ROUNDS + 2, E = buyEnemyGuess(team), base, why;
  if(second && teamEco[team].wonPistol){ base = "half"; why = "выиграли пистолетный — хаф (бонус)"; }
  else if(second && avg >= BUY_ECO.lostPistolAvg && hashRand(roundNum*97 + matchNum*13 + (team === "CT" ? 1 : 2)) < BUY_ECO.lostPistolForce){ base = "force"; why = "проиграли пистолетный — форс"; }
  else if(canFull >= 4 || (canFull >= 3 && money >= need)){ base = "full"; why = canFull + " из " + n + " в фулле" + (plan.drops.length ? " (с дропом)" : ""); }
  else if(buyMustWin(team)){ base = "force"; why = "раунд надо выиграть"; }
  else if(nextFull >= 4){ base = canFull >= 2 ? "half" : "eco"; why = "после сейва фулл у " + nextFull; }
  else if(canBare >= 4){ base = "full"; why = "винтовки и броня у " + canBare + " (без гранат)"; }
  else { base = avg >= BUY_ECO.forceAvg ? "force" : "eco"; why = "после сейва фулл только у " + nextFull + ", в среднем $" + Math.round(avg); }
  if(E.eco && (base === "eco" || base === "half") && avg >= 1500){ base = "force"; why += "; у них эко — SMG"; }
  else if(E.full && base === "force" && !buyMustWin(team) && nextFull >= 4){ base = "eco"; why += "; у них фулл — копим"; }
  else if(E.full && base === "half" && !teamEco[team].wonPistol && !buyMustWin(team)){ base = "eco"; why += "; у них фулл — не хаф, эко"; }
  return {type: base, why: why};
}
// AWP (v237, перенос из v166 teamAwp): снайпер покупает сам, если хватает на AWP + кевлар; нет — богатый тиммейт, у
// которого после этого останется на свой фулл, покупает и скидывает (как в CS)
function buyAwp(T){
  var a = T.filter(function(b){ return b.role === "awp"; })[0], P = WEAPONS.AWP.price;
  if(!a || a.primary === "AWP") return;
  if(a.money >= P + ARMOR_PRICE){ a.money -= P; a.primary = "AWP"; return; }
  var rich = T.filter(function(m){ return m !== a && m.money - P >= buyFullCost(m); }).sort(function(x, y){ return y.money - x.money; })[0];
  if(rich){ rich.money -= P; a.primary = "AWP"; logEvent("Дроп: " + nick(rich.id) + " → " + nick(a.id) + " (AWP)", "info"); }
}
// ---------- гранаты «себе» (v237, перенос из v166 buyNades; было — заплатка stubSelfNades) ----------
// У про на фулле почти каждый берёт 3–4 гранаты (CT кидают ~10 за раунд, T ~9,4); набор — по роли (v166, по демкам того
// времени). Фулл — до 4 штук, форс/хаф — до 2, эко/пистолетка — 1 (без молотова; на эко — не ниже денег на следующий фулл).
// Покупается после гранат сценария и утилиты по времени — на то, что осталось
var BUY_NADES = {
  entry: ["flash", "flash", "smoke", "molly"], support: ["flash", "smoke", "molly", "he"], igl: ["smoke", "molly", "flash", "flash"],
  lurker: ["smoke", "flash", "molly", "he"], awp: ["smoke", "flash", "molly", "he"],
  anchor: ["molly", "smoke", "flash", "he"], rotator: ["smoke", "flash", "he", "molly"], mid: ["flash", "smoke", "he", "molly"], roamer: ["flash", "smoke", "he", "molly"]
};
var BUY_CT_WISH = {anchor: "anchor", support: "rotator", entry: "roamer", awp: "mid"};
function buySelfNades(){
  bots.forEach(function(b){
    if(!b.alive || !b.nades) return;
    var N = b._selfN = {flash: 0, molly: 0, smoke: 0, he: 0};   // купленные себе (не под сценарий) — 13_nades.js selfLeft
    var type = teamEco[b.team].roundType;
    var key = b.team === "CT" ? (BUY_CT_WISH[b.role] || "rotator") : (b.igl ? "igl" : b.role || "support");
    var wish = BUY_NADES[key] || BUY_NADES.support;
    var budget = type === "full" || type === "hero" ? 99 : type === "force" || type === "half" ? 2 : 1;
    var bought = 0;
    for(var i = 0; i < wish.length && bought < budget; i++){
      var t = wish[i];
      if((type === "eco" || type === "pistol") && t === "molly") continue;
      if(type !== "full" && type !== "hero" && type !== "pistol" && b.money - nadePrice(b, t) < 200) continue;
      if(buyNade(b, t)){ N[t]++; bought++; }
    }
    if((b.team === "CT" || (bomb && bomb.carrier === b)) && b.nades.smoke === 0 && buyNade(b, "smoke")) N.smoke++;   // смок под дефуз / плант
  });
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
