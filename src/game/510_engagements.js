function resolveEngagements(){
  var pairs = [];
  bots.forEach(function(b){ b._sawEnemy = false; b._nearestEnemyDist = Infinity; b._nearestEnemyBot = null; b._visible = []; });
  bots.forEach(function(ct){
    if(ct.team!=="CT"||!ct.alive) return;
    bots.forEach(function(t){
      if(t.team!=="T"||!t.alive) return;
      var dist = Math.hypot(ct.x-t.x, ct.y-t.y);
      var maxRange = Math.max(ct.weapon.range, t.weapon.range);
      if(dist > maxRange) return;
      // шаг 5: обзор перекрывает дым; видит только тот, у кого враг в конусе
      // взгляда (или вплотную, или контакт уже идёт), и кто не ослеплён
      // (v241) что каждый видит у другого — в 3D: стены, укрытия, пол/уступы, крыши (visParts: голова / тело)
      // (М140, В4) высокие стены проверяет visParts — и у плеч цели: центр за углом, а край тела виден
      var ctP = visParts(ct.x, ct.y, ct.crouching, t.x, t.y, t.crouching, true, ct.z, t.z), tP = visParts(t.x, t.y, t.crouching, ct.x, ct.y, ct.crouching, true, t.z, ct.z);
      if(!(ctP.head || ctP.body) && !(tP.head || tP.body)) return;
      // ван-вей: стоящий в самом краю дыма видит наружу, а его снаружи — нет
      var smk = smokeBlocks(ct.x,ct.y,t.x,t.y), ctOW = false, tOW = false;
      if(smk){ if(!BAL.oneWay) return; ctOW = oneWaySees(ct, t); tOW = oneWaySees(t, ct); if(!ctOW && !tOW) return; }
      // вне поля зрения видно только того, с кем контакт уже идёт (видел его ≤ 0,125 с назад). (аудит 11.10) Раньше хватало
      // контакта с ЛЮБЫМ врагом (contactStreak > 0): в перестрелке бот видел всех врагов на линии на 360°, и второго за спиной тоже
      var ctSees = (ctP.head || ctP.body) && (!smk || ctOW) && tick >= ct.blindUntil && (inFov(ct, t.x, t.y) || seenRecently(ct, t));
      var tSees  = (tP.head || tP.body) && (!smk || tOW) && tick >= t.blindUntil  && (inFov(t, ct.x, ct.y) || seenRecently(t, ct));
      if(!ctSees && !tSees) return;
      if(ctSees) (ct._seenAt || (ct._seenAt = {}))[t.id] = tick;
      if(tSees) (t._seenAt || (t._seenAt = {}))[ct.id] = tick;
      if(ctSees){ ct._sawEnemy = true; ct._lastSawT = tick; ct._visible.push(t); if(dist < ct._nearestEnemyDist){ ct._nearestEnemyDist = dist; ct._nearestEnemyBot = t; } }
      if(tSees){ t._sawEnemy = true; t._lastSawT = tick; t._visible.push(ct); if(dist < t._nearestEnemyDist){ t._nearestEnemyDist = dist; t._nearestEnemyBot = ct; } }
      pairs.push({ct:ct, t:t, dist:dist, ctSees:ctSees, tSees:tSees});
    });
  });

  // цель держится, пока видна (раньше каждый тик бралась ближайшая: при двух
  // врагах на похожей дистанции прицел метался между ними и выстрелы срывались).
  // Сменить цель (убил / пропала из вида): с шансом по навыку — перевести спрей
  // сразу, иначе короткая пауза и новая очередь
  bots.forEach(function(b){
    if(!b.alive || !b._sawEnemy) return;
    var T0 = b._tgt;
    if(T0 && T0.alive && b._visible.indexOf(T0) >= 0){
      var d0 = Math.hypot(T0.x-b.x, T0.y-b.y);
      if(d0 <= b._nearestEnemyDist*1.4 + 20){ b._nearestEnemyBot = T0; b._nearestEnemyDist = d0; return; }
    }
    var NT = b._nearestEnemyBot;
    if(T0 && NT && T0 !== NT && tick - (b.lastShotTick||-999) < 20){
      var pT = 0.3 + 0.4*Math.max(0, Math.min(1, ((b.skill||1)-0.8)/0.4));
      if(hashRand(tick*37 + b.id.charCodeAt(1)*5) < pT){ if(hashRand(tick+11) < 0.3) logEvent(b.id+": перевёл спрей на "+NT.id); }
      else { b.nextShotTick = Math.max(b.nextShotTick, tick + 8); b.burstCount = 0; }
    }
    b._tgt = NT;
  });
  bots.forEach(function(b){
    if(!b.alive) return;
    if(b._sawEnemy){
      b.contactStreak++;
      var TS = b._ts || (b._ts = {}), vis = {};
      b._visible.forEach(function(e){ vis[e.id] = 1; TS[e.id] = (TS[e.id] || 0) + 1; });
      for(var tsId in TS) if(!vis[tsId]) TS[tsId] = Math.max(0, TS[tsId] - 3);
      // (аудит 11.10) что бот знал ДО этого контакта — префайр в tryShoot только по нему. Раньше lastIntel перезаписывался
      // текущей позицией цели до выстрела, и «держащий» стрелял в только что появившегося без реакции (74 % первых выстрелов,
      // медиана 5 тиков ≈ 80 мс). Контакт непрерывный (lastIntel с прошлого тика) — прежнее «до» сохраняется
      if(!b.lastIntel || b.lastIntel.tick < tick - 1) b._intelPre = b.lastIntel;
      // память для префайра (план §3/§6): "видел врага тут только что" —
      // обновляется каждый тик реального контакта, не только на входе в бой
      b.lastIntel = {x:b._nearestEnemyBot.x, y:b._nearestEnemyBot.y, tick:tick, id:b._nearestEnemyBot.id};   // (v435) id — кого видел (контакт кончается с его смертью)
    } else {
      // раньше тут было contactStreak = 0 и nextShotTick = 0: один тик без LOS
      // (враг чуть сдвинулся за край угла, пик закончился) — и стрелок заново
      // проходил полную задержку реакции 20-48 тиков, т.е. просто переставал
      // стрелять. Теперь "реакция" остывает постепенно: короткая потеря
      // контакта почти не сбрасывает её, долгая — сбрасывает полностью.
      b.contactStreak = Math.max(0, b.contactStreak - 3);
      if(b._ts) for(var tsId2 in b._ts) b._ts[tsId2] = Math.max(0, b._ts[tsId2] - 3);   // (этап 2, P0-2) по целям — так же
      // holding on stale-but-recent intel = "ещё смотрю на угол, где только что
      // видел врага" — это ровно то состояние, из которого возможен префайр;
      // без этого "hold" схлопывался бы в patrol в тот же тик, когда контакт
      // на миг теряется, и префайру было бы неоткуда взяться
      // (v408, Б5в, видео владельца 22.10: игрок 9 стоял 2,5 с с новой задачей «трейд» в 80 ед. и построенным путём — «держу» здесь
      // значит скорость 0 и путь не идёт) задача в другом месте (пост не достигнут) и перестрелка кончилась (_fc снят) — «держу» снимается
      var taskAway = !b._fc && b.post && !b.atPost && Math.hypot(b.post.x-b.baseX, b.post.y-b.baseY) > 40;
      var stillWatching = b.holding && !taskAway && b.lastIntel && (tick - b.lastIntel.tick) < CAUTION_TICKS;
      if(!stillWatching && b.state !== "patrol"){ b.state = "patrol"; b.holding = false; b.forcedRetreat = false; }
      return;
    }
    if(tick - b.decisionTick < DECISION_INTERVAL_TICKS) return;
    if(b.planting || b.defusing) return; // закладывает/дефузит — решение уже принято
    b.decisionTick = tick;
    var alliesNear = bots.filter(function(o){ return o!==b && o.team===b.team && o.alive && Math.hypot(o.x-b.x,o.y-b.y) < 550; }).length;
    var enemiesSeen = bots.filter(function(o){ return o.team!==b.team && o.alive && Math.hypot(o.x-b.x,o.y-b.y) <= (b._nearestEnemyDist===Infinity? b.weapon.range : Math.max(b.weapon.range, b._nearestEnemyDist)) && hasVision(b.x,b.y,o.x,o.y) && inFov(b, o.x, o.y); }).length;
    var next = decideAction(b, b._nearestEnemyDist, alliesNear, enemiesSeen);
    // гистерезис: в отход и из отхода — не чаще раза в ~1.3с, иначе бот с низким
    // HP дёргался "отступаю / атакую / отступаю" каждые полсекунды
    if(next !== b.state && (next === "retreat" || b.state === "retreat") && tick - (b.stateSince||0) < 160) next = b.state; // ~2.5с
    if(next !== b.state) b.stateSince = tick;
    if(next !== b.state){
      logEvent(b.id+": "+STATE_LABEL[next]+" (HP "+Math.max(0,b.hp)+"%, союзников рядом "+alliesNear+", врагов видит "+enemiesSeen+")");
      if(next === "engage") aggrNote(b.id);   // как выглядывать — fightCycleTick (перестрелка по данным, v250)
    }
    b.state = next;
    if(next !== "patrol") b.roamChecking = false;
    b.holding = (next === "hold");
    b.holdSinceTick = b.holding ? (b.holdSinceTick===-999 ? tick : b.holdSinceTick) : -999;
    b.crouching = b.holding && (tick - b.holdSinceTick > 25);
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
        var fa = Math.atan2(foe.y-b.baseY, foe.x-b.baseX);
        var w0 = wp.length ? wp[0] : [rt.x, rt.y];
        var wa = Math.atan2(w0[1]-b.baseY, w0[0]-b.baseX);
        var dA = Math.abs(((wa - fa + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
        if(dA < 1.2){ var cov = findCover(b, foe); if(cov) wp = buildWaypointPath(b.baseX, b.baseY, b.z, cov.x, cov.y, 0); }
      }
      b.path = wp; b.pathIdx = 0;
      b.forcedRetreat = true;
    } else if(next !== "retreat"){
      b.forcedRetreat = false;
    }
  });

  // отступающий, который всё равно сближается с врагом (путь позже повернул
  // к нему) — каждые 16 тиков проверяем и, если так, перестраиваем путь в укрытие
  bots.forEach(function(b){
    if(!b.alive || b.state !== "retreat"){ b._rtChk = null; return; }
    var foe = b._nearestEnemyBot || (b.lastIntel ? {x:b.lastIntel.x, y:b.lastIntel.y} : null);
    if(!foe) return;
    var dF = Math.hypot(foe.x-b.baseX, foe.y-b.baseY);
    if(!b._rtChk){ b._rtChk = {t:tick, d:dF}; return; }
    if(tick - b._rtChk.t >= 16){
      if(dF < b._rtChk.d - 4){
        var cv = findCover(b, foe);
        if(cv){ b.path = buildWaypointPath(b.baseX, b.baseY, b.z, cv.x, cv.y, 0, b.team, botLane(b)); b.pathIdx = 0; }
      }
      b._rtChk = {t:tick, d:dF};
    }
  });

  // ---------- куда смотрит бот ----------
  // приоритет: видимый враг → (если держит угол) свежая память "враг был тут"
  // → свежий звук шагов → иначе направление движения (ставится в движении).
  // Поворот плавный, но быстрый (AIM_TURN_RATE), и стрелять можно только
  // когда прицел уже почти на цели (AIM_FIRE_CONE) — отсюда естественная
  // задержка "развернулся → выстрелил", когда враг появился сбоку/сзади.
  var aimStep = AIM_TURN_RATE / TICK_HZ;
  // (v291, И32, владелец 14.10: раунд 1, тик 3087 — игрок 6 убил в T Lower и отвернулся на Mid «как у про», пока второй T стоял
  // в 35 px от убитого) после фрага оценка взгляда стрелка пересчитывается сразу, а не через до 8 тиков
  if(BZ.ids.length){
    if(tick % 8 === 0){ lookPlan("CT"); lookPlan("T"); LOOK_REPLAN.CT = LOOK_REPLAN.T = false; }
    else ["CT","T"].forEach(function(t){ if(LOOK_REPLAN[t]){ LOOK_REPLAN[t] = false; lookPlan(t); } });
  }
  bots.forEach(function(b){
    if(!b.alive) return;
    // (v381, М126 шаг 4) куда смотреть — одно место: арбитр взгляда (270_look_plan_smooth.js, LOOK_LEVEL); враг виден — верхний уровень
    var look;
    if(b._sawEnemy && b._nearestEnemyBot){ look = b._nearestEnemyBot; b.lookReason = "enemy"; b._lookLvl = LOOK_LEVEL.enemy; if(LOOKDBG.on) b._ldArb = null; }
    else look = lookArbiter(b);
    var LD = LOOKDBG.on ? {tick: tick, reason: b.lookReason || null, raw: look ? {x: look.x, y: look.y} : null, steps: []} : null;
    var LF = lookFilter(b, look, LD), slUrg = LF.urgent; look = LF.look;
    if(LD){ LD.final = look ? {x: look.x, y: look.y} : null; LD.reasonFinal = b.lookReason || null; b._ld = LD; }
    b.lookTarget = look ? {x:look.x, y:look.y} : null;
    // (v153) бросает гранату — смотрит туда, куда кинул, пока бросок не закончен
    // (раньше за 0,2с после броска взгляд щёлкал обратно — самый частый "рывок")
    if(look && b.throwUntil && tick < b.throwUntil && !b._sawEnemy) look = null;
    if(look){
      var want = Math.atan2(look.y-b.y, look.x-b.x);
      if(b.facing === undefined) b.facing = want;
      var dd = want - b.facing;
      dd = ((dd + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI;
      if(slUrg) b.facing += Math.max(-aimStep, Math.min(aimStep, dd));
      else {
        // (v153) вне боя: плавно, с торможением к цели, не быстрее ~260°/с;
        // стоя мелкие поправки (<3°) не делаем — прицел стоит, а не дрожит
        var standing = !(b.curSpeed > 15*SPD_K);
        if(!(standing && Math.abs(dd) < 0.05)){
          var cap = SL.calmRate / TICK_HZ, stp = Math.min(cap, Math.max(SL.minStep, Math.abs(dd)*SL.ease));
          b.facing += Math.max(-stp, Math.min(stp, dd));
        }
      }
    }
  });

  pairs.forEach(function(p){
    if(p.ctSees && p.ct._nearestEnemyBot === p.t) tryShoot(p.ct, p.t, p.dist);
    if(p.tSees && p.t._nearestEnemyBot === p.ct) tryShoot(p.t, p.ct, p.dist);
  });
}

function escapeWallLine(bot){
  for(var rr=3; rr<=18; rr+=3){
    for(var a=0; a<16; a++){
      var ang = a*Math.PI/8;
      var nx = bot.baseX + Math.cos(ang)*rr, ny = bot.baseY + Math.sin(ang)*rr;
      if(insideSolidWall(nx, ny)) continue;
      if(!navFloorNear(nx, ny, NAV_STEP_TOL) && navFloorNear(bot.baseX, bot.baseY, NAV_STEP_TOL)) continue;   // (v336) не с пола в ящик/щель
      if(inFire(nx, ny) && !inFire(bot.baseX, bot.baseY) && !fireCommit(bot)) continue;   // (этап 3, P1-4) не в огонь
      // из новой точки должно быть можно куда-то идти
      var free = 0;
      for(var q=0;q<8;q++){ var qa=q*Math.PI/4; if(!crossesWall(nx,ny,nx+Math.cos(qa)*4,ny+Math.sin(qa)*4)) free++; }
      if(free >= 5){ bot.baseX = nx; bot.baseY = ny; bot.x = nx; bot.y = ny; bot.path = []; bot.pathIdx = 0; return true; }
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
    bot.path = buildWaypointPath(bot.baseX, bot.baseY, bot.z, tgt.x, tgt.y, 0, bot.team, botLane(bot));
    bot.pathIdx = 0; bot.pickTick = tick;
    return;
  }
  if(bot.post && bot.state === "patrol"){
    if(bot.atPost || bot.planting || bot.defusing) return; // стоит на посту — путь не нужен
    var epp = fireSafe(bot.post, bot);
    bot.path = buildWaypointPath(bot.baseX, bot.baseY, bot.z, epp.x, epp.y, 0, bot.team, botLane(bot));
    bot.pathIdx = 0; bot.pickTick = tick;
    return;
  }
  if(bot.role === "roamer" && bot.state === "patrol"){
    if(bot.roamChecking) return; // стоит на чеке — путь не нужен
    var route = ROAM_ROUTES[bot.team];
    if(route && route.length){
      var rp = route[bot.roamIdx % route.length];
      bot.path = buildWaypointPath(bot.baseX, bot.baseY, bot.z, rp.x, rp.y, 0, bot.team, botLane(bot));
      bot.pathIdx = 0; bot.pickTick = tick; bot.roamTarget = rp;
      return;
    }
  }
  // (Б1, ENGINE_AUDIT Х3) нет задачи (поста), не отход и не роумер — бот никуда не идёт, пока задачу не поставит механика (setPost,
  // арбитр места). Раньше здесь сам выбирал цель: случайную точку карты (в бою — тоже: путь кончился в engage — бежит на случайную
  // точку) или место сбора тактики T со сдвигом; мозг ставил пост на следующем тике — цель менялась туда-обратно
  if(bot.path.length) bot.path = [];
  bot.pathIdx = 0;
}

