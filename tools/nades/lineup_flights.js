// Полёт каждого лайнапа набора карты (MAP.lineups.pro + proExtra) через ТЕКУЩИЙ бросок и полёт игры — без матча.
// node src/q.js sim.html @tools/nades/lineup_flights.js > out.json   (сборка карты — python3 src/build.py --map <карта> <файл>)
// Один и тот же вход для любой версии физики: бот встаёт в from лайнапа, throwNade(…, lob, trusted) в to; дальше — только
// nadesTick (боты стоят), пока граната не сработает. Разброс исполнения выключен (BAL.lobErr = 0, execErr off), tick перед
// броском = 1000 + 7 × номер — прогон детерминирован. На лайнап: конец (x, y радара, z — если физика знает), тики полёта, как кончилась
// (det — сработала, roof — эвристика «упала на крышу», fail — бросок не состоялся + причина), касания (по порядку, если есть).
(function(){
  freshMatch(1); roundState = "live";
  // LF_ERR (задать перед кодом: «var LF_ERR = 1;») — с разбросом исполнения игры (тот же tick → тот же разброс)
  if(typeof LF_ERR === "undefined"){ BAL.lobErr = 0; BAL.execErr = false; }
  var L = (MAP.lineups.pro || []).concat(MAP.lineups.proExtra || []), out = [];
  var walls = 0, wrapW = typeof nadeWallHit === "function" ? nadeWallHit : null;
  if(wrapW) nadeWallHit = function(){ var r = wrapW.apply(this, arguments); if(r) walls++; return r; };
  var fxRoof = null;
  L.forEach(function(lu){
    var b = bots.filter(function(o){ return o.team === lu.team; })[0];
    var mates = bots.filter(function(o){ return o.team === lu.team && o !== b; });
    nadesInAir.length = 0; smokes.length = 0; fires.length = 0; nadeFx.length = 0;
    b.alive = true; b.x = b.baseX = lu.from.x; b.y = b.baseY = lu.from.y;
    // LF_OFF = {d: px, a: "back" | "side"} — боец не точно в точке лайнапа (в игре бросает, дойдя ближе 36 px): d px назад от цели
    // или вбок; точка без навмеша — как в точке лайнапа
    if(typeof LF_OFF !== "undefined" && LF_OFF.d){ var oa = Math.atan2(lu.from.y-lu.to.y, lu.from.x-lu.to.x) + (LF_OFF.a === "side" ? Math.PI/2 : 0);
      var ox = lu.from.x + Math.cos(oa)*LF_OFF.d, oy = lu.from.y + Math.sin(oa)*LF_OFF.d; if(navAt(ox, oy, null)){ b.x = b.baseX = ox; b.y = b.baseY = oy; } }
    var na = navAt(b.x, b.y, null); b.z = na ? na.z : visFloorAt(b.x, b.y);
    b.crouching = false; b.nades = emptyNades(); b.nades[lu.type] = 1; b._nadeT = null; b.nadeTask = null;
    tick = 1000 + 7*out.length; walls = 0;   // свой tick у каждого лайнапа — свой разброс исполнения (с LF_ERR), прогон тот же
    mates.forEach(function(o){ o._wasAlive = o.alive; o.alive = false; });
    var ok = throwNade(b, lu.type, lu.to.x, lu.to.y, true, "тест", true, lu.from);
    mates.forEach(function(o){ o.alive = o._wasAlive; });
    var r = {id: lu.id, team: lu.team, type: lu.type, from: [lu.from.x, lu.from.y], to: [lu.to.x, lu.to.y]};
    if(!ok){ r.how = "fail"; r.why = NADE_FAIL; out.push(r); return; }
    var n = nadesInAir[nadesInAir.length - 1], t0 = tick, path = [];
    if(n.p) n.p0 = n.p.map(function(v){ return +v.toFixed(1); });   // точка вылета (ед. игры)
    for(var k = 0; k < 64*30 && nadesInAir.indexOf(n) >= 0; k++){
      if(k % 4 === 0) path.push([+n.x.toFixed(1), +n.y.toFixed(1), n.z != null ? +n.z.toFixed(1) : null]);
      tick++; nadesTick();
    }
    r.ticks = tick - t0; r.end = [+n.x.toFixed(1), +n.y.toFixed(1), n.z != null ? +n.z.toFixed(1) : null];
    r.err = +Math.hypot(n.x - lu.to.x, n.y - lu.to.y).toFixed(1);
    r.how = n.onRoof ? "roof" : nadesInAir.indexOf(n) >= 0 ? "air" : "det";
    if(n.how) r.phys = n.how;
    if(n.exec) r.exec = n.exec;   // ошибка исполнения: поворот и наклон, °
    if(n.tx != null) r.pred = +Math.hypot(n.tx - n.x, n.ty - n.y).toFixed(2);              // расчёт броска ↔ где сработала
    if(n.plan){ r.plan = [+n.plan[0].toFixed(1), +n.plan[1].toFixed(1), +n.plan[2].toFixed(1), +n.plan[3].toFixed(0)]; r.from0 = n.from0.map(function(v){ return +v.toFixed(1); }); }
    if(n.bounces){ var f0 = n.bounces[0]; if(f0){ var R0 = m3Radar(m3(), f0[0], f0[1]); r.first = [+R0[0].toFixed(1), +R0[1].toFixed(1), +f0[2].toFixed(1), f0[3]]; } }
    if(n.p0) r.p0 = n.p0;
    // пол у цели: сработала не выше / не ниже пола цели больше чем на 64 ед. (смок, молотов) — «тот же этаж»; иначе — другой этаж / крыша
    if(n.z != null && (lu.type === "smoke" || lu.type === "molly")){ var fl = nadeAimFloors(m3(), lu.to.x, lu.to.y); r.floorOk = fl.some(function(z){ return Math.abs(n.z - z) <= 64; }); }
    r.contacts = n.bounces ? n.bounces.map(function(q){ return q[3]; }) : (walls ? ["wall2d×" + walls] : []);
    r.path = path;
    out.push(r);
  });
  return JSON.stringify({map: MAP.name || MAP.id || "", n: out.length, lineups: out});
})()
