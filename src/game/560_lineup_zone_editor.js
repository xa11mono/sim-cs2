// ---- редактор лайнапов ----
var chkLineups = document.getElementById("chkLineups"), lineupPanel = document.getElementById("lineupPanel");
var luPending = null, luHover = null;
var LU_COL = {smoke:"rgba(200,205,210,0.95)", flash:"rgba(255,240,150,0.95)", molly:"rgba(255,140,60,0.95)", he:"rgba(150,230,120,0.95)"};
// встроенные гранаты — то, что боты кидают сами (цели считаются так же, как в
// nadeBrains/комбо); "откуда" — примерная точка, где обычно стоит бросающий
function builtinLineups(){
  if(!GEO.A || !GEO.B) return [];
  var out = [], mid = function(a, b2, f){ f = f == null ? 0.5 : f; return {x:a.x+(b2.x-a.x)*f, y:a.y+(b2.y-a.y)*f}; };
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
  zsRebuildTimer = setTimeout(function(){ zsRebuildTimer = null; spotCache = {}; _zbnCache = {}; applyZoneLayer(true); draw(); }, 150);
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
  zoneNameInput2.value = ZONE_NAMES[id] || ""; zoneNameInput2.placeholder = zoneUserName(id) || MAP.ui.zoneNameHint;
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
  if(e.button === 0 && showZones.checked && !chkNavWarp.checked && !chkZoneEdit.checked &&
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
  if(chkZoneAlign.checked){  } else if(chkZoneAlign.checked){
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

