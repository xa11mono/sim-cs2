// ======================= v198: редактор карты для владельца (19_map_editor.js) =======================
// Галочка «правка карты» → панель с вкладками. Сейчас одна вкладка — «стены»;
// «высоты», «укрытия», «прострелы» добавляются так же: mapEdAddTab({...}).
// Общее у всех вкладок: панель, отмена (Ctrl+Z и кнопка, несколько шагов),
// сохранение в базу страницы (коллекция `map`, у каждой вкладки свой документ),
// «вернуть как в коде». У каждой вкладки свой слой данных.
// Всё состояние редактора — в MAPED; в снимок игры (отметки, перемотка) оно
// не попадает (src/build.py, список UI).
var MAPED = {
  on: false, tab: null, tabs: {}, order: [],
  undo: [], UNDO_MAX: 80,       // [{tab, data}] — общая отмена для всех вкладок
  pending: null,                // данные вкладки до начала действия (перетаскивание)
  db: null, dbState: "wait",    // wait | none | ok
  src: {},                      // tab → {from: "code"|"page", t}
  save: {},                     // tab → {state: "idle"|"queued"|"saving"|"ok"|"fail", t, err}
  saveTimer: {}
};
function mapEdOn(){ return !!(MAPED && MAPED.on); }
function mapEdEl(id){ return document.getElementById(id); }
function mapEdTab(){ return MAPED.tabs[MAPED.tab]; }
function mapEdClone(v){ return JSON.parse(JSON.stringify(v)); }

// ---------- вкладки ----------
// tab = { id, label, doc (имя документа в коллекции map),
//   get() → данные слоя, set(data) → применить в игре, code() → данные из кода,
//   toDoc(data) → тело документа, fromDoc(body) → данные или null (если битые),
//   render(body) — нарисовать свою часть панели, refresh() — обновить её,
//   down(w, e) → true, если клик забран; move(w, e); up(w, e); key(e) → true, если клавиша забрана;
//   draw() — рисунок поверх радара; reset() — сброс выделения/режима }
function mapEdAddTab(t){ MAPED.tabs[t.id] = t; MAPED.order.push(t.id); MAPED.src[t.id] = {from: "code"}; MAPED.save[t.id] = {state: "idle"}; if(!MAPED.tab) MAPED.tab = t.id; }

// ---------- общая отмена ----------
// перед действием: mapEdBegin(); после — mapEdCommit(): шаг отмены пишется,
// только если данные правда поменялись (клик без сдвига шага не оставляет)
function mapEdBegin(){ MAPED.pending = {tab: MAPED.tab, data: mapEdClone(mapEdTab().get())}; }
function mapEdCommit(){
  var p = MAPED.pending; MAPED.pending = null;
  if(!p) return;
  var t = MAPED.tabs[p.tab];
  if(JSON.stringify(p.data) === JSON.stringify(t.get())) return;
  MAPED.undo.push(p); if(MAPED.undo.length > MAPED.UNDO_MAX) MAPED.undo.shift();
  t.set(t.get());           // полная пересборка игры по новым данным
  mapEdChanged(t.id);
}
// одним шагом: сделать правку fn() и записать её в отмену
function mapEdDo(fn){ mapEdBegin(); fn(); mapEdCommit(); }
function mapEdUndo(){
  var u = MAPED.undo.pop(); if(!u) return;
  var t = MAPED.tabs[u.tab];
  if(t.reset) t.reset();
  t.set(u.data);
  if(MAPED.tab !== u.tab) mapEdSwitch(u.tab);
  mapEdChanged(u.tab);
}
function mapEdChanged(tabId){
  // вернулись ровно к данным из кода (например, отменой) — значит, «из кода»
  var t = MAPED.tabs[tabId], same = JSON.stringify(t.get()) === JSON.stringify(t.code());
  MAPED.src[tabId] = same ? {from: "code"} : {from: "page", t: Date.now()};
  mapEdQueueSave(tabId);
  mapEdRefresh();
}

