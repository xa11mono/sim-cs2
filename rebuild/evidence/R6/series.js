// (Р6, 27.11, требование владельца «скорость и память в ходе матча, а не только после») ряд по ходу матча в Node: каждые W тиков —
// мс на тик в окне (среднее, 95-й процентиль и максимум тика), куча V8 после сборки мусора, число записей в больших кэшах игры.
// Запуск: node --expose-gc rebuild/evidence/R6/series.js <dist/core-<карта>.js> <матч> [окно=2000] [до тика=конец матча] > ряд.json
const [core, m, W0, END] = process.argv.slice(2); const EV = require('../../../tools/node/core_run.js').load(core);
const W = +(W0 || 2000), gc = global.gc || (() => {});
const heap = () => { gc(); gc(); return +(process.memoryUsage().heapUsed / 1048576).toFixed(1); };
const caches = () => JSON.parse(EV(`JSON.stringify({PATHQ: typeof PATHQ_N !== "undefined" ? PATHQ_N : null, nTriPl: (typeof M3 !== "undefined" && M3.nTriPl) ? M3.nTriPl.size : null,
  WPM: typeof WPM !== "undefined" && WPM ? Object.keys(WPM).length : null})`));
const out = { core: require('path').basename(core), match: +m, window: W, load_mb: heap(), rows: [] };
// матч целиком — runMatch (как mass_run / Э2), onTick — только чтение: время между вызовами = время тика; окно закрывается сборкой мусора
// и замером кучи, их время в тики не входит
let ts = [], last = 0;
globalThis.__rowTick = t => { const now = Number(process.hrtime.bigint()) / 1e6; if (last) ts.push(now - last);
  if (t % W === 0 || (END && t >= +END)) { const n = ts.length, s2 = ts.slice().sort((a, b) => a - b);
    out.rows.push({ tick: t, ms_mean: +(ts.reduce((a, b) => a + b, 0) / n).toFixed(3), ms_p95: +s2[Math.floor(n * 0.95)].toFixed(2), ms_max: +s2[n - 1].toFixed(1),
      over50: ts.filter(x => x > 50).length, heap_mb: heap(), caches: caches() }); process.stderr.write(JSON.stringify(out.rows[out.rows.length - 1]) + '\n'); ts = []; }
  last = Number(process.hrtime.bigint()) / 1e6; };
const r = JSON.parse(EV('JSON.stringify(runMatch({match: ' + m + ', maxTicks: ' + (+(END || 400000)) + ', onTick: function(t){ __rowTick(t); }}))'));
out.result = r; out.end_mb = heap(); console.log(JSON.stringify(out, null, 1));
