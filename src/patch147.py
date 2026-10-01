# ===== v147: про-позиции из демок =====
rep("  egFix: true,", "  egFix: true,\n  proPrior: true,     // v147: позиции с учётом того, где реально стоят про (12 матчей)\n  proW: 1.5,          // вес про-плотности при выборе точки (pickSpots)\n  proFloor: 0.08,     // минимальный вес редкой позиции из списка названий")
rep("  var expT = BAL.openAngles ? ((o && o.team) || SPOT_TEAM) : null;",
    "  var expT = BAL.openAngles ? ((o && o.team) || SPOT_TEAM) : null;\n  var ppTeam = BAL.proPrior ? ((o && o.team) || SPOT_TEAM) : null, ppL = ppTeam ? ppLayer(ppTeam) : null;")
rep('    (o && o.cross ? "|x"+Math.round(o.cross.from.x/40)+","+Math.round(o.cross.from.y/40) : "");',
    '    (o && o.cross ? "|x"+Math.round(o.cross.from.x/40)+","+Math.round(o.cross.from.y/40) : "") + (ppL ? "|p"+ppL : "");')
rep("    sc -= d/(rMax*3); // при прочих равных — ближе к центру",
    "    sc -= d/(rMax*3); // при прочих равных — ближе к центру\n    if(ppL) sc += BAL.proW * proAt(ppTeam, c.x, c.y, ppL);")
rep('      var ni = weightedPick(names.length, roundNum*131 + matchNum*977 + (kA==="A"?1:2));',
    '      var ni = BAL.proPrior ? proPick("CT", names, roundNum*131 + matchNum*977 + (kA==="A"?1:2)) : weightedPick(names.length, roundNum*131 + matchNum*977 + (kA==="A"?1:2));')
rep("      if(off) ni = names.length - 1", "      if(BAL.proPrior) off = false;\n      if(off) ni = names.length - 1")
rep("  var ni = weightedPick(names.length, roundNum*211 + matchNum*37 + b.id.charCodeAt(2||1));",
    '  var ni = BAL.proPrior ? proPick("CT", names, roundNum*211 + matchNum*37 + b.id.charCodeAt(2||1)) : weightedPick(names.length, roundNum*211 + matchNum*37 + b.id.charCodeAt(2||1));')
rep("  var nm = P.pos[Math.floor(hashRand(roundNum*97 + role.length*13 + matchNum) * P.pos.length)];",
    '  var nm = BAL.proPrior ? P.pos[proPick("CT", P.pos, roundNum*97 + role.length*13 + matchNum)] : P.pos[Math.floor(hashRand(roundNum*97 + role.length*13 + matchNum) * P.pos.length)];')
rep("  proFloor: 0.08,", "  proFloor: 0.08,\n  proSetup: true,     // v147: стандартная расстановка CT по данным демок (сколько где стоят)")
rep("      var names = POS[kA].ctHold, ents = [GEO[kA].tEntry].concat(entryPts(kA));",
    "      var names = (BAL.proSetup ? PRO_ROLE[\"anchor\"+kA] : POS[kA].ctHold), ents = [GEO[kA].tEntry].concat(entryPts(kA));")
rep("        if(!secondOnSite(b, ks, ap2))",
    "        if(!(BAL.proSetup ? proRolePost(b, \"rot\", PRO_ROLE.rot212, GEO.rotator || CT_SPAWN, GEO.ctMid, \"rotator\") : secondOnSite(b, ks, ap2)))")
rep("      if(!secondOnSite(b, ko2, apR))",
    "      if(!(BAL.proSetup ? proRolePost(b, \"roam\", PRO_ROLE.roam212, GEO.B.anchor, GEO.B.tEntry, \"anchor2B\") : secondOnSite(b, ko2, apR)))")
rep("  proSetup: true,", "  proSetup: true,\n  ppSpread: true,     // v147: после планта бомбу видит один, остальные держат подходы (по демкам)")
rep('holdGroup(group, {key:"pp"+bomb.site+Math.round(bp0.x/30), center:bp0, rArea:320, rMin:90, rMax:420, must:[bp0],',
    'holdGroup(group, {key:"pp"+bomb.site+Math.round(bp0.x/30), center:bp0, rArea:320, rMin:90, rMax:420, must:[bp0], mustFirst:BAL.ppSpread, rMax2:560,')
