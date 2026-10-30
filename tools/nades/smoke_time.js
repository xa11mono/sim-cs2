// (тактика 30.10) Время полёта гранат: контролируемый опыт без карты — ровный пол z = 0, бросок из (0, 0, 0) вдоль оси X.
// node tools/nades/smoke_time.js
// 1) Один и тот же бросок (наклон, сила) всеми типами: физика одна (385), разница — только в том, когда граната срабатывает
//    (флешка / HE — запал 1,627 с от вылета; молотов — касание пола или 2 с; смок — когда остановился).
// 2) Подбор броска (nadeAim) на дистанцию D: какой бросок выбирает бот и сколько он летит.
'use strict';
const N = require('../../src/game/385_nades_flight.js');
function flat(A, B, r) {
  if (B[2] - r >= 0) return null;
  if (A[2] - r < 0) return { f: 0, n: [0, 0, 1] };
  return { f: (A[2] - r) / (A[2] - B[2]), n: [0, 0, 1] };
}
const TYPES = ['smoke', 'flash', 'he', 'molotov'];
console.log('1) один бросок — все типы: t от броска (с), где сработала (x, ед.), касаний, как');
for (const pit of [-45, -20, 0, 10]) for (const s of [1, 0.5]) {
  const row = ['pitch ' + pit + ' s ' + s];
  for (const t of TYPES) {
    const x = N.nadeThrow({ type: t, pos: [0, 0, 0], yaw: 0, pitch: pit, strength: s, vel: [0, 0, 0] }, flat);
    row.push(t + ' ' + x.tFire.toFixed(2) + ' с, x ' + x.det[0].toFixed(0) + ', ' + x.bounces.length + ' кас., ' + x.how);
  }
  console.log(' ' + row.join(' | '));
}
console.log('2) подбор броска на дистанцию D (без прыжка): t (с), промах (ед.), наклон, сила');
for (const D of [300, 600, 900, 1200, 1600, 2000]) {
  const row = ['D ' + D];
  for (const t of TYPES) {
    const a = N.nadeAim(t, [0, 0, 0], [D, 0, 0], flat, { noJump: true });
    row.push(t + ' ' + a.t.toFixed(2) + ' с, ' + a.err.toFixed(0) + ' ед., ' + a.pitch + '°, ' + a.strength);
  }
  console.log(' ' + row.join(' | '));
}
