// (физика гранат, этап 1в) Лайнап назначается, только если из его точки бросок выполним: nadeLineupOk(L) == бросок из точки лайнапа
// стоя состоялся (throwNade не отказал «не долетит» / «не тот этаж»). node src/q.js <сборка карты> @tools/tests/nade_lineup_feasible_test.js
(function(){
  freshMatch(1); roundState = "live"; BAL.lobErr = 0; BAL.execErr = false;
  var L = (MAP.lineups.pro || []).concat(MAP.lineups.proExtra || []), bad = [], nOk = 0, nNo = 0;
  L.forEach(function(lu){
    var ok = nadeLineupOk(lu); if(ok) nOk++; else nNo++;
    var b = bots.filter(function(o){ return o.team === lu.team; })[0], mates = bots.filter(function(o){ return o.team === lu.team && o !== b; });
    nadesInAir.length = 0; smokes.length = 0; fires.length = 0;
    b.alive = true; b.x = b.baseX = lu.from.x; b.y = b.baseY = lu.from.y; var na = navAt(lu.from.x, lu.from.y, null); b.z = na ? na.z : visFloorAt(b.x, b.y);
    b.crouching = false; b._nv = null; b.nades = emptyNades(); b.nades[lu.type] = 1; b._nadeT = null; tick = 5000;
    mates.forEach(function(o){ o._w = o.alive; o.alive = false; });
    var thrown = throwNade(b, lu.type, lu.to.x, lu.to.y, true, "тест", true, lu.from), why = NADE_FAIL;
    mates.forEach(function(o){ o.alive = o._w; }); nadesInAir.length = 0;
    var physNo = !thrown && /долетит|этаж/.test(why || "");
    if(ok === physNo) bad.push(lu.id + ": nadeLineupOk " + ok + ", бросок " + (thrown ? "состоялся" : why));
  });
  return JSON.stringify({map: MAP.name, lineups: L.length, feasible: nOk, notFeasible: nNo, mismatches: bad.length, ok: bad.length === 0, bad: bad.slice(0, 10)});
})()
