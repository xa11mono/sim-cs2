// ======================= (v246) ГДЕ ВСТАТЬ: СВОЙ ПОЧЕРК, ОРУЖИЕ, ПРОШЛЫЙ РАУНД =======================
// Одно место на «насколько этому игроку подходит эта позиция из демок» (0..1), его читают выбор места
// «держать район» (holdSpot) и выбор позиции CT по названию (posPickName). Всё из демок, ничего не придумано:
//  • почерк — доля позиции у реального игрока, которым играет бот (ник = ник в демках);
//  • оружие — доля позиции у про с тем же оружием в руках (AWP / винтовка / ПП / пистолет);
//    почерк и оружие — поровну (проектное число: «поровну»); нет записей игрока — только оружие;
//  • прошлый раунд — встал на позицию, погиб на ней или раунд проигран: вес позиции × во столько раз,
//    во сколько про реже возвращаются на неё после такого раунда (KNOW_POSITIONS.repeat).
// Только до планта (позиции демок — до планта); после планта — как было (тепловая карта v166).
var POSPREF = {cache: {}};
function posWeaponClass(b){
  var k = b.primary || (b.weapon && b.weapon.key) || "";
  if(k === "AWP" || k === "SSG") return "awp";
  if(/^(AK|M4|M4S|GALIL|FAMAS|AUG|SG)$/.test(k)) return "rifle";
  if(/^(MAC10|MP9|MP7|UMP|P90)$/.test(k)) return "smg";
  return "pistol";
}
// (док 6, п.4, владелец 28.10: «ПП — сильный разброс и скорострельность, должен стоять в упор к врагам: выход на A — не на Ticket, а у рампы, на 90»)
// дальность оружия — с какого расстояния CT убивают этим классом (75-й процентиль, м; демки Mirage, tools/measure/pro_checks.py: ПП 272 убийства,
// пистолет 856, винтовка 4124). Место, откуда до врага дальше дальности своего оружия, стоит меньше — во столько раз, во сколько его дальность меньше
// нужной (относительно винтовки: у винтовок и AWP — 1, как было)
var WPN_RANGE_M = {smg: 16.1, pistol: 21.1, rifle: 25.6};
function wpnRangeFit(b, d){
  var c = posWeaponClass(b); if(c !== "smg" && c !== "pistol") return 1;
  var k = 39.37/PX_UNITS, R = WPN_RANGE_M[c]*k, Rr = WPN_RANGE_M.rifle*k;
  return d <= R ? 1 : d >= Rr ? R/Rr : R/d;
}
function posTable(side, who, wc){
  var key = side + "|" + who + "|" + wc; if(POSPREF.cache[key]) return POSPREF.cache[key];
  var P = KNOW_POSITIONS.points.filter(function(q){ return q.side === side; }), NP = 0, NW = 0, raw = {}, mx = 0;
  P.forEach(function(q){ NP += (q.byP && q.byP[who]) || 0; NW += (q.byW && q.byW[wc]) || 0; });
  P.forEach(function(q){
    var sP = NP ? ((q.byP && q.byP[who]) || 0)/NP : 0, sW = NW ? ((q.byW && q.byW[wc]) || 0)/NW : 0;
    var v = NP ? 0.5*sP + 0.5*sW : sW; raw[q.id] = v; if(v > mx) mx = v;
  });
  for(var id in raw) raw[id] = mx > 0 ? raw[id]/mx : 0;
  return POSPREF.cache[key] = raw;
}
// позиция демок под точкой (ближайшая своей стороны в пределах её разброса)
function posAt(side, x, y){
  var ck = side + (x>>2) + "," + (y>>2), C = POSPREF.at || (POSPREF.at = {});   // кэш по клетке 4 px (геометрия не меняется)
  if(ck in C) return C[ck];
  var best = null, bd = Infinity;
  KNOW_POSITIONS.points.forEach(function(q){ if(q.side !== side) return; var d = Math.hypot(q.x-x, q.y-y);
    if(d <= Math.max(q.spread || 0, 40) && d < bd){ bd = d; best = q; } });
  return C[ck] = best;
}
// (v249) с кем в паре: насколько чаще про стоят на q, когда тиммейт стоит на p, чем случайно (lift по демкам:
// раундов вместе × всего раундов / (раундов на q × раундов на p)); берётся лучший из тиммейтов. Нет тиммейтов
// на позициях демок — 1 (ничего не меняет)
function posPairLift(b, q){
  if(!q.n) return 1;
  var best = null, N = KNOW_POSITIONS.rounds;
  bots.forEach(function(m){
    if(m === b || !m.alive || m.team !== b.team) return;
    var pt = m.post ? {x: m.post.x, y: m.post.y} : {x: m.x, y: m.y}, p = posAt(m.team, pt.x, pt.y);
    if(!p || p.id === q.id || !p.n) return;
    var t = (q.w && q.w[p.id]) || 0, L = t*N/(q.n*p.n);
    if(best === null || L > best) best = L;
  });
  return best === null ? 1 : best;
}
function posPref(b, q, noPair){
  if(!q) return 0;
  var v = posTable(b.team, nick(b.id), posWeaponClass(b))[q.id] || 0;
  if(!noPair && !(bomb && bomb.state === "planted")) v *= posPairLift(b, q);
  var M = b._posMem, R = KNOW_POSITIONS.repeat;
  if(M && M.pid === q.id && M.round === roundNum - 1 && M.half === posHalf() && R && R.ok[0] > 0){
    if(M.res === "died") v *= R.died[0]/R.ok[0];
    else if(M.res === "lost") v *= R.lost[0]/R.ok[0];
  }
  return v;
}
function posHalf(){ return matchNum + ":" + (roundNum <= HALF_ROUNDS ? 0 : roundNum <= regRounds() ? 1 : 2 + Math.floor((roundNum - regRounds() - 1)/6)); }
// где бот стоял в этом раунде до планта (стоит: медленнее 10 ед./с, как стоянка в демках) — время по позициям
function posTick(){
  if(roundState !== "live" || tick % 16 || (bomb && bomb.state === "planted")) return;
  bots.forEach(function(b){
    if(!b.alive || (b.curSpeed||0) >= 10) return;
    var q = posAt(b.team, b.x, b.y); if(!q) return;
    if(!b._posT || b._posT.round !== roundNum) b._posT = {round: roundNum, t: {}};
    b._posT.t[q.id] = (b._posT.t[q.id] || 0) + 16;
  });
}
// конец раунда: где стоял дольше всего (не меньше 2 с — как стоянка в демках), погиб ли там, выиграли ли — память
function posRoundEnd(winner){
  bots.forEach(function(b){
    var T = b._posT, H = null; b._posMem = null;
    if(T && T.round === roundNum){ var bt = 2*TICK_HZ - 1; for(var id in T.t) if(T.t[id] > bt){ bt = T.t[id]; H = {pid: id}; } }
    if(!H) return;
    var q = KNOW_POSITIONS.points.filter(function(z){ return z.id === H.pid; })[0]; if(!q) return;
    var died = !b.alive && Math.hypot(b.x-q.x, b.y-q.y) <= 60;   // 60 ед. карты — как «погиб у точки» в positions_bake.py
    b._posMem = {round: roundNum, half: posHalf(), pid: H.pid, res: died ? "died" : (winner === b.team ? "ok" : "lost")};
  });
}
// выбор позиции CT по названию зоны: вес названия — лучшая позиция демок в зонах с этим названием для этого бота
// (аудит 11.10) выбор места по названиям — один раз на раунд (как и задумано: «каждый раунд — одна из них»). Вес места
// зависит от того, где стоят тиммейты (posPairLift), а их места — от этого выбора: пересчёт каждый тик давал качели —
// опорник и ротатор менялись точками каждый тик (матч 3, тик 78346: CT0 и CT3, по 106 смен поста за 1,7 с, оба стояли)
var PPN = {key: null, v: {}};
// (v411, Б5з, владелец 22.10: «kyousuke на CT играет мид в Short, Catwalk, а не окно; NiKo часто у Connector») места игрока на этой
// стороне карты по его демкам: зона → доля его времени там (q.byP — время игрока на позиции). Пусто — демок игрока на карте нет
function posOwnZones(side, who){
  var C = POSPREF.own || (POSPREF.own = {}), key = side + "|" + who; if(C[key]) return C[key];
  var N = 0, by = {};
  KNOW_POSITIONS.points.forEach(function(q){ if(q.side !== side || !q.byP || !q.byP[who]) return; if(q.zid === undefined) q.zid = zoneIdAt(q.x, q.y) || null;
    var nm = q.zid ? zoneUserName(q.zid) : null; if(!nm) return; N += q.byP[who]; by[nm] = (by[nm] || 0) + q.byP[who]; });
  return C[key] = Object.keys(by).map(function(nm){ return {name: nm, share: by[nm]/N}; }).sort(function(a, c){ return c.share - a.share; });
}
// места роли + свои места игрока по демкам этой карты (доля времени выше средней по его местам); демок нет — места роли как есть
// (v425, владелец 25.10, Mirage м1 р6: расстановка 3-1-1, а на A один) сторона места CT: A / B / мид — по спискам мест сайтов набора карты
// (tactics.pos), иначе — к чему ближе точка зоны (сайт A, сайт B, мид CT)
var POS_SIDE = {};
function posSideOf(nm){
  if(POS_SIDE[nm] !== undefined) return POS_SIDE[nm];
  // (v433, М167, владелец: «kyousuke играет окно, а не шорт») сторона места — где его держат CT (ctHold A / B / мид); в нескольких списках
  // или ни в одном — к чему ближе (центр сайта / мид CT). Раньше первыми шли списки A и B целиком, с местами ретейка (ctRetake): Short и
  // Connector — места ретейка B и A — становились «B» и «A», хотя держат их с мида (Short в 283 ед. от мида, в 521 от B); Underpath
  // (держат и с B, и с мида) — «B». Мидеру kyousuke его место из демок Short (16 % раундов) отсекалось как чужая сторона
  var hold = ["A","B","M"].filter(function(k){ return (POS[k] && POS[k].ctHold || []).indexOf(nm) >= 0; });
  var s = hold.length === 1 ? hold[0] : null;
  if(!s){ var p = zonePoint(nm, GEO.ctMid), cs = hold.length ? hold : ["A","B","M"], ref = {A: SITES.A, B: SITES.B, M: GEO.ctMid};
    if(p){ var c = cs.map(function(k){ return [k, Math.hypot(p.x-ref[k].x, p.y-ref[k].y)]; }).sort(function(a, d){ return a[1]-d[1]; }); s = c[0][0]; } }
  if(s) POS_SIDE[nm] = s;   // нет точки зоны (ещё не готовы при загрузке) — не запоминается
  return s;
}
// места роли + свои места игрока по демкам (доля выше средней по его местам) — только на стороне слота расстановки: сторону задаёт
// расстановка, привычка игрока — точку внутри стороны. (v425) раньше свои места брались со всей карты и по весу перебивали места роли:
// в 3-1-1 ротатор TeSeS вставал на A в 44 % раундов (Van — его место из демок), мидер kyousuke — на B в 69 %; на A в среднем 1,6 из 3
function posNamesOwn(b, names){
  var own = posOwnZones(b.team, nick(b.id)), out = names.slice(), sides = {};
  names.forEach(function(nm){ var s = posSideOf(nm); if(s) sides[s] = (sides[s]||0) + 1; });
  var side = Object.keys(sides).sort(function(a, c){ return sides[c] - sides[a]; })[0];
  own.forEach(function(o){ if(o.share >= 1/own.length && out.indexOf(o.name) < 0 && zonesByName(o.name).length && (!side || posSideOf(o.name) === side)) out.push(o.name); });
  return out;
}
function posPickName(b, names, seed){
  if(!b || (bomb && bomb.state === "planted")) return proPick("CT", names, seed);
  var rk = matchNum + ":" + roundNum; if(PPN.key !== rk || tick < PPN.t){ PPN.key = rk; PPN.v = {}; } PPN.t = tick;   // тик назад — матч начат заново
  var ck = b.id + "|" + seed + "|" + names.join(",");
  if(PPN.v[ck] !== undefined) return PPN.v[ck];
  // (v411, Б5з; правило владельца 22.10 «места — по демкам этой карты») есть демки игрока на этой стороне карты — вес места = доля его
  // времени там (posOwnZones); раньше — самая похожая одна позиция по почерку + оружию (posPref), у всех с винтовкой Window ≈ 1, и kyousuke
  // стоял в Window 8 раундов из 12 (в демках — 8 % времени). Демок нет — как раньше
  var own = posOwnZones(b.team, nick(b.id)), ownBy = {}; own.forEach(function(o){ ownBy[normZoneName(o.name)] = o.share; });
  // (док 6) с ПП / пистолетом место дальше от подхода T, чем дальность оружия, — реже (wpnRangeFit; подходы T — GEO: входы A, B и мид T)
  var TE = b.team === "CT" ? [GEO.A && GEO.A.tEntry, GEO.B && GEO.B.tEntry, GEO.tMid].filter(Boolean) : [];
  var fitOf = function(nm){ if(!TE.length) return 1; var p = zonePoint(nm, GEO.ctMid); if(!p) return 1;
    return wpnRangeFit(b, Math.min.apply(null, TE.map(function(e){ return Math.hypot(e.x-p.x, e.y-p.y); }))); };
  var w = names.map(function(nm){
    if(own.length) return (BAL.proFloor*0.1 + (ownBy[normZoneName(nm)] || 0))*fitOf(nm);
    var ids = zonesByName(nm), best = 0;
    KNOW_POSITIONS.points.forEach(function(q){ if(q.side !== b.team) return; if(q.zid === undefined) q.zid = zoneIdAt(q.x, q.y) || null;
      if(q.zid && ids.indexOf(q.zid) >= 0) best = Math.max(best, posPref(b, q)); });
    return (BAL.proFloor + best)*fitOf(nm); });
  var tot = w.reduce(function(a, v){ return a+v; }, 0), r = hashRand(seed)*tot, pick = w.length-1;
  for(var i=0;i<w.length;i++){ r -= w[i]; if(r <= 0){ pick = i; break; } }
  return (PPN.v[ck] = pick);
}

