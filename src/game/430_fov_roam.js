// ---------- поле зрения ----------
// Бот видит врага, только если тот в конусе взгляда (FOV_DEG) или совсем
// рядом (слышно/"спиной почувствовал" — FOV_NEAR), либо контакт уже идёт
// (не теряет цель, повернувшись к ней). Раньше обзор был на 360° — тогда
// и конус на радаре врал бы, и "держать угол" ничего не значило.
var FOV_DEG = BAL.fov, FOV_NEAR = 70, CONE_R = 520;
function inFov(b, x, y){
  if(b.facing === undefined) return true;
  var d = Math.hypot(x-b.x, y-b.y);
  if(d < FOV_NEAR) return true;
  var a = Math.atan2(y-b.y, x-b.x);
  var off = Math.abs(((a - b.facing + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
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
      bot.roamPrevPt = done;
      bot.roamChecking = false;
      bot.roamIdx = (bot.roamIdx+1) % route.length;
      bot.path = []; bot.pathIdx = 0;
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
    bot._roamSoundHandled = sndKey;
    var bi = -1, bd = Infinity;
    route.forEach(function(p,i){
      if(tick - p.cleared < ROAM_RECHECK_TICKS) return;
      var d = Math.hypot(p.x-snd.x, p.y-snd.y);
      if(d < bd){ bd = d; bi = i; }
    });
    if(bi >= 0 && bi !== bot.roamIdx % route.length){
      bot.roamIdx = bi; bot.path = []; bot.pathIdx = 0;
      bot._roamSoundLockUntil = tick + 192;
      logEvent(bot.id+" (роумер): "+(snd===bot.heardSound?"услышал шаги":"по коллу тиммейта")+" — иду чекать "+roamPtLabel(route[bi]));
    }
  }
  var cur = route[bot.roamIdx % route.length];
  if(bot.roamTarget === cur && Math.hypot(cur.x-bot.baseX, cur.y-bot.baseY) < 45){
    bot.roamChecking = true;
    bot.roamCheckStart = tick; bot.roamCheckUntil = tick + ROAM_CHECK_TICKS;
    bot.path = []; bot.pathIdx = 0;
    // смотрим туда, откуда вероятнее придёт враг — в сторону его спавна
    var en = bot.team==="CT" ? T_SPAWN : CT_SPAWN;
    bot.roamLookPt = {x:en.x, y:en.y};
  }
}

// ---------- combat ----------
var DECISION_INTERVAL_TICKS = 12;

