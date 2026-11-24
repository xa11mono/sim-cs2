// Сверка математики: std (платформенная) и libm (чистый Rust) против JS Math. Входы — общий LCG, как в prec.js.
pub const NF: usize = 9; // sin cos tan atan2 exp log pow hypot sqrt
pub struct L(u32);
impl L { pub fn u(&mut self) -> f64 { self.0 = self.0.wrapping_mul(1664525).wrapping_add(1013904223); (self.0 as f64) / 4294967296.0 } }
pub fn fill(mode: u32, out: &mut [f64], n: usize) {
    let mut r = L(12345);
    for i in 0..n {
        let a = (r.u() - 0.5) * 8.0 * std::f64::consts::PI;
        let x = (r.u() - 0.5) * 6000.0; let y = (r.u() - 0.5) * 6000.0;
        let e = r.u() * 25.0 - 20.0; let l = r.u() * 1e4 + 1e-9;
        let pb = r.u() * 10.0 + 1e-9; let pe = (r.u() - 0.5) * 6.0;
        let o = &mut out[i * NF..i * NF + NF];
        if mode == 0 {
            o[0]=a.sin(); o[1]=a.cos(); o[2]=a.tan(); o[3]=y.atan2(x); o[4]=e.exp(); o[5]=l.ln(); o[6]=pb.powf(pe); o[7]=x.hypot(y); o[8]=(x*x+y*y).sqrt();
        } else {
            o[0]=libm::sin(a); o[1]=libm::cos(a); o[2]=libm::tan(a); o[3]=libm::atan2(y,x); o[4]=libm::exp(e); o[5]=libm::log(l); o[6]=libm::pow(pb,pe); o[7]=libm::hypot(x,y); o[8]=libm::sqrt(x*x+y*y);
        }
    }
}
#[unsafe(no_mangle)] pub extern "C" fn buf(n: usize) -> *mut f64 { let mut v = vec![0f64; n * NF]; let p = v.as_mut_ptr(); std::mem::forget(v); p }
#[unsafe(no_mangle)] pub extern "C" fn run(mode: u32, p: *mut f64, n: usize) { let s = unsafe { std::slice::from_raw_parts_mut(p, n * NF) }; fill(mode, s, n); }
#[unsafe(no_mangle)] pub extern "C" fn inc(x: f64) -> f64 { x + 1.0 }
#[unsafe(no_mangle)] pub extern "C" fn m_sin(x: f64) -> f64 { libm::sin(x) }
#[unsafe(no_mangle)] pub extern "C" fn m_cos(x: f64) -> f64 { libm::cos(x) }
#[unsafe(no_mangle)] pub extern "C" fn m_atan2(y: f64, x: f64) -> f64 { libm::atan2(y, x) }
#[unsafe(no_mangle)] pub extern "C" fn m_exp(x: f64) -> f64 { libm::exp(x) }
#[unsafe(no_mangle)] pub extern "C" fn m_log(x: f64) -> f64 { libm::log(x) }
#[unsafe(no_mangle)] pub extern "C" fn m_pow(x: f64, y: f64) -> f64 { libm::pow(x, y) }
