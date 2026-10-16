// ---------- шкала высот ----------
var HGT_STOPS = [[-170, [44, 75, 214]], [-60, [34, 166, 201]], [20, [76, 194, 106]], [70, [190, 214, 60]],
                 [110, [240, 205, 55]], [150, [240, 138, 42]], [235, [224, 65, 58]]];
function hgtColor(z, a){
  var S = HGT_STOPS, i = 0;
  if(z <= S[0][0]) i = 0; else if(z >= S[S.length-1][0]) i = S.length - 2; else while(z > S[i+1][0]) i++;
  var t = Math.max(0, Math.min(1, (z - S[i][0]) / (S[i+1][0] - S[i][0])));
  var c = S[i][1].map(function(v, k){ return Math.round(v + (S[i+1][1][k] - v) * t); });
  return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
}

// ---------- кэш путей и поиск участка под курсором ----------
var HGT_C = { src: null, path: {}, grid: {}, ids: [], hatch: null };
function hgtCache(){
  if(HGT_C.src === NAVAREAS) return HGT_C;
  HGT_C.src = NAVAREAS; HGT_C.path = {}; HGT_C.grid = {}; HGT_C.ids = []; HGT_C.poly = {}; HGT_C.c = {};
  NAVAREAS.forEach(function(a){
    var p = new Path2D(), x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, cx = 0, cy = 0;
    a.points.forEach(function(q, i){ if(i) p.lineTo(q.x, q.y); else p.moveTo(q.x, q.y);
      x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); cx += q.x; cy += q.y; });
    p.closePath();
    HGT_C.path[a.id] = p; HGT_C.poly[a.id] = a.points; HGT_C.c[a.id] = {x: cx / a.points.length, y: cy / a.points.length};
    HGT_C.ids.push(a.id);
    for(var gx = Math.floor(x0/64); gx <= Math.floor(x1/64); gx++) for(var gy = Math.floor(y0/64); gy <= Math.floor(y1/64); gy++){
      var k = gx + "," + gy; (HGT_C.grid[k] = HGT_C.grid[k] || []).push(a.id);
    }
  });
  return HGT_C;
}
function hgtAreaAt(x, y){
  var C = hgtCache(), L = C.grid[Math.floor(x/64) + "," + Math.floor(y/64)] || [];
  for(var i = 0; i < L.length; i++) if(pointInPoly(x, y, C.poly[L[i]])) return L[i];
  return null;
}
function hgtLedgeNear(x, y, tol){
  var best = null, bd = tol;
  HEIGHTS.ledges.forEach(function(l){ var d = distToSeg(x, y, l.seg); if(d < bd){ bd = d; best = l; } });
  return best;
}
function hgtHatch(){
  if(HGT_C.hatch) return HGT_C.hatch;
  var c = document.createElement("canvas"); c.width = c.height = 8;
  var g = c.getContext("2d");
  g.strokeStyle = "rgba(15,20,30,0.75)"; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(-2, 10); g.lineTo(10, -2); g.moveTo(-2, 2); g.lineTo(2, -2); g.moveTo(6, 10); g.lineTo(10, 6); g.stroke();
  HGT_C.hatch = ctx.createPattern(c, "repeat");
  return HGT_C.hatch;
}

