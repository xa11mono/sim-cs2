// (Р7, 27.11) ядра игры для WASM (страница, Worker) и Node (N-API) из одного исходника. Геометрия карты передаётся один раз (массивы M3),
// запрос — числами в аргументах, ответ — в общий буфер (WASM) или массивом (N-API). Однопоточно: одно ядро на изолят.
pub mod cast;
pub mod path;
use cast::{Cols, Fill, Geo};

static mut GEO: Option<Geo> = None;
static mut OUT: [f64; 7] = [0.0; 7];
#[allow(static_mut_refs)]
fn geo() -> &'static mut Geo { unsafe { GEO.as_mut().expect("геометрия не задана") } }

pub fn geo_init(w: f64, cell: f64, unit: f64, x0: f64, y0: f64, b: f64, bn: f64) {
    unsafe { GEO = Some(Geo { w, cell, unit, x0, y0, b, bn, tri: vec![], tri_flag: vec![], tri_z: vec![], btri_off: vec![], btri: vec![], bhull_off: vec![], bhull: vec![],
        hull_p: vec![], hull_off: vec![], hull_flag: vec![], cols: [None, None, None], fill: vec![], seen: vec![], stamp: 0 }); }
}
// поле геометрии по номеру: байты (little-endian) → массив своего типа
pub fn geo_set(field: u32, bytes: &[u8]) {
    let g = geo();
    fn f32s(b: &[u8]) -> Vec<f32> { b.chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect() }
    fn u32s(b: &[u8]) -> Vec<u32> { b.chunks_exact(4).map(|c| u32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect() }
    fn i16s(b: &[u8]) -> Vec<i16> { b.chunks_exact(2).map(|c| i16::from_le_bytes([c[0], c[1]])).collect() }
    match field {
        0 => g.tri = f32s(bytes), 1 => g.tri_flag = bytes.to_vec(), 2 => g.tri_z = f32s(bytes),
        3 => g.btri_off = u32s(bytes), 4 => g.btri = u32s(bytes), 5 => g.bhull_off = u32s(bytes), 6 => g.bhull = u32s(bytes),
        7 => g.hull_p = f32s(bytes), 8 => g.hull_off = u32s(bytes), 9 => g.hull_flag = bytes.to_vec(),
        // столбики: 10 + 3·вид + (0 st, 1 lo, 2 hi)
        10..=18 => { let k = ((field - 10) / 3) as usize; let p = (field - 10) % 3;
            let c = g.cols[k].get_or_insert(Cols { st: vec![], lo: vec![], hi: vec![] });
            match p { 0 => c.st = u32s(bytes), 1 => c.lo = i16s(bytes), _ => c.hi = i16s(bytes) } }
        _ => {}
    }
}
// укрытия: [число, затем на каждое: 6 чисел рамки, число плоскостей, плоскости по 4]
pub fn geo_fill(v: &[f64]) {
    let g = geo(); g.fill.clear(); let n = v[0] as usize; let mut o = 1;
    for _ in 0..n { let bx = [v[o], v[o+1], v[o+2], v[o+3], v[o+4], v[o+5]]; let np = v[o+6] as usize; o += 7;
        let pl = (0..np).map(|q| [v[o+q*4], v[o+q*4+1], v[o+q*4+2], v[o+q*4+3]]).collect(); o += np * 4; g.fill.push(Fill { bx, pl }); }
}
pub fn geo_ready() { let g = geo(); let nb = (g.bn * g.bn) as usize; g.seen = vec![0; nb]; g.stamp = 0; }
#[allow(static_mut_refs)]
pub fn cast_out(kind: u32, ax: f64, ay: f64, az: f64, bx: f64, by: f64, bz: f64, first: u32) -> &'static [f64; 7] {
    unsafe { geo().cast(kind as usize, ax, ay, az, bx, by, bz, first != 0, &mut OUT); &OUT }
}

// ---------------- WASM (без wasm-bindgen: память и числа) ----------------
#[cfg(target_arch = "wasm32")]
mod wasm {
    use super::*;
    #[no_mangle] pub extern "C" fn r7_alloc(n: usize) -> *mut u8 { let mut v = Vec::<u8>::with_capacity(n.max(8)); let p = v.as_mut_ptr(); std::mem::forget(v); p }
    #[no_mangle] pub extern "C" fn r7_free(p: *mut u8, n: usize) { unsafe { drop(Vec::from_raw_parts(p, 0, n.max(8))) } }
    #[no_mangle] pub extern "C" fn r7_geo_init(w: f64, cell: f64, unit: f64, x0: f64, y0: f64, b: f64, bn: f64) { geo_init(w, cell, unit, x0, y0, b, bn) }
    #[no_mangle] pub extern "C" fn r7_geo_set(field: u32, p: *const u8, n: usize) { geo_set(field, unsafe { std::slice::from_raw_parts(p, n) }) }
    #[no_mangle] pub extern "C" fn r7_geo_fill(p: *const f64, n: usize) { geo_fill(unsafe { std::slice::from_raw_parts(p, n) }) }
    #[no_mangle] pub extern "C" fn r7_geo_ready() { geo_ready() }
    #[no_mangle] #[allow(static_mut_refs)] pub extern "C" fn r7_out() -> *const f64 { unsafe { OUT.as_ptr() } }
    #[no_mangle] pub extern "C" fn r7_cast(kind: u32, ax: f64, ay: f64, az: f64, bx: f64, by: f64, bz: f64, first: u32) -> f64 { cast_out(kind, ax, ay, az, bx, by, bz, first)[0] }
    // поиск пути — см. path.rs
    #[no_mangle] pub extern "C" fn r7_path_graph(p: *const f64, n: usize) { path::graph_set(unsafe { std::slice::from_raw_parts(p, n) }) }
    #[no_mangle] pub extern "C" fn r7_path_query(p: *const f64, n: usize) -> usize { path::query(unsafe { std::slice::from_raw_parts(p, n) }) }
    #[no_mangle] pub extern "C" fn r7_path_out() -> *const f64 { path::out_ptr() }
}

// ---------------- Node N-API ----------------
#[cfg(feature = "napi")]
mod node {
    use super::*;
    use napi::bindgen_prelude::*;
    use napi_derive::napi;
    #[napi] pub fn geo_init_n(w: f64, cell: f64, unit: f64, x0: f64, y0: f64, b: f64, bn: f64) { geo_init(w, cell, unit, x0, y0, b, bn) }
    #[napi] pub fn geo_set_n(field: u32, bytes: Uint8Array) { geo_set(field, &bytes) }
    #[napi] pub fn geo_fill_n(v: Float64Array) { geo_fill(&v) }
    #[napi] pub fn geo_ready_n() { geo_ready() }
    // ответ — в переданный Float64Array(7) (без нового объекта на вызов)
    #[napi] pub fn cast_n(kind: u32, ax: f64, ay: f64, az: f64, bx: f64, by: f64, bz: f64, first: u32, mut out: Float64Array) -> f64 {
        let r = cast_out(kind, ax, ay, az, bx, by, bz, first); out.copy_from_slice(r); r[0] }
    #[napi] pub fn path_graph_n(v: Float64Array) { path::graph_set(&v) }
    #[napi] pub fn path_query_n(v: Float64Array, mut out: Float64Array) -> u32 { let n = path::query(&v); let o = path::out_slice(); out[..n].copy_from_slice(&o[..n]); n as u32 }
}
