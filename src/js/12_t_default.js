// ======================= ДЕФОЛТ T: ЧТО ДЕЛАЕТ КАЖДЫЙ T ДО ВЫХОДА (шаг 7б) =======================
// Одно место на «где T и что они делают, пока нет execute» (docs/PRO_PLAY.md 1–2.3; К14, П11).
// Как у про: план выбран (07_t_brain.js), каждый играет СВОЮ полосу карты по роли, внутри неё не
// стоит истуканом, на контакт реагирует сам по тому, что знает; куда бить — решает IGL позже.
//
// Полосы — из демок (setups.json → t[].default.lanes, tools/positions_bake.py): где T этого варианта
// execute проводят 10–35-ю с, сколько их там в среднем, когда приходят, где стоят (spots). Состав
// каждый раунд свой: 5 мест тянутся по этим долям (своя случайность от матча и раунда).
// Кто куда — по роли (TDEF_FIT, docs/PRO_PLAY.md 2.3): лёркер — на сторону, куда план не бьёт;
// энтри — к выходу на сайт плана; AWP — мид (Falcons: m0NESY с AWP на миде); саппорт — куда угодно.
// Бомба — у того, кто играет последним: на стороне плана, не энтри (он входит первым), лучше саппорт.
//
// В полосе — одно место из spots (по доле у про); дошёл — держит его. До места бежит, лёркер — шагом (тихо).
// Контроль карты (v225, правка владельца 2; PRO_PLAY 1, 2.2: «T берут пространство и держат»): занявший полосу
// раз в TZONES.step с решает, идти ли в следующую зону — куда и как часто T переходят из этой зоны у про
// (src/data/tzones.json, tools/tzone_bake.py; «остаться» — тоже вариант). В зону, где по его знанию стоит CT
// (видел / слышал / войс — tdefDanger), не идёт — держит свою и смотрит туда (posStandLook). Решает первый
// в паре и лёркер, второй идёт за первым.
// Своё знание (b.know, 09_knowledge.js):
//   • вижу врага — стоп, держу (стрельба — движок); не вижу TDEF.holdSee с — дальше;
//   • слышу шаги/стрельбу ближе TDEF.hearR — стоп, смотрю туда TDEF.holdHear с;
//   • свой в полосе погиб (киллфид + радар), а полоса на стороне плана или мид — её занимает тот, у
//     кого в полосе есть напарник (не оставлять дыру, «потерянный игрок открывает место»).
// После execute (план execute): кто не занят шагом сценария — подтягивается к выходу на сайт плана
// (полоса на его стороне, ближайшая к сайту), после входа энтри — на сайт («входят вместе»).
// Лёркер остаётся в своей полосе. Пост-плант — места из демок вокруг бомбы, на дефуз — проверить бомбу
// (tdefPost). Fallback (потеря состава) — все вместе к выходу, потом на сайт.
// Кого ведёт исполнитель (b._scrT == этот тик) — не трогаем.
// Лог: TDEF_LOG + консоль.

var TDEF = {
  holdSee:  1.5,        // с: врага не видно столько — можно двигаться дальше
  holdHear: 3,          // с: услышал рядом — стоит и смотрит туда
  hearR:    450,        // px: «рядом» для звука
  arrive:   14,         // px: дошёл до места
  repath:   48,         // тиков: путь сбросился — снова не чаще
  mateMin:  60,         // px: второй в паре — не ближе к первому (v220)
  mateMax:  260,        //   … и не дальше: дистанция размена (TRADE_DIST в tools/positions_bake.py); у про медиана 140
  tradeR:   600,        // px: свой погиб не дальше — идёт разменять (проектное число)
  tradeSec: 3,          // с: столько идёт на размен (размен — «за 3 с», как в замере)
  gatherR:  260,        // px: fallback — «собрались у выхода»
  gatherMax: 10         // с: fallback — дольше не ждём, заходим
};
// роль → насколько ей подходит полоса: site — сторона сайта плана, mid — мид, other — другой сайт,
// home — у своего спавна (T Ramp). Из docs/PRO_PLAY.md 2.3, 5 (не из демок)
var TDEF_FIT = {
  entry:   {site: 3, mid: 2, home: 1, other: 0},
  support: {site: 2, mid: 2, home: 2, other: 1},
  awp:     {site: 2, mid: 3, home: 1, other: 1},
  lurker:  {site: 0, mid: 1, home: 1, other: 3},
  anchor:  {site: 2, mid: 2, home: 2, other: 1}
};
var TZONES = @@DATA:tzones.json@@;
var TDEF_S = null;   // {key, setupId, site, seats: [{lane, kind, bot}]}
var TDEF_LOG = [];

