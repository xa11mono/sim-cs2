// ======================= РЕТЕЙК CT: СБОР, ОТКАЗ, ВХОД, СЕЙВ (шаг 8) =======================
// Одно место на «как CT отбивают заложенную бомбу» (docs/BRAIN.md 5.2; шаг 8 PROMPTS.md).
// Сценарий — RetakeSetup ниже; его шаги (утилита, вход, дефуз) исполняет общий исполнитель
// 12_script_runner.js: scrStart берёт rtSetup(site), когда план CT — retake и сайт известен.
// Здесь — то, чего у T-execute нет:
//   gather  — точка сбора у сайта. Шаги с dependsOn.teamGatheredAt ждут, пока у точки соберутся
//             ≥ minPlayers живых (и ещё до waitForTicks тиков — тех, кто подбегает; собрались все — сразу).
//             Поодиночке не лезут: всех CT, кого сейчас не ведёт шаг сценария, rtTick ведёт к точке
//             сбора, а когда энтри пошёл на сайт — следом за ним (размен).
//   abortIf — rtAbortWhy, до того как энтри пошёл (ретейк не начинают, начатый не бросают):
//             живых меньше teamAliveBelow; по таймеру бомбы (знают все) не успеть дойти + утилита +
//             дефуз; или ретейк невыгоден: нас меньше, кита нет, утилиты мало, а у живых оружие,
//             которое жалко отдать (docs/PRO_PLAY.md, «Ретейк / сейв»). Считать — здесь;
//             решает IGL — 12_ct_brain.js (план save через teamSetPlan).
//   save    — rtSave: живые CT уходят подальше от бомбы (дальше RETAKE.safeR от сайта) и от врагов,
//             о которых знают, — сохранить оружие на следующий раунд.
// Кого ведёт ретейк — b._scrT = тик (как у исполнителя): позиции CT (11_position.js) его не трогают.
// Заплатка: точки сбора и цели гранат — руками по зонам карты и CT-лайнапам про (их from — у точки
// сбора); в демках ретейк пока не размечен (это работа tools/positions_bake.py).

var RETAKE = {
  gatherR:   170,   // px: «у точки сбора»
  fromR:     170,   // px: лайнап годится ретейку, если бросают от точки сбора, а не уходят одни вперёд
  arriveR:   30,    // px: дошёл до своей точки
  utilSec:   2,     // с: утилита перед входом (бросок + разрыв флешки)
  marginSec: 2,     // с: запас на бой на входе
  hurrySec:  3,     // с: запаса меньше — энтри больше не ждёт утилиту, идёт
  checkEvery: 16,   // тиков: как часто IGL пересчитывает «успеваем ли / выгодно ли»
  utilMin:   2,     // гранат у живых меньше — «утилиты мало»
  saveWorth: 2700,  // $: оружие живых, которое жалко отдать (от цены винтовки)
  safeR:     500,   // px: сейв — не ближе к сайту с бомбой (радиус взрыва BOMB_KILL_RADIUS 330 + запас)
  enemyR:    350,   // px: сейв — не ближе к врагу, о котором знает сам бот
  enemyW:    0.4    // вес гипотезы врага, с которого её обходят
};

var RETAKE_SETUPS = [
  {id: "retake_A_ancient", side: "CT", site: "A",
   gather: {area: "CT Lane", at: [830, 420], minPlayers: 2, waitForTicks: 40},
   steps: [
     {actor: "util_1", action: "throw_smoke", target: "Long — закрыть вид на бомбу", at: [350, 715],
      condition: "cutOffPlantSightline", dependsOn: {teamGatheredAt: "gather"}, ways: [{from: [826, 418], to: [349, 715], n: 0}]},
     {actor: "util_2", action: "throw_flash", target: "над сайтом A", at: [650, 510],
      dependsOn: {teamGatheredAt: "gather"}, ways: [{from: [830, 420], to: [650, 510], n: 0}]},
     {actor: "entry", action: "push", target: "A", dependsOn: {afterFlashPop: "util_2"}},
     {actor: "defuser", action: "defuse", target: "A", dependsOn: {afterEntryCommitted: "entry"}},
     {actor: "defuser_cover", action: "hold_angle", target: "rotationPathFromMid"}
   ],
   abortIf: {teamAliveBelow: 2}},
  {id: "retake_B_ancient", side: "CT", site: "B",
   gather: {area: "Second Lane", at: [1450, 690], minPlayers: 2, waitForTicks: 40},
   steps: [
     {actor: "util_1", action: "throw_smoke", target: "Ramp — закрыть вид на бомбу", at: [1680, 995],
      condition: "cutOffPlantSightline", dependsOn: {teamGatheredAt: "gather"}, ways: [{from: [1453, 680], to: [1680, 995], n: 0}]},
     {actor: "util_2", action: "throw_flash", target: "над сайтом B", at: [1530, 800],
      dependsOn: {teamGatheredAt: "gather"}, ways: [{from: [1450, 690], to: [1530, 800], n: 0}]},
     {actor: "entry", action: "push", target: "B", dependsOn: {afterFlashPop: "util_2"}},
     {actor: "defuser", action: "defuse", target: "B", dependsOn: {afterEntryCommitted: "entry"}},
     {actor: "defuser_cover", action: "hold_angle", target: "rotationPathFromMid"}
   ],
   abortIf: {teamAliveBelow: 2}}
];

