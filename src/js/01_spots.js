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
//   времени}; n — сколько раз там стояли}. Что видно с места и какие входы
//   открыты — по углам (10_corners.js), как с любой точки.
var SPOTS_DATA = @@DATA:spots.json@@;
var SPOTS = null;
function spotsGet(){
  if(!SPOTS) SPOTS = SPOTS_DATA.spots.map(function(p){ var q = Object.assign({}, p); q.lx = p.looks[0].x; q.ly = p.looks[0].y; return q; });
  return SPOTS;
}
// (v196, В15) где можно встать — проверочные точки по полу (сетка 32 px внутри зон
// карты, не в стене; «укрытие» — стена ближе 34 px) + места из демок своей стороны
// (небольшой плюс своей фазе, ACT.W.lib). У точки нет заранее заданного взгляда и
// входа: что отсюда видно, какие входы открыты и насколько они опасны сейчас,
// считает выбор действия по углам (placeEval, 12_team.js). Заменило
// «места карты» v195 (точки зон с готовым направлением на проход).
var _PROBES = null;
function wallDist(x, y){ var best = 1e9;
  for(var i=0;i<wallSegsLOS.length;i++){ var s = wallSegsLOS[i], vx = s[2]-s[0], vy = s[3]-s[1], L = vx*vx+vy*vy, t = L ? Math.max(0, Math.min(1, ((x-s[0])*vx+(y-s[1])*vy)/L)) : 0;
    var d = Math.hypot(x-(s[0]+vx*t), y-(s[1]+vy*t)); if(d < best) best = d; }
  return best; }
function placesGet(){
  var out = [];
  for(var x=16; x<2048; x+=32) for(var y=16; y<2048; y+=32){
    if(!zoneIdAt(x, y) || insideSolidWall(x, y)) continue;
    var wd = wallDist(x, y); if(wd < 10) continue;
    out.push({x:x, y:y, meet:null, looks:null, ct:true, t:true, ph:null, lib:false, cover:wd < 34, area:teamAreaOf({x:x, y:y}) || null, side:null, name:""});
  }
  spotsGet().forEach(function(p){
    out.push({x:p.x, y:p.y, meet:null, looks:p.looks, ct:p.side === "CT", t:p.side === "T", ph:p.phase, lib:true, cover:wallDist(p.x, p.y) < 34, area:p.area || null, side:null, name:"", id:p.id});
  });
  return (_PROBES = out);
}
