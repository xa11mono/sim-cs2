// ======================= КОМАНДА: ВОЙС И ОБЩАЯ КАРТИНА (teamKnowledge) =======================
// Одно место на «что команда сказала друг другу» (docs/BRAIN.md, раздел 3; шаг 3 PROMPTS.md).
// Слияние знания ботов — ТОЛЬКО через произнесённое: бот решает сказать по своему b.know
// (09_knowledge.js), фраза ждёт реакции и своей очереди в канале, звучит какое-то время, и
// лишь когда договорена — тиммейты получают её (knowCall → их собственное b.know).
// Чужое b.know здесь не читается и не пишется.
//
// Что говорят (повод — своё восприятие, без правил под ситуации):
//   see    — увидел врага (или того же — в новой зоне): «один A Main», «двое Mid, один с AWP»;
//   hear   — услышал шаги/стрельбу, которые не объясняет то, что команде уже сказано: «шаги Cave»;
//   plant  — CT услышал/увидел плант: «ставят B!» (срочно);
//   defuse — T услышал дефуз: «дефузят!» (срочно);
//   death  — убили, а убийцу видел: «убили с Mid, AWP» (срочно; мёртвый успевает сказать ~2 с);
//   igl    — колл IGL: смена плана (07_t_brain.js / 12_ct_brain.js), срочно.
//   script — своя граната сценария упала / свой вошёл на сайт: «дым Second Lane», «заходим B Site»
//            (шаг 7; тиммейты узнают из этого, что шаг сценария случился; на доске угроз не числится).
// Неточность как у человека: место — зона колл-аута (не точка), «один/двое/несколько»,
// из оружия — только AWP; содержимое фиксируется при решении сказать и к моменту, когда
// договорено, уже немного устарело. Задержка: реакция + время произнесения.
// Без повторов: доска threats — что команде уже сказано (по зонам); фраза, которую доска
// покрывает, не произносится — проверка при решении и ещё раз, когда подошла очередь.
// Канал один на команду: говорят по очереди, срочное — вне очереди; устаревшее выкидывается;
// при толпе в очереди неважное может не прозвучать (это разброс, не баг).
//
// teamKnowledge.planState — активный план команды; менять — только teamSetPlan (раздел «план
// команды» ниже; решают 07_t_brain.js и 12_ct_brain.js).
// Случайность — своя (hashRand от тика и ника), игровой генератор не трогается: войс на
// бой и движение пока не влияет, отпечаток матча тот же.

var TEAM = {
  react:    [0.3, 0.8],  // от события до начала фразы, с (зависит от того, кто и когда)
  sayBase:  0.4,         // время произнесения: база + на слово, с …
  sayWord:  0.15,
  sayMax:   2.0,         //   … не дольше (BRAIN 1: 0,5–2 с)
  stale:    3.0,         // фраза, ждавшая очереди дольше, — уже не актуальна, не говорится
  crowd:    3,           // столько и больше в очереди — неважное (hear) выкидывается
  board:    6.0,         // сколько сказанное о зоне считается «команда знает», с
  reTell:   2.0,         // того же видимого врага в новой зоне — не чаще, с (перестрелка на границе зон)
  deadTalk: 2.0          // мёртвый ещё договаривает, с
};
var TEAM_PRIO = {death: 2, plant: 2, defuse: 2, igl: 2, see: 1, script: 1, hear: 0};
var teamKnow = {};       // T / CT → teamKnowledge

function teamNew(team){
  return {
    key: matchNum + ":" + roundNum, team: team,
    threats: {},            // зона → {count, awp, tick, by, kind} — что команде уже сказано
    claimedPositions: {},   // botId → {corner, since} — заполнит позиционирование (шаг 5)
    openRequests: {},       // requestId → {askerId, target, responders: {botId: 'yes'|'no'|null}}
    planState: {type: "default", site: null, declaredAt: null, activeSetupId: null, label: null},
    planLog: [],            // смены плана за раунд: {tick, from, to, why}
    roundPick: null, roundSite: null, callMade: false,   // выбор на раунд (для памяти IGL), колл уже был
    queue: [],              // ждут своей очереди в канале
    speaking: null,         // кто говорит сейчас: {msg, end}
    seq: 0
  };
}
function teamOf(side){
  var key = matchNum + ":" + roundNum, T = teamKnow[side];
  // тик пошёл назад — матч начат заново («Сыграть» тот же номер): прошлое сказанное не в счёт
  if(!T || T.key !== key || T.at > tick) T = teamKnow[side] = teamNew(side);
  T.at = tick;
  return T;
}
function teamRand(b, salt){ return hashRand(tick*977 + (b.id.charCodeAt(b.id.length-1)||0)*131 + (b.id.charCodeAt(0)||0)*29 + salt); }
function teamSec(t){ return t*TICK_HZ; }
// одно и то же место для колла: та же зона или тот же бомбсайт (на сайте несколько мелких зон)
function teamSamePlace(a, b){ var g = knowGraph(); return a === b || (!!g.site[a] && g.site[a] === g.site[b]); }
function teamNear(z){ var g = knowGraph(); return [z].concat(g.adj[z] || []); }   // зона и соседние

