use napi::bindgen_prelude::*;
use napi_derive::napi;
#[napi] pub fn inc(x: f64) -> f64 { x + 1.0 }
#[napi] pub fn sum(a: Float64Array) -> f64 { let mut s = 0.0; for v in a.iter() { s += *v; } s }
#[napi] pub fn libm_sin(x: f64) -> f64 { libm_like(x) }
fn libm_like(x: f64) -> f64 { x.sin() }
