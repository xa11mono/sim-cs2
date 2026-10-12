// Сценарии этапа 4: node src/q.js <сборка.html> "$(cat tools/measure/audit/scenarios4.js)" → JSON {сценарий: {ok, valid, ...}}
// Засчитывается, только если нужное событие действительно случилось (valid).
(function(){
  var R = {};
  function bot(id){ return bots.filter(function(b){ return b.id === id; })[0]; }
  function live(m){ freshMatch(m || 3); for(var i = 0; i < 5000 && roundState !== "live"; i++) stepTick(); for(var j = 0; j < 64; j++) stepTick(); }
  function park(keep){ bots.forEach(function(o){ if(keep.indexOf(o) >= 0) return; o.x = o.baseX = (o.team === "CT" ? CT_SPAWN.x : T_SPAWN.x); o.y = o.baseY = (o.team === "CT" ? CT_SPAWN.y : T_SPAWN.y); }); }
  function put(o, p){ o.x = o.baseX = p.x; o.y = o.baseY = p.y; o.px = p.x; o.py = p.y; o.curSpeed = 0; }
  function openSpot(minR){   // точка, от которой влево и вправо на minR px нет стен (бросок по прямой не отскочит)
    for(var k = 0; k < 6000; k++){
      var z = NAVAREAS[Math.floor(hashRand(k*7+3)*NAVAREAS.length)], c = zoneCentroid(z), ok = !insideSolidWall(c.x, c.y) && bzOf(c.x, c.y) >= 0;
      for(var a = 0; a < 2 && ok; a++){ var q = {x: c.x + (a ? -minR : minR), y: c.y}; if(insideSolidWall(q.x, q.y) || crossesWall(c.x, c.y, q.x, q.y)) ok = false; }
      if(ok) return c;
    }
    throw new Error("нет открытого места");
  }

  // P1 (молотов) (а): бросающий не кидает молотов себе под ноги. Прямой бросок в точку в 79 px (как опорник CT «задержать
  // выход», матч 41, тик 6073): огонь вспыхивает на ~27 px ближе цели, т. е. в ~52 px — внутри радиуса 72. Должен не бросить.
  // Контроль: тот же бросок в 220 px — бросает, и огонь не под ним.
  try {
    live(3); var th = bot("CT0"), p = openSpot(260); park([th]); put(th, p); th.nades.molly = 2;
    var r1 = throwNade(th, "molly", p.x + 79, p.y, false, "тест: под ноги");
    var fire1 = null; for(var i = 0; i < 120 && !fire1; i++){ stepTick(); put(th, p); fire1 = fires.filter(function(f){ return f.thrower === th; })[0] || null; }
    var r2 = throwNade(th, "molly", p.x - 220, p.y, false, "тест: далеко");
    var fire2 = null; for(var j = 0; j < 160 && !fire2; j++){ stepTick(); put(th, p); fire2 = fires.filter(function(f){ return f.thrower === th && f !== fire1; })[0] || null; }
    var d1 = fire1 ? Math.round(Math.hypot(fire1.x-p.x, fire1.y-p.y)) : null, d2 = fire2 ? Math.round(Math.hypot(fire2.x-p.x, fire2.y-p.y)) : null;
    R.molly_thrower_not_at_feet = {ok: r1 === false && !fire1 && r2 !== false && !!fire2 && d2 >= NADE.molly.radius, valid: r2 !== false && !!fire2,
      nearThrow: r1 !== false, nearFireDist: d1, farFireDist: d2, radius: NADE.molly.radius};
  } catch(e){ R.molly_thrower_not_at_feet = {ok: false, err: String(e).slice(0, 200)}; }

  // (б): тиммейт стоит там, куда молотов реально упадёт (на 27 px ближе цели), хотя сама цель от него дальше радиуса —
  // бросок не должен состояться. Раньше проверялась только точка цели.
  try {
    live(3); var th2 = bot("CT1"), mt = bot("CT2"), p2 = openSpot(300); park([th2, mt]); put(th2, p2); th2.nades.molly = 1;
    var tgt = {x: p2.x + 200, y: p2.y}, land = {x: p2.x + 200 - 70/TICK_HZ/(1-0.96), y: p2.y};
    put(mt, {x: land.x - 50, y: land.y});   // до точки падения 50 (< 72), до цели 77 (> 72)
    var dT = Math.round(Math.hypot(mt.x-tgt.x, mt.y-tgt.y)), dL = Math.round(Math.hypot(mt.x-land.x, mt.y-land.y));
    var r3 = throwNade(th2, "molly", tgt.x, tgt.y, false, "тест: тиммейт у точки падения");
    var hit = 0; for(var k = 0; k < 200; k++){ stepTick(); put(th2, p2); put(mt, {x: land.x - 50, y: land.y}); if(inFire(mt.x, mt.y)) hit++; }
    R.molly_mate_at_real_landing = {ok: r3 === false && hit === 0, valid: dT > NADE.molly.radius && dL < NADE.molly.radius, thrown: r3 !== false, mateTicksInFire: hit, mateToTarget: dT, mateToLanding: dL};
  } catch(e){ R.molly_mate_at_real_landing = {ok: false, err: String(e).slice(0, 200)}; }

  return JSON.stringify(R);
})()
