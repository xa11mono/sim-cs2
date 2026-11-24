use std::io::Read;
fn main(){ let mut s=String::new(); std::fs::File::open(std::env::args().nth(1).unwrap()).unwrap().read_to_string(&mut s).unwrap();
  let mut it=s.split_whitespace(); let mut nx=||->f64{ it.next().unwrap().parse().unwrap() };
  let (nn,ne,nk,nq)=(nx() as usize,nx() as usize,nx() as usize,nx() as usize); let (r,det,ck)=(nx(),nx(),nx());
  let nodes:Vec<(f64,f64)>=(0..nn).map(|_|(nx(),nx())).collect(); let edges:Vec<(u32,u32,f64,f64,f64)>=(0..ne).map(|_|(nx() as u32,nx() as u32,nx(),nx(),nx())).collect();
  let kp:Vec<[f64;3]>=(0..nk).map(|_|[nx(),nx(),nx()]).collect(); let qs:Vec<(usize,usize)>=(0..nq).map(|_|(nx() as usize,nx() as usize)).collect();
  let mut g=rdj::G::new(&nodes,&edges,kp,r,det,ck);
  for _ in 0..2 { for q in qs.iter().take(300) { g.query(q.0,q.1); } }
  let t0=std::time::Instant::now(); let mut sum=0.0; for _ in 0..3 { for q in qs.iter() { sum+=g.query(q.0,q.1); } }
  let ms=t0.elapsed().as_secs_f64()*1000.0; let n=3*qs.len();
  println!("{{\"variant\":\"C_rust_native\",\"queries\":{},\"totalMs\":{:.1},\"usPerQuery\":{:.2},\"checksum\":{:.3}}}", n, ms, ms*1000.0/n as f64, sum); }
