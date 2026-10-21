// В4 (21.10.2026): записанные лайнапы про (lineups.json → pro / proExtra → throws[], tools/nades/lineups_rec.py) — сила броска
// (1 ЛКМ, 0,5 обе, 0 ПКМ) и прыжок на бинде, которых в демке не видно: подбираются физикой игры (src/game/385_nades_flight.js) на
// геометрии игры (map3d.json) — та сила / прыжок, при которых записанные броски варианта ложатся ближе всего к своим разрывам у про.
// Пишет в вариант: s (сила), j (прыжок на бинде), ok (доля его бросков, которые физика кладёт туда же, где у про: место ≤ N ед.,
// время ≤ M с — пороги В2), e50 (медиана ошибки, ед.). И печатает проверку «без матчей» — по типам.
// node tools/nades/lineups_fit.js <карта>
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const NP = require(path.join(ROOT, 'src', 'game', '385_nades_flight.js')), P = NP.NADE_P;
const map = process.argv[2];
const W = require('./world.js').load(map);
const FL = path.join(ROOT, 'data', 'maps', map, 'lineups.json');
const LJ = JSON.parse(fs.readFileSync(FL, 'utf8'));
const N = 32, M = 0.25;
const PT = { molly: 'molotov' };
// бросок записи так, как его кинет бот в игре (src/game/380_nades_throw.js: nadeRecThrow — задержка вылета SPAWN модуля)
function sim(type, r, s, j, duck) {
  return NP.nadeThrow({ type: PT[type] || type, pos: r.p, yaw: r.yaw, pitch: r.pitch, vel: r.vel, duck: !!duck, strength: s, jump: j }, W.trace);
}
const med = a => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : NaN; };
const stat = {};
const t0 = Date.now();
for (const L of LJ.pro.concat(LJ.proExtra)) {
  for (const V of L.throws || []) {
    const J = V.move === 'jump' ? [false] : [false, true];
    let best = null;
    for (const j of J) for (const s of [1, 0.5, 0]) {
      const E = V.rec.map(r => { const q = sim(L.type, r, s, j, V.duck);
        return { e: Math.hypot(q.det[0] - r.det[0], q.det[1] - r.det[1], q.det[2] - r.det[2]), et: q.tFire - r.dt }; });
      const sc = med(E.map(x => x.e + Math.abs(x.et) * 100));
      if (!best || sc < best.sc) best = { sc, s, j, E };
    }
    V.s = best.s; V.j = best.j;
    V.ok = +(best.E.filter(x => x.e <= N && Math.abs(x.et) <= M).length / best.E.length).toFixed(2);
    V.e50 = +med(best.E.map(x => x.e)).toFixed(1);
    const S = stat[L.type] || (stat[L.type] = { var: 0, varOk: 0, rec: 0, recOk: 0, w: 0, wOk: 0 });
    S.var++; if (V.ok >= 0.5) S.varOk++;
    S.rec += best.E.length; S.recOk += best.E.filter(x => x.e <= N && Math.abs(x.et) <= M).length;
    // по тому, как часто кидают: вес варианта — доля раундов записи × его доля бросков в записи
    const w = L.prob * V.n / Math.max(1, L.nRec || V.n); S.w += w; S.wOk += w * V.ok;
  }
}
fs.writeFileSync(FL, JSON.stringify(LJ) + '\n');
const pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—') + '%';
for (const ty of ['smoke', 'flash', 'he', 'molly']) {
  const S = stat[ty]; if (!S) continue;
  console.log(map, ty.padEnd(6), 'вариантов', String(S.var).padStart(4), 'падает как у про (≥ половины бросков):', pc(S.varOk, S.var),
    '| бросков', String(S.rec).padStart(4), 'совпало', pc(S.recOk, S.rec), '| по частоте', pc(S.wOk, S.w));
}
console.log('время', ((Date.now() - t0) / 1000).toFixed(1), 'с →', FL);
