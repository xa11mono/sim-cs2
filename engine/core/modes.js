// [хозяева: warmSpawn, warmTick, sbPlace, sbRemove, sbRevive, sbTick, dvPlace] (Р5, 26.11, ядро без показа) состояние режимов страницы, которое читает и пишет ядро: демо (DEMOV), песочница (SANDBOX), разминка (WARM)
// и надпись смены сторон RC_HALF (пишет смена сторон, показ забирает). Объявления перенесены дословно из view/demo.js, view/sandbox.js,
// view/warmup.js, view/app.js: ядро обходится без файлов показа (tools/node/core_build.py); в ядре без показа режимы выключены (on: false) —
// как у страницы при загрузке.
// (Р5, 27.11) расчёт режимов — здесь же (перенесён дословно из view/warmup.js, view/sandbox.js, view/demo.js, view/replay-play.js): режим
// меняет состояние игры только функциями ядра, показ зовёт их как команды (граница показ → игра, tools/rebuild/frame_contract.js --check).
// Показ — у вызывающего (ответ функции) или по флагу кадра (KF_DIRTY): расчёт функций показа не зовёт
var DEMOV = {on: false, i: 0, R: null, t0: 0, BOT: {}, ei: 0, allow: false};
var SANDBOX = {on: false, sel: null, drag: null, place: null, last: 0};
var WARM = {on:false};
var RC_HALF = null;
// (Р5.2, 26.11) показ нужен: строки войса, надпись смены сторон — то, что только показывают. Страница — да, Node — нет (как было: проверка
// `typeof document`); ядро в Worker страницы включает его само (tools/node/core_build.py, обработчик команд)
var SIM_SHOW = typeof document !== "undefined";
// ---- разминка
// Как в CS2: сервер запущен заранее, матч — по расписанию (например, 11:30, сервер с 11:25 → 5 мин разминки игрового времени;
// сколько — случайно, 3–8 мин, по номеру матча). Все бегают по карте между позициями про (KNOW_POSITIONS), стреляются, убитый
// возрождается через 2 с на своей половине; бомбы, раундов, экономики и войса нет. Конец (или «Начать матч») — freshMatch(n):
// матч идёт точно так же, как без разминки (номер матча по-прежнему повторяет игру). Числа — проектные (это показ)
// WARM (состояние режима, которое читает и пишет ядро) — engine/core/modes.js (Р5)
// (Р5, 27.11) случайность разминки — вход от страницы (rnd = Math.random показа, та же последовательность вызовов, что была): в расчёте ядра
// нет Math.random; DM.* — те же биты, что Math.* в Chromium / Node (engine/core/dmath.ts)
function warmPick(b, rnd){ var P = KNOW_POSITIONS.points; return P[Math.floor(rnd()*P.length)]; }
function warmSpawn(b, rnd){
  // (v311, владелец 14.10: «как в CS2 — возрождаются на спавне») на спавне своей стороны, с разбросом точек спавна
  var sp = b.team === "T" ? T_SPAWN : CT_SPAWN, a0 = rnd()*Math.PI*2, r0 = 20 + rnd()*60;
  var q = walk({x: sp.x + DM.cos(a0)*r0, y: sp.y + DM.sin(a0)*r0}) || sp;
  b.baseX = moveSetX(b, b.px = q.x); b.baseY = moveSetY(b, b.py = q.y); damageSetAlive(b, true); damageSetHp(b, 100); b._wPath = null; engagementSetSawEnemy(b, false); b._wRespawn = 0;
  equipmentSetPrimary(b, b.team === "T" ? "AK" : "M4"); equipmentSetWeapon(b, WEAPONS[b.primary] || b.weapon); shotSetAmmo(b, b.weapon.mag); reloadSetReloading(b, false); reloadSetAmmoFor(b, b.weapon.key);
  damageSetArmor(b, true); damageSetHelmet(b, true); damageSetArmorHp(b, 100); engagementSetTs(b, {}); engagementSetContactStreak(b, 0); damageSetBlindUntil(b, 0); shotSetNextShotTick(b, 0); bombActReset(b);
}
function warmTurn(b, a, maxA){
  if(b.facing === undefined){ b._visFacing = a; lookFace(b, a, "warm"); return; }
  var d = DM.wrapPi(a - b.facing);
  lookTurnBy(b, Math.max(-maxA, Math.min(maxA, d)), "warm"); b._visFacing = b.facing;
}
function warmStart(n, rnd){
  var hr = function(k){ return hashRand(n*7919 + k*131); };
  var mh = 12 + Math.floor(hr(1)*10), mm = hr(2) < 0.5 ? 0 : 30, len = 180 + Math.floor(hr(3)*300);   // матч в 12:00–21:30, разминка 3–8 мин
  freshMatch(n);
  // (v313) снимок матча до разминки: в разминке работает настоящая стрельба (знание, войс, память матча) — после неё матч
  // восстанавливается из снимка ровно таким, каким был бы без разминки
  var snap = (typeof mkSnapshot === "function") ? mkSnapshot() : null;
  WARM = {on:true, n:n, left:len, total:len, snap:snap, match:(mh<10?"0":"")+mh+":"+(mm?"30":"00")};
  roundState = "warmup"; killfeed = []; KF_DIRTY = true;   // (Р5, 27.11) киллфид рисует кадр; кнопку и прочий показ — warmShow (view/warmup.js) у вызывающего
  bots.forEach(function(b){ warmSpawn(b, rnd); });
  KF_DIRTY = true;
  logEvent("Разминка: матч в "+WARM.match+", до начала "+Math.round(len/60)+" мин", true);
}
// (Р5, 27.11) ответ: true — разминка кончилась (показ вызывающего: warmShow(false))
function warmEnd(){
  if(!WARM.on) return false;
  var n = WARM.n, snap = WARM.snap; WARM = {on:false};
  freshMatch(n); if(snap && typeof mkRestore === "function") mkRestore(snap);
  killfeed = []; voiceLines = []; clockPause(false);
  return true;
}
function warmTick(dt, rnd, foeOf){
  if(!WARM.on) return;
  WARM.left -= dt; if(WARM.left <= 0) return warmEnd();   // (Р5, 27.11) true — разминка кончилась
  clockSet(tick + 1);
  bots.forEach(function(b){
    b.px = b.x; b.py = b.y;
    if(!b.alive){ if(!b._wRespawn) b._wRespawn = tick + 2*TICK_HZ; if(tick >= b._wRespawn) warmSpawn(b, rnd); return; }
    // враг в поле зрения — стоп и стрельба
    // (Р5, 27.11) цель разминки выбирает страница (foeOf — view/warmup.js warmFoe, тот же поиск в том же месте тика): режим страницы
    // ведёт ботов разминки сам, это не решение бота в матче
    var F = foeOf(b), foe = F ? F.o : null, fd = F ? F.d : 700;
    if(foe){
      var a = DM.atan2(foe.y-b.y, foe.x-b.x);
      warmTurn(b, a, AIM_TURN_RATE*dt); engagementSetNearestEnemyBot(b, foe); b._wv = Math.max(0, (b._wv||0) - ACCEL*dt); moveSpeed(b, b._wv, "warm");   // (v312) доворот и торможение, а не щелчок
      // (v313, владелец 14.10: «в разминку такую же стрельбу») стрельба — та же, что в матче (tryShoot: реакция, разброс, отдача,
      // хитбоксы, урон, киллфид); разминка после себя всё сбрасывает (freshMatch), так что матч не меняется
      if(!b._sawEnemy){ engagementSetSawEnemy(b, true); engagementSetContactStreak(b, 0); }
      engagementSetContactStreak(b, (b.contactStreak||0) + 1);
      var TS = b._ts || (engagementSetTs(b, {})); engagementSetTargetTicks(TS, foe.id, (TS[foe.id]||0) + 1);
      tryShoot(b, foe, fd);
      return;
    }
    engagementSetSawEnemy(b, false);
    // бег к случайной позиции про
    if(!b._wPath || b._wIdx >= b._wPath.length){
      var q = warmPick(b, rnd), wp = buildWaypointPath(b.x, b.y, 0, q.x, q.y, 0);
      b._wPath = (wp && wp.length) ? wp : [[q.x, q.y, 0]]; b._wIdx = 0;
    }
    // (v312, владелец 14.10: «в разминке движения дёрганые») как в матче: разгон/торможение (ACCEL), направление движения
    // поворачивает не быстрее TURN-скорости (6 рад/с, дугой), взгляд доворачивает за ним (AIM_TURN_RATE)
    var t = b._wPath[b._wIdx], dx = t[0]-b.x, dy = t[1]-b.y, d = DM.hypot(dx, dy);
    if(d < 12 && b._wIdx < b._wPath.length - 1){ b._wIdx++; t = b._wPath[b._wIdx]; dx = t[0]-b.x; dy = t[1]-b.y; d = DM.hypot(dx, dy); }   // срезаем угол
    var want = DM.atan2(dy, dx); if(b.heading === undefined) moveSetHeading(b, want);
    var dh = DM.wrapPi(want - b.heading), mt = 6*dt;
    moveSetHeading(b, b.heading + (Math.max(-mt, Math.min(mt, dh))));
    var vT = SPEED * (Math.abs(dh) > 1.2 ? 0.45 : 1);
    b._wv = (b._wv||0) < vT ? Math.min(vT, (b._wv||0) + ACCEL*dt) : Math.max(vT, (b._wv||0) - ACCEL*dt);
    var st = b._wv*dt;
    if(d <= st && b._wIdx >= b._wPath.length - 1){ moveSetX(b, b.baseX = t[0]); moveSetY(b, b.baseY = t[1]); b._wIdx++; }
    else { var nx = b.x + DM.cos(b.heading)*st, ny = b.y + DM.sin(b.heading)*st;
      if(stepBlocked(b.x, b.y, nx, ny, b)){ nx = b.x + dx/(d||1)*st; ny = b.y + dy/(d||1)*st; moveSetHeading(b, want); }
      moveSetX(b, b.baseX = nx); moveSetY(b, b.baseY = ny); }
    warmTurn(b, b.heading, AIM_TURN_RATE*dt);
    moveSpeed(b, b._wv, "warm");
  });
}
// ---- песочница
// один тик песочницы (stepTick, раунд идёт): часы раунда и бомбы стоят
function sbTick(){
  roundStartTime += TICK_MS/1000;
  // приказ «иди сюда» (Shift + клик): держится, пока не дошёл — задача уровня выше всех (TASK_LEVEL, «приказ песочницы»)
  // (v552, отметка владельца 11.11 «бот T залез и сразу слез»: дошёл до точки приказа на ящике — приказ снимался, бот возвращался к задаче роли
  // (siteholdA:Stairs) и уходил) приказ держится и после того, как дошёл: стоит на точке, пока не дан новый приказ (или бот погиб)
  bots.forEach(function(b){ var G = b._sbGo; if(!G) return; if(!b.alive){ b._sbGo = null; return; }
    setPost(b, G, G.look || null, true, "sbGo"); });
  if(bomb && bomb.state === "planted" && bomb.explodeTick != null) bomb.explodeTick++;
}
// (v552, владелец 11.11: «ставлю боту точку на ящик, а у него уводит якорь») точка приказа — там, где клик, если там есть пол навмеша (верхний:
// на ящике — его крыша), с его высотой; нет пола — ближайшее проходимое, как раньше (snapToWalkable: ящик на плоской карте — сплошная стена,
// точку уводило к центру ближайшего участка)
function sbOrderPoint(x, y){
  if(!NAV_GRID) navGridBuild();
  var L = NAV_GRID[Math.floor(x/NAV_GRID_C)+","+Math.floor(y/NAV_GRID_C)] || [], top = null;
  for(var i = 0; i < L.length; i++){ var a = NAVAREAS[L[i]]; if(NAV_BLOCKED[a.id] || !pointInPoly(x, y, a.points)) continue; if(!top || a.z > top.z) top = a; }
  if(top) return {x: x, y: y, z: navFloorZ(top, x, y)};
  var g = snapToWalkable(x, y); return {x: g.x, y: g.y};
}
// поставить бота в точку (x, y): пол — ближайший участок навмеша, всё движение и задачи — заново
function sbPlace(b, x, y){
  var w = snapToWalkable(x, y), a = navFloorNear(w.x, w.y, 40, null) || navAt(w.x, w.y, b.z || 0);
  moveSetX(b, b.baseX = b.px = w.x); moveSetY(b, b.baseY = b.py = w.y);
  if(a){ navSetZ(b, navFloorZ(a, w.x, w.y)); navSetArea(b, a.id); }
  movePath(b, [], "sandbox", 0); navSetClimb(b, null); fightSetFc(b, null); moveSetHold(b, null); b._trail = []; moveSpeed(b, 0, "sandbox");
  b._underV = null; b._overV = null; navSetFall(b, null); floorViewTick(b);
}
function sbRevive(b, x, y){
  damageSetAlive(b, true); damageSetHp(b, 100); fightReset(b); clearPost(b); contactSetContact(b, null);
  engagementSetContactStreak(b, 0); engagementSetTs(b, {}); shotSetNextShotTick(b, 0); reloadSetReloading(b, false); soundSetBlind(b, null); damageSetBlindUntil(b, 0);
  sbPlace(b, x, y);
  logEvent("песочница: " + b.id + " в игре");
}
function sbRemove(b){ damageSetAlive(b, false); damageSetHp(b, 0); clearPost(b); fightSetFc(b, null); if(SANDBOX.drag === b) SANDBOX.drag = null; logEvent("песочница: " + b.id + " убран"); }
// ---- демо
function dvRounds(){ return (MAP.demorounds && MAP.demorounds.rounds) || []; }
function dvAt(s, t){ var T = DEMOV.R.players[s].track, lo = 0, hi = T.length - 1; if(t <= T[0][0]) return T[0]; if(t >= T[hi][0]) return T[hi];
  while(hi - lo > 1){ var m = (lo + hi) >> 1; if(T[m][0] <= t) lo = m; else hi = m; } var a = T[lo], c = T[hi], k = (t - a[0]) / Math.max(1, c[0] - a[0]);
  var dy = DM.wrapPi(c[4]-a[4]);
  return [t, a[1]+(c[1]-a[1])*k, a[2]+(c[2]-a[2])*k, a[3]+(c[3]-a[3])*k, a[4]+dy*k, a[5], a[6], a[7]]; }
