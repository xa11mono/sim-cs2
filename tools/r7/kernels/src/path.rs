// (Р7, 27.11) ядро поиска пути — перенос engine/nav/path-search.js zoneDijkstra (цена перехода, сторона CT, места врагов по знанию
// с knownSegCost, огонь (fireTouches: высота и круг), куча makeHeap — та же последовательность вставок и правило «строго меньше», продолжение поиска в том же тике по тому же
// ключу, ближайший достижимый участок при недостижимой цели — в порядке ключей объекта JS). Огонь (inFire) — не перенесён: запрос с огнём
// ядро не принимает (ответ −1), его считает JS.
use crate::cast::hypot2;
use std::collections::HashMap;

pub struct Edge { to: usize, mx: f64, my: f64, z: f64, jq: f64, jf: f64 }
pub struct Node { cx: f64, cy: f64, has_c: bool, num_key: f64, side: f64, e0: usize, e1: usize }
pub struct Graph { nodes: Vec<Node>, edges: Vec<Edge>, portal: f64, side_line: f64, enemy_side: f64, kr: f64, kdet: f64, kclose: f64, fire_dz: f64, fire_detour: f64 }

struct Heap { h: Vec<(usize, f64)> }
impl Heap {
    fn less(&self, i: usize, j: usize) -> bool { self.h[i].1 < self.h[j].1 }
    fn push(&mut self, id: usize, d: f64) { self.h.push((id, d)); let mut i = self.h.len() - 1; while i > 0 { let p = (i - 1) >> 1; if !self.less(i, p) { break } self.h.swap(p, i); i = p; } }
    fn pop(&mut self) -> Option<(usize, f64)> { if self.h.is_empty() { return None } let last = self.h.pop().unwrap(); if self.h.is_empty() { return Some(last) }
        let top = self.h[0]; self.h[0] = last; let mut i = 0; let n = self.h.len();
        loop { let (l, r) = (2*i + 1, 2*i + 2); let mut s = i; if l < n && self.less(l, s) { s = l } if r < n && self.less(r, s) { s = r } if s == i { break } self.h.swap(s, i); i = s; }
        Some(top) }
}
struct State { dist: Vec<f64>, has: Vec<bool>, vis: Vec<bool>, prev: Vec<usize>, entry: Vec<(f64, f64, bool)>, order: Vec<usize>, heap: Heap, relax: Option<usize> }

static mut G: Option<Graph> = None;
static mut CACHE: Option<(f64, HashMap<Vec<u64>, State>)> = None;
static mut OUTP: Vec<f64> = Vec::new();

