// (шаг 0а, ENGINE_AUDIT) вопросы движку на точках демок про. Только чтение: visParts, hasLOS, visFloorAt, navAt, сетка VIS.
// DATA = {kills:[…], neg:[…], hgt:[…]} из demo_prep.py. Возвращает JSON {kills:[…], neg:[…], hgt:[…]}.
// kills[i] → [видно стоя (0 нет / 1 тело / 2 голова / 3 оба), hasLOS, видно хоть в одной стойке (стоя/присев × стоя/присев),
//             причина (floor|cover|ceil|wall|level|''), x, y точки, где линию режет, глаза убийцы над полом движка (ez − z демки)]
visReady();
function why(ax, ay, az, bx, by, bz){
  if(levelBlocked(ax, ay, az, bx, by, bz)) return ["level", (ax+bx)/2, (ay+by)/2];
  // высокие стены — первая пересечённая (по ходу линии)
  var best = null, bt = 2;
  VIS.segs.forEach(function(s){ if(!segIntersect(ax, ay, bx, by, s[0], s[1], s[2], s[3])) return;
    var dx = bx-ax, dy = by-ay, ex = s[2]-s[0], ey = s[3]-s[1], den = dx*ey - dy*ex; if(!den) return;
    var t = ((s[0]-ax)*ey - (s[1]-ay)*ex)/den; if(t < bt){ bt = t; best = ["wall", ax+dx*t, ay+dy*t]; } });
  if(best) return best;
  var dx = bx-ax, dy = by-ay, dz = bz-az, n = Math.ceil(Math.hypot(dx, dy)/VIS_CELL), W = VIS.W, inv = 1/VIS_CELL;
  for(var i = 1; i < n; i++){ var t = i/n, x = (ax+dx*t)*inv, y = (ay+dy*t)*inv; if(x < 0 || y < 0 || x >= W || y >= W) continue;
    var k = (y|0)*W + (x|0), z = az + dz*t;
    if(z < VIS.solid[k] - VIS_FLOOR_EPS) return [VIS.solid[k] > VIS.floor[k] + 1 ? "cover" : "floor", ax+dx*t, ay+dy*t];
    if(z > VIS.ceil[k]) return ["ceil", ax+dx*t, ay+dy*t]; }
  return ["", 0, 0];
}
function code(p){ return (p.body ? 1 : 0) + (p.head ? 2 : 0); }
var outK = DATA.kills.map(function(r){
  var ax = r[3], ay = r[4], az = r[5], vx = r[6], vy = r[7], vz = r[8];
  var st = visParts(ax, ay, false, vx, vy, false, true, az, vz), any = code(st) > 0;
  [[true, false], [false, true], [true, true]].forEach(function(c){ if(!any) any = code(visParts(ax, ay, c[0], vx, vy, c[1], true, az, vz)) > 0; });
  var los = hasLOS(ax, ay, vx, vy) ? 1 : 0, w = ["", 0, 0];
  var fv = visFloorAt(ax, ay); if(Math.abs(fv - az) > JUMP_UP) fv = az; var ez = fv + VIS_EYE.stand;
  var ft = visFloorAt(vx, vy); if(Math.abs(ft - vz) > JUMP_UP) ft = vz;
  if(!code(st)) w = why(ax, ay, ez, vx, vy, ft + VIS_BODY.stand[0]);
  return [code(st), los, any ? 1 : 0, w[0], Math.round(w[1]), Math.round(w[2]), Math.round(ez - VIS_EYE.stand - az)];
});
var outN = DATA.neg.map(function(r){
  var p = visParts(r[2], r[3], false, r[5], r[6], false, true, r[4], r[7]);
  return [code(p), hasLOS(r[2], r[3], r[5], r[6]) ? 1 : 0];
});
var outH = DATA.hgt.map(function(r){
  var f = visFloorAt(r[0], r[1]), a = navAt(r[0], r[1], r[2]), n = a ? null : navNearestZ(r[0], r[1], 6, r[2]);
  // пол движка под точкой: visFloorAt (сетка «верхнего пола»), этаж навмеша, ближайший по высоте (null — навмеша нет)
  return [Math.round(f*10)/10, a ? a.z : (n ? n.z : null), a ? 1 : (n ? 2 : 0)];
});
JSON.stringify({kills: outK, neg: outN, hgt: outH});
