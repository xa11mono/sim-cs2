// Тот же алгоритм, что вариант B (bench.js): Дейкстра + knownSegCost. Без зависимостей; WASM — через extern "C" и линейную память.
pub struct G { pub n: usize, pub off: Vec<u32>, pub et: Vec<u32>, pub emx: Vec<f64>, pub emy: Vec<f64>, pub ewb: Vec<f64>, pub cx: Vec<f64>, pub cy: Vec<f64>,
  pub kp: Vec<[f64;3]>, pub r: f64, pub det: f64, pub ck: f64,
  dist: Vec<f64>, enx: Vec<f64>, eny: Vec<f64>, vis: Vec<u8>, has: Vec<u8>, hp: Vec<f64>, hi: Vec<u32> }
#[inline] fn ksc(g:&G, ax:f64,ay:f64,bx:f64,by:f64,qx:f64,qy:f64,qw:f64)->f64{ let r=g.r;
  if (ax<qx-r&&bx<qx-r)||(ax>qx+r&&bx>qx+r)||(ay<qy-r&&by<qy-r)||(ay>qy+r&&by>qy+r) { return 0.0; }
  let dx=bx-ax; let dy=by-ay; let l2=dx*dx+dy*dy; if l2<1e-9 { return 0.0; } let fx=ax-qx; let fy=ay-qy;
  let b=2.0*(fx*dx+fy*dy); let c=fx*fx+fy*fy-r*r; let d=b*b-4.0*l2*c; if d<=0.0 { return 0.0; }
  let sq=d.sqrt(); let t0=f64::max(0.0,(-b-sq)/(2.0*l2)); let t1=f64::min(1.0,(-b+sq)/(2.0*l2)); if t1<=t0 { return 0.0; }
  let tm=f64::max(0.0,f64::min(1.0,-b/(2.0*l2))); let cx=ax+dx*tm-qx; let cy=ay+dy*tm-qy; let dmin=(cx*cx+cy*cy).sqrt();
  g.det*qw*(t1-t0)*l2.sqrt()/(2.0*r)*(1.0+g.ck*f64::max(0.0,1.0-dmin/r)) }
#[inline] fn wedge(g:&G, ax:f64,ay:f64,mx:f64,my:f64,wb:f64)->f64{ let ddx=mx-ax; let ddy=my-ay; let mut w=(ddx*ddx+ddy*ddy).sqrt()+wb;
  let (mnx,mxx)=if ax<mx {(ax,mx)} else {(mx,ax)}; let (mny,mxy)=if ay<my {(ay,my)} else {(my,ay)};
  for q in g.kp.iter(){ if mxx<q[0]-g.r||mnx>q[0]+g.r||mxy<q[1]-g.r||mny>q[1]+g.r { continue; } w+=ksc(g,ax,ay,mx,my,q[0],q[1],q[2]); } w }