// граф: [N, portal, side_line, enemy_side, KNOWN_PATH_R, KNOWN_DETOUR, KNOWN_CLOSE_K, затем на участок: cx, cy, есть центр, числовой ключ (−1 — нет),
// сторона (NaN — нет), число рёбер, рёбра: (to, mid.x, mid.y, цена прыжка тихо, цена прыжка обычно)]
pub fn graph_set(v: &[f64]) {
    let n = v[0] as usize; let mut o = 9; let mut nodes = Vec::with_capacity(n); let mut edges = vec![];
    for _ in 0..n { let ne = v[o+5] as usize; let e0 = edges.len();
        nodes.push(Node { cx: v[o], cy: v[o+1], has_c: v[o+2] != 0.0, num_key: v[o+3], side: v[o+4], e0, e1: e0 + ne }); o += 6;
        for _ in 0..ne { edges.push(Edge { to: v[o] as usize, mx: v[o+1], my: v[o+2], z: v[o+3], jq: v[o+4], jf: v[o+5] }); o += 6; } }
    // память продолжения поиска — не сбрасывается: её срок задаёт JS (номер в запросе — то же правило, что у ZDJ: тик, матч, граф); связь,
    // убранная посреди тика (navUnlinkBlocked), меняет граф, а начатые поиски продолжаются по новому — как в JS. Другое число участков — сброс
    #[allow(static_mut_refs)]
    unsafe { let same_n = G.as_ref().map_or(false, |g0| g0.nodes.len() == nodes.len()); if !same_n { CACHE = None; }
        G = Some(Graph { nodes, edges, portal: v[1], side_line: v[2], enemy_side: v[3], kr: v[4], kdet: v[5], kclose: v[6], fire_dz: v[7], fire_detour: v[8] }); }
}
// knownSegCost (engine/nav/paths.js) дословно
fn known_seg_cost(g: &Graph, ax: f64, ay: f64, bx: f64, by: f64, qx: f64, qy: f64, qw: f64) -> f64 {
    let r = g.kr;
    if (ax < qx - r && bx < qx - r) || (ax > qx + r && bx > qx + r) || (ay < qy - r && by < qy - r) || (ay > qy + r && by > qy + r) { return 0.0 }
    let (dx, dy) = (bx - ax, by - ay); let l2 = dx*dx + dy*dy; if l2 < 1e-9 { return 0.0 }
    let (fx, fy) = (ax - qx, ay - qy);
    let b = 2.0*(fx*dx + fy*dy); let c = fx*fx + fy*fy - r*r; let d = b*b - 4.0*l2*c; if d <= 0.0 { return 0.0 }
    let sq = d.sqrt(); let t0 = jmax(0.0, (-b - sq)/(2.0*l2)); let t1 = jmin(1.0, (-b + sq)/(2.0*l2)); if t1 <= t0 { return 0.0 }
    let tm = jmax(0.0, jmin(1.0, -b/(2.0*l2))); let cx = ax + dx*tm - qx; let cy = ay + dy*tm - qy; let dmin = (cx*cx + cy*cy).sqrt();
    g.kdet*qw*(t1 - t0)*l2.sqrt()/(2.0*r)*(1.0 + g.kclose*jmax(0.0, 1.0 - dmin/r))
}
#[inline] fn jmin(a: f64, b: f64) -> f64 { if a.is_nan() || b.is_nan() { f64::NAN } else if a < b { a } else if b < a { b } else if a == 0.0 && (a.is_sign_negative() || b.is_sign_negative()) { -0.0 } else { a } }
#[inline] fn jmax(a: f64, b: f64) -> f64 { if a.is_nan() || b.is_nan() { f64::NAN } else if a > b { a } else if b > a { b } else if a == 0.0 && (a.is_sign_positive() || b.is_sign_positive()) { 0.0 } else { a } }

