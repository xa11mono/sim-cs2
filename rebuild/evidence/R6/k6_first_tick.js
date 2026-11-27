// (Р6 К-6, 27.11) пик первого тика раунда: время каждого тика (runMatch, onTick — только чтение), отдельно — первый тик раунда в игре
// (roundState стал "live") и первый тик закупки (стал "freeze"); сравнение с медианой и 95-м процентилем обычных тиков.
// node rebuild/evidence/R6/k6_first_tick.js <core.js> <матч> <тиков>
const [core, m, T] = process.argv.slice(2); const EV = require('../../../tools/node/core_run.js').load(core);
// R7=ts | shadow | speed — режим ядер Rust игры (r7Mode); без R7 — режим сборки (с ядрами — speed)
if (process.env.R7) EV('r7Mode("' + process.env.R7 + '"); 1');
let last = 0, prevState = null; const all = [], live = [], freeze = [], at = [];
globalThis.__k6 = t => { const now = Number(process.hrtime.bigint()) / 1e6, st = EV('roundState'); if (last) { const d = now - last; all.push(d); at.push(d);
  if (st === 'live' && prevState !== 'live') live.push(at.length - 1); if (st === 'freeze' && prevState !== 'freeze') freeze.push(at.length - 1); }
  prevState = st; last = Number(process.hrtime.bigint()) / 1e6; };
EV('runMatch({match: ' + m + ', maxTicks: ' + T + ', onTick: function(t){ __k6(t); }}); 1');
const s = all.slice().sort((a, b) => a - b), q = p => +s[Math.floor(s.length * p)].toFixed(2);
console.log(JSON.stringify({ core: require('path').basename(core), match: +m, ticks: all.length, median_ms: q(0.5), p95_ms: q(0.95), p99_ms: q(0.99), max_ms: +s[s.length - 1].toFixed(1),
  // переход в «живой» раунд — расчёт первого тика идёт на этом или следующих тиках: максимум за 4 тика после перехода
  first_live_tick_ms: live.map(i => +Math.max(...at.slice(i, i + 4)).toFixed(1)), first_freeze_tick_ms: freeze.map(i => +Math.max(...at.slice(i, i + 4)).toFixed(1)), ticks_over_50ms: all.filter(x => x > 50).length }));
