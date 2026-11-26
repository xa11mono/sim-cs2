// [хозяева: movePath, movePathIdx, movePlace, moveRunWhy, moveSetFireExit, moveSetFireExitFire, moveSetStopWhy, moveSetX, moveSetY, moveSpeed, moveSpeedTick, moveWalk, moveWalkTick, moveWalkWhy] ======================= (v522) РЕЖИМ ДВИЖЕНИЯ — одно место: шагом / бегом / стоять =======================
// Раньше эти решения были размазаны по stepTick одним условием из полутора десятков причин и цепочкой отмен после него.
// Логика перенесена сюда БЕЗ изменений (тот же порядок проверок, отпечаток бит в бит) — но теперь у решения есть причина:
//   bot._walkWhy — почему идёт шагом (null — не шагом), bot._runWhy — какая отмена сняла шаг (null — не снимала),
//   bot._stopWhy — почему целевая скорость 0 или урезана (null — обычный ход).
// ПРАВИЛО: новая причина идти шагом / бежать / стоять добавляется строкой СЮДА (moveWalkWhy / moveRunWhy / moveSpeedTick),
// на своё место по порядку, а не отдельной проверкой в другом файле. Порядок причин — пока как сложился исторически
// (первая подходящая); замена на таблицу важности — следующий шаг (00_PLAN.md), он уже меняет игру.
// Вне этого файла скорость ещё задают: перестрелка (fightCycleTick / fightStrafe, 470 — после неё stepTick ставит скорость
// фазы _fc), лестница (ladderTick, levels), стрейф на посту, торможение в повороте (cornerSlow) и «жду у огня» (fireWait) — в
// ветке движения stepTick. Они — физика шага, а не решение «как идти»; сюда переносить вместе с таблицей важности.
var MOVE = {run: 0, burn: null};   // выход moveSpeedTick: скорость бега после поправок и огонь под ботом (нужны stepTick дальше)