function tdefKind(lane, site){
  if(lane.region === site) return "site";
  if(lane.region === "A" || lane.region === "B") return "other";
  if(lane.region === "mid") return "mid";
  return "home";
}
function tdefRand(salt){ return hashRand(matchNum*7349 + roundNum*15013 + salt*131); }

// ---------- начало раунда (resetRound, после плана IGL): места, кто куда, у кого бомба ----------
function tDefaultRoundStart(){
  TDEF_S = null;
  bots.forEach(function(b){ b._ppLook = null; });
  if(roundNum === 1) TDEF_LOG.length = 0;
  bots.forEach(function(b){ delete b.tdef; });
  var P = teamOf("T").planState, setup = tbSetup(P.activeSetupId);
  if(!setup || !setup.default) return;
  tdefSeat(setup, "раунд");
}
function tdefSeat(setup, why){
  var lanes = setup.default.lanes, seats = [];
  var T = bots.filter(function(b){ return b.team === "T" && b.alive; });
  // группы, как у про (v220; демки: на 10–35-й с у 81 % T ближайший свой ≤ 350 px, медиана 140 px; «мид берут
  // вдвоём» — PRO_PLAY 2.2): лёркер — один, на сторону, куда план не бьёт; остальные — парами, полоса пары тянется
  // по доле «сколько там в среднем игроков», разные пары — в разные полосы
  function draw(cands, salt){
    var sum = cands.reduce(function(a, L){ return a + L.players; }, 0), r = tdefRand(salt) * sum;
    for(var i = 0; i < cands.length; i++){ r -= cands[i].players; if(r <= 0) return cands[i]; }
    return cands[cands.length - 1];
  }
  var hasLurk = T.some(function(b){ return b.role === "lurker"; }), taken = [];
  if(hasLurk && T.length >= 3){
    var oth = lanes.filter(function(L){ return tdefKind(L, setup.site) === "other"; });
    var lz = draw(oth.length ? oth : lanes, 1); taken.push(lz);
    seats.push({lane: lz, kind: tdefKind(lz, setup.site), bot: null, solo: true});
  }
  for(var g = 0; seats.length < T.length; g++){
    var rest = lanes.filter(function(L){ return taken.indexOf(L) < 0 && tdefKind(L, setup.site) !== "other"; });
    if(!rest.length) rest = lanes.filter(function(L){ return taken.indexOf(L) < 0; });
    if(!rest.length) rest = lanes;
    var L = draw(rest, 11 + g); taken.push(L);
    var lead = {lane: L, kind: tdefKind(L, setup.site), bot: null};
    seats.push(lead);
    if(seats.length < T.length) seats.push({lane: L, kind: lead.kind, bot: null, lead: lead});
  }

  // кто куда: перебор (5! = 120) — сумма «насколько роль подходит полосе»
  var best = {sc: -1, perm: null};
  (function rec(perm, rest){
    if(!rest.length || perm.length === seats.length){
      var sc = 0; perm.forEach(function(b, i){
        sc += ((TDEF_FIT[b.role] || TDEF_FIT.support)[seats[i].kind] || 0) + (seats[i].solo ? (b.role === "lurker" ? 5 : -5) : 0);
      });
      if(sc > best.sc) best = {sc: sc, perm: perm.slice()};
      return;
    }
    rest.forEach(function(b, j){ rec(perm.concat([b]), rest.slice(0, j).concat(rest.slice(j + 1))); });
  })([], T);
  (best.perm || []).forEach(function(b, i){
    seats[i].bot = b;
    b.tdef = {seat: seats[i], spot: null, until: 0, holdUntil: 0, pathT: -1e9, arrived: false};
  });
  seats = seats.filter(function(s){ return s.bot; });
  TDEF_S = {key: matchNum + ":" + roundNum, setupId: setup.id, site: setup.site, seats: seats};
  tdefBomb(seats);
  tdefLog("места", setup.id + " (" + why + "): " + seats.map(function(s){
    return s.bot.id + " " + s.bot.role + " → " + s.lane.zone + " [" + s.kind + (s.solo ? ", один" : s.lead ? ", пара с " + (s.lead.bot ? s.lead.bot.id : "?") : "") + "]"; }).join("; "));
}
// бомба — тому, кто играет последним: на стороне плана, не энтри; лучше саппорт
function tdefBomb(seats){
  if(!bomb || bomb.state !== "carried") return;
  var sc = function(s){ var b = s.bot; return (s.kind === "site" ? 4 : s.kind === "home" ? 2 : s.kind === "mid" ? 1 : 0) +
                                       (b.role === "support" ? 2 : b.role === "entry" ? -3 : b.role === "lurker" ? -4 : 0); };
  var best = null;
  seats.forEach(function(s){ if(s.bot.alive && (!best || sc(s) > sc(best))) best = s; });
  if(!best || bomb.carrier === best.bot) return;
  bomb.carrier = best.bot;
  tdefLog("бомба", best.bot.id + " (" + best.bot.role + ", " + best.lane.zone + ") — играет последним");
}

