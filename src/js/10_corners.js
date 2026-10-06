// =====================================================================
// (v196, В15) УГЛЫ: бот видит карту углами, а не зонами.
// Видимая область с точки — лучи до стен (CORNER.rays штук); «край» (угол) —
// место, где соседние лучи резко расходятся по длине: ближний упёрся в кромку
// стены, дальний ушёл за неё — оттуда может выйти враг. Для каждого края:
//   cx, cy — кромка стены; x, y — куда целиться (чуть за кромку, на уровне
//   головы); a — направление; d — расстояние; z — зона прохода за краем
//   (откуда придёт враг); gap — насколько глубоко уходит проход (широкий/узкий угол).
// Геометрия зависит только от стен — кэш по клетке 12 px. Дым — отдельно
// (cornersSeen: край за дымом не виден).
// Опасность края (cornerDanger) — из картины команды: может ли враг уже быть там
// (REACH: по секундам от спавна / от последней инфы, проходы, которые видят свои,
// закрыты), что известно (видел / слышал / колл), стоит ли там свой.
// =====================================================================
var CORNER = {rays:180, R:1100, cell:12, jump:55, jumpK:0.3, minD:24};
var _CRN = {}, _CRN_N = 0;
var _CSEG = null;
// стены по клеткам 64 px — луч проверяет только стены клеток, через которые проходит
function cornerSegs(){
  if(_CSEG && _CSEG.n === wallSegsLOS.length) return _CSEG;
  var n = wallSegsLOS.length, A = new Float64Array(n*4), G = {}, CS = 64;
  for(var i=0;i<n;i++){ var s = wallSegsLOS[i]; A[i*4] = s[0]; A[i*4+1] = s[1]; A[i*4+2] = s[2]; A[i*4+3] = s[3];
    var L = Math.hypot(s[2]-s[0], s[3]-s[1]), steps = Math.max(1, Math.ceil(L/16));
    for(var k=0;k<=steps;k++){ var x = s[0] + (s[2]-s[0])*k/steps, y = s[1] + (s[3]-s[1])*k/steps;
      for(var ox=-1;ox<=1;ox+=2) for(var oy=-1;oy<=1;oy+=2){ var key = Math.floor((x+ox*2)/CS)+","+Math.floor((y+oy*2)/CS), c = G[key] || (G[key] = []); if(c[c.length-1] !== i && c.indexOf(i) < 0) c.push(i); } } }
  return (_CSEG = {n:n, A:A, G:G, CS:CS});
}
// длина луча до первой стены: идём по клеткам вдоль луча (DDA), в каждой — её стены
function cornerRay(x, y, dx, dy, R){
  var S = cornerSegs(), A = S.A, G = S.G, CS = S.CS, best = R;
  var cx = Math.floor(x/CS), cy = Math.floor(y/CS), stx = dx > 0 ? 1 : -1, sty = dy > 0 ? 1 : -1;
  var tdx = dx !== 0 ? Math.abs(CS/dx) : Infinity, tdy = dy !== 0 ? Math.abs(CS/dy) : Infinity;
  var tmx = dx !== 0 ? ((dx > 0 ? (cx+1)*CS - x : x - cx*CS)/Math.abs(dx)) : Infinity;
  var tmy = dy !== 0 ? ((dy > 0 ? (cy+1)*CS - y : y - cy*CS)/Math.abs(dy)) : Infinity;
  var tcell = 0;
  while(tcell < best){
    var L = G[cx+","+cy];
    if(L) for(var q=0;q<L.length;q++){ var i = L[q];
      var x1 = A[i*4], y1 = A[i*4+1], sx = A[i*4+2]-x1, sy = A[i*4+3]-y1, den = dx*sy - dy*sx;
      if(den > -1e-9 && den < 1e-9) continue;
      var qx = x1-x, qy = y1-y, t = (qx*sy - qy*sx)/den; if(t <= 0 || t >= best) continue;
      var u = (qx*dy - qy*dx)/den; if(u >= 0 && u <= 1) best = t; }
    if(tmx < tmy){ tcell = tmx; tmx += tdx; cx += stx; } else { tcell = tmy; tmy += tdy; cy += sty; }
  }
  return best;
}
// видимая область и края с точки (только стены; кэш по клетке)
function cornersAt(x, y){
  var k = Math.round(x/CORNER.cell)+","+Math.round(y/CORNER.cell);
  var C = _CRN[k]; if(C) return C;
  if(_CRN_N > 30000){ _CRN = {}; _CRN_N = 0; }
  var px = Math.round(x/CORNER.cell)*CORNER.cell, py = Math.round(y/CORNER.cell)*CORNER.cell;
  if(insideSolidWall(px, py)){ px = x; py = y; }
  var N = CORNER.rays, R = CORNER.R, D = new Float64Array(N), st = 2*Math.PI/N;
  for(var i=0;i<N;i++){ var a = i*st; D[i] = cornerRay(px, py, Math.cos(a), Math.sin(a), R); }
  var E = [], z0 = bzOf(px, py);
  for(var i2=0;i2<N;i2++){
    var j = (i2+1) % N, dn = Math.min(D[i2], D[j]), df = Math.max(D[i2], D[j]);
    if(df - dn < Math.max(CORNER.jump, CORNER.jumpK*dn) || dn < CORNER.minD || dn >= R - 1) continue;
    var near = D[i2] < D[j] ? i2 : j, far = near === i2 ? j : i2, an = near*st, af = far*st, sgn = far === j ? 1 : -1;
    var cx = px + Math.cos(an)*dn, cy = py + Math.sin(an)*dn;
    // куда целиться: чуть за кромку, на той же дальности (голова выходящего)
    var aa = an + sgn*st*0.75, ax = px + Math.cos(aa)*(dn + 6), ay = py + Math.sin(aa)*(dn + 6);
    // откуда придёт враг: зона за кромкой (по дальнему лучу, чуть глубже кромки)
    var z = -1; for(var s = dn + 40; s < Math.min(df, dn + 400); s += 30){ var zz = bzOf(px + Math.cos(af)*s, py + Math.sin(af)*s); if(zz >= 0){ z = zz; if(zz !== z0) break; } }
    if(z < 0) continue;
    var dup = E.filter(function(e){ return Math.hypot(e.cx-cx, e.cy-cy) < 26; })[0];
    if(dup){ if(df - dn > dup.gap) { dup.gap = df - dn; dup.z = z; } continue; }
    E.push({cx:cx, cy:cy, x:ax, y:ay, a:aa, d:dn, z:z, gap:df - dn, side:sgn, key:"c"+Math.round(cx/20)+","+Math.round(cy/20)});
  }
  C = {x:px, y:py, D:D, E:E, z:z0}; _CRN[k] = C; _CRN_N++;
  return C;
}
// края, которые сейчас видно (дым закрывает)
function cornersSeen(x, y){
  var C = cornersAt(x, y);
  if(typeof smokes === "undefined" || !smokes.length) return C.E;
  return C.E.filter(function(e){ return hasVision(x, y, e.x, e.y); });
}
// опасность края для команды сейчас:
//  t — 0, если враг туда ещё не мог дойти (REACH), иначе 1 → гаснет до 0,15, если путь открыт
//      давно, а никто не вышел; eta — через сколько секунд сможет (для «без угроз»);
//  info — враги, о которых есть инфа (видел / слышал / колл) за этим краем;
//  mate — за краем (ближе к врагу) стоит свой: враг выйдет сначала на него.
function cornerDanger(team, e, me){
  var R = REACH[team], r = R ? R[e.z] : 0, eta = 0, t = 0;
  if(R && !isFinite(r)) return {v:0, t:0, eta:Infinity, info:0, mate:false};
  if(r > tick) eta = (r - tick)/TICK_HZ;
  else t = Math.max(LOOK.reachFloor, Math.exp(-(tick - r)/(LOOK.reachFade*TICK_HZ)));
  var info = 0, L = beliefLast[team] || {};
  for(var eid in L){ var lo = L[eid]; if(!lo || lo.gone) continue; var age = (tick - lo.tick)/TICK_HZ; if(age > 8) continue;
    var foe = botById(eid); if(!foe || !foe.alive) continue;
    var zl = bzOf(lo.x, lo.y); if(zl !== e.z && (BZ.nbr[e.z]||[]).indexOf(zl) < 0) continue;
    if(Math.hypot(lo.x-e.x, lo.y-e.y) > 650) continue;
    info += age <= 3 ? 1 : 1 - 0.6*(age-3)/5; }
  var mate = bots.some(function(o){ return o !== me && o.alive && o.team === team && bzOf(o.x, o.y) === e.z && Math.hypot(o.x-e.cx, o.y-e.cy) < 450; });
  var v = mate ? 0.1*(t + 2.5*info) : t + 2.5*info;
  return {v:v, t:t, eta:eta, info:info, mate:mate};
}
