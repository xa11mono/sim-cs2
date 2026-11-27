// (Р7, 27.11) ядро луча — построчный перенос engine/map/geometry3d.js m3Cast (с m3SegTri, m3SegHull, m3SegPlanes и нормалью первого
// попадания). Те же операции IEEE в том же порядке, без FMA: числа из Float32Array (треугольники, плоскости блоков) читаются как f32 → f64,
// как в JS. Порядок обхода клеток, корзин, треугольников и блоков — тот же: при first = false ответ — первое найденное, а не ближайшее.

pub struct Cols { pub st: Vec<u32>, pub lo: Vec<i16>, pub hi: Vec<i16> }
pub struct Fill { pub bx: [f64; 6], pub pl: Vec<[f64; 4]> }
pub struct Geo {
    pub w: f64, pub cell: f64, pub unit: f64, pub x0: f64, pub y0: f64, pub b: f64, pub bn: f64,
    pub tri: Vec<f32>, pub tri_flag: Vec<u8>, pub tri_z: Vec<f32>,
    pub btri_off: Vec<u32>, pub btri: Vec<u32>, pub bhull_off: Vec<u32>, pub bhull: Vec<u32>,
    pub hull_p: Vec<f32>, pub hull_off: Vec<u32>, pub hull_flag: Vec<u8>,
    pub cols: [Option<Cols>; 3], // 0 — sight, 1 — nade, 2 — sky
    pub fill: Vec<Fill>,
    pub seen: Vec<u32>, pub stamp: u32,
    // полёт гранаты (m3NadeTrace): рамки блоков (Int16 ×6), рамки треугольников по x, y (как M.nTriXY), отметки «уже проверен»
    pub hull_box: Vec<i16>, pub tri_xy: Vec<f32>, pub nseen_t: Vec<u32>, pub nseen_h: Vec<u32>, pub nstamp: u32,
}

// Math.min / Math.max JS: NaN, если хоть один аргумент NaN; −0 < +0
#[inline] fn jmin(a: f64, b: f64) -> f64 { if a.is_nan() || b.is_nan() { f64::NAN } else if a < b { a } else if b < a { b } else if a == 0.0 && (a.is_sign_negative() || b.is_sign_negative()) { -0.0 } else { a } }
#[inline] fn jmax(a: f64, b: f64) -> f64 { if a.is_nan() || b.is_nan() { f64::NAN } else if a > b { a } else if b > a { b } else if a == 0.0 && (a.is_sign_positive() || b.is_sign_positive()) { 0.0 } else { a } }

// DM.hypot3 (engine/core/dmath.ts — алгоритм V8): модули, максимум, сумма (x/max)² с поправкой Кэхэна, √ · max
pub fn hypot3(a: f64, b: f64, c: f64) -> f64 {
    let mut nan = false; let mut max = 0.0f64; let (mut aa, mut ab, mut ac) = (0.0, 0.0, 0.0);
    if a.is_nan() { nan = true } else { aa = a.abs(); if aa > max { max = aa } }
    if b.is_nan() { nan = true } else { ab = b.abs(); if ab > max { max = ab } }
    if c.is_nan() { nan = true } else { ac = c.abs(); if ac > max { max = ac } }
    if max == f64::INFINITY { return f64::INFINITY } if nan { return f64::NAN } if max == 0.0 { return 0.0 }
    let (mut sum, mut comp) = (0.0f64, 0.0f64);
    let mut q = aa / max; let mut summand = q * q - comp; let mut pre = sum + summand; comp = (pre - sum) - summand; sum = pre;
    q = ab / max; summand = q * q - comp; pre = sum + summand; comp = (pre - sum) - summand; sum = pre;
    q = ac / max; summand = q * q - comp; pre = sum + summand; sum = pre;
    sum.sqrt() * max
}
// DM.hypot (2 аргумента)
pub fn hypot2(a: f64, b: f64) -> f64 {
    let mut nan = false; let mut max = 0.0f64; let (mut aa, mut ab) = (0.0, 0.0);
    if a.is_nan() { nan = true } else { aa = a.abs(); if aa > max { max = aa } }
    if b.is_nan() { nan = true } else { ab = b.abs(); if ab > max { max = ab } }
    if max == f64::INFINITY { return f64::INFINITY } if nan { return f64::NAN } if max == 0.0 { return 0.0 }
    let (mut sum, mut comp) = (0.0f64, 0.0f64);
    let mut q = aa / max; let mut summand = q * q - comp; let mut pre = sum + summand; comp = (pre - sum) - summand; sum = pre;
    q = ab / max; summand = q * q - comp; pre = sum + summand; sum = pre;
    sum.sqrt() * max
}

