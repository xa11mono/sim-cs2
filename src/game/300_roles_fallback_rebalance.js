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
function tFallbackTick(){
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
// (v165) ПЕРЕРАСПРЕДЕЛЕНИЕ САЙТА. Точка, куда смотрит защитник = луч взгляда с
// его поста до стены (≤500px). Двое смотрят в одну точку, или туда уже вышел
// тиммейт — второй берёт угол, который про с этого сайта держат, а сейчас не
// держит никто; не нашёл — встаёт глубже, под размен вышедшего вперёд.
var REBAL = {every:48, minHold:5, R:560, same:190, fwdR:230, freeR:260};
function rebalTarget(px, py, a){ var c = rayClipWalls(px, py, px + Math.cos(a)*500, py + Math.sin(a)*500); return {x:c.x, y:c.y}; }
function rebalLookOf(o){
  var px = o.post.x, py = o.post.y, a;
  if(o.post.pro && o._proM && o._proM.k === o.post.pro.k && o.post.pro.m[o._proM.i]) a = o.post.pro.m[o._proM.i][0];
  else if(o.post.look) a = Math.atan2(o.post.look.y-py, o.post.look.x-px);
  else a = o.facing || 0;
  return rebalTarget(px, py, a);
}
function rebalSpot(b, k, taken, avoidPts, opt){
  var L = PRO_SPOTS["CT|pre"] || [], best = null, bs = -1e9;
  for(var i=0;i<L.length;i++){ var s = L[i];
    if(Math.hypot(s[0]-SITES[k].x, s[1]-SITES[k].y) > REBAL.R || insideSolidWall(s[0], s[1])) continue;
    if(bots.some(function(o){ return o !== b && o.alive && o.team === "CT" && Math.hypot(o.x-s[0], o.y-s[1]) < 70; })) continue;
    var modes = [[s[3], s[4]]]; if(s.length > 5) modes.push([s[5], s[6]]);
    modes.forEach(function(m){
      var t = rebalTarget(s[0], s[1], m[0]);
      if(Math.hypot(t.x-s[0], t.y-s[1]) < 90) return;
      if(opt && opt.see){ if(!hasLOS(s[0], s[1], opt.see.x, opt.see.y) || Math.hypot(s[0]-SITES[k].x, s[1]-SITES[k].y) > Math.hypot(opt.see.x-SITES[k].x, opt.see.y-SITES[k].y) - 60) return;
        if(_angOff(m[0], Math.atan2(opt.see.y-s[1], opt.see.x-s[0])) > 0.7) return; }
      else if(taken.some(function(q){ return Math.hypot(q.x-t.x, q.y-t.y) < REBAL.freeR; }) || avoidPts.some(function(q){ return Math.hypot(q.x-t.x, q.y-t.y) < REBAL.freeR; })) return;
      // угол в сторону своего спавна/тыла — не угол
      if(Math.hypot(t.x-CT_SPAWN.x, t.y-CT_SPAWN.y) < Math.hypot(s[0]-CT_SPAWN.x, s[1]-CT_SPAWN.y) - 120) return;
      var sc = Math.log(1 + s[2]) + 1.2*m[1] - Math.hypot(s[0]-b.x, s[1]-b.y)/400;
      if(sc > bs){ bs = sc; best = {pt:{x:s[0], y:s[1]}, look:{x:s[0] + Math.cos(m[0])*300, y:s[1] + Math.sin(m[0])*300}, t:t}; }
    });
  }
  return best;
}
function siteRebalanceTick(){
  if(!BAL.siteRebal || tick % REBAL.every || roundState !== "live" || (bomb && bomb.state === "planted")) return;
  if(tick - roundStartTick < 12*TICK_HZ) return;
  var cts = bots.filter(function(o){ return o.alive && o.team === "CT"; });
  cts.forEach(function(o){ var R = o._rebal; if(!R) return;
    if(R.round !== roundNum || o._sawEnemy){ o._rebal = null; return; }
    if(tick - R.t < REBAL.minHold*TICK_HZ) return;
    var q = bots.filter(function(x){ return x.id === R.by; })[0];
    var still = q && q.alive && (R.fwd ? Math.hypot(q.x-R.fx, q.y-R.fy) < 220 : true);
    if(!still){ o._rebal = null; voiceLog("CT", "rebalOff"+o.id+tick, o.id, "возвращаюсь на свой угол"); }
  });
  ["A","B"].forEach(function(k){
    var site = SITES[k];
    var defs = cts.filter(function(o){ return o.atPost && o.post && !o._sawEnemy && !o.nadeTask && Math.hypot(o.post.x-site.x, o.post.y-site.y) < REBAL.R && /^(anchor|rotator|set:|stack|cts:|rebal|rotateHold|sitehold)/.test(o.post.tag); });
    if(!defs.length) return;
    var T = defs.map(function(o){ return rebalLookOf(o); });
    defs.forEach(function(o, i){
      if(o._rebal) return;
      var t = T[i], dO = Math.hypot(o.post.x-site.x, o.post.y-site.y), by = null, fwd = false;
      // тиммейт вышел туда, куда я смотрю (дальше от сайта, чем я)
      cts.forEach(function(q){ if(q === o || by) return;
        if(!(q.curSpeed > 40*SPD_K) && Math.hypot(q.x-t.x, q.y-t.y) < REBAL.fwdR && Math.hypot(q.x-site.x, q.y-site.y) > dO + 80 && hasLOS(o.post.x, o.post.y, q.x, q.y)){ by = q; fwd = true; } });
      // другой защитник смотрит в ту же точку, и он к ней ближе
      // (v340, владелец: «NiKo: m0NESY держит тот же угол — беру угол» и «m0NESY: NiKo держит тот же угол…» одновременно) уступает
      // один: кто дальше от угла (поровну — второй по порядку); тому, кто сам уже уходит на другой угол (_rebal), не уступают
      if(!by) defs.forEach(function(q, j){ if(q === o || by || q._rebal) return;
        var dq = Math.hypot(q.post.x-T[j].x, q.post.y-T[j].y), dMe = Math.hypot(o.post.x-t.x, o.post.y-t.y);
        if(Math.hypot(T[j].x-t.x, T[j].y-t.y) < REBAL.same && (dq < dMe - 1 || (Math.abs(dq - dMe) <= 1 && j < i))) by = q; });
      if(!by) return;
      var taken = T.filter(function(_, j){ return j !== i; }), avoid = cts.filter(function(q){ return q !== o; }).map(function(q){ return {x:q.x, y:q.y}; });
      var sp = rebalSpot(o, k, taken, fwd ? avoid.concat([t]) : [t]), why;
      if(sp) why = (fwd ? by.id+" вышел вперёд" : by.id+" держит тот же угол")+" — беру угол "+calloutName(sp.t.x, sp.t.y);
      else if(fwd){ sp = rebalSpot(o, k, [], [], {see:{x:by.x, y:by.y}}); if(sp){ sp.look = {x:by.x, y:by.y}; why = by.id+" впереди — встаю под размен"; } }
      if(!sp) return;
      o._rebal = {round:roundNum, t:tick, by:by.id, fwd:fwd, fx:by.x, fy:by.y};
      setPost(o, sp.pt, sp.look, true, "rebal"+k);
      voiceLog("CT", "rebal"+o.id+tick, o.id, why);
    });
  });
}
function infoFallbackTick(){
  siteRebalanceTick();
  tFallbackTick();
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
    // (v291, И31, владелец 14.10: раунд 1, тик 2858 — игрок 6 на Mid «минус рядом» от смерти на Back Site: 926 px по прямой,
    // 1150 пешком, другой конец карты) смерть рядом — по длине пути, а не по прямой
    var died = teamIntel.CT.sig.some(function(sg){ return sg.type === "died" && tick - sg.tick <= FB.window*TICK_HZ && Math.hypot(sg.x-b.x, sg.y-b.y) < FB.deathR &&
      polyLen(pathPts(b.x, b.y, sg.x, sg.y)) < FB.deathR; });
    var hurt = b._hurtT && tick - b._hurtT < 2*TICK_HZ && b.hp < FB.hurtHp;
    var why = ids >= FB.enemies ? "их "+ids+" — откатываюсь" : died ? "минус рядом — откатываюсь" : hurt ? "ранен — откатываюсь" : null;
    if(!why) return;
    var th = ids ? {x:cx/ids, y:cy/ids} : (b.lastIntel ? {x:b.lastIntel.x, y:b.lastIntel.y} : null);
    // назад = от угрозы, дальше от вражеского спавна
    var dx = th ? b.x-th.x : 0, dy = th ? b.y-th.y : 0, dl = Math.hypot(dx, dy);
    var center = dl > 1 ? walk({x:b.x+dx/dl*FB.back, y:b.y+dy/dl*FB.back}) : null;
    var cand = [];
    if(center) cand = pickSpots("fb"+tick+b.id, center, 4, {rMax:FB.rMax, minGap:40, hideFrom: th ? [th] : []});
    // (v291, И31) откат — к своим: точка ближе к живому тиммейту, чем я сейчас, и не в зоне, где команда ждёт врага (раньше «назад
    // от одного известного врага» увело игрока 6 в T Upper — к двум живым T, подальше от своих). Нет такой — к ближайшему своему
    var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === "CT"; });
    var mateD = function(q){ var m = Infinity; mates.forEach(function(o){ m = Math.min(m, Math.hypot(o.x-q.x, o.y-q.y)); }); return m; };
    var myMate = mateD(b);
    var sp = cand.filter(function(q){ var zq = bzOf(q.x, q.y); return zq >= 0 && ED[zq] >= ED[zb] + FB.gainED && (!th || !hasLOS(q.x, q.y, th.x, th.y)) &&
      mateD(q) < myMate && beliefCount("CT", [zq]) < 0.5; })[0];
    if(!sp && mates.length){ var nm = mates.slice().sort(function(a, c){ return Math.hypot(a.x-b.x, a.y-b.y) - Math.hypot(c.x-b.x, c.y-b.y); })[0];
      var nz = bzOf(nm.x, nm.y); if(!(nz >= 0 && beliefCount("CT", [nz]) >= 0.5)) sp = walk({x: nm.x, y: nm.y}); }
    if(!sp) return;
    b._fbRound = roundNum;
    b._reposUntil = 0; b._egLock = 0; b._probeLock = 0;
    setPost(b, sp, th || null, true, "repos:fallback");
    b._reposUntil = tick + FB.lock*TICK_HZ;
    voiceLog("CT", "fb"+b.id+roundNum, b.id, why+" ("+calloutName(sp.x, sp.y).replace(/^на /,"")+")");
  });
}

var PRO_PRIOR = MAP.pro.prior;
var PRO_LOOK = MAP.pro.look;
var PRO_LINEUPS_RAW = MAP.lineups.pro;
