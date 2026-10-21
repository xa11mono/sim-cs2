// В2 (21.10.2026): проверка физики гранаты (src/nadephys.js) бросками про из В1 — без матчей.
// node tools/nades/check.js <карта> --fuse [--fill] [--par '{"GRAV":..}'] [--mask '{"playerclip":true}'] [--out файл] [--every k] [--nojump]
// Каждый бросок (data/maps/<карта>/throws.json, связанные с разрывом) — через физику со всеми тремя силами (1 ЛКМ, 0,5 обе,
// 0 ПКМ); берётся сила с наименьшей ошибкой (место + время × V_T). Совпал — ошибка места ≤ N и времени ≤ M (NADES.md).
// --fuse: у флешки / HE задержку вылета брать из времени разрыва (запал модуля постоянный), иначе — SPAWN модуля.
// Пишет: --out (по умолчанию data/maps/<карта>/throws_check.json): на бросок {i, s, e, exy, dz, et, how, nb, sim:[x,y,z], tsim}.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const NP = require(path.join(ROOT, 'src', 'nadephys.js')), P = NP.NADE_P;
const args = process.argv.slice(2), map = args[0];
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
Object.assign(P, JSON.parse(arg('--par', '{}')));
const W = require('./world.js').load(map, JSON.parse(arg('--mask', '{}')));
const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'maps', map, 'throws.json'))).throws;
const every = +arg('--every', 1), fuseFromDemo = args.includes('--fuse');
const V_T = 100;                 // ед. места за 1 с ошибки времени при выборе силы (только выбор силы, не порог)
const STR = [1, 0.5, 0];
// прыжок с броском в демке не виден (скорость в тик броска ещё без прыжка) — для бросков с земли пробуем оба варианта
const noJump = args.includes('--nojump');
const out = [];
const t0 = Date.now();
T.forEach((t, i) => {
  if (!t.det || i % every) return;
  let best = null;
  const J = (!noJump && Math.abs(t.vel[2]) <= P.AIR_VZ) ? [false, true] : [false];
  for (const jump of J) for (const s of STR) {
    // флешка / HE: запал от вылета известен — задержку вылета этого броска берём из времени разрыва (обычно SPAWN,
    // у ≈ 8 % на 7 тиков больше — граната вышла позже, а не горела дольше: NADES.md)
    const fu = P.FUSE[t.type], spawn = (fuseFromDemo && fu !== undefined) ? Math.max(0, t.det.dt * P.TICK - fu * P.TICK) : undefined;
    const r = NP.nadeThrow(Object.assign({}, t, { strength: s, jump, spawn }), W.trace);
    const d = [t.det.pos[0] - r.det[0], t.det.pos[1] - r.det[1], t.det.pos[2] - r.det[2]];
    const e = Math.hypot(d[0], d[1], d[2]), et = r.tFire - t.det.dt;
    const sc = e + Math.abs(et) * V_T;
    if (!best || sc < best.sc) best = { sc, s, jump, e, exy: Math.hypot(d[0], d[1]), dz: d[2], et, how: r.how, nb: r.bounces.length,
      sim: r.det.map(v => +v.toFixed(1)), tsim: +r.tFire.toFixed(3), kinds: r.bounces.map(b => b[3][0]).join('') };
  }
  delete best.sc;
  // для разбора несовпадений: первое касание у нас и «пролетела бы по дуге без стен» (ближе всего к разрыву про за время полёта)
  {
    const fu = P.FUSE[t.type], spawn = (fuseFromDemo && fu !== undefined) ? Math.max(0, t.det.dt * P.TICK - fu * P.TICK) : undefined;
    const o = Object.assign({}, t, { strength: best.s, jump: best.jump, spawn });
    const r = NP.nadeThrow(o, W.trace);
    best.hit0 = r.bounces.length ? r.bounces[0].slice(0, 3).map(v => +v.toFixed(0)).concat([r.bounces[0][3]]) : null;
    const mx = P.MAXT; P.MAXT = t.det.dt + 0.3;
    const fr = NP.nadeFly('flash_free', r.p0, r.v0, () => null, { path: true });
    P.MAXT = mx;
    best.free = +Math.min(...fr.path.map(q => Math.hypot(q[0] - t.det.pos[0], q[1] - t.det.pos[1], q[2] - t.det.pos[2]))).toFixed(1);
  }
  for (const k of ['e', 'exy', 'dz', 'et']) best[k] = +best[k].toFixed(k === 'et' ? 3 : 1);
  out.push(Object.assign({ i }, best));
});
const fo = arg('--out', path.join(ROOT, 'data', 'maps', map, 'throws_check.json'));
fs.writeFileSync(fo, JSON.stringify({ map, par: P, mask: W.opt, fuseFromDemo, n: out.length, res: out }));
const q = (a, p) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(p * (a.length - 1))] : NaN; };
for (const ty of ['smoke', 'flash', 'he', 'molotov', 'all']) {
  const r = out.filter(x => ty === 'all' || T[x.i].type === ty);
  const e = r.map(x => x.e), et = r.map(x => Math.abs(x.et));
  console.log(map, ty.padEnd(7), 'n', String(r.length).padStart(6), 'e p50', q(e, .5).toFixed(1), 'p75', q(e, .75).toFixed(1),
    '|et| p50', q(et, .5).toFixed(3), 'p75', q(et, .75).toFixed(3),
    '≤25', (r.filter(x => x.e <= 25).length / r.length * 100).toFixed(1) + '%',
    '≤50', (r.filter(x => x.e <= 50).length / r.length * 100).toFixed(1) + '%');
}
// --fill: подобранную силу и «прыжок на бинде» — обратно в throws.json (только у совпавших: ошибка ≤ N_FILL ед. и ≤ M_FILL с)
if (args.includes('--fill')) {
  const N_FILL = 32, M_FILL = 0.25, ft = path.join(ROOT, 'data', 'maps', map, 'throws.json');
  const TJ = JSON.parse(fs.readFileSync(ft));
  for (const t of TJ.throws) { t.strength = null; t.jumpBind = null; t.simErr = null; }
  for (const r of out) {
    const t = TJ.throws[r.i];
    t.simErr = [r.e, r.et];
    if (r.e <= N_FILL && Math.abs(r.et) <= M_FILL) { t.strength = r.s; t.jumpBind = r.jump; }
  }
  fs.writeFileSync(ft, JSON.stringify(TJ));
  console.log('сила записана в', ft, out.filter(r => r.e <= N_FILL && Math.abs(r.et) <= M_FILL).length);
}
console.log('время', ((Date.now() - t0) / 1000).toFixed(1), 'с →', fo);