// запрос: [номер памяти поиска (JS: сменился ZDJ — новый номер), 0, от, к, CT (сторона), тихо, есть точка старта, x, y, ближайший, огонь, число мест, места (x, y, w)…]
// ответ (OUTP): [код (1 — путь, 0 — нет пути, −1 — не моё: огонь), длина, номера участков пути…, (ближайший — номер цели)]
#[allow(static_mut_refs)]
pub fn query(q: &[f64]) -> usize {
    let g = unsafe { G.as_ref().expect("граф не задан") };
    let out = unsafe { &mut OUTP }; out.clear();
    let (from, to) = (q[2] as usize, q[3] as usize); let ct = q[4] != 0.0; let quiet = q[5] != 0.0; let fx = if q[6] != 0.0 { Some((q[7], q[8])) } else { None };
    let nkp = q[11] as usize; let kp = &q[12..12 + nkp*3];
    // огонь: число, затем (x, y, z или NaN, радиус сейчас + тело) — радиус считает JS (fireRadiusNow + FIRE_BODY), проверка — fireTouches
    let fo = 12 + nkp*3; let nf = if q.len() > fo { q[fo] as usize } else { 0 }; let fr = if nf > 0 { &q[fo+1..fo+1+nf*4] } else { &q[0..0] }; let fire_on = q[10] != 0.0 && nf > 0;
    if from == to { out.push(1.0); out.push(1.0); out.push(from as f64); return 3 }
    // ключ — то же, что ключ ZDJ в JS: начало, сторона, тихо, точка старта, места врагов, огонь; номер памяти (q[0]) сменился — сброс
    let mut key: Vec<u64> = vec![from as u64, ct as u64, quiet as u64, fx.is_some() as u64]; if let Some((x, y)) = fx { key.push(x.to_bits()); key.push(y.to_bits()); }
    for v in kp { key.push(v.to_bits()); }
    if fire_on { key.push(u64::MAX); for v in fr { key.push(v.to_bits()); } }
    let stamp = q[0] * 1e6 + q[1];
    let cache = unsafe { if CACHE.as_ref().map_or(true, |c| c.0 != stamp) { CACHE = Some((stamp, HashMap::new())); } &mut CACHE.as_mut().unwrap().1 };
    let n = g.nodes.len();
    let s = cache.entry(key).or_insert_with(|| { let mut s = State { dist: vec![0.0; n], has: vec![false; n], vis: vec![false; n], prev: vec![usize::MAX; n],
        entry: vec![(0.0, 0.0, false); n], order: vec![], heap: Heap { h: vec![] }, relax: None };
        s.dist[from] = 0.0; s.has[from] = true; if let Some((x, y)) = fx { s.entry[from] = (x, y, true); } s.heap.push(from, 0.0); s });
    let relax = |s: &mut State, u: usize| {
        let nu = &g.nodes[u]; let (fcx, fcy) = if s.entry[u].2 { (s.entry[u].0, s.entry[u].1) } else { (nu.cx, nu.cy) };
        for ei in nu.e0..nu.e1 { let e = &g.edges[ei];
            if s.vis[e.to] { continue }
            let mut w = hypot2(fcx - e.mx, fcy - e.my) + g.portal + if quiet { e.jq } else { e.jf };
            if ct { let sd = g.nodes[e.to].side; if !sd.is_nan() && sd < g.side_line { w *= g.enemy_side; } }
            if fire_on { for f in 0..nf { let (fx, fy, fz, frr) = (fr[f*4], fr[f*4+1], fr[f*4+2], fr[f*4+3]);
                    if !e.z.is_nan() && !fz.is_nan() && (e.z - fz).abs() > g.fire_dz { continue }
                    if hypot2(e.mx - fx, e.my - fy) < frr { w += g.fire_detour; break } } }
            if nkp > 0 { let (sax, say, sbx, sby) = (fcx, fcy, e.mx, e.my);
                let (mnx, mxx) = if sax < sbx { (sax, sbx) } else { (sbx, sax) }; let (mny, mxy) = if say < sby { (say, sby) } else { (sby, say) };
                for k in 0..nkp { let (qx, qy, qw) = (kp[k*3], kp[k*3+1], kp[k*3+2]);
                    if mxx < qx - g.kr || mnx > qx + g.kr || mxy < qy - g.kr || mny > qy + g.kr { continue }
                    w += known_seg_cost(g, fcx, fcy, e.mx, e.my, qx, qy, qw); } }
            let alt = s.dist[u] + w;
            if !s.has[e.to] || alt < s.dist[e.to] { s.dist[e.to] = alt; s.has[e.to] = true; s.prev[e.to] = u; s.entry[e.to] = (e.mx, e.my, true); s.heap.push(e.to, alt); }
        }
    };
    if !s.vis[to] {
        if let Some(r) = s.relax.take() { relax(s, r); }
        while let Some((u, _)) = s.heap.pop() { if s.vis[u] { continue } s.vis[u] = true; s.order.push(u); if u == to { s.relax = Some(u); break } relax(s, u); }
    }
    let mut target = to;
    if !s.has[to] {
        if q[9] == 0.0 { out.push(0.0); return 1 }
        // ближайший к цели раскрытый участок: ключи объекта JS — числовые по возрастанию, затем прочие по порядку раскрытия
        let tc = &g.nodes[to]; let mut ord: Vec<usize> = s.order.iter().cloned().filter(|&k| g.nodes[k].num_key >= 0.0).collect();
        ord.sort_by(|a, b| g.nodes[*a].num_key.partial_cmp(&g.nodes[*b].num_key).unwrap()); ord.extend(s.order.iter().cloned().filter(|&k| g.nodes[k].num_key < 0.0));
        let (mut best, mut bd) = (usize::MAX, f64::INFINITY);
        for k in ord { let c = &g.nodes[k]; if !c.has_c { continue } let d = hypot2(c.cx - tc.cx, c.cy - tc.cy); if d < bd { bd = d; best = k; } }
        if best == usize::MAX { out.push(0.0); return 1 }
        target = best;
    }
    let mut path = vec![target]; let mut cur = target;
    while cur != from { let p = s.prev[cur]; if p == usize::MAX { out.clear(); out.push(0.0); return 1 } cur = p; path.push(cur); }
    path.reverse(); out.push(1.0); out.push(path.len() as f64); for p in path { out.push(p as f64) } out.len()
}
#[allow(static_mut_refs)] pub fn out_ptr() -> *const f64 { unsafe { OUTP.as_ptr() } }
#[allow(static_mut_refs)] pub fn out_slice() -> &'static [f64] { unsafe { &OUTP } }
