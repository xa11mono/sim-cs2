// освобождение памяти между матчами (Р6): куча после загрузки → после матча → после нового матча (сборка мусора); размер M3.nTriPl
const v8 = require('v8'); const [core, m1, m2] = process.argv.slice(2);
const EV = require('../../../tools/node/core_run.js').load(core);
const heap = () => { global.gc(); global.gc(); return Math.round(v8.getHeapStatistics().used_heap_size / 1048576); };
const tp = () => EV('M3 && M3.nTriPl ? M3.nTriPl.size : 0');
const out = { afterLoad: heap() };
const r1 = JSON.parse(EV('JSON.stringify(runMatch({match: ' + m1 + '}))')); out.afterMatch1 = heap(); out.triPl1 = tp();
EV('freshMatch(' + m2 + '); 1'); out.afterNewMatch = heap(); out.triPl2 = tp();
const r2 = JSON.parse(EV('JSON.stringify(runMatch({match: ' + m2 + '}))')); out.afterMatch2 = heap();
out.m1 = [r1.ticks, r1.score]; out.m2 = [r2.ticks, r2.score, r2.kills.length];
console.log(JSON.stringify(out));
