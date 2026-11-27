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

impl Geo {
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
