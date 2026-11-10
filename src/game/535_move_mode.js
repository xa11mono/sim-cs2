// ======================= (v522) РЕЖИМ ДВИЖЕНИЯ — одно место: шагом / бегом / стоять =======================
// Раньше эти решения были размазаны по stepTick одним условием из полутора десятков причин и цепочкой отмен после него.
// Логика перенесена сюда БЕЗ изменений (тот же порядок проверок, отпечаток бит в бит) — но теперь у решения есть причина:
//   bot._walkWhy — почему идёт шагом (null — не шагом), bot._runWhy — какая отмена сняла шаг (null — не снимала),
//   bot._stopWhy — почему целевая скорость 0 или урезана (null — обычный ход).
// ПРАВИЛО: новая причина идти шагом / бежать / стоять добавляется строкой СЮДА (moveWalkWhy / moveRunWhy / moveSpeedTick),
// на своё место по порядку, а не отдельной проверкой в другом файле. Порядок причин — пока как сложился исторически
// (первая подходящая); замена на таблицу важности — следующий шаг (00_PLAN.md), он уже меняет игру.
// Вне этого файла скорость ещё задают: перестрелка (fightCycleTick / fightStrafe, 470 — после неё stepTick ставит скорость
// фазы _fc), лестница (ladderTick, 370), стрейф на посту, торможение в повороте (cornerSlow) и «жду у огня» (fireWait) — в
// ветке движения stepTick. Они — физика шага, а не решение «как идти»; сюда переносить вместе с таблицей важности.
var MOVE = {run: 0, burn: null};   // выход moveSpeedTick: скорость бега после поправок и огонь под ботом (нужны stepTick дальше)

