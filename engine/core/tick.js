// [хозяева: —] ---------- fixed-tick sim ----------
var TICK_HZ = 64;
var TICK_MS = 1000/TICK_HZ;
var tick = 0;

var paused = false;
var accumulator = 0;
var lastFrame = null;
// (17.11, перестройка — модули) ЧАСЫ игры — у главного цикла: пауза, тик, накопитель кадра, время кадра пишут только эти функции
// (сброс матча 530, разминка 660, повтор 675, демо 678, кадр и кнопки 680 — через них; импорт модуля только для чтения)
function clockPause(on){ paused = on; }
function clockSet(t){ tick = t; }
function clockTick(){ tick++; }
function clockAcc(v){ accumulator = v; }
function clockFrameDt(ts){ if(lastFrame===null) lastFrame = ts; var dt = ts - lastFrame; lastFrame = ts; return dt; }
roundSetState(BAL.freeze > 0 ? "freeze" : "live");
roundSetStart(BAL.freeze, Math.round(BAL.freeze*TICK_HZ));
buyPhase(); // закуп первого (пистолетного) раунда — после объявления simTime (logEvent его использует); (v428) тактика выбирается в нём
resetBomb();
beliefBuild(); beliefReset(); // раздел 13: карта вероятностей врага

// (v322, М14) свободный обзор в закупку — канал взгляда (turn.ts, freezeLookTick)

// (v322) звук движения — шаги, вода, прыжок (одно место «кто из врагов услышал»): через стену слышно ближе (~75 % радиуса),
// место — пятно, а не точка (hearPos), в уши — hearReal
function moveSoundEmit(bot, soundRadius, kind, label){
  bots.forEach(function(listener){
    if(listener===bot || !listener.alive || listener.team===bot.team) return;
    var dHear = DM.hypot(listener.x-bot.x, listener.y-bot.y);
    if(dHear > soundRadius) return;
    var occS = !hasLOS(listener.x, listener.y, bot.x, bot.y, listener.z, bot.z);
    if(occS && dHear > soundRadius*0.75) return;
    var wasStale = !listener.heardSound || (tick - listener.heardSound.tick) > 90;
    var seed = tick*331 + bot.id.charCodeAt(0)*17 + listener.id.charCodeAt(0)*11 + bot.lastStepTick;
    var jitterMag = 20 + dHear*0.12, jang = hashRand(seed) * Math.PI*2;
    var hpF = hearPos(listener, bot.x, bot.y, seed, occS);
    knowHear(listener, hpF ? {x:hpF.x, y:hpF.y, tick:tick, team:bot.team, src:bot.id, kind:kind, occl:occS}
                              : {x:bot.x+DM.cos(jang)*jitterMag, y:bot.y+DM.sin(jang)*jitterMag, tick:tick, team:bot.team, src:bot.id, kind:"steps", occl:occS}, label);
    if(wasStale) logEvent(listener.id+" услышал "+label+" ("+bot.team+")"+(occS ? " за стеной" : ""));
  });
}
// (v323, М39, владелец) подход к дефузу шифтом. Демки Mirage (196 дефузов, скорость за 1,5 с до начала дефуза): был ближе
// 150 ед. игры (60 ед. карты) — шагом 77 %, 150–300 (60–120) — 34 %, дальше — всегда бегом. Шагом — только если успевает дойти
// и дефузнуть (запас 1,5 с). Кто идёт шагом в этом раунде — жребий на раунд и бота (решение не дёргается каждый тик)
function defuseWalk(bot){
  if(!(bomb && bomb.state === "planted" && bot.team === "CT" && bot.post && taskProp(bot.post.tag, "defuseTask"))) return false;
  var d = DM.hypot(bomb.x-bot.baseX, bomb.y-bot.baseY); if(d >= 120) return false;
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
      var t = Math.max(0, Math.min(1, ((bot.baseX-p.x)*ex + (bot.baseY-p.y)*ey)/L2)), px = p.x+ex*t, py = p.y+ey*t, d = DM.hypot(px-bot.baseX, py-bot.baseY);
      if(d < nbd){ var cx = 0, cy = 0; a.points.forEach(function(r){ cx += r.x; cy += r.y; }); cx /= a.points.length; cy /= a.points.length;
        nbd = d; nb = {x: px + (cx-px)*0.15, y: py + (cy-py)*0.15, a: a}; } }); });
  if(nb){ bot.baseX = bot.x = nb.x; bot.baseY = bot.y = nb.y; bot.z = nb.a.z; bot._area = nb.a.id; bot.path = []; bot.pathIdx = 0; bot._offNav = 0; logEvent(bot.id+": вне навмеша — перенесён на ближайший пол (заплатка)"); }
}
