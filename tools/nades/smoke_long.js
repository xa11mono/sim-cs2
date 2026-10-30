// (30.10) Лайнапы смоков дольше 8,1 с (99 % смоков про) — по каждому: наш бросок (подбор nadeAim, как лайнап: wide) и броски про
// в этом лайнапе (throws.json, ≤ 60 ед. от точки броска и ≤ 60 от цели), повторённые нашей физикой. Причина:
//   pro_fast_ok   — у про есть бросок ≤ 8,1 с, наша физика кладёт его ≤ 32 ед. → подбор его не находит (дело подбора)
//   pro_fast_far  — быстрый бросок про есть, но наша физика кладёт его дальше 32 ед. (геометрия / физика)
//   pro_slow      — у про этот лайнап тоже дольше 8,1 с
//   no_pro        — бросков про рядом нет
// node tools/nades/smoke_long.js <карта>
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..', '..');
const map = process.argv[2] || 'ancient';
const W = require('./world.js').load(map), N = require(path.join(ROOT, 'src/game/385_nades_flight.js'));
const M = W.M, k = M.unit / M.cell, game = (x, y) => [M.X0 + x * k, M.Y0 - y * k];
const LU = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/maps', map, 'lineups.json')));
const TH = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/maps', map, 'throws.json'))).throws.filter(t => t.type === 'smoke' && t.det);
const out = [];
for (const L of LU.pro.concat(LU.proExtra || [])) {
  if (L.type !== 'smoke') continue;
  const F = game(L.from.x, L.from.y), T = game(L.to.x, L.to.y);
  const near = TH.filter(t => Math.hypot(t.pos[0] - F[0], t.pos[1] - F[1]) < 60 && Math.hypot(t.det.pos[0] - T[0], t.det.pos[1] - T[1]) < 60);
  const z = near.length ? near[0].pos[2] : 0, tz = near.length ? near[0].det.pos[2] : 0;
  if (!near.length) { out.push({id: L.id, name: L.name, cause: 'no_pro'}); continue; }
  const a = N.nadeAim('smoke', [F[0], F[1], z], [T[0], T[1], tz], W.trace, {wide: true});
  if (!a || a.t <= 8.1) continue;
  const pro = near.map(t => { const r = N.nadeThrow({type: 'smoke', pos: t.pos, yaw: t.yaw, pitch: t.pitch, strength: t.strength != null ? t.strength : 1, duck: t.duck, vel: t.vel, jump: !!t.jumpBind}, W.trace);
    return {dt: t.det.dt, sim: r.tFire, e: Math.hypot(r.det[0] - t.det.pos[0], r.det[1] - t.det.pos[1]), move: t.move}; });
  const fast = pro.filter(p => p.dt <= 8.1), fastOk = fast.filter(p => p.e <= 32 && p.sim <= 8.1);
  const cause = !fast.length ? 'pro_slow' : fastOk.length ? 'pro_fast_ok' : 'pro_fast_far';
  out.push({id: L.id, name: L.name, ours: +a.t.toFixed(2), err: Math.round(a.err), jump: a.jump, pitch: a.pitch, nPro: pro.length,
    proMed: +pro.map(p => p.dt).sort((x, y) => x - y)[pro.length >> 1].toFixed(2), proMoving: pro.filter(p => p.move !== 'stand').length, fastOk: fastOk.length, cause});
}
const c = {}; out.forEach(o => c[o.cause] = (c[o.cause] || 0) + 1);
console.log(JSON.stringify({map, long: out.filter(o => o.cause !== 'no_pro').length, noPro: c.no_pro || 0, causes: c, list: out.filter(o => o.cause !== 'no_pro')}, null, 0));
