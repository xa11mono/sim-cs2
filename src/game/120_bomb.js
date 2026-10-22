// ---------- бомба ----------
var PLANT_TICKS = Math.round(3.2*64), BOMB_TICKS = 40*64, DEFUSE_TICKS = 10*64, DEFUSE_KIT_TICKS = 5*64;
// (v271) Урон взрыва — как в CS2 после июля 2025: волна расходится по карте от бомбы, углы и
// стены её гасят (Valve «запекает» урон в карту, формулы не публикует). Числа — из наших демок
// (tools/bomb_dmg.py: 1727 игроков в 347 взрывах на Ancient): урон по HP хорошо ложится на длину
// пути по навмешу от бомбы, а не на прямую — 182·exp(−путь²/(2·1091²)) в юнитах; медианы у про:
// путь 1500–1750 → 60, 1750–2000 → 37, 2000–2250 → 31, 2250–2500 → 17, 2500–3000 → 5; до ~500 — гибнут.
// Броня не учитывается отдельно: в демках урон по HP у игроков почти всегда в броне.
var BOMB_DMG = {max:182, sigma:1091/2.5, reach:2900/2.5};   // px (1 px = 2.5 юнита, PX_UNITS)
function bombPathLen(x, y){
  if(!bomb) return Infinity;
  var C = bomb._pathC || (bomb._pathC = {}), k = Math.round(x/8)+","+Math.round(y/8);
  if(C[k] != null) return C[k];
  var L = Infinity;
  if(Math.hypot(x-bomb.x, y-bomb.y) < BOMB_DMG.reach){ var pts = pathPts(bomb.x, bomb.y, x, y); if(pts.length) L = polyLen(pts); }
  return (C[k] = L);
}
function bombDamageAt(x, y){
  var L = bombPathLen(x, y); if(!isFinite(L)) return 0;
  return Math.round(BOMB_DMG.max * Math.exp(-L*L/(2*BOMB_DMG.sigma*BOMB_DMG.sigma)));
}
// куда бежать от бомбы: раньше все T бежали в свою точку сбора (tStage), даже
// если стояли по другую сторону сайта — и бежали ЧЕРЕЗ бомбу. Теперь — ближайшая
// по пути зона за радиусом взрыва; путь не должен проходить через сам взрыв,
// и подальше от известного врага (карта угроз)
// (v381, М134, владелец 16.10: «игроки недостаточно далеко отходят от бомбы и умирают от взрыва») по замеру (2 матча, Mirage и
// Ancient): все 7 смертей от взрыва — T с задачей «уход» на выбранной точке (11–62 px от неё), урон там 80–89 при HP 3–67. Точка
// выбиралась раз за раунд при полном HP с запасом всего 10 HP — потом бота ранили, а до самой точки он не доходит ровно. Теперь:
// запас FLEE_HP_MARGIN, точка пересчитывается, если HP упало и она больше не спасает, дальше 900 px тоже ищем (до досягаемости
// взрыва), а если не спасает ни одна — берём ту, где урон меньше всего (раньше — точка сбора, путь через сам взрыв)
var FLEE_HP_MARGIN = 30;   // проектное число: урон в точке ухода не больше HP − 30 (бот встаёт не ровно в точку)
function bombFleePoint(b){
  if(!bomb || bomb.state !== "planted") return null;
  var F = b._flee;
  if(F && F.round === roundNum && F.m === matchNum && (!F.pt || F.hp <= b.hp || bombDamageAt(F.pt.x, F.pt.y) <= Math.max(0, b.hp - FLEE_HP_MARGIN))) return F.pt;
  var R = BOMB_DMG.sigma, best = null, bs = Infinity, low = null, ls = Infinity;   // R — «внутри волны»: путь не должен туда заходить
  if(!BZ.ids.length) beliefBuild();
  BZ.cent.forEach(function(c, i){
    if(!c) return;
    var dB = Math.hypot(c.x-bomb.x, c.y-bomb.y);
    if(dB > BOMB_DMG.reach + 100) return;
    var q = walk(c), dq = bombDamageAt(q.x, q.y);
    var ok = dq <= Math.max(0, b.hp - FLEE_HP_MARGIN);   // там взрыв не добьёт и с запасом
    var pts = pathPts(b.x, b.y, q.x, q.y);
    if(pts.length < 1) return;
    var L = polyLen(pts), minD = Infinity;
    for(var k=1;k<pts.length;k++){ var dd = distToSeg(bomb.x, bomb.y, [pts[k-1][0], pts[k-1][1], pts[k][0], pts[k][1]]); if(dd < minD) minD = dd; }
    // старт уже внутри радиуса — путь неизбежно начинается в нём; штрафуем
    // только если путь уходит к бомбе ближе, чем бот стоит сейчас
    var dNow = Math.hypot(b.x-bomb.x, b.y-bomb.y);
    var sc = L + (minD < Math.min(R*0.75, dNow - 30) ? 900 : 0) + 600*beliefZoneKnown(b.team, i);
    if(ok && sc < bs){ bs = sc; best = q; }
    if(!ok && L < 1400 && dq*20 + sc < ls){ ls = dq*20 + sc; low = q; }   // запасной: меньше урона, потом ближе
  });
  if(!best) best = low;
  b._flee = {round:roundNum, m:matchNum, pt:best, hp:b.hp};
  if(best && b._fleeLog !== roundNum){ b._fleeLog = roundNum; logEvent(b.id+": уходит от бомбы — "+calloutName(best.x, best.y)); }
  return best;
}
var bomb = null;
function resetBomb(){
  // план §8: носитель — по роли: IGL/поддержка чаще, энтри и AWP реже (им нужны свободные руки)
  var order = ["igl","support","lurker","awp","entry"];
  var carrier = null;
  order.forEach(function(r){ if(!carrier) carrier = bots.filter(function(b){ return b.team==="T" && b.tRole===r; })[0]; });
  carrier = carrier || bots.filter(function(b){ return b.team==="T"; })[0];
  bomb = {state:"carried", carrier:carrier, x:carrier.x, y:carrier.y, site:null, plantTick:-1, explodeTick:-1};
  bots.forEach(function(b){ b.planting = false; b.defusing = false; b.fakeUntil = 0; b.fakeHoldUntil = 0; b.retakeRole = null; b._defuseHeard = -9999; b._tradeLock = null; b._fillLock = null; });
}
function dropBomb(b){
  if(bomb && bomb.state === "carried" && bomb.carrier === b){
    bomb.state = "dropped"; bomb.x = b.x; bomb.y = b.y; bomb.carrier = null;
    logEvent(b.id+" погиб с бомбой — C4 на земле");
  }
}
// звук дефуза слышат T в радиусе 700px — именно звук, а не "всезнание":
// T, которые не рядом, про дефуз не знают
var DEFUSE_HEAR = 700;
var DEFUSE_R = 30;
function defuseSees(b){
  var fv = visFloorAt(b.baseX, b.baseY, b.z); if(b.z != null && Math.abs(fv - b.z) > JUMP_UP) fv = b.z;
  var fb = visFloorAt(bomb.x, bomb.y, bomb.z), az = b._area && navArea(b._area); if(bomb.z != null && Math.abs(fb - bomb.z) > JUMP_UP) fb = bomb.z;
  return !visWallHit(b.baseX, b.baseY, bomb.x, bomb.y) && visMarch(b.baseX, b.baseY, fv + VIS_EYE.crouch, bomb.x, bomb.y, fb + 8);
}
var ESC_MAX_SEC = 8, ESC_WAIT_SEC = 8;
var UTIL_WAIT = 7, UTIL_WAIT_RUSH = 2.5, UTIL_AT_ENTRY = 140, UTIL_MIN_LEFT = 25;   // (v363) 7 с — между медианой 2,7 и 75 % 6,6 с у про (последняя граната → заход первого), 25 с до конца — уже не ждут   // (v346) ждать свои гранаты на выходе — проектные числа   // (v342) сопровождение носителя — проектные числа
function defuseSound(ct){
  bots.forEach(function(o){
    if(!o.alive || o.team !== "T") return;
    if(Math.hypot(o.x-bomb.x, o.y-bomb.y) < DEFUSE_HEAR){ o._defuseHeard = tick; o.heardSound = hearReal(o, {x:bomb.x, y:bomb.y, tick:tick, team:"CT", kind:"defuse"}); }
  });
}
// (6) звук дефуза длится, пока дефузят: T рядом слышат, что он продолжается
// (фейк — короткий "тап" и тишина). По этому и отличают фейк от настоящего
function defuseContTick(){
  if(!bomb || bomb.state !== "planted") return;
  var dfz = bots.some(function(o){ return o.alive && o.defusing; });
  if(!dfz || tick % 8) return;
  bots.forEach(function(o){ if(o.alive && o.team === "T" && Math.hypot(o.x-bomb.x, o.y-bomb.y) < DEFUSE_HEAR) o._defuseCont = tick; });
}
// T решают, бежать ли на звук дефуза сейчас: если время позволяет — ~0.8с
// ждут, продолжается ли звук (настоящий дефуз) или стих (фейк — CT ждут пика).
// Не успевают — бегут сразу (тогда фейк их и ловит). Агрессивный — иногда сразу
function tDefuseGo(tt, ts){
  var heard = ts.filter(function(b){ return tick - (b._defuseHeard||-9999) < 110; });
  if(!heard.length) return false;
  if(!BAL.fakeRead) return true;
  var h0 = Math.max.apply(null, heard.map(function(b){ return b._defuseHeard; }));
  var cont = ts.some(function(b){ return (b._defuseCont||-9999) > h0 + 36; });
  if(cont){ if(tt._dfRead !== h0){ tt._dfRead = h0; voiceLog("T", "dfreal"+h0, heard[0].id, "дефуз не прекращается — настоящий, все на бомбу!"); } return true; }
  var kitGuess = teamEco.CT.roundType === "full" ? DEFUSE_KIT_TICKS : DEFUSE_TICKS;
  var near = heard.slice().sort(function(a, c){ return pathLenTo(a, bomb.x, bomb.y) - pathLenTo(c, bomb.x, bomb.y); })[0];
  var travel = pathLenTo(near, bomb.x, bomb.y)/SPEED*TICK_HZ;
  var canWait = travel + 60 < kitGuess && bombTimeLeftTicks() > kitGuess + 40;
  var aggr = near.prof ? prof(near, "aggr") : 0.5;
  var rush = hashRand(h0*7 + near.id.charCodeAt(1)) < 0.25*aggr;           // горячий — иногда без раздумий
  if(!canWait || rush) return true;
  if(tick - h0 < 52) return false;                                          // слушают ~0.8с
  if(tt._dfFake !== h0){ tt._dfFake = h0; voiceLog("T", "dffake"+h0, near.id, "тапнул и замолчал — фейк, не выходим, держим углы"); }
  return false;
}
function bombTimeLeftTicks(){ return bomb && bomb.state==="planted" ? bomb.explodeTick - tick : Infinity; }

