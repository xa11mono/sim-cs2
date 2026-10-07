// Скорость бега как в CS2: M4 225 ю/с = 90 px/с (1 px ≈ 2,5 юнита); шифт ~0,5 от неё
var SPD_K = 1;
SPEED = 90; SPD_K = SPEED/150; ACCEL = 700*SPD_K;

// ники игроков и номера 0–9 (T — 0…4, CT — 5…9); внутри кода id остаются T0…CT4
var NICKS = {T0:"donk", T1:"sh1ro", T2:"TN1R", T3:"magixx", T4:"zont1x", CT0:"kyousuke", CT1:"m0NESY", CT2:"TeSeS", CT3:"karrigan", CT4:"NiKo"};
function pnum(id){ var m = /^(CT|T)(\d)$/.exec(id||""); return m ? (m[1] === "T" ? +m[2] : 5 + (+m[2])) : ""; }
function nick(id){ return NICKS[id] || id; }
function nickify(t){ return String(t).replace(/\b(CT|T)([0-4])\b/g, function(m){ return NICKS[m] || m; }); }
function centroidOf(pts){ var cx=0, cy=0; pts.forEach(function(p){ cx+=p.x; cy+=p.y; }); return {x:cx/pts.length, y:cy/pts.length}; }

// ---------- сайты (правило CS2: бомбу ставят только внутри зоны сайта) ----------
var SITES = {};
function buildSites(){
  ["A","B"].forEach(function(k){
    var uz = USER_ZONES.filter(function(z){ return z.kind === (k==="A" ? "sitea" : "siteb") && z.basePoints.length >= 3; })[0];
    var poly = uz ? zoneObjAbsPoints(uz) : null;
    if(!poly){ var zz = ZONEMAP.zones.filter(function(z){ return z.name === k+"site"; })[0]; if(zz) poly = zz.points; }
    var c = poly ? centroidOf(poly) : {x:1024, y:1024};
    var sp = snapToWalkable(c.x, c.y);
    SITES[k] = {key:k, x:sp.x, y:sp.y, poly:poly};
    SITES[k].plant = sitePlantSpot(SITES[k]);
  });
}
// бомбу можно ставить только ВНУТРИ зоны сайта (если она есть); раньше
// хватало быть в 110px от центра — и плант получался рядом с сайтом, а не на нём
function onSite(site, x, y){
  if(site.poly) return pointInPoly(x, y, site.poly);
  return Math.hypot(x-site.x, y-site.y) < 110;
}
// точка планта для показа — центр проходимого полигона навмеша внутри зоны
// сайта, ближайший к её центру (центроид вогнутой зоны может лежать вне её)
function sitePlantSpot(site){
  if(!site.poly) return {x:site.x, y:site.y};
  var c = centroidOf(site.poly), best = null, bd = Infinity;
  NAVAREAS.forEach(function(z){
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var zc = zoneCentroid(z);
    if(!pointInPoly(zc.x, zc.y, site.poly)) return;
    var d = Math.hypot(zc.x-c.x, zc.y-c.y);
    if(d < bd){ bd = d; best = zc; }
  });
  return best ? {x:best.x, y:best.y} : {x:site.x, y:site.y};
}
// (v162) отдельно стоящие ящики/колонны — небольшие замкнутые контуры стен
var _WB = null, _WBn = -1;
function wallBoxes(){
  if(_WB && _WBn === MANUAL_WALLS.length) return _WB;
  _WBn = MANUAL_WALLS.length; _WB = [];
  var W = MANUAL_WALLS, par = W.map(function(_, i){ return i; });
  var f = function(i){ while(par[i] !== i){ par[i] = par[par[i]]; i = par[i]; } return i; };
  var K = function(x, y){ return Math.round(x/3)+","+Math.round(y/3); }, idx = {};
  W.forEach(function(w, i){ [[w[0],w[1]],[w[2],w[3]]].forEach(function(p){
    var kx = Math.round(p[0]/3), ky = Math.round(p[1]/3);
    for(var dx=-1;dx<=1;dx++) for(var dy=-1;dy<=1;dy++){ (idx[(kx+dx)+","+(ky+dy)]||[]).forEach(function(j){ par[f(i)] = f(j); }); }
    (idx[kx+","+ky] = idx[kx+","+ky] || []).push(i); }); });
  var comp = {}; W.forEach(function(_, i){ (comp[f(i)] = comp[f(i)] || []).push(i); });
  Object.keys(comp).forEach(function(c){
    var S = comp[c], xs = [], ys = [];
    S.forEach(function(i){ xs.push(W[i][0], W[i][2]); ys.push(W[i][1], W[i][3]); });
    if(Math.max(Math.max.apply(null, xs)-Math.min.apply(null, xs), Math.max.apply(null, ys)-Math.min.apply(null, ys)) >= 90) return;
    // обход контура по сегментам
    var left = S.slice(), poly = [[W[left[0]][0], W[left[0]][1]], [W[left[0]][2], W[left[0]][3]]]; left.shift();
    var guard = 0;
    while(left.length && guard++ < 200){
      var e = poly[poly.length-1], hit = -1, rev = false;
      for(var q=0;q<left.length;q++){ var w = W[left[q]];
        if(Math.hypot(w[0]-e[0], w[1]-e[1]) < 4){ hit = q; break; }
        if(Math.hypot(w[2]-e[0], w[3]-e[1]) < 4){ hit = q; rev = true; break; } }
      if(hit < 0) break;
      var w2 = W[left[hit]]; poly.push(rev ? [w2[0], w2[1]] : [w2[2], w2[3]]); left.splice(hit, 1);
    }
    if(!left.length) _WB.push(poly);
  });
  return _WB;
}
buildSites();
SITES_READY = true;
