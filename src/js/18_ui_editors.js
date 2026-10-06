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
var showCalls = document.getElementById("chkCalls");
var showWhy = document.getElementById("chkWhy");
// подпись "почему": задача (пост) · куда смотрит и из-за чего
var WHY_POST = [[/^hold:(.*)/,"держит вход $1"],[/^retakeHold:(.*)/,"играет от ретейка: $1"],[/^gather/,"сбор на ретейк"],[/^retakeEntry/,"ретейк: заходит первым"],[/^retake/,"ретейк"],
  [/^peek:(.*)/,"ранний пик за инфой: $1"],[/^push:(.*)/,"подпуш: $1"],[/^jiggle/,"джиггл на звук"],[/^back:(.*)/,"назад после хода ($1)"],[/^repos:(.*)/,"меняет позицию: $1"],[/^fallback/,"отходит (ранен, их больше)"],
  [/^stage/,"сбор перед выходом"],[/^control/,"контроль области"],[/^probe/,"проба за инфой"],[/^lurk/,"лёрк"],[/^route:(.*)/,"идёт: $1"],
  [/^entry/,"энтри: заходит первым"],[/^trade/,"за энтри на размен"],[/^take/,"заход на сайт"],[/^carry/,"бомба за группой"],[/^plantspot/,"плант"],
  [/^flee/,"уходит от бомбы"],[/^save/,"сейв"],[/^defuse/,"дефуз"],[/^postplant/,"пост-плант с дистанции"],[/^antidefuse/,"сбить дефуз"],
  [/^pickup/,"за оружием"],[/^fetch/,"за бомбой"],[/^lineup/,"идёт кидать гранату"]];
var WHY_LOOK = {spam:"простреливает смок", look:"угроза", enemy:"видит врага", corner:"край угла впереди", cover:"держит второй угол за тиммейта", open:"открытый угол (свой угол держит тиммейт)", flank:"фланг за тиммейтом", death:"туда, где убили своего", sweep:"чекает после смока", sound:"на звук", threat:"угроза", post:"свой угол", preaim:"по плану", roam:"проверяет точку",
  hunt:"ищет последнего", save:"сейв: проходы", fake:"фейк-дефуз", intel:"инфа", call:"колл", lkp:"где видели", habit:"привычка врага", belief:"вероятность"};
