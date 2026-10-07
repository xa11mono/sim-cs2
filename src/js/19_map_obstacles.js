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
var COVER = @@DATA:cover.json@@;
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
var chkCover = document.getElementById("chkCover");
function covLayerOn(){ return chkCover.checked || (mapEdOn() && MAPED.tab === "cover"); }
function covColor(cat, a){ var c = COV_CAT[cat].col; return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
function covPath(p){ ctx.beginPath(); p.forEach(function(q, i){ if(i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); }
function covDraw(){
  if(!covLayerOn()) return;
  var S = view.scale, L = covList();
  // сначала большие, потом мелкие (ступени ящиков лежат поверх своей стены)
  L.slice().sort(function(a, b){ return covPolyArea(b.poly) - covPolyArea(a.poly); }).forEach(function(c){
    covPath(c.poly);
    ctx.fillStyle = covColor(c.cat, 0.62); ctx.fill();
    ctx.lineJoin = "round"; ctx.lineWidth = 1.8/S; ctx.strokeStyle = "rgba(12,12,14,0.95)";
    // пунктир — высота не измерена (навмеша сверху нет), «выше головы» по умолчанию
    ctx.setLineDash(c.h === null && !c.own ? [4/S, 3/S] : []);
    ctx.stroke(); ctx.setLineDash([]); ctx.lineJoin = "miter";
  });
  covLegend();
}
function covLegend(){
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  var ec = document.getElementById("econ"), by = cv.height - 10;
  if(ec && ec.offsetHeight) by = Math.min(by, ec.getBoundingClientRect().top - cv.getBoundingClientRect().top - 10);
  var x0 = hgtLayerOn() ? 352 : 20, w = 300, y0 = by - 102;
  ctx.fillStyle = "rgba(10,14,9,0.9)"; ctx.fillRect(x0 - 8, y0 - 26, w + 16, 128);
  ctx.strokeStyle = "rgba(120,140,100,0.6)"; ctx.lineWidth = 1; ctx.strokeRect(x0 - 8.5, y0 - 26.5, w + 17, 129);
  ctx.font = "11px 'IBM Plex Sans',sans-serif"; ctx.fillStyle = "#e8ecdd"; ctx.textAlign = "left";
  ctx.fillText("Укрытия: высота над полом рядом (рост 72, присев 54)", x0, y0 - 9);
  var y = y0 + 8;
  [["high", "≥ 72 — стоящего не видно"], ["chest", "46–72 — стоя голову видно, присев нет"], ["low", "< 46 — присевший видит поверх"]].forEach(function(r){
    ctx.fillStyle = covColor(r[0], 0.85); ctx.fillRect(x0, y - 9, 18, 12);
    ctx.strokeStyle = "#0c0c0e"; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + .5, y - 8.5, 17, 11);
    ctx.fillStyle = "#e8ecdd"; ctx.font = "600 11px 'IBM Plex Sans',sans-serif"; ctx.fillText(COV_CAT[r[0]].name, x0 + 26, y);
    ctx.font = "11px 'IBM Plex Sans',sans-serif"; ctx.fillStyle = "#c9cfbd"; ctx.fillText(r[1], x0 + 112, y);
    y += 19;
  });
  ctx.setLineDash([4, 3]); ctx.strokeStyle = "#e8ecdd"; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + .5, y - 8.5, 17, 11); ctx.setLineDash([]);
  ctx.fillStyle = "#c9cfbd"; ctx.fillText("пунктир — не измерено (навмеша сверху нет),", x0 + 26, y);
  ctx.fillText("по умолчанию «выше головы»", x0 + 26, y + 14);
  ctx.restore();
}

// ---------- подсказка при наведении ----------
var covTip = document.getElementById("covTip");
function covTipText(x, y){
  var c = covAt(x, y); if(!c) return null;
  var t = ["<b>" + COV_CAT[c.cat].name + "</b> · высота " + covHText(c) + (c.own ? " (правка)" : "")];
  t.push(COV_CAT[c.cat].tip);
  if(c.own && !c.byOwner) t.push("автоматически: " + COV_CAT[c.autoCat].name + (c.autoH !== null ? ", " + Math.round(c.autoH) + " ед." : ""));
  if(c.top !== null && c.top !== undefined) t.push("верх " + Math.round(c.top) + " · пол рядом " + Math.round(c.floor));
  if(c.note) t.push(c.note);
  t.push("<span style='opacity:.6'>" + c.name + " · укрытие " + c.id + (c.byOwner ? " (нарисовано на странице)" : "") + "</span>");
  return t.join("<br>");
}
cv.addEventListener("mousemove", function(e){
  if(!covLayerOn()){ covTip.style.display = "none"; return; }
  var w = navScreenToWorld(e.clientX, e.clientY), txt = covTipText(w.x, w.y);
  if(!txt){ covTip.style.display = "none"; return; }
  hgtTip.style.display = "none";      // над укрытием подсказка укрытия главнее подсказки пола
  var r = cv.getBoundingClientRect();
  covTip.innerHTML = txt; covTip.style.display = "block";
  var px = e.clientX - r.left + 16, py = e.clientY - r.top + 14;
  if(px + covTip.offsetWidth > r.width - 4) px = e.clientX - r.left - covTip.offsetWidth - 12;
  if(py + covTip.offsetHeight > r.height - 4) py = e.clientY - r.top - covTip.offsetHeight - 10;
  covTip.style.left = px + "px"; covTip.style.top = py + "px";
});
cv.addEventListener("mouseleave", function(){ covTip.style.display = "none"; });
chkCover.addEventListener("change", function(){ if(!this.checked) covTip.style.display = "none"; });

// =========================== вкладка «укрытия» редактора карты ===========================
var MED_C = { tool: "select", sel: null, rect: null };
function medCSel(){ var L = covList(); return L.filter(function(c){ return c.id === MED_C.sel || c.ownId === MED_C.sel; })[0] || null; }
// поставить укрытию категорию или число; совпало с автоматическим — правка убирается
function medCApply(cat, h){
  var c = medCSel(); if(!c) return;
  mapEdDo(function(){
    var id = c.ownId || c.id, o = COV_OWN[id] || {pt: [c.pt[0], c.pt[1]]};
    if(c.poly && c.byOwner) o.poly = c.poly;
    delete o.cat; delete o.h;
    if(h !== null && h !== undefined) o.h = h; else o.cat = cat;
    var same = !c.byOwner && ((o.h !== undefined && o.h === c.autoH) || (o.cat !== undefined && c.autoH === null && o.cat === c.autoCat));
    if(same) delete COV_OWN[id]; else COV_OWN[id] = o;
    MED_C.sel = id;
  });
  mapEdRefresh();
}
function medCAuto(){
  var c = medCSel(); if(!c || !c.own || c.byOwner) return;
  var id = c.ownId;
  mapEdDo(function(){ delete COV_OWN[id]; });
  MED_C.sel = c.id; mapEdRefresh();
}
function medCDelete(){
  var c = medCSel(); if(!c || !c.byOwner) return;
  mapEdDo(function(){ delete COV_OWN[c.id]; });
  MED_C.sel = null; mapEdRefresh();
}
var MED_C_HINTS = {
  select: "<b>Выбор.</b><ul><li>Клик по укрытию — выделить (жёлтое), видна его высота.</li><li>Кнопки или клавиши: 1 — выше головы, 2 — по грудь, 3 — низкое; или впиши высоту числом (единицы игры: рост 72, присев 54).</li><li>Правая кнопка — двигать карту. Esc — снять выделение.</li></ul>",
  rect: "<b>Новый кусок.</b><ul><li>Протяни прямоугольник по части стены, которая ниже остальной (выступ, бортик), — появится отдельное укрытие, ему можно поставить высоту.</li><li>Удалить такой кусок — кнопка «Удалить кусок».</li></ul>"
};
mapEdAddTab({
  id: "cover", label: "укрытия", doc: "cover",
  get: function(){ return COV_OWN; },
  set: function(d){ COV_OWN = mapEdClone(d); visInvalidate(); },
  code: function(){ return mapEdClone(COV_OWN_CODE); },
  toDoc: function(d){ return {own: covOwnToList(d)}; },
  fromDoc: function(b){
    var L = b && b.own;
    if(!Array.isArray(L)) return null;
    var num = function(v){ return typeof v === "number" && isFinite(v); };
    var ok = L.every(function(e){
      return e && typeof e.id === "string" && Array.isArray(e.pt) && num(e.pt[0]) && num(e.pt[1]) &&
        (e.cat === undefined || COV_CAT[e.cat]) && (e.h === undefined || (num(e.h) && e.h >= 0 && e.h <= 400)) &&
        (e.poly === undefined || (Array.isArray(e.poly) && e.poly.length >= 3 && e.poly.every(function(q){ return Array.isArray(q) && num(q[0]) && num(q[1]); })));
    });
    return ok ? covOwnFromList(L) : null;
  },
  reset: function(){ MED_C.rect = null; },
  render: function(body){
    body.innerHTML = '<div class="med-tools"><button data-t="select">Выбор</button><button data-t="rect">+ Кусок (прямоугольник)</button></div>' +
      '<div class="med-hint" id="medCHint"></div>' +
      '<div class="med-info" id="medCInfo"></div>' +
      '<div class="med-lv"><span>Высота:</span><button data-c="high">выше головы</button><button data-c="chest">по грудь</button><button data-c="low">низкое</button>' +
      '<input id="medCH" type="number" min="0" max="400" step="1" title="высота над полом, единицы игры (рост 72, присев 54)"> ед.</div>' +
      '<div class="med-row"><button id="medCAuto" title="Убрать правку выделенного укрытия — вернуть то, что посчитано автоматически">Как посчитано автоматически</button><button id="medCDel">Удалить кусок</button></div>';
    body.querySelectorAll("[data-t]").forEach(function(b){ b.addEventListener("click", function(){ MED_C.tool = b.getAttribute("data-t"); MED_C.rect = null; mapEdRefresh(); }); });
    body.querySelectorAll("[data-c]").forEach(function(b){ b.addEventListener("click", function(){ medCApply(b.getAttribute("data-c"), null); }); });
    mapEdEl("medCH").addEventListener("change", function(){ var v = Math.round(+this.value); if(this.value !== "" && isFinite(v) && v >= 0 && v <= 400) medCApply(null, v); });
    mapEdEl("medCAuto").addEventListener("click", medCAuto);
    mapEdEl("medCDel").addEventListener("click", medCDelete);
  },
  refresh: function(){
    var body = mapEdEl("mapEdBody"); if(!body || !mapEdEl("medCHint")) return;
    body.querySelectorAll("[data-t]").forEach(function(b){ b.className = b.getAttribute("data-t") === MED_C.tool ? "on" : ""; });
    mapEdEl("medCHint").innerHTML = MED_C_HINTS[MED_C.tool];
    var c = medCSel(), L = covList(), n = {high: 0, chest: 0, low: 0};
    L.forEach(function(k){ n[k.cat]++; });
    var txt = c ? c.name + ": " + COV_CAT[c.cat].name + ", высота " + covHText(c) +
      (c.own && !c.byOwner ? " (правка; автоматически: " + COV_CAT[c.autoCat].name + (c.autoH !== null ? ", " + Math.round(c.autoH) + " ед." : "") + ")" : "") +
      (c.byOwner ? " (кусок нарисован на странице)" : "") : "Ничего не выделено.";
    mapEdEl("medCInfo").textContent = txt + " Укрытий: " + L.length + " (выше головы " + n.high + ", по грудь " + n.chest + ", низких " + n.low + "), правок: " +
      Object.keys(COV_OWN).length + (COV_C.lost ? ", правок без укрытия (стену удалили): " + COV_C.lost : "") + ".";
    body.querySelectorAll("[data-c]").forEach(function(b){ b.disabled = !c; b.className = c && c.h === null && c.cat === b.getAttribute("data-c") ? "on" : ""; });
    var inp = mapEdEl("medCH"); inp.disabled = !c; if(document.activeElement !== inp) inp.value = c && c.h !== null && c.h !== undefined ? Math.round(c.h) : "";
    mapEdEl("medCAuto").disabled = !(c && c.own && !c.byOwner);
    mapEdEl("medCDel").disabled = !(c && c.byOwner);
  },
  down: function(w, e){
    if(MED_C.tool === "rect"){ MED_C.rect = {x0: w.x, y0: w.y, x1: w.x, y1: w.y}; return true; }
    var c = covAt(w.x, w.y);
    MED_C.sel = c ? (c.ownId || c.id) : null; mapEdRefresh();
    return !!c;
  },
  move: function(w){ if(MED_C.rect){ MED_C.rect.x1 = w.x; MED_C.rect.y1 = w.y; } },
  up: function(){
    var r = MED_C.rect; if(!r) return; MED_C.rect = null;
    var R1 = function(v){ return Math.round(v*10)/10; };
    var x0 = R1(Math.min(r.x0, r.x1)), x1 = R1(Math.max(r.x0, r.x1)), y0 = R1(Math.min(r.y0, r.y1)), y1 = R1(Math.max(r.y0, r.y1));
    if(x1 - x0 >= 3 && y1 - y0 >= 3){
      var id = "o" + Math.round((x0 + x1)/2) + "_" + Math.round((y0 + y1)/2);
      mapEdDo(function(){ COV_OWN[id] = {pt: [R1((x0 + x1)/2), R1((y0 + y1)/2)], cat: "high", poly: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]}; });
      MED_C.sel = id; MED_C.tool = "select";
    }
    mapEdRefresh();
  },
  key: function(e){
    if(e.key === "Escape"){ MED_C.sel = null; MED_C.rect = null; mapEdRefresh(); return true; }
    if(!medCSel()) return false;
    var k = {"1": "high", "2": "chest", "3": "low"}[e.key];
    if(k){ medCApply(k, null); return true; }
    if(e.key === "Delete" && medCSel().byOwner){ medCDelete(); return true; }
    return false;
  },
  draw: function(){
    // сам слой укрытий рисует covDraw (он включён, пока открыта вкладка); здесь — правки и выделение
    var S = view.scale, L = covList();
    ctx.setLineDash([3/S, 3/S]); ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 1.4/S;
    L.forEach(function(c){ if(c.own || c.byOwner){ covPath(c.poly); ctx.stroke(); } });
    ctx.setLineDash([]);
    var c = medCSel();
    if(c){ covPath(c.poly); ctx.fillStyle = "rgba(255,215,90,0.35)"; ctx.fill(); ctx.strokeStyle = "rgba(255,215,90,1)"; ctx.lineWidth = 2.5/S; ctx.stroke(); }
    if(MED_C.rect){ var r = MED_C.rect; ctx.setLineDash([6/S, 4/S]); ctx.strokeStyle = "rgba(120,230,140,1)"; ctx.lineWidth = 2/S;
      ctx.strokeRect(Math.min(r.x0, r.x1), Math.min(r.y0, r.y1), Math.abs(r.x1 - r.x0), Math.abs(r.y1 - r.y0)); ctx.setLineDash([]); }
  }
});
