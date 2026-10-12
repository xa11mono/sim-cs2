// Сценарии этапа 3: node src/q.js <сборка.html> "$(cat tools/measure/audit/scenarios3.js)" → JSON {сценарий: {ok, ...}}
// Сценарий засчитывается, только если нужное событие действительно произошло (поле valid).
(function(){
  var R = {};
  function bot(id){ return bots.filter(function(b){ return b.id === id; })[0]; }

  // P1-4 (г): путь через свой молотов. Матч 3, тик 23300: T1 (siteholdA) идёт к точке, путь лежит сквозь молотов T2 (поджог 23096,
  // гаснет 23544). Раньше: 1,5 с у края, затем «рывок от застревания» на 33 px — в огонь (13 HP). Должен: не заходить, не застрять навсегда
  try {
    freshMatch(3); while(tick < 23300) stepTick();
    var b = bot("T1"), f = fires.filter(function(q){ return q.thrower && q.thrower.id === "T2"; })[0], x0 = b.x, y0 = b.y, inF = 0, moved = null, hp0 = b.hp;
    var valid = !!f && Math.hypot(b.x-f.x, b.y-f.y) < NADE.molly.radius + 60;
    for(var i = 0; i < 900 && b.alive; i++){ stepTick(); if(inFire(b.x, b.y)) inF++; if(moved === null && Math.hypot(b.x-x0, b.y-y0) > 40) moved = tick; }
    R.molly_path_through_own_fire = {ok: valid && inF === 0 && moved !== null && moved <= f.until + 2*TICK_HZ, valid: valid, ticksInFire: inF, movedAt: moved, fireUntil: f ? f.until : null, hpLost: hp0 - b.hp};
  } catch(e){ R.molly_path_through_own_fire = {ok: false, err: String(e).slice(0, 200)}; }

  return JSON.stringify(R);
})()