// запуск раунда i: новый матч, закупка пропущена, игроки ↔ боты (сторона; совпал ник — тот, остальные по порядку), оружие из демки
function dvStart(i){
  var R = dvRounds()[i]; if(!R) return;
  DEMOV.on = false;
  if(WARM.on){ WARM = {on:false}; }   // кнопку прячет кадр (app, warmSkipSync)   // из разминки — сразу в раунд демки
  freshMatch(1); var guard = 0; while(roundState !== "live" && guard++ < 20000) stepTick();
  DEMOV.R = R; DEMOV.i = i; DEMOV.t0 = tick; DEMOV.ei = 0; DEMOV.BOT = {};
  var P = R.players, ids = Object.keys(P), used = {};
  ["T", "CT"].forEach(function(side){
    var dem = ids.filter(function(s){ return P[s].side === side; }), bs = bots.filter(function(x){ return x.team === side; });
    bs.forEach(function(x){ var n = String(nick(x.id)).toLowerCase(), m = dem.filter(function(s){ return !used[s] && P[s].name.toLowerCase() === n; })[0]; if(m){ DEMOV.BOT[m] = x; used[m] = 1; } });
    bs.forEach(function(x){ for(var k in DEMOV.BOT) if(DEMOV.BOT[k] === x) return; var m = dem.filter(function(s){ return !used[s]; })[0]; if(m){ DEMOV.BOT[m] = x; used[m] = 1; } }); });
  var wkey = {}; Object.keys(WEAPONS).forEach(function(k){ wkey[WEAPONS[k].name] = k; });
  Object.keys(DEMOV.BOT).forEach(function(s){ var x = DEMOV.BOT[s], pr = null, sc = null;
    P[s].track.forEach(function(r){ var k = wkey[r[7]]; if(!k) return; if(WEAPONS[k].slot === "secondary") sc = k; else pr = k; });
    equipmentSetPrimary(x, pr); if(sc) equipmentSetSecondary(x, sc); equipmentSetWeapon(x, WEAPONS[pr || x.secondary]); reloadSetAmmoFor(x, null); damageSetArmor(x, true); damageSetHelmet(x, true); x._dvName = P[s].name; });
  DEMOV.on = true; dvPlace(); clockPause(false);
  logEvent("раунд из демки: " + R.demo + " р" + R.num + " — игроки по демке, боты решают («тень»)");
}
function dvStop(){ DEMOV.on = false; bots.forEach(function(x){ x._dvName = null; }); logEvent("раунд из демки — выключен"); }
// каждый тик (stepTick, tick): события демки до этого момента, игроки — на места демки
function dvTick(){
  var R = DEMOV.R, t = tick - DEMOV.t0, B = DEMOV.BOT;
  if(t >= R.len){ DEMOV.on = false; clockPause(true); logEvent("раунд из демки кончился"); return; }   // панель — по таймеру показа (view/demo.js, 300 мс)
  while(DEMOV.ei < R.ev.length && R.ev[DEMOV.ei][1] <= t){ var e = R.ev[DEMOV.ei++], A = B[e[2]];
    if(e[0] === "shot" && A && A.alive){ shotSetLastShotTick(A, tick); dvHearShot(A); }
    else if(e[0] === "hurt" && A && B[e[3]] && B[e[3]].alive){ var V = B[e[3]]; knowHear(V, {x: A.x, y: A.y, tick: tick, team: A.team, src: A.id, kind: "hit"}); V._shotAtT = tick; V._shotAtBy = A; }
    else if(e[0] === "death" && B[e[3]] && B[e[3]].alive){ DEMOV.allow = true; applyDamage(A || B[e[3]], B[e[3]], 999, "bullet", {}); DEMOV.allow = false; }
    else if(e[0] === "nade" && e[3] === "smoke") smokes.push({x: e[4], y: e[5], born: tick, until: tick + NADE.smoke.life, team: A ? A.team : "T"});
    else if(e[0] === "plant"){ bomb.state = "planted"; bomb.x = e[3]; bomb.y = e[4]; bomb.carrier = null; bomb.plantTick = tick; bomb.explodeTick = tick + BOMB_TICKS; bomb.site = R.site; }
    else if(e[0] === "defused"){ bomb.state = "defused"; }
  }
  dvPlace();
}
function dvPlace(){ var t = tick - DEMOV.t0;
  Object.keys(DEMOV.BOT).forEach(function(s){ var x = DEMOV.BOT[s]; if(!x.alive) return; var q = dvAt(s, t), q1 = dvAt(s, t - 8);
    moveSetX(x, x.baseX = x.px = q[1]); moveSetY(x, x.baseY = x.py = q[2]); lookFace(x, q[4], "demo"); moveSpeed(x, DM.hypot(q[1]-q1[1], q[2]-q1[2]) / (8/TICK_HZ), "demo"); if(q[6] > 0) damageSetHp(x, q[6]); }); }
