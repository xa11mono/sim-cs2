// (Р7, 27.11) связка ядер Rust с игрой (Node: ядро игры через tools/node/core_run.js; страница — тот же код через --inject).
// attach(EV, {backend: 'wasm' | 'napi', mode: 'shadow' | 'speed', cast: true, path: true}) — подменяет m3Cast и zoneDijkstra в области игры.
//  shadow — считает и JS, и ядро на КАЖДОМ запросе матча, сравнивает ответы (биты чисел, ключи и их порядок, типы номеров), игра идёт по JS;
//  speed — отвечает только ядро (геометрия и граф — один раз; запрос — числа; ответ — общий буфер), счётчик M.bStamp ведётся как в JS.
// Запросы, которые ядро не берёт (вид луча не sight / nade / sky, поиск с огнём), считает JS — их доля в отчёте.
'use strict';
const HAS_NODE = typeof require === 'function' && typeof process !== 'undefined' && !!(process.versions && process.versions.node);
const fs = HAS_NODE ? require('fs') : null, path = HAS_NODE ? require('path') : null;
const KDIR = HAS_NODE ? path.join(__dirname, '..') : '';
function loadBackend(kind, wasmBytes) {
  if (kind === 'napi') {
    const f = ['libsim_r7_kernels.so', 'sim_r7_kernels.dll', 'libsim_r7_kernels.dylib'].map(n => path.join(KDIR, 'target-napi/release', n)).find(fs.existsSync);
    const m = { exports: {} }; process.dlopen(m, f); const N = m.exports, out = new Float64Array(7), pout = new Float64Array(4096);
    return { name: 'napi', geoInit: N.geoInitN, geoSet: (fld, u8) => N.geoSetN(fld, u8), geoFill: v => N.geoFillN(v), geoReady: N.geoReadyN,
      cast: (k, ax, ay, az, bx, by, bz, f) => { N.castN(k, ax, ay, az, bx, by, bz, f, out); return out; },
      nade: (ax, ay, az, bx, by, bz, r, sk) => { N.nadeN(ax, ay, az, bx, by, bz, r, sk, out); return out; },
      pathGraph: v => N.pathGraphN(v), pathQuery: q => { const n = N.pathQueryN(q, pout); return pout.subarray(0, n); } };
  }
  const wasm = wasmBytes || fs.readFileSync(path.join(KDIR, 'target/wasm32-unknown-unknown/release/sim_r7_kernels.wasm'));
  const I = new WebAssembly.Instance(new WebAssembly.Module(wasm), {}).exports;
  const put = u8 => { const p = I.r7_alloc(u8.byteLength); new Uint8Array(I.memory.buffer, p, u8.byteLength).set(u8); return p; };
  let outV = null;
  return { name: 'wasm', geoInit: I.r7_geo_init, geoSet: (fld, u8) => { const p = put(u8); I.r7_geo_set(fld, p, u8.byteLength); I.r7_free(p, u8.byteLength); },
    geoFill: v => { const u8 = new Uint8Array(v.buffer, v.byteOffset, v.byteLength), p = put(u8); I.r7_geo_fill(p, v.length); I.r7_free(p, u8.byteLength); },
    geoReady: I.r7_geo_ready,
    cast: (k, ax, ay, az, bx, by, bz, f) => { I.r7_cast(k, ax, ay, az, bx, by, bz, f); if (!outV || outV.buffer !== I.memory.buffer) outV = new Float64Array(I.memory.buffer, I.r7_out(), 7); return outV; },
    nade: (ax, ay, az, bx, by, bz, r, sk) => { I.r7_nade(ax, ay, az, bx, by, bz, r, sk); if (!outV || outV.buffer !== I.memory.buffer) outV = new Float64Array(I.memory.buffer, I.r7_out(), 7); return outV; },
    pathGraph: v => { const u8 = new Uint8Array(v.buffer, v.byteOffset, v.byteLength), p = put(u8); I.r7_path_graph(p, v.length); I.r7_free(p, u8.byteLength); },
    pathQuery: q => { const u8 = new Uint8Array(q.buffer, q.byteOffset, q.byteLength), p = put(u8); const n = I.r7_path_query(p, q.length); I.r7_free(p, u8.byteLength);
      return new Float64Array(I.memory.buffer, I.r7_path_out(), n); } };
}
const u8of = a => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
function flatLists(L) { const off = new Uint32Array(L.length + 1); let n = 0; L.forEach((x, i) => { off[i] = n; n += x.length; }); off[L.length] = n;
  const v = new Uint32Array(n); let o = 0; L.forEach(x => { for (const k of x) v[o++] = k; }); return [off, v]; }