// ---------- база страницы ----------
function mapEdQueueSave(tabId){
  var S = MAPED.save[tabId];
  if(MAPED.dbState !== "ok"){ S.state = MAPED.dbState === "wait" ? "queued" : "idle"; return; }
  S.state = "queued";
  clearTimeout(MAPED.saveTimer[tabId]);
  MAPED.saveTimer[tabId] = setTimeout(function(){ mapEdSaveNow(tabId); }, 1000);
}
function mapEdSaveNow(tabId){
  var t = MAPED.tabs[tabId], S = MAPED.save[tabId], src = MAPED.src[tabId];
  if(!MAPED.db) return;
  S.state = "saving"; mapEdRefresh();
  var p;
  try{
    var ref = MAPED.db.collection("map").doc(t.doc);
    if(src.from === "code") p = ref.delete();
    else { var body = t.toDoc(t.get()); body.t = src.t || Date.now(); p = ref.set(body); }
  }catch(e){ p = Promise.reject(e); }
  Promise.resolve(p).then(function(){ S.state = "ok"; S.t = Date.now(); S.err = null; mapEdRefresh(); },
    function(e){ S.state = "fail"; S.err = (e && (e.code || e.message)) || "ошибка"; mapEdRefresh(); });
}
function mapEdLoadFromDb(){
  MAPED.order.forEach(function(id){
    var t = MAPED.tabs[id];
    var p;
    try{ p = MAPED.db.collection("map").doc(t.doc).get(); }catch(e){ p = Promise.reject(e); }
    Promise.resolve(p).then(function(snap){
      // владелец уже успел поправить до ответа базы — его правка главнее
      if(MAPED.save[id].state === "queued"){ mapEdQueueSave(id); return; }
      if(!snap || !snap.exists) return;
      var data = null;
      try{ data = t.fromDoc(snap.data()); }catch(e){ data = null; }
      if(!data) return;
      t.set(data);
      var tt = +(snap.data() || {}).t;
      MAPED.src[id] = {from: "page", t: tt > 0 ? tt : null};
      logEvent("Карта: " + t.label + " — правка с этой страницы" + (tt > 0 ? " от " + mapEdDate(tt) : ""), "round");
      mapEdRefresh();
    }, function(){ MAPED.save[id] = {state: "fail", err: "не удалось прочитать базу"}; mapEdRefresh(); });
  });
}
function mapEdDate(t){
  var d = new Date(t), z = function(n){ return (n < 10 ? "0" : "") + n; };
  return z(d.getDate()) + "." + z(d.getMonth()+1) + " " + z(d.getHours()) + ":" + z(d.getMinutes());
}
function mapEdResetToCode(){
  var t = mapEdTab();
  mapEdBegin();
  if(t.reset) t.reset();
  t.set(t.code());
  var p = MAPED.pending; MAPED.pending = null;
  if(JSON.stringify(p.data) !== JSON.stringify(t.get())){ MAPED.undo.push(p); if(MAPED.undo.length > MAPED.UNDO_MAX) MAPED.undo.shift(); }
  MAPED.src[t.id] = {from: "code"};
  mapEdQueueSave(t.id);       // в базе документ удаляется → при загрузке берётся код
  mapEdRefresh();
}

