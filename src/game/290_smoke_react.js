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
    var sigE = (teamIntel[b.team].sig || []).some(function(g){ return tick - g.tick <= 6*TICK_HZ && (g.type === "spotted" || g.type === "sound") && !sigFoeDead(g) && Math.hypot(g.x-s.x, g.y-s.y) < SMK_ENTRY_R; });
    var cl = b.team === "CT" && teamTac.CT && teamTac.CT.call, near = cl && SITES[cl.site] && Math.hypot(SITES[cl.site].x-s.x, SITES[cl.site].y-s.y) < 900 && cl.count >= 1.5;
    if(sigE || near) return {kind:"entry", pt:beyond};
  }
  return null;
}
var BLIND_SPREAD = 0.35;   // (v554) проектное число: рад — разброс очереди ослеплённого (не видит прицела), сквозь дым — 0.08
function blindBullet(b, pt){
  var w = b.weapon; if(!w || b.ammo <= 0) return false;
  b.ammo--; b.lastShotTick = tick; b.nextShotTick = tick + (w.fireIntervalTicks||6);
  var a = Math.atan2(pt.y-b.y, pt.x-b.x) + (hashRand(tick*31 + b.id.charCodeAt(1))-0.5)*(pt.spread || 0.08);
  var cl = bulletClip3(b, b.x + Math.cos(a)*(w.range||900), b.y + Math.sin(a)*(w.range||900), {x:pt.x, y:pt.y, z:pt.z});   // (v519) по 3D-геометрии
  var ez0 = visFloorAt(b.x, b.y, b.z) + VIS_EYE.stand;   // (v548) дыра — линия пули в 3D: от глаз к точке, куда целился (на уровне груди)
  smokeBulletHole(b.x, b.y, pt.x, pt.y, ez0, (pt.z != null ? visFloorAt(pt.x, pt.y, pt.z) : visFloorAt(b.x, b.y, b.z)) + VIS_BODY.stand[0]);
  var sv = bulletLineHit(b, cl.x, cl.y, null, tick*37 + b.id.charCodeAt(1)*11, b._spam && b._spam.blind ? "вслепую" : "сквозь дым");   // (Г1) пуля сквозь дым попадает в того, кто на линии
  if(sv) cl = {x:sv.x, y:sv.y};
  tracers.push({wc:tracerClass(b.weapon), wk:b.weapon && b.weapon.key, sil:!!(b.weapon && b.weapon.silenced), x1:b.x, y1:b.y, x2:cl.x, y2:cl.y, team:b.team, born:nowTs, hit:!!sv, miss:!sv}); if(tracers.length > 60) tracers.shift(); if(SND && SND.on) sndShot(b.weapon, b.x, b.y);
  bots.forEach(function(o){ if(!o.alive || o.team === b.team) return;
    var hr = (hasLOS(o.x, o.y, b.x, b.y, o.z, b.z) ? GUN_HEAR_OPEN : GUN_HEAR_WALL) * (w.silenced ? 0.55 : 1);
    if(Math.hypot(o.x-b.x, o.y-b.y) < hr) o.heardSound = hearReal(o, {x:b.x, y:b.y, tick:tick, team:b.team, src:b.id, kind:"shots"}); });
  return true;
}
function smokeSpamTick(){
  if(!smokes.length && !bots.some(function(b){ return (b._spam && b._spam.blind) || (b._blind && b._blind.fire && tick < b.blindUntil); })){ bots.forEach(function(b){ b._spam = null; }); return; }
  bots.forEach(function(b){
    if(!b.alive) return;
    var P = b._spam;
    // (v554) P.blind — очередь вслепую после флешки (onBlind, 460): дыма нет, слепота её не отменяет
    // (v556) нож в руках (идёт резать дефузящего, knifeDefuseTick 450) — очередь кончается здесь, у хозяина, а не там
    if(P && (tick > P.until || b._sawEnemy || b.planting || b.defusing || b._reloading || b.ammo <= 0 || b._knife || (tick < b.blindUntil) !== !!P.blind ||
             (!P.blind && (smokes.indexOf(P.s) < 0 || (tick % 16 === 0 && !smokeEnemyPossible(b, P.s, P.pt, P.seen)))))){ b._spam = null; P = null; }
    // (v554 → v556 сюда) ослеплённый с причиной (onBlind, 460: видел врага ≤ 1 с до вспышки, он рядом) — очередь вслепую в ту точку, один раз
    var BF = b._blind && b._blind.fire;
    if(!P && BF && tick < b.blindUntil && !b._sawEnemy && b.ammo > 0 && !b._reloading && !b._knife){ b._blind.fire = null;
      P = b._spam = {pt:BF, s:null, blind:true, seen:true, bursts:SMK.burstsMin, shot:0, nextBurst:tick + (b.reactionTicks||12), until:b.blindUntil}; }
    if(P){
      if(tick < P.nextBurst) return;
      // стреляем: если на линии за дымом реально кто-то есть — настоящий выстрел
      // (с пониженной точностью), иначе — очередь "по памяти" в дым
      if(tick < (b.nextShotTick||0)) return;
      // (v528, владелец 10.11: «с AWP смок на ходу не простреливают — остановиться и выстрелить, и то редко; вдали он обычно стоит») снайперка
      // (оружие с прицелом, scopeTicks) в дым стреляет только с точной скорости (≤ 34 % — та же граница, что у разброса, shotSpread): на ходу
      // не стреляет, стоит — стреляет. Ради прострела не останавливается (как часто останавливаться — владелец: редко; числа нет)
      // (v555) звук дефуза / планта — стреляет и с AWP на ходу (дефуз важнее точности; в дыму всё равно не видно)
      if(b.weapon.scopeTicks && b.curSpeed > 0.34*SPEED*weaponSpeedMul(b) && !P.urgent) return;
      var aim = Math.atan2(P.pt.y-b.y, P.pt.x-b.x), foe = null;
      if(b.facing !== undefined && _angOff(aim, b.facing) > 0.2 && !P.blind) return;   // сначала довести прицел (слепой не видит прицела — как есть)
      if(!P.blind) bots.forEach(function(e){ if(foe || !e.alive || e.team === b.team) return; var d = Math.hypot(e.x-b.x, e.y-b.y); if(d > 900) return;
        if(_angOff(Math.atan2(e.y-b.y, e.x-b.x), aim) > 0.12 || !hasLOS(b.x, b.y, e.x, e.y, b.z) || !smokeBlocks(b.x, b.y, e.x, e.y)) return; foe = e; });
      var fired = false;
      if(foe){ var a0 = b.ammo; b._smokeShot = true; tryShoot(b, foe, Math.hypot(foe.x-b.x, foe.y-b.y)); b._smokeShot = false; fired = b.ammo !== a0; if(fired) smokeBulletHole(b.x, b.y, foe.x, foe.y, visFloorAt(b.x, b.y, b.z) + VIS_EYE.stand, visFloorAt(foe.x, foe.y, foe.z) + VIS_BODY.stand[0]); }
      else fired = blindBullet(b, P.blind ? {x:P.pt.x, y:P.pt.y, z:P.pt.z, spread:BLIND_SPREAD} : P.pt);
      if(fired && ++P.shot >= SMK.bullets){ P.shot = 0; P.bursts--; P.nextBurst = tick + (P.urgent ? 0 : SMK.burstGap); if(P.bursts <= 0) b._spam = null; }   // (v555) на дефуз — без пауз
      return;
    }
    if(b._sawEnemy || b.planting || b.defusing || b._reloading || tick < b.blindUntil || b.ammo <= 0 || !b.weapon) return;
    // (v272, просьба владельца 13.10) попали сквозь дым — откуда, бот знает (урон + звук выстрела, как живой игрок):
    // отвечает очередью в ту точку после своей реакции, даже на ходу. У про 8,9 % фрагов — сквозь смок (88 демок)
    var hs = b.heardSound;
    var hsS = hs && hs.kind === "hit" && hs.team !== b.team && tick - hs.tick < TICK_HZ && Math.hypot(hs.x-b.x, hs.y-b.y) < 900 && hasLOS(b.x, b.y, hs.x, hs.y, b.z) ?
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
    if(bp && Math.hypot(bp.x-b.x, bp.y-b.y) < 900 && hasLOS(b.x, b.y, bp.x, bp.y, b.z)){
      var bS = smokes.filter(function(s){ return smkActive(s) && segHitsCircle(b.x, b.y, bp.x, bp.y, s.x, s.y, smokeRadiusNow(s)); })[0];
      // (v555, отметка владельца м300 р3: «дефузит в смоке, T выстрелил раз и всё — зажимает всю обойму») на плант / дефуз — до конца магазина
      if(bS){ b._spam = {pt:bp, s:bS, seen:true, urgent:true, bursts:Math.max(SMK.burstsMax, Math.ceil(b.ammo/SMK.bullets)), shot:0, nextBurst:tick + b.reactionTicks, until:tick + 4*TICK_HZ};
        logEvent(b.id+": слышит "+(b.team === "CT" ? "плант" : "дефуз")+" за смоком — простреливает"); return; }
    }
    // (v469, п.6 владельца 29.10, р3 м1 т17330: kyousuke шёл через смок B Apartments к magixx, тот слышал его шаги в дыму 2 с и не стрелял —
    // решение «стрелять в дым» было только у стоящего вне боя и разыгрывалось один раз на смок) слышит врага в дыму (шаги / выстрел,
    // ≤ CONTACT_AGE с), до этого места линия свободна (кроме дыма) — очередь на звук сразу и на ходу, в бою тоже (владелец: «про сразу
    // стреляет в смок и двигается»). И если сам в этом дыму
    var hSm = hs && hs.team && hs.team !== b.team && (hs.kind === "steps" || hs.kind === "shots" || hs.kind === "hit") && tick - hs.tick < CONTACT_AGE*TICK_HZ ?
      smokes.filter(function(sm){ return smkActive(sm) && Math.hypot(sm.x-hs.x, sm.y-hs.y) < smokeRadiusNow(sm) + 20; })[0] : null;
    if(hSm && Math.hypot(hs.x-b.x, hs.y-b.y) < 900 && hasLOS(b.x, b.y, hs.x, hs.y, b.z, hs.z)){
      b._spam = {pt:{x:hs.x, y:hs.y}, s:hSm, seen:true, bursts:SMK.burstsMax, shot:0, nextBurst:tick + b.reactionTicks, until:tick + 3*TICK_HZ};
      logEvent(b.id+": слышит врага в смоке "+calloutName(hSm.x, hSm.y)+" — стреляет на звук"); return;
    }
    if(b.curSpeed > 40*SPD_K) return;   // стоит (на посту или просто остановился)
    // (v353, владелец: «решение стрелять в смок в другой стороне перебивает существующую перестрелку») в перестрелке (цикл
    // «на линии → за укрытие» идёт, или враг виден был ≤ 3 с назад) — в посторонний смок не стреляет
    if(b._fc || tick - (b._lastSawT || -1e9) < 3*TICK_HZ || tick - (b._shotAtT || -1e9) < 3*TICK_HZ) return;
    var D = b._spamDone || (b._spamDone = {});
    smokes.forEach(function(s){
      if(b._spam || s.team === b.team || !s.team || !smkActive(s)) return;
      var k = smkKey(s); if(D[k] !== undefined) return;
      var d = Math.hypot(s.x-b.x, s.y-b.y); if(d < 120 || d > 900 || !hasLOS(b.x, b.y, s.x, s.y, b.z)) return;
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
// HE в смок противника (v554, владелец 11.11: «HE в смок — разогнать, убить или проверить инфу; самому или попросить тиммейта, как флешку»).
// Повод — тот же, что у прострела: за дымом только что видел / слышал врага или команда его там ждёт (smkEvidence; «смок на входе» без инфы —
// нет). Было: только у своего сайта и по жребию (heP). Одна HE на смок от команды: есть своя — кидает сам (пользу и время проверяет
// assignNade: nadeSelfWhyNot), нет — просит своего с HE (nadeAskFlash с типом «he», 365)
function smokeHeTick(){
  if(!smokes.length || tick % 16) return;
  smokes.forEach(function(s){
    if(!s.team || !smkActive(s)) return;
    var k = smkKey(s), foe = s.team === "CT" ? "T" : "CT", D = s._heDone || (s._heDone = {});
    if(D[foe]) return;
    var ask = null;
    bots.forEach(function(b){
      if(D[foe] || !b.alive || b.team !== foe || b.nadeTask || b._sawEnemy || b.planting || b.defusing || tick < (b.blindUntil||0)) return;
      var d = Math.hypot(s.x-b.x, s.y-b.y); if(d < 200 || d > NADE_THROW_RANGE || !hasLOS(b.x, b.y, s.x, s.y, b.z)) return;
      var ev = smkEvidence(b, s); if(!ev || ev.kind === "entry") return;
      if(b.nades && b.nades.he > 0){
        if(assignNade(b, "he", {x:s.x, y:s.y}, "HE в смок — разогнать", {now:true})){ D[foe] = true; voiceLog(b.team, "hesmk"+k, b.id, "кидаю HE в смок "+calloutName(s.x, s.y)); }
      } else if(!ask) ask = b;
    });
    if(!D[foe] && ask && nadeAskFlash(ask, {x:s.x, y:s.y}, "HE в смок "+calloutName(s.x, s.y)+" — разогнать", "he")) D[foe] = true;
  });
}
// смок закрыл угол, который держал: часть игроков меняет позицию (отходит глубже)
function smokeShiftOnDetonate(s){
  bots.forEach(function(b){
    if(!b.alive || b.team === s.team || b._sawEnemy || !(b.atPost && b.post && b.post.hold)) return;
    var d = Math.hypot(s.x-b.x, s.y-b.y); if(d > 700 || !hasLOS(b.x, b.y, s.x, s.y, b.z)) return;
    // (Г4, 04.11, разбор отметок п.21 и ответ владельца 7Б: «позиция полезна — держит край дыма; через дым задачу не выполнить — отходит на
    // запасную») смок лёг на сам пост (стоит в дыму — не видит ничего) — меняет позицию всегда; раньше смок ближе 150 не учитывался вовсе
    var inside = d < NADE.smoke.radius;   // дым раскроется до полного радиуса
    var lk = b.lookTarget || b.post.look; if(!lk && !inside) return;
    if(!inside && !segHitsCircle(b.x, b.y, lk.x, lk.y, s.x, s.y, NADE.smoke.radius)) return;   // смок не на его линии
    if(!inside && hashRand(s.born*53 + b.id.charCodeAt(0)*29 + b.id.length) >= SMK.shiftP) return;
    shiftHold(b, {x:s.x, y:s.y}, null, "смок закрыл угол");
  });
}

