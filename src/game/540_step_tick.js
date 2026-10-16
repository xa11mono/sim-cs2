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

// (v322, М14) свободный обзор в закупку: каждый смотрит сам по себе — держит взгляд, потом поворачивает мышь.
// Сколько держат и на сколько поворачивают — из демок про Mirage (25 матчей, фризтайм, взгляд раз в 0,25 с; поворот —
// больше 8° за 0,25 с): держат 0,25 / 0,25 / 1 / 2,5 / 5,75 с, поворот 11 / 21 / 50 / 98 / 145° (10/25/50/75/90 %).
var FREEZE_HOLD = [0.25, 0.25, 1, 2.5, 5.75], FREEZE_TURN = [11, 21, 50, 98, 145], FREEZE_TURN_SPEED = 0.25*Math.PI/16;  // скорость — поворот за ~0,25 с (шаг демок)
function freezePick(q, u){ var k = Math.min(3, Math.floor(u*4)), f = u*4 - k; return q[k] + (q[k+1]-q[k])*f; }   // доля u → число по процентилям (упрощение)
function freezeLookTick(){
  bots.forEach(function(b, i){
    if(!b.alive) return;
    if(!isFinite(b.facing)) b.facing = Math.atan2(1024-b.y, 1024-b.x);   // ещё не смотрел никуда — к середине карты
    var F = b._fz;
    if(!F || F.round !== roundNum){ F = b._fz = {round: roundNum, until: tick, target: b.facing}; }
    if(tick >= F.until){
      var seed = roundNum*7919 + i*104729 + tick;
      var turn = freezePick(FREEZE_TURN, hashRand(seed)) * Math.PI/180 * (hashRand(seed+1) < 0.5 ? -1 : 1);
      F.target = b.facing + turn;
      F.until = tick + Math.round(freezePick(FREEZE_HOLD, hashRand(seed+2)) * TICK_HZ) + Math.ceil(Math.abs(turn)/FREEZE_TURN_SPEED);
    }
    var d = F.target - b.facing;
    b.facing += Math.max(-FREEZE_TURN_SPEED, Math.min(FREEZE_TURN_SPEED, d));
  });
}

