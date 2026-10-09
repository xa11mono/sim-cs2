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
  if(!D.arrived){ D.arrived = true; tdefLog("в полосе", b.id + " → " + L.zone); }
  // v224: занял место — держит его (правка владельца: «заняли зону — не возвращаться проверять старое»); перестановка
  // между местами полосы раз в 2,5–6 с была придумана (не из демок) — убрана. Движение на месте — пункт 6, по демкам
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
// сайте, как часто, куда смотрят. Кто куда: каждому — место, где выше «часто у про» и ближе идти
// (TPOST.walk), не ближе TPOST.apart к месту тиммейта. Дошёл — стоит, смотрит, как смотрят про там.
// Дефуз (свой слух — K.defuseT, 09_knowledge.js; или войс «дефузят!»): ближайший к бомбе, кто её не
// видит, идёт к ней, пока не увидит (стрельба — движок); остальные держат свои места.
var TPOST = {
  walk:  600,   // px: столько пути «стоят» как вдвое более частое место (проектное число)
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
    var s = P.spot[b.id];
    if(!s){ tdefPostSeat([b], site); s = P.spot[b.id]; if(!s) return; }
    if(Math.hypot(b.x - s.x, b.y - s.y) > TDEF.arrive){ b.walking = false; b._ppLook = null; tdefGo(b, s.x, s.y); return; }
    if(!b.tdef.postAt){ b.tdef.postAt = tick; tdefLog("пост-плант", b.id + " на месте: " + s.zone); }
    b._ppLook = s.look;
  });
}
function tdefPostSeat(T, site){
  var P = TDEF_S.post, L = (POSTPLANT[site] || []).map(function(s){
    var w = snapToWalkable(s.x, s.y) || {x: s.x, y: s.y};
    return {x: w.x, y: w.y, share: s.share, look: s.look, zone: s.zone};
  });
  P.spot = P.spot || {};
  var taken = Object.keys(P.spot).map(function(id){ return P.spot[id]; });
  var free = T.filter(function(b){ return !P.spot[b.id]; });
  // по одному: каждый раз лучшая пара «бот — место» по всем свободным (не ближе TPOST.apart к занятым)
  while(free.length){
    var best = null;
    free.forEach(function(b){
      L.forEach(function(s){
        if(taken.some(function(t){ return Math.hypot(t.x - s.x, t.y - s.y) < TPOST.apart; })) return;
        var sc = Math.log(s.share) - Math.LN2 * Math.hypot(b.x - s.x, b.y - s.y) / TPOST.walk;
        if(!best || sc > best.sc) best = {sc: sc, b: b, s: s};
      });
    });
    if(!best) break;
    P.spot[best.b.id] = best.s; taken.push(best.s);
    free = free.filter(function(b){ return b !== best.b; });
  }
  tdefLog("пост-плант", "бомба " + site + ": " + T.map(function(b){ return b.id + " → " + (P.spot[b.id] ? P.spot[b.id].zone : "—"); }).join("; "));
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
