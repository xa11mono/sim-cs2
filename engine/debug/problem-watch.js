// [хозяева: probTick] ======================= (v407) СЧЁТ ОШИБОК ДВИЖЕНИЯ — одно место (владелец 22.10: «их вообще не должно быть»; «ты уверен, что
// считается правильно?») =======================
// Только наблюдает — игру не меняет (не зовёт ничего, что меняет состояние ботов). Зовётся в конце stepTick. Читают: слой «ошибки
// движения» на странице (draw) и сторож замера (tools/measure/audit/watch.js → PROB).
//   stall — застрял: бот хочет идти (пост не достигнут, есть путь, шаг пути — patrol, скорость > 0 в ≥ 80 % окна — пытается идти, а не
//           стоит по плану; не держит угол, не в бою / броске / на
//           лестнице / ослеплён / ставит / дефузит), а за PROB_STALL_SEC с сдвинулся меньше PROB_STALL_MOVE. Один случай — один раз:
//           следующий — только после того, как бот ушёл от места больше чем на PROB_STALL_MOVE·2 (раньше сторож считал заново при
//           каждом сдвиге точки поста — ≈ 20 % повторов). Причина — проверка шага к следующей точке пути: стена / уступ / вне пола /
//           огонь, «шаг проходит» (путь есть, шаг свободен, а стоит).
//           Залип (v407б): своя задача PROB_BLOCK_SEC (8) с подряд не пускается другой (журнал решений: «отказ X: занят Y»), бот на
//           месте — тоже «застрял» (стоит «по плану», но своё не делает).
//   nav   — перенос: за один тик сдвинулся дальше, чем может шагом (PROB_JUMP), без лестницы — «вне навмеша — перенесён» и «рывок»
//           застрявшего к пути (раньше считался только первый).
//   tug   — перетягивание: задача места за PROB_TUG_SEC меняется A → B → A; не считается, если B — бросок гранаты, а гранату за это
//           время бросил (законно: кинул и вернулся).
// Числа — проектные (как в стороже v373: 5 с / 25 px / 2 с).
var PROB_STALL_SEC = 5, PROB_STALL_MOVE = 25, PROB_TUG_SEC = 2, PROB_SHOW_SEC = 4, PROB_BLOCK_SEC = 8;
var PROB = {n: {stall: 0, nav: 0, tug: 0}, ev: [], s: {}, round: -1, match: -1};
function probReset(){ PROB.n = {stall: 0, nav: 0, tug: 0}; PROB.sub = {}; PROB.ep = 0; PROB.all = []; PROB.ev = []; PROB.s = {}; PROB.round = -1; PROB.match = -1; }
// (Р3.6, 25.11, аудит Codex D: «stall смешивает физику и отказы») stall по причинам — РЯДОМ со старым счётом (PROB.n.stall не меняется,
// историческое сравнение сохраняется): stall.block — задачу не пускает задача выше (отказ арбитра), stall.geom — шаг упирается в геометрию
// (стена / уступ / край пола / огонь), stall.free — шаг свободен, а бот стоит (стоп, скорость), stall.path — нет пути / на точке пути.
// (Р-9, 26.11) вид — полем от того, кто нашёл причину (probStallWhy → [вид, текст]; «залип» — block), а не разбором текста события
// причинный след события (Р3.3 → Р3.6): какую задачу выполнял, почему шагом / стоял, куда и почему смотрел, последний ответ арбитра места
function probTrace(b){
  var A = (typeof dlogOf === "function" ? dlogOf(b, "_dlogA") : []), a = A[A.length-1];
  return {task: b._task ? b._task.tag + " ур. " + b._task.lv : (b.post ? b.post.tag : null), walk: b._walkWhy || null, stop: b._stopWhy || null,
    look: b.lookReason || null, state: b.state, arb: a ? Math.round((tick - a[0])/TICK_HZ*10)/10 + " с назад: " + a[2] : null};
}
function probEvent(kind, b, text, sub){
  PROB.n[kind]++;
  sub = sub ? kind + "." + sub : null;
  // (Р3.6, найдено в Р2 — P05: одно стояние давало два stall — «залип» и «застрял», и «залип» снова после паузы отказов > 1,5 с) эпизод
  // стояния — один, пока бот не отошёл на PROB_STALL_MOVE·2 от места, где эпизод начался (и в том же раунде): PROB.ep — РЯДОМ со старым счётом
  var ep = null;
  if(kind === "stall"){ var st = PROB.s[b.id] || (PROB.s[b.id] = {}), E = st.ep;
    if(!E || E.round !== roundNum || DM.hypot(b.baseX - E.x, b.baseY - E.y) > PROB_STALL_MOVE*2){ PROB.ep = (PROB.ep || 0) + 1; E = st.ep = {n: PROB.ep, x: b.baseX, y: b.baseY, round: roundNum}; }
    ep = E.n; }
  if(sub){ PROB.sub = PROB.sub || {}; PROB.sub[sub] = (PROB.sub[sub] || 0) + 1; }
  PROB.ev.push({kind: kind, id: b.id, x: Math.round(b.baseX), y: Math.round(b.baseY), tick: tick, round: roundNum, text: text, sub: sub, ep: ep, why: probTrace(b)});
  // (Р3.6, владелец 26.11) полный журнал матча — у каждого увеличения счётчика своя причина (PROB.all, без ограничения); PROB.ev — последние 400
  // (слой «ошибки движения» на экране)
  (PROB.all = PROB.all || []).push(PROB.ev[PROB.ev.length - 1]);
  if(PROB.ev.length > 400) PROB.ev.shift();
}
function probStallWhy(b){
  var wp = b.path && b.path[b.pathIdx]; if(!wp) return ["path", "нет пути"];
  var d = DM.hypot(wp[0]-b.baseX, wp[1]-b.baseY); if(d < 0.5) return ["path", "на точке пути"];
  var x2 = b.baseX + (wp[0]-b.baseX)/d*2, y2 = b.baseY + (wp[1]-b.baseY)/d*2;
  if(crossesWall(b.baseX, b.baseY, x2, y2)) return ["geom", "стена"];
  if(heightBlocked(b.baseX, b.baseY, x2, y2, b)) return ["geom", "уступ"];
  if(offNavStep(b.baseX, b.baseY, x2, y2, b)) return ["geom", "край пола"];
  if(!inFire(b.baseX, b.baseY, b.z) && inFire(x2, y2, b.z)) return ["geom", "огонь"];
  // (v570, диагностика прогона 215: «застрял (anchor / mid)» без причины в записи) — чем остановлен (535 _stopWhy), скорость, сколько раз за 5 с
  // пост ставился заново (setPost — _postSets); только текст наблюдения
  var nP = (b._postSets || []).filter(function(t){ return tick - t <= 5*TICK_HZ; }).length;
  return ["free", "шаг проходит, а стоит (стоп: " + (b._stopWhy || "—") + "; скорость " + Math.round(b.curSpeed || 0) + "; пост заново " + nP + " раз за 5 с)"];
}
function probTick(){
  if(PROB.match !== matchNum){ probReset(); PROB.match = matchNum; }   // новый матч — счёт заново
  if(PROB.round !== roundNum || roundState !== "live"){ if(PROB.round !== roundNum){ PROB.s = {}; PROB.round = roundNum; } else bots.forEach(function(b){ var s = PROB.s[b.id]; if(s){ s.x = b.x; s.y = b.y; } }); return; }
  var maxStep = SPEED/TICK_HZ*2 + 3;   // вдвое больше шага бегом + запас (ед. карты)
  bots.forEach(function(b){
    if(!b.alive){ delete PROB.s[b.id]; return; }
    var s = PROB.s[b.id] || (PROB.s[b.id] = {x: b.x, y: b.y, hist: [], tags: [], stallAt: null});
    // перенос — по видимой позиции (b.x: внутренняя baseX при выходе из пика сдвигается на смещение пика законно, видимая — нет)
    var jump = DM.hypot(b.x - s.x, b.y - s.y);
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
    // залип (v407б, отметка владельца 22.10, Mirage Jungle: CT1 16 с стоял на «держать угол на контакт», журнал каждую секунду —
    // «отказ «set:roamer»: занят «contact:hold»») — своя задача PROB_BLOCK_SEC с подряд не пускается другой (журнал решений, 645), а бот
    // на месте (< PROB_STALL_MOVE·2 за это время): это тоже застревание, хотя бот «стоит по плану»
    s.lh = s.lh || []; s.lh.push([tick, b.baseX, b.baseY]); while(s.lh.length && tick - s.lh[0][0] > PROB_BLOCK_SEC*TICK_HZ) s.lh.shift();
    var DL = dlogOf(b), ref = null, first = null, lastT = -1e9;
    for(var di = DL.length - 1; di >= 0; di--){ var m = DL[di][3]; if(DL[di][1] !== "место" || !m || !m.busy) continue;   // (Р-9) отказ места — поля записи следа (setPost), не текст
      var rk = m.ask.replace(/[:|].*$/, "") + "|" + m.busy.replace(/[:|].*$/, "");
      if(!ref){ if(tick - DL[di][0] > 1.5*TICK_HZ) break; ref = rk; lastT = DL[di][0]; first = DL[di][0]; }
      else if(rk === ref && first - DL[di][0] <= 1.5*TICK_HZ) first = DL[di][0]; else if(rk !== ref) continue; }
    if(ref && lastT - first >= PROB_BLOCK_SEC*TICK_HZ && s.blockRef !== ref && s.lh.length && DM.hypot(b.baseX - s.lh[0][1], b.baseY - s.lh[0][2]) < PROB_STALL_MOVE*2){
      s.blockRef = ref; var pr = ref.split("|");
      probEvent("stall", b, "залип: «" + pr[1] + "» " + Math.round((lastT - first)/TICK_HZ) + " с не пускает «" + pr[0] + "»", "block"); }
    else if(!ref) s.blockRef = null;
    // застрял
    if(s.stallAt && DM.hypot(b.baseX - s.stallAt.x, b.baseY - s.stallAt.y) > PROB_STALL_MOVE*2) s.stallAt = null;
    var wants = b.post && !b.atPost && b.state === "patrol" && !b.holding && DM.hypot(b.post.x-b.baseX, b.post.y-b.baseY) > 40;   // путь не обязателен: застрявшему его сбрасывают
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
      if(DM.hypot(b.baseX - h0[0], b.baseY - h0[1]) < PROB_STALL_MOVE && tries >= s.hist.length*0.8){ s.stallAt = {x: b.baseX, y: b.baseY};
        var SW = probStallWhy(b); probEvent("stall", b, "застрял («" + tg + "»): " + SW[1], SW[0]); } }
  });
}
