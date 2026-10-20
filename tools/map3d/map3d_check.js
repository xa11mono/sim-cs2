// А3: проверка map3d.json образцом для игры (map3d.js) по убийствам демок — то же, что А1 по треугольникам (los_check.py).
// node tools/map3d/map3d_check.js [mirage]   (нужен tools/measure/engine/demo_prep.py)
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const {m3Load, m3Line, m3Hit, m3FloorAt} = require('./map3d.js');
const MAP = process.argv[2] || 'mirage', ROOT = path.join(__dirname, '..', '..');
let t0 = Date.now();
const M = m3Load(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/maps', MAP, 'geom3d/map3d.json'))), u => zlib.inflateSync(u));
console.log('загрузка', Date.now() - t0, 'мс');
const K = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/measure/runs/e0a_vis', MAP + '_kills.json')));
const N = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/measure/runs/e0a_vis', MAP + '_neg.json')));
function clear(ax, ay, za, bx, by, zb, eyes, tg, side){
  const L = Math.hypot(bx-ax, by-ay) || 1, px = -(by-ay)/L, py = (bx-ax)/L, k = 2/ (M.unit) * 1;   // сдвиг вбок — ед. игры → px радара
  for(const e of eyes) for(const t of tg) for(const s of side){
    const sp = s / (M.unit / M.cell);
    if(m3Line(M, ax, ay, za + e, bx + px*sp, by + py*sp, zb + t, 'sight')) return true;
  }
  return false;
}
t0 = Date.now(); let n = 0, st = 0, all = 0, pn = 0, pst = 0, pall = 0, rays = 0;
for(const k of K){
  const [name, tick, rnd, ax, ay, za, vx, vy, zv, wpn, a_air, v_air, pen] = k;
  const s = clear(ax, ay, za, vx, vy, zv, [64], [62, 44], [0]);
  const f = s || clear(ax, ay, za, vx, vy, zv, [64, 46], [62, 44, 30], [0, 12, -12]);
  if(pen === 0){ n++; if(!s) st++; if(!f) all++; } else { pn++; if(!s) pst++; if(!f) pall++; }
}
const dt = Date.now() - t0;
let face = 0, faceVis = 0;
for(const q of N){ if(!q[8]) continue; face++; if(clear(q[2], q[3], q[4], q[5], q[6], q[7], [64], [62, 44], [0]) || clear(q[5], q[6], q[7], q[2], q[3], q[4], [64], [62, 44], [0])) faceVis++; }
// скорость одного луча
let t1 = Date.now(), R = 0; for(let r = 0; r < 3; r++) for(const k of K){ m3Line(M, k[3], k[4], k[5]+64, k[6], k[7], k[8]+44, 'sight'); R++; }
const us = (Date.now() - t1) * 1000 / R;
// гранаты: попадание с нормалью (пример — луч вниз на пол)
const h = m3Hit(M, K[0][3], K[0][4], K[0][5] + 200, K[0][3], K[0][4], K[0][5] - 300, 'nade');
const res = {kills: n, closed_stand_pct: +(100*st/n).toFixed(1), closed_all_pct: +(100*all/n).toFixed(1),
  pen_closed_stand_pct: +(100*pst/pn).toFixed(1), pen_closed_all_pct: +(100*pall/pn).toFixed(1),
  neg_face_pairs: face, neg_face_visible_pct: +(100*faceVis/face).toFixed(1), ray_us: +us.toFixed(1),
  nade_down_hit: h && {t: +h.t.toFixed(3), n: [h.nx, h.ny, h.nz].map(v => +v.toFixed(2)), mat: h.mat},
  floor_at_killer: m3FloorAt(M, K[0][3], K[0][4], K[0][5] + 10), killer_z: K[0][5]};
console.log(JSON.stringify(res));
fs.writeFileSync(path.join(ROOT, 'data/maps', MAP, 'geom3d/map3d_check.json'), JSON.stringify(res, null, 1));
