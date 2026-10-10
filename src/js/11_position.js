// ======================= ПОЗИЦИЯ И ВЗГЛЯД (шаг 5) =======================
// Одно место на «где бот стоит и куда смотрит, пока не видит врага»
// (docs/BRAIN.md, раздел 4; шаг 5 docs/PROMPTS.md). Бой (поворот на видимого
// врага, выстрел) — 15_combat.js; он берёт отсюда только posLook(b).
//
// CT: активный Setup из setups.json (раскладка «сколько на A / миде / B» из демок)
//   • раздача слотов — раз в раунд, в начале: роль бота (шаг 4) → слот по POS_FIT;
//   • точка слота — из его point + alternatives (positions.json), один раз:
//     фильтр по роли (RoleProfile.preferredAngle: standard / длинная линия / любая; якорь и
//     саппорт — ещё и не глубже POS.marginMin: запас времени до врага по навмешу, posMargin),
//     кроссфайр-напарники (pairWith) берут точки, которые вместе стоят в списке pairs;
//   • на месте — смотрит в angle точки; пересчёта каждый тик нет.
// Меняется только по событию:
//   • погиб свой — перераздача слотов среди живых (важные слоты не пустеют:
//     снайпер может уйти на опорник, саппорт — стать якорем); кто остался на своём
//     слоте — точку не меняет;
//   • дым встал между точкой и её углом — запасная точка (fallback) слота; дым ушёл — назад;
//   • угроза на slot (гипотеза врага с весом ≥ POS.threatW на входе, который держит
//     точка, BRAIN 4.4) — позиция та же, взгляд в пределах yawRange точки — на вход угрозы;
//   • смена Setup'а — план команды CT (teamKnowledge.planState.activeSetupId, решает IGL в
//     12_ct_brain.js): posTick видит новый id — перестраивает живых CT;
//   • ротация по инфе (ротатор, PRO_PLAY 3: «первым уходит со своей зоны, когда на другой сайт давят
//     или выходят», «ротироваться только по настоящей инфе»): по СВОЕМУ знанию (гипотезы + войс +
//     разрывы утилиты T у сайта) на сайте X ≥ POS.rotNeed врагов — туда идут ближайшие не-якоря, пока
//     защитников X меньше min(инфа, rotMax); точка — CT-точка из демок на стороне X. Якорь своего сайта
//     не уходит. На своей стороне стало ≥ rotNeed, а на X меньше — назад на свою точку.
//   • (v215) инфа для ротации — ещё и то, что команде уже сказали в войсе (доска teamKnow.threats:
//     «несколько B», «шаги Cave» — до утилиты выхода);
//   • подпуш за инфой (PRO_PLAY 3, 5: ранний пик, агрессия на миде, «ramp aggro»): точки push из демок —
//     каждая в раунде с вероятностью её доли у про (share), её берёт CT со слотом на той же стороне
//     (сначала entry/awp — инициаторы, якорь — последним), не больше POS.pushMax; приходит к типичной
//     секунде точки (sec), стоит её типичное время (hold), потом назад на слот; был контакт — назад сразу;
//   • после своего фрага или попадания по нему, когда врага уже не видно, — на другое место точки (запасная
//     или другой spot дальше POS.movedR): враг знает, где он.
// T: расстановки в данных нет (T-Setup'ы — сценарии execute, шаги 6–7) — стоят у спавна,
//   взгляд вперёд к центру карты (заплатка до шага 7, перенесена из 12_stub.js).
//
// Числа ниже — проектные константы, не из демок.
var POS_SETUPS = @@DATA:setups.json@@;
var POS = {
  arrive:      10,   // ближе — «на месте», px
  repathEvery: 32,   // движок сбросил путь (застрял) — снова к той же точке не чаще, тиков
  threatW:     0.5,  // гипотеза врага с таким весом и больше на входе угла — угроза на slot
  threatEvery: 8,    // как часто бот на месте сверяет угрозу, тиков
  smokeEvery:  16,   // как часто, пока есть дым, сверяется «угол закрыт дымом», тиков
  pfCone:      75,   // префайр / проверка места: не шире стольких ° от направления хода / удержания
  pfFar:       900,  // префайр / проверка места: и не дальше, px
  yawPad:      10,   // к yawRange точки — запас, ° (держит из-за края шире)
  keepBonus:   2,    // при перераздаче — за то, что остаёшься на своём слоте
  moveCost:    600,  // при перераздаче — −1 балл за столько px до новой точки
  marginMin:   3,    // с: якорь/саппорт — только точки, где свои успевают раньше врага хотя бы на столько
  // v214 (аудит п. 4): CT по ходу раунда
  rotEvery:    16,   // тиков: как часто CT сверяет «где бьют» по своему знанию
  rotNeed:     2,    // «настоящая инфа» о выходе на сайт: столько врагов там по своему знанию (или утилита выхода)
  rotPops:     2,    // разрывов гранат T у сайта за 3 с (слышал/видел) — это выход; врагов там — столько, сколько разрывов
  rotPopR:     450,  // px: разрыв «у сайта»
  rotMax:      4,    // защитников на сайте выхода не больше столько (вместе с теми, кто там стоял; v222: было 3)
  rotHearR:    700,  // px: шаги/стрельба ближе к сайту — это «идут на сайт» (v222, проектное число)
  rotApart:    150,  // px: точка ротации не ближе этого к цели тиммейта
  siteR:       450,  // px: «на сайте» — ближе этого к нему (как в замере реакции на стак, tools/measure/stack.py)
  // v215 (аудит п. 4, доделка): игры за инфой и смена позиции
  pushMax:     2,    // подпушей за раунд не больше (вдвоём — пара; данные дают в среднем ~1 на раунд)
  pushLead:    1,    // с: выйти так, чтобы быть на точке подпуша к её типичной секунде (sec), с запасом
  movedR:      40,   // px: после фрага / попадания — на другое место хотя бы так далеко (у про «откатился» > 40 px)
  pushHearR:   600,  // px: на подпуше услышал врага / сказали про зону так близко — назад (v221, проектное число)
  mateLookR:   500,  // px: тиммейт рядом — его направление взгляда уже держится (v224, проектное число)
  mateLookDeg: 25,   // °: направление «то же», если в пределах стольких градусов (v224, проектное число)
  endSnap:     80,   // px: конец пути ближе к цели — цель там (v224, проектное число: навмеш не всегда доходит до точки из демок)
  coverK:      0.6,  // напарник подпуша — на 60 % пути от своей точки к точке подпуша (v223, проектное число)
  // v227 (правка владельца 9): пик по инфе. Пики CT у про (10 демок: стоял ≥ 2 с → вышел на 30–250 px и вернулся ближе
  // 15 px к месту): отход 34 / 44 / 66 px (25 / 50 / 75 %), туда-обратно 2,75 с (медиана), 3,75 с (90 %). v235: замер в
  // v227 был с ошибкой — «вернулся» засчитывался уже на выходе (в 30–60 px), отсюда 0,8 с и 2,4 пика в минуту
  peekOut:     [34, 44, 66],
  peekSec:     2.75,
  peekMax:     3.75,
  // v228 (правка владельца 6 / В17): CT стоя не замирает. Из демок (8 демок, стоящие CT, шаг 0,25 с): одно направление
  // держат 1,8 / 3,2 / 7,8 / 15,2 с (25 / 50 / 75 / 90 %), потом переводят прицел (> 20°) — на какое, по долям с этой
  // точки (positions.json → looks, tools/ct_look_bake.py); джиггл — 0,12 на минуту стояния (тот же исправленный замер
  // пиков, v235; было 2,35 — ошибка замера: так часто про просто уходили с места, а не выглядывали и возвращались)
  jigglePerMin: 0.12,
  // v231 (замечание владельца: «стоят, никак не двигаются — точка держит»). Про, держащие место (за ±5 с не дальше 60 px;
  // 6 демок, шаг 0,25 с): сдвиг 0,5–10 px — CT 13,3 %, T 9,2 % четвертей секунды (боты — 2 %); прицел стоя меняется на
  // 0,5–2° в 6,2 %, 2–5° в 2,8 %, 5–20° в 3,4 % четвертей секунды (CT; T — почти так же)
  // v236: CT держит позицию в движении. У про CT на 10–45-й с до планта: стоит 25–33 %, шагом/медленно 42–50 %, бегом
  // 18–33 % (у ботов стояли 83 %). Отрезки (10 демок, 15–45-я с): стоит 0,25 / 0,25 / 0,75 / 1,75 с (25/50/75/90 %),
  // шагом — смещение 5,5 / 12 / 27 / 77 px. Бот так и делает: постоял — прошёл шагом в другое место рядом (откуда виден
  // его угол), постоял — снова. Далеко от середины зоны не уходит: не дальше POS.shuffleR (проектное число)
};
// насколько слот нужен команде, когда живых меньше, чем слотов: якорь сайта пустеть не должен —
// его вес больше, чем «свой слот + подходит по роли» у соседа, поэтому сосед на него переходит
var POS_IMPORTANCE = {anchor:8, mid_control:5, support:3, stack:2, mid_support:2, mid_extra:1};
// роль бота (шаг 4) → насколько ему подходит слот
var POS_FIT = {
  anchor:  {anchor:3, support:2, stack:2, mid_support:1, mid_extra:1, mid_control:0},
  support: {support:3, mid_support:3, stack:2, anchor:2, mid_extra:2, mid_control:1},
  awp:     {mid_control:3, anchor:2, support:1, mid_support:1, stack:1, mid_extra:0},
  entry:   {mid_extra:3, stack:3, mid_support:2, support:2, mid_control:1, anchor:0},
  lurker:  {mid_extra:2, stack:2, mid_support:2, support:1, mid_control:1, anchor:1}
};
var POS_PT = {};   // id → точка positions.json
KNOW_POSITIONS.points.forEach(function(p){ POS_PT[p.id] = p; });
var POS_STATE = {applied: null, aliveCT: -1};   // applied — id Setup'а, по которому сейчас стоят CT
var POS_LOG = [];  // {tick, round, who, slot, pid, why} — каждая смена цели (проверка «не дёргается»)

