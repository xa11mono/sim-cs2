// (Р7, 27.11) прогон ядра игры с ядрами Rust: node tools/r7/kernels/js/run.js <core.js> <матч> <тиков> <wasm|napi|js> <shadow|speed> [cast,path]
// js — без ядер (база). Вывод: мс на тик, контрольный хэш (места, здоровье, счёт), счётчики запросов и расхождений.
const path = require('path'); const [core, m, T, backend, mode, what] = process.argv.slice(2);
const EV = require(path.join(__dirname, '../../../node/core_run.js')).load(core);
const W = (what || 'cast,path').split(',');
let st = null; if (backend !== 'js') st = require('./bridge.js').attach(EV, { backend, mode, cast: W.includes('cast'), path: W.includes('path') });
EV('freshMatch(' + m + '); 1'); const t0 = process.hrtime.bigint(); EV('while(tick < ' + T + ') stepTick(); 1'); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
const h = EV('(function(){ var s = JSON.stringify([score, bots.map(function(b){ return [b.id, b.x, b.y, b.z, b.hp, b.alive, b.facing]; })]), x = 2166136261 >>> 0; for(var i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619) >>> 0; return x; })()');
if (st) { delete st.M; delete st.ids; delete st.vals; }
console.log(JSON.stringify({ core: path.basename(core), match: +m, ticks: +T, backend, mode, what: W, ms_per_tick: +(ms / T).toFixed(4), hash: h, kern: st }));
