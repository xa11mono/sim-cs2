// Регрессия физики гранаты (30.10.2026): детерминированные сценарии на искусственной геометрии + броски на картах.
// node tools/tests/nade_physics_test.js            → строки «ok / FAIL», код выхода 1 при любой ошибке
// Физика — src/game/385_nades_flight.js (как в игре), луч — m3NadeTrace из src/game/035_map3d.js (как в игре); искусственный
// мир собирается в ту же структуру, что m3Load (треугольники, блоки, корзины), — проверяется и отбор по корзинам.
// Инварианты на каждом полёте: (1) кубик чуть меньше гранаты не проходит сквозь геометрию ни на одном тике (нет туннеля),
// (2) направление по горизонтали меняется только в тик с касанием (нет поворота «из ничего»), (3) шаг за тик не больше
// скорости × тик (нет телепорта), (4) нет NaN.
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const G = require(path.join(ROOT, 'src', 'game', '035_map3d.js'));
const NP = require(path.join(ROOT, 'src', 'game', '385_nades_flight.js')), P = NP.NADE_P;
let fails = 0, oks = 0;
function check(name, cond, info){ if(cond){ oks++; console.log('ok   ', name); } else { fails++; console.log('FAIL ', name, info !== undefined ? JSON.stringify(info) : ''); } }

// ---------- искусственный мир: треугольники и блоки (axis-aligned boxes) в той же структуре, что m3Load ----------
function world(tris, boxes){
  const M = { X0: -4096, Y0: 4096, unit: 5, cell: 2, B: 4, mats: ['concrete'] };
  M.BN = Math.ceil(8192 / (M.unit * M.B));
  const nt = tris.length;
  M.tri = new Float32Array(nt * 9); M.triFlag = new Uint8Array(nt).fill(3); M.triMat = new Uint8Array(nt); M.triZ = new Float32Array(nt * 2);
  tris.forEach((t, k) => { for (let q = 0; q < 9; q++) M.tri[k*9 + q] = t[q]; M.triZ[k*2] = Math.min(t[2], t[5], t[8]); M.triZ[k*2+1] = Math.max(t[2], t[5], t[8]); });
  const hp = [], hoff = [0], hb = [];
  boxes.forEach(b => { const [x0, y0, z0, x1, y1, z1] = b;
    hp.push(1,0,0,x1, -1,0,0,-x0, 0,1,0,y1, 0,-1,0,-y0, 0,0,1,z1, 0,0,-1,-z0); hoff.push(hoff[hoff.length-1] + 6); hb.push(x0, y0, z0, x1, y1, z1); });
  M.hullP = new Float32Array(hp); M.hullOff = new Uint32Array(hoff); M.hullBox = new Int16Array(hb.map(Math.round));
  M.hullFlag = new Uint8Array(boxes.length).fill(3); M.hullMat = new Uint8Array(boxes.length);
  M.bTri = []; M.bHull = []; for (let g = 0; g < M.BN * M.BN; g++){ M.bTri.push([]); M.bHull.push([]); }
  const BU = M.unit * M.B;
  function put(list, idx, x0, y0, x1, y1){
    const i0 = Math.max(0, Math.floor((x0 - M.X0) / BU)), i1 = Math.min(M.BN-1, Math.floor((x1 - M.X0) / BU));
    const j0 = Math.max(0, Math.floor((M.Y0 - y1) / BU)), j1 = Math.min(M.BN-1, Math.floor((M.Y0 - y0) / BU));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) list[j*M.BN + i].push(idx);
  }
  tris.forEach((t, k) => put(M.bTri, k, Math.min(t[0], t[3], t[6]), Math.min(t[1], t[4], t[7]), Math.max(t[0], t[3], t[6]), Math.max(t[1], t[4], t[7])));
  boxes.forEach((b, h) => put(M.bHull, h, b[0], b[1], b[3], b[4]));
  return { M, trace: (A, B, r) => G.m3NadeTrace(M, A, B, r) };
}
// пол z на квадрате ±S
function floorTris(z, S, x0, y0, x1, y1){ x0 = x0 ?? -S; y0 = y0 ?? -S; x1 = x1 ?? S; y1 = y1 ?? S;
  return [[x0,y0,z, x1,y0,z, x1,y1,z], [x0,y0,z, x1,y1,z, x0,y1,z]]; }