// m3BoxPlanes: отрезок центра A + t·D против выпуклого объёма (плоскости [nx, ny, nz, d]), каждая отодвинута на опору кубика r
fn box_planes(pl: &[f64], ax: f64, ay: f64, az: f64, dx: f64, dy: f64, dz: f64, r: f64, skin: f64) -> Option<(f64, f64, f64, f64)> {
    let (mut t0, mut t1, mut e, mut se) = (f64::NEG_INFINITY, f64::INFINITY, -1i64, 0.0f64);
    let mut q = 0; while q < pl.len() {
        let (nx, ny, nz) = (pl[q], pl[q+1], pl[q+2]); let d = pl[q+3] + r*(nx.abs() + ny.abs() + nz.abs());
        let s = nx*ax + ny*ay + nz*az - d; let v = nx*dx + ny*dy + nz*dz;
        if v == 0.0 { if s > 0.0 { return None } q += 4; continue; }
        let t = -s / v;
        if v < 0.0 { if t > t0 { t0 = t; e = q as i64; se = s; } } else if t < t1 { t1 = t; }
        if t0 > t1 { return None }
        q += 4;
    }
    if e < 0 || t0 > 1.0 || t1 < 0.0 { return None }
    if t0 < 0.0 { if se < -skin { return None } t0 = 0.0; }
    let e = e as usize; Some((t0, pl[e], pl[e+1], pl[e+2]))
}
fn bevel_push(pl: &mut Vec<f64>, x0: f64, y0: f64, z0: f64, x1: f64, y1: f64, z1: f64) {
    pl.extend_from_slice(&[1.0, 0.0, 0.0, x1, -1.0, 0.0, 0.0, -x0, 0.0, 1.0, 0.0, y1, 0.0, -1.0, 0.0, -y0, 0.0, 0.0, 1.0, z1, 0.0, 0.0, -1.0, -z0]);
}
#[inline] fn jmin3(a: f64, b: f64, c: f64) -> f64 { jmin(jmin(a, b), c) }
#[inline] fn jmax3(a: f64, b: f64, c: f64) -> f64 { jmax(jmax(a, b), c) }
// m3TriPlanes: плоскость треугольника (обе стороны), три боковые, скосы рамки; None — вырожденный
fn tri_planes(t: &[f32], o: usize) -> Option<Vec<f64>> {
    let v = |i: usize| t[o + i] as f64;
    let (px, py, pz, qx, qy, qz, wx, wy, wz) = (v(0), v(1), v(2), v(3), v(4), v(5), v(6), v(7), v(8));
    let (e1x, e1y, e1z, e2x, e2y, e2z) = (qx-px, qy-py, qz-pz, wx-px, wy-py, wz-pz);
    let (mut nx, mut ny, mut nz) = (e1y*e2z - e1z*e2y, e1z*e2x - e1x*e2z, e1x*e2y - e1y*e2x); let l = hypot3(nx, ny, nz);
    if l < 1e-6 { return None }
    nx /= l; ny /= l; nz /= l;
    let d = nx*px + ny*py + nz*pz; let mut pl = vec![nx, ny, nz, d, -nx, -ny, -nz, -d];
    let vv = [px, py, pz, qx, qy, qz, wx, wy, wz];
    for a in 0..3 { let b = (a + 1) % 3; let c = (a + 2) % 3;
        let (ex, ey, ez) = (vv[b*3]-vv[a*3], vv[b*3+1]-vv[a*3+1], vv[b*3+2]-vv[a*3+2]);
        let (mut mx, mut my, mut mz) = (ey*nz - ez*ny, ez*nx - ex*nz, ex*ny - ey*nx); let ml = hypot3(mx, my, mz); if ml < 1e-9 { return None }
        mx /= ml; my /= ml; mz /= ml;
        if mx*(vv[c*3]-vv[a*3]) + my*(vv[c*3+1]-vv[a*3+1]) + mz*(vv[c*3+2]-vv[a*3+2]) > 0.0 { mx = -mx; my = -my; mz = -mz; }
        pl.extend_from_slice(&[mx, my, mz, mx*vv[a*3] + my*vv[a*3+1] + mz*vv[a*3+2]]);
    }
    bevel_push(&mut pl, jmin3(px, qx, wx), jmin3(py, qy, wy), jmin3(pz, qz, wz), jmax3(px, qx, wx), jmax3(py, qy, wy), jmax3(pz, qz, wz));
    Some(pl)
}