// активный Setup CT — из плана команды (12_team.js; выбирает IGL, 12_ct_brain.js)
function posSetup(){
  var id = teamOf("CT").planState.activeSetupId;
  for(var i = 0; i < POS_SETUPS.ct.length; i++) if(POS_SETUPS.ct[i].id === id) return POS_SETUPS.ct[i];
  return POS_SETUPS.ct[0];
}
function posKind(slotRole){ return slotRole.replace(/_[AB]$/, ""); }
function posSeed(b, salt){ return hashRand(matchNum*7919 + roundNum*613 + (b ? (b.id.charCodeAt(b.id.length-1)||0)*131 : 0) + salt); }
function posPick(list, wf, r){
  var s = 0; list.forEach(function(x){ s += wf(x); });
  var t = r * s;
  for(var i = 0; i < list.length; i++){ t -= wf(list[i]); if(t <= 0) return list[i]; }
  return list[list.length-1];
}
// какой тип точки роль берёт: standard / самая длинная линия / любой (BRAIN 4.3, RoleProfile)
function posAngleKind(role){
  var R = RoleProfile[role] || {};
  if(R.preferredAngle === "standard") return "standard";
  if(R.preferredAngle === "long_sightline") return "long";
  if(R.tradeReliance === "needs_partner") return "standard";   // якорь без напарника off не занимает
  return "any";
}
// кандидаты слота под роль: [{p, n}]
function posCands(slot, role, used){
  var L = [{id: slot.point, n: slot.n}].concat(slot.alternatives || []), seen = {}, out = [];
  L.forEach(function(a){
    var p = POS_PT[a.id];
    if(!p || seen[a.id] || used[a.id] || p.push) return;
    seen[a.id] = 1; out.push({p: p, n: Math.max(1, a.n || 1)});
  });
  var k = posAngleKind(role);
  if(k === "standard"){
    var st = out.filter(function(c){ return c.p.type === "standard"; }); if(st.length) out = st;
    // якорь/саппорт не встают в глубокие точки: свои должны успеть встать раньше, чем враг может её
    // увидеть, с запасом POS.marginMin (09.10, владелец: A Main — слишком глубоко); не посчитан — не берут
    var deep = out.filter(function(c){ var m = posMargin(c.p); return m !== null && m >= POS.marginMin; });
    if(deep.length) out = deep;
  }
  if(k === "long" && out.length){ var best = out.reduce(function(a, c){ return c.p.angle.dist > a.p.angle.dist ? c : a; }); out = [best]; }
  return out;
}
function posPairW(a, b){
  var P = KNOW_POSITIONS.pairs;
  for(var i = 0; i < P.length; i++) if((P[i].a === a && P[i].b === b) || (P[i].a === b && P[i].b === a)) return P[i].weight;
  return 0;
}