function rtSetup(site){
  for(var i = 0; i < RETAKE_SETUPS.length; i++) if(RETAKE_SETUPS[i].site === site) return RETAKE_SETUPS[i];
  return null;
}
// гранаты под ретейк, пока сайт неизвестен (закуп во freeze, scrBuyUtility): по каждому типу —
// сколько нужно самому «жадному» сценарию
function rtUtilityPlan(){
  var need = {};
  RETAKE_SETUPS.forEach(function(s){
    var n = {};
    s.steps.forEach(function(st){ var m = /^throw_(\w+)$/.exec(st.action); if(m) n[m[1]] = (n[m[1]] || 0) + 1; });
    for(var t in n) need[t] = Math.max(need[t] || 0, n[t]);
  });
  var steps = [];
  for(var t in need) for(var i = 0; i < need[t]; i++) steps.push({action: "throw_" + t});
  return {id: "ретейк (сайт пока неизвестен)", steps: steps};
}
function rtAlive(side){ return bots.filter(function(b){ return b.team === side && b.alive; }); }
function rtPathLen(ax, ay, bx, by){
  var p = buildWaypointPath(ax, ay, 0, bx, by, 0);
  if(!p || !p.length) return Math.hypot(bx - ax, by - ay)*1.35;
  var L = 0, x = ax, y = ay;
  p.forEach(function(w){ L += Math.hypot(w[0] - x, w[1] - y); x = w[0]; y = w[1]; });
  return L;
}
function rtSec(t){ return (t/TICK_HZ).toFixed(1); }
// энтри уже пошёл на сайт — ретейк начат, отказа нет
function rtCommitted(R){
  return !!R && R.steps.some(function(S){ return S.kind === "push" && (S.state === "go" || S.state === "done"); });
}

// ---------- abortIf: почему ретейк не начинать (null — начинать) ----------
// Знание IGL: сколько живых с каждой стороны (видно всем), таймер бомбы (считают все), что у своих
// в руках (свои говорят), где бомба — сайт (знает IGL / сказали).
function rtAbortWhy(site){
  var us = rtAlive("CT"), them = rtAlive("T").length, S = rtSetup(site);
  var below = S ? S.abortIf.teamAliveBelow : 2;
  if(us.length < below) return "живых " + us.length + " (нужно ≥ " + below + ")";
  if(!S || !bomb || bomb.state !== "planted") return null;
  var R = SCR_S.CT && !SCR_S.CT.over && SCR_S.CT.setup === S ? SCR_S.CT : null;
  if(rtCommitted(R)) return null;
  var left = bomb.explodeTick - tick, need = rtNeedTicks(S, us, R && R.gatheredT !== undefined);
  if(need > left) return "не успеть: нужно " + rtSec(need) + " с (дойти, утилита, дефуз " + (us.some(function(b){ return b.kit; }) ? "с китом" : "без кита") + "), до взрыва " + rtSec(left) + " с";
  var kit = us.some(function(b){ return b.kit; });
  // гранаты, уже брошенные в этом ретейке, — тоже его утилита (иначе свой дым сам «делает» ретейк невыгодным)
  var util = R ? R.steps.filter(function(S){ return S.kind === "throw" && S.state === "done"; }).length : 0, worth = 0;
  us.forEach(function(b){
    util += b.nades.smoke + b.nades.flash + b.nades.molly + b.nades.he;
    if(b.primary && WEAPONS[b.primary]) worth += WEAPONS[b.primary].price;
  });
  if(us.length < them && !kit && util < RETAKE.utilMin && worth >= RETAKE.saveWorth)
    return "невыгодно: " + us.length + " против " + them + ", кита нет, гранат " + util + ", оружие на $" + worth;
  return null;
}
// сколько тиков нужно: второй по близости (сбор — minPlayers) дошёл до точки сбора, оттуда до бомбы,
// плюс утилита, дефуз и запас. Собрались — путь второго по близости прямо до бомбы
function rtNeedTicks(S, us, gathered){
  var g = S.gather.at, k = Math.min(S.gather.minPlayers, us.length) - 1, walk;
  if(gathered){
    walk = us.map(function(b){ return rtPathLen(b.x, b.y, bomb.x, bomb.y); }).sort(function(a, b){ return a - b; })[k];
  } else {
    var toG = us.map(function(b){ return rtPathLen(b.x, b.y, g[0], g[1]); }).sort(function(a, b){ return a - b; })[k];
    walk = toG + rtPathLen(g[0], g[1], bomb.x, bomb.y);
  }
  var kit = us.some(function(b){ return b.kit; });
  return Math.round(walk/SPEED*TICK_HZ + (RETAKE.utilSec + RETAKE.marginSec)*TICK_HZ) + (kit ? DEFUSE_KIT_TICKS : DEFUSE_TICKS);
}

