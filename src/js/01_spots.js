// ---------- места из демок (v195): где держать угол и куда оттуда смотреть ----------
// Заменяет точки углов v193 (стартовый набор — бывшие авто-укрытия по стенам)
// и их редактор. Библиотеку собирает tools/spots_bake.py из демок в data/demos:
// места, где про стоят и держат угол (не бегут, не в бою, врага не видят), —
// это знание карты, которое есть у любого игрока: «отсюда держат, туда смотрят».
// Какое место выбрать, решает выбор действия (12_team.js) по ситуации из любых мест
// карты (placesGet); место из демок своей фазы — только небольшой плюс.
//
// SPOTS[i] = {id, x, y — где стоять; side "CT" | "T"; phase "pre" (до планта)
//   | "post" (T после планта) | "retake" (CT после планта); area "A" | "B" |
//   "M" | "" (вне районов); looks — 1–2 направления взгляда {x, y, w — доля
//   времени}; n — сколько раз там стояли}. Что игра считает сама по стенам и
//   зонам по главному направлению взгляда (spotDerive): hold — зона, где стоишь;
//   from — зона, откуда придёт враг; key — какой это вход; open — доля мест
//   врага, откуда точку видно; dirs — сколько других направлений её видят.
var SPOTS_DATA = @@DATA:spots.json@@;
var SPOTS = null;
function spotsGet(){
  if(!SPOTS) SPOTS = SPOTS_DATA.spots.map(function(p){ var q = Object.assign({}, p); q.lx = p.looks[0].x; q.ly = p.looks[0].y; return spotDerive(q); });
  return SPOTS;
}
// (v195, решение владельца 07.10) места из демок — желательные, не обязательные. Бот
// выбирает место сам по ситуации из любых мест карты: точки, по которым игра знает
// карту (ZONE_SAMPLES, ~8 на зону), с направлением на проход, откуда придёт враг этой
// стороны; место из демок даёт только небольшой плюс (ACT.W.lib в 12_team.js).
// Каталог считается один раз: места карты обеих сторон + библиотека.
function placesGet(){
  var out = [];
  ["CT", "T"].forEach(function(team){
    var ED = enemySpawnDist(team); if(!BZ.portal) bzPortals();
    for(var zid in ZONE_SAMPLES) (ZONE_SAMPLES[zid] || []).forEach(function(q){
      var zp = bzOf(q.x, q.y); if(zp < 0) return;
      // куда смотреть отсюда: видимый проход к врагу (ведёт ближе к его спавну, не в тыл), ближайший к нему
      var best = null, bs = Infinity;
      BZ.portal.forEach(function(row, i){ for(var js in row){ var j = +js, pt = row[j];
        if(j === zp || !(ED[j] < ED[i]) || ED[j] > ED[zp] + LOOK.rearMargin) continue;
        var d = Math.hypot(pt.x-q.x, pt.y-q.y); if(d < 60 || d > 900 || !hasLOS(q.x, q.y, pt.x, pt.y)) continue;
        var sc = ED[j] + 0.35*d; if(sc < bs){ bs = sc; best = pt; } } });
      if(!best) return;   // отсюда не видно ни одного прохода к врагу — держать нечего
      var p = spotDerive({x:q.x, y:q.y, lx:best.x, ly:best.y});
      out.push({x:p.x, y:p.y, meet:{x:p.lx, y:p.ly}, looks:null, open:p.open, dirs:p.dirs, side:p.key, hold:p.hold, from:p.from, name:p.name || "",
        ct: team === "CT", t: team === "T", ph:null, lib:false, area: teamAreaOf(p) || null});
    });
  });
  spotsGet().forEach(function(p){
    out.push({x:p.x, y:p.y, meet:{x:p.lx, y:p.ly}, looks:p.looks, open:p.open, dirs:p.dirs, side:p.key, hold:p.hold, from:p.from, name:p.name || "",
      ct: p.side === "CT", t: p.side === "T", ph:p.phase, lib:true, area: p.area || null, id:p.id});
  });
  return out;
}
// знание точки, которое есть у любого игрока: какой проход она держит и насколько открыта
function spotDerive(p){
  var zn = function(i){ return i >= 0 ? (ZONE_NAMES[ZONEMAP.zones[i].id] || ZONEMAP.zones[i].id) : ""; };
  var hold = bzOf(p.x, p.y), from = -1, dx = p.lx - p.x, dy = p.ly - p.y, L = Math.hypot(dx, dy) || 1;
  // откуда придёт враг: первая зона с другим названием по линии взгляда (до 1,6 длины)
  for(var s = 8; s < L*1.6 + 200; s += 8){ var x = p.x + dx/L*s, y = p.y + dy/L*s; if(insideSolidWall(x, y) && s > L) break;
    var z = bzOf(x, y); if(z >= 0 && z !== hold && zn(z) !== zn(hold)){ from = z; break; } }
  if(from < 0) from = bzOf(p.lx, p.ly);
  p.hold = hold; p.from = from; p.key = "z"+hold+":"+from; p.name = zn(from);
  // открыта ли врагу: какая доля точек его стороны (зона врага и соседние, кроме моей) видит меня
  var foeZ = [from]; (BZ.nbr[from] || []).forEach(function(i){ if(i !== hold && foeZ.indexOf(i) < 0) foeZ.push(i); });
  var seen = 0, tot = 0;
  foeZ.forEach(function(zi){ if(zi < 0) return; (ZONE_SAMPLES[ZONEMAP.zones[zi].id] || []).forEach(function(q){
    var d = Math.hypot(q.x-p.x, q.y-p.y); if(d < 40 || d > 900) return; tot++; if(hasLOS(p.x, p.y, q.x, q.y)) seen++; }); });
  p.open = tot ? +(seen/tot).toFixed(2) : 0;
  // открыта ли с других направлений (кроме взгляда): по одному лучу на 0,55 рад
  var ang0 = Math.atan2(dy, dx), bins = {}, dirs = 0;
  ZONEMAP.zones.forEach(function(Z, zi){ if(zi === hold || zi === from) return;
    var sm = ZONE_SAMPLES[Z.id] || [];
    for(var k = 0; k < sm.length && k < 5; k++){ var q = sm[k], dq = Math.hypot(q.x-p.x, q.y-p.y); if(dq < 60 || dq > 1000) continue;
      var aq = Math.atan2(q.y-p.y, q.x-p.x), da = Math.abs(((aq-ang0+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
      if(da < 0.6) break; if(!hasLOS(p.x, p.y, q.x, q.y)) continue;
      var bi = Math.round(aq/0.55); if(bi === -6) bi = 6; if(!bins[bi]){ bins[bi] = 1; dirs++; } break; } });
  p.dirs = dirs;
  return p;
}
