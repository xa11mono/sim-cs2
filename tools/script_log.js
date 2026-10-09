// Исполнитель сценариев (12_script_runner.js, шаг 7) на одном тестовом раунде T-execute.
// Запуск: python3 src/build.py && node src/q.js sim.html "$(sed -e s/__SETUP__/t_exec_B_main_ancient/ -e s/__GOD__/1/ tools/script_log.js)" > script_B_main.json
//         python3 tools/script_log.py script_B_main.json   — лог шагов по времени и вердикт
// __SETUP__ — какой T-сценарий играть (id из setups.json); __GOD__=1 — T не гибнут (виден весь сценарий),
// 0 — как в игре (шаги снимаются при гибели актёров, замены).
// Тест сценарный: сценарий T выбран принудительно (teamSetPlan), у T деньги на все гранаты (16000) —
// иначе после закупа винтовки гранат на шаги не хватит. В игру это не попадает.
// Что проверяется (проверка внутри, независимо от исполнителя): «истина» — реальные разрывы гранат
// (detonate) и вход энтри; каждый шаг, сделанный не по таймауту, не раньше события-источника,
// не раньше момента, когда актёр сам о нём узнал, и не раньше паузы pauseSec. Шаги по таймауту и шаги,
// чей источник снят (актёр погиб, гранаты нет), в нарушения не входят — они в отдельных списках.
freshMatch(3);
var SETUP = "__SETUP__", GOD = __GOD__;
var TRUTH = [], _det = detonate;
detonate = function(n){ TRUTH.push({tick: tick, type: n.type, x: +n.x.toFixed(1), y: +n.y.toFixed(1), by: n.thrower && n.thrower.id}); return _det(n); };
var S0 = tbSetup(SETUP);
teamSetPlan("T", {type: "default", site: S0.site, activeSetupId: S0.id}, "тест: сценарий принудительно", "тест " + S0.id);
teamOf("T").roundPick = S0.id; teamOf("T").roundSite = S0.site;
bots.forEach(function(b){ if(b.team === "T"){ b.money = 16000; if(GOD) b.hp = 1e6; } });
scrBuyUtility("T");
var inv = {}; bots.filter(function(b){ return b.team === "T"; }).forEach(function(b){ inv[b.id] = b.role + " " + JSON.stringify(b.nades); });
events.length = 0;
var R0 = roundNum, n = 0, tPlant = null;
while(roundNum === R0 && roundState !== "ending" && n < 64*150){
  stepTick(); n++;
  var R = SCR_S.T;
  if(R && R.over && !tPlant) tPlant = tick;
  if(tPlant && tick - tPlant > 64*3) break;
  if(bomb && bomb.state === "planted") break;
}
var R = SCR_S.T, stepsData = S0.steps, start = R ? R.start : null, bad = [], tmo = [], nosrc = [], rows = [];
// истина: разрыв гранаты → шаг сценария (ближайший по точке того же типа)
function attr(p){ var best = null, bd = 1e9;
  stepsData.forEach(function(s){ if(s.action !== "throw_" + p.type || !s.at) return; var d = Math.hypot(p.x - s.at[0], p.y - s.at[1]); if(d < bd){ bd = d; best = s; } });
  return best && bd <= SCR.matchR ? best.actor : null; }
var firstPop = {};
TRUTH.forEach(function(p){ if(start === null || p.tick < start) return; var a = attr(p); if(a && !(a in firstPop)) firstPop[a] = p.tick; });
var pushTick = {};
SCR_LOG.forEach(function(r){ if(r.ev === "заходит") pushTick[r.actor] = r.tick; });
SCR_LOG.forEach(function(r){
  rows.push([r.sec, r.tick, r.actor, r.who, r.ev, r.why]);
  if(["бросил", "заходит", "идёт ставить"].indexOf(r.ev) < 0 || r.step === null) return;
  var sd = stepsData[r.step], dd = sd.dependsOn || {}, rel = r.rel;
  var on = dd.afterSmokeLands || dd.afterFlashPop || dd.afterPrev || dd.afterEntryCommitted;
  var pause = Math.round((dd.pauseSec || 0)*64);
  if(!rel){ bad.push([r.sec, r.actor, "нет записи о сигнале"]); return; }
  if(rel.tick > r.tick) bad.push([r.sec, r.actor, "действие раньше сигнала"]);
  if(rel.timeout){ tmo.push([r.sec, r.actor, r.why]); return; }
  if(rel.noSrc){ nosrc.push([r.sec, r.actor, r.why]); return; }   // источник снят (актёр погиб, гранаты нет) — события не будет, идёт без него
  if(dd.trigger === "execute_start"){ if(rel.tick < start) bad.push([r.sec, r.actor, "раньше старта сценария"]); return; }
  var truthT = (stepsData.filter(function(x){ return x.actor === on; })[0] || {}).action === "push" ? pushTick[on] : firstPop[on];
  if(truthT === undefined){ bad.push([r.sec, r.actor, "источник «" + on + "» в мире не случился, а шаг не по таймауту"]); return; }
  if(rel.tick < truthT + pause) bad.push([r.sec, r.actor, "сигнал на тике " + rel.tick + " раньше события «" + on + "» (" + truthT + (pause ? " + пауза " + pause : "") + ")"]);
  if(rel.evTick !== null && rel.evTick < truthT) bad.push([r.sec, r.actor, "актёр «узнал» на тике " + rel.evTick + " раньше события «" + on + "» (" + truthT + ")"]);
});
JSON.stringify({setup: SETUP, god: !!GOD, start: start, startSec: R ? +((start - roundStartTick)/64).toFixed(1) : null, ticks: n, inv: inv,
  rows: rows, truth: TRUTH.map(function(p){ return [p.tick, p.type, p.x, p.y, p.by, attr(p)]; }),
  timeouts: tmo, noSource: nosrc, violations: bad,
  summary: R ? R.steps.map(function(s){ return [s.i, s.actor, s.state, s.bot ? s.bot.id : null, s.why || ""]; }) : null,
  voice: events.slice().reverse().filter(function(e){ return e.kind === "voice"; }).map(function(e){ return [e.t, e.text]; })});
