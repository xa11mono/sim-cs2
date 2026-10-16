// ---------- стены (v241, из переделки v198) ----------
// Одно место хранения стен: WALL_POLYS — замкнутые многоугольники [[x,y],...] в координатах радара 0..2048
// (формат src/data/walls.json ветки rebuild-v238, с правками владельца). Правка владельца из базы страницы
// (редактор карты, вкладка «стены») заменяет их. После любой правки — applyWalls(true): пересобирает всё,
// что игра строит из стен (отрезки для движения, сплошные многоугольники, навмеш, спавны, опасность зон, видимость).
var WALL_POLYS_CODE = MAP.walls.polys;
var WALL_POLYS = JSON.parse(JSON.stringify(WALL_POLYS_CODE));
var MANUAL_WALLS = [];      // отрезки стен [x1,y1,x2,y2] — движение (crossesWall), гранаты, рисование
var WALL_SOLID_POLYS = [];  // те же стены как многоугольники {x,y} — «точка внутри стены»
var WALLS_SIG = "";
function applyWalls(full){
  MANUAL_WALLS.length = 0;
  WALL_SOLID_POLYS = WALL_POLYS.map(function(poly){ return poly.map(function(p){ return {x:p[0], y:p[1]}; }); });
  var h = 0;
  WALL_POLYS.forEach(function(poly){
    for(var i=0;i<poly.length;i++){
      var a = poly[i], b = poly[(i+1)%poly.length];
      MANUAL_WALLS.push([a[0],a[1],b[0],b[1]]);
      h = (h*31 + Math.round(a[0]*10)*7 + Math.round(a[1]*10)) % 2147483647;
    }
  });
  WALLS_SIG = MANUAL_WALLS.length + ":" + h;
  if(!full || typeof zonesById === "undefined" || !zonesById) return;
  rebuildNav();
  if(typeof resnapSpawns === "function") resnapSpawns();
  if(typeof HOLD_CANDS !== "undefined") HOLD_CANDS = {};
  if(typeof visInvalidate === "function") visInvalidate();   // и таблица «откуда простреливается»
}
applyWalls();

// ======================= v199: высоты и этажи (19_map_heights.js) =======================
// Данные — src/data/heights.json (делает tools/heights_bake.py из навмеша и
// радаров Simple Radar): у каждого участка пола (полигона навмеша) высота z,
// уровень lvl, «крыто сверху» cov, номер рампы; уступы, стрелки «вверх»,
// «уровень над уровнем». Правки владельца (вкладка «высоты» редактора карты) —
// HGT_OWN {id: {lvl, cov}} поверх автоматического; в базе страницы — документ
// map/heights, в коде — поле own в heights.json (забирает tools/map_pull.py).
// Только показ и разметка: на игру (движение, стрельбу, видимость) пока не влияет.
// Состояние слоя и редактора в снимок игры не попадает (src/build.py, список UI).
var HEIGHTS = MAP.heights;
var HGT_AUTO = {};          // id → [z, lvl, cov, ramp]
HEIGHTS.areas.forEach(function(r){ HGT_AUTO[r[0]] = r; });
function hgtOwnFromList(list){
  var o = {};
  (Array.isArray(list) ? list : []).forEach(function(e){ var v = {}; if(e.lvl !== undefined) v.lvl = e.lvl; if(e.cov !== undefined) v.cov = e.cov; o[e.id] = v; });
  return o;
}
function hgtOwnToList(o){
  return Object.keys(o).map(Number).sort(function(a, b){ return a - b; }).map(function(id){
    var e = {id: id}; if(o[id].lvl !== undefined) e.lvl = o[id].lvl; if(o[id].cov !== undefined) e.cov = o[id].cov; return e; });
}
var HGT_OWN_CODE = hgtOwnFromList(HEIGHTS.own);
var HGT_OWN = JSON.parse(JSON.stringify(HGT_OWN_CODE));

