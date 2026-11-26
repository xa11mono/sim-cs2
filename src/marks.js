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
    roundState: roundState, sandbox: !!(typeof SANDBOX !== "undefined" && SANDBOX.on), score: {CT: score.CT, T: score.T}, bomb: {state: bomb.state, site: bomb.site || null,
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
        log: (typeof dlogOf === "function" ? dlogOf(b).concat(dlogOf(b, "_dlog2")) : (b._dlog || []).concat(b._dlog2 || [])).sort(function(x, y){ return x[0] - y[0]; }).map(function(e){ return Math.round((e[0]-tick)/TICK_HZ*10)/10 + " с · " + e[1] + ": " + e[2]; }),   // (v384) журнал решений за 15 с; (15.11) + бой и ход
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

// ---------- кадр: вся карта (v401, владелец 22.10 — «скриншот со всей карты, а не участка») ----------
// радар 2048×2048 целиком в MK_FRAME px: названия зон, номера всех игроков (рисует draw), дым и огонь; отмеченный — красный круг
var MK_FRAME = 1400, MK_FRAME_PAD = 140;   // px кадра по длинной стороне; запас от центров крайних зон (ед. радара) — проектные числа
function mkFrame(botId){
  var b = bots.filter(function(o){ return o.id === botId; })[0];
  // рамка — по зонам карты (центры ± MK_FRAME_PAD ед. радара), чтобы пустые края радара не съедали кадр
  var x0 = 2048, y0 = 2048, x1 = 0, y1 = 0, PAD = MK_FRAME_PAD;
  for(var zid in ZONE_CENTROIDS){ var c = ZONE_CENTROIDS[zid]; if(!c) continue; x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x); y1 = Math.max(y1, c.y); }
  if(x1 <= x0){ x0 = 0; y0 = 0; x1 = 2048; y1 = 2048; PAD = 0; }
  x0 = Math.max(0, x0 - PAD); y0 = Math.max(0, y0 - PAD); x1 = Math.min(2048, x1 + PAD); y1 = Math.min(2048, y1 + PAD);
  var K = MK_FRAME/Math.max(x1 - x0, y1 - y0), W = Math.round((x1 - x0)*K), H = Math.round((y1 - y0)*K);
  var sv = {s: view.scale, x: view.panX, y: view.panY, w: cv.width, h: cv.height}, url = null;
  try{
    cv.width = W; cv.height = H; view.scale = K; view.panX = -x0*K; view.panY = -y0*K;
    draw();
    ctx.save(); ctx.font = "600 13px 'IBM Plex Sans', system-ui, sans-serif"; ctx.textAlign = "center";
    var seen = {};
    ZONEMAP.zones.forEach(function(z){ var p = ZONE_CENTROIDS[z.id]; if(!p) return;
      var sx = p.x*K + view.panX, sy = p.y*K + view.panY;
      var nm = mkPlace(p.x, p.y); if(!nm || nm === "?" || seen[nm]) return; seen[nm] = 1;
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.75)"; ctx.strokeText(nm, sx, sy); ctx.fillStyle = "#f3efe4"; ctx.fillText(nm, sx, sy); });
    if(b){ ctx.setLineDash([6, 4]); ctx.lineWidth = 3; ctx.strokeStyle = "#ff5a4f"; ctx.beginPath(); ctx.arc(b.x*K + view.panX, b.y*K + view.panY, 20, 0, Math.PI*2); ctx.stroke(); }
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
// (v401) снимок за 15–25 с до отметки — по нему в чате проигрывается история до момента (tools/marks/mark_story.js): что было до, что
// перебило, как менялись веса зон. Чекпоинты пишутся каждые 10 с (CP_EVERY); MK_PRE_SEC — проектное число (= журнал решений DLOG_SEC)
var MK_PRE_SEC = 15;
function mkPreSnap(){
  var fp = mkFp(), best = null;
  MK.cps.forEach(function(c){ if(c.fp === fp && c.match === matchNum && c.tick <= tick - MK_PRE_SEC*TICK_HZ && (!best || c.tick > best.tick)) best = c; });
  if(!best) MK.cps.forEach(function(c){ if(c.fp === fp && c.match === matchNum && c.tick < tick && (!best || c.tick < best.tick)) best = c; });   // раунд только начался — самый ранний
  return best ? {tick: best.tick, data: best.data} : null;
}
function mkStart(){
  if(MK.busy) return;
  if(typeof WARM !== "undefined" && WARM.on){ mkToast("Разминка — отметки только в матче"); return; }   // (v521) снимок разминки не открывается как матч
  if(MK.cur){ mkEl("mkText").focus(); return; }
  clockPause(true); mkPauseLabel();
  MK.cur = { snap: mkSnapshot(), state: mkState(), match: matchNum, tick: tick, round: roundNum, roundTime: Math.round((simTime - roundStartTime)*10)/10,
             fp: mkFp(), bot: null, text: "", want: "", category: "Взгляд", priority: "normal", pre: mkPreSnap() };
  MK.cur.screenP = mkScreen();   // (v385) весь экран — до того, как открылась панель отметки
  MK.pick = true;
  mkEl("mkMoment").textContent = "Матч " + MK.cur.match + " · раунд " + MK.cur.round + " · " + mkClock(MK.cur.roundTime) + " раунда · тик " + MK.cur.tick;
  mkEl("mkText").value = ""; mkEl("mkWant").value = ""; mkEl("mkBot").textContent = "не выбран — кликни по боту на радаре (необязательно)";
  mkEl("mkCat").value = "Взгляд"; mkEl("mkPrioN").checked = true;
  mkEl("mkErr").textContent = "";
  mkEl("mkPanel").style.display = "block"; mkEl("mkText").focus();
}
function mkClock(s){ s = Math.max(0, Math.round(s)); return Math.floor(s/60) + ":" + ("0" + (s%60)).slice(-2); }
function mkClose(){ MK.cur = null; MK.pick = false; mkEl("mkPanel").style.display = "none"; }
// (v397, М147) отметка сохраняется сразу — без разбора нейросетью на странице; разбор — в чате по снимку (tools/marks/mark_open.js)
async function mkSubmit(){
  var m = MK.cur; if(!m) return;
  m.text = mkEl("mkText").value.trim(); m.want = mkEl("mkWant").value.trim(); m.category = mkEl("mkCat").value; m.priority = mkEl("mkPrioU").checked ? "urgent" : "normal";
  if(!m.text){ mkEl("mkErr").textContent = "Напиши, что не так"; return; }
  mkEl("mkErr").textContent = "";
  MK.pick = false;
  m.frameUrl = mkFrame(m.bot);
  mkClose(); mkToast("Сохраняю отметку…");
  if(await mkSave(m, "new")) mkToast("Отметка сохранена");
}
// (Р0.1, 24.11) среда записи: браузер и ОС влияют на последние знаки Math (rebuild/ENVIRONMENT.md) — снимок повторяется только в той же среде
function mkEnv(){
  var n = typeof navigator !== "undefined" ? navigator : {}, ua = n.userAgentData, v = document.getElementById("simVersion");
  return { ua: n.userAgent || null, brands: ua && ua.brands ? ua.brands.map(function(b){ return b.brand + " " + b.version; }).join(", ") : null,
    platform: (ua && ua.platform) || n.platform || null, build: v ? v.textContent : null,
    src: typeof MK_BUILD !== "undefined" ? MK_BUILD : null };   // (Р2.1) отпечаток исходника игры — по нему tools/marks/mark_build.js собирает ту же сборку
}
async function mkSave(m, status){
  var doc = { match: m.match, tick: m.tick, round: m.round, roundTime: m.roundTime, category: m.category, priority: m.priority,
    text: m.text, want: m.want || "", bot: m.bot || null, principle: null, status: status, version: null,
    fp: m.fp, state: m.state, frameAsset: null, created: Date.now(), updated: Date.now(), env: mkEnv() };
  if(MK.assets && m.frameUrl){ try{ var up = await MK.assets.upload(mkUrlToBlob(m.frameUrl)); doc.frameAsset = up.id; }catch(e){} }
  doc.screenAsset = null;   // (v385) весь экран
  if(MK.assets && m.screenP){ try{ var su = await m.screenP; if(su){ var us0 = await MK.assets.upload(mkUrlToBlob(su)); doc.screenAsset = us0.id; } }catch(e){} }
  // полный снимок игры в момент нажатия — по нему отметка открывается у владельца и у Claude
  doc.snapAsset = null;
  if(MK.assets && m.snap){ try{ var us = await MK.assets.upload(new Blob([mkPack(m.snap)], {type: "application/json"})); doc.snapAsset = us.id; }catch(e){ mkToast("Снимок игры не сохранился: " + (e && (e.code || e.message))); } }
  doc.preSnapAsset = null; doc.preTick = m.pre ? m.pre.tick : null;   // (v401) снимок до момента — для истории в чате
  if(MK.assets && m.pre){ try{ var up2 = await MK.assets.upload(new Blob([mkPack(m.pre.data)], {type: "application/json"})); doc.preSnapAsset = up2.id; }catch(e){} }
  if(!MK.db){ MK.local = MK.local || []; doc.id = "local" + doc.created; MK.local.push(doc); mkRenderList(); mkToast("Базы страницы нет (открыто не в Claude) — отметка только до перезагрузки"); return false; }
  try{ await MK.db.collection("marks").doc("m" + doc.created).set(doc); return true; }
  catch(e){ mkToast("Не удалось сохранить отметку: " + (e && (e.code || e.message))); return false; }
}

// (Р5.7, 26.11) отметка одним файлом (формат выгрузки sim-cs2/mark-export v1): запись как в базе (mkSave), снимки момента и «до» (mkPack),
// кадр экрана; в пакет отметки v2 (mark.json + вложения с SHA-256) её переводит node tools/sim.js mark import <файл> <папка> (tools/marks/prototype)
async function mkExportFile(){
  var m = MK.cur; if(!m) return; m.text = mkEl("mkText").value.trim(); m.want = mkEl("mkWant").value.trim();
  if(!m.text){ mkEl("mkErr").textContent = "Напиши, что не так"; return; }
  var img = null; try{ img = m.screenP ? await m.screenP : null; }catch(e){}
  var doc = { match: m.match, tick: m.tick, round: m.round, roundTime: m.roundTime, category: mkEl("mkCat").value, priority: mkEl("mkPrioU").checked ? "urgent" : "normal",
    text: m.text, want: m.want, bot: m.bot || null, principle: null, status: "new", version: null, fp: m.fp, state: m.state, created: Date.now(), updated: Date.now(),
    env: mkEnv(), preTick: m.pre ? m.pre.tick : null, map: MAP.id || null, seed: m.match };   // map, seed — в identity пакета (номер матча задаёт зерно матча)
  var out = JSON.stringify({format: "sim-cs2/mark-export", version: 1, doc: doc, snapshot: mkPack(m.snap), pre: m.pre ? mkPack(m.pre.data) : null, image: img || null});
  var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([out], {type: "application/json"}));
  a.download = "mark-m" + m.match + "-t" + m.tick + ".json"; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  mkToast("Отметка выгружена файлом (" + Math.round(out.length / 1024) + " КБ)");
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
      '<div class="mk-t">' + mkEsc(d.text) + '</div>' + (d.want ? '<div class="mk-q">Как должно быть: ' + mkEsc(d.want) + '</div>' : "") +
      (d.understood ? '<div class="mk-q">Понял: ' + mkEsc(d.understood) + '</div>' : "") +
      '<div class="mk-q">матч ' + d.match + ', тик ' + d.tick + ' · раунд ' + d.round + ', ' + mkClock(d.roundTime) + (d.bot ? ' · ' + mkEsc(d.bot) : "") + '</div>' +
      (d.status === "fixed" ? '<button data-ok="' + i + '">Подтверждаю</button>' : "") + '</div>';
  }).join("");
}
function mkJump(d){
  mkEl("mkList").style.display = "none";
  if(!d.snapAsset){ mkToast("У этой отметки нет снимка игры (сделана до v175) — открыть точно нельзя"); return; }
  if(MK.busy) return;
  MK.busy = true; clockPause(true); mkPauseLabel();
  // (15.11, замечание владельца: «кликнул отметку — тот же раунд, приходится мотать назад 10 с, чтобы пересчитался») снимок в момент
  // отметки уже несёт принятое (ошибочное) решение — новый код его не пересматривает. Есть снимок за MK_PRE_SEC до — открываем его и
  // пересчитываем до момента отметки кодом этой страницы (решения принимаются заново); нет — как раньше, снимок момента.
  var pre = !!d.preSnapAsset && d.preTick != null && d.preTick < d.tick;
  fetch("/_blob/" + (pre ? d.preSnapAsset : d.snapAsset)).then(function(r){ if(!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
    .then(function(t){ mkOpenSnap(t); MK.busy = false;
      var msg = "Отметка: матч " + d.match + ", раунд " + d.round + ", " + mkClock(d.roundTime);
      if(!pre){ mkPauseLabel(); mkToast(msg + " — открыта из снимка момента (снимка до нет — пересчёта нет)"); return; }
      mkGoTo(matchNum, d.tick, function(ok){ mkToast(msg + (ok ? " — пересчитана этой версией с " + Math.round((d.tick - d.preTick)/TICK_HZ) + " с до отметки" : " — пересчёт не удался")); }); })
    .catch(function(e){ MK.busy = false; mkToast("Не удалось открыть снимок отметки: " + (e && e.message)); });
}
function mkCopyAll(){
  var t = mkSorted().map(function(d){
    return "- " + (d.priority === "urgent" ? "[срочно] " : "") + d.category + " · матч " + d.match + ", тик " + d.tick + " (раунд " + d.round + ", " + mkClock(d.roundTime) + ")" +
      (d.bot ? " · " + d.bot : "") + " — «" + d.text + "»" + (d.want ? " — как должно быть: «" + d.want + "»" : "") + (d.understood ? " — понял: " + d.understood : "") +
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
  bar.insertAdjacentHTML("afterend", '<button id="btnBack10" title="Перемотать на 10 секунд игры назад">10 с</button>');
  (slot || bar).insertAdjacentHTML(slot ? "beforeend" : "afterend", '<button id="btnMarks">Отметки (0)</button>' +
    '<button id="btnMark" class="primary" title="Отметить момент: пауза и отметка — что не так, кто, категория (клавиша M)">Отметить <kbd>M</kbd></button>');
  mkEl("main").insertAdjacentHTML("beforeend",
    '<div id="mkPanel" class="mk-panel" style="display:none">' +
      '<div class="mk-head"><b>Отметка момента</b><button id="mkX">✕</button></div>' +
      '<div class="mk-q" id="mkMoment"></div>' +
      '<div id="mkForm">' +
        '<div class="mk-lbl">Что не так</div><textarea id="mkText" rows="3" placeholder="Что не так — своими словами (Ctrl+Enter — сохранить)"></textarea>' +
        '<div class="mk-lbl">Как должно быть (можно пусто)</div><textarea id="mkWant" rows="2" placeholder="Как должен был сыграть — своими словами"></textarea>' +
        '<div class="mk-row2"><select id="mkCat">' + MK_CATS.map(function(c){ return '<option>' + c + '</option>'; }).join("") + '</select>' +
        '<label><input type="radio" name="mkPrio" id="mkPrioN" checked> обычно</label><label><input type="radio" name="mkPrio" id="mkPrioU"> срочно</label></div>' +
        '<div class="mk-q">О ком: <span id="mkBot"></span></div>' +
        '<div class="mk-err" id="mkErr"></div>' +
        '<div class="mk-row2"><button id="mkGo" class="active">Сохранить</button><button id="mkFile" title="Отметка одним файлом: текст, снимки момента и «до», кадр экрана — для node tools/sim.js mark import">В файл</button><button id="mkCancel">Отмена</button></div>' +
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
  mkEl("mkFile").addEventListener("click", mkExportFile);
  mkEl("mkText").addEventListener("input", function(){ mkEl("mkErr").textContent = ""; });
  ["mkText", "mkWant"].forEach(function(id){ mkEl(id).addEventListener("keydown", function(e){ if(e.key === "Enter" && (e.ctrlKey || e.metaKey)){ e.preventDefault(); mkSubmit(); } }); });
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
