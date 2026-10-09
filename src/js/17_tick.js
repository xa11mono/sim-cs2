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

// Тик движка (v197 — без мозга): бомба, гранаты, подбор оружия, движение по
// пути (путь задаёт мозг; сейчас его нет — боты стоят), шаги, кто кого видит и
// стрельба, стойка (присел/стоит), конец раунда.
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
  bombTick();
  if(roundState !== "live") return; // дефуз мог только что закончить раунд
  weaponPickupTick();
  nadesTick();
  if(roundState !== "live") return;
  var dtSec = TICK_MS/1000, maxDelta = ACCEL*dtSec;
  // ARRIVE_RADIUS — точка пути считается пройденной на этом расстоянии (бот
  //   срезает угол дугой, а не встаёт в вершине); BRAKE_RADIUS — с какого
  //   расстояния до конца пути тормозить; TURN_RATE — макс. поворот направления
  //   движения в секунду (плавная дуга вместо поворота на месте)
  var ARRIVE_RADIUS = 40, BRAKE_RADIUS = 90, TURN_RATE = 6.0;
  // slope = |Δz|/расстояние по отрезку пути; 0.35 отсекает обычные пологие
  // перепады этажей и ловит именно лестницы/рампы
  var STAIRS_SLOPE_THRESHOLD = 0.35;
  bots.forEach(function(bot){
    if(!bot.alive) return;
    bot.px = bot.x; bot.py = bot.y;
    updateReload(bot);
    // этаж под ботом (метка уровня на радаре) — раз в 16 тиков хватает
    if(tick % 16 === 0){ var za = zoneOf(bot.baseX, bot.baseY); bot._zArea = za ? za.z : 0; }
    bot.onStairs = false; // движение ниже выставит заново, если бот на лестнице
    // присев — 34 % скорости бега (CS2), шаг — 50 %
    var runSpeed = (bot.crouching ? SPEED*CROUCH_SPEED_FRAC : (bot.walking ? SPEED*WALK_SPEED_FRAC : SPEED)) * weaponSpeedMul(bot);
    var hasPath = bot.path.length > 0 && bot.pathIdx < bot.path.length;
    var targetSpeed = (!hasPath || bot.planting || bot.defusing || tick < (bot.throwUntil||0)) ? 0 : runSpeed;
    if(hasPath){
      var finalWp = bot.path[bot.path.length-1];
      var dFinal = Math.hypot(finalWp[0]-bot.baseX, finalWp[1]-bot.baseY);
      if(dFinal < BRAKE_RADIUS) targetSpeed = runSpeed * Math.max(0.35, dFinal/BRAKE_RADIUS);
    }
    if(bot.curSpeed < targetSpeed) bot.curSpeed = Math.min(targetSpeed, bot.curSpeed+maxDelta);
    else if(bot.curSpeed > targetSpeed) bot.curSpeed = Math.max(targetSpeed, bot.curSpeed-maxDelta);
    if(tick < (bot._tagUntil||0)) bot.curSpeed = Math.min(bot.curSpeed, SPEED*0.4); // попадание замедляет (как в CS2)

    // ---------- шаги: бег слышно, шифт — нет (вода плещет и под шифтом) ----------
    var wet = bot.curSpeed > 5 && inWater(bot.baseX, bot.baseY);
    if(bot.curSpeed > 5 && ((!bot.walking && !bot.crouching) || wet)){
      var stepInterval = (bot.walking || bot.crouching) ? FOOTSTEP_INTERVAL_WALK : FOOTSTEP_INTERVAL_RUN;
      if(tick - bot.lastStepTick >= stepInterval){
        bot.lastStepTick = tick;
        var soundRadius = wet ? (bot.walking || bot.crouching ? 220 : SOUND.water.open) : SOUND.steps.open;
        soundPings.push({x:bot.baseX, y:bot.baseY, team:bot.team, born:nowTs, radius:soundRadius});
        if(soundPings.length > 40) soundPings.shift();
        makeSound(bot, bot.x, bot.y, wet ? "water" : "steps", {mul: wet && (bot.walking || bot.crouching) ? 220/SOUND.water.open : 1, seed: bot.lastStepTick});
      }
    }

    if(bot.curSpeed > 0.5){
      if(bot.path.length === 0 || bot.pathIdx >= bot.path.length){
        bot.path = []; bot.pathIdx = 0;   // путь кончился — стоит (новый путь задаёт мозг)
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
        var maxTurn = TURN_RATE * dtSec;
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
          if(daLeft > 0.5){ var cs = Math.max(0.3, 1 - (daLeft-0.5)/1.6); step *= cs; bot.curSpeed = Math.min(bot.curSpeed, Math.max(bot.curSpeed*0.9, runSpeed*cs)); }
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

    bot.x = bot.baseX;
    bot.y = bot.baseY;
  });
  resolveEngagements();
  knowTick();   // что каждый бот теперь знает о врагах (09_knowledge.js) — пока только знание, на игру не влияет
  teamTick();   // войс: кто что сказал команде, тиммейты узнают из договорённого (12_team.js)
  bots.forEach(function(b){ if(b.alive) b.crouching = stubCrouch(b); });   // стойка — заглушка (12_stub.js)
  checkRoundEnd();
}