// полёт с путём и проверкой инвариантов
function fly(W, type, p, v, label){
  const st = NP.nadeState(type, p, v), pts = [st.p.slice()], vel = [st.v.slice()], nb = [0];
  let how = null, guard = 0;
  while (!(how = NP.nadeStep(st, W.trace)) && guard++ < 64 * 30){ pts.push(st.p.slice()); vel.push(st.v.slice()); nb.push(st.bounces.length); }
  pts.push(st.p.slice()); vel.push(st.v.slice()); nb.push(st.bounces.length);
  const bad = [];
  const last = how === 'air' ? pts.length - 1 : pts.length;   // молотов в воздухе: последняя точка — огонь на полу под ним, не ход
  for (let i = 1; i < last; i++){
    const a = pts[i-1], b = pts[i];
    if (b.some(x => !isFinite(x))) { bad.push(['nan', i]); break; }
    const step = Math.hypot(b[0]-a[0], b[1]-a[1], b[2]-a[2]), vmax = Math.hypot(...vel[i-1]) + P.GRAV / P.TICK + 1;
    if (step > vmax / P.TICK * 1.01 + 0.2) bad.push(['jump', i, +step.toFixed(2)]);
    if (step > 1e-6 && W.trace(a, b, P.R - 0.5) && nb[i] === nb[i-1]) bad.push(['tunnel', i]);
    const h0 = Math.atan2(vel[i-1][1], vel[i-1][0]), h1 = Math.atan2(vel[i][1], vel[i][0]);
    const hs0 = Math.hypot(vel[i-1][0], vel[i-1][1]), hs1 = Math.hypot(vel[i][0], vel[i][1]);
    let dh = Math.abs(h1 - h0); if (dh > Math.PI) dh = 2*Math.PI - dh;
    if (hs0 > 1 && hs1 > 1 && dh > 1e-6 && nb[i] === nb[i-1]) bad.push(['turn', i, +(dh*180/Math.PI).toFixed(2)]);
  }
  check((label || type) + ': инварианты (нет туннеля / поворота без касания / телепорта / NaN)', bad.length === 0, bad.slice(0, 4));
  return { st, how, pts, vel };
}
const near = (a, b, e) => Math.abs(a - b) <= e;

