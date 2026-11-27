// (Р7, 27.11) ядра Rust в игре (engine/map/geometry3d.js, engine/nav/path-search.js) — ядро игры в Node, режим r7Mode:
//   ts — только эталон на TS; shadow — каждый луч и поиск пути считают ядро и эталон, ответы сверяются бит в бит (R7.bad); speed — отвечает ядро.
// node tools/r7/kernels/js/run.js <core.js> <матч> <тиков> <ts|shadow|speed>   → JSON: мс на тик (без freshMatch), хэш итога, сверок, расхождений
'use strict';
const path = require('path');
const [core, m, T, mode] = process.argv.slice(2);
const EV = require(path.join(__dirname, '../../../node/core_run.js')).load(core);
const r = EV('r7Mode("' + mode + '")');
EV('freshMatch(' + m + '); 1'); const t0 = process.hrtime.bigint(); EV('while(tick < ' + T + ') stepTick(); 1'); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
const h = EV('(function(){ var s = JSON.stringify([score, bots.map(function(b){ return [b.id, b.x, b.y, b.z, b.hp, b.alive, b.facing]; })]), x = 2166136261 >>> 0; for(var i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619) >>> 0; return x; })()');
console.log(JSON.stringify({ core: path.basename(core), match: +m, ticks: +T, mode, mode_set: r, ms_per_tick: +(ms / T).toFixed(4), hash: h, n: EV('R7.n'), bad: EV('R7.bad'), first: EV('R7.first') }));