// ---------- панель ----------
function mapEdSetOn(on){
  MAPED.on = !!on;
  mapEdEl("chkMapEdit").checked = MAPED.on;
  mapEdEl("mapEdPanel").style.display = MAPED.on ? "block" : "none";
  var t = mapEdTab(); if(t && t.reset) t.reset();
  if(MAPED.on){ mapEdSwitch(MAPED.tab); if(typeof chkLineups !== "undefined" && chkLineups.checked){ chkLineups.checked = false; lineupPanel.style.display = "none"; } }
}
function mapEdSwitch(id){
  var old = mapEdTab(); if(old && old.reset) old.reset();
  MAPED.tab = id;
  var tabs = mapEdEl("mapEdTabs"); tabs.innerHTML = "";
  MAPED.order.forEach(function(k){
    var b = document.createElement("button"); b.textContent = MAPED.tabs[k].label;
    if(k === id) b.className = "on";
    b.addEventListener("click", function(){ mapEdSwitch(k); });
    tabs.appendChild(b);
  });
  var body = mapEdEl("mapEdBody"); body.innerHTML = "";
  mapEdTab().render(body);
  mapEdRefresh();
}
function mapEdRefresh(){
  if(!MAPED.tab || !mapEdEl("mapEdPanel")) return;
  var t = mapEdTab(), src = MAPED.src[t.id], S = MAPED.save[t.id];
  mapEdEl("mapEdSrc").textContent = "Сейчас в игре: " + (src.from === "page" ? "правка на странице" + (src.t ? " от " + mapEdDate(src.t) : "") : "из кода");
  mapEdEl("mapEdUndo").disabled = !MAPED.undo.length;
  mapEdEl("mapEdUndo").textContent = "Отменить" + (MAPED.undo.length ? " (" + MAPED.undo.length + ")" : "");
  var sv = mapEdEl("mapEdSave"), txt, cls = "med-save";
  if(MAPED.dbState === "none"){ txt = "Не сохраняется: страница открыта не на claude.ai. Правки действуют до перезагрузки."; cls += " warn"; }
  else if(MAPED.dbState === "wait") txt = "Подключаюсь к базе страницы…";
  else if(S.state === "queued") txt = "Сохраню через секунду…";
  else if(S.state === "saving") txt = "Сохраняю…";
  else if(S.state === "ok"){ txt = "Сохранено на странице · " + mapEdDate(S.t); cls += " ok"; }
  else if(S.state === "fail"){ txt = "Не удалось сохранить (" + S.err + ") — правка действует только до перезагрузки."; cls += " warn"; }
  else txt = "Правки сохраняются на странице сами, через секунду.";
  sv.textContent = txt; sv.className = cls;
  if(t.refresh) t.refresh();
}
function mapEdDraw(){ if(mapEdOn() && mapEdTab()) mapEdTab().draw(); }

