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
  burstsMin: 2, burstsMax: 5, burstGap: 32, bullets: 3,
  heP: 0.4,      // шанс разогнать HE смок на своём объекте, если за ним вероятен враг
  shiftP: 0.25   // шанс сменить позицию, когда смок закрыл угол, который держал
};
function smkKey(s){ return s.born+"_"+Math.round(s.x); }
function smkActive(s){ return tick - s.born > 40 && s.until - tick > 64; }
// (v271) может ли за дымом быть враг — по тому, что знает команда: по таймингу туда ещё никто не успел
// (REACH), или все живые враги (их число видно на табло) недавно замечены далеко от дыма — стрелять незачем.
// Память о враге за дымом (видел/слышал ≤3 с) тайминг не проверяет — он там был.
var SMK_ENTRY_R = 700;   // (v359) проектное число
function smokeEnemyPossible(b, s, pt, seen){
  var zi = bzOf(pt.x, pt.y);
  if(!seen && zi >= 0 && !reachPossible(b.team, zi) && (BZ.nbr[zi]||[]).every(function(j){ return !reachPossible(b.team, j); })) return false;
  var foe = b.team === "CT" ? "T" : "CT", BL = beliefLast[b.team] || {}, R = smokeRadiusNow(s), alive = 0, away = 0;
  bots.forEach(function(e){
    if(e.team !== foe || !e.alive) return; alive++;
    var L = BL[e.id]; if(L && tick - L.tick < 4*TICK_HZ && Math.hypot(L.x-s.x, L.y-s.y) > R + 400) away++;
  });
  return alive > away;
}
function smkEvidence(b, s){
  var ev = smkEvidence0(b, s);
  return ev && smokeEnemyPossible(b, s, ev.pt, ev.kind === "mem") ? ev : null;
}
function smkEvidence0(b, s){
  var R = smokeRadiusNow(s), mem = null;
  var cand = [];
  if(b.lastIntel && tick - b.lastIntel.tick < 3*TICK_HZ) cand.push(b.lastIntel);
  if(b.heardSound && b.heardSound.team && b.heardSound.team !== b.team && tick - b.heardSound.tick < 3*TICK_HZ) cand.push(b.heardSound);
  cand.forEach(function(q){ if(!mem && Math.hypot(q.x-b.x, q.y-b.y) < 800 && segHitsCircle(b.x, b.y, q.x, q.y, s.x, s.y, R)) mem = q; });
  if(mem) return {kind:"mem", pt:{x:mem.x, y:mem.y}};
  var d = Math.hypot(s.x-b.x, s.y-b.y), ux = (s.x-b.x)/d, uy = (s.y-b.y)/d;
  var beyond = {x:s.x + ux*R*1.3, y:s.y + uy*R*1.3};
  if(insideSolidWall(beyond.x, beyond.y)) return null;   // (v321, М18) за дымом стена — там никого
  if(enemyBeyondSmoke(b, s, R)) return {kind:"belief", pt:beyond};
  // (v321, М18) вход на сайт — по данным карты (pos.entries: где T заходят по демкам), а не точка кратчайшего пути
  // (на Mirage вход на B по нему — E Box, и простреливали дым там, где врага быть не может)
  var entry = ["A","B"].some(function(k){ var g = GEO[k];
    var tE = (POS[k] && POS[k].entries && POS[k].entries.length) ? entryPts(k) : [g.tEntry];
    return tE.some(function(p){ return Math.hypot(s.x-p.x, s.y-p.y) < 220; }) || Math.hypot(s.x-g.ctEntry.x, s.y-g.ctEntry.y) < 220; });
  // (v359, владелец: «боты до сих пор стреляют в смоки, за которыми нет врагов») смок у входа — повод стрелять, только если команда
  // сейчас ждёт врага у этого входа: свежий звук / колл / видели в SMK_ENTRY_R ед. от смока за 6 с или колл «выход» на этот сайт.
  // Раньше смок у входа простреливали всегда, даже когда все враги были на другой стороне карты
  if(entry){
    var sigE = (teamIntel[b.team].sig || []).some(function(g){ return tick - g.tick <= 6*TICK_HZ && (g.type === "spotted" || g.type === "sound") && Math.hypot(g.x-s.x, g.y-s.y) < SMK_ENTRY_R; });
    var cl = b.team === "CT" && teamTac.CT && teamTac.CT.call, near = cl && SITES[cl.site] && Math.hypot(SITES[cl.site].x-s.x, SITES[cl.site].y-s.y) < 900 && cl.count >= 1.5;
    if(sigE || near) return {kind:"entry", pt:beyond};
  }
  return null;
}
function blindBullet(b, pt){
  var w = b.weapon; if(!w || b.ammo <= 0) return false;
  b.ammo--; b.lastShotTick = tick; b.nextShotTick = tick + (w.fireIntervalTicks||6);
  var a = Math.atan2(pt.y-b.y, pt.x-b.x) + (hashRand(tick*31 + b.id.charCodeAt(1))-0.5)*0.08;
  var cl = rayClipWalls(b.x, b.y, b.x + Math.cos(a)*(w.range||900), b.y + Math.sin(a)*(w.range||900));
  smokeBulletHole(b.x, b.y, cl.x, cl.y);
  tracers.push({wc:tracerClass(b.weapon), x1:b.x, y1:b.y, x2:cl.x, y2:cl.y, team:b.team, born:nowTs, hit:false, miss:true}); if(tracers.length > 60) tracers.shift(); if(SND && SND.on) sndShot(b.weapon, b.x, b.y);
  bots.forEach(function(o){ if(!o.alive || o.team === b.team) return;
    var hr = (hasLOS(o.x, o.y, b.x, b.y) ? GUN_HEAR_OPEN : GUN_HEAR_WALL) * (w.silenced ? 0.55 : 1);
    if(Math.hypot(o.x-b.x, o.y-b.y) < hr) o.heardSound = hearReal(o, {x:b.x, y:b.y, tick:tick, team:b.team, src:b.id, kind:"shots"}); });
  return true;
}
function smokeSpamTick(){
  if(!smokes.length){ bots.forEach(function(b){ b._spam = null; }); return; }
  bots.forEach(function(b){
    if(!b.alive) return;
    var P = b._spam;
    if(P && (tick > P.until || b._sawEnemy || b.planting || b.defusing || b._reloading || b.ammo <= 0 || tick < b.blindUntil ||
             smokes.indexOf(P.s) < 0 || (tick % 16 === 0 && !smokeEnemyPossible(b, P.s, P.pt, P.seen)))){ b._spam = null; P = null; }
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
      if(foe){ var a0 = b.ammo; b._smokeShot = true; tryShoot(b, foe, Math.hypot(foe.x-b.x, foe.y-b.y)); b._smokeShot = false; fired = b.ammo !== a0; if(fired) smokeBulletHole(b.x, b.y, foe.x, foe.y); }
      else fired = blindBullet(b, P.pt);
      if(fired && ++P.shot >= SMK.bullets){ P.shot = 0; P.bursts--; P.nextBurst = tick + SMK.burstGap; if(P.bursts <= 0) b._spam = null; }
      return;
    }
    if(b._sawEnemy || b.planting || b.defusing || b._reloading || tick < b.blindUntil || b.ammo <= 0 || !b.weapon) return;
    // (v272, просьба владельца 13.10) попали сквозь дым — откуда, бот знает (урон + звук выстрела, как живой игрок):
    // отвечает очередью в ту точку после своей реакции, даже на ходу. У про 8,9 % фрагов — сквозь смок (88 демок)
    var hs = b.heardSound;
    var hsS = hs && hs.kind === "hit" && hs.team !== b.team && tick - hs.tick < TICK_HZ && Math.hypot(hs.x-b.x, hs.y-b.y) < 900 && hasLOS(b.x, b.y, hs.x, hs.y) ?
      smokes.filter(function(s){ return segHitsCircle(b.x, b.y, hs.x, hs.y, s.x, s.y, smokeRadiusNow(s)); })[0] : null;
    if(hsS){
      b._spam = {pt:{x:hs.x, y:hs.y}, s:hsS, seen:true, bursts:SMK.burstsMin, shot:0, nextBurst:hs.tick + b.reactionTicks, until:tick + 4*TICK_HZ};
      logEvent(b.id+": по нему стреляют сквозь смок — отвечает");
      return;
    }
    // (v340, владелец: «во время планта в смоку они не пытаются прострелить, так же и при дефузе») слышит плант (CT) или дефуз
    // (T), а между ним и бомбой дым — очереди в точку звука, пока звук идёт, и на ходу. Раньше решение «стрелять в этот дым»
    // принималось один раз, когда дым встал, и звук планта/дефуза его уже не менял
    var bp = null;
    if(hs && (hs.kind === "plant" || hs.kind === "defuse") && hs.team !== b.team && tick - hs.tick < TICK_HZ) bp = {x:hs.x, y:hs.y};
    else if(b.team === "T" && bomb && bomb.state === "planted" && tick - Math.max(b._defuseHeard||-9999, b._defuseCont||-9999) < TICK_HZ) bp = {x:bomb.x, y:bomb.y};
    if(bp && Math.hypot(bp.x-b.x, bp.y-b.y) < 900 && hasLOS(b.x, b.y, bp.x, bp.y)){
      var bS = smokes.filter(function(s){ return smkActive(s) && segHitsCircle(b.x, b.y, bp.x, bp.y, s.x, s.y, smokeRadiusNow(s)); })[0];
      if(bS){ b._spam = {pt:bp, s:bS, seen:true, bursts:SMK.burstsMax, shot:0, nextBurst:tick + b.reactionTicks, until:tick + 4*TICK_HZ};
        logEvent(b.id+": слышит "+(b.team === "CT" ? "плант" : "дефуз")+" за смоком — простреливает"); return; }
    }
    if(b.curSpeed > 40*SPD_K) return;   // стоит (на посту или просто остановился)
    // (v353, владелец: «решение стрелять в смок в другой стороне перебивает существующую перестрелку») в перестрелке (цикл
    // «на линии → за укрытие» идёт, или враг виден был ≤ 3 с назад) — в посторонний смок не стреляет
    if(b._fc || tick - (b._lastSawT || -1e9) < 3*TICK_HZ || tick - (b._shotAtT || -1e9) < 3*TICK_HZ) return;
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
      b._spam = {pt:ev.pt, s:s, seen:ev.kind === "mem", bursts:nb, shot:0, nextBurst:tick + 10, until:tick + 8*TICK_HZ};
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
      if(D[k] && assignNade(b, "he", {x:s.x, y:s.y}, "HE в смок — разогнать", {now:true, lvl:NADE_LEVEL.react})) voiceLog(b.team, "hesmk"+k, b.id, "кидаю HE в смок "+calloutName(s.x, s.y));
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

