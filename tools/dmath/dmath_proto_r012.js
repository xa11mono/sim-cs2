// (Р0.12, 24.11) Прототип общей математики dmath — ВНЕ ИГРЫ. Построчный перенос Rust libm 0.2.16 (src/math: sin, cos, k_sin, k_cos,
// rem_pio2, rem_pio2_large, atan, atan2, acos, exp, log, pow, hypot, scalbn) на JavaScript: только + − × ÷ √ и операции с битами,
// без FMA и без Math.sin/cos/… движка — чтобы TS и Rust (нативно и WASM) давали одинаковые биты (АР-05, rebuild/MASTER_PLAN.md Р2).
// Порядок операций — как в Rust; целые u32 / i32 — явно (>>> 0, | 0); «as i32» в Rust — отбрасывание дробной части (Math.trunc).
// Особые случаи — как в libm (C99): pow(1, NaN) = 1, pow(-1, ±∞) = 1 — в JS Math.pow даёт NaN (различие контракта — отчёт Р0.12).
'use strict';
const { IPIO2, PIO2T } = require('./tables.js');
const F = new Float64Array(1), U = new Uint32Array(F.buffer);
if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) throw new Error('dmath: нужен порядок байт little-endian');
const hi = x => { F[0] = x; return U[1]; };                       // старшее слово (u32)
const lo = x => { F[0] = x; return U[0]; };                       // младшее слово (u32)
const mk = (h, l) => { U[1] = h >>> 0; U[0] = l >>> 0; return F[0]; };
const setLo = (x, l) => { F[0] = x; U[0] = l >>> 0; return F[0]; };
const setHi = (x, h) => { F[0] = x; U[1] = h >>> 0; return F[0]; };
const trunc = Math.trunc, sqrt = Math.sqrt, floor = Math.floor, fabs = Math.abs;   // точные операции IEEE (одинаковы везде)

function scalbn(x, n) {
  const fmax = mk(0x7fe00000, 0), mul = mk(0x00100000, 0) * mk(0x43400000, 0), add = 1022 - 53;   // 2^1023; 2^-1022 · 2^53
  if (n > 1023) { x *= fmax; n -= 1023; if (n > 1023) { x *= fmax; n -= 1023; if (n > 1023) n = 1023; } }
  else if (n < -1022) { x *= mul; n += add; if (n < -1022) { x *= mul; n += add; if (n < -1022) n = -1022; } }
  return x * mk((0x3ff + n) << 20, 0);
}
// ---- sin / cos ----
const S1 = -1.66666666666666324348e-01, S2 = 8.33333333332248946124e-03, S3 = -1.98412698298579493134e-04, S4 = 2.75573137070700676789e-06, S5 = -2.50507602534068634195e-08, S6 = 1.58969099521155010221e-10;
function k_sin(x, y, iy) { const z = x * x, w = z * z, r = S2 + z * (S3 + z * S4) + z * w * (S5 + z * S6), v = z * x; return iy === 0 ? x + v * (S1 + z * r) : x - ((z * (0.5 * y - v * r) - y) - v * S1); }
const C1 = 4.16666666666666019037e-02, C2 = -1.38888888888741095749e-03, C3 = 2.48015872894767294178e-05, C4 = -2.75573143513906633035e-07, C5 = 2.08757232129817482790e-09, C6 = -1.13596475577881948265e-11;
function k_cos(x, y) { const z = x * x, w = z * z, r = z * (C1 + z * (C2 + z * C3)) + w * w * (C4 + z * (C5 + z * C6)), hz = 0.5 * z, w2 = 1.0 - hz; return w2 + (((1.0 - w2) - hz) + (z * r - x * y)); }
const EPS = 2.2204460492503131e-16, TO_INT = 1.5 / EPS, INV_PIO2 = 6.36619772367581382433e-01, PIO2_1 = 1.57079632673412561417e+00, PIO2_1T = 6.07710050650619224932e-11,
  PIO2_2 = 6.07710050630396597660e-11, PIO2_2T = 2.02226624879595063154e-21, PIO2_3 = 2.02226624871116645580e-21, PIO2_3T = 8.47842766036889956997e-32;