// итог по участку: автоматическое + правка владельца
function hgtInfo(id){
  var a = HGT_AUTO[id]; if(!a) return null;
  var o = HGT_OWN[id] || {};
  return { id: id, z: a[1], lvl: o.lvl !== undefined ? o.lvl : a[2], cov: o.cov !== undefined ? o.cov : a[3], ramp: a[4],
           autoLvl: a[2], autoCov: a[3], own: !!HGT_OWN[id] };
}
// ======================= v200: высота укрытий (19_map_obstacles.js) =======================
// Данные — src/data/cover.json (делает tools/cover_bake.py из стен и навмеша):
// у каждого укрытия (ящик, колонна, низкая стена, отдельная стена) — высота над
// полом рядом h (единицы игры; null — не измерено, «выше головы» по умолчанию) и
// категория. Форма: shape "wall" — та стена WALL_POLYS, внутри которой точка pt
// (правка стен двигает и укрытие), shape "piece" — своя форма poly.
// Правки владельца (вкладка «укрытия» редактора карты) — COV_OWN {id: {pt, cat|h, poly?}}
// поверх автоматического; в базе страницы — документ map/cover, в коде — поле own
// в cover.json (забирает tools/map_pull.py).
// Только показ и разметка: на игру (видимость, стрельбу) пока не влияет.
// Состояние слоя и редактора в снимок игры не попадает (src/build.py, список UI).
var COVER = MAP.cover;
// рост CS2: стоя 72 (глаза 64), присев 54 (глаза 46); пороги — как в cover.json (_about)
var COV_HIGH = 72, COV_CHEST = 46;
var COV_CAT = {
  high:  { name: "выше головы", col: [205, 64, 92],  tip: "стоящего не видно целиком" },
  chest: { name: "по грудь",    col: [236, 170, 48], tip: "стоя голову видно, присев — нет" },
  low:   { name: "низкое",      col: [70, 200, 225], tip: "присевший видит поверх; закрывает ноги или ничего" }
};
var COV_ORDER = ["high", "chest", "low"];
function covCatOf(h){ return (h === null || h === undefined || h >= COV_HIGH) ? "high" : (h >= COV_CHEST ? "chest" : "low"); }
var COV_AUTO = {};
COVER.items.forEach(function(it){ COV_AUTO[it.id] = it; });
function covOwnFromList(list){
  var o = {};
  (Array.isArray(list) ? list : []).forEach(function(e){
    var v = {pt: [e.pt[0], e.pt[1]]};
    if(e.cat !== undefined) v.cat = e.cat;
    if(e.h !== undefined) v.h = e.h;
    if(e.poly) v.poly = e.poly.map(function(q){ return [q[0], q[1]]; });
    o[e.id] = v;
  });
  return o;
}
function covOwnToList(o){
  return Object.keys(o).sort().map(function(id){
    var v = o[id], e = {id: id, pt: v.pt};
    if(v.cat !== undefined) e.cat = v.cat;
    if(v.h !== undefined) e.h = v.h;
    if(v.poly) e.poly = v.poly;
    return e;
  });
}
var COV_OWN_CODE = covOwnFromList(COVER.own);
var COV_OWN = JSON.parse(JSON.stringify(COV_OWN_CODE));

function covPts(p){ return p.map(function(q){ return {x: q[0], y: q[1]}; }); }
function covPolyArea(p){ var a = 0; for(var i = 0; i < p.length; i++){ var b = p[(i+1) % p.length]; a += p[i][0]*b[1] - b[0]*p[i][1]; } return Math.abs(a)/2; }
// стена, внутри которой точка (самая маленькая из таких)
function covWallAt(x, y){
  var best = null, ba = Infinity;
  WALL_POLYS.forEach(function(p){ if(pointInPoly(x, y, covPts(p))){ var a = covPolyArea(p); if(a < ba){ ba = a; best = p; } } });
  return best;
}

