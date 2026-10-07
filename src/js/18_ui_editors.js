// расстояние от точки до отрезка (редакторы: клик рядом с линией)
function segPtDist(px, py, x1, y1, x2, y2){
  var dx = x2-x1, dy = y2-y1, L = dx*dx + dy*dy, t = L ? Math.max(0, Math.min(1, ((px-x1)*dx + (py-y1)*dy)/L)) : 0;
  return Math.hypot(px - (x1 + t*dx), py - (y1 + t*dy));
}
// ---------- render ----------
var cv = document.getElementById("cv"), ctx = cv.getContext("2d");
var wrap = document.getElementById("main");
var img = new Image(); var imgReady=false; var imgFailed=false;
img.onload = function(){ imgReady = true; };
img.onerror = function(){ imgFailed = true; };
// фон вшит прямо в файл (data URI), чтобы страница работала и как отдельный скачанный .html
img.src = "data:image/png;base64,@@PNG:radar.png@@";

var view = {scale:0.4, panX:20, panY:20};
function fit(){
  var r = wrap.getBoundingClientRect();
  cv.width = r.width; cv.height = r.height;
  view.scale = Math.min(r.width/2048, r.height/2048) * 1.08;
  view.panX = (r.width - 2048*view.scale)/2;
  view.panY = (r.height - 2048*view.scale)/2;
}
window.addEventListener("resize", fit);
fit();

var showNavmesh = document.getElementById("chkNavmesh"); // navmesh-полигоны (NAVAREAS) — точная геометрия проходимости
var showPortals = document.getElementById("chkPortals");
var showWalls = document.getElementById("chkWalls");
var showZones = document.getElementById("chkZones");     // именованные зоны из Zone Editor (ZONEMAP.zones) — семантический слой поверх навмеша
var showPoints = document.getElementById("chkPoints");   // тактические точки из Zone Editor (ZONEMAP.points)
var showDanger = document.getElementById("chkDanger");   // hover-проверка предрасчитанной таблицы ZONE_DANGER
var showLos = document.getElementById("chkLos");
var showTracers = document.getElementById("chkTracers");
var showWhy = document.getElementById("chkWhy");
// подпись "что делает": без мозга задач нет — только действие движка и взгляд
function whyText(b){
  var pt = b.planting ? "ставит бомбу" : b.defusing ? "дефузит" : (b.path && b.pathIdx < b.path.length) ? "идёт" : "стоит";
  var lt = b.lookReason === "enemy" ? "видит врага" : b.lookReason === "stub" ? "смотрит вперёд (заглушка)" : "по ходу движения";
  return pt + " · " + lt;
}
var showSound = document.getElementById("chkSound");

// ---------- danger-table hover ----------
var hoverZoneId = null;
function findZoneMapZoneAt(x, y){
  // topmost-drawn-wins, same convention as Zone Editor
  for(var i=ZONEMAP.zones.length-1; i>=0; i--){
    if(pointInPoly(x, y, ZONEMAP.zones[i].points)) return ZONEMAP.zones[i].id;
  }
  return null;
}
cv.addEventListener("mousemove", function(e){
  if(!showDanger.checked){ if(hoverZoneId!==null){ hoverZoneId=null; } return; }
  // don't fight the existing drag modes (wall edit/align/nav align/pan) for the cursor
  if(mapEdOn() || chkAlign.checked) return;
  var w = navScreenToWorld(e.clientX, e.clientY);
  hoverZoneId = findZoneMapZoneAt(w.x, w.y);
});
document.getElementById("btnRecomputeDanger").addEventListener("click", function(){
  computeZoneDanger();
  logEvent("Таблица опасности пересчитана ("+ZONEMAP.zones.length+" зон)", "round");
});

// ---------- navmesh align mode: drag to move, wheel to scale ----------
// The .nav file's own coordinate transform (pos_x/pos_y/scale from the HLTV
// overview .txt) got us close, but it's not pixel-perfect against this
// particular radar image — this lets you nudge the whole navmesh (and
// everything derived from it: walls, portals, pathing) to line up visually,
// live, without re-exporting anything.
var chkAlign = document.getElementById("chkAlign");
var alignPanel = document.getElementById("alignPanel");
var inNavDx = document.getElementById("navDx");
var inNavDy = document.getElementById("navDy");
var inNavScale = document.getElementById("navScale");
var btnNavReset = document.getElementById("btnNavReset");

function updateNavInputs(){
  inNavDx.value = navTransform.dx.toFixed(1);
  inNavDy.value = navTransform.dy.toFixed(1);
  inNavScale.value = navTransform.scale.toFixed(3);
}
updateNavInputs();

var navRebuildTimer = null;
function scheduleNavRebuild(){
  // applyNavTransform() (cheap, just moves points) already ran and the
  // canvas already reflects it next frame — this debounce only delays the
  // EXPENSIVE part (graph + both wall sets, ~2000 areas), so dragging/
  // scrolling stays smooth and the pathing/walls "catch up" a moment after
  // you stop adjusting.
  if(navRebuildTimer) clearTimeout(navRebuildTimer);
  navRebuildTimer = setTimeout(function(){ navRebuildTimer=null; rebuildNav(); }, 220);
}

function navScreenToWorld(clientX, clientY){
  var r = cv.getBoundingClientRect();
  return { x: (clientX-r.left-view.panX)/view.scale, y: (clientY-r.top-view.panY)/view.scale };
}