// ---------- запас времени точки (margin) — знание карты, как у любого игрока ----------
// Сколько секунд у своих в запасе: когда враг, выбежав со своего спавна, может оказаться там,
// откуда видно точку (в поле зрения точки — то, что она держит), минус когда свои добегают до
// неё. Бег — по навмешу игры (те же переходы, что у путей ботов), с ножом 250 ед. игры/с;
// «видно» — visLine игры (стены, высоты, укрытия), глаза стоя, до центра или углов области
// навмеша. Нет ни одного такого места — null (точка смотрит в стену вплотную). Один раз на точку.
var POS_RUN = 100;     // px/с — бег с ножом (250 ед. игры/с), самое быстрое, как враг может успеть
var POS_FOV = 60;      // ° от взгляда точки — что она держит
var POS_SEE = 1100;    // px — дальше не разглядеть (как KNOW.lookRange)
var POS_NAVD = {};     // сторона → {id области: путь от спавна этой стороны, px}
function posNavDist(side){
  if(POS_NAVD[side]) return POS_NAVD[side];
  var sp = side === "CT" ? CT_SPAWN : T_SPAWN, a0 = zoneOf(sp.x, sp.y, sp.z || 0), D = {};
  if(!a0) return (POS_NAVD[side] = D);
  var C = {}; function c(id){ return C[id] || (C[id] = zoneCentroid(zonesById[id])); }
  D[a0.id] = Math.hypot(c(a0.id).x - sp.x, c(a0.id).y - sp.y);
  var heap = makeHeap(), done = {}; heap.push(a0.id, D[a0.id]);
  while(heap.size()){
    var u = heap.pop().id; if(done[u]) continue; done[u] = true;
    (zoneGraph[u] || []).forEach(function(e){
      if(done[e.to] || NAV_BLOCKED[e.to]) return;
      var w = D[u] + Math.hypot(c(u).x - e.mid.x, c(u).y - e.mid.y) + Math.hypot(e.mid.x - c(e.to).x, e.mid.y - c(e.to).y);
      if(D[e.to] === undefined || w < D[e.to]){ D[e.to] = w; heap.push(e.to, w); }
    });
  }
  return (POS_NAVD[side] = D);
}
function posMargin(P){
  if(P._margin !== undefined) return P._margin;
  var own = posNavDist(P.side), foe = posNavDist(P.side === "CT" ? "T" : "CT");
  // область навмеша точки: из содержащих точку и достижимых — ближайшая по высоте (уровни друг над
  // другом); точка в щели — ближайшая достижимая по центру
  var ap = null, best = Infinity;
  NAVAREAS.forEach(function(A){
    if(own[A.id] === undefined) return;
    var inside = pointInPoly(P.x, P.y, A.points), c = zoneCentroid(A);
    var k = inside ? Math.abs((A.z || 0) - (P.z || 0)) : 1e6 + Math.hypot(c.x - P.x, c.y - P.y);
    if(k < best){ best = k; ap = A; }
  });
  if(!ap) return (P._margin = null);
  var cp = zoneCentroid(ap), tOwn = (own[ap.id] + Math.hypot(cp.x - P.x, cp.y - P.y)) / POS_RUN;
  var eye = visFloorAt(P.x, P.y) + VIS_EYE.stand, c0 = -P.yaw*Math.PI/180, tFoe = Infinity;
  // где враг может стоять в области: её центр и углы, подтянутые к центру на 20 %
  NAVAREAS.forEach(function(A){
    if(foe[A.id] === undefined) return;
    var c = zoneCentroid(A);
    var S = [c].concat(A.points.map(function(q){ return {x: q.x + (c.x - q.x)*0.2, y: q.y + (c.y - q.y)*0.2}; }));
    for(var i = 0; i < S.length; i++){
      var q = S[i], t = (foe[A.id] + Math.hypot(q.x - c.x, q.y - c.y)) / POS_RUN;
      if(t >= tFoe || Math.hypot(q.x - P.x, q.y - P.y) > POS_SEE) continue;
      var da = Math.atan2(q.y - P.y, q.x - P.x) - c0;
      da = Math.abs(((da + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
      if(da > POS_FOV*Math.PI/180) continue;
      if(visLine(P.x, P.y, eye, q.x, q.y, visFloorAt(q.x, q.y) + VIS_EYE.stand, false)) tFoe = t;
    }
  });
  return (P._margin = tFoe === Infinity ? null : tFoe - tOwn);
}

// ---------- раздача слотов ----------
// alive — живые CT; keep — учитывать текущие слоты (перераздача) или нет (начало раунда / новый Setup)
function posAssign(alive, keep){
  var S = posSetup().slots, n = Math.min(alive.length, S.length), best = null, bestS = -Infinity;
  function score(b, s){
    var k = posKind(s.role), sc = POS_IMPORTANCE[k] || 1, fit = POS_FIT[b.role] || POS_FIT.lurker;
    sc += fit[k] || 0;
    if(keep && b.pos && b.pos.slot === s.role) sc += POS.keepBonus;
    else if(keep){ var p = POS_PT[s.point]; if(p) sc -= Math.hypot(p.x-b.x, p.y-b.y) / POS.moveCost; }
    return sc;
  }
  // перебор: каждому живому — свой слот (до 5! = 120 вариантов)
  (function rec(i, used, acc, cur){
    if(i === alive.length || cur.length === n){ if(acc > bestS + 1e-9){ bestS = acc; best = cur.slice(); } return; }
    for(var j = 0; j < S.length; j++){
      if(used[j]) continue;
      used[j] = 1; cur.push(j); rec(i+1, used, acc + score(alive[i], S[j]), cur); cur.pop(); used[j] = 0;
    }
  })(0, {}, 0, []);
  var res = [];
  alive.forEach(function(b, i){ if(best && best[i] !== undefined) res.push({b: b, slot: S[best[i]]}); });
  return res;
}
// точки для тех, кому слот новый; напарники по кроссфайру — вместе
function posChoosePoints(asg, why){
  var used = {}, bySlot = {};
  asg.forEach(function(a){ bySlot[a.slot.role] = a; if(a.keep) used[a.b.pos.pid] = 1; });
  asg.sort(function(x, y){ return (POS_IMPORTANCE[posKind(y.slot.role)]||1) - (POS_IMPORTANCE[posKind(x.slot.role)]||1); });
  asg.forEach(function(a, ai){
    if(a.keep || a.pid) return;
    var mate = a.slot.pairWith ? bySlot[a.slot.pairWith] : null;
    var cA = posCands(a.slot, a.b.role, used), r = posSeed(a.b, 17 + ai);
    if(!cA.length) cA = [{p: POS_PT[a.slot.point], n: 1}];
    if(mate && (mate.keep || mate.pid)){                      // напарник уже стоит — к его точке
      var mp = mate.keep ? mate.b.pos.pid : mate.pid;
      var withM = cA.filter(function(c){ return posPairW(c.p.id, mp) > 0; });
      a.pid = posPick(withM.length ? withM : cA, function(c){ return withM.length ? posPairW(c.p.id, mp) : c.n; }, r).p.id;
    } else if(mate){                                          // оба новые — пара из списка pairs
      var cB = posCands(mate.slot, mate.b.role, used), J = [];
      cA.forEach(function(x){ cB.forEach(function(y){ var w = x.p.id !== y.p.id ? posPairW(x.p.id, y.p.id) : 0; if(w > 0) J.push({a: x.p.id, b: y.p.id, w: w}); }); });
      if(J.length){ var j = posPick(J, function(q){ return q.w; }, r); a.pid = j.a; mate.pid = j.b; used[j.b] = 1; }
      else a.pid = posPick(cA, function(c){ return c.n; }, r).p.id;
    } else a.pid = posPick(cA, function(c){ return c.n; }, r).p.id;
    used[a.pid] = 1;
  });
  asg.forEach(function(a){
    if(a.keep) return;
    if(!a.pid){ var c = posCands(a.slot, a.b.role, used); a.pid = (c.length ? c[0].p : POS_PT[a.slot.point]).id; used[a.pid] = 1; }
    a.b.pos = {slot: a.slot.role, pairWith: a.slot.pairWith, pid: a.pid, fb: false, threat: null, pathT: -1e9};
    posGo(a.b, why);
  });
}
// цель: точка слота или её запасная; путь — от того места, где бот сейчас
function posGo(b, why){
  var P = POS_PT[b.pos.fb ? POS_PT[b.pos.pid].fallback : b.pos.pid];
  var H = b.pos.fb ? null : posHoldTask(b, P), sp = H ? H.pt : {x: P.x, y: P.y};   // v237: где встать в районе точки — решает сам
  b.pos.cur = P.id; b.pos.tx = sp.x; b.pos.ty = sp.y; b.pos.tz = P.z || 0;
  b.pos.threat = null;
  b.walking = false;   // к точке / на ротацию — бегом
  posPath(b);
  POS_LOG.push({tick: tick, round: roundNum, who: b.id, slot: b.pos.slot, pid: P.id, why: why});
  if(why !== "раунд") logEvent("Позиция: "+nick(b.id)+" → "+b.pos.slot+" ("+P.area+(b.pos.fb ? ", запасная" : "")+") — "+why, "info");
}
function posPath(b){
  b.pos.pathT = tick;
  if(posLed(b)) return;   // ведёт сценарий (ретейк/сейв, 08_retake.js) — путь его
  b.path = buildWaypointPath(b.x, b.y, b.z, b.pos.tx, b.pos.ty, b.pos.tz); b.pathIdx = 0; b._pathBy = "pos";
  // путь кончается в ближайшей проходимой точке, а не ровно в цели: цель — там, куда бот реально дойдёт
  // (иначе «не дошёл» → новый путь каждые repathEvery тиков: бота «выталкивает», он снова идёт вставать; v224)
  var e = b.path.length ? b.path[b.path.length - 1] : null;
  if(e && Math.hypot(e[0] - b.pos.tx, e[1] - b.pos.ty) <= POS.endSnap){ b.pos.tx = e[0]; b.pos.ty = e[1]; }
}
function posLed(b){ return b._scrT !== undefined && tick - b._scrT <= 1; }

// ---------- события ----------
function posRoundStart(){
  if(roundNum === 1) POS_LOG.length = 0;
  bots.forEach(function(b){ delete b.pos; delete b._goDir; delete b._pf; });
  var alive = bots.filter(function(b){ return b.team === "CT" && b.alive; });
  POS_STATE.aliveCT = alive.length;
  POS_STATE.applied = posSetup().id;
  posChoosePoints(posAssign(alive, false), "раунд");
  posPlanPushes(alive);
  logEvent("Setup CT: "+posSetup().name+" — "+alive.map(function(b){ return nick(b.id)+" "+b.pos.slot+" ("+POS_PT[b.pos.pid].area+")"; }).join(", "), "round");
}
// план CT сменил Setup — перестроить живых CT (вызывает posTick)
function posApplySetup(){
  POS_STATE.applied = posSetup().id;
  var alive = bots.filter(function(b){ return b.team === "CT" && b.alive; });
  alive.forEach(function(b){ delete b.pos; });
  posChoosePoints(posAssign(alive, true), "смена Setup'а: "+posSetup().name);
}
function posReslot(){
  var alive = bots.filter(function(b){ return b.team === "CT" && b.alive; });
  var asg = posAssign(alive, true);
  asg.forEach(function(a){ a.keep = !!(a.b.pos && a.b.pos.slot === a.slot.role); });
  posChoosePoints(asg, "погиб свой, слоты перераспределены");
}
// дым между точкой и её углом (сама точка в дыму — тоже)
function posSmoked(P){ return smokeBlocks(P.x, P.y, P.angle.x, P.angle.y); }
function posSmokeCheck(b){
  var P = POS_PT[b.pos.pid], F = P.fallback && POS_PT[P.fallback];
  if(!b.pos.fb && F && posSmoked(P) && !posSmoked(F)){ b.pos.fb = true; posGo(b, "дым закрыл угол"); }
  else if(b.pos.fb && !posSmoked(P)){ b.pos.fb = false; posGo(b, "дым ушёл"); }
}
function posAngleZone(P){
  if(P._az === undefined){ var z = knowZoneAt(P.angle.x, P.angle.y); P._az = z ? teamNear(z) : []; }
  return P._az;
}
// угроза на slot: враг (по гипотезам самого бота) на входе, который держит точка. Считается вся вероятность врага на
// этом входе — сумма его гипотез там (v226: по одной гипотезе вес ≥ 0,5 почти не набирался — знание делит вес между
// ветками, — и угроза за матч была в 0,2 % замеров); точка — его самая весомая гипотеза там
function posThreatCheck(b){
  var P = POS_PT[b.pos.cur], Z = posAngleZone(P), best = null, bw = 0;
  var K = b.know;
  if(K) for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible) continue;
    var w = 0, top = null;
    B.hyps.forEach(function(h){
      if(h.x === undefined || Z.indexOf(h.zone) < 0) return;
      w += h.weight;
      if(!top || h.weight > top.weight) top = h;
    });
    if(top && w >= POS.threatW && w > bw){ bw = w; best = top; }
  }
  b.pos.threat = best ? {x: best.x, y: best.y} : null;
}
function posTick(){
  if(roundState !== "live") return;
  if(posSetup().id !== POS_STATE.applied) posApplySetup();
  var aliveCT = bots.filter(function(b){ return b.team === "CT" && b.alive; }).length;
  if(aliveCT < POS_STATE.aliveCT && aliveCT > 0) posReslot();
  POS_STATE.aliveCT = aliveCT;
  bots.forEach(function(b){
    if(!b.alive || !b.pos) return;
    if(posPeekTick(b)) return;   // пикает (v227) — цель пути не своя точка
    if(b.pos.back && tick - b.pos.back < TICK_HZ) b._strafe = tick;   // и назад с пика — так же, контрстрейфом (v229)
    var far = Math.hypot(b.pos.tx-b.x, b.pos.ty-b.y) > POS.arrive;
    var moving = b.path.length > 0 && b.pathIdx < b.path.length;
    if(far && !moving && tick - b.pos.pathT >= POS.repathEvery) posPath(b);   // движок сбросил путь — та же цель
    if((smokes.length || b.pos.fb) && (tick + (b.id.charCodeAt(b.id.length-1)||0)) % POS.smokeEvery === 0) posSmokeCheck(b);
    if(!far && (tick + (b.id.charCodeAt(0)||0)) % POS.threatEvery === 0) posThreatCheck(b);
    if((tick + (b.id.charCodeAt(0)||0)) % POS.threatEvery === 0 && posHoldTick(b)) return;
    if(posPushTick(b)) return;
    if(posCoverTick(b)) return;
    if(posAfterHit(b)) return;
    if(!far && !moving && posPeekCheck(b)) return;
    if((tick + (b.id.charCodeAt(1)||0)) % POS.rotEvery === 0){ if(!posSiteReact(b)) posRotateCheck(b); posEmptySite(b); }
  });
}
// ---------- «держать район» (v237, перенос из v166: holdSpot / holdGroup; замечание владельца 10.10: «точки — только
// рекомендация, движение свободное, как в v166») ----------
// Задача говорит только ЧТО держать: центр (рекомендованная точка из демок / место полосы T), радиус, что обязательно
// видеть (угол точки). Где встать, выбирает одна оценка по тому, что бот знает (как в v166):
//  + видно главный вход, откуда вероятнее всего придут (по его гипотезам о врагах — масса в зоне за входом и за ней);
//  − каждый лишний открытый вход («встать под один вход»); − засвеченное место (сам стрелял тут, тут убили своего);
//  − стоять кучей с тиммейтом; + кроссфайр (тот же вход под другим углом); + где обычно стоят про (сетка progrid);
//  − долго идти; − далеко от центра; + своё нынешнее место (не бегать между равными).
// Пересчёт раз в HOLD.reeval тиков (2 с): знание поменялось — место меняется само, без «точка → точка».
// Числа — из v166 (там они подобраны глазами и по замерам того времени: проектные числа)
var HOLD = {seeMain: 3.0, extraOpen: 1.6, burned: 1.5, burnR: 160, burnSec: 8, stackR: 110, stack: 1.2, cross: 0.8,
            travel: 0.6, objDist: 0.3, pro: 1.2, keep: 0.35, reeval: 128, minW: 0.02, nbrW: 0.6, rArea: 280, rMax: 340,
            strafeR: 200};   // strafeR — к новому месту ближе этого идёт, не отводя прицел с угла (боком/задом)
var PROGRID = @@DATA:progrid.json@@;
function holdProAt(team, x, y){
  var C = PROGRID.cell, n = PROGRID.n, cx = Math.floor(x/C), cy = Math.floor(y/C);
  return cx < 0 || cy < 0 || cx >= n || cy >= n ? 0 : PROGRID[team][cy*n + cx];
}
var HOLD_CANDS = {}, HOLD_ZNAV = null, HOLD_PORT = {};
function holdCands(center, rMin, rMax){
  var k = Math.round(center.x/20) + "," + Math.round(center.y/20) + "|" + rMin + "|" + rMax;
  if(HOLD_CANDS[k]) return HOLD_CANDS[k];
  var out = [];
  NAVAREAS.forEach(function(z){
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id] || []).length) return;
    var c = zoneCentroid(z), d = Math.hypot(c.x - center.x, c.y - center.y);
    if(d < rMin || d > rMax || insideSolidWall(c.x, c.y)) return;
    if(out.some(function(q){ return Math.hypot(q.x - c.x, q.y - c.y) < 24; })) return;
    out.push({x: c.x, y: c.y, d: d});
  });
  return (HOLD_CANDS[k] = out);
}
// вход из зоны колл-аута i в соседнюю nn: место навмеша в nn, ближайшее к центру i
function holdPortal(i, nn){
  var key = i + ">" + nn; if(HOLD_PORT[key] !== undefined) return HOLD_PORT[key];
  if(!HOLD_ZNAV){ HOLD_ZNAV = {}; NAVAREAS.forEach(function(z){ if(NAV_BLOCKED[z.id]) return; var c = zoneCentroid(z), zid = zoneIdAt(c.x, c.y); if(zid) (HOLD_ZNAV[zid] = HOLD_ZNAV[zid] || []).push(c); }); }
  var ci = knowGraph().c[i], best = null, bd = 1e9;
  (HOLD_ZNAV[nn] || []).forEach(function(c){ var d = Math.hypot(c.x - ci.x, c.y - ci.y); if(d < bd){ bd = d; best = c; } });
  return (HOLD_PORT[key] = best);
}
function holdMass(b, z){
  var K = b.know, m = 0; if(!K) return 0;
  for(var id in K.enemies) K.enemies[id].hyps.forEach(function(h){ if(h.zone === z) m += h.weight; });
  return m;
}
function holdEntrances(b, center, rArea){
  var g = knowGraph(), inside = {}, E = [];
  for(var z in g.c) if(Math.hypot(g.c[z].x - center.x, g.c[z].y - center.y) <= rArea) inside[z] = 1;
  var zc = knowZoneAt(center.x, center.y); if(zc) inside[zc] = 1;
  Object.keys(inside).forEach(function(i){
    (g.adj[i] || []).forEach(function(nn){
      if(inside[nn]) return;
      var p = holdPortal(i, nn); if(!p) return;
      var w = holdMass(b, nn) + 0.02;
      (g.adj[nn] || []).forEach(function(n2){ if(!inside[n2]) w += HOLD.nbrW*holdMass(b, n2); });
      var m = E.filter(function(e){ return Math.hypot(e.pt.x - p.x, e.pt.y - p.y) < 120; })[0];
      if(m) m.w += w; else E.push({pt: p, w: w, z: nn});
    });
  });
  E.sort(function(a, c){ return c.w - a.w; });
  return E;
}
// T: {key, center, rArea, rMin, rMax, must: [pt], mates: [{pt, see}]}
function holdSpot(b, T){
  var E = holdEntrances(b, T.center, T.rArea || HOLD.rArea).filter(function(e){ return e.w > HOLD.minW; });
  var wmax = E.length ? E[0].w : 1; E.forEach(function(e){ e.wn = e.w/wmax; });
  var cands = holdCands(T.center, T.rMin || 0, T.rMax || HOLD.rMax), must = T.must || [], H = b._hold;
  function eval1(c, useMust){
    if(useMust && !must.every(function(m){ return !crossesWall(c.x, c.y, m.x, m.y); })) return null;
    var main = 0, mainE = null, open = 0;
    E.forEach(function(e){ if(crossesWall(c.x, c.y, e.pt.x, e.pt.y)) return; open += e.wn; if(e.wn > main){ main = e.wn; mainE = e; } });
    var sc = HOLD.seeMain*main - HOLD.extraOpen*(open - main);
    if(tick - (b.lastShotTick || -1e9) < HOLD.burnSec*TICK_HZ && Math.hypot(c.x - b.x, c.y - b.y) < HOLD.burnR) sc -= HOLD.burned;
    if(bots.some(function(o){ return o.team === b.team && !o.alive && o._diedT !== undefined && tick - o._diedT < 10*TICK_HZ && Math.hypot(o.x - c.x, o.y - c.y) < HOLD.burnR; })) sc -= HOLD.burned;
    (T.mates || []).forEach(function(m){
      var dm = Math.hypot(m.pt.x - c.x, m.pt.y - c.y);
      if(dm < HOLD.stackR) sc -= HOLD.stack;
      else if(mainE && m.see && Math.hypot(m.see.pt.x - mainE.pt.x, m.see.pt.y - mainE.pt.y) < 60 && dm > 90){
        var a1 = Math.atan2(c.y - mainE.pt.y, c.x - mainE.pt.x), a2 = Math.atan2(m.pt.y - mainE.pt.y, m.pt.x - mainE.pt.x);
        var da = Math.abs(((a1 - a2 + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI);
        sc += da > 0.87 && da < 2.1 ? HOLD.cross : da > 0.5 ? HOLD.cross*0.4 : 0;
      }
    });
    sc += HOLD.pro*holdProAt(b.team, c.x, c.y);
    sc -= HOLD.travel*Math.hypot(c.x - b.x, c.y - b.y)*1.2/1000;
    sc -= HOLD.objDist*c.d/(T.rMax || HOLD.rMax);
    if(H && H.key === T.key && Math.hypot(c.x - H.pt.x, c.y - H.pt.y) < 40) sc += HOLD.keep;
    return {pt: {x: c.x, y: c.y}, s: sc, main: mainE};
  }
  var best = null;
  [true, false].some(function(useMust){
    cands.forEach(function(c){ var r = eval1(c, useMust); if(r && (!best || r.s > best.s)) best = r; });
    return !!best;
  });
  if(!best) return null;
  best.look = best.main ? best.main.pt : (E[0] ? E[0].pt : (must[0] || T.center));
  return best;
}
// задача «держать район» для бота: пересчёт раз в HOLD.reeval; возвращает {pt, look, see}; mates — уже выбранные места своих
function holdTask(b, T){
  var H = b._hold, same = H && H.key === T.key && H.round === roundNum;
  if(same && tick - H.t < HOLD.reeval) return H;
  var r = holdSpot(b, T);
  if(!r) return same ? H : null;
  b._hold = {key: T.key, round: roundNum, t: tick, pt: r.pt, look: r.look, see: r.main};
  return b._hold;
}
function holdMates(b){
  return bots.filter(function(o){ return o !== b && o.alive && o.team === b.team && o._hold && o._hold.round === roundNum; })
    .map(function(o){ return {pt: o._hold.pt, see: o._hold.see}; });
}
// CT: задача по точке слота (центр — точка, обязательно видеть — её угол)
function posHoldTask(b, P){
  return holdTask(b, {key: "ct:" + P.id, center: {x: P.x, y: P.y}, must: [P.angle], mates: holdMates(b)});
}
// стоит / идёт к месту: пересчёт; новое место дальше 40 px — туда (близко — шагом и с прицелом на угол)
function posHoldTick(b){
  if(b.pos.fb || b.pos.peek || b._sawEnemy || posLed(b) || b.pos.push || b.pos.cover) return false;
  var P = POS_PT[b.pos.cur]; if(!P) return false;
  var H = posHoldTask(b, P); if(!H) return false;
  if(Math.hypot(H.pt.x - b.pos.tx, H.pt.y - b.pos.ty) <= 40) return false;
  b.pos.tx = H.pt.x; b.pos.ty = H.pt.y;
  b.walking = Math.hypot(H.pt.x - b.x, H.pt.y - b.y) < HOLD.strafeR;
  posPath(b);
  return true;
}
// ---------- ротация по инфе (v214) ----------
// где бьют — по знанию самого бота: враги, которых он уверенно ставит на сторону (planLocatedList,
// 12_team.js: видел сам + войс), и разрывы гранат T у сайта, которые он слышал/видел (b.ears, «pop»)
function posPressure(b){
  var n = {A: 0, B: 0, mid: 0};
  planLocatedList(b).forEach(function(e){ n[e.region]++; });
  // сказанное команде (доска войса): «несколько B» — это инфа, даже если гипотезы бота ещё не дотянули
  var T = teamOf(b.team), said = {A: 0, B: 0, mid: 0};
  for(var z in T.threats){
    var th = T.threats[z], r = planRegion(z);
    if(!r || th.count === undefined || tick - th.tick > teamSec(TEAM.board)) continue;
    said[r] += th.count;
  }
  ["A", "B", "mid"].forEach(function(r){ n[r] = Math.max(n[r], said[r]); });
  // шаги/стрельба у сайта, которые он слышал сам за 3 с: сколько разных источников (ближе 150 px — один) — столько
  // примерно врагов идёт (v222: ротация по ранней инфе, до утилиты выхода)
  // свой погиб на сайте (киллфид + радар — место видно всем) за TEAM.board с: сайт берут — это настоящая инфа (v231;
  // у про после первой смерти CT на сайте до планта 43 % CT в 450–1300 px идут к нему за 5 с, у ботов было 7–25 %)
  ["A", "B"].forEach(function(k){ if(posSiteLost(b, k)) n[k] = Math.max(n[k], POS.rotNeed); });
  ["A", "B"].forEach(function(k){
    n[k] = Math.max(n[k], knowSources(b.know, function(h){ return Math.hypot(h.x - SITES[k].x, h.y - SITES[k].y) <= POS.rotHearR; }, KNOW.srcSec).length);
  });
  ["A", "B"].forEach(function(k){
    var s = SITES[k], pops = (b.ears || []).filter(function(e){
      return e.kind === "pop" && tick - e.tick <= 3*TICK_HZ && Math.hypot(e.x - s.x, e.y - s.y) <= POS.rotPopR; }).length;
    // выход с утилитой: сколько гранат легло у сайта, примерно столько людей за ними идёт (допущение, не из демок)
    if(pops >= POS.rotPops) n[k] = Math.max(n[k], pops);
  });
  return n;
}
// свой погиб на сайте X за последние TEAM.board с (место смерти видно на радаре)
function posSiteLost(b, X){
  return bots.some(function(o){ return o.team === b.team && !o.alive && o._diedT !== undefined && tick - o._diedT <= teamSec(TEAM.board) &&
    Math.hypot(o.x - SITES[X].x, o.y - SITES[X].y) <= POS.siteR; });
}
// до планта: раскладка (default) или потеря состава (fallback — раскладка та же, слоты поделены). v232: раньше ротация
// и реакция работали только в default — после первых смертей (fallback) CT переставали реагировать вовсе
function posPrePlant(){ var t = teamOf("CT").planState.type; return t === "default" || t === "fallback"; }
function posOnSite(b, X){ return Math.hypot(b.x - SITES[X].x, b.y - SITES[X].y) <= POS.siteR; }
function posRegionOf(b){ var P = POS_PT[b.pos.home || b.pos.pid]; return P ? P.region : null; }
function posRotateCheck(b){
  if(posLed(b) || !b.know || !posPrePlant()) return;
  var pr = posPressure(b), home = posRegionOf(b);
  // уже в ротации: на своей стороне жарко, а там, куда шёл, — нет → назад
  if(b.pos.rot){
    if(home && pr[home] >= POS.rotNeed && pr[b.pos.rot] < POS.rotNeed){
      var to = b.pos.rot; b.pos.pid = b.pos.home; b.pos.rot = null; b.pos.home = null; b.pos.fb = false;
      posGo(b, "назад со стороны " + to + ": на своей стороне " + pr[home] + " по инфе");
    }
    return;
  }
  if(/^anchor/.test(b.pos.slot)) return;            // якорь держит свой сайт
  var X = pr.A >= pr.B ? "A" : "B";
  // v231: «на сайте» — ближе POS.siteR к нему, а не «точка с той же стороны карты»: игрок в Cave (сторона B) раньше
  // считался уже на B и не шёл на сайт, когда тот брали
  if(home && home !== X && pr[home] >= 1) return;   // у себя (на другой стороне) есть враг — держит своё
  if(pr[X] < POS.rotNeed || posOnSite(b, X)) return;
  var CT = bots.filter(function(o){ return o.team === "CT" && o.alive && o.pos; });
  var at = CT.filter(function(o){ return o.pos.rot === X || (!o.pos.rot && posOnSite(o, X)); }).length;
  // сайт берут (свой погиб на нём) — идут все, кроме якорей (до POS.rotMax на сайте): у про после первой смерти CT на
  // сайте 43 % CT в 450–1300 px идут к нему за 5 с (v231); иначе — сколько врагов там по инфе
  var need = posSiteLost(b, X) ? POS.rotMax : Math.min(pr[X], POS.rotMax);
  if(at >= need) return;
  // идут ближайшие к сайту не-якоря — я среди первых (need − at)?
  var s = SITES[X];
  var cand = CT.filter(function(o){ return !o.pos.rot && !/^anchor/.test(o.pos.slot) && !posOnSite(o, X); })
    .sort(function(a, c){ return Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(c.x - s.x, c.y - s.y); });
  if(cand.indexOf(b) < 0 || cand.indexOf(b) >= need - at) return;
  var taken = CT.filter(function(o){ return o !== b; }).map(function(o){ return {x: o.pos.tx, y: o.pos.ty}; });
  var best = null, bd = 1e9;
  KNOW_POSITIONS.points.forEach(function(P){
    if(P.side !== "CT" || P.push || P.region !== X || Math.hypot(P.x - s.x, P.y - s.y) > POS.siteR) return;
    if(taken.some(function(t){ return Math.hypot(t.x - P.x, t.y - P.y) < POS.rotApart; })) return;
    var d = Math.hypot(P.x - b.x, P.y - b.y) * (P.type === "standard" ? 1 : 1.3);
    if(d < bd){ bd = d; best = P; }
  });
  if(!best) return;
  b.pos.home = b.pos.pid; b.pos.rot = X; b.pos.pid = best.id; b.pos.fb = false;
  posGo(b, "ротация на " + X + " — по инфе: там " + pr[X] + (pr[X] >= POS.rotNeed && planLocatedList(b).filter(function(e){ return e.region === X; }).length < pr[X] ? " (утилита выхода)" : ""));
}
// ---------- сайт берут: стоящий на нём разворачивается к месту смерти своего (v232–v233) ----------
// Замечание владельца: «один пикнул и погиб, второй ничего не делает до планта». У про после первой смерти CT на сайте
// CT на этом же сайте за 5 с сдвигаются больше чем на 100 px в 60 % случаев. Проверено (v232–v233): переход на другую
// точку сайта — и с видом на место смерти, и скрытую от него — стоил CT больше, чем давал (36–40 смертей на 20–24
// фрага за 3 матча; без перехода — 145 на 124 по всему раунду). Поэтому: бот поворачивается туда, где погиб свой (там
// враг), и выбирает место в своей зоне заново (posZoneTick: смерть своего меняет знание — скрыться от известных врагов)
function posSiteReact(b){
  if(posLed(b) || b._sawEnemy || b.pos.peek || !posPrePlant()) return false;
  var X = ["A", "B"].filter(function(k){ return posOnSite(b, k) && posSiteLost(b, k); })[0];
  if(!X) return false;
  var dead = bots.filter(function(o){ return o.team === b.team && !o.alive && o._diedT !== undefined && tick - o._diedT <= teamSec(TEAM.board) &&
    Math.hypot(o.x - SITES[X].x, o.y - SITES[X].y) <= POS.siteR; }).sort(function(a, c){ return c._diedT - a._diedT; })[0];
  if(!dead || b.pos.reactTo === dead.id + ":" + dead._diedT) return false;
  b.pos.reactTo = dead.id + ":" + dead._diedT;
  b.pos.reactLook = {x: dead.x, y: dead.y, until: tick + 5*TICK_HZ};
  POS_LOG.push({tick: tick, round: roundNum, who: b.id, slot: b.pos.slot, pid: b.pos.cur, why: "сайт берут: погиб " + dead.id + " — смотрю туда"});
  return false;
}
// ---------- нас мало: пустой сайт (v232, замечание владельца: «стак 0-3-2, мид убили — последний на B стоит, хотя
// понятно, что пойдут на A») ----------
// Как думает IGL T (07_t_brain.js, tbDefenders: выход — в сайт, где защитников меньше; у про так в 82 % плантов), так CT
// и ждут: живых CT ≤ 2, на одном сайте никого, а у себя врагов по знанию нет — ближайший к пустому сайту идёт туда
// (якорь — тоже: держать нечего, если сайт, куда пойдут, пуст). Один на сайт; где стоять — точка CT того сайта (демки)
function posEmptySite(b){
  if(posLed(b) || b._sawEnemy || b.pos.rot || b.pos.peek || !posPrePlant()) return false;
  var CT = bots.filter(function(o){ return o.team === b.team && o.alive && o.pos; });
  if(CT.length > 2) return false;
  var pr = posPressure(b), home = posRegionOf(b);
  if(home && pr[home] >= 1) return false;
  var X = ["A", "B"].filter(function(k){ return !CT.some(function(o){ return o.pos.rot === k || (!o.pos.rot && posOnSite(o, k)); }); })[0];
  if(!X) return false;
  var s = SITES[X], near = CT.slice().sort(function(a, c){ return Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(c.x - s.x, c.y - s.y); })[0];
  if(near !== b) return false;
  var best = null, bd = 1e9;
  KNOW_POSITIONS.points.forEach(function(P){
    if(P.side !== "CT" || P.push || Math.hypot(P.x - s.x, P.y - s.y) > POS.siteR) return;
    var d = Math.hypot(P.x - b.x, P.y - b.y)*(P.type === "standard" ? 1 : 1.3);
    if(d < bd){ bd = d; best = P; }
  });
  if(!best) return false;
  b.pos.home = b.pos.pid; b.pos.rot = X; b.pos.pid = best.id; b.pos.fb = false;
  posGo(b, "нас " + CT.length + ", на " + X + " никого — туда (пойдут в пустой сайт)");
  return true;
}
// ---------- подпуш за инфой (v215) ----------
function posPlanPushes(alive){
  var used = {}, n = 0, fit = {entry: 0, awp: 1, support: 2, lurker: 2, anchor: 3};
  KNOW_POSITIONS.points.filter(function(P){ return P.side === "CT" && P.push; })
    .sort(function(a, c){ return c.share - a.share; })
    .forEach(function(P, i){
      if(n >= POS.pushMax || posSeed(null, 401 + i*17) >= P.share) return;   // в этом раунде её не берут
      var reg = P.region === "Tside" || P.region === "back" ? "mid" : P.region, best = null, bs = 1e9;
      alive.forEach(function(b){
        if(used[b.id] || !b.pos) return;
        var home = POS_PT[b.pos.pid];
        if(!home || home.region !== reg) return;
        var sc = (fit[b.role] === undefined ? 2 : fit[b.role])*1000 + Math.hypot(home.x - P.x, home.y - P.y);
        if(sc < bs){ bs = sc; best = b; }
      });
      if(!best) return;
      // v223: подпуш не в одиночку (PRO_PLAY 3, 5: «подпуш парой», «не пикать одному»): напарник — ближайший CT той же
      // стороны, не якорь; он держит отход подпушившего. Нет напарника — подпуш только с флешкой под выход, иначе не идёт
      var mate = null, md = 1e9;
      alive.forEach(function(o){
        if(o === best || used[o.id] || !o.pos || /^anchor/.test(o.pos.slot)) return;
        var h = POS_PT[o.pos.pid]; if(!h || h.region !== reg) return;
        var d = Math.hypot(h.x - P.x, h.y - P.y); if(d < md){ md = d; mate = o; }
      });
      if(!mate && !(best.nades && best.nades.flash > 0)) return;
      used[best.id] = true; n++;
      best.pos.push = {pid: P.id, state: "wait", at: roundStartTick + Math.round(P.sec*TICK_HZ), hold: Math.round(P.hold*TICK_HZ),
                       mate: mate, flash: !mate};
      if(mate){ used[mate.id] = true; mate.pos.cover = {who: best, pid: P.id}; }
      POS_LOG.push({tick: tick, round: roundNum, who: best.id, slot: best.pos.slot, pid: P.id,
                    why: "план подпуша на " + P.sec + "-й с" + (mate ? ", напарник " + mate.id : ", один — с флешкой")});
    });
}
function posPushTick(b){
  var Q = b.pos.push; if(!Q || Q.state === "done" || posLed(b)) return false;
  var P = POS_PT[Q.pid], home = POS_PT[b.pos.pid];
  if(teamOf("CT").planState.type !== "default" || b.pos.rot){ Q.state = "done"; posGo(b, "подпуш отменён"); return false; }
  if(Q.state === "wait"){
    var travel = Math.hypot(P.x - b.x, P.y - b.y)*1.35/SPEED*TICK_HZ + POS.pushLead*TICK_HZ;
    if(tick < Q.at - travel) return false;
    Q.state = "go";
    b.pos.tx = P.x; b.pos.ty = P.y; b.pos.tz = P.z || 0; b.pos.cur = P.id; b.walking = false; posPath(b);
    if(Q.flash && b.nades.flash > 0) nadeThrow(b, "flash", P.angle.x, P.angle.y, true, "флешка под подпуш — " + P.area);   // выходит за своей флешкой
    logEvent("Позиция: " + nick(b.id) + " — подпуш за инфой: " + P.area, "info");
    return true;
  }
  var contact = b._sawEnemy || tick - (b._lastSawT || -1e9) < TICK_HZ/2;
  // подпуш — за инфой, не за дуэлью (PRO_PLAY 5: «не пикать одному на миде — драться с поддержкой или отойти»;
  // у про у push-точек гибнут в 0–14 % раундов): инфа пришла раньше врага — назад (v221)
  if(!contact && (Q.state === "go" || Q.state === "hold")){
    var why = posPushInfo(b, P);
    if(why){ Q.state = "done"; posGo(b, "подпуш: " + why + " — инфа есть, назад"); return true; }
  }
  if(Q.state === "go"){
    if(contact){ Q.saw = true; return true; }
    if(Q.saw){ Q.state = "done"; posGo(b, "подпуш: был контакт — назад на слот"); return true; }   // встретил по пути — назад
    if(Math.hypot(P.x - b.x, P.y - b.y) <= POS.arrive*2){ Q.state = "hold"; Q.until = tick + Q.hold; }
    return true;
  }
  if(Q.state === "hold"){
    if(contact){ Q.saw = true; return true; }   // перестрелка — движок
    if(Q.saw || tick >= Q.until){
      Q.state = "done";
      posGo(b, Q.saw ? "подпуш: был контакт — назад на слот" : "подпуш: никого — назад на слот");
    }
    return true;
  }
  return false;
}
// напарник подпуша: стоит между своей точкой и точкой подпуша (ближе к подпушу) — на размен и прикрыть отход;
// подпушивший вернулся/погиб — назад на свою точку
function posCoverTick(b){
  var C = b.pos.cover; if(!C || posLed(b)) return false;
  var w = C.who, Q = w && w.pos && w.pos.push;
  if(!w || !w.alive || !Q || Q.state === "done" || teamOf("CT").planState.type !== "default"){
    b.pos.cover = null; posGo(b, "прикрытие подпуша закончено"); return true;
  }
  if(Q.state === "wait") return false;
  var P = POS_PT[Q.pid], H = POS_PT[b.pos.pid];
  var tx = H.x + (P.x - H.x)*POS.coverK, ty = H.y + (P.y - H.y)*POS.coverK, t = snapToWalkable(tx, ty) || {x: H.x, y: H.y};
  if(Math.hypot(t.x - b.pos.tx, t.y - b.pos.ty) > 30){ b.pos.tx = t.x; b.pos.ty = t.y; b.walking = false; posPath(b); }
  return true;
}
// инфа на подпуше: свои шаги/стрельба рядом (слух) или команде уже сказали, что враги у точки (доска войса)
function posPushInfo(b, P){
  var K = b.know;
  if(K) for(var i = K.heard.length - 1; i >= 0 && tick - K.heard[i].tick <= 2; i--){
    var h = K.heard[i];
    if((h.kind === "steps" || h.kind === "shots" || h.kind === "water") && Math.hypot(h.x - b.x, h.y - b.y) <= POS.pushHearR)
      return "слышу " + (h.kind === "shots" ? "стрельбу" : "шаги") + " " + knowZoneName(h.zone);
  }
  var T = teamOf(b.team);
  for(var z in T.threats){
    var th = T.threats[z], c = knowGraph().c[z];
    if(!c || !th.count || tick - th.tick > teamSec(TEAM.board)) continue;
    if(Math.hypot(c.x - P.x, c.y - P.y) <= POS.pushHearR) return "сказали: " + knowZoneName(z);
  }
  return null;
}
// ---------- пик по инфе (v227, правка владельца 9; PRO_PLAY 3: «игры за инфой — один джигглит») ----------
// Стоит на месте, врага не видит, а только что (≤ 1 с) слышал бегущего врага за стеной — выглядывает: шаг на
// 33–49 px (как у про) туда, откуда это место видно, смотрит туда и через 0,8 с возвращается (бой — движок; пока
// видит врага — стоит). Тиммейты рядом (≤ POS.mateLookR), которым тоже есть откуда выглянуть на это место, пикают
// вместе — «пикаем вместе» (двое-трое выходят разом, враг не разменяет одного за другим; так и из дыма). Один —
// только если свой рядом может разменять; якорь (главное — выжить, PRO_PLAY 3) — только вместе с кем-то. Один звук — один пик: снова — на новые шаги.
function posPeekCheck(b){
  var K = b.know;
  if(!K || b.pos.peek || posLed(b) || b._sawEnemy || b.pos.push || b.pos.cover) return false;
  if(teamOf("CT").planState.type !== "default") return posJiggle(b);
  var h = null;
  for(var i = K.heard.length - 1; i >= 0 && tick - K.heard[i].tick <= TICK_HZ; i--){
    var s = K.heard[i];
    if((s.kind !== "steps" && s.kind !== "water") || s.tick <= (b.pos.peekSrc || -1)) continue;
    if(crossesWall(b.x, b.y, s.x, s.y) || smokeBlocks(b.x, b.y, s.x, s.y)){ h = s; break; }
  }
  if(!h) return posJiggle(b);
  b.pos.peekSrc = h.tick;
  var p = posPeekPoint(b, h); if(!p) return false;
  var go = [{b: b, p: p}];
  bots.forEach(function(o){
    if(o === b || o.team !== b.team || !o.alive || !o.pos || o.pos.peek || posLed(o) || o._sawEnemy || o.pos.push || o.pos.cover) return;
    if(Math.hypot(o.x - b.x, o.y - b.y) > POS.mateLookR || Math.hypot(o.pos.tx - o.x, o.pos.ty - o.y) > POS.arrive) return;
    var q = posPeekPoint(o, h); if(q) go.push({b: o, p: q});
  });
  // пик в одиночку — только если свой рядом может разменять (PRO_PLAY 5: «не пикать одному — драться с поддержкой или
  // отойти»; v230: одиночные пики стоили CT больше, чем давали — 17 смертей на 12 фрагов за 2 матча); якорь — только вместе
  var mate = bots.some(function(o){ return o !== b && o.team === b.team && o.alive && Math.hypot(o.x - b.x, o.y - b.y) <= POS.mateLookR; });
  if(go.length < 2 && (/^anchor/.test(b.pos.slot) || !mate)) return false;
  go.forEach(function(g){
    g.b.pos.peek = {x: g.p.x, y: g.p.y, hx: h.x, hy: h.y, start: tick, back: null};
    g.b.pos.peekSrc = h.tick;
    g.b.walking = false;
    g.b.path = buildWaypointPath(g.b.x, g.b.y, g.b.z, g.p.x, g.p.y, g.b.pos.tz); g.b.pathIdx = 0; g.b._pathBy = "pos";
  });
  var who = go.map(function(g){ return g.b.id; }).join(", ");
  POS_LOG.push({tick: tick, round: roundNum, who: b.id, slot: b.pos.slot, pid: b.pos.cur, why: "пик по инфе: шаги " + knowZoneName(h.zone) + (go.length > 1 ? " — вместе: " + who : "")});
  logEvent("Позиция: " + who + " — пик на шаги " + knowZoneName(h.zone) + (go.length > 1 ? " (вместе)" : ""), "info");
  return true;
}
// джиггл в своём ритме (v228, В17): без инфы, стоя на точке — с частотой, как у про (POS.jigglePerMin), выглянуть на
// угол, который держит сейчас (lookTarget), и вернуться — тем же шагом и за то же время, что пик по инфе
function posJiggle(b){
  if(Math.hypot(b.pos.tx - b.x, b.pos.ty - b.y) > POS.arrive || !b.lookTarget) return false;
  if(posSeed(b, tick*17 + 5) >= POS.jigglePerMin/60/TICK_HZ) return false;
  var t = b.lookTarget, p = posPeekPoint(b, {x: t.x, y: t.y});
  if(!p) return false;
  b.pos.peek = {x: p.x, y: p.y, hx: t.x, hy: t.y, start: tick, jiggle: true};
  b.walking = false;
  b.path = buildWaypointPath(b.x, b.y, b.z, p.x, p.y, b.pos.tz); b.pathIdx = 0; b._pathBy = "pos";
  POS_LOG.push({tick: tick, round: roundNum, who: b.id, slot: b.pos.slot, pid: b.pos.cur, why: "джиггл"});
  return true;
}
// откуда выглянуть: шаг POS.peekOut от себя, откуда место звука видно (без стены и дыма); ближайший
function posPeekPoint(b, h){
  var a0 = Math.atan2(h.y - b.y, h.x - b.x);
  for(var i = 0; i < POS.peekOut.length; i++){
    for(var k = 0; k <= 6; k++){
      var a = a0 + (k % 2 ? 1 : -1)*Math.ceil(k/2)*Math.PI/6;   // к звуку, потом ±30°, ±60°, ±90°
      var w = snapToWalkable(b.x + Math.cos(a)*POS.peekOut[i], b.y + Math.sin(a)*POS.peekOut[i]);
      if(!w || crossesWall(b.x, b.y, w.x, w.y)) continue;
      if(!crossesWall(w.x, w.y, h.x, h.y) && !smokeBlocks(w.x, w.y, h.x, h.y)) return w;
    }
  }
  return null;
}
function posPeekTick(b){
  var Q = b.pos.peek; if(!Q) return false;
  if(posLed(b)){ b.pos.peek = null; return false; }
  if(b._sawEnemy || tick - (b._lastSawT || -1e9) < TICK_HZ/4){ Q.saw = true; return true; }   // перестрелка — движок, стоит
  b._strafe = tick;   // выход на полной скорости (17_tick.js)
  if(!Q.at && Math.hypot(b.x - Q.x, b.y - Q.y) <= 4) Q.at = tick;   // вышел — место видно
  var out = tick - Q.start;
  // назад: вышел и прошло время пика у про (POS.peekSec от начала — туда-обратно), или дольше POS.peekMax
  if((!Q.saw && Q.at && out >= POS.peekSec*TICK_HZ) || out >= POS.peekMax*TICK_HZ){
    b.pos.peek = null;
    b.walking = false; posPath(b);   // назад на свою точку (цель — прежняя b.pos.tx/ty)
    b.pos.back = tick;
    POS_LOG.push({tick: tick, round: roundNum, who: b.id, slot: b.pos.slot, pid: b.pos.cur, why: "пик: " + (Q.saw ? "был контакт" : "никого") + " — назад"});
    return true;
  }
  return true;
}
// ---------- после фрага / попадания — сменить место (v215) ----------
function posAfterHit(b){
  var k = b.kills || 0, hp = b.hp;
  if(b.pos.k0 === undefined){ b.pos.k0 = k; b.pos.hp0 = hp; return false; }
  // свой фраг или пуля по нему (огонь молотова — не повод: из огня и так выходят); не чаще раза в 5 с
  // v232: только после своего фрага (у про «после фрага откатился» — 12,6 %). «После попадания» было придумано (v215), и
  // когда шаги стали выполняться (v229), CT уходил под огнём и погибал на ходу: 38 смертей на 14 фрагов за 3 матча
  if(k > b.pos.k0 && tick - (b.pos.movedT || -1e9) > 5*TICK_HZ) b.pos.moveAfter = true;
  b.pos.k0 = k; b.pos.hp0 = hp;
  if(!b.pos.moveAfter || b._sawEnemy || tick - (b._lastSawT || -1e9) < TICK_HZ || posLed(b)) return false;
  b.pos.moveAfter = false; b.pos.movedT = tick;
  var P = POS_PT[b.pos.cur], F = P && P.fallback && POS_PT[P.fallback];
  var cand = (P && P.spots || []).filter(function(s){ return Math.hypot(s.x - b.x, s.y - b.y) > POS.movedR; });
  var t = F && Math.hypot(F.x - b.x, F.y - b.y) > POS.movedR ? {x: F.x, y: F.y} : (cand.length ? cand[0] : null);
  if(!t) return false;
  b.pos.tx = t.x; b.pos.ty = t.y; b.walking = false; posPath(b);
  POS_LOG.push({tick: tick, round: roundNum, who: b.id, slot: b.pos.slot, pid: b.pos.cur, why: "после фрага/попадания — сменил место"});
  return true;
}
// ---------- взгляд (15_combat.js, когда врага не видно) ----------
// Куда смотрит прицел (шаг 9): идёт — по ходу, а если по его гипотезам впереди весомый
// враг — префайр туда (узкое удержание, engagementPrep в 15_combat.js); CT на месте — угол
// slot'а или угроза на него; T на своей полосе — туда, куда шёл (держит проход по ходу).
function posLook(b){
  var w = (b.path.length && b.pathIdx < b.path.length && b._pathBy !== "micro") ? b.path[Math.min(b.pathIdx + 1, b.path.length - 1)] : null;
  if(w && Math.hypot(w[0]-b.x, w[1]-b.y) <= 4) w = null;
  if(b.pos && b.pos.peek) return {x: b.pos.peek.hx, y: b.pos.peek.hy, why: "threat"};   // пик — туда, где слышал (v227)
  if(b.pos && b.pos.reactLook && tick < b.pos.reactLook.until) return {x: b.pos.reactLook.x, y: b.pos.reactLook.y, why: "threat"};   // сайт берут (v233)
  // к новому месту в своём районе — боком/задом, прицел на угол (v237: раньше разворачивался спиной к углу и обратно)
  if(w && b._hold && b._hold.look && Math.hypot(b._hold.pt.x - b.x, b._hold.pt.y - b.y) < HOLD.strafeR &&
     Math.hypot((b.pos ? b.pos.tx : b._hold.pt.x) - b._hold.pt.x, (b.pos ? b.pos.ty : b._hold.pt.y) - b._hold.pt.y) < 5){
    b._goDir = Math.atan2(w[1]-b.y, w[0]-b.x);
    return {x: b._hold.look.x, y: b._hold.look.y, why: "angle"};
  }
  if(w){
    b._goDir = Math.atan2(w[1]-b.y, w[0]-b.x);
    return posAhead(b, b._goDir) || {x: w[0], y: w[1], why: "move"};
  }
  if(b._rtLook && posLed(b)) return {x: b._rtLook[0], y: b._rtLook[1], why: "retake"};   // стоит в ретейке/сейве
  if(b._ppLook) return {x: b.x + b._ppLook[0]*400, y: b.y + b._ppLook[1]*400, why: "postplant"};   // T стоит на месте пост-планта (12_t_default.js)
  if(!b.pos) return posStandLook(b);   // T стоит на своём месте (v224)
  var P = POS_PT[b.pos.cur];
  if(!b.pos.threat){
    if(!b.pos.fb && b._hold && b._hold.look && b._hold.key === "ct:" + P.id) return {x: b._hold.look.x, y: b._hold.look.y, why: "angle"};   // главный вход (v237)
    return {x: P.angle.x, y: P.angle.y, why: b.pos.fb ? "fallback" : "angle"};
  }
  // угроза — взгляд на неё, но не шире yawRange точки (в игре yaw против часовой, на радаре y вниз)
  var c = -P.yaw*Math.PI/180, lo = -(P.yawRange[1] + POS.yawPad)*Math.PI/180, hi = -(P.yawRange[0] - POS.yawPad)*Math.PI/180;
  var d = Math.atan2(b.pos.threat.y - b.y, b.pos.threat.x - b.x) - c;
  d = ((d + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI;
  d = Math.max(lo, Math.min(hi, d));
  var R = Math.max(150, P.angle.dist);
  return {x: b.x + Math.cos(c+d)*R, y: b.y + Math.sin(c+d)*R, why: "threat"};
}

// ---------- T стоит на месте: куда смотреть (v224, правки владельца 3 и 10) ----------
// Туда, откуда может выйти враг — по своему знанию, а не «куда шёл» (раньше: спиной к врагу, в стену, на свой спавн):
//  1) префайр — весомая гипотеза врага (POS.threatW) не дальше POS.pfFar, в любую сторону;
//  2) проверка — ближайшее открытое типичное место врага, до которого он уже мог дойти и которое видно отсюда
//     (knowLook закроет его, когда бот увидит его пустым, — так места расчекиваются по очереди);
//  3) удержание — угол, который держат про с ближайшей своей точки (positions.json: angle — из демок).
// Направление, которое уже держит тиммейт рядом (≤ POS.mateLookR, взгляд в пределах POS.mateLookDeg°), — не берёт.
function posStandLook(b){
  if(b._sl && tick - b._sl.t < POS.threatEvery) return b._sl.p;
  var K = b.know, cands = [];
  if(K) for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible) continue;
    B.hyps.forEach(function(h){
      if(h.x === undefined || h.weight < POS.threatW) return;
      var d = Math.hypot(h.x - b.x, h.y - b.y); if(d < 40 || d > POS.pfFar) return;
      cands.push({x: h.x, y: h.y, why: "prefire", sc: 3 + h.weight});
    });
  }
  if(K && K.spots && K.alive){
    var ez = visEyeZ(b);
    K.spots.forEach(function(p){
      if(!p.open || !knowSpotReach(p)) return;
      var d = Math.hypot(p.x - b.x, p.y - b.y); if(d < 40 || d > POS.pfFar) return;
      if(!visLine(b.x, b.y, ez, p.x, p.y, visFloorAt(p.x, p.y) + VIS_EYE.crouch, true)) return;
      cands.push({x: p.x, y: p.y, why: "check", sc: 2 - d/POS.pfFar});
    });
  }
  // T на своём месте полосы — куда смотрят про, стоя на этом месте (pro_samples; tools/lane_look_bake.py)
  var sp = b.tdef && b.tdef.spot;
  if(sp && sp.look && Math.hypot(sp.x - b.x, sp.y - b.y) <= 40)
    cands.push({x: b.x + sp.look[0]*400, y: b.y + sp.look[1]*400, why: "lane", sc: 1.1, src: "spot"});
  // главный вход района, который он держит (v237, «держать район»: откуда вероятнее всего придут) — выше взгляда про
  if(b._hold && b._hold.look && b._hold.round === roundNum && Math.hypot(b._hold.pt.x - b.x, b._hold.pt.y - b.y) <= 40)
    cands.push({x: b._hold.look.x, y: b._hold.look.y, why: "lane", sc: 1.2, src: "hold"});
  var best = null, bd = 1e9;
  KNOW_POSITIONS.points.forEach(function(P){
    if(P.side !== b.team) return;
    var d = Math.hypot(P.x - b.x, P.y - b.y); if(d < bd && d <= Math.max(P.spread, 20)){ bd = d; best = P; }   // стоит на точке про (spread — 80 % их стоянок)
  });
  if(best) cands.push({x: best.angle.x, y: best.angle.y, why: "lane", sc: 1, src: "angle"});
  var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === b.team && o.lookTarget && Math.hypot(o.x - b.x, o.y - b.y) <= POS.mateLookR; });
  function covered(c){
    // свой стоит на линии взгляда (±15°, ближе цели) — смотреть «ему в спину» = та же линия огня (scope.gg: второй —
    // «не на одной линии огня»): не берёт
    var ac = Math.atan2(c.y - b.y, c.x - b.x), dc = Math.hypot(c.x - b.x, c.y - b.y);
    if(bots.some(function(o){
      if(o === b || !o.alive || o.team !== b.team) return false;
      var d = Math.hypot(o.x - b.x, o.y - b.y); if(d < 30 || d > Math.min(dc, POS.mateLookR)) return false;
      var a = Math.atan2(o.y - b.y, o.x - b.x) - ac; return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) <= 15*Math.PI/180;
    })) return true;
    return mates.some(function(o){
      var a1 = Math.atan2(o.lookTarget.y - o.y, o.lookTarget.x - o.x), a2 = Math.atan2(c.y - o.y, c.x - o.x);
      return Math.abs(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2))) <= POS.mateLookDeg*Math.PI/180;
    });
  }
  cands.sort(function(a, c){ return c.sc - a.sc; });
  var p = null;
  for(var i = 0; i < cands.length && !p; i++) if(!covered(cands[i])) p = cands[i];
  if(!p) p = cands[0] || null;
  if(!p){   // ни знания, ни точки рядом — к сайту плана (T) / к центру карты
    var site = b.team === "T" && TDEF_S && TDEF_S.site ? SITES[TDEF_S.site] : {x: 1024, y: 1024};
    p = {x: site.x, y: site.y, why: "lane", src: "site"};
  }
  p = {x: p.x, y: p.y, why: p.why, src: p.src || p.why};
  b._sl = {t: tick, p: p};
  return p;
}
// куда смотреть впереди (по направлению dir, не шире POS.pfCone°, не дальше POS.pfFar):
//  • префайр — самая весомая гипотеза врага (вес ≥ POS.threatW, по знанию самого бота);
//  • иначе проверка — ближайшее типичное место врага, которое бот ещё не видел пустым
//    (knowSpotAhead, 09_knowledge.js): так игрок на ходу проверяет углы.
// Пересчёт раз в POS.threatEvery тиков (знание меняется событиями, не каждый тик)
function posAhead(b, dir){
  if(b._pf && tick - b._pf.t < POS.threatEvery) return b._pf.p;
  var K = b.know, best = null, cone = POS.pfCone*Math.PI/180;
  if(K) for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible) continue;
    B.hyps.forEach(function(h){
      if(h.x === undefined || h.weight < POS.threatW) return;
      var d = Math.hypot(h.x - b.x, h.y - b.y); if(d < 40 || d > POS.pfFar) return;
      var a = Math.atan2(h.y - b.y, h.x - b.x) - dir;
      if(Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > cone) return;
      if(!best || h.weight > best.weight) best = h;
    });
  }
  var p = best ? {x: best.x, y: best.y, why: "prefire"} : null;
  if(!p){ var sp = knowSpotAhead(b, dir, POS.pfCone, POS.pfFar); if(sp) p = {x: sp.x, y: sp.y, why: "check"}; }
  b._pf = {t: tick, p: p};
  return p;
}