// почему бот идёт шагом (первая подходящая причина; null — не шагом)
function moveWalkWhy(bot){
  if(BAL.pieSlice && bot._pie && bot._pie.slice && tick - bot._pie.t < 16 && !bot.holding && !bot._sawEnemy && !(bot.post && /^repos/.test(bot.post.tag))) return "режет угол";
  // "тихий шаг" (план §3): осторожен, если подозревает, что враг рядом —
  // либо только что видел (lastIntel), либо услышал шаги (heardSound) —
  // но сам сейчас его не видит и не держит угол в открытую (holding
  // уже означает "готов стрелять", там скорость и так 0). bot._sawEnemy
  // тут — с прошлого тика (resolveEngagements считается в конце stepTick),
  // отставание на один тик не критично для решения "идти тише".
  if(bot.holding || bot._sawEnemy || bot._stopPlantUntil > tick || (bot._tradeLock && bot._tradeLock.until > tick)) return null;
  // уход с засвеченного угла после фрага — бегом, а не шифтом (позиция и так известна)
  if(bot.post && /^repos/.test(bot.post.tag) && bot._reposUntil > tick) return null;
  // (v438, док 27.10) свежая инфа / звук — шагом, только если этот враг сам может услышать мой бег (≤ 1,5 слышимости бега — проектное
  // число: враг мог подойти). Было — любой звук: выстрелы за 2000 px давали 6 с шифта по всей карте
  if(bot.lastIntel && tick - bot.lastIntel.tick < CAUTION_TICKS && Math.hypot(bot.lastIntel.x-bot.baseX, bot.lastIntel.y-bot.baseY) <= 1.5*STEP_HEAR_R()) return "видел врага рядом";
  if(bot.heardSound && tick - bot.heardSound.tick < SOUND_CAUTION_TICKS && Math.hypot(bot.heardSound.x-bot.baseX, bot.heardSound.y-bot.baseY) <= 1.5*STEP_HEAR_R()) return "слышал врага рядом";
  // роумер подходит к точке чека тихо
  if(bot.role === "roamer" && !bot.roamChecking && bot.roamTarget && bot.state === "patrol" &&
     Math.hypot(bot.roamTarget.x-bot.baseX, bot.roamTarget.y-bot.baseY) < ROAM_QUIET_RADIUS) return "роумер у точки чека";
  // заход на занятый врагом сайт (ретейк/ротация) — последние метры шагом
  if(bot.post && bot.state === "patrol" && (bot.post.tag === "flank1" || bot.post.tag === "flank2")) return "фланг";
  if(bot.post && bot.state === "patrol" && /^gather/.test(bot.post.tag) && Math.hypot(bot.post.x-bot.baseX, bot.post.y-bot.baseY) < 500) return "сбор на ретейк — последние метры";
  if(bot.post && bot.state === "patrol" && /^probe/.test(bot.post.tag) && Math.hypot(bot.post.x-bot.baseX, bot.post.y-bot.baseY) < 420) return "проба — последние метры";
  if(bot.post && bot.state === "patrol" && bot.post.tag === "shift" && Math.hypot(bot.post.x-bot.baseX, bot.post.y-bot.baseY) < 450) return "перестановка — последние метры";
  // клатч T с бомбой: без инфы — на шифте (не палится бегом); бежит,
  // только если время поджимает или все CT известны и далеко
  if(BAL.soloSlow && bot.team === "T" && bomb && bomb.state === "carried" && bomb.carrier === bot && aliveCount("T") === 1 && soloMayWalk(bot)) return "клатч с бомбой";
  if(BAL.cautious && bot.post && bot.state === "patrol" && /^(retake|rotate|defuse)$/.test(bot.post.tag) &&
     Math.hypot(bot.post.x-bot.baseX, bot.post.y-bot.baseY) < 350) return "ретейк / ротация / дефуз — последние метры";
  // лёркер ходит тихо всегда, кроме самого начала (до своей точки на сетапе)
  if(bot.tRole === "lurker" && bot.post && bot.state === "patrol" && /^lurk/.test(bot.post.tag) && bot.post.tag !== "lurkStage"+(teamTac.T && teamTac.T.site==="A"?"B":"A")) return "лёркер";
  if(BAL.dangerWalk && dangerWalk(bot)) return "опасное место";
  // (v323, М39) к дефузу близко — подходит шифтом, чтобы не выдать себя, если время есть (defuseWalk)
  if(defuseWalk(bot)) return "подход к дефузу";
  // добивание последнего — не бегом в открытую: последние метры тихим шагом
  if(bot.post && bot.state === "patrol" && bot.post.tag === "endhunt" && Math.hypot(bot.post.x-bot.baseX, bot.post.y-bot.baseY) < 350) return "охота на последнего — последние метры";
  return null;
}
// почему шаг отменён — бегом (первая подходящая причина; зовётся, только когда moveWalkWhy сказал «шагом»)
function moveRunWhy(bot){
  // (v257, К3) врагов живых нет (видно по табло) — шагом идти не от кого
  if(aliveCount(bot.team === "CT" ? "T" : "CT") === 0) return "врагов не осталось";
  // (v299, И43, владелец 14.10: T0 стрелялся на A, лёркер T4 шёл к бою на шифте) тиммейт рядом уже в перестрелке (видит врага ≥ 0,3 с,
  // как у дабл-пика, или стрелял / по нему стреляли за 2 с) в 900 px от меня, а моя точка — не дальше 600 px от него: иду к бою — бегом, тишина уже ничего не даёт
  if(bot.post && !/^(defuse|plantspot)/.test(bot.post.tag) && bots.some(function(m){ return m !== bot && m.alive && m.team === bot.team &&
       ((m._sawEnemy && (m.contactStreak||0) >= 20) || tick - (m.lastShotTick||-1e9) < 2*TICK_HZ || tick - (m._shotAtT||-1e9) < 2*TICK_HZ) && Math.hypot(m.x-bot.baseX, m.y-bot.baseY) < 900 && Math.hypot(m.x-bot.post.x, m.y-bot.post.y) < 600; })) return "свой рядом уже в бою";
  // (v257, К3) ретейк: шагом — только если шагом успевает дойти до бомбы и дефузнуть (та же мерка, что у ниндзя-дефуза)
  if(bot.team === "CT" && bomb && bomb.state === "planted" && bot.post && /^(gather|retake|defuse|rotate)/.test(bot.post.tag)){
    var dB = Math.hypot(bomb.x-bot.baseX, bomb.y-bot.baseY);
    if(bombTimeLeftTicks()/TICK_HZ <= dB/(SPEED*WALK_SPEED_FRAC) + (bot.kit ? 5 : 10) + 1.5) return "шагом не успеть к дефузу";
  }
  // (v438, док владельца 27.10: NiKo за 3,5 с до взрыва шёл шифтом и погиб от бомбы) в зоне смертельного взрыва (урон ≥ HP, BOMB_DMG) —
  // шагом, только если шагом успевает выйти из неё до взрыва (+1 с — проектное число); иначе бегом. Любая сторона, любая задача
  if(bomb && bomb.state === "planted" && bombDamageAt(bot.baseX, bot.baseY) >= bot.hp){
    var rKill = BOMB_DMG.sigma*Math.sqrt(2*Math.log(BOMB_DMG.max/Math.max(1, bot.hp))), dOut = Math.max(0, rKill - bombPathLen(bot.baseX, bot.baseY));
    if(bombTimeLeftTicks()/TICK_HZ <= dOut/(SPEED*WALK_SPEED_FRAC) + 1) return "шагом не выйти из взрыва";
  }
  return null;
}
// шагом или бегом — одно место записи bot.walking
function moveWalkTick(bot){
  var w = moveWalkWhy(bot), r = null;
  if(bot.nadeTask && bot.nadeTask.runPh === "go"){   // (разбег гранаты) шаг или бег — как у эталона про (380)
    if(bot.nadeTask.runWalk) w = "разбег гранаты шагом"; else { w = null; r = "разбег гранаты бегом"; } }
  if(w){ var rr = moveRunWhy(bot); if(rr){ r = rr; w = null; } }
  bot.walking = !!w; bot._walkWhy = w; bot._runWhy = r;
}
// целевая скорость этого тика: стоять / идти / выбегать из огня / тормозить; заодно разгон к ней. Возвращает ничего;
// MOVE.run — скорость хода после поправок, MOVE.burn — огонь под ботом
function moveSpeedTick(bot, runSpeed, BRAKE_RADIUS, maxDelta){
  var why = null;
  // ждёт хлопка флешки тиммейта (поп на убийцу / ретейк) — не выбегает раньше неё
  var waitPop = (bot._waitPopUntil > tick && nadeFlags[bot._waitPopKey] === undefined && !bot._sawEnemy) || (BAL.pieSlice && bot._ppWaitUntil > tick && !bot._sawEnemy);
  if(BAL.pieSlice && bot._pie && bot._pie.slice && tick - bot._pie.t < 16 && !bot._sawEnemy) runSpeed *= 0.75; // режет угол
  var targetSpeed = runSpeed;
  if(waitPop){ targetSpeed = 0; why = "ждёт флешку своего"; } else if(bot.holding){ targetSpeed = 0; why = "держит угол"; } else if(bot.roamChecking){ targetSpeed = 0; why = "роумер проверяет точку"; }
  else if(bot.atPost){ targetSpeed = 0; why = "на посту"; } else if(bot.planting){ targetSpeed = 0; why = "ставит бомбу"; } else if(bot.defusing){ targetSpeed = 0; why = "дефузит"; }
  else if(tick < (bot.throwUntil||0)){ targetSpeed = 0; why = "бросает гранату"; } else if(bot.state === "engage" && bot._sawEnemy){ targetSpeed = 0; why = "стреляет по врагу"; }
  // (v375, владелец: «в 4 раунде все по одному выходили из T Ramp и умирали») демки Mirage: первый T, входящий на сайт (≤ 250
  // от него), один (своих ближе 500 нет) в 13 % раундов у про и в 29 % у ботов; второй входит через 2,0 с у про и 3,0 с у ботов.
  // Перед входом на сайт один — ждёт напарника на размен до ENTRY_WAIT (2 с — медиана про), потом идёт; лёркер и бой — без ожидания
  var stS = bot.team === "T" && bomb.state !== "planted" && teamTac.T && SITES[teamTac.T.site];
  if(stS && targetSpeed > 0 && bot.tRole !== "lurker" && !bot._sawEnemy && bot.post && Math.hypot(bot.post.x-stS.x, bot.post.y-stS.y) < 250){
    var dS0 = Math.hypot(bot.baseX-stS.x, bot.baseY-stS.y), alone = !bots.some(function(o){ return o !== bot && o.alive && o.team === "T" && Math.hypot(o.x-bot.x, o.y-bot.y) < 500; });
    var anyMate = bots.some(function(o){ return o !== bot && o.alive && o.team === "T" && o.tRole !== "lurker"; });
    if(dS0 > 250 && dS0 < 340 && alone && anyMate){ if(!bot._entryWait || bot._entryWait.round !== roundNum) bot._entryWait = {t:tick, round:roundNum};
      if(tick - bot._entryWait.t < ENTRY_WAIT){ targetSpeed = 0; why = "ждёт напарника перед входом на сайт"; if(!bot._entryWait.log){ bot._entryWait.log = true; logEvent(bot.id+": перед входом на сайт — жду напарника на размен"); } } }
    else if(!alone) bot._entryWait = null;
  }
  // стоит в огне — выбегает из него прямо сейчас, что бы ни делал
  var burn = inFire(bot.baseX, bot.baseY);
  if(burn && !fireCommit(bot)){
    // Из огня бот ВЫХОДИТ обычным бегом по пути к ближайшему краю (раньше его
    // каждый тик сдвигало наружу напрямую — выглядело как отбрасывание).
    if(bot.defusing){ bot.defuseCooldownUntil = tick + 32; logEvent(bot.id+" прервал дефуз — молотов, не доживёт"); }
    if(bot.planting){ bot._noPlantUntil = tick + 32; bot._plantAbort = {t:tick, why:"огонь"}; logEvent(bot.id+" прервал плант — молотов, не доживёт"); }
    bot.atPost = false; bot.defusing = false; bot.planting = false;
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
    targetSpeed = BAL.fireExit ? SPEED * weaponSpeedMul(bot) : runSpeed; why = "выбегает из огня";
  } else {
    bot._burning = false; if(bot._fireExit){ bot._fireExit = null; bot._fireExitFire = null; }
    if(burn && targetSpeed > 0) targetSpeed = SPEED * weaponSpeedMul(bot);   // (v263, Б2) идёт по делу через огонь — бегом, не шифтом
  }
  // (v263, Б2) в огне — без торможения у конца пути: точка выхода всего в 28 px за краем, и бот, тормозя к ней, полз по
  // огню в 3–5 раз медленнее бега (на 3 матчах v262 почти все случаи «в огне > 1 с» — это он)
  // (физика гранат: разбег) бросок с разбега — без торможения: в точке броска скорость полная, как у про (380: runupTick)
  if(!bot.holding && bot.path.length && !burn && !(bot.nadeTask && bot.nadeTask.runPh === "go")){
    var finalWp = bot.path[bot.path.length-1];
    var dFinal = Math.hypot(finalWp[0]-bot.baseX, finalWp[1]-bot.baseY);
    if(dFinal < BRAKE_RADIUS){ targetSpeed = runSpeed * Math.max(0.35, dFinal/BRAKE_RADIUS); why = "тормозит у конца пути"; }
  }
  // ослеплён: либо шаг назад за угол (путь уже задан в onBlind), либо стоп
  if(BAL.blindPlay && bot._blind && tick < bot._blind.until && !burn){
    targetSpeed = bot._blind.back ? runSpeed*0.55 : 0; why = bot._blind.back ? "ослеплён — шаг назад" : "ослеплён — стоит";
    if(!bot._blind.back) bot.crouching = true;
  } else if(bot._blind && tick >= bot._blind.until){ bot._blind = null; }
  if(bot.curSpeed < targetSpeed) bot.curSpeed = Math.min(targetSpeed, bot.curSpeed+maxDelta);
  else if(bot.curSpeed > targetSpeed) bot.curSpeed = Math.max(targetSpeed, bot.curSpeed-maxDelta);
  if(BAL.tagging && tick < (bot._tagUntil||0)){ bot.curSpeed = Math.min(bot.curSpeed, SPEED*0.4); why = (why ? why + " + " : "") + "попали — замедлен"; }
  bot._stopWhy = why; MOVE.run = runSpeed; MOVE.burn = burn;
}