function whyText(b){
  var t = b.post ? b.post.tag : "", pt = "без задачи";
  for(var i=0;i<WHY_POST.length;i++){ var m = WHY_POST[i][0].exec(t); if(m){ pt = WHY_POST[i][1].replace("$1", (m[1]||"").replace(/^[AB]:?/,"")); break; } }
  if(t && pt === "без задачи") pt = t;
  if(b.planting) pt = "ставит бомбу"; if(b.defusing) pt = "дефузит";
  var lr = b.lookReason, lt = lr ? (WHY_LOOK[lr] || lr) : "по ходу движения";
  if(b.state === "engage" && b.peekType) pt = "бой · пик " + ({wide:"широкий", shoulder:"плечом", jiggle:"джиггл"})[b.peekType];
  else if(b.state === "hold") pt = "бой · держит угол";
  else if(b.state === "retreat") pt = "бой · отходит";
  if(lr === "look" && b._lkTop && b._lkTop.length){
    lt = "смотрит: " + b._lkTop.map(function(t){ return t[0] + " " + t[1].toFixed(2); }).join(" › ");
    return pt + " · " + lt; }
  if(b.lookTarget && (lr === "threat" || lr === "post" || lr === "sound" || lr === "preaim" || lr === "enemy")) lt += " → " + calloutName(b.lookTarget.x, b.lookTarget.y).replace(/^на «(.*)»$/, "$1");
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
  if(chkWallEdit.checked || chkWallAlign.checked || chkAlign.checked) return;
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

// ---------- manual wall editing, Photoshop-style: click an object to select
// it (dashed box + a corner handle), drag its body to MOVE it, drag the
// handle to SCALE it (from its own center). Click empty space to draw a new
// wall object instead (or to deselect). Takes priority over align-mode/
// camera-pan dragging whenever it's on. ----------
var chkWallEdit = document.getElementById("chkWallEdit");
var wallEditPanel = document.getElementById("wallEditPanel");
var wallEditCount = document.getElementById("wallEditCount");
var btnWallUndo = document.getElementById("btnWallUndo");
var btnWallClear = document.getElementById("btnWallClear");
var btnWallDelete = document.getElementById("btnWallDelete");
var btnWallExport = document.getElementById("btnWallExport");
var wallExportArea = document.getElementById("wallExportArea");
var btnWallRevert = document.getElementById("btnWallRevert");
btnWallRevert.addEventListener("click", function(){
  // discards the autosaved browser copy and rebuilds fresh from the
  // WALLPOLYS_RAW seed baked into this artifact's source — for when local
  // edits went sideways and you want to start over from what's actually published
  try{ localStorage.removeItem(WALLS_STORAGE_KEY); }catch(e){}
  WALL_OBJECTS.length = 0;
  WALLPOLYS_RAW.forEach(function(poly){
    WALL_OBJECTS.push({ basePoints: poly.map(function(p){ return {x:p[0], y:p[1]}; }), closed:true, dx:0, dy:0, scale:1, fromRaw:false, traced:true });
  });
  selectedObjId = null;
  rebuildManualWalls();
  updateWallEditCount();
  logEvent("Стены сброшены к версии из кода", "round");
});
btnWallExport.addEventListener("click", function(){
  // absolute points for every object, baked (ignores fromRaw/wallTransform/
  // obj dx-dy-scale entirely — this is "what's actually on screen right now",
  // exactly what needs to go back into the source to make it permanent)
  var out = WALL_OBJECTS.map(function(obj){
    var pts = objectAbsPoints(obj);
    return { points: pts.map(function(p){ return {x:Math.round(p.x*10)/10, y:Math.round(p.y*10)/10}; }), closed: obj.closed };
  });
  wallExportArea.style.display = "block";
  wallExportArea.value = JSON.stringify(out);
  wallExportArea.select();
  try{ document.execCommand("copy"); }catch(e){}
});
var wallDrawing = false, wallDrawStart = null, wallDrawCur = null;
var HIT_TOL_PX = 8;   // screen px, converted to world units by /view.scale below
var HANDLE_TOL_PX = 10;
var selectedObjId = null; // index into WALL_OBJECTS, or null
var objMoving = false, objMoveStart = null, objMoveOrig = null;
var objScaling = false, objScaleCenter = null, objScaleBaseDist = 1;

var chkVertexEdit = document.getElementById("chkVertexEdit");
var wallEditHint = document.getElementById("wallEditHint");
var vertexDragging = false, vertexDragObjId = null, vertexDragIdx = -1;
var VERTEX_TOL_PX = 10;
var HINT_OBJECT_MODE = "клик — выделить · тащи тело — двигать · тащи уголок (квадратик) — масштаб · колесо — тоже масштаб · тащи пустое место — новая стена";
var HINT_VERTEX_MODE = "клик по точке — выделить объект · тащи точку — сдвинуть её · клик на ребре между точками — вставить новую точку туда (перо) · Shift+клик по точке — удалить её";
function updateWallEditHint(){ wallEditHint.textContent = chkVertexEdit.checked ? HINT_VERTEX_MODE : HINT_OBJECT_MODE; }
chkVertexEdit.addEventListener("change", function(){
  // switching modes mid-drag would leave a half-finished move/scale/drag dangling
  objMoving = false; objScaling = false; vertexDragging = false;
  updateWallEditHint();
});

// как только правишь точки объекта индивидуально, он отсоединяется от любых
// групповых трансформаций — тот же приём, что уже применяется к hand-drawn
// объектам (см. WALL_OBJECTS выше): иначе "куда сместилась эта точка"
// зависело бы ещё и от dx/dy/scale объекта и от общего выравнивания стен
function bakeObjectTransform(obj){
  if(obj.fromRaw || obj.dx!==0 || obj.dy!==0 || obj.scale!==1){
    obj.basePoints = objectAbsPoints(obj);
    obj.dx = 0; obj.dy = 0; obj.scale = 1; obj.fromRaw = false;
  }
}
function findVertexNear(obj, wx, wy){
  var tol = VERTEX_TOL_PX / view.scale;
  var pts = objectAbsPoints(obj);
  var best = -1, bestD = tol;
  pts.forEach(function(p, i){
    var d = Math.hypot(p.x-wx, p.y-wy);
    if(d < bestD){ bestD = d; best = i; }
  });
  return best;
}

function updateWallEditCount(){ wallEditCount.textContent = WALL_OBJECTS.length; btnWallDelete.disabled = selectedObjId===null; }
updateWallEditCount();
updateWallEditHint();

function distToSeg(px,py, s){
  var x1=s[0],y1=s[1],x2=s[2],y2=s[3];
  var dx=x2-x1, dy=y2-y1;
  var len2 = dx*dx+dy*dy;
  var t = len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((px-x1)*dx+(py-y1)*dy)/len2));
  var cx = x1+t*dx, cy = y1+t*dy;
  return Math.hypot(px-cx, py-cy);
}
// nearest OBJECT (not raw segment) to a world point, for select/move-drag
function findObjectNear(wx, wy){
  var tol = HIT_TOL_PX / view.scale;
  var best = -1, bestD = tol;
  WALL_OBJECTS.forEach(function(obj, i){
    var pts = objectAbsPoints(obj);
    var n = obj.closed ? pts.length : pts.length-1;
    for(var k=0;k<n;k++){
      var a = pts[k], b = pts[(k+1)%pts.length];
      var d = distToSeg(wx, wy, [a.x,a.y,b.x,b.y]);
      if(d < bestD){ bestD = d; best = i; }
    }
  });
  return best;
}

chkWallEdit.addEventListener("change", function(){
  if(chkWallEdit.checked) setMode("wallEdit"); else { setMode(null); selectedObjId = null; updateWallEditCount(); }
});
btnWallUndo.addEventListener("click", function(){
  // only undoes hand-drawn additions, never one of the 25 traced originals
  for(var i=WALL_OBJECTS.length-1;i>=0;i--){
    if(!WALL_OBJECTS[i].traced){ WALL_OBJECTS.splice(i,1); break; }
  }
  if(selectedObjId!==null && selectedObjId>=WALL_OBJECTS.length) selectedObjId=null;
  rebuildManualWalls();
  updateWallEditCount();
});
btnWallClear.addEventListener("click", function(){
  if(WALL_OBJECTS.length && !confirm("Удалить все "+WALL_OBJECTS.length+" объект(ов) стен?")) return;
  WALL_OBJECTS.length = 0;
  selectedObjId = null;
  rebuildManualWalls();
  updateWallEditCount();
});
btnWallDelete.addEventListener("click", function(){
  if(selectedObjId===null) return;
  WALL_OBJECTS.splice(selectedObjId, 1);
  selectedObjId = null;
  rebuildManualWalls();
  updateWallEditCount();
});
window.addEventListener("keydown", function(e){
  if(!chkWallEdit.checked || selectedObjId===null) return;
  if(e.key==="Delete" || e.key==="Backspace"){
    WALL_OBJECTS.splice(selectedObjId, 1);
    selectedObjId = null;
    rebuildManualWalls();
    updateWallEditCount();
    e.preventDefault();
  }
});

