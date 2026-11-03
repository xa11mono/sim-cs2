// Прицел про для лайнапов набора: подсказка подбора броска (380: nadeGuess) — броски, которые подбор сам не находит (смок со стены:
// у про поворот на ~105° от цели, Mirage «Jungle (выход, A)»; подбор ищет ± 12° от направления на цель).
// node tools/nades/luaim_bake.js <карта>  → data/maps/<карта>/luaim.json  {<id лайнапа>: {yaw, pitch, strength, jump, t, err, n}}
// Для каждого лайнапа (MAP.lineups.pro + proExtra, все типы) — броски про с места (стоя / прыжок на месте) без приседа рядом (≤ 60 ед. от точки броска и от цели,
// throws.json). Каждый повторяется нашей физикой из точки лайнапа: поворот и наклон про ± уточнение (сетка 0,5°, ± REF = 5°), сила — у про
// (нет — 1 / 0,5 / 0), прыжок на бинде — как у про. Годный — лёг ≤ 32 ед. от цели (порог совпадения с про, NADES.md); из годных —
// медиана по времени полёта (смок) или по ошибке (остальные). Физика — та же, что в игре (385).
'use strict';
const path = require('path'), fs = require('fs'), ROOT = path.join(__dirname, '..', '..');
const map = process.argv[2] || 'ancient';
const W = require('./world.js').load(map), N = require(path.join(ROOT, 'src/game/385_nades_flight.js'));
const M = W.M, k = M.unit / M.cell, game = (x, y) => [M.X0 + x * k, M.Y0 - y * k];
const SAME = 32, NEAR = 60, REF = +(process.env.REF || 5);   // ° — уточнение у прицела про: точка лайнапа в ≤ 60 ед. от места про (проектное число)
const LU = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/maps', map, 'lineups.json')));
// с места: стоя или почти стоя (горизонтальная скорость < 40 ед/с — как отбор разбега, runup_bake.js), в том числе прыжок на месте;
// тип в демках — molotov, в лайнапах — molly
const TH = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/maps', map, 'throws.json'))).throws
  .filter(t => t.det && !t.duck && (t.move === 'stand' || (t.hspeed || 0) < 40)).map(t => Object.assign({}, t, {type: t.type === 'molotov' ? 'molly' : t.type}));
const out = {}; let nAll = 0, nOk = 0;
for (const L of LU.pro.concat(LU.proExtra || [])) {
  nAll++;
  const F = game(L.from.x, L.from.y), T = game(L.to.x, L.to.y);
  const near = TH.filter(t => t.type === L.type && Math.hypot(t.pos[0] - F[0], t.pos[1] - F[1]) < NEAR && Math.hypot(t.det.pos[0] - T[0], t.det.pos[1] - T[1]) < NEAR);
  if (!near.length) continue;
  const z = near[0].pos[2], tz = near[0].det.pos[2];
  const good = [];
  for (const t of near.slice(0, 30)) {
    let best = null;
    for (const s of (t.strength != null ? [t.strength] : [1, 0.5, 0])) for (let dy = -REF; dy <= REF; dy += 0.5) for (let dp = -REF; dp <= REF; dp += 0.5) {
      const r = N.nadeThrow({type: L.type, pos: [F[0], F[1], z], yaw: t.yaw + dy, pitch: t.pitch + dp, strength: s, duck: false, vel: [0, 0, 0], jump: !!t.jumpBind || t.move === 'jump', spawn: 0}, W.trace);
      if (r.how === 'lost') continue;
      const e = Math.hypot(r.det[0] - T[0], r.det[1] - T[1]), ez = Math.abs(r.det[2] - tz);
      if (e > SAME || ez > 64) continue;
      const c = {yaw: +(t.yaw + dy).toFixed(2), pitch: +(t.pitch + dp).toFixed(2), strength: s, jump: !!t.jumpBind || t.move === 'jump', t: +r.t.toFixed(2), err: Math.round(e)};
      if (!best || (L.type === 'smoke' ? c.t < best.t : c.err < best.err)) best = c;
    }
    if (best) good.push(best);
  }
  if (!good.length) continue;
  good.sort((a, b) => L.type === 'smoke' ? a.t - b.t : a.err - b.err);
  const g = good[good.length >> 1]; g.n = good.length; out[L.id] = g; nOk++;
}
fs.writeFileSync(path.join(ROOT, 'data/maps', map, 'luaim.json'), JSON.stringify(out));
console.log(JSON.stringify({map, lineups: nAll, withAim: nOk}));
