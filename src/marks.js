// ======================= v167: «Отметить момент», перемотка (v397: без разбора нейросетью — М147) =======================
// Инструмент для владельца и Claude, мозг ботов не трогает. Описание — docs/tasks/02-mark-moment.md.
// Снимки состояния: __SNAP (список переменных симулятора) генерирует src/marks_build.py при сборке (build.py, mkpub.py).
  var MK = { cps: [], snap: null, cur: null, list: [], db: null, assets: null, busy: false,
             lastCpTick: -1, cpMatch: -1, pick: false, CP_EVERY: 640, CP_KEEP: 40 };
  var MK_CATS = ["Взгляд", "Позиция", "Команда", "Гранаты", "Закуп", "Темп", "Войс", "Визуал"];
  var MK_SEC = {"Взгляд":"В", "Позиция":"П", "Команда":"К", "Гранаты":"Г", "Закуп":"Э", "Темп":"Т", "Войс":"Н", "Визуал":"И"};

// ---------- снимки и перемотка ----------
function mkSnapList(){
  if(MK.snap) return MK.snap;
  MK.snap = __SNAP.filter(function(e){
    if(/^SND/.test(e[0])) return false;   // (v324) звук — только показ, в нём AudioContext (не копируется) — в снимок не идёт
    try{ var v = e[1]();
      if(typeof v === "function") return false;
      if(v && typeof v === "object" && (v.nodeType || v instanceof CanvasRenderingContext2D || v instanceof HTMLImageElement)) return false;
      return true;
    }catch(err){ return false; } });
  return MK.snap;
}
function mkSnapshot(){ var o = {}; mkSnapList().forEach(function(e){ o[e[0]] = e[1](); }); return structuredClone(o); }
function mkRestore(data){ var c = structuredClone(data); mkSnapList().forEach(function(e){ if(e[0] in c) e[2](c[e[0]]); }); }
// (v175) снимок → текст и обратно, чтобы хранить его в отметке файлом. В снимке
// объекты ссылаются друг на друга (бот → цель → бот), поэтому каждый объект
// записывается один раз, а ссылки — номером. Сохраняются Map/Set, массивы чисел,
// регулярные выражения, NaN/Infinity/-0/undefined — ровно то, что умеет structuredClone.
function mkPack(root){
  var ids = new Map(), objs = [];
  function num(v){ return v !== v ? {n:"NaN"} : v === Infinity ? {n:"I"} : v === -Infinity ? {n:"-I"} : (v === 0 && 1/v < 0) ? {n:"-0"} : v; }
  function enc(v){
    if(v === undefined) return {u:1};
    if(typeof v === "number") return num(v);
    if(v === null || typeof v !== "object") return v;
    if(ids.has(v)) return {r:ids.get(v)};
    var id = objs.length, o, i; ids.set(v, id); objs.push(null);
    if(Array.isArray(v)){ o = {a:[]}; for(i = 0; i < v.length; i++) o.a.push(enc(v[i])); }
    else if(v instanceof Map){ o = {m:[]}; v.forEach(function(x, k){ o.m.push([enc(k), enc(x)]); }); }
    else if(v instanceof Set){ o = {s:[]}; v.forEach(function(x){ o.s.push(enc(x)); }); }
    else if(ArrayBuffer.isView(v)){ o = {t:v.constructor.name, d:[]}; for(i = 0; i < v.length; i++) o.d.push(num(v[i])); }
    else if(v instanceof Date){ o = {dt:+v}; }
    else if(v instanceof RegExp){ o = {re:[v.source, v.flags]}; }
    else { o = {o:{}}; for(var k in v) if(Object.prototype.hasOwnProperty.call(v, k)) o.o[k] = enc(v[k]); }
    objs[id] = o; return {r:id};
  }
  var root2 = enc(root);
  return JSON.stringify({v:1, root:root2, objs:objs});
}
function mkUnpack(text){
  var P = JSON.parse(text), objs = P.objs;
  var made = objs.map(function(o){
    return o.a ? new Array(o.a.length) : o.m ? new Map() : o.s ? new Set() : o.t ? new self[o.t](o.d.length) : o.dt != null ? new Date(o.dt) : o.re ? new RegExp(o.re[0], o.re[1]) : {};
  });
  function dec(v){
    if(v === null || typeof v !== "object") return v;
    if(v.r != null) return made[v.r];
    if(v.u) return undefined;
    return v.n === "NaN" ? NaN : v.n === "I" ? Infinity : v.n === "-I" ? -Infinity : -0;
  }
  objs.forEach(function(o, i){ var t = made[i], j;
    if(o.a) for(j = 0; j < o.a.length; j++) t[j] = dec(o.a[j]);
    else if(o.m) o.m.forEach(function(e){ t.set(dec(e[0]), dec(e[1])); });
    else if(o.s) o.s.forEach(function(e){ t.add(dec(e)); });
    else if(o.t) for(j = 0; j < o.d.length; j++) t[j] = dec(o.d[j]);
    else if(o.o) for(var k in o.o) t[k] = dec(o.o[k]);
  });
  return dec(P.root);
}
// открыть момент из снимка отметки: вся игра ровно как в момент нажатия
function mkOpenSnap(text){
  mkRestore(mkUnpack(text));
  paused = true; MK.cps = []; MK.cpMatch = matchNum; MK.lastCpTick = -1;
}
// «отпечаток» настроек: если стены/зоны/лайнапы/переключатели поменялись — матч пойдёт иначе
function mkFp(){
  var s = JSON.stringify(BAL) + "|" + WALLS_SIG + "|" + (USER_LINEUPS||[]).length + "|" + (USER_ZONES||[]).length + "|" + JSON.stringify(navTransform||null) + "|" + JSON.stringify(zoneLayer||null);
  var h = 2166136261; for(var i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
function mkCheckpoint(){
  if(roundState === "matchover") return;
  if(MK.cpMatch !== matchNum){ MK.cps = []; MK.cpMatch = matchNum; }
  var fp = mkFp();
  MK.cps = MK.cps.filter(function(c){ return c.fp === fp && c.tick !== tick; });
  var first = !MK.cps.some(function(c){ return c.round === roundNum; });
  MK.cps.push({tick: tick, match: matchNum, round: roundNum, fp: fp, first: first, data: mkSnapshot()});
  MK.cps.sort(function(a, b){ return a.tick - b.tick; });
  // храним последние CP_KEEP (~7 мин игры) + первый снимок каждого раунда матча
  while(MK.cps.length > MK.CP_KEEP + 32){
    var keepFrom = MK.cps.length - MK.CP_KEEP, idx = -1;
    for(var i=0;i<keepFrom;i++) if(!MK.cps[i].first){ idx = i; break; }
    MK.cps.splice(idx < 0 ? 0 : idx, 1);
  }
  MK.lastCpTick = tick;
}
// вызывается из frame() после шагов симуляции
function mkAfterTicks(){
  if(MK.busy || paused) return;
  if(MK.cpMatch !== matchNum || tick - MK.lastCpTick >= MK.CP_EVERY || tick < MK.lastCpTick) mkCheckpoint();
}
// перемотка: ближайший снимок не позже цели (или начало матча) → быстрый пересчёт до тика
function mkGoTo(match, target, done){
  if(MK.busy) return;
  MK.busy = true; paused = true; mkPauseLabel();
  var fp = mkFp(), cp = null;
  if(match === matchNum) MK.cps.forEach(function(c){ if(c.fp === fp && c.match === match && c.tick <= target && (!cp || c.tick > cp.tick)) cp = c; });
  if(match === matchNum && tick <= target && (!cp || tick >= cp.tick)){ /* идём вперёд от текущего */ }
  else if(cp) mkRestore(cp.data);
  else { freshMatch(match); MK.cps = []; MK.cpMatch = matchNum; }
  var from = tick, total = Math.max(1, target - from);
  var prog = document.getElementById("mkProg");
  function step(){
    var t0 = performance.now();
    while(tick < target && matchNum === match && performance.now() - t0 < 60){
      stepTick();
      if(tick % MK.CP_EVERY === 0 && tick !== MK.lastCpTick) mkCheckpoint();
    }
    if(tick < target && matchNum === match){
      prog.style.display = "block";
      prog.textContent = "Пересчитываю матч " + match + "… " + Math.round(100*(tick-from)/total) + "%";
      setTimeout(step, 0); return;
    }
    prog.style.display = "none"; MK.busy = false; paused = true; mkPauseLabel();
    if(done) done(tick === target && matchNum === match);
  }
  step();
}
function mkPauseLabel(){ var b = document.getElementById("btnPause"); if(b){ b.textContent = paused ? "Продолжить" : "Пауза"; b.classList.toggle("active", paused); } }
function mkBack10(){
  if(MK.busy) return;
  var to = Math.max(0, tick - 10*TICK_HZ);
  mkGoTo(matchNum, to, function(ok){ mkToast(ok ? "Назад на 10 с: матч " + matchNum + ", тик " + tick : "Не удалось перемотать"); });
}

// ---------- состояние момента ----------
function mkDeg(a){ return Math.round(((a*180/Math.PI)%360+360)%360); }
function mkPlace(x, y){ return String(calloutName(x, y) || "").replace(/^на «/, "").replace(/»$/, ""); }
function mkState(){
  return {
    match: matchNum, tick: tick, round: roundNum, roundTime: Math.round((simTime - roundStartTime)*10)/10,
    roundState: roundState, score: {CT: score.CT, T: score.T}, bomb: {state: bomb.state, site: bomb.site || null,
      x: bomb.x != null ? Math.round(bomb.x) : null, y: bomb.y != null ? Math.round(bomb.y) : null},
    bots: bots.map(function(b){
      var f = b.facing || 0, ray = rayClipWalls(b.x, b.y, b.x + Math.cos(f)*700, b.y + Math.sin(f)*700);
      return { id: b.id, num: pnum(b.id), nick: nick(b.id), team: b.team,
        alive: !!b.alive, hp: b.hp, weapon: b.weapon ? b.weapon.key : "",
        x: Math.round(b.x*10)/10, y: Math.round(b.y*10)/10, place: mkPlace(b.x, b.y),
        facingDeg: mkDeg(f), look: b.lookTarget ? {x: Math.round(b.lookTarget.x), y: Math.round(b.lookTarget.y), place: mkPlace(b.lookTarget.x, b.lookTarget.y)} : null,
        wallAhead: ray.wall ? Math.round(Math.hypot(ray.x-b.x, ray.y-b.y)) : null,
        lookReason: b.lookReason || "", why: whyText(b),
        sees: (b._visible || []).map(function(e){ return e.id; }), moving: b.curSpeed > 15*SPD_K,
        log: (b._dlog || []).map(function(e){ return Math.round((e[0]-tick)/TICK_HZ*10)/10 + " с · " + e[1] + ": " + e[2]; }),   // (v384) журнал решений за 15 с
        // (v385) вспомогательное по игроку: роль, задача места и её уровень, граната в задаче, гранаты, деньги, броня
        role: b.tRole || "", task: b.post ? String(b.post.tag) : "", taskLv: b._task ? b._task.lv : null,
        nadeTask: b.nadeTask ? b.nadeTask.type + " — " + (b.nadeTask.why || "") : "", nades: b.nades ? {smoke: b.nades.smoke, flash: b.nades.flash, he: b.nades.he, molly: b.nades.molly} : null,
        money: b.money, armor: b.armor || 0, helmet: !!b.helmet, kit: !!b.kit };
    }),
    smokes: smokes.map(function(s){ return {x: Math.round(s.x), y: Math.round(s.y), place: mkPlace(s.x, s.y)}; }),
    fires: fires.map(function(s){ return {x: Math.round(s.x), y: Math.round(s.y), place: mkPlace(s.x, s.y)}; }),
    zones: mkZones()
  };
}
// (v385) по каждой зоне, где что-то есть: кто стоит (живые), сколько врагов там ждёт каждая команда по своему знанию (belief),
// дым / огонь. Пустые зоны не пишутся — запись отметки в базе небольшая
function mkZones(){
  var out = [];
  try{
    (BZ.ids || []).forEach(function(id, i){
      var c = BZ.cent[i]; if(!c) return;
      var inZ = bots.filter(function(o){ return o.alive && zoneIdAt(o.x, o.y) === id; }).map(function(o){ return o.id; });
      var kT = Math.round(beliefCount("T", [i])*100)/100, kCT = Math.round(beliefCount("CT", [i])*100)/100;
      var sm = smokes.some(function(q){ return zoneIdAt(q.x, q.y) === id; }), fi = fires.some(function(q){ return zoneIdAt(q.x, q.y) === id; });
      if(!inZ.length && kT < 0.05 && kCT < 0.05 && !sm && !fi) return;
      out.push({zone: mkPlace(c.x, c.y) || String(id), bots: inZ, tThinkCT: kT, ctThinkT: kCT, smoke: sm, fire: fi});
    });
  }catch(e){}
  return out;
}
function mkBotIdAt(wx, wy){
  var best = null, bd = 40;
  bots.forEach(function(b){ var d = Math.hypot(b.x-wx, b.y-wy); if(d < bd){ bd = d; best = b.id; } });
  return best;
}

// ---------- кадр настоящего радара вокруг бота (~600×400 карты) ----------
function mkFrame(botId){
  var b = bots.filter(function(o){ return o.id === botId; })[0], cx, cy;
  if(b){ cx = b.x; cy = b.y; }
  else { var al = bots.filter(function(o){ return o.alive; }); cx = al.reduce(function(s, o){ return s + o.x; }, 0)/Math.max(1, al.length); cy = al.reduce(function(s, o){ return s + o.y; }, 0)/Math.max(1, al.length); }
  var W = 900, H = 600, K = 1.5, sv = {s: view.scale, x: view.panX, y: view.panY, w: cv.width, h: cv.height}, url = null;
  try{
    cv.width = W; cv.height = H; view.scale = K; view.panX = W/2 - cx*K; view.panY = H/2 - cy*K;
    draw();
    ctx.save(); ctx.font = "600 14px 'IBM Plex Sans', system-ui, sans-serif"; ctx.textAlign = "center";
    var seen = {};
    ZONEMAP.zones.forEach(function(z){ var p = ZONE_CENTROIDS[z.id]; if(!p) return;
      var sx = p.x*K + view.panX, sy = p.y*K + view.panY; if(sx < 40 || sx > W-40 || sy < 18 || sy > H-12) return;
      var nm = mkPlace(p.x, p.y); if(!nm || nm === "?" || seen[nm]) return; seen[nm] = 1;
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.75)"; ctx.strokeText(nm, sx, sy); ctx.fillStyle = "#f3efe4"; ctx.fillText(nm, sx, sy); });
    if(b){ ctx.setLineDash([7, 5]); ctx.lineWidth = 3; ctx.strokeStyle = "#ff5a4f"; ctx.beginPath(); ctx.arc(W/2, H/2, 26, 0, Math.PI*2); ctx.stroke(); }
    ctx.restore();
    url = cv.toDataURL("image/jpeg", 0.86);
  } finally {
    cv.width = sv.w; cv.height = sv.h; view.scale = sv.s; view.panX = sv.x; view.panY = sv.y; draw();
  }
  return url;
}
// (v385, владелец 20.10) снимок всего экрана в момент нажатия M — как его видел владелец (радар, табло, панели, войс): html2canvas
// с cdnjs; не загрузился — текущий вид радара без панелей (данные панелей всё равно есть в сводке отметки)
var MK_H2C = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
function mkLoadH2C(){
  if(window.html2canvas) return Promise.resolve(window.html2canvas);
  if(MK._h2c) return MK._h2c;
  return (MK._h2c = new Promise(function(ok, no){ var s = document.createElement("script"); s.src = MK_H2C;
    s.onload = function(){ window.html2canvas ? ok(window.html2canvas) : no(new Error("нет html2canvas")); }; s.onerror = function(){ MK._h2c = null; no(new Error("не загрузился")); };
    document.head.appendChild(s); }));
}
function mkScreen(){
  var plain = null; try{ plain = cv.toDataURL("image/jpeg", 0.82); }catch(e){}
  return mkLoadH2C().then(function(h2c){
    return h2c(document.body, {backgroundColor: "#060806", logging: false, useCORS: true, ignoreElements: function(el){ return el.id === "mkPanel" || el.id === "mkToast" || el.id === "mkProg"; }, scale: Math.min(1, 1600/Math.max(1, window.innerWidth))})
      .then(function(c){ return c.toDataURL("image/jpeg", 0.8); });
  }).catch(function(){ return plain; });
}
function mkUrlToBlob(url){ var p = url.split(","), bin = atob(p[1]), u = new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) u[i] = bin.charCodeAt(i); return new Blob([u], {type: "image/jpeg"}); }

// ---------- интерфейс отметки ----------
function mkEl(id){ return document.getElementById(id); }
function mkEsc(t){ return String(t == null ? "" : t).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }
function mkToast(t){ var el = mkEl("mkToast"); el.textContent = t; el.style.display = "block"; clearTimeout(MK._tt); MK._tt = setTimeout(function(){ el.style.display = "none"; }, 4000); }
function mkStart(){
  if(MK.busy) return;
  if(MK.cur){ mkEl("mkText").focus(); return; }
  paused = true; mkPauseLabel();
  MK.cur = { snap: mkSnapshot(), state: mkState(), match: matchNum, tick: tick, round: roundNum, roundTime: Math.round((simTime - roundStartTime)*10)/10,
             fp: mkFp(), bot: null, text: "", category: "Взгляд", priority: "normal" };
  MK.cur.screenP = mkScreen();   // (v385) весь экран — до того, как открылась панель отметки
  MK.pick = true;
  mkEl("mkMoment").textContent = "Матч " + MK.cur.match + " · раунд " + MK.cur.round + " · " + mkClock(MK.cur.roundTime) + " раунда · тик " + MK.cur.tick;
  mkEl("mkText").value = ""; mkEl("mkBot").textContent = "не выбран — кликни по боту на радаре (необязательно)";
  mkEl("mkCat").value = "Взгляд"; mkEl("mkPrioN").checked = true;
  mkEl("mkErr").textContent = "";
  mkEl("mkPanel").style.display = "block"; mkEl("mkText").focus();
}
function mkClock(s){ s = Math.max(0, Math.round(s)); return Math.floor(s/60) + ":" + ("0" + (s%60)).slice(-2); }
function mkClose(){ MK.cur = null; MK.pick = false; mkEl("mkPanel").style.display = "none"; }
// (v397, М147) отметка сохраняется сразу — без разбора нейросетью на странице; разбор — в чате по снимку (tools/mark_open.js)
async function mkSubmit(){
  var m = MK.cur; if(!m) return;
  m.text = mkEl("mkText").value.trim(); m.category = mkEl("mkCat").value; m.priority = mkEl("mkPrioU").checked ? "urgent" : "normal";
  if(!m.text){ mkEl("mkErr").textContent = "Напиши, что не так"; return; }
  mkEl("mkErr").textContent = "";
  MK.pick = false;
  m.frameUrl = mkFrame(m.bot);
  mkClose(); mkToast("Сохраняю отметку…");
  if(await mkSave(m, "new")) mkToast("Отметка сохранена");
}
async function mkSave(m, status){
  var doc = { match: m.match, tick: m.tick, round: m.round, roundTime: m.roundTime, category: m.category, priority: m.priority,
    text: m.text, bot: m.bot || null, principle: null, status: status, version: null,
    fp: m.fp, state: m.state, frameAsset: null, created: Date.now(), updated: Date.now() };
  if(MK.assets && m.frameUrl){ try{ var up = await MK.assets.upload(mkUrlToBlob(m.frameUrl)); doc.frameAsset = up.id; }catch(e){} }
  doc.screenAsset = null;   // (v385) весь экран
  if(MK.assets && m.screenP){ try{ var su = await m.screenP; if(su){ var us0 = await MK.assets.upload(mkUrlToBlob(su)); doc.screenAsset = us0.id; } }catch(e){} }
  // полный снимок игры в момент нажатия — по нему отметка открывается у владельца и у Claude
  doc.snapAsset = null;
  if(MK.assets && m.snap){ try{ var us = await MK.assets.upload(new Blob([mkPack(m.snap)], {type: "application/json"})); doc.snapAsset = us.id; }catch(e){ mkToast("Снимок игры не сохранился: " + (e && (e.code || e.message))); } }
  if(!MK.db){ MK.local = MK.local || []; doc.id = "local" + doc.created; MK.local.push(doc); mkRenderList(); mkToast("Базы страницы нет (открыто не в Claude) — отметка только до перезагрузки"); return false; }
  try{ await MK.db.collection("marks").doc("m" + doc.created).set(doc); return true; }
  catch(e){ mkToast("Не удалось сохранить отметку: " + (e && (e.code || e.message))); return false; }
}

// ---------- список отметок ----------
var MK_ST = {new: "новое", unparsed: "не разобрано", added: "добавлено", fixed: "исправлено", confirmed: "подтверждено"};
function mkStatusText(d){
  if(d.status === "added") return "добавлено как " + (d.principle || "?");
  if(d.status === "fixed") return "исправлено в v" + (d.version || "?") + ", проверь";
  return MK_ST[d.status] || d.status;
}
function mkSorted(){
  var L = (MK.list || []).concat(MK.local || []);
  var rank = function(d){ return d.status === "confirmed" ? 3 : (d.priority === "urgent" ? 0 : 1) + (d.status === "new" || d.status === "unparsed" ? 0 : 0.5); };
  return L.slice().sort(function(a, b){ return rank(a) - rank(b) || (b.created||0) - (a.created||0); });
}
function mkRenderList(){
  var L = mkSorted(), box = mkEl("mkItems");
  mkEl("btnMarks").textContent = "Отметки (" + L.length + ")";
  if(!L.length){ box.innerHTML = '<div class="mk-q">Пока нет отметок. Нажми «Отметить момент» или клавишу M.</div>'; return; }
  box.innerHTML = L.map(function(d, i){
    return '<div class="mk-item' + (d.status === "confirmed" ? " mk-done" : "") + '" data-i="' + i + '">' +
      '<div class="mk-row"><b>' + (d.priority === "urgent" ? '<span class="mk-urg">срочно</span> ' : "") + mkEsc(d.category) + '</b>' +
      '<span class="mk-st mk-st-' + mkEsc(d.status) + '">' + mkEsc(mkStatusText(d)) + '</span></div>' +
      '<div class="mk-t">' + mkEsc(d.text) + '</div>' +
      (d.understood ? '<div class="mk-q">Понял: ' + mkEsc(d.understood) + '</div>' : "") +
      '<div class="mk-q">матч ' + d.match + ', тик ' + d.tick + ' · раунд ' + d.round + ', ' + mkClock(d.roundTime) + (d.bot ? ' · ' + mkEsc(d.bot) : "") + '</div>' +
      (d.status === "fixed" ? '<button data-ok="' + i + '">Подтверждаю</button>' : "") + '</div>';
  }).join("");
}
function mkJump(d){
  mkEl("mkList").style.display = "none";
  if(!d.snapAsset){ mkToast("У этой отметки нет снимка игры (сделана до v175) — открыть точно нельзя"); return; }
  if(MK.busy) return;
  MK.busy = true; paused = true; mkPauseLabel();
  fetch("/_blob/" + d.snapAsset).then(function(r){ if(!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
    .then(function(t){ mkOpenSnap(t); MK.busy = false; mkPauseLabel();
      mkToast("Отметка: матч " + d.match + ", раунд " + d.round + ", " + mkClock(d.roundTime) + " — открыта из снимка"); })
    .catch(function(e){ MK.busy = false; mkToast("Не удалось открыть снимок отметки: " + (e && e.message)); });
}
function mkCopyAll(){
  var t = mkSorted().map(function(d){
    return "- " + (d.priority === "urgent" ? "[срочно] " : "") + d.category + " · матч " + d.match + ", тик " + d.tick + " (раунд " + d.round + ", " + mkClock(d.roundTime) + ")" +
      (d.bot ? " · " + d.bot : "") + " — «" + d.text + "»" + (d.understood ? " — понял: " + d.understood : "") +
      (d.principle ? " — пункт " + d.principle : (d.newItem ? " — новый пункт (" + d.newItem.section + "): " + d.newItem.text : "")) + " — " + mkStatusText(d);
  }).join("\n");
  var done = function(){ mkToast("Скопировано: " + mkSorted().length + " отметок"); };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function(){ mkShowCopy(t); });
  else mkShowCopy(t);
}
function mkShowCopy(t){ var a = mkEl("mkCopyBox"); a.value = t; a.style.display = "block"; a.select(); mkToast("Выдели и скопируй текст из поля"); }

// ---------- подключение ----------
(function(){
  // (v256) кнопки: «◀ 10 с» — рядом с паузой, «Отметки» и «Отметить момент» — в правой части панели (#mkSlot)
  var bar = mkEl("btnPause"), slot = mkEl("mkSlot");
  bar.insertAdjacentHTML("afterend", '<button id="btnBack10" title="Перемотать на 10 секунд игры назад">◀ 10 с</button>');
  (slot || bar).insertAdjacentHTML(slot ? "beforeend" : "afterend", '<button id="btnMarks">Отметки (0)</button>' +
    '<button id="btnMark" class="primary" title="Пауза и отметка момента: что не так, кто, категория (клавиша M)">Отметить момент <kbd>M</kbd></button>');
  mkEl("main").insertAdjacentHTML("beforeend",
    '<div id="mkPanel" class="mk-panel" style="display:none">' +
      '<div class="mk-head"><b>Отметка момента</b><button id="mkX">✕</button></div>' +
      '<div class="mk-q" id="mkMoment"></div>' +
      '<div id="mkForm">' +
        '<textarea id="mkText" rows="3" placeholder="Что не так — своими словами (Ctrl+Enter — сохранить)"></textarea>' +
        '<div class="mk-row2"><select id="mkCat">' + MK_CATS.map(function(c){ return '<option>' + c + '</option>'; }).join("") + '</select>' +
        '<label><input type="radio" name="mkPrio" id="mkPrioN" checked> обычно</label><label><input type="radio" name="mkPrio" id="mkPrioU"> срочно</label></div>' +
        '<div class="mk-q">О ком: <span id="mkBot"></span></div>' +
        '<div class="mk-err" id="mkErr"></div>' +
        '<div class="mk-row2"><button id="mkGo" class="active">Сохранить</button><button id="mkCancel">Отмена</button></div>' +
      '</div>' +
    '</div>' +
    '<div id="mkList" class="mk-panel" style="display:none"><div class="mk-head"><b>Отметки</b><span><button id="mkCopy">Скопировать все</button> <button id="mkLX">✕</button></span></div>' +
      '<textarea id="mkCopyBox" rows="5" style="display:none"></textarea><div id="mkItems"></div></div>' +
    '<div id="mkToast" class="mk-toast" style="display:none"></div><div id="mkProg" class="mk-prog" style="display:none"></div>');
  ["mkPanel", "mkList"].forEach(function(id){ var el = mkEl(id);
    ["keydown", "mousedown", "wheel"].forEach(function(ev){ el.addEventListener(ev, function(e){ e.stopPropagation(); }); }); });
  mkEl("btnMark").addEventListener("click", mkStart);
  mkEl("btnBack10").addEventListener("click", mkBack10);
  mkEl("btnMarks").addEventListener("click", function(){ var L = mkEl("mkList"); L.style.display = L.style.display === "block" ? "none" : "block"; mkRenderList(); });
  mkEl("mkLX").addEventListener("click", function(){ mkEl("mkList").style.display = "none"; });
  mkEl("mkX").addEventListener("click", mkClose); mkEl("mkCancel").addEventListener("click", mkClose);
  mkEl("mkGo").addEventListener("click", mkSubmit);
  mkEl("mkText").addEventListener("input", function(){ mkEl("mkErr").textContent = ""; });
  mkEl("mkText").addEventListener("keydown", function(e){ if(e.key === "Enter" && (e.ctrlKey || e.metaKey)){ e.preventDefault(); mkSubmit(); } });
  mkEl("mkCopy").addEventListener("click", mkCopyAll);
  mkEl("mkItems").addEventListener("click", function(e){
    var L = mkSorted(), ok = e.target.getAttribute && e.target.getAttribute("data-ok");
    if(ok != null){ var d = L[+ok]; e.stopPropagation();
      if(MK.db && d && !/^local/.test(d.id||"")) MK.db.collection("marks").doc(d.id).update({status: "confirmed", confirmedAt: Date.now(), updated: Date.now()}).catch(function(){ mkToast("Не удалось сохранить подтверждение"); });
      return; }
    var it = e.target.closest && e.target.closest(".mk-item"); if(it) mkJump(L[+it.getAttribute("data-i")]);
  });
  // клик по боту, пока открыта отметка
  cv.addEventListener("mousedown", function(e){
    if(!MK.pick || !MK.cur || e.button !== 0) return;
    var w = navScreenToWorld(e.clientX, e.clientY), id = mkBotIdAt(w.x, w.y);
    if(!id) return;
    MK.cur.bot = id; var s = MK.cur.state.bots.filter(function(o){ return o.id === id; })[0];
    mkEl("mkBot").textContent = id + " (номер " + (s ? s.num : "?") + (s && s.place ? ", " + s.place : "") + ")";
    e.stopImmediatePropagation(); e.preventDefault();
  }, true);
  window.addEventListener("keydown", function(e){
    var tg = e.target && e.target.tagName; if(tg === "INPUT" || tg === "TEXTAREA" || tg === "SELECT") return;
    if((e.key === "m" || e.key === "M" || e.key === "ь" || e.key === "Ь") && !e.ctrlKey && !e.metaKey && !e.altKey){ mkStart(); e.preventDefault(); }
  });
  mkEl("btnRestartRound").addEventListener("click", function(){ MK.cps = []; });
  mkEl("btnFreshMatch").addEventListener("click", function(){ MK.cps = []; });
  // возможности страницы в Claude: база отметок, картинки кадров и снимки
  if(window.claude && claude.use){
    claude.use("db").then(function(db){ if(!db) return; MK.db = db;
      db.collection("marks").onSnapshot(function(snap){ MK.list = snap.docs.map(function(d){ var o = Object.assign({}, d.data()); o.id = d.id; return o; }); mkRenderList(); },
        function(){ mkToast("База отметок недоступна"); }); });
    claude.use("assets").then(function(a){ MK.assets = a || null; });
  }
  mkRenderList();
})();