var navDragging = false, navDragStart = null, navDragOrig = null;
var camDragging = false, camDragStart = null, camDragOrig = null;

// допуски попадания мышью (редактор зон)
var HIT_TOL_PX = 8;   // screen px, converted to world units by /view.scale below
var HANDLE_TOL_PX = 10;
var VERTEX_TOL_PX = 10;
function distToSeg(px,py, s){
  var x1=s[0],y1=s[1],x2=s[2],y2=s[3];
  var dx=x2-x1, dy=y2-y1;
  var len2 = dx*dx+dy*dy;
  var t = len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((px-x1)*dx+(py-y1)*dy)/len2));
  var cx = x1+t*dx, cy = y1+t*dy;
  return Math.hypot(px-cx, py-cy);
}

var chkNavWarp = document.getElementById("chkNavWarp");
var navWarpPanel = document.getElementById("navWarpPanel");
var navWarpHint = document.getElementById("navWarpHint");
var navWarpCountEl = document.getElementById("navWarpCount");
var btnNavWarpUndo = document.getElementById("btnNavWarpUndo");
var btnNavWarpClear = document.getElementById("btnNavWarpClear");
var navWarpPending = null; // {x,y} — выбранная сырая точка navmesh, ждём клика "куда её надо"
var NAV_VERTEX_PICK_TOL = 22; // px (в мировых единицах, после деления на view.scale ниже)

function updateNavWarpHint(){
  navWarpCountEl.textContent = navAnchors.length;
  navWarpHint.textContent = navWarpPending
    ? "клик 2: куда эта точка должна встать на самом деле"
    : "жёлтая линия — реальная граница навмеша (должна лежать на стене) · клик 1: точка на ней · минимум 3, в т.ч. у спавнов и дверных проёмов";
}
updateNavWarpHint();

// ближайшая СЫРАЯ (NAVAREAS_RAW) вершина к точке клика — ищем по текущему
// отображению (navMapPoint), но возвращаем raw-координаты, т.к. именно они
// остаются стабильным "ключом" точки независимо от будущих правок warp'а
// only the perimeter's own vertices — an anchor pinned to an interior
// vertex (just a triangulation diagonal, means nothing physically) would be
// easy to grab by accident and wouldn't correspond to anything on the wall
// layer anyway, so restrict picking to NAV_BOUNDARY_SEGS_RAW's endpoints.
var NAV_BOUNDARY_VERTS_RAW = (function(){
  var seen = {}, out = [];
  NAV_BOUNDARY_SEGS_RAW.forEach(function(s){
    [[s.x1,s.y1],[s.x2,s.y2]].forEach(function(p){
      var k = Math.round(p[0]*4)+","+Math.round(p[1]*4);
      if(!seen[k]){ seen[k]=true; out.push({x:p[0], y:p[1]}); }
    });
  });
  return out;
})();
function findRawNavVertexNear(wx, wy){
  var tol = NAV_VERTEX_PICK_TOL / view.scale;
  var best = null, bestD = tol;
  NAV_BOUNDARY_VERTS_RAW.forEach(function(p){
    var mp = navMapPoint(p.x, p.y);
    var d = Math.hypot(mp.x-wx, mp.y-wy);
    if(d < bestD){ bestD = d; best = {x:p.x, y:p.y}; }
  });
  return best;
}

function applyNavWarpChange(){
  saveNavAnchors();
  rebuildNavWarp();
  updateNavWarpHint();
  rebuildNav();
}
btnNavWarpUndo.addEventListener("click", function(){
  navAnchors.pop();
  navWarpPending = null;
  applyNavWarpChange();
});
btnNavWarpClear.addEventListener("click", function(){
  navAnchors.length = 0;
  navWarpPending = null;
  applyNavWarpChange();
});

// ---------- zone editor: draw/edit spawn & site zones directly here,
// Photoshop-style like the wall editor — click empty space to start a new
// zone (click adds a vertex, "Готово" closes it, min 3 points), click an
// existing zone to select it (drag body to move, corner handle/wheel to
// scale, "перо" toggle to edit individual points same as walls). ----------
var chkZoneEdit = document.getElementById("chkZoneEdit");
var zoneEditPanel = document.getElementById("zoneEditPanel");
var zoneEditHint = document.getElementById("zoneEditHint");
var zoneKindSelect = document.getElementById("zoneKindSelect");
var zoneNameInput = document.getElementById("zoneNameInput");
var btnZoneFinish = document.getElementById("btnZoneFinish");
var chkZoneVertexEdit = document.getElementById("chkZoneVertexEdit");
var zoneEditCountEl = document.getElementById("zoneEditCount");
var btnZoneDelete = document.getElementById("btnZoneDelete");
var selectedZoneId = null;
var zoneDrawing = false, zoneDrawPts = [], zoneDrawCur = null;
var zoneMoving = false, zoneMoveStart = null, zoneMoveOrig = null;
var zoneScaling = false, zoneScaleCenter = null, zoneScaleBaseDist = null;
var zoneVertexDragging = false, zoneVertexIdx = -1;