// ---------- текст фразы ----------
function teamText(m){
  var z = m.zone ? knowZoneName(m.zone) : "";
  if(m.kind === "igl") return m.say;
  if(m.kind === "script") return m.ev === "commit" ? "заходим " + z : NADE[m.ev].name + " " + z;
  if(m.kind === "plant") return "ставят " + m.site + "!";
  if(m.kind === "defuse") return "дефузят!";
  if(m.kind === "death") return "убили с " + z + (m.awp ? ", AWP" : "");
  if(m.kind === "hear") return (m.sound === "shots" ? "стреляют " : m.sound === "water" ? "шаги в воде " : "шаги ") + z;
  var n = m.count >= 3 ? "несколько" : m.count === 2 ? "двое" : "один";
  if(m.awp && m.count === 1) return "AWP " + z;
  return n + " " + z + (m.awp ? ", один с AWP" : "");
}

// ---------- доска: покрывает ли уже сказанное эту фразу ----------
function teamCovered(T, m){
  if(m.kind === "plant" || m.kind === "defuse") return !!T.threats[m.kind];
  if(m.kind === "death" || m.kind === "igl" || m.kind === "script") return false;   // про своего убийцу / колл / свою гранату — всегда новость
  // звук — место понятно грубо: сказанное про эту зону или соседнюю — уже не новость
  if(m.kind === "hear") return teamNear(m.zone).some(function(z){ var t = T.threats[z]; return t && tick - t.tick <= teamSec(TEAM.board); });
  var t = T.threats[m.zone];
  if(!t || tick - t.tick > teamSec(TEAM.board)) return false;
  return t.count >= m.count && (!m.awp || t.awp);    // «шаги там» (count 0) не покрывает «вижу одного»
}

// ---------- решить сказать: своя фраза уходит в канал после реакции ----------
function teamPropose(b, m){
  var T = teamOf(b.team);
  if(teamCovered(T, m)) return;
  // своя ещё не сказанная фраза о той же зоне — дополняется (успел увидеть второго)
  var V = b.voice;
  for(var i = 0; i < V.pending.length; i++){
    var p = V.pending[i];
    if(p.kind === m.kind && p.zone === m.zone && p.kind !== "hear" && p.kind !== "igl" && p.kind !== "script"){
      p.count = Math.max(p.count || 0, m.count || 0); p.awp = p.awp || m.awp; p.text = teamText(p);
      (m.ids || []).forEach(function(id){ if(p.ids.indexOf(id) < 0) p.ids.push(id); });
      return;
    }
  }
  m.by = b.id; m.made = tick; m.id = ++T.seq;
  var r = TEAM.react[0] + (TEAM.react[1]-TEAM.react[0])*teamRand(b, m.id);
  m.ready = tick + Math.round(teamSec(r));
  m.text = teamText(m);
  V.pending.push(m);
}