// ---------- global wall alignment: one coarse move+scale over the whole
// traced set (see objectAbsPoints — only fromRaw:true objects are affected,
// and none currently are, since the traced set was baked point-by-point via
// the pen tool — see WALLPOLYS_RAW above). Left in place, inert, in case a
// future fromRaw:true batch is added and needs this coarse pass again.
// Same drag/wheel mechanism as navmesh alignment. ----------
var chkWallAlign = document.getElementById("chkWallAlign");
var wallAlignPanel = document.getElementById("wallAlignPanel");
var inWallDx = document.getElementById("wallDx");
var inWallDy = document.getElementById("wallDy");
var inWallScale = document.getElementById("wallScale");
var btnWallAlignReset = document.getElementById("btnWallAlignReset");
var wallAlignDragging = false, wallAlignDragStart = null, wallAlignDragOrig = null;

function updateWallAlignInputs(){
  inWallDx.value = wallTransform.dx.toFixed(1);
  inWallDy.value = wallTransform.dy.toFixed(1);
  inWallScale.value = wallTransform.scale.toFixed(3);
}
updateWallAlignInputs();

// ---------- navmesh multi-anchor calibration UI: click a navmesh vertex,
// then click where it should actually be — repeat 3+ times in different
// corners of the map to fix the non-uniform drift a single affine
// transform can't (see navMapPoint/rebuildNavWarp above). ----------
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
  if(which !== "wallEdit" && chkWallEdit.checked){ chkWallEdit.checked = false; }
  if(which !== "wallAlign" && chkWallAlign.checked){ chkWallAlign.checked = false; }
  if(which !== "zoneEdit" && chkZoneEdit.checked){ chkZoneEdit.checked = false; }
  if(which !== "zoneAlign" && chkZoneAlign.checked){ chkZoneAlign.checked = false; }
  zoneAlignPanel.style.display = chkZoneAlign.checked ? "block" : "none";
  alignPanel.style.display = chkAlign.checked ? "block" : "none";
  navWarpPanel.style.display = chkNavWarp.checked ? "block" : "none";
  wallEditPanel.style.display = chkWallEdit.checked ? "block" : "none";
  wallAlignPanel.style.display = chkWallAlign.checked ? "block" : "none";
  zoneEditPanel.style.display = chkZoneEdit.checked ? "block" : "none";
  if(!chkZoneEdit.checked){ zoneDrawing=false; zoneDrawPts=[]; btnZoneFinish.disabled=true; selectedZoneId=null; updateZoneEditCount(); }
  cv.style.cursor = chkAlign.checked ? "move" : chkNavWarp.checked ? "crosshair" : chkWallEdit.checked ? "default" : chkWallAlign.checked ? "move" : chkZoneEdit.checked ? "default" : chkZoneAlign.checked ? "move" : "";
}
chkZoneEdit.addEventListener("change", function(){ if(chkZoneEdit.checked) setMode("zoneEdit"); else setMode(null); });
chkZoneAlign.addEventListener("change", function(){ if(chkZoneAlign.checked) setMode("zoneAlign"); else setMode(null); });
chkAlign.addEventListener("change", function(){ if(chkAlign.checked) setMode("align"); else setMode(null); });
chkNavWarp.addEventListener("change", function(){
  if(chkNavWarp.checked) setMode("navWarp"); else setMode(null);
  navWarpPending = null;
  updateNavWarpHint();
});
chkWallAlign.addEventListener("change", function(){
  if(chkWallAlign.checked) setMode("wallAlign"); else setMode(null);
});
var WALL_ALIGN_BASELINE = { dx: 0, dy: 0, scale: 1 }; // identity — the old confirmed-good coarse pass (-15.7/36.7/0.83) is now baked directly into WALLPOLYS_RAW's points, not applied here
btnWallAlignReset.addEventListener("click", function(){
  wallTransform.dx = WALL_ALIGN_BASELINE.dx; wallTransform.dy = WALL_ALIGN_BASELINE.dy; wallTransform.scale = WALL_ALIGN_BASELINE.scale;
  rebuildManualWalls();
  updateWallAlignInputs();
  updateWallEditCount();
});
[inWallDx,inWallDy,inWallScale].forEach(function(el){
  el.addEventListener("change", function(){
    wallTransform.dx = parseFloat(inWallDx.value)||0;
    wallTransform.dy = parseFloat(inWallDy.value)||0;
    wallTransform.scale = parseFloat(inWallScale.value)||1;
    rebuildManualWalls();
    updateWallEditCount();
  });
});

