// В2 (21.10.2026): луч гранаты по геометрии столкновений карты (Node) — trace(A, B) для src/nadephys.js.
// const W = require('./world.js').load('mirage', {playerclip: false, grenadeclip: true}); W.trace(A, B)
// Геометрия — data/maps/<карта>/geom3d/nade_world.bin (tools/nades/export_world.py из world_physics.npz).
// Что останавливает гранату (маска групп столкновений, А2):
//   да  — обычная геометрия (стены, полы, ящики), группы «кроме игроков» (exclude player), csgo_grenadeclip (стены только
//         для гранат), passbullets (решётки, перила), window, небо (отскок);
//   нет — группы, где в exclude есть csgo_thrown_grenade (детали, сквозь которые граната пролетает), playerclip / npcclip
//         (невидимые стены для игроков), ladder.
// Варианты маски — ключи opt (проверка «что её останавливает» — check.js --mask).
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const CELL = 32;

function groupSolid(g, opt) {
  const as = new Set(g.as), ex = new Set(g.exclude);
  if (ex.has('csgo_thrown_grenade')) return !!opt.thrownExcluded;
  if (as.has('ladder')) return false;
  if (as.has('playerclip') || as.has('npcclip')) return !!opt.playerclip;
  if (as.has('csgo_grenadeclip')) return opt.grenadeclip !== false;
  if (as.has('sky')) return true;
  return true;
}