// 1. свободный бросок: дуга совпадает с формулой (средняя скорость за тик — точна при постоянной тяжести)
{
  const W = world([], []), v = [400, 100, 300];
  const r = fly(W, 'flash', [0, 0, 100], v, 'свободный бросок');
  const k = 50, q = r.pts[k], t = k / P.TICK;
  check('свободный бросок: x, y, z по формуле', near(q[0], 400*t, 1e-6) && near(q[1], 100*t, 1e-6) && near(q[2], 100 + 300*t - P.GRAV*t*t/2, 1e-6), q);
  check('свободный бросок: флешка — по запалу ' + P.FUSE.flash + ' с', r.how === 'fuse' && near(r.st.t, P.FUSE.flash, 1/P.TICK + 1e-9), [r.how, r.st.t]);
}
// 2. отскок от пола: нормаль вверх, вертикаль отражена × 0,45, по горизонтали направление то же
{
  const W = world(floorTris(0, 2000), []);
  const r = fly(W, 'he', [0, 0, 60], [300, 200, -100], 'пол');
  const b = r.st.bounces[0];
  check('пол: первое касание — пол, нормаль (0, 0, 1)', b && b[3] === 'floor' && near(b[6], 1, 1e-6), b);
  check('пол: центр гранаты на R над полом', b && near(b[2], P.R + P.PUSH, 1e-3), b && b[2]);
  const i = r.st.bounces.length && r.vel.findIndex((v, j) => j > 0 && v[2] > 0);
  const vb = r.vel[i - 1], va = r.vel[i];
  check('пол: направление по горизонтали не меняется', near(Math.atan2(va[1], va[0]), Math.atan2(200, 300), 1e-6), [va]);
  check('пол: скорость × 0,45 (вдоль) и отражение (поперёк)', near(va[0], vb[0]*P.ELAST, 1e-6) && va[2] > 0, [vb, va]);
}
// 3. вертикальная стена: отражение по нормали стены, без поворота на 90°
{
  const W = world(floorTris(0, 2000), [[100, -500, 0, 120, 500, 300]]);
  const r = fly(W, 'flash', [0, 0, 64], [500, 300, 50], 'стена');
  const b = r.st.bounces.find(q => q[3] === 'wall');
  check('стена: касание, нормаль (−1, 0, 0), центр на R от стены', b && near(b[4], -1, 1e-6) && near(b[0], 100 - P.R - P.PUSH, 1e-3), b);
  const j = r.vel.findIndex(v => v[0] < 0), va = r.vel[j];
  check('стена: vx сменил знак, vy тот же знак (отражение, не поворот)', va && va[1] > 0 && near(va[0] / va[1], -500/300, 0.05), va);
}
// 4. под навесом: низкая дуга проходит под крышей (без касаний крыши), высокая — падает на крышу и лежит там
{
  const W = world(floorTris(0, 3000), [[300, -400, 150, 900, 400, 170]]);
  const low = fly(W, 'smoke', [0, 0, 40], [700, 0, 150], 'под навесом');
  check('под навесом: крышу не задела (ни одного касания выше 100)', !low.st.bounces.some(q => q[2] > 100), low.st.bounces.map(q => q.slice(0, 4)));
  check('под навесом: прошёл под крышей (точки под ней ниже 150 − R)', low.pts.filter(q => q[0] > 300 && q[0] < 900).length > 5 && low.pts.every(q => q[0] < 300 || q[0] > 900 || q[2] < 150 - P.R), [low.how, low.st.p]);
  const high = fly(W, 'smoke', [0, 0, 60], [200, 0, 520], 'на крышу');
  const top = high.st.bounces.find(q => q[2] > 160);
  check('на крышу: касание верха крыши, нормаль вверх', top && top[3] === 'floor' && near(top[2], 170 + P.R + P.PUSH, 1e-3), high.st.bounces.map(q => q.slice(0, 4)));
  check('на крышу: смок остановился на крыше (не пропал)', high.how === 'stop' && high.st.p[2] > 160, [high.how, high.st.p]);
  const hit = fly(W, 'flash', [400, 0, 64], [100, 0, 400], 'в крышу снизу');
  check('в крышу снизу: касание низа, нормаль вниз', hit.st.bounces.some(q => near(q[6], -1, 1e-6)), hit.st.bounces.map(q => q.slice(0, 7)));
}
// 5. ступень: катящаяся граната упирается в подступенок (стена), прыгающая — ложится на ступень
{
  const W = world(floorTris(0, 3000), [[200, -500, 0, 1000, 500, 16]]);
  const roll = fly(W, 'smoke', [180, 0, P.R + 0.05], [600, 0, 0], 'ступень (качение)');
  check('ступень: подступенок — стена, нормаль (−1, 0, 0)', roll.st.bounces.some(q => q[3] === 'wall' && near(q[4], -1, 1e-6)), roll.st.bounces.map(q => q.slice(0, 5)));
  check('ступень: не прошла сквозь подступенок', roll.st.p[0] < 200, roll.st.p);
  const jump = fly(W, 'smoke', [0, 0, 40], [300, 0, 200], 'ступень (сверху)');
  check('ступень: легла на верх ступени (z = 16 + R)', jump.how === 'stop' && near(jump.st.p[2], 16 + P.R + P.PUSH, 0.01), jump.st.p);
}
// 6. угол двух стен: без туннеля, остаётся внутри угла
{
  const W = world(floorTris(0, 3000), [[100, -500, 0, 140, 140, 300], [-500, 100, 0, 140, 140, 300]]);
  const r = fly(W, 'he', [0, 0, 50], [600, 600, 100], 'угол');
  check('угол: касания обеих стен', r.st.bounces.some(q => near(q[4], -1, 1e-6)) && r.st.bounces.some(q => near(q[5], -1, 1e-6)), r.st.bounces.map(q => q.slice(3, 7)));
  check('угол: граната внутри угла (x < 100, y < 100)', r.pts.every(q => q[0] < 100 && q[1] < 100), r.st.p);
}
// 7. наклон 30°: нормаль поверхности из треугольника; молотов на 30° рвётся, на 45° — отскакивает
{
  const slope = a => { const s = Math.tan(a * Math.PI / 180); return [[0,-500,0, 1000,-500,1000*s, 1000,500,1000*s], [0,-500,0, 1000,500,1000*s, 0,500,0]]; };
  const W30 = world(slope(29.9), []), W45 = world(slope(45), []);
  const a = fly(W30, 'molotov', [500, 0, 600], [0, 0, -100], 'наклон 30° (молотов)');
  const b0 = a.st.bounces[0];
  check('наклон 30°: нормаль (−sin, 0, cos)', b0 && near(b0[4], -Math.sin(29.9*Math.PI/180), 1e-4) && near(b0[6], Math.cos(29.9*Math.PI/180), 1e-4), b0);
  check('наклон 30°: молотов сработал о пол', a.how === 'floor', a.how);
  const b = fly(W45, 'molotov', [500, 0, 900], [0, 0, -100], 'наклон 45° (молотов)');
  check('наклон 45°: молотов отскочил (не сработал о круть)', b.st.bounces.length >= 1 && b.how !== 'floor', [b.how, b.st.bounces.length]);
  check('наклон 45°: после касания летит вниз по склону (−x)', b.vel.some(v => v[0] < -1), null);
}
// 8. несколько отскоков подряд: высоты отскоков убывают, смок останавливается
{
  const W = world(floorTris(0, 3000), []);
  const r = fly(W, 'smoke', [0, 0, 300], [100, 0, 0], 'серия отскоков');
  const peaks = []; for (let i = 1; i + 1 < r.pts.length; i++) if (r.vel[i-1][2] > 0 && r.vel[i][2] <= 0) peaks.push(r.pts[i][2]);
  check('серия: ≥ 2 отскока, пики убывают', peaks.length >= 2 && peaks.every((h, i) => !i || h < peaks[i-1]), peaks.map(h => +h.toFixed(1)));
  check('серия: смок остановился на полу', r.how === 'stop' && near(r.st.p[2], P.R + P.PUSH, 0.01), [r.how, r.st.p]);
}
// 9. туннель: тонкая пластина (треугольники нулевой толщины и блок 0,5 ед.), скорость 5000 ед/с (≈ 78 ед. за тик)
{
  const plate = [[200,-300,-300, 200,300,-300, 200,300,300], [200,-300,-300, 200,300,300, 200,-300,300]];
  const r1 = fly(world(plate, []), 'flash', [0, 0, 0], [5000, 0, 0], 'тонкая пластина, 5000 ед/с');
  check('туннель: о пластину нулевой толщины — удар', r1.st.bounces.length > 0 && r1.pts.every(q => q[0] < 200), r1.st.bounces.map(q => q.slice(0, 4)));
  const r2 = fly(world([], [[200, -300, -300, 200.5, 300, 300]]), 'flash', [0, 0, 0], [5000, 0, 0], 'блок 0,5 ед., 5000 ед/с');
  check('туннель: о блок 0,5 ед. — удар', r2.st.bounces.length > 0 && r2.pts.every(q => q[0] < 200), r2.st.bounces.length);
}
// 10. проём: в проём 40 ед. пролетает, в щель 3 ед. (уже гранаты 4 ед.) — нет
{
  const wallGap = g => world([], [[300, -500, -500, 320, -g/2, 500], [300, g/2, -500, 320, 500, 500]]);
  const r1 = fly(wallGap(40), 'flash', [0, 0, 0], [800, 0, 0], 'проём 40 ед.');
  check('проём 40: пролетела без касаний', r1.st.bounces.length === 0 && r1.st.p[0] > 320, r1.st.p);
  const r2 = fly(wallGap(3), 'flash', [0, 0, 0], [800, 0, 0], 'щель 3 ед.');
  check('щель 3: граната (4 ед.) не пролезла', r2.st.bounces.length > 0 && r2.pts.every(q => q[0] < 300), r2.st.p);
}
// 11. типы гранат: смок — остановка, флешка / HE — запал (в т. ч. на полу), молотов — пол или 2 с в воздухе (огонь на пол под ним)
{
  const W = world(floorTris(0, 3000), []);
  const he = fly(W, 'he', [0, 0, 64], [200, 0, 100], 'HE');
  check('HE: по запалу, лёжа на полу', he.how === 'fuse' && near(he.st.t, P.FUSE.he, 1/P.TICK + 1e-9) && he.st.p[2] < 10, [he.how, he.st.t, he.st.p]);
  const mo = fly(world(floorTris(-1000, 3000), []), 'molotov', [0, 0, 64], [100, 0, 0], 'молотов в воздухе');
  check('молотов: 2 с в воздухе — сработал, огонь на полу под ним', mo.how === 'air' && near(mo.st.p[2], -1000 + P.R, 0.1), [mo.how, mo.st.p]);
}
// 12. детерминизм: тот же бросок — те же числа
{
  const W = world(floorTris(0, 3000), [[400, -100, 0, 450, 100, 80]]);
  const L1 = NP.nadeLaunch({ pos: [0, 0, 0], yaw: 10, pitch: -20, strength: 1, vel: [0, 0, 0] }, W.trace);
  const a = NP.nadeFly('smoke', L1.p, L1.v, W.trace, { path: true }), b = NP.nadeFly('smoke', L1.p, L1.v, W.trace, { path: true });
  check('детерминизм: два одинаковых броска — бит в бит', JSON.stringify(a) === JSON.stringify(b), null);
}
// 13. бросок у стены: точка вылета не за стеной (TraceHull от глаз до руки)
{
  const W = world([], [[10, -100, -100, 30, 100, 200]]);
  const L = NP.nadeLaunch({ pos: [0, 0, 0], yaw: 0, pitch: 0, strength: 1, vel: [0, 0, 0] }, W.trace);
  check('вылет у стены: граната перед стеной (x + R < 10)', L.p[0] + P.R < 10, L.p);
}
// 14. подбор броска (nadeAim) в известную точку на ровном полу: ошибка мала; бросок тем же полётом попадает туда же
{
  const W = world(floorTris(0, 5000), []);
  const s = NP.nadeAim('smoke', [0, 0, 0], [900, 300, 0], W.trace, {});
  const L = NP.nadeLaunch({ pos: [0, 0, 0], yaw: s.yaw, pitch: s.pitch, strength: s.strength, jump: s.jump, vel: [0, 0, 0] }, W.trace);
  const f = NP.nadeFly('smoke', L.p, L.v, W.trace);
  check('nadeAim: смок в точку на полу ≤ 32 ед.', s.err <= 32, s.err);
  check('nadeAim: решение = настоящий полёт (та же точка)', Math.hypot(f.det[0] - s.det[0], f.det[1] - s.det[1], f.det[2] - s.det[2]) < 1e-6, [f.det, s.det]);
}