// ---------- дефузер: с китом; иначе не энтри (ему входить первым) и ближе к бомбе ----------
function rtPickDefuser(R, except){
  var best = null, bd = 1e9;
  bots.forEach(function(b){
    if(b.team !== R.side || !b.alive || b === except) return;
    var d = Math.hypot(b.x - bomb.x, b.y - bomb.y) + (b.kit ? 0 : 1e4) + (b === R.entry ? 1e5 : 0);
    if(d < bd){ bd = d; best = b; }
  });
  return best;
}

// ---------- раз в тик (scriptTick, после исполнителя): сбор, следом за энтри, сейв ----------
function rtTick(){
  if(roundState !== "live") return;
  var P = teamOf("CT").planState;
  if(P.type === "save"){ rtSave(P); return; }
  var R = SCR_S.CT;
  if(P.type !== "retake" || !R || R.over || !R.setup.gather) return;
  rtGather(R);
  var go = rtCommitted(R), site = SITES[R.setup.site], g = R.setup.gather.at;
  bots.forEach(function(b){
    if(b.team !== "CT" || !b.alive || b._scrT === tick) return;   // этого ведёт шаг сценария
    b._rtLook = [site.x, site.y];
    if(!go && rtViaSite(b, g[0], g[1], R.setup.site)){   // к сбору — только через сайт: ждёт рядом, зайдёт с командой
      if(!b._rtHold){ b._rtHold = true; scrLog(R, null, "ждёт у сайта", b.id + ": к точке сбора — только через сайт, зайдёт с командой"); }
      b._scrT = tick; if(b.path.length){ b.path = []; b.pathIdx = 0; }
      return;
    }
    var tx = go ? site.x : g[0], ty = go ? site.y : g[1];
    var near = go ? bombSiteAt(b.baseX, b.baseY) === R.setup.site : Math.hypot(b.x - tx, b.y - ty) <= RETAKE.gatherR*0.6;
    if(near){ b._scrT = tick; if(b._pathBy === "rt" && b.path.length){ b.path = []; b.pathIdx = 0; } return; }
    rtGo(b, tx, ty);
  });
}
// сбор: ≥ minPlayers у точки — ждём ещё до waitForTicks тех, кто подбегает; все здесь — сразу
function rtGather(R){
  if(R.gatheredT !== undefined) return;
  var G = R.setup.gather, us = rtAlive("CT");
  var at = us.filter(function(b){ return Math.hypot(b.x - G.at[0], b.y - G.at[1]) <= RETAKE.gatherR; });
  if(at.length < G.minPlayers){ R.gMinT = undefined; return; }
  if(R.gMinT === undefined){ R.gMinT = tick; scrLog(R, null, "сбор", at.length + " из " + us.length + " у " + G.area + (at.length < us.length ? ", ждём остальных до " + rtSec(G.waitForTicks) + " с" : "")); }
  if(at.length < us.length && tick - R.gMinT < G.waitForTicks) return;
  R.gatheredT = tick; R.gatherN = at.length;
  scrLog(R, null, "собрались", at.length + " из " + us.length + " у " + G.area + ": " + at.map(function(b){ return b.id; }).join(", "));
  rtRecast(R, at);
}
// входят те, кто собрался: энтри и дефузер не у точки — их шаг берёт собравшийся (энтри — роль entry,
// иначе свободный от гранат; дефузер — с китом, иначе ближе к бомбе, не энтри)
function rtRecast(R, at){
  var busy = function(b){ return R.steps.some(function(o){ return o.kind === "throw" && o.state === "wait" && o.bot === b; }); };
  R.steps.forEach(function(S){
    if(S.state !== "wait" || !S.bot || at.indexOf(S.bot) >= 0) return;
    var pool = at.filter(function(b){ return b !== R.entry && !R.steps.some(function(o){ return o !== S && (o.kind === "push" || o.kind === "defuse") && o.bot === b; }); });
    var nb = null;
    if(S.kind === "push") nb = pool.filter(function(b){ return b.role === "entry" && !busy(b); })[0] || pool.filter(function(b){ return !busy(b); })[0] || pool[0];
    else if(S.kind === "defuse") nb = pool.slice().sort(function(a, b){ return ((a.kit ? 0 : 1e4) + Math.hypot(a.x - bomb.x, a.y - bomb.y)) - ((b.kit ? 0 : 1e4) + Math.hypot(b.x - bomb.x, b.y - bomb.y)); })[0];
    else return;
    if(!nb) return;
    scrLog(R, S, "замена", S.bot.id + " не у точки сбора → " + nb.id);
    S.bot = nb; if(S.kind === "push") R.entry = nb;
    S.bestD = undefined; S.pathT = undefined; S.activeT = undefined;
  });
}
// путь бота к точке идёт через сайт с бомбой (сам он не на сайте) — кэш на раунд по точке
function rtViaSite(b, x, y, site){
  var key = matchNum + ":" + roundNum + ":" + Math.round(x) + "," + Math.round(y);
  b._rtVia = b._rtVia || {};
  if(b._rtVia[key] !== undefined) return b._rtVia[key];
  var v = false;
  if(bombSiteAt(b.baseX, b.baseY) !== site){
    var p = buildWaypointPath(b.x, b.y, b.z || 0, x, y, 0) || [];
    v = p.some(function(w){ return bombSiteAt(w[0], w[1]) === site; });
  }
  return (b._rtVia[key] = v);
}
// время поджимает: ждать утилиту больше нельзя (пересчёт раз в RETAKE.checkEvery тиков)
function rtHurry(R){
  if(!bomb || bomb.state !== "planted") return false;
  if(R._hurryT !== undefined && tick - R._hurryT < RETAKE.checkEvery) return R._hurry;
  var us = rtAlive("CT");
  R._hurryT = tick;
  R._hurry = us.length > 0 && bomb.explodeTick - tick <= rtNeedTicks(R.setup, us, true) + RETAKE.hurrySec*TICK_HZ;
  return R._hurry;
}
function rtGo(b, tx, ty){
  b._scrT = tick; b.walking = false;
  var same = b._pathBy === "rt" && b._rtTo && b._rtTo[0] === tx && b._rtTo[1] === ty;
  if(same && b.path.length > 0 && b.pathIdx < b.path.length) return;
  if(same && tick - b._rtPathT < SCR.repath) return;
  b._rtTo = [tx, ty]; b._rtPathT = tick; b._pathBy = "rt";
  b.path = buildWaypointPath(b.x, b.y, b.z || 0, tx, ty, 0); b.pathIdx = 0;
}