function medium(x, ix) {
  const f_n = (x * INV_PIO2 + TO_INT) - TO_INT, n = trunc(f_n) | 0;
  let r = x - f_n * PIO2_1, w = f_n * PIO2_1T, y0 = r - w;
  const ex = ix >>> 20; let ey = (hi(y0) >>> 20) & 0x7ff;
  if (ex - ey > 16) { let t = r; w = f_n * PIO2_2; r = t - w; w = f_n * PIO2_2T - ((t - r) - w); y0 = r - w; ey = (hi(y0) >>> 20) & 0x7ff;
    if (ex - ey > 49) { t = r; w = f_n * PIO2_3; r = t - w; w = f_n * PIO2_3T - ((t - r) - w); y0 = r - w; } }
  return [n, y0, (r - y0) - w];
}
function rem_pio2(x) {
  const sign = hi(x) >>> 31, ix = hi(x) & 0x7fffffff;
  if (ix <= 0x400f6a7a) {
    if ((ix & 0xfffff) === 0x921fb) return medium(x, ix);
    if (ix <= 0x4002d97c) { if (sign === 0) { const z = x - PIO2_1, y0 = z - PIO2_1T; return [1, y0, (z - y0) - PIO2_1T]; } const z = x + PIO2_1, y0 = z + PIO2_1T; return [-1, y0, (z - y0) + PIO2_1T]; }
    if (sign === 0) { const z = x - 2.0 * PIO2_1, y0 = z - 2.0 * PIO2_1T; return [2, y0, (z - y0) - 2.0 * PIO2_1T]; }
    const z = x + 2.0 * PIO2_1, y0 = z + 2.0 * PIO2_1T; return [-2, y0, (z - y0) + 2.0 * PIO2_1T];
  }
  if (ix <= 0x401c463b) {
    if (ix <= 0x4015fdbc) {
      if (ix === 0x4012d97c) return medium(x, ix);
      if (sign === 0) { const z = x - 3.0 * PIO2_1, y0 = z - 3.0 * PIO2_1T; return [3, y0, (z - y0) - 3.0 * PIO2_1T]; }
      const z = x + 3.0 * PIO2_1, y0 = z + 3.0 * PIO2_1T; return [-3, y0, (z - y0) + 3.0 * PIO2_1T];
    }
    if (ix === 0x401921fb) return medium(x, ix);
    if (sign === 0) { const z = x - 4.0 * PIO2_1, y0 = z - 4.0 * PIO2_1T; return [4, y0, (z - y0) - 4.0 * PIO2_1T]; }
    const z = x + 4.0 * PIO2_1, y0 = z + 4.0 * PIO2_1T; return [-4, y0, (z - y0) + 4.0 * PIO2_1T];
  }
  if (ix < 0x413921fb) return medium(x, ix);
  if (ix >= 0x7ff00000) { const y0 = x - x; return [0, y0, y0]; }
  // большие |x|: Payne–Hanek
  let z = mk((hi(x) & 0x000fffff) | ((0x3ff + 23) << 20), lo(x));
  const tx = [0, 0, 0], x1p24 = mk(0x41700000, 0);
  for (let i = 0; i < 2; i++) { tx[i] = trunc(z); z = (z - tx[i]) * x1p24; }
  tx[2] = z; let i = 2; while (i !== 0 && tx[i] === 0.0) i--;
  const ty = [0, 0, 0], n = rem_pio2_large(tx.slice(0, i + 1), ty, (ix >> 20) - (0x3ff + 23), 1);
  return sign !== 0 ? [-n, -ty[0], -ty[1]] : [n, ty[0], ty[1]];
}
function rem_pio2_large(x, y, e0, prec) {
  const x1p24 = mk(0x41700000, 0), x1p_24 = mk(0x3e700000, 0), jk = [3, 4, 4, 6][prec], jp = jk, nx = x.length, jx = nx - 1;
  const f = new Array(20).fill(0), fq = new Array(20).fill(0), q = new Array(20).fill(0), iq = new Array(20).fill(0);
  let jv = trunc((e0 - 3) / 24); if (jv < 0) jv = 0;
  let q0 = e0 - 24 * (jv + 1), j = jv - jx, fw, n, ih, z;
  const m = jx + jk;
  for (let i = 0; i <= m; i++) { f[i] = j < 0 ? 0 : IPIO2[j]; j++; }
  for (let i = 0; i <= jk; i++) { fw = 0; for (let jj = 0; jj <= jx; jj++) fw += x[jj] * f[jx + i - jj]; q[i] = fw; }
  let jz = jk;
  for (;;) {
    let i = 0; z = q[jz];
    for (let jj = jz; jj >= 1; jj--) { fw = trunc(x1p_24 * z); iq[i] = trunc(z - x1p24 * fw) | 0; z = q[jj - 1] + fw; i++; }
    z = scalbn(z, q0); z -= 8.0 * floor(z * 0.125); n = trunc(z) | 0; z -= n; ih = 0;
    if (q0 > 0) { i = iq[jz - 1] >> (24 - q0); n += i; iq[jz - 1] -= i << (24 - q0); ih = iq[jz - 1] >> (23 - q0); }
    else if (q0 === 0) ih = iq[jz - 1] >> 23;
    else if (z >= 0.5) ih = 2;
    if (ih > 0) {
      n += 1; let carry = 0;
      for (let k = 0; k < jz; k++) { const v = iq[k]; if (carry === 0) { if (v !== 0) { carry = 1; iq[k] = 0x1000000 - v; } } else iq[k] = 0xffffff - v; }
      if (q0 > 0) { if (q0 === 1) iq[jz - 1] &= 0x7fffff; else if (q0 === 2) iq[jz - 1] &= 0x3fffff; }
      if (ih === 2) { z = 1.0 - z; if (carry !== 0) z -= scalbn(1.0, q0); }
    }
    if (z === 0.0) {
      let jj = 0; for (let k = jz - 1; k >= jk; k--) jj |= iq[k];
      if (jj === 0) {
        let k = 1; while (iq[jk - k] === 0) k++;
        for (let ii = jz + 1; ii <= jz + k; ii++) { f[jx + ii] = IPIO2[jv + ii]; fw = 0; for (let t = 0; t <= jx; t++) fw += x[t] * f[jx + ii - t]; q[ii] = fw; }
        jz += k; continue;
      }
    }
    break;
  }
  if (z === 0.0) { jz -= 1; q0 -= 24; while (iq[jz] === 0) { jz -= 1; q0 -= 24; } }
  else { z = scalbn(z, -q0); if (z >= x1p24) { fw = trunc(x1p_24 * z); iq[jz] = trunc(z - x1p24 * fw) | 0; jz += 1; q0 += 24; iq[jz] = fw | 0; } else iq[jz] = trunc(z) | 0; }
  fw = scalbn(1.0, q0);
  for (let i = jz; i >= 0; i--) { q[i] = fw * iq[i]; fw *= x1p_24; }
  for (let i = jz; i >= 0; i--) { fw = 0; let k = 0; while (k <= jp && k <= jz - i) { fw += PIO2T[k] * q[i + k]; k++; } fq[jz - i] = fw; }
  // prec 1 (единственный вызов из rem_pio2)
  fw = 0; for (let i = jz; i >= 0; i--) fw += fq[i];
  y[0] = ih === 0 ? fw : -fw; fw = fq[0] - fw; for (let i = 1; i <= jz; i++) fw += fq[i]; y[1] = ih === 0 ? fw : -fw;
  return n & 7;
}
function sin(x) {
  const ix = hi(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) { if (ix < 0x3e500000) return x; return k_sin(x, 0.0, 0); }
  if (ix >= 0x7ff00000) return x - x;
  const [n, y0, y1] = rem_pio2(x);
  switch (n & 3) { case 0: return k_sin(y0, y1, 1); case 1: return k_cos(y0, y1); case 2: return -k_sin(y0, y1, 1); default: return -k_cos(y0, y1); }
}
function cos(x) {
  const ix = hi(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) { if (ix < 0x3e46a09e) { if (trunc(x) === 0) return 1.0; } return k_cos(x, 0.0); }
  if (ix >= 0x7ff00000) return x - x;
  const [n, y0, y1] = rem_pio2(x);
  switch (n & 3) { case 0: return k_cos(y0, y1); case 1: return -k_sin(y0, y1, 1); case 2: return -k_cos(y0, y1); default: return k_sin(y0, y1, 1); }
}
// ---- atan / atan2 / acos ----
const ATANHI = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT = [3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01, 9.09088713343650656196e-02,
  -7.69187620504482999495e-02, 6.66107313738753120669e-02, -5.83357013379057348645e-02, 4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02];