// ---------- раз в тик (17_tick.js, после scriptTick) ----------
function tDefaultTick(){
  if(roundState !== "live" || !TDEF_S || TDEF_S.key !== matchNum + ":" + roundNum) return;
  var P = teamOf("T").planState;
  if(P.type === "default" && P.activeSetupId !== TDEF_S.setupId){   // IGL сменил вариант — новые места
    var s2 = tbSetup(P.activeSetupId);
    if(s2 && s2.default){ bots.forEach(function(b){ if(b.team === "T") delete b.tdef; }); tdefSeat(s2, "колл IGL"); }
  }
  if(P.type === "fallback" || P.type === "default" || P.type === "execute") tdefBombPick();
  if(P.type === "fallback"){ tdefFallback(); return; }
  if(P.type === "post_plant"){ tdefPost(); return; }
  if(P.type !== "default" && P.type !== "execute") return;
  tdefRefill();
  tdefTrades();
  var R = SCR_S.T, entryIn = R && R.steps.some(function(S){ return S.kind === "push" && S.state !== "wait"; });
  bots.forEach(function(b){
    if(b.team !== "T" || !b.alive || !b.tdef) return;
    if(b._scrT !== undefined && tick - b._scrT <= 1) return;   // ведёт исполнитель
    if(b.planting || b._tdefBusy === tick) return;
    if(tdefReact(b)) return;
    if(tdefTrade(b)) return;
    if(P.type === "execute" && b.role !== "lurker") tdefJoin(b, entryIn);
    else tdefLane(b);
  });
}

