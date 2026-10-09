// Ретейк CT (08_retake.js, шаг 8) на одном тестовом раунде с плантом.
// Запуск: python3 src/build.py && node src/q.js sim.html "$(sed -e s/__MODE__/full/ -e s/__SITE__/A/ tools/retake_log.js)" > rt.json
//         python3 tools/retake_log.py rt.json   — лог по времени и вердикт
// __SITE__ — A / B. __MODE__:
//   full  — после планта все T убраны: чистый ретейк (сбор → утилита → вход → дефуз);
//   live  — T живы, как в игре;
//   late  — до взрыва 12 с: не успеть — сейв;
//   alone — живой один CT: сейв;
//   econ  — 3 CT против 5 T, гранат нет, винтовки есть: невыгодно — сейв.
// Тест сценарный: носителя бомбы переносят на точку планта на 20-й секунде; CT-IGL сообщают сайт (как
// если бы видел плант) — проверяется ретейк, а не то, как CT узнают сайт. В игру это не попадает.
// Проверка внутри: никто из CT не заходит на сайт раньше, чем команда собралась (≥ minPlayers у точки
// сбора), и никто, кроме энтри, — раньше входа энтри; кто зашёл первым и сколько своих рядом (≤ 450 px).
freshMatch(3);
var MODE = "__MODE__", SITE = "__SITE__";
// раунд 1 — пистолетный: CT дают закуп обычного раунда (винтовка, броня, гранаты под ретейк)
bots.forEach(function(b){ if(b.team === "CT"){ b.money = 16000; buyItem(b, "M4"); buyArmor(b, true); } });
scrBuyUtility("CT");
var END = null, _end = endRound;
endRound = function(w, why){ if(!END) END = {winner: w, why: why, sec: +((tick - roundStartTick)/64).toFixed(1)}; return _end(w, why); };
while(tick < roundStartTick + 64*20 && (roundState === "live" || roundState === "freeze")) stepTick();
var Ts = bots.filter(function(b){ return b.team === "T" && b.alive; });
var car = bomb.state === "carried" && bomb.carrier && bomb.carrier.alive ? bomb.carrier : Ts[0];
bomb.state = "carried"; bomb.carrier = car;
var sp = SITES[SITE].plant;
car.x = car.baseX = sp.x; car.y = car.baseY = sp.y; car.path = []; car.pathIdx = 0; car.hp = 1e6;
var planted = bombStartPlant(car), n = 0;
while(bomb.state !== "planted" && n < 64*5){ stepTick(); n++; }
var CTs = bots.filter(function(b){ return b.team === "CT" && b.alive; });
CTs.forEach(function(b){ if(b.know){ b.know.planted = true; b.know.plantSite = SITE; } });
if(MODE === "full") bots.forEach(function(b){ if(b.team === "T"){ b.alive = false; b.hp = 0; } });
else car.hp = 100;
if(MODE === "late") bomb.explodeTick = tick + 64*12;
if(MODE === "alone") CTs.slice(1).forEach(function(b){ b.alive = false; b.hp = 0; });
if(MODE === "econ") CTs.forEach(function(b, i){ if(i >= 3){ b.alive = false; b.hp = 0; } b.nades = emptyNades(); b.kit = false; });
var plantT = tick, G = rtSetup(SITE).gather, trace = {}, enter = [], wasOn = {}, maxT = bomb.explodeTick + 64*2;
bots.forEach(function(b){ if(b.team === "CT") wasOn[b.id] = bombSiteAt(b.baseX, b.baseY) === SITE; });
var R0 = roundNum;
while(roundNum === R0 && roundState === "live" && tick < maxT){
  stepTick();
  bots.forEach(function(b){
    if(b.team !== "CT" || !b.alive) return;
    var on = bombSiteAt(b.baseX, b.baseY) === SITE;
    if(on && !wasOn[b.id]){
      var mates = bots.filter(function(m){ return m !== b && m.team === "CT" && m.alive && Math.hypot(m.x - b.x, m.y - b.y) <= 450; }).length;
      enter.push({tick: tick, sec: +((tick - plantT)/64).toFixed(1), who: b.id, mates: mates});
    }
    wasOn[b.id] = on;
    if(tick % 64 === 0) (trace[b.id] = trace[b.id] || []).push([+((tick - plantT)/64).toFixed(0), Math.round(b.x), Math.round(b.y)]);
  });
}
var R = SCR_S.CT, rows = [], bad = [], gT = null, commitT = null, entryId = null;
SCR_LOG.forEach(function(r){
  if(r.side !== "CT") return;
  rows.push([+((r.tick - plantT)/64).toFixed(1), r.actor, r.who, r.ev, r.why]);
  if(r.ev === "собрались" && gT === null) gT = r.tick;
  if(r.ev === "заходит" && commitT === null){ commitT = r.tick; entryId = r.who; }
});
enter.forEach(function(e){
  if(gT === null || e.tick < gT) bad.push([e.sec, e.who, "на сайте раньше, чем собрались"]);
  else if(e.who !== entryId && (commitT === null || e.tick < commitT)) bad.push([e.sec, e.who, "на сайте раньше входа энтри"]);
});
JSON.stringify({mode: MODE, site: SITE, planted: planted, plantSec: +((plantT - roundStartTick)/64).toFixed(1),
  gather: G, end: END, aliveCT: bots.filter(function(b){ return b.team === "CT" && b.alive; }).map(function(b){ return b.id + " " + (b.primary || b.secondary); }),
  plan: teamOf("CT").planLog.filter(function(p){ return p.tick >= plantT - 1; }).map(function(p){ return [+((p.tick - plantT)/64).toFixed(1), p.to, p.why]; }),
  rows: rows, enter: enter, violations: bad,
  saveLog: events.slice().reverse().filter(function(e){ return /^Сейв:/.test(e.text); }).map(function(e){ return e.text; }),
  summary: R ? R.steps.map(function(s){ return [s.actor, s.state, s.bot ? s.bot.id : null, s.why || ""]; }) : null,
  trace: trace});
