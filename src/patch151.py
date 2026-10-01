# ===== v151: правки по фидбеку =====
rep("  smokeReact: true,", "  smokeReact: true,\n  coverFix: true,     // v151: прикрыть угол слепого со своего места, не залезая в тиммейта")
rep('''      var cs = pickSpots("covblind"+tick+cov.id, {x:b.baseX, y:b.baseY}, 2, {rMax:110, minGap:24, see:[threat]})
        .filter(function(q){ return hasLOS(q.x, q.y, threat.x, threat.y); })[0];''',
'''      var cs = BAL.coverFix
        // (v151) раньше точка бралась вплотную к ослеплённому — а он в это время
        // отходит по тому же проходу: оба упирались друг в друга и дёргались.
        // Теперь: если угол и так видно — стоим и целимся; иначе шаг рядом с собой,
        // не ближе ~1м к слепому и к точке, куда он отходит
        ? (hasLOS(cov.x, cov.y, threat.x, threat.y) ? null : pickSpots("covblind"+tick+cov.id, {x:cov.x, y:cov.y}, 3, {rMax:130, minGap:24, see:[threat]})
            .filter(function(q){ return hasLOS(q.x, q.y, threat.x, threat.y) && Math.hypot(q.x-b.x, q.y-b.y) > 60 && !(back && Math.hypot(q.x-back.x, q.y-back.y) < 60); })[0])
        : pickSpots("covblind"+tick+cov.id, {x:b.baseX, y:b.baseY}, 2, {rMax:110, minGap:24, see:[threat]})
        .filter(function(q){ return hasLOS(q.x, q.y, threat.x, threat.y); })[0];
      if(BAL.coverFix && !cs){ cov._coverDir = {pt:{x:threat.x, y:threat.y}, until:b.blindUntil}; voiceLog(b.team, "cb"+b.id+tick, cov.id, "держу угол за "+b.id); }''')
rep("function newLookFor(b){\n", "function newLookFor(b){\n  if(BAL.coverFix && b._coverDir && tick < b._coverDir.until && !b._sawEnemy){ b.lookReason = \"cover\"; return cornerLook(b, b._coverDir.pt) || b._coverDir.pt; }\n")
rep("  coverFix: true,", "  coverFix: true,\n  cornerAim: true,    // v151: взгляд на место, где враг реально появится (угол на его пути), а не на середину прохода")
rep("  cornerAim: true,", "  cornerAim: true,\n  fireExit: true,     // v151: из огня выходит всегда (даже если держал угол), путь наружу не перебивается")
rep("""        bot._fireExit = best; bot._fireExitFire = burn;
        if(best){ bot.path = [[best.x, best.y, bot.z]]; bot.pathIdx = 0; }
      }
      targetSpeed = runSpeed;""","""        bot._fireExit = best; bot._fireExitFire = burn;
        if(best){ bot.path = [[best.x, best.y, bot.z]]; bot.pathIdx = 0; }
      }
      // (v151) раньше путь наружу перебивали пост/бой каждый тик, а держащий угол
      // вообще не двигался — стоял в огне. Теперь, пока горит, путь только наружу
      if(BAL.fireExit && bot._fireExit){
        bot.holding = false;
        var fw = bot.path && bot.path[bot.path.length-1];
        if(!fw || Math.hypot(fw[0]-bot._fireExit.x, fw[1]-bot._fireExit.y) > 4){ bot.path = [[bot._fireExit.x, bot._fireExit.y, bot.z]]; bot.pathIdx = 0; }
      }
      targetSpeed = runSpeed;""")
rep("          if(bot.post) dq += Math.hypot(qx-bot.post.x, qy-bot.post.y)*0.3;",
    "          if(bot.post) dq += Math.hypot(qx-bot.post.x, qy-bot.post.y)*(BAL.fireExit ? 0.08 : 0.3);   // (v151) ближний край важнее, не через весь огонь")
rep("""        if(!fw || Math.hypot(fw[0]-bot._fireExit.x, fw[1]-bot._fireExit.y) > 4){ bot.path = [[bot._fireExit.x, bot._fireExit.y, bot.z]]; bot.pathIdx = 0; }
      }
      targetSpeed = runSpeed;""","""        if(!fw || Math.hypot(fw[0]-bot._fireExit.x, fw[1]-bot._fireExit.y) > 4){ bot.path = [[bot._fireExit.x, bot._fireExit.y, bot.z]]; bot.pathIdx = 0; }
        bot.walking = false; bot.crouching = false;   // из огня — бегом, не шифтом
      }
      targetSpeed = BAL.fireExit ? SPEED * weaponSpeedMul(bot) : runSpeed;""")
rep("  fireExit: true,", "  fireExit: true,\n  callFix: true,      // v151: колл CT по сайтам — исправлен NaN (колл всегда висел на A, на B не появлялся)")
rep("""    var evN = BAL.oneStore ? (est.seen + est.heard) : est.n;""","""    var evN = BAL.oneStore ? (est.seen + est.heard) : est.n;
    // (v151) раньше nadeHere использовалась ДО подсчёта (undefined → NaN): ev и
    // score сайта всегда были NaN, колл вечно висел на A, а B не мог его перебить
    var nadeHere = BAL.callFix ? 0 : undefined;
    // гранаты в первые ~18с — стандартный контроль карты (инсты, молотов на рампу),
    // про не читают их как выход; флешки — не довод (их кидают и в фейках)
    if(BAL.callFix && BAL.tacRead && tick - roundStartTick > 18*TICK_HZ){
      (teamIntel.CT.nadeSeen||[]).forEach(function(q){ if(tick - q.tick > 6*TICK_HZ || q.type === "flash") return;
        if(Math.hypot(q.x-SITES[k].x, q.y-SITES[k].y) < 600 || Math.hypot(q.x-GEO[k].tEntry.x, q.y-GEO[k].tEntry.y) < 300 || Math.hypot(q.x-GEO[k].ctEntry.x, q.y-GEO[k].ctEntry.y) < 300)
          nadeHere += q.type === "flash" ? 0.5 : 1; });
    }""")
rep("""    var nadeHere = 0;
    if(BAL.tacRead){""","""    if(!BAL.callFix) nadeHere = 0;
    if(!BAL.callFix && BAL.tacRead){""")
