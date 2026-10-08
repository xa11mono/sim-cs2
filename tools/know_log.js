// Лог знания ботов о врагах (09_knowledge.js) по тикам одного тестового раунда.
// Запуск: node src/q.js sim.html "$(cat tools/know_log.js)" > know_log.json
//         python3 tools/know_log.py know_log.json      — читаемая таблица
// Мозга пока нет (боты стоят на спавне), поэтому раунд СЦЕНАРНЫЙ: тут, в тесте,
// нескольким ботам задаются маршруты, чтобы случились контакт, потеря из вида,
// шаги, тихий проход и убийство. В игру это не попадает.
//   T0  бегом в Mid                 ↔ CT0 бегом в Mid           — перестрелка, киллфид
//   T1  бегом в A Main; как только  ↔ CT1 в Back Site, смотрит   — увидел → потерял (бежал);
//       CT1 его увидел — назад           на A Main; через 3 с после    отвернулся и снова посмотрел —
//       на T-спавн                       потери 2 с смотрит на CT-спавн    «посмотрел — пусто»
//   T2  ШАГОМ (тихо) в Lamp Room     ↔ CT2 в Site B, смотрит       — тихий проход: окна без шагов
//   T3  бегом в Dark (за стеной)       на Cave                    — шаги, которые CT2 слышит
//   носитель бомбы — на 30-й секунде бегом на B Site и ставит  — плант (звук + объявление)
// Взгляд CT1/CT2 в тесте задаётся вместо заглушки stubLook. Следим за CT1 и CT2.
freshMatch(3);
KNOW_TRACE = {CT1: true, CT2: true}; KNOW_LOG = [];
while(roundState !== "live") stepTick();
function zc(name){ var z = ZONEMAP.zones.filter(function(z){ return zoneUserName(z.id) === name; })[0], g = knowGraph();
  var p = snapToWalkable(g.c[z.id].x, g.c[z.id].y) || g.c[z.id]; return p; }
function go(id, zone, walk){ var b = botById(id), p = zc(zone);
  b.path = buildWaypointPath(b.x, b.y, b.z || 0, p.x, p.y, 0); b.pathIdx = 0; b.walking = !!walk; }
go("T0", "Mid"); go("CT0", "Mid"); go("T1", "A Main"); go("CT1", "Back Site");
go("T2", "Lamp Room", true); go("CT2", "Site B"); go("T3", "Dark");
var LOOK = {CT1: zc("A Main"), CT2: zc("Cave")}, osl = stubLook;
stubLook = function(b){ return LOOK[b.id] || osl(b); };
var T1back = false, lost = 0;
bomb.carrier = botById("T4");   // тест: бомба у T4 (стоит на спавне), чтобы дожила до планта
botById("T1").hp = botById("CT1").hp = botById("CT2").hp = 1e6;   // тест: T1, CT1, CT2 не умирают — нужна цепочка «увидел → потерял → проверил»
var R0 = roundNum, snaps = [], kills = [], t0 = Date.now(), n = 0;
var ofk = feedKill; feedKill = function(a, v){ kills.push([tick, a && a.id, v.id]); return ofk.apply(this, arguments); };
var start = tick;
while(roundNum === R0 && roundState !== "ending" && n < 64*120){
  stepTick(); n++;
  var t1 = botById("T1"), ct1 = botById("CT1");   // T1: заметили — назад на T-спавн
  if(!T1back && t1.alive && (ct1._visible || []).indexOf(t1) >= 0){ go("T1", "T Spawn"); T1back = tick; }
  if(T1back && !lost && ct1.know && ct1.know.enemies.T1 && !ct1.know.enemies.T1.visible) lost = tick;
  if(lost && tick === lost + 192) LOOK.CT1 = zc("CT Spawn");      // отвернулся…
  if(lost && tick === lost + 320) LOOK.CT1 = zc("A Main");    // …и снова посмотрел
  var cr = bomb && bomb.carrier;    // плант: на 30-й с носитель бежит на B и ставит
  if(cr && tick - start === 30*64){ cr.hp = 1e6; go(cr.id, "B Site"); }
  if(cr && tick - start > 30*64 && !cr.planting && bombSiteAt(cr.baseX, cr.baseY)) bombStartPlant(cr);
  if((tick - start) % 64 === 0) ["CT1", "CT2"].forEach(function(id){
    var b = botById(id); if(!b.alive || !b.know) return;
    var E = {};
    for(var k in b.know.enemies){ var B = b.know.enemies[k];
      E[k] = B.visible ? "ВИДИТ" : B.hyps.map(function(h){ return [h.type, h.type === "moved_unknown" ? "?" : knowZoneName(h.zone), +h.weight.toFixed(2)]; }); }
    snaps.push({tick: tick, sec: (tick - start)/64, who: id, enemies: E});
  });
}
// где кто реально (для сверки «верит ↔ на самом деле»)
JSON.stringify({start: start, ticks: n, msPerTick: (Date.now() - t0)/n, kills: kills, log: KNOW_LOG, snaps: snaps,
  truth: bots.map(function(b){ return [b.id, b.alive, knowZoneName(zoneIdAt(b.x, b.y))]; })});
