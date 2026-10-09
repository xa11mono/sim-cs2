// Войс команды (12_team.js) на одном тестовом раунде.
// Запуск: node src/q.js sim.html "$(sed s/__VOICE__/1/ tools/team_log.js)" > team_on.json
//         node src/q.js sim.html "$(sed s/__VOICE__/0/ tools/team_log.js)" > team_off.json
//         python3 tools/team_log.py team_on.json team_off.json  — фразы, дубли, «знание только из войса»
// __VOICE__=0 — тиммейты фраз не получают (knowCall выключен): сравнение «с войсом / без».
// Мозга пока нет, поэтому раунд СЦЕНАРНЫЙ (как tools/know_log.js): нескольким ботам заданы
// маршруты, чтобы был контакт, шаги, плант и смерть. В игру это не попадает.
//   T0 → Mid ↔ CT0 → Mid (перестрелка, «убил с …»); T1 → A Main, заметили — назад ↔ CT1 в Back Site;
//   T2 шагом в Lamp Room, T3 бегом в Dark ↔ CT2 в Site B смотрит на Cave; плант B на 30-й с.
//   CT3, CT4 стоят на CT-спавне — врагов не видят: всё, что узнают, — из войса (и киллфида).
freshMatch(3);
var VOICE = __VOICE__;
if(!VOICE) knowCall = function(){};
KNOW_TRACE = {}; bots.forEach(function(b){ KNOW_TRACE[b.id] = true; }); KNOW_LOG = [];
while(roundState !== "live") stepTick();
function zc(name){ var z = ZONEMAP.zones.filter(function(z){ return zoneUserName(z.id) === name; })[0], g = knowGraph();
  return snapToWalkable(g.c[z.id].x, g.c[z.id].y) || g.c[z.id]; }
function go(id, zone, walk){ var b = botById(id), p = zc(zone);
  b.path = buildWaypointPath(b.x, b.y, b.z || 0, p.x, p.y, 0); b.pathIdx = 0; b.walking = !!walk; }
go("T0", "Mid"); go("CT0", "Mid"); go("T1", "A Main"); go("CT1", "Back Site");
go("T2", "Lamp Room", true); go("CT2", "Site B"); go("T3", "Dark");
// сценарный тест: позиции шага 5 выключены (боты ходят по маршрутам теста), взгляд — из LOOK
posTick = function(){}; bots.forEach(function(b){ delete b.pos; });
var LOOK = {CT1: zc("A Main"), CT2: zc("Cave")}, osl = posLook;
posLook = function(b){ var l = LOOK[b.id]; return l ? {x: l.x, y: l.y, why: "stub"} : osl(b); };
var T1back = false;
bomb.carrier = botById("T4");
botById("T1").hp = botById("CT1").hp = botById("CT2").hp = 1e6;
var R0 = roundNum, n = 0, start = tick, seen = {}, truth = [];
events.length = 0;
while(roundNum === R0 && roundState !== "ending" && n < 64*120){
  stepTick(); n++;
  var t1 = botById("T1"), ct1 = botById("CT1");
  if(!T1back && t1.alive && (ct1._visible || []).indexOf(t1) >= 0){ go("T1", "T Spawn"); T1back = tick; }
  var cr = bomb && bomb.carrier;
  if(cr && tick - start === 30*64){ cr.hp = 1e6; go(cr.id, "B Site"); }
  if(cr && tick - start > 30*64 && !cr.planting && bombSiteAt(cr.baseX, cr.baseY)) bombStartPlant(cr);
  // кто кого хоть раз видел сам (истина — только для проверки)
  bots.forEach(function(b){ (b._visible || []).forEach(function(e){ seen[b.id + ">" + e.id] = true; }); });
  if((tick - start) % 64 === 0) truth.push([tick, bots.filter(function(b){ return b.alive && b.team === "T"; })
    .map(function(b){ return [b.id, knowZoneName(knowZoneAt(b.x, b.y))]; })]);
}
// итоговая вера CT3/CT4 (стоят на спавне): самая тяжёлая не-«?» гипотеза по каждому врагу
var fin = {};
["CT3", "CT4"].forEach(function(id){ var b = botById(id); if(!b.know) return; fin[id] = {};
  for(var k in b.know.enemies){ var B = b.know.enemies[k];
    fin[id][k] = B.hyps.map(function(h){ return [h.type, h.type === "moved_unknown" ? "?" : knowZoneName(h.zone), +h.weight.toFixed(2)]; }); } });
JSON.stringify({voice: VOICE, start: start, ticks: n, seen: Object.keys(seen),
  events: events.slice().reverse().map(function(e){ return [e.t, e.kind, e.text]; }),
  log: KNOW_LOG.map(function(r){ return [r.tick, r.who, r.enemy, r.cause]; }), fin: fin, truth: truth});