// выстрел демки слышат враги — как в игре (shoot: слышимость по прямой / сквозь стены, место — с ошибкой hearPos)
function dvHearShot(sh){ bots.forEach(function(o){ if(!o.alive || o.team === sh.team) return; var dG = DM.hypot(o.x-sh.x, o.y-sh.y);
  var hearR = hasLOS(o.x, o.y, sh.x, sh.y, o.z, sh.z) ? GUN_HEAR_OPEN : GUN_HEAR_WALL; if(dG >= hearR) return;
  var hp = hearPos(o, sh.x, sh.y, tick*17 + o.id.charCodeAt(0)*7, hearR === GUN_HEAR_WALL);
  knowHear(o, {x: hp ? hp.x : sh.x, y: hp ? hp.y : sh.y, tick: tick, team: sh.team, src: sh.id, kind: "shots"}); }); }
// ---- песочница: команды показа (панель, мышь) — (Р5, 27.11) были прямыми записями в обработчиках view/sandbox.js
// включение / выключение (sbToggle): расчётная часть; кнопку, панель и рисунок обновляет показ
// ответ: true — заодно кончилась разминка (показ: warmShow(false))
function sbSwitch(){
  var we = false;
  // (v539, владелец 10.11: «нажимаю песочницу — сразу игра с физикой обычного матча, не разминки, и не ждать закупку») включение: разминка
  // кончается (матч — как после неё, warmEnd), раунд между раундами — новый, закупка (freeze) пропускается — раунд идёт сразу
  if(!SANDBOX.on){
    if(typeof WARM !== "undefined" && WARM.on) we = warmEnd();   // до включения: warmEnd восстанавливает снимок матча (там песочница выключена)
    if(roundState === "ending") resetRound();
    if(roundState === "freeze"){ roundStartTime = simTime; roundStartTick = tick; }
  }
  SANDBOX.on = !SANDBOX.on;
  if(!SANDBOX.on){ bots.forEach(function(b){ b._sbOff = false; }); SANDBOX.drag = null; SANDBOX.place = null; }
  logEvent("песочница " + (SANDBOX.on ? "включена — раунд не кончается" : "выключена"));
  return we;
}
// ИИ вкл / выкл (off: true / false; null — переключить) у списка ботов
function sbAi(L, off){ L.forEach(function(b){ b._sbOff = off === null ? !b._sbOff : off; }); }
// (v544) ход: сам → шагом → бегом → сам
function sbWalkNext(b){ b._sbWalk = b._sbWalk == null ? "walk" : b._sbWalk === "walk" ? "run" : null; }
// приказ «иди сюда» (Shift + клик): точка — sbOrderPoint; ИИ не трогаем (v538)
function sbOrder(b, g){ b._sbGo = g; }
// ---- повтор клатча (перенесено из view/replay.js, view/replay-play.js, Р5 27.11)
// (v463) мир тика для кадра повтора: то, что читает draw (draw) — поля игроков, дым, огонь, гранаты, эффекты, бомба, вещи на земле
var RP_BF = ["x","y","z","alive","hp","crouching","facing","_visFacing","_reloading","reloadUntil","weapon","_underV","_overV","_jump","blindUntil","state","tRole",
  "_knife","planting","defusing","plantUntil","defuseUntil","kit","onStairs","walking","_killHow","_sawEnemy","curSpeed","_idle","_idlePhase","holding","atPost"];
