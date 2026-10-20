// А3 (20.10.2026): чтение map3d.json и луч по 3D-геометрии карты — образец для игры (А5: VIS, гранаты), без зависимостей.
// Устройство файла — docs/ARCHITECTURE.md, «Карта 3D (map3d.json)». Координаты здесь — как в игре: x, y — радар 0..2048, z — ед. игры.
//   var M = m3Load(json, inflate);   inflate(Uint8Array) → Uint8Array (zlib); в браузере — DecompressionStream('deflate') заранее,
//                                     в node — require('zlib').inflateSync
//   m3Line(M, ax, ay, az, bx, by, bz, 'sight')  → true, если линия свободна (взгляд и пули); 'nade' — для гранат
//   m3Hit(M, ax, ay, az, bx, by, bz, 'nade')    → первое попадание {t, nx, ny, nz, mat} (нормаль — в ед. игры, для отскока) или null
//   m3Floors(M, x, y) → этажи клетки [z…] по возрастанию; m3FloorAt(M, x, y, z) — пол под точкой (ближайший снизу, допуск +18)
// Как считается: 1) столбики (клетка 5 ед.): идём по клеткам линии, в каждой — z линии от входа до выхода против отрезков клетки;
// ни одного пересечения — свободно (столбики пишутся с запасом: геометрия, задевшая клетку краем, занимает её целиком). 2) Есть
// пересечение — точная проверка: треугольники и выпуклые блоки из «корзины» 16×16 клеток (80 ед.) против всего отрезка.
"use strict";
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
  var M = {W: J.W, cell: J.cell, unit: J.unit, X0: J.pos_x, Y0: J.pos_y, mats: J.mats,
           sight: cols(J.sight), nade: cols(J.nade), sky: cols(J.sky), skyZ: arr(J.sky_z, Int16Array)};
  var fl = cols({n: J.floors.n, lo: J.floors.z, hi: J.floors.z}); M.floors = {st: fl.st, z: fl.lo, kind: arr(J.floors.kind, Uint8Array)};
  // точная геометрия → ед. игры
  var P = J.prims, V = arr(P.v, Int16Array), T = arr(P.tri, Uint16Array), tf = arr(P.tri_flag, Uint8Array), tm = arr(P.tri_mat, Uint8Array);
  var nt = tf.length, tri = new Float32Array(nt * 9);
  for(var k = 0; k < nt; k++) for(var a = 0; a < 3; a++){ var v = T[k*3 + a]; for(var q = 0; q < 3; q++) tri[k*9 + a*3 + q] = V[v*3 + q] / 4; }
  var hn = arr(P.hull_n, Uint8Array), hp = arr(P.hull_p, Float32Array), hb = arr(P.hull_box, Int16Array);
  var hoff = new Uint32Array(hn.length + 1); for(var h = 0; h < hn.length; h++) hoff[h+1] = hoff[h] + hn[h];
  M.tri = tri; M.triFlag = tf; M.triMat = tm; M.hullN = hn; M.hullP = hp; M.hullOff = hoff; M.hullBox = hb;
  M.hullFlag = arr(P.hull_flag, Uint8Array); M.hullMat = arr(P.hull_mat, Uint8Array);
  // корзины 16×16 клеток: списки треугольников и блоков (по охвату XY)
  var B = 16, BN = Math.ceil(J.W / B), bt = [], bh = [];
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
// first: false — только «есть ли преграда» (быстро), true — первое попадание с нормалью
function m3Cast(M, ax, ay, az, bx, by, bz, kind, first){
  var C = M[kind], st = C.st, LO = C.lo, HI = C.hi, W = M.W, s = M.cell, flag = kind === "nade" ? 2 : 1;
  var cx = ax / M.cell, cy = ay / M.cell, ex = bx / M.cell, ey = by / M.cell;
  // ед. игры для точной проверки
  var k2 = M.unit / M.cell, wax = M.X0 + ax * k2, way = M.Y0 - ay * k2, wdx = (bx - ax) * k2, wdy = -(by - ay) * k2, wdz = bz - az;
  var dx = ex - cx, dy = ey - cy, dz = bz - az;
  var i = Math.floor(cx), j = Math.floor(cy), ei = Math.floor(ex), ej = Math.floor(ey);
  var sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  var tdx = dx !== 0 ? Math.abs(1/dx) : Infinity, tdy = dy !== 0 ? Math.abs(1/dy) : Infinity;
  var tmx = dx !== 0 ? ((dx > 0 ? i + 1 - cx : cx - i) * tdx) : Infinity, tmy = dy !== 0 ? ((dy > 0 ? j + 1 - cy : cy - j) * tdy) : Infinity;
  var t0 = 0, stamp = ++M.bStamp, best = null;
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
          var k = lt[n]; if(!(M.triFlag[k] & flag)) continue;
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
  if(best && first){
    if(best.tri !== undefined){
      var T = M.tri, o = best.tri*9;
      var e1x = T[o+3]-T[o], e1y = T[o+4]-T[o+1], e1z = T[o+5]-T[o+2], e2x = T[o+6]-T[o], e2y = T[o+7]-T[o+1], e2z = T[o+8]-T[o+2];
      var nx = e1y*e2z - e1z*e2y, ny = e1z*e2x - e1x*e2z, nz = e1x*e2y - e1y*e2x, L = Math.hypot(nx, ny, nz) || 1;
      if(nx*wdx + ny*wdy + nz*wdz > 0){ nx = -nx; ny = -ny; nz = -nz; }   // нормаль — навстречу лучу
      best.nx = nx/L; best.ny = ny/L; best.nz = nz/L; best.mat = M.mats[M.triMat[best.tri]];
    } else {
      var P = M.hullP, p = best.plane < 0 ? M.hullOff[best.hull] : best.plane;
      best.nx = P[p*4]; best.ny = P[p*4+1]; best.nz = P[p*4+2]; best.mat = M.mats[M.hullMat[best.hull]];
    }
    // нормаль в ед. игры (y игры противоположен y радара)
  }
  return best;
}
function m3Line(M, ax, ay, az, bx, by, bz, kind){ return !m3Cast(M, ax, ay, az, bx, by, bz, kind || "sight", false); }
function m3Hit(M, ax, ay, az, bx, by, bz, kind){ return m3Cast(M, ax, ay, az, bx, by, bz, kind || "nade", true); }
function m3Floors(M, x, y){
  var i = Math.floor(x / M.cell), j = Math.floor(y / M.cell); if(i < 0 || j < 0 || i >= M.W || j >= M.W) return [];
  var c = j*M.W + i, F = M.floors, o = []; for(var q = F.st[c]; q < F.st[c+1]; q++) o.push(F.z[q]); return o;
}
function m3FloorAt(M, x, y, z){
  var f = m3Floors(M, x, y), best = null; for(var q = 0; q < f.length; q++) if(f[q] <= z + 18 && (best === null || f[q] > best)) best = f[q];
  return best;
}
if(typeof module !== "undefined") module.exports = {m3Load: m3Load, m3Line: m3Line, m3Hit: m3Hit, m3Floors: m3Floors, m3FloorAt: m3FloorAt};
