// R7 parity prototypes. The order of IEEE 754 operations follows SIM-CS2.
// known_segment and segment_triangle build on stage3/bench/rdj.
// No fused multiply-add or rounding/quantization at the ABI.
fn known_segment(input: &[f64]) -> f64 {
    let [ax, ay, bx, by, qx, qy, weight, r, detour, close] = input else {
        unreachable!()
    };
    if (*ax < qx - r && *bx < qx - r)
        || (*ax > qx + r && *bx > qx + r)
        || (*ay < qy - r && *by < qy - r)
        || (*ay > qy + r && *by > qy + r)
    {
        return 0.0;
    }
    let dx = bx - ax;
    let dy = by - ay;
    let l2 = dx * dx + dy * dy;
    if l2 < 1e-9 {
        return 0.0;
    }
    let fx = ax - qx;
    let fy = ay - qy;
    let b = 2.0 * (fx * dx + fy * dy);
    let c = fx * fx + fy * fy - r * r;
    let d = b * b - 4.0 * l2 * c;
    if d <= 0.0 {
        return 0.0;
    }
    let t0 = 0.0_f64.max((-b - d.sqrt()) / (2.0 * l2));
    let t1 = 1.0_f64.min((-b + d.sqrt()) / (2.0 * l2));
    if t1 <= t0 {
        return 0.0;
    }
    let tm = 0.0_f64.max(1.0_f64.min(-b / (2.0 * l2)));
    let cx = ax + dx * tm - qx;
    let cy = ay + dy * tm - qy;
    let dmin = (cx * cx + cy * cy).sqrt();
    detour * weight * (t1 - t0) * l2.sqrt() / (2.0 * r)
        * (1.0 + close * 0.0_f64.max(1.0 - dmin / r))
}

fn segment_triangle(input: &[f64]) -> f64 {
    let [x0, y0, z0, x1, y1, z1, x2, y2, z2, ax, ay, az, dx, dy, dz] = input else {
        unreachable!()
    };
    let (e1x, e1y, e1z) = (x1 - x0, y1 - y0, z1 - z0);
    let (e2x, e2y, e2z) = (x2 - x0, y2 - y0, z2 - z0);
    let (px, py, pz) = (
        dy * e2z - dz * e2y,
        dz * e2x - dx * e2z,
        dx * e2y - dy * e2x,
    );
    let det = e1x * px + e1y * py + e1z * pz;
    if det > -1e-9 && det < 1e-9 {
        return -1.0;
    }
    let inv = 1.0 / det;
    let (sx, sy, sz) = (ax - x0, ay - y0, az - z0);
    let u = (sx * px + sy * py + sz * pz) * inv;
    if u < 0.0 || u > 1.0 {
        return -1.0;
    }
    let (qx, qy, qz) = (
        sy * e1z - sz * e1y,
        sz * e1x - sx * e1z,
        sx * e1y - sy * e1x,
    );
    let v = (dx * qx + dy * qy + dz * qz) * inv;
    if v < 0.0 || u + v > 1.0 {
        return -1.0;
    }
    let t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (0.0..=1.0).contains(&t) {
        t
    } else {
        -1.0
    }
}

fn sweep_box(input: &[f64]) -> Option<[f64; 4]> {
    let [ax, ay, az, dx, dy, dz, radius, skin, planes @ ..] = input else {
        unreachable!()
    };
    let (mut enter, mut leave) = (f64::NEG_INFINITY, f64::INFINITY);
    let mut entering = None;
    for plane in planes.chunks_exact(4) {
        let [nx, ny, nz, d] = [plane[0], plane[1], plane[2], plane[3]];
        let expanded = d + radius * (nx.abs() + ny.abs() + nz.abs());
        let s = nx * ax + ny * ay + nz * az - expanded;
        let v = nx * dx + ny * dy + nz * dz;
        if v == 0.0 {
            if s > 0.0 {
                return None;
            }
            continue;
        }
        let t = -s / v;
        if v < 0.0 {
            if t > enter {
                enter = t;
                entering = Some((s, nx, ny, nz));
            }
        } else if t < leave {
            leave = t;
        }
        if enter > leave {
            return None;
        }
    }
    let (s, nx, ny, nz) = entering?;
    if enter > 1.0 || leave < 0.0 {
        return None;
    }
    if enter < 0.0 {
        if s < -skin {
            return None;
        }
        enter = 0.0;
    }
    Some([enter, nx, ny, nz])
}

pub fn compute(operation: u8, input: &[f64], output: &mut [f64; 4]) -> Option<usize> {
    if !input.iter().all(|x| x.is_finite()) {
        return None;
    }
    match operation {
        0 if input.len() == 10 => output[0] = known_segment(input),
        1 if input.len() == 15 => output[0] = segment_triangle(input),
        2 if input.len() >= 12 && (input.len() - 8) % 4 == 0 => {
            return Some(if let Some(hit) = sweep_box(input) {
                *output = hit;
                4
            } else {
                0
            });
        }
        _ => return None,
    }
    Some(1)
}

// Only used by the single-threaded WASM parity harness. f64 buffers are
// aligned and allocated with capacity len, and released after each request.
#[no_mangle]
pub extern "C" fn allocate(len: usize) -> *mut f64 {
    Box::into_raw(vec![0.0_f64; len].into_boxed_slice()) as *mut f64
}

#[no_mangle]
pub unsafe extern "C" fn release(ptr: *mut f64, len: usize) {
    drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len)));
}

#[no_mangle]
pub unsafe extern "C" fn request(
    operation: u8,
    input: *const f64,
    len: usize,
    output: *mut [f64; 4],
) -> i32 {
    compute(
        operation,
        std::slice::from_raw_parts(input, len),
        &mut *output,
    )
    .map_or(-1, |words| words as i32)
}
