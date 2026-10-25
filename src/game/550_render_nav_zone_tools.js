// ---------- render ----------
var cv = document.getElementById("cv"), ctx = cv.getContext("2d");
var wrap = document.getElementById("main");
var img = new Image(); var imgReady=false; var imgFailed=false;
img.onload = function(){ imgReady = true; };
img.onerror = function(){ imgFailed = true; };
// фон вшит прямо в файл (data URI), чтобы страница работала и как отдельный скачанный .html
img.src = MAP.radar;

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
var WHY_POST = [[/^mid:back/,"мид: отошёл (их больше)"],[/^repos:finish/,"добивает раненого"],[/^repos:coverblind/,"держит угол слепого тиммейта"],[/^coverplant/,"прикрывает ставящего"],[/^bombwatch/,"держит упавшую бомбу"],[/^postplant:split/,"пост-плант, другой угол"],[/^clutch:(.*)/,"клатч: играет $1"],[/^rebal/,"сменил угол: вход держат"],[/^midcover:go/,"идёт на мид (мидер погиб)"],[/^midcover/,"держит мид вместо мидера"],[/^postplant:time:(.+)/,"играет на время: $1"],[/^postplant:time/,"играет на время"],[/^repos:lowhp/,"мало HP — к своим"],[/^repos:rlcover/,"перезарядка за укрытием"],[/^repos:assist/,"дабл-пик с тиммейтом"],[/^repos:reload/,"пикает на перезарядку"],[/^rotateHold/,"ждёт ретейк (их больше)"],[/^earlyPeek/,"ранний пик за инфой"],[/^repos:killmove/,"после фрага — в укрытие"],[/^repos:swing/,"добирает после фрага"],[/^anchor2/,"второй на сайте"],[/^anchor/,"опорник"],[/^mid/,"мид"],[/^rotat/,"ротатор"],[/^rotate/,"ротация"],
  [/^stack/,"стак"],[/^stage/,"сбор перед выходом"],[/^probePair/,"напарник пробы"],[/^probe/,"проба за инфой"],[/^lurk/,"лурк"],[/^route:(.*)/,"идёт: $1"],
  [/^siteholdA?B?:?(.*)/,"держит сайт $1"],[/^clear/,"зачистка сайта"],[/^tradeR/,"РАЗМЕН"],[/^trade/,"прикрывает вход"],
  [/^flee/,"уходит от бомбы"],[/^save/,"сейв"],[/^retakeEntry/,"ретейк: заходит первым"],[/^retakeCover/,"ретейк: дефузит за первым"],[/^retake/,"ретейк"],[/^defuse/,"дефуз"],[/^postplant/,"пост-плант"],
  [/^endhunt/,"охота на последних"],[/^repos/,"меняет позицию"],[/^fake/,"фейк"],[/^shift/,"смещается"],[/^awpline/,"AWP линия"],
  [/^pickup/,"за оружием"],[/^plantspot/,"плант"],[/^fetch/,"за бомбой"],[/^antidefuse/,"сбить дефуз"],[/^stopplant/,"сбить плант"],
  [/^contact:swing/,"выходит на врага рядом"],[/^contact:hold/,"держит, где враг рядом"],[/^gatherSolo/,"ретейк в одиночку: подход"],[/^gatherSite/,"у бомбы — ждёт своих на ретейк"],[/^utilWait/,"ждёт гранаты / размен у выхода"],[/^utilHold/,"ждёт за энтри"],[/^gather/,"сбор на ретейк"],[/^flank/,"фланг"],[/^lineup/,"идёт кидать гранату"],[/^smokeWait/,"ждёт у смока"],[/^tmid/,"мид T"],[/^cts:/,"сетап CT"]];
var WHY_LOOK = {contact:"держит свой контакт", team:"инфа команды (≤ 1 с)", pro:"угол про с этой точки", spam:"простреливает смок", look:"угроза", enemy:"видит врага", corner:"край угла впереди", cover:"держит второй угол за тиммейта", open:"свой на линии взгляда — смотрит в другую открытую сторону", flank:"фланг за тиммейтом", death:"туда, где убили своего", sweep:"чекает после смока", sound:"на звук", threat:"угроза", post:"свой угол", preaim:"по плану", roam:"проверяет точку",
  hunt:"ищет последнего", save:"сейв: проходы", fake:"фейк-дефуз", intel:"инфа", call:"колл", lkp:"где видели", habit:"привычка врага", belief:"вероятность"};
