// [хозяева: roamSetRoamCheckStart, roamSetRoamCheckUntil, roamSetRoamChecking, roamSetRoamIdx, roamSetRoamLookPt, roamSetRoamPrevPt, roamSetRoamSoundHandled, roamSetRoamSoundLockUntil, roamSetRoamTarget, updateRoamer] ---------- поле зрения ----------
// Бот видит врага, только если тот в конусе взгляда (FOV_DEG) или совсем
// рядом (слышно/"спиной почувствовал" — FOV_NEAR), либо контакт уже идёт
// (не теряет цель, повернувшись к ней). Раньше обзор был на 360° — тогда
// и конус на радаре врал бы, и "держать угол" ничего не значило.
var FOV_DEG = BAL.fov, FOV_NEAR = 70, CONE_R = 520;
function inFov(b, x, y){
  if(b.facing === undefined) return true;
  var d = DM.hypot(x-b.x, y-b.y);
  if(d < FOV_NEAR) return true;
  var a = DM.atan2(y-b.y, x-b.x);
  var off = Math.abs(DM.wrapPi(a - b.facing));
  return off <= FOV_DEG*Math.PI/360;
}

buildSites();

function roamPtLabel(p){ var zid = /^zone\d+$/.test(p.name||"") ? p.name : zoneIdAt(p.x, p.y); return zid ? zoneLabel(zid) : (p.name||"точка"); }
function updateRoamer(bot){
  if(bot.role !== "roamer" || bot.state !== "patrol") return;
  var route = ROAM_ROUTES[bot.team]; if(!route || !route.length) return;
  if(bot.roamChecking){
    if(tick >= bot.roamCheckUntil){
      var done = route[bot.roamIdx % route.length];
      done.cleared = tick;
      logEvent(bot.id+" (роумер): "+roamPtLabel(done)+" — чисто");
      roamSetRoamPrevPt(bot, done);
      roamSetRoamChecking(bot, false);
      roamSetRoamIdx(bot, (bot.roamIdx+1) % route.length);
      movePath(bot, [], "roam", 0);
    }
    return;
  }
  // раздел 11.1: маршрут как сбор инфы — роумер сворачивает проверить точку не
  // только по тому, что услышал сам, но и по тому, что услышала команда
  // (сигналы "sound" из раздела 11): путь по карте подстраивается под то,
  // где недавно было шумно, а не идёт по жёстко заданному кругу
  // (после смены цели по звуку ~3с не дёргается на каждый следующий шаг —
  // иначе при двух источниках звука метался бы между точками туда-сюда)
  var snd = null, sndKey = null;
  if(bot.heardSound && tick - bot.heardSound.tick < 4){ snd = bot.heardSound; sndKey = "own"+snd.tick; }
  else if(typeof teamIntel !== "undefined"){
    var TIsig = teamIntel[bot.team].sig;
    for(var si2 = TIsig.length-1; si2 >= 0; si2--){
      var sgz = TIsig[si2];
      if(tick - sgz.tick > 3*TICK_HZ) break;
      if(sgz.type === "sound" && sgz.by !== bot.id){ snd = sgz; sndKey = "team"+sgz.tick+sgz.id; break; }
    }
  }
  if(snd && bot._roamSoundHandled !== sndKey && tick >= (bot._roamSoundLockUntil||0)){
    roamSetRoamSoundHandled(bot, sndKey);
    var bi = -1, bd = Infinity;
    route.forEach(function(p,i){
      if(tick - p.cleared < ROAM_RECHECK_TICKS) return;
      var d = DM.hypot(p.x-snd.x, p.y-snd.y);
      if(d < bd){ bd = d; bi = i; }
    });
    if(bi >= 0 && bi !== bot.roamIdx % route.length){
      roamSetRoamIdx(bot, bi); movePath(bot, [], "roam", 0);
      roamSetRoamSoundLockUntil(bot, tick + 192);
      logEvent(bot.id+" (роумер): "+(snd===bot.heardSound?"услышал шаги":"по коллу тиммейта")+" — иду чекать "+roamPtLabel(route[bi]));
    }
  }
  var cur = route[bot.roamIdx % route.length];
  if(bot.roamTarget === cur && DM.hypot(cur.x-bot.baseX, cur.y-bot.baseY) < 45){
    roamSetRoamChecking(bot, true);
    roamSetRoamCheckStart(bot, tick); roamSetRoamCheckUntil(bot, tick + ROAM_CHECK_TICKS);
    movePath(bot, [], "roam", 0);
    // смотрим туда, откуда вероятнее придёт враг — в сторону его спавна
    var en = bot.team==="CT" ? T_SPAWN : CT_SPAWN;
    roamSetRoamLookPt(bot, {x:en.x, y:en.y});
  }
}

// ---------- combat ----------
var DECISION_INTERVAL_TICKS = 12;


// Запись состояния канала. Вызовы выполняются в исходной точке тика.
function roamSetRoamSoundHandled(bot, value){ return bot._roamSoundHandled = value; }
function roamSetRoamSoundLockUntil(bot, value){ return bot._roamSoundLockUntil = value; }
function roamSetRoamChecking(bot, value){ return bot.roamChecking = value; }
function roamSetRoamCheckStart(bot, value){ return bot.roamCheckStart = value; }
function roamSetRoamCheckUntil(bot, value){ return bot.roamCheckUntil = value; }
function roamSetRoamIdx(bot, value){ return bot.roamIdx = value; }
function roamSetRoamLookPt(bot, value){ return bot.roamLookPt = value; }
function roamSetRoamPrevPt(bot, value){ return bot.roamPrevPt = value; }
function roamSetRoamTarget(bot, value){ return bot.roamTarget = value; }