// =========================== вкладка «стены» ===========================
// Слой данных — WALL_POLYS (01_map.js), формат src/data/walls.json.
var MED_W = { tool: "select", sel: -1, drag: null, rect: null, poly: [], cur: null };
function medWSet(data){
  var c = data.map(function(p){ return p.map(function(q){ return [q[0], q[1]]; }); });
  WALL_POLYS.length = 0; c.forEach(function(p){ WALL_POLYS.push(p); });
  if(MED_W.sel >= WALL_POLYS.length) MED_W.sel = -1;
  applyWalls(true);
}
function medWR(v){ return Math.round(v*10)/10; }
function medWArea(p){ var a = 0; for(var i=0;i<p.length;i++){ var b = p[(i+1)%p.length]; a += p[i][0]*b[1] - b[0]*p[i][1]; } return Math.abs(a)/2; }
function medWEdgeDist(p, x, y){
  var best = Infinity;
  for(var i=0;i<p.length;i++){ var a = p[i], b = p[(i+1)%p.length]; best = Math.min(best, distToSeg(x, y, [a[0],a[1],b[0],b[1]])); }
  return best;
}
// какая стена под курсором: сначала та, у которой край ближе всего (в пределах
// 8 px экрана), иначе самая маленькая из тех, внутри которых курсор
function medWHit(x, y){
  var tol = 8/view.scale, best = -1, bd = tol;
  WALL_POLYS.forEach(function(p, i){ var d = medWEdgeDist(p, x, y); if(d < bd){ bd = d; best = i; } });
  if(best >= 0) return best;
  var ba = Infinity;
  WALL_POLYS.forEach(function(p, i){ if(pointInPoly(x, y, p.map(function(q){ return {x:q[0], y:q[1]}; }))){ var a = medWArea(p); if(a < ba){ ba = a; best = i; } } });
  return best;
}
function medWVertexAt(i, x, y){
  if(i < 0 || !WALL_POLYS[i]) return -1;
  var tol = 9/view.scale, best = -1, bd = tol;
  WALL_POLYS[i].forEach(function(q, k){ var d = Math.hypot(q[0]-x, q[1]-y); if(d < bd){ bd = d; best = k; } });
  return best;
}
function medWEdgeAt(i, x, y){
  if(i < 0 || !WALL_POLYS[i]) return -1;
  var p = WALL_POLYS[i], tol = 7/view.scale;
  for(var k=0;k<p.length;k++){ var a = p[k], b = p[(k+1)%p.length]; if(distToSeg(x, y, [a[0],a[1],b[0],b[1]]) < tol) return k; }
  return -1;
}
function medWDelete(){
  if(MED_W.sel < 0) return;
  var i = MED_W.sel;
  mapEdDo(function(){ WALL_POLYS.splice(i, 1); });
  MED_W.sel = -1; mapEdRefresh();
}
function medWFinishPoly(){
  var pts = MED_W.poly;
  if(pts.length >= 3) mapEdDo(function(){ WALL_POLYS.push(pts.map(function(q){ return [medWR(q[0]), medWR(q[1])]; })); MED_W.sel = WALL_POLYS.length-1; });
  MED_W.poly = []; mapEdRefresh();
}
var MED_W_HINTS = {
  select: "<b>Выбор.</b><ul><li>Клик по стене — выделить (жёлтая).</li><li>Тащи выделенную стену — сдвинуть её целиком.</li><li>Тащи кружок-уголок — сдвинуть один угол.</li><li>Двойной клик по краю — новый уголок там.</li><li>Shift + клик по уголку — убрать уголок.</li><li>Delete — удалить стену.</li><li>Тащи пустое место — двигать карту.</li></ul>",
  rect: "<b>Прямоугольник.</b><ul><li>Зажми мышь в одном углу и протяни до другого — появится стена-прямоугольник.</li></ul>",
  poly: "<b>Многоугольник.</b><ul><li>Кликай по углам новой стены по порядку.</li><li>Клик по первой точке, двойной клик или Enter — готово.</li><li>Backspace — убрать последнюю точку, Esc — бросить.</li></ul>"
};
mapEdAddTab({
  id: "walls", label: "стены", doc: "walls",
  get: function(){ return WALL_POLYS; },
  set: medWSet,
  code: function(){ return mapEdClone(WALL_POLYS_CODE); },
  toDoc: function(d){ return {walls: mapEdClone(d)}; },
  fromDoc: function(b){
    var w = b && b.walls;
    if(!Array.isArray(w) || !w.length) return null;
    var ok = w.every(function(p){ return Array.isArray(p) && p.length >= 3 && p.every(function(q){ return Array.isArray(q) && isFinite(q[0]) && isFinite(q[1]); }); });
    return ok ? w.map(function(p){ return p.map(function(q){ return [+q[0], +q[1]]; }); }) : null;
  },
  reset: function(){ MED_W.drag = null; MED_W.rect = null; MED_W.poly = []; if(MED_W.sel >= WALL_POLYS.length) MED_W.sel = -1; },
  render: function(body){
    body.innerHTML = '<div class="med-tools">' +
      '<button data-t="select">Выбор</button><button data-t="rect">+ Прямоугольник</button><button data-t="poly">+ Многоугольник</button></div>' +
      '<div class="med-hint" id="medWHint"></div>' +
      '<div class="med-info" id="medWInfo"></div>' +
      '<div class="med-row"><button id="medWDel">Удалить стену</button></div>';
    body.querySelectorAll("[data-t]").forEach(function(b){ b.addEventListener("click", function(){
      MED_W.tool = b.getAttribute("data-t"); MED_W.poly = []; MED_W.rect = null; MED_W.drag = null; mapEdRefresh(); }); });
    mapEdEl("medWDel").addEventListener("click", medWDelete);
  },
  refresh: function(){
    var body = mapEdEl("mapEdBody"); if(!body || !mapEdEl("medWHint")) return;
    body.querySelectorAll("[data-t]").forEach(function(b){ b.className = b.getAttribute("data-t") === MED_W.tool ? "on" : ""; });
    mapEdEl("medWHint").innerHTML = MED_W_HINTS[MED_W.tool];
    var s = MED_W.sel >= 0 && WALL_POLYS[MED_W.sel];
    mapEdEl("medWInfo").textContent = "Стен на карте: " + WALL_POLYS.length + (s ? " · выделена: " + s.length + " уголков" : " · ничего не выделено") +
      (MED_W.tool === "poly" && MED_W.poly.length ? " · новая: " + MED_W.poly.length + " точек" : "");
    mapEdEl("medWDel").disabled = !s;
  },
  down: function(w, e){
    var x = w.x, y = w.y;
    if(MED_W.tool === "rect"){ MED_W.rect = {x0: x, y0: y, x1: x, y1: y}; return true; }
    if(MED_W.tool === "poly"){
      var P = MED_W.poly;
      if(P.length >= 3 && Math.hypot(P[0][0]-x, P[0][1]-y) < 10/view.scale){ medWFinishPoly(); return true; }
      if(e.detail >= 2 && P.length >= 3){ medWFinishPoly(); return true; }
      if(!P.length || Math.hypot(P[P.length-1][0]-x, P[P.length-1][1]-y) > 2/view.scale) P.push([x, y]);
      mapEdRefresh(); return true;
    }
    // выбор
    var s = MED_W.sel, vi = medWVertexAt(s, x, y);
    if(vi >= 0){
      if(e.shiftKey){ if(WALL_POLYS[s].length > 3) mapEdDo(function(){ WALL_POLYS[s].splice(vi, 1); }); mapEdRefresh(); return true; }
      mapEdBegin(); MED_W.drag = {kind: "vertex", i: s, k: vi}; return true;
    }
    if(e.detail >= 2){
      var ek = medWEdgeAt(s, x, y);
      if(ek >= 0){ mapEdDo(function(){ WALL_POLYS[s].splice(ek+1, 0, [medWR(x), medWR(y)]); }); mapEdRefresh(); return true; }
    }
    var hit = medWHit(x, y);
    MED_W.sel = hit; mapEdRefresh();
    if(hit < 0) return false;          // пустое место — двигаем карту, как обычно
    mapEdBegin(); MED_W.drag = {kind: "move", i: hit, x: x, y: y, orig: mapEdClone(WALL_POLYS[hit])};
    return true;
  },
  move: function(w){
    MED_W.cur = [w.x, w.y];
    var d = MED_W.drag;
    if(MED_W.rect){ MED_W.rect.x1 = w.x; MED_W.rect.y1 = w.y; return; }
    if(!d) return;
    if(d.kind === "vertex"){ WALL_POLYS[d.i][d.k] = [medWR(w.x), medWR(w.y)]; applyWalls(false); }
    else if(d.kind === "move"){
      var dx = w.x - d.x, dy = w.y - d.y;
      WALL_POLYS[d.i] = d.orig.map(function(q){ return [medWR(q[0]+dx), medWR(q[1]+dy)]; });
      applyWalls(false);
    }
  },
  up: function(w){
    if(MED_W.rect){
      var r = MED_W.rect; MED_W.rect = null;
      var x0 = medWR(Math.min(r.x0, r.x1)), x1 = medWR(Math.max(r.x0, r.x1)), y0 = medWR(Math.min(r.y0, r.y1)), y1 = medWR(Math.max(r.y0, r.y1));
      if(x1-x0 >= 3 && y1-y0 >= 3) mapEdDo(function(){ WALL_POLYS.push([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]); MED_W.sel = WALL_POLYS.length-1; });
      mapEdRefresh(); return;
    }
    if(MED_W.drag){ MED_W.drag = null; mapEdCommit(); }
  },
  key: function(e){
    if((e.key === "Delete" || e.key === "Backspace") && MED_W.tool === "select" && MED_W.sel >= 0){ medWDelete(); return true; }
    if(MED_W.tool === "poly"){
      if(e.key === "Enter"){ medWFinishPoly(); return true; }
      if(e.key === "Escape"){ MED_W.poly = []; mapEdRefresh(); return true; }
      if(e.key === "Backspace"){ MED_W.poly.pop(); mapEdRefresh(); return true; }
    }
    if(e.key === "Escape"){ MED_W.sel = -1; mapEdRefresh(); return true; }
    return false;
  },
  draw: function(){
    var S = view.scale, path = function(p){ ctx.beginPath(); p.forEach(function(q, k){ if(k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); };
    ctx.lineJoin = "round";
    WALL_POLYS.forEach(function(p, i){
      if(i === MED_W.sel) return;
      path(p); ctx.fillStyle = "rgba(193,88,79,0.22)"; ctx.fill();
      ctx.strokeStyle = "rgba(225,95,85,0.95)"; ctx.lineWidth = 2/S; ctx.stroke();
    });
    var s = MED_W.sel >= 0 && WALL_POLYS[MED_W.sel];
    if(s){
      path(s); ctx.fillStyle = "rgba(255,215,90,0.28)"; ctx.fill();
      ctx.strokeStyle = "rgba(255,215,90,1)"; ctx.lineWidth = 2.5/S; ctx.stroke();
      if(MED_W.tool === "select") s.forEach(function(q, k){
        ctx.beginPath(); ctx.arc(q[0], q[1], 5/S, 0, Math.PI*2);
        ctx.fillStyle = MED_W.drag && MED_W.drag.kind === "vertex" && MED_W.drag.k === k ? "#fff" : "rgba(255,215,90,1)"; ctx.fill();
        ctx.strokeStyle = "rgba(20,20,10,0.9)"; ctx.lineWidth = 1.2/S; ctx.stroke();
      });
    }
    ctx.setLineDash([6/S, 4/S]); ctx.strokeStyle = "rgba(120,230,140,1)"; ctx.lineWidth = 2/S;
    if(MED_W.rect){ var r = MED_W.rect; ctx.strokeRect(Math.min(r.x0,r.x1), Math.min(r.y0,r.y1), Math.abs(r.x1-r.x0), Math.abs(r.y1-r.y0)); }
    var P = MED_W.poly;
    if(P.length){
      ctx.beginPath(); P.forEach(function(q, k){ if(k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
      if(MED_W.cur) ctx.lineTo(MED_W.cur[0], MED_W.cur[1]);
      ctx.stroke();
      P.forEach(function(q, k){ ctx.beginPath(); ctx.arc(q[0], q[1], (k ? 4 : 6)/S, 0, Math.PI*2); ctx.fillStyle = "rgba(120,230,140,1)"; ctx.fill(); });
    }
    ctx.setLineDash([]); ctx.lineJoin = "miter";
  }
});

// ---------- мышь и клавиши (только когда редактор включён) ----------
// левая кнопка — вкладке; если она клик не забрала (пустое место), событие
// уходит дальше — карта двигается, как обычно. Правая кнопка — всегда карта.
cv.addEventListener("mousedown", function(e){
  if(!mapEdOn() || e.button !== 0) return;
  if(mapEdTab().down(navScreenToWorld(e.clientX, e.clientY), e)){ e.stopImmediatePropagation(); e.preventDefault(); }
}, true);
window.addEventListener("mousemove", function(e){ if(mapEdOn()) mapEdTab().move(navScreenToWorld(e.clientX, e.clientY), e); });
window.addEventListener("mouseup", function(e){ if(mapEdOn()) mapEdTab().up(navScreenToWorld(e.clientX, e.clientY), e); });
window.addEventListener("keydown", function(e){
  if(!mapEdOn()) return;
  // в полях ввода клавиши не перехватываем (галочки и кнопки — не поля)
  var tg = e.target && e.target.tagName; if((tg === "INPUT" && !/^(checkbox|radio|button)$/.test(e.target.type)) || tg === "TEXTAREA" || tg === "SELECT") return;
  if((e.ctrlKey || e.metaKey) && (e.code === "KeyZ" || e.key === "z" || e.key === "я")){ mapEdUndo(); e.preventDefault(); e.stopImmediatePropagation(); return; }
  if(mapEdTab().key(e)){ e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
mapEdEl("chkMapEdit").addEventListener("change", function(){
  if(this.checked){ mapEdSetOn(true); setMode("mapEdit"); } else { mapEdSetOn(false); setMode(null); }
});
mapEdEl("mapEdUndo").addEventListener("click", mapEdUndo);
mapEdEl("mapEdReset").addEventListener("click", function(){
  if(!confirm("Убрать все правки вкладки «" + mapEdTab().label + "» и вернуть как в коде? (Можно отменить кнопкой «Отменить».)")) return;
  mapEdResetToCode();
});

// ---------- подключение к базе страницы при загрузке ----------
(function(){
  if(!(window.claude && claude.use)){ MAPED.dbState = "none"; mapEdRefresh(); return; }
  try{
    Promise.resolve(claude.use("db")).then(function(db){
      if(!db){ MAPED.dbState = "none"; mapEdRefresh(); return; }
      MAPED.db = db; MAPED.dbState = "ok";
      mapEdLoadFromDb();
      mapEdRefresh();
    }, function(){ MAPED.dbState = "none"; mapEdRefresh(); });
  }catch(e){ MAPED.dbState = "none"; }
})();
mapEdRefresh();