// ---------- карты: броски про (throws.json) — физикой, инварианты на настоящей геометрии ----------
const fs = require('fs');
for (const map of ['mirage', 'ancient']){
  const W = require(path.join(ROOT, 'tools', 'nades', 'world.js')).load(map);
  const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'maps', map, 'throws.json'))).throws.filter(t => t.det && t.strength != null);
  let n = 0, badInv = 0, within = 0, contacts = 0, nB = 0, wB = 0;
  const byType = {};
  for (let i = 0; i < T.length && n < 400; i += Math.max(1, Math.floor(T.length / 400))){
    const t = T[i], o = Object.assign({}, t, { jump: !!t.jumpBind });
    const fu = P.FUSE[t.type]; o.spawn = fu !== undefined ? Math.max(0, t.det.dt * P.TICK - fu * P.TICK) : undefined;
    const sp = o.spawn !== undefined ? o.spawn : P.SPAWN, tau = sp / P.TICK, pv = o.vel || [0, 0, 0], air = Math.abs(pv[2]) > P.AIR_VZ;
    o.pos = [o.pos[0] + pv[0]*tau, o.pos[1] + pv[1]*tau, o.pos[2] + (air ? pv[2]*tau : 0)];
    const L = NP.nadeLaunch(o, W.trace);
    const st = NP.nadeState(t.type, L.p, L.v); let prev = st.p.slice(), pvv = st.v.slice(), nb = 0, bad = false, g = 0;
    while (!NP.nadeStep(st, W.trace) && g++ < 64*30){
      const turn = Math.hypot(pvv[0], pvv[1]) > 1 && Math.hypot(st.v[0], st.v[1]) > 1 && Math.abs(Math.atan2(st.v[1], st.v[0]) - Math.atan2(pvv[1], pvv[0])) > 1e-6;
      if (st.bounces.length === nb && (turn || W.trace(prev, st.p, P.R - 0.5))) bad = true;
      nb = st.bounces.length; prev = st.p.slice(); pvv = st.v.slice();
    }
    n++; if (bad) badInv++; contacts += st.bounces.length;
    const e = Math.hypot(st.p[0] - t.det.pos[0], st.p[1] - t.det.pos[1], st.p[2] - t.det.pos[2]);
    const bt = byType[t.type] || (byType[t.type] = [0, 0]); bt[0]++; if (e <= 32) { within++; bt[1]++; }
    if (st.bounces.length){ nB++; if (e <= 32) wB++; }
  }
  check(map + ': броски про (' + n + ', сила из throws.json) — инварианты на геометрии карты', badInv === 0, badInv);
  console.log('      ', map, 'в 32 ед. от разрыва про:', (100 * within / n).toFixed(1) + '%', Object.entries(byType).map(([k, v]) => k + ' ' + (100*v[1]/v[0]).toFixed(0) + '%').join(', '), '| касаний', contacts, '| с отскоком:', nB, 'в 32 ед.', (100 * wB / Math.max(1, nB)).toFixed(1) + '%');
  check(map + ': броски про с отскоком (' + nB + ') — ≥ 70 % в 32 ед.', nB > 50 && wB / nB >= 0.7, [nB, wB]);
  check(map + ': броски про, у которых сила подобрана — большинство повторяется (≥ 70 % в 32 ед.)', within / n >= 0.7, within / n);
}
console.log(fails ? 'FAIL: ' + fails + ' из ' + (fails + oks) : 'все ' + oks + ' проверок пройдены');
process.exit(fails ? 1 : 0);
