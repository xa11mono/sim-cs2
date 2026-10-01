# v154 шаг 3: "брать дуэль или нет" — без напарника на размен не лезть,
# после контакта без преимущества — откат, одно правило для CT и T.
rep("var BAL = {", """var BAL = {
  duelValue: true,    // v154: дуэль оценивается с учётом размена рядом (≤350px), перевеса и ситуации: один без размена — не лезет
  fallbackAll: true,  // v154: откат после контакта без преимущества — и у T в дефолте, не только у выдвинутых CT""")

rep("""  if(r === "anchorA" || r === "anchorB"){ holdScore += 0.15; retreatScore -= 0.05; } // опорник держит, ждёт помощь""",
"""  // (v154) ценность дуэли. По демкам: у про в момент смерти в 71–77% рядом (≤350px)
  // есть свой на размен, у ботов было 38–54% — боты дерутся в одиночку.
  if(BAL.duelValue){
    var dv = duelContext(bot, enemiesSeen, alliesNear);
    if(!dv.forced){
      if(dv.trade === 0 && !dv.hurtFoe){ engageScore -= 0.18; retreatScore += 0.10; holdScore += 0.04; }
      if(dv.up){ engageScore += 0.08; }
      if(dv.awpLine && !dv.flashed){ engageScore -= 0.12; holdScore += 0.05; }
      // по демкам первым в раунде у T гибнет энтри (22%), лёркер — 13%, AWP — 4%;
      // у ботов было: лёркер 25%, AWP 9%, энтри 9%. Лёркер играет от инфы и
      // тайминга, а не от дуэлей; AWP T в дефолте — не первая жертва
      if(bot.team === "T" && r === "lurker"){ engageScore -= 0.22; retreatScore += 0.14; }
      if(bot.team === "T" && wk === "AWP"){ engageScore -= 0.08; retreatScore += 0.05; }
    }
  }
  if(r === "anchorA" || r === "anchorB"){ holdScore += 0.15; retreatScore -= 0.05; } // опорник держит, ждёт помощь""")

rep("""function decideAction(bot, nearestDist, alliesNear, enemiesSeen){""","""// (v154) обстановка для решения о дуэли
function duelContext(bot, enemiesSeen, alliesNear){
  var o = {trade:0, up:false, forced:false, hurtFoe:false, awpLine:false, flashed:false};
  bots.forEach(function(m){ if(m !== bot && m.alive && m.team === bot.team && Math.hypot(m.x-bot.x, m.y-bot.y) <= 350) o.trade++; });
  var my = aliveCount(bot.team), their = aliveCount(bot.team === "CT" ? "T" : "CT");
  o.up = my > their;
  var tt = teamTac.T, secLeft = ROUND_TIME_SEC - (simTime - roundStartTime);
  // когда драться обязан: после планта (обе стороны), выход T, ретейк, клатч, время
  if(bomb && bomb.state === "planted") o.forced = true;
  else if(bot.team === "T" && tt && tt.phase && tt.phase !== "setup") o.forced = true;
  else if(my === 1) o.forced = true;
  else if(secLeft < 20) o.forced = true;
  else if(bot.post && /^(retake|defuse|plantspot|antidefuse|endhunt|tradeR)/.test(bot.post.tag || "")) o.forced = true;
  var e = bot._nearestEnemyBot;
  if(e){
    var HT = teamIntel[bot.team] && teamIntel[bot.team].hurt, hk = HT && HT[e.id];
    o.hurtFoe = !!(hk && hk.hp <= 40 && tick - hk.tick < 8*TICK_HZ) || e.hp <= 40;
    o.awpLine = !!(e.weapon && e.weapon.key === "AWP");
    o.flashed = tick < (e.blindUntil || 0);
  }
  return o;
}
function decideAction(bot, nearestDist, alliesNear, enemiesSeen){""")

