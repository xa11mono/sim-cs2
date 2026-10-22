// ======================= (v407) СЧЁТ ОШИБОК ДВИЖЕНИЯ — одно место (владелец 22.10: «их вообще не должно быть»; «ты уверен, что
// считается правильно?») =======================
// Только наблюдает — игру не меняет (не зовёт ничего, что меняет состояние ботов). Зовётся в конце stepTick. Читают: слой «ошибки
// движения» на странице (620_draw) и сторож замера (tools/measure/audit/watch.js → PROB).
//   stall — застрял: бот хочет идти (пост не достигнут, есть путь, шаг пути — patrol, скорость > 0 в ≥ 80 % окна — пытается идти, а не
//           стоит по плану; не держит угол, не в бою / броске / на
//           лестнице / ослеплён / ставит / дефузит), а за PROB_STALL_SEC с сдвинулся меньше PROB_STALL_MOVE. Один случай — один раз:
//           следующий — только после того, как бот ушёл от места больше чем на PROB_STALL_MOVE·2 (раньше сторож считал заново при
//           каждом сдвиге точки поста — ≈ 20 % повторов). Причина — проверка шага к следующей точке пути: стена / уступ / вне пола /
//           огонь, «шаг проходит» (путь есть, шаг свободен, а стоит).
//   nav   — перенос: за один тик сдвинулся дальше, чем может шагом (PROB_JUMP), без лестницы — «вне навмеша — перенесён» и «рывок»
//           застрявшего к пути (раньше считался только первый).
//   tug   — перетягивание: задача места за PROB_TUG_SEC меняется A → B → A; не считается, если B — бросок гранаты, а гранату за это
//           время бросил (законно: кинул и вернулся).
// Числа — проектные (как в стороже v373: 5 с / 25 px / 2 с).
var PROB_STALL_SEC = 5, PROB_STALL_MOVE = 25, PROB_TUG_SEC = 2, PROB_SHOW_SEC = 4;
var PROB = {n: {stall: 0, nav: 0, tug: 0}, ev: [], s: {}, round: -1, match: -1};
function probReset(){ PROB.n = {stall: 0, nav: 0, tug: 0}; PROB.ev = []; PROB.s = {}; PROB.round = -1; PROB.match = -1; }
function probEvent(kind, b, text){
  PROB.n[kind]++;
  PROB.ev.push({kind: kind, id: b.id, x: Math.round(b.baseX), y: Math.round(b.baseY), tick: tick, round: roundNum, text: text});
  if(PROB.ev.length > 400) PROB.ev.shift();
}
function probStallWhy(b){
  var wp = b.path && b.path[b.pathIdx]; if(!wp) return "нет пути";
  var d = Math.hypot(wp[0]-b.baseX, wp[1]-b.baseY); if(d < 0.5) return "на точке пути";
  var x2 = b.baseX + (wp[0]-b.baseX)/d*2, y2 = b.baseY + (wp[1]-b.baseY)/d*2;
  if(crossesWall(b.baseX, b.baseY, x2, y2)) return "стена";
  if(heightBlocked(b.baseX, b.baseY, x2, y2, b)) return "уступ";
  if(offNavStep(b.baseX, b.baseY, x2, y2, b)) return "край пола";
  if(!inFire(b.baseX, b.baseY) && inFire(x2, y2)) return "огонь";
  return "шаг проходит, а стоит";
}
function probTick(){
  if(PROB.match !== matchNum){ probReset(); PROB.match = matchNum; }   // новый матч — счёт заново
  if(PROB.round !== roundNum || roundState !== "live"){ if(PROB.round !== roundNum){ PROB.s = {}; PROB.round = roundNum; } else bots.forEach(function(b){ var s = PROB.s[b.id]; if(s){ s.x = b.x; s.y = b.y; } }); return; }
  var maxStep = SPEED/TICK_HZ*2 + 3;   // вдвое больше шага бегом + запас (ед. карты)
  bots.forEach(function(b){
    if(!b.alive){ delete PROB.s[b.id]; return; }
    var s = PROB.s[b.id] || (PROB.s[b.id] = {x: b.x, y: b.y, hist: [], tags: [], stallAt: null});
    // перенос — по видимой позиции (b.x: внутренняя baseX при выходе из пика сдвигается на смещение пика законно, видимая — нет)
    var jump = Math.hypot(b.x - s.x, b.y - s.y);
    if(jump > maxStep && !b._climb && !s.climb) probEvent("nav", b, "перенос на " + Math.round(jump) + " px");
    s.x = b.x; s.y = b.y; s.climb = !!b._climb;
    if(tick % 16) return;
    // перетягивание
    var tg = b.post ? String(b.post.tag).replace(/[:|].*$/, "") : "-";
    if(!s.tags.length || s.tags[s.tags.length-1].t !== tg){ s.tags.push({t: tg, at: tick, thr: b.throwUntil || 0}); if(s.tags.length > 4) s.tags.shift();
      var L = s.tags.length;
      if(L >= 3 && s.tags[L-1].t === s.tags[L-3].t && s.tags[L-1].t !== "-" && s.tags[L-2].t !== "-" && tick - s.tags[L-3].at <= PROB_TUG_SEC*TICK_HZ){
        var mid = s.tags[L-2], threw = (b.throwUntil || 0) > mid.at;
        if(!(mid.t === "lineup" && threw)) probEvent("tug", b, s.tags[L-3].t + " → " + mid.t + " → " + s.tags[L-1].t); } }
    // застрял
    if(s.stallAt && Math.hypot(b.baseX - s.stallAt.x, b.baseY - s.stallAt.y) > PROB_STALL_MOVE*2) s.stallAt = null;
    var wants = b.post && !b.atPost && b.state === "patrol" && !b.holding && Math.hypot(b.post.x-b.baseX, b.post.y-b.baseY) > 40;   // путь не обязателен: застрявшему его сбрасывают
    var busy = b.planting || b.defusing || b._climb || b._sawEnemy || b._fc || tick < (b.blindUntil||0) || tick < (b.throwUntil||0);
    // окно — только пока бот хочет идти к одной и той же задаче: сменилась задача / перестал хотеть / занят — заново (раньше в окно
    // попадало время до задачи: 5 с держал угол на месте, получил новую задачу — сразу «застрял»)
    // точка задачи может сдвигаться (контакт уточняется каждую секунду) — окно от этого не сбрасывается, только от смены задачи
    var key = wants && !busy ? tg : null;
    if(key === null || s.key !== key) s.hist = [];
    s.key = key;
    // в окне — позиция и «пытается идти» (скорость > 0.5: с нулевой бот стоит по плану — ждёт; это не застревание)
    if(key){ s.hist.push([b.baseX, b.baseY, b.curSpeed > 0.5 ? 1 : 0]); if(s.hist.length > PROB_STALL_SEC*TICK_HZ/16 + 1) s.hist.shift(); }
    if(wants && !busy && !s.stallAt && s.hist.length > PROB_STALL_SEC*TICK_HZ/16){
      var h0 = s.hist[0], tries = s.hist.reduce(function(n, q){ return n + q[2]; }, 0);
      if(Math.hypot(b.baseX - h0[0], b.baseY - h0[1]) < PROB_STALL_MOVE && tries >= s.hist.length*0.8){ s.stallAt = {x: b.baseX, y: b.baseY};
        probEvent("stall", b, "застрял («" + tg + "»): " + probStallWhy(b)); } }
  });
}
