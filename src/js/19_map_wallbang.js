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
var WALLBANG = @@DATA:wallbang.json@@;
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
var chkWallbang = document.getElementById("chkWallbang");
function wbLayerOn(){ return chkWallbang.checked || (mapEdOn() && MAPED.tab === "wallbang"); }
function wbColor(mat, a){ var c = (WB_MAT[mat] || WB_MAT.wood).col; return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
function wbDraw(){
  if(!wbLayerOn()) return;
  var S = view.scale, ed = mapEdOn() && MAPED.tab === "wallbang";
  wbList().slice().sort(function(a, b){ return covPolyArea(b.poly) - covPolyArea(a.poly); }).forEach(function(c){
    if(!c.on && !ed) return;
    covPath(c.poly);
    if(c.on){ ctx.fillStyle = wbColor(c.mat, 0.8); ctx.fill(); }
    else { ctx.fillStyle = "rgba(120,120,120,0.35)"; ctx.fill(); }
    ctx.lineJoin = "round"; ctx.lineWidth = 2/S; ctx.strokeStyle = c.on ? "rgba(255,255,255,0.95)" : "rgba(200,200,200,0.8)";
    ctx.setLineDash(c.on ? [] : [4/S, 3/S]); ctx.stroke(); ctx.setLineDash([]); ctx.lineJoin = "miter";
    // пули: три короткие линии поперёк — «сюда стреляют»
    if(c.on){
      var r = Math.max(4, 7/S);
      ctx.strokeStyle = "rgba(20,14,8,0.9)"; ctx.lineWidth = 1.6/S;
      for(var k = -1; k <= 1; k++){ ctx.beginPath(); ctx.moveTo(c.pt[0] - r, c.pt[1] + k*r*0.6); ctx.lineTo(c.pt[0] + r, c.pt[1] + k*r*0.6); ctx.stroke(); }
    }
  });
  wbLegend();
}
function wbLegend(){
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  var ec = document.getElementById("econ"), by = cv.height - 10;
  if(ec && ec.offsetHeight) by = Math.min(by, ec.getBoundingClientRect().top - cv.getBoundingClientRect().top - 10);
  var used = {}; wbList().forEach(function(c){ if(c.on) used[c.mat] = 1; });
  var mats = Object.keys(WB_MAT).filter(function(k){ return used[k]; });
  var x0 = 20 + (hgtLayerOn() ? 332 : 0) + (covLayerOn() ? 332 : 0), w = 330, h = 62 + mats.length*19, y0 = by - h + 26;
  ctx.fillStyle = "rgba(10,14,9,0.9)"; ctx.fillRect(x0 - 8, y0 - 26, w + 16, h);
  ctx.strokeStyle = "rgba(120,140,100,0.6)"; ctx.lineWidth = 1; ctx.strokeRect(x0 - 8.5, y0 - 26.5, w + 17, h + 1);
  ctx.font = "11px 'IBM Plex Sans',sans-serif"; ctx.fillStyle = "#e8ecdd"; ctx.textAlign = "left";
  ctx.fillText("Прострелы: куски стен, которые пробивает пуля", x0, y0 - 9);
  var y = y0 + 8;
  mats.forEach(function(k){
    var m = WB_MAT[k];
    ctx.fillStyle = wbColor(k, 0.9); ctx.fillRect(x0, y - 9, 18, 12);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + .5, y - 8.5, 17, 11);
    ctx.fillStyle = "#e8ecdd"; ctx.font = "600 11px 'IBM Plex Sans',sans-serif"; ctx.fillText(m.name, x0 + 26, y);
    var ak = wbAfter(2, 36, k, 8);
    ctx.font = "11px 'IBM Plex Sans',sans-serif"; ctx.fillStyle = "#c9cfbd";
    ctx.fillText("AK сквозь 8 ед.: " + (ak >= 1 ? Math.round(ak) + " из 36" : "не пробивает"), x0 + 150, y);
    y += 19;
  });
  ctx.fillStyle = "#c9cfbd";
  ctx.fillText("Остальное — камень/бетон толще 90 ед.: не пробивается.", x0, y);
  ctx.fillText("Наведи на кусок — материал, толщина, урон AK и AWP.", x0, y + 14);
  ctx.restore();
}

