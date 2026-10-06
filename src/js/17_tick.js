// ---------- fixed-tick sim ----------
var TICK_HZ = 64;
var TICK_MS = 1000/TICK_HZ;
var tick = 0;

var paused = false;
var accumulator = 0;
var lastFrame = null;
roundState = BAL.freeze > 0 ? "freeze" : "live";
roundStartTime = BAL.freeze; roundStartTick = Math.round(BAL.freeze*TICK_HZ);
buyPhase(); // закуп первого (пистолетного) раунда — после объявления simTime (logEvent его использует)
resetBomb();
chooseTactic();
beliefBuild(); beliefReset(); // раздел 13: карта вероятностей врага

function stepTick(){
  tick++;
  simTime = tick * TICK_MS / 1000;
  if(roundState === "ending"){
    if(simTime - roundEndTime >= ROUND_RESTART_DELAY_SEC) resetRound();
    return;
  }
  if(roundState === "matchover"){
    if(simTime - roundEndTime >= 7){ freshMatch(matchNum + 1); paused = false; var inpMN = document.getElementById("inpMatchNum"); if(inpMN) inpMN.value = matchNum; }
    return;
  }
  if(roundState === "freeze"){
    if(simTime >= roundStartTime){ roundState = "live"; logEvent("Freeze-тайм окончен — раунд пошёл"); }
    return;
  }
  teamBrains(); // шаг 4: тактика T / расстановка и ротации CT / бомба
  if(roundState !== "live") return;
  nadeBrains(); updateNadeTasks(); nadesTick(); // шаг 5: гранаты
  if(roundState !== "live") return;
  var dtSec = TICK_MS/1000, maxDelta = ACCEL*dtSec;
  // movement tuning (plan-driven "natural, not robotic" pass):
  // ARRIVE_RADIUS = corner-rounding radius — a waypoint counts as "passed"
  //   once the bot is this close, instead of demanding pixel-exact arrival,
  //   so the bot curves through a corner rather than stopping dead at it.
  // BRAKE_RADIUS = braking point — start easing off full speed this far from
  //   the true final destination, so a patrol stop looks like deceleration,
  //   not a hard freeze.
  // TURN_RATE = max heading change per second — movement direction eases
  //   toward the target direction instead of snapping instantly, which is
  //   what actually produces a curved, natural-looking turn (the funnel path
  //   above already cut the corner geometrically; this is what makes the
  //   bot's own motion trace that curve smoothly instead of in dead-straight
  //   segments with instant pivots at each vertex).
  var ARRIVE_RADIUS = 40, BRAKE_RADIUS = 90, TURN_RATE = BAL.turnRate || 6.0; // (10) на повороте бот шёл дугой и тёрся о угол
  // slope = |Δz|/расстояние по отрезку пути; 0.35 отсекает обычные пологие
  // перепады этажей и ловит именно лестницы/рампы (плюс любой резкий обрыв,
  // что по факту тоже честная "точность падает, не задерживайся" ситуация)
  var STAIRS_SLOPE_THRESHOLD = 0.35;
  bots.forEach(function(bot){
    if(!bot.alive) return;
    bot.px = bot.x; bot.py = bot.y;
    updatePost(bot);
    updateReload(bot);
    if(!bot.post) updateRoamer(bot);
    // этаж под ботом (раздел 9: метка уровня на радаре) — раз в 16 тиков хватает
    if(tick % 16 === 0){ var za = zoneOf(bot.baseX, bot.baseY); bot._zArea = za ? za.z : 0; }
    // "на лестнице" пересчитывается только в ветке движения — если бот
    // остановился (держит угол, стоит на посту), флаг раньше оставался от
    // последнего отрезка пути навсегда: бот, дошедший до поста по лестнице,
    // весь раунд стрелял со штрафом лестницы 0.35 и не мог выбрать "держать
    // угол". Сбрасываем каждый тик; движение ниже выставит заново, если надо.
    bot.onStairs = false;
    // "тихий шаг" (план §3): осторожен, если подозревает, что враг рядом —
    // либо только что видел (lastIntel), либо услышал шаги (heardSound) —
    // но сам сейчас его не видит и не держит угол в открытую (holding
    // уже означает "готов стрелять", там скорость и так 0). bot._sawEnemy
    // тут — с прошлого тика (resolveEngagements считается в конце stepTick),
    // отставание на один тик не критично для решения "идти тише".
    bot.walking = (bot._pie && bot._pie.slice && tick - bot._pie.t < 16 && !bot.holding && !bot._sawEnemy && !(bot.post && /^repos/.test(bot.post.tag))) || !bot.holding && !bot._sawEnemy && !(bot._stopPlantUntil > tick) && !taskOn(bot, "tradeR") &&
      // уход с засвеченного угла после фрага — бегом, а не шифтом (позиция и так известна)
      !(bot.post && /^repos/.test(bot.post.tag) && taskOn(bot, "repos")) &&
      ((bot.lastIntel && tick - bot.lastIntel.tick < CAUTION_TICKS) ||
       (bot.heardSound && tick - bot.heardSound.tick < SOUND_CAUTION_TICKS) ||
       // роумер подходит к точке чека тихо
       (bot.role === "roamer" && !bot.roamChecking && bot.roamTarget && bot.state === "patrol" &&
        Math.hypot(bot.roamTarget.x-bot.baseX, bot.roamTarget.y-bot.baseY) < ROAM_QUIET_RADIUS) ||
       // заход на занятый врагом сайт (ретейк/ротация) — последние метры шагом
       (bot.post && bot.state === "patrol" && (bot.post.tag === "flank1" || bot.post.tag === "flank2")) ||
       (bot.post && bot.state === "patrol" && /^gather/.test(bot.post.tag) && Math.hypot(bot.post.x-bot.baseX, bot.post.y-bot.baseY) < 500) ||
       (bot.post && bot.state === "patrol" && /^probe/.test(bot.post.tag) && Math.hypot(bot.post.x-bot.baseX, bot.post.y-bot.baseY) < 420) ||
       (bot.post && bot.state === "patrol" && bot.post.tag === "shift" && Math.hypot(bot.post.x-bot.baseX, bot.post.y-bot.baseY) < 450) ||
       // клатч T с бомбой: без инфы — на шифте (не палится бегом); бежит,
       // только если время поджимает или все CT известны и далеко
       (BAL.soloSlow && bot.team === "T" && bomb && bomb.state === "carried" && bomb.carrier === bot && aliveCount("T") === 1 && soloMayWalk(bot)) ||
       (BAL.cautious && bot.post && bot.state === "patrol" && /^(retake|rotate|defuse)$/.test(bot.post.tag) &&
        Math.hypot(bot.post.x-bot.baseX, bot.post.y-bot.baseY) < 350) ||
       // лёркер ходит тихо всегда, кроме самого начала (до своей точки на сетапе)
       (bot.tRole === "lurker" && bot.post && bot.state === "patrol" && /^lurk/.test(bot.post.tag) && bot.post.tag !== "lurkStage"+(teamTac.T && teamTac.T.site==="A"?"B":"A")) ||
       (BAL.dangerWalk && dangerWalk(bot)) ||
       // ниндзя-дефуз: последние ~3м к бомбе шифтом, если время позволяет
       (BAL.ninjaDefuse && bomb && bomb.retake && bomb.retake.ninja && bot.post && bot.post.tag === "defuse" &&
        Math.hypot(bot.post.x-bot.baseX, bot.post.y-bot.baseY) < 300 &&
        bombTimeLeftTicks()/TICK_HZ > Math.hypot(bot.post.x-bot.baseX, bot.post.y-bot.baseY)/(SPEED*WALK_SPEED_FRAC) + (bot.kit ? 5 : 10) + 1.5) ||
       // добивание последнего — не бегом в открытую: последние метры тихим шагом
       (bot.post && bot.state === "patrol" && bot.post.tag === "endhunt" && Math.hypot(bot.post.x-bot.baseX, bot.post.y-bot.baseY) < 350));
    knifeTick(bot); prePeekTick(bot); exposedShiftTick(bot);
    var runSpeed = (bot.walking ? SPEED*WALK_SPEED_FRAC : SPEED) * weaponSpeedMul(bot);
    // атакующий, который прямо сейчас видит врага, останавливается и
    // стреляет (контр-страф), а не продолжает бежать по патрульному пути —
    // иначе он сам уходил из линии огня посреди перестрелки. Боковое
    // движение при этом даёт пик (см. peekType ниже).
    // ждёт хлопка флешки тиммейта (поп на убийцу / ретейк) — не выбегает раньше неё
    var waitPop = (bot._waitPopUntil > tick && nadeFlags[bot._waitPopKey] === undefined && !bot._sawEnemy) || (bot._ppWaitUntil > tick && !bot._sawEnemy);
    if(bot._pie && bot._pie.slice && tick - bot._pie.t < 16 && !bot._sawEnemy) runSpeed *= 0.75; // режет угол
    var targetSpeed = (waitPop || bot.holding || bot.roamChecking || bot.atPost || bot.planting || bot.defusing || tick < (bot.throwUntil||0) || (bot.state === "engage" && bot._sawEnemy)) ? 0 : runSpeed;
    // стоит в огне — выбегает из него прямо сейчас, что бы ни делал
    var burn = inFire(bot.baseX, bot.baseY);
    if(burn && !bot.planting && !fireCommit(bot)){
      // Из огня бот ВЫХОДИТ обычным бегом по пути к ближайшему краю (раньше его
      // каждый тик сдвигало наружу напрямую — выглядело как отбрасывание).
      bot.atPost = false; bot.defusing = false;
      bot._burning = true;
      if(!bot._fireExit || inFire(bot._fireExit.x, bot._fireExit.y) || bot._fireExitFire !== burn){
        var best = null, bd = Infinity;
        for(var ai=0; ai<12; ai++){
          var aa = ai*Math.PI/6, rr = NADE.molly.radius + 28;
          var qx = burn.x + Math.cos(aa)*rr, qy = burn.y + Math.sin(aa)*rr;
          if(insideSolidWall(qx, qy) || crossesWall(bot.baseX, bot.baseY, qx, qy)) continue;
          var dq = Math.hypot(qx-bot.baseX, qy-bot.baseY);
          // ближе всего — и лучше в сторону, куда бот и так шёл
          if(bot.post) dq += Math.hypot(qx-bot.post.x, qy-bot.post.y)*(BAL.fireExit ? 0.08 : 0.3);   // (v151) ближний край важнее, не через весь огонь
          if(dq < bd){ bd = dq; best = {x:qx, y:qy}; }
        }
        bot._fireExit = best; bot._fireExitFire = burn;
        if(best){ bot.path = [[best.x, best.y, bot.z]]; bot.pathIdx = 0; }
      }
      // (v151) раньше путь наружу перебивали пост/бой каждый тик, а держащий угол
      // вообще не двигался — стоял в огне. Теперь, пока горит, путь только наружу
      if(BAL.fireExit && bot._fireExit){
        bot.holding = false;
        var fw = bot.path && bot.path[bot.path.length-1];
        if(!fw || Math.hypot(fw[0]-bot._fireExit.x, fw[1]-bot._fireExit.y) > 4){ bot.path = [[bot._fireExit.x, bot._fireExit.y, bot.z]]; bot.pathIdx = 0; }
        bot.walking = false; bot.crouching = false;   // из огня — бегом, не шифтом
      }
      targetSpeed = BAL.fireExit ? SPEED * weaponSpeedMul(bot) : runSpeed;
    } else { bot._burning = false; if(bot._fireExit){ bot._fireExit = null; bot._fireExitFire = null; } }
    if(!bot.holding && bot.path.length){
      var finalWp = bot.path[bot.path.length-1];
      var dFinal = Math.hypot(finalWp[0]-bot.baseX, finalWp[1]-bot.baseY);
      if(dFinal < BRAKE_RADIUS) targetSpeed = runSpeed * Math.max(0.35, dFinal/BRAKE_RADIUS);
    }
    // ослеплён: либо шаг назад за угол (путь уже задан в onBlind), либо стоп
    if(BAL.blindPlay && bot._blind && tick < bot._blind.until && !burn){
      targetSpeed = bot._blind.back ? runSpeed*0.55 : 0;
      if(!bot._blind.back) bot.crouching = true;
    } else if(bot._blind && tick >= bot._blind.until){ bot._blind = null; }
    if(bot.curSpeed < targetSpeed) bot.curSpeed = Math.min(targetSpeed, bot.curSpeed+maxDelta);
    else if(bot.curSpeed > targetSpeed) bot.curSpeed = Math.max(targetSpeed, bot.curSpeed-maxDelta);
    if(BAL.tagging && tick < (bot._tagUntil||0)) bot.curSpeed = Math.min(bot.curSpeed, SPEED*0.4);
    if(tick % 16 === 0){ var TR = bot._trail || (bot._trail = []); TR.push({x:bot.baseX, y:bot.baseY}); if(TR.length > 8) TR.shift(); }
    // стрейф между выстрелами в дальней дуэли
    var dsOn = BAL.duelStrafe && bot._sawEnemy && (bot.state === "engage" || bot.state === "hold") && !bot.peekType && !bot.planting && !bot.defusing &&
               !burn && tick >= (bot.blindUntil||0) && duelStrafeOk(bot);
    if(dsOn){
      var DS = bot._ds;
      if(!DS){ DS = bot._ds = {dir: (hashRand(tick*13 + bot.id.charCodeAt(1)) < 0.5 ? 1 : -1), moving:false, stopT: tick, until: tick + 40}; } // сначала выстрел
      // (С1) стоп → очередь (длину решает режим огня) → шаг → стоп. Стоит, пока не
      // отстрелял очередь (не дольше ~0,6 с, если выстрелить не вышло)
      var burstDone = bot.lastShotTick >= DS.stopT && !(bot._fire && bot._fire.left > 0);
      if(DS.moving ? tick >= DS.until : (burstDone || tick >= DS.until)){
        if(DS.moving){ DS.moving = false; DS.stopT = tick; DS.until = tick + 40; }   // контрстрейф — и очередь
        else { DS.moving = true; DS.dir = -DS.dir;
          // на средней дистанции с винтовкой — короткий шаг (под бёрст), вдали и с пистолетом — шире
          var enD = bot._nearestEnemyBot ? Math.hypot(bot._nearestEnemyBot.x-bot.x, bot._nearestEnemyBot.y-bot.y) : 600;
          var shortS = bot.weapon && bot.weapon.slot !== "secondary" && enD < 600;
          DS.until = tick + (shortS ? 5 : 8) + Math.floor(hashRand(tick*7 + bot.id.charCodeAt(1)*3)*(shortS ? 3 : 5)); }
      }
      if(DS.moving){
        var en = bot._nearestEnemyBot, pA = Math.atan2(en.y-bot.baseY, en.x-bot.baseX) + Math.PI/2;
        var stp = 105*SPD_K*dtSec, nx2 = bot.baseX + Math.cos(pA)*DS.dir*stp, ny2 = bot.baseY + Math.sin(pA)*DS.dir*stp;
        // не выходить из линии на врага и не лезть в стену: иначе разворот
        if(stepBlocked(bot.baseX, bot.baseY, nx2, ny2, bot) || !hasLOS(nx2, ny2, en.x, en.y) || Math.hypot(nx2-(DS.ax||bot.baseX), ny2-(DS.ay||bot.baseY)) > 70){
          DS.dir = -DS.dir; nx2 = bot.baseX; ny2 = bot.baseY;
        }
        if(DS.ax == null){ DS.ax = bot.baseX; DS.ay = bot.baseY; }
        bot.baseX = nx2; bot.baseY = ny2; bot.curSpeed = 105*SPD_K; bot.crouching = false;
      } else bot.curSpeed = 0;
    } else if(bot._ds){ bot._ds = null; }

    // ---------- держит угол "живьём" ----------
    // Стоящий на посту / держащий угол без контакта не стоит статуей: медленно
    // (шагом, тихо) переставляется влево-вправо поперёк направления взгляда
    // в пределах ~25px, иногда замирает. Это настоящее движение (с коллизией),
    // не только анимация. Как только видит врага — сразу стоп (контр-страф).
    var idleHold = (bot.atPost || (bot.holding && !bot._sawEnemy)) && !bot._sawEnemy && !bot.planting && !bot.defusing &&
                   !(bot.post && /^(gather|retake|defuse|save|stopplant|antidefuse|lineup|pickup)/.test(bot.post.tag)) &&
                   tick >= (bot.throwUntil||0) && !burn && !(bot.fakeHoldUntil && tick < bot.fakeHoldUntil);
    if(idleHold){
      if(!bot._hold || bot._hold.post !== bot.post){ bot._hold = {post: bot.post, ax: bot.baseX, ay: bot.baseY, dir: 0, until: tick}; }
      var H = bot._hold;
      if(tick >= H.until){
        var hr = hashRand(tick*7 + bot.id.charCodeAt(0)*31 + bot.id.length*101);
        H.dir = hr < 0.25 ? 0 : (hr < 0.62 ? 1 : -1);          // иногда просто стоит
        H.until = tick + 55 + Math.floor(hashRand(tick*3 + bot.id.charCodeAt(0))*110);
        H.fwd = (hashRand(tick*11 + bot.id.length) - 0.5) * 14;  // чуть вперёд/назад
      }
      var lookA = bot.facing !== undefined ? bot.facing : 0;
      var pa = lookA + Math.PI/2;
      var tx = H.ax + Math.cos(pa)*H.dir*24 + Math.cos(lookA)*(H.fwd||0);
      var ty = H.ay + Math.sin(pa)*H.dir*24 + Math.sin(lookA)*(H.fwd||0);
      var sdx = tx - bot.baseX, sdy = ty - bot.baseY, sd = Math.hypot(sdx, sdy);
      var STRAFE = 38*SPD_K; // px/с — медленнее тихого шага
      if(sd > 1.5){
        var st = Math.min(sd, STRAFE*dtSec);
        var sx = bot.baseX + sdx/sd*st, sy = bot.baseY + sdy/sd*st;
        if(!stepBlocked(bot.baseX, bot.baseY, sx, sy, bot)){ bot.baseX = sx; bot.baseY = sy; bot.curSpeed = STRAFE; bot.walking = true; }
        else H.until = tick; // упёрся — сменить направление
      } else if(bot.curSpeed <= STRAFE) bot.curSpeed = 0;
    } else if(bot._hold && !bot.atPost && !bot.holding){ bot._hold = null; }

    // ---------- эмиссия звука шагов (план §13, минимальная версия для §3) ----------
    // Дискретные "шаги" с интервалом, не сплошное поле — бег громче и чаще,
    // тихий шаг тише и реже. Без затухания через стены (упрощение v1 — если
    // понадобится точнее, тут же место, где учитывать hasLOS/дистанцию до стены).
    // вода (Ancient: Water между мидом и B) — всплески слышно громче, и даже шифтом
    var wet = bot.curSpeed > 5 && inWater(bot.baseX, bot.baseY);
    if(bot.curSpeed > 5 && (!(BAL.silentWalk && bot.walking) || wet)){ // шифт (тихий шаг) не слышно, как в CS
      var stepInterval = bot.walking ? FOOTSTEP_INTERVAL_WALK : FOOTSTEP_INTERVAL_RUN;
      if(tick - bot.lastStepTick >= stepInterval){
        bot.lastStepTick = tick;
        var soundRadius = (wet ? (bot.walking ? 220 : 460) : (bot.walking ? SOUND_RADIUS_WALK : SOUND_RADIUS_RUN)) * (BAL.stepHearMul || 1);
        soundPings.push({x:bot.baseX, y:bot.baseY, team:bot.team, born:nowTs, radius:soundRadius});
        // (4) сам знает, что шумит: бежал в пределах слышимости места, где враг вероятен
        if(BAL.heardMe && roundState === "live"){ var zN = bzOf(bot.x, bot.y); if(zN >= 0){ var nearZ = [zN].concat(BZ.nbr[zN]||[]);
          if(nearZ.some(function(j){ var cj = BZ.cent[j]; return cj && Math.hypot(cj.x-bot.x, cj.y-bot.y) < soundRadius && reachPossible(bot.team, j) && beliefZoneKnown(bot.team, j) >= 0.2; })) bot._noisyT = tick; } }
        if(soundPings.length > 40) soundPings.shift();
        bots.forEach(function(listener){
          if(listener===bot || !listener.alive || listener.team===bot.team) return;
          var dHear = Math.hypot(listener.x-bot.x, listener.y-bot.y);
          if(dHear > soundRadius) return;
          // через стену шаги глуше: слышно только ближе (~75% радиуса)
          var occS = !hasLOS(listener.x, listener.y, bot.x, bot.y);
          if(occS && dHear > soundRadius*0.75) return;
          var wasStale = !listener.heardSound || (tick - listener.heardSound.tick) > 90;
          // звук как вероятностное пятно, не точная координата (план §13) —
          // джиттер растёт вместе с дистанцией до источника
          var jitterMag = 20 + dHear*0.12;
          var jr = hashRand(tick*331 + bot.id.charCodeAt(0)*17 + listener.id.charCodeAt(0)*11 + bot.lastStepTick);
          var jang = jr * Math.PI*2;
          var hpF = hearPos(listener, bot.x, bot.y, tick*331 + bot.id.charCodeAt(0)*17 + listener.id.charCodeAt(0)*11 + bot.lastStepTick, occS);
          listener.heardSound = hpF ? {x:hpF.x, y:hpF.y, tick:tick, team:bot.team, src:bot.id, kind: wet ? "water" : "steps"}
                                    : {x:bot.x+Math.cos(jang)*jitterMag, y:bot.y+Math.sin(jang)*jitterMag, tick:tick, team:bot.team, src:bot.id, kind:"steps"};
          if(wasStale) logEvent(listener.id+" услышал "+(wet ? "всплески в воде" : "шаги")+" ("+bot.team+")"+(bot.walking?" (тихо)":"")+(occS ? " за стеной" : ""));
        });
      }
    }

    if(!((bot.holding && !bot._burning) || bot.curSpeed <= 0.5)){
      if(bot.path.length === 0 || bot.pathIdx >= bot.path.length){
        if(bot.forcedRetreat) bot.forcedRetreat = false;
        assignNewDestination(bot, tick);
      } else {
        // corner rounding: skip ahead past any waypoint already within
        // ARRIVE_RADIUS (except the last — that one must be actually reached)
        // ...но только если от текущей позиции до СЛЕДУЮЩЕЙ точки прямая
        // свободна. Раньше точка у угла стены пропускалась "досрочно" за 40px,
        // и бот срезал прямо в угол — вершины пути как раз стоят вплотную к
        // углам, так что это была главная причина "упёрся и трётся об стену".
        // (вплотную, <6px, точка считается пройденной в любом случае — иначе
        // бот, стоящий ровно в вершине у угла, так бы в ней и остался)
        while(bot.pathIdx < bot.path.length-1){
          var wdCur = Math.hypot(bot.path[bot.pathIdx][0]-bot.baseX, bot.path[bot.pathIdx][1]-bot.baseY);
          if(wdCur < 6 || (wdCur < ARRIVE_RADIUS && !crossesWall(bot.baseX, bot.baseY, bot.path[bot.pathIdx+1][0], bot.path[bot.pathIdx+1][1]))) bot.pathIdx++;
          else break;
        }
        var target = bot.path[bot.pathIdx];
        var dx = target[0]-bot.baseX, dy = target[1]-bot.baseY;
        var dist = Math.hypot(dx,dy);
        var isLastLeg = bot.pathIdx === bot.path.length-1;
        var step = bot.curSpeed * dtSec;

        // "лестницы" (план §3): нет отдельного типа портала на навмеше, зато
        // funnel() уже даёт высоту (z) каждой точки пути (elevation, не этаж-
        // индекс) — крутой подъём/спуск на коротком отрезке ЭТО и есть лестница/
        // рампа. Считаем прямо по текущему отрезку пути, каждый тик — дёшево,
        // всего одна точка сравнения, а не отдельная предрасчитанная разметка.
        var legFromZ = bot.pathIdx > 0 ? bot.path[bot.pathIdx-1][2] : bot.z;
        var legToZ = target[2];
        var legLen = Math.max(1, Math.hypot(target[0]-(bot.pathIdx>0?bot.path[bot.pathIdx-1][0]:bot.baseX), target[1]-(bot.pathIdx>0?bot.path[bot.pathIdx-1][1]:bot.baseY)));
        bot.onStairs = Math.abs(legToZ - legFromZ) / legLen > STAIRS_SLOPE_THRESHOLD;

        // smooth turning: ease the actual movement heading toward the
        // direction to target, capped at TURN_RATE — this is what replaces
        // the old instant-snap "walk in dead-straight lines" motion
        var desiredHeading = dist > 0.01 ? Math.atan2(dy,dx) : (bot.heading!==undefined ? bot.heading : 0);
        if(bot.heading === undefined) bot.heading = desiredHeading;
        var da = desiredHeading - bot.heading;
        da = ((da + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI; // shortest signed angle
        // при отходе разворачиваемся сразу, а не плавной дугой: иначе бот по
        // инерции ещё несколько шагов бежал туда же, куда бежал — то есть на врага
        var maxTurn = TURN_RATE * dtSec * (bot.state === "retreat" ? 5 : 1);
        bot.heading += Math.max(-maxTurn, Math.min(maxTurn, da));
        if(bot.facing === undefined) bot.facing = bot.heading; // first tick / just respawned — nothing to derive an actual-movement facing from yet
        // NOTE: bot.facing (the rendered/visual direction) is otherwise set
        // further down from the ACTUAL movement this tick, not from
        // bot.heading — see the comment there for why.

        var moveX, moveY;
        if(isLastLeg && dist <= step){
          moveX = dx; moveY = dy; // final approach: snap exactly onto the true destination, don't overshoot or orbit it
        } else {
          // (10) крутой поворот: сбросить скорость, а не бежать дугой по старому
          // направлению в угол стены (там бот тёрся и "залипал")
          var daLeft = Math.abs(((desiredHeading - bot.heading + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
          if(BAL.cornerSlow && daLeft > 0.5){ var cs = Math.max(0.3, 1 - (daLeft-0.5)/1.6); step *= cs; bot.curSpeed = Math.min(bot.curSpeed, Math.max(bot.curSpeed*0.9, runSpeed*cs)); }
          moveX = Math.cos(bot.heading) * step;
          moveY = Math.sin(bot.heading) * step;
        }
        var nx = bot.baseX+moveX, ny = bot.baseY+moveY;
        var startX = bot.baseX, startY = bot.baseY;
        // walls are a physical obstacle for movement (not just LOS) — a
        // straight zone-to-portal-to-zone line can still clip a wall corner
        // on a hand-drawn map, so check before committing the step.
        if(!stepBlocked(bot.baseX,bot.baseY,nx,ny,bot)){ // стены + в огонь без причины не заходим
          bot.baseX = nx; bot.baseY = ny;
          if(isLastLeg && dist <= step){ bot.baseX = target[0]; bot.baseY = target[1]; bot.z = target[2]; bot.pathIdx++; }
        } else {
          // blocked — first try the basic wall-slide (each axis alone),
          // then, if that ALSO fails (both axes blocked — a corner, or a
          // local navmesh/wall mismatch pinning the bot right against
          // something), probe a fan of directions around the desired
          // heading and take the first that's actually clear. This is what
          // stops the "faces the wall and does nothing for half a second"
          // look: instead of freezing until stuckTicks forces a repath, the
          // bot immediately sidesteps around whatever it hit, the same tick.
          // Слайд засчитывается, только если он реально двигает бота: когда
          // бот смотрит почти перпендикулярно в стену, составляющая вдоль стены
          // крошечная (доли пикселя) — раньше такой "слайд" считался успехом,
          // веер проб не запускался, и бот тёрся об стену до сброса пути.
          var minSlide = step*0.3;
          var nx1 = bot.baseX+moveX;
          var slid = false;
          if(Math.abs(moveX) >= minSlide && !stepBlocked(bot.baseX,bot.baseY,nx1,bot.baseY,bot)){
            bot.baseX = nx1; slid = true;
          } else {
            var ny2 = bot.baseY+moveY;
            if(Math.abs(moveY) >= minSlide && !stepBlocked(bot.baseX,bot.baseY,bot.baseX,ny2,bot)){
              bot.baseY = ny2; slid = true;
            }
          }
          if(!slid){
            var probeAngles = [30,-30,60,-60,90,-90,120,-120,150,-150,180];
            for(var pa=0; pa<probeAngles.length; pa++){
              var pang = bot.heading + probeAngles[pa]*Math.PI/180;
              var pstep = step*0.7; // shorter step while feeling around a corner — less likely to clip something else
              var pnx = bot.baseX + Math.cos(pang)*pstep, pny = bot.baseY + Math.sin(pang)*pstep;
              if(!stepBlocked(bot.baseX,bot.baseY,pnx,pny,bot)){
                bot.baseX = pnx; bot.baseY = pny;
                break;
              }
            }
          }
        }
        // stuck detection uses REAL distance covered this tick, not which
        // branch ran — a wall-slide that only inches forward (e.g. the path
        // runs almost flush along a jagged wall) must still count as stuck,
        // otherwise the bot "moves" by fractions of a pixel forever instead
        // of ever giving up on a bad straight-line path.
        var actuallyMoved = Math.hypot(bot.baseX-startX, bot.baseY-startY);
        // "топчется": каждый тик куда-то сдвигается (веер проб у угла туда-сюда),
        // но за 1.5с никуда не ушёл — раньше это не считалось застреванием
        // (движение в тике было), и бот стоял у угла с кругами шагов
        if(!bot._np || Math.hypot(bot.baseX-bot._np.x, bot.baseY-bot._np.y) > 14){ bot._np = {x:bot.baseX, y:bot.baseY, t:tick}; }
        else if(tick - bot._np.t > 96){
          bot._netStuck = (bot._netStuck||0) + 1;
          var wpN = bot.path[bot.pathIdx];
          if(bot._netStuck >= 3 && wpN){
            // упорно не проходит — шаг прямо к следующей точке пути по навмешу
            var toward = snapToWalkable(bot.baseX + (wpN[0]-bot.baseX)*0.35, bot.baseY + (wpN[1]-bot.baseY)*0.35);
            if(toward && Math.hypot(toward.x-bot.baseX, toward.y-bot.baseY) > 4){ bot.baseX = toward.x; bot.baseY = toward.y; bot.x = toward.x; bot.y = toward.y; }
            if(bot.pathIdx < bot.path.length-1) bot.pathIdx++;
            bot._netStuck = 0;
          } else { escapeWallLine(bot); bot.path = []; bot.pathIdx = 0; }
          bot._np = {x:bot.baseX, y:bot.baseY, t:tick};
        }
        // facing follows where the bot ACTUALLY went this tick, not where it
        // wanted to go — this is what kills the "spins in place while stuck"
        // look: bot.heading (the steering target above) keeps chasing the
        // blocked destination every tick, but the rendered facing now only
        // turns when the bot is really moving somewhere.
        if(actuallyMoved > 0.15 && !bot.lookTarget){
          // плавно, а не рывком — иначе после того как бот перестал смотреть
          // на звук/врага, взгляд мгновенно щёлкал бы обратно по ходу движения
          var mvA = Math.atan2(bot.baseY-startY, bot.baseX-startX);
          var mvD = ((mvA - bot.facing + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI;
          var mvStep = TURN_RATE * dtSec;
          bot.facing += Math.max(-mvStep, Math.min(mvStep, mvD));
        }
        if(actuallyMoved > Math.max(0.3, step*0.15)){
          bot.stuckTicks = 0;
          if(actuallyMoved > step*0.6) bot._stuckResets = 0;
        } else {
          bot.stuckTicks = (bot.stuckTicks||0) + 1;
          if(bot.stuckTicks > 40){
            // второй подряд "совсем не двигается" без нормального движения между
            // ними — бот, скорее всего, стоит ровно НА линии стены (тогда любое
            // движение формально её пересекает). Сдвигаем на несколько px в
            // свободную сторону, иначе он так и будет стоять до конца раунда.
            bot._stuckResets = (bot._stuckResets||0) + 1;
            if(bot._stuckResets >= 2){ escapeWallLine(bot); bot._stuckResets = 0; } // was 90 (~1.4s) — with local navmesh/wall mismatches near doorways more likely right now (calibration mid-progress), a bot pinned there should give up and re-path faster (~0.6s) instead of visibly grinding against the corner
            // this straight-line path is bad (cuts through wall geometry a
            // hand-drawn zone shouldn't have allowed) — drop it and pick a
            // fresh destination rather than crawl forever
            bot.path = []; bot.pathIdx = 0; bot.stuckTicks = 0;
          }
        }
        // Второй детектор — по ПРОГРЕССУ, а не по скорости: бот может
        // двигаться каждый тик (веер проб толкает его то влево, то вправо), но
        // топтаться на месте бесконечно — детектор выше такое не ловит, потому
        // что формально он "двигается". Если за ~1.5с он не приблизился к
        // следующей точке пути хотя бы на 8px — путь плохой, берём новый.
        if(bot._progPath !== bot.path || bot._progIdx !== bot.pathIdx){
          bot._progPath = bot.path; bot._progIdx = bot.pathIdx;
          bot._progBest = Infinity; bot._progTick = tick;
        }
        if(bot.path.length && bot.pathIdx < bot.path.length){
          var pw = bot.path[bot.pathIdx];
          var pd = Math.hypot(pw[0]-bot.baseX, pw[1]-bot.baseY);
          if(pd < bot._progBest - 8){ bot._progBest = pd; bot._progTick = tick; }
          else if(tick - bot._progTick > 96){
            bot.path = []; bot.pathIdx = 0; bot.stuckTicks = 0;
          }
        }
      }
    }

    var offX = 0, offY = 0;
    if(bot.state === "engage" && bot.peekType){
      var nb = bot._nearestEnemyBot;
      var dirAng = bot._peekDir != null ? bot._peekDir : (nb ? Math.atan2(nb.y-bot.baseY, nb.x-bot.baseX) : (bot.facing||0));
      var perp = dirAng + Math.PI/2;
      var side = bot._peekSide || ((bot.id.charCodeAt(bot.id.length-1) % 2 === 0) ? 1 : -1);
      var dt2 = tick - bot.peekSinceTick, amp = 0, stillActive = true;
      // пока из пика реально видно врага — не уходим обратно за угол
      // посреди перестрелки: фаза "стою выглянув" продлевается, пока есть контакт
      if(bot._sawEnemy){
        var pkS0 = SPEED*weaponSpeedMul(bot)/TICK_HZ;
        var holdEnd = BAL.smoothPeek ? (bot.peekType === "wide" ? Math.round(42/pkS0*1.3)+24-1 : (bot.peekType === "shoulder" ? Math.round(16/pkS0*1.2)+6-1 : -1))
                                     : (bot.peekType === "wide" ? 8+24-1 : (bot.peekType === "shoulder" ? 4+10-1 : -1));
        if(holdEnd > 0 && dt2 > holdEnd){ bot.peekSinceTick = tick - holdEnd; dt2 = holdEnd; }
      }
      // (v151) раньше широкий пик сдвигал на 60px за 0.12с — в ~5 раз быстрее бега.
      // Теперь пик идёт со скоростью бега этим оружием, плавно (разгон/торможение)
      var pkS = BAL.smoothPeek ? SPEED*weaponSpeedMul(bot)/TICK_HZ : 0;
      var ease = function(u){ u = Math.max(0, Math.min(1, u)); return u*u*(3-2*u); };
      if(bot.peekType === "wide"){
        var A1 = BAL.smoothPeek ? 42 : 60, r1 = BAL.smoothPeek ? Math.round(A1/pkS*1.3) : 8, h1 = 24;
        if(dt2<r1) amp = A1*(BAL.smoothPeek ? ease(dt2/r1) : dt2/r1);
        else if(dt2<r1+h1) amp = A1;
        else if(dt2<r1*2+h1) amp = A1*(BAL.smoothPeek ? 1-ease((dt2-r1-h1)/r1) : 1-(dt2-r1-h1)/r1);
        else stillActive = false;
      } else if(bot.peekType === "shoulder"){
        var A2 = BAL.smoothPeek ? 16 : 32, r2 = BAL.smoothPeek ? Math.round(A2/pkS*1.2) : 4, h2 = BAL.smoothPeek ? 6 : 10;
        if(dt2<r2) amp = A2*(BAL.smoothPeek ? ease(dt2/r2) : dt2/r2);
        else if(dt2<r2+h2) amp = A2;
        else if(dt2<r2*2+h2) amp = A2*(BAL.smoothPeek ? 1-ease((dt2-r2-h2)/r2) : 1-(dt2-r2-h2)/r2);
        else stillActive = false;
      } else if(bot.peekType === "jiggle"){
        amp = BAL.smoothPeek ? 12*Math.sin(dt2*0.2) : 22*Math.sin(dt2*0.35);
      }
      if(!stillActive){ bot.peekType = null; }
      offX = Math.cos(perp)*side*amp;
      offY = Math.sin(perp)*side*amp;
      // don't let a peek lean shove the bot's rendered/combat position through
      // a wall — clamp to the path position if the lean would clip one
      if(crossesWall(bot.baseX,bot.baseY,bot.baseX+offX,bot.baseY+offY)){ offX = 0; offY = 0; }
    }
    // Пик закончился (или бот перешёл из "атакует" в "держит угол"), пока он
    // всё ещё видит врага: раньше смещение пика просто обнулялось, и бот
    // мгновенно "телепортировался" на 30-85px обратно за угол — терял
    // линию обзора, и стрельба с обеих сторон обрывалась. Теперь позиция,
    // где он стоял в момент пика, становится его реальной позицией.
    if(offX === 0 && offY === 0 && (bot._prevOffX || bot._prevOffY) && bot._sawEnemy){
      var cX = bot.baseX + bot._prevOffX, cY = bot.baseY + bot._prevOffY;
      if(!crossesWall(bot.baseX, bot.baseY, cX, cY)){ bot.baseX = cX; bot.baseY = cY; }
    }
    bot._prevOffX = offX; bot._prevOffY = offY;
    bot.x = bot.baseX + offX;
    bot.y = bot.baseY + offY;
  });
  resolveEngagements();
  if(BAL.smokeSpam) smokeSpamTick(); else smokeShots();
  infoFallbackTick();
  if(BAL.smokeReact) smokeHeTick();
  teamInfoTick(); // раздел 11: коллы из восприятия этого тика → командная память
  beliefTick();   // раздел 13: карта вероятностей врага
  checkRoundEnd();
}

