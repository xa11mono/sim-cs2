function decideAction(bot, nearestDist, alliesNear, enemiesSeen){
  var hpFrac = Math.max(0, bot.hp)/100;
  // было enemiesSeen - alliesNear — себя не считали, и КАЖДАЯ дуэль 1 на 1
  // выглядела как "меньшинство" → отступление. Теперь 1v1 — это 0.
  var outnumbered = enemiesSeen - (alliesNear + 1);
  var inRange = nearestDist <= bot.weapon.range;

  var holdScore    = 0.45 + 0.20*(inRange?1:0) + 0.20*hpFrac - 0.15*Math.max(0,outnumbered);
  var engageScore  = 0.35 + 0.30*hpFrac - 0.25*Math.max(0,outnumbered) - 0.15*Math.max(0,nearestDist/bot.weapon.range-0.5);
  var retreatScore = 0.15 + 0.50*(1-hpFrac) + 0.20*Math.max(0,outnumbered);
  // plan §3: on stairs, "приоритет не задерживаться" — holding an angle mid-staircase
  // isn't an option a real player takes, so take it off the table entirely rather
  // than just making it score worse (a bad-enough alternative could still win otherwise).
  if(bot.onStairs) holdScore = -Infinity;
  // роумер играет от информации: увидел — охотнее уходит, чем лезет в дуэль
  if(bot.role === "roamer"){ retreatScore += 0.12; engageScore -= 0.05; }
  // план §5: роль и оружие — это веса в той же формуле, а не отдельный код
  var r = bot.tRole, wk = bot.weapon && bot.weapon.key;
  // (5) клатч T: один против нескольких — дуэли по одной. Видно/известно двоих
  // рядом — отойти за укрытие и взять следующего отдельно (кроме дефуза: тогда надо идти)
  if(BAL.tClutch && bot.team === "T" && aliveCount("T") === 1 && aliveCount("CT") >= 2 && tick - (bot._defuseHeard||-9999) > 110){
    var LKc = beliefLast.T || {}, kF = enemiesSeen;
    for(var eC in LKc){ var qC = LKc[eC]; if(tick - qC.tick < 3*TICK_HZ && Math.hypot(qC.x-bot.x, qC.y-bot.y) < 700 && bots.some(function(o){ return o.id === eC && o.alive; })) kF = Math.max(kF, 1) + (enemiesSeen ? 0 : 0); }
    var kN = 0; for(var eC2 in LKc){ var q2 = LKc[eC2]; if(tick - q2.tick < 3*TICK_HZ && Math.hypot(q2.x-bot.x, q2.y-bot.y) < 700) kN++; }
    if(Math.max(enemiesSeen, kN) >= 2){ retreatScore += 0.4; engageScore -= 0.3;
      if(bot._tcV !== roundNum){ bot._tcV = roundNum; voiceLog("T", "tcl"+roundNum, bot.id, "я один против "+aliveCount("CT")+" — не беру двоих сразу, по одному"); } }
  }
  // (1) мидер/роумер CT против группы T на миде: раньше "союзников рядом" считались
  // все в 550px (стоят на сайте за стеной и помочь не могут) — и мидер держал
  // дуэль против 3–5 T. Считаем тех, кто реально рядом на размен (≤300px);
  // известно 2+ T, а разменять некому — отходит, а не стоит насмерть
  if(BAL.midOutnum && bot.team === "CT" && (r === "mid" || r === "roamer") && !(bomb && bomb.state === "planted")){
    var LKo = beliefLast.CT || {}, knownF = 0;
    for(var eO in LKo){ var qO = LKo[eO]; if(tick - qO.tick < 4*TICK_HZ && Math.hypot(qO.x-bot.x, qO.y-bot.y) < 800 && bots.some(function(o){ return o.id === eO && o.alive; })) knownF++; }
    knownF = Math.max(knownF, enemiesSeen);
    var tradeM = bots.filter(function(o){ return o !== bot && o.alive && o.team === bot.team && Math.hypot(o.x-bot.x, o.y-bot.y) < TRADE_R; }).length;
    if(knownF >= 2 && knownF > tradeM + 1){ retreatScore += 0.35 + 0.1*(knownF - tradeM - 2); engageScore -= 0.25; holdScore -= 0.1;
      if(bot._moV !== roundNum){ bot._moV = roundNum; voiceLog("CT", "mo"+bot.id+roundNum, bot.id, "их "+knownF+" на миде, я один — отхожу, не дуэлю"); } }
  }
  // (v154) ценность дуэли. По демкам: у про в момент смерти в 71–77% рядом (≤350px)
  // есть свой на размен, у ботов было 38–54% — боты дерутся в одиночку.
  if(BAL.duelValue){
    var dv = duelContext(bot, enemiesSeen, alliesNear);
    if(!dv.forced){
      if(dv.trade === 0 && !dv.hurtFoe){ engageScore -= 0.18; retreatScore += 0.10; holdScore += 0.04; }
      if(dv.up){ engageScore += 0.08; }
      if(dv.awpLine && !dv.flashed){ engageScore -= 0.12; holdScore += 0.05; }
      // по демкам первым в раунде у T гибнет энтри (22%), лёркер — 13%, AWP — 4%;
      // у ботов было: лёркер 25%, AWP 9%, энтри 9%. Лёркер играет от инфы и
      // тайминга, а не от дуэлей; AWP T в дефолте — не первая жертва
      if(bot.team === "T" && r === "lurker"){ engageScore -= 0.22; retreatScore += 0.14; }
      if(bot.team === "T" && wk === "AWP"){ engageScore -= 0.08; retreatScore += 0.05; }
    }
  }
  if(r === "anchorA" || r === "anchorB"){ holdScore += 0.15; retreatScore -= 0.05; } // опорник держит, ждёт помощь
  if(r === "entry"){ engageScore += 0.15; }                                          // энтри лезет в первую дуэль
  if(r === "lurker"){ holdScore += 0.08; }
  if(wk === "AWP" || wk === "SSG" || (bot.weapon && bot.weapon.scoped)){ holdScore += wk === "AWP" ? 0.15 : 0.08; engageScore -= wk === "AWP" ? 0.10 : 0.05; } // снайперки/прицел — дальняя линия
  var ws = bot.weapon ? bot.weapon.slot : null;
  if(wk === "MAC10" || wk === "MP9" || wk === "UMP" || wk === "MP7" || wk === "P90" || (ws === "secondary" && wk !== "DEAGLE")){ engageScore += 0.08; } // SMG/пистолеты — сближаться
  if(bot.team === "T" && teamTac.T && teamTac.T.saving && !(bomb && bomb.state === "planted")){ engageScore -= 0.25; retreatScore += 0.25; } // сейв T — не лезть в дуэли
  if(bot.team === "CT" && teamTac.CT && teamTac.CT.preSave && !(bomb && bomb.state === "planted")){ engageScore -= 0.25; retreatScore += 0.25; }
  // враг ранен ("он на 20") — не отходить, а добивать
  if(BAL.hurtCall && bot._nearestEnemyBot){ var HTd = teamIntel[bot.team].hurt, hk = HTd && HTd[bot._nearestEnemyBot.id];
    if(hk && hk.hp <= 35 && tick - hk.tick < 10*TICK_HZ){ engageScore += 0.2; retreatScore -= 0.15; } }
  // после планта T держат бомбу, CT обязаны идти — время важнее HP
  if(bomb && bomb.state === "planted"){
    if(bot.team === "T"){ holdScore += 0.12; }
    else if(teamTac.CT && teamTac.CT.saving){ engageScore -= 0.25; retreatScore += 0.25; } // сейв — не лезть в дуэли
    else { engageScore += 0.15; retreatScore -= 0.20; holdScore -= 0.30; } // CT не могут "пересидеть" — надо идти на бомбу
  }
  // ---- цель важнее HP: у кого задача по бомбе, тот не бегает туда-сюда ----
  var ttT = teamTac.T;
  if(bot.team === "T" && bomb){
    if(bomb.state === "carried" && bomb.carrier === bot && ttT && ttT.phase !== "setup"){ retreatScore -= 0.5; } // носитель на выходе — ставить
    else if(bomb.state === "carried" && bomb.carrier === bot){
      // план §11.1 п.7: с бомбой не "всегда беги" — если рядом тиммейт для трейда,
      // играет как обычно; если изолирован — бомба дороже ещё одного фрага
      var mate = bots.some(function(o){ return o !== bot && o.alive && o.team === "T" && Math.hypot(o.x-bot.x, o.y-bot.y) < TRADE_R; });
      if(!mate){ engageScore -= 0.2; retreatScore += 0.15; }
    }
    if(bomb.state === "planted"){
      var someoneDefusing = tick - (bot._defuseHeard||-9999) < 110; // слышал дефуз (реальный или фейк)
      if(someoneDefusing){ engageScore += 0.4; retreatScore -= 0.6; }   // дефузят — любой ценой сбить дефуз
      else retreatScore -= 0.25;                                        // держим бомбу, а не убегаем
    }
  }
  if(bot._smokePush && tick < bot._smokePush.until){ holdScore -= 0.2; engageScore += 0.05; }
  // только что на этом углу убили тиммейта, а стрелка не видели — не выходить туда же
  if(bot._avoidPeekUntil > tick && bot._avoidPeekAt && Math.hypot(bot._avoidPeekAt.x-bot.x, bot._avoidPeekAt.y-bot.y) < 450){ engageScore -= 0.25; holdScore += 0.1; }
  // сбивает плант — время важнее всего: лезет в дуэль, не отходит
  if(bot._stopPlantUntil > tick){ engageScore += 0.3; holdScore -= 0.15; retreatScore -= 0.25; }
  // раздел 14: перезаряжается посреди боя — не высовываться, уйти за угол
  if(bot._reloading){ retreatScore += 0.35; engageScore -= 0.35; holdScore -= 0.1; }
  // ---- раздел 11: командная информация в весах ----
  // тиммейт только что погиб рядом — идти разменивать, а не прятаться
  if(tick < (bot._tradeUntil||0)){ engageScore += 0.2; retreatScore -= 0.15; }
  // команда знает, что рядом стак (2+ врагов), а своих меньше — в одиночку в дуэль не лезть
  var nearEst = intelEstimate(bot.team, bot.x, bot.y, 500, 4*64);
  if(nearEst.n >= 2 && alliesNear + 1 < nearEst.n){ engageScore -= 0.15; holdScore += 0.08; }
  // ---- инициатива: бесконечно стоять нельзя ----
  // Держать угол без контакта становится всё менее выгодно (через 3с каждая
  // секунда −0.04, до −0.35) — рано или поздно бот либо идёт дальше по своим
  // делам, либо сам пикает. T без планта под конец раунда давит (время против
  // них), CT с бомбой на карте и так обязаны идти.
  if(bot.holding && bot.holdSinceTick > 0){
    var heldSec = (tick - bot.holdSinceTick)/TICK_HZ;
    holdScore -= Math.min(0.35, 0.04*Math.max(0, heldSec - 3));
  }
  if(bot.team === "T" && bomb && bomb.state !== "planted"){
    var secL = ROUND_TIME_SEC - (simTime - roundStartTime);
    if(secL < 30){ engageScore += 0.25; holdScore -= 0.2; retreatScore -= 0.2; }
    // раздел: "T не слишком сильно пытаются взять бомбу, предпочитают холдить
    // углы" — на выходе/постпланте до закладки T должны продавливать контакт,
    // а не садиться в оборону, как только увидели первого CT
    if(ttT && ttT.phase !== "setup"){ engageScore += 0.10; holdScore -= 0.06; }
  }

  // раздел 12: анти-эко — у нас закуп, у них эко: не лезть в упор (там пистолет
  // опасен), держать дистанцию, где винтовка сильнее; не давать "геройский" пик
  var myEco = teamEco[bot.team], enEco = teamEco[bot.team === "CT" ? "T" : "CT"];
  if(BAL.antiEco && myEco && enEco && (BAL.buyRead ? antiEco(bot.team) : ((myEco.roundType === "full" || myEco.roundType === "half") && enEco.roundType === "eco"))){
    if(nearestDist < 220){ retreatScore += 0.12; engageScore -= 0.08; }
    else { holdScore += 0.08; engageScore -= 0.04; }
  }
  // раздел 12: клатч (1 против 2+). Изоляция дуэлей — видит двоих сразу →
  // уйти из линии и ловить по одному; CT до планта время на его стороне —
  // не лезть, держать и тянуть время; T после планта — сидеть и ждать звук дефуза
  var myAlive = aliveCount(bot.team), theirAlive = aliveCount(bot.team === "CT" ? "T" : "CT");
  if(myAlive === 1 && theirAlive >= 2){
    if(enemiesSeen >= 2){ retreatScore += 0.30; engageScore -= 0.15; }
    else if(enemiesSeen === 1){ engageScore += 0.05; }
    if(bot.team === "CT" && bomb && bomb.state !== "planted"){ holdScore += 0.12; engageScore -= 0.08; }
    if(bot.team === "T" && bomb && bomb.state === "planted"){ holdScore += 0.10; }
    // T один до планта: цель — поставить бомбу; дальних дуэлей избегает,
    // стреляет, только если враг совсем рядом
    if(bot.team === "T" && bomb && bomb.state !== "planted" && (bomb.state !== "carried" || bomb.carrier === bot)){
      if(nearestDist > 230){ engageScore -= 0.25; retreatScore += 0.15; holdScore -= 0.05; }
    }
  }
  if(BAL.profiles && bot.prof){
    var pa = prof(bot, "aggr"), pd = prof(bot, "disc"), pr = prof(bot, "risk");
    engageScore += (pa-0.5)*0.24;
    holdScore   += (pd-0.5)*0.12 - (pa-0.5)*0.08;
    retreatScore+= (0.5-pr)*0.12*(1-hpFrac+0.3);
    // враг, про которого известно, что он агрессивно пикает, — пусть сам выйдет под прицел
    var ne = bot._nearestEnemyBot;
    if(ne && aggrRate(ne.id) > 1.3){ holdScore += 0.06; engageScore -= 0.03; }
  }
  var best = "hold", bestScore = holdScore;
  if(engageScore > bestScore){ best = "engage"; bestScore = engageScore; }
  if(retreatScore > bestScore){ best = "retreat"; bestScore = retreatScore; }
  return best;
}

