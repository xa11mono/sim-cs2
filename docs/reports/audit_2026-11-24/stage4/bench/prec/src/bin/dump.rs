use std::io::Write;
fn main(){ let n: usize = std::env::args().nth(1).unwrap().parse().unwrap(); for mode in 0..2u32 { let mut v = vec![0f64; n*prec::NF]; prec::fill(mode, &mut v, n);
  let mut f = std::fs::File::create(format!("native_{}.bin", if mode==0 {"std"} else {"libm"})).unwrap(); let b: Vec<u8> = v.iter().flat_map(|x| x.to_le_bytes()).collect(); f.write_all(&b).unwrap(); } }