function atan(x) {
  let ix = hi(x); const sign = ix >>> 31; ix &= 0x7fffffff;
  if (ix >= 0x44100000) { if (x !== x) return x; const z = ATANHI[3] + mk(0, 0x03800000); return sign !== 0 ? -z : z; }
  let id;
  if (ix < 0x3fdc0000) { if (ix < 0x3e400000) return x; id = -1; }
  else { x = fabs(x);
    if (ix < 0x3ff30000) { if (ix < 0x3fe60000) { x = (2. * x - 1.) / (2. + x); id = 0; } else { x = (x - 1.) / (x + 1.); id = 1; } }
    else if (ix < 0x40038000) { x = (x - 1.5) / (1. + 1.5 * x); id = 2; }
    else { x = -1. / x; id = 3; } }
  const z = x * x, w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) return x - x * (s1 + s2);
  const r = ATANHI[id] - (x * (s1 + s2) - ATANLO[id] - x);
  return sign !== 0 ? -r : r;
}
const PI = 3.1415926535897931160E+00, PI_LO = 1.2246467991473531772E-16;
function atan2(y, x) {
  if (x !== x || y !== y) return x + y;
  let ix = hi(x); const lx = lo(x); let iy = hi(y); const ly = lo(y);
  if ((((ix - 0x3ff00000) >>> 0) | lx) === 0) return atan(y);
  const m = ((iy >>> 31) & 1) | ((ix >>> 30) & 2);
  ix &= 0x7fffffff; iy &= 0x7fffffff;
  if ((iy | ly) === 0) return m === 0 || m === 1 ? y : m === 2 ? PI : -PI;
  if ((ix | lx) === 0) return m & 1 ? -PI / 2.0 : PI / 2.0;
  if (ix === 0x7ff00000) {
    if (iy === 0x7ff00000) return m === 0 ? PI / 4.0 : m === 1 ? -PI / 4.0 : m === 2 ? 3.0 * PI / 4.0 : -3.0 * PI / 4.0;
    return m === 0 ? 0.0 : m === 1 ? -0.0 : m === 2 ? PI : -PI;
  }
  if (((ix + (64 << 20)) >>> 0) < (iy >>> 0) || iy === 0x7ff00000) return m & 1 ? -PI / 2.0 : PI / 2.0;
  const z = ((m & 2) !== 0 && ((iy + (64 << 20)) >>> 0) < (ix >>> 0)) ? 0.0 : atan(fabs(y / x));
  return m === 0 ? z : m === 1 ? -z : m === 2 ? PI - (z - PI_LO) : (z - PI_LO) - PI;
}
const PIO2_HI = 1.57079632679489655800e+00, PIO2_LO = 6.12323399573676603587e-17, PS0 = 1.66666666666666657415e-01, PS1 = -3.25565818622400915405e-01,
  PS2 = 2.01212532134862925881e-01, PS3 = -4.00555345006794114027e-02, PS4 = 7.91534994289814532176e-04, PS5 = 3.47933107596021167570e-05,
  QS1 = -2.40339491173441421878e+00, QS2 = 2.02094576023350569471e+00, QS3 = -6.88283971605453293030e-01, QS4 = 7.70381505559019352791e-02;