impl G {
  pub fn new(nodes:&[(f64,f64)], edges:&[(u32,u32,f64,f64,f64)], kp:Vec<[f64;3]>, r:f64, det:f64, ck:f64)->G{
    let n=nodes.len(); let mut cnt=vec![0u32;n]; for e in edges { cnt[e.0 as usize]+=1; } let mut off=vec![0u32;n+1]; for i in 0..n { off[i+1]=off[i]+cnt[i]; }
    let m=edges.len(); let mut et=vec![0u32;m]; let mut emx=vec![0.0;m]; let mut emy=vec![0.0;m]; let mut ewb=vec![0.0;m]; let mut pos:Vec<u32>=off[..n].to_vec();
    for e in edges { let p=pos[e.0 as usize] as usize; pos[e.0 as usize]+=1; et[p]=e.1; emx[p]=e.2; emy[p]=e.3; ewb[p]=e.4; }
    G{ n, off, et, emx, emy, ewb, cx:nodes.iter().map(|c|c.0).collect(), cy:nodes.iter().map(|c|c.1).collect(), kp, r, det, ck,
       dist:vec![0.0;n], enx:vec![0.0;n], eny:vec![0.0;n], vis:vec![0;n], has:vec![0;n], hp:Vec::with_capacity(1024), hi:Vec::with_capacity(1024) } }
  fn hpush(&mut self,i:u32,p:f64){ self.hp.push(p); self.hi.push(i); let mut k=self.hp.len()-1; while k>0 { let j=(k-1)>>1; if self.hp[j]<=p { break; } self.hp[k]=self.hp[j]; self.hi[k]=self.hi[j]; k=j; } self.hp[k]=p; self.hi[k]=i; }
  fn hpop(&mut self)->u32{ let top=self.hi[0]; let lp=self.hp.pop().unwrap(); let li=self.hi.pop().unwrap(); let n=self.hp.len(); if n==0 { return top; } let mut k=0;
    loop { let a=2*k+1; let b=a+1; if a>=n { break; } let m= if b<n && self.hp[b]<self.hp[a] {b} else {a}; if self.hp[m]>=lp { break; } self.hp[k]=self.hp[m]; self.hi[k]=self.hi[m]; k=m; }
    self.hp[k]=lp; self.hi[k]=li; top }
  pub fn query(&mut self,f:usize,t:usize)->f64{ for v in self.dist.iter_mut(){*v=f64::INFINITY;} for v in self.vis.iter_mut(){*v=0;} for v in self.has.iter_mut(){*v=0;} self.hp.clear(); self.hi.clear();
    self.dist[f]=0.0; self.hpush(f as u32,0.0);
    while !self.hp.is_empty(){ let u=self.hpop() as usize; if self.vis[u]!=0 { continue; } self.vis[u]=1; if u==t { break; }
      let (ax,ay)= if self.has[u]!=0 {(self.enx[u],self.eny[u])} else {(self.cx[u],self.cy[u])};
      for k in self.off[u] as usize..self.off[u+1] as usize { let v=self.et[k] as usize; if self.vis[v]!=0 { continue; }
        let alt=self.dist[u]+wedge(self,ax,ay,self.emx[k],self.emy[k],self.ewb[k]);
        if alt<self.dist[v] { self.dist[v]=alt; self.enx[v]=self.emx[k]; self.eny[v]=self.emy[k]; self.has[v]=1; self.hpush(v as u32,alt); } } }
    if self.dist[t].is_infinite() { -1.0 } else { self.dist[t] } }
}
// ---- WASM: плоские буферы в линейной памяти
static mut GG: Option<G> = None;
#[no_mangle] pub extern "C" fn alloc_f64(n: usize) -> *mut f64 { let mut v=vec![0f64;n]; let p=v.as_mut_ptr(); std::mem::forget(v); p }
#[no_mangle] pub unsafe extern "C" fn init(nodes:*const f64, nn:usize, edges:*const f64, ne:usize, kp:*const f64, nk:usize, r:f64, det:f64, ck:f64){
  let ns=std::slice::from_raw_parts(nodes,nn*2); let es=std::slice::from_raw_parts(edges,ne*5); let ks=std::slice::from_raw_parts(kp,nk*3);
  let nodes:Vec<(f64,f64)>=(0..nn).map(|i|(ns[2*i],ns[2*i+1])).collect(); let edges:Vec<(u32,u32,f64,f64,f64)>=(0..ne).map(|i|(es[5*i] as u32,es[5*i+1] as u32,es[5*i+2],es[5*i+3],es[5*i+4])).collect();
  let kp:Vec<[f64;3]>=(0..nk).map(|i|[ks[3*i],ks[3*i+1],ks[3*i+2]]).collect(); GG=Some(G::new(&nodes,&edges,kp,r,det,ck)); }
#[no_mangle] pub unsafe extern "C" fn query(f:u32,t:u32)->f64{ (*std::ptr::addr_of_mut!(GG)).as_mut().unwrap().query(f as usize,t as usize) }
#[no_mangle] pub unsafe extern "C" fn query_batch(q:*const u32, n:usize)->f64{ let qs=std::slice::from_raw_parts(q,n*2); let g=(*std::ptr::addr_of_mut!(GG)).as_mut().unwrap(); let mut s=0.0; for i in 0..n { s+=g.query(qs[2*i] as usize, qs[2*i+1] as usize); } s }
pub fn tri_hits(t:&[f64], s:&[f64])->(u64,f64){ let (mut h, mut acc)=(0u64,0.0f64); let nt=t.len()/9; let ns=s.len()/6;
  for i in 0..ns { let (ox,oy,oz)=(s[6*i],s[6*i+1],s[6*i+2]); let (dx,dy,dz)=(s[6*i+3]-ox,s[6*i+4]-oy,s[6*i+5]-oz);
    for j in 0..nt { let o=9*j; let (ax,ay,az)=(t[o],t[o+1],t[o+2]); let (e1x,e1y,e1z)=(t[o+3]-ax,t[o+4]-ay,t[o+5]-az); let (e2x,e2y,e2z)=(t[o+6]-ax,t[o+7]-ay,t[o+8]-az);
      let (px,py,pz)=(dy*e2z-dz*e2y, dz*e2x-dx*e2z, dx*e2y-dy*e2x); let det=e1x*px+e1y*py+e1z*pz; if det>-1e-12 && det<1e-12 { continue; } let inv=1.0/det;
      let (tx,ty,tz)=(ox-ax,oy-ay,oz-az); let u=(tx*px+ty*py+tz*pz)*inv; if u<0.0||u>1.0 { continue; } let (qx,qy,qz)=(ty*e1z-tz*e1y, tz*e1x-tx*e1z, tx*e1y-ty*e1x);
      let v=(dx*qx+dy*qy+dz*qz)*inv; if v<0.0||u+v>1.0 { continue; } let tt=(e2x*qx+e2y*qy+e2z*qz)*inv; if tt<0.0||tt>1.0 { continue; } h+=1; acc+=tt; } } (h,acc) }
#[no_mangle] pub unsafe extern "C" fn tri_bench(t:*const f64, nt:usize, s:*const f64, ns:usize, out:*mut f64){ let r=tri_hits(std::slice::from_raw_parts(t,nt*9), std::slice::from_raw_parts(s,ns*6)); *out=r.0 as f64; *out.add(1)=r.1; }