// ---------- слой «высоты» ----------
var chkHeights = document.getElementById("chkHeights");
var HGT_LEDGE_TXT = { jump: "можно запрыгнуть", climb: "подъём есть (по навмешу)", drop: "только спрыгнуть", none: "не пройти (край ящика / обрыв)" };
function hgtLayerOn(){ return chkHeights.checked || (mapEdOn() && MAPED.tab === "heights"); }
function hgtDraw(){
  if(!hgtLayerOn()) return;
  var C = hgtCache(), S = view.scale;
  // пол по высоте
  C.ids.forEach(function(id){ var h = HGT_AUTO[id]; if(!h) return; ctx.fillStyle = hgtColor(h[1], 0.62); ctx.fill(C.path[id]); });
  // крыто сверху — штриховка
  ctx.save();
  var pat = hgtHatch();
  if(pat.setTransform) pat.setTransform(new DOMMatrix().scale(1/S, 1/S));   // полосы одной толщины на экране при любом масштабе
  ctx.fillStyle = pat;
  if(HEIGHTS.roofs){   // (v321) крыши многоугольниками + участки, крытые правкой владельца
    HEIGHTS.roofs.forEach(function(R){ ctx.beginPath(); R.forEach(function(p, i){ if(i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill(); });
    C.ids.forEach(function(id){ var o = HGT_OWN[id]; if(o && o.cov) ctx.fill(C.path[id]); });
  } else C.ids.forEach(function(id){ var h = hgtInfo(id); if(h && h.cov) ctx.fill(C.path[id]); });
  ctx.restore();
  // уровень над уровнем: участки с уровнем 1 и выше — пурпурным контуром
  ctx.lineWidth = 2/S; ctx.strokeStyle = "rgba(235,80,235,0.95)"; ctx.fillStyle = "rgba(235,80,235,0.28)";
  C.ids.forEach(function(id){ var h = hgtInfo(id); if(h && h.lvl > 0){ ctx.fill(C.path[id]); ctx.stroke(C.path[id]); } });
  HEIGHTS.over.forEach(function(o){
    ctx.beginPath(); o.poly.forEach(function(q, i){ if(i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath();
    ctx.fill(); ctx.stroke();
  });
  // уступы — толстая линия края (пунктир — можно запрыгнуть)
  ctx.lineCap = "round";
  HEIGHTS.ledges.forEach(function(l){
    var s = l.seg;
    ctx.setLineDash(l.kind === "jump" ? [5/S, 4/S] : []);
    ctx.strokeStyle = "rgba(10,10,12,0.95)"; ctx.lineWidth = 5.5/S;
    ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,1)"; ctx.lineWidth = 2.6/S;
    ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.stroke();
  });
  ctx.setLineDash([]); ctx.lineCap = "butt";
  // лестницы и рампы — стрелки «вверх»
  var L = 9, W = 4.5;
  HEIGHTS.arrows.forEach(function(a){
    var x = a[0], y = a[1], dx = a[2], dy = a[3], nx = -dy, ny = dx;
    ctx.beginPath();
    ctx.moveTo(x - dx*L, y - dy*L); ctx.lineTo(x + dx*L, y + dy*L);
    ctx.moveTo(x + dx*L - dx*W + nx*W, y + dy*L - dy*W + ny*W); ctx.lineTo(x + dx*L, y + dy*L); ctx.lineTo(x + dx*L - dx*W - nx*W, y + dy*L - dy*W - ny*W);
    ctx.strokeStyle = "rgba(10,10,12,0.9)"; ctx.lineWidth = Math.max(3.6/S, 2.4); ctx.lineJoin = "round"; ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,1)"; ctx.lineWidth = Math.max(1.6/S, 1.1); ctx.stroke();
  });
  ctx.lineJoin = "miter";
  hgtLegend();
}
function hgtLegend(){
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  // над панелью экономики (она внизу слева), иначе у нижнего края
  var ec = document.getElementById("econ"), by = cv.height - 10;
  if(ec && ec.offsetHeight) by = Math.min(by, ec.getBoundingClientRect().top - cv.getBoundingClientRect().top - 10);
  var x0 = 20, w = 300, h = 12, y0 = by - 102, z0 = -170, z1 = 235;
  ctx.fillStyle = "rgba(10,14,9,0.9)"; ctx.fillRect(x0 - 8, y0 - 26, w + 16, 128);
  ctx.strokeStyle = "rgba(120,140,100,0.6)"; ctx.lineWidth = 1; ctx.strokeRect(x0 - 8.5, y0 - 26.5, w + 17, 129);
  ctx.font = "11px 'IBM Plex Sans',sans-serif"; ctx.fillStyle = "#e8ecdd"; ctx.textAlign = "left";
  ctx.fillText("Высота пола, единицы игры (рост ≈ 72)", x0, y0 - 9);
  for(var i = 0; i < w; i++){ ctx.fillStyle = hgtColor(z0 + (z1 - z0) * i / w, 1); ctx.fillRect(x0 + i, y0, 1, h); }
  ctx.fillStyle = "#c9cfbd"; ctx.textAlign = "center"; ctx.font = "10px 'IBM Plex Mono',monospace";
  for(var z = -150; z <= 200; z += 50){ var x = x0 + (z - z0) / (z1 - z0) * w; ctx.fillRect(x, y0 + h, 1, 4); ctx.fillText(z, x, y0 + h + 14); }
  ctx.textAlign = "left"; ctx.fillStyle = "#9aa58c"; ctx.fillText("низко", x0, y0 + h + 27); ctx.textAlign = "right"; ctx.fillText("высоко", x0 + w, y0 + h + 27);
  // значки
  var y = y0 + h + 44; ctx.textAlign = "left"; ctx.font = "11px 'IBM Plex Sans',sans-serif";
  ctx.fillStyle = hgtColor(60, 1); ctx.fillRect(x0, y - 9, 18, 11); ctx.fillStyle = hgtHatch(); if(ctx.fillStyle.setTransform) ctx.fillStyle.setTransform(new DOMMatrix()); ctx.fillRect(x0, y - 9, 18, 11);
  ctx.fillStyle = "#e8ecdd"; ctx.fillText("крыто сверху", x0 + 24, y);
  ctx.strokeStyle = "#0a0a0c"; ctx.lineWidth = 3.6; ctx.beginPath(); ctx.moveTo(x0 + 120, y - 3); ctx.lineTo(x0 + 140, y - 3); ctx.moveTo(x0 + 135, y - 7); ctx.lineTo(x0 + 140, y - 3); ctx.lineTo(x0 + 135, y + 1); ctx.stroke();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillText("лестница / рампа, вверх", x0 + 146, y);
  y += 18;
  ctx.lineCap = "round";
  [[x0, []], [x0 + 120, [5, 4]]].forEach(function(d){ ctx.setLineDash(d[1]); ctx.strokeStyle = "#0a0a0c"; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.moveTo(d[0], y - 3); ctx.lineTo(d[0] + 18, y - 3); ctx.stroke();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.6; ctx.stroke(); });
  ctx.setLineDash([]); ctx.lineCap = "butt";
  ctx.fillText("уступ", x0 + 24, y); ctx.fillText("уступ, можно запрыгнуть", x0 + 146, y);
  y += 18;
  ctx.fillStyle = "rgba(235,80,235,0.5)"; ctx.fillRect(x0, y - 9, 18, 11); ctx.strokeStyle = "rgba(235,80,235,1)"; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + .5, y - 8.5, 17, 10);
  ctx.fillStyle = "#e8ecdd"; ctx.fillText("уровень над уровнем" + (HEIGHTS.over.length ? "" : " (на "+MAP.name+" нет)"), x0 + 24, y);
  ctx.restore();
}

// ---------- подсказка при наведении ----------
var hgtTip = document.getElementById("hgtTip");
function hgtTipText(x, y){
  var id = hgtAreaAt(x, y), l = hgtLedgeNear(x, y, 6/view.scale);
  if(id === null && !l) return null;
  var t = [];
  if(id !== null){
    var h = hgtInfo(id);
    t.push("<b>Высота пола: " + Math.round(h.z) + "</b> ед. · уровень " + h.lvl + (h.lvl !== h.autoLvl ? " (правка)" : ""));
    t.push("Крыто сверху: " + (h.cov ? "да" : "нет") + (h.cov !== h.autoCov ? " (правка)" : ""));
    if(h.ramp >= 0){ var r = HEIGHTS.ramps[h.ramp]; t.push("Лестница / рампа: подъём " + Math.round(r.z0) + " → " + Math.round(r.z1)); }
    var ov = HEIGHTS.over.filter(function(o){ return o.top === id || o.bottom === id; });
    if(ov.length) t.push(ov[0].top === id ? "Под этим полом есть ещё пол" : "Над этим полом есть ещё пол");
  }
  if(l) t.push("Уступ: перепад " + l.dz + " ед. — " + HGT_LEDGE_TXT[l.kind]);
  if(id !== null) t.push("<span style='opacity:.6'>участок навмеша #" + id + "</span>");
  return t.join("<br>");
}
cv.addEventListener("mousemove", function(e){
  if(!hgtLayerOn()){ hgtTip.style.display = "none"; return; }
  var w = navScreenToWorld(e.clientX, e.clientY), txt = hgtTipText(w.x, w.y);
  if(!txt){ hgtTip.style.display = "none"; return; }
  var r = cv.getBoundingClientRect();
  hgtTip.innerHTML = txt; hgtTip.style.display = "block";
  var px = e.clientX - r.left + 16, py = e.clientY - r.top + 14;
  if(px + hgtTip.offsetWidth > r.width - 4) px = e.clientX - r.left - hgtTip.offsetWidth - 12;
  if(py + hgtTip.offsetHeight > r.height - 4) py = e.clientY - r.top - hgtTip.offsetHeight - 10;
  hgtTip.style.left = px + "px"; hgtTip.style.top = py + "px";
});
cv.addEventListener("mouseleave", function(){ hgtTip.style.display = "none"; });
chkHeights.addEventListener("change", function(){ if(!this.checked) hgtTip.style.display = "none"; });

// =========================== вкладка «высоты» редактора карты ===========================
var MED_H = { tool: "select", sel: [], rect: null };
function medHSel(){ return MED_H.sel.filter(function(id){ return HGT_AUTO[id]; }); }
// поставить поле участкам; если совпало с автоматическим — правка поля убирается
function medHApply(field, val){
  var ids = medHSel(); if(!ids.length) return;
  mapEdDo(function(){
    ids.forEach(function(id){
      var auto = HGT_AUTO[id][field === "lvl" ? 2 : 3], o = HGT_OWN[id] || {};
      if(val === null || val === auto) delete o[field]; else o[field] = val;
      if(o.lvl === undefined && o.cov === undefined) delete HGT_OWN[id]; else HGT_OWN[id] = o;
    });
  });
  mapEdRefresh();
}
function medHAutoSel(){
  var ids = medHSel(); if(!ids.length) return;
  mapEdDo(function(){ ids.forEach(function(id){ delete HGT_OWN[id]; }); });
  mapEdRefresh();
}
var MED_H_HINTS = {
  select: "<b>Выбор.</b><ul><li>Клик по полу — выделить участок навмеша (жёлтый), видна его высота.</li><li>Shift + клик — добавить / убрать участок.</li><li>Правая кнопка — двигать карту.</li><li>Клавиши: 0, 1, 2 — уровень; К — крыто да/нет; Esc — снять выделение.</li></ul>",
  rect: "<b>Рамка.</b><ul><li>Протяни рамку — выделятся все участки, чей центр внутри (с Shift — добавить к выделенным).</li><li>Удобно для целого коридора или зала.</li></ul>"
};
mapEdAddTab({
  id: "heights", label: "высоты", doc: "heights",
  get: function(){ return HGT_OWN; },
  set: function(d){ HGT_OWN = mapEdClone(d); visInvalidate(); },
  code: function(){ return mapEdClone(HGT_OWN_CODE); },
  toDoc: function(d){ return {own: hgtOwnToList(d)}; },
  fromDoc: function(b){
    var L = b && b.own;
    if(!Array.isArray(L)) return null;
    var ok = L.every(function(e){ return e && HGT_AUTO[e.id] && (e.lvl === undefined || (Number.isInteger(e.lvl) && e.lvl >= 0 && e.lvl <= 5)) && (e.cov === undefined || e.cov === 0 || e.cov === 1); });
    return ok ? hgtOwnFromList(L) : null;
  },
  reset: function(){ MED_H.rect = null; },
  render: function(body){
    body.innerHTML = '<div class="med-tools"><button data-t="select">Выбор</button><button data-t="rect">Рамка</button></div>' +
      '<div class="med-hint" id="medHHint"></div>' +
      '<div class="med-info" id="medHInfo"></div>' +
      '<div class="med-lv"><span>Уровень:</span><button data-lv="0">0</button><button data-lv="1">1</button><button data-lv="2">2</button><input id="medHLv" type="number" min="0" max="5" step="1" title="другой уровень (0–5)"></div>' +
      '<div class="med-lv"><span>Крыто сверху:</span><button data-cv="1">да</button><button data-cv="0">нет</button></div>' +
      '<div class="med-row"><button id="medHAuto" title="Убрать правки выделенных участков — вернуть то, что посчитано автоматически">Как посчитано автоматически</button></div>';
    body.querySelectorAll("[data-t]").forEach(function(b){ b.addEventListener("click", function(){ MED_H.tool = b.getAttribute("data-t"); MED_H.rect = null; mapEdRefresh(); }); });
    body.querySelectorAll("[data-lv]").forEach(function(b){ b.addEventListener("click", function(){ medHApply("lvl", +b.getAttribute("data-lv")); }); });
    body.querySelectorAll("[data-cv]").forEach(function(b){ b.addEventListener("click", function(){ medHApply("cov", +b.getAttribute("data-cv")); }); });
    mapEdEl("medHLv").addEventListener("change", function(){ var v = Math.round(+this.value); if(isFinite(v) && v >= 0 && v <= 5) medHApply("lvl", v); });
    mapEdEl("medHAuto").addEventListener("click", medHAutoSel);
  },
  refresh: function(){
    var body = mapEdEl("mapEdBody"); if(!body || !mapEdEl("medHHint")) return;
    body.querySelectorAll("[data-t]").forEach(function(b){ b.className = b.getAttribute("data-t") === MED_H.tool ? "on" : ""; });
    mapEdEl("medHHint").innerHTML = MED_H_HINTS[MED_H.tool];
    var ids = medHSel(), H = ids.map(hgtInfo), nOwn = Object.keys(HGT_OWN).length, txt;
    if(!ids.length) txt = "Ничего не выделено.";
    else if(ids.length === 1){
      var h = H[0];
      txt = "Участок #" + h.id + ": высота " + Math.round(h.z) + " ед. · уровень " + h.lvl + " · крыто: " + (h.cov ? "да" : "нет") +
        (h.own ? " (правка; автоматически: уровень " + h.autoLvl + ", крыто " + (h.autoCov ? "да" : "нет") + ")" : "");
    } else {
      var zs = H.map(function(h){ return h.z; }), cv1 = H.filter(function(h){ return h.cov; }).length;
      var lv = {}; H.forEach(function(h){ lv[h.lvl] = (lv[h.lvl] || 0) + 1; });
      txt = "Выделено участков: " + ids.length + " · высота " + Math.round(Math.min.apply(null, zs)) + "…" + Math.round(Math.max.apply(null, zs)) +
        " ед. · уровень " + Object.keys(lv).map(function(k){ return k + (Object.keys(lv).length > 1 ? " (" + lv[k] + ")" : ""); }).join(", ") +
        " · крыто: " + cv1 + " из " + ids.length;
    }
    mapEdEl("medHInfo").textContent = txt + " Всего правок: " + nOwn + ".";
    var allLv = ids.length && H.every(function(h){ return h.lvl === H[0].lvl; }) ? H[0].lvl : null;
    var allCv = ids.length && H.every(function(h){ return h.cov === H[0].cov; }) ? H[0].cov : null;
    body.querySelectorAll("[data-lv]").forEach(function(b){ b.disabled = !ids.length; b.className = allLv === +b.getAttribute("data-lv") ? "on" : ""; });
    body.querySelectorAll("[data-cv]").forEach(function(b){ b.disabled = !ids.length; b.className = allCv === +b.getAttribute("data-cv") ? "on" : ""; });
    var inp = mapEdEl("medHLv"); inp.disabled = !ids.length; if(document.activeElement !== inp) inp.value = allLv === null ? "" : allLv;
    mapEdEl("medHAuto").disabled = !ids.some(function(id){ return HGT_OWN[id]; });
  },
  down: function(w, e){
    if(MED_H.tool === "rect"){ MED_H.rect = {x0: w.x, y0: w.y, x1: w.x, y1: w.y, add: e.shiftKey}; return true; }
    var id = hgtAreaAt(w.x, w.y);
    if(id === null){ if(!e.shiftKey){ MED_H.sel = []; mapEdRefresh(); } return false; }
    if(e.shiftKey){ var k = MED_H.sel.indexOf(id); if(k >= 0) MED_H.sel.splice(k, 1); else MED_H.sel.push(id); }
    else MED_H.sel = [id];
    mapEdRefresh(); return true;
  },
  move: function(w){ if(MED_H.rect){ MED_H.rect.x1 = w.x; MED_H.rect.y1 = w.y; } },
  up: function(){
    var r = MED_H.rect; if(!r) return; MED_H.rect = null;
    var x0 = Math.min(r.x0, r.x1), x1 = Math.max(r.x0, r.x1), y0 = Math.min(r.y0, r.y1), y1 = Math.max(r.y0, r.y1), C = hgtCache();
    var got = C.ids.filter(function(id){ var c = C.c[id]; return c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1; });
    if(r.add) got.forEach(function(id){ if(MED_H.sel.indexOf(id) < 0) MED_H.sel.push(id); });
    else MED_H.sel = got;
    mapEdRefresh();
  },
  key: function(e){
    if(e.key === "Escape"){ MED_H.sel = []; MED_H.rect = null; mapEdRefresh(); return true; }
    if(!medHSel().length) return false;
    if(/^[0-5]$/.test(e.key)){ medHApply("lvl", +e.key); return true; }
    if(e.code === "KeyK"){ var H = medHSel().map(hgtInfo); medHApply("cov", H.every(function(h){ return h.cov; }) ? 0 : 1); return true; }
    return false;
  },
  draw: function(){
    // сам слой высот рисует hgtDraw (он включён, пока открыта вкладка); здесь — выделение и правки
    var C = hgtCache(), S = view.scale;
    ctx.setLineDash([3/S, 3/S]); ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.4/S;
    Object.keys(HGT_OWN).forEach(function(id){ if(C.path[id]) ctx.stroke(C.path[id]); });
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,215,90,0.35)"; ctx.strokeStyle = "rgba(255,215,90,1)"; ctx.lineWidth = 2/S;
    medHSel().forEach(function(id){ if(C.path[id]){ ctx.fill(C.path[id]); ctx.stroke(C.path[id]); } });
    if(MED_H.rect){ var r = MED_H.rect; ctx.setLineDash([6/S, 4/S]); ctx.strokeStyle = "rgba(120,230,140,1)"; ctx.lineWidth = 2/S;
      ctx.strokeRect(Math.min(r.x0, r.x1), Math.min(r.y0, r.y1), Math.abs(r.x1 - r.x0), Math.abs(r.y1 - r.y0)); ctx.setLineDash([]); }
  }
});

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