function acos_r(z) { const p = z * (PS0 + z * (PS1 + z * (PS2 + z * (PS3 + z * (PS4 + z * PS5))))), q = 1.0 + z * (QS1 + z * (QS2 + z * (QS3 + z * QS4))); return p / q; }
function acos(x) {
  const x1p_120f = mk(0x38700000, 0), hx = hi(x), ix = hx & 0x7fffffff;
  if (ix >= 0x3ff00000) { const lx = lo(x); if ((((ix - 0x3ff00000) >>> 0) | lx) === 0) { if ((hx >>> 31) !== 0) return 2. * PIO2_HI + x1p_120f; return 0.; } return 0. / (x - x); }
  if (ix < 0x3fe00000) { if (ix <= 0x3c600000) return PIO2_HI + x1p_120f; return PIO2_HI - (x - (PIO2_LO - x * acos_r(x * x))); }
  if ((hx >>> 31) !== 0) { const z = (1.0 + x) * 0.5, s = sqrt(z), w = acos_r(z) * s - PIO2_LO; return 2. * (PIO2_HI - (s + w)); }
  const z = (1.0 - x) * 0.5, s = sqrt(z), df = setLo(s, 0), c = (z - df * df) / (s + df), w = acos_r(z) * s + c;
  return 2. * (df + w);
}
// ---- exp / log / pow ----
const HALF = [0.5, -0.5], LN2HI = 6.93147180369123816490e-01, LN2LO = 1.90821492927058770002e-10, INVLN2 = 1.44269504088896338700e+00,
  P1 = 1.66666666666666019037e-01, P2 = -2.77777777770155933842e-03, P3 = 6.61375632143793436117e-05, P4 = -1.65339022054652515390e-06, P5 = 4.13813679705723846039e-08;
