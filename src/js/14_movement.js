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
    var TIsig = picEvents(bot.team);
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

// Одна запись для консоли. kind — что это для смотрящего: kill (фраг), bomb
// (плант/дефуз/взрыв), team (решение команды: план, перестройка, сейв, ретейк),
// voice (колл в тимспике), round (раунд/матч). Без kind — отладка: только в
// скрытом журнале (галочка «отладка»), в консоль не попадает.
function logEvent(text, kind){
  var e = {t: simTime.toFixed(1), text: nickify(text), kind: kind || "dbg"};
  events.unshift(e);
  if(events.length > 400) events.length = 400;
  if(e.kind !== "dbg") renderLog("log", true);
  if(logDebugOpen) renderLog("logDbg", false);
}
var logDebugOpen = false;
function renderLog(id, mainOnly){
  var el = document.getElementById(id); if(!el) return;
  var h = "", n = 0;
  for(var i = 0; i < events.length && n < (mainOnly ? 40 : 400); i++){
    var e = events[i]; if(mainOnly && e.kind === "dbg") continue; n++;
    h += '<div class="ev '+e.kind+'">['+e.t+'s] '+esc(e.text)+'</div>';
  }
  el.innerHTML = h;
}
var tracers = [];
// (v151) как выглядит выстрел у разного оружия: пистолет — тонкий короткий след и
// маленькая вспышка; ПП — частые тонкие; винтовка — как было; AWP — толстый
// мгновенный луч с ореолом, большая вспышка, след висит дольше
var TRACER_STYLE = {
  pistol:{life:130, travel:55, core:1.2, trailW:0.8, trailA:0.22, tail:0.35, fr:2, fg:2.5, fl:40},
  deagle:{life:210, travel:45, core:1.9, trailW:1.1, trailA:0.3,  tail:0.3,  fr:3, fg:5,   fl:60},
  smg:   {life:110, travel:50, core:1.1, trailW:0.7, trailA:0.18, tail:0.4,  fr:2, fg:2.5, fl:35},
  rifle: {life:170, travel:70, core:1.9, trailW:1.0, trailA:0.32, tail:0.3,  fr:3, fg:4,   fl:55},
  scout: {life:300, travel:30, core:2.3, trailW:1.4, trailA:0.45, tail:0.15, fr:4, fg:6,   fl:70},
  awp:   {life:450, travel:22, core:3.0, trailW:2.0, trailA:0.55, tail:0.05, fr:6, fg:9,   fl:90, glow:7}
};
function tracerClass(w){
  if(!w) return "rifle";
  if(w.key === "AWP") return "awp";
  if(w.key === "SSG") return "scout";
  if(w.key === "DEAGLE") return "deagle";
  if(w.slot === "secondary") return "pistol";
  if(w.tier === 4) return "smg";
  return "rifle";
}
var soundPings = []; // {x,y,team,born,radius} — footstep events, visual only (hearing itself is handled via bot.heardSound)
var nowTs = 0;