// =====================================================================
// (v145) ЗАДАЧА "ДЕРЖАТЬ РАЙОН" + ОДНА ОЦЕНКА ПОЗИЦИИ.
// Вместо того чтобы каждая ситуация (клатч, пост-плант, опорник...) выбирала
// точку по своим правилам, задача говорит только ЧТО держать (центр, радиус,
// что обязательно видеть), а точку выбирает одна функция по общим критериям:
//  + видеть главный вход, откуда вероятнее всего придут (по карте вероятностей);
//  − каждый ДОПОЛНИТЕЛЬНЫЙ открытый вход (с учётом его опасности) —
//    "встать под один вход, максимум два";
//  − засвеченная точка (отсюда только что стрелял, тут убили своего);
//  − стоять кучей с тиммейтом; + кроссфаер (тот же вход под другим углом);
//  − долго идти; − далеко от цели; + инерция (не бегать между равными точками).
// =====================================================================
var HOLD = {
  seeMain: 3.0,     // вес "вижу главный вход" (× его доля опасности)
  extraOpen: 1.6,   // штраф за каждый лишний открытый вход (× его доля)
  staticOpen: 0.25, // штраф за открытые направления со стороны врага (статично, по карте)
  burned: 1.5, burnR: 160, burnSec: 8,   // засвеченная точка
  stackR: 110, stack: 1.2,               // двое в одной точке — один пик забирает обоих
  cross: 0.8,       // кроссфаер: тот же главный вход под углом 50–120°
  travel: 0.6,      // штраф за путь, на 1000px
  objDist: 0.3,     // штраф за удалённость от цели (на весь радиус)
  pro: 1.2,         // бонус точке, где обычно стоят про (0..1 из демок)
  keep: 0.35,       // бонус текущей точке
  reeval: 128,      // тиков между пересчётами (2с), раньше — если сменился главный вход
  minW: 0.02        // вход с опасностью ниже — не учитываем
};
var HOLD_CANDS = {};
function holdCands(center, rMin, rMax, team){
  var k = team+"|"+Math.round(center.x/20)+","+Math.round(center.y/20)+"|"+rMin+"|"+rMax;
  if(HOLD_CANDS[k]) return HOLD_CANDS[k];
  var out = [];
  // (v240) места, где стояли про (88 демок, KNOW_POSITIONS) — варианты, которые можно занять, не обязательные:
  // идут в общий список, выбирает та же оценка (вход, лишние углы, кроссфаер, путь…)
  KNOW_POSITIONS.points.forEach(function(P){
    if(P.side !== team) return;
    P.spots.concat([[P.x, P.y]]).forEach(function(q){
      var d = Math.hypot(q[0]-center.x, q[1]-center.y);
      if(d < rMin || d > rMax || insideSolidWall(q[0], q[1])) return;
      if(out.some(function(c){ return Math.hypot(c.x-q[0], c.y-q[1]) < 12; })) return;
      out.push({x:q[0], y:q[1], d:d, pro:true});
    });
  });
  NAVAREAS.forEach(function(z){
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var c = zoneCentroid(z), d = Math.hypot(c.x-center.x, c.y-center.y);
    if(d < rMin || d > rMax || insideSolidWall(c.x, c.y)) return;
    if(out.some(function(q){ return Math.hypot(q.x-c.x, q.y-c.y) < 24; })) return;   // прореживание
    out.push({x:c.x, y:c.y, d:d});
  });
  HOLD_CANDS[k] = out; return out;
}
// T: {key, center, rArea, rMin, rMax, must:[pt], mates:[{pt, see}]}
function holdSpot(b, T){
  var team = b.team, center = T.center;
  var E = threatEntrances(team, center, T.rArea || 280).filter(function(e){ return e.w > HOLD.minW; });
  var wmax = E.length ? E[0].w : 1;
  E.forEach(function(e){ e.wn = e.w / wmax; });
  var cands = holdCands(center, T.rMin || 0, T.rMax || 340, team);
  var mustPts = T.must || [];
  var eval1 = function(c, useMust){
    if(useMust && !mustPts.every(function(m){ return hasLOS(c.x, c.y, m.x, m.y); })) return null;
    var main = 0, mainE = null, open = 0;
    E.forEach(function(e){ if(!hasLOS(c.x, c.y, e.pt.x, e.pt.y)) return; var v = e.wn; open += v; if(v > main){ main = v; mainE = e; } });
    var s = HOLD.seeMain*main*(mainE ? wpnRangeFit(b, Math.hypot(c.x-mainE.pt.x, c.y-mainE.pt.y)) : 1) - HOLD.extraOpen*(open - main), why = [];   // (док 6) вход дальше дальности оружия — виден, но держать его хуже
    var ex = spotExposure(team, c.x, c.y); if(ex > 1) s -= HOLD.staticOpen*(ex - 1);
    if(tick - (b.lastShotTick||-1e9) < HOLD.burnSec*TICK_HZ && Math.hypot(c.x-b.x, c.y-b.y) < HOLD.burnR){ s -= HOLD.burned; why.push("засвечен"); }
    if(intelDeathsNear(team, c.x, c.y, HOLD.burnR, 10*TICK_HZ) > 0){ s -= HOLD.burned; why.push("тут убили своего"); }
    (T.mates||[]).forEach(function(m){
      var dm = Math.hypot(m.pt.x-c.x, m.pt.y-c.y);
      if(dm < HOLD.stackR) s -= HOLD.stack;
      else if(mainE && m.see && Math.hypot(m.see.pt.x-mainE.pt.x, m.see.pt.y-mainE.pt.y) < 60 && dm > 90){
        var a1 = Math.atan2(c.y-mainE.pt.y, c.x-mainE.pt.x), a2 = Math.atan2(m.pt.y-mainE.pt.y, m.pt.x-mainE.pt.x);
        var da = _angOff(a1, a2); if(da > 0.87 && da < 2.1) s += HOLD.cross; else if(da > 0.5) s += HOLD.cross*0.4;
      }
    });
    // (v246) где этот игрок с этим оружием обычно стоит (и не туда, где только что не сработало); после планта — тепловая карта
    if(!(bomb && bomb.state === "planted")){ var qp = c.pos !== undefined ? c.pos : (c.pos = posAt(team, c.x, c.y)); s += HOLD.pro * posPref(b, qp); }
    else s += HOLD.pro * proAt(team, c.x, c.y);
    s -= HOLD.travel * Math.hypot(c.x-b.x, c.y-b.y)*1.2/1000;
    s -= HOLD.objDist * c.d / (T.rMax || 340);
    if(b._hTask && b._hTask.key === T.key && Math.hypot(c.x-b._hTask.pt.x, c.y-b._hTask.pt.y) < 40) s += HOLD.keep;
    return {pt:{x:c.x, y:c.y}, s:s, main:mainE, open:open, why:why};
  };
  var best = null;
  [true, false].some(function(useMust){
    cands.forEach(function(c){ var r = eval1(c, useMust); if(r && (!best || r.s > best.s)) best = r; });
    return !!best;
  });
  if(!best) return null;
  best.look = best.main ? best.main.pt : (E[0] ? E[0].pt : center);
  best.E = E;
  return best;
}
// раздать задачу "держать район" группе: по очереди, каждый учитывает уже выбранные точки тиммейтов
function holdGroup(members, T, tag){
  var chosen = [];
  members.slice().sort(function(a, c){ return Math.hypot(a.x-T.center.x, a.y-T.center.y) - Math.hypot(c.x-T.center.x, c.y-T.center.y); })
  .forEach(function(b){
    var H = b._hTask, same = H && H.key === T.key && H.round === roundNum;
    // издалека точку не перевыбираем (иначе, пока идёт, "сколько идти" меняется
    // и он бегает между почти равными точками) — только если сменился главный вход
    var far = same && Math.hypot(b.x-T.center.x, b.y-T.center.y) > (T.rMax || 340) + 250;
    if(far && tick - H.t >= HOLD.reeval){ var E0 = threatEntrances(b.team, T.center, T.rArea || 280)[0];
      if(E0 && H.see && Math.hypot(E0.pt.x-H.see.pt.x, E0.pt.y-H.see.pt.y) < 60) H.t = tick; }
    var fresh = same && tick - H.t < HOLD.reeval;
    if(!fresh){
      // mustFirst: бомбу (цель) обязательно видит только первый; остальные держат
      // подходы и слушают — как про после планта (не все с линией на бомбу)
      var mustNow = (T.mustFirst && chosen.length > 0) ? [] : T.must;
      var r = holdSpot(b, {key:T.key, center:T.center, rArea:T.rArea, rMin:T.rMin, rMax:(T.mustFirst && chosen.length > 0 && T.rMax2) || T.rMax, must:mustNow, mates:chosen});
      // (v373, сторож: «метание» — двое на пост-планте каждые пару секунд менялись проходами, войс «держу бомбу, смотрю…»
      // спамился) пересмотр точки — новая, только если она заметно лучше старой (на 15 % — проектное число) и старую не занял свой
      if(r && same && H.pt && r.s < (H.s || 0) + Math.abs(H.s || 0)*0.15 + 0.01 && !chosen.some(function(c){ return Math.hypot(c.pt.x-H.pt.x, c.pt.y-H.pt.y) < 60; })){ H.t = tick; r = null; }
      if(r){
        var moved = !H || H.key !== T.key || Math.hypot(r.pt.x-H.pt.x, r.pt.y-H.pt.y) > 40;
        b._hTask = {key:T.key, round:roundNum, t:tick, pt:r.pt, look:r.look, see:r.main, s:r.s};
        if(moved && T.voice) T.voice(b, r);
      }
    }
    if(b._hTask && b._hTask.key === T.key){ chosen.push({pt:b._hTask.pt, see:b._hTask.see}); setPost(b, b._hTask.pt, b._hTask.look, true, tag); }
  });
}