function exp(x) {
  const x1p1023 = mk(0x7fe00000, 0);
  let hx = hi(x); const sign = hx >>> 31; hx &= 0x7fffffff;
  let hi_, lo_, k;
  if (hx >= 0x4086232b) { if (x !== x) return x; if (x > 709.782712893383973096) return x * x1p1023; if (x < -708.39641853226410622) { if (x < -745.13321910194110842) return 0.; } }
  if (hx > 0x3fd62e42) {
    if (hx >= 0x3ff0a2b2) k = trunc(INVLN2 * x + HALF[sign]) | 0; else k = 1 - sign - sign;
    hi_ = x - k * LN2HI; lo_ = k * LN2LO; x = hi_ - lo_;
  } else if (hx > 0x3e300000) { k = 0; hi_ = x; lo_ = 0.; }
  else return 1. + x;
  const xx = x * x, c = x - xx * (P1 + xx * (P2 + xx * (P3 + xx * (P4 + xx * P5)))), y = 1. + (x * c / (2. - c) - lo_ + hi_);
  return k === 0 ? y : scalbn(y, k);
}
const LN2_HI = 6.93147180369123816490e-01, LN2_LO = 1.90821492927058770002e-10, LG1 = 6.666666666666735130e-01, LG2 = 3.999999999940941908e-01,
  LG3 = 2.857142874366239149e-01, LG4 = 2.222219843214978396e-01, LG5 = 1.818357216161805012e-01, LG6 = 1.531383769920937332e-01, LG7 = 1.479819860511658591e-01;
function log(x) {
  const x1p54 = mk(0x43500000, 0);
  let hx = hi(x), l = lo(x), k = 0;
  if (hx < 0x00100000 || (hx >>> 31) !== 0) {
    if (((hx & 0x7fffffff) | l) === 0) return -1. / (x * x);
    if ((hx >>> 31) !== 0) return (x - x) / 0.0;
    k -= 54; x *= x1p54; hx = hi(x); l = lo(x);
  } else if (hx >= 0x7ff00000) return x;
  else if (hx === 0x3ff00000 && l === 0) return 0.;
  hx = (hx + (0x3ff00000 - 0x3fe6a09e)) >>> 0;
  k += (hx >>> 20) - 0x3ff;
  hx = ((hx & 0x000fffff) + 0x3fe6a09e) >>> 0;
  x = mk(hx, l);
  const f = x - 1.0, hfsq = 0.5 * f * f, s = f / (2.0 + f), z = s * s, w = z * z;
  const t1 = w * (LG2 + w * (LG4 + w * LG6)), t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7))), r = t2 + t1, dk = k;
  return s * (hfsq + r) + dk * LN2_LO - hfsq + f + dk * LN2_HI;
}
const BP = [1.0, 1.5], DP_H = [0.0, 5.84962487220764160156e-01], DP_L = [0.0, 1.35003920212974897128e-08], TWO53 = 9007199254740992.0, HUGE = 1.0e300, TINY = 1.0e-300,
  L1 = 5.99999999999994648725e-01, L2 = 4.28571428578550184252e-01, L3 = 3.33333329818377432918e-01, L4 = 2.72728123808534006489e-01, L5 = 2.30660745775561754067e-01, L6 = 2.06975017800338417784e-01,
  LG2c = 6.93147180559945286227e-01, LG2_H = 6.93147182464599609375e-01, LG2_L = -1.90465429995776804525e-09, OVT = 8.0085662595372944372e-017,
  CP = 9.61796693925975554329e-01, CP_H = 9.61796700954437255859e-01, CP_L = -7.02846165095275826516e-09, IVLN2 = 1.44269504088896338700e+00, IVLN2_H = 1.44269502162933349609e+00, IVLN2_L = 1.92596299112661746887e-08;