function whyText(b){
  var t = b.post ? b.post.tag : "", pt = "без задачи";
  for(var i=0;i<WHY_POST.length;i++){ var m = WHY_POST[i][0].exec(t); if(m){ pt = WHY_POST[i][1].replace("$1", (m[1]||"").replace(/^[AB]:?/,"")); break; } }
  if(t && pt === "без задачи") pt = t;
  if(b.planting) pt = "ставит бомбу"; if(b.defusing) pt = "дефузит";
  var lr = b.lookReason, lt = lr ? (WHY_LOOK[lr] || lr) : "по ходу движения";
  if(b._fc && b._fc.ph !== "line") pt = b._fc.ph === "off" ? "бой · ушёл с линии за укрытие" : "бой · выглядывает снова";
  // (v414, М154) на линии: стрейфит (держит врага) или бой «остывает»; (v415) у укрытия видит врага — снова на линии
  else if(b._fc) pt = "бой · на линии · " + (b._fc.own ? "стрейфит" : "не видит врага");
  else if(b.state === "engage") pt = "бой · на линии";
  else if(b.state === "hold") pt = "бой · держит угол";
  else if(b.state === "retreat") pt = "бой · отходит";
  if(tick - (b._fcSnap||-999) < TICK_HZ) pt += " · у укрытия видит врага — снова на линии";
  // (v414, М155) носитель бомбы: что мешает начать плант (plantBlock — то же условие, что в bombTick) и почему бросил
  if(bomb && bomb.state === "carried" && bomb.carrier === b && !b.planting && typeof teamTac !== "undefined" && teamTac.T){
    var pbr = plantBlock(b, teamTac.T, SITES[teamTac.T.site]);
    if(pbr && (pbr !== "не на сайте / не на месте про" || /^plantspot/.test(t))) pt += " · не ставит: " + pbr; }
  if(b._plantAbort && tick - b._plantAbort.t < 2*TICK_HZ) pt += " · бросил плант: " + b._plantAbort.why;
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
  if(chkAlign.checked || mapEdOn()) return;
  var w = navScreenToWorld(e.clientX, e.clientY);
  hoverZoneId = findZoneMapZoneAt(w.x, w.y);
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

var HIT_TOL_PX = 8;   // screen px, converted to world units by /view.scale (редактор зон)
var HANDLE_TOL_PX = 10;
function distToSeg(px,py, s){
  var x1=s[0],y1=s[1],x2=s[2],y2=s[3];
  var dx=x2-x1, dy=y2-y1;
  var len2 = dx*dx+dy*dy;
  var t = len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((px-x1)*dx+(py-y1)*dy)/len2));
  var cx = x1+t*dx, cy = y1+t*dy;
  return Math.hypot(px-cx, py-cy);
}
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
  if(which !== "zoneEdit" && chkZoneEdit.checked){ chkZoneEdit.checked = false; }
  if(which !== "mapEdit" && typeof MAPED !== "undefined" && MAPED.on) mapEdSetOn(false);
  if(which !== "zoneAlign" && chkZoneAlign.checked){ chkZoneAlign.checked = false; }
  zoneAlignPanel.style.display = chkZoneAlign.checked ? "block" : "none";
  alignPanel.style.display = chkAlign.checked ? "block" : "none";
  navWarpPanel.style.display = chkNavWarp.checked ? "block" : "none";
  zoneEditPanel.style.display = chkZoneEdit.checked ? "block" : "none";
  if(!chkZoneEdit.checked){ zoneDrawing=false; zoneDrawPts=[]; btnZoneFinish.disabled=true; selectedZoneId=null; updateZoneEditCount(); }
  cv.style.cursor = chkAlign.checked ? "move" : chkNavWarp.checked ? "crosshair" : chkZoneEdit.checked ? "default" : chkZoneAlign.checked ? "move" : "";
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
