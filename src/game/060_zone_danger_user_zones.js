// ---------- предрасчёт опасности (план §2) ----------
// "для каждой точки считаем множество других точек, которые её простреливают,
// один раз при загрузке карты (не каждый тик)". Гранулярность — именованные
// зоны из ZONEMAP (~60), а не ~2000 микро-областей навмеша: боты и будущие
// коллы (план §11) всё равно думают зонами ("вижу врага на zone31"), так что
// таблица опасности нужна на этом же уровне, не мельче.
// Известное упрощение: одна точка на зону (центроид) — у зон с вогнутой
// формой (например буквой Г вокруг угла) центроид иногда лежит не совсем
// точно, и такая зона может недосчитать пару LOS-связей у самой границы.
// Для целей взвешивания риска в слое 4/6 этого достаточно; если понадобится
// точнее — берём несколько сэмпл-точек на зону вместо одной.
function zoneMapCentroid(z){
  // (v319) середина зоны из набора карты (zones.centers — точка внутри зоны на её этаже, tools/zones_bake.py): у изогнутой
  // зоны среднее углов вылетает наружу и на чужой этаж (Mirage: Ladder Room → Underpass). Нет поля или зону перерисовали
  // так, что точка вне неё, — как раньше, среднее углов (у Ancient поля нет)
  var C = MAP.zones.centers && MAP.zones.centers[z.id];
  if(C){ var q = zlPt(C.x, C.y); if(pointInPoly(q.x, q.y, z.points)) return q; }
  var cx=0, cy=0;
  z.points.forEach(function(p){ cx+=p.x; cy+=p.y; });
  return { x: cx/z.points.length, y: cy/z.points.length };
}
var ZONE_CENTROIDS = {};
ZONEMAP.zones.forEach(function(z){ ZONE_CENTROIDS[z.id] = zoneMapCentroid(z); });