// ---------- подсказка при наведении ----------
var wbTip = document.getElementById("wbTip");
function wbR(v){ return Math.round(v); }
function wbTipText(x, y){
  var c = wbAt(x, y, mapEdOn() && MAPED.tab === "wallbang"); if(!c) return null;
  var m = WB_MAT[c.mat], t = [];
  t.push("<b>" + c.name + "</b>" + (c.own ? " (правка)" : ""));
  if(!c.on){ t.push("не простреливается (правка владельца)"); return t.join("<br>"); }
  t.push(m.name + " · толщина " + c.t + " ед." + (c.radarT ? " <span style='opacity:.6'>(стена на радаре ~" + c.radarT + " ед.)</span>" : ""));
  [["AK", "AK-47"], ["AWP", "AWP"]].forEach(function(r){
    var d = wbChest(r[0], c.mat, c.t), w = WEAPONS[r[0]];
    t.push(r[1] + " в грудь: " + (d[0] >= 1 ? "<b>" + wbR(d[0]) + "</b> из " + w.dmg + ", в броне " + wbR(d[1]) : "<b>не пробивает</b>"));
  });
  var yes = [], no = [];
  Object.keys(WEAPONS).forEach(function(k){
    var d = wbChest(k, c.mat, c.t); if(!d) return;
    (d[0] >= 1 ? yes : no).push(WEAPONS[k].name + (d[0] >= 1 ? " " + wbR(d[1]) : ""));
  });
  t.push("<span style='opacity:.85'>пробивает (в грудь, в броне): " + (yes.join(", ") || "ничего") + "</span>");
  if(no.length) t.push("<span style='opacity:.85'>не пробивает: " + no.join(", ") + "</span>");
  if(c.own && !c.byOwner && (c.mat !== c.autoMat || c.t !== c.autoT)) t.push("автоматически: " + WB_MAT[c.autoMat].name + ", " + c.autoT + " ед.");
  if(c.note) t.push(c.note);
  if(c.sure) t.push("<span style='color:#9fd89a'>из источников:</span> " + c.sure);
  if(c.guess) t.push("<span style='color:#f0c060'>предположение:</span> " + c.guess);
  t.push("<span style='opacity:.6'>урон в упор, без падения с дистанцией · " + c.callout + " · " + c.id + "</span>");
  return t.join("<br>");
}
cv.addEventListener("mousemove", function(e){
  if(!wbLayerOn()){ wbTip.style.display = "none"; return; }
  var w = navScreenToWorld(e.clientX, e.clientY), txt = wbTipText(w.x, w.y);
  if(!txt){ wbTip.style.display = "none"; return; }
  hgtTip.style.display = "none"; covTip.style.display = "none";   // над простреливаемым куском его подсказка главнее
  var r = cv.getBoundingClientRect();
  wbTip.innerHTML = txt; wbTip.style.display = "block";
  var px = e.clientX - r.left + 16, py = e.clientY - r.top + 14;
  if(px + wbTip.offsetWidth > r.width - 4) px = e.clientX - r.left - wbTip.offsetWidth - 12;
  if(py + wbTip.offsetHeight > r.height - 4) py = Math.max(4, e.clientY - r.top - wbTip.offsetHeight - 10);
  wbTip.style.left = px + "px"; wbTip.style.top = py + "px";
});
cv.addEventListener("mouseleave", function(){ wbTip.style.display = "none"; });
chkWallbang.addEventListener("change", function(){ if(!this.checked) wbTip.style.display = "none"; draw(); });

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
