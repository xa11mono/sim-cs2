// Снимок кадра игры с гранатой в полёте — проверка глазами, что рисунок = состояние физики (след и значок — точки полёта).
// node tools/nades/flight_shot.js <sim.html> <id лайнапа> <тиков после броска> <файл.png> [масштаб=4]
// Бросок — как в tools/nades/lineup_flights.js (без разброса), дальше только nadesTick; кадр рисует сама игра (draw).
const { chromium } = require('playwright');
(async () => {
  const [file, id, K, out, zoom] = process.argv.slice(2);
  const br = await chromium.launch(), pg = await br.newPage({ viewport: { width: 900, height: 900 } }), errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.route(/^https?:/, r => r.abort());
  await pg.goto('file://' + require('path').resolve(file)); await pg.waitForTimeout(1500);
  const info = await pg.evaluate(a => __ev(`(function(){ freshMatch(1); roundState = "live"; BAL.lobErr = 0; BAL.execErr = false;
    var lu = (MAP.lineups.pro || []).concat(MAP.lineups.proExtra || []).filter(function(l){ return l.id === "${a.id}"; })[0];
    var b = bots.filter(function(o){ return o.team === lu.team; })[0];
    bots.forEach(function(o){ if(o !== b){ o.x = -9999; o.y = -9999; } });
    b.x = b.baseX = lu.from.x; b.y = b.baseY = lu.from.y; var na = navAt(lu.from.x, lu.from.y, null); b.z = na ? na.z : visFloorAt(b.x, b.y);
    b.nades = emptyNades(); b.nades[lu.type] = 1; b._nadeT = null; tick = 1000;
    if(!throwNade(b, lu.type, lu.to.x, lu.to.y, true, "тест", true, lu.from)) return "не брошена: " + NADE_FAIL;
    var n = nadesInAir[nadesInAir.length - 1];
    for(var k = 0; k < ${a.K} && nadesInAir.indexOf(n) >= 0; k++){ tick++; nadesTick(); }
    paused = true; OBS.on = false; var r = document.getElementById('cv').getBoundingClientRect();
    view.scale = Math.min(r.width/2048, r.height/2048) * ${a.zoom}; var cx = (n.x + lu.to.x)/2, cy = (n.y + lu.to.y)/2;
    view.panX = r.width/2 - cx*view.scale; view.panY = r.height/2 - cy*view.scale; try{ draw(); }catch(e){ return "draw: " + e.message; }
    return lu.name + " | тик " + k + ": x " + n.x.toFixed(1) + " y " + n.y.toFixed(1) + " z " + n.z.toFixed(1) + " | след " + n.trail.length + " точек, касаний " + n.bounces.length +
      " | сработает в " + n.tx.toFixed(1) + ", " + n.ty.toFixed(1) + " (цель " + lu.to.x.toFixed(1) + ", " + lu.to.y.toFixed(1) + ")"; })()`), { id, K: +K, zoom: +(zoom || 4) });
  console.log(info);
  await (await pg.$('#cv')).screenshot({ path: out });
  if (errs.length) console.log('ошибки страницы:', errs.slice(0, 3).join(' | '));
  await br.close();
})();
