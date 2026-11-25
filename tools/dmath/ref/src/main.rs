// (Р0.12) dmath_ref <функция> <вход.bin> <выход.bin>: вход — f64 little-endian (для atan2 / pow / hypot — пары), выход — f64 результат libm.
use std::io::{Read, Write};
fn main() {
    let a: Vec<String> = std::env::args().collect();
    let (f, inp, out) = (a[1].as_str(), &a[2], &a[3]);
    let mut b = Vec::new(); std::fs::File::open(inp).unwrap().read_to_end(&mut b).unwrap();
    let v: Vec<f64> = b.chunks(8).map(|c| f64::from_le_bytes(c.try_into().unwrap())).collect();
    let two = matches!(f, "atan2" | "pow" | "hypot");
    let r: Vec<f64> = if two { v.chunks(2).map(|p| match f { "atan2" => libm::atan2(p[0], p[1]), "pow" => libm::pow(p[0], p[1]), _ => libm::hypot(p[0], p[1]) }).collect() }
        else { v.iter().map(|&x| match f { "sin" => libm::sin(x), "cos" => libm::cos(x), "atan" => libm::atan(x), "acos" => libm::acos(x), "exp" => libm::exp(x), "log" => libm::log(x), "sqrt" => libm::sqrt(x), _ => panic!("функция") }).collect() };
    let mut o = std::fs::File::create(out).unwrap(); for x in r { o.write_all(&x.to_le_bytes()).unwrap(); }
}
