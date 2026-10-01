// =====================================================================
// (v151) РОЛИ КАК У ПРО (12 матчей). У каждого бота — роль игрока:
//   энтри — первая дуэль в 39% раундов за T; второй (размен) — сразу за энтри;
//   саппорт — больше всех гранат (2.3 за раунд), часто IGL; лёркер — дальше всех
//   от команды; снайпер — AWP ~35% времени, гранат тоже много (2.4).
// За CT те же типы игроков встают так: лёркер — один выдвинут на B (Cave/Lamp,
// 42%), энтри — мид/вперёд за инфой, саппорт — опорник B, снайпер — гибко.
// Выдвинутый CT у про берёт инфу и ОТКАТЫВАЕТСЯ (ранних смертей CT у про 0.41
// за 20с против 0.68 у ботов) — это поведение ниже (infoFallbackTick).
// =====================================================================
var PRO_PROLE = {
  // внутренние роли T в симуляторе → роль игрока
  T:  {entry:"entry", support:"second", igl:"support", lurker:"lurker", awp:"awp"},
  CT: {anchorA:"second", mid:"awp", anchorB:"support", rotator:"support", roamer:"lurker"}
};
var PROLE_NADES = {T:{entry:1.6, second:1.6, support:2.3, lurker:1.8, awp:2.35}, CT:{second:1.9, awp:2.0, support:2.06, lurker:2.0, entry:2.08}};
var PROLE_LABEL = {entry:"энтри", second:"второй (размен)", support:"саппорт", lurker:"лёркер", awp:"снайпер"};
function pRole(b){ var M = PRO_PROLE[b.team]; return (M && M[b.tRole]) || b.tRole; }
// кто кидает лайнап: при прочих равных — тот, чья роль кидает больше гранат
function nadeRoleCost(b){
  if(!BAL.proRoles) return 0;
  var r = (PROLE_NADES[b.team]||{})[pRole(b)]; if(r == null) return 0;
  return (2.4 - r) * BAL.utilRoleK;
}
var FB = { enemies:2, window:3, deathR:900, hurtHp:70, back:320, rMax:220, gainED:150, lock:10 };
function infoFallbackTick(){
  if(!BAL.infoFallback || tick % 8 || roundState !== "live" || (bomb && bomb.state === "planted")) return;
  var ED = enemySpawnDist("CT");
  bots.forEach(function(b){
    if(!b.alive || b.team !== "CT" || b._sawEnemy || b.planting || b.defusing) return;
    if(b._fbRound === roundNum) return;
    if(b.post && /^(repos|clutch|retake|gather|save|defuse|lineup|tradeR|endhunt|rotate)/.test(b.post.tag||"")) return;
    var zb = bzOf(b.x, b.y); if(zb < 0) return;
    // выдвинут: ближе к врагу, чем ближайший сайт (на 200+ по пути)
    var zA = bzOf(GEO.A.anchor.x, GEO.A.anchor.y), zB = bzOf(GEO.B.anchor.x, GEO.B.anchor.y);
    var siteED = Math.min(zA >= 0 ? ED[zA] : 1e9, zB >= 0 ? ED[zB] : 1e9);
    if(!(ED[zb] < siteED - 200)) return;
    // повод откатиться: 2+ разных врага рядом за 3с, погиб свой рядом, или ранен
    var L = beliefLast.CT || {}, ids = 0, cx = 0, cy = 0;
    for(var eid in L){ var lo = L[eid]; if(tick - lo.tick > FB.window*TICK_HZ) continue; var eb = bots.filter(function(o){ return o.id === eid; })[0]; if(!eb || !eb.alive) continue;
      if(Math.hypot(lo.x-b.x, lo.y-b.y) > 900) continue; ids++; cx += lo.x; cy += lo.y; }
    var died = intelDeathsNear("CT", b.x, b.y, FB.deathR, FB.window*TICK_HZ) > 0;
    var hurt = b._hurtT && tick - b._hurtT < 2*TICK_HZ && b.hp < FB.hurtHp;
    var why = ids >= FB.enemies ? "их "+ids+" — откатываюсь" : died ? "минус рядом — откатываюсь" : hurt ? "ранен — откатываюсь" : null;
    if(!why) return;
    var th = ids ? {x:cx/ids, y:cy/ids} : (b.lastIntel ? {x:b.lastIntel.x, y:b.lastIntel.y} : null);
    // назад = от угрозы, дальше от вражеского спавна
    var dx = th ? b.x-th.x : 0, dy = th ? b.y-th.y : 0, dl = Math.hypot(dx, dy);
    var center = dl > 1 ? walk({x:b.x+dx/dl*FB.back, y:b.y+dy/dl*FB.back}) : null;
    var cand = [];
    if(center) cand = pickSpots("fb"+tick+b.id, center, 4, {rMax:FB.rMax, minGap:40, hideFrom: th ? [th] : []});
    var sp = cand.filter(function(q){ var zq = bzOf(q.x, q.y); return zq >= 0 && ED[zq] >= ED[zb] + FB.gainED && (!th || !hasLOS(q.x, q.y, th.x, th.y)); })[0];
    if(!sp){ var k = Math.hypot(b.x-SITES.A.x, b.y-SITES.A.y) < Math.hypot(b.x-SITES.B.x, b.y-SITES.B.y) ? "A" : "B"; sp = GEO[k].anchor; }
    b._fbRound = roundNum;
    b._reposUntil = 0; b._egLock = 0; b._probeLock = 0;
    setPost(b, sp, th || null, true, "repos:fallback");
    b._reposUntil = tick + FB.lock*TICK_HZ;
    voiceLog("CT", "fb"+b.id+roundNum, b.id, why+" ("+calloutName(sp.x, sp.y).replace(/^на /,"")+")");
  });
}