// почему бот идёт шагом (первая подходящая причина; null — не шагом)
// (15.11, перестройка, фаза 3 — канал хода, шаг 1) ход бота — шагом / бегом walking, скорость curSpeed, путь path — пишут только файлы
// хода 535, 540, 370 (уровни, лестницы, огонь); остальные — через интерфейс: movePath(b, путь, причина), moveSpeed(b, скорость, причина),
// moveWalk(b, шагом?, причина) — место (task), бомба (bomb), роумер (fov, weapons-bots), ослеплён (sound), бой (470 стрейф, 510), сброс (round, paths),
// разминка (warmup), повтор (replay), песочница (sandbox), демо (demo). Причина — b._moveWhy.
// (17.11, перестройка, фаза 3 шаг 3) «подождать флешку перед выходом» — причина стоять у хода; механики (размен 190, ранний выход CT 320,
// просьба о флешке 365, флешка под пик 380, своя флешка 410, сейв 180) не пишут _waitPopUntil / _waitPopKey, а просят moveWaitPop
// (Р3.2 ход ш.2, 26.11) сдвинуть бота на точку (бой: шаг стрейфа, отход за укрытие) — позицию пишет ход, не бой. vis — и видимую (x, y)
// сразу. Порядок записей — прежний (baseX, baseY, затем x, y)
function movePlace(b, x, y, vis){ b.baseX = x; b.baseY = y; if(vis){ moveSetX(b, x); moveSetY(b, y); } }
function moveWaitPop(b, until, key, why){ b._waitPopUntil = until; if(key !== undefined) b._waitPopKey = key; b._moveWhy = why; }
// (Р3.2 ход ш.2) idx — и номер точки пути (было: movePath(…); b.pathIdx = 0 у вызывающих). Порядок записей прежний: путь, причина, номер
function movePath(b, p, why, idx){ b.path = p; b._moveWhy = why; if(idx !== undefined) b.pathIdx = idx; }
function movePathIdx(b, i){ b.pathIdx = i; }   // номер точки прежнего пути (путь не меняется)
function moveSpeed(b, v, why){ b.curSpeed = v; b._moveWhy = why; }
function moveWalk(b, w, why){ b.walking = w; b._moveWhy = why; }
function moveWalkWhy(bot){
  if(bot._pie && bot._pie.slice && tick - bot._pie.t < 16 && !bot.holding && !bot._sawEnemy && !(bot.post && taskProp(bot.post.tag, "reposMove"))) return "режет угол";
  // "тихий шаг" (план §3): осторожен, если подозревает, что враг рядом —
  // либо только что видел (lastIntel), либо услышал шаги (heardSound) —
  // но сам сейчас его не видит и не держит угол в открытую (holding
  // уже означает "готов стрелять", там скорость и так 0). bot._sawEnemy
  // тут — с прошлого тика (resolveEngagements считается в конце stepTick),
  // отставание на один тик не критично для решения "идти тише".
  if(bot.holding || bot._sawEnemy || bot._stopPlantUntil > tick || tradeGoing(bot)) return null;
  // уход с засвеченного угла после фрага — бегом, а не шифтом (позиция и так известна)
  if(bot.post && taskProp(bot.post.tag, "reposMove") && taskKeepUntil(bot, "repos") > tick) return null;
  // (v438, док 27.10) свежая инфа / звук — шагом, только если этот враг сам может услышать мой бег (≤ 1,5 слышимости бега — проектное
  // число: враг мог подойти). Было — любой звук: выстрелы за 2000 px давали 6 с шифта по всей карте
  // (22.11, Ж17, владелец: «после убийства игроки шифтят, смысла нет»; прогон v583n Mirage: после убийства шагом 24 % времени, главные
  // причины — «видел / слышал врага рядом» про того, кого только что убил) враг из инфы / звука убит (киллфид знают все) или в том месте
  // только труп (220 knowCorpseOnly: убили, после — тихо, живых по знанию нет) — не повод идти тихо. Другие враги рядом — свои причины ниже
  var deadSrc = function(id, p){ if(id){ var o = teamBot(id); if(o && !o.alive) return true; } return !!(p && knowCorpseOnly(bot.team, p)); };
  if(bot.lastIntel && tick - bot.lastIntel.tick < CAUTION_TICKS && DM.hypot(bot.lastIntel.x-bot.baseX, bot.lastIntel.y-bot.baseY) <= 1.5*STEP_HEAR_R() && !deadSrc(bot.lastIntel.id, bot.lastIntel)) return "видел врага рядом";
  if(bot.heardSound && tick - bot.heardSound.tick < SOUND_CAUTION_TICKS && DM.hypot(bot.heardSound.x-bot.baseX, bot.heardSound.y-bot.baseY) <= 1.5*STEP_HEAR_R() && !deadSrc(bot.heardSound.src, bot.heardSound)) return "слышал врага рядом";
  // роумер подходит к точке чека тихо (v560, В104: только пока он роумит — без задачи, как в stepTick → updateRoamer; было — и на чужой
  // задаче по старой точке чека: ротирующий шёл шагом «роумер у точки чека»)
  if(bot.role === "roamer" && !bot.post && !bot.roamChecking && bot.roamTarget && bot.state === "patrol" &&
     DM.hypot(bot.roamTarget.x-bot.baseX, bot.roamTarget.y-bot.baseY) < ROAM_QUIET_RADIUS) return "роумер у точки чека";
  // заход на занятый врагом сайт (ретейк/ротация) — последние метры шагом
  // (22.11, Ж23, разбор м271222 р6: karrigan шёл в спину шагом 9 с и не успел к планту) фланг / засада / в спину — шагом, только если по моему
  // знанию враг может услышать мой бег: место, куда иду (где их слышал), или куда смотрю — ближе 1,5 слышимости бега (то же правило, что
  // у звука и инфы выше). Было — шагом всегда, сколько бы до них ни было
  if(bot.post && bot.state === "patrol" && taskProp(bot.post.tag, "flankTask")){ var fp = bot.post, fl = fp.look, hr = 1.5*STEP_HEAR_R();
    if(DM.hypot(fp.x-bot.baseX, fp.y-bot.baseY) <= hr || (fl && DM.hypot(fl.x-bot.baseX, fl.y-bot.baseY) <= hr)) return "фланг"; }
  // (v583a, ретейк как у про: сходятся на ходу, не стоят на точке) CT на сборе ушёл вперёд своего больше чем на RT_GAP по пути — идёт шагом,
  // пока тот не подтянется (расстояния — хозяин ретейка, 180: bomb.retake.apDist)
  if(bot.post && bot.state === "patrol" && taskProp(bot.post.tag, "gatherTask") && bomb && bomb.retake && bomb.retake.apDist){ var AD = bomb.retake.apDist, me = AD[bot.id];
    if(me != null && Object.keys(AD).some(function(id){ return id !== bot.id && AD[id] - me > RT_GAP/PX_UNITS; })) return "ретейк — свой отстаёт, иду шагом"; }
  if(bot.post && bot.state === "patrol" && taskProp(bot.post.tag, "gatherTask") && DM.hypot(bot.post.x-bot.baseX, bot.post.y-bot.baseY) < 500) return "сбор на ретейк — последние метры";
  if(bot.post && bot.state === "patrol" && taskProp(bot.post.tag, "probeTask") && DM.hypot(bot.post.x-bot.baseX, bot.post.y-bot.baseY) < 420) return "проба — последние метры";
  if(bot.post && bot.state === "patrol" && taskProp(bot.post.tag, "shiftTask") && DM.hypot(bot.post.x-bot.baseX, bot.post.y-bot.baseY) < 450) return "перестановка — последние метры";
  // клатч T с бомбой: без инфы — на шифте (не палится бегом); бежит,
  // только если время поджимает или все CT известны и далеко
  if(bot.team === "T" && bomb && bomb.state === "carried" && bomb.carrier === bot && aliveCount("T") === 1 && soloMayWalk(bot)) return "клатч с бомбой";
  if(bot.post && bot.state === "patrol" && taskProp(bot.post.tag, "cautiousEnd") &&
     DM.hypot(bot.post.x-bot.baseX, bot.post.y-bot.baseY) < 350) return "ретейк / ротация / дефуз — последние метры";
  // лёркер ходит тихо всегда, кроме самого начала (до своей точки на сетапе)
  // (v530, отметка владельца 10.11 «раш, а лёрк ходит на шифте») тишина лёркера — чтобы его не услышали, пока команда играет медленно; на раше
  // команда сама шумит и выходит сразу — шаг ничего не скрывает, он отстаёт
  if(bot.tRole === "lurker" && !(teamTac.T && teamTac.T.tac && teamTac.T.tac.style === "rush") && bot.post && bot.state === "patrol" && taskProp(bot.post.tag, "lurkTask") && bot.post.tag !== "lurkStage"+(teamTac.T && teamTac.T.site==="A"?"B":"A")) return "лёркер";
  if(dangerWalk(bot)) return "опасное место";
  // (v323, М39) к дефузу близко — подходит шифтом, чтобы не выдать себя, если время есть (defuseWalk)
  if(defuseWalk(bot)) return "подход к дефузу";
  // добивание последнего — не бегом в открытую: последние метры тихим шагом
  if(bot.post && bot.state === "patrol" && taskProp(bot.post.tag, "endhuntTask") && DM.hypot(bot.post.x-bot.baseX, bot.post.y-bot.baseY) < 350) return "охота на последнего — последние метры";
  return null;
}
// почему шаг отменён — бегом (первая подходящая причина; зовётся, только когда moveWalkWhy сказал «шагом»)
function moveRunWhy(bot){
  // (v257, К3) врагов живых нет (видно по табло) — шагом идти не от кого
  if(aliveCount(bot.team === "CT" ? "T" : "CT") === 0) return "врагов не осталось";
  // (v583a, Д26) уходит из-под линии раненым — бегом: шаг «видел / слышал врага рядом» держал его на линии (прогон 274: 30 из 149 погибших так)
  if(bot.post && !bot.atPost && taskProp(bot.post.tag, "escape")) return "ухожу из-под линии — бегом";
  // (v299, И43, владелец 14.10: T0 стрелялся на A, лёркер T4 шёл к бою на шифте) тиммейт рядом уже в перестрелке (видит врага ≥ 0,3 с,
  // как у дабл-пика, или стрелял / по нему стреляли за 2 с) в 900 px от меня, а моя точка — не дальше 600 px от него: иду к бою — бегом, тишина уже ничего не даёт
  if(bot.post && !taskProp(bot.post.tag, "bombSpot") && bots.some(function(m){ return m !== bot && m.alive && m.team === bot.team &&
       ((m._sawEnemy && (m.contactStreak||0) >= 20) || tick - (m.lastShotTick||-1e9) < 2*TICK_HZ || tick - (m._shotAtT||-1e9) < 2*TICK_HZ) && DM.hypot(m.x-bot.baseX, m.y-bot.baseY) < 900 && DM.hypot(m.x-bot.post.x, m.y-bot.post.y) < 600; })) return "свой рядом уже в бою";
  // (v257, К3) ретейк: шагом — только если шагом успевает дойти до бомбы и дефузнуть (та же мерка, что у ниндзя-дефуза)
  if(bot.team === "CT" && bomb && bomb.state === "planted" && bot.post && taskProp(bot.post.tag, "retakeMove")){
    var dB = DM.hypot(bomb.x-bot.baseX, bomb.y-bot.baseY);
    if(bombTimeLeftTicks()/TICK_HZ <= dB/(SPEED*WALK_SPEED_FRAC) + (bot.kit ? 5 : 10) + 1.5) return "на шифте не успеть к дефузу";
  }
  // (v438, док владельца 27.10: NiKo за 3,5 с до взрыва шёл шифтом и погиб от бомбы) в зоне смертельного взрыва (урон ≥ HP, BOMB_DMG) —
  // шагом, только если шагом успевает выйти из неё до взрыва (+1 с — проектное число); иначе бегом. Любая сторона, любая задача
  if(bomb && bomb.state === "planted" && bombDamageAt(bot.baseX, bot.baseY) >= bot.hp){
    var rKill = BOMB_DMG.sigma*Math.sqrt(2*DM.log(BOMB_DMG.max/Math.max(1, bot.hp))), dOut = Math.max(0, rKill - bombPathLen(bot.baseX, bot.baseY));
    if(bombTimeLeftTicks()/TICK_HZ <= dOut/(SPEED*WALK_SPEED_FRAC) + 1) return "на шифте не выйти из взрыва";
  }
  return null;
}
// шагом или бегом — одно место записи bot.walking
function moveWalkTick(bot){
  var w = moveWalkWhy(bot), r = null;
  if(bot.nadeTask && bot.nadeTask.runPh === "go"){   // (разбег гранаты) шаг или бег — как у эталона про (throw)
    if(bot.nadeTask.runWalk) w = "разбег гранаты на шифте"; else { w = null; r = "разбег гранаты бегом"; } }
  if(w){ var rr = moveRunWhy(bot); if(rr){ r = rr; w = null; } }
  // (v544, владелец 10.11: «в песочнице указывать, как идти — на шифте или нет») ход, заданный владельцем в песочнице, — главнее всех причин
  if(SANDBOX.on && bot._sbWalk === "walk"){ w = "песочница: на шифте (задал владелец)"; r = null; }
  else if(SANDBOX.on && bot._sbWalk === "run"){ w = null; r = "песочница: бегом (задал владелец)"; }
  bot.walking = !!w; bot._walkWhy = w; bot._runWhy = r;
}
// целевая скорость этого тика: стоять / идти / выбегать из огня / тормозить; заодно разгон к ней. Возвращает ничего;
// MOVE.run — скорость хода после поправок, MOVE.burn — огонь под ботом
// (Р3.2 ход ш.2, 26.11) таблица писателей скорости «стоп»: кто останавливает ноги и почему — в прежнем порядке (первая подошедшая строка;
// была цепочка if / else в moveSpeedTick). Условия — без побочных эффектов; waitPop считает moveSpeedTick
var MOVE_STOP = [
  {why: "ждёт флешку своего",     when: function(bot, waitPop){ return waitPop; }},
  {why: "держит угол",            when: function(bot){ return bot.holding && !(bot.post && !bot.atPost && taskProp(bot.post.tag, "escape")); }},
  {why: "роумер проверяет точку", when: function(bot){ return bot.roamChecking; }},
  {why: "на посту",               when: function(bot){ return bot.atPost; }},
  {why: "ставит бомбу",           when: function(bot){ return bot.planting; }},
  {why: "дефузит",                when: function(bot){ return bot.defusing; }},
  {why: "бросает гранату",        when: function(bot){ return tick < (bot.throwUntil||0); }},
  {why: "стреляет по врагу",      when: function(bot){ return bot.state === "engage" && bot._sawEnemy; }}
];
function moveSpeedTick(bot, runSpeed, BRAKE_RADIUS, maxDelta){
  var why = null;
  // ждёт хлопка флешки тиммейта (поп на убийцу / ретейк) — не выбегает раньше неё
  var waitPop = (bot._waitPopUntil > tick && nadeFlags[bot._waitPopKey] === undefined && !bot._sawEnemy) || (bot._ppWaitUntil > tick && !bot._sawEnemy);
  if(bot._pie && bot._pie.slice && tick - bot._pie.t < 16 && !bot._sawEnemy) runSpeed *= 0.75; // режет угол
  var targetSpeed = runSpeed;
  // (v583a, Д26, прогон 274: раненый CT с задачей «уйти из-под линии» погиб, стоя «держу угол», в 68 из 149 случаев — снова увидел врага, режим
  // боя «держать» останавливал ноги на линии) уходит из-под линии — «держит угол» не останавливает, пока не дошёл до укрытия
  for(var si = 0; si < MOVE_STOP.length; si++) if(MOVE_STOP[si].when(bot, waitPop)){ targetSpeed = 0; why = MOVE_STOP[si].why; break; }
  // (v375, владелец: «в 4 раунде все по одному выходили из T Ramp и умирали») демки Mirage: первый T, входящий на сайт (≤ 250
  // от него), один (своих ближе 500 нет) в 13 % раундов у про и в 29 % у ботов; второй входит через 2,0 с у про и 3,0 с у ботов.
  // Перед входом на сайт один — ждёт напарника на размен до ENTRY_WAIT (2 с — медиана про), потом идёт; лёркер и бой — без ожидания
  var stS = bot.team === "T" && bomb.state !== "planted" && teamTac.T && SITES[teamTac.T.site];
  if(stS && targetSpeed > 0 && bot.tRole !== "lurker" && !bot._sawEnemy && bot.post && DM.hypot(bot.post.x-stS.x, bot.post.y-stS.y) < 250){
    var dS0 = DM.hypot(bot.baseX-stS.x, bot.baseY-stS.y), alone = !bots.some(function(o){ return o !== bot && o.alive && o.team === "T" && DM.hypot(o.x-bot.x, o.y-bot.y) < 500; });
    var anyMate = bots.some(function(o){ return o !== bot && o.alive && o.team === "T" && o.tRole !== "lurker"; });
    if(dS0 > 250 && dS0 < 340 && alone && anyMate){ if(!bot._entryWait || bot._entryWait.round !== roundNum) bot._entryWait = {t:tick, round:roundNum};
      if(tick - bot._entryWait.t < ENTRY_WAIT){ targetSpeed = 0; why = "ждёт напарника перед входом на сайт"; if(!bot._entryWait.log){ bot._entryWait.log = true; logEvent(bot.id+": перед входом на сайт — жду напарника на размен"); } } }
    else if(!alone) bot._entryWait = null;
  }
  // стоит в огне — выбегает из него прямо сейчас, что бы ни делал
  var burn = inFire(bot.baseX, bot.baseY, bot.z);
  if(burn && !fireCommit(bot)){
    // Из огня бот ВЫХОДИТ обычным бегом по пути к ближайшему краю (раньше его
    // каждый тик сдвигало наружу напрямую — выглядело как отбрасывание).
    bombActAbort(bot, "огонь", "молотов, не доживёт");   // (Р3.2 ход ш.2) плант / дефуз прерывает хозяин бомбы, не ход
    taskSetAtPost(bot, false);
    bot._burning = true;
    if(!bot._fireExit || inFire(bot._fireExit.x, bot._fireExit.y, bot.z) || bot._fireExitFire !== burn){
      var best = null, bd = Infinity;
      for(var ai=0; ai<12; ai++){
        var aa = ai*Math.PI/6, rr = NADE.molly.radius + 28;
        var qx = burn.x + DM.cos(aa)*rr, qy = burn.y + DM.sin(aa)*rr;
        if(insideSolidWall(qx, qy) || crossesWall(bot.baseX, bot.baseY, qx, qy)) continue;
        var dq = DM.hypot(qx-bot.baseX, qy-bot.baseY);
        // ближе всего — и лучше в сторону, куда бот и так шёл
        if(bot.post) dq += DM.hypot(qx-bot.post.x, qy-bot.post.y)*(0.08);   // (v151) ближний край важнее, не через весь огонь
        if(dq < bd){ bd = dq; best = {x:qx, y:qy}; }
      }
      moveSetFireExit(bot, best); moveSetFireExitFire(bot, burn);
      if(best){ bot.path = [[best.x, best.y, bot.z]]; bot.pathIdx = 0; }
    }
    // (v151) раньше путь наружу перебивали пост/бой каждый тик, а держащий угол
    // вообще не двигался — стоял в огне. Теперь, пока горит, путь только наружу
    if(bot._fireExit){
      fightHoldOff(bot, "fire");
      var fw = bot.path && bot.path[bot.path.length-1];
      if(!fw || DM.hypot(fw[0]-bot._fireExit.x, fw[1]-bot._fireExit.y) > 4){ bot.path = [[bot._fireExit.x, bot._fireExit.y, bot.z]]; bot.pathIdx = 0; }
      bot.walking = false; placeStance(bot, false, "fire-run");   // из огня — бегом, не шифтом
    }
    targetSpeed = SPEED * weaponSpeedMul(bot); why = "выбегает из огня";
  } else {
    bot._burning = false; if(bot._fireExit){ moveSetFireExit(bot, null); moveSetFireExitFire(bot, null); }
    if(burn && targetSpeed > 0) targetSpeed = SPEED * weaponSpeedMul(bot);   // (v263, Б2) идёт по делу через огонь — бегом, не шифтом
  }
  // (v263, Б2) в огне — без торможения у конца пути: точка выхода всего в 28 px за краем, и бот, тормозя к ней, полз по
  // огню в 3–5 раз медленнее бега (на 3 матчах v262 почти все случаи «в огне > 1 с» — это он)
  // (физика гранат: разбег) бросок с разбега — без торможения: в точке броска скорость полная, как у про (throw: runupTick)
  if(!bot.holding && bot.path.length && !burn && !(bot.nadeTask && bot.nadeTask.runPh === "go")){
    var finalWp = bot.path[bot.path.length-1];
    var dFinal = DM.hypot(finalWp[0]-bot.baseX, finalWp[1]-bot.baseY);
    if(dFinal < BRAKE_RADIUS){ targetSpeed = runSpeed * Math.max(0.35, dFinal/BRAKE_RADIUS); why = "тормозит у конца пути"; }
  }
  // ослеплён: либо шаг назад за угол (путь уже задан в onBlind), либо стоп
  if(bot._blind && tick < bot._blind.until && !burn){
    targetSpeed = bot._blind.back ? runSpeed*0.55 : 0; why = bot._blind.back ? "ослеплён — шаг назад" : "ослеплён — стоит";
    if(!bot._blind.back) placeStance(bot, true, "blind");
  } else if(bot._blind && tick >= bot._blind.until){ soundSetBlind(bot, null); }
  if(bot._boost){ targetSpeed = 0; bot.curSpeed = 0; why = "подсадка"; }   // (v575, В144) подсадка — оба стоят (tick, jumpCheckTick)
  // (v575, В144) в воздухе — не разгоняется; ход гаснет к доле про к приземлению (поворот A / D в воздухе у про стоит скорости, RUN_JUMP.keep, 540)
  if(bot._jc && bot._jc.run){ var jq = Math.min(1, (tick - bot._jc.t)/(RUN_JUMP.air*TICK_HZ)); bot.curSpeed = bot._jc.v0*(1 - (1 - bot._jc.kt)*jq); targetSpeed = bot.curSpeed; why = "в прыжке"; }
  if(bot.curSpeed < targetSpeed) bot.curSpeed = Math.min(targetSpeed, bot.curSpeed+maxDelta);
  else if(bot.curSpeed > targetSpeed) bot.curSpeed = Math.max(targetSpeed, bot.curSpeed-maxDelta);
  if(tick < (bot._tagUntil||0)){ bot.curSpeed = Math.min(bot.curSpeed, SPEED*0.4); why = (why ? why + " + " : "") + "попали — замедлен"; }
  moveSetStopWhy(bot, why); MOVE.run = runSpeed; MOVE.burn = burn;
}

// Запись состояния канала. Вызовы выполняются в исходной точке тика.
function moveSetFireExit(bot, value){ return bot._fireExit = value; }
function moveSetFireExitFire(bot, value){ return bot._fireExitFire = value; }
function moveSetStopWhy(bot, value){ return bot._stopWhy = value; }
function moveSetX(bot, value){ return bot.x = value; }
function moveSetY(bot, value){ return bot.y = value; }