# --- откат T в дефолте (тот же принцип, что у выдвинутых CT) ---
rep("""function infoFallbackTick(){""","""function tFallbackTick(){
  if(!BAL.fallbackAll || tick % 8 || roundState !== "live" || (bomb && bomb.state === "planted")) return;
  var tt = teamTac.T; if(!tt || tt.phase !== "setup") return;
  var secLeft = ROUND_TIME_SEC - (simTime - roundStartTime); if(secLeft < 35) return;
  var ED = enemySpawnDist("T");
  bots.forEach(function(b){
    if(!b.alive || b.team !== "T" || b._sawEnemy || b.planting || b._fbRound === roundNum) return;
    if(bomb && bomb.state === "carried" && bomb.carrier === b && tt.phase !== "setup") return;
    if(b.post && /^(repos|plantspot|lineup|tradeR|endhunt|fetch|coverplant|exec|stage|gather|save)/.test(b.post.tag||"")) return;
    var zb = bzOf(b.x, b.y); if(zb < 0) return;
    var L = beliefLast.T || {}, ids = 0, cx = 0, cy = 0;
    for(var eid in L){ var lo = L[eid]; if(tick - lo.tick > FB.window*TICK_HZ) continue; var eb = bots.filter(function(o){ return o.id === eid; })[0]; if(!eb || !eb.alive) continue;
      if(Math.hypot(lo.x-b.x, lo.y-b.y) > 900) continue; ids++; cx += lo.x; cy += lo.y; }
    var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === "T" && Math.hypot(o.x-b.x, o.y-b.y) <= 350; }).length;
    var died = intelDeathsNear("T", b.x, b.y, FB.deathR, FB.window*TICK_HZ) > 0;
    var hurt = b._hurtT && tick - b._hurtT < 2*TICK_HZ && b.hp < FB.hurtHp;
    // повод: их больше, чем нас тут; погиб свой рядом без размена; ранен
    var solo = b.tRole === "lurker" && mates === 0;
    var why = ((ids >= 2 && ids > mates + 1) || (solo && ids >= 1)) ? "их "+ids+" — отхожу" : (died && mates === 0) ? "минус рядом — отхожу" : hurt ? "ранен — отхожу" : null;
    if(!why) return;
    var th = ids ? {x:cx/ids, y:cy/ids} : (b.lastIntel ? {x:b.lastIntel.x, y:b.lastIntel.y} : null);
    var dx = th ? b.x-th.x : 0, dy = th ? b.y-th.y : 0, dl = Math.hypot(dx, dy);
    var center = dl > 1 ? walk({x:b.x+dx/dl*FB.back, y:b.y+dy/dl*FB.back}) : null;
    var cand = center ? pickSpots("tfb"+tick+b.id, center, 4, {rMax:FB.rMax, minGap:40, hideFrom: th ? [th] : []}) : [];
    var sp = cand.filter(function(q){ var zq = bzOf(q.x, q.y); return zq >= 0 && ED[zq] >= ED[zb] + FB.gainED && (!th || !hasLOS(q.x, q.y, th.x, th.y)); })[0];
    if(!sp) return;
    b._fbRound = roundNum; b._reposUntil = 0; b._probeLock = 0;
    setPost(b, sp, th || null, true, "repos:fallback");
    b._reposUntil = tick + FB.lock*TICK_HZ;
    voiceLog("T", "tfb"+b.id+roundNum, b.id, why+" ("+calloutName(sp.x, sp.y).replace(/^на /,"")+")");
  });
}
function infoFallbackTick(){
  tFallbackTick();""")
rep("версия 153 · 30.09","версия 154 · 30.09")

rep("""      if(BAL.bombCarrier && bomb && bomb.state === "carried" && bomb.carrier === o && aliveCount(o.team) >= 3) return; // носитель не бежит менять — бомба не должна умереть на входе""","""      if(BAL.bombCarrier && bomb && bomb.state === "carried" && bomb.carrier === o && aliveCount(o.team) >= 3) return; // носитель не бежит менять — бомба не должна умереть на входе
      // (v154) снайпер и лёркер T в дефолте на размен не срываются: у про их роль — держать свою линию
      if(BAL.duelValue && !(bomb && bomb.state === "planted") && ((o.weapon && o.weapon.key === "AWP") || (o.team === "T" && o.tRole === "lurker" && teamTac.T && teamTac.T.phase === "setup"))) return;""")