function pow(x, y) {
  let t1, t2;
  const hx = hi(x) | 0, lx = lo(x), hy = hi(y) | 0, ly = lo(y);
  let ix = hx & 0x7fffffff; const iy = hy & 0x7fffffff;
  if ((iy | ly) === 0) return 1.0;
  if (hx === 0x3ff00000 && lx === 0) return 1.0;
  if (ix > 0x7ff00000 || (ix === 0x7ff00000 && lx !== 0) || iy > 0x7ff00000 || (iy === 0x7ff00000 && ly !== 0)) return x + y;
  let yisint = 0, k, j;
  if (hx < 0) {
    if (iy >= 0x43400000) yisint = 2;
    else if (iy >= 0x3ff00000) { k = (iy >> 20) - 0x3ff;
      if (k > 20) { j = (ly >>> (52 - k)) | 0; if (((j << (52 - k)) | 0) === (ly | 0)) yisint = 2 - (j & 1); }
      else if (ly === 0) { j = iy >> (20 - k); if ((j << (20 - k)) === iy) yisint = 2 - (j & 1); } }
  }
  if (ly === 0) {
    if (iy === 0x7ff00000) return ((ix - 0x3ff00000) | lx) === 0 ? 1.0 : ix >= 0x3ff00000 ? (hy >= 0 ? y : 0.0) : (hy >= 0 ? 0.0 : -y);
    if (iy === 0x3ff00000) return hy >= 0 ? x : 1.0 / x;
    if (hy === 0x40000000) return x * x;
    if (hy === 0x3fe00000) { if (hx >= 0) return sqrt(x); }
  }
  let ax = fabs(x);
  if (lx === 0) { if (ix === 0x7ff00000 || ix === 0 || ix === 0x3ff00000) { let z = ax; if (hy < 0) z = 1.0 / z;
    if (hx < 0) { if (((ix - 0x3ff00000) | yisint) === 0) z = (z - z) / (z - z); else if (yisint === 1) z = -z; } return z; } }
  let s = 1.0;
  if (hx < 0) { if (yisint === 0) return (x - x) / (x - x); if (yisint === 1) s = -1.0; }
  if (iy > 0x41e00000) {
    if (iy > 0x43f00000) { if (ix <= 0x3fefffff) return hy < 0 ? HUGE * HUGE : TINY * TINY; if (ix >= 0x3ff00000) return hy > 0 ? HUGE * HUGE : TINY * TINY; }
    if (ix < 0x3fefffff) return hy < 0 ? s * HUGE * HUGE : s * TINY * TINY;
    if (ix > 0x3ff00000) return hy > 0 ? s * HUGE * HUGE : s * TINY * TINY;
    const t = ax - 1.0, w = (t * t) * (0.5 - t * (0.3333333333333333333333 - t * 0.25)), u = IVLN2_H * t, v = t * IVLN2_L - w * IVLN2;
    t1 = setLo(u + v, 0); t2 = v - (t1 - u);
  } else {
    let n = 0;
    if (ix < 0x00100000) { ax *= TWO53; n -= 53; ix = hi(ax) | 0; }
    n += (ix >> 20) - 0x3ff; j = ix & 0x000fffff; let kk; ix = j | 0x3ff00000;
    if (j <= 0x3988E) kk = 0; else if (j < 0xBB67A) kk = 1; else { kk = 0; n += 1; ix -= 0x00100000; }
    ax = setHi(ax, ix >>> 0);
    const u = ax - BP[kk], v = 1.0 / (ax + BP[kk]), ss = u * v, s_h = setLo(ss, 0);
    let t_h = setHi(0.0, ((((ix >>> 0) >>> 1) | 0x20000000) + 0x00080000 + (kk << 18)) >>> 0);
    let t_l = ax - (t_h - BP[kk]);
    const s_l = v * ((u - s_h * t_h) - s_h * t_l);
    let s2 = ss * ss, r = s2 * s2 * (L1 + s2 * (L2 + s2 * (L3 + s2 * (L4 + s2 * (L5 + s2 * L6)))));
    r += s_l * (s_h + ss); s2 = s_h * s_h;
    t_h = setLo(3.0 + s2 + r, 0); t_l = r - ((t_h - 3.0) - s2);
    const uu = s_h * t_h, vv = s_l * t_h + t_l * ss, p_h = setLo(uu + vv, 0), p_l = vv - (p_h - uu);
    const z_h = CP_H * p_h, z_l = CP_L * p_h + p_l * CP + DP_L[kk], t = n;
    t1 = setLo(((z_h + z_l) + DP_H[kk]) + t, 0); t2 = z_l - (((t1 - t) - DP_H[kk]) - z_h);
  }
  const y1 = setLo(y, 0), p_l = (y - y1) * t1 + y * t2; let p_h = y1 * t1;
  let z = p_l + p_h; let jj = hi(z) | 0; const i0 = lo(z) | 0;
  if (jj >= 0x40900000) { if (((jj - 0x40900000) | i0) !== 0) return s * HUGE * HUGE; if (p_l + OVT > z - p_h) return s * HUGE * HUGE; }
  else if ((jj & 0x7fffffff) >= 0x4090cc00) { if (((((jj >>> 0) - 0xc090cc00) >>> 0) | (i0 >>> 0)) !== 0) return s * TINY * TINY; if (p_l <= z - p_h) return s * TINY * TINY; }
  const i = jj & 0x7fffffff; k = (i >> 20) - 0x3ff; let n = 0;
  if (i > 0x3fe00000) {
    n = (jj + (0x00100000 >> (k + 1))) | 0; k = ((n & 0x7fffffff) >> 20) - 0x3ff;
    const t = setHi(0.0, (n & ~(0x000fffff >> k)) >>> 0);
    n = ((n & 0x000fffff) | 0x00100000) >> (20 - k); if (jj < 0) n = -n; p_h -= t;
  }
  const t = setLo(p_l + p_h, 0), u = t * LG2_H, v = (p_l - (t - p_h)) * LG2c + t * LG2_L;
  z = u + v; const w = v - (z - u), tt = z * z, tt1 = z - tt * (P1 + tt * (P2 + tt * (P3 + tt * (P4 + tt * P5)))), r = (z * tt1) / (tt1 - 2.0) - (w + z * w);
  z = 1.0 - (r - z); jj = hi(z) | 0; jj = (jj + (n << 20)) | 0;
  if ((jj >> 20) <= 0) z = scalbn(z, n); else z = setHi(z, jj >>> 0);
  return s * z;
}
// ---- hypot ----
const SPLIT = 134217728. + 1.;
function sq(x) { const xc = x * SPLIT, xh = x - xc + xc, xl = x - xh, h = x * x, l = xh * xh - h + 2. * xh * xl + xl * xl; return [h, l]; }
function hypot(x, y) {
  const x1p700 = mk(0x6bb00000, 0), x1p_700 = mk(0x14300000, 0);
  let xh = hi(x) & 0x7fffffff, xl = lo(x), yh = hi(y) & 0x7fffffff, yl = lo(y);
  if (xh < yh || (xh === yh && xl < yl)) { let t = xh; xh = yh; yh = t; t = xl; xl = yl; yl = t; }
  const ex = xh >>> 20, ey = yh >>> 20;
  x = mk(xh, xl); y = mk(yh, yl);
  if (ey === 0x7ff) return y;
  if (ex === 0x7ff || (yh | yl) === 0) return x;
  if (ex - ey > 64) return x + y;
  let z = 1.;
  if (ex > 0x3ff + 510) { z = x1p700; x *= x1p_700; y *= x1p_700; } else if (ey < 0x3ff - 450) { z = x1p_700; x *= x1p700; y *= x1p700; }
  const [hx, lx] = sq(x), [hy, ly] = sq(y);
  return z * sqrt(ly + lx + hy + hx);
}
module.exports = { sin, cos, atan, atan2, acos, exp, log, pow, hypot, sqrt };