impl Geo {
    // m3NadeTrace (engine/map/geometry3d.js): ход кубика гранаты ±r от A к B — первое касание. out: [вид (0 — нет, 1 — треуг., 2 — блок,
    // 3 — укрытие), доля хода f, номер, nx, ny, nz]
    pub fn nade_trace(&mut self, ax: f64, ay: f64, az: f64, bx: f64, by: f64, bz: f64, r: f64, skin: f64, out: &mut [f64; 7]) {
        out[0] = 0.0;
        let (dx, dy, dz) = (bx - ax, by - ay, bz - az);
        self.nstamp = self.nstamp.wrapping_add(1); if self.nstamp == 0 || self.nstamp as f64 > 4e9 { for s in self.nseen_t.iter_mut() { *s = 0 } for s in self.nseen_h.iter_mut() { *s = 0 } self.nstamp = 1; }
        let stamp = self.nstamp;
        let (x0, x1, y0, y1) = (jmin(ax, bx) - r, jmax(ax, bx) + r, jmin(ay, by) - r, jmax(ay, by) + r); let (z0, z1) = (jmin(az, bz) - r, jmax(az, bz) + r);
        let bu = self.unit * self.b; let bn = self.bn;
        let i0 = jmax(0.0, ((x0 - self.x0) / bu).floor()); let i1 = jmin(bn - 1.0, ((x1 - self.x0) / bu).floor());
        let j0 = jmax(0.0, ((self.y0 - y1) / bu).floor()); let j1 = jmin(bn - 1.0, ((self.y0 - y0) / bu).floor());
        let mut best: Option<(f64, f64, f64, f64, u8, usize)> = None;
        let mut j = j0; while j <= j1 { let mut i = i0; while i <= i1 {
            let b = (j * bn + i) as usize;
            for n in self.btri_off[b] as usize..self.btri_off[b + 1] as usize { let k = self.btri[n] as usize;
                if self.nseen_t[k] == stamp { continue } self.nseen_t[k] = stamp;
                if (self.tri_flag[k] & 2) == 0 || (self.tri_z[k*2] as f64) > z1 || (self.tri_z[k*2+1] as f64) < z0 { continue }
                let k4 = k * 4; if (self.tri_xy[k4] as f64) > x1 || (self.tri_xy[k4+1] as f64) < x0 || (self.tri_xy[k4+2] as f64) > y1 || (self.tri_xy[k4+3] as f64) < y0 { continue }
                if let Some(tp) = tri_planes(&self.tri, k * 9) { if let Some(h) = box_planes(&tp, ax, ay, az, dx, dy, dz, r, skin) {
                    if best.map_or(true, |bb| h.0 < bb.0) { best = Some((h.0, h.1, h.2, h.3, 1, k)) } } }
            }
            for n in self.bhull_off[b] as usize..self.bhull_off[b + 1] as usize { let hh = self.bhull[n] as usize;
                if self.nseen_h[hh] == stamp { continue } self.nseen_h[hh] = stamp;
                if (self.hull_flag[hh] & 2) == 0 { continue }
                let q6 = hh * 6; let hb = |o: usize| self.hull_box[q6 + o] as f64;
                if hb(0) > x1 || hb(3) < x0 || hb(1) > y1 || hb(4) < y0 || hb(2) > z1 || hb(5) < z0 { continue }
                let mut pl = Vec::with_capacity(48); for q in self.hull_off[hh] as usize..self.hull_off[hh+1] as usize { for c in 0..4 { pl.push(self.hull_p[q*4 + c] as f64) } }
                bevel_push(&mut pl, hb(0), hb(1), hb(2), hb(3), hb(4), hb(5));
                if let Some(h) = box_planes(&pl, ax, ay, az, dx, dy, dz, r, skin) { if best.map_or(true, |bb| h.0 < bb.0) { best = Some((h.0, h.1, h.2, h.3, 2, hh)) } }
            }
            i += 1.0; } j += 1.0; }
        for (fi, f) in self.fill.iter().enumerate() { let bx0 = &f.bx;
            if bx0[0] > x1 || bx0[3] < x0 || bx0[1] > y1 || bx0[4] < y0 || bx0[2] > z1 || bx0[5] < z0 { continue }
            let mut pf = Vec::with_capacity(f.pl.len()*4 + 24); for p in &f.pl { pf.extend_from_slice(p) } bevel_push(&mut pf, bx0[0], bx0[1], bx0[2], bx0[3], bx0[4], bx0[5]);
            if let Some(h) = box_planes(&pf, ax, ay, az, dx, dy, dz, r, skin) { if best.map_or(true, |bb| h.0 < bb.0) { best = Some((h.0, h.1, h.2, h.3, 3, fi)) } }
        }
        if let Some(bb) = best { out[0] = bb.4 as f64; out[1] = bb.0; out[2] = bb.5 as f64; out[3] = bb.1; out[4] = bb.2; out[5] = bb.3; }
    }

