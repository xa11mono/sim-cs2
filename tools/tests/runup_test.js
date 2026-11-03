// (физика гранат: разбег) Лайнапы с эталоном разбега (MAP.runups; типы — window.RUNUP_TYPES, по умолчанию все) — бросок в игре: бот у точки лайнапа получает задание, игра идёт
// тиками до срабатывания смока. node src/q.js sim.html @tools/tests/runup_test.js → JSON: на лайнап — с разбега ли (на ходу), время полёта (с),
// промах (px радара от цели), время от задания до броска (с); итог: доля с разбега, медианы. Все живы (как в начале раунда).
(function(){
  function live(){ freshMatch(1); if(typeof WARM !== "undefined") WARM.on = false; for(var g = 0; g < 200000 && !(roundState === "live"); g++) stepTick(); }

  var L = (MAP.lineups.pro || []).concat(MAP.lineups.proExtra || []).filter(function(l){ return MAP.runups && MAP.runups[l.id] && (!window.RUNUP_TYPES || window.RUNUP_TYPES.indexOf(l.type) >= 0); });
  var out = [], cur = null;
  var odt = detonate; detonate = function(n){ if(cur && n.thrower === cur.b && n.type === cur.L.type && n.why === "тест разбега" && cur.det == null){ cur.det = tick; cur.flight = (tick - n.born)/TICK_HZ;
    cur.err = Math.round(Math.hypot(n.x - cur.L.to.x, n.y - cur.L.to.y)); cur.moving = !!(n.vel0 && Math.hypot(n.vel0[0], n.vel0[1]) > 20); cur.v = n.vel0 ? Math.round(Math.hypot(n.vel0[0], n.vel0[1])) : 0; cur.thrown = n.born; cur.plan = Math.round(Math.hypot(n.plan[0] - cur.L.to.x, n.plan[1] - cur.L.to.y)); } return odt.apply(this, arguments); };
  // смок на крыше (промах исполнения) не срабатывает — detonate не зовётся (400: nadeOnRoof); брошен — засчитывается с roof
  var otn = throwNade; throwNade = function(bb){ var r = otn.apply(this, arguments), n = nadesInAir[nadesInAir.length-1];
    if(cur && bb === cur.b && r !== false && n && n.thrower === bb && n.why === "тест разбега") cur.nd = n; return r; };
  L.forEach(function(l){
    live();   // каждая сцена — с начала раунда нового матча: прошлая сцена оставляет задачи, бой, конец раунда
    roundStartTime = simTime; roundStartTick = tick;   // раунд не кончается по времени, пока идёт сцена
    var car = bomb && bomb.carrier && bomb.carrier.team === l.team ? bomb.carrier : null;
    var b = bots.filter(function(o){ return o.team === l.team && o !== car; })[0];
    bots.forEach(function(o){ if(!o.alive){ o.post = null; o.atPost = false; o._task = null; o.path = []; o.state = "patrol"; } o.alive = true; o.hp = 100; });   // все живы: 1 на 1 — клатч (его задача важнее гранаты), один в команде — эндгейм
    b.x = b.baseX = l.from.x; b.y = b.baseY = l.from.y; var na = navAt(b.x, b.y, null); if(na) b.z = na.z;
    b.nades = emptyNades(); b.nades[l.type] = 1; b._nadeT = null; clearPost(b); b.atPost = false; b.path = []; b.pathIdx = 0; b.state = "patrol"; b.hp = 100;
    nadesInAir.length = 0; smokes.length = 0;
    b.nadeTask = {type: l.type, x: l.to.x, y: l.to.y, from: {x: l.from.x, y: l.from.y}, until: tick + 20*TICK_HZ, why: "тест разбега", start: tick, lob: true, range: 4000, now: true, lineup: true, luId: l.id};
    cur = {L: l, b: b, t0: tick, det: null}; var tk = b.nadeTask, ph = {};
    var e = null;
    try { for(var i = 0; i < 25*TICK_HZ && cur.det == null; i++){ stepTick(); ph[tk.runPh || (tk.runFail ? "fail" : "-")] = 1; if(!b.alive || roundState !== "live") break; } } catch(x){ e = String(x) + " @ " + String(x.stack).split("\n").slice(1, 3).join(" | ").replace(/file:[^ ]*html:/g, ""); }
    if(cur.det == null && cur.nd && cur.nd.onRoof){ var n = cur.nd; cur.flight = (n.etaDet - n.born)/TICK_HZ; cur.roof = true; cur.thrown = n.born;
      cur.err = Math.round(Math.hypot(n.x - l.to.x, n.y - l.to.y)); cur.moving = !!(n.vel0 && Math.hypot(n.vel0[0], n.vel0[1]) > 20); cur.plan = Math.round(Math.hypot(n.plan[0] - l.to.x, n.plan[1] - l.to.y)); }
    out.push({id: l.id, type: l.type, roof: !!cur.roof, name: (l.name || "").slice(0, 32), moving: cur.moving || false, flight: cur.flight != null ? +cur.flight.toFixed(2) : null, err: cur.err,
              toThrow: cur.thrown != null ? +((cur.thrown - cur.t0)/TICK_HZ).toFixed(1) : null, bake: MAP.runups[l.id].t, stand: MAP.runups[l.id].standT, plan: cur.plan, v: cur.v, vBake: MAP.runups[l.id].speed, error: e, phases: Object.keys(ph).join(","), noStart: !!tk.runFail && !tk.runStart, alive: b.alive, state: roundState});
  });
  var done = out.filter(function(o){ return o.flight != null; }), mv = done.filter(function(o){ return o.moving; });
  var med = function(a){ a = a.slice().sort(function(x, y){ return x - y; }); return a.length ? a[a.length >> 1] : null; };
  return JSON.stringify({n: out.length, thrown: done.length, onTheMove: mv.length, medFlightMove: med(mv.map(function(o){ return o.flight; })),
    medErrMove: med(mv.map(function(o){ return o.err; })), medPlanMove: med(mv.map(function(o){ return o.plan; })), medFlightAll: med(done.map(function(o){ return o.flight; })), errors: out.filter(function(o){ return o.error; }).length, list: out});
})()
