// (I-рет-1, 27.11) Где ретейк CT теряет время: по раундам с плантом — тики планта, смены фазы ретейка (gather / util / go), первый CT в
// 250 px (≈ 625 ед.) от бомбы (та же мерка, что tools/measure/retake_cmp.py у про), начало дефуза; расклад CT : T на плант. Только чтение
// состояния после stepTick (игру не меняет). Запуск: node tools/measure/retake_phases.js <core.js> [матчи=3,7] [тиков=40000]
'use strict';
const path = require('path');
const EV = require(path.join(__dirname, '..', 'node', 'core_run.js')).load(path.resolve(process.argv[2]));
const MS = (process.argv[3] || '3,7').split(',').map(Number), N = +(process.argv[4] || 40000);
const out = [];
for (const m of MS) out.push(...JSON.parse(EV(`(function(){ freshMatch(${m}); var R = [], cur = null;
  while(tick < ${N}){ stepTick();
    if(bomb && bomb.state === 'planted' && roundState === 'live'){
      if(!cur || cur.round !== roundNum){ cur = {m: ${m}, round: roundNum, plant: tick, ct: aliveCount('CT'), t: aliveCount('T'), ph: {}, near: null, def: null}; R.push(cur); }
      var P = bomb.retake && bomb.retake.phase; if(P && cur.ph[P] == null) cur.ph[P] = tick - cur.plant;
      if(cur.near == null && bots.some(function(o){ return o.alive && o.team === 'CT' && DM.hypot(o.x-bomb.x, o.y-bomb.y) < 250; })) cur.near = tick - cur.plant;
      if(cur.def == null && bots.some(function(o){ return o.alive && o.team === 'CT' && o.defusing; })) cur.def = tick - cur.plant;
    } else if(cur && cur.end == null && cur.round === roundNum && bomb && bomb.state !== 'planted') cur.end = bomb.state;
  }
  return JSON.stringify(R); })()`)));
const s = t => t == null ? '—' : (t/64).toFixed(1);
console.log('матч р  CT:T  сбор утил заход у_бомбы дефуз итог');
out.forEach(r => console.log([r.m, r.round, r.ct + ':' + r.t, s(r.ph.gather), s(r.ph.util), s(r.ph.go), s(r.near), s(r.def), r.end || ''].join('  ')));