// ---------- итог: все укрытия с правками владельца ----------
// одно место: автоматическое (cover.json) + правка владельца (COV_OWN)
var COV_C = { key: null, list: [] };
function covList(){
  var key = WALLS_SIG + "|" + JSON.stringify(COV_OWN);
  if(COV_C.key === key) return COV_C.list;
  var out = [], byId = {};
  COVER.items.forEach(function(it){
    var poly = it.shape === "piece" ? it.poly : covWallAt(it.pt[0], it.pt[1]);
    if(!poly) return;                 // стену удалили — укрытия нет
    var c = {id: it.id, name: it.name, poly: poly, pt: it.pt, autoH: it.h, autoCat: it.cat, h: it.h, cat: it.cat,
             src: it.src, top: it.top, floor: it.floor, note: it.note || "", own: false, byOwner: false};
    out.push(c); byId[it.id] = c;
  });
  var lost = 0;
  Object.keys(COV_OWN).sort().forEach(function(id){
    var o = COV_OWN[id], c = byId[id];
    if(!c && o.poly){   // кусок, нарисованный владельцем
      c = {id: id, name: calloutName(o.pt[0], o.pt[1]), poly: o.poly, pt: o.pt, autoH: null, autoCat: "high", h: null, cat: "high",
           src: "own", top: null, floor: null, note: "", own: false, byOwner: true};
      out.push(c); byId[id] = c;
    }
    if(!c){   // id после пересчёта сменился — ищем укрытие по точке
      c = out.filter(function(k){ return !k.own && pointInPoly(o.pt[0], o.pt[1], covPts(k.poly)); })[0];
      if(!c){ lost++; return; }
    }
    c.own = true; c.ownId = id;
    if(o.h !== undefined){ c.h = o.h; c.cat = covCatOf(o.h); }
    else if(o.cat !== undefined){ c.cat = o.cat; c.h = null; }
  });
  COV_C.key = key; COV_C.list = out; COV_C.lost = lost;
  return out;
}
// укрытие под точкой: сначала то, у которого край ближе (8 px экрана), иначе самое маленькое из тех, что накрывают точку
function covAt(x, y){
  var L = covList(), best = null, ba = Infinity;
  L.forEach(function(c){ if(pointInPoly(x, y, covPts(c.poly))){ var a = covPolyArea(c.poly); if(a < ba){ ba = a; best = c; } } });
  return best;
}
function covHText(c){
  if(c.h === null || c.h === undefined) return c.own ? "числом не задана" : "не измерена (навмеша сверху нет)";
  return Math.round(c.h) + " ед.";
}

// ---------- слой «укрытия» ----------
// ======================= v202: прострелы (19_map_wallbang.js) =======================
// Данные — src/data/wallbang.json (делает tools/wallbang_bake.py): правила урона
// через стену CS2 (rules), пробитие оружия (weapons), материалы (materials) и
// простреливаемые куски стен и укрытий Ancient (items: материал, толщина t в ед. игры,
// источники и что предположение). Форма куска: shape "wall" — стена WALL_POLYS,
// внутри которой точка pt (ящик целиком), "piece" — своя форма poly.
// Правки владельца (вкладка «прострелы» редактора карты) — WB_OWN {id: {pt, on?, mat?, t?, poly?}}
// поверх автоматического; в базе страницы — документ map/wallbang, в коде — поле own
// в wallbang.json (забирает tools/map_pull.py).
// Только показ и разметка: на игру (стрельбу, урон) пока не влияет — это часть 2.
// Состояние слоя и редактора в снимок игры не попадает (src/build.py, список UI).
var WALLBANG = MAP.wallbang;
var WB_MAT = WALLBANG.materials, WB_RULES = WALLBANG.rules;
var WB_AUTO = {};
WALLBANG.items.forEach(function(it){ WB_AUTO[it.id] = it; });
function wbOwnFromList(list){
  var o = {};
  (Array.isArray(list) ? list : []).forEach(function(e){
    var v = {pt: [e.pt[0], e.pt[1]]};
    if(e.on !== undefined) v.on = !!e.on;
    if(e.mat !== undefined) v.mat = e.mat;
    if(e.t !== undefined) v.t = e.t;
    if(e.poly) v.poly = e.poly.map(function(q){ return [q[0], q[1]]; });
    o[e.id] = v;
  });
  return o;
}
function wbOwnToList(o){
  return Object.keys(o).sort().map(function(id){
    var v = o[id], e = {id: id, pt: v.pt};
    ["on", "mat", "t", "poly"].forEach(function(k){ if(v[k] !== undefined) e[k] = v[k]; });
    return e;
  });
}
var WB_OWN_CODE = wbOwnFromList(WALLBANG.own);
var WB_OWN = JSON.parse(JSON.stringify(WB_OWN_CODE));