// ---------- поводы: по своему b.know ----------
function teamNotice(b){
  var K = b.know, V = b.voice; if(!K) return;
  // see: видимые враги по зонам
  var byZone = {};
  for(var id in K.enemies){
    var B = K.enemies[id]; if(!B.visible) continue;
    var z = B.last.zone; if(!z) continue;
    (byZone[z] = byZone[z] || []).push(B);
  }
  for(var z2 in byZone){
    var L = byZone[z2], fresh = false, awp = false;
    L.forEach(function(B){
      var t = V.told[B.id];
      if(!t || (!teamSamePlace(t.zone, z2) && tick - t.tick > teamSec(TEAM.reTell))) fresh = true;
      if(B.last.weapon === "AWP") awp = true;
    });
    if(!fresh) continue;
    L.forEach(function(B){ V.told[B.id] = {zone: z2, tick: tick}; });
    teamPropose(b, {kind: "see", zone: z2, count: L.length, awp: awp, ids: L.map(function(B){ return B.id; })});
  }
  // hear: свои новые звуки этого тика (K.heard — уже с ошибкой «на слух»)
  for(var i = K.heard.length-1; i >= 0 && K.heard[i].tick === tick; i--){
    var s = K.heard[i];
    if(s.kind === "plant" && b.team === "CT"){ teamPropose(b, {kind: "plant", site: knowNearestSite(s.x, s.y)}); continue; }
    if(s.kind === "defuse" && b.team === "T"){ teamPropose(b, {kind: "defuse"}); continue; }
    if(s.kind !== "steps" && s.kind !== "water" && s.kind !== "shots") continue;
    if(!s.zone) continue;
    // шумит тот, кого я сейчас вижу, — про него уже «see»
    var vis = (b._visible || []).some(function(e){ return Math.hypot(e.x-s.x, e.y-s.y) <= s.err + 30; });
    if(vis) continue;
    // тот же шум продолжается (стрельба, бег) — сказал один раз; снова — только после
    // паузы TEAM.board без звуков в этой и соседних зонах
    var quietFor = Infinity;
    teamNear(s.zone).forEach(function(z){ var t = V.heardAt[z]; if(t !== undefined) quietFor = Math.min(quietFor, tick - t); });
    V.heardAt[s.zone] = tick;
    if(quietFor < teamSec(TEAM.board)) continue;
    teamPropose(b, {kind: "hear", zone: s.zone, sound: s.kind});
  }
  // plant: видел, как ставят (CT)
  if(b.team === "CT" && K.plantSeen && !V.plantSaid){ V.plantSaid = true; teamPropose(b, {kind: "plant", site: K.plantSeen}); }
}

// ---------- смерть (feedKill, 20_hud.js): видел убийцу — успевает сказать, откуда ----------
function teamDeath(att, vic){
  if(roundState !== "live" || !att || att.team === vic.team || !vic.know || !vic.voice) return;
  // остальное недосказанное мёртвый уже не скажет
  vic.voice.pending = [];
  var B = vic.know.enemies[att.id];
  if(!B || !B.visible) return;                  // не видел, откуда — сказать нечего
  vic.voice.diedAt = tick;
  teamPropose(vic, {kind: "death", zone: B.last.zone, enemy: att.id, awp: B.last.weapon === "AWP"});
}

// ---------- канал команды ----------
function teamChannel(T){
  var mates = bots.filter(function(b){ return b.team === T.team; });
  // готовые фразы — в очередь
  mates.forEach(function(b){
    var V = b.voice; if(!V) return;
    V.pending = V.pending.filter(function(m){
      if(m.ready > tick) return true;
      T.queue.push(m); return false;
    });
  });
  // договорил — все живые свои получили
  var S = T.speaking;
  if(S && tick >= S.end){
    T.speaking = null;
    var m = S.msg;
    if(m.kind === "plant" || m.kind === "defuse") T.threats[m.kind] = {tick: tick, by: m.by};
    else if(m.zone && m.kind !== "death" && m.kind !== "script"){   // «дым там» — не угроза на доске
      var t = T.threats[m.zone], fresh = t && tick - t.tick <= teamSec(TEAM.board);
      T.threats[m.zone] = {count: Math.max(m.count || 0, fresh ? t.count || 0 : 0), awp: !!m.awp || (fresh && t.awp),
                           tick: tick, by: m.by, kind: m.kind};
    }
    if(m.kind === "igl") teamSetPlan(T.team, m.plan, m.why + " (колл " + m.by + ")", m.label);
    else mates.forEach(function(o){ if(o.alive && o.id !== m.by) knowCall(o, m); });
    logEvent(m.by + ": " + m.text, "voice");
  }
  if(T.speaking || !T.queue.length) return;
  // кто следующий: срочное — первым, дальше по порядку
  T.queue.sort(function(a, b){ return (TEAM_PRIO[b.kind] - TEAM_PRIO[a.kind]) || (a.ready - b.ready) || (a.id - b.id); });
  while(T.queue.length){
    var crowd = T.queue.length >= TEAM.crowd;
    var n = T.queue.shift(), sp = botById(n.by), why = null;
    if(tick - n.ready > teamSec(TEAM.stale)) why = "устарело";
    else if(teamCovered(T, n)) why = "уже сказано";
    // про кого хотел сказать — уже в киллфиде (смерть видят все): говорить не о ком
    else if(n.ids && !n.ids.some(function(id){ var e = botById(id); return e && e.alive; })) why = "враг уже убит";
    else if(crowd && TEAM_PRIO[n.kind] === 0) why = "не до того — в канале толпа";
    else if(!sp || (!sp.alive && !(n.kind === "death" && tick - sp.voice.diedAt <= teamSec(TEAM.deadTalk)))) why = "говорящий погиб";
    if(why){ logEvent("войс не прозвучал (" + why + "): " + n.by + ": " + n.text); continue; }
    var words = n.text.split(/\s+/).length;
    var dur = Math.min(TEAM.sayMax, Math.max(0.5, TEAM.sayBase + TEAM.sayWord*words));
    T.speaking = {msg: n, end: tick + Math.round(teamSec(dur))};
    break;
  }
}

