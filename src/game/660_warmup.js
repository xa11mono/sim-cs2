// ======================= (v306) РАЗМИНКА перед матчем — только показ, на матч не влияет =======================
// Как в CS2: сервер запущен заранее, матч — по расписанию (например, 11:30, сервер с 11:25 → 5 мин разминки игрового времени;
// сколько — случайно, 3–8 мин, по номеру матча). Все бегают по карте между позициями про (KNOW_POSITIONS), стреляются, убитый
// возрождается через 2 с на своей половине; бомбы, раундов, экономики и войса нет. Конец (или «Начать матч») — freshMatch(n):
// матч идёт точно так же, как без разминки (номер матча по-прежнему повторяет игру). Числа — проектные (это показ)
var WARM = {on:false};
function warmPick(b){ var P = KNOW_POSITIONS.points; return P[Math.floor(Math.random()*P.length)]; }
function warmSpawn(b){
  // (v311, владелец 14.10: «как в CS2 — возрождаются на спавне») на спавне своей стороны, с разбросом точек спавна
  var sp = b.team === "T" ? T_SPAWN : CT_SPAWN, a0 = Math.random()*Math.PI*2, r0 = 20 + Math.random()*60;
  var q = walk({x: sp.x + Math.cos(a0)*r0, y: sp.y + Math.sin(a0)*r0}) || sp;
  b.baseX = b.x = b.px = q.x; b.baseY = b.y = b.py = q.y; b.alive = true; b.hp = 100; b._wPath = null; b._sawEnemy = false; b._wRespawn = 0;
  b.primary = b.team === "T" ? "AK" : "M4"; b.weapon = WEAPONS[b.primary] || b.weapon; b.ammo = b.weapon.mag; b._reloading = false; b._ammoFor = b.weapon.key;
  b.armor = true; b.helmet = true; b.armorHp = 100; b._ts = {}; b.contactStreak = 0; b.blindUntil = 0; b.nextShotTick = 0; b.planting = b.defusing = false;
}
function warmTurn(b, a, maxA){
  if(b.facing === undefined){ b.facing = b._visFacing = a; return; }
  var d = ((a - b.facing + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI;
  b.facing += Math.max(-maxA, Math.min(maxA, d)); b._visFacing = b.facing;
}
function warmStart(n){
  var hr = function(k){ return hashRand(n*7919 + k*131); };
  var mh = 12 + Math.floor(hr(1)*10), mm = hr(2) < 0.5 ? 0 : 30, len = 180 + Math.floor(hr(3)*300);   // матч в 12:00–21:30, разминка 3–8 мин
  freshMatch(n);
  // (v313) снимок матча до разминки: в разминке работает настоящая стрельба (знание, войс, память матча) — после неё матч
  // восстанавливается из снимка ровно таким, каким был бы без разминки
  var snap = (typeof mkSnapshot === "function") ? mkSnapshot() : null;
  WARM = {on:true, n:n, left:len, total:len, snap:snap, match:(mh<10?"0":"")+mh+":"+(mm?"30":"00")};
  roundState = "warmup"; killfeed = []; if(typeof renderFeed === "function") renderFeed();
  bots.forEach(warmSpawn);
  var sk = document.getElementById("btnWarmSkip"); if(sk) sk.style.display = "";
  logEvent("Разминка: матч в "+WARM.match+", до начала "+Math.round(len/60)+" мин", true);
}
function warmEnd(){
  if(!WARM.on) return;
  var n = WARM.n, snap = WARM.snap; WARM = {on:false};
  var sk = document.getElementById("btnWarmSkip"); if(sk) sk.style.display = "none";
  freshMatch(n); if(snap && typeof mkRestore === "function") mkRestore(snap);
  killfeed = []; renderFeed(); voiceLines = []; if(typeof renderVoice === "function") renderVoice(); paused = false;
}
function warmTick(dt){
  if(!WARM.on) return;
  WARM.left -= dt; if(WARM.left <= 0){ warmEnd(); return; }
  tick++;
  bots.forEach(function(b){
    b.px = b.x; b.py = b.y;
    if(!b.alive){ if(!b._wRespawn) b._wRespawn = tick + 2*TICK_HZ; if(tick >= b._wRespawn) warmSpawn(b); return; }
    // враг в поле зрения — стоп и стрельба
    var foe = null, fd = 700;
    bots.forEach(function(o){ if(o.alive && o.team !== b.team){ var d = Math.hypot(o.x-b.x, o.y-b.y); if(d < fd && hasLOS(b.x, b.y, o.x, o.y)){ fd = d; foe = o; } } });
    if(foe){
      var a = Math.atan2(foe.y-b.y, foe.x-b.x);
      warmTurn(b, a, AIM_TURN_RATE*dt); b._nearestEnemyBot = foe; b._wv = Math.max(0, (b._wv||0) - ACCEL*dt); b.curSpeed = b._wv;   // (v312) доворот и торможение, а не щелчок
      // (v313, владелец 14.10: «в разминку такую же стрельбу») стрельба — та же, что в матче (tryShoot: реакция, разброс, отдача,
      // хитбоксы, урон, киллфид); разминка после себя всё сбрасывает (freshMatch), так что матч не меняется
      if(!b._sawEnemy){ b._sawEnemy = true; b.contactStreak = 0; }
      b.contactStreak = (b.contactStreak||0) + 1;
      var TS = b._ts || (b._ts = {}); TS[foe.id] = (TS[foe.id]||0) + 1;
      tryShoot(b, foe, fd);
      return;
    }
    b._sawEnemy = false;
    // бег к случайной позиции про
    if(!b._wPath || b._wIdx >= b._wPath.length){
      var q = warmPick(b), wp = buildWaypointPath(b.x, b.y, 0, q.x, q.y, 0);
      b._wPath = (wp && wp.length) ? wp : [[q.x, q.y, 0]]; b._wIdx = 0;
    }
    // (v312, владелец 14.10: «в разминке движения дёрганые») как в матче: разгон/торможение (ACCEL), направление движения
    // поворачивает не быстрее TURN-скорости (6 рад/с, дугой), взгляд доворачивает за ним (AIM_TURN_RATE)
    var t = b._wPath[b._wIdx], dx = t[0]-b.x, dy = t[1]-b.y, d = Math.hypot(dx, dy);
    if(d < 12 && b._wIdx < b._wPath.length - 1){ b._wIdx++; t = b._wPath[b._wIdx]; dx = t[0]-b.x; dy = t[1]-b.y; d = Math.hypot(dx, dy); }   // срезаем угол
    var want = Math.atan2(dy, dx); if(b.heading === undefined) b.heading = want;
    var dh = ((want - b.heading + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI, mt = 6*dt;
    b.heading += Math.max(-mt, Math.min(mt, dh));
    var vT = SPEED * (Math.abs(dh) > 1.2 ? 0.45 : 1);
    b._wv = (b._wv||0) < vT ? Math.min(vT, (b._wv||0) + ACCEL*dt) : Math.max(vT, (b._wv||0) - ACCEL*dt);
    var st = b._wv*dt;
    if(d <= st && b._wIdx >= b._wPath.length - 1){ b.x = b.baseX = t[0]; b.y = b.baseY = t[1]; b._wIdx++; }
    else { var nx = b.x + Math.cos(b.heading)*st, ny = b.y + Math.sin(b.heading)*st;
      if(stepBlocked(b.x, b.y, nx, ny, b)){ nx = b.x + dx/(d||1)*st; ny = b.y + dy/(d||1)*st; b.heading = want; }
      b.x = b.baseX = nx; b.y = b.baseY = ny; }
    warmTurn(b, b.heading, AIM_TURN_RATE*dt);
    b.curSpeed = b._wv;
  });
}