// своё знание: вижу врага / слышу рядом — стоп и держу
function tdefReact(b){
  var D = b.tdef, K = b.know;
  var vis = (b._visible || []).filter(function(e){ return e.alive; });
  if(vis.length){ D.holdUntil = tick + Math.round(TDEF.holdSee*TICK_HZ); tdefStop(b, "вижу " + vis[0].id); return true; }
  if(K) for(var i = K.heard.length - 1; i >= 0 && K.heard[i].tick === tick; i--){
    var h = K.heard[i];
    if((h.kind === "steps" || h.kind === "shots" || h.kind === "water") && Math.hypot(h.x - b.x, h.y - b.y) <= TDEF.hearR){
      D.holdUntil = tick + Math.round(TDEF.holdHear*TICK_HZ);
      b.facing = Math.atan2(h.y - b.y, h.x - b.x);
      tdefStop(b, "слышу " + (h.kind === "shots" ? "стрельбу" : "шаги") + " " + knowZoneName(h.zone));
      return true;
    }
  }
  return tick < D.holdUntil;
}
function tdefStop(b, why){
  var D = b.tdef;
  if(b._pathBy === "tdef" && b.path.length){ b.path = []; b.pathIdx = 0; }
  if(D.lastStop !== why || tick - (D.lastStopT || -1e9) > 3*TICK_HZ) tdefLog("стоп", b.id + ": " + why);
  D.lastStop = why; D.lastStopT = tick;
}
// полоса: к месту, постоять, к другому
function tdefLane(b){
  var D = b.tdef, L = D.seat.lane, lead = D.seat.lead && D.seat.lead.bot;
  // второй в паре — рядом с первым, на соседнем месте полосы, на дистанции размена (scope.gg: «сзади и не на одной
  // линии огня»): первый сменил место — второй тоже
  if(lead && lead.alive && lead.tdef && lead.tdef.seat === D.seat.lead){
    var ls = lead.tdef.spot;
    if(ls && (!D.leadSpot || D.leadSpot !== ls)){ D.leadSpot = ls; D.spot = tdefMateSpot(b, L, ls); D.until = 0; }
  }
  if(!D.spot){ D.spot = tdefSpot(b, L, null); D.until = 0; }
  var d = Math.hypot(b.x - D.spot.x, b.y - D.spot.y);
  if(d > TDEF.arrive){
    b.walking = b.role === "lurker" || D.arrived;   // до полосы — бегом; в полосе и лёркер — шагом
    tdefGo(b, D.spot.x, D.spot.y);
    return;
  }
  if(!D.arrived){ D.arrived = true; D.stepT = tick + TZONES.step*TICK_HZ; tdefLog("в полосе", b.id + " → " + L.zone); }
  if(!(lead && lead.alive) && tick >= D.stepT){ D.stepT = tick + TZONES.step*TICK_HZ; tdefAdvance(b); }
  // v224: занял место — держит его (правка владельца: «заняли зону — не возвращаться проверять старое»); перестановка
  // между местами полосы раз в 2,5–6 с была придумана (не из демок) — убрана. Движение на месте — пункт 6, по демкам
}
// следующая зона: из переходов T у про из этой зоны (при этом сайте плана) — только в зоны, где есть места
// полос (tdefZoneLane) и где по знанию бота нет CT; «опасный» переход становится «остаться»
function tdefAdvance(b){
  var D = b.tdef, L = D.seat.lane, tr = (TZONES.trans[TDEF_S.site] || {})[L.zone];
  if(!tr) return;
  var cand = [], stay = 0, held = [];
  for(var z in tr){
    if(z === L.zone){ stay += tr[z]; continue; }
    var lane = tdefZoneLane(z);
    if(!lane) continue;
    if(tdefDanger(b, z)){ stay += tr[z]; held.push(z); continue; }
    cand.push({lane: lane, w: tr[z]});
  }
  var sum = stay + cand.reduce(function(a, c){ return a + c.w; }, 0), r = tdefRand(tick + b.id.charCodeAt(1)*13) * sum - stay;
  if(r <= 0 || !cand.length) return;
  var pick = cand[cand.length - 1];
  for(var i = 0; i < cand.length; i++){ r -= cand[i].w; if(r <= 0){ pick = cand[i]; break; } }
  var kind = tdefKind(pick.lane, TDEF_S.site);
  TDEF_S.seats.forEach(function(s){
    if(s === D.seat || s.lead === D.seat){ s.lane = pick.lane; s.kind = kind; }
  });
  D.spot = null; D.arrived = false;
  tdefLog("дальше", b.id + ": " + L.zone + " → " + pick.lane.zone + (held.length ? " (не иду: " + held.join(", ") + " — там CT)" : ""));
}
// полоса по названию зоны: своего варианта, иначе — любого варианта T (места и взгляд — те же демки)
function tdefZoneLane(zone){
  var own = tbSetup(TDEF_S.setupId), L = null;
  [own].concat(POS_SETUPS.t).forEach(function(s){
    if(L || !s || !s.default) return;
    s.default.lanes.forEach(function(x){ if(!L && x.zone === zone) L = x; });
  });
  return L;
}
// по знанию бота в зоне стоит CT: видит его там или есть факт (не «вышел со спавна»), и гипотезы в этой зоне
// весят ≥ PLAN.infoW (то же, что «враг стоит на стороне» у IGL — planLocatedList)
function tdefDanger(b, zone){
  var K = b.know; if(!K) return false;
  for(var id in K.enemies){
    var B = K.enemies[id];
    if(!planFact(B)) continue;
    var w = 0;
    B.hyps.forEach(function(h){ if(zoneUserName(h.zone) === zoneMainName(zone)) w += h.weight; });   // у зон данных — полное «A / B»
    if(w >= PLAN.infoW) return true;
  }
  return false;
}
// место второго в паре: ближайшее к месту первого место полосы не ближе TDEF.mateMin; нет такого — на mateBack
// назад от первого, в сторону своего спавна (сзади, а не рядом на одной линии)
function tdefMateSpot(b, L, ls){
  var best = null, bd = 1e9;
  (L.spots || []).forEach(function(s){
    var d = Math.hypot(s[0] - ls.x, s[1] - ls.y);
    if(d >= TDEF.mateMin && d <= TDEF.mateMax && d < bd){ bd = d; best = s; }
  });
  var p = best ? {x: best[0], y: best[1], look: best.length >= 5 ? [best[3], best[4]] : null} : null;
  if(!p){
    var a = Math.atan2(T_SPAWN.y - ls.y, T_SPAWN.x - ls.x), r = (TDEF.mateMin + TDEF.mateMax)/2;
    p = {x: ls.x + Math.cos(a + 0.5)*r, y: ls.y + Math.sin(a + 0.5)*r};
  }
  var w = snapToWalkable(p.x, p.y) || ls;
  if(crossesWall(ls.x, ls.y, w.x, w.y)) w = ls;
  return {x: w.x, y: w.y, look: p.look || ls.look || null};
}
// размен (v220): свой погиб рядом (киллфид + где — по радару) — кто рядом, идёт туда сразу, чтобы разменять
// (scope.gg: размен — убить врага сразу после того, как он убил твоего); лёркер — нет
function tdefTrades(){
  var S = TDEF_S; S.deadSeen = S.deadSeen || {};
  bots.forEach(function(v){
    if(v.team !== "T" || v.alive || S.deadSeen[v.id] || !v.tdef) return;
    S.deadSeen[v.id] = true;
    // идут двое ближайших (размен — второй в паре и ещё один), остальные держат своё
    bots.filter(function(b){ return b.team === "T" && b.alive && b.tdef && b.role !== "lurker" && Math.hypot(b.x - v.x, b.y - v.y) <= TDEF.tradeR; })
      .sort(function(a, c){ return Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(c.x - v.x, c.y - v.y); }).slice(0, 2)
      .forEach(function(b){
        b.tdef.trade = {x: v.x, y: v.y, until: tick + Math.round(TDEF.tradeSec*TICK_HZ)};
        tdefLog("размен", b.id + " → туда, где погиб " + v.id + " (" + calloutName(v.x, v.y) + ")");
      });
  });
}
function tdefTrade(b){
  var Q = b.tdef.trade; if(!Q) return false;
  if(tick > Q.until || Math.hypot(b.x - Q.x, b.y - Q.y) < 60){ b.tdef.trade = null; return false; }
  b.walking = false; tdefGo(b, Q.x, Q.y);
  return true;
}
function tdefSpot(b, L, cur){
  var sp = (L.spots && L.spots.length ? L.spots : [[L.x, L.y, 1]]).filter(function(s){ return !cur || Math.hypot(s[0] - cur.x, s[1] - cur.y) > 5; });
  if(!sp.length) sp = [[L.x, L.y, 1]];
  var sum = sp.reduce(function(a, s){ return a + s[2]; }, 0), r = tdefRand(tick + b.id.charCodeAt(1)*7) * sum, pick = sp[0];
  for(var i = 0; i < sp.length; i++){ r -= sp[i][2]; if(r <= 0){ pick = sp[i]; break; } }
  var w = snapToWalkable(pick[0], pick[1]) || {x: pick[0], y: pick[1]};
  return {x: w.x, y: w.y, look: pick.length >= 5 ? [pick[3], pick[4]] : null};   // взгляд про на этом месте (tools/lane_look_bake.py)
}
function tdefGo(b, x, y){
  var D = b.tdef, moving = b.path.length > 0 && b.pathIdx < b.path.length;
  if(b._pathBy === "tdef" && moving && D.goX === x && D.goY === y) return;
  if(b._pathBy === "tdef" && !moving && tick - D.pathT < TDEF.repath && D.goX === x && D.goY === y) return;
  D.pathT = tick; D.goX = x; D.goY = y; b._pathBy = "tdef";
  b.path = buildWaypointPath(b.x, b.y, b.z || 0, x, y, 0); b.pathIdx = 0;
  // конец пути — это и есть место (навмеш может не доходить до точки из демок): иначе «не дошёл» и путь заново (v224)
  var e = b.path.length ? b.path[b.path.length - 1] : null;
  if(e && Math.hypot(e[0] - x, e[1] - y) <= POS.endSnap){
    if(D.spot && D.spot.x === x && D.spot.y === y){ D.spot = {x: e[0], y: e[1], look: D.spot.look}; D.goX = e[0]; D.goY = e[1]; }
  }
}
// execute: подтянуться к выходу, после входа энтри — на сайт
function tdefJoin(b, entryIn){
  var D = b.tdef, site = SITES[TDEF_S.site];
  b.walking = false;
  if(entryIn){
    if(bombSiteAt(b.baseX, b.baseY) === TDEF_S.site){ if(b._pathBy === "tdef" && b.path.length){ b.path = []; b.pathIdx = 0; } return; }
    if(!D.joined){ D.joined = "site"; tdefLog("вход", b.id + " за энтри на " + TDEF_S.site); }
    tdefGo(b, site.x, site.y);
    return;
  }
  // ближайшее к сайту место полос стороны плана; нет таких полос — к сайту
  var w = tdefExit() || {x: site.x, y: site.y};
  if(D.joined !== "exit"){ D.joined = "exit"; tdefLog("к выходу", b.id + " → " + TDEF_S.site); }
  if(Math.hypot(b.x - w.x, b.y - w.y) > TDEF.arrive*3) tdefGo(b, w.x, w.y);
}
// fallback (потеря состава, 07_t_brain.js): «вместе на сайт плана» — все, и лёркер, к выходу; когда
// живые собрались у выхода (ближе TDEF.gatherR) или прошло TDEF.gatherMax с — заходят вместе
function tdefFallback(){
  var T = bots.filter(function(b){ return b.team === "T" && b.alive && b.tdef; });
  if(!TDEF_S.fbT){ TDEF_S.fbT = tick; tdefLog("fallback", "живые вместе к выходу на " + TDEF_S.site); }
  var ex = tdefExit();
  var together = ex && T.every(function(b){ return Math.hypot(b.x - ex.x, b.y - ex.y) <= TDEF.gatherR; });
  if(!TDEF_S.fbGo && (together || tick - TDEF_S.fbT > TDEF.gatherMax*TICK_HZ)){
    TDEF_S.fbGo = true; tdefLog("fallback", (together ? "собрались" : "ждать дольше нельзя") + " — заходим на " + TDEF_S.site);
  }
  T.forEach(function(b){
    if(b._scrT !== undefined && tick - b._scrT <= 1) return;
    if(b.planting || b._tdefBusy === tick || tdefReact(b)) return;
    // носитель на сайте плана — ставит (в fallback исполнителя уже нет)
    if(TDEF_S.fbGo && bomb && bomb.state === "carried" && bomb.carrier === b && bombSiteAt(b.baseX, b.baseY) === TDEF_S.site){
      if(bombStartPlant(b)) tdefLog("fallback", b.id + " ставит на " + TDEF_S.site);
      return;
    }
    tdefJoin(b, !!TDEF_S.fbGo);
  });
}
// бомба на земле (носитель погиб; где она — видно на радаре): за ней идёт ближайший, кроме лёркера
function tdefBombPick(){
  if(!bomb || bomb.state !== "dropped") { if(TDEF_S.picker) TDEF_S.picker = null; return; }
  var p = TDEF_S.picker && TDEF_S.picker.alive ? TDEF_S.picker : null;
  if(!p){
    var bd = 1e9;
    bots.forEach(function(b){
      if(b.team !== "T" || !b.alive || !b.tdef) return;
      var d = Math.hypot(b.x - bomb.x, b.y - bomb.y) + (b.role === "lurker" ? 2000 : 0);
      if(d < bd){ bd = d; p = b; }
    });
    if(!p) return;
    TDEF_S.picker = p; tdefLog("бомба", p.id + " идёт подобрать (" + knowZoneName(knowZoneAt(bomb.x, bomb.y)) + ")");
  }
  p._scrT = undefined;
  p.walking = false;
  tdefGo(p, bomb.x, bomb.y);
  p._tdefBusy = tick;   // в этот тик дефолт его больше никуда не ведёт
}
function tdefExit(){
  var site = SITES[TDEF_S.site], best = null, bd = 1e9;
  TDEF_S.seats.forEach(function(s){
    if(s.kind !== "site") return;
    (s.lane.spots || []).forEach(function(p){ var d = Math.hypot(p[0] - site.x, p[1] - site.y); if(d < bd){ bd = d; best = p; } });
  });
  if(!best) return null;
  return snapToWalkable(best[0], best[1]) || {x: best[0], y: best[1]};
}
// ---------- пост-плант (v213; docs/PRO_PLAY.md 6в) ----------
// Как у про: не стоять на бомбе, а сразу разойтись на сильные места с видом на бомбу и входы ретейка
// (кроссфайр — CT приходится драться с двумя), играть на время; услышал дефуз — проверить бомбу.
// Места — из демок (src/data/postplant.json, tools/postplant_bake.py): где T стоят после планта на этом
// сайте при этой бомбе (v230), как часто, куда смотрят. Места — жребием по долям про, не ближе TPOST.apart друг к
// другу; кто куда — чтобы всем вместе идти меньше. Дошёл — стоит, смотрит, как смотрят про там.
// Дефуз (свой слух — K.defuseT, 09_knowledge.js; или войс «дефузят!»): ближайший к бомбе, кто её не
// видит, идёт к ней, пока не увидит (стрельба — движок); остальные держат свои места.
var TPOST = {
  huntSec: 17,  // с после планта: охота на сейвящих — не раньше (у про четверть киллов «охоты» — раньше 17 с; v230)
  huntR: 600,   // px: «далеко от бомбы» — CT там не на ретейке (та же граница, что в замере охоты у про)
  bombR: 90,    // px: бомба в кучке плантов из демок — ближе этого к её середине (как BOMB_R в tools/postplant_bake.py)
  apart: 130,   // px: два T не встают ближе этого — кроссфайр, а не толпа
  defuse: 96    // тиков: звук дефуза свежий — столько после последнего услышанного
};
var POSTPLANT = @@DATA:postplant.json@@;
function tdefPost(){
  var site = bomb && bomb.state === "planted" ? bomb.site : null;
  var T = bots.filter(function(b){ return b.team === "T" && b.alive; });
  if(!site || !T.length) return;
  if(!TDEF_S.post){ TDEF_S.post = {site: site}; tdefPostSeat(T, site); }
  var P = TDEF_S.post;
  // дефуз: кто-то из живых T знает (слышал сам / сказали), что дефузят прямо сейчас
  var heard = T.some(function(b){ return b.know && b.know.defuseT !== undefined && tick - b.know.defuseT <= TPOST.defuse; });
  if(heard && (!P.checker || !P.checker.alive)){
    var bd = 1e9, ch = null;
    T.forEach(function(b){ var d = Math.hypot(b.x - bomb.x, b.y - bomb.y); if(d < bd){ bd = d; ch = b; } });
    if(ch){ P.checker = ch; tdefLog("пост-плант", ch.id + " слышит дефуз — идёт проверить бомбу"); }
  }
  if(!heard && P.checker){ P.checker = null; }
  tdefHuntCheck(T, P);
  T.forEach(function(b){
    if(b.planting || b._tdefBusy === tick) return;
    if(!b.tdef) b.tdef = {seat: null, spot: null, until: 0, holdUntil: 0, pathT: -1e9, arrived: false};
    if(P.checker === b){
      b._ppLook = null; b.walking = false;
      var sees = visLine(b.x, b.y, visEyeZ(b), bomb.x, bomb.y, visFloorAt(bomb.x, bomb.y) + 20, true) && Math.hypot(b.x - bomb.x, b.y - bomb.y) < 900;
      if(sees){ if(b._pathBy === "tdef" && b.path.length){ b.path = []; b.pathIdx = 0; } b.facing = Math.atan2(bomb.y - b.y, bomb.x - b.x); }
      else tdefGo(b, bomb.x, bomb.y);
      return;
    }
    if(tdefReact(b)) return;
    if(P.hunt && P.hunt.ids.indexOf(b.id) >= 0 && tdefHunt(b)) return;
    var s = P.spot[b.id];
    if(!s){ tdefPostSeat([b], site); s = P.spot[b.id]; if(!s) return; }
    if(Math.hypot(b.x - s.x, b.y - s.y) > TDEF.arrive){ b.walking = false; b._ppLook = null; tdefGo(b, s.x, s.y); return; }
    if(!b.tdef.postAt){ b.tdef.postAt = tick; tdefLog("пост-плант", b.id + " на месте: " + s.zone); }
    b._ppLook = s.look;
  });
}
// охота на сейвящих (v230, правка владельца 8: «выбивать ганы»). У про: в 13 % раундов с плантом T убивают CT дальше
// 600 px от бомбы, первый такой килл — в среднем на 23-й с после планта, в 91 % — когда T больше (88 демок). По знанию
// команды: прошло TPOST.huntSec после планта, нас больше (киллфид), и никто из T не знает CT у бомбы (ближе TPOST.huntR —
// видел / слышал / войс) — CT не идут на ретейк, сейвят. Тогда все, кроме ближайшего к бомбе (он её держит), идут туда,
// где по их знанию вероятнее всего CT (самая весомая гипотеза), — парой; узнали про CT у бомбы — назад на места.
function tdefHuntCheck(T, P){
  var sec = (tick - bomb.plantTick)/TICK_HZ, ct = bots.filter(function(b){ return b.team === "CT" && b.alive; }).length;
  var near = T.some(function(b){
    var K = b.know; if(!K) return false;
    for(var id in K.enemies){
      var B = K.enemies[id]; if(!planFact(B)) continue;
      if(B.hyps.some(function(h){ return h.x !== undefined && h.weight >= PLAN.infoW && Math.hypot(h.x - bomb.x, h.y - bomb.y) <= TPOST.huntR; })) return true;
    }
    return false;
  });
  if(P.hunt){
    if(near || T.length <= ct){ tdefLog("пост-плант", "охота отменена — " + (near ? "CT у бомбы" : "нас уже не больше")); P.hunt = null; }
    return;
  }
  if(sec < TPOST.huntSec || !ct || T.length <= ct || near || T.length < 2) return;
  var keep = T.slice().sort(function(a, c){ return Math.hypot(a.x - bomb.x, a.y - bomb.y) - Math.hypot(c.x - bomb.x, c.y - bomb.y); })[0];
  P.hunt = {ids: T.filter(function(b){ return b !== keep; }).map(function(b){ return b.id; }), t: tick};
  tdefLog("пост-плант", "охота: нас " + T.length + " против " + ct + ", у бомбы CT не видно " + Math.round(sec) + " с — " + P.hunt.ids.join(", ") + " ищут сейвящих, " + keep.id + " держит бомбу");
}
function tdefHunt(b){
  var K = b.know, best = null;
  if(K) for(var id in K.enemies){
    var B = K.enemies[id];
    B.hyps.forEach(function(h){ if(h.x !== undefined && (!best || h.weight > best.weight)) best = h; });
  }
  if(!best) return false;
  b._ppLook = null; b.walking = false;
  tdefGo(b, best.x, best.y);
  return true;
}
function tdefPostSeat(T, site){
  // доли мест — для этой бомбы (v230, правка владельца 5): где про стоят, когда бомба лежит в той же кучке плантов
  // (postplant.json → <сайт>_bombs, spot.byBomb); бомба не в кучке — по всему сайту
  var B = (POSTPLANT[site + "_bombs"] || []), ci = -1, cd = 1e9;
  B.forEach(function(c, i){ var d = Math.hypot(c.x - bomb.x, c.y - bomb.y); if(d < cd){ cd = d; ci = i; } });
  if(cd > TPOST.bombR) ci = -1;
  var P = TDEF_S.post, L = (POSTPLANT[site] || []).map(function(s){
    var w = snapToWalkable(s.x, s.y) || {x: s.x, y: s.y};
    return {x: w.x, y: w.y, share: ci >= 0 && s.byBomb ? s.byBomb[ci] : s.share, look: s.look, zone: s.zone};
  }).filter(function(s){ return s.share > 0; });
  P.spot = P.spot || {};
  var taken = Object.keys(P.spot).map(function(id){ return P.spot[id]; });
  var free = T.filter(function(b){ return !P.spot[b.id]; });
  // места — как часто там стоят про (жребий по долям, не ближе TPOST.apart друг к другу); кто куда — чтобы всем вместе
  // идти меньше всего (раньше: «чаще у про и ближе идти» с придуманным весом пути — всех тянуло к ближайшим местам у бомбы)
  var pick = [];
  for(var n = 0; n < free.length; n++){
    var ok = L.filter(function(s){ return pick.indexOf(s) < 0 && !taken.concat(pick).some(function(t){ return Math.hypot(t.x - s.x, t.y - s.y) < TPOST.apart; }); });
    if(!ok.length) break;
    var sum = ok.reduce(function(a, s){ return a + s.share; }, 0), r = tdefRand(tick + n*31 + 7) * sum, c = ok[ok.length - 1];
    for(var i = 0; i < ok.length; i++){ r -= ok[i].share; if(r <= 0){ c = ok[i]; break; } }
    pick.push(c);
  }
  var best = {d: 1e18, perm: null};
  (function rec(perm, rest){
    if(perm.length === Math.min(free.length, pick.length)){
      var d = 0; perm.forEach(function(s, k){ d += Math.hypot(free[k].x - s.x, free[k].y - s.y); });
      if(d < best.d) best = {d: d, perm: perm.slice()};
      return;
    }
    rest.forEach(function(s, k){ rec(perm.concat([s]), rest.slice(0, k).concat(rest.slice(k + 1))); });
  })([], pick);
  (best.perm || []).forEach(function(s, k){ P.spot[free[k].id] = s; });
  tdefLog("пост-плант", "бомба " + site + (ci >= 0 ? " (кучка " + ci + ")" : "") + ": " + T.map(function(b){ return b.id + " → " + (P.spot[b.id] ? P.spot[b.id].zone + " " + Math.round(Math.hypot(P.spot[b.id].x - bomb.x, P.spot[b.id].y - bomb.y)) + " px от бомбы" : "—"); }).join("; "));
}