function updateZoneEditCount(){
  zoneEditCountEl.textContent = USER_ZONES.length;
  btnZoneDelete.disabled = selectedZoneId===null;
}
updateZoneEditCount();
zoneKindSelect.addEventListener("change", function(){
  zoneNameInput.style.display = zoneKindSelect.value === "custom" ? "block" : "none";
});
function finishZoneDraw(){
  if(zoneDrawPts.length < 3){ zoneDrawing = false; zoneDrawPts = []; btnZoneFinish.disabled = true; return; }
  var kind = zoneKindSelect.value;
  USER_ZONES.push({
    id: "uz"+Date.now()+Math.floor(Math.random()*1000),
    name: kind === "custom" ? (zoneNameInput.value||"точка") : null,
    kind: kind,
    basePoints: zoneDrawPts.slice(), closed: true, dx:0, dy:0, scale:1
  });
  zoneDrawing = false; zoneDrawPts = []; btnZoneFinish.disabled = true;
  applyUserZones(); saveUserZonesDebounced(); updateZoneEditCount();
}
btnZoneFinish.addEventListener("click", finishZoneDraw);
btnZoneDelete.addEventListener("click", function(){
  if(selectedZoneId===null) return;
  USER_ZONES.splice(selectedZoneId,1);
  selectedZoneId = null;
  applyUserZones(); saveUserZonesDebounced(); updateZoneEditCount();
});
function findZoneNear(wx,wy){
  var tol = HIT_TOL_PX/view.scale;
  var best=-1, bestD=tol;
  USER_ZONES.forEach(function(z,i){
    var pts = zoneObjAbsPoints(z);
    for(var k=0;k<pts.length;k++){
      var a=pts[k], b=pts[(k+1)%pts.length];
      var d = distToSeg(wx,wy,[a.x,a.y,b.x,b.y]);
      if(d<bestD){ bestD=d; best=i; }
    }
  });
  return best;
}
function findZoneVertexNear(obj, wx, wy){
  var tol = VERTEX_TOL_PX/view.scale;
  var pts = zoneObjAbsPoints(obj);
  var best=-1, bestD=tol;
  pts.forEach(function(p,i){ var d=Math.hypot(p.x-wx,p.y-wy); if(d<bestD){ bestD=d; best=i; } });
  return best;
}

