# v160 шаг 7: оборона CT до планта — расстановка как у про, опорник не
# сдаёт сайт на одну "вероятность", агрессивные сетапы реже.
rep("var BAL = {", """var BAL = {
  proCtSetup: true,   // v160: веса расстановок как у про (в основном стандарт), стаки/ранние пики реже; опорник отходит только при реальном выходе (видели 2+ или гранаты выхода)""")

rep("""      ct.call = {logged: prevLogged, site:best.site, count:best.count, tick:tick, evTick:tick, since:(!isNew && ct.call.since) || tick, sinceSite:best.site, undefended:best.undefended, bombSeen: best.carrier || best.plant};""",
"""      ct.call = {logged: prevLogged, site:best.site, count:best.count, tick:tick, evTick:tick, since:(!isNew && ct.call.since) || tick, sinceSite:best.site, undefended:best.undefended, bombSeen: best.carrier || best.plant, seen: best.est ? best.est.seen : 0, nades: best.nades || 0};""")

# опорник: отход только когда выход реальный (у ботов он уходил на 18-й секунде
# по одной "оценке" — T в дефолте стоят у сайта, а сайт уже пустой)
rep("""      if(BAL.anchorFall && cl && cl.site === kA && cl.count >= 2.6 && !(bomb && bomb.state === "planted") &&""","""      if(BAL.anchorFall && cl && cl.site === kA && cl.count >= 2.6 && !(bomb && bomb.state === "planted") &&
         (!BAL.proCtSetup || (cl.seen || 0) >= 2 || (cl.nades || 0) >= 2 || cl.bombSeen) &&""")

# веса расстановок
rep("""    var w = {std212:3, std111:1.5, midAggro:1, pickA:0.8, pickB:0.8, redRoom:1, cavePush:1, stackA:0.2, stackB:0.2, retakeA:0.2, retakeB:0.2}[S.id] || 1;
    if(S.stack){ var h = heat[S.stack]; if(last.length >= 3 && h >= 3){ w = 4; why[S.id] = "T ходили на "+S.stack+" "+h+" из "+last.length; } else if(h >= 2) w = 1; }""","""    var w = (BAL.proCtSetup ? {std212:4, std111:1.5, midAggro:0.5, pickA:0.4, pickB:0.4, redRoom:0.6, cavePush:0.5, stackA:0.2, stackB:0.2, retakeA:0.2, retakeB:0.2}
                            : {std212:3, std111:1.5, midAggro:1, pickA:0.8, pickB:0.8, redRoom:1, cavePush:1, stackA:0.2, stackB:0.2, retakeA:0.2, retakeB:0.2})[S.id] || 1;
    if(S.stack){ var h = heat[S.stack]; if(last.length >= 3 && h >= 3){ w = BAL.proCtSetup ? 1.2 : 4; why[S.id] = "T ходили на "+S.stack+" "+h+" из "+last.length; } else if(h >= 2) w = BAL.proCtSetup ? 0.4 : 1; }""")
rep("""      if(avgExec < 25) w *= 0.4; else if(avgExec > 45){ w *= 1.6;""","""      if(avgExec < 25) w *= 0.4; else if(avgExec > 45){ w *= BAL.proCtSetup ? 1.15 : 1.6;""")
rep("версия 159 · 01.10","версия 160 · 01.10")