var PX_UNITS = 2.5;   // 1px радара ≈ 2.5 юнита CS2 (Ancient: scale 5.0 на 1024px, у нас 2048px)
var BODY_HALF = 6.4;  // полуширина модели, px (32 юнита)
var HEAD_HALF = 2.2;  // полуразмер головы, px (~11 юнитов)
function rayClipWalls(x1, y1, x2, y2){
  var best = 1, hit = false;
  for(var i=0;i<MANUAL_WALLS.length;i++){
    var w = MANUAL_WALLS[i];
    var rx = x2-x1, ry = y2-y1, sx = w[2]-w[0], sy = w[3]-w[1];
    var den = rx*sy - ry*sx; if(Math.abs(den) < 1e-9) continue;
    var t = ((w[0]-x1)*sy - (w[1]-y1)*sx)/den, u = ((w[0]-x1)*ry - (w[1]-y1)*rx)/den;
    if(t > 0.001 && t < best && u >= 0 && u <= 1){ best = t; hit = true; }
  }
  return {x: x1 + (x2-x1)*best, y: y1 + (y2-y1)*best, wall: hit};
}
// раздел 14: магазин/перезарядка. Пустой магазин — перезарядка сразу; неполный
// (<35%) — перезаряжается, когда секунду нет стрельбы и врага не видно
// ---- оружие на земле: убитый роняет основное оружие, его может подобрать любой
// (в CS так поднимают AWP/AK у убитого и уносят в следующий раунд) ----
var groundWeapons = [];
function dropWeaponOnDeath(b){ if(b.primary && WEAPONS[b.primary]) groundWeapons.push({key:b.primary, x:b.x, y:b.y, t:tick, from:b.id}); }
// скорость бега по оружию, CS2 (юниты/с): пистолеты 240 (Deagle 230), MAC-10/MP9 240,
// Galil 215, FAMAS 220, AK 215, M4A4 225, AWP 200 (в прицеле 100). Считаем от M4 (=SPEED),
// чтобы средняя скорость команды почти не изменилась
var WSPEED = {UMP:230, MP7:220, P90:230, SSG:230, M4S:225, AUG:220, SG:210, GLOCK:240, USP:240, P250:240, TEC9:240, FIVE7:240, DEAGLE:230, MAC10:240, MP9:240, GALIL:215, FAMAS:220, AK:215, M4:225, AWP:200};
// (10) бег с ножом: длинная пробежка там, где врага быть не может (по
// таймингу/инфе ни в своей зоне, ни в соседних он ещё не успел оказаться,
// свежей инфы о врагах рядом нет) — нож (250 ю/с). Увидел/услышал врага или
// зашёл туда, где он уже может быть — достаёт оружие (~0.4с без выстрела)
function knifeTick(b){
  var want = false;
  if(b.alive && b.state === "patrol" && !b.walking && !b._sawEnemy && b.post && !b.atPost && !b.planting && !b.defusing && !b.nadeTask &&
     !(bomb && bomb.state === "carried" && bomb.carrier === b) && Math.hypot(b.post.x-b.x, b.post.y-b.y) > 450 && roundState === "live"){
    var zb = bzOf(b.x, b.y), foe = b.team === "CT" ? "T" : "CT";
    var safe = zb >= 0 && !reachPossible(b.team, zb) && (BZ.nbr[zb]||[]).every(function(j){ return !reachPossible(b.team, j); });
    if(safe){ var BL = beliefLast[b.team] || {}; for(var e in BL){ if(tick - BL[e].tick < 8*TICK_HZ && Math.hypot(BL[e].x-b.x, BL[e].y-b.y) < 1200){ safe = false; break; } } }
    if(safe && b.heardSound && tick - b.heardSound.tick < 3*TICK_HZ) safe = false;
    want = safe;
  }
  if(want && !b._knife){ b._knife = true; }
  else if(!want && b._knife){ b._knife = false; b._drawUntil = tick + Math.round(0.4*TICK_HZ); }
}
function weaponSpeedMul(b){
  if(b._knife) return 250/225;
  if(!b.weapon) return 1;
  var v = WSPEED[b.weapon.key] || 225, m = v/225;
  if(b.weapon.key === "AWP" && (b._sawEnemy || b.state === "engage" || b.state === "hold")) m *= 0.5; // в прицеле
  return m;
}
function weaponValue(k){ return k ? (WEAPONS[k].tier + (k === "AWP" ? 1.5 : 0) + (k === "AK" ? 0.5 : 0)) : -1; }
// AWP с винтовкой в руках берёт только снайпер/мидер — пока у команды есть свой
// живой снайпер или AWP у кого-то; нет — поднимает любой (AWP не бросают)
function awpAllowed(b){
  if(b.tRole === "awp" || b.tRole === "mid") return true;
  return !bots.some(function(o){ return o.alive && o.team === b.team && o !== b && (o.primary === "AWP" || o.tRole === "awp" || (b.team === "CT" && o.tRole === "mid")); });
}
function weaponPickupTick(){
  if(roundState !== "live") return;
  if(!groundWeapons.length){ bots.forEach(function(b){ if(b.alive && b.post && b.post.tag === "pickup"){ clearPost(b); dropTask(b, "pickup"); } }); return; }
  bots.forEach(function(b){
    if(!b.alive || b.planting || b.defusing) return;
    // оружие уже подобрал кто-то другой — пост "за оружием" снять (иначе стоял на пустом месте)
    if(b.post && b.post.tag === "pickup" && !groundWeapons.some(function(G){ return Math.hypot(G.x-b.post.x, G.y-b.post.y) < 40; })){ clearPost(b); dropTask(b, "pickup"); }
    // идёт за оружием — держим блок каждый тик: раньше блок жил 1 тик, и через
    // тик пост роли и "за оружием" перебивали друг друга (путь пересчитывался)
    else if(b.post && b.post.tag === "pickup" && b.state === "patrol" && !b._sawEnemy){
      // но не вечно: дошёл и не поднял (не положено по правилам/не лучше) или
      // идёт дольше 6с — бросить затею, вернуться к своей задаче
      if(!b._pickT || b._pickT.x !== b.post.x || b._pickT.y !== b.post.y) b._pickT = {x:b.post.x, y:b.post.y, t:tick};
      // (v136) раньше таймер сбрасывался при смене цели: два оружия рядом — бот
      // метался между ними и стоял на месте (путь пересчитывался). Общий лимит
      // на "хожу за оружием" — 7с, потом 8с не отвлекается на ганы
      if(!b._pickSince || tick - b._pickSeen > 4) b._pickSince = tick; b._pickSeen = tick;
      var pickTooLong = BAL.pickFix && tick - b._pickSince > 7*TICK_HZ;
      if((b.atPost && tick - b._pickT.t > TICK_HZ) || tick - b._pickT.t > 6*TICK_HZ || pickTooLong){ b._pickIgnore = {x:b.post.x, y:b.post.y, round:roundNum}; if(pickTooLong) b._pickBan = tick + 8*TICK_HZ; clearPost(b); dropTask(b, "pickup"); b._pickSince = 0; }
      else holdTask(b, "pickup", tick+1);
    }
    var cur = weaponValue(b.primary);
    // подобрать под ногами
    for(var i=0;i<groundWeapons.length;i++){
      var G = groundWeapons[i];
      if(Math.hypot(G.x-b.baseX, G.y-b.baseY) > 38 || weaponValue(G.key) <= cur) continue; // 38 ≥ радиуса "дошёл" (34), иначе стоял рядом и не поднимал
      if(G.key === "AWP" && !awpAllowed(b) && cur >= 5) continue; // снайпу — снайперу
      groundWeapons.splice(i, 1);
      if(b.primary) groundWeapons.push({key:b.primary, x:b.x, y:b.y, t:tick, from:b.id});
      b.primary = G.key; b.weapon = WEAPONS[G.key]; b._ammoFor = null; dropTask(b, "pickup");
      logEvent(b.id+" подобрал "+WEAPONS[G.key].name+(G.from ? " ("+G.from+")" : ""));
      return;
    }
    // (9) в бою: с пистолетом/ПП, рядом (≤170px) лежит винтовка/AWP убитого, врага
    // сейчас не видно ~0.5с — быстро поднять (как в CS: "подобрал АК и дальше")
    if(BAL.fightPickup && !b._sawEnemy && (b.state === "hold" || b.state === "engage" || b.state === "patrol") && tick - (b._lastSawT||0) > 32 &&
       !(bomb.state === "carried" && bomb.carrier === b) && !(b.post && /^(defuse|plantspot|antidefuse|stopplant)/.test(b.post.tag||"")) && b._fpT !== tick){
      // не срывается ради гана с важной позиции: после планта (ретейк/пост-плант)
      // и когда рядом свежая инфа о враге — только если ган почти под ногами
      var LKf = picKnown(b.team) || {}, foeNear = false;
      for(var eF in LKf){ if(tick - LKf[eF].tick < 3*TICK_HZ && Math.hypot(LKf[eF].x-b.x, LKf[eF].y-b.y) < 900){ foeNear = true; break; } }
      var gBest = null, gd = (foeNear || bomb.state === "planted") ? 80 : 170;
      groundWeapons.forEach(function(G){
        if(weaponValue(G.key) < cur + 2) return;
        if(G.key === "AWP" && !awpAllowed(b) && cur >= 5) return;
        var dG = Math.hypot(G.x-b.x, G.y-b.y); if(dG < gd && hasLOS(b.x, b.y, G.x, G.y)){ gd = dG; gBest = G; } });
      if(gBest && (b.state !== "patrol" || intelEstimate(b.team, gBest.x, gBest.y, 450, 3*TICK_HZ).n > 0)){
        b._fpT = tick;
        if(b.state !== "patrol"){ b.state = "patrol"; b.holding = false; b.stateSince = tick; }
        setPost(b, {x:gBest.x, y:gBest.y}, null, true, "pickup"); holdTask(b, "pickup", tick+1);
        if(!b._fpV || tick - b._fpV > 5*TICK_HZ){ b._fpV = tick; logEvent(b.id+": в бою — подбираю "+WEAPONS[gBest.key].name); }
        return;
      }
    }
    // сходить за ним: рядом, заметно лучше своего, не в бою, без свежей инфы о враге рядом
    if(b.state !== "patrol" || b._sawEnemy || (bomb.state === "carried" && bomb.carrier === b)) return;
    if(bomb.state === "planted" || (teamTac.CT && teamTac.CT.saving && b.team === "CT")) return; // ретейк/дефуз/сейв/отход — не до того
    if(b.post && /^(defuse|flee|save|retake|gather|antidefuse|stopplant|plantspot|fetch|lineup)/.test(b.post.tag)) return;
    if(taskOn(b, "pickup")) return;
    if(BAL.pickFix && b._pickBan > tick) return;
    var best = null, bd = 420;
    groundWeapons.forEach(function(G){
      if(b._pickIgnore && b._pickIgnore.round === roundNum && Math.hypot(G.x-b._pickIgnore.x, G.y-b._pickIgnore.y) < 40) return;
      if(weaponValue(G.key) < cur + 1 && !(G.key === "AWP" && awpAllowed(b) && weaponValue(G.key) > cur)) return; // своя AWP — за второй не ходит (раньше шёл и стоял над ней)
      // то же правило, что при подборе: AWP с винтовкой в руках берёт только снайпер/мидер
      // (раньше шёл к AWP, а поднять "не имел права" — и стоял над ней)
      if(G.key === "AWP" && !awpAllowed(b) && cur >= 5) return;
      var d = Math.hypot(G.x-b.x, G.y-b.y); if(d < bd){ bd = d; best = G; }
    });
    if(!best) return;
    var danger = intelEstimate(b.team, best.x, best.y, 450, 3*TICK_HZ).n > 0;
    if(danger) return;
    setPost(b, {x:best.x, y:best.y}, null, true, "pickup"); holdTask(b, "pickup", tick+1);
  });
}
// ======================= ЗВУК: направление, стены, новые источники =======================
// Как слышит человек в CS2: НАПРАВЛЕНИЕ понятно довольно точно (±5–7°), дистанция —
// примерно (±15%). Через стену звук глуше: слышно ближе, направление расплывается
// (±15–20°), дистанция гуляет сильнее (±30%). Раньше услышанная точка = реальная
// + случайный сдвиг в ЛЮБУЮ сторону, одинаковый для открытого места и стен.
function hearPos(o, sx, sy, seed, occl){
  var d = Math.hypot(sx-o.x, sy-o.y), a = Math.atan2(sy-o.y, sx-o.x);
  var sa = occl ? 0.30 : 0.10, sd = occl ? 0.30 : 0.15;
  var ra = hashRand(seed) + hashRand(seed*7+3) - 1;       // треугольное −1…1: чаще около нуля
  var rd = hashRand(seed*13+5) + hashRand(seed*17+11) - 1;
  var pd = Math.max(20, d*(1 + rd*sd)), pa = a + ra*sa;
  return {x:o.x + Math.cos(pa)*pd, y:o.y + Math.sin(pa)*pd};
}
var WATER_Z = {};
function inWater(x, y){
  var zid = zoneIdAt(x, y); if(!zid) return false;
  if(!(zid in WATER_Z)) WATER_Z[zid] = /water|вода/i.test(zoneUserName(zid) || "");
  return WATER_Z[zid];
}
// один звук для всех врагов в радиусе: по прямой слышно дальше, через стену — ближе
function emitSound(src, x, y, rOpen, rWall, kind, seed){
  var heard = [];
  bots.forEach(function(o){
    if(!o.alive || o.team === src.team) return;
    var d = Math.hypot(o.x-x, o.y-y); if(d > rOpen) return;
    var occl = !hasLOS(o.x, o.y, x, y); if(occl && d > rWall) return;
    var p = hearPos(o, x, y, seed + (o.id.charCodeAt(o.id.length-1)||0)*131, occl) || {x:x, y:y};
    o.heardSound = {x:p.x, y:p.y, tick:tick, team:src.team, src:src.id, kind:kind};
    heard.push(o);
  });
  return heard;
}
// услышал перезарядку — окно, пока у врага пустой магазин: держащий рядом
// выглядывает на него (у про — классика "он перезаряжается, пушу")
function reloadHeard(b, w){
  var hs = emitSound(b, b.x, b.y, 380, 220, "reload", tick*29 + (b.id.charCodeAt(b.id.length-1)||0)*7);
  hs.forEach(function(o){
    o._heardReload = {id:b.id, x:o.heardSound.x, y:o.heardSound.y, until:b.reloadUntil};
    if(!o._rlVoice || o._rlVoice + 3*TICK_HZ < tick){ o._rlVoice = tick; voiceLog(o.team, "rl"+b.id, o.id, b.id+" перезаряжается "+calloutName(o.heardSound.x, o.heardSound.y)+"!"); }
    // по голосу знают и ближние тиммейты
    bots.forEach(function(m){ if(m !== o && m.alive && m.team === o.team && Math.hypot(m.x-o.x, m.y-o.y) < 500) m._heardReload = o._heardReload; });
  });
}
// пик на перезарядку: держит угол рядом (≤450), сам не в бою, HP > 50 —
// коротко выходит на линию, откуда видно место звука. Агрессивные — чаще.
function reloadPeek(b){
  var R = b._heardReload;
  if(!R || tick >= R.until || b._sawEnemy || b.planting || b.defusing || b.hp <= 50) return false;
  if(b._rlPeekDone === R.until) return false;
  var d = Math.hypot(R.x-b.x, R.y-b.y); if(d > 450 || d < 60) return false;
  b._rlPeekDone = R.until;
  var downN = BAL.numbersPlay && aliveCount(b.team) < aliveCount(b.team === "CT" ? "T" : "CT");
  if(hashRand(tick*43 + (b.id.charCodeAt(b.id.length-1)||0)*3) > (0.35 + 0.5*prof(b, "aggr"))*(downN ? 0.5 : 1)) return false;
  var sp = pickSpots("rlpeek"+tick+b.id, {x:b.x, y:b.y}, 2, {rMax:140, minGap:40, see:[{x:R.x, y:R.y}]})[0];
  if(!sp) return false;
  
  setPost(b, sp, {x:R.x, y:R.y}, true, "repos:reload");
  if(!b.post || b.post.tag !== "repos:reload") return false;
  holdTask(b, "repos", Math.min(R.until + 32, tick + 3*TICK_HZ));
  logEvent(b.id+": пикает на перезарядку "+R.id);
  return true;
}
// ---- пас бомбы ----
// Про не носят бомбу тем, кто лезет первым или ходит в одиночку: лёркер и
// энтри отдают её тому, кто рядом из основной группы; раненый носитель (≤30 HP)
// рядом со здоровым тиммейтом тоже отдаёт — бомба не должна умереть с ним.
function bombPassTick(){
  if(tick % 16 || bomb.state !== "carried" || !teamTac.T) return;
  var c = bomb.carrier; if(!c || !c.alive || c.planting || c._sawEnemy) return;
  var tt = teamTac.T, ts = bots.filter(function(b){ return b.team === "T" && b.alive && b !== c; });
  if(!ts.length || tt.phase === "postplant") return;
  var why = null, pool = null;
  if((c.tRole === "lurker" || c.tRole === "entry") && tt.phase === "setup" && ts.length >= 2){
    pool = ts.filter(function(b){ return b.tRole !== "lurker" && b.tRole !== "entry" && b.tRole !== "awp" && b.hp > 50; }); why = c.tRole === "lurker" ? "лёркер" : "энтри";
  } else if(c.hp <= 30){
    pool = ts.filter(function(b){ return b.hp > 60; }); why = "у меня "+c.hp+" HP";
  }
  if(!pool || !pool.length) return;
  var to = pool.filter(function(b){ return Math.hypot(b.x-c.x, b.y-c.y) < 180 && !b._sawEnemy; })
    .sort(function(a, b2){ return Math.hypot(a.x-c.x, a.y-c.y) - Math.hypot(b2.x-c.x, b2.y-c.y); })[0];
  if(!to || c._passTried === roundNum+"|"+to.id) return;
  c._passTried = roundNum+"|"+to.id;
  // бросает под ноги тиммейту — тот подбирает (как дроп в CS)
  bomb.state = "dropped"; bomb.carrier = null; bomb.x = to.baseX; bomb.y = to.baseY;
  tt.fetchId = to.id;
  voiceLog("T", "pass"+c.id, c.id, "отдаю бомбу "+to.id+" ("+why+")");
  logEvent(c.id+" отдал бомбу → "+to.id);
}
// ---- (S1) добить раненого ----
function finishPush(b){
  if(b._sawEnemy || b.planting || b.defusing || b.hp <= 50 || tick < (b._finNext||0)) return;
  if(b.post && /^(defuse|plantspot|flee|save|repos|tradeR|antidefuse|stopplant|fetch|lineup|clutch)/.test(b.post.tag)) return;
  if(bomb && bomb.state === "carried" && bomb.carrier === b) return;
  if((b.team === "CT" && teamTac.CT && teamTac.CT.saving) || (b.team === "T" && teamTac.T && teamTac.T.saving)) return;
  var HT = teamIntel[b.team].hurt; if(!HT) return;
  b._finNext = tick + 16;
  var BL = beliefLast[b.team] || {}, tgt = null, tid = null;
  for(var eid in HT){ var h = HT[eid]; if(h.hp > 35 || tick - h.tick > 8*TICK_HZ) continue;
    var e = bots.filter(function(o){ return o.id === eid; })[0]; if(!e || !e.alive) continue;
    var lo = BL[eid]; if(!lo || tick - lo.tick > 4*TICK_HZ || Math.hypot(lo.x-b.x, lo.y-b.y) > 600) continue;
    if(bots.some(function(o){ return o !== b && o.alive && o.team === b.team && o.post && o.post.tag === "repos:finish" && o._finId === eid; })) continue; // уже идёт другой
    if(picOutnumbered(b.team, lo.x, lo.y, b)) continue; // раненый не один — добивать под их стволы нельзя
    tgt = lo; tid = eid; break; }
  if(!tgt) return;
  var sp = pickSpots("finish"+tick+b.id, {x:b.x, y:b.y}, 2, {rMax:200, minGap:40, see:[{x:tgt.x, y:tgt.y}]})[0];
  if(!sp) return;
  
  setPost(b, sp, {x:tgt.x, y:tgt.y}, true, "repos:finish");
  if(!b.post || b.post.tag !== "repos:finish") return;
  b._finId = tid; holdTask(b, "repos", tick + 3*TICK_HZ);
  voiceLog(b.team, "fin"+tid+b.id, b.id, tid+" на "+HT[tid].hp+" — добиваю");
}
// ---- (S7) смок уходит — готовность к выходу из-за него ----
function smokeFadeTick(){
  if(tick % 8) return;
  smokes.forEach(function(sm){
    var left = sm.until - tick; if(left > 2.5*TICK_HZ || left <= 0) return;
    sm._fadeReady = sm._fadeReady || {};
    bots.forEach(function(b){
      if(!b.alive || b._sawEnemy || sm._fadeReady[b.id]) return;
      var d = Math.hypot(b.x-sm.x, b.y-sm.y); if(d > 550 || d < NADE.smoke.radius) return;
      if(!hasLOS(b.x, b.y, sm.x, sm.y)) return;
      // враг вероятно за дымом: свежая инфа за ним (дальше центра от нас)
      var BL = beliefLast[b.team] || {}, far = null;
      for(var eid in BL){ var lo = BL[eid]; if(tick - lo.tick > 10*TICK_HZ) continue; if(Math.hypot(lo.x-sm.x, lo.y-sm.y) < 450 && Math.hypot(lo.x-b.x, lo.y-b.y) > d){ far = lo; break; } }
      if(!far) return;
      sm._fadeReady[b.id] = 1;
      var a = Math.atan2(sm.y-b.y, sm.x-b.x), ex = {x: sm.x + Math.cos(a)*NADE.smoke.radius, y: sm.y + Math.sin(a)*NADE.smoke.radius};
      if(!sm._fadeVoice){ sm._fadeVoice = 1; voiceLog(b.team, "fade"+Math.round(sm.x)+b.team, b.id, "смок уходит — готовы, они за ним"); }
    });
  });
}
// ---- (S3) смок на засвеченного AWP ----
var awpSmokeCd = {CT:0, T:0};
function awpSmokeTick(){
  if(tick % 16) return;
  ["CT","T"].forEach(function(team){
    if(tick < awpSmokeCd[team]) return;
    var BL = beliefLast[team] || {};
    for(var eid in BL){ var lo = BL[eid]; if(lo.src !== "spotted" || tick - lo.tick > 8*TICK_HZ) continue;
      var e = bots.filter(function(o){ return o.id === eid; })[0]; if(!e || !e.alive || e.primary !== "AWP") continue;
      var ap = {x:lo.x, y:lo.y};
      var th = bots.filter(function(b){ return b.alive && b.team === team && b.nades && b.nades.smoke > 0 && !b.nadeTask && !b._sawEnemy && b.post &&
        Math.hypot(b.post.x-ap.x, b.post.y-ap.y) > 300 && Math.hypot(b.post.x-ap.x, b.post.y-ap.y) < 1500 && hasLOS(b.post.x, b.post.y, ap.x, ap.y); })
        .sort(function(a, c){ return Math.hypot(a.x-ap.x, a.y-ap.y) - Math.hypot(c.x-ap.x, c.y-ap.y); })[0];
      if(!th) continue;
      var sp = {x: ap.x + (th.post.x-ap.x)*0.35, y: ap.y + (th.post.y-ap.y)*0.35};
      if(Math.hypot(sp.x-th.x, sp.y-th.y) > NADE_THROW_RANGE*1.1 || smokeCovered(sp.x, sp.y)) continue;
      if(assignNade(th, "smoke", sp, "смок на AWP "+eid, {now:true})){ awpSmokeCd[team] = tick + 15*TICK_HZ;
        voiceLog(team, "awps"+eid, th.id, "AWP "+calloutName(ap.x, ap.y)+" — даю смок на его линию"); return; }
    }
  });
}
// ---- ослеплён: не идти дальше вслепую ----
// Про, поймав флешку, не продолжает бежать: отходит на шаг-два назад за угол
// (туда, откуда пришёл — там безопасно) или, если некуда, встаёт/садится и
// держит направление, откуда шёл враг, пока не прозреет.
function onBlind(b, threat){
  if(b.planting || b.defusing) return;
  var back = null, tr = b._trail || [];
  for(var i = tr.length-1; i >= 0; i--){ var q = tr[i]; if(Math.hypot(q.x-b.baseX, q.y-b.baseY) < 40) continue; if(Math.hypot(q.x-b.baseX, q.y-b.baseY) > 220) break;
    if(!hasLOS(q.x, q.y, threat.x, threat.y)){ back = q; break; } }
  b._blind = {until:b.blindUntil, back:back, face:{x:threat.x, y:threat.y}};
  if(back){ b.path = [[back.x, back.y, b.z]]; b.pathIdx = 0; }
  logEvent(b.id+": ослеплён — "+(back ? "отходит за угол" : "присел, держит направление"));
  // (S2) тиммейт рядом закрывает угол ослеплённого: смотрит туда и готов стрелять
  if(BAL.coverBlind){
    var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === b.team && !o._sawEnemy && tick >= (o.blindUntil||0) && Math.hypot(o.x-b.x, o.y-b.y) < 260 && !o.planting && !o.defusing; });
    var cov = mates.filter(function(o){ return o.hp > 50 && !(o.post && /^(defuse|plantspot|lineup|flee|save|tradeR)/.test(o.post.tag)); })
      .sort(function(a, c){ return Math.hypot(a.x-b.x, a.y-b.y) - Math.hypot(c.x-b.x, c.y-b.y); })[0];
    if(cov){
      var cs = BAL.coverFix
        // (v151) раньше точка бралась вплотную к ослеплённому — а он в это время
        // отходит по тому же проходу: оба упирались друг в друга и дёргались.
        // Теперь: если угол и так видно — стоим и целимся; иначе шаг рядом с собой,
        // не ближе ~1м к слепому и к точке, куда он отходит
        ? (hasLOS(cov.x, cov.y, threat.x, threat.y) ? null : pickSpots("covblind"+tick+cov.id, {x:cov.x, y:cov.y}, 3, {rMax:130, minGap:24, see:[threat]})
            .filter(function(q){ return hasLOS(q.x, q.y, threat.x, threat.y) && Math.hypot(q.x-b.x, q.y-b.y) > 60 && !(back && Math.hypot(q.x-back.x, q.y-back.y) < 60); })[0])
        : pickSpots("covblind"+tick+cov.id, {x:b.baseX, y:b.baseY}, 2, {rMax:110, minGap:24, see:[threat]})
        .filter(function(q){ return hasLOS(q.x, q.y, threat.x, threat.y); })[0];
      if(BAL.coverFix && !cs){ cov._coverDir = {pt:{x:threat.x, y:threat.y}, until:b.blindUntil}; voiceLog(b.team, "cb"+b.id+tick, cov.id, "держу угол за "+b.id); }
      if(cs){ setPost(cov, cs, threat, true, "repos:coverblind"); if(cov.post && cov.post.tag === "repos:coverblind"){ holdTask(cov, "repos", tick + Math.max(2*TICK_HZ, b.blindUntil - tick)); voiceLog(b.team, "cb"+b.id, cov.id, b.id+" слепой — держу его угол"); } }
    }
  }
}
// ---- кончились патроны в бою: пистолет ----
function pistolSwap(b){
  if(!b.primary || !b.secondary || b._onPistol || b.weapon !== WEAPONS[b.primary]) return false;
  var e = b._nearestEnemyBot, near = e && e.alive && Math.hypot(e.x-b.x, e.y-b.y) < 650;
  if(!near && !(b.lastIntel && tick - b.lastIntel.tick < TICK_HZ && Math.hypot(b.lastIntel.x-b.x, b.lastIntel.y-b.y) < 650)) return false;
  var W = WEAPONS[b.secondary];
  b._onPistol = {prim:b.primary, ammo:Math.max(0, b.ammo||0)};
  b.weapon = W; b._ammoFor = W.key; b.ammo = b._secAmmo != null ? b._secAmmo : W.mag; b._reloading = false; b.reloadUntil = 0;
  b.nextShotTick = Math.max(b.nextShotTick||0, tick + 14); // ~0.2с достать пистолет
  b.burstCount = 0; b._fire = null;   // другое оружие — новая очередь
  logEvent(b.id+": кончились патроны — на пистолет ("+W.name+")");
  return true;
}
function pistolBack(b){
  if(!b._onPistol || b._sawEnemy || tick - (b.lastShotTick||-999) < 96) return;
  if(b.primary !== b._onPistol.prim){ b._onPistol = null; return; }
  b._secAmmo = b.ammo;
  var W = WEAPONS[b.primary];
  b.weapon = W; b._ammoFor = W.key; b.ammo = b._onPistol.ammo; b._reloading = false; b.reloadUntil = 0;
  b._onPistol = null;
}
// ---- стрейф в дальней дуэли (ADAD) ----
// Пистолетом (и винтовкой на большой дистанции) про не стоят столбом: шаг в
// сторону → контр-страф → выстрел → шаг в другую сторону. Двигаясь, в него
// труднее попасть (см. трекинг), а стреляет он только остановившись.
function duelStrafeOk(b){
  var e = b._nearestEnemyBot, w = b.weapon; if(!e || !w || w.key === "AWP") return false;
  var d = Math.hypot(e.x-b.x, e.y-b.y);
  if(w.slot === "secondary") return d > 220;
  if(b.state !== "engage" || b.atPost) return false;
  if(d > 600) return true;
  // средняя дистанция: ADAD только в затяжной перестрелке (уже постреляли друг
  // в друга ~0.5с), а не на первом выходе — иначе у пикающего двойное преимущество
  return BAL.midStrafe && d > 300 && (b.contactStreak || 0) > 32;
}
// ---- (3) безопасная ротация: путь мимо известных T ----
// опасность пути: рядом (≤380px) со свежей (≤10с) позицией живого T или через
// зону, где T по карте вероятностей почти наверняка есть
function pathDanger(team, pts){
  var BL = beliefLast[team] || {}, foes = [];
  for(var eid in BL){ var lo = BL[eid]; if(tick - lo.tick > 10*TICK_HZ) continue; var e = bots.filter(function(o){ return o.id === eid; })[0]; if(e && e.alive) foes.push(lo); }
  for(var i = 0; i < pts.length; i++){
    var q = pts[i];
    for(var f = 0; f < foes.length; f++) if(Math.hypot(q[0]-foes[f].x, q[1]-foes[f].y) < 380) return true;
    if(i % 2 === 0 && BZ.ids.length){ var zi = bzOf(q[0], q[1]); if(zi >= 0 && beliefZoneKnown(team, zi) >= 0.6) return true; }
  }
  return false;
}
function densify(pts, step){ var out = []; for(var i = 1; i < pts.length; i++){ var a = pts[i-1], b = pts[i], L = Math.hypot(b[0]-a[0], b[1]-a[1]), n = Math.max(1, Math.ceil(L/step)); for(var k = 0; k < n; k++) out.push([a[0]+(b[0]-a[0])*k/n, a[1]+(b[1]-a[1])*k/n]); } if(pts.length) out.push(pts[pts.length-1]); return out; }
function safeRotate(b, dest, site){
  var key = "saferot"+site+roundNum;
  if(b._safeRotK === key) return; b._safeRotK = key;
  if(Math.hypot(b.x-CT_SPAWN.x, b.y-CT_SPAWN.y) < 250) return;
  // у самого сайта T и так ждут (туда и идём) — опасность считаем только на
  // дороге ДО последних ~5м, где выбор маршрута ещё есть
  var far = function(pts){ return densify(pts, 60).filter(function(q){ return Math.hypot(q[0]-dest.x, q[1]-dest.y) > 500; }); };
  var direct = pathPts(b.x, b.y, dest.x, dest.y);
  if(!pathDanger("CT", far(direct))) return;
  var v1 = pathPts(b.x, b.y, CT_SPAWN.x, CT_SPAWN.y), v2 = pathPts(CT_SPAWN.x, CT_SPAWN.y, dest.x, dest.y);
  var Ld = polyLen(direct), Lv = polyLen(v1) + polyLen(v2);
  if(Lv > Ld*1.7 + 150) { logEvent(b.id+": путь на "+site+" опасный, но крюк слишком длинный — иду напрямую, тихо"); return; }
  if(pathDanger("CT", far(v1.concat(v2.slice(1))))) { logEvent(b.id+": к "+site+" оба пути опасные — иду напрямую, тихо"); return; }
  startRoute(b, ["CT Spawn"], key);
  voiceLog("CT", "saferot"+b.id, b.id, "на "+site+" иду через спавн — там, где короче, их видели");
}
// ---- (4) ниндзя-дефуз ----
// все живые T засвечены недавно (≤8с) и все далеко от бомбы (>700px) — не
// ждём сбора и не кидаем гранат: дефузер идёт сразу, последние метры шифтом
function ninjaOk(){
  var ts = bots.filter(function(o){ return o.team === "T" && o.alive; }); if(!ts.length) return false;
  var BL = beliefLast.CT || {};
  return ts.every(function(t){ var lo = BL[t.id]; return lo && tick - lo.tick < 8*TICK_HZ && Math.hypot(lo.x-bomb.x, lo.y-bomb.y) > 700; });
}
// ---- (7) перезарядка за укрытием ----
function exposedTo(b, maxD, maxAge){
  // только реальная угроза выглянуть сейчас: свежая (≤4с) инфа и близко (≤600) —
  // иначе бот уходил с угла на каждую перезарядку и сайт оставался пустым
  maxD = maxD || 600; maxAge = maxAge || 4*TICK_HZ;
  var BL = beliefLast[b.team] || {}, out = [];
  for(var eid in BL){ var lo = BL[eid]; if(tick - lo.tick > maxAge) continue; var e = bots.filter(function(o){ return o.id === eid; })[0]; if(!e || !e.alive) continue;
    if(Math.hypot(lo.x-b.x, lo.y-b.y) < maxD && hasLOS(b.x, b.y, lo.x, lo.y)) out.push({x:lo.x, y:lo.y}); }
  return out;
}
function coverForReload(b, from){
  if(b._rlCoverT && tick - b._rlCoverT < 3*TICK_HZ) return true;
  b._rlCoverT = tick;
  var sp = pickSpots("rlcov"+tick+b.id, {x:b.x, y:b.y}, 2, {rMin:30, rMax:150, minGap:30, hideFrom:from})
    .filter(function(q){ return from.every(function(f){ return !hasLOS(q.x, q.y, f.x, f.y); }); })[0];
  if(!sp) return false;
  
  setPost(b, sp, from[0], true, "repos:rlcover");
  if(!b.post || b.post.tag !== "repos:rlcover") return false;
  holdTask(b, "repos", tick + 3*TICK_HZ);
  logEvent(b.id+": уходит за укрытие перезарядиться");
  return true;
}
// ---- (8) мало HP — к своим ----
function lowHpBack(b){
  if(b.hp > 30 || b._sawEnemy || b.planting || b.defusing || tick < (b._lowHpNext||0)) return;
  if(bomb && bomb.state === "planted") return; // ретейк/пост-плант — бомба важнее
  var defending = b.team === "CT" && b.post && /^(anchor|stack|set:|cts:|clutch|midcover)/.test(b.post.tag);
  if(bomb && bomb.state === "carried" && bomb.carrier === b) return;
  if(b.post && /^(defuse|plantspot|flee|save|repos|tradeR|antidefuse|stopplant|fetch|lineup)/.test(b.post.tag)) return;
  b._lowHpNext = tick + TICK_HZ;
  var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === b.team; });
  if(!mates.length) return; // один — отходить не к кому
  if(mates.some(function(o){ return Math.hypot(o.x-b.x, o.y-b.y) < 350; })) return; // рядом уже есть свой
  var threat = exposedTo(b).concat([]); var BL = beliefLast[b.team] || {};
  var near = false; for(var eid in BL){ var lo = BL[eid]; if(tick - lo.tick < 8*TICK_HZ && Math.hypot(lo.x-b.x, lo.y-b.y) < 700){ near = true; threat.push({x:lo.x, y:lo.y}); } }
  if(!near) return;
  // опорник на своём сайте с малым HP сайт не бросает — отходит, только если
  // совсем мало (≤20) и на него идут двое+
  if(defending){ var nNear = 0; for(var eid2 in BL){ var lo2 = BL[eid2]; if(tick - lo2.tick < 6*TICK_HZ && Math.hypot(lo2.x-b.x, lo2.y-b.y) < 700) nNear++; } if(b.hp > 20 || nNear < 2) return; }
  var m = mates.sort(function(a, c){ return Math.hypot(a.x-b.x, a.y-b.y) - Math.hypot(c.x-b.x, c.y-b.y); })[0];
  var sp = pickSpots("lowhp"+tick+b.id, {x:m.x, y:m.y}, 2, {rMin:40, rMax:180, minGap:40, hideFrom:threat.slice(0, 3)})[0] || {x:m.x, y:m.y};
  
  setPost(b, sp, threat[0], true, "repos:lowhp");
  if(!b.post || b.post.tag !== "repos:lowhp") return;
  if(b.state === "hold") leaveHold(b);
  holdTask(b, "repos", tick + 6*TICK_HZ); b._lowHpNext = tick + 10*TICK_HZ;
  voiceLog(b.team, "lowhp"+b.id, b.id, "у меня "+b.hp+" — отхожу к "+m.id);
}
// ---- шифт по угрозе ----
// Раньше боты бегали всегда, кроме нескольких частных случаев (слышал/видел
// только что, заход на ретейк, проба, лёркер…). Как будто точно знали, что
// впереди никого. Про-игрок шифтует там, где враг уже МОЖЕТ стоять и слушать:
// смотрим на ~260px вперёд по пути — если в этих зонах (или соседних) по карте
// вероятностей кто-то вероятно есть и по таймингу он уже мог туда добежать,
// идём тихо. Бегом — где пусто/враг ещё не успел, и когда надо спешить:
// выход T, время раунда, размен, бомба, ротация на подтверждённый выход.
function dangerWalk(b){
  if(!b.post || b.state !== "patrol" || !BZ.ids.length) return false;
  var tag = b.post.tag || "";
  if(/^(tradeR|flee|fetch|stopplant|antidefuse|repos|plantspot|lineup|defuse|smokeWait|pickup|retake|save|trade)/.test(tag)) return false;
  var secLeft = ROUND_TIME_SEC - (simTime - roundStartTime), tt = teamTac.T, ct = teamTac.CT;
  if(b.team === "T"){
    if(secLeft < 30 && bomb.state !== "planted") return false;
    if(tt && tt.phase === "execute" && b.tRole !== "lurker" && tick - (tt.execStart||tick) < 15*TICK_HZ) return false; // выход — быстро
    if(tt && tt.phase === "setup" && b.post){ // шифтом не успеть к выходу — бегом
      var dP = Math.hypot(b.post.x-b.baseX, b.post.y-b.baseY)*1.3;
      if((tt.execTick - tick)/TICK_HZ < dP/(SPEED*WALK_SPEED_FRAC) + 2) return false;
    }
  } else {
    if(bomb.state === "planted") return false; // ретейк — своя логика подхода
    if(/^rotate/.test(tag) && ct && ct.call && (ct.call.bombSeen || ct.call.count >= 2)) return false; // подтверждённый выход — бегом
  }
  if(b._dwTick && tick - b._dwTick < 8) return !!b._dwVal;
  // включился шифт — держим его хотя бы ~1с (иначе на границе порога бот
  // переключался шаг/бег/шаг несколько раз в секунду)
  if(BAL.lookCommit && b._dwVal && tick - (b._dwOnT||0) < 64){ b._dwTick = tick; return true; }
  b._dwTick = tick; var dwPrev = b._dwVal;
  var foe = b.team, pts = [], acc = 0, px = b.baseX, py = b.baseY;
  for(var i = b.pathIdx; i < b.path.length && acc < 260; i++){
    var q = b.path[i], sl = Math.hypot(q[0]-px, q[1]-py); acc += sl; px = q[0]; py = q[1]; pts.push([px, py]);
  }
  if(!pts.length) pts.push([b.post.x, b.post.y]);
  var seenZ = {}, dz = 0;
  pts.forEach(function(q){
    var zi = bzOf(q[0], q[1]); if(zi < 0 || seenZ[zi]) return; seenZ[zi] = 1;
    var own = reachPossible(foe, zi) ? beliefZoneKnown(foe, zi) : 0;
    var nb = 0; (BZ.nbr[zi]||[]).forEach(function(j){ if(reachPossible(foe, j)) nb = Math.max(nb, beliefZoneKnown(foe, j)); });
    dz = Math.max(dz, own + 0.5*nb);
    // (v143) непроверенный угол вплотную к пути, куда враг мог успеть — тихо,
    // чтобы чекнуть его и не спалиться (у про: "иду шифтом, чекаю каждый угол")
    var uc = uncheckedW(foe, zi); (BZ.nbr[zi]||[]).forEach(function(j){ var c = BZ.cent[j]; if(c && Math.hypot(c.x-q[0], c.y-q[1]) < 320) uc = Math.max(uc, uncheckedW(foe, j)); });
      if(uc >= 0.8) dz = Math.max(dz, LOOK.uncheckWalk);
  });
  b._dwVal = dz >= (BAL.dangerWalkThr || 0.12);
  if(b._dwVal && !dwPrev) b._dwOnT = tick;
  // "чисто" в одной зоне ≠ безопасно вокруг: карта вероятностей после колла
  // "проверил — пусто" обнуляет зону, и раньше бот сразу срывался на бег и
  // палил позицию. Если враг недавно (≤15с) был засвечен рядом с путём (≤650px)
  // и он жив — идём тихо, пока его не найдут снова
  if(!b._dwVal && BAL.clearQuiet){
    var L = picKnown(b.team) || {}, BL = beliefLast[b.team] || {};
    outer: for(var eid in BL){
      var lo = BL[eid]; if(!lo || tick - lo.tick > 15*TICK_HZ) continue;
      var foeB = bots.filter(function(o){ return o.id === eid; })[0]; if(!foeB || !foeB.alive) continue;
      for(var pi = 0; pi < pts.length; pi++) if(Math.hypot(pts[pi][0]-lo.x, pts[pi][1]-lo.y) < 650){ b._dwVal = true; b._dwWhy = "near"; if(!dwPrev) b._dwOnT = tick; break outer; }
    }
  }
  return b._dwVal;
}
// ---- дабл-пик: помочь тиммейту в перестрелке ----
// Раньше, если тиммейт в упор рядом перестреливался, а самому врага не видно
// (стоял за углом/смотрел свой угол), бот так и стоял: реакции на "рядом идёт
// бой" не было — только размен ПОСЛЕ смерти. Теперь: тиммейт ≤160px уже ~0.3с
// видит врага и стреляет, мне его не видно — выхожу на соседнюю точку с линией
// на того врага (рядом с тиммейтом, но не в его же клетку), двое на одного.
function assistPeek(b){
  if(b._sawEnemy || b.planting || b.defusing || b.hp <= 35) return false;
  if(tick < (b._assistNext||0)) return false;
  if(b.post && /^(defuse|plantspot|lineup|flee|save|repos|tradeR|stopplant|antidefuse|fetch)/.test(b.post.tag)) return false;
  if(bomb && bomb.state === "carried" && bomb.carrier === b) return false; // носитель в дуэли не лезет
  var mate = null, E = null;
  bots.forEach(function(m){
    if(mate || m === b || !m.alive || m.team !== b.team || !m._sawEnemy || (m.contactStreak||0) < 20) return;
    if(Math.hypot(m.x-b.x, m.y-b.y) > (BAL.groupPlay ? 300 : 160)) return;
    var e = m._nearestEnemyBot; if(!e || !e.alive || Math.hypot(e.x-b.x, e.y-b.y) > 900) return;
    mate = m; E = e;
  });
  if(!mate) return false;
  b._assistNext = tick + 24;
  // линия есть, но смотрит в другую сторону — разворот на врага по коллу тиммейта
  if(hasVision(b.x, b.y, E.x, E.y)) return false; // врага видит тиммейт — он уже в картине команды, разворот — по ней
  var ep = {x:E.x, y:E.y};
  var sp = pickSpots("assist"+tick+b.id, BAL.groupPlay ? {x:mate.x, y:mate.y} : {x:(b.x+mate.x)/2, y:(b.y+mate.y)/2}, 3, {rMax: BAL.groupPlay ? 140 : 110, minGap:24, must:[ep]})
    .filter(function(q){ return Math.hypot(q.x-mate.x, q.y-mate.y) > 22 && hasLOS(q.x, q.y, ep.x, ep.y); })[0];
  if(!sp) return false;
  
  setPost(b, sp, ep, true, "repos:assist");
  if(!b.post || b.post.tag !== "repos:assist") return false;
  if(b.state === "hold") leaveHold(b);
  holdTask(b, "repos", tick + 2*TICK_HZ);
  if(!b._assistVoice || tick - b._assistVoice > 4*TICK_HZ){ b._assistVoice = tick; voiceLog(b.team, "assist"+b.id, b.id, "выхожу с "+mate.id+" на "+E.id+" — дабл!"); }
  return true;
}
function updateReload(b){
  var w = b.weapon; if(!w || !b.alive) return;
  if(b._ammoFor !== w.key){ b._ammoFor = w.key; b.ammo = w.mag; b._reloading = false; b.reloadUntil = 0; }
  if(b._reloading && tick >= b.reloadUntil){ b._reloading = false; b.ammo = w.mag; }
  if(b._onPistol) pistolBack(b);
  if(!b._reloading && b.ammo <= 0 && pistolSwap(b)) return;
  // после перестрелки про перезаряжается почти всегда, если магазин заметно
  // потрачен (а не только когда он почти пуст) — отсюда и звук перезарядки,
  // на который пикают
  var rlFrac = 0.75, rlWait = 96;
  var tacRl = !b._reloading && b.ammo > 0 && !b._sawEnemy && b.ammo < w.mag*rlFrac && tick - (b.lastShotTick||-999) > rlWait;
  // тактическая перезарядка на виду у известного врага — сначала за укрытие
  // (если патронов ещё не критично мало)
  if(tacRl && BAL.reloadCover && b.ammo > w.mag*0.2 && !b.planting && !b.defusing){
    var ex = exposedTo(b);
    if(ex.length){ coverForReload(b, ex); tacRl = false; }
  }
  if(!b._reloading && (b.ammo <= 0 || tacRl)){
    b._reloading = true; b.reloadUntil = tick + Math.round(w.reload*TICK_HZ);
    if(b.ammo <= 0) logEvent(b.id+": перезарядка ("+w.name+", "+w.reload+"с)");
    reloadHeard(b, w);
  }
}

