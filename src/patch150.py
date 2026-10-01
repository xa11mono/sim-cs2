rep("  enemyward: true,", "  enemyward: true,\n  proLineups: true,   // v150: гранаты по реальным про-лайнапам из демок (с вероятностью и таймингом)")
# добавить про-лайнапы в общий список
rep("function allLineups(){ return LINEUPS_BAKED.concat(USER_LINEUPS); }",
    "function allLineups(){ var L = LINEUPS_BAKED.concat(USER_LINEUPS); return BAL.proLineups ? L.concat(proLineups()) : L; }")
# встроенные общие — выключаются, если есть про-лайнап той же категории
rep("function builtinAllowed(key){\n  if(BUILTIN_OFF[key]) return false;",
    "function builtinAllowed(key){\n  if(BUILTIN_OFF[key]) return false;\n  if(proCovers(key)) return false;")
# розыгрыш вероятности, тайминг, новые триггеры, радиус поиска бросающего
rep("""    var key = "lu"+L.id; if(nadeFlags[key]) return;
    var siteOk = function(k){ return L.site === "any" || L.site === k; };
    var go = false;
    if(L.trigger === "insta") go = since > TICK_HZ;""",
"""    var key = "lu"+L.id; if(nadeFlags[key]) return;
    // (v150) про-лайнап: в этом раунде кидается с вероятностью, как у про
    if(L.pro && nadeFlags["pr"+L.id] === undefined){
      var hid = 0; for(var hi=0; hi<L.id.length; hi++) hid = hid*31 + L.id.charCodeAt(hi);
      nadeFlags["pr"+L.id] = hashRand(roundNum*7919 + matchNum*104729 + hid) < L.prob;
    }
    if(L.pro && !nadeFlags["pr"+L.id]){ nadeFlags[key] = true; return; }
    var siteOk = function(k){ return L.site === "any" || L.site === k; };
    var go = false;
    if(L.trigger === "insta") go = since > TICK_HZ;
    else if(L.trigger === "timed") go = bomb.state !== "planted" && since >= (L.at||0)*TICK_HZ && since < ((L.at||0)+12)*TICK_HZ;
    else if(L.pro && L.team === "T" && L.trigger === "setup") go = tt.phase === "setup" && since >= Math.max(1, (L.at||12)-1)*TICK_HZ && siteOk(tt.site);""")
rep("""    var hot = L.trigger !== "insta" && L.trigger !== "setup";
    var maxD = hot ? 480 : 1600;""",
"""    var hot = L.trigger !== "insta" && L.trigger !== "setup";
    var maxD = hot ? 480 : 1600;
    // (v150) про-лайнапы кидает тот, кто и так рядом: сетап — в пределах ~7 м,
    // "по времени" — ~4 м (не бросать позицию ради гранаты)
    if(L.pro && L.trigger === "setup") maxD = 700;
    if(L.pro && L.trigger === "timed"){ maxD = 400; hot = true; }""")