var ZONE_DANGER = {}; // zoneId -> [zoneId, ...] — из каких зон простреливается данная (симметрично)
// Несколько точек на зону (а не один центр): у длинной или изогнутой зоны
// центр мог стоять за углом, и реальные прострелы с её края не находились.
// Точки — сетка внутри полигона зоны (шаг подстраивается под размер, до
// DANGER_SAMPLES штук), плюс центр. Зона A простреливается из B, если хотя бы
// одна пара точек (a из A, b из B) видит друг друга. Заодно считается "сила"
// — доля видящих пар (0..1): зона, которая видна почти целиком, опаснее той,
// у которой виден только край. Для наведения мышью сохраняется пара точек,
// через которую нашли прострел, — её и рисуем линией.
var DANGER_SAMPLES = 10;
var ZONE_SAMPLES = {}, ZONE_DANGER_W = {}, ZONE_DANGER_LINE = {};
function sampleZone(z){
  var pts = z.points, minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  pts.forEach(function(p){ if(p.x<minX)minX=p.x; if(p.y<minY)minY=p.y; if(p.x>maxX)maxX=p.x; if(p.y>maxY)maxY=p.y; });
  var c = zoneMapCentroid(z), out = [];
  if(pointInPoly(c.x, c.y, pts) && !insideSolidWall(c.x, c.y)) out.push(c);
  var area = (maxX-minX)*(maxY-minY);
  var step = Math.max(22, Math.sqrt(area/DANGER_SAMPLES));
  var grid = [];
  for(var x=minX+step/2; x<maxX; x+=step) for(var y=minY+step/2; y<maxY; y+=step){
    if(pointInPoly(x, y, pts) && !insideSolidWall(x, y)) grid.push({x:x, y:y});
  }
  // равномерно прореживаем до лимита
  var need = DANGER_SAMPLES - out.length;
  if(grid.length <= need) out = out.concat(grid);
  else for(var i=0;i<need;i++) out.push(grid[Math.floor(i*grid.length/need)]);
  if(!out.length) out.push(c);
  return out;
}
function computeZoneDanger(){
  visReady();
  var zs = ZONEMAP.zones, ids = zs.map(function(z){ return z.id; });
  ids.forEach(function(id){ ZONE_DANGER[id] = []; ZONE_DANGER_W[id] = {}; ZONE_DANGER_LINE[id] = {}; });
  zs.forEach(function(z){ ZONE_SAMPLES[z.id] = sampleZone(z); });
  // (А5) по геометрии у точки зоны — этаж зоны (её высота z: Underpath под Short), иначе — верхний пол
  var zz = zs.map(function(z){ return m3() && z.z != null ? z.z : null; });
  for(var i=0;i<ids.length;i++){
    for(var j=i+1;j<ids.length;j++){
      var A = ZONE_SAMPLES[ids[i]], B = ZONE_SAMPLES[ids[j]], zA = zz[i], zB = zz[j];
      // (v243) видно ли — та же 3D-видимость, что в бою (visLine: стены, укрытия, пол/уступы, крыши),
      // глаза стоящего человека с обеих сторон; раньше — только плоские стены
      var seen = 0, first = null;
      for(var a=0;a<A.length;a++) for(var b=0;b<B.length;b++){
        var pa = A[a], pb = B[b];
        if(visLine(pa.x, pa.y, visFloorAt(pa.x, pa.y, zA) + VIS_EYE.stand, pb.x, pb.y, visFloorAt(pb.x, pb.y, zB) + VIS_EYE.stand, false)){ seen++; if(!first) first = [pa, pb]; }
      }
      if(seen > 0){
        var wgt = seen/(A.length*B.length);
        ZONE_DANGER[ids[i]].push(ids[j]); ZONE_DANGER[ids[j]].push(ids[i]);
        ZONE_DANGER_W[ids[i]][ids[j]] = wgt; ZONE_DANGER_W[ids[j]][ids[i]] = wgt;
        ZONE_DANGER_LINE[ids[i]][ids[j]] = [first[0], first[1]]; ZONE_DANGER_LINE[ids[j]][ids[i]] = [first[1], first[0]];
      }
    }
  }
}
computeZoneDanger(); // once at load, per plan §2 — not re-run every tick
var zoneLayerRebuildTimer = null;
function applyZoneLayer(heavy){
  applyZoneLayerToData();
  try{ localStorage.setItem(ZONE_LAYER_KEY, JSON.stringify(zoneLayer)); }catch(e){}
  // спавны: база — точки слоя (CT — сама точка ZONEMAP, T — исправленная)
  CT_SPAWN._baseX = CT_SPAWN.x; CT_SPAWN._baseY = CT_SPAWN.y;
  var tq = zlPt(T_SPAWN_FIX_RAW.x, T_SPAWN_FIX_RAW.y); T_SPAWN._baseX = tq.x; T_SPAWN._baseY = tq.y;
  if(!heavy){
    // тяжёлое (таблица опасности, сайты, маршруты) — с задержкой, пока тянешь мышью
    if(zoneLayerRebuildTimer) clearTimeout(zoneLayerRebuildTimer);
    zoneLayerRebuildTimer = setTimeout(function(){ zoneLayerRebuildTimer = null; applyZoneLayer(true); }, 300);
    return;
  }
  ZONEMAP.zones.forEach(function(z){ ZONE_CENTROIDS[z.id] = zoneMapCentroid(z); });
  computeZoneDanger();
  applyUserZones(); // пул точек, спавны (resnap), маршруты роумеров, сайты
  if(typeof beliefBuild === "function"){ beliefBuild(); beliefReset(); }
}
// walls block movement, not just sight — hasLOS above is line-of-sight only
// (bullets/visibility); this is the same wall geometry used as a physical
// obstacle for bot movement (see stepTick's wall-slide below).
function crossesWall(x1,y1,x2,y2){
  if(MAP3D) return !!m3SolidHit(x1, y1, x2, y2);   // (А5) по геометрии игры, стены радара — только рисование
  for(var i=0;i<wallSegs.length;i++){
    var s = wallSegs[i];
    if(segIntersect(x1,y1,x2,y2,s[0],s[1],s[2],s[3])) return true;
  }
  return false;
}