// ---------- слой радара «позиции» ----------
function drawPositions(){
  var ch = document.getElementById("chkPositions"); if(!ch || !ch.checked) return;
  var px = 1/view.scale;
  ctx.save();
  bots.forEach(function(b){
    if(!b.alive || !b.pos) return;
    var P = POS_PT[b.pos.cur], M = POS_PT[b.pos.pid];
    ctx.setLineDash([]); ctx.lineWidth = 1.5*px; ctx.strokeStyle = "rgba(120,180,255,0.75)";
    ctx.beginPath(); ctx.moveTo(b.pos.tx, b.pos.ty); ctx.lineTo(P.angle.x, P.angle.y); ctx.stroke();   // угол
    ctx.beginPath(); ctx.arc(b.pos.tx, b.pos.ty, 7*px, 0, 2*Math.PI); ctx.stroke();
    if(M.fallback && POS_PT[M.fallback] && !b.pos.fb){
      var F = POS_PT[M.fallback];
      ctx.setLineDash([3*px, 3*px]); ctx.strokeStyle = "rgba(120,180,255,0.45)";
      ctx.beginPath(); ctx.arc(F.x, F.y, 5*px, 0, 2*Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.pos.tx, b.pos.ty); ctx.lineTo(F.x, F.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(170,210,255,0.95)"; ctx.font = (8*px)+"px 'IBM Plex Mono',monospace"; ctx.textAlign = "center";
    ctx.fillText(b.pos.slot + (b.pos.fb ? " (зап.)" : ""), b.pos.tx, b.pos.ty + 15*px);
  });
  // кроссфайр-пары — жёлтая линия между точками напарников, только если их точки — пара из pairs
  bots.forEach(function(b){
    if(!b.alive || !b.pos || !b.pos.pairWith) return;
    bots.forEach(function(m){
      if(m === b || !m.alive || !m.pos || m.pos.slot !== b.pos.pairWith || b.id > m.id) return;
      if(!posPairW(b.pos.cur, m.pos.cur)) return;   // слоты-напарники, но точки не кроссфайр (пары не нашлось)
      ctx.strokeStyle = "rgba(255,210,80,0.85)"; ctx.lineWidth = 2*px; ctx.setLineDash([6*px, 4*px]);
      ctx.beginPath(); ctx.moveTo(b.pos.tx, b.pos.ty); ctx.lineTo(m.pos.tx, m.pos.ty); ctx.stroke();
    });
  });
  ctx.restore();
}
