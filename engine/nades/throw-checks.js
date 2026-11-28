// [хозяева: nadeSetNadeNo, nadeSetNadeT, nadeSetNades, nadeSetThrowUntil, runupTick]
function smokeCovered(x, y){
  // план §7: "два бота не кидают смок в одну точку, пока один ещё не рассеялся"
  // (v438, док владельца 27.10: два смока Stove + B Apps в 128 ед.; у про такая пара — 3 раунда из 742) «то же место» — облака
  // перекрылись бы (центры ближе двух радиусов смока), а не ближе 60
  var R = 2*NADE.smoke.radius;
  if(smokes.some(function(s){ return DM.hypot(s.x-x, s.y-y) < R && s.until - tick > 64; })) return true;
  return nadesInAir.some(function(n){ return n.type === "smoke" && DM.hypot((n.tx||n.x)-x, (n.ty||n.y)-y) < R; });
}
// (v489) бросок, отказавший «не долетит / стена / этаж», — запоминается: до конца раунда та же граната в ту же цель (≤ NADE_NO_TO) с того же места
// (≤ NADE_NO_FROM) не назначается. Облако v487, Ancient м11 + м17: после такого отказа 25–30 % целей пробовались снова через 0,2–0,8 с (медиана),
// 120 / 142 лишних попытки за матч — мозг гранат не помнил, что отсюда не долетело. Числа — проектные
var NADE_NO_TO = 80, NADE_NO_FROM = 120;
function nadeNoteFail(b, type, tx, ty){
  if(!nadeFailIs("geo")) return;
  var L = b._nadeNo && b._nadeNo.round === roundNum ? b._nadeNo.list : (nadeSetNadeNo(b, {round: roundNum, list: []})).list;
  L.push({type: type, tx: tx, ty: ty, x: b.x, y: b.y});
}
function nadeFailedHere(b, type, tx, ty){
  var N = b._nadeNo; if(!N || N.round !== roundNum) return false;
  return N.list.some(function(q){ return q.type === type && DM.hypot(q.tx-tx, q.ty-ty) <= NADE_NO_TO && DM.hypot(q.x-b.x, q.y-b.y) <= NADE_NO_FROM; });
}
// (v554, владелец 11.11: «гранаты без лайнапа кидают рандомно — без оценки, поможет ли, успеет ли; во время файтов и перед смертью; туда, где врагов
// точно нет, когда все убиты») одно место: своя граната (не лайнап и не граната плана команды — у тех opts.bkey) — только если есть смысл и время.
// Облако, 24 раунда Mirage (v553): 416 своих гранат; в миг броска HP < 30 — 54, ранен за ≤ 1 с — 41, видит врага — 19. Возвращает причину отказа
// или null. NADE_HIT_GAP, NADE_LOW_HP, NADE_FOE_R — проектные числа; порог «враг возможен» 0,2 — как «шумлю там, где враг вероятен» (tick)
var NADE_HIT_GAP = 64, NADE_LOW_HP = 30, NADE_FOE_R = 400, NADE_FOE_P = 0.2;   // (v554) проектные числа: тики «под огнём», HP, ед., ожидание врага в зоне
function nadeSelfWhyNot(b, type, pt){
  var foe = b.team === "CT" ? "T" : "CT";
  if(!bots.some(function(o){ return o.alive && o.team === foe; })) return "врагов нет";
  if(b._sawEnemy) return "видит врага — стреляется";
  if((b._hitIn || []).some(function(h){ return tick - h[0] < NADE_HIT_GAP; })) return "под огнём";
  if(b.hp < NADE_LOW_HP && tick - (b._lastSawT || -1e9) < 3*TICK_HZ) return "мало HP в бою";
  if(type === "smoke") return null;   // дым режет линию — нужен только живой враг (смок поверх смока отсекает smokeCovered)
  // флешка / молотов / HE — туда, где по знанию команды враг сейчас может быть: свежая инфа рядом с точкой или вес карты команды в её зоне
  var BL = kvLast(b.team);
  for(var e in BL){ var q = BL[e], o = teamBot(e); if(o && o.alive && tick - q.tick <= 6*TICK_HZ && DM.hypot(q.x-pt.x, q.y-pt.y) < NADE_FOE_R) return null; }
  if(BZ.ids.length){ var j = bzOf(pt.x, pt.y); if(j >= 0 && [j].concat(BZ.nbr[j] || []).some(function(k){ return reachPossible(b.team, k) && beliefZoneKnownB(b, k) >= NADE_FOE_P; })) return null; }
  return "там врага быть не может";
}
function assignNadeDo(b, type, target, why, opts){
  if(!b || !b.alive || !b.nades || b.nades[type] <= 0) return {ok: false, why: "нет гранаты"};
  // (v560, В98, разбор владельца 11.11: «зачем он кинул молотов» — молотов выхода «в любимый угол» кинул последний живой T, шедший за бомбой)
  // граната плана команды (bkey) — тоже с проверкой пользы и времени, кроме смока (он закрывает обзор и без известного врага)
  if(!(opts && opts.bkey) || type !== "smoke"){ var wn = nadeSelfWhyNot(b, type, target); if(wn){ nadeFail("self", wn); return {ok: false, why: wn}; } }
  if(nadeFailedHere(b, type, target.x, target.y)){ nadeFail("failedHere"); return {ok: false, why: NADE_FAIL}; }
  if(opts && opts.bkey && !builtinAllowed(opts.bkey)) return {ok: false, why: "встроенная граната выключена"}; // встроенная выключена или заменена своим лайнапом
  // (v428) план гранат команды (plan): граната, отложенная на более поздний момент (выход, после планта, ретейк), сейчас не тратится;
  // гранаты выхода T — момент «выход» и тогда, когда их кидают заранее, до пика (preExec)
  var npm = (opts && opts.bkey && /^T\.exec\./.test(opts.bkey)) ? "exec" : (opts && opts.bkey && /^T\.fake\./.test(opts.bkey)) ? "fake" : npMomentNow(b);
  if(!npCanUse(b, type, npm, null)){ nadeFail("plan", npWhyNot(b, type)); return {ok: false, why: NADE_FAIL}; }
  // (Г3, 04.11, разбор отметок п.19: молотов «комбо» затёрт смоком «отрезать вход», ни один не брошен; сторож: 74 замены на 8 матчей Mirage)
  // задание гранаты не перебивается другим — бросок доводится или сгорает по сроку (раньше перебивался любой не-лайнап другого типа)
  if(b.nadeTask) return {ok: false, why: "занят гранатой: " + b.nadeTask.type};
  if(type === "smoke" && smokeCovered(target.x, target.y)) return {ok: false, why: "точку уже закрывает дым"};
  // одна граната одного типа в одну точку: другие механики (комбо, флешка
  // себе, дамп…) не дублируют уже летящую/назначенную туда же
  if(type !== "smoke" && (nadesInAir.some(function(n){ return n.team === b.team && n.type === type && DM.hypot((n.tx||n.x)-target.x, (n.ty||n.y)-target.y) < 120; }) ||
     bots.some(function(o){ return o !== b && o.alive && o.team === b.team && o.nadeTask && o.nadeTask.type === type && DM.hypot(o.nadeTask.x-target.x, o.nadeTask.y-target.y) < 120; }))) return {ok: false, why: "туда уже летит / заказана своя"};
  // (v419) here — бросок только с места (задержать гранатой, 350): срок 2 с, на точку броска не идёт
  var here = !!(opts && opts.here);
  b.nadeTask = {type:type, x:target.x, y:target.y, until: tick + (here ? 2 : 10)*64, why:why||"", start:tick, lob:true, range:(opts && opts.range) || NADE_THROW_RANGE, now:!!(opts && opts.now), here:here, npm:npm, eid:(opts && opts.eid) || null, forC:(opts && opts.forC) || null};
  return {ok: true, why: "заказ"};
}
// (22.11, Ж23-П4, разбор м271222 р6: опорник, о котором не знали, кинул флешку, потом молотов «выкурить по инфе» — помощи не шло,
// а себя выдал) граната, которая выдаёт того, кого ещё не нашли (knowMeRevealed, events), — только когда от неё есть толк: обо мне и так
// знают; бомба стоит (ретейк / пост-плант); CT — слышим плант (сорвать) или свои уже идут ротацией на этот сайт; T — идёт выход команды
// (не лёркер). Иначе спрятанный не выдаёт себя гранатой
function nadeRevealOk(b){
  if(knowMeRevealed(b) || (bomb && bomb.state === "planted")) return true;
  if(b.team === "CT"){
    var PH = teamIntel.CT && teamIntel.CT.plantHeard; if(PH && tick - PH.tick < 5*TICK_HZ) return true;
    var go = teamTac.CT && teamTac.CT.go;
    return !!(go && go.ids && Object.keys(go.ids).length && SITES[go.site] && ctNearSite(b, SITES[go.site], 700));
  }
  return !!(teamTac.T && teamTac.T.phase === "execute" && b.tRole !== "lurker");
}
// (22.11, Ж23) заказчик гранаты: «под мой / его выход на врага» — {by, cid}: жива, пока у заказчика контакт с этим врагом (_contact, contact);
// «под его пробу» — {by, tag}: пока заказчик на той же задаче (тег поста при заказе). Только свойства задачи заказчика, без списков имён
function nadeOwnerOf(o, cid){ return cid !== undefined ? {by: o.id, cid: cid} : {by: o.id, tag: o.post ? o.post.tag : null}; }
function nadeOwnerOk(F){
  var o = teamBot(F.by); if(!o || !o.alive) return false;
  if(F.cid !== undefined) return !!(o._contact && tick < o._contact.until && (F.cid == null || o._contact.id === F.cid));
  return !!(o.post && o.post.tag === F.tag);
}
// (17.11, перестройка — модули) запись в журнал решений (trace) — здесь, у хозяина (было: 645 подменял функцию обёрткой)
// (Р3.2, канал «гранаты», шаг 1) хозяин заказа гранаты отвечает результатом {ok, why — причина отказа: нет гранаты, не по плану гранат,
// не долетит, занят гранатой, точку уже закрывает дым, своя туда уже летит / заказана}; assignNade — прежний да / нет (переходник);
// NADE_FAIL — как было (текст: exec-sync goneWhy); код NADE_FC — throwNadeDo (_tnMiss)
// (Р3.2 гранаты ш.2, Р-7, 26.11) заказ гранаты — ответ хозяина целиком: {ok, why} (было: да / нет, полный ответ — у assignNadeR)
function assignNade(b, type, target, why){
  var R = assignNadeDo.apply(this, arguments), r = R.ok;
  if(b) dlog(b, "граната", (r ? "заказ " : "отказ в заказе ") + type + " — " + (why || "") + (r ? "" : (b.nadeTask ? " (занят: " + b.nadeTask.type + " — " + b.nadeTask.why + ")" : "")));
  return R;
}
// задание на гранату выполняется, как только точка видна и в пределах броска
function nadeQueueNext(b){
  // (v355) следующая граната из очереди того же бойца: с той же точки броска, срок 6 с (проектное число)
  if(!b.alive || !b.nadeQueue || !b.nadeQueue.length || b.nadeTask) return;
  var q = nadeShiftQueued(b.nadeQueue);
  if(!b.nades || b.nades[q.type] <= 0 || roundState !== "live") return nadeQueueNext(b);
  // (v487) в очереди — и своя граната с места (без точки броска): её отложила передача смока выхода (exec-sync: exuReassign). Возвращается тем же
  // заданием со свежим сроком (как в assignNade: с места — 2 с, иначе 10 с). Было: очередь знала только броски с точки, q.from.x падал (v483)
  if(!q.from){ b.nadeTask = Object.assign({}, q, {until: tick + (q.here ? 2 : 10)*TICK_HZ, start: tick, int: null}); return; }
  var qSec = Math.max(6, Math.ceil(pathLenTo(b, q.from.x, q.from.y)/SPEED + LU_REACH_PAD));   // (v359) точка следующей — бывает дальше
  b.nadeTask = {type:q.type, x:q.x, y:q.y, from:q.from, until: tick + qSec*TICK_HZ, why:q.why, start:tick, lob:true, range:4000, now:true, lineup:true, exec:q.exec && q.type === "smoke", npm:q.npm, exu:q.exu, luL:q.luL || null, luId:q.luId};   // (v579) цель плана — у очереди CT (lineups)
}
// (этап 4) скорость бойца в миг броска: сдвиг за последний тик (движение идёт после гранат — 540), ед/с игры [vx, vy, 0]; y игры
// противоположен y радара. Обновляется каждый тик раунда для всех живых (nadeVelTrack), до заданий на гранату
// Вертикаль — 0: бот бросает с земли (прыжка у бота нет; подъём по ступеням — не прыжок, а модель CS считает прыжком всё, что
// поднимается быстрее 60 ед/с — 385 AIR_VZ). Сдвиг больше двух полных шагов за тик (SPEED × 2) — перенос (лестница, перемотка), не скорость
function nadeVelTrack(){
  var M = m3(), k = M ? M.unit / M.cell : 1;
  bots.forEach(function(b){ var p = b._nvP, v = null;
    if(p && p[2] === tick - 1 && b.alive){ var dx = b.x - p[0], dy = b.y - p[1]; if(DM.hypot(dx, dy)*TICK_HZ <= 2*SPEED) v = [dx*TICK_HZ*k, -dy*TICK_HZ*k, 0]; }
    b._nv = v; b._nvP = [b.x, b.y, tick]; });
}
function nadeBotVel(b){ var v = b._nv; return v && (v[0] || v[1]) ? v : null; }
// лайнап — бросок стоя (решение для точки лайнапа — стоя): боец, который ещё идёт (скорость > NADE_STILL_V), сначала останавливается
// (на посту лайнапа скорость гасится — 540), бросок — в тот тик, когда стоит. Своя граната летит с хода — со скоростью бойца
var NADE_STILL_V = 5;   // ед/с игры (проектное число: заметно меньше шага 2,5 ед. за тик)
function updateNadeTasks(){
  nadeVelTrack();
  bots.forEach(function(b){
    // (тактика 30.10) граната выхода T снята без броска — почему (NADE_FAIL последней попытки): для журнала 366
    var t0 = b.nadeTask; nadeFail(null); updateNadeTask1(b);
    if(t0 && t0.exu != null && b.nadeTask !== t0 && t0.exuThrown !== true) exuTaskGone(t0, b);
  });
}
// (v492) лайнап стоя — из точки броска: «дошёл» ближе LU_AT (9 px; v498 — 24 px, откачено в v499); застрял — не дальше RUN_NEAR (60 ед. —
// радиус бросков про у точки лайнапа). Было 34–36 px (общий приход поста): прогон 143, Mirage — 548 из 730 лайнап-смоков брошены в
// 28–36 px от точки, из них 20 % летят > 8,1 с (ближе 28 px — 1,5–2 %): подбор из того места — долгая «свеча»
// (v499) откат v498 (24 px): прогон 148, 16 матчей — стоячие лайнап-смоки сдвинулись из 5–15 px в 15–28 px и стали длиннее
// (> 8,1 с: Mirage 3,9 → 7,1 %, Ancient 11,0 → 13,2 %; все лайнап-смоки Mirage 8,9 → 12,8 %); флешек за раунд — в пределах шума (+2–3 %)
var LU_AT = 9;
var LU_NEAR = 40;   // (v560) ед. карты: до точки броска так близко, а дойти не даёт задача важнее, — бросает с места (проектное число)
var RUN_V = 0.9, RUN_COS = 0.94;   // скорость ≥ 90 % эталона (план п. 3); направление ± 20° (как перебор точки разгона)
var RUN_SEC = 4, RUN_MARGIN = 8, RUN_PAST = 24, RUN_NEAR = 24;   // с — разбег не дольше (проектное); px — запас к пути разгона (проектное);
// px — проскочил (проектное); px — «у точки»: 60 ед. — радиус, в котором бейк брал броски про у точки лайнапа (runup_bake.js), бросок из
// фактического места (подбор считает от него)
function runupFor(t){ if(t.runR) return t.runR; var R = MAP.runups; return R && t.luId ? R[t.luId] || null : null; }
// (v504, владелец 04.11: «в реальном CS есть гранаты, которые долетают туда, куда, кажется, не должны, — даже очень далеко: нужно правильно
// нацелиться, кинуть с разбега, в прыжке») своя граната (не лайнап), которая с места не долетает ни стоя, ни в прыжке (подбор пробует
// прыжок сам, 385), — бросок с разбега к цели: подбор со скоростью бега бойца (SPEED × оружие) в сторону цели и ± RUN_OWN_A; ложится в
// порог своей гранаты (nadeAimLimit) — точка броска здесь, разбег ведёт runupTick (тот же, что у лайнапов: точка разгона позади, бросок
// на ходу), эталон — найденный бросок (t.runR). Не ложится — как было (задание снимается). Прогон 152, отказы «не долетит», 120 на карту:
// стоя / в прыжке ложатся 29 / 30, с разбега — ещё 21 / 17 (Mirage / Ancient), остальные — сквозь стены и потолки
var RUN_OWN_A = [0, 10, -10];   // ° — направления разбега от направления на цель (проектные числа)
function nadeRunPlan(b, t){
  if(t.runOwnTried || t.here || t.runR || !m3()) return false;
  var M = m3(), k = M.unit / M.cell, sp = Math.round(SPEED * weaponSpeedMul(b) * k), bz = b.z != null ? b.z : visFloorAt(b.baseX, b.baseY),
      lim = nadeAimLimit(t.type, false), a0 = DM.atan2(-(t.y - b.baseY), t.x - b.baseX);   // y игры вверх, y радара вниз
  for(var i = t.runOwnI || 0; i < RUN_OWN_A.length; i++){
    if(!nadeBudgetLeft()){ t.runOwnI = i; return true; }   // (Д3) подбор этого тика исчерпан — следующий угол в следующем тике, задание ждёт
    var a = a0 + RUN_OWN_A[i]*Math.PI/180, dir = [DM.cos(a), DM.sin(a)], V = [Math.round(dir[0]*sp), Math.round(dir[1]*sp), 0];
    var S = nadeSolve(t.type, b.baseX, b.baseY, bz, t.x, t.y, false, false, null, V);
    if(!S || S.levelOk === false || S.e3 > lim) continue;
    t.from = {x: b.baseX, y: b.baseY}; t.gen = true; t.runOwn = true; t.runPh = null; t.runEnd = null; t.runFail = false;
    t.runR = {dir: dir, speed: sp, walk: false, jump: S.jump, yaw: S.yaw, pitch: S.pitch, strength: S.strength, err: S.e3};
    t.until = Math.max(t.until, tick + (RUN_SEC + 3)*TICK_HZ);
    logEvent(b.id+": граната «"+t.why+"» с места не долетает — с разбега");
    t.runOwnTried = true; return true;
  }
  t.runOwnTried = true;
  return false;
}
// точка разгона: позади точки броска против направления разбега, на пути разгона до скорости эталона (ACCEL, tick) + запас;
// путь по навмешу от неё до точки броска — почти прямой (≤ RUN_STRAIGHT × по прямой: иначе бот идёт в обход — ступени, ящики — и к точке
// подходит не с той стороны). Перебор: длина ×2 / ×3 / ×4 / ×1 (запас на разворот: бот приходит к точке разгона со стороны точки броска), отклонение 0 / ±10 / ±20°; не нашлось — null (бросок стоя)
var RUN_STRAIGHT = 1.2;   // проектное число
function runupStart(t, R){
  var sp = R.speed / (m3() ? m3().unit / m3().cell : 1), d0 = sp*sp/(2*ACCEL) + RUN_MARGIN;   // px
  var a0 = DM.atan2(-R.dir[1], R.dir[0]);   // y игры вверх, y радара вниз
  var Ds = [2, 3, 4, 1], As = [0, 10, -10, 20, -20];
  for(var i = 0; i < Ds.length; i++) for(var j = 0; j < As.length; j++){
    var a = a0 + As[j]*Math.PI/180, d = d0*Ds[i], p = {x: t.from.x - DM.cos(a)*d, y: t.from.y - DM.sin(a)*d};
    if(!navAt(p.x, p.y)) continue;
    var P = buildWaypointPath(p.x, p.y, 0, t.from.x, t.from.y, 0), L = 0, px = p.x, py = p.y;
    P.forEach(function(q){ L += DM.hypot(q[0]-px, q[1]-py); px = q[0]; py = q[1]; });
    if(P.length && DM.hypot(px-t.from.x, py-t.from.y) < 8 && L <= RUN_STRAIGHT*d) return p;
  }
  return null;
}
function runupTick(b, t){
  var R = runupFor(t);
  if(!t.runPh){ t.runStart = runupStart(t, R); if(!t.runStart){ if(t.runOwn){ nadeTaskEnd(b, "разбег: нет точки разгона", 0); return true; } t.runFail = true; return false; } t.runPh = "to"; }
  if(t.runPh === "to"){
    if(DM.hypot(t.runStart.x-b.baseX, t.runStart.y-b.baseY) > 6){
      if(b.state === "hold" && !b._sawEnemy) leaveHold(b);
      if(b.state === "patrol") setPost(b, t.runStart, t.from, false, "lineup"); else return true;   // без удержания: пост с hold притягивается к месту про (proSnap)
      postKeep(b); return true; }
    t.runPh = "go"; t.runT0 = tick; t.runWalk = !!R.walk; t.runMin = Infinity;
  }
  // go: идёт от точки разгона через точку броска (пост — за ней на RUN_PAST по той же прямой, без удержания: у поста бот тормозит, а
  // в точке броска скорость должна быть полной) и кидает на подходе
  if(!t.runEnd){ var ex = t.from.x - t.runStart.x, ey = t.from.y - t.runStart.y, el = DM.hypot(ex, ey) || 1, e2 = {x: t.from.x + ex/el*RUN_PAST*2, y: t.from.y + ey/el*RUN_PAST*2};
    t.runEnd = navAt(e2.x, e2.y) ? e2 : {x: t.from.x, y: t.from.y}; }
  setPost(b, t.runEnd, {x: t.x, y: t.y}, false, "lineup");
  var d = DM.hypot(t.from.x-b.baseX, t.from.y-b.baseY), step = SPEED/TICK_HZ, passed = d > t.runMin;
  // бросок — в ближайший к точке тик: уже у точки (≤ шаг) или прошёл ближайшее место, бывшее ≤ RUN_NEAR; прошёл дальше / не успел — стоя
  if(tick - t.runT0 > RUN_SEC*TICK_HZ || d > t.runMin + RUN_PAST){ if(t.runOwn){ nadeTaskEnd(b, "разбег: не успел / проскочил", 2); return true; } t.runFail = true; t.runPh = null; clearPost(b); return true; }
  // скорость в тик броска — как у эталона (± 10 %, план п. 3): не разогнался — не кидает (проскочит — бросок стоя)
  // (В142, v579) направление — по своей линии разгона (точка разгона → точка броска; её выбирают до ± 20° от направления про, runupStart):
  // сверка с направлением про при том же допуске ± 20° не проходила у точек со сдвигом (облако v579 м13, молотов Stove: бежит под 58° при
  // эталоне 28° — броска на ходу не было ни разу, стоя «не долетит»). Бросок всё равно подбирается с фактической скоростью (throwNade)
  var rx = t.from.x - t.runStart.x, ry = -(t.from.y - t.runStart.y), rl = DM.hypot(rx, ry) || 1;
  var V = nadeBotVel(b), vOk = V && DM.hypot(V[0], V[1]) >= RUN_V*R.speed && (V[0]*rx + V[1]*ry)/rl >= RUN_COS*DM.hypot(V[0], V[1]);
  var at = vOk && (d <= step + 2 || (passed && t.runMin <= RUN_NEAR));
  t.runMin = Math.min(t.runMin, d);
  if(!at || !nadeReady(b)) return true;
  if(!throwNade(b, t.type, t.x, t.y, true, t.why, !t.runOwn, t.from)){
    if(nadeFailIs("wait")) return true;
    if(t.runOwn){ nadeTaskEnd(b, "разбег: не легла", 2); return true; }   // (v504) своя с разбега не легла — стоя отсюда не долетала: снимается
    t.runFail = true; t.runPh = null; clearPost(b); return true; }   // с хода не ложится (подбор с фактической скоростью) — бросок стоя
  nadeTaskEnd(b, "брошена с разбега", 1); return true;
}
function updateNadeTask1(b){
    if(!b.nadeTask && b.nadeQueue && b.nadeQueue.length) nadeQueueNext(b);
    var t = b.nadeTask; if(!t) return;
    if(!b.alive || tick > t.until || !b.nades || b.nades[t.type] <= 0){
      // задание сгорело, а пост "лайнап" остался — снять, иначе стоит на точке броска весь раунд
      nadeTaskEnd(b, "срок / мёртв / нет гранаты", 1);
      return; }
    if(b.planting || b.defusing) return;
    // (v583a, Д20, владелец 17.11: «почему кидают гранаты на труп») граната по конкретному врагу (комбо, добить HE, выкурить по инфе) — он
    // убит (киллфид знают все) — бросать незачем: задание снимается
    if(t.eid && !bots.some(function(o){ return o.id === t.eid && o.alive; })){ nadeTaskEnd(b, "цель убита", 0); return; }
    // (22.11, Ж23, разбор м271222 р6: karrigan вышел на звук с флешкой «под выход», выход отменился в 48 с, а флешка брошена в 50,5 с в
    // старую точку и раскрыла его) граната ПОД ЧЬЮ-ТО ЗАДАЧУ (свой выход на врага, проба тиммейта, просьба «накиньте флешку») живёт, пока жива
    // та задача: заказчик жив и всё ещё в ней (nadeOwnerOk). Гранаты плана команды и лайнапы без заказчика это не трогает
    if(t.type !== "smoke" && knowCorpseOnly(b.team, t)){ nadeTaskEnd(b, "в труп", 1, true); return; }   // (22.11, Ж18) в труп — незачем
    if(t.forC && !nadeOwnerOk(t.forC)){ nadeTaskEnd(b, "заказчик вне задачи", 1); return; }
    if(t.here && !delaySafe(b)){ nadeTaskEnd(b, "враг рядом", 0); return; }   // (v419) враг виден / в упор — граната убирается, в руках оружие
    // (v359, р7) T уже на сайте выхода, а точка броска позади — задание снимается: с взятого сайта назад за гранатой не уходят
    if(t.lineup && t.from && b.team === "T" && teamTac.T && SITES[teamTac.T.site] && bomb.state !== "planted"){
      var Sx = SITES[teamTac.T.site], dB = DM.hypot(b.x-Sx.x, b.y-Sx.y);
      if((onSite(Sx, b.x, b.y) || dB < 450) && DM.hypot(t.from.x-Sx.x, t.from.y-Sx.y) > dB + 200){ nadeTaskEnd(b, "сайт взят, точка позади", 1, true); return; }
    }
    var d = DM.hypot(t.x-b.x, t.y-b.y);
    if(t.type === "smoke" && smokeCovered(t.x, t.y)){ nadeTaskEnd(b, "дым уже стоит", 0); return; }
    // (док 6, п.1: kyousuke шёл на Connector, контакт увёл его на B Short — и он пошёл назад на Connector) хозяин цели ушёл — точка броска
    // той же цели пересматривается раз в 0,5 с: ближе по пути — туда
    if(t.from && t.luL && tick % 32 === 0 && DM.hypot(t.from.x-b.baseX, t.from.y-b.baseY) > 36){
      var M = luSpotFor(b, t.luL, t.npm);
      if(M && (M.from.x !== t.from.x || M.from.y !== t.from.y) && pathLenTo(b, M.from.x, M.from.y) < pathLenTo(b, t.from.x, t.from.y)){
        t.from = {x:M.from.x, y:M.from.y}; t.x = M.to.x; t.y = M.to.y; t.why = "лайнап «"+(M.name||LU_TYPE[M.type])+"»"; t.luId = M.id; t.runPh = null; t.runEnd = null;
        if(b.post && b.post.tag === "lineup") clearPost(b); } }
    // (физика гранат: разбег) лайнап смока с эталоном броска на ходу (MAP.runups, tools/nades/runup_bake.js — броски про, повторённые скоростью
    // бота): встать в точку разгона позади точки броска, пробежать (или пройти шагом) через неё и кинуть на ходу; подбор — от эталона с
    // фактической скоростью бойца (throwNade: runGuess). Не вышло (нет точки разгона, не дошёл за RUN_SEC, проскочил) — бросок стоя, как раньше
    if(t.from && !t.runFail && runupFor(t) && runupTick(b, t)) return;   // (v496) все гранаты: эталон есть — у флешки / HE / молотова только там, где стоя не ложится
    if(t.from){ // свой лайнап: сначала встать ровно в точку броска
      // раньше кидал только ближе 22px к точке, а "дошёл до поста" считается
      // уже с 34px — бот вставал в 23–34px и стоял до конца задания, не кидая (v492: «дошёл» до лайнапа — ближе LU_AT, 110)
      // (v369, владелец: «пишется "идёт кидать гранату", но как будто не успевают кинуть») бот, стоявший на угле (state hold), к
      // точке броска не шёл вовсе — пост ставился только в patrol, и задание сгорало в 40–60 ед. от точки. Теперь угол он
      // оставляет (кроме боя: engage / retreat — сначала бой)
      var here = DM.hypot(t.from.x-b.baseX, t.from.y-b.baseY) > LU_AT && !(b.atPost && b.post && b.post.tag === "lineup");
      if(here){
        // (v570, отметка владельца м1 р3 15,7 с, CT1: «назначается лайнап, который он может кинуть и с текущего места») — было: к точке
        // лайнапа шёл всегда (3+ с через мид). Сначала — одна попытка броска отсюда: подбор считает полёт из места бойца (лайнап —
        // подсказкой), граната ложится туда же — летит сразу; не долетает / стена — идёт на точку. Пауза подбора — попробует в следующем тике
        var nbWait = t.notBefore && tick < t.notBefore && teamTac.T && teamTac.T.phase === "setup";   // (v583a, Д27) раздали заранее — сначала встать на точку
        if(!nbWait && !t._hereTried && (b.state === "patrol" || b.state === "hold") && nadeReady(b)){
          if(throwNade(b, t.type, t.x, t.y, true, t.why, false, t.from)){ nadeTaskEnd(b, "брошена отсюда", 1); return; }
          if(!nadeFailIs("pause")) t._hereTried = 1; }
        // (этап B, М3) уйти с угла к точке броска — только если арбитр пустит лайнап (иначе задача важнее держит бота, а лайнап каждый тик ломал удержание)
        if(b.state === "hold" && !b._sawEnemy && taskCanSet(b, "lineup")) leaveHold(b);
        // (v378) задача важнее броска (арбитр места) — бросок не идёт, пока она не кончится (с v438 — ждёт, а не отменяется)
        // (v438, док владельца 27.10: «мид взяли без гранат, хотя куплены»; замер: 29 % заданий снимала задача важнее — бой, перестановка)
        // задача важнее — бросок ждёт, пока она кончится (срок задания until остаётся: момент прошёл — граната не летит). Было — снимался сразу
        // (п.2/12 владельца 29.10: «бросать задачи и идти назад и кидать её»; м1 р2 NiKo — отход увёл от Connector, потом снова туда;
        // р4 donk — фланг к миду, потом назад в T Apps) ждёт — пока перебившая задача не увела его от точки броска: вернуться к броску —
        // только если точка не дальше по пути, чем была, когда перебили; ушёл дальше — бросок снят (идти назад за гранатой не надо)
        if(b.state === "patrol") setPost(b, t.from, {x:t.x, y:t.y}, true, "lineup");
        var lu = b.state === "patrol" && b.post && b.post.tag === "lineup";
        // (v560, В106, разбор владельца 11.11: «куча гранат, но не кидают» — флешка ретейка 10 с ждала, пока боец встанет в точку броска, а он
        // в 18 ед. от неё шёл по ретейку — задача важнее, к точке не пускала) задача важнее не даёт дойти, а точка рядом (≤ LU_NEAR) — бросок
        // отсюда: подбор считает его из места бойца (лайнап — подсказкой), как свою гранату — тем же броском ниже (here), без ожидания остановки
        if(lu || t._nearFail || DM.hypot(t.from.x-b.baseX, t.from.y-b.baseY) > LU_NEAR){   // (Д27) «отсюда» не долетел — только из точки
          if(!lu){ if(!t.int) t.int = {d: pathLenTo(b, t.from.x, t.from.y)}; }
          else if(t.int){ var dI = t.int.d; t.int = null;
            if(pathLenTo(b, t.from.x, t.from.y) > dI + 36){ logEvent(b.id+": граната отменена — после другой задачи точка броска позади ("+t.why+")");
              nadeTaskEnd(b, "точка позади после задачи", 2, true); return; } }
          return; } }
      if(!here) postKeep(b);   // стоит на точке броска — затея ещё идёт
      if(t.notBefore && tick < t.notBefore && teamTac.T && teamTac.T.phase === "setup") return;   // (v583a, Д27) стоит на точке и ждёт колла (preExecNow)
      if(!nadeReady(b)) return;   // (v340) только что кинул другую — задание ждёт
      // (Г3, 04.11, п.19: молотов «по инфе» 4 с ждал остановки, а ретейк вёл бойца к киту — сгорел) стоя — только лайнап (точный бросок про);
      // своя точка броска (gen) — и на ходу: подбор считает бросок со скоростью бойца (nadeBotVel → nadeSolve)
      var vNow = nadeBotVel(b); if(!t.gen && !here && vNow && DM.hypot(vNow[0], vNow[1]) > NADE_STILL_V) return;   // (этап 4) лайнап — стоя: ещё идёт — ждёт
      // не вышло на время (пауза между гранатами, свой в зоне огня) — задание остаётся, попробует снова; раньше снималось молча
      if(!throwNade(b, t.type, t.x, t.y, true, t.why, !t.gen && !here, t.from) && nadeFailIs("wait")) return;   // своя точка (gen) — дуга проверяется
      if(t.gen && b.nadeTask === t && nadeFailIs("far") && nadeRunPlan(b, t)) return;   // (v504) с места не долетает — с разбега
      // (v583a, Д27, прогоны 282–285: смок выхода «Cross» — 11 отказов «не долетит» в 15–39 ед. от точки броска) бросок не из самой точки лайнапа
      // (задача важнее не пускала дойти — бросок «отсюда», LU_NEAR) не долетел — задание не снимается: дойдёт до точки и кинет оттуда (срок — прежний)
      if(here && !t.gen && b.nadeTask === t && nadeFailIs("geo")){ t._nearFail = 1; return; }
      nadeTaskEnd(b, "попытка из точки", 1); return;
    }
    if(d <= t.range && hasLOS(b.x, b.y, t.x, t.y, b.z)){
      if(!nadeReady(b)) return;   // (v340) только что кинул другую — задание ждёт
      if(!throwNade(b, t.type, t.x, t.y, false, t.why) && (nadeFailIs("pause") || (nadeFailIs("far") && nadeRunPlan(b, t)))) return;   // (v504) с разбега; (Д3) пауза подбора — ждёт
      nadeTaskEnd(b, "попытка в прямой видимости", 0);
    } else if(t.lob && d <= t.range*0.85 && (t.now || tick - t.start > 64)){
      // навесом — точки не видно. (v370, отметка владельца: magixx кинул смок из T Ramp в Window сквозь здания) раньше «стены
      // по пути не мешают» для любого броска; теперь сквозь стены летят только лайнапы про (из демок, так кидали на самом деле).
      // Свой бросок — над открытым местом (проходы, окна, укрытия); нет пути — идёт на точку рядом, откуда граната долетает
      // (nadeThrowSpot: безопасную от известных врагов); нет и такой — не кидает
      if(!nadeReady(b)) return;   // (v438) пауза между гранатами — задание ждёт (раньше снималось: 277 заданий на 8 матчей)
      if(throwNade(b, t.type, t.x, t.y, true, t.why)){ nadeTaskEnd(b, "брошена навесом", 0); return; }
      if(nadeFailIs("pause")) return;   // (Д3) подбор этого тика исчерпан — попробует в следующем
      if(!nadeFailIs("geo") || t._spotTried || t.here){ nadeTaskEnd(b, "навесом не ложится", 0); return; }   // (v373) и под крышей — на точку, откуда долетит
      t._spotTried = true;
      var fs = nadeThrowSpot(b, t);
      if(!fs){ if(nadeFailIs("far") && nadeRunPlan(b, t)) return; nadeTaskEnd(b, "нет точки броска", 0); return; }   // (v507) места, откуда долетит стоя, нет — с разбега (v504 пробовал разбег раньше места: прогон 156 — бросков со своей точки 157 → 119–126 на 100 раундов)
      t.from = fs; t.gen = !fs.lane; t.until = Math.max(t.until, tick + Math.ceil(pathLenTo(b, fs.x, fs.y)/SPEED + 2)*TICK_HZ);
    }
}

