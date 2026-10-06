// ---------- точки углов (v193, К12): откуда держать угол и куда смотреть ----------
// Заменяет автоматические «укрытия» разметки v189 (01_markup.js удалён целиком).
// Точки ставит и правит владелец редактором на радаре (слой «точки углов»,
// 18_ui_editors.js); хранятся в src/data/points.json, правки со страницы — в
// базе страницы (коллекция points, документ map), Claude переносит их в файл.
// Боты используют точки только чтобы держать угол: ходить по карте, пикать,
// брать области можно и без точек (12_team.js).
//
// POINTS[i] = {id, x, y — где стоять; lx, ly — куда смотреть; side: "CT" | "T"
//   | "both" — чья точка; area: "A" | "B" | "M" | "" — район (пусто — вне
//   районов плана: передняя точка, годится для пика/подпуша, но не для «держать
//   по расстановке»)}. Остальное игра считает сама по стенам и зонам
//   (pointDerive): hold — зона, где стоишь; from — зона, откуда придёт враг (по
//   направлению взгляда); key — какой это вход; open — доля мест врага, откуда
//   точку видно; dirs — сколько других направлений её видят.
var POINTS_CODE = @@DATA:points.json@@;
var POINTS = null, POINTS_SRC = "код";
function pointsGet(){
  if(!POINTS) POINTS = POINTS_CODE.pts.map(function(p){ return Object.assign({}, p); });
  POINTS.forEach(function(p){ if(p.hold == null || p.from == null || p.open == null) pointDerive(p); });
  return POINTS;
}
// заменить весь набор (из базы страницы или из редактора); выбор действия
// перечитает каталог (TEAM_COV)
function pointsSet(list, src){
  POINTS = list.map(function(p){ return Object.assign({}, p); }); POINTS_SRC = src || POINTS_SRC;
  if(typeof TEAM_COV !== "undefined") TEAM_COV = null;
}
// знание точки, которое есть у любого игрока: какой проход она держит и насколько открыта
function pointDerive(p){
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
// точки из базы страницы: владелец правил редактором — играем его точками
// (с начала следующего раунда, чтобы раунд не менялся на ходу)
var POINTS_PENDING = null;
function pointsFromDb(doc){
  if(!doc || !doc.pts || !doc.pts.length) return;
  POINTS_PENDING = {pts:doc.pts, src:"база страницы, "+new Date(doc.t || Date.now()).toLocaleString("ru-RU")};
  if(typeof roundState === "undefined" || roundState !== "live") pointsApplyPending();
}
function pointsApplyPending(){ if(!POINTS_PENDING) return; pointsSet(POINTS_PENDING.pts, POINTS_PENDING.src); POINTS_PENDING = null;
  if(typeof ptEdRefresh === "function") ptEdRefresh(); }