function load(map, opt) {
  opt = opt || {};
  const buf = fs.readFileSync(path.join(ROOT, 'data', 'maps', map, 'geom3d', 'nade_world.bin'));
  if (buf.toString('latin1', 0, 4) !== 'NADW') throw new Error('nade_world.bin: не тот формат');
  const hl = buf.readUInt32LE(8);
  const head = JSON.parse(buf.toString('utf8', 12, 12 + hl));
  let o = 12 + hl; o += (4 - o % 4) % 4;
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
  const tri = new Float32Array(ab, o, head.ntri * 9); o += head.ntri * 36;
  const tg = new Uint8Array(ab, o, head.ntri); o += head.ntri; o += (4 - o % 4) % 4;
  const hs = new Uint32Array(ab, o, head.nhull); o += head.nhull * 4;
  const hn = new Uint32Array(ab, o, head.nhull); o += head.nhull * 4;
  const hg = new Uint8Array(ab, o, head.nhull); o += head.nhull; o += (4 - o % 4) % 4;
  const hp = new Float32Array(ab, o, head.nplane * 4); o += head.nplane * 16;
  const hbb = new Float32Array(ab, o, head.nhull * 6); o += head.nhull * 24;
  const sky = new Float32Array(ab, o, head.nsky * 9); o += head.nsky * 36;
  const tsf = new Uint8Array(ab, o, head.ntri); o += head.ntri;
  const hsf = new Uint8Array(ab, o, head.nhull);
  const solidG = head.groups.map(g => groupSolid(g, opt));

  // все треугольники (обычные + небо) — в один список: N×(p0, e1, e2), флаг неба, группа
  const keepT = []; for (let i = 0; i < head.ntri; i++) if (solidG[tg[i]]) keepT.push(i);
  const NT = keepT.length + head.nsky;
  const P0 = new Float64Array(NT * 3), E1 = new Float64Array(NT * 3), E2 = new Float64Array(NT * 3);
  const NRM = new Float64Array(NT * 3), lo = new Float32Array(NT * 3), hi = new Float32Array(NT * 3);
  const isSky = new Uint8Array(NT), grp = new Uint8Array(NT), srf = new Uint8Array(NT);
  for (let k = 0; k < NT; k++) {
    const src = k < keepT.length ? tri : sky, i = k < keepT.length ? keepT[k] : k - keepT.length, b = i * 9;
    if (k >= keepT.length) { isSky[k] = 1; grp[k] = 255; srf[k] = 255; } else { grp[k] = tg[i]; srf[k] = tsf[i]; }
    for (let a = 0; a < 3; a++) {
      const x0 = src[b + a], x1 = src[b + 3 + a], x2 = src[b + 6 + a];
      P0[k * 3 + a] = x0; E1[k * 3 + a] = x1 - x0; E2[k * 3 + a] = x2 - x0;
      lo[k * 3 + a] = Math.min(x0, x1, x2); hi[k * 3 + a] = Math.max(x0, x1, x2);
    }
    const ax = E1[k * 3], ay = E1[k * 3 + 1], az = E1[k * 3 + 2], bx = E2[k * 3], by = E2[k * 3 + 1], bz = E2[k * 3 + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const L = Math.hypot(nx, ny, nz) || 1;
    NRM[k * 3] = nx / L; NRM[k * 3 + 1] = ny / L; NRM[k * 3 + 2] = nz / L;
  }
  // блоки
  const keepH = []; for (let i = 0; i < head.nhull; i++) if (solidG[hg[i]]) keepH.push(i);
  const NH = keepH.length, hlo = new Float32Array(NH * 3), hhi = new Float32Array(NH * 3);
  for (let k = 0; k < NH; k++) for (let a = 0; a < 3; a++) { hlo[k * 3 + a] = hbb[keepH[k] * 6 + a]; hhi[k * 3 + a] = hbb[keepH[k] * 6 + 3 + a]; }
  // сетка по XY
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let k = 0; k < NT; k++) { x0 = Math.min(x0, lo[k * 3]); y0 = Math.min(y0, lo[k * 3 + 1]); x1 = Math.max(x1, hi[k * 3]); y1 = Math.max(y1, hi[k * 3 + 1]); }
  x0 -= CELL; y0 -= CELL; x1 += CELL; y1 += CELL;
  const nx = Math.ceil((x1 - x0) / CELL) + 1, ny = Math.ceil((y1 - y0) / CELL) + 1;
  const cl = (v, n) => Math.max(0, Math.min(n - 1, v));
  function csr(N, LO, HI) {
    const cnt = new Uint32Array(nx * ny + 1);
    const span = k => [cl(Math.floor((LO[k * 3] - x0) / CELL), nx), cl(Math.floor((HI[k * 3] - x0) / CELL), nx),
      cl(Math.floor((LO[k * 3 + 1] - y0) / CELL), ny), cl(Math.floor((HI[k * 3 + 1] - y0) / CELL), ny)];
    for (let k = 0; k < N; k++) { const [i0, i1, j0, j1] = span(k); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) cnt[i * ny + j + 1]++; }
    for (let c = 0; c < nx * ny; c++) cnt[c + 1] += cnt[c];
    const items = new Uint32Array(cnt[nx * ny]), fill = cnt.slice(0, nx * ny);
    for (let k = 0; k < N; k++) { const [i0, i1, j0, j1] = span(k); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) items[fill[i * ny + j]++] = k; }
    return [cnt, items];
  }
  const [tS, tI] = csr(NT, lo, hi);
  const [hS, hI] = csr(NH, hlo, hhi);
  const stampT = new Uint32Array(NT), stampH = new Uint32Array(NH); let stamp = 0;

  function trace(A, B) {
    const Dx = B[0] - A[0], Dy = B[1] - A[1], Dz = B[2] - A[2];
    const i0 = cl(Math.floor((Math.min(A[0], B[0]) - x0) / CELL), nx), i1 = cl(Math.floor((Math.max(A[0], B[0]) - x0) / CELL), nx);
    const j0 = cl(Math.floor((Math.min(A[1], B[1]) - y0) / CELL), ny), j1 = cl(Math.floor((Math.max(A[1], B[1]) - y0) / CELL), ny);
    const zlo = Math.min(A[2], B[2]), zhi = Math.max(A[2], B[2]);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 64) {      // длинный луч — делим (шаг полёта короткий, это редкость)
      const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
      const h1 = trace(A, M); if (h1) { h1.f *= 0.5; return h1; }
      const h2 = trace(M, B); if (h2) { h2.f = 0.5 + h2.f * 0.5; return h2; }
      return null;
    }
    stamp++; if (stamp === 0xffffffff) { stampT.fill(0); stampH.fill(0); stamp = 1; }
    let best = 2, bk = -1, bn = null, bsky = false, bg = 0, bs = 255;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const c = i * ny + j;
      for (let q = tS[c]; q < tS[c + 1]; q++) {
        const k = tI[q]; if (stampT[k] === stamp) continue; stampT[k] = stamp;
        if (hi[k * 3 + 2] < zlo || lo[k * 3 + 2] > zhi) continue;
        const e1x = E1[k * 3], e1y = E1[k * 3 + 1], e1z = E1[k * 3 + 2], e2x = E2[k * 3], e2y = E2[k * 3 + 1], e2z = E2[k * 3 + 2];
        const hx = Dy * e2z - Dz * e2y, hy = Dz * e2x - Dx * e2z, hz = Dx * e2y - Dy * e2x;
        const a = e1x * hx + e1y * hy + e1z * hz; if (a > -1e-9 && a < 1e-9) continue;
        const f = 1 / a, sx = A[0] - P0[k * 3], sy = A[1] - P0[k * 3 + 1], sz = A[2] - P0[k * 3 + 2];
        const u = f * (sx * hx + sy * hy + sz * hz); if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
        const vv = f * (Dx * qx + Dy * qy + Dz * qz); if (vv < 0 || u + vv > 1) continue;
        const t = f * (e2x * qx + e2y * qy + e2z * qz);
        if (t > 1e-7 && t <= 1 && t < best) { best = t; bk = k; bsky = !!isSky[k]; bg = grp[k]; bs = srf[k]; bn = null; }
      }
      for (let q = hS[c]; q < hS[c + 1]; q++) {
        const k = hI[q]; if (stampH[k] === stamp) continue; stampH[k] = stamp;
        if (hhi[k * 3 + 2] < zlo || hlo[k * 3 + 2] > zhi) continue;
        const h = keepH[k]; let t0 = 0, t1 = 1, pn = -1, out = false;
        for (let j = hs[h]; j < hs[h] + hn[h]; j++) {
          const nx_ = hp[j * 4], ny_ = hp[j * 4 + 1], nz_ = hp[j * 4 + 2], d = hp[j * 4 + 3];
          const dn = nx_ * Dx + ny_ * Dy + nz_ * Dz, num = d - (nx_ * A[0] + ny_ * A[1] + nz_ * A[2]);
          if (Math.abs(dn) < 1e-12) { if (num < 0) { out = true; break; } continue; }
          const tt = num / dn;
          if (dn < 0) { if (tt > t0) { t0 = tt; pn = j; } } else if (tt < t1) t1 = tt;
          if (t0 > t1) { out = true; break; }
        }
        if (out || pn < 0 || t0 <= 1e-7 || t0 >= best) continue;   // начали внутри блока (pn < 0) — не считаем
        best = t0; bk = -2; bsky = false; bg = hg[h]; bs = hsf[h]; bn = [hp[pn * 4], hp[pn * 4 + 1], hp[pn * 4 + 2]];
      }
    }
    if (best > 1) return null;
    let n = bn;
    if (bk >= 0) {
      n = [NRM[bk * 3], NRM[bk * 3 + 1], NRM[bk * 3 + 2]];
      if (n[0] * Dx + n[1] * Dy + n[2] * Dz > 0) n = [-n[0], -n[1], -n[2]];   // нормаль — навстречу полёту
    }
    return { f: best, n: n, sky: bsky, g: bg, m: bs < 255 ? head.surf[bs] : 'sky' };
  }
  return { trace, head, ntri: NT, nhull: NH, opt };
}

module.exports = { load };