// (v370) откуда докинуть свою гранату: точка в NADE_SPOT_R от бойца, откуда так кидают про (или без стены на пути), цель в
// пределах броска; не на виду у врагов, которых команда знает (≤ 8 с), и ближе по пути. Владелец: «главное, чтобы не дохли, пока
// шли до точки». Радиус — проектное число
var NADE_SPOT_R = 450;
function nadeThrowSpot(b, t){
  var bl = kvLast(b.team), foes = [];
  for(var e in bl){ var q = bl[e]; if(q && tick - q.tick <= 8*TICK_HZ && bots.some(function(o){ return o.id === e && o.alive; })) foes.push({x:q.x, y:q.y}); }
  var throwSpotExposed = function(q){ return foes.some(function(f){ return hasLOS(q.x, q.y, f.x, f.y); }); };
  // (v373) кандидаты — места, откуда про кидали в эту точку (MAP.nadelanes), и точки рядом без стены на пути
  // бросок с места про — как у про (долетит ли — решит бросок); своё место — граната долетает по физике (nadeLands, физика гранат 30.10)
  var c = nadeLaneFroms(t.x, t.y).filter(function(q){ return DM.hypot(q.x-b.x, q.y-b.y) <= NADE_SPOT_R && navAt(q.x, q.y); }).map(function(q){ return {x:q.x, y:q.y, lane:true}; })
    .concat(pickSpots("nthr"+b.id+"_"+Math.round(t.x)+","+Math.round(t.y), {x:b.x, y:b.y}, 8, {rMax:NADE_SPOT_R, minGap:40, hideFrom:foes})
      .filter(function(q){ return DM.hypot(q.x-t.x, q.y-t.y) <= t.range*0.85 && !crossesWall(q.x, q.y, t.x, t.y) && !throwSpotExposed(q) && nadeLands(t.type, q.x, q.y, null, t.x, t.y); }))
    .filter(function(q){ return (!q.lane || !throwSpotExposed(q)) && !luBehind(b, q); });   // (п.12) и не позади по ходу (lineups)
  // (Г6, скорость, 04.11) «не на виду у врагов» — до подбора броска (nadeLands — физика полёта): то же условие раньше; подбор и поиски пути
  // (luBehind, pathLenTo) — у того же набора точек, что и раньше: их запомненные пути (pathQ, 0,5 с) читают другие решения — порядок и
  // число этих вызовов менять нельзя (сверка 04.11: ленивый перебор сдвинул выбор лайнапа в м7 Ancient). Фриз точки броска — в пакете 2
  if(c.length > 12) c = c.sort(function(a, d){ return DM.hypot(a.x-b.x, a.y-b.y) - DM.hypot(d.x-b.x, d.y-b.y); }).slice(0, 12);
  var best = null, bL = Infinity;
  c.forEach(function(q){ var L = pathLenTo(b, q.x, q.y); if(L < bL){ bL = L; best = q; } });
  return best && bL <= NADE_SPOT_R*1.5 ? best : null;
}

// Запись состояния канала. Вызовы выполняются в исходной точке тика.
function nadeSetNadeNo(bot, value){ return bot._nadeNo = value; }
function nadeSetNadeT(bot, value){ return bot._nadeT = value; }
function nadeSetNades(bot, value){ return bot.nades = value; }
function nadeAddToStock(stock, type){ stock[type]++; }
function nadeChangeStock(stock, type, delta){ stock[type] = +stock[type] + delta; }
function nadeSetThrowUntil(bot, value){ return bot.throwUntil = value; }
