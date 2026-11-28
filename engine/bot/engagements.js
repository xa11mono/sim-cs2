// [хозяева: assignNewDestination, engDecide, engRetreatCheck, engSee, engShoot, engTarget, engagementSetContactStreak, engagementSetDecisionTick, engagementSetForcedRetreat, engagementSetHoldSinceTick, engagementSetNearestEnemyBot, engagementSetPickTick, engagementSetSawEnemy, engagementSetStateSince, engagementSetTs, resolveEngagements] присед у про (12 демок Mirage): на приседе 11 % первых пуль винтовки, 37 % 2–3-х, 22 % дальше; сидят коротко (медиана 0,19 с)
// Доли решений больше долей пуль: присед срывает «не видно из приседа» (v521), уход за укрытие (fight) и конец очереди — подобраны так, чтобы
// на приседе было столько же пуль, сколько у про (замер — бот: 1-я 6 %, 2–3 28 %, 4+ 14 % при решениях 0,11 / 0,37 / 0,22; 17 / 42 / 28 % при 0,2 / 0,49 / 0,35)
var DUCK_PRO = {first: 0.13, burst: 0.46, spray: 0.27};
function duckDecide(b, p, salt){   // присед на ближайшее решение (12 тиков); не сяду, если из приседа врага не видно (v521)
  var e = b._nearestEnemyBot, duck = keysRand(b, salt) < p;
  var cvp = duck && e && b._sawEnemy ? visParts(b.x, b.y, true, e.x, e.y, e.crouching, true, b.z, e.z) : null;
  placeStance(b, duck && (!cvp || !!(cvp.head || cvp.body || cvp.side)), "duck"); b._duckT = tick;
}
var FIGHT_MOVE_NEAR = 10;
// (Р3.2, канал «бой», шаг 1) перестрелки — этапами в прежнем порядке (I-30: порядок обхода ботов не менять): кто кого видит (engSee,
// пары CT × T) → цель (engTarget) → контакт и решение режима боя (engDecide) → отход не на врага (engRetreatCheck) → взгляд (turn) →
// выстрелы по парам (engShoot). Код этапов перенесён дословно; общее между этапами — только список пар видимости
function resolveEngagements(){
  var pairs = engSee();
  engTarget();
  engDecide();
  engRetreatCheck();
  // ---------- куда смотрит бот ---------- — канал взгляда (turn.ts, lookTick)
  lookTick();
  engShoot(pairs);
}
// кто кого видит: пары CT × T (видимость 3D, дым, ван-вей, конус взгляда, ослепление); ближайший видимый враг у каждого
function engSee(){
  var pairs = [];
  bots.forEach(function(b){ engagementSetSawEnemy(b, false); b._nearestEnemyDist = Infinity; engagementSetNearestEnemyBot(b, null); b._visible = []; });
  bots.forEach(function(ct){
    if(ct.team!=="CT"||!ct.alive) return;
    bots.forEach(function(t){
      if(t.team!=="T"||!t.alive) return;
      var dist = DM.hypot(ct.x-t.x, ct.y-t.y);
      var maxRange = Math.max(ct.weapon.range, t.weapon.range);
      if(dist > maxRange) return;
      // шаг 5: обзор перекрывает дым; видит только тот, у кого враг в конусе
      // взгляда (или вплотную, или контакт уже идёт), и кто не ослеплён
      // (v241) что каждый видит у другого — в 3D: стены, укрытия, пол/уступы, крыши (visParts: голова / тело)
      // (М140, В4) высокие стены проверяет visParts — и у плеч цели: центр за углом, а край тела виден
      var ctP = visParts(ct.x, ct.y, ct.crouching, t.x, t.y, t.crouching, true, ct.z, t.z, boostLift(ct), boostLift(t)), tP = visParts(t.x, t.y, t.crouching, ct.x, ct.y, ct.crouching, true, t.z, ct.z, boostLift(t), boostLift(ct));   // (v575) на подсадке глаза выше
      if(!(ctP.head || ctP.body) && !(tP.head || tP.body)) return;
      // ван-вей: стоящий в самом краю дыма видит наружу, а его снаружи — нет
      var smk = smokeBlocks(ct.x,ct.y,t.x,t.y), ctOW = false, tOW = false;
      // (v548) сквозь дым по дырам от пуль видна только часть тела, которая попала в окошко (smokeHoleParts, smoke) — и цель — только она
      if(smk){ ctOW = oneWaySees(ct, t); tOW = oneWaySees(t, ct);   // кромка дыма (ван-вей) — как раньше, целиком
        if(!ctOW){ var ctH = smokeHoleParts(ct, t); ctP = {head: ctP.head && ctH.head, body: ctP.body && ctH.body}; if(ctP.head || ctP.body){ ctOW = true; ct._smkParts = {id: t.id, t: tick, head: ctP.head, body: ctP.body}; } }
        if(!tOW){ var tH = smokeHoleParts(t, ct); tP = {head: tP.head && tH.head, body: tP.body && tH.body}; if(tP.head || tP.body){ tOW = true; t._smkParts = {id: ct.id, t: tick, head: tP.head, body: tP.body}; } }
        if(!ctOW && !tOW) return; }
      // вне поля зрения видно только того, с кем контакт уже идёт (видел его ≤ 0,125 с назад). (аудит 11.10) Раньше хватало
      // контакта с ЛЮБЫМ врагом (contactStreak > 0): в перестрелке бот видел всех врагов на линии на 360°, и второго за спиной тоже
      var ctSees = (ctP.head || ctP.body) && (!smk || ctOW) && tick >= ct.blindUntil && (inFov(ct, t.x, t.y) || seenRecently(ct, t));
      var tSees  = (tP.head || tP.body) && (!smk || tOW) && tick >= t.blindUntil  && (inFov(t, ct.x, ct.y) || seenRecently(t, ct));
      if(!ctSees && !tSees) return;
      if(ctSees) (ct._seenAt || (ct._seenAt = {}))[t.id] = tick;
      if(tSees) (t._seenAt || (t._seenAt = {}))[ct.id] = tick;
      if(ctSees){ engagementSetSawEnemy(ct, true); ct._lastSawT = tick; ct._visible.push(t); if(dist < ct._nearestEnemyDist){ ct._nearestEnemyDist = dist; engagementSetNearestEnemyBot(ct, t); } }
      if(tSees){ engagementSetSawEnemy(t, true); t._lastSawT = tick; t._visible.push(ct); if(dist < t._nearestEnemyDist){ t._nearestEnemyDist = dist; engagementSetNearestEnemyBot(t, ct); } }
      pairs.push({ct:ct, t:t, dist:dist, ctSees:ctSees, tSees:tSees});
    });
  });
  return pairs;
}
function engTarget(){

  // цель держится, пока видна (раньше каждый тик бралась ближайшая: при двух
  // врагах на похожей дистанции прицел метался между ними и выстрелы срывались).
  // Сменить цель (убил / пропала из вида): с шансом по навыку — перевести спрей
  // сразу, иначе короткая пауза и новая очередь
  bots.forEach(function(b){
    if(!b.alive || !b._sawEnemy) return;
    var T0 = b._tgt;
    if(T0 && T0.alive && b._visible.indexOf(T0) >= 0){
      var d0 = DM.hypot(T0.x-b.x, T0.y-b.y);
      if(d0 <= b._nearestEnemyDist*1.4 + 20){ engagementSetNearestEnemyBot(b, T0); b._nearestEnemyDist = d0; return; }
    }
    var NT = b._nearestEnemyBot;
    if(T0 && NT && T0 !== NT && tick - (b.lastShotTick||-999) < 20){
      var pT = 0.3 + 0.4*Math.max(0, Math.min(1, ((b.skill||1)-0.8)/0.4));
      if(hashRand(tick*37 + b.id.charCodeAt(1)*5) < pT){ if(hashRand(tick+11) < 0.3) logEvent(b.id+": перевёл спрей на "+NT.id); }
      else { shotSetNextShotTick(b, Math.max(b.nextShotTick, tick + 8)); shotSetBurstCount(b, 0); }
    }
    b._tgt = NT;
  });
}
// контакт (реакция, память «видел тут», присед очереди) и решение режима боя (decideAction → fightState), отход
function engDecide(){
  bots.forEach(function(b){
    if(!b.alive) return;
    if(b._sawEnemy){
      engagementSetContactStreak(b, +b.contactStreak + 1);
      if(b.lastShotTick === tick - 1 && b.burstCount === 1) duckDecide(b, DUCK_PRO.burst, 12);   // (v575) началась очередь — сесть или нет
      var TS = b._ts || (engagementSetTs(b, {})), vis = {};
      b._visible.forEach(function(e){ vis[e.id] = 1; TS[e.id] = (TS[e.id] || 0) + 1; });
      for(var tsId in TS) if(!vis[tsId]) TS[tsId] = Math.max(0, TS[tsId] - 3);
      // (аудит 11.10) что бот знал ДО этого контакта — префайр в tryShoot только по нему. Раньше lastIntel перезаписывался
      // текущей позицией цели до выстрела, и «держащий» стрелял в только что появившегося без реакции (74 % первых выстрелов,
      // медиана 5 тиков ≈ 80 мс). Контакт непрерывный (lastIntel с прошлого тика) — прежнее «до» сохраняется
      if(!b.lastIntel || b.lastIntel.tick < tick - 1) b._intelPre = b.lastIntel;
      // память для префайра (план §3/§6): "видел врага тут только что" —
      // обновляется каждый тик реального контакта, не только на входе в бой
      knowIntel(b, {x:b._nearestEnemyBot.x, y:b._nearestEnemyBot.y, tick:tick, id:b._nearestEnemyBot.id});   // (v435) id — кого видел (контакт кончается с его смертью)
    } else {
      // раньше тут было contactStreak = 0 и nextShotTick = 0: один тик без LOS
      // (враг чуть сдвинулся за край угла, пик закончился) — и стрелок заново
      // проходил полную задержку реакции 20-48 тиков, т.е. просто переставал
      // стрелять. Теперь "реакция" остывает постепенно: короткая потеря
      // контакта почти не сбрасывает её, долгая — сбрасывает полностью.
      engagementSetContactStreak(b, Math.max(0, b.contactStreak - 3));
      // (v575, В140) врага не видно — присед кончается вместе с очередью (у про — 0,19 с); ослеплён — сидит (move)
      if(b.crouching && tick >= (b.blindUntil || 0) && tick - (b.lastShotTick || -1e9) >= DECISION_INTERVAL_TICKS) placeStance(b, false, "burst-end");
      if(b._ts) for(var tsId2 in b._ts) engagementSetTargetTicks(b._ts, tsId2, Math.max(0, b._ts[tsId2] - 3));   // (этап 2, P0-2) по целям — так же
      // holding on stale-but-recent intel = "ещё смотрю на угол, где только что
      // видел врага" — это ровно то состояние, из которого возможен префайр;
      // без этого "hold" схлопывался бы в patrol в тот же тик, когда контакт
      // на миг теряется, и префайру было бы неоткуда взяться
      // (v408, Б5в, видео владельца 22.10: игрок 9 стоял 2,5 с с новой задачей «трейд» в 80 ед. и построенным путём — «держу» здесь
      // значит скорость 0 и путь не идёт) задача в другом месте (пост не достигнут) и перестрелка кончилась (_fc снят) — «держу» снимается
      // (v560, В82, разбор владельца 11.11: «почему встал, если никого не увидел» — видел врага 1 тик, «держит угол» на всю паузу перестрелки,
      // хотя задача — выйти на него) задача «выйти на врага» уводит с угла и во время перестрелки, пока врага не видно
      // (отметка владельца 18.11, м5 р2 т6916, CT1: «почему не залезет на бортик — зелёный квадрат на бортике») точка выхода на врага была в 33 ед.
      // (на бортике Catwalk, оттуда враг весь), порог «далеко» 40 — бот держал угол, не дойдя, и видел одну голову. Задача выхода — до точки
      // (FIGHT_MOVE_NEAR, проектное число), остальные — как было (40)
      var fmv = b.post && taskProp(b.post.tag, "fightMove");
      var taskAway = (!b._fc || fmv) && b.post && !b.atPost && DM.hypot(b.post.x-b.baseX, b.post.y-b.baseY) > (fmv ? FIGHT_MOVE_NEAR : 40);
      // (v450, док владельца 28.10 №5; м3 р1: носитель T4 с задачей «плант» в 270 ед. 14 с ходил «линия / укрытие» по слуху, ни разу не видя
      // врага) носитель в выходе, врага не видит — перестрелка по памяти кончилась, идёт ставить
      // (v450) и любой T в выходе, кто не видит врага дольше паузы про в перестрелке (PEEK_PRO.T.pause, верхний край — 2,7 с): перестрелка
      // кончилась, «держу» снимается, идёт по задаче (м3 р1: T4 10 с стоял «на линии», ни разу не видя врага)
      var tEx = b.team === "T" && bomb && bomb.state !== "planted" && teamTac.T && teamTac.T.phase === "execute";
      var carGo = tEx && bomb.state === "carried" && bomb.carrier === b && b.post && taskProp(b.post.tag, "plantGo");
      var lostLong = tEx && tick - (b._lastSawT || -1e9) > PEEK_PRO.T.pause[4]*TICK_HZ;
      if((carGo || lostLong) && b._fc){ fcEnd(b, carGo ? "конец: несу бомбу ставить" : "конец: в выходе врага не вижу дольше паузы — иду по задаче"); }
      if(carGo || lostLong) taskAway = taskAway || (b.post && !b.atPost && DM.hypot(b.post.x-b.baseX, b.post.y-b.baseY) > 40);
      var stillWatching = b.holding && !taskAway && b.lastIntel && (tick - b.lastIntel.tick) < CAUTION_TICKS;
      if(!stillWatching && b.state !== "patrol"){ fightState(b, "patrol", taskAway ? "врага не вижу, задача в другом месте" : "врага не вижу, угол больше не держу"); b.holding = false; engagementSetForcedRetreat(b, false); }
      return;
    }
    if(tick - b.decisionTick < DECISION_INTERVAL_TICKS) return;
    if(b.planting || b.defusing) return; // закладывает/дефузит — решение уже принято
    engagementSetDecisionTick(b, tick);
    var alliesNear = bots.filter(function(o){ return o!==b && o.team===b.team && o.alive && nearP(o.x, o.y, o.z, b.x, b.y, b.z, 550); }).length;
    var enemiesSeen = bots.filter(function(o){ return o.team!==b.team && o.alive && DM.hypot(o.x-b.x,o.y-b.y) <= (b._nearestEnemyDist===Infinity? b.weapon.range : Math.max(b.weapon.range, b._nearestEnemyDist)) && hasVision(b.x,b.y,o.x,o.y) && inFov(b, o.x, o.y); }).length;
    var AR = decideActionR(b, b._nearestEnemyDist, alliesNear, enemiesSeen), next = AR.state;
    dlog(b, "оценка боя", next + ": " + (AR.why.length ? AR.why.join("; ") : "без поправок"), "_dlogF");   // (Р3.2 бой ш.2) причины — в след (вне состояния игры)
    // гистерезис: в отход и из отхода — не чаще раза в ~1.3с, иначе бот с низким
    // HP дёргался "отступаю / атакую / отступаю" каждые полсекунды
    if(next !== b.state && (next === "retreat" || b.state === "retreat") && tick - (b.stateSince||0) < 160) next = b.state; // ~2.5с
    if(next !== b.state) engagementSetStateSince(b, tick);
    if(next !== b.state){
      logEvent(b.id+": "+STATE_LABEL[next]+" (HP "+Math.max(0,b.hp)+"%, союзников рядом "+alliesNear+", врагов видит "+enemiesSeen+")");
      if(next === "engage") aggrNote(b.id);   // как выглядывать — fightCycleTick (перестрелка по данным, v250)
    }
    if(next !== b.state){ var AS = b._actS || [0, 0, 0]; fightState(b, next, "оценка: держать " + AS[0].toFixed(2) + " · атаковать " + AS[1].toFixed(2) + " · отойти " + AS[2].toFixed(2)); }
    if(next !== "patrol") roamSetRoamChecking(b, false);
    b.holding = (next === "hold");
    engagementSetHoldSinceTick(b, b.holding ? (b.holdSinceTick===-999 ? tick : b.holdSinceTick) : -999);
    // (v521, дуэли: присед за низким укрытием рвал линию — враг пропадал, перестрелка «расходилась») держит угол — приседает, только если
    // ближайший видимый враг виден и из приседа
    // (v575, В140, владелец 13.11: «очень часто стреляют и даже пикают на приседе») было: держит угол дольше 0,4 с — всегда сидит (8 % времени).
    // У про (12 демок Mirage, scratchpad duck.py) присед — 3 % времени, угол держат стоя (4 %), сидят коротко (медиана 0,19 с = одно решение здесь)
    // и в очереди (DUCK_PRO). Решение на 12 тиков: стреляю — DUCK_PRO.spray, вижу врага и вот-вот выстрелю — first; иначе стоя; первая пуля
    // очереди — отдельное решение сразу (burst, ниже в контакте), иначе присед опаздывает к 2–3-й пуле
    var firing = tick - (b.lastShotTick || -1e9) < DECISION_INTERVAL_TICKS;
    if(tick - (b._duckT || -1e9) >= DECISION_INTERVAL_TICKS) duckDecide(b, firing ? DUCK_PRO.spray : (b._sawEnemy && b._nearestEnemyBot ? DUCK_PRO.first : 0), 11);
    if(next === "retreat" && !b.forcedRetreat){
      // роумер отходит на предыдущую точку маршрута, а не на спавн
      var rt = (b.role === "roamer" && b.roamPrevPt) ? b.roamPrevPt : b.spawnPt;
      // опорник отходит не на спавн, а к CT-входу своего сайта — ждать помощь/ретейк;
      // T во время выхода — назад к точке сбора
      if(b.tRole === "anchorA") rt = GEO.A.ctEntry;
      else if(b.tRole === "anchorB") rt = GEO.B.ctEntry;
      else if(b.team === "T" && teamTac.T && GEO[teamTac.T.site]) rt = GEO[teamTac.T.site].tStage;
      var wp = buildWaypointPath(b.baseX, b.baseY, b.z, rt.x, rt.y, rt.z||0, b.team);
      // Отход не должен вести на врага: раньше "дальняя" точка отхода (спавн,
      // вход на сайт, точка сбора) часто лежала ЗА противником, и бот, решив
      // отступать, бежал прямо на него. Теперь, если первый отрезок пути ведёт
      // в сторону врага, бот уходит в ближайшее укрытие — место, откуда врага
      // не видно и которое дальше от него, чем сам бот.
      var foe = b._nearestEnemyBot;
      if(foe){
        var fa = DM.atan2(foe.y-b.baseY, foe.x-b.baseX);
        var w0 = wp.length ? wp[0] : [rt.x, rt.y];
        var wa = DM.atan2(w0[1]-b.baseY, w0[0]-b.baseX);
        var dA = Math.abs(((wa - fa + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
        if(dA < 1.2){ var cov = findCover(b, foe); if(cov) wp = buildWaypointPath(b.baseX, b.baseY, b.z, cov.x, cov.y, 0); }
      }
      movePath(b, wp, "fight", 0);
      engagementSetForcedRetreat(b, true);
    } else if(next !== "retreat"){
      engagementSetForcedRetreat(b, false);
    }
  });
}
function engRetreatCheck(){
  // отступающий, который всё равно сближается с врагом (путь позже повернул
  // к нему) — каждые 16 тиков проверяем и, если так, перестраиваем путь в укрытие
  bots.forEach(function(b){
    if(!b.alive || b.state !== "retreat"){ b._rtChk = null; return; }
    var foe = b._nearestEnemyBot || (b.lastIntel ? {x:b.lastIntel.x, y:b.lastIntel.y} : null);
    if(!foe) return;
    var dF = DM.hypot(foe.x-b.baseX, foe.y-b.baseY);
    if(!b._rtChk){ b._rtChk = {t:tick, d:dF}; return; }
    if(tick - b._rtChk.t >= 16){
      if(dF < b._rtChk.d - 4){
        var cv = findCover(b, foe);
        if(cv){ movePath(b, buildWaypointPath(b.baseX, b.baseY, b.z, cv.x, cv.y, 0, b.team, botLane(b)), "fight", 0); }
      }
      b._rtChk = {t:tick, d:dF};
    }
  });
}
// выстрелы по парам видимости — в порядке пар (CT × T), каждый стреляет в свою текущую цель
function engShoot(pairs){
  pairs.forEach(function(p){
    if(p.ctSees && p.ct._nearestEnemyBot === p.t) tryShoot(p.ct, p.t, p.dist);
    if(p.tSees && p.t._nearestEnemyBot === p.ct) tryShoot(p.t, p.ct, p.dist);
  });
}

function escapeWallLine(bot){
  for(var rr=3; rr<=18; rr+=3){
    for(var a=0; a<16; a++){
      var ang = a*Math.PI/8;
      var nx = bot.baseX + DM.cos(ang)*rr, ny = bot.baseY + DM.sin(ang)*rr;
      if(insideSolidWall(nx, ny)) continue;
      if(!navFloorNear(nx, ny, NAV_STEP_TOL) && navFloorNear(bot.baseX, bot.baseY, NAV_STEP_TOL)) continue;   // (v336) не с пола в ящик/щель
      if(inFire(nx, ny, bot.z) && !inFire(bot.baseX, bot.baseY, bot.z) && !fireCommit(bot)) continue;   // (этап 3, P1-4) не в огонь
      // из новой точки должно быть можно куда-то идти
      var free = 0;
      for(var q=0;q<8;q++){ var qa=q*Math.PI/4; if(!crossesWall(nx,ny,nx+DM.cos(qa)*4,ny+DM.sin(qa)*4)) free++; }
      if(free >= 5){ var before = [bot.baseX,bot.baseY,bot.z,bot._area]; movePlace(bot, nx, ny, true); movePath(bot, [], "fight", 0); probNav(bot, "escapeWallLine", before); return true; }
    }
  }
  return false;
}
function assignNewDestination(bot, tick){
  // отступает, а путь кончился/сброшен — не случайная точка патруля (часто
  // как раз в сторону врага), а укрытие от того, от кого отходит
  if(bot.state === "retreat"){
    var foe = bot._nearestEnemyBot || (bot.lastIntel ? {x:bot.lastIntel.x, y:bot.lastIntel.y} : null);
    var cv = foe ? findCover(bot, foe) : null;
    var tgt = cv || bot.spawnPt;
    movePath(bot, buildWaypointPath(bot.baseX, bot.baseY, bot.z, tgt.x, tgt.y, 0, bot.team, botLane(bot)), "fight", 0);
    engagementSetPickTick(bot, tick);
    return;
  }
  if(bot.post && bot.state === "patrol"){
    if(bot.atPost || bot.planting || bot.defusing) return; // стоит на посту — путь не нужен
    var epp = fireSafe(bot.post, bot);
    movePath(bot, buildWaypointPath(bot.baseX, bot.baseY, bot.z, epp.x, epp.y, (epp === bot.post && bot.post.z) || 0, bot.team, botLane(bot), bot.walking), "fight", 0);   // (v546) высота поста (ящик), если известна
    engagementSetPickTick(bot, tick);
    return;
  }
  if(bot.role === "roamer" && bot.state === "patrol"){
    if(bot.roamChecking) return; // стоит на чеке — путь не нужен
    var route = ROAM_ROUTES[bot.team];
    if(route && route.length){
      var rp = route[bot.roamIdx % route.length];
      movePath(bot, buildWaypointPath(bot.baseX, bot.baseY, bot.z, rp.x, rp.y, 0, bot.team, botLane(bot), bot.walking), "fight", 0);
      engagementSetPickTick(bot, tick); roamSetRoamTarget(bot, rp);
      return;
    }
  }
  // (Б1, ENGINE_AUDIT Х3) нет задачи (поста), не отход и не роумер — бот никуда не идёт, пока задачу не поставит механика (setPost,
  // арбитр места). Раньше здесь сам выбирал цель: случайную точку карты (в бою — тоже: путь кончился в engage — бежит на случайную
  // точку) или место сбора тактики T со сдвигом; мозг ставил пост на следующем тике — цель менялась туда-обратно
  if(bot.path.length) movePath(bot, [], "fight", 0); else movePathIdx(bot, 0);
}


// Запись состояния канала. Вызовы выполняются в исходной точке тика.
function engagementSetNearestEnemyBot(bot, value){ return bot._nearestEnemyBot = value; }
function engagementSetSawEnemy(bot, value){ return bot._sawEnemy = value; }
function engagementSetTs(bot, value){ return bot._ts = value; }
function engagementSetTargetTicks(targetTicks, id, value){ targetTicks[id] = value; }
function engagementSetContactStreak(bot, value){ return bot.contactStreak = value; }
function engagementSetDecisionTick(bot, value){ return bot.decisionTick = value; }
function engagementSetForcedRetreat(bot, value){ return bot.forcedRetreat = value; }
function engagementSetHoldSinceTick(bot, value){ return bot.holdSinceTick = value; }
function engagementSetPickTick(bot, value){ return bot.pickTick = value; }
function engagementSetStateSince(bot, value){ return bot.stateSince = value; }