// ---- после фрага: AWP меняет угол, агрессивный добирает, остальные — как было ----
// Раньше снайпер после килла оставался на том же угле (или сдвигался на пару
// шагов, если стоял на посту) — второй T выходил туда, где у AWP уже стоит
// прицел, но и знал, где он. У про AWP после выстрела почти всегда уходит:
// отскок за укрытие и новый угол на ту же линию (кроссом к старому). Рисковый
// снайпер иногда (≤1 раз за раунд) репикает тот же угол — ставка на то, что
// его не ждут. Агрессивный рисковый игрок с винтовкой, наоборот, добирает:
// выходит на место фрага за вторым, пока тот перезаряжается/не готов.
// сход с позиции после фрага: цель мертва — "смотрю на угол, где только что
// видел врага" (hold по lastIntel) держал бота на месте ещё ~3с, и новый пост
// не срабатывал. Снимаем бой-удержание, чтобы он реально ушёл.
function leaveHold(b){ b.state = "patrol"; b.holding = false; b.crouching = false; b.decisionTick = tick; }
// (v156) решение после фрага — только по тому, что команда знает (ЛИП ≤5с),
// а не по настоящим позициям врагов
function postKillDecide(sh, tg, vp, here){
  if(!taskCanSet(sh, "repos")) return false;   // (v378) идёт по задаче важнее перестановки — арбитр места
  var known = [], LK = beliefLast[sh.team] || {};
  for(var eid in LK){ var q = LK[eid]; if(eid === tg.id || tick - q.tick > 5*TICK_HZ) continue;
    if(!bots.some(function(o){ return o.id === eid && o.alive; })) continue;
    if(Math.hypot(q.x-vp.x, q.y-vp.y) < 700 || Math.hypot(q.x-sh.x, q.y-sh.y) < 700) known.push({id:eid, x:q.x, y:q.y}); }
  var mates = bots.filter(function(o){ return o !== sh && o.alive && o.team === sh.team && Math.hypot(o.x-sh.x, o.y-sh.y) <= TRADE_R; }).length;
  var my = aliveCount(sh.team), their = aliveCount(tg.team);
  var HT = teamIntel[sh.team] && teamIntel[sh.team].hurt, hurtK = known.some(function(k){ var h = HT && HT[k.id]; return h && h.hp <= 40 && tick - h.tick < 8*TICK_HZ; });
  var tPP = sh.team === "T" && bomb && bomb.state === "planted";
  var ctMust = sh.team === "CT" && bomb && bomb.state === "planted";
  var pa = prof(sh, "aggr"), seed = tick*53 + (sh.id.charCodeAt(sh.id.length-1)||0)*17;
  // 1) откат: их рядом двое и больше (и нас тут меньше), или мало HP — уйти с засвеченной точки
  if(!ctMust && ((known.length >= 2 && known.length > mates) || sh.hp <= 45)){
    var dvx = here.x - vp.x, dvy = here.y - vp.y, dvl = Math.max(1, Math.hypot(dvx, dvy));
    var back = walk({x: here.x + dvx/dvl*170, y: here.y + dvy/dvl*170});
    var hide = [vp].concat(known.map(function(k){ return {x:k.x, y:k.y}; }));
    var np = pickSpots("pkb"+tick+sh.id, back, 4, {rMin:0, rMax:200, minGap:50, see: sh.post && sh.post.look ? [sh.post.look] : [], hideFrom:hide})
      .filter(function(p){ return Math.hypot(p.x-here.x, p.y-here.y) > 70 && !hasLOS(p.x, p.y, vp.x, vp.y); })[0];
    if(np){
      sh._reposUntil = 0; sh._probeLock = 0;
      setPost(sh, np, vp, true, "repos:back");
      if(sh.post && sh.post.tag === "repos:back"){ leaveHold(sh); sh._reposUntil = tick + 4*TICK_HZ;
        logEvent(sh.id+": после фрага откат — "+(sh.hp <= 45 ? "мало HP" : "их ещё "+known.length+" рядом")); return true; }
    }
  }
  // 2) добор: известный враг рядом один (или ранен), сам цел, есть размен или перевес
  if(!tPP && known.length <= 1 && sh.hp > 50 && (mates >= 1 || my > their || hurtK || ctMust)){
    var pPush = (ctMust ? 0.75 : 0.35 + 0.4*pa);
    if(hashRand(seed) < pPush){
      var tgt = known[0] ? {x:known[0].x, y:known[0].y} : vp;
      var sw = pickSpots("pkp"+tick+sh.id, vp, 4, {rMax:150, minGap:40, see:[tgt]})
        .filter(function(p){ return Math.hypot(p.x-here.x, p.y-here.y) > 60; })[0] || vp;
      sh._reposUntil = 0;
      setPost(sh, sw, tgt, true, "repos:push");
      if(sh.post && sh.post.tag === "repos:push"){ leaveHold(sh); sh._reposUntil = tick + 3*TICK_HZ;
        logEvent(sh.id+": после фрага добирает — "+(known.length ? "второй рядом" : "дальше по месту фрага")); return true; }
    }
  }
  return false;
}
function afterKillMove(sh, tg, w){
  if(!sh.alive || sh.planting || sh.defusing) return false;   // (v370) носитель — как все (v368)
  if(afterKillReact(sh, tg, w)) return true;
  if((sh._visible||[]).some(function(o){ return o.alive && o !== tg; })) return false;   // ещё кого-то видит — стреляет (движение в бою — fightCycleTick)
  return killMoveCover(sh, tg);
}
// (v370, владелец: «про после убийства пытаются дойти до укрытия… не стоят») демки: за 2 с после убийства убийца сместился
// на медиану 67 (Mirage) / 73 (Ancient) ед. карты и стоит на месте только в 8 %; у ботов на снимках — 46 ед. и 23 %. Если особой
// реакции (сейв, AWP, смена угла при известных врагах) нет — с места убийства в укрытие в KILL_MOVE ед., откуда не видно места,
// где упал враг (оттуда разменивают), но видно то, что он держал; 2 с, потом обратно к задаче
function killMoveCover(sh, tg){
  if(!taskCanSet(sh, "repos:killmove")) return false;   // (v378) идёт по задаче важнее — арбитр места
  if(sh._contact) sh._contact = null;   // выход на контакт закончен — враг, на которого выходил, убит (иначе пост контакта держал его на месте)
  var hereK = {x:sh.x, y:sh.y}, vpK = {x:tg.x, y:tg.y}, seeK = sh.post && sh.post.look ? [sh.post.look] : [];
  var spK = pickSpots("kmv"+tick+sh.id, hereK, 3, {rMin:KILL_MOVE[0], rMax:KILL_MOVE[1], minGap:30, hideFrom:[vpK], see:seeK})
    .filter(function(q){ return Math.hypot(q.x-hereK.x, q.y-hereK.y) >= KILL_MOVE[0]; })[0];
  if(!spK) return false;
  sh._reposUntil = 0; sh._probeLock = 0; sh._fc = null;   // перестрелка с убитым кончилась — цикл «линия/укрытие» не держит на месте
  setPost(sh, spK, sh.post && sh.post.look ? sh.post.look : vpK, true, "repos:killmove");
  if(!sh.post || sh.post.tag !== "repos:killmove") return false;
  leaveHold(sh); sh._reposUntil = tick + 2*TICK_HZ;
  return true;
}
function afterKillReact(sh, tg, w){
  // (9) на сейве убил — позиция засвечена (звук выстрела, килфид): уходит на
  // другое укрытие, откуда не видно место убийства и старую точку
  if(BAL.saveMove && sh.post && sh.post.tag === "save" && sh._saveSpot){
    var hereS = {x:sh.x, y:sh.y}, vpS = {x:tg.x, y:tg.y};
    var altS = pickSpots("svmv"+tick+sh.id, hereS, 4, {rMin:170, rMax:480, minGap:60, hideFrom:[vpS, hereS]})
      .filter(function(q){ return Math.hypot(q.x-hereS.x, q.y-hereS.y) > 150 && !hasLOS(q.x, q.y, vpS.x, vpS.y); })[0];
    if(altS){ sh._saveSpot = altS; sh._saveLooks = null; logEvent(sh.id+": на сейве — меняю позицию после фрага ("+calloutName(altS.x, altS.y)+")"); return true; }
  }
  // (v248) враги рядом — по тому, что команда знает (ЛИП ≤ 5 с, живые по киллфиду), а не настоящие позиции
  var LKk = beliefLast[sh.team] || {}, foesNear = [];
  for(var eK in LKk){ var qK = LKk[eK]; if(eK === tg.id || tick - qK.tick > 5*TICK_HZ || Math.hypot(qK.x-sh.x, qK.y-sh.y) >= 1400) continue;
    if(bots.some(function(o){ return o.id === eK && o.alive; })) foesNear.push({id: eK, x: qK.x, y: qK.y}); }
  if(!foesNear.length) return false;   // (v370) без известных врагов — в укрытие (killMoveCover)
  var mates = bots.filter(function(o){ return o !== sh && o.alive && o.team === sh.team && Math.hypot(o.x-sh.x, o.y-sh.y) <= TRADE_R; }).length;
  // ещё кого-то видит прямо сейчас — продолжает стрелять, не бегает
  if((sh._visible||[]).some(function(o){ return o.alive && o !== tg; })) return false;
  var pa = prof(sh, "aggr"), pr = prof(sh, "risk"), pd = prof(sh, "disc");
  var vp = {x:tg.x, y:tg.y}, here = {x:sh.x, y:sh.y};
  if(BAL.awpRepos && w && w.key === "AWP" && (!BAL.awpSide || BAL.awpSide === sh.team)){
    if(BAL.styles && pa > 0.7 && pr > 0.7 && sh._repeeked !== roundNum && hashRand(tick*37 + sh.id.charCodeAt(1)*5) < 0.35){
      sh._repeeked = roundNum;
      logEvent(sh.id+" (AWP): рискует — остаётся на том же угле");
      return true;
    }
    // новая точка: та же линия под другим углом, и не на виду у остальных
    // известных врагов (иначе по дороге его снимает второй)
    var others = [];
    for(var eidA in beliefLast[sh.team]){ var eA = beliefLast[sh.team][eidA]; if(eidA !== tg.id && tick - eA.tick < 8*TICK_HZ && Math.hypot(eA.x-sh.x, eA.y-sh.y) < 1300) others.push({x:eA.x, y:eA.y}); }
    // держал пост (опорник/линия) — новый угол должен видеть и то, что он держал
    var seeA = [vp]; if(sh.post && sh.post.look && sh.post.tag !== "repos") seeA.push(sh.post.look);
    var alt = pickSpots("awpr"+tick+sh.id, here, 4, {rMin:100, rMax:260, minGap:60, see:seeA, hideFrom:others, cross:{from:here, pt:vp}});
    var ap = alt.filter(function(q){ return Math.hypot(q.x-here.x, q.y-here.y) > 90; })[0];
    if(!ap) return false;
    sh._reposUntil = 0; sh._probeLock = 0;
    setPost(sh, ap, vp, true, "repos");
    if(!sh.post || sh.post.tag !== "repos") return false; // пост перебит (размен/лайнап) — не уходит
    leaveHold(sh);
    sh._reposUntil = tick + Math.round((5 + 2*pd)*TICK_HZ);
    logEvent(sh.id+" (AWP): после фрага уходит с угла — новый угол, держит "+calloutName(vp.x, vp.y));
    return true;
  }
  // (смена позиции после фрага) убил с угла, а живых врагов рядом ещё хватает:
  // по нему есть инфа (килфид, звук) — следующий пойдёт на тот же угол или
  // зайдёт с другой стороны. Уходит чуть глубже, в укрытие от места убийства
  // и от известных врагов, но так, чтобы видеть тот же вход; до конца раунда
  // это его новая точка (роль больше не возвращает на старую)
  if(BAL.postKill){ var pkR = postKillDecide(sh, tg, vp, here); if(pkR) return true; }
  var foes700 = foesNear.filter(function(o){ return Math.hypot(o.x-sh.x, o.y-sh.y) < 700; });
  if(BAL.styles && mates >= 1 && !(sh.team === "CT" && teamTac.CT && teamTac.CT.antiEco) && pa >= 0.75 && pr >= 0.7 && sh.hp > 60 && foes700.length >= 1 && foes700.length <= 2 && hashRand(tick*41 + sh.id.charCodeAt(1)*3) < pa*0.6){
    var sw = pickSpots("swing"+tick+sh.id, vp, 3, {rMax:140, minGap:40})[0] || vp;
    var nf = foesNear.slice().sort(function(a, c){ return Math.hypot(a.x-vp.x, a.y-vp.y) - Math.hypot(c.x-vp.x, c.y-vp.y); })[0];
    sh._reposUntil = 0;
    setPost(sh, sw, {x:nf.x, y:nf.y}, true, "repos:swing");
    if(!sh.post || sh.post.tag !== "repos:swing") return false;
    leaveHold(sh);
    sh._reposUntil = tick + 3*TICK_HZ;
    logEvent(sh.id+": агрессивно добирает после фрага — выходит за вторым");
    return true;
  }
  // (смена позиции после фрага) — после проверки агрессивного добора: раньше
  // шла первой и агрессивный стиль "убил — сразу за вторым" почти не срабатывал
  if(BAL.holdShift && foesNear.length >= 1 && shiftHold(sh, vp, tg.id, "после фрага засветился")) return true;
  return false;
}
// уйти с засвеченного угла чуть глубже: скрыто от точки контакта и известных
// врагов, но видно тот же вход; до конца раунда это его новая точка
function shiftHold(sh, vp, exceptId, why){
  if(!(sh.atPost && sh.post && sh.post.hold) || /^(save|repos|defuse|plantspot|lineup|pickup|endhunt|retake|gather|stopplant|antidefuse)/.test(sh.post.tag)) return false;
  if(sh._hs && sh._hs.round === roundNum && tick - sh._hs.t < 8*TICK_HZ) return false;
  var here = {x:sh.x, y:sh.y}, knownE = [], LKs = beliefLast[sh.team] || {};
  for(var eH in LKs){ var qH = LKs[eH]; if(eH !== exceptId && tick - qH.tick < 10*TICK_HZ && Math.hypot(qH.x-sh.x, qH.y-sh.y) < 1400) knownE.push({x:qH.x, y:qH.y}); }
  var dvx = here.x - vp.x, dvy = here.y - vp.y, dvl = Math.max(1, Math.hypot(dvx, dvy));
  var back = walk({x: here.x + dvx/dvl*170, y: here.y + dvy/dvl*170});
  var seeL = sh.post.look ? [sh.post.look] : [];
  var np = pickSpots("hs"+tick+sh.id, back, 4, {rMin:0, rMax:200, minGap:50, see:seeL, hideFrom:[vp].concat(knownE)})
    .filter(function(q){ return Math.hypot(q.x-here.x, q.y-here.y) > 80 && !hasLOS(q.x, q.y, vp.x, vp.y); })[0];
  if(!np) return false;
  sh._hs = {round:roundNum, tag:sh.post.tag, pt:np, t:tick};
  var lk0 = sh.post.look, tg0 = sh.post.tag;
  sh._reposUntil = 0; sh._probeLock = 0;
  setPost(sh, np, lk0, true, tg0);
  leaveHold(sh);
  sh._avoidPeekUntil = tick + 6*TICK_HZ; sh._avoidPeekAt = {x:vp.x, y:vp.y};
  logEvent(sh.id+": "+why+" — ухожу глубже ("+calloutName(np.x, np.y)+")");
  return true;
}
// ближайшее укрытие от конкретного врага: не видно его, дальше от него, чем
// бот сейчас, и первый шаг пути к укрытию не ведёт в его сторону
function findCover(b, foe){
  var dFoe = Math.hypot(foe.x-b.baseX, foe.y-b.baseY);
  var fa = Math.atan2(foe.y-b.baseY, foe.x-b.baseX);
  var best = null, bd = Infinity;
  NAVAREAS.forEach(function(z){
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var c = zoneCentroid(z);
    var d = Math.hypot(c.x-b.baseX, c.y-b.baseY);
    if(d < 40 || d > 420) return;
    if(Math.hypot(c.x-foe.x, c.y-foe.y) <= dFoe + 20) return;
    if(hasLOS(c.x, c.y, foe.x, foe.y)) return;
    var ca = Math.atan2(c.y-b.baseY, c.x-b.baseX);
    var dA = Math.abs(((ca - fa + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
    if(dA < 1.3) return;
    if(d < bd){ bd = d; best = c; }
  });
  return best;
}
function seenRecently(b, e){ var s = b._seenAt && b._seenAt[e.id]; return s != null && tick - s >= 0 && tick - s <= 8; }