    #[inline] fn t(&self, i: usize) -> f64 { self.tri[i] as f64 }
    fn seg_tri(&self, k: usize, ax: f64, ay: f64, az: f64, dx: f64, dy: f64, dz: f64) -> f64 {
        let o = k * 9;
        let (e1x, e1y, e1z) = (self.t(o+3) - self.t(o), self.t(o+4) - self.t(o+1), self.t(o+5) - self.t(o+2));
        let (e2x, e2y, e2z) = (self.t(o+6) - self.t(o), self.t(o+7) - self.t(o+1), self.t(o+8) - self.t(o+2));
        let (px, py, pz) = (dy*e2z - dz*e2y, dz*e2x - dx*e2z, dx*e2y - dy*e2x);
        let det = e1x*px + e1y*py + e1z*pz;
        if det > -1e-9 && det < 1e-9 { return -1.0 }
        let inv = 1.0 / det; let (sx, sy, sz) = (ax - self.t(o), ay - self.t(o+1), az - self.t(o+2));
        let u = (sx*px + sy*py + sz*pz) * inv;
        if u < 0.0 || u > 1.0 { return -1.0 }
        let (qx, qy, qz) = (sy*e1z - sz*e1y, sz*e1x - sx*e1z, sx*e1y - sy*e1x);
        let v = (dx*qx + dy*qy + dz*qz) * inv;
        if v < 0.0 || u + v > 1.0 { return -1.0 }
        let t = (e2x*qx + e2y*qy + e2z*qz) * inv;
        if t >= 0.0 && t <= 1.0 { t } else { -1.0 }
    }
    // → (t входа, номер плоскости или −1); None — мимо
    fn seg_hull(&self, h: usize, ax: f64, ay: f64, az: f64, dx: f64, dy: f64, dz: f64) -> Option<(f64, i64)> {
        let (mut t0, mut t1, mut pl) = (0.0f64, 1.0f64, -1i64);
        for q in self.hull_off[h] as usize..self.hull_off[h+1] as usize {
            let p = &self.hull_p; let (nx, ny, nz, d) = (p[q*4] as f64, p[q*4+1] as f64, p[q*4+2] as f64, p[q*4+3] as f64);
            let s = nx*ax + ny*ay + nz*az - d; let v = nx*dx + ny*dy + nz*dz;
            if v == 0.0 { if s > 0.0 { return None } continue; }
            let t = -s / v;
            if v < 0.0 { if t > t0 { t0 = t; pl = q as i64; } } else if t < t1 { t1 = t; }
            if t0 > t1 { return None }
        }
        Some((t0, pl))
    }
    fn seg_planes(pl: &[[f64; 4]], ax: f64, ay: f64, az: f64, dx: f64, dy: f64, dz: f64) -> f64 {
        let (mut t0, mut t1) = (0.0f64, 1.0f64);
        for n in pl { let s = n[0]*ax + n[1]*ay + n[2]*az - n[3]; let v = n[0]*dx + n[1]*dy + n[2]*dz;
            if v == 0.0 { if s > 0.0 { return -1.0 } continue; }
            let t = -s / v; if v < 0.0 { if t > t0 { t0 = t } } else if t < t1 { t1 = t } if t0 > t1 { return -1.0 } }
        t0
    }