function bombTick(){
  if(!bomb) return;
  if(bomb.state === "carried"){
    var c = bomb.carrier;
    if(!c || !c.alive){ dropBomb(c); return; }
    bomb.x = c.x; bomb.y = c.y;
    // плант: носитель на сайте цели во время execute, врага прямо сейчас не видит
    var tac = teamTac.T;
    var site = tac && SITES[tac.site];
    if(c.planting){
      // (7) по нему стреляют, а плант ещё далеко не закончен — бросает плант и
      // отвечает (раньше доставлял бомбу под огнём, не отстреливаясь). Если
      // осталось меньше ~0.8с или стрелок далеко и мажет — дожимает плант
      if(BAL.plantReact && c._shotAtT && tick - c._shotAtT < 12 && c.plantUntil - tick > 0.8*TICK_HZ){
        var sh = c._shotAtBy, dSh = sh ? Math.hypot(sh.x-c.x, sh.y-c.y) : 0;
        var hitRecent = c._hurtT && tick - c._hurtT < 20;
        if(sh && sh.alive && (hitRecent || dSh < 700)){
          c.planting = false; c._noPlantUntil = tick + 1.2*TICK_HZ; c._fakePlantAt = 0;
          if(!c._prV || tick - c._prV > 8*TICK_HZ){ c._prV = tick; logEvent(c.id+": по мне стреляют — бросил плант, отвечаю"); }
          return;
        }
      }
      // фейк-плант: начал ставить — CT слышат и выходят сбивать — прервал
      if(c._fakePlantAt && tick >= c._fakePlantAt){
        c.planting = false; c._fakePlantAt = 0; c._noPlantUntil = tick + 90;
        voiceLog("T", "fakeplant", c.id, "фейк-плант — сейчас выйдут сбивать, держите!");
        return;
      }
      if(tick >= c.plantUntil){
        c.planting = false;
        bomb.state = "planted"; bomb.site = tac.site; bomb.x = c.baseX; bomb.y = c.baseY; bomb.z = c.z;   // (v353) высота — для «видно ли бомбу» при дефузе if(SND && SND.on) sndBomb("planted", c.baseX, c.baseY);
        bomb.plantTick = tick; bomb.explodeTick = tick + BOMB_TICKS; bomb.carrier = null;
        c.money = Math.min(MAX_MONEY, c.money + 300);
        logEvent(c.id+" заложил бомбу на "+tac.site+" (+$300)", true);
        feedEvent("bomb", c.id+" заложил бомбу на "+tac.site);
      }
      return;
    }
    // Плант: на сайте, в патруле; видимый враг мешает только если он близко
    // (раньше любой видимый CT через полкарты — и носитель стоял на точке
    // планта до конца раунда: это и были почти все проигрыши T по времени)
    var nearFoe = c._sawEnemy && c._nearestEnemyDist < 500;
    if(site && tac.phase !== "setup" && c.state === "patrol" && !nearFoe && canPlantAt(tac.site, c.baseX, c.baseY) && !(c._noPlantUntil > tick) && !inFire(c.baseX, c.baseY)){   // (v263, Б2) в огне плант не начинают — не доживут
      c.planting = true; c.plantUntil = tick + PLANT_TICKS; c.path = []; c.pathIdx = 0; if(SND && SND.on) sndBomb("plant", c.baseX, c.baseY);
      // фейк-плант (раз за раунд): свои рядом держат углы, CT по инфе рядом —
      // начать и через ~1с бросить: CT на звук выйдут под прицел
      if(BAL.fakePlant && c._fakePlanted !== roundNum){
        var BLf = beliefLast.T || {}, ctNearF = false;
        for(var eF in BLf){ if(tick - BLf[eF].tick < 6*TICK_HZ && Math.hypot(BLf[eF].x-c.x, BLf[eF].y-c.y) < 700) ctNearF = true; }
        var mateF = bots.some(function(o){ return o !== c && o.alive && o.team === "T" && Math.hypot(o.x-c.x, o.y-c.y) < 350; });
        if(ctNearF && mateF && bombTimeLeftTicks() && (ROUND_TIME_SEC - (simTime - roundStartTime)) > 25 && hashRand(roundNum*433 + matchNum*19) < 0.35){
          c._fakePlanted = roundNum; c._fakePlantAt = tick + 64;
        }
      }
      logEvent(c.id+" закладывает бомбу на "+tac.site+"…");
      // звук планта (писк C4): CT рядом (≤520px, или ≤850 по прямой видимости) слышат
      // и сразу говорят в войс — это самый сильный повод для колла/ротации
      // (v242) команда узнаёт из войса услышавшего («ставят B!» — teamChannel), а не сразу
      bots.forEach(function(o){
        if(o.team !== "CT" || !o.alive) return;
        var dH = Math.hypot(o.x-c.x, o.y-c.y);
        if(dH < 520 || (dH < 850 && hasLOS(o.x, o.y, c.x, c.y, o.z)))
          o.heardSound = hearReal(o, {x:c.x, y:c.y, tick:tick, team:"T", src:c.id, kind:"plant", occl:!hasLOS(o.x, o.y, c.x, c.y, o.z)});
      });
    }
  } else if(bomb.state === "dropped"){
    // подбирает любой живой T, пробежавший рядом
    var aliveTp = aliveCount("T");
    // энтри и AWP бомбу на бегу не подбирают (им лезть первыми) — только тот, кто
    // за ней послан, или если нас осталось двое
    var pick = bots.filter(function(b){ return b.team==="T" && b.alive && Math.hypot(b.baseX-bomb.x, b.baseY-bomb.y) < 36 &&
      !(BAL.bombCarrier && (b.tRole === "entry" || b.tRole === "awp") && aliveTp > 2 && !(teamTac.T && teamTac.T.fetchId === b.id)); })[0];
    if(pick){ bomb.state = "carried"; bomb.carrier = pick; logEvent(pick.id+" подобрал бомбу"); }
  } else if(bomb.state === "planted"){
    var def = bots.filter(function(b){ return b.defusing && b.alive; })[0];
    if(def){
      // увидел врага посреди дефуза: если время терпит — бросает дефуз и дерётся,
      // если впритык — дефузит "на удачу"
      var need = def.defuseUntil - tick;
      if((def.defuseUntil - tick) % 64 === 0) defuseSound(def);
      // дефуз в огне продолжается, если HP хватает дожить до конца, — fireCommit, прерывает выход из огня (v263)
      if(def._sawEnemy && def.contactStreak > 6 && bombTimeLeftTicks() > need + 192){
        def.defusing = false; def.defuseCooldownUntil = tick + 96; logEvent(def.id+" прервал дефуз — враг рядом");
      } else if(tick >= def.defuseUntil){
        def.defusing = false; bomb.state = "defused"; if(SND && SND.on) sndBomb("defused", bomb.x, bomb.y);
        def.money = Math.min(MAX_MONEY, def.money + 300);
        logEvent(def.id+" обезвредил бомбу (+$300)", true);
        feedEvent("defuse", def.id+" обезвредил бомбу"+(bots.some(function(o){ return o.team==="T" && o.alive; }) ? " под носом у T" : ""));
        endRound("CT", "defuse");
      }
    } else {
      // (v353, отметка владельца: kyousuke дефузил через ящик в 41 ед. от бомбы — T не мог его увидеть) дефуз — ближе DEFUSE_R ед. карты
      // (~75 ед. игры: «использовать» в Source — до ~72) и только если бомбу видно из глаз присевшего (без стен и ящиков)
      var cand = bots.filter(function(b){ return b.team==="CT" && b.alive && b.state==="patrol" && Math.hypot(b.baseX-bomb.x, b.baseY-bomb.y) < DEFUSE_R && defuseSees(b); })[0];
      var dTicks = cand ? (cand.kit ? DEFUSE_KIT_TICKS : DEFUSE_TICKS) : 0;
      if(cand && cand.fakeUntil && tick < cand.fakeUntil){ /* идёт фейк — ждём */ }
      else if(cand && cand.fakeHoldUntil && tick < cand.fakeHoldUntil){ /* после фейка держит угол */ }
      else if(cand && tick >= (cand.defuseCooldownUntil||0) && (!cand._sawEnemy || bombTimeLeftTicks() < dTicks+64)){
        var tLeftAlive = bots.some(function(o){ return o.team==="T" && o.alive; });
        // фейк-дефуз (план §8): если T живы и время с запасом — сначала "тапнуть"
        // дефуз, чтобы T на звук выглянули, и встретить их, стоя с прицелом на угол
        var doFake = tLeftAlive && !bomb.fakeDone && bombTimeLeftTicks() > dTicks + 5*TICK_HZ;
        if(doFake && BAL.fakeRead){ bomb.fakeDone = true; doFake = hashRand(roundNum*577 + matchNum*31 + 3) < 0.55; }  // не каждый раз — иначе читают
        if(doFake){
          bomb.fakeDone = true;
          cand.fakeUntil = tick + 26; cand.fakeHoldUntil = tick + 26 + 110;
          cand.path = []; cand.pathIdx = 0;
          defuseSound(cand);
          logEvent(cand.id+" фейк-дефуз — ловит пик на звук");
        } else {
          cand.defusing = true; cand.defuseUntil = tick + dTicks; if(SND && SND.on) sndBomb("defuse", cand.baseX, cand.baseY);
          cand.path = []; cand.pathIdx = 0;
          defuseSound(cand);
          logEvent(cand.id+" дефузит"+(cand.kit?" с китом (5с)":" без кита (10с)")+"…");
        }
      }
    }
  }
}

