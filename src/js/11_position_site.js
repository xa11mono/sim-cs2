// =====================================================================
// (v150) РЕАКЦИЯ НА СМОКИ ПО ДЕМКАМ. По 12 про-матчам (1 884 смока):
//  • в 20% смоков противник стреляет сквозь дым, ~3–4 очереди на такой смок;
//  • 13% смоков разгоняют HE;
//  • стоящий, которому смок закрыл обзор, за 4с сдвигается в 28% случаев
//    (без смока — в 14%).
// Раньше боты стреляли в смок только если ТОЧНО там враг (подсматривали
// настоящие позиции) и почти никогда не разгоняли HE. Теперь решение — по тому,
// что бот знает: слышал/видел за дымом, карта вероятностей, смок на входе.
// =====================================================================
var SMK = {
  pMem: 0.8,     // шанс начать прострел, если за дымом только что видел/слышал врага
  pBelief: 0.45, // …если по карте вероятностей там вероятно враг
  pEntry: 0.22,  // …если инфы нет, но смок на входе на сайт (за ним почти всегда кто-то)
  burstsMin: 2, burstsMax: 5,   // очередей на прострел; длина очереди и пауза — режим огня (С1)
  heP: 0.4,      // шанс разогнать HE смок на своём объекте, если за ним вероятен враг
  shiftP: 0.25   // шанс сменить позицию, когда смок закрыл угол, который держал
};
function smkKey(s){ return s.born+"_"+Math.round(s.x); }
function smkActive(s){ return tick - s.born > 40 && s.until - tick > 64; }
function smkEvidence(b, s){
  var R = smokeRadiusNow(s), mem = null;
  var cand = [];
  if(b.lastIntel && tick - b.lastIntel.tick < 3*TICK_HZ) cand.push(b.lastIntel);
  if(b.heardSound && b.heardSound.team && b.heardSound.team !== b.team && tick - b.heardSound.tick < 3*TICK_HZ) cand.push(b.heardSound);
  picRecent(b.team, 3*TICK_HZ).forEach(function(q){ cand.push(q); });
  cand.forEach(function(q){ if(!mem && Math.hypot(q.x-b.x, q.y-b.y) < 800 && segHitsCircle(b.x, b.y, q.x, q.y, s.x, s.y, R)) mem = q; });
  if(mem) return {kind:"mem", pt:{x:mem.x, y:mem.y}};
  var d = Math.hypot(s.x-b.x, s.y-b.y), ux = (s.x-b.x)/d, uy = (s.y-b.y)/d;
  var beyond = {x:s.x + ux*R*1.3, y:s.y + uy*R*1.3};
  if(enemyBeyondSmoke(b, s, R)) return {kind:"belief", pt:beyond};
  var entry = ["A","B"].some(function(k){ var g = GEO[k]; return Math.hypot(s.x-g.tEntry.x, s.y-g.tEntry.y) < 220 || Math.hypot(s.x-g.ctEntry.x, s.y-g.ctEntry.y) < 220; });
  if(entry) return {kind:"entry", pt:beyond};
  return null;
}
function blindBullet(b, pt){
  var w = b.weapon; if(!w || b.ammo <= 0) return false;
  b.ammo--; b.lastShotTick = tick; b.nextShotTick = tick + (w.fireIntervalTicks||6);
  var a = Math.atan2(pt.y-b.y, pt.x-b.x) + (hashRand(tick*31 + b.id.charCodeAt(1))-0.5)*0.08;
  var cl = rayClipWalls(b.x, b.y, b.x + Math.cos(a)*(w.range||900), b.y + Math.sin(a)*(w.range||900));
  tracers.push({wc:tracerClass(b.weapon), x1:b.x, y1:b.y, x2:cl.x, y2:cl.y, team:b.team, born:nowTs, hit:false, miss:true}); if(tracers.length > 60) tracers.shift();
  makeSound(b, b.x, b.y, "shots", {mul: w.silenced ? 0.55 : 1});
  return true;
}
function smokeSpamTick(){
  if(!smokes.length){ bots.forEach(function(b){ b._spam = null; }); return; }
  bots.forEach(function(b){
    if(!b.alive) return;
    var P = b._spam;
    if(P && (tick > P.until || b._sawEnemy || b.planting || b.defusing || b._reloading || b.ammo <= 0 || tick < b.blindUntil)){ b._spam = null; P = null; }
    if(P){
      if(tick < P.nextBurst) return;
      // стреляем: если на линии за дымом реально кто-то есть — настоящий выстрел
      // (с пониженной точностью), иначе — очередь "по памяти" в дым
      if(tick < (b.nextShotTick||0)) return;
      var aim = Math.atan2(P.pt.y-b.y, P.pt.x-b.x), foe = null;
      if(b.facing !== undefined && _angOff(aim, b.facing) > 0.2) return;   // сначала довести прицел
      bots.forEach(function(e){ if(foe || !e.alive || e.team === b.team) return; var d = Math.hypot(e.x-b.x, e.y-b.y); if(d > 900) return;
        if(_angOff(Math.atan2(e.y-b.y, e.x-b.x), aim) > 0.12 || !hasLOS(b.x, b.y, e.x, e.y) || !smokeBlocks(b.x, b.y, e.x, e.y)) return; foe = e; });
      var fired = false;
      if(foe){ var a0 = b.ammo; b._smokeShot = true; tryShoot(b, foe, Math.hypot(foe.x-b.x, foe.y-b.y)); b._smokeShot = false; fired = b.ammo !== a0; }
      else if(fireReady(b, b.weapon, Math.hypot(P.pt.x-b.x, P.pt.y-b.y))){ fired = blindBullet(b, P.pt); if(fired){ b.burstCount++; fireShot(b, b.weapon); } }
      if(fired && !(b._fire && b._fire.left > 0)){ P.bursts--; if(P.bursts <= 0) b._spam = null; }
      return;
    }
    if(b._sawEnemy || b.planting || b.defusing || b._reloading || tick < b.blindUntil || b.ammo <= 0 || !b.weapon) return;
    if(b.curSpeed > 40*SPD_K) return;   // стоит (на посту или просто остановился)
    var D = b._spamDone || (b._spamDone = {});
    smokes.forEach(function(s){
      if(b._spam || s.team === b.team || !s.team || !smkActive(s)) return;
      var k = smkKey(s); if(D[k] !== undefined) return;
      var d = Math.hypot(s.x-b.x, s.y-b.y); if(d < 120 || d > 900 || !hasLOS(b.x, b.y, s.x, s.y)) return;
      var ev = smkEvidence(b, s); if(!ev){ return; }
      var p = ev.kind === "mem" ? SMK.pMem : ev.kind === "belief" ? SMK.pBelief : SMK.pEntry;
      var go = hashRand(s.born*17 + b.id.charCodeAt(0)*131 + b.id.length*7 + Math.round(s.x)) < p;
      D[k] = go;
      if(!go) return;
      var nb = SMK.burstsMin + Math.floor(hashRand(s.born*29 + b.id.charCodeAt(1))*(SMK.burstsMax - SMK.burstsMin + 1));
      b._spam = {pt:ev.pt, bursts:nb, nextBurst:tick + 10, until:tick + 8*TICK_HZ};
      logEvent(b.id+": простреливает смок "+calloutName(s.x, s.y)+" ("+({mem:"только что был враг", belief:"там вероятно враг", entry:"смок на входе"})[ev.kind]+")");
    });
  });
}
// HE в смок противника у своего объекта (CT — на своём сайте/входе; T — у бомбы/на подходе)
function smokeHeTick(){
  if(!smokes.length || tick % 16) return;
  smokes.forEach(function(s){
    if(!s.team || !smkActive(s)) return;
    var k = smkKey(s);
    bots.forEach(function(b){
      if(!b.alive || b.team === s.team || !b.nades || !(b.nades.he > 0) || b.nadeTask || b._sawEnemy || b.planting || b.defusing) return;
      var D = b._heDone || (b._heDone = {}); if(D[k] !== undefined) return;
      var d = Math.hypot(s.x-b.x, s.y-b.y); if(d < 200 || d > NADE_THROW_RANGE) return;
      var near = ["A","B"].some(function(q){ return Math.hypot(s.x-SITES[q].x, s.y-SITES[q].y) < 700; });
      if(!near){ D[k] = false; return; }
      var ev = smkEvidence(b, s); if(!ev || ev.kind === "entry"){ return; }
      D[k] = hashRand(s.born*41 + b.id.charCodeAt(0)*17 + b.id.length) < SMK.heP;
      if(D[k] && assignNade(b, "he", {x:s.x, y:s.y}, "HE в смок — разогнать", {now:true})) voiceLog(b.team, "hesmk"+k, b.id, "кидаю HE в смок "+calloutName(s.x, s.y));
    });
  });
}
// смок закрыл угол, который держал: часть игроков меняет позицию (отходит глубже)
function smokeShiftOnDetonate(s){
  bots.forEach(function(b){
    if(!b.alive || b.team === s.team || b._sawEnemy || !(b.atPost && b.post && b.post.hold)) return;
    var d = Math.hypot(s.x-b.x, s.y-b.y); if(d < 150 || d > 700 || !hasLOS(b.x, b.y, s.x, s.y)) return;
    var lk = b.lookTarget || b.post.look; if(!lk) return;
    if(!segHitsCircle(b.x, b.y, lk.x, lk.y, s.x, s.y, NADE.smoke.radius)) return;   // смок не на его линии
    if(hashRand(s.born*53 + b.id.charCodeAt(0)*29 + b.id.length) >= SMK.shiftP) return;
    shiftHold(b, {x:s.x, y:s.y}, null, "смок закрыл угол");
  });
}

