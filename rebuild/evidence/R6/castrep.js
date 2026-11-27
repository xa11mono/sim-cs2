// доля повторов m3Cast с теми же аргументами в одном тике (только счёт, обёртка не меняет ответ)
const [core, m, T0, T1] = process.argv.slice(2); const EV = require('../../../tools/node/core_run.js').load(core);
EV('freshMatch(' + m + '); while(tick < ' + T0 + ') stepTick(); 1');
console.log(EV(`(function(){ var o = m3Cast, n = 0, rep = 0, seen = new Set(), st = -1, F = {};
  m3Cast = function(M, ax, ay, az, bx, by, bz, kind, first){ if(tick !== st){ st = tick; seen.clear(); } n++; var k = ax+","+ay+","+az+","+bx+","+by+","+bz+","+kind+","+(first?1:0); if(seen.has(k)) rep++; else seen.add(k); return o.apply(this, arguments); };
  while(tick < ${T1}) stepTick(); m3Cast = o; return JSON.stringify({calls: n, perTick: +(n/(${T1}-${T0})).toFixed(1), repeats: rep, share: +(rep/n).toFixed(3)}); })()`));