cv.addEventListener("contextmenu", function(e){ e.preventDefault(); });
// ---- редактор лайнапов ----
var chkLineups = document.getElementById("chkLineups"), lineupPanel = document.getElementById("lineupPanel");
var luPending = null, luHover = null;
var LU_COL = {smoke:"rgba(200,205,210,0.95)", flash:"rgba(255,240,150,0.95)", molly:"rgba(255,140,60,0.95)", he:"rgba(150,230,120,0.95)"};
// встроенные гранаты — то, что боты кидают сами (цели считаются так же, как в
// nadeBrains/комбо); "откуда" — примерная точка, где обычно стоит бросающий
function builtinLineups(){
  if(!GEO.A || !GEO.B) return [];
  var out = [], mid = function(a, b2, f){ f = f == null ? 0.5 : f; return {x:a.x+(b2.x-a.x)*f, y:a.y+(b2.y-a.y)*f}; };
  out.push({key:"T.insta.mid", team:"T", type:"smoke", trigger:"insta", site:"any", name:"инстасмок мид", from:T_SPAWN, to:mid(GEO.tMid, GEO.ctMid)});
  ["A","B"].forEach(function(k){
    var g = GEO[k], st = SITES[k];
    out.push({key:"T.exec.ctEntry."+k, team:"T", type:"smoke", trigger:"exec", site:k, name:"вход CT", from:g.tStage, to:g.ctEntry});
    out.push({key:"T.exec.cross."+k, team:"T", type:"smoke", trigger:"exec", site:k, name:"кросс", from:g.tStage, to:mid(g.anchor, g.ctEntry)});
    out.push({key:"T.exec.flash."+k, team:"T", type:"flash", trigger:"exec", site:k, name:"под пик энтри", from:g.tStage, to:mid(g.tEntry, st, 0.35)});
    out.push({key:"T.exec.molly."+k, team:"T", type:"molly", trigger:"exec", site:k, name:"выжечь опорника / любимый угол", from:g.tStage, to:g.anchor});
    out.push({key:"T.fake.smoke."+k, team:"T", type:"smoke", trigger:"setup", site:k, name:"фейк-смок (фейк на "+k+")", from:g.tStage, to:g.ctEntry});
    out.push({key:"T.fake.flash."+k, team:"T", type:"flash", trigger:"setup", site:k, name:"фейк-флешка (фейк на "+k+")", from:g.tStage, to:mid(g.tEntry, st, 0.4)});
    out.push({key:"T.pp.molly."+k, team:"T", type:"molly", trigger:"postplant", site:k, name:"на дефуз", from:g.tEntry, to:st.plant || st});
    out.push({key:"CT.call.molly."+k, team:"CT", type:"molly", trigger:"call", site:k, name:"задержать выход", from:g.anchor, to:g.tEntry});
    out.push({key:"CT.call.smoke."+k, team:"CT", type:"smoke", trigger:"call", site:k, name:"перекрыть вход", from:g.anchor, to:g.tEntry});
    out.push({key:"CT.take.he."+k, team:"CT", type:"he", trigger:"exec", site:k, name:"в смок — не дать занять сайт", from:g.anchor, to:mid(g.tEntry, st, 0.35)});
    out.push({key:"CT.retake.flash."+k, team:"CT", type:"flash", trigger:"retake", site:k, name:"ретейк", from:g.ctEntry, to:st.plant || st});
    out.push({key:"CT.retake.smoke."+k, team:"CT", type:"smoke", trigger:"retake", site:k, name:"отрезать вход T", from:g.ctEntry, to:g.tEntry});
  });
  return out;
}
function drawLineups(){
  var show = chkLineups && chkLineups.checked; if(!show) return;
  ctx.save();
  var bShow = document.getElementById("luShowBuiltin");
  if(bShow && bShow.checked){
    // одна точка падения — одна подпись (несколько гранат в одну цель — списком)
    var groups = {};
    builtinLineups().forEach(function(L){
      if(!builtinAllowed(L.key)) return;
      var col = (LU_COL[L.type] || "#fff").replace("0.95)", "0.45)");
      ctx.strokeStyle = col; ctx.lineWidth = 1/view.scale;
      ctx.setLineDash([2/view.scale, 6/view.scale]);
      ctx.beginPath(); ctx.moveTo(L.from.x, L.from.y); ctx.lineTo(L.to.x, L.to.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(L.to.x, L.to.y, (L.type === "smoke" ? 20 : 10)/view.scale, 0, 7); ctx.stroke();
      var k = Math.round(L.to.x/25)+","+Math.round(L.to.y/25);
      (groups[k] = groups[k] || {x:L.to.x, y:L.to.y, items:[]}).items.push(L);
    });
    ctx.font = (9/view.scale)+"px 'IBM Plex Mono',monospace"; ctx.textAlign = "left";
    Object.keys(groups).forEach(function(k){
      var G = groups[k];
      G.items.forEach(function(L, i){
        ctx.fillStyle = (LU_COL[L.type] || "#fff").replace("0.95)", "0.8)");
        ctx.fillText(L.team+" "+LU_TYPE[L.type]+": "+L.name, G.x + 24/view.scale, G.y + (i*10 - (G.items.length-1)*5 + 3)/view.scale);
      });
    });
  }
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
var luSel = null, luDrag = null, luBuiltinOpen = false;
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
function builtinCopy(key){
  var B = builtinLineups().filter(function(L){ return L.key === key; })[0]; if(!B) return;
  var ex = USER_LINEUPS.findIndex(function(L){ return L.replaces === key; });
  if(ex >= 0){ selectLineup(ex); return; }
  USER_LINEUPS.push({id:"lu"+Date.now().toString(36)+Math.floor(Math.random()*1000), team:B.team, type:B.type, trigger:B.trigger, site:B.site,
    name:B.name, from:{x:Math.round(B.from.x*10)/10, y:Math.round(B.from.y*10)/10}, to:{x:Math.round(B.to.x*10)/10, y:Math.round(B.to.y*10)/10}, replaces:key});
  saveLineups(); selectLineup(USER_LINEUPS.length-1);
}
function refreshLineupList(){
  var el = document.getElementById("lineupList"), h = "";
  USER_LINEUPS.forEach(function(L, i){
    var sel = i === luSel;
    h += '<div data-sel="'+i+'" style="display:flex;justify-content:space-between;gap:6px;border-top:1px solid var(--line);padding:3px 4px;cursor:pointer;'+(sel?'background:rgba(255,215,106,0.12);border-left:2px solid #ffd76a;':'')+'"><span>'+L.team+' · '+LU_TYPE[L.type]+' · '+LU_TRIG[L.trigger]+(L.site!=="any"?" "+L.site:"")+
      (L.replaces ? ' <span style="color:var(--accent-dim)">(вместо встроенной)</span>' : '')+'<br><span style="color:var(--text-dim)">'+esc2(L.name||"")+'</span></span><button data-lu="'+i+'" title="удалить" style="height:22px;">✕</button></div>';
  });
  if(!USER_LINEUPS.length) h = '<div style="color:var(--text-dim)">пока нет своих лайнапов</div>';
  el.innerHTML = h;
  var BL = builtinLineups();
  var hb = '<details'+(luBuiltinOpen?' open':'')+' id="luBuiltinDet"><summary style="cursor:pointer;color:var(--accent-dim);">встроенные гранаты ('+BL.length+') — ✎ правка, выкл</summary>';
  BL.forEach(function(L){
    var rep = USER_LINEUPS.some(function(U){ return U.replaces === L.key; }), off = !!BUILTIN_OFF[L.key];
    hb += '<div style="display:flex;justify-content:space-between;gap:4px;align-items:center;padding:1px 0;'+(off||rep?'opacity:.45;':'')+'"><span>'+L.team+' · '+LU_TYPE[L.type]+' · '+LU_TRIG[L.trigger]+(L.site!=="any"?" "+L.site:"")+' — '+esc2(L.name)+(rep?' (заменена)':'')+'</span>'+
      '<span style="white-space:nowrap"><button data-bedit="'+L.key+'" title="скопировать в свои и править (встроенная отключится)" style="height:20px;padding:0 5px;">✎</button> <button data-boff="'+L.key+'" title="выключить/включить" style="height:20px;padding:0 5px;">'+(off?'вкл':'выкл')+'</button></span></div>';
  });
  document.getElementById("lineupBuiltin").innerHTML = hb + '</details>';
  var det = document.getElementById("luBuiltinDet"); det.addEventListener("toggle", function(){ luBuiltinOpen = det.open; });
  Array.prototype.forEach.call(el.querySelectorAll("button[data-lu]"), function(btn){
    btn.addEventListener("click", function(ev){ ev.stopPropagation(); var i = +btn.getAttribute("data-lu"); USER_LINEUPS.splice(i, 1); if(luSel === i) luSel = null; else if(luSel > i) luSel--; saveLineups(); refreshLineupList(); draw(); });
  });
  Array.prototype.forEach.call(el.querySelectorAll("div[data-sel]"), function(row){
    row.addEventListener("click", function(){ var i = +row.getAttribute("data-sel"); selectLineup(luSel === i ? null : i); });
  });
  Array.prototype.forEach.call(document.querySelectorAll("button[data-bedit]"), function(btn){ btn.addEventListener("click", function(){ builtinCopy(btn.getAttribute("data-bedit")); }); });
  Array.prototype.forEach.call(document.querySelectorAll("button[data-boff]"), function(btn){ btn.addEventListener("click", function(){ var k = btn.getAttribute("data-boff"); if(BUILTIN_OFF[k]) delete BUILTIN_OFF[k]; else BUILTIN_OFF[k] = true; saveLineups(); refreshLineupList(); draw(); }); });
  document.getElementById("lineupHint").textContent = luSel !== null ? "правка: тащи точки ● (откуда) и ○ (куда) · поля ниже меняют лайнап · клик мимо — снять выбор"
    : luPending ? "клик 2 — куда летит (Esc — отмена)" : "клик 1 — откуда кидают · клик 2 — куда летит · клик по своему лайнапу — выбрать и править";
}
document.getElementById("luShowBuiltin").addEventListener("change", function(){ draw(); });
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
  zsRebuildTimer = setTimeout(function(){ zsRebuildTimer = null; _zbnCache = {}; applyZoneLayer(true); draw(); }, 150);
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
  if(e.button === 0 && chkPtEd.checked){ ptEdDown(e); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if(e.button === 0 && chkLineups.checked){ lineupClick(e); e.preventDefault(); return; }
  // слой «зоны» без других режимов редактирования: клик по зоне — её название
  if(e.button === 0 && showZones.checked && !chkNavWarp.checked && !chkZoneEdit.checked && !chkWallEdit.checked &&
     !chkAlign.checked && !chkWallAlign.checked && !chkZoneAlign.checked){
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
  if(chkWallEdit.checked && chkVertexEdit.checked){
    // pen/vertex mode — never moves or scales the whole object, and never
    // starts a fresh wall; only selects objects and edits their points
    var wv = navScreenToWorld(e.clientX, e.clientY);
    if(selectedObjId !== null){
      var vobj = WALL_OBJECTS[selectedObjId];
      var vi = findVertexNear(vobj, wv.x, wv.y);
      if(vi >= 0){
        var minPts = vobj.closed ? 3 : 2;
        var curPts = objectAbsPoints(vobj);
        if(e.shiftKey){
          if(curPts.length > minPts){
            bakeObjectTransform(vobj);
            vobj.basePoints.splice(vi, 1);
            rebuildManualWalls();
          }
        } else {
          bakeObjectTransform(vobj);
          vertexDragging = true; vertexDragObjId = selectedObjId; vertexDragIdx = vi;
        }
        e.preventDefault();
        return;
      }
      // not on a point — on an edge of the SAME selected object? insert a new point there
      var ePts = objectAbsPoints(vobj);
      var eN = vobj.closed ? ePts.length : ePts.length-1;
      var insTol = HIT_TOL_PX/view.scale;
      for(var ek=0; ek<eN; ek++){
        var ea = ePts[ek], eb = ePts[(ek+1)%ePts.length];
        if(distToSeg(wv.x, wv.y, [ea.x,ea.y,eb.x,eb.y]) < insTol){
          bakeObjectTransform(vobj);
          vobj.basePoints.splice(ek+1, 0, {x:wv.x, y:wv.y});
          rebuildManualWalls();
          vertexDragging = true; vertexDragObjId = selectedObjId; vertexDragIdx = ek+1;
          e.preventDefault();
          return;
        }
      }
    }
    // clicked elsewhere — (re)select whichever object is under the cursor, if any
    var hitv = findObjectNear(wv.x, wv.y);
    selectedObjId = hitv >= 0 ? hitv : null;
    updateWallEditCount();
    e.preventDefault();
    return;
  }
  if(chkWallEdit.checked){
    var w = navScreenToWorld(e.clientX, e.clientY);
    // the selected object's own scale handle takes priority over everything
    if(selectedObjId !== null){
      var h = objectHandlePos(WALL_OBJECTS[selectedObjId]);
      if(Math.hypot(w.x-h.x, w.y-h.y) < HANDLE_TOL_PX/view.scale){
        objScaling = true;
        objScaleCenter = objectCentroid(WALL_OBJECTS[selectedObjId]);
        objScaleBaseDist = Math.max(1, Math.hypot(h.x-objScaleCenter.x, h.y-objScaleCenter.y)) / WALL_OBJECTS[selectedObjId].scale;
        e.preventDefault();
        return;
      }
    }
    var hit = findObjectNear(w.x, w.y);
    if(hit >= 0){
      selectedObjId = hit;
      updateWallEditCount();
      objMoving = true;
      objMoveStart = w;
      objMoveOrig = {dx:WALL_OBJECTS[hit].dx, dy:WALL_OBJECTS[hit].dy};
    } else {
      selectedObjId = null;
      updateWallEditCount();
      wallDrawing = true;
      wallDrawStart = w;
      wallDrawCur = w;
    }
  } else if(chkZoneAlign.checked){
    zlDragging = true;
    zlDragStart = navScreenToWorld(e.clientX, e.clientY);
    zlDragOrig = {dx:zoneLayer.dx, dy:zoneLayer.dy};
  } else if(chkWallAlign.checked){
    wallAlignDragging = true;
    wallAlignDragStart = navScreenToWorld(e.clientX, e.clientY);
    wallAlignDragOrig = {dx:wallTransform.dx, dy:wallTransform.dy};
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
  } else if(objScaling){
    var w = navScreenToWorld(e.clientX, e.clientY);
    var d = Math.hypot(w.x-objScaleCenter.x, w.y-objScaleCenter.y);
    WALL_OBJECTS[selectedObjId].scale = Math.max(0.1, Math.min(10, d/objScaleBaseDist));
    rebuildManualWalls();
  } else if(objMoving){
    var w = navScreenToWorld(e.clientX, e.clientY);
    WALL_OBJECTS[selectedObjId].dx = objMoveOrig.dx + (w.x-objMoveStart.x);
    WALL_OBJECTS[selectedObjId].dy = objMoveOrig.dy + (w.y-objMoveStart.y);
    rebuildManualWalls();
  } else if(vertexDragging){
    // baked already (fromRaw:false, dx/dy 0, scale 1) at drag start, so the
    // absolute point IS the basePoint — no transform to invert here
    var wv2 = navScreenToWorld(e.clientX, e.clientY);
    WALL_OBJECTS[vertexDragObjId].basePoints[vertexDragIdx] = {x:wv2.x, y:wv2.y};
    rebuildManualWalls();
  } else if(wallDrawing){
    wallDrawCur = navScreenToWorld(e.clientX, e.clientY);
  } else if(zlDragging){
    var zc = navScreenToWorld(e.clientX, e.clientY);
    zoneLayer.dx = zlDragOrig.dx + (zc.x - zlDragStart.x);
    zoneLayer.dy = zlDragOrig.dy + (zc.y - zlDragStart.y);
    applyZoneLayer(false); updateZlInputs();
  } else if(wallAlignDragging){
    var cur = navScreenToWorld(e.clientX, e.clientY);
    wallTransform.dx = wallAlignDragOrig.dx + (cur.x - wallAlignDragStart.x);
    wallTransform.dy = wallAlignDragOrig.dy + (cur.y - wallAlignDragStart.y);
    rebuildManualWalls();
    updateWallAlignInputs();
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
  if(wallDrawing){
    wallDrawing = false;
    var w = navScreenToWorld(e.clientX, e.clientY);
    var len = Math.hypot(w.x-wallDrawStart.x, w.y-wallDrawStart.y);
    if(len > 2/view.scale){ // ignore accidental clicks-as-zero-length-drags
      WALL_OBJECTS.push({ basePoints:[{x:wallDrawStart.x,y:wallDrawStart.y},{x:w.x,y:w.y}], closed:false, dx:0, dy:0, scale:1, fromRaw:false });
      rebuildManualWalls();
      updateWallEditCount();
    }
    wallDrawStart = null; wallDrawCur = null;
  }
  objMoving = false; objScaling = false;
  vertexDragging = false; vertexDragObjId = null; vertexDragIdx = -1;
  wallAlignDragging = false;
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
  if(chkWallEdit.checked && selectedObjId !== null){
    // scale the selected object from its own center
    var wfac = e.deltaY < 0 ? 1.06 : (1/1.06);
    var obj = WALL_OBJECTS[selectedObjId];
    obj.scale = Math.max(0.1, Math.min(10, obj.scale*wfac));
    rebuildManualWalls();
  } else if(chkZoneEdit.checked && selectedZoneId !== null){
    var zwfac = e.deltaY < 0 ? 1.06 : (1/1.06);
    var zobj = USER_ZONES[selectedZoneId];
    zobj.scale = Math.max(0.1, Math.min(10, zobj.scale*zwfac));
    applyUserZones(); saveUserZonesDebounced();
  } else if(chkZoneAlign.checked){
    var zf2 = e.deltaY < 0 ? 1.03 : (1/1.03);
    zoneLayer.scale = Math.max(0.3, Math.min(3, zoneLayer.scale*zf2));
    applyZoneLayer(false); updateZlInputs();
  } else if(chkWallAlign.checked){
    // wall-align mode: wheel resizes the old wall set relative to the image
    var wfactor = e.deltaY < 0 ? 1.04 : (1/1.04);
    wallTransform.scale = Math.max(0.3, Math.min(2.5, wallTransform.scale*wfactor));
    rebuildManualWalls();
    updateWallAlignInputs();
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
      var A = walk(a), C = walk(c), st = Math.hypot(A.x-C.x, A.y-C.y), L = polyLen(pathPts(A.x, A.y, C.x, C.y));
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


// ---- (v193) редактор точек углов (01_points.js): как редактор стен ----
// Правки сразу идут в игру (POINTS) и сами сохраняются в базу страницы
// (коллекция points, документ map) через 1,5 с; Claude переносит их в
// src/data/points.json. Нет базы — «Экспорт» даёт JSON, его можно прислать в чат.
var chkPtEd = document.getElementById("chkPtEd"), ptEdPanel = document.getElementById("ptEdPanel");
var PTED = {sel:null, drag:null, hover:null, db:null, dirty:false, savedAt:null, timer:null, lastT:0};
function ptEdEl(id){ return document.getElementById(id); }
function ptEdVisible(p){ var f = ptEdEl("ptEdShow").value; return f === "all" || p.side === f || p.side === "both"; }
function ptEdFind(w){ var best = null, bd = 10/view.scale;
  pointsGet().forEach(function(p){ if(!ptEdVisible(p)) return; var d = Math.hypot(p.x-w.x, p.y-w.y); if(d < bd){ bd = d; best = p; } });
  return best; }
// точку правили — её «знание» (какой вход, насколько открыта) пересчитать; каталог ботов — заново
function ptEdTouched(p){ if(p){ delete p.hold; delete p.from; delete p.open; delete p.dirs; delete p.key; delete p.name; }
  TEAM_COV = null; PTED.dirty = true; POINTS_SRC = "правка на странице (ещё не в коде)"; ptEdSaveSoon(); ptEdRefresh(); }
function ptEdRefresh(){
  if(!ptEdPanel) return;
  var P = pointsGet(), n = {CT:0, T:0, both:0}; P.forEach(function(p){ n[p.side] = (n[p.side]||0)+1; });
  ptEdEl("ptEdCount").textContent = "· "+P.length+" (CT "+n.CT+", T "+n.T+", обе "+n.both+")";
  var p = PTED.sel && P.indexOf(PTED.sel) >= 0 ? PTED.sel : (PTED.sel = null);
  ptEdEl("ptEdFields").style.display = p ? "grid" : "none";
  if(p){ if(p.open == null) pointDerive(p);
    ptEdEl("ptEdSel").innerHTML = "<b style='color:var(--text)'>"+esc2(p.id)+"</b> · стоит: "+esc2(zoneNameAt(p.x, p.y))+
      "<br>держит выход из: <b style='color:var(--text)'>"+esc2(p.name || "?")+"</b><br>открыта врагу "+Math.round((p.open||0)*100)+"% · других углов "+(p.dirs||0);
    ptEdEl("ptEdSide").value = p.side; ptEdEl("ptEdArea").value = p.area || "";
  } else ptEdEl("ptEdSel").textContent = "точка не выбрана";
  ptEdEl("ptEdStatus").textContent = "сейчас в игре: "+POINTS_SRC+(PTED.db ? (PTED.dirty ? " · сохраняю…" : PTED.savedAt ? " · сохранено "+PTED.savedAt : "") : " · база страницы недоступна — используй «Экспорт»");
}
function zoneNameAt(x, y){ var z = bzOf(x, y); return z >= 0 ? (ZONE_NAMES[ZONEMAP.zones[z].id] || ZONEMAP.zones[z].id) : "?"; }
function ptEdPack(){ return pointsGet().map(function(p){ var o = {id:p.id, x:Math.round(p.x*10)/10, y:Math.round(p.y*10)/10, lx:Math.round(p.lx*10)/10, ly:Math.round(p.ly*10)/10, side:p.side, area:p.area || ""};
  ["key","hold","from","name","open","dirs"].forEach(function(k){ if(p[k] != null) o[k] = p[k]; }); return o; }); }
function ptEdSaveSoon(){ clearTimeout(PTED.timer); PTED.timer = setTimeout(ptEdSave, 1500); }
function ptEdSave(){
  if(!PTED.db){ ptEdRefresh(); return; }
  var t = Date.now(); PTED.lastT = t;
  PTED.db.collection("points").doc("map").set({pts:ptEdPack(), t:t, n:pointsGet().length})
    .then(function(){ PTED.dirty = false; PTED.savedAt = new Date(t).toLocaleTimeString("ru-RU"); ptEdRefresh(); })
    .catch(function(){ PTED.savedAt = null; ptEdEl("ptEdStatus").textContent = "не удалось сохранить в базу — используй «Экспорт»"; });
}
function ptEdDown(e){
  var w = navScreenToWorld(e.clientX, e.clientY), p = PTED.sel;
  // красный кружок выбранной точки — куда смотреть
  if(p && Math.hypot(p.lx-w.x, p.ly-w.y) < 9/view.scale){ PTED.drag = {p:p, look:true}; return; }
  var hit = ptEdFind(w);
  if(hit){ PTED.sel = hit; PTED.drag = {p:hit, look:false, dx:hit.x-w.x, dy:hit.y-w.y, lx:hit.lx-hit.x, ly:hit.ly-hit.y, moved:false}; ptEdRefresh(); draw(); return; }
  PTED.sel = null; ptEdRefresh(); draw();
}
cv.addEventListener("dblclick", function(e){
  if(!chkPtEd.checked) return;
  var w = navScreenToWorld(e.clientX, e.clientY); if(ptEdFind(w)) return;
  var f = ptEdEl("ptEdShow").value, P = pointsGet(), k = 1; P.forEach(function(p){ var m = /^p(\d+)$/.exec(p.id); if(m) k = Math.max(k, +m[1]+1); });
  var a = teamAreaOf(w), p = {id:"p"+k, x:Math.round(w.x*10)/10, y:Math.round(w.y*10)/10, lx:Math.round(w.x*10)/10 + 120, ly:Math.round(w.y*10)/10, side: f === "T" ? "T" : "CT", area: a || ""};
  P.push(p); PTED.sel = p; ptEdTouched(p); draw();
});
window.addEventListener("mousemove", function(e){
  if(!chkPtEd.checked) return;
  var w = navScreenToWorld(e.clientX, e.clientY);
  PTED.hover = w;
  var D = PTED.drag; if(!D) return;
  if(D.look){ D.p.lx = Math.round(w.x*10)/10; D.p.ly = Math.round(w.y*10)/10; }
  else { D.p.x = Math.round((w.x+D.dx)*10)/10; D.p.y = Math.round((w.y+D.dy)*10)/10; D.p.lx = D.p.x + D.lx; D.p.ly = D.p.y + D.ly; }
  D.moved = true; draw();
});
window.addEventListener("mouseup", function(){ var D = PTED.drag; PTED.drag = null; if(D && (D.moved || D.look)) ptEdTouched(D.p); });
window.addEventListener("keydown", function(e){
  if(!chkPtEd.checked || !PTED.sel) return;
  var tg = e.target && e.target.tagName; if(tg === "INPUT" || tg === "TEXTAREA" || tg === "SELECT") return;
  if(e.key === "Delete" || e.key === "Backspace"){ ptEdDelete(); e.preventDefault(); }
});
function ptEdDelete(){ var P = pointsGet(), i = P.indexOf(PTED.sel); if(i < 0) return; P.splice(i, 1); PTED.sel = null; ptEdTouched(null); draw(); }
chkPtEd.addEventListener("change", function(){ ptEdPanel.style.display = chkPtEd.checked ? "block" : "none"; if(chkPtEd.checked){ chkLineups.checked = false; lineupPanel.style.display = "none"; } PTED.sel = null; ptEdRefresh(); draw(); });
ptEdEl("ptEdShow").addEventListener("change", function(){ PTED.sel = null; ptEdRefresh(); draw(); });
ptEdEl("ptEdSide").addEventListener("change", function(){ if(PTED.sel){ PTED.sel.side = this.value; ptEdTouched(null); draw(); } });
ptEdEl("ptEdArea").addEventListener("change", function(){ if(PTED.sel){ PTED.sel.area = this.value; ptEdTouched(null); draw(); } });
ptEdEl("ptEdDel").addEventListener("click", ptEdDelete);
ptEdEl("ptEdSave").addEventListener("click", function(){ clearTimeout(PTED.timer); ptEdSave(); });
ptEdEl("ptEdExport").addEventListener("click", function(){ var a = ptEdEl("ptEdOut"); a.style.display = "block"; a.value = JSON.stringify({v:1, pts:ptEdPack()}); a.select(); try{ document.execCommand("copy"); }catch(e){} });
ptEdEl("ptEdRevert").addEventListener("click", function(){
  if(!confirm("Вернуть точки из кода? Правки на странице пропадут (в базе тоже).")) return;
  pointsSet(POINTS_CODE.pts, "код"); PTED.sel = null; PTED.dirty = true; ptEdSave(); ptEdRefresh(); draw(); });
// база страницы: точки владельца — в игру (с нового раунда)
if(window.claude && claude.use){
  claude.use("db").then(function(db){ if(!db) return; PTED.db = db;
    db.collection("points").onSnapshot(function(snap){
      var d = snap.docs.filter(function(x){ return x.id === "map"; })[0]; if(!d) { ptEdRefresh(); return; }
      var v = d.data(); if(v && v.t && v.t !== PTED.lastT){ PTED.lastT = v.t; PTED.savedAt = new Date(v.t).toLocaleTimeString("ru-RU"); pointsFromDb(v); }
      ptEdRefresh();
    }, function(){ PTED.db = null; ptEdRefresh(); });
  });
}
ptEdRefresh();
