// (30.10, ошибка PR #2) Подбор броска и вылет — из одного и того же состояния бойца. Код для страницы игры:
// node src/q.js <сборка карты> @tools/tests/nade_launch_state_test.js     (сборка — python3 src/build.py --map <карта> <файл>)
// Без разброса исполнения (BAL.lobErr = 0, execErr off). Лайнапы — все 30 «не долетит» из отчёта + первые 20 тех, что в v479 работали.
// Сценарии: A — боец точно в точке лайнапа; B — 35,5 px за ней (от цели); C — 20 px вбок; D — рядом на другой высоте (навмеш в 36 px,
// пол отличается > 40 ед.); E — отказ (нет броска отсюда): гранаты нет, граната не потрачена, причина; F — боец бежит: вылет тот же,
// что стоя (скорость не идёт ни в подбор, ни в вылет).
// Проверки у каждого броска: где сработала = где сработает по подбору (бит в бит), точка вылета — у самого бойца (≤ 23 ед. по
// горизонтали: рука в 16 ед. перед глазами), подбор шёл из места бойца (from0 = x, y, z бойца); смок / молотов — на полу у цели
// (nadeLandFloors ± NADE_LEVEL_TOL), не на крыше.
(function(){
  freshMatch(1); roundState = "live"; BAL.lobErr = 0; BAL.execErr = false;
  var BAD = {ancient: "pro88 pro99 prx16 prx66 prx108", mirage: "pro1 pro2 pro30 pro49 pro53 pro64 pro65 pro69 prx15 prx28 prx31 prx41 prx91 prx103 prx112 prx128 prx142 prx171 prx182 prx211 prx213 prx244 prx259 prx291 prx294"};
  var M = m3(), mk = String(MAP.name || "").toLowerCase(), bad = (BAD[mk] || "").split(" ");
  var L = (MAP.lineups.pro || []).concat(MAP.lineups.proExtra || []);
  var sel = L.filter(function(l){ return bad.indexOf(l.id) >= 0; }).concat(L.filter(function(l){ return bad.indexOf(l.id) < 0; }).slice(0, 20));
  var res = {map: MAP.name, n: 0, thrown: 0, refused: 0, fails: [], why: {}, ms: [], rows: []};
  function fail(s){ if(res.fails.length < 40) res.fails.push(s); }
  function throwAt(lu, x, y, z, moving){
    var b = bots.filter(function(o){ return o.team === lu.team; })[0], mates = bots.filter(function(o){ return o.team === lu.team && o !== b; });
    nadesInAir.length = 0; smokes.length = 0; fires.length = 0;
    b.alive = true; b.x = b.baseX = x; b.y = b.baseY = y; b.z = z; b.crouching = false; b.nades = emptyNades(); b.nades[lu.type] = 1; b._nadeT = null;
    b.curSpeed = moving ? 215 : 0; tick = 2000;
    mates.forEach(function(o){ o._w = o.alive; o.alive = false; });
    var t0 = performance.now(), ok = throwNade(b, lu.type, lu.to.x, lu.to.y, true, "тест", true, lu.from), ms = performance.now() - t0;
    mates.forEach(function(o){ o.alive = o._w; });
    res.n++; res.ms.push(ms); LAST_MS = ms;
    if(!ok){ res.refused++; res.why[NADE_FAIL] = (res.why[NADE_FAIL] || 0) + 1;
      if(nadesInAir.length) fail(lu.id + ": отказ, а граната в воздухе"); if(b.nades[lu.type] !== 1) fail(lu.id + ": отказ, а граната потрачена");
      return null; }
    res.thrown++;
    var n = nadesInAir[nadesInAir.length - 1], p0 = n.p.slice(), v0 = n.v.slice(), G = m3Game(M, x, y);
    if(Math.hypot(p0[0] - G[0], p0[1] - G[1]) > 23) fail(lu.id + ": вылет не у бойца (" + Math.hypot(p0[0] - G[0], p0[1] - G[1]).toFixed(1) + " ед.)");
    if(n.from0[0] !== x || n.from0[1] !== y || n.from0[2] !== z) fail(lu.id + ": подбор не из места бойца");
    for(var k = 0; k < 64*30 && nadesInAir.indexOf(n) >= 0; k++){ tick++; nadesTick(); }
    var dPlan = Math.hypot(n.x - n.plan[0], n.y - n.plan[1]);
    if(dPlan > 1e-6 || Math.abs(n.z - n.plan[2]) > 1e-6) fail(lu.id + ": сработала не там, где по подбору (" + dPlan.toFixed(2) + " px)");
    var f0 = n.bounces[0], R0 = f0 ? m3Radar(M, f0[0], f0[1]) : null;
    // тот же этаж, что цель (смок / молотов): сработала в 64 ед. от одного из полов цели, куда можно дойти; иначе — крыша / другой этаж
    var floorOk = (lu.type !== "smoke" && lu.type !== "molly") || nadeLandFloors(M, lu.to.x, lu.to.y).some(function(fz){ return Math.abs(n.z - fz) <= NADE_LEVEL_TOL; }) && !n.onRoof;
    if(!floorOk) fail(lu.id + ": смок / молотов брошен, а лёг на другой этаж / крышу (z " + n.z.toFixed(0) + ")");   // (этап 1) такой бросок не должен состояться
    return {p0: p0, v0: v0, end: [n.x, n.y, n.z], err: Math.hypot(n.x - lu.to.x, n.y - lu.to.y), t: n.t, first: R0 ? [R0[0], R0[1], f0[2], f0[3]] : null, roof: !!n.onRoof, floorOk: floorOk};
  }
  function floorZ(x, y){ var na = navAt(x, y, null); return na ? na.z : visFloorAt(x, y); }
  var nD = 0, nF = 0, LAST_MS = 0, MS = {A: [], B: [], C: [], D: []};
  sel.forEach(function(lu){
    var row = {id: lu.id, type: lu.type, bad: bad.indexOf(lu.id) >= 0}, zf = floorZ(lu.from.x, lu.from.y);
    var oa = Math.atan2(lu.from.y - lu.to.y, lu.from.x - lu.to.x);
    var A = throwAt(lu, lu.from.x, lu.from.y, zf); MS.A.push(LAST_MS);
    var bx = lu.from.x + Math.cos(oa)*35.5, by = lu.from.y + Math.sin(oa)*35.5, B = navAt(bx, by, null) ? throwAt(lu, bx, by, floorZ(bx, by)) : undefined; if(B !== undefined) MS.B.push(LAST_MS);
    var cx = lu.from.x + Math.cos(oa + Math.PI/2)*20, cy = lu.from.y + Math.sin(oa + Math.PI/2)*20, C = navAt(cx, cy, null) ? throwAt(lu, cx, cy, floorZ(cx, cy)) : undefined; if(C !== undefined) MS.C.push(LAST_MS);
    // D — другая высота в пределах допуска
    var D;
    for(var r = 8; r <= 36 && D === undefined; r += 4) for(var q = 0; q < 16 && D === undefined; q++){
      var dx = lu.from.x + Math.cos(q*Math.PI/8)*r, dy = lu.from.y + Math.sin(q*Math.PI/8)*r, a2 = navAt(dx, dy, null);
      if(a2 && Math.abs(a2.z - zf) > 40){ D = throwAt(lu, dx, dy, a2.z); MS.D.push(LAST_MS); nD++; row.dz = +(a2.z - zf).toFixed(0); }
    }
    // F — бежит: вылет тот же, что стоя
    if(A){ var F = throwAt(lu, lu.from.x, lu.from.y, zf, true); nF++;
      if(!F || F.p0.join() !== A.p0.join() || F.v0.join() !== A.v0.join()) fail(lu.id + ": бег меняет вылет / подбор"); }
    function pack(s){ return s === undefined ? "нет навмеша" : s === null ? "отказ" : {err: +s.err.toFixed(1), t: +s.t.toFixed(2), roof: s.roof, floorOk: s.floorOk,
      p0: s.p0.map(function(v){ return +v.toFixed(1); }), first: s.first ? [+s.first[0].toFixed(1), +s.first[1].toFixed(1), +s.first[2].toFixed(1), s.first[3]] : null,
      end: [+s.end[0].toFixed(1), +s.end[1].toFixed(1), +s.end[2].toFixed(1)]}; }
    row.A = pack(A); row.B = pack(B); row.C = pack(C); if(D !== undefined) row.D = pack(D);
    res.rows.push(row);
  });
  res.nD = nD; res.nF = nF; res.ms.sort(function(a, b){ return a - b; });
  res.msP50 = +res.ms[res.ms.length >> 1].toFixed(1); res.msP90 = +res.ms[Math.floor(res.ms.length*0.9)].toFixed(1); res.msMax = +res.ms[res.ms.length - 1].toFixed(1); delete res.ms;
  // время подбора по сценариям: A — с нуля (холодный кэш, полный перебор), B/C/D — уточнение у решения точки лайнапа (оно уже в кэше)
  res.msBy = {}; for(var kk in MS){ var a = MS[kk].sort(function(x, y){ return x - y; }); if(a.length) res.msBy[kk] = [+a[a.length >> 1].toFixed(1), +a[Math.floor(a.length*0.9)].toFixed(1), +a[a.length-1].toFixed(1)]; }
  res.ok = res.fails.length === 0;
  return JSON.stringify(res);
})()
