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
//     12_ct_brain.js): posTick видит новый id — перестраивает живых CT.
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
  marginMin:   3     // с: якорь/саппорт — только точки, где свои успевают раньше врага хотя бы на столько
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
  var sp = P.spots && P.spots.length ? posPick(P.spots, function(s){ return s.share; }, posSeed(b, 3)) : P;
  b.pos.cur = P.id; b.pos.tx = sp.x; b.pos.ty = sp.y; b.pos.tz = P.z || 0;
  b.pos.threat = null;
  posPath(b);
  POS_LOG.push({tick: tick, round: roundNum, who: b.id, slot: b.pos.slot, pid: P.id, why: why});
  if(why !== "раунд") logEvent("Позиция: "+nick(b.id)+" → "+b.pos.slot+" ("+P.area+(b.pos.fb ? ", запасная" : "")+") — "+why, "info");
}
function posPath(b){
  b.pos.pathT = tick;
  if(posLed(b)) return;   // ведёт сценарий (ретейк/сейв, 08_retake.js) — путь его
  b.path = buildWaypointPath(b.x, b.y, b.z, b.pos.tx, b.pos.ty, b.pos.tz); b.pathIdx = 0; b._pathBy = "pos";
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
// угроза на slot: враг (по гипотезам самого бота) на входе, который держит точка
function posThreatCheck(b){
  var P = POS_PT[b.pos.cur], Z = posAngleZone(P), best = null;
  var K = b.know;
  if(K) for(var id in K.enemies){
    var B = K.enemies[id]; if(B.visible) continue;
    B.hyps.forEach(function(h){
      if(h.x === undefined || h.weight < POS.threatW || Z.indexOf(h.zone) < 0) return;
      if(!best || h.weight > best.weight) best = h;
    });
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
    var far = Math.hypot(b.pos.tx-b.x, b.pos.ty-b.y) > POS.arrive;
    var moving = b.path.length > 0 && b.pathIdx < b.path.length;
    if(far && !moving && tick - b.pos.pathT >= POS.repathEvery) posPath(b);   // движок сбросил путь — та же цель
    if((smokes.length || b.pos.fb) && (tick + (b.id.charCodeAt(b.id.length-1)||0)) % POS.smokeEvery === 0) posSmokeCheck(b);
    if(!far && (tick + (b.id.charCodeAt(0)||0)) % POS.threatEvery === 0) posThreatCheck(b);
  });
}

// ---------- взгляд (15_combat.js, когда врага не видно) ----------
// Куда смотрит прицел (шаг 9): идёт — по ходу, а если по его гипотезам впереди весомый
// враг — префайр туда (узкое удержание, engagementPrep в 15_combat.js); CT на месте — угол
// slot'а или угроза на него; T на своей полосе — туда, куда шёл (держит проход по ходу).
function posLook(b){
  var w = (b.path.length && b.pathIdx < b.path.length) ? b.path[Math.min(b.pathIdx + 1, b.path.length - 1)] : null;
  if(w && Math.hypot(w[0]-b.x, w[1]-b.y) <= 4) w = null;
  if(w){
    b._goDir = Math.atan2(w[1]-b.y, w[0]-b.x);
    return posAhead(b, b._goDir) || {x: w[0], y: w[1], why: "move"};
  }
  if(b._rtLook && posLed(b)) return {x: b._rtLook[0], y: b._rtLook[1], why: "retake"};   // стоит в ретейке/сейве
  if(!b.pos){   // T на месте: держит то, куда шёл; гипотеза / типичное место врага перед ним — туда
    var dir = b._goDir;
    if(dir === undefined){ var sp = b.spawnPt || (b.team === "CT" ? CT_SPAWN : T_SPAWN); dir = Math.atan2(1024 - sp.y, 1024 - sp.x); }
    return posAhead(b, dir) || {x: b.x + Math.cos(dir)*400, y: b.y + Math.sin(dir)*400, why: b.tdef ? "lane" : "stub"};
  }
  var P = POS_PT[b.pos.cur];
  if(!b.pos.threat) return {x: P.angle.x, y: P.angle.y, why: b.pos.fb ? "fallback" : "angle"};
  // угроза — взгляд на неё, но не шире yawRange точки (в игре yaw против часовой, на радаре y вниз)
  var c = -P.yaw*Math.PI/180, lo = -(P.yawRange[1] + POS.yawPad)*Math.PI/180, hi = -(P.yawRange[0] - POS.yawPad)*Math.PI/180;
  var d = Math.atan2(b.pos.threat.y - b.y, b.pos.threat.x - b.x) - c;
  d = ((d + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI;
  d = Math.max(lo, Math.min(hi, d));
  var R = Math.max(150, P.angle.dist);
  return {x: b.x + Math.cos(c+d)*R, y: b.y + Math.sin(c+d)*R, why: "threat"};
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
