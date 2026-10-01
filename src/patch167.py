# v164 шаг 10: гранаты. Про-лайнапы из демок чаще долетают: кидать идёт тот,
# кто в пределах 8–11 м от точки броска (было 4–7 м — 60–70% лайнапов пропадали);
# смок 18с и молотов 7с как в CS2.
rep("var BAL = {", """var BAL = {
  nadeReach: true,    // v164: про-лайнапы кидает ближайший в 8–11 м (было 4–7 м), задание на "тайминговый" лайнап живёт 12с""")
rep("""    var maxD = hot ? 480 : 1600;""","""    var maxD = hot ? (BAL.nadeReach ? 650 : 480) : 1600;""")
rep("""    if(L.pro && L.trigger === "setup") maxD = 700;
    if(L.pro && L.trigger === "timed"){ maxD = 400; hot = true; }""","""    if(L.pro && L.trigger === "setup") maxD = BAL.nadeReach ? 1100 : 700;
    if(L.pro && L.trigger === "timed"){ maxD = BAL.nadeReach ? 850 : 400; hot = true; }""")
rep("""    cand.nadeTask = {type:L.type, x:L.to.x, y:L.to.y, from:{x:L.from.x, y:L.from.y}, until: tick + (hot ? 7 : 20)*TICK_HZ,""","""    cand.nadeTask = {type:L.type, x:L.to.x, y:L.to.y, from:{x:L.from.x, y:L.from.y}, until: tick + (hot ? ((BAL.nadeReach && L.trigger === "timed") ? 12 : 7) : 20)*TICK_HZ,""")
rep("""  smokeLife: 15,""","""  smokeLife: 18,""")
rep("""  mollyLife: 5,""","""  mollyLife: 7,""")
rep("версия 163 · 01.10","версия 164 · 01.10")
# закуп гранат как у про: эко ~1 на игрока (если не ломает следующий закуп), пистолетка —
# у кого осталось на флешку/смок, форс/хаф — до 2 (у про на форсе ~11 гранат на команду)
rep("var BAL = {", """var BAL = {
  nadeBuy: true,      // v164: гранаты и на эко/пистолетке (флешка/смок/HE), на форсе до 2""")
rep("""  var budget = type === "full" ? 99 : (type === "force" || type === "half" ? 1 : 0);
  if(type === "pistol" || type === "eco") budget = 0;""","""  var budget = type === "full" ? 99 : (type === "force" || type === "half" ? (BAL.nadeBuy ? 2 : 1) : 0);
  if(type === "pistol" || type === "eco") budget = BAL.nadeBuy ? 1 : 0;
  var keepEco = (BAL.nadeBuy && type === "eco") ? fullNeed(b) - nextLossIncome(b.team) : -1e9;""")
rep("""    if(type !== "full" && b.money - pr < 200) continue;""","""    if(type !== "full" && b.money - pr < 200 && !(BAL.nadeBuy && type === "pistol" && b.money >= pr)) continue;
    if(BAL.nadeBuy && (type === "eco" || type === "pistol") && t === "molly") continue;
    if(BAL.nadeBuy && type === "eco" && b.money - pr < keepEco) continue;""")
# кит на фулле — не каждому за счёт гранат: двое-трое (чётные слоты) или если после кита остаётся на 2–3 гранаты
rep("""    if(b.team === "CT" && !b.kit && b.money >= 400){ b.money -= 400; b.kit = true; } // кит""","""    if(b.team === "CT" && !b.kit && b.money >= 400 && (!BAL.nadeBuy || idx % 2 === 0 || b.money >= 400 + 750)){ b.money -= 400; b.kit = true; } // кит""")
# остальные про-лайнапы из демок (реже 5% раундов, но не меньше чем в 3 матчах)
rep("var BAL = {", """var BAL = {
  nadeMore: true,     // v164: + ~150 редких про-лайнапов из демок (≥3 матчей)""")
rep("""var PRO_LINEUPS = null;""","""if(BAL.nadeMore) PRO_LINEUPS_RAW = PRO_LINEUPS_RAW.concat(""" + open('prolib/lineups_extra.json').read() + """);
var PRO_LINEUPS = null;""")