// ---------- deterministic PRNG (no Math.random in sim) ----------
function hashRand(seed){
  var t = seed += 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------- tactical points ----------
var pointsByName = {};
ZONEMAP.points.forEach(function(p){ pointsByName[p.name] = p; });
var CT_SPAWN = pointsByName[MAP.spawns.CT];
var T_SPAWN = pointsByName[MAP.spawns.T];
// Tspawn_7's stored point (1006,1892, from the Zone Editor) sits just past
// the traced map boundary near that corner — it was placed against the OLD
// wall trace, before the pen-tool correction pass, and never got moved with
// it (this confirms the earlier suspicion that the hand-drawn Zone Editor
// layer can drift out of sync with the walls once those get fixed up). Bots
// were spawning technically off the playable footprint. Re-anchored here to
// the centroid of the nearest actual navmesh polygon (id 1945) instead of
// trusting the stale hand-placed point — that's guaranteed-walkable ground
// truth, only ~32 units from the original, well inside the "Tspawn" zone.
var T_SPAWN_FIX_RAW = MAP.spawnFix.T;
T_SPAWN = (function(){ var q = zlPt(T_SPAWN_FIX_RAW.x, T_SPAWN_FIX_RAW.y); return { x: q.x, y: q.y, z: T_SPAWN.z||0, name: T_SPAWN.name }; })();
// pool = every placed tactical point except the two spawns — sparse right now
// (9 points total), grows as you place more in the editor; nothing else to change here.
var POINT_POOL = ZONEMAP.points.filter(function(p){ return p!==CT_SPAWN && p!==T_SPAWN; });

// ---------- user-drawn zones (спавны/сайты, рисуются прямо здесь, пером) ----------
// Больше не полагаемся на отдельный артефакт Zone Editor — его данные (ZONEMAP)
// оказались рассинхронизированы со стенами (см. историю T_SPAWN выше) и
// правятся отдельно от того, что реально видно на этом радаре. Вместо
// повторного экспорта/импорта между артефактами — зоны спавнов и сайтов
// теперь можно рисовать прямо тут, тем же Photoshop-style инструментом, что
// и стены (клик — выделить, тащи тело — двигать, тащи уголок/колесо —
// масштаб, "перо" — редактировать точки). CT/T-спавн зоны автоматически
// подставляют CT_SPAWN/T_SPAWN (мутируя объект НА МЕСТЕ — боты держат ссылку
// на него, поэтому подхватывают новую позицию без пересоздания), сайты и
// прочие именованные зоны добавляются в POINT_POOL как тактические точки.
var USER_ZONES = []; // {id, name, kind:'ctspawn'|'tspawn'|'sitea'|'siteb'|'custom', basePoints:[{x,y}], closed:true, dx,dy,scale}
var USER_ZONES_KEY = MAP.store + "-userzones-v1";
var userZonesSaveTimer = null;
function saveUserZonesDebounced(){
  if(userZonesSaveTimer) clearTimeout(userZonesSaveTimer);
  userZonesSaveTimer = setTimeout(function(){
    try{ localStorage.setItem(USER_ZONES_KEY, JSON.stringify(USER_ZONES)); }catch(e){}
  }, 250);
}
function loadUserZones(){
  try{
    var raw = localStorage.getItem(USER_ZONES_KEY);
    if(!raw) return;
    var arr = JSON.parse(raw);
    if(Array.isArray(arr)) USER_ZONES = arr;
  }catch(e){}
}
loadUserZones();
// исправление данных из браузера: зона сайта A была нарисована с типом "сайт B"
// (две зоны "сайт B", ни одной "сайт A") — та, что на левой половине карты, это A
(function(){
  if(USER_ZONES.some(function(z){ return z.kind === "sitea"; })) return;
  var fixed = false;
  USER_ZONES.forEach(function(z){
    if(z.kind !== "siteb" || !z.basePoints || !z.basePoints.length) return;
    var cx = 0; z.basePoints.forEach(function(p){ cx += p.x; }); cx /= z.basePoints.length;
    if(MAP.siteAFix && cx < MAP.siteAFix.maxX){ z.kind = "sitea"; fixed = true; }
  });
  if(fixed){ try{ localStorage.setItem(USER_ZONES_KEY, JSON.stringify(USER_ZONES)); }catch(e){} }
})();

// те же формулы, что objectAbsPoints/objectCentroid/objectHandlePos у стен,
// но без fromRaw/wallTransform — у зон нет отдельного "сырого" исходника с
// глобальной выравнивающей трансформацией, только свой dx/dy/scale вокруг
// собственного центра.
function zoneObjAbsPoints(obj){
  var src = obj.basePoints;
  var cx=0, cy=0;
  src.forEach(function(p){ cx+=p.x; cy+=p.y; });
  cx/=src.length; cy/=src.length;
  return src.map(function(p){
    return { x:(p.x-cx)*obj.scale+cx+obj.dx, y:(p.y-cy)*obj.scale+cy+obj.dy };
  });
}
function zoneObjCentroid(obj){
  var pts = zoneObjAbsPoints(obj);
  var cx=0, cy=0;
  pts.forEach(function(p){ cx+=p.x; cy+=p.y; });
  return {x:cx/pts.length, y:cy/pts.length};
}
function zoneObjHandlePos(obj){
  var pts = zoneObjAbsPoints(obj);
  var maxX=-Infinity, maxY=-Infinity;
  pts.forEach(function(p){ if(p.x>maxX)maxX=p.x; if(p.y>maxY)maxY=p.y; });
  return {x:maxX, y:maxY};
}
function zoneBakeObjectTransform(obj){
  if(obj.dx!==0 || obj.dy!==0 || obj.scale!==1){
    obj.basePoints = zoneObjAbsPoints(obj);
    obj.dx = 0; obj.dy = 0; obj.scale = 1;
  }
}
var ZONE_KIND_LABELS = { ctspawn:"CT-спавн", tspawn:"T-спавн", sitea:"Сайт A", siteb:"Сайт B", roam_ct:"роум CT", roam_t:"роум T", custom:"своя точка" };
var ZONE_KIND_COLORS = {
  roam_ct: "rgba(120,200,255,0.9)", roam_t: "rgba(255,200,110,0.9)",
  ctspawn: "rgba(90,155,217,0.9)", tspawn: "rgba(232,150,70,0.9)",
  sitea: "rgba(232,90,90,0.9)", siteb: "rgba(200,90,232,0.9)", custom: "rgba(148,180,73,0.9)"
};
// применяет текущие USER_ZONES к игровому состоянию: спавны мутируются НА
// МЕСТЕ (см. комментарий выше), остальные (сайты/своё) — дописываются в
// POINT_POOL после исходных ZONEMAP.points, не трогая их.
var POINT_POOL_ZONEMAP_LEN = POINT_POOL.length;
function applyUserZones(){
  POINT_POOL.length = POINT_POOL_ZONEMAP_LEN;
  [CT_SPAWN, T_SPAWN].forEach(function(sp){
    if(sp._baseX === undefined){ sp._baseX = sp.x; sp._baseY = sp.y; }
    sp._wantX = sp._baseX; sp._wantY = sp._baseY;
  });
  USER_ZONES.forEach(function(z){
    if(!z.basePoints.length) return;
    var c = zoneObjCentroid(z);
    if(z.kind === "ctspawn"){ CT_SPAWN._wantX = c.x; CT_SPAWN._wantY = c.y; }
    else if(z.kind === "tspawn"){ T_SPAWN._wantX = c.x; T_SPAWN._wantY = c.y; }
    else if(z.kind === "roam_ct" || z.kind === "roam_t"){ /* маршрут роумера — не в общий пул, см. buildRoamRoutes */ }
    else { POINT_POOL.push({ name: z.name || ZONE_KIND_LABELS[z.kind], x: c.x, y: c.y, z: 0 }); }
  });
  resnapSpawns();
  if(ROAM_READY){ buildRoamRoutes(); buildSites(); }
}
var ROAM_READY = false; // становится true после инициализации модуля роумера (ниже, после создания ботов)
// спавн внутри стены → ближайшее проходимое место. Желаемая точка хранится
// отдельно (_baseX — исходная, _wantX — с учётом нарисованной зоны спавна),
// чтобы при следующей правке стен пересчитывать от неё, а не от уже сдвинутой.
function resnapSpawns(){
  [CT_SPAWN, T_SPAWN].forEach(function(sp){
    var s2 = snapToWalkable(sp._wantX, sp._wantY);
    sp.x = s2.x; sp.y = s2.y;
  });
}
function spawnPosFor(sp, ox, oy){
  // разброс ботов вокруг точки спавна не должен выталкивать их за стену
  var x = sp.x+ox, y = sp.y+oy;
  if(insideSolidWall(x,y) || segCrossesManualWalls(sp.x,sp.y,x,y)) return {x:sp.x, y:sp.y};
  return {x:x, y:y};
}
applyUserZones();

