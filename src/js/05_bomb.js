// ---------- бомба ----------
var PLANT_TICKS = Math.round(3.2*64), BOMB_TICKS = 40*64, DEFUSE_TICKS = 10*64, DEFUSE_KIT_TICKS = 5*64;
var BOMB_KILL_RADIUS = 330;
// куда бежать от бомбы: раньше все T бежали в свою точку сбора (tStage), даже
// если стояли по другую сторону сайта — и бежали ЧЕРЕЗ бомбу. Теперь — ближайшая
// по пути зона за радиусом взрыва; путь не должен проходить через сам взрыв,
// и подальше от известного врага (карта угроз)
function bombFleePoint(b){
  if(!bomb || bomb.state !== "planted") return null;
  if(b._flee && b._flee.round === roundNum && b._flee.m === matchNum) return b._flee.pt;
  var R = BOMB_KILL_RADIUS, best = null, bs = Infinity;
  if(!BZ.ids.length) beliefBuild();
  BZ.cent.forEach(function(c, i){
    if(!c) return;
    var dB = Math.hypot(c.x-bomb.x, c.y-bomb.y);
    if(dB < R + 70 || dB > R + 500) return;
    var q = walk(c), pts = pathPts(b.x, b.y, q.x, q.y);
    if(pts.length < 1) return;
    var L = polyLen(pts), minD = Infinity;
    for(var k=1;k<pts.length;k++){ var dd = distToSeg(bomb.x, bomb.y, [pts[k-1][0], pts[k-1][1], pts[k][0], pts[k][1]]); if(dd < minD) minD = dd; }
    // старт уже внутри радиуса — путь неизбежно начинается в нём; штрафуем
    // только если путь уходит к бомбе ближе, чем бот стоит сейчас
    var dNow = Math.hypot(b.x-bomb.x, b.y-bomb.y);
    var sc = L + (minD < Math.min(R*0.75, dNow - 30) ? 900 : 0) + 600*beliefZoneKnown(b.team, i);
    if(sc < bs){ bs = sc; best = q; }
  });
  b._flee = {round:roundNum, m:matchNum, pt:best};
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
  bots.forEach(function(b){ b.planting = false; b.defusing = false; b.fakeUntil = 0; b.fakeHoldUntil = 0; b.retakeRole = null; b._defuseHeard = -9999; b._task = null; });
}
function dropBomb(b){
  if(bomb && bomb.state === "carried" && bomb.carrier === b){
    bomb.state = "dropped"; bomb.x = b.x; bomb.y = b.y; bomb.carrier = null;
    logEvent(b.id+" погиб с бомбой — C4 на земле", "bomb");
  }
}
// звук дефуза слышат T в радиусе 700px — именно звук, а не "всезнание":
// T, которые не рядом, про дефуз не знают
var DEFUSE_HEAR = 700;
function defuseSound(ct){ makeSound(ct, bomb.x, bomb.y, "defuse"); }
// (6) звук дефуза длится, пока дефузят: T рядом слышат, что он продолжается
// (фейк — короткий "тап" и тишина). По этому и отличают фейк от настоящего
function defuseContTick(){
  if(!bomb || bomb.state !== "planted") return;
  var dfz = bots.filter(function(o){ return o.alive && o.defusing; })[0];
  if(!dfz || tick % 8) return;
  makeSound(dfz, bomb.x, bomb.y, "defusing");
}
// T решают, бежать ли на звук дефуза сейчас: если время позволяет — ~0.8с
// ждут, продолжается ли звук (настоящий дефуз) или стих (фейк — CT ждут пика).
// Не успевают — бегут сразу (тогда фейк их и ловит). Агрессивный — иногда сразу
function tDefuseGo(tt, ts){
  var heard = ts.filter(function(b){ return tick - (b._defuseHeard||-9999) < 110; });
  if(!heard.length) return false;
  var h0 = Math.max.apply(null, heard.map(function(b){ return b._defuseHeard; }));
  var cont = ts.some(function(b){ return (b._defuseCont||-9999) > h0 + 36; });
  if(cont){ return true; }
  var kitGuess = tDefuseNeed();
  var near = heard.slice().sort(function(a, c){ return pathLenTo(a, bomb.x, bomb.y) - pathLenTo(c, bomb.x, bomb.y); })[0];
  var travel = pathLenTo(near, bomb.x, bomb.y)/SPEED*TICK_HZ;
  var canWait = travel + 60 < kitGuess && bombTimeLeftTicks() > kitGuess + 40;
  var rush = hashRand(h0*7 + near.id.charCodeAt(1)) < 0.125;               // иногда без раздумий
  if(!canWait || rush) return true;
  if(tick - h0 < 52) return false;                                          // слушают ~0.8с
  return false;
}
// сколько длится дефуз по мнению T: с китом ли — не знаем, считаем по тому,
// что поняли об их закупе (видели винтовки — значит, и кит, скорее всего, есть)
function tDefuseNeed(){
  var BR = teamIntel.T.buy, EG = teamEco.T.enemyGuess;
  return (BR && BR.read ? BR.read === "buy" : !!(EG && EG.full)) ? DEFUSE_KIT_TICKS : DEFUSE_TICKS;
}
// сколько ему ещё дефузить по мнению T: от того, когда услышали начало
function tDefuseLeftGuess(ts){
  var st = -1; ts.forEach(function(b){ if(tick - (b._defuseHeard||-9999) < 110) st = Math.max(st, b._defuseStart||-1); });
  return st < 0 ? null : Math.max(0, st + tDefuseNeed() - tick);
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
          c.planting = false; c._noPlantUntil = tick + 1.2*TICK_HZ;
          if(!c._prV || tick - c._prV > 8*TICK_HZ){ c._prV = tick; logEvent(c.id+": по мне стреляют — бросил плант, отвечаю"); }
          return;
        }
      }
      if(tick >= c.plantUntil){
        c.planting = false;
        bomb.state = "planted"; bomb.site = tac.site; bomb.x = c.baseX; bomb.y = c.baseY;
        bomb.plantTick = tick; bomb.explodeTick = tick + BOMB_TICKS; bomb.carrier = null;
        c.money = Math.min(MAX_MONEY, c.money + 300);
        logEvent(c.id+" заложил бомбу на "+tac.site+" (+$300)", "bomb");
        feedEvent("bomb", c.id+" заложил бомбу на "+tac.site);
      }
      return;
    }
    // Плант: на сайте, в патруле; видимый враг мешает только если он близко
    // (раньше любой видимый CT через полкарты — и носитель стоял на точке
    // планта до конца раунда: это и были почти все проигрыши T по времени)
    var nearFoe = c._sawEnemy && c._nearestEnemyDist < 500;
    if(site && tac.phase !== "setup" && c.state === "patrol" && !nearFoe && onSite(site, c.baseX, c.baseY) && !(c._noPlantUntil > tick)){
      c.planting = true; c.plantUntil = tick + PLANT_TICKS; c.path = []; c.pathIdx = 0;
      logEvent(c.id+" закладывает бомбу на "+tac.site+"…", "bomb");
      // звук планта (писк C4): CT рядом (≤520px, или ≤850 по прямой видимости) слышат
      // и сразу говорят в войс — это самый сильный повод для колла/ротации
      // (что плантят и на каком сайте, CT узнают, когда услышавший скажет — тимспик)
      makeSound(c, c.x, c.y, "plant");
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
      // дефуз в огне (как в CS) продолжается, если HP хватает дожить до конца
      if(inFire(def.x, def.y) && def.hp < (def.defuseUntil - tick)/TICK_HZ*40 + 10){ def.defusing = false; def.defuseCooldownUntil = tick + 32; logEvent(def.id+" прервал дефуз — молотов, не доживёт"); return; }
      if(def._sawEnemy && def.contactStreak > 6 && bombTimeLeftTicks() > need + 192){
        def.defusing = false; def.defuseCooldownUntil = tick + 96; logEvent(def.id+" прервал дефуз — враг рядом", "bomb");
      } else if(tick >= def.defuseUntil){
        def.defusing = false; bomb.state = "defused";
        def.money = Math.min(MAX_MONEY, def.money + 300);
        logEvent(def.id+" обезвредил бомбу (+$300)", "bomb");
        feedEvent("defuse", def.id+" обезвредил бомбу"+(bots.some(function(o){ return o.team==="T" && o.alive; }) ? " под носом у T" : ""));
        endRound("CT", "defuse");
      }
    } else {
      var cand = bots.filter(function(b){ return b.team==="CT" && b.alive && b.state==="patrol" && Math.hypot(b.baseX-bomb.x, b.baseY-bomb.y) < 42; })[0];
      var dTicks = cand ? (cand.kit ? DEFUSE_KIT_TICKS : DEFUSE_TICKS) : 0;
      if(cand && cand.fakeUntil && tick < cand.fakeUntil){ /* идёт фейк — ждём */ }
      else if(cand && cand.fakeHoldUntil && tick < cand.fakeHoldUntil){ /* после фейка держит угол */ }
      else if(cand && tick >= (cand.defuseCooldownUntil||0) && (!cand._sawEnemy || bombTimeLeftTicks() < dTicks+64)){
        var tLeftAlive = bots.some(function(o){ return o.team==="T" && o.alive; });
        // фейк-дефуз (план §8): если T живы и время с запасом — сначала "тапнуть"
        // дефуз, чтобы T на звук выглянули, и встретить их, стоя с прицелом на угол
        var doFake = tLeftAlive && !bomb.fakeDone && bombTimeLeftTicks() > dTicks + 5*TICK_HZ;
        if(doFake){ bomb.fakeDone = true; doFake = hashRand(roundNum*577 + matchNum*31 + 3) < 0.55; }  // не каждый раз — иначе читают
        if(doFake){
          bomb.fakeDone = true;
          cand.fakeUntil = tick + 26; cand.fakeHoldUntil = tick + 26 + 110;
          cand.path = []; cand.pathIdx = 0;
          defuseSound(cand);
          logEvent(cand.id+" фейк-дефуз — ловит пик на звук");
        } else {
          cand.defusing = true; cand.defuseUntil = tick + dTicks;
          cand.path = []; cand.pathIdx = 0;
          defuseSound(cand);
          logEvent(cand.id+" дефузит"+(cand.kit?" с китом (5с)":" без кита (10с)")+"…", "bomb");
        }
      }
    }
  }
}

