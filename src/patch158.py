# v156 шаг 4: что делать после своего фрага.
# По демкам за 2с после фрага: 31% про идут вперёд (к месту фрага/за вторым),
# 13% откатываются, 56% остаются. У ботов было 23 / 7 / 72.
rep("var BAL = {", """var BAL = {
  postKill: true,     // v156: после фрага — добор (враг один/ранен, есть размен), откат (их много, мало HP) или остаться""")

rep("""  var foes700 = foesNear.filter(function(o){ return Math.hypot(o.x-sh.x, o.y-sh.y) < 700; });""","""  if(BAL.postKill){ var pkR = postKillDecide(sh, tg, vp, here); if(pkR) return true; }
  var foes700 = foesNear.filter(function(o){ return Math.hypot(o.x-sh.x, o.y-sh.y) < 700; });""")

rep("""function afterKillMove(sh, tg, w){""","""// (v156) решение после фрага — только по тому, что команда знает (ЛИП ≤5с),
// а не по настоящим позициям врагов
function postKillDecide(sh, tg, vp, here){
  if(sh.post && /^(lineup|plantspot|defuse|save|fetch|antidefuse|stopplant)/.test(sh.post.tag || "")) return false;
  var known = [], LK = LKP[sh.team] || {};
  for(var eid in LK){ var q = LK[eid]; if(eid === tg.id || tick - q.tick > 5*TICK_HZ) continue;
    if(!bots.some(function(o){ return o.id === eid && o.alive; })) continue;
    if(Math.hypot(q.x-vp.x, q.y-vp.y) < 700 || Math.hypot(q.x-sh.x, q.y-sh.y) < 700) known.push({id:eid, x:q.x, y:q.y}); }
  var mates = bots.filter(function(o){ return o !== sh && o.alive && o.team === sh.team && Math.hypot(o.x-sh.x, o.y-sh.y) <= 350; }).length;
  var my = aliveCount(sh.team), their = aliveCount(tg.team);
  var HT = teamIntel[sh.team] && teamIntel[sh.team].hurt, hurtK = known.some(function(k){ var h = HT && HT[k.id]; return h && h.hp <= 40 && tick - h.tick < 8*TICK_HZ; });
  var tPP = sh.team === "T" && bomb && bomb.state === "planted";
  var ctMust = sh.team === "CT" && bomb && bomb.state === "planted";
  var pa = prof(sh, "aggr"), seed = tick*53 + (sh.id.charCodeAt(sh.id.length-1)||0)*17;
  // 1) откат: их рядом двое и больше (и нас тут меньше), или мало HP — уйти с засвеченной точки
  if(!ctMust && ((known.length >= 2 && known.length > mates) || sh.hp <= 45)){
    var dvx = here.x - vp.x, dvy = here.y - vp.y, dvl = Math.max(1, Math.hypot(dvx, dvy));
    var back = walk({x: here.x + dvx/dvl*170, y: here.y + dvy/dvl*170});
    var hide = [vp].concat(known.map(function(k){ return {x:k.x, y:k.y}; }));
    var np = pickSpots("pkb"+tick+sh.id, back, 4, {rMin:0, rMax:200, minGap:50, see: sh.post && sh.post.look ? [sh.post.look] : [], hideFrom:hide})
      .filter(function(p){ return Math.hypot(p.x-here.x, p.y-here.y) > 70 && !hasLOS(p.x, p.y, vp.x, vp.y); })[0];
    if(np){
      sh._reposUntil = 0; sh._egLock = 0; sh._probeLock = 0;
      setPost(sh, np, vp, true, "repos:back");
      if(sh.post && sh.post.tag === "repos:back"){ leaveHold(sh); sh._reposUntil = tick + 4*TICK_HZ;
        logEvent(sh.id+": после фрага откат — "+(sh.hp <= 45 ? "мало HP" : "их ещё "+known.length+" рядом")); return true; }
    }
  }
  // 2) добор: известный враг рядом один (или ранен), сам цел, есть размен или перевес
  if(!tPP && known.length <= 1 && sh.hp > 50 && (mates >= 1 || my > their || hurtK || ctMust)){
    var pPush = (ctMust ? 0.75 : 0.35 + 0.4*pa);
    if(hashRand(seed) < pPush){
      var tgt = known[0] ? {x:known[0].x, y:known[0].y} : vp;
      var sw = pickSpots("pkp"+tick+sh.id, vp, 4, {rMax:150, minGap:40, see:[tgt]})
        .filter(function(p){ return Math.hypot(p.x-here.x, p.y-here.y) > 60; })[0] || vp;
      sh._reposUntil = 0; sh._egLock = 0;
      setPost(sh, sw, tgt, true, "repos:push");
      if(sh.post && sh.post.tag === "repos:push"){ leaveHold(sh); sh._reposUntil = tick + 3*TICK_HZ;
        logEvent(sh.id+": после фрага добирает — "+(known.length ? "второй рядом" : "дальше по месту фрага")); return true; }
    }
  }
  return false;
}
function afterKillMove(sh, tg, w){""")
rep("версия 155 · 30.09","версия 156 · 01.10")
