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

