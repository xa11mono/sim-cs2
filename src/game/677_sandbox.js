// ======================= (v536) ПЕСОЧНИЦА — одно место =======================
// Владелец 10.11: «режим песочницы на любой карте: спавнить ботов, отключать, управлять ими, включать ИИ — например, два бота, включил ИИ,
// они убили, чтобы раунды не заканчивались; перетаскивать и смотреть, какая у них сейчас включилась логика».
// Что делает (только когда SANDBOX.on): раунд не кончается (endRound ничего не делает), часы раунда и таймер бомбы стоят; у каждого бота —
// «ИИ вкл / выкл» (выкл — стоит и не стреляет, мозги команды его не двигают) и «в игре / убран» (убрать — без киллфида; вернуть — на точку,
// куда кликнешь); бота можно перетащить мышью; панель показывает логику выбранного бота (то же, что подпись на карте, и причины решений).
// Игру вне песочницы не меняет: все проверки — SANDBOX.on / b._sbOff.
var SANDBOX = {on: false, sel: null, drag: null, place: null, last: 0};
// (v537, владелец 10.11: «чтобы отметки тоже работали в песочнице») SANDBOX — только данные (копируется в снимок отметки: открытый снимок
// снова в песочнице, с теми же ИИ вкл / выкл у ботов); элемент панели — отдельно (элементы страницы в снимок не идут)
var SB_PANEL_EL = null;
function sbBot(id){ for(var i = 0; i < bots.length; i++) if(bots[i].id === id) return bots[i]; return null; }
// один тик песочницы (stepTick, раунд идёт): часы раунда и бомбы стоят
function sbTick(){
  roundStartTime += TICK_MS/1000;
  // приказ «иди сюда» (Shift + клик): держится, пока не дошёл — задача уровня выше всех (TASK_LEVEL, «приказ песочницы»)
  bots.forEach(function(b){ var G = b._sbGo; if(!G) return; if(!b.alive || (b.atPost && !b._climb && b.post && b.post.tag === "sbGo")){ b._sbGo = null; return; }
    setPost(b, G, G.look || null, true, "sbGo"); });
  if(bomb && bomb.state === "planted" && bomb.explodeTick != null) bomb.explodeTick++;
}
// поставить бота в точку (x, y): пол — ближайший участок навмеша, всё движение и задачи — заново
function sbPlace(b, x, y){
  var w = snapToWalkable(x, y), a = navFloorNear(w.x, w.y, 40, null) || navAt(w.x, w.y, b.z || 0);
  b.x = b.baseX = b.px = w.x; b.y = b.baseY = b.py = w.y;
  if(a){ b.z = navFloorZ(a, w.x, w.y); b._area = a.id; }
  b.path = []; b.pathIdx = 0; b._climb = null; b._fc = null; b._hold = null; b._trail = []; b.curSpeed = 0;
  b._underV = null; b._overV = null; floorViewTick(b);
}
function sbRevive(b, x, y){
  b.alive = true; b.hp = 100; b.state = "patrol"; b.holding = false; clearPost(b); b._contact = null;
  b.contactStreak = 0; b._ts = {}; b.nextShotTick = 0; b._reloading = false; b._blind = null; b.blindUntil = 0;
  sbPlace(b, x, y);
  logEvent("песочница: " + b.id + " в игре");
}
function sbRemove(b){ b.alive = false; b.hp = 0; clearPost(b); b._fc = null; if(SANDBOX.drag === b) SANDBOX.drag = null; logEvent("песочница: " + b.id + " убран"); }
// ---------- панель ----------
function sbEsc(s){ return String(s == null ? "" : s).replace(/[&<>]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c]; }); }
function sbPanel(){
  if(SB_PANEL_EL) return SB_PANEL_EL;
  var el = document.createElement("div"); el.className = "med sb-panel"; el.style.display = "none";
  el.innerHTML = '<div class="med-head"><b>Песочница</b><span class="med-src">раунд не кончается</span></div>' +
    '<div class="med-hint">Тащи бота мышью. Shift + клик — выбранный бот идёт туда (ИИ при этом не включается). «ИИ» — думает и стреляет сам. «В игре» — убрать / вернуть (вернуть — клик по карте).</div>' +
    '<div class="med-row"><button data-sb="allOn">ИИ всем</button><button data-sb="allOff">ИИ никому</button><button data-sb="allOut">Убрать всех</button></div>' +
    '<div class="sb-list"></div><div class="sb-info med-info"></div>';
  document.getElementById("main").appendChild(el);
  el.addEventListener("click", function(e){
    var t = e.target.closest && e.target.closest("[data-sb]"); if(!t) return;
    var k = t.getAttribute("data-sb"), id = t.getAttribute("data-id"), b = id ? sbBot(id) : null;
    if(k === "allOn") bots.forEach(function(o){ o._sbOff = false; });
    else if(k === "allOff") bots.forEach(function(o){ o._sbOff = true; });
    else if(k === "allOut") bots.forEach(function(o){ if(o.alive) sbRemove(o); });
    else if(k === "ai" && b) b._sbOff = !b._sbOff;
    else if(k === "in" && b){ if(b.alive) sbRemove(b); else { SANDBOX.place = b; SANDBOX.sel = b; } }
    else if(k === "sel" && b) SANDBOX.sel = b;
    sbRender(true); if(typeof draw === "function") draw();
  });
  SB_PANEL_EL = el; return el;
}
// причины решений выбранного бота — то, что пишут механики (только чтение)
function sbLogic(b){
  if(!b) return "Выбери бота — клик по имени или по кружку на карте.";
  if(!b.alive) return b.id + " убран. " + (SANDBOX.place === b ? "Кликни по карте — куда поставить." : "Нажми «в игре» и кликни по карте.");
  var L = [];
  L.push("<b>" + sbEsc(b.id + " · " + (typeof nick === "function" ? nick(b.id) : "") + " · " + b.team + " · " + (b.tRole || b.role || "") + " · HP " + Math.max(0, Math.round(b.hp)) + " · " + (b.weapon ? b.weapon.key : "") + " " + (b.ammo == null ? "" : b.ammo)) + "</b>");
  L.push("на карте: " + sbEsc(typeof whyText === "function" ? whyText(b) : ""));
  L.push("задача места: " + sbEsc(b._task ? b._task.tag + " (уровень " + b._task.lv + ")" : "нет") + (b.post ? " · " + sbEsc(calloutName(b.post.x, b.post.y)) + (b.atPost ? " · дошёл" : "") : ""));
  L.push("режим боя: " + sbEsc(b.state) + (b._stateWhy ? " — " + sbEsc(b._stateWhy) : ""));
  if(b._fc || b._fcWhy) L.push("перестрелка: " + sbEsc(b._fc ? b._fc.ph : "нет") + (b._fcWhy ? " — " + sbEsc(b._fcWhy) : ""));
  L.push("движение: " + sbEsc(Math.round(b.curSpeed || 0) + " px/с") + (b._walkWhy ? " · шагом: " + sbEsc(b._walkWhy) : "") + (b._runWhy ? " · бегом: " + sbEsc(b._runWhy) : "") + (b._stopWhy ? " · стоит: " + sbEsc(b._stopWhy) : ""));
  L.push("взгляд: " + sbEsc(b.lookReason || "по ходу") + (b.lookTarget ? " → " + sbEsc(calloutName(b.lookTarget.x, b.lookTarget.y)) : ""));
  if(b._contact) L.push("контакт: " + sbEsc((b._contact.tag || "") + " · ещё " + Math.max(0, ((b._contact.until - tick)/TICK_HZ)).toFixed(1) + " с"));
  if(b.nadeTask) L.push("граната: " + sbEsc(b.nadeTask.type + " — " + (b.nadeTask.why || "")));
  L.push("этаж: " + ((b._underV || 0) > 0.5 ? "под другим этажом" : (b._overV || 0) > 0.5 ? "над другим этажом" : "обычный") + " · z " + Math.round(b.z || 0));
  L.push("видит врагов: " + sbEsc((b._visible || []).filter(function(o){ return o.alive && o.team !== b.team; }).map(function(o){ return o.id; }).join(", ") || "нет"));
  if(b._sbOff) L.push("<i>ИИ выключен — " + (b._sbGo ? "идёт по приказу, не стреляет" : "стоит и не стреляет") + "</i>");
  return L.join("<br>");
}
function sbRender(force){
  var el = sbPanel(); el.style.display = SANDBOX.on ? "" : "none";
  var bt = document.getElementById("btnSandbox"); if(bt) bt.classList.toggle("on", SANDBOX.on);   // (v537) и после открытия отметки / перемотки
  if(!SANDBOX.on) return;
  var now = performance.now(); if(!force && now - SANDBOX.last < 200) return; SANDBOX.last = now;   // 5 раз в секунду хватает
  var rows = bots.map(function(b){
    var sel = SANDBOX.sel === b ? ' style="color:var(--accent)"' : '';
    return '<div class="med-row"><button data-sb="sel" data-id="' + b.id + '"' + sel + '>' + sbEsc(b.id + " " + (typeof nick === "function" ? nick(b.id) : "")) + '</button>' +
      '<button data-sb="ai" data-id="' + b.id + '">ИИ ' + (b._sbOff ? "выкл" : "вкл") + '</button>' +
      '<button data-sb="in" data-id="' + b.id + '">' + (b.alive ? "в игре" : "убран") + '</button></div>';
  }).join("");
  el.querySelector(".sb-list").innerHTML = rows;
  el.querySelector(".sb-info").innerHTML = sbLogic(SANDBOX.sel);
}
function sbToggle(){
  // (v539, владелец 10.11: «нажимаю песочницу — сразу игра с физикой обычного матча, не разминки, и не ждать закупку») включение: разминка
  // кончается (матч — как после неё, warmEnd), раунд между раундами — новый, закупка (freeze) пропускается — раунд идёт сразу
  if(!SANDBOX.on){
    if(typeof WARM !== "undefined" && WARM.on) warmEnd();   // до включения: warmEnd восстанавливает снимок матча (там песочница выключена)
    if(roundState === "ending") resetRound();
    if(roundState === "freeze"){ roundStartTime = simTime; roundStartTick = tick; }
  }
  SANDBOX.on = !SANDBOX.on;
  if(!SANDBOX.on){ bots.forEach(function(b){ b._sbOff = false; }); SANDBOX.drag = null; SANDBOX.place = null; }
  var bt = document.getElementById("btnSandbox"); if(bt) bt.classList.toggle("on", SANDBOX.on);
  logEvent("песочница " + (SANDBOX.on ? "включена — раунд не кончается" : "выключена"));
  sbRender(true); if(typeof draw === "function") draw();
}
// ---------- мышь: выбрать / перетащить / поставить ----------
function sbPick(w){
  var best = null, bd = 14/view.scale;
  bots.forEach(function(b){ if(!b.alive) return; var d = Math.hypot(b.x - w.x, b.y - w.y); if(d < bd){ bd = d; best = b; } });
  return best;
}
cv.addEventListener("mousedown", function(e){
  if(!SANDBOX.on || e.button !== 0 || (typeof mapEdOn === "function" && mapEdOn())) return;
  var w = navScreenToWorld(e.clientX, e.clientY);
  if(SANDBOX.place){ sbRevive(SANDBOX.place, w.x, w.y); SANDBOX.place = null; }
  else if(e.shiftKey && SANDBOX.sel && SANDBOX.sel.alive){ var g = snapToWalkable(w.x, w.y); SANDBOX.sel._sbGo = {x: g.x, y: g.y}; /* (v538, владелец: «если ИИ выключен и я веду его — ИИ не включать») ИИ не трогаем */ logEvent("песочница: " + SANDBOX.sel.id + " — иди сюда"); }
  else { var b = sbPick(w); if(!b) return; SANDBOX.sel = b; SANDBOX.drag = b; }
  e.stopImmediatePropagation(); e.preventDefault(); sbRender(true); if(typeof draw === "function") draw();
}, true);
window.addEventListener("mousemove", function(e){
  if(!SANDBOX.on || !SANDBOX.drag) return;
  var w = navScreenToWorld(e.clientX, e.clientY); sbPlace(SANDBOX.drag, w.x, w.y);
  if(typeof draw === "function") draw();
});
// (v540, скрин владельца 10.11: «Ошибка игры… Cannot read properties of null (reading 'tag')» в ctBrain) отпущенный бот терял пост, а «дошёл до
// поста» (atPost) оставался — мозг CT читал задачу поста, которого нет. Пост снимает только clearPost (110): и пост, и «дошёл», и задачу
window.addEventListener("mouseup", function(){ if(SANDBOX.drag){ clearPost(SANDBOX.drag); SANDBOX.drag = null; } });
(function(){ var bt = document.getElementById("btnSandbox"); if(bt) bt.addEventListener("click", sbToggle); })();
setInterval(function(){ if(SANDBOX.on || (SB_PANEL_EL && SB_PANEL_EL.style.display !== "none")) sbRender(false); }, 200);   // (v537) панель следует за SANDBOX.on и после перемотки