function rpCl(o){ var c = {}; for(var k in o){ var v = o[k]; c[k] = Array.isArray(v) ? v.slice() : v; } return c; }
function rpSetBotField(bot, field, value){
  switch(field){
    case "x": return moveSetX(bot, value);
    case "y": return moveSetY(bot, value);
    case "z": return navSetZ(bot, value);
    case "alive": return damageSetAlive(bot, value);
    case "hp": return damageSetHp(bot, value);
    case "_reloading": return reloadSetReloading(bot, value);
    case "reloadUntil": return reloadSetReloadUntil(bot, value);
    case "weapon": return equipmentSetWeapon(bot, value);
    case "_jump": return jumpSetJump(bot, value);
    case "blindUntil": return damageSetBlindUntil(bot, value);
    case "_knife": return equipmentSetKnife(bot, value);
    case "kit": return equipmentSetKit(bot, value);
    case "onStairs": return moveSetOnStairs(bot, value);
    case "_sawEnemy": return engagementSetSawEnemy(bot, value);
    case "atPost": return taskSetAtPost(bot, value);
    case "crouching": case "facing": case "_visFacing": case "_underV": case "_overV": case "state": case "tRole":
    case "planting": case "defusing": case "plantUntil": case "defuseUntil": case "walking": case "_killHow":
    case "curSpeed": case "_idle": case "_idlePhase": case "holding": bot[field] = value;
    default:
  }
}
// ---- повтор клатча: кадр записанного мира (Р5, 27.11; было — прямые записи в view/replay-play.js rpWorldDraw). Мир записи кладётся в
// игру на время show() и возвращается целиком (поле, которого у бота не было, удаляется), даже если рисунок упал. A, B — кадры записи
// (B — для полей RP_BF), f — доля тика, gw / gi — предметы на земле записи, tl — трассеры, pf — взгляд игроков записи для рисунка (как его видит показ)
function rpWorldWith(R, A, B, f, gw, gi, tl, pf, show){
  var keep = {tick: tick, simTime: simTime, roundNum: roundNum, roundState: roundState, accumulator: accumulator, smokes: smokes, fires: fires, nadesInAir: nadesInAir,
    nadeFx: nadeFx, bomb: bomb, tracers: tracers, soundPings: soundPings, groundWeapons: groundWeapons, groundItems: groundItems, teamTac: teamTac,
    FREEZE_FX: FREEZE_FX, SIDE_TEAM: SIDE_TEAM, NICKS: NICKS};
  // (Р5, 27.11) поле, которого у бота не было, после кадра повтора удаляется (было: появлялось со значением undefined — форма объекта игры менялась
  // от рисования повтора; tools/page/ui_state_check.js: plantUntil / defuseUntil / _killHow после повтора клатча)
  var saved = bots.map(function(o){ var c = {px: o.px, py: o.py, pfacing: o.pfacing, path: o.path, _trail: o._trail, __has: {}}; RP_BF.forEach(function(k){ c[k] = o[k]; c.__has[k] = Object.prototype.hasOwnProperty.call(o, k); }); return c; });
  try{
    clockSet(A.tick); simTime = tick*TICK_MS/1000; roundNum = R.round; roundState = "live"; clockAcc(f*TICK_MS);
    nadeWorldSet(A.sm, A.fi, A.nd, A.fx); groundWeapons = gw || []; groundItems = gi || [];
    bomb = A.bomb ? rpCl(A.bomb) : null; if(bomb) bomb.carrier = A.bc >= 0 ? bots[A.bc] : null;
    tracers = tl; soundPings = []; teamTac = {T: null, CT: keep.teamTac && keep.teamTac.CT}; FREEZE_FX = [];
    if(R.side){ SIDE_TEAM = R.side; } if(R.NK){ NICKS = R.NK; }
    bots.forEach(function(o, i){ var a = A.b[i], b2 = B.b[i]; RP_BF.forEach(function(k){ rpSetBotField(o, k, b2[k]); });
      o.px = a.x; o.py = a.y; o.pfacing = pf[i]; movePath(o, null, "replay"); o._trail = []; });
    show();
  } catch(e){ /* кадр повтора не нарисовался — дальше игра не страдает: всё возвращается ниже */ }
  finally {
    bots.forEach(function(o, i){ var c = saved[i]; RP_BF.forEach(function(k){ if(c.__has[k]) rpSetBotField(o, k, c[k]); else delete o[k]; }); o.px = c.px; o.py = c.py; o.pfacing = c.pfacing; movePath(o, c.path, "replay"); o._trail = c._trail; });
    clockSet(keep.tick); simTime = keep.simTime; roundNum = keep.roundNum; roundState = keep.roundState; clockAcc(keep.accumulator);
    nadeWorldSet(keep.smokes, keep.fires, keep.nadesInAir, keep.nadeFx); bomb = keep.bomb; tracers = keep.tracers; soundPings = keep.soundPings;
    groundWeapons = keep.groundWeapons; groundItems = keep.groundItems; teamTac = keep.teamTac; FREEZE_FX = keep.FREEZE_FX; SIDE_TEAM = keep.SIDE_TEAM; NICKS = keep.NICKS;
  }
}
