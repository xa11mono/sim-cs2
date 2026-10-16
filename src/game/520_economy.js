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
    // T проиграли, но успели заложить бомбу — каждому +$600 к loss bonus (CS2, с 23.05.2024; было $800)
    if(!won && team === "T" && bomb && (bomb.state === "planted" || bomb.state === "defused")) income += 600;
    bots.forEach(function(b){
      if(b.team !== team) return;
      var inc = income;
      if(!won && team === "T" && reason === "time" && b.alive) inc = 0;
      b.money = Math.min(MAX_MONEY, b.money + inc);
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
  if(BAL.moreWeapons && b && hashRand(pHash(b.id)*7 + 3) < 0.5) return WEAPONS.M4S;
  return WEAPONS.M4;
}
// (v271) какое ПП берут — доли у про на форсах (tools/buy_pro.py, data/pro/buys.json): CT — MP9 90%, MP7 7%;
// T — MAC-10 87%, MP7 10%, UMP 2% (было: UMP 25%, MP7 20% у всех — у про UMP почти не берут)
function smgFor(team, b){
  if(BAL.moreWeapons && b){ var h = hashRand(pHash(b.id)*11 + roundNum*3 + 5);
    if(team === "CT"){ if(h < 0.07) return WEAPONS.MP7; }
    else { if(h < 0.10) return WEAPONS.MP7; if(h < 0.12) return WEAPONS.UMP; } }
  return team === "CT" ? WEAPONS.MP9 : WEAPONS.MAC10;
}
// (v271) пистолет на эко / форсе без основного — доли у про (tools/buy_pro.py); null — остаётся стартовый
var PRO_PISTOL = {
  eco:   {CT:[["FIVE7",0.32],["DEAGLE",0.21],["P250",0.06]], T:[["TEC9",0.34],["DEAGLE",0.255],["P250",0.08]]},
  force: {CT:[["FIVE7",0.44],["DEAGLE",0.21],["P250",0.03]], T:[["TEC9",0.42],["DEAGLE",0.24],["P250",0.06]]}
};
function proPistol(b, kind, salt){
  var L = PRO_PISTOL[kind][b.team], h = hashRand(pHash(b.id)*17 + roundNum*7 + matchNum*3 + salt), acc = 0;
  for(var i = 0; i < L.length; i++){ acc += L[i][1]; if(h < acc) return L[i][0]; }
  return null;
}
function pHash(id){ var h = 0; for(var i=0;i<id.length;i++) h = (h*31 + id.charCodeAt(i)) % 100003; return h; }
// сколько не хватает до полного закупа (винтовка + кевлар/шлем) с учётом того, что уже есть
function fullNeedU(b){ return fullNeed(b) + (b.team === "CT" ? 500 : 300); } // + гранаты
function fullNeed(b){
  var need = 0;
  var cur = b.primary ? WEAPONS[b.primary] : null;
  if(!cur || cur.tier < 6) need += rifleFor(b.team).price;
  var ahp = armorHpOf(b);   // (v357) прочность ниже тесного порога — броню докупать
  if(ahp < ARMOR_REBUY.tight) need += ARMOR_PRICE + (b.helmet ? 0 : HELMET_UPGRADE);
  else if(!b.helmet) need += HELMET_UPGRADE + (ahp < 100 ? ARMOR_PRICE : 0);
  return need;
}
function nextLossIncome(team){ return LOSS_BONUS[Math.min(4, teamEco[team].lossLevel)]; }

// оценка денег соперника: про считают по лосс-бонусу и тому, что те сохранили;
// у нас — реальная средняя сумма с погрешностью ±$500 (не телепатия, а подсчёт)
function enemyEcoGuess(team){
  var en = team === "CT" ? "T" : "CT", ms = bots.filter(function(b){ return b.team === en; });
  var avg = ms.reduce(function(a, b){ return a + b.money; }, 0) / Math.max(1, ms.length);
  var guns = ms.filter(function(b){ return b.primary && WEAPONS[b.primary].tier >= 5; }).length; // сохранили винтовки
  avg += (hashRand(roundNum*557 + matchNum*19 + (team === "CT" ? 1 : 2)) - 0.5)*1000;
  var full = guns >= 3 || avg >= 4200;
  var eco = !full && guns <= 1 && avg < 2300;
  return {avg:avg, full:full, eco:eco, guns:guns};
}
function decideRoundType(team){
  var base = decideRoundType0(team);
  if(!BAL.ecoRead || base === "pistol") return base;
  var E = enemyEcoGuess(team), te = teamEco[team];
  te.enemyGuess = E; // оценка ДО закупа — по ней CT потом решают "играем против эко"
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
  // сэкономим — хватит ли на полный закуп с гранатами в следующем раунде (даже при поражении)?
  var nextInc = nextLossIncome(team);
  var canFullNext = mates.filter(function(b){ return b.money + nextInc >= fullNeedU(b); }).length;
  var lastOfHalf = lastOfHalfNow();
  var enemy = team === "CT" ? "T" : "CT";
  var matchPoint = score[enemy] === matchWinTarget()-1;
  if(lastOfHalf || matchPoint) return "force";          // копить уже незачем
  // (v251) на винтовки и броню хватает четверым, не хватает только на гранаты —
  // про заходят в фулл, гранаты на остаток (CT после проигранного фулла снова
  // в фулле 55 %, в эко 21 %, tools/ct_cmp.py). Раньше эта проверка стояла после
  // «копим на следующий раунд» и не срабатывала никогда: кому хватает сейчас,
  // тому хватит и после эко.
  var canBare = mates.filter(function(b){ return b.money >= fullNeed(b); }).length;
  if(canBare >= 4) return "full";
  if(canFullNext >= 4) return canFull >= 2 ? "half" : "eco";
  // даже после эко на полный не хватит — копить бессмысленно, покупаем что можем
  var avg = teamMoney / mates.length;
  return avg >= 2000 ? "force" : "eco";
}

// (v321, М14) что видно в закупку: дропы своим, старое оружие на земле, боты смотрят по сторонам
var FREEZE_FX = [];
// (v334, М59, владелец) продать можно только то, что сам купил в этом раунде, в закупку и ещё SELL_SEC с после неё — за полную цену
// (как в CS2). Купленное в этом раунде — b._bought {ключ: раунд}
var SELL_SEC = 20;
function canSell(b, key){
  if(!key || !b._bought || b._bought[key] !== roundNum) return false;
  if(roundState === "freeze") return true;
  var sp = b.team === "T" ? T_SPAWN : CT_SPAWN;   // и только в зоне закупа (у своего спавна, 350 ед. карты — проектное число)
  return roundState === "live" && simTime - roundStartTime <= SELL_SEC && sp && Math.hypot(b.x-sp.x, b.y-sp.y) < 350;
}
function sellItem(b, key){
  if(!canSell(b, key)) return false;
  b.money += WEAPONS[key].price; delete b._bought[key];
  if(roundState === "freeze") FREEZE_FX.push({kind:"sell", from:b.id, key:key, t:tick});
  logEvent(b.id+" продал "+WEAPONS[key].name+" (+$"+WEAPONS[key].price+")");
  return true;
}
function buyItem(b, key){
  var w = WEAPONS[key];
  if(b.money < w.price) return false;
  b.money -= w.price;
  // купил основное поверх старого: купленное в этом раунде — продаёт, иначе старое падает под ноги (как в CS2)
  if(w.slot === "primary" && b.primary && b.primary !== key && WEAPONS[b.primary] && !sellItem(b, b.primary)){
    groundWeapons.push({key:b.primary, x:b.x + 6, y:b.y + 6, t:tick, from:b.id});
    FREEZE_FX.push({kind:"throw", from:b.id, key:b.primary, t:tick});
  }
  if(w.slot === "primary") b.primary = key; else b.secondary = key;
  (b._bought || (b._bought = {}))[key] = roundNum;
  return true;
}
// (v357) броня с прочностью: выжил — броня и каска остаются с тем, что осталось. Докупка — всегда $650 до 100 (частичной нет),
// если прочность ниже порога ARMOR_REBUY (оценка аналитики: фулл 90, тесный фулл 60, форс/хаф 40; на эко не докупают).
// Каска $350 — только к целой (100) броне, иначе сначала докупка (источники расходятся; так в вики CS)
var ARMOR_REBUY = {full:90, tight:60, force:40, half:40, eco:0, pistol:1};
function armorHpOf(b){ if(b.armorHp == null) b.armorHp = b.armor ? 100 : 0; return b.armorHp; }
function buyArmor(b, withHelmet, below){
  var hp = armorHpOf(b); if(below == null) below = 1;
  if((hp < below || (withHelmet && !b.helmet && hp < 100)) && b.money >= ARMOR_PRICE){ b.money -= ARMOR_PRICE; b.armor = true; b.armorHp = 100; }
  if(withHelmet && b.armor && b.armorHp >= 100 && !b.helmet && b.money >= HELMET_UPGRADE){ b.money -= HELMET_UPGRADE; b.helmet = true; }
}
// каска по таблице (ответ Claude, JSON helmet_decision_table): T на фулле — всегда (M4 в каску с одного выстрела не убивает);
// на форсе/хафе против фулла CT — без каски. CT против фулла T (AK в голову убивает и в каске) — на фулле берут, но каску
// режут раньше гранат и кита, на форсе/хафе — без; против эко/форса T — всегда (пистолеты и ПП без каски убивают в голову)
function helmetWanted(b, type){
  var eg = teamEco[b.team].enemyGuess || {};
  if(type === "eco" || type === "pistol") return false;
  if(teamEco[b.team].antiEcoSmg) return true;
  if(type === "force" || type === "half") return !eg.full;
  return true;
}
// (v357) фулл-бай: набор роли целиком (оружие, броня, каска, кит, гранаты); денег не хватает — режем по порядку из JSON
// cut_priority (сначала то, без чего раунд играется легче всего): T — HE, вторая флешка (у энтри — после молотова), молотов,
// AK → Galil, каска, первая флешка, смок; кевлар не режется. CT — HE, вторая флешка, каска (против фулла T), кит третьему и
// дальше, зажигалка (не у опорника), M4 → FAMAS, первая флешка, смок, первые 2 кита, каска (против эко), зажигалка опорника
function buyFullKit(b, idx){
  var T = b.team === "T", eg = teamEco[b.team].enemyGuess || {}, mates = bots.filter(function(m){ return m.team === b.team; });
  var hp = armorHpOf(b), cur = b.primary ? WEAPONS[b.primary] : null;
  var wantAwp = idx === 1 && b.primary !== "AWP" && b.money >= WEAPONS.AWP.price + ARMOR_PRICE + HELMET_UPGRADE && !mates.some(function(m){ return m.primary === "AWP"; });
  var rifle = rifleFor(b.team, b), cheap = WEAPONS[T ? "GALIL" : "FAMAS"];
  var P = {weapon: wantAwp ? WEAPONS.AWP : (cur && cur.tier >= 6 ? null : rifle), refill: hp < ARMOR_REBUY.tight, top: hp >= ARMOR_REBUY.tight && hp < ARMOR_REBUY.full,
           helmet: !b.helmet, kit: !T && !b.kit && !wantAwp && b.primary !== "AWP", nades: []};
  var kitN = mates.filter(function(m){ return m !== b && m.kit; }).length;
  var kitKey = (b.primary === "AWP" || wantAwp) ? "awp" : (b.tRole === "awp" ? "support" : b.tRole);   // снайпер без AWP — набор саппорта
  var have = {smoke:b.nades.smoke, flash:b.nades.flash, molly:b.nades.molly, he:b.nades.he}, fN = 0;
  (NADE_WISH_PRO[kitKey] || []).forEach(function(t){
    var tag = t === "flash" ? (++fN === 1 ? "flash1" : "flash2") : t;
    if(have[t] > 0){ have[t]--; return; }
    P.nades.push({t:t, tag:tag});
  });
  var cost = function(){ var c = (P.weapon ? P.weapon.price : 0) + (P.refill || P.top ? ARMOR_PRICE : 0);
    if(P.helmet) c += HELMET_UPGRADE + (!(P.refill || P.top) && hp < 100 ? ARMOR_PRICE : 0);
    if(P.kit) c += 400; P.nades.forEach(function(n){ c += nadePrice(n.t, b.team); }); return c; };
  var dropN = function(tag){ for(var i = P.nades.length-1; i >= 0; i--) if(P.nades[i].tag === tag){ P.nades.splice(i, 1); return true; } return false; };
  var anchor = b.tRole === "anchorA" || b.tRole === "anchorB";
  var cuts = T ? ["top","he", b.tRole === "entry" ? "molly" : "flash2", b.tRole === "entry" ? "flash2" : "molly","awp","rifle","helmet","flash1","smoke"]
               : ["top","he","flash2", eg.full ? "helmet" : null, kitN >= 2 ? "kit" : null, anchor ? null : "molly","awp","rifle","flash1","smoke","kit","helmet","molly"];
  for(var ci = 0; ci < cuts.length && cost() > b.money; ci++){
    var c = cuts[ci]; if(!c) continue;
    if(c === "top") P.top = false;
    else if(c === "helmet") P.helmet = false;
    else if(c === "kit") P.kit = false;
    else if(c === "awp"){ if(P.weapon === WEAPONS.AWP) P.weapon = cur && cur.tier >= 6 ? null : rifle; }
    else if(c === "rifle"){ if(P.weapon === rifle && !(cur && cur.tier >= 5)) P.weapon = cheap; }
    else dropN(c);
  }
  // покупка: оружие, броня, каска, кит, гранаты — что по деньгам (если и после всех срезов не хватает — по порядку)
  if(P.weapon && b.money >= P.weapon.price) buyItem(b, P.weapon.key);
  if(!b.primary || WEAPONS[b.primary].tier < 5){ var bp = bestPrimary(b, 99999, ARMOR_PRICE); if(bp) buyItem(b, bp.key); }
  buyArmor(b, P.helmet, P.refill || P.top ? 101 : 1);
  if(P.kit && b.money >= 400){ b.money -= 400; b.kit = true; }
  P.nades.forEach(function(n){ var pr = nadePrice(n.t, b.team), tot = b.nades.smoke + b.nades.flash + b.nades.he + b.nades.molly;
    if(tot < 4 && b.money >= pr && (n.t === "flash" ? b.nades.flash < 2 : b.nades[n.t] < 1)){ b.money -= pr; b.nades[n.t]++; } });
  // срезанное, на что после замены оружия (AK → Galil) хватает остатка, — докупает по тому же порядку набора
  kitKey = b.primary === "AWP" ? "awp" : (b.tRole === "awp" ? "support" : b.tRole);
  (NADE_WISH_PRO[kitKey] || []).forEach(function(t){ var pr = nadePrice(t, b.team), tot = b.nades.smoke + b.nades.flash + b.nades.he + b.nades.molly;
    var need = (NADE_WISH_PRO[kitKey] || []).filter(function(x){ return x === t; }).length;
    if(tot < 4 && b.money >= pr && b.nades[t] < need){ b.money -= pr; b.nades[t]++; } });
  b._fullKit = roundNum;
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

// (v293) гранаты команды на пистолетке — сколько в среднем бросают про (92 демки Ancient, раунды 1 и 13, на команду):
// смок 1,1, флешка 1,0, молотов 0,36, HE 0,09. Кевлар $650 из $800 + граната не помещаются — кто берёт гранату, тот без кевлара.
// Кому — по списку гранат роли (NADE_WISH_PRO), не больше $800 на игрока. План один на раунд
// (v373, сторож: «цепочка гранат» — на форсе HE не покупали вовсе, молотов у T — 0,2 на команду, на эко — один дым; про на форсе
// бросают 8,9–10,1 гранаты на команду, боты — 4,8–6,0) какие гранаты берёт команда на пистолетке, эко и форсе — одно место для
// всех типов раунда (было: план — только на пистолетке, на эко/форсе — по 1–2 гранаты из списка роли, HE последней). Сколько —
// из демок карты по стороне и типу раунда (tools/nades_pro.py → MAP.pro.nadesBy: брошено за раунд на команду); дробная часть —
// случай. Раздаётся по ролям (NADE_WISH_PRO) и деньгам; фулл — набор роли (buyFullKit)
function teamNadePlan(team, rt){
  var E = teamEco[team] || (teamEco[team] = {});
  if(E._tnp && E._tnp.k === matchNum+":"+roundNum+":"+rt) return E._tnp.plan;
  var hr = function(n){ return hashRand(matchNum*131 + roundNum*17 + (team === "CT" ? 7 : 3) + n*29); };
  var NB = ((MAP.pro.nadesBy || {})[team] || {})[rt] || {}, want = [];
  ["smoke", "flash", "molly", "he"].forEach(function(t, ti){ var e = NB[t] || 0, k = Math.floor(e) + (hr(ti+1) < e - Math.floor(e) ? 1 : 0); for(var i = 0; i < k; i++) want.push(t); });
  var ps = bots.filter(function(o){ return o.team === team; }), plan = {}, cost = {}, cnt = {};
  var cap = rt === "pistol" ? function(o){ return 800; } : function(o){ return o.money; };
  want.forEach(function(t){
    var pr = nadePrice(t, team);
    var cand = ps.filter(function(o){ var have = plan[o.id] || []; return (cost[o.id]||0) + pr <= cap(o) && have.length < 4 && have.filter(function(x){ return x === t; }).length < (t === "flash" ? 2 : 1); })
      .sort(function(a, c){ var wa = (NADE_WISH_PRO[a.tRole] || NADE_WISH[a.tRole] || []).indexOf(t), wc = (NADE_WISH_PRO[c.tRole] || NADE_WISH[c.tRole] || []).indexOf(t);
        wa = wa < 0 ? 9 : wa; wc = wc < 0 ? 9 : wc; return (wa - wc) || ((plan[a.id]||[]).length - (plan[c.id]||[]).length) || (c.money - a.money); });
    var o = cand[0]; if(!o) return;
    (plan[o.id] = plan[o.id] || []).push(t); cost[o.id] = (cost[o.id]||0) + pr;
  });
  E._tnp = {k: matchNum+":"+roundNum+":"+rt, plan: plan};
  return plan;
}
function buyForPlayer(b, type, idx){
  var before = b.money;
  if(type === "pistol"){
    // (v271) у про: CT — USP 75%, Dual Berettas 24%; T — Glock 92%, P250 7%, Tec-9 почти никогда
    // (tools/buy_pro.py). Кто не взял пистолет — кевлар; остальное — гранаты
    var hP = hashRand(pHash(b.id)*19 + matchNum*5 + roundNum);
    if(b.team === "CT" && hP < 0.24) buyItem(b, "ELITE");
    else if(b.team === "T" && hP < 0.07) buyItem(b, "P250");
    // (v293, Э-пункт, владелец 14.10: «на пистолетке не покупают гранаты») кому команда отдала гранату — берёт её вместо кевлара
    var PN = teamNadePlan(b.team, "pistol")[b.id];
    if(PN){ if(!b.nades) b.nades = emptyNades(); PN.forEach(function(t){ var pr = nadePrice(t, b.team); if(b.money >= pr){ b.money -= pr; b.nades[t]++; } }); }
    else if(!b.secondary || b.secondary === (b.team === "CT" ? "USP" : "GLOCK")) buyArmor(b, false, ARMOR_REBUY.pistol);
  } else if(type === "full"){
    if(!b.nades) b.nades = emptyNades();
    buyFullKit(b, idx);
  } else if(type === "force" && teamEco[b.team].antiEcoSmg){
    // против эко: броня + SMG ($600 за килл), винтовку — только если и так богат
    buyArmor(b, false, ARMOR_REBUY.force);
    var sm = smgFor(b.team, b), cA = b.primary ? WEAPONS[b.primary].tier : -1;
    if(cA < 4){ if(b.money >= rifleFor(b.team, b).price + 1500) buyItem(b, rifleFor(b.team, b).key); else if(b.money >= sm.price) buyItem(b, sm.key); }
    buyArmor(b, true, ARMOR_REBUY.force);
  } else if(type === "force"){
    // форс: кевлар + что тянет — винтовка, если хватает; нет — ПП (MAC-10 / MP9:
    // дёшево, $600 за килл, сильны вблизи); совсем мало — дигл
    buyArmor(b, false, ARMOR_REBUY.force);
    var cur0 = b.primary ? WEAPONS[b.primary].tier : -1, rf = rifleFor(b.team, b), smg = smgFor(b.team, b);
    // (7) снайпер на форсе — скаут (дёшево, ваншот в голову, точен на ходу)
    var sniperRole = b.tRole === "awp" || (b.team === "CT" && b.tRole === "mid");
    if(BAL.moreWeapons && cur0 < 5 && sniperRole && b.money < rf.price + 300 && b.money >= WEAPONS.SSG.price + ARMOR_PRICE) buyItem(b, "SSG");
    if(cur0 < 4 && !(b.primary === "SSG")){
      // (v271) дешёвая винтовка вместо ПП — доли у про на форсе (tools/buy_pro.py): T Galil 22% против ПП 20%,
      // CT FAMAS 5% против ПП 35% (было 0.35 для обеих сторон)
      var wantRifle = b.money >= rf.price + 300 || (b.money >= WEAPONS[b.team === "CT" ? "FAMAS" : "GALIL"].price + 200 && hashRand(roundNum*53 + idx*7 + matchNum) < (b.team === "CT" ? 0.13 : 0.52));
      if(b.money >= rf.price + 300) buyItem(b, rf.key);
      else if(wantRifle) buyItem(b, b.team === "CT" ? "FAMAS" : "GALIL");
      else if(b.money >= smg.price) buyItem(b, smg.key);
    }
    if(!b.primary && (!b.secondary || WEAPONS[b.secondary].tier < 2)){ var fp = proPistol(b, "force", 1); if(fp && b.money >= WEAPONS[fp].price) buyItem(b, fp); }
    buyArmor(b, helmetWanted(b, "force"), ARMOR_REBUY.force);
    if(b.team === "CT" && !b.kit && b.money >= 400 && idx % 2 === 0){ b.money -= 400; b.kit = true; }
  } else if(type === "half"){
    // хаф-бай: броня + SMG/дешёвая винтовка, но оставляем деньги на следующий раунд
    var keep = teamEco[b.team].bonus ? 0 : Math.max(0, fullNeed(b) - nextLossIncome(b.team));
    if(b.money - ARMOR_PRICE >= keep) buyArmor(b, false, ARMOR_REBUY.half);
    // хаф-бай — чаще ПП (как в CS: MP9/MAC-10 + броня), иногда дешёвая винтовка
    var smgH = smgFor(b.team, b);
    var hp = (hashRand(roundNum*41 + idx*13 + matchNum*7) < 0.4 && b.money - smgH.price >= keep && (!b.primary || WEAPONS[b.primary].tier < 4)) ? smgH : bestPrimary(b, 2100, keep);
    if(hp) buyItem(b, hp.key);
  } else if(type === "eco"){
    // эко: копим; максимум дешёвый пистолет, если он не ломает следующий закуп
    var keepE = fullNeed(b) - nextLossIncome(b.team);
    var ep = WEAPONS[b.secondary].tier < 1 ? proPistol(b, "eco", 2) : null;   // (v271) что берут про на эко
    if(ep && b.money - WEAPONS[ep].price >= keepE) buyItem(b, ep);
    else if(ep && ep !== "P250" && b.money - 300 >= keepE) buyItem(b, "P250");
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
    FREEZE_FX.push({kind:"drop", from:rich.id, to:poor.id, key:rifle.key, t:tick});   // (v321, М14) видно на радаре
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
  if(mates.some(function(m){ return m.primary === "AWP"; })) return;   // (v271) AWP у команды уже есть (подобрал) — вторую не берут: у про две AWP в 1% закупов
  var P = WEAPONS.AWP.price;
  if(awper.money >= P + ARMOR_PRICE){ awper.money -= P; awper.primary = "AWP"; return; }
  var rich = mates.filter(function(m){ return m !== awper && m.money - P >= fullNeed(m); })
                  .sort(function(a,b){ return b.money - a.money; })[0];
  if(rich){ rich.money -= P; awper.primary = "AWP"; logEvent(rich.id+" скинул AWP → "+awper.id); FREEZE_FX.push({kind:"drop", from:rich.id, to:awper.id, key:"AWP", t:tick}); }
}
var BUY_SHOW = {}, BUY_SHOW_FIRST = [1.05, 2, 4.27, 8.5, 12.92], BUY_SHOW_GAP = 0.35;   // (v323, М28) числа закупа по очереди — описание у buyShowStart