// (v322) звук движения — шаги, вода, прыжок (одно место «кто из врагов услышал»): через стену слышно ближе (~75 % радиуса),
// место — пятно, а не точка (hearPos), в уши — hearReal
function moveSoundEmit(bot, soundRadius, kind, label){
  bots.forEach(function(listener){
    if(listener===bot || !listener.alive || listener.team===bot.team) return;
    var dHear = Math.hypot(listener.x-bot.x, listener.y-bot.y);
    if(dHear > soundRadius) return;
    var occS = BAL.soundDir && !hasLOS(listener.x, listener.y, bot.x, bot.y);
    if(occS && dHear > soundRadius*0.75) return;
    var wasStale = !listener.heardSound || (tick - listener.heardSound.tick) > 90;
    var seed = tick*331 + bot.id.charCodeAt(0)*17 + listener.id.charCodeAt(0)*11 + bot.lastStepTick;
    var jitterMag = 20 + dHear*0.12, jang = hashRand(seed) * Math.PI*2;
    var hpF = hearPos(listener, bot.x, bot.y, seed, occS);
    listener.heardSound = hearReal(listener, hpF ? {x:hpF.x, y:hpF.y, tick:tick, team:bot.team, src:bot.id, kind:kind, occl:occS}
                              : {x:bot.x+Math.cos(jang)*jitterMag, y:bot.y+Math.sin(jang)*jitterMag, tick:tick, team:bot.team, src:bot.id, kind:"steps", occl:occS});
    if(listener.heardSound && /^приземление/.test(label || "")) listener.heardSound.land = true;   // (v343) звук приземления — для ctLandPunish
    if(wasStale) logEvent(listener.id+" услышал "+label+" ("+bot.team+")"+(occS ? " за стеной" : ""));
  });
}
// (v323, М39, владелец) подход к дефузу шифтом. Демки Mirage (196 дефузов, скорость за 1,5 с до начала дефуза): был ближе
// 150 ед. игры (60 ед. карты) — шагом 77 %, 150–300 (60–120) — 34 %, дальше — всегда бегом. Шагом — только если успевает дойти
// и дефузнуть (запас 1,5 с). Кто идёт шагом в этом раунде — жребий на раунд и бота (решение не дёргается каждый тик)
function defuseWalk(bot){
  if(!(bomb && bomb.state === "planted" && bot.team === "CT" && bot.post && bot.post.tag === "defuse")) return false;
  var d = Math.hypot(bomb.x-bot.baseX, bomb.y-bot.baseY); if(d >= 120) return false;
  if(bombTimeLeftTicks()/TICK_HZ <= d/(SPEED*WALK_SPEED_FRAC) + (bot.kit ? 5 : 10) + 1.5) return false;
  var u = hashRand(roundNum*389 + matchNum*71 + bot.id.charCodeAt(bot.id.length-1)*13);
  return u < (d < 60 ? 0.77 : 0.34);
}
// (v333, заплатка, отметка владельца: magixx «застрял и дёргается» на спавне T) бот вне навмеша в кармане за тонкой стеной
// (пол навмеша уже настоящего пола) дольше 0,5 с с путём — переносим на ближайший участок навмеша своего этажа (≤ 40 ед. карты).
// Как он туда попадает — не найдено; это заплатка, пока не найдена причина
function navSnap(bot){
  var nb = null, nbd = 40;
  // (v340, отметка владельца: NiKo «пролезает наверх, где не должен» — после двух переносов) перенос не поднимает выше ступеньки
  // (18 ед.): раньше брался пол в ±JUMP_UP, и бота закидывало на уступ, куда не залезть; вниз — как было
  // (v347, отметка владельца: magixx «с Short провалился в Underpass» — перенос с края Short опустил на 196 ед.) вниз — не больше
  // JUMP_UP (v341 разрешало любую высоту — ошибка), вверх — только ступенька (18 ед.)
  NAVAREAS.forEach(function(a){ if(NAV_BLOCKED[a.id] || (bot.z != null && (a.z - bot.z > 18 || bot.z - a.z > JUMP_UP))) return;
    a.points.forEach(function(p, k){ var q = a.points[(k+1)%a.points.length], ex = q.x-p.x, ey = q.y-p.y, L2 = ex*ex+ey*ey || 1;
      var t = Math.max(0, Math.min(1, ((bot.baseX-p.x)*ex + (bot.baseY-p.y)*ey)/L2)), px = p.x+ex*t, py = p.y+ey*t, d = Math.hypot(px-bot.baseX, py-bot.baseY);
      if(d < nbd){ var cx = 0, cy = 0; a.points.forEach(function(r){ cx += r.x; cy += r.y; }); cx /= a.points.length; cy /= a.points.length;
        nbd = d; nb = {x: px + (cx-px)*0.15, y: py + (cy-py)*0.15, a: a}; } }); });
  if(nb){ bot.baseX = bot.x = nb.x; bot.baseY = bot.y = nb.y; bot.z = nb.a.z; bot._area = nb.a.id; bot.path = []; bot.pathIdx = 0; bot._offNav = 0; logEvent(bot.id+": вне навмеша — перенесён на ближайший пол (заплатка)"); }
}
// (v335) звук приземления — одно место: слышат враги (как шаги, громко), на странице — запись приземления там, где он сейчас.
// LAND_DELAY — время полёта при запрыгивании (CS2: прыжок ~0,6 с вверх-вниз; вверх на уступ — короче) — проектное число
var LAND_DELAY = 0.35;
function landSound(bot, quiet){
  var R = SOUND_RADIUS_RUN*(quiet ? 0.5 : 1); bot._landAt = 0;
  soundPings.push({x:bot.baseX, y:bot.baseY, team:bot.team, born:nowTs, radius:R});
  moveSoundEmit(bot, R, "steps", quiet ? "приземление (чек прыжком)" : "приземление");
  if(SND && SND.on) sndBody("land", bot.baseX, bot.baseY);
}
// (v334, М58, владелец: «в CS2 есть места, где прыгают для чека, — у B Apps, где стоит karrigan») чек прыжком. Места и как часто —
// из демок (tools/jumps_bake.py → MAP.pro.jumps: прыжок на месте, rate — прыжков за раунд; Mirage у B Apps — 0,49, у Ticket —
// 0,09). Стоит у такого места своей стороны (≤ 50 ед. карты), без контакта ≥ 2 с — прыгает с вероятностью rate / JUMP_HOLD_SEC
// в секунду (JUMP_HOLD_SEC — сколько про обычно стоят у места, проектное). В прыжке видно поверх укрытий (только высокие стены
// и дым закрывают) в конусе ±60° — и его оттуда тоже. Приземление с приседом тише (csdb.gg: «присесть перед приземлением —
// тише»): радиус × 0,5 — проектное число
var JUMP_HOLD_SEC = 30;
function jumpCheckTick(b){
  if(b._landAt && tick >= b._landAt && b.alive && roundState === "live") landSound(b);   // (v335) запрыгнул — приземлился
  var JS = MAP.pro && MAP.pro.jumps; if(!JS || !JS.length || roundState !== "live" || !b.alive) return;
  var J = b._jc;
  if(J){
    var age = tick - J.t;
    if(age === 20){   // верх прыжка — видно поверх укрытий
      bots.forEach(function(o){ if(!o.alive || o.team === b.team) return; var d = Math.hypot(o.x-b.x, o.y-b.y); if(d > 1100) return;
        if(visWallHit(b.x, b.y, o.x, o.y) || smokeBlocks(b.x, b.y, o.x, o.y)) return;
        if(_angOff(Math.atan2(o.y-b.y, o.x-b.x), b.facing) < 1.05){ intelPush(b.team, {type:"spotted", x:o.x, y:o.y, id:o.id, by:b.id, conf:1});
          voiceLog(b.team, "jc"+o.id+Math.floor(tick/(4*TICK_HZ)), b.id, "чек прыжком: вижу "+nick(o.id)+" — "+calloutName(o.x, o.y)); }
        if(o.facing !== undefined && _angOff(Math.atan2(b.y-o.y, b.x-o.x), o.facing) < 1.05) intelPush(o.team, {type:"spotted", x:b.x, y:b.y, id:b.id, by:o.id, conf:1}); });
    }
    if(age === 38){   // приземление, с приседом
      landSound(b, true); b._jc = null;
    }
    return;
  }
  if(b.curSpeed > 20 || b._sawEnemy || b.planting || b.defusing || tick - (b._shotAtT||-1e9) < 2*TICK_HZ || tick - (b.lastShotTick||-1e9) < 2*TICK_HZ) return;
  var sp = null; for(var i=0;i<JS.length;i++){ var q = JS[i]; if(q.side === b.team && Math.hypot(q.x-b.x, q.y-b.y) < 50){ sp = q; break; } }
  if(!sp) return;
  if(hashRand(tick*977 + b.id.charCodeAt(b.id.length-1)*31 + roundNum*7) < sp.rate/(JUMP_HOLD_SEC*TICK_HZ)){ b._jc = {t:tick}; b._jump = {t:tick, up:true}; }
}
function stepTick(){
  tick++;
  simTime = tick * TICK_MS / 1000;
  if(roundState === "ending"){
    if(simTime - roundEndTime >= ROUND_RESTART_DELAY_SEC) resetRound();
    return;
  }
  if(roundState === "matchover"){
    if(simTime - roundEndTime >= 7) newMatch();
    return;
  }
  if(roundState === "freeze"){
    freezeLookTick();
    if(simTime >= roundStartTime){ roundState = "live"; FREEZE_FX = []; logEvent("Freeze-тайм окончен — раунд пошёл"); }
    return;
  }
  teamBrains(); // шаг 4: тактика T / расстановка и ротации CT / бомба
  if(roundState !== "live") return;
  nadeBrains(); updateNadeTasks(); nadesTick(); // шаг 5: гранаты
  if(roundState === "live" && tick % 16 === 0) tClearCalls();
  if(SND && SND.on) sndTick();   // (v323, М40) пиканье бомбы   // (v321, М24) «B чисто» — T увидел пустую зону у сайта
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
    if(tick % 16 === 0){ var za = zoneOf(bot.baseX, bot.baseY, bot.z); bot._zArea = za ? za.z : 0; bot._lvl = za ? hgtLevelOf(za.id) : 0; }
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
    bot.walking = (BAL.pieSlice && bot._pie && bot._pie.slice && tick - bot._pie.t < 16 && !bot.holding && !bot._sawEnemy && !(bot.post && /^repos/.test(bot.post.tag))) || !bot.holding && !bot._sawEnemy && !(bot._stopPlantUntil > tick) && !(bot._tradeLock && bot._tradeLock.until > tick) &&
      // уход с засвеченного угла после фрага — бегом, а не шифтом (позиция и так известна)
      !(bot.post && /^repos/.test(bot.post.tag) && bot._reposUntil > tick) &&
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
       // (v323, М39) к дефузу близко — подходит шифтом, чтобы не выдать себя, если время есть (defuseWalk)
       defuseWalk(bot) ||
       // добивание последнего — не бегом в открытую: последние метры тихим шагом
       (bot.post && bot.state === "patrol" && bot.post.tag === "endhunt" && Math.hypot(bot.post.x-bot.baseX, bot.post.y-bot.baseY) < 350));
    // (v257, К3) врагов живых нет (видно по табло) — шагом идти не от кого
    if(bot.walking && aliveCount(bot.team === "CT" ? "T" : "CT") === 0) bot.walking = false;
    // (v299, И43, владелец 14.10: T0 стрелялся на A, лёркер T4 шёл к бою на шифте) тиммейт рядом уже в перестрелке (видит врага ≥ 0,3 с,
    // как у дабл-пика, или стрелял / по нему стреляли за 2 с) в 900 px от меня, а моя точка — не дальше 600 px от него: иду к бою — бегом, тишина уже ничего не даёт
    if(bot.walking && bot.post && !/^(defuse|plantspot)/.test(bot.post.tag) && bots.some(function(m){ return m !== bot && m.alive && m.team === bot.team &&
         ((m._sawEnemy && (m.contactStreak||0) >= 20) || tick - (m.lastShotTick||-1e9) < 2*TICK_HZ || tick - (m._shotAtT||-1e9) < 2*TICK_HZ) && Math.hypot(m.x-bot.baseX, m.y-bot.baseY) < 900 && Math.hypot(m.x-bot.post.x, m.y-bot.post.y) < 600; })) bot.walking = false;
    // (v257, К3) ретейк: шагом — только если шагом успевает дойти до бомбы и дефузнуть (та же мерка, что у ниндзя-дефуза)
    if(bot.walking && bot.team === "CT" && bomb && bomb.state === "planted" && bot.post && /^(gather|retake|defuse|rotate)/.test(bot.post.tag)){
      var dB = Math.hypot(bomb.x-bot.baseX, bomb.y-bot.baseY);
      if(bombTimeLeftTicks()/TICK_HZ <= dB/(SPEED*WALK_SPEED_FRAC) + (bot.kit ? 5 : 10) + 1.5) bot.walking = false;
    }
    knifeTick(bot); prePeekTick(bot); exposedShiftTick(bot); jumpCheckTick(bot);
    var runSpeed = (bot.walking ? SPEED*WALK_SPEED_FRAC : SPEED) * weaponSpeedMul(bot);
    // атакующий, который прямо сейчас видит врага, останавливается и
    // стреляет (контр-страф), а не продолжает бежать по патрульному пути —
    // иначе он сам уходил из линии огня посреди перестрелки. Уйти с линии
    // за укрытие и выглянуть снова — fightCycleTick (по данным про).
    // ждёт хлопка флешки тиммейта (поп на убийцу / ретейк) — не выбегает раньше неё
    var waitPop = (bot._waitPopUntil > tick && nadeFlags[bot._waitPopKey] === undefined && !bot._sawEnemy) || (BAL.pieSlice && bot._ppWaitUntil > tick && !bot._sawEnemy);
    if(BAL.pieSlice && bot._pie && bot._pie.slice && tick - bot._pie.t < 16 && !bot._sawEnemy) runSpeed *= 0.75; // режет угол
    var targetSpeed = (waitPop || bot.holding || bot.roamChecking || bot.atPost || bot.planting || bot.defusing || tick < (bot.throwUntil||0) || (bot.state === "engage" && bot._sawEnemy)) ? 0 : runSpeed;
    // (v375, владелец: «в 4 раунде все по одному выходили из T Ramp и умирали») демки Mirage: первый T, входящий на сайт (≤ 250
    // от него), один (своих ближе 500 нет) в 13 % раундов у про и в 29 % у ботов; второй входит через 2,0 с у про и 3,0 с у ботов.
    // Перед входом на сайт один — ждёт напарника на размен до ENTRY_WAIT (2 с — медиана про), потом идёт; лёркер и бой — без ожидания
    var stS = bot.team === "T" && bomb.state !== "planted" && teamTac.T && SITES[teamTac.T.site];
    if(stS && targetSpeed > 0 && bot.tRole !== "lurker" && !bot._sawEnemy && bot.post && Math.hypot(bot.post.x-stS.x, bot.post.y-stS.y) < 250){
      var dS0 = Math.hypot(bot.baseX-stS.x, bot.baseY-stS.y), alone = !bots.some(function(o){ return o !== bot && o.alive && o.team === "T" && Math.hypot(o.x-bot.x, o.y-bot.y) < 500; });
      var anyMate = bots.some(function(o){ return o !== bot && o.alive && o.team === "T" && o.tRole !== "lurker"; });
      if(dS0 > 250 && dS0 < 340 && alone && anyMate){ if(!bot._entryWait || bot._entryWait.round !== roundNum) bot._entryWait = {t:tick, round:roundNum};
        if(tick - bot._entryWait.t < ENTRY_WAIT){ targetSpeed = 0; if(!bot._entryWait.log){ bot._entryWait.log = true; logEvent(bot.id+": перед входом на сайт — жду напарника на размен"); } } }
      else if(!alone) bot._entryWait = null;
    }
    // стоит в огне — выбегает из него прямо сейчас, что бы ни делал
    var burn = inFire(bot.baseX, bot.baseY);
    if(burn && !fireCommit(bot)){
      // Из огня бот ВЫХОДИТ обычным бегом по пути к ближайшему краю (раньше его
      // каждый тик сдвигало наружу напрямую — выглядело как отбрасывание).
      if(bot.defusing){ bot.defuseCooldownUntil = tick + 32; logEvent(bot.id+" прервал дефуз — молотов, не доживёт"); }
      if(bot.planting){ bot._noPlantUntil = tick + 32; logEvent(bot.id+" прервал плант — молотов, не доживёт"); }
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
      targetSpeed = BAL.fireExit ? SPEED * weaponSpeedMul(bot) : runSpeed;
    } else {
      bot._burning = false; if(bot._fireExit){ bot._fireExit = null; bot._fireExitFire = null; }
      if(burn && targetSpeed > 0) targetSpeed = SPEED * weaponSpeedMul(bot);   // (v263, Б2) идёт по делу через огонь — бегом, не шифтом
    }
    // (v263, Б2) в огне — без торможения у конца пути: точка выхода всего в 28 px за краем, и бот, тормозя к ней, полз по
    // огню в 3–5 раз медленнее бега (на 3 матчах v262 почти все случаи «в огне > 1 с» — это он)
    if(!bot.holding && bot.path.length && !burn){
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
    // перестрелка по данным: уйти с линии за укрытие и выглянуть снова
    fightCycleTick(bot, dtSec, bot.planting || bot.defusing || burn || tick < (bot.blindUntil||0));
    if(bot._fc && bot._fc.ph !== "line") bot.curSpeed = bot._fc.moving ? SPEED*weaponSpeedMul(bot) : 0;

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
        // (v298) шаг в стену не выбираем: сначала другая сторона, иначе стоим (раньше упирался и каждый тик выбирал заново — дёргался)
        var la0 = bot.facing !== undefined ? bot.facing : 0, pa0 = la0 + Math.PI/2;
        var tgt = function(d){ return {x: H.ax + Math.cos(pa0)*d*24 + Math.cos(la0)*H.fwd, y: H.ay + Math.sin(pa0)*d*24 + Math.sin(la0)*H.fwd}; };
        if(H.dir){ var q0 = tgt(H.dir); if(stepBlocked(H.ax, H.ay, q0.x, q0.y, bot)){ var q1 = tgt(-H.dir); H.dir = stepBlocked(H.ax, H.ay, q1.x, q1.y, bot) ? 0 : -H.dir; } }
      }
      // (v298, владелец 14.10: «переминание дёрганое») направление шага берётся один раз, когда выбран новый шаг (раньше — каждый тик от
      // взгляда: повернул голову — точка шага прыгала), и скорость не скачет: разгон и торможение к точке шага за ~0,25 с (проектное
      // число), разворот — через остановку
      var STRAFE = 38*SPD_K; // px/с — медленнее тихого шага
      if(H.pa === undefined || H.paT !== H.until){ var lookA = bot.facing !== undefined ? bot.facing : 0; H.pa = lookA + Math.PI/2; H.la = lookA; H.paT = H.until; }
      var tx = H.ax + Math.cos(H.pa)*H.dir*24 + Math.cos(H.la)*(H.fwd||0);
      var ty = H.ay + Math.sin(H.pa)*H.dir*24 + Math.sin(H.la)*(H.fwd||0);
      var sdx = tx - bot.baseX, sdy = ty - bot.baseY, sd = Math.hypot(sdx, sdy);
      var acc = STRAFE/0.25, v0 = H.v || 0;
      // текущее движение не туда (новая точка за спиной) — сначала тормозим
      var same = !H.vx || (sd > 0.01 && (H.vx*sdx + H.vy*sdy)/sd > 0);
      var vT = !same ? 0 : Math.min(STRAFE, Math.sqrt(2*acc*Math.max(0, sd - 0.5)));
      var v1 = v0 < vT ? Math.min(vT, v0 + acc*dtSec) : Math.max(vT, v0 - acc*dtSec);
      if(sd > 0.5 && (v1 > 0.5 || same)){
        var ux = same ? sdx/sd : (H.vx || 0), uy = same ? sdy/sd : (H.vy || 0);
        var st = Math.min(same ? sd : 99, v1*dtSec);
        var sx = bot.baseX + ux*st, sy = bot.baseY + uy*st;
        if(st > 0 && !stepBlocked(bot.baseX, bot.baseY, sx, sy, bot)){ bot.baseX = sx; bot.baseY = sy; bot.curSpeed = v1; bot.walking = true; H.vx = ux; H.vy = uy; H.v = v1; }
        else if(st > 0){ H.dir = 0; H.until = tick + 32; H.v = 0; H.vx = H.vy = 0; } // упёрся — постоять 0,5 с, потом новый шаг
        else { H.v = v1; if(v1 <= 0.5){ H.vx = H.vy = 0; } }
      } else { H.v = 0; H.vx = H.vy = 0; if(bot.curSpeed <= STRAFE) bot.curSpeed = 0; }
    } else if(bot._hold && !bot.atPost && !bot.holding){ bot._hold = null; }

    // ---------- эмиссия звука шагов (план §13, минимальная версия для §3) ----------
    // Дискретные "шаги" с интервалом, не сплошное поле — бег громче и чаще,
    // тихий шаг тише и реже. Без затухания через стены (упрощение v1 — если
    // понадобится точнее, тут же место, где учитывать hasLOS/дистанцию до стены).
    // вода (зоны со свойством water в наборе карты) — всплески слышно громче, и даже шифтом
    var wet = BAL.soundMore && bot.curSpeed > 5 && inWater(bot.baseX, bot.baseY);
    if(bot.curSpeed > 5 && (!(BAL.silentWalk && bot.walking) || wet)){ // шифт (тихий шаг) не слышно, как в CS
      // (v332, М50, владелец: «скорость шагов не соответствует скорости игрока») шаг — по пройденному пути, а не по времени:
      // длина шага такая, что на полной скорости (225 ед./с, винтовка) — раз в FOOTSTEP_INTERVAL_RUN тиков, как было; с AWP реже,
      // с ножом чаще, при разгоне и торможении — в такт скорости
      var stride = SPEED*(bot.walking ? WALK_SPEED_FRAC*FOOTSTEP_INTERVAL_WALK : FOOTSTEP_INTERVAL_RUN)/TICK_HZ;
      var mv = bot._stepP ? Math.min(Math.hypot(bot.baseX-bot._stepP.x, bot.baseY-bot._stepP.y), 3*SPEED/TICK_HZ) : 0;   // реально пройдено за тик (упёрся в стену — не шагает)
      bot._stepP = {x:bot.baseX, y:bot.baseY}; bot._stepDist = (bot._stepDist||0) + mv;
      if(bot._stepDist >= stride){
        bot._stepDist -= stride; if(bot._stepDist > stride) bot._stepDist = 0;
        bot.lastStepTick = tick;
        var soundRadius = (wet ? (bot.walking ? 220 : 460) : (bot.walking ? SOUND_RADIUS_WALK : SOUND_RADIUS_RUN)) * (BAL.stepHearMul || 1);
        soundPings.push({x:bot.baseX, y:bot.baseY, team:bot.team, born:nowTs, radius:soundRadius}); if(SND && SND.on) sndStep(bot.baseX, bot.baseY);
        // (4) сам знает, что шумит: бежал в пределах слышимости места, где враг вероятен
        if(BAL.heardMe && roundState === "live"){ var zN = bzOf(bot.x, bot.y); if(zN >= 0){ var nearZ = [zN].concat(BZ.nbr[zN]||[]);
          if(nearZ.some(function(j){ var cj = BZ.cent[j]; return cj && Math.hypot(cj.x-bot.x, cj.y-bot.y) < soundRadius && reachPossible(bot.team, j) && beliefZoneKnown(bot.team, j) >= 0.2; })) bot._noisyT = tick; } }
        if(soundPings.length > 40) soundPings.shift();
        moveSoundEmit(bot, soundRadius, wet ? "water" : "steps", (wet ? "всплески в воде" : "шаги")+(bot.walking ? " (тихо)" : ""));
      }
    }

    if(!ladderTick(bot) && !((bot.holding && !bot._burning) || bot.curSpeed <= 0.5 || (bot._fc && bot._fc.ph !== "line"))){
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
          // (v341, отметка владельца: karrigan по кругу у Catwalk) точку подъёма/спуска (> 40 ед. от своей высоты, проектное число) и
          // следующую за ней досрочно не пропускать: раньше подъём «срезался», и бот шёл к следующей точке понизу, под верхний этаж
          var wpA = bot.path[bot.pathIdx], wpB = bot.path[bot.pathIdx+1], lvlOk = bot.z == null || ((wpA[2] == null || Math.abs(wpA[2] - bot.z) <= 40) && (wpB[2] == null || Math.abs(wpB[2] - bot.z) <= 40));
          if(wdCur < 6 || (lvlOk && wdCur < ARRIVE_RADIUS && !crossesWall(bot.baseX, bot.baseY, wpB[0], wpB[1]) && navSegOnLevel(bot.baseX, bot.baseY, bot.z, wpB[0], wpB[1], wpB[2]))) bot.pathIdx++;
          else break;
        }
        var target = bot.path[bot.pathIdx];
        var dx = target[0]-bot.baseX, dy = target[1]-bot.baseY;
        var dist = Math.hypot(dx,dy);
        var isLastLeg = bot.pathIdx === bot.path.length-1;
        var step = bot.curSpeed * dtSec;
        // (v370, владелец: «не стоят в толпе») идём за своим, который идёт туда же, — держим дистанцию, а не наступаем ему на пятки:
        // у про на выходе ближайший свой ближе 60 ед. карты только 11–13 % времени (tools: демки Mirage / Ancient), у ботов — 25 %
        if(dist > FOLLOW_GAP){
          var fx = dx/Math.max(dist, 0.01), fy = dy/Math.max(dist, 0.01);
          for(var fi = 0; fi < bots.length; fi++){ var fo = bots[fi]; if(fo === bot || !fo.alive || fo.team !== bot.team || !(fo.curSpeed > 40) || fo.heading === undefined) continue;
            var ox = fo.x-bot.x, oy = fo.y-bot.y, fwd = ox*fx + oy*fy, lat = Math.abs(ox*fy - oy*fx);
            if(fwd > 0 && fwd < FOLLOW_GAP && lat < 40 && Math.cos(fo.heading)*fx + Math.sin(fo.heading)*fy > 0.5) step *= Math.max(0.25, (fwd - 20) / (FOLLOW_GAP - 20)); }
        }

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
          if(isLastLeg && dist <= step){ bot.baseX = target[0]; bot.baseY = target[1]; bot.pathIdx++; }   // (v323) высота — только по навмешу (ниже), не по точке пути
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
        // (v321) высота бота — по участку навмеша под ним (ближайший по высоте); прыжок / спрыгнул — для показа
        if(actuallyMoved > 0){ var naz = navAt(bot.baseX, bot.baseY, bot.z) || navNearestZ(bot.baseX, bot.baseY, NAV_STEP_TOL, bot.z);   // (v341) в щели — ближайший пол
          // (v323, М38) в щели своего этажа под точкой бывает только чужой этаж (под Palace — пол Palace): это не подъём —
          // этаж меняется только по связи навмеша (лестница, ступени, спуск), иначе бот остаётся на своём
          var a0z = navArea(bot._area);
          // (v333) пол своего этажа под ногами есть — остаётся на нём (щель в верхнем полу больше не «роняет» вниз — donk под
          // Palace); своего пола нет — падает на нижний (zont1x с B Apps — раньше «висел» на высоте Apps над сайтом, без звука)
          // (v353, отметка владельца: NiKo «застревает под Palace, выкидывает на Palace, трясётся») лестница: путь ведёт на другой конец
          // лестницы (участки связаны лестницей в .nav) — этаж меняется, даже если свой пол под ногами тоже есть (у лестницы оба)
          // (v359) этаж по лестнице меняет только подъём (ladderTick); здесь лестница — как любой пол другого этажа
          if(naz && a0z && naz !== a0z && Math.abs(naz.z - a0z.z) > JUMP_UP){
            var own = navAtLevel(bot.baseX, bot.baseY, a0z.z);
            if(own) naz = own;
            else { var wpz3 = bot.path && bot.path[bot.pathIdx] ? bot.path[bot.pathIdx][2] : null;
              if(!navLinked2(a0z, naz) && !(naz.z < a0z.z && wpz3 != null && wpz3 < a0z.z - JUMP_UP)) naz = null; }   // без связи навмеша и не по пути вниз — остаётся на своём этаже
          }
          if(naz){ var dzz = naz.z - (bot.z == null ? naz.z : bot.z);
            // (v336, владелец: «прыгают на рандом, где не нужно, и палятся») прыжок и приземление — по полу у края (navStepDz),
            // а не по центрам участков: ступени и пандусы Mirage (Stairs, Palace, рампы) больше не «прыжок» со звуком
            var djz = (a0z && naz !== a0z) ? navStepDz(a0z, naz, bot.baseX, bot.baseY) : (naz === a0z ? 0 : dzz);
            if(djz > 18) bot._jump = {t:tick, up:true}; else if(djz < -40) bot._jump = {t:tick, up:false};
            // (v322, М29) прыжок / приземление слышно и при тихом шаге, далеко (csdb.gg: «громкий звук приземления, слышно
            // издалека», без числа) — радиус как у бега: проектное число
            // (v335, владелец: «звук прыжка в одном месте, а он в другом; приземление должно его перебивать») звучит только
            // приземление — там, где игрок приземлился: спрыгнул вниз — сразу; запрыгнул вверх — через LAND_DELAY с (полёт)
            if(roundState === "live" && djz < -40) landSound(bot);
            else if(roundState === "live" && djz > 18) bot._landAt = tick + Math.round(LAND_DELAY*TICK_HZ);
            // (v333) сменил этаж (спуск, лестница) — путь, построенный с прежнего этажа, пересчитывается с нового
            if(Math.abs(dzz) > JUMP_UP && bot.path && bot.pathIdx < bot.path.length){ bot.path = []; bot.pathIdx = 0; }
            bot.z = naz.z; bot._area = naz.id; } }
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
            // (этап 3, P1-4) не через огонь: путь шёл сквозь свой/чужой молотов, обычный шаг его не пускал (stepBlocked), бот
            // 1,5 с стоял у края — и этот рывок переносил его на 30+ px прямо в огонь (матч 3, тик 23335, T1 в молотов T2).
            // Теперь у огня — ждёт у края, как при обычном шаге (зайти можно только по делу — fireCommit)
            if(toward && inFire(toward.x, toward.y) && !inFire(bot.baseX, bot.baseY) && !fireCommit(bot)) toward = null;
            if(toward && !navFloorNear(toward.x, toward.y, NAV_STEP_TOL)) toward = null;   // (v336) рывок — только на пол навмеша
            // (v341, отметка владельца: TeSeS «застрял и его тпшнуло» — на 380 ед.) snapToWalkable из стены ставит в центр ближайшего
            // участка, иногда далеко; рывок — не дальше 12 ед. (проектное число), иначе нет
            if(toward && Math.hypot(toward.x-bot.baseX, toward.y-bot.baseY) > 12) toward = null;
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
            if(bot._stuckResets >= 2) escapeWallLine(bot);
            if(bot._stuckResets >= 2 || !navNearLevel(bot.baseX, bot.baseY, NAV_STEP_TOL, bot.z)){ bot._stuckResets = 0;
              navSnap(bot);
            } // was 90 (~1.4s) — with local navmesh/wall mismatches near doorways more likely right now (calibration mid-progress), a bot pinned there should give up and re-path faster (~0.6s) instead of visibly grinding against the corner
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
        // (v373, заплатка; сторож: «застой» — бот с путём и скоростью стоит на месте: на ящике/уступе, которого нет в графе, путь
        // начинается с пола ниже рядом, а шаг туда по прямой не пускает) за 2 с сдвинулся < 4 px — спрыгивает на начало свежего
        // пути, если оно ниже и рядом (≤ 40 px, без стены); раз в 2 с
        var TRl = bot._trail || [];
        if(TRl.length >= 8 && tick - (bot._unstickT||-1e9) > 2*TICK_HZ && bot.z != null && bot.path.length && bot.pathIdx < bot.path.length &&
           TRl.every(function(q){ return Math.hypot(q.x-TRl[0].x, q.y-TRl[0].y) < 4; })){
          bot._unstickT = tick;
          var pe = bot.path[bot.path.length-1], fr = buildWaypointPath(bot.baseX, bot.baseY, bot.z, pe[0], pe[1], pe[2], bot.team), p0 = fr && fr[0];
          if(p0 && p0[2] != null && p0[2] <= bot.z + 18 && Math.hypot(p0[0]-bot.baseX, p0[1]-bot.baseY) <= 40 && Math.hypot(p0[0]-bot.baseX, p0[1]-bot.baseY) > 2 && !crossesWall(bot.baseX, bot.baseY, p0[0], p0[1])){
            bot.baseX = bot.x = p0[0]; bot.baseY = bot.y = p0[1]; bot.z = p0[2]; var a0 = navAt(p0[0], p0[1], p0[2]); if(a0) bot._area = a0.id;
            bot.path = fr; bot.pathIdx = 1; bot._trail = [];
            logEvent(bot.id+": не может сойти с уступа по пути — спрыгнул на начало пути (заплатка)"); }
        }
        // (v333) вне навмеша с путём дольше 0,5 с — на ближайший пол (заплатка, navSnap)
        // (v340) «вне пола» — тем же допуском, что и шаг (offNavStep, NAV_STEP_TOL): у края пола (1–3 ед.) бот стоит законно, а
        // перенос его выкидывал (9 раз за 7 с в отметке владельца)
        if(bot.path.length && bot.pathIdx < bot.path.length && !navNearLevel(bot.baseX, bot.baseY, NAV_STEP_TOL, bot.z)){ if(++bot._offNav > 32) navSnap(bot); } else bot._offNav = 0;
        if(bot.path.length && bot.pathIdx < bot.path.length){
          var pw = bot.path[bot.pathIdx];
          var pd = Math.hypot(pw[0]-bot.baseX, pw[1]-bot.baseY);
          if(pd < bot._progBest - 8){ bot._progBest = pd; bot._progTick = tick; }
          else if(tick - bot._progTick > 96){
            navUnlinkBlocked(bot, pw);
            bot.path = []; bot.pathIdx = 0; bot.stuckTicks = 0;
          }
        }
      }
    }

    var offX = 0, offY = 0;
    if(bot.roamChecking && bot.state === "patrol" && bot.roamLookPt){
      // на чеке роумер не стоит столбом, а джиглит угол — короткие выглядывания
      var rla = Math.atan2(bot.roamLookPt.y-bot.baseY, bot.roamLookPt.x-bot.baseX) + Math.PI/2;
      var ramp;
      if(BAL.roamSmooth){
        // цикл ~2,1с: выглянуть 0,35с → постоять 0,5с → назад 0,35с → пауза
        var cyc = (tick - bot.roamCheckStart) % 136, e3 = function(u){ u = Math.max(0, Math.min(1, u)); return u*u*(3-2*u); };
        var sgn = (Math.floor((tick - bot.roamCheckStart)/136) % 2) ? -1 : 1;
        ramp = sgn*12*(cyc < 22 ? e3(cyc/22) : cyc < 54 ? 1 : cyc < 76 ? 1-e3((cyc-54)/22) : 0);
      } else ramp = 14*Math.sin((tick - bot.roamCheckStart)*0.3);
      offX = Math.cos(rla)*ramp; offY = Math.sin(rla)*ramp;
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
  smokeSpamTick();
  infoFallbackTick();
  if(BAL.smokeReact) smokeHeTick();
  teamInfoTick(); // раздел 11: коллы из восприятия этого тика → командная память
  posTick();      // где бот стоит (память «не сработало — меняю место»)
  knowTick();     // знание каждого бота о врагах (гипотезы) — из того, что он увидел/услышал/узнал
  teamTick();     // войс: каждый говорит, что узнал; тиммейты узнают, когда фраза договорена
  beliefTick();   // раздел 13: карта вероятностей врага
  checkRoundEnd();
}