function attach(EV, opt) {
  const B = loadBackend(opt.backend || 'wasm', opt.wasmBytes), mode = opt.mode || 'shadow', st = { backend: B.name, mode, cast: { n: 0, kern: 0, js: 0, bad: 0, firstBad: null }, path: { n: 0, kern: 0, js: 0, bad: 0, firstBad: null }, upload_ms: 0 };
  const t0 = performance.now();
  if (opt.cast !== false) {
    EV('m3Col(m3(), "nade"); m3Col(m3(), "sky"); if(!m3().fill && typeof m3SolidFill === "function") m3SolidFill(m3()); 1');
    const M = EV('m3()'); st.M = M;
    B.geoInit(M.W, M.cell, M.unit, M.X0, M.Y0, M.B, M.BN);
    const [bo, bt] = flatLists(M.bTri), [ho, bh] = flatLists(M.bHull);
    B.geoSet(0, u8of(M.tri)); B.geoSet(1, u8of(M.triFlag)); B.geoSet(2, u8of(M.triZ)); B.geoSet(3, u8of(bo)); B.geoSet(4, u8of(bt)); B.geoSet(5, u8of(ho)); B.geoSet(6, u8of(bh));
    B.geoSet(7, u8of(M.hullP)); B.geoSet(8, u8of(M.hullOff)); B.geoSet(9, u8of(M.hullFlag)); B.geoSet(19, u8of(M.hullBox));
    [M.sight, M.nade, M.sky].forEach((c, k) => { B.geoSet(10 + 3*k, u8of(c.st)); B.geoSet(11 + 3*k, u8of(c.lo)); B.geoSet(12 + 3*k, u8of(c.hi)); });
    const F = M.fill || [], fv = [F.length]; F.forEach(f => { fv.push(...f.box, f.p.length); f.p.forEach(p => fv.push(p[0], p[1], p[2], p[3])); }); B.geoFill(new Float64Array(fv)); B.geoReady();
    const KIND = { sight: 0, nade: 1, sky: 2 };
    globalThis.__R7cast = function (orig, M2, ax, ay, az, bx, by, bz, kind, first) {
      const C = st.cast; C.n++; const k = KIND[kind];
      if (M2 !== M || k === undefined) { C.js++; return orig(M2, ax, ay, az, bx, by, bz, kind, first); }
      const mk = () => { const o = B.cast(k, ax, ay, az, bx, by, bz, first ? 1 : 0), v = o[0]; if (v === 0) return null; if (v === 1) return { t: o[1] };
        let r; if (v === 2) { r = { t: o[1], tri: o[2] }; if (first) { r.nx = o[4]; r.ny = o[5]; r.nz = o[6]; r.mat = M.mats[M.triMat[o[2]]]; } }
        else if (v === 3) { r = { t: o[1], hull: o[2], plane: o[3] }; if (first) { r.nx = o[4]; r.ny = o[5]; r.nz = o[6]; r.mat = M.mats[M.hullMat[o[2]]]; } }
        else { r = { t: o[1], fill: o[2] }; if (first) { r.nx = 0; r.ny = 0; r.nz = 1; r.mat = 'wood'; } } return r; };
      C.kern++;
      if (mode === 'shadow') { const a = orig(M2, ax, ay, az, bx, by, bz, kind, first), b = mk();
        if (!same(a, b)) { C.bad++; if (!C.firstBad) C.firstBad = { args: [ax, ay, az, bx, by, bz, kind, first], js: a, kernel: b }; } return a; }
      const s = ++M.bStamp; if (s > 4e9) { M.bSeen.fill(0); M.bStamp = 1; } return mk();
    };
    // полёт гранаты (m3NadeTrace): ход кубика ±r — первое касание
    const SKIN = EV('M3_SKIN'), PRIM = [null, 'tri', 'hull', 'fill'];
    st.nade = { n: 0, kern: 0, js: 0, bad: 0, firstBad: null };
    globalThis.__R7nade = function (orig, M2, A, Bp, r) {
      const C = st.nade; C.n++; if (M2 !== M || opt.nade === false) { C.js++; return orig(M2, A, Bp, r); }
      const mk = () => { const o = B.nade(A[0], A[1], A[2], Bp[0], Bp[1], Bp[2], r || 0, SKIN), v = o[0]; if (v === 0) return null;
        return { f: o[1], n: [o[3], o[4], o[5]], mat: v === 1 ? M.mats[M.triMat[o[2]]] : v === 2 ? M.mats[M.hullMat[o[2]]] : 'wood', sky: false, prim: PRIM[v] }; };
      C.kern++;
      if (mode === 'shadow') { const a = orig(M2, A, Bp, r), b = mk(); if (!same(a, b)) { C.bad++; if (!C.firstBad) C.firstBad = { A: Array.from(A), B: Array.from(Bp), r, js: a, kernel: b }; } return a; }
      if (M.nStamp !== undefined) M.nStamp++; return mk();
    };
    EV('var __r7n0 = m3NadeTrace; m3NadeTrace = function(M, A, B, r){ return __R7nade(__r7n0, M, A, B, r); }; 1');
    EV('var __r7c0 = m3Cast; m3Cast = function(M, ax, ay, az, bx, by, bz, kind, first){ return __R7cast(__r7c0, M, ax, ay, az, bx, by, bz, kind, first); }; 1');
  }
  if (opt.path !== false) {
    // граф — из области игры: участки (ключи zoneGraph и концы рёбер), центр (zoneCentroid), сторона CT (zoneSideMap), цена прыжка (navJumpCost)
    globalThis.__R7graph = function (flat, ids, vals) { B.pathGraph(new Float64Array(flat)); st.ids = ids; st.vals = vals; };
    globalThis.__R7path = function (orig, fromId, toId, team, ctx, q) {
      const P = st.path; P.n++;
      if (!q) { P.js++; return orig(fromId, toId, team, ctx); }
      const o = B.pathQuery(q);
      if (o[0] === -1) { P.js++; return orig(fromId, toId, team, ctx); }
      P.kern++;
      let r = null;
      if (o[0] === 1) { const n = o[1]; r = new Array(n); for (let i = 0; i < n; i++) r[i] = st.vals[o[2 + i]]; r[0] = fromId;
        const last = o[2 + n - 1]; r[n - 1] = last === q[3] ? toId : (isNaN(+st.ids[last]) ? st.ids[last] : +st.ids[last]); if (n === 1) r[0] = fromId; }
      if (mode === 'shadow') { const a = orig(fromId, toId, team, ctx); if (!same(a, r)) { P.bad++; if (!P.firstBad) P.firstBad = { q: Array.from(q).slice(0, 12), js: a, kernel: r }; } return a; }
      return r;
    };
    EV(`var __r7g = null, __r7ix = null, __r7z0 = zoneDijkstra;
function __r7up(){ var keys = Object.keys(zoneGraph), ix = new Map(), ids = [], vals = [], side = zoneSideMap();
  function add(id){ var k = String(id), i = ix.get(k); if(i === undefined){ i = ids.length; ix.set(k, i); ids.push(k); vals.push(id); } return i; }
  keys.forEach(function(k){ add(isNaN(+k) ? k : +k); (zoneGraph[k] || []).forEach(function(e){ add(e.to); }); });
  var f = [ids.length, ROUTE_PORTAL, ROUTE_SIDE_LINE, ROUTE_ENEMY_SIDE, KNOWN_PATH_R, KNOWN_DETOUR, KNOWN_CLOSE_K, FIRE_DZ, FIRE_DETOUR];
  ids.forEach(function(k){ var z = zonesById[k], c = z ? zoneCentroid(z) : null, num = /^(0|[1-9][0-9]*)$/.test(k) && +k < 4294967295 ? +k : -1, sd = side[k];
    var EL = zoneGraph[k] || []; f.push(c ? c.x : 0, c ? c.y : 0, c ? 1 : 0, num, sd === undefined ? NaN : sd === null ? 0 : +sd, EL.length);
    EL.forEach(function(e){ f.push(add(e.to), e.mid.x, e.mid.y, e.z == null ? NaN : e.z, navJumpCost(z, e, true), navJumpCost(z, e, false)); }); });
  __r7g = zoneGraph; __r7ix = ix; __R7graph(f, ids, vals); }
zoneDijkstra = function(fromId, toId, team, ctx){
  if(fromId === toId) return [fromId];
  if(zoneGraph !== __r7g) __r7up();
  var c = ctx || {}, fi = __r7ix.get(String(fromId)), ti = __r7ix.get(String(toId));
  var fireOn = !!(c.fire && fires.length);
  if(fi === undefined || ti === undefined || fi === ti) return __R7path(__r7z0, fromId, toId, team, ctx, null);
  var tp0 = c.toPt, KP = c.fire && team ? knownPathSpots(team).filter(function(q){ return !tp0 || DM.hypot(q.x-tp0.x, q.y-tp0.y) > KNOWN_PATH_R; }) : [];
  var nf = fireOn ? fires.length : 0, q = new Float64Array(13 + KP.length*3 + nf*4), fx = c.from, fo = 12 + KP.length*3;
  q[0] = tick; q[1] = matchNum; q[2] = fi; q[3] = ti; q[4] = team === "CT" ? 1 : 0; q[5] = c.quiet ? 1 : 0; q[6] = fx ? 1 : 0; q[7] = fx ? fx.x : 0; q[8] = fx ? fx.y : 0;
  q[9] = c.nearest ? 1 : 0; q[10] = fireOn ? 1 : 0; q[11] = KP.length; for(var i = 0; i < KP.length; i++){ q[12+i*3] = KP[i].x; q[13+i*3] = KP[i].y; q[14+i*3] = KP[i].w; }
  q[fo] = nf; for(var j = 0; j < nf; j++){ var F = fires[j]; q[fo+1+j*4] = F.x; q[fo+2+j*4] = F.y; q[fo+3+j*4] = F.z == null ? NaN : F.z; q[fo+4+j*4] = fireRadiusNow(F) + FIRE_BODY; }
  return __R7path(__r7z0, fromId, toId, team, ctx, q);
}; 1`);
  }
  st.upload_ms = +(performance.now() - t0).toFixed(1);
  return st;
}
// равенство ответов: биты чисел (−0, NaN), ключи и их порядок, типы
function same(a, b) {
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return Object.is(a, b);
  const ka = Object.keys(a), kb = Object.keys(b); if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every(k => same(a[k], b[k]));
}
if (typeof module !== 'undefined' && module.exports) module.exports = { attach }; else globalThis.R7attach = attach;