// полоса на стороне плана или мид осталась без живых — её занимает тот, у кого в полосе есть напарник
function tdefRefill(){
  var moves = [];
  TDEF_S.seats.forEach(function(s){
    if(s.bot.alive || s.refilled || (s.kind !== "site" && s.kind !== "mid")) return;
    if(TDEF_S.seats.some(function(o){ return o.lane === s.lane && o.bot.alive; })) return;
    s.refilled = true;
    var cand = null, cd = 1e9;
    TDEF_S.seats.forEach(function(o){
      if(!o.bot.alive || !o.bot.tdef || o.bot.role === "lurker" || moves.some(function(m){ return m.from === o; })) return;
      var mates = TDEF_S.seats.filter(function(q){ return q.lane === o.lane && q.bot.alive; }).length;
      if(mates < 2) return;
      var d = Math.hypot(o.bot.x - s.lane.x, o.bot.y - s.lane.y);
      if(d < cd){ cd = d; cand = o; }
    });
    if(cand) moves.push({from: cand, to: s});
  });
  moves.forEach(function(m){
    var b = m.from.bot;
    m.to.bot = b;
    TDEF_S.seats = TDEF_S.seats.filter(function(q){ return q !== m.from; });
    b.tdef.seat = m.to; b.tdef.spot = null; b.tdef.arrived = false;
    tdefLog("занял место", b.id + " → " + m.to.lane.zone + " (там погибли)");
  });
}
function tdefLog(ev, why){
  TDEF_LOG.push({tick: tick, sec: +((tick - roundStartTick)/TICK_HZ).toFixed(1), round: roundNum, ev: ev, why: why});
  logEvent("Дефолт T: " + ev + " — " + why, ev === "стоп" ? "dbg" : "info");
}
