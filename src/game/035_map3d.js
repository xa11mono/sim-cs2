// ======================= А5 (20.10.2026): КАРТА ИЗ 3D-ГЕОМЕТРИИ ИГРЫ — MAP.map3d =======================
// Данные — data/maps/<карта>/map3d.json (сборка tools/map3d/columns.py → layers.py, устройство — docs/ARCHITECTURE.md,
// «Карта 3D»). Есть у карты — видимость (040_visibility), «внутри стены» и «шаг сквозь стену» (050, 060) идут по геометрии
// игры, а стены радара (walls.json) — только рисование. Нет (Ancient до А6) — всё по-старому, по стенам радара и навмешу.
// Здесь же — чтение файла (zlib в base64, распаковка своя — синхронно, без DecompressionStream) и луч; образец и проверка
// в node — tools/map3d/map3d.js (берёт этот файл).
//   m3()                                  → загруженная геометрия (один раз, при первом вопросе) или null
//   m3Line(M, ax,ay,az, bx,by,bz, kind)   → true, если линия свободна ('sight' — взгляд и пули, 'nade' — гранаты)
//   m3Hit(M, …, 'nade')                   → первое попадание {t, nx, ny, nz, mat} или null
//   m3NadeTrace(M, A, B)                  → луч гранаты в ед. игры — для физики гранаты (385_nades_flight, В3)
//   m3Floors(M, x, y) / m3FloorKinds      → этажи клетки (z по возрастанию; вид: 1 — пешком, 2 — прыжком, 3 — подсадкой)
//   m3Solid(x, y) / m3SolidHit(…)         → «внутри стены»: в клетке нет ни этажа геометрии, ни участка навмеша
// Координаты: x, y — радар 0..2048, z — ед. игры.
var MAP3D = (typeof MAP !== "undefined" && MAP.map3d) || null, M3 = null;
function m3(){
  if(M3 || !MAP3D) return M3;
  M3 = m3Load(MAP3D, zInflate);
  return M3;
}
// ---------- распаковка zlib (RFC 1950/1951; заголовок 2 байта, хвост adler32 не проверяется) ----------
var ZI_LB = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
var ZI_LE = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
var ZI_DB = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
var ZI_DE = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
var ZI_ORD = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
function zInflate(src){
  var pos = 2, bb = 0, bc = 0, out = new Uint8Array(Math.max(1024, src.length * 4)), op = 0;
  function need(n){ if(op + n > out.length){ var o2 = new Uint8Array(Math.max(out.length * 2, op + n)); o2.set(out); out = o2; } }
  function bits(n){ while(bc < n){ bb |= src[pos++] << bc; bc += 8; } var v = bb & ((1 << n) - 1); bb >>>= n; bc -= n; return v; }
  function huff(lens, off, n){
    var cnt = new Uint16Array(16), sym = new Uint16Array(n), offs = new Uint16Array(16), i;
    for(i = 0; i < n; i++) cnt[lens[off + i]]++;
    cnt[0] = 0;
    for(i = 1; i < 16; i++) offs[i] = offs[i-1] + cnt[i-1];
    for(i = 0; i < n; i++) if(lens[off + i]) sym[offs[lens[off + i]]++] = i;
    return {cnt: cnt, sym: sym};
  }
  function dec(h){
    var code = 0, first = 0, index = 0;
    for(var len = 1; len < 16; len++){
      code |= bits(1); var c = h.cnt[len];
      if(code - c < first) return h.sym[index + (code - first)];
      index += c; first += c; first <<= 1; code <<= 1;
    }
    throw new Error("zInflate: плохой код");
  }
  var fixL = null, fixD = null, last = 0;
  while(!last){
    last = bits(1); var type = bits(2);
    if(type === 0){
      bb = 0; bc = 0;
      var len = src[pos] | (src[pos+1] << 8); pos += 4;
      need(len); out.set(src.subarray(pos, pos + len), op); op += len; pos += len;
      continue;
    }
    var L, D;
    if(type === 1){
      if(!fixL){ var fl = new Uint8Array(288), i;
        for(i = 0; i < 144; i++) fl[i] = 8; for(; i < 256; i++) fl[i] = 9; for(; i < 280; i++) fl[i] = 7; for(; i < 288; i++) fl[i] = 8;
        fixL = huff(fl, 0, 288); var fd = new Uint8Array(30).fill(5); fixD = huff(fd, 0, 30); }
      L = fixL; D = fixD;
    } else if(type === 2){
      var nl = bits(5) + 257, nd = bits(5) + 1, nc = bits(4) + 4, cl = new Uint8Array(19);
      for(var q = 0; q < nc; q++) cl[ZI_ORD[q]] = bits(3);
      var ch = huff(cl, 0, 19), lens = new Uint8Array(nl + nd), k = 0;
      while(k < nl + nd){
        var s = dec(ch);
        if(s < 16){ lens[k++] = s; continue; }
        var rep, val = 0;
        if(s === 16){ val = lens[k-1]; rep = 3 + bits(2); } else if(s === 17) rep = 3 + bits(3); else rep = 11 + bits(7);
        while(rep--) lens[k++] = val;
      }
      L = huff(lens, 0, nl); D = huff(lens, nl, nd);
    } else throw new Error("zInflate: плохой блок");
    for(;;){
      var sy = dec(L);
      if(sy < 256){ need(1); out[op++] = sy; continue; }
      if(sy === 256) break;
      sy -= 257; var ln = ZI_LB[sy] + bits(ZI_LE[sy]), ds = dec(D), dist = ZI_DB[ds] + bits(ZI_DE[ds]);
      need(ln); for(var c2 = 0; c2 < ln; c2++){ out[op] = out[op - dist]; op++; }
    }
  }
  return out.subarray(0, op);
}
// ---------- чтение map3d.json ----------
function m3Load(J, inflate){
  function arr(b64, T){
    var bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
    var u = new Uint8Array(bin.length); for(var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    var raw = inflate(u); var buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    return new T(buf);
  }
  function cols(c){
    var n = arr(c.n, Uint8Array), st = new Uint32Array(n.length + 1);
    for(var i = 0; i < n.length; i++) st[i+1] = st[i] + n[i];
    var o = {st: st, lo: arr(c.lo, Int16Array), hi: arr(c.hi, Int16Array)};
    if(c.mat) o.mat = arr(c.mat, Uint8Array);
    return o;
  }
  var M = {W: J.W, cell: J.cell, unit: J.unit, X0: J.pos_x, Y0: J.pos_y, mats: J.mats, J: J, cols: cols,
           sight: cols(J.sight), nade: null, sky: null, skyZ: null};   // гранаты и небо — при первом вопросе (m3Col)
  var fl = cols({n: J.floors.n, lo: J.floors.z, hi: J.floors.z}); M.floors = {st: fl.st, z: fl.lo, kind: arr(J.floors.kind, Uint8Array)};
  M.skyArr = function(){ if(!M.skyZ){ M.sky = cols(J.sky); M.skyZ = arr(J.sky_z, Int16Array); } return M.skyZ; };
  // точная геометрия → ед. игры
  var P = J.prims, V = arr(P.v, Int16Array), T = P.delta ? arr(P.tri, Int32Array) : arr(P.tri, P.tri32 ? Uint32Array : Uint16Array), tf = arr(P.tri_flag, Uint8Array), tm = arr(P.tri_mat, Uint8Array);
  if(P.delta){   // (А6) большая карта: номера вершин и вершины записаны разностями (tools/map3d/layers.py)
    for(var di = 1; di < T.length; di++) T[di] += T[di-1];
    for(di = 3; di < V.length; di++) V[di] += V[di-3];
  }
  var nt = tf.length, tri = new Float32Array(nt * 9);
  for(var k = 0; k < nt; k++) for(var a = 0; a < 3; a++){ var v = T[k*3 + a]; for(var q = 0; q < 3; q++) tri[k*9 + a*3 + q] = V[v*3 + q] / 4; }
  var hn = arr(P.hull_n, Uint8Array), hp = arr(P.hull_p, Float32Array), hb = arr(P.hull_box, Int16Array);
  var hoff = new Uint32Array(hn.length + 1); for(var h = 0; h < hn.length; h++) hoff[h+1] = hoff[h] + hn[h];
  // (А6) высоты треугольника (низ / верх) — быстрый отсев по высоте луча: у Ancient ~1 млн мелких треугольников рельефа
  var tz = new Float32Array(nt * 2);
  for(k = 0; k < nt; k++){ var z0 = tri[k*9+2], z1 = tri[k*9+5], z2 = tri[k*9+8]; tz[k*2] = Math.min(z0, z1, z2); tz[k*2+1] = Math.max(z0, z1, z2); }
  M.triZ = tz;
  M.tri = tri; M.triFlag = tf; M.triMat = tm; M.hullN = hn; M.hullP = hp; M.hullOff = hoff; M.hullBox = hb;
  M.hullFlag = arr(P.hull_flag, Uint8Array); M.hullMat = arr(P.hull_mat, Uint8Array);
  // корзины 4×4 клеток (А6: у Ancient треугольники мелкие и частые — меньше корзина, меньше лишних проверок): списки треугольников и блоков (по охвату XY)
  var B = 4, BN = Math.ceil(J.W / B), bt = [], bh = [];
  for(var g = 0; g < BN*BN; g++){ bt.push([]); bh.push([]); }
  function cellOf(x, y){ return [(x - M.X0) / M.unit, (M.Y0 - y) / M.unit]; }
  function put(list, idx, x0, y0, x1, y1){
    var a0 = cellOf(x0, y1), a1 = cellOf(x1, y0);
    var i0 = Math.max(0, Math.floor(a0[0] / B)), i1 = Math.min(BN-1, Math.floor(a1[0] / B));
    var j0 = Math.max(0, Math.floor(a0[1] / B)), j1 = Math.min(BN-1, Math.floor(a1[1] / B));
    for(var j = j0; j <= j1; j++) for(var i = i0; i <= i1; i++) list[j*BN + i].push(idx);
  }
  for(k = 0; k < nt; k++){
    var o = k*9, x0 = Math.min(tri[o], tri[o+3], tri[o+6]), x1 = Math.max(tri[o], tri[o+3], tri[o+6]);
    var y0 = Math.min(tri[o+1], tri[o+4], tri[o+7]), y1 = Math.max(tri[o+1], tri[o+4], tri[o+7]);
    put(bt, k, x0, y0, x1, y1);
  }
  for(h = 0; h < hn.length; h++) put(bh, h, hb[h*6], hb[h*6+1], hb[h*6+3], hb[h*6+4]);
  M.B = B; M.BN = BN; M.bTri = bt; M.bHull = bh; M.bSeen = new Uint32Array(BN*BN); M.bStamp = 0;
  return M;
}
function m3Col(M, kind){
  if(!M[kind]){ if(kind === "sky") M.skyArr(); else M[kind] = M.cols(M.J[kind]); }
  return M[kind];
}
// ---------- точные проверки (ед. игры) ----------
function m3SegTri(M, k, ax, ay, az, dx, dy, dz){   // отрезок A + t·D, t ∈ [0, 1] → t или -1 (Мёллер — Трумбор)
  var T = M.tri, o = k*9;
  var e1x = T[o+3]-T[o], e1y = T[o+4]-T[o+1], e1z = T[o+5]-T[o+2], e2x = T[o+6]-T[o], e2y = T[o+7]-T[o+1], e2z = T[o+8]-T[o+2];
  var px = dy*e2z - dz*e2y, py = dz*e2x - dx*e2z, pz = dx*e2y - dy*e2x, det = e1x*px + e1y*py + e1z*pz;
  if(det > -1e-9 && det < 1e-9) return -1;
  var inv = 1/det, sx = ax-T[o], sy = ay-T[o+1], sz = az-T[o+2], u = (sx*px + sy*py + sz*pz) * inv;
  if(u < 0 || u > 1) return -1;
  var qx = sy*e1z - sz*e1y, qy = sz*e1x - sx*e1z, qz = sx*e1y - sy*e1x, v = (dx*qx + dy*qy + dz*qz) * inv;
  if(v < 0 || u + v > 1) return -1;
  var t = (e2x*qx + e2y*qy + e2z*qz) * inv;
  return (t >= 0 && t <= 1) ? t : -1;
}
function m3SegHull(M, h, ax, ay, az, dx, dy, dz){   // → [t входа, номер плоскости] или null
  var P = M.hullP, t0 = 0, t1 = 1, pl = -1;
  for(var q = M.hullOff[h]; q < M.hullOff[h+1]; q++){
    var nx = P[q*4], ny = P[q*4+1], nz = P[q*4+2], d = P[q*4+3];
    var s = nx*ax + ny*ay + nz*az - d, v = nx*dx + ny*dy + nz*dz;
    if(v === 0){ if(s > 0) return null; continue; }
    var t = -s / v;
    if(v < 0){ if(t > t0){ t0 = t; pl = q; } } else if(t < t1) t1 = t;
    if(t0 > t1) return null;
  }
  return [t0, pl];
}
// ---------- луч ----------
// 1) столбики (клетка 5 ед.): идём по клеткам линии, в каждой — z линии от входа до выхода против отрезков клетки; ни одного
// пересечения — свободно (столбики пишутся с запасом). 2) Есть пересечение — точная проверка: треугольники и выпуклые блоки
// «корзины» 4×4 клеток против всего отрезка. first: false — только «есть ли преграда», true — первое попадание с нормалью
function m3Cast(M, ax, ay, az, bx, by, bz, kind, first){
  var C = m3Col(M, kind), st = C.st, LO = C.lo, HI = C.hi, W = M.W, flag = kind === "nade" ? 2 : 1;
  var cx = ax / M.cell, cy = ay / M.cell, ex = bx / M.cell, ey = by / M.cell;
  var k2 = M.unit / M.cell, wax = M.X0 + ax * k2, way = M.Y0 - ay * k2, wdx = (bx - ax) * k2, wdy = -(by - ay) * k2, wdz = bz - az;
  var dx = ex - cx, dy = ey - cy, dz = bz - az;
  var i = Math.floor(cx), j = Math.floor(cy), ei = Math.floor(ex), ej = Math.floor(ey);
  var sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  var tdx = dx !== 0 ? Math.abs(1/dx) : Infinity, tdy = dy !== 0 ? Math.abs(1/dy) : Infinity;
  var tmx = dx !== 0 ? ((dx > 0 ? i + 1 - cx : cx - i) * tdx) : Infinity, tmy = dy !== 0 ? ((dy > 0 ? j + 1 - cy : cy - j) * tdy) : Infinity;
  var t0 = 0, stamp = ++M.bStamp, best = null, rzl = Math.min(az, bz) - 0.5, rzh = Math.max(az, bz) + 0.5;   // (А6) высоты всего отрезка
  if(stamp > 4e9){ M.bSeen.fill(0); M.bStamp = stamp = 1; }
  for(var guard = 0; guard < 4*W; guard++){
    var t1 = Math.min(tmx, tmy, 1);
    if(best && best.t < t0) break;
    if(i >= 0 && j >= 0 && i < W && j < W){
      var za = az + dz*t0, zb = az + dz*t1, zl = za < zb ? za : zb, zh = za < zb ? zb : za, c = j*W + i;
      for(var q = st[c]; q < st[c+1]; q++){
        if(LO[q] > zh || HI[q] < zl) continue;
        var b = Math.floor(j / M.B) * M.BN + Math.floor(i / M.B);
        if(M.bSeen[b] === stamp) break;
        M.bSeen[b] = stamp;
        var lt = M.bTri[b], lh = M.bHull[b];
        for(var n = 0; n < lt.length; n++){
          var k = lt[n]; if(!(M.triFlag[k] & flag) || M.triZ[k*2] > rzh || M.triZ[k*2+1] < rzl) continue;
          var t = m3SegTri(M, k, wax, way, az, wdx, wdy, wdz);
          if(t >= 0){ if(!first) return {t: t}; if(!best || t < best.t) best = {t: t, tri: k}; }
        }
        for(n = 0; n < lh.length; n++){
          var h = lh[n]; if(!(M.hullFlag[h] & flag)) continue;
          var r = m3SegHull(M, h, wax, way, az, wdx, wdy, wdz);
          if(r){ if(!first) return {t: r[0]}; if(!best || r[0] < best.t) best = {t: r[0], hull: h, plane: r[1]}; }
        }
        break;
      }
    }
    if((i === ei && j === ej) || t1 >= 1) break;
    if(tmx < tmy){ t0 = tmx; tmx += tdx; i += sx; } else { t0 = tmy; tmy += tdy; j += sy; }
  }
  if(best && first){   // нормаль — в ед. игры (y игры противоположен y радара), навстречу лучу
    if(best.tri !== undefined){
      var T = M.tri, o = best.tri*9;
      var e1x = T[o+3]-T[o], e1y = T[o+4]-T[o+1], e1z = T[o+5]-T[o+2], e2x = T[o+6]-T[o], e2y = T[o+7]-T[o+1], e2z = T[o+8]-T[o+2];
      var nx = e1y*e2z - e1z*e2y, ny = e1z*e2x - e1x*e2z, nz = e1x*e2y - e1y*e2x, L = Math.hypot(nx, ny, nz) || 1;
      if(nx*wdx + ny*wdy + nz*wdz > 0){ nx = -nx; ny = -ny; nz = -nz; }
      best.nx = nx/L; best.ny = ny/L; best.nz = nz/L; best.mat = M.mats[M.triMat[best.tri]];
    } else {
      var P = M.hullP, p = best.plane < 0 ? M.hullOff[best.hull] : best.plane;
      best.nx = P[p*4]; best.ny = P[p*4+1]; best.nz = P[p*4+2]; best.mat = M.mats[M.hullMat[best.hull]];
    }
  }
  return best;
}
function m3Line(M, ax, ay, az, bx, by, bz, kind){ return !m3Cast(M, ax, ay, az, bx, by, bz, kind || "sight", false); }
function m3Hit(M, ax, ay, az, bx, by, bz, kind){ return m3Cast(M, ax, ay, az, bx, by, bz, kind || "nade", true); }
function m3Cell(M, x, y){ var i = Math.floor(x / M.cell), j = Math.floor(y / M.cell); return (i < 0 || j < 0 || i >= M.W || j >= M.W) ? -1 : j*M.W + i; }
function m3Floors(M, x, y){
  var c = m3Cell(M, x, y), F = M.floors, o = []; if(c < 0) return o;
  for(var q = F.st[c]; q < F.st[c+1]; q++) o.push(F.z[q]); return o;
}
function m3FloorKinds(M, x, y){
  var c = m3Cell(M, x, y), F = M.floors, o = []; if(c < 0) return o;
  for(var q = F.st[c]; q < F.st[c+1]; q++) o.push(F.kind[q]); return o;
}
function m3FloorAt(M, x, y, z){
  var f = m3Floors(M, x, y), best = null; for(var q = 0; q < f.length; q++) if(f[q] <= z + 18 && (best === null || f[q] > best)) best = f[q];
  return best;
}
// ---------- «внутри стены» по геометрии (вместо стен радара) ----------
// клетка твёрдая, если в ней нет ни одного этажа геометрии (пол, на котором можно стоять) и нет участка навмеша (по навмешу
// ходят — он главный: 0,55 % его точек у края стен попадают в клетку без этажа). Сетка — при первом вопросе.
var M3_SOLID = null;
function m3SolidGrid(){
  if(M3_SOLID) return M3_SOLID;
  var M = m3(), W = M.W, C = M.cell, F = M.floors, S = new Uint8Array(W*W);
  for(var c = 0; c < W*W; c++) S[c] = F.st[c+1] > F.st[c] ? 0 : 1;
  NAVAREAS.forEach(function(a){
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    a.points.forEach(function(p){ if(p.x < x0) x0 = p.x; if(p.y < y0) y0 = p.y; if(p.x > x1) x1 = p.x; if(p.y > y1) y1 = p.y; });
    var i0 = Math.max(0, Math.floor(x0/C)), i1 = Math.min(W-1, Math.floor(x1/C)), j0 = Math.max(0, Math.floor(y0/C)), j1 = Math.min(W-1, Math.floor(y1/C));
    for(var j = j0; j <= j1; j++) for(var i = i0; i <= i1; i++) if(S[j*W + i] && pointInPoly((i+0.5)*C, (j+0.5)*C, a.points)) S[j*W + i] = 0;
  });
  return (M3_SOLID = S);
}
function m3Solid(x, y){
  var M = m3(), c = m3Cell(M, x, y); if(c < 0) return true;
  return m3SolidGrid()[c] === 1;
}
// отрезок проходит через твёрдую клетку → край клетки, через который вошёл ([x1,y1,x2,y2] — как отрезок стены, для отскока
// гранаты), иначе null. Твёрдые клетки в начале отрезка не считаются: кто уже «в стене» (щель у края), выходит из неё
function m3SolidHit(ax, ay, bx, by){
  var M = m3(), S = m3SolidGrid(), W = M.W, C = M.cell;
  var cx = ax / C, cy = ay / C, ex = bx / C, ey = by / C, dx = ex - cx, dy = ey - cy;
  var i = Math.floor(cx), j = Math.floor(cy), ei = Math.floor(ex), ej = Math.floor(ey);
  var sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  var tdx = dx !== 0 ? Math.abs(1/dx) : Infinity, tdy = dy !== 0 ? Math.abs(1/dy) : Infinity;
  var tmx = dx !== 0 ? ((dx > 0 ? i + 1 - cx : cx - i) * tdx) : Infinity, tmy = dy !== 0 ? ((dy > 0 ? j + 1 - cy : cy - j) * tdy) : Infinity;
  var out = !(i >= 0 && j >= 0 && i < W && j < W && S[j*W + i]);
  for(var guard = 0; guard < 4*W; guard++){
    if(i === ei && j === ej) return null;
    var vert = tmx < tmy;
    if(vert){ tmx += tdx; i += sx; } else { tmy += tdy; j += sy; }
    if(i < 0 || j < 0 || i >= W || j >= W) return null;
    if(!S[j*W + i]){ out = true; continue; }
    if(out){
      if(vert){ var xe = (sx > 0 ? i : i + 1) * C; return [xe, j*C, xe, (j+1)*C]; }
      var ye = (sy > 0 ? j : j + 1) * C; return [i*C, ye, (i+1)*C, ye];
    }
  }
  return null;
}
// ---------- радар ↔ ед. игры (В3: физика гранаты считает в ед. игры) ----------
function m3Game(M, x, y){ var k = M.unit / M.cell; return [M.X0 + x * k, M.Y0 - y * k]; }
function m3Radar(M, X, Y){ var k = M.cell / M.unit; return [(X - M.X0) * k, (M.Y0 - Y) * k]; }
// ---------- луч гранаты (В3) — trace для физики гранаты (385_nades_flight): всё в ед. игры ----------
// A, B — [X, Y, Z] игры (Y игры противоположен y радара) → null или {f: доля пути, n: нормаль навстречу, sky: небо}.
// Геометрия — маска 'nade' (без playerclip, с grenadeclip, без деталей «кроме гранаты»); неба нет (В2б).
function m3NadeTrace(M, A, B){
  var k = 1 / (M.unit / M.cell);   // ед. игры → px радара
  var ax = (A[0] - M.X0) * k, ay = (M.Y0 - A[1]) * k, bx = (B[0] - M.X0) * k, by = (M.Y0 - B[1]) * k;
  // (В2б) неба для гранаты нет: у Mirage низ неба над T-спауном — 704, а смоки про оттуда идут до ≈ 910 и падают точно (с небом
  // как потолком — мимо на сотни ед.); у Ancient неба в файле нет вовсе
  var h = m3Cast(M, ax, ay, A[2], bx, by, B[2], "nade", true);
  return h ? {f: h.t, n: [h.nx, h.ny, h.nz], sky: false} : null;
}
if(typeof module !== "undefined" && module.exports) module.exports = {zInflate: zInflate, m3Load: m3Load, m3Line: m3Line, m3Hit: m3Hit,
  m3Floors: m3Floors, m3FloorKinds: m3FloorKinds, m3FloorAt: m3FloorAt, m3NadeTrace: m3NadeTrace, m3Cell: m3Cell, m3Game: m3Game, m3Radar: m3Radar};
