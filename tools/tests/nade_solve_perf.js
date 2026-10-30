// (физика гранат, этап 3) Время подбора броска в игре: node src/q.js <сборка карты> @tools/tests/nade_solve_perf.js
// Без разброса. Для каждого лайнапа набора (MAP.lineups.pro + proExtra): боец в 35,5 px за точкой лайнапа (как в матчах) и в 20 px вбок.
// cold — подсказка (решение точки лайнапа) не посчитана: в бросок входит и она; warm — посчитана заранее (nadePrecalcTick во
// freeze-тайм), в броске только подбор из места бойца. load — 10 бойцов бросают в один тик (сумма за тик).
// По типу гранаты и всего: медиана, p95, максимум, мс. Плюс время nadePrecalcTick на все лайнапы.
(function(){
  freshMatch(1); roundState = "live"; BAL.lobErr = 0; BAL.execErr = false;
  var L = (MAP.lineups.pro || []).concat(MAP.lineups.proExtra || []), R = {cold: {}, warm: {}}, load = [];
  function q(a, p){ a = a.slice().sort(function(x, y){ return x - y; }); return a.length ? +a[Math.floor(p*(a.length - 1))].toFixed(1) : null; }
  function one(lu, x, y, b){
    var mates = bots.filter(function(o){ return o.team === lu.team && o !== b; });
    nadesInAir.length = 0; b.alive = true; b.x = b.baseX = x; b.y = b.baseY = y; var na = navAt(x, y, null); b.z = na ? na.z : visFloorAt(x, y);
    b.crouching = false; b.nades = emptyNades(); b.nades[lu.type] = 1; b._nadeT = null; tick = 3000;
    mates.forEach(function(o){ o._w = o.alive; o.alive = false; });
    var t0 = performance.now(); throwNade(b, lu.type, lu.to.x, lu.to.y, true, "тест", true, lu.from); var ms = performance.now() - t0;
    mates.forEach(function(o){ o.alive = o._w; }); nadesInAir.length = 0; return ms;
  }
  function pos(lu, d, side){ var a = Math.atan2(lu.from.y - lu.to.y, lu.from.x - lu.to.x) + (side ? Math.PI/2 : 0), x = lu.from.x + Math.cos(a)*d, y = lu.from.y + Math.sin(a)*d;
    return navAt(x, y, null) ? [x, y] : [lu.from.x, lu.from.y]; }
  // cold: подсказки нет
  L.forEach(function(lu){ var b = bots.filter(function(o){ return o.team === lu.team; })[0], p = pos(lu, 35.5, false);
    (R.cold[lu.type] = R.cold[lu.type] || []).push(one(lu, p[0], p[1], b)); });
  // подсказки готовы (как после freeze-тайма); warm: другое место бойца — подбор из места заново, подсказка из хранилища
  var tp = performance.now(), guard = 0; if(typeof nadePrecalcTick === "function"){ NADE_PRECALC_I = 0; while(NADE_PRECALC_I < allLineups().length && guard++ < 1e5) nadePrecalcTick(); } tp = performance.now() - tp;   // сборка до этапа 3 — без заранее посчитанного
  L.forEach(function(lu){ var b = bots.filter(function(o){ return o.team === lu.team; })[0], p = pos(lu, 20, true);
    (R.warm[lu.type] = R.warm[lu.type] || []).push(one(lu, p[0], p[1], b)); });
  // load: 10 бойцов (5 + 5) в один тик, разные лайнапы, места в 35,5 px вбок-назад
  for(var g = 0; g + 10 <= Math.min(L.length, 200); g += 10){ var s = 0;
    for(var i = 0; i < 10; i++){ var lu = L[g + i], b = bots.filter(function(o){ return o.team === lu.team; })[i % 5], p = pos(lu, 30, i % 2 === 0); s += one(lu, p[0], p[1], b); }
    load.push(s); }
  var out = {map: MAP.name, precalcAllMs: +tp.toFixed(0), lineups: L.length};
  ["cold", "warm"].forEach(function(k){ var all = []; out[k] = {}; for(var t in R[k]){ all = all.concat(R[k][t]); out[k][t] = [q(R[k][t], .5), q(R[k][t], .95), q(R[k][t], 1)]; } out[k].all = [q(all, .5), q(all, .95), q(all, 1)]; });
  out.load10 = [q(load, .5), q(load, .95), q(load, 1)];
  return JSON.stringify(out);
})()
