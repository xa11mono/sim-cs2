fn main(){ let mut s:u32=12345; let mut r=||->f64{ s=s.wrapping_mul(1664525).wrapping_add(1013904223); s as f64/4294967296.0 };
  let t:Vec<f64>=(0..256*9).map(|_|r()*100.0).collect(); let sg:Vec<f64>=(0..4000*6).map(|_|r()*100.0).collect(); rdj::tri_hits(&t,&sg);
  let t0=std::time::Instant::now(); let mut res=(0,0.0); for _ in 0..5 { res=rdj::tri_hits(&t,&sg); } let ms=t0.elapsed().as_secs_f64()*1000.0;
  println!("{{\"variant\":\"rust_native\",\"ms\":{:.1},\"nsPerTest\":{:.2},\"hits\":{},\"acc\":{}}}", ms, ms*1e6/(5.0*4000.0*256.0), res.0, res.1); }