// ---------- урон через стену (правила CS2; одно место — часть 2 возьмёт отсюда) ----------
// mod — модификатор материала (вход и выход из одного дерева/картона — 3, пластика — 2);
// потеря = урон × 0,16 + 3,75 / пробитие × 3 / mod + толщина² / (24 × mod)
function wbAfter(pen, dmg, mat, t){
  var m = WB_MAT[mat], R = WB_RULES;
  if(!m || t > R.max_thick) return 0;
  var mod = m.kind === "grate" ? R.grate_mod : (R.same_mat[m.kind] || m.pen);
  var share = m.kind === "grate" ? R.grate_share : R.lost_share, pm = 1/mod;
  var lost = dmg*share + R.wep_k/pen*pm*3 + pm*t*t/R.thick_div;
  return Math.max(0, dmg - lost);
}
// урон оружия игры (WEAPONS) в грудь после стены: [без брони, в броне]
function wbChest(wkey, mat, t){
  var w = WEAPONS[wkey], wb = WALLBANG.weapons[wkey];
  if(!w || !wb) return null;
  var d = wbAfter(wb.pen, w.dmg, mat, t);
  return [d, d*w.armorPen];
}

// ---------- итог: все куски с правками владельца ----------
var WB_C = { key: null, list: [] };
function wbList(){
  var key = WALLS_SIG + "|" + JSON.stringify(WB_OWN);
  if(WB_C.key === key) return WB_C.list;
  var out = [], byId = {};
  WALLBANG.items.forEach(function(it){
    var poly = it.shape === "piece" ? it.poly : covWallAt(it.pt[0], it.pt[1]);
    if(!poly) return;                 // стену удалили — куска нет
    var c = {id: it.id, name: it.name, callout: it.callout, poly: poly, pt: it.pt, shape: it.shape,
             mat: it.mat, t: it.t, on: true, autoMat: it.mat, autoT: it.t, radarT: it.radar_t,
             refs: it.refs || [], sure: it.sure || "", guess: it.guess || "", note: it.note || "", own: false, byOwner: false};
    out.push(c); byId[it.id] = c;
  });
  var lost = 0;
  Object.keys(WB_OWN).sort().forEach(function(id){
    var o = WB_OWN[id], c = byId[id];
    if(!c && !WB_AUTO[id]){   // кусок или стена, отмеченные владельцем
      var poly = o.poly || covWallAt(o.pt[0], o.pt[1]);
      if(!poly){ lost++; return; }
      c = {id: id, name: (o.poly ? "кусок" : "стена") + " (отмечено на странице)", callout: calloutName(o.pt[0], o.pt[1]), poly: poly, pt: o.pt,
           shape: o.poly ? "piece" : "wall", mat: "wood", t: 8, on: true, autoMat: null, autoT: null, radarT: null,
           refs: [], sure: "", guess: "", note: "", own: false, byOwner: true};
      out.push(c); byId[id] = c;
    }
    if(!c){   // id после пересчёта сменился — ищем кусок по точке
      c = out.filter(function(k){ return !k.own && !k.byOwner && pointInPoly(o.pt[0], o.pt[1], covPts(k.poly)); })[0];
      if(!c){ lost++; return; }
    }
    c.own = true; c.ownId = id;
    if(o.on !== undefined) c.on = o.on;
    if(o.mat !== undefined && WB_MAT[o.mat]) c.mat = o.mat;
    if(o.t !== undefined) c.t = o.t;
  });
  WB_C.key = key; WB_C.list = out; WB_C.lost = lost;
  return out;
}
// кусок под точкой (самый маленький из накрывающих); off — брать и выключенные
function wbAt(x, y, off){
  var best = null, ba = Infinity;
  wbList().forEach(function(c){
    if(!c.on && !off) return;
    if(pointInPoly(x, y, covPts(c.poly))){ var a = covPolyArea(c.poly); if(a < ba){ ba = a; best = c; } }
  });
  return best;
}

// ---------- слой «прострелы» ----------
