// (v487) Передача смока выхода запасному (366: exuReassign) и очередь гранат (380: nadeQueueNext) — сцены в игре.
// node src/q.js sim.html @tools/tests/exu_reassign_test.js   → JSON {ok, checks: [[имя, true/false, подробности]]}
// Каждая сцена: матч 3, раунд идёт (сетап T), у ботов T — заданные гранаты и задания; передача; затем 300 тиков игры без исключений.
(function(){
  var R = [];
  function check(name, cond, info){ R.push([name, !!cond, info || ""]); }
  function setup(){
    freshMatch(3); if(typeof WARM !== "undefined") WARM.on = false;
    for(var g = 0; g < 200000 && !(roundState === "live" && teamTac.T && teamTac.T.phase === "setup" && tick - roundStartTick > 64*20); g++) stepTick();
    var ts = bots.filter(function(b){ return b.team === "T" && b.alive; });
    ts.forEach(function(b){ b.nadeTask = null; b.nadeQueue = null; b.nades = emptyNades(); });
    EXU = null; exuCur();
    return ts;
  }
  function item(owner, from){ var E = exuCur(), S = SITES[teamTac.T.site];
    var it = {id: ++E.n, type: "smoke", x: S.x, y: S.y, from: from ? {x: owner.x, y: owner.y} : null, why: "тест", site: teamTac.T.site, owner: owner.id,
              crit: true, state: "failed", at: tick, re: 0, failWhy: "тест"};
    E.items[it.id] = it; return it; }
  function run(n){ try { for(var i = 0; i < n; i++) stepTick(); return null; } catch(e){ return String(e); } }
  var nonCarrier = function(b){ return !(bomb.state === "carried" && bomb.carrier === b) && b.tRole !== "lurker"; };

  // 1) запасной со своей гранатой с места (без точки броска) — берётся; своя граната в очереди; очередь её возвращает
  var ts = setup(), own = ts.filter(nonCarrier)[0], back = ts.filter(nonCarrier)[1];
  back.nades.smoke = 1; back.nades.flash = 1; assignNade(back, "flash", {x: back.x + 200, y: back.y}, "своя", {now: true});
  var ownT = back.nadeTask, it = item(own, true);
  ts.forEach(function(b){ if(b !== back) b.nades.smoke = 0; });
  var ok = exuReassign(it, teamTac.T);
  check("1 запасной со своей гранатой с места взят", ok && it.owner === back.id, "owner " + it.owner);
  check("1 своя граната в очереди", (back.nadeQueue || []).indexOf(ownT) >= 0);
  back.nadeTask = null;   // смок выхода «брошен / снят» — очередь отдаёт свою гранату
  nadeQueueNext(back);
  check("1 очередь вернула гранату с места", back.nadeTask && back.nadeTask.type === "flash" && !back.nadeTask.from, back.nadeTask && back.nadeTask.type);
  var err = run(300); check("1 300 тиков без ошибок", !err, err);

  // 2) у единственного со смоком — свой лайнап (с точкой броска): не перебиваем → запасного нет
  ts = setup(); own = ts.filter(nonCarrier)[0]; back = ts.filter(nonCarrier)[1];
  back.nades.smoke = 2; back.nadeTask = {type: "smoke", x: back.x + 300, y: back.y, from: {x: back.x, y: back.y}, until: tick + 640, why: "свой лайнап", start: tick, lob: true, range: 4000, now: true, lineup: true};
  it = item(own, true);
  ok = exuReassign(it, teamTac.T);
  check("2 свой лайнап не перебит", !ok && back.nadeTask && back.nadeTask.why === "свой лайнап");
  err = run(300); check("2 300 тиков без ошибок", !err, err);

  // 3) запасного нет вовсе (ни у кого нет смока) → не передаётся; exuTick: провал → «drop» (выход без смока)
  ts = setup(); own = ts.filter(nonCarrier)[0];
  it = item(own, true); it.state = "assigned";
  check("3 запасного нет — передачи нет", !exuReassign(it, teamTac.T));
  it.state = "failed"; exuTick(teamTac.T);
  check("3 провал без замены — drop", it.done === true, JSON.stringify(EXU.ev.slice(-1)));
  err = run(300); check("3 300 тиков без ошибок", !err, err);

  // 4) основной погиб: задание пропало без броска → провал «исполнитель погиб» → передача запасному
  ts = setup(); own = ts.filter(nonCarrier)[0]; back = ts.filter(nonCarrier)[1];
  own.nades.smoke = 1; back.nades.smoke = 1;
  own.nadeTask = {type: "smoke", x: SITES[teamTac.T.site].x, y: SITES[teamTac.T.site].y, from: {x: own.x, y: own.y}, until: tick + 640, why: "лайнап тест", start: tick, lob: true, range: 4000, now: true, lineup: true, exec: true};
  exuTick(teamTac.T);
  var it4 = EXU.items[own.nadeTask.exu];
  own.alive = false; own.nadeTask = null;
  exuTick(teamTac.T);
  check("4 смерть основного → провал", it4 && (it4.failWhy === "исполнитель погиб" || it4.state === "assigned"), it4 && (it4.failWhy || it4.state));
  check("4 смок у запасного", it4 && it4.owner !== own.id && it4.re === 1, it4 && it4.owner);
  err = run(300); check("4 300 тиков без ошибок", !err, err);

  // 5) передача один раз: второй провал той же гранаты — без новой передачи
  if(it4){ it4.state = "failed"; it4.done = false; exuTick(teamTac.T); check("5 второй раз не передаётся", it4.done === true && it4.re === 1, "re " + it4.re); }

  // 6) конец раунда во время передачи: задание в очереди, раунд кончился → очередь не падает
  ts = setup(); own = ts.filter(nonCarrier)[0]; back = ts.filter(nonCarrier)[1];
  back.nades.smoke = 1; back.nades.flash = 1; assignNade(back, "flash", {x: back.x + 200, y: back.y}, "своя", {now: true});
  it = item(own, true); exuReassign(it, teamTac.T);
  endRound("CT", "time");
  back.nadeTask = null; var e6 = null; try { nadeQueueNext(back); } catch(e){ e6 = String(e); }
  check("6 очередь после конца раунда без ошибки", !e6, e6);
  err = run(600); check("6 600 тиков без ошибок", !err, err);

  return JSON.stringify({ok: R.every(function(c){ return c[1]; }), checks: R});
})()
