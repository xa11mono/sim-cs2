// Бросок смока с разбега: эталон для лайнапов набора (docs/tasks/RUNUP_THROW_PLAN.md).
// node tools/nades/runup_bake.js <карта>  → data/maps/<карта>/runups.json  {<id лайнапа>: {dir, speed, walk, jump, yaw, pitch, strength, t, err, n}}
// Для каждого лайнапа смока (MAP.lineups.pro + proExtra) — броски про на ходу / в прыжке рядом (≤ 60 ед. от точки броска и цели, throws.json).
// Каждый повторяется так, как может бот: скорость по направлению разбега про, величина — бег бота (BOT_RUN) или шаг (BOT_WALK, если у про
// шаг), вертикаль — прыжок на бинде, если про был в прыжке; поворот и наклон про ± уточнение (сетка 0,5°), силы 1 / 0,5 / 0 — лучший полёт
// нашей физикой из точки лайнапа. Берётся, если ложится ≤ 32 ед. от цели (порог совпадения с про, NADES.md) и быстрее броска стоя (подбор
// nadeAim, как у бота) и не дольше 8,1 с (99 % смоков про). Из всех годных — медиана по времени. Физика — та же, что в игре (385).
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..', '..');
const map = process.argv[2] || 'ancient';
const W = require('./world.js').load(map), N = require(path.join(ROOT, 'src/game/385_nades_flight.js'));
const M = W.M, k = M.unit / M.cell, game = (x, y) => [M.X0 + x * k, M.Y0 - y * k];
// скорость бота, ед/с игры: SPEED (px/с) × ед. на px; BAL.realSpeed — 90 px/с (080); шаг — × WALK_SPEED_FRAC 0,5 (070)
const BOT_RUN = 90 * k, BOT_WALK = BOT_RUN * 0.5, WALK_IF = 160;   // ед/с; про медленнее WALK_IF — шаг (проектное число: между шагом 130 и бегом 215–250)
const SAME = 32, SLOW = 8.1;
const LU = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/maps', map, 'lineups.json')));
const TH = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/maps', map, 'throws.json'))).throws.filter(t => t.type === 'smoke' && t.det && t.move !== 'stand');
const out = {}; let nAll = 0, nOk = 0;
for (const L of LU.pro.concat(LU.proExtra || [])) {
  if (L.type !== 'smoke') continue; nAll++;
  const F = game(L.from.x, L.from.y), T = game(L.to.x, L.to.y);
  const near = TH.filter(t => Math.hypot(t.pos[0] - F[0], t.pos[1] - F[1]) < 60 && Math.hypot(t.det.pos[0] - T[0], t.det.pos[1] - T[1]) < 60 && t.hspeed > 40);
  if (!near.length) continue;
  const z = near[0].pos[2], tz = near[0].det.pos[2];
  const stand = N.nadeAim('smoke', [F[0], F[1], z], [T[0], T[1], tz], W.trace, {wide: true});
  const good = [];
  for (const t of near.slice(0, 40)) {
    const hs = Math.hypot(t.vel[0], t.vel[1]), walk = hs < WALK_IF, sp = walk ? BOT_WALK : BOT_RUN;
    const dir = [t.vel[0] / hs, t.vel[1] / hs], vel = [dir[0] * sp, dir[1] * sp, 0], jump = t.move === 'jump';
    let best = null;
    for (const s of [1, 0.5, 0]) for (let dy = -2; dy <= 2; dy += 0.5) for (let dp = -2; dp <= 2; dp += 0.5) {
      const r = N.nadeThrow({type: 'smoke', pos: [F[0], F[1], z], yaw: t.yaw + dy, pitch: t.pitch + dp, strength: s, duck: false, vel, jump, spawn: 0}, W.trace);
      if (r.how !== 'stop') continue;
      const e = Math.hypot(r.det[0] - T[0], r.det[1] - T[1]), ez = Math.abs(r.det[2] - tz);
      if (e > SAME || ez > 64 || r.t > SLOW) continue;
      if (!best || r.t < best.t) best = {dir: dir.map(v => +v.toFixed(4)), speed: Math.round(sp), walk, jump, yaw: +(t.yaw + dy).toFixed(2), pitch: +(t.pitch + dp).toFixed(2), strength: s, t: +r.t.toFixed(2), err: Math.round(e)};
    }
    if (best && (!stand || best.t < stand.t - 0.5)) good.push(best);
  }
  if (!good.length) continue;
  good.sort((a, b) => a.t - b.t); const g = good[good.length >> 1]; g.n = good.length; g.standT = stand ? +stand.t.toFixed(2) : null;
  out[L.id] = g; nOk++;
}
fs.writeFileSync(path.join(ROOT, 'data/maps', map, 'runups.json'), JSON.stringify(out));
const ts = Object.values(out);
console.log(JSON.stringify({map, smokeLineups: nAll, withRunup: nOk, medianT: ts.length ? ts.map(o => o.t).sort((a, b) => a - b)[ts.length >> 1] : null,
  medianStandT: ts.length ? ts.map(o => o.standT).sort((a, b) => a - b)[ts.length >> 1] : null, walk: ts.filter(o => o.walk).length, jump: ts.filter(o => o.jump).length}));