    // ответ в out: [вид (0 — нет, 1 — только t, 2 — треугольник, 3 — блок, 4 — укрытие), t, номер, плоскость, nx, ny, nz]
    pub fn cast(&mut self, kind: usize, ax: f64, ay: f64, az: f64, bx: f64, by: f64, bz: f64, first: bool, out: &mut [f64; 7]) {
        out[0] = 0.0;
        let flag: u8 = if kind == 1 { 2 } else { 1 };
        let w = self.w;
        let (cx, cy, ex, ey) = (ax / self.cell, ay / self.cell, bx / self.cell, by / self.cell);
        let k2 = self.unit / self.cell; let (wax, way) = (self.x0 + ax * k2, self.y0 - ay * k2);
        let (wdx, wdy, wdz) = ((bx - ax) * k2, -(by - ay) * k2, bz - az);
        let (dx, dy, dz) = (ex - cx, ey - cy, bz - az);
        let (mut i, mut j, ei, ej) = (cx.floor(), cy.floor(), ex.floor(), ey.floor());
        let sx = if dx > 0.0 { 1.0 } else { -1.0 }; let sy = if dy > 0.0 { 1.0 } else { -1.0 };
        let tdx = if dx != 0.0 { (1.0 / dx).abs() } else { f64::INFINITY }; let tdy = if dy != 0.0 { (1.0 / dy).abs() } else { f64::INFINITY };
        let mut tmx = if dx != 0.0 { (if dx > 0.0 { i + 1.0 - cx } else { cx - i }) * tdx } else { f64::INFINITY };
        let mut tmy = if dy != 0.0 { (if dy > 0.0 { j + 1.0 - cy } else { cy - j }) * tdy } else { f64::INFINITY };
        let mut t0 = 0.0f64;
        self.stamp = self.stamp.wrapping_add(1); if self.stamp == 0 || self.stamp as f64 > 4e9 { for s in self.seen.iter_mut() { *s = 0 } self.stamp = 1; }
        let stamp = self.stamp;
        let rzl = jmin(az, bz) - 0.5; let rzh = jmax(az, bz) + 0.5;
        // лучшее: (t, вид 2/3/4, номер, плоскость)
        let mut best: Option<(f64, u8, usize, i64)> = None;
        let col = self.cols[kind].as_ref().unwrap();
        let mut guard = 0.0f64;
        while guard < 4.0 * w {
            let t1 = jmin(jmin(tmx, tmy), 1.0);
            if let Some(b) = best { if b.0 < t0 { break } }
            if i >= 0.0 && j >= 0.0 && i < w && j < w {
                let za = az + dz * t0; let zb = az + dz * t1;
                let (zl, zh) = if za < zb { (za, zb) } else { (zb, za) };
                let c = (j * w + i) as usize;
                let mut q = col.st[c] as usize;
                while q < col.st[c + 1] as usize {
                    if (col.lo[q] as f64) > zh || (col.hi[q] as f64) < zl { q += 1; continue; }
                    let bk = ((j / self.b).floor() * self.bn + (i / self.b).floor()) as usize;
                    if self.seen[bk] == stamp { break }
                    self.seen[bk] = stamp;
                    for n in self.btri_off[bk] as usize..self.btri_off[bk + 1] as usize {
                        let k = self.btri[n] as usize;
                        if (self.tri_flag[k] & flag) == 0 || (self.tri_z[k*2] as f64) > rzh || (self.tri_z[k*2+1] as f64) < rzl { continue }
                        let t = self.seg_tri(k, wax, way, az, wdx, wdy, wdz);
                        if t >= 0.0 { if !first { out[0] = 1.0; out[1] = t; return } if best.map_or(true, |b| t < b.0) { best = Some((t, 2, k, -1)) } }
                    }
                    for n in self.bhull_off[bk] as usize..self.bhull_off[bk + 1] as usize {
                        let h = self.bhull[n] as usize; if (self.hull_flag[h] & flag) == 0 { continue }
                        if let Some((t, p)) = self.seg_hull(h, wax, way, az, wdx, wdy, wdz) {
                            if !first { out[0] = 1.0; out[1] = t; return } if best.map_or(true, |b| t < b.0) { best = Some((t, 3, h, p)) } }
                    }
                    break;
                }
            }
            if (i == ei && j == ej) || t1 >= 1.0 { break }
            if tmx < tmy { t0 = tmx; tmx += tdx; i += sx; } else { t0 = tmy; tmy += tdy; j += sy; }
            guard += 1.0;
        }
        for (fi, f) in self.fill.iter().enumerate() {
            let b0 = &f.bx;
            if jmax(wax, wax + wdx) < b0[0] || jmin(wax, wax + wdx) > b0[3] || jmax(way, way + wdy) < b0[1] || jmin(way, way + wdy) > b0[4] || rzh < b0[2] || rzl > b0[5] { continue }
            let tf = Geo::seg_planes(&f.pl, wax, way, az, wdx, wdy, wdz);
            if tf >= 0.0 { if !first { out[0] = 1.0; out[1] = tf; return } if best.map_or(true, |b| tf < b.0) { best = Some((tf, 4, fi, -1)) } }
        }
        let b = match best { None => return, Some(b) => b };
        out[0] = b.1 as f64; out[1] = b.0; out[2] = b.2 as f64; out[3] = b.3 as f64;
        if !first { return }
        match b.1 {
            2 => { let o = b.2 * 9;
                let (e1x, e1y, e1z) = (self.t(o+3) - self.t(o), self.t(o+4) - self.t(o+1), self.t(o+5) - self.t(o+2));
                let (e2x, e2y, e2z) = (self.t(o+6) - self.t(o), self.t(o+7) - self.t(o+1), self.t(o+8) - self.t(o+2));
                let (mut nx, mut ny, mut nz) = (e1y*e2z - e1z*e2y, e1z*e2x - e1x*e2z, e1x*e2y - e1y*e2x);
                let mut l = hypot3(nx, ny, nz); if l == 0.0 || l.is_nan() { l = 1.0 }
                if nx*wdx + ny*wdy + nz*wdz > 0.0 { nx = -nx; ny = -ny; nz = -nz; }
                out[4] = nx / l; out[5] = ny / l; out[6] = nz / l; }
            4 => { out[4] = 0.0; out[5] = 0.0; out[6] = 1.0; }
            _ => { let p = if b.3 < 0 { self.hull_off[b.2] as usize } else { b.3 as usize };
                out[4] = self.hull_p[p*4] as f64; out[5] = self.hull_p[p*4+1] as f64; out[6] = self.hull_p[p*4+2] as f64; }
        }
    }
}
