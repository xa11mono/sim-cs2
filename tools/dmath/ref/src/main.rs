// (Р0.12) dmath_ref <функция> <вход.bin> <выход.bin>: вход — f64 little-endian (для atan2 / pow / hypot — пары), выход — f64 результат libm.
use std::io::{Read, Write};
fn main() {
    let a: Vec<String> = std::env::args().collect();
    let (f, inp, out) = (a[1].as_str(), &a[2], &a[3]);
    let mut b = Vec::new(); std::fs::File::open(inp).unwrap().read_to_end(&mut b).unwrap();
    let v: Vec<f64> = b.chunks(8).map(|c| f64::from_le_bytes(c.try_into().unwrap())).collect();
    let two = matches!(f, "atan2" | "pow" | "hypot" | "pow_js" | "hypot_v8");
    let r: Vec<f64> = if f == "hypot3_v8" { v.chunks(3).map(hypot_v8).collect() }
        else if two { v.chunks(2).map(|p| match f { "atan2" => libm::atan2(p[0], p[1]), "pow" => libm::pow(p[0], p[1]), "pow_js" => pow_js(p[0], p[1]),
            "hypot_v8" => hypot_v8(p), _ => libm::hypot(p[0], p[1]) }).collect() }
        else { v.iter().map(|&x| match f { "sin" => libm::sin(x), "cos" => libm::cos(x), "atan" => libm::atan(x), "acos" => libm::acos(x), "exp" => libm::exp(x), "log" => libm::log(x), "sqrt" => libm::sqrt(x), _ => panic!("функция") }).collect() };
    let mut o = std::fs::File::create(out).unwrap(); for x in r { o.write_all(&x.to_le_bytes()).unwrap(); }
}
// (Р2.2) контракт JS у pow: pow(x, NaN) = NaN, pow(±1, ±∞) = NaN (в libm — 1); остальное — libm (src/game/005_dmath.ts)
fn pow_js(x: f64, y: f64) -> f64 { if y.is_nan() { return f64::NAN; } if (x == 1.0 || x == -1.0) && y.is_infinite() { return f64::NAN; } libm::pow(x, y) }
// (Р2.2) hypot — алгоритм V8 (MathHypot): модули и максимум, ∞ раньше NaN, сумма (x/max)² с поправкой Кэхэна, √ · max — только точные операции
fn hypot_v8(v: &[f64]) -> f64 {
    if v.is_empty() { return 0.0; }
    let mut abs = vec![0.0f64; v.len()]; let mut nan = false; let mut max = 0.0f64;
    for (i, &x) in v.iter().enumerate() { if x.is_nan() { nan = true; } else { let a = x.abs(); abs[i] = a; if a > max { max = a; } } }
    if max == f64::INFINITY { return f64::INFINITY; } if nan { return f64::NAN; } if max == 0.0 { return 0.0; }
    let (mut sum, mut comp) = (0.0f64, 0.0f64);
    for &a in &abs { let q = a / max; let s = q * q - comp; let p = sum + s; comp = (p - sum) - s; sum = p; }
    sum.sqrt() * max
}