// ---------- план команды (BRAIN 5.4): одно значение planState, меняется только здесь ----------
// Решают 07_t_brain.js (T) и 12_ct_brain.js (CT): выбор Setup'а на раунд во freeze и смена
// по четырём поводам — плант, колл IGL по сильной инфе, контрольный тайминг, потеря состава.
// Колл IGL — фраза в канале (kind "igl"): тиммейты узнают новый план, когда он договорён.
// Числа ниже — проектные константы, не из демок.
var PLAN = {
  minGap:   8,     // с: между сменами плана не меньше (плант — без ожидания)
  repeat1:  0.5,   // Setup был в прошлом раунде — его вес ×
  repeat2:  0.25,  //   … два прошлых раунда подряд — ×
  lost:     0.6,   // последний раунд с этим Setup'ом проигран — ×
  lostSite: 0.8,   // T: последний execute на этот сайт проигран — другие варианты на тот же сайт ×
  read:     0.3,   // CT: за каждый плант T на сайте за последние readN раундов — вес × (1 + read·n·(людей на сайте − 1))
  readN:    3,
  ecoStack: 2,     // CT на эко — стак ×
  ecoFast:  2,     // T на эко — вариант с самым ранним выходом ×
  infoW:    0.6,   // враг «стоит на стороне», если его гипотезы там весят столько и больше …
  infoN:    3,     //   … и таких врагов на одной стороне (A или B) столько — сильная инфа
  lossAlive:2,     // живых столько и меньше — fallback …
  lossDiff: 2      //   … или нас меньше, чем врагов, на столько
};
var PLAN_HIST = [];   // {match, half, round, side, setupId, site, won, plantSite} — что команды играли
function planHalf(r){
  if(r <= HALF_ROUNDS) return 0;
  if(r <= regRounds()) return 1;
  return 2 + Math.floor((r - regRounds() - 1)/OT_HALF);
}
// последние n раундов этой половины за сторону side, свежие — первыми
function planHist(side, n){
  var h = planHalf(roundNum), out = [];
  for(var i = PLAN_HIST.length-1; i >= 0 && out.length < n; i--){
    var e = PLAN_HIST[i];
    if(e.match !== matchNum || e.half !== h) break;
    if(e.side === side) out.push(e);
  }
  return out;
}
// конец раунда (endRound, 16_economy.js): что играли и чем кончилось — память IGL на половину
function planRoundEnd(winner){
  ["T","CT"].forEach(function(side){
    var T = teamOf(side);
    if(!T.roundPick) return;
    PLAN_HIST.push({match: matchNum, half: planHalf(roundNum), round: roundNum, side: side, setupId: T.roundPick,
                    site: T.roundSite || null, won: winner === side, plantSite: bomb && bomb.plantTick >= 0 ? bomb.site : null});
  });
}
// выбор по весам: [{s, w, why}] → один; случайность своя (раунд + сторона), игровой генератор не трогается
function planPick(side, list){
  var sum = 0; list.forEach(function(c){ sum += c.w; });
  var r = hashRand(matchNum*7919 + roundNum*104729 + (side === "T" ? 17 : 31)) * sum;
  for(var i = 0; i < list.length; i++){ r -= list[i].w; if(r <= 0) return list[i]; }
  return list[list.length-1];
}
function planIgl(side){ return bots.filter(function(b){ return b.team === side && b.igl; })[0] || null; }
function planCanSwitch(side){ return tick - teamOf(side).planState.declaredAt >= teamSec(PLAN.minGap); }
// сменить план. Тот же — ничего. why — повод (пишется в консоль). Начало раунда — roundStart.
function teamSetPlan(side, plan, why, label){
  var T = teamOf(side), P = T.planState;
  var same = P.type === plan.type && P.site === (plan.site || null) && P.activeSetupId === (plan.activeSetupId || null);
  if(same && P.label) return false;
  var was = P.label;
  T.planState = {type: plan.type, site: plan.site || null, declaredAt: tick, activeSetupId: plan.activeSetupId || null, label: label};
  T.planLog.push({tick: tick, from: was || null, to: label, why: why});
  logEvent("План " + side + ": " + (was ? was + " → " : "") + label + " — " + why, "plan");
  return true;
}
// начало раунда (resetRound, 16_economy.js; до posRoundStart): IGL обеих сторон выбирают план
function planRoundStart(){
  if(roundNum === 1) PLAN_HIST.length = 0;   // новый матч (или тот же номер заново)
  tBrainRoundStart();    // 07_t_brain.js
  ctBrainRoundStart();   // 12_ct_brain.js
}
// сторона карты зоны — как в tools/positions_bake.py (region_of): по x центра зоны; спавны и
// задние проходы — ничья сторона
var PLAN_NOSIDE = {"T Spawn":1, "T Ramp":1, "CT Spawn":1, "CT Lane":1, "Alley":1, "Back Halls":1, "Back Halls / Back Alley":1};
function planRegion(zid){
  if(!zid || PLAN_NOSIDE[zoneUserName(zid)]) return null;
  var c = knowGraph().c[zid]; if(!c) return null;
  return c.x < 700 ? "A" : c.x > 1250 ? "B" : "mid";
}
// сколько врагов бот b (обычно IGL) уверенно ставит на каждую сторону — по СВОЕМУ b.know
// (видел сам + договорённое в войсе). Считается враг, про которого есть факт (не только
// «вышел со спавна»), и его гипотезы на этой стороне весят ≥ PLAN.infoW
function planLocatedList(b){
  var out = [], K = b.know; if(!K) return out;
  for(var id in K.enemies){
    var B = K.enemies[id];
    var fact = B.visible || (B.last && B.last.source !== "spawn") || B.hyps.some(function(h){ return h.heard; });
    if(!fact) continue;
    var w = {A: 0, B: 0, mid: 0};
    B.hyps.forEach(function(h){ var r = planRegion(h.zone); if(r) w[r] += h.weight; });
    ["A","B","mid"].forEach(function(r){ if(w[r] >= PLAN.infoW) out.push({id: id, region: r, w: w[r], seen: B.visible}); });
  }
  return out;
}
function planLocated(b){
  var n = {A: 0, B: 0, mid: 0};
  planLocatedList(b).forEach(function(e){ n[e.region]++; });
  return n;
}
function planLocatedWhy(b, region){
  return planLocatedList(b).filter(function(e){ return e.region === region; })
    .map(function(e){ return e.id + (e.seen ? " вижу" : " " + e.w.toFixed(2)); }).join(", ");
}
// колл IGL: новый план — фразой в канал; применится, когда договорён (teamChannel)
function teamCallPlan(igl, say, plan, why, label){
  var T = teamOf(igl.team);
  T.callMade = true;
  teamPropose(igl, {kind: "igl", say: say, plan: plan, why: why, label: label});
}

