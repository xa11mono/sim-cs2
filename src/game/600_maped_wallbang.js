// =========================== вкладка «прострелы» редактора карты ===========================
// Выделено: кусок из списка (sel = id) или стена без разметки (wall = точка клика).
var MED_B = { tool: "select", sel: null, wall: null, rect: null };
function medBSel(){ return wbList().filter(function(c){ return c.id === MED_B.sel || c.ownId === MED_B.sel; })[0] || null; }
function medBR(v){ return Math.round(v*10)/10; }
// правка выделенного: f — {on?, mat?, t?}; совпало с автоматическим — правка убирается
function medBApply(f){
  var c = medBSel();
  if(!c && MED_B.wall){         // стена без разметки → новая отметка «простреливается»
    if(f.on === false) return;
    var p = MED_B.wall, id = "w" + Math.round(p[0]) + "_" + Math.round(p[1]);
    mapEdDo(function(){ WB_OWN[id] = {pt: [medBR(p[0]), medBR(p[1])], on: true, mat: f.mat || "wood", t: f.t || 8}; });
    MED_B.sel = id; MED_B.wall = null; mapEdRefresh(); return;
  }
  if(!c) return;
  var id = c.ownId || c.id;
  if(c.byOwner && f.on === false){ medBDelete(); return; }   // своя отметка «нет» — просто убрать её
  mapEdDo(function(){
    var o = WB_OWN[id] || {pt: [c.pt[0], c.pt[1]]};
    Object.keys(f).forEach(function(k){ o[k] = f[k]; });
    if(!c.byOwner){
      if(o.on === true) delete o.on;
      if(o.mat === c.autoMat) delete o.mat;
      if(o.t === c.autoT) delete o.t;
      if(o.on === undefined && o.mat === undefined && o.t === undefined){ delete WB_OWN[id]; return; }
    }
    WB_OWN[id] = o;
  });
  MED_B.sel = WB_OWN[id] ? id : c.id;
  mapEdRefresh();
}
function medBAuto(){
  var c = medBSel(); if(!c || !c.own || c.byOwner) return;
  var id = c.ownId;
  mapEdDo(function(){ delete WB_OWN[id]; });
  MED_B.sel = c.id; mapEdRefresh();
}
function medBDelete(){
  var c = medBSel(); if(!c || !c.byOwner) return;
  mapEdDo(function(){ delete WB_OWN[c.id]; });
  MED_B.sel = null; mapEdRefresh();
}
var MED_B_HINTS = {
  select: "<b>Выбор.</b><ul><li>Клик по стене, ящику или цветному куску — выделить (жёлтое).</li><li>«Простреливается: да / нет», материал из списка, толщина в единицах игры (доска 2–8, ящик поперёк 30–60; толще 90 не пробивает ничто).</li><li>«Да» на стене без разметки — простреливается вся стена; для части большой стены нарисуй кусок.</li><li>Правая кнопка — двигать карту. Esc — снять выделение.</li></ul>",
  rect: "<b>Новый кусок.</b><ul><li>Протяни прямоугольник по части стены, которую пробивает пуля (доски, фанера, тонкий металл) — появится кусок, ему ставится материал и толщина.</li><li>Удалить такой кусок — кнопка «Удалить кусок».</li></ul>"
};
mapEdAddTab({
  id: "wallbang", label: "прострелы", doc: "wallbang",
  get: function(){ return WB_OWN; },
  set: function(d){ WB_OWN = mapEdClone(d); },
  code: function(){ return mapEdClone(WB_OWN_CODE); },
  toDoc: function(d){ return {own: wbOwnToList(d)}; },
  fromDoc: function(b){
    var L = b && b.own;
    if(!Array.isArray(L)) return null;
    var num = function(v){ return typeof v === "number" && isFinite(v); };
    var ok = L.every(function(e){
      return e && typeof e.id === "string" && Array.isArray(e.pt) && num(e.pt[0]) && num(e.pt[1]) &&
        (e.on === undefined || typeof e.on === "boolean") && (e.mat === undefined || WB_MAT[e.mat]) &&
        (e.t === undefined || (num(e.t) && e.t >= 0 && e.t <= 400)) &&
        (e.poly === undefined || (Array.isArray(e.poly) && e.poly.length >= 3 && e.poly.every(function(q){ return Array.isArray(q) && num(q[0]) && num(q[1]); })));
    });
    return ok ? wbOwnFromList(L) : null;
  },
  reset: function(){ MED_B.rect = null; },
  render: function(body){
    var opts = Object.keys(WB_MAT).map(function(k){ return '<option value="' + k + '">' + WB_MAT[k].name + '</option>'; }).join("");
    body.innerHTML = '<div class="med-tools"><button data-t="select">Выбор</button><button data-t="rect">+ Кусок (прямоугольник)</button></div>' +
      '<div class="med-hint" id="medBHint"></div>' +
      '<div class="med-info" id="medBInfo"></div>' +
      '<div class="med-lv"><span>Простреливается:</span><button data-on="1">да</button><button data-on="0">нет</button></div>' +
      '<div class="med-lv"><span>Материал:</span><select id="medBMat" class="med-sel">' + opts + '</select>' +
      '<span>толщина</span><input id="medBT" type="number" min="0" max="400" step="1" title="толщина простреливаемого куска, единицы игры (толще 90 не пробивает ничто)"> ед.</div>' +
      '<div class="med-info" id="medBDmg"></div>' +
      '<div class="med-row"><button id="medBAuto" title="Убрать правку выделенного куска — вернуть то, что размечено в коде">Как размечено в коде</button><button id="medBDel">Удалить кусок</button></div>';
    body.querySelectorAll("[data-t]").forEach(function(b){ b.addEventListener("click", function(){ MED_B.tool = b.getAttribute("data-t"); MED_B.rect = null; mapEdRefresh(); }); });
    body.querySelectorAll("[data-on]").forEach(function(b){ b.addEventListener("click", function(){ medBApply({on: b.getAttribute("data-on") === "1"}); }); });
    mapEdEl("medBMat").addEventListener("change", function(){ medBApply({on: true, mat: this.value}); });
    mapEdEl("medBT").addEventListener("change", function(){ var v = Math.round(+this.value); if(this.value !== "" && isFinite(v) && v >= 0 && v <= 400) medBApply({on: true, t: v}); });
    mapEdEl("medBAuto").addEventListener("click", medBAuto);
    mapEdEl("medBDel").addEventListener("click", medBDelete);
  },
  refresh: function(){
    var body = mapEdEl("mapEdBody"); if(!body || !mapEdEl("medBHint")) return;
    body.querySelectorAll("[data-t]").forEach(function(b){ b.className = b.getAttribute("data-t") === MED_B.tool ? "on" : ""; });
    mapEdEl("medBHint").innerHTML = MED_B_HINTS[MED_B.tool];
    var c = medBSel(), L = wbList(), on = L.filter(function(k){ return k.on; }).length, txt;
    if(c) txt = c.name + ": " + (c.on ? WB_MAT[c.mat].name + ", " + c.t + " ед." : "не простреливается") +
      (c.own && !c.byOwner ? " (правка; в коде: " + WB_MAT[c.autoMat].name + ", " + c.autoT + " ед.)" : "");
    else if(MED_B.wall) txt = "Стена без разметки (" + calloutName(MED_B.wall[0], MED_B.wall[1]) + "): не простреливается — камень/бетон.";
    else txt = "Ничего не выделено.";
    mapEdEl("medBInfo").textContent = txt + " Простреливаемых кусков: " + on + " из " + L.length + ", правок: " + Object.keys(WB_OWN).length +
      (WB_C.lost ? ", правок без стены (стену удалили): " + WB_C.lost : "") + ".";
    var has = !!(c || MED_B.wall), isOn = c ? c.on : false;
    body.querySelectorAll("[data-on]").forEach(function(b){ b.disabled = !has; b.className = has && ((b.getAttribute("data-on") === "1") === isOn) ? "on" : ""; });
    var sel = mapEdEl("medBMat"), inp = mapEdEl("medBT");
    sel.disabled = !has; inp.disabled = !has;
    if(c) sel.value = c.mat;
    if(document.activeElement !== inp) inp.value = c ? c.t : "";
    var dm = "";
    if(c && c.on){
      var ak = wbChest("AK", c.mat, c.t), awp = wbChest("AWP", c.mat, c.t);
      dm = "AK в грудь: " + (ak[0] >= 1 ? wbR(ak[0]) + " (в броне " + wbR(ak[1]) + ")" : "не пробивает") + " · AWP: " + (awp[0] >= 1 ? wbR(awp[0]) + " (в броне " + wbR(awp[1]) + ")" : "не пробивает");
    }
    mapEdEl("medBDmg").textContent = dm;
    mapEdEl("medBAuto").disabled = !(c && c.own && !c.byOwner);
    mapEdEl("medBDel").disabled = !(c && c.byOwner);
  },
  down: function(w, e){
    if(MED_B.tool === "rect"){ MED_B.rect = {x0: w.x, y0: w.y, x1: w.x, y1: w.y}; return true; }
    var c = wbAt(w.x, w.y, true);
    MED_B.sel = c ? (c.ownId || c.id) : null;
    MED_B.wall = !c && covWallAt(w.x, w.y) ? [w.x, w.y] : null;
    mapEdRefresh();
    return !!(c || MED_B.wall);
  },
  move: function(w){ if(MED_B.rect){ MED_B.rect.x1 = w.x; MED_B.rect.y1 = w.y; } },
  up: function(){
    var r = MED_B.rect; if(!r) return; MED_B.rect = null;
    var x0 = medBR(Math.min(r.x0, r.x1)), x1 = medBR(Math.max(r.x0, r.x1)), y0 = medBR(Math.min(r.y0, r.y1)), y1 = medBR(Math.max(r.y0, r.y1));
    if(x1 - x0 >= 3 && y1 - y0 >= 3){
      var id = "p" + Math.round((x0 + x1)/2) + "_" + Math.round((y0 + y1)/2);
      mapEdDo(function(){ WB_OWN[id] = {pt: [medBR((x0 + x1)/2), medBR((y0 + y1)/2)], on: true, mat: "wood", t: 8, poly: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]}; });
      MED_B.sel = id; MED_B.wall = null; MED_B.tool = "select";
    }
    mapEdRefresh();
  },
  key: function(e){
    if(e.key === "Escape"){ MED_B.sel = null; MED_B.wall = null; MED_B.rect = null; mapEdRefresh(); return true; }
    var c = medBSel();
    if(e.key === "Delete" && c && c.byOwner){ medBDelete(); return true; }
    return false;
  },
  draw: function(){
    // сам слой рисует wbDraw (он включён, пока открыта вкладка); здесь — правки и выделение
    var S = view.scale;
    ctx.setLineDash([3/S, 3/S]); ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 1.4/S;
    wbList().forEach(function(c){ if(c.own || c.byOwner){ covPath(c.poly); ctx.stroke(); } });
    ctx.setLineDash([]);
    var c = medBSel(), p = c ? c.poly : (MED_B.wall ? covWallAt(MED_B.wall[0], MED_B.wall[1]) : null);
    if(p){ covPath(p); ctx.fillStyle = "rgba(255,215,90,0.3)"; ctx.fill(); ctx.strokeStyle = "rgba(255,215,90,1)"; ctx.lineWidth = 2.5/S; ctx.stroke(); }
    if(MED_B.rect){ var r = MED_B.rect; ctx.setLineDash([6/S, 4/S]); ctx.strokeStyle = "rgba(120,230,140,1)"; ctx.lineWidth = 2/S;
      ctx.strokeRect(Math.min(r.x0, r.x1), Math.min(r.y0, r.y1), Math.abs(r.x1 - r.x0), Math.abs(r.y1 - r.y0)); ctx.setLineDash([]); }
  }
});