var chkZoneAlign = document.getElementById("chkZoneAlign");
var zoneAlignPanel = document.getElementById("zoneAlignPanel");
var inZlDx = document.getElementById("zlDx"), inZlDy = document.getElementById("zlDy"), inZlScale = document.getElementById("zlScale");
var zlDragging = false, zlDragStart = null, zlDragOrig = null;
function updateZlInputs(){ inZlDx.value = zoneLayer.dx.toFixed(1); inZlDy.value = zoneLayer.dy.toFixed(1); inZlScale.value = zoneLayer.scale.toFixed(3); }
updateZlInputs();
[inZlDx, inZlDy, inZlScale].forEach(function(el){
  el.addEventListener("change", function(){
    zoneLayer.dx = parseFloat(inZlDx.value)||0; zoneLayer.dy = parseFloat(inZlDy.value)||0; zoneLayer.scale = parseFloat(inZlScale.value)||1;
    applyZoneLayer(true);
  });
});
document.getElementById("btnZlReset").addEventListener("click", function(){
  zoneLayer.dx = ZONE_LAYER_BASELINE.dx; zoneLayer.dy = ZONE_LAYER_BASELINE.dy; zoneLayer.scale = ZONE_LAYER_BASELINE.scale; updateZlInputs(); applyZoneLayer(true);
});
function setMode(which){
  // exactly one of these (or none) is active at a time
  if(which !== "align" && chkAlign.checked){ chkAlign.checked = false; }
  if(which !== "navWarp" && chkNavWarp.checked){ chkNavWarp.checked = false; }
  if(which !== "mapEdit" && mapEdOn()) mapEdSetOn(false);
  if(which !== "zoneEdit" && chkZoneEdit.checked){ chkZoneEdit.checked = false; }
  if(which !== "zoneAlign" && chkZoneAlign.checked){ chkZoneAlign.checked = false; }
  zoneAlignPanel.style.display = chkZoneAlign.checked ? "block" : "none";
  alignPanel.style.display = chkAlign.checked ? "block" : "none";
  navWarpPanel.style.display = chkNavWarp.checked ? "block" : "none";
  zoneEditPanel.style.display = chkZoneEdit.checked ? "block" : "none";
  if(!chkZoneEdit.checked){ zoneDrawing=false; zoneDrawPts=[]; btnZoneFinish.disabled=true; selectedZoneId=null; updateZoneEditCount(); }
  cv.style.cursor = chkAlign.checked ? "move" : chkNavWarp.checked ? "crosshair" : mapEdOn() ? "crosshair" : chkZoneEdit.checked ? "default" : chkZoneAlign.checked ? "move" : "";
}
chkZoneEdit.addEventListener("change", function(){ if(chkZoneEdit.checked) setMode("zoneEdit"); else setMode(null); });
chkZoneAlign.addEventListener("change", function(){ if(chkZoneAlign.checked) setMode("zoneAlign"); else setMode(null); });
chkAlign.addEventListener("change", function(){ if(chkAlign.checked) setMode("align"); else setMode(null); });
chkNavWarp.addEventListener("change", function(){
  if(chkNavWarp.checked) setMode("navWarp"); else setMode(null);
  navWarpPending = null;
  updateNavWarpHint();
});
cv.addEventListener("contextmenu", function(e){ e.preventDefault(); });
// ---- редактор лайнапов ----
var chkLineups = document.getElementById("chkLineups"), lineupPanel = document.getElementById("lineupPanel");
var luPending = null, luHover = null;
var LU_COL = {smoke:"rgba(200,205,210,0.95)", flash:"rgba(255,240,150,0.95)", molly:"rgba(255,140,60,0.95)", he:"rgba(150,230,120,0.95)"};
function drawLineups(){
  var show = chkLineups && chkLineups.checked; if(!show) return;
  ctx.save();
  allLineups().forEach(function(L, i){
    var col = LU_COL[L.type] || "#fff", isSel = typeof luSel !== "undefined" && luSel !== null && USER_LINEUPS[luSel] === L;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = (isSel ? 3 : 1.6)/view.scale;
    if(isSel){ var hs = 7/view.scale; ctx.save(); ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 2/view.scale;
      ctx.strokeRect(L.from.x-hs, L.from.y-hs, hs*2, hs*2); ctx.strokeRect(L.to.x-hs, L.to.y-hs, hs*2, hs*2); ctx.restore(); }
    ctx.setLineDash([6/view.scale, 5/view.scale]);
    ctx.beginPath(); ctx.moveTo(L.from.x, L.from.y); ctx.lineTo(L.to.x, L.to.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(L.from.x, L.from.y, 5/view.scale, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(L.to.x, L.to.y, (L.type === "smoke" ? 22 : 12)/view.scale, 0, 7); ctx.stroke();
    ctx.font = (10/view.scale)+"px 'IBM Plex Mono',monospace"; ctx.textAlign = "center";
    ctx.fillText((L.team)+" · "+(L.name||LU_TYPE[L.type]), L.to.x, L.to.y - 16/view.scale);
  });
  if(luPending){ ctx.fillStyle = "#ffd76a"; ctx.beginPath(); ctx.arc(luPending.x, luPending.y, 6/view.scale, 0, 7); ctx.fill();
    if(luHover){ ctx.strokeStyle = "#ffd76a"; ctx.setLineDash([4/view.scale,4/view.scale]); ctx.beginPath(); ctx.moveTo(luPending.x, luPending.y); ctx.lineTo(luHover.x, luHover.y); ctx.stroke(); ctx.setLineDash([]); } }
  ctx.restore();
}
function esc2(t){ return String(t).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
var luSel = null, luDrag = null;
function luFieldsFrom(L){
  document.getElementById("luTeam").value = L.team; document.getElementById("luType").value = L.type;
  document.getElementById("luTrigger").value = L.trigger; document.getElementById("luSite").value = L.site;
  document.getElementById("luName").value = L.name || "";
}
function selectLineup(i){ luSel = i; luPending = null; if(i !== null && USER_LINEUPS[i]) luFieldsFrom(USER_LINEUPS[i]); refreshLineupList(); draw(); }
// поля панели правят выбранный лайнап
["luTeam","luType","luTrigger","luSite","luName"].forEach(function(id){
  var el = document.getElementById(id);
  el.addEventListener(id === "luName" ? "input" : "change", function(){
    if(luSel === null || !USER_LINEUPS[luSel]) return;
    var L = USER_LINEUPS[luSel], f = {luTeam:"team", luType:"type", luTrigger:"trigger", luSite:"site", luName:"name"}[id];
    L[f] = id === "luName" ? el.value.trim().slice(0,40) : el.value;
    saveLineups(); if(id !== "luName") refreshLineupList(); draw();
  });
  el.addEventListener("keydown", function(e){ e.stopPropagation(); });
});
function refreshLineupList(){
  var el = document.getElementById("lineupList"), h = "";
  USER_LINEUPS.forEach(function(L, i){
    var sel = i === luSel;
    h += '<div data-sel="'+i+'" style="display:flex;justify-content:space-between;gap:6px;border-top:1px solid var(--line);padding:3px 4px;cursor:pointer;'+(sel?'background:rgba(255,215,106,0.12);border-left:2px solid #ffd76a;':'')+'"><span>'+L.team+' · '+LU_TYPE[L.type]+' · '+LU_TRIG[L.trigger]+(L.site!=="any"?" "+L.site:"")+
'<br><span style="color:var(--text-dim)">'+esc2(L.name||"")+'</span></span><button data-lu="'+i+'" title="удалить" style="height:22px;">✕</button></div>';
  });
  if(!USER_LINEUPS.length) h = '<div style="color:var(--text-dim)">пока нет своих лайнапов</div>';
  el.innerHTML = h;
  Array.prototype.forEach.call(el.querySelectorAll("button[data-lu]"), function(btn){
    btn.addEventListener("click", function(ev){ ev.stopPropagation(); var i = +btn.getAttribute("data-lu"); USER_LINEUPS.splice(i, 1); if(luSel === i) luSel = null; else if(luSel > i) luSel--; saveLineups(); refreshLineupList(); draw(); });
  });
  Array.prototype.forEach.call(el.querySelectorAll("div[data-sel]"), function(row){
    row.addEventListener("click", function(){ var i = +row.getAttribute("data-sel"); selectLineup(luSel === i ? null : i); });
  });
  document.getElementById("lineupHint").textContent = luSel !== null ? "правка: тащи точки ● (откуда) и ○ (куда) · поля ниже меняют лайнап · клик мимо — снять выбор"
    : luPending ? "клик 2 — куда летит (Esc — отмена)" : "клик 1 — откуда кидают · клик 2 — куда летит · клик по своему лайнапу — выбрать и править";
}
chkLineups.addEventListener("change", function(){ lineupPanel.style.display = chkLineups.checked ? "block" : "none"; luPending = null; luSel = null; refreshLineupList(); draw(); });
document.addEventListener("keydown", function(e){ if(e.key === "Escape" && (luPending || luSel !== null)){ luPending = null; luSel = null; refreshLineupList(); draw(); } });
cv.addEventListener("mousemove", function(e){
  if(!chkLineups.checked) return;
  var w = navScreenToWorld(e.clientX, e.clientY);
  if(luDrag && luSel !== null && USER_LINEUPS[luSel]){ USER_LINEUPS[luSel][luDrag] = {x:Math.round(w.x*10)/10, y:Math.round(w.y*10)/10}; draw(); return; }
  if(luPending){ luHover = w; draw(); }
});
window.addEventListener("mouseup", function(){ if(luDrag){ luDrag = null; saveLineups(); } });
function lineupHit(w){
  var tol = 10/view.scale, best = null, bd = tol;
  USER_LINEUPS.forEach(function(L, i){
    var d = Math.min(Math.hypot(L.from.x-w.x, L.from.y-w.y), Math.hypot(L.to.x-w.x, L.to.y-w.y), segPtDist(w.x, w.y, L.from.x, L.from.y, L.to.x, L.to.y));
    if(d < bd){ bd = d; best = i; }
  });
  return best;
}
function lineupClick(e){
  var w = navScreenToWorld(e.clientX, e.clientY), tol = 12/view.scale;
  if(luSel !== null && USER_LINEUPS[luSel]){
    var L0 = USER_LINEUPS[luSel];
    if(Math.hypot(L0.from.x-w.x, L0.from.y-w.y) < tol){ luDrag = "from"; return; }
    if(Math.hypot(L0.to.x-w.x, L0.to.y-w.y) < tol){ luDrag = "to"; return; }
  }
  if(!luPending){
    var hit = lineupHit(w);
    if(hit !== null){ selectLineup(hit); return; }
    if(luSel !== null){ selectLineup(null); return; }
  }
  if(!luPending){ luPending = {x:w.x, y:w.y}; refreshLineupList(); draw(); return; }
  var L = {id:"lu"+Date.now().toString(36)+Math.floor(Math.random()*1000), team:document.getElementById("luTeam").value,
    type:document.getElementById("luType").value, trigger:document.getElementById("luTrigger").value, site:document.getElementById("luSite").value,
    name:document.getElementById("luName").value.trim().slice(0,40), from:{x:Math.round(luPending.x*10)/10, y:Math.round(luPending.y*10)/10}, to:{x:Math.round(w.x*10)/10, y:Math.round(w.y*10)/10}};
  USER_LINEUPS.push(L); saveLineups(); luPending = null; luHover = null; selectLineup(USER_LINEUPS.length-1);
}
var zoneNameSel = null;
var zsDrag = -1, zsRebuildTimer = null;
function zoneShapeOn(){ var c = document.getElementById("chkZoneShape"); return c && c.checked && zoneNameSel; }
function saveZoneShape(id){
  var z = zoneById(id); if(!z) return;
  ZONE_SHAPES[id] = z.points.map(function(p){ var r = zlInv(p.x, p.y); return {x:Math.round(r.x*10)/10, y:Math.round(r.y*10)/10}; });
  try{ localStorage.setItem(ZONE_SHAPES_KEY, JSON.stringify(ZONE_SHAPES)); }catch(e){}
  rebuildAfterZoneShape();
}
function rebuildAfterZoneShape(){
  if(zsRebuildTimer) clearTimeout(zsRebuildTimer);
  zsRebuildTimer = setTimeout(function(){ zsRebuildTimer = null; applyZoneLayer(true); draw(); }, 150);
}
document.getElementById("chkZoneShape").addEventListener("change", function(){
  document.getElementById("zoneShapeHint").style.display = this.checked ? "block" : "none"; draw();
});
document.getElementById("zoneShapeReset").addEventListener("click", function(e){
  e.preventDefault(); if(!zoneNameSel) return;
  delete ZONE_SHAPES[zoneNameSel];
  try{ localStorage.setItem(ZONE_SHAPES_KEY, JSON.stringify(ZONE_SHAPES)); }catch(e2){}
  applyZoneLayerToData(); rebuildAfterZoneShape(); draw();
});
// ручки выбранной зоны
function drawZoneShapeHandles(){
  if(!zoneShapeOn()) return;
  var z = zoneById(zoneNameSel); if(!z) return;
  ctx.save(); ctx.fillStyle = "#ffd76a"; ctx.strokeStyle = "#1a1a10"; ctx.lineWidth = 1/view.scale;
  var hs = 4/view.scale;
  z.points.forEach(function(p){ ctx.fillRect(p.x-hs, p.y-hs, hs*2, hs*2); ctx.strokeRect(p.x-hs, p.y-hs, hs*2, hs*2); });
  ctx.restore();
}
function zoneShapeMouseDown(e){
  var z = zoneById(zoneNameSel); if(!z) return false;
  var w = navScreenToWorld(e.clientX, e.clientY), tol = 8/view.scale;
  for(var i=0;i<z.points.length;i++){
    if(Math.hypot(z.points[i].x-w.x, z.points[i].y-w.y) < tol){
      if(e.shiftKey){ if(z.points.length > 3){ z.points.splice(i,1); saveZoneShape(z.id); draw(); } return true; }
      zsDrag = i; return true;
    }
  }
  for(var j=0;j<z.points.length;j++){
    var a = z.points[j], b2 = z.points[(j+1)%z.points.length];
    if(segPtDist(w.x, w.y, a.x, a.y, b2.x, b2.y) < tol){ z.points.splice(j+1, 0, {x:w.x, y:w.y}); zsDrag = j+1; draw(); return true; }
  }
  return false;
}
cv.addEventListener("mousemove", function(e){
  if(zsDrag < 0 || !zoneNameSel) return;
  var z = zoneById(zoneNameSel); if(!z || !z.points[zsDrag]) return;
  var w = navScreenToWorld(e.clientX, e.clientY); z.points[zsDrag].x = w.x; z.points[zsDrag].y = w.y; draw();
});
window.addEventListener("mouseup", function(){ if(zsDrag >= 0){ zsDrag = -1; if(zoneNameSel) saveZoneShape(zoneNameSel); } });
var zoneNamePanel = document.getElementById("zoneNamePanel"), zoneNameInput2 = document.getElementById("zoneNameInput2");
function refreshZoneNamePanel(){
  document.getElementById("zoneNameId").textContent = zoneNameSel || "—";
  document.getElementById("zoneNameTotal").textContent = ZONEMAP.zones.length;
  document.getElementById("zoneNameNamed").textContent = ZONEMAP.zones.filter(function(z){ return ZONE_NAMES[z.id]; }).length;
}
function openZoneName(id){
  zoneNameSel = id; zoneNamePanel.style.display = "block";
  zoneNameInput2.value = ZONE_NAMES[id] || ""; zoneNameInput2.placeholder = zoneUserName(id) || "например: Кейв, Донат, Мейн B";
  refreshZoneNamePanel(); setTimeout(function(){ zoneNameInput2.focus(); zoneNameInput2.select(); }, 0); draw();
}
function saveZoneNameFromInput(){
  if(!zoneNameSel) return;
  var v = zoneNameInput2.value.trim().slice(0,32);
  if(v) ZONE_NAMES[zoneNameSel] = v; else delete ZONE_NAMES[zoneNameSel];
  saveZoneNames(); refreshZoneNamePanel(); draw();
}
document.getElementById("btnZoneNameSave").addEventListener("click", saveZoneNameFromInput);
document.getElementById("btnZoneNameReset").addEventListener("click", function(){ if(!zoneNameSel) return; delete ZONE_NAMES[zoneNameSel]; zoneNameInput2.value = ""; saveZoneNames(); refreshZoneNamePanel(); draw(); });
document.getElementById("btnZoneNameClose").addEventListener("click", function(){ zoneNamePanel.style.display = "none"; zoneNameSel = null; draw(); });
zoneNameInput2.addEventListener("keydown", function(e){ if(e.key === "Enter"){ saveZoneNameFromInput(); e.preventDefault(); } e.stopPropagation(); });
cv.addEventListener("mousedown", function(e){
  if(e.button === 0 && chkLineups.checked){ lineupClick(e); e.preventDefault(); return; }
  // слой «зоны» без других режимов редактирования: клик по зоне — её название
  if(e.button === 0 && showZones.checked && !chkNavWarp.checked && !chkZoneEdit.checked && !mapEdOn() &&
     !chkAlign.checked && !chkZoneAlign.checked){
    if(zoneShapeOn() && zoneShapeMouseDown(e)){ e.preventDefault(); return; }
    var zw = navScreenToWorld(e.clientX, e.clientY), zid = zoneIdAt(zw.x, zw.y);
    if(zid){ openZoneName(zid); e.preventDefault(); return; }
  }
  if(e.button === 2){
    // ПКМ всегда двигает камеру, в любом режиме (перо/выравнивание/обычный) —
    // не задевает ни вершины, ни масштаб объекта, ни рисование новой стены,
    // так что можно спокойно панорамировать, не боясь случайно что-то сдвинуть
    camDragging = true;
    camDragStart = {x: e.clientX, y: e.clientY};
    camDragOrig = {panX: view.panX, panY: view.panY};
    e.preventDefault();
    return;
  }
  if(chkNavWarp.checked){
    var nw = navScreenToWorld(e.clientX, e.clientY);
    if(!navWarpPending){
      var rv = findRawNavVertexNear(nw.x, nw.y);
      if(rv) navWarpPending = rv;
    } else {
      navAnchors.push({ sx:navWarpPending.x, sy:navWarpPending.y, tx:nw.x, ty:nw.y });
      navWarpPending = null;
      applyNavWarpChange();
    }
    updateNavWarpHint();
    e.preventDefault();
    return;
  }
  if(chkZoneEdit.checked && chkZoneVertexEdit.checked){
    // pen mode for zones — same idea as the wall pen tool: only selects and
    // edits individual points of the already-selected zone, never moves/
    // scales the whole thing and never starts a new one
    var zv = navScreenToWorld(e.clientX, e.clientY);
    if(selectedZoneId !== null){
      var vz = USER_ZONES[selectedZoneId];
      var zvi = findZoneVertexNear(vz, zv.x, zv.y);
      if(zvi >= 0){
        var zCurPts = zoneObjAbsPoints(vz);
        if(e.shiftKey){
          if(zCurPts.length > 3){ zoneBakeObjectTransform(vz); vz.basePoints.splice(zvi,1); applyUserZones(); saveUserZonesDebounced(); }
        } else {
          zoneBakeObjectTransform(vz);
          zoneVertexDragging = true; zoneVertexIdx = zvi;
        }
        e.preventDefault();
        return;
      }
      var zEdgePts = zoneObjAbsPoints(vz);
      var zInsTol = HIT_TOL_PX/view.scale;
      for(var zek=0; zek<zEdgePts.length; zek++){
        var zea=zEdgePts[zek], zeb=zEdgePts[(zek+1)%zEdgePts.length];
        if(distToSeg(zv.x,zv.y,[zea.x,zea.y,zeb.x,zeb.y]) < zInsTol){
          zoneBakeObjectTransform(vz);
          vz.basePoints.splice(zek+1,0,{x:zv.x,y:zv.y});
          applyUserZones(); saveUserZonesDebounced();
          zoneVertexDragging = true; zoneVertexIdx = zek+1;
          e.preventDefault();
          return;
        }
      }
    }
    var zhit = findZoneNear(zv.x, zv.y);
    selectedZoneId = zhit >= 0 ? zhit : null;
    updateZoneEditCount();
    e.preventDefault();
    return;
  }
  if(chkZoneEdit.checked){
    var zw = navScreenToWorld(e.clientX, e.clientY);
    if(zoneDrawing){
      // still placing the new zone's vertices — every click (that isn't on
      // the existing polyline, handled by the "Готово" button) adds a point
      zoneDrawPts.push({x:zw.x, y:zw.y});
      btnZoneFinish.disabled = zoneDrawPts.length < 3;
      e.preventDefault();
      return;
    }
    if(selectedZoneId !== null){
      var zh = zoneObjHandlePos(USER_ZONES[selectedZoneId]);
      if(Math.hypot(zw.x-zh.x, zw.y-zh.y) < HANDLE_TOL_PX/view.scale){
        zoneScaling = true;
        zoneScaleCenter = zoneObjCentroid(USER_ZONES[selectedZoneId]);
        zoneScaleBaseDist = Math.max(1, Math.hypot(zh.x-zoneScaleCenter.x, zh.y-zoneScaleCenter.y)) / USER_ZONES[selectedZoneId].scale;
        e.preventDefault();
        return;
      }
    }
    var zHit = findZoneNear(zw.x, zw.y);
    if(zHit >= 0){
      selectedZoneId = zHit;
      updateZoneEditCount();
      zoneMoving = true;
      zoneMoveStart = zw;
      zoneMoveOrig = {dx:USER_ZONES[zHit].dx, dy:USER_ZONES[zHit].dy};
    } else {
      selectedZoneId = null;
      updateZoneEditCount();
      zoneDrawing = true;
      zoneDrawPts = [{x:zw.x, y:zw.y}];
      zoneDrawCur = zw;
      btnZoneFinish.disabled = true;
    }
    e.preventDefault();
    return;
  }
  if(chkZoneAlign.checked){
    zlDragging = true;
    zlDragStart = navScreenToWorld(e.clientX, e.clientY);
    zlDragOrig = {dx:zoneLayer.dx, dy:zoneLayer.dy};
  } else if(chkAlign.checked){
    navDragging = true;
    navDragStart = navScreenToWorld(e.clientX, e.clientY);
    navDragOrig = {dx:navTransform.dx, dy:navTransform.dy};
  } else {
    // normal mode: drag pans the camera (doesn't touch geometry)
    camDragging = true;
    camDragStart = {x: e.clientX, y: e.clientY};
    camDragOrig = {panX: view.panX, panY: view.panY};
  }
  e.preventDefault();
});
window.addEventListener("mousemove", function(e){
  if(zoneDrawing){
    zoneDrawCur = navScreenToWorld(e.clientX, e.clientY);
  } else if(zoneScaling){
    var zws = navScreenToWorld(e.clientX, e.clientY);
    var zds = Math.hypot(zws.x-zoneScaleCenter.x, zws.y-zoneScaleCenter.y);
    USER_ZONES[selectedZoneId].scale = Math.max(0.1, Math.min(10, zds/zoneScaleBaseDist));
    applyUserZones(); saveUserZonesDebounced();
  } else if(zoneMoving){
    var zwm = navScreenToWorld(e.clientX, e.clientY);
    USER_ZONES[selectedZoneId].dx = zoneMoveOrig.dx + (zwm.x-zoneMoveStart.x);
    USER_ZONES[selectedZoneId].dy = zoneMoveOrig.dy + (zwm.y-zoneMoveStart.y);
    applyUserZones(); saveUserZonesDebounced();
  } else if(zoneVertexDragging){
    var zwv = navScreenToWorld(e.clientX, e.clientY);
    USER_ZONES[selectedZoneId].basePoints[zoneVertexIdx] = {x:zwv.x, y:zwv.y};
    applyUserZones(); saveUserZonesDebounced();
  } else if(zlDragging){
    var zc = navScreenToWorld(e.clientX, e.clientY);
    zoneLayer.dx = zlDragOrig.dx + (zc.x - zlDragStart.x);
    zoneLayer.dy = zlDragOrig.dy + (zc.y - zlDragStart.y);
    applyZoneLayer(false); updateZlInputs();
  } else if(navDragging){
    var cur = navScreenToWorld(e.clientX, e.clientY);
    navTransform.dx = navDragOrig.dx + (cur.x - navDragStart.x);
    navTransform.dy = navDragOrig.dy + (cur.y - navDragStart.y);
    applyNavTransform();
    updateNavInputs();
    scheduleNavRebuild();
  } else if(camDragging){
    view.panX = camDragOrig.panX + (e.clientX - camDragStart.x);
    view.panY = camDragOrig.panY + (e.clientY - camDragStart.y);
  }
});
window.addEventListener("mouseup", function(e){
  if(zlDragging){ zlDragging = false; applyZoneLayer(true); }
  zoneMoving = false; zoneScaling = false;
  zoneVertexDragging = false; zoneVertexIdx = -1;
  if(navDragging){
    navDragging = false;
    if(navRebuildTimer){ clearTimeout(navRebuildTimer); navRebuildTimer=null; }
    rebuildNav();
  }
  camDragging = false;
});
cv.addEventListener("wheel", function(e){
  e.preventDefault();
  if(chkZoneEdit.checked && selectedZoneId !== null){
    var zwfac = e.deltaY < 0 ? 1.06 : (1/1.06);
    var zobj = USER_ZONES[selectedZoneId];
    zobj.scale = Math.max(0.1, Math.min(10, zobj.scale*zwfac));
    applyUserZones(); saveUserZonesDebounced();
  } else if(chkZoneAlign.checked){
    var zf2 = e.deltaY < 0 ? 1.03 : (1/1.03);
    zoneLayer.scale = Math.max(0.3, Math.min(3, zoneLayer.scale*zf2));
    applyZoneLayer(false); updateZlInputs();
  } else if(chkAlign.checked){
    // align mode: wheel resizes the navmesh itself relative to the image
    var factor = e.deltaY < 0 ? 1.04 : (1/1.04);
    navTransform.scale = Math.max(0.5, Math.min(2, navTransform.scale*factor));
    applyNavTransform();
    updateNavInputs();
    scheduleNavRebuild();
  } else {
    // normal mode: wheel just zooms the camera view, centered on the cursor
    // (doesn't touch navTransform/geometry — purely how close you're looking)
    var r = cv.getBoundingClientRect();
    var mx = e.clientX - r.left, my = e.clientY - r.top;
    var wx = (mx - view.panX) / view.scale, wy = (my - view.panY) / view.scale;
    var zf = e.deltaY < 0 ? 1.08 : (1/1.08);
    view.scale = Math.max(0.1, Math.min(4, view.scale * zf));
    view.panX = mx - wx * view.scale;
    view.panY = my - wy * view.scale;
  }
}, {passive:false});

[inNavDx,inNavDy,inNavScale].forEach(function(el){
  el.addEventListener("change", function(){
    navTransform.dx = parseFloat(inNavDx.value)||0;
    navTransform.dy = parseFloat(inNavDy.value)||0;
    navTransform.scale = parseFloat(inNavScale.value)||1;
    applyNavTransform();
    rebuildNav();
  });
});
btnNavReset.addEventListener("click", function(){
  navTransform.dx = 0; navTransform.dy = 0; navTransform.scale = 1;
  applyNavTransform();
  updateNavInputs();
  rebuildNav();
});

// warn banner: unreachable zones / missing portal geometry, computed once at load
(function(){
  var connected = {};
  ZONEMAP.portals.forEach(function(p){ connected[p.a]=true; connected[p.b]=true; });
  var orphans = ZONEMAP.zones.filter(function(z){ return !connected[z.id]; });
  // Раньше тут писалось "N порталов пересчитаны приближённо" — это угловые
  // стыки треугольников навмеша (~10%, так устроен сам .nav), на ходьбу они не
  // влияют, и надпись только пугала. Теперь — реальная проверка: соседние по
  // карте зоны, между которыми навмеш НЕ ведёт напрямую (как было с Dark)
  var broken = [];
  try{
    ZONEMAP.portals.forEach(function(pp){
      var a = ZONE_CENTROIDS[pp.a], c = ZONE_CENTROIDS[pp.b]; if(!a || !c) return;
      var A = snapToWalkable(a.x, a.y), C = snapToWalkable(c.x, c.y), st = Math.hypot(A.x-C.x, A.y-C.y), L = 0, px = A.x, py = A.y;
      buildWaypointPath(A.x, A.y, 0, C.x, C.y, 0).forEach(function(q){ L += Math.hypot(q[0]-px, q[1]-py); px = q[0]; py = q[1]; });
      if(L > Math.max(2.2*st, st + 400)) broken.push((zoneUserName(pp.a) || pp.a) + " ↔ " + (zoneUserName(pp.b) || pp.b));
    });
  }catch(e){}
  if(orphans.length || broken.length){
    var msg = [];
    if(orphans.length) msg.push(orphans.length+" зон(а) без портала — бот не сможет туда дойти ("+orphans.map(function(z){return z.id;}).join(", ")+")");
    if(broken.length) msg.push("навмеш не связывает напрямую: "+broken.join(", ")+" — проверь калибровку навмеша/стены в этом месте");
    var el = document.getElementById("warn");
    el.textContent = msg.join(" · ");
    el.style.display = "block";
  }
})();