var FB = { enemies:2, window:3, deathR:900, hurtHp:70, back:320, rMax:220, gainED:150, lock:10 };
function tFallbackTick(){
  if(tick % 8 || roundState !== "live" || (bomb && bomb.state === "planted")) return;
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
    b._fbRound = roundNum; 
    setPost(b, sp, th || null, true, "repos:fallback");
    holdTask(b, "repos", tick + FB.lock*TICK_HZ);
    voiceLog("T", "tfb"+b.id+roundNum, b.id, why+" ("+calloutName(sp.x, sp.y).replace(/^на /,"")+")");
  });
}
// (v165) ПЕРЕРАСПРЕДЕЛЕНИЕ САЙТА. Точка, куда смотрит защитник = луч взгляда с
// его поста до стены (≤500px). Двое смотрят в одну точку, или туда уже вышел
// тиммейт — второй берёт вход на сайт, который сейчас не держит никто (точка —
// по навмешу: видит вход, меньше открыта, ближе); не нашёл — встаёт глубже,
// под размен вышедшего вперёд.
var REBAL = {every:48, minHold:5, R:560, same:190, fwdR:230, freeR:260};
function rebalTarget(px, py, a){ var c = rayClipWalls(px, py, px + Math.cos(a)*500, py + Math.sin(a)*500); return {x:c.x, y:c.y}; }
function rebalLookOf(o){
  var px = o.post.x, py = o.post.y, a;
  if(o.post.look) a = Math.atan2(o.post.look.y-py, o.post.look.x-px);
  else a = o.facing || 0;
  return rebalTarget(px, py, a);
}
function rebalSpot(b, k, taken, avoidPts, opt){
  var L = holdCands(SITES[k], 0, REBAL.R), ents = entryPts(k), best = null, bs = -1e9;
  for(var i=0;i<L.length;i++){ var s = L[i];
    if(bots.some(function(o){ return o !== b && o.alive && o.team === "CT" && Math.hypot(o.x-s.x, o.y-s.y) < 70; })) continue;
    var ex = spotExposure("CT", s.x, s.y), base = -Math.max(0, ex - 1)*0.5 - Math.hypot(s.x-b.x, s.y-b.y)/400;
    var dirs = opt && opt.see ? [opt.see] : ents;
    dirs.forEach(function(e){
      if(!hasLOS(s.x, s.y, e.x, e.y)) return;
      var a = Math.atan2(e.y-s.y, e.x-s.x), t = rebalTarget(s.x, s.y, a);
      if(Math.hypot(t.x-s.x, t.y-s.y) < 90) return;
      if(opt && opt.see){ if(Math.hypot(s.x-SITES[k].x, s.y-SITES[k].y) > Math.hypot(e.x-SITES[k].x, e.y-SITES[k].y) - 60) return; }
      else if(taken.some(function(q){ return Math.hypot(q.x-t.x, q.y-t.y) < REBAL.freeR; }) || avoidPts.some(function(q){ return Math.hypot(q.x-t.x, q.y-t.y) < REBAL.freeR; })) return;
      // угол в сторону своего спавна/тыла — не угол
      if(Math.hypot(t.x-CT_SPAWN.x, t.y-CT_SPAWN.y) < Math.hypot(s.x-CT_SPAWN.x, s.y-CT_SPAWN.y) - 120) return;
      if(base > bs){ bs = base; best = {pt:{x:s.x, y:s.y}, look:{x:s.x + Math.cos(a)*300, y:s.y + Math.sin(a)*300}, t:t}; }
    });
  }
  return best;
}
function siteRebalanceTick(){
  if(tick % REBAL.every || roundState !== "live" || (bomb && bomb.state === "planted")) return;
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
      if(!by) defs.forEach(function(q, j){ if(q === o || by) return;
        if(Math.hypot(T[j].x-t.x, T[j].y-t.y) < REBAL.same && Math.hypot(q.post.x-T[j].x, q.post.y-T[j].y) <= Math.hypot(o.post.x-t.x, o.post.y-t.y)) by = q; });
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
  if(tick % 8 || roundState !== "live" || (bomb && bomb.state === "planted")) return;
  var ED = enemySpawnDist("CT");
  bots.forEach(function(b){
    if(!b.alive || b.team !== "CT" || b._sawEnemy || b.planting || b.defusing) return;
    if(b._fbRound === roundNum) return;
    var CTt = teamTac.CT, call = CTt && CTt.call;
    if(call && CTt.rot && CTt.rot[b.id]) return; // по коллу идёт на ротацию — план команды важнее своего отката
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
    // назад = к своим по плану команды. Есть колл — откат в сторону сайта колла
    // (вход CT: там соберутся защита и ретейк), а не «от угрозы куда попало» —
    // раньше мидер на колл B откатывался на Short, к A. Колла нет — от угрозы.
    var center = null;
    if(call && GEO[call.site]){ var ce = GEO[call.site].ctEntry, cd = Math.hypot(ce.x-b.x, ce.y-b.y);
      center = cd > FB.back ? walk({x:b.x+(ce.x-b.x)/cd*FB.back, y:b.y+(ce.y-b.y)/cd*FB.back}) : walk(ce); }
    else { var dx = th ? b.x-th.x : 0, dy = th ? b.y-th.y : 0, dl = Math.hypot(dx, dy);
      center = dl > 1 ? walk({x:b.x+dx/dl*FB.back, y:b.y+dy/dl*FB.back}) : null; }
    var cand = [];
    if(center) cand = pickSpots("fb"+tick+b.id, center, 4, {rMax:FB.rMax, minGap:40, hideFrom: th ? [th] : []});
    var sp = cand.filter(function(q){ var zq = bzOf(q.x, q.y); return zq >= 0 && ED[zq] >= ED[zb] + FB.gainED && (!th || !hasLOS(q.x, q.y, th.x, th.y)); })[0];
    if(!sp){ var k = call ? call.site : Math.hypot(b.x-SITES.A.x, b.y-SITES.A.y) < Math.hypot(b.x-SITES.B.x, b.y-SITES.B.y) ? "A" : "B"; sp = call ? GEO[k].ctEntry : GEO[k].anchor; }
    b._fbRound = roundNum;
    
    setPost(b, sp, th || null, true, "repos:fallback");
    holdTask(b, "repos", tick + FB.lock*TICK_HZ);
    voiceLog("CT", "fb"+b.id+roundNum, b.id, why+" ("+calloutName(sp.x, sp.y).replace(/^на /,"")+")");
  });
}

