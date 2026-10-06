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
      if(D[k]) assignNade(b, "he", {x:s.x, y:s.y}, "HE в смок — разогнать", {now:true});
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
  });
}
