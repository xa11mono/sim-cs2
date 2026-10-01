rep("  proLineups: true,", "  proLineups: true,\n  smokeSpam: true,    // v150: прострел смоков по тому, что бот знает (частоты — по демкам)\n  smokeReact: true,   // v150: HE в смок противника и смена позиции, когда смок закрыл угол")
rep('  if(T === "smoke"){ smokes.push({x:n.x, y:n.y, born:tick, until:tick+NADE.smoke.life}); }',
    '  if(T === "smoke"){ smokes.push({x:n.x, y:n.y, born:tick, until:tick+NADE.smoke.life, team:n.team}); if(BAL.smokeReact) smokeShiftOnDetonate(smokes[smokes.length-1]); }')
rep("  smokeShots();", "  if(BAL.smokeSpam) smokeSpamTick(); else smokeShots();\n  if(BAL.smokeReact) smokeHeTick();")
rep("function newLookFor(b){", "function newLookFor(b){\n  if(b._spam && tick < b._spam.until){ b.lookReason = \"spam\"; return b._spam.pt; }")
rep("var WHY_LOOK = {look:", "var WHY_LOOK = {spam:\"простреливает смок\", look:")