// ---------- просьбы: один ответ на запрос; кто сказал «нет» — того не переспрашивают ----------
// Пока просить некому (мозга нет); подключат шаги 5–7.
function teamAsk(asker, target, to){
  var T = teamOf(asker.team), id = "rq" + (++T.seq), R = {askerId: asker.id, target: target, responders: {}};
  (to || []).forEach(function(bid){
    for(var k in T.openRequests){ var o = T.openRequests[k];
      if(o.target === target && o.responders[bid] === "no") return; }
    R.responders[bid] = null;
  });
  T.openRequests[id] = R; return id;
}
function teamAnswer(b, reqId, yes){
  var R = teamOf(b.team).openRequests[reqId];
  if(!R || !(b.id in R.responders) || R.responders[b.id] !== null) return false;
  R.responders[b.id] = yes ? "yes" : "no"; return true;
}

// ---------- раз в тик, после knowTick (17_tick.js) ----------
function teamTick(){
  if(roundState !== "live") return;
  var key = matchNum + ":" + roundNum;
  bots.forEach(function(b){
    if(!b.voice || b.voice.key !== key) b.voice = {key: key, pending: [], told: {}, heardAt: {}, plantSaid: false, diedAt: null};
    if(b.alive) teamNotice(b);
  });
  teamChannel(teamOf("T"));
  teamChannel(teamOf("CT"));
}