// ---------- сейв: подальше от бомбы и от врагов, о которых знает сам ----------
function rtSave(P){
  if(!bomb || bomb.state !== "planted") return;
  var danger = P.site && SITES[P.site] ? [SITES[P.site]] : [SITES.A, SITES.B];   // где бомба — не знают: от обоих
  bots.forEach(function(b){
    if(b.team !== "CT" || !b.alive) return;
    if(!b._rtSafe){
      b._rtSafe = rtSafeSpot(b, danger);
      logEvent("Сейв: " + nick(b.id) + " → " + b._rtSafe.area, "info");
    }
    var s = b._rtSafe, d0 = danger[0];
    b._rtLook = [d0.x, d0.y];   // смотрит туда, откуда могут прийти
    if(Math.hypot(b.x - s.x, b.y - s.y) <= RETAKE.arriveR){ b._scrT = tick; return; }
    rtGo(b, s.x, s.y);
  });
}
function rtSafeSpot(b, danger){
  var foes = [], K = b.know;
  if(K) for(var id in K.enemies) K.enemies[id].hyps.forEach(function(h){ if(h.x !== undefined && h.weight >= RETAKE.enemyW) foes.push(h); });
  var cand = Object.keys(POS_PT).map(function(k){ return POS_PT[k]; }).concat([{x: CT_SPAWN.x, y: CT_SPAWN.y, area: "CT Spawn"}]);
  var best = null, bd = 1e9;
  cand.forEach(function(p){
    if(danger.some(function(s){ return Math.hypot(p.x - s.x, p.y - s.y) < RETAKE.safeR; })) return;
    if(foes.some(function(h){ return Math.hypot(p.x - h.x, p.y - h.y) < RETAKE.enemyR; })) return;
    var d = Math.hypot(p.x - b.x, p.y - b.y);
    if(d < bd){ bd = d; best = p; }
  });
  return best ? {x: best.x, y: best.y, area: best.area || "?"} : {x: CT_SPAWN.x, y: CT_SPAWN.y, area: "CT Spawn"};
}
