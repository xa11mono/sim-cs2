// куда смотреть, стоя на посту без свежей инфы: зона, откуда меня могут
// простреливать, с наибольшей вероятностью врага (кэш на 0.25с)
// куда смотреть на "невидимую" точку (звук, где только что был враг, вход
// поста за углом): не сквозь стену прямо на неё, а на ближайший видимый угол,
// из-за которого оттуда выйдут — видимую точку её зоны или соседних зон,
// ближайшую к самой точке
// линия взгляда упирается в смок — смотреть на его ближний край (оттуда из дыма
// выйдут), а не на угол за дымом
function smokeEdge(o, p){
  var best = null, bt = Infinity;
  for(var i=0;i<smokes.length;i++){
    var S = smokes[i], r = smokeRadiusNow(S)*0.95; if(r < 25) continue;
    var dx = p.x-o.x, dy = p.y-o.y, fx = o.x-S.x, fy = o.y-S.y;
    var a = dx*dx+dy*dy, bq = 2*(fx*dx+fy*dy), c = fx*fx+fy*fy-r*r;
    if(c <= 0) continue;                      // стоим в дыму — край не ищем
    var disc = bq*bq-4*a*c; if(disc < 0) continue;
    var t = (-bq - Math.sqrt(disc))/(2*a); if(t < 0 || t > 1) continue;
    if(t < bt){ bt = t; best = {x:o.x+dx*t, y:o.y+dy*t}; }
  }
  return best;
}
// свой на линии взгляда (ближе точки) или стоит у самой точки взгляда
// (v413, Б5д-3 / М153, владелец 25.10) на бегу свой впереди, бегущий туда же, — не помеха взгляду: смотрим мимо него по ходу (выход T Mirage:
// колонна к T Ramp — у каждого свой «на линии», взгляд уводился в сторону в ~половине тиков). «Бежит» — как в lookArbiter (> 60·SPD_K),
// «туда же» — ходы в пределах 60° (cos > 0,5 — проектное число)
function lookOnMate(b, p){
  var dp = Math.hypot(p.x-b.x, p.y-b.y), ap = Math.atan2(p.y-b.y, p.x-b.x);
  var run = b.curSpeed > 60*SPD_K && b.heading !== undefined;
  return bots.some(function(o){ if(o === b || !o.alive || o.team !== b.team) return false;
    if(run && o.curSpeed > 60*SPD_K && o.heading !== undefined && Math.cos(o.heading - b.heading) > 0.5) return false;
    var dm = Math.hypot(o.x-b.x, o.y-b.y); if(dm < 20) return false;
    var off = Math.abs(((Math.atan2(o.y-b.y, o.x-b.x)-ap+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
    // свой ближе точки на той же линии (смотрит ему в спину) или стоит у самой
    // точки и смотрит туда же (держит этот угол сам)
    return (off < 0.2 && dm < dp + 40 && dm > 60) || (Math.hypot(o.x-p.x, o.y-p.y) < 90 && dm < dp + 150); });
}
// открытое направление: видимые точки своей и соседних зон (как проходы для
// сейва), не перекрытые своими; лучше — где враг может быть и ближе к углу поста
// (v413, Б5д-3 / М153, владелец 25.10: T к T Ramp смотрели на Palace Entry под 100–146° и держали это 1,4 с) свой тыл (isRearZone — как
// у lookCands) не берётся; на ходу — ничего за спиной (> 1,5 рад от хода, как сказал владелец), запомненная точка на ходу проверяется
// заново; впереди всё закрыто своими — null: смотрит по ходу движения
// (v417, М153, скрин владельца: NiKo, опорник A, м1 р1 1:49 — стоял на посту, мимо прошёл CT2, взгляд ушёл «на CT» назад: точка в своей
// же зоне, isRearZone её не отсекает, а «не за спину» было только на ходу) стоя на посту — то же правило от угла поста: ничего дальше 1,5 рад
function openDirLook(b){
  var moving = b.curSpeed > 60*SPD_K && b.heading !== undefined;
  var postA = b.post && b.post.look ? Math.atan2(b.post.look.y-b.y, b.post.look.x-b.x) : null;
  var refA = moving ? b.heading : postA;
  var ahead = function(q){ return refA === null || _angOff(Math.atan2(q.y-b.y, q.x-b.x), refA) <= 1.5; };
  if(b._odl && tick - b._odl.t < 90 && b._odl.post === (b.post && b.post.id) && (!b._odl.p || ahead(b._odl.p))) return b._odl.p;
  var zi = bzOf(b.x, b.y), cands = [], seen = {};
  var addZ = function(j){ if(j < 0 || seen[j]) return; seen[j] = 1;
    if(zi >= 0 && j !== zi && isRearZone(b.team, zi, j, b)) return;
    (ZONE_SAMPLES[BZ.ids[j]] || (BZ.cent[j] ? [BZ.cent[j]] : [])).forEach(function(q){ var d = Math.hypot(q.x-b.x, q.y-b.y);
      if(d < 120 || d > 900 || !ahead(q) || !hasLOS(b.x, b.y, q.x, q.y, b.z) || lookOnMate(b, q)) return;
      var sc = beliefZoneKnown(b.team, j) + (reachPossible(b.team, j) ? 0.35 : 0) + d/3000;
      if(postA !== null){ var off = Math.abs(((Math.atan2(q.y-b.y, q.x-b.x)-postA+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI); sc += 0.15*Math.cos(off); }
      cands.push({p:q, sc:sc}); }); };
  if(zi >= 0){ addZ(zi); (BZ.nbr[zi]||[]).forEach(function(j){ addZ(j); (BZ.nbr[j]||[]).forEach(addZ); }); }
  cands.sort(function(a, c){ return c.sc - a.sc; });
  // (v381) лучшее открытое направление, без чередования двух лучших раз в ~3 с: по замеру v381 чередование добавляло метаний взгляда
  var pick = cands.length ? cands[0].p : null;
  b._odl = {t:tick, p:pick, post: b.post && b.post.id};
  return pick;
}
// держит установленный угол (hold-пост с назначенным взглядом) — далёкая и
// не связанная с этим направлением инфа (звук/колл/ЛИП) его не отвлекает:
// иначе бросал угол ради того, что всё равно за стеной и никак не влияет
function holdRelevant(b, pt){
  if(!(b.atPost && b.post && b.post.hold && b.post.look)) return true;
  if(Math.hypot(pt.x-b.x, pt.y-b.y) <= 550) return true;
  var wantA = Math.atan2(b.post.look.y-b.y, b.post.look.x-b.x), srcA = Math.atan2(pt.y-b.y, pt.x-b.x);
  return Math.abs(((srcA-wantA+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI) <= 1.15;
}
// ================= ПИКИ ДО КОНТАКТА (v135) =================
// Угол впереди по пути: последняя видимая точка пути, за которой путь уходит
// из видимости. Оттуда и выйдет враг — туда прицел (ближний угол первым), а
// последние метры до него — шагом и медленнее ("режем угол по кусочку").
function aheadCorner(b){
  if(!b.path || !b.path.length || b.pathIdx >= b.path.length) return null;
  var prev = {x:b.x, y:b.y}, acc = 0;
  for(var i=b.pathIdx; i<b.path.length && i < b.pathIdx+8; i++){
    var q = {x:b.path[i][0], y:b.path[i][1]}; acc += Math.hypot(q.x-prev.x, q.y-prev.y); prev = q;
    if(acc > 420) return null;
    if(!hasLOS(b.x, b.y, q.x, q.y, b.z)){
      var vis = i > b.pathIdx ? {x:b.path[i-1][0], y:b.path[i-1][1]} : null;
      if(!vis) return null;
      return {pt:vis, beyond:q, dist:Math.hypot(vis.x-b.x, vis.y-b.y)};
    }
  }
  return null;
}
function pieAllowed(b){
  // режут углы и выбирают пик заранее — когда есть время: T до выхода, охота,
  // пробы, лёрк, ранние пики CT, CT без колла. Ротации, выход T, ретейк —
  // бегом и с командой, как у про (там решает скорость и гранаты)
  var tag = (b.post && b.post.tag) || "", tt = teamTac.T, ct = teamTac.CT;
  if(/^(endhunt|hunt|probe|earlyPeek|flank|lurk|midcover|clear|roam|shift|clutch)/.test(tag)) return true;
  if(bomb && bomb.state === "planted") return false;
  if(b.team === "T") return !!(tt && tt.phase === "setup");
  return !(ct && (ct.call || (ct.rot && ct.rot[b.id]))) && !/^(rotate|gather|stack|anchor2)/.test(tag);
}
function pieBusy(b){
  return !b.alive || !pieAllowed(b) || b.state !== "patrol" || b._sawEnemy || b.planting || b.defusing || b.holding || b.atPost ||
    (b.post && /^(defuse|plantspot|flee|save|antidefuse|stopplant|retake|tradeR|repos|fetch|pickup|lineup)/.test(b.post.tag||"")) ||
    (bomb && bomb.state === "carried" && bomb.carrier === b && (ROUND_TIME_SEC - (simTime - roundStartTime)) < 30);
}
function prePeekTick(b){
  if(!BAL.pieSlice){ b._pie = null; return; }
  if(pieBusy(b)){ b._pie = null; if(b._ppWaitUntil && b._sawEnemy) b._ppWaitUntil = 0; return; }
  if(tick % 8 === (b.id.charCodeAt(1) % 8)){
    var C = aheadCorner(b);
    if(C){
      var zB = bzOf(C.beyond.x, C.beyond.y);
      // за углом враг может быть (по таймингу/инфе) и там не стоит свой
      var open = zB >= 0 && reachPossible(b.team, zB) &&
        !bots.some(function(o){ return o !== b && o.alive && o.team === b.team && Math.hypot(o.x-C.beyond.x, o.y-C.beyond.y) < 160; });
      C.danger = open ? (beliefZoneKnown(b.team, zB) + 0.1) : 0;
      C.slice = open && C.dist < 110;
      C.t = tick; b._pie = C;
      if(open && C.dist < 150) prePeekDecide(b, C, zB);
    } else b._pie = null;
  }
  // ждёт (флешку/тиммейта/паузу) — но не дольше, и тиммейт подошёл — выходят
  if(b._ppWaitUntil > tick && b._ppMate){
    var m = b._ppMate; if(!m.alive || Math.hypot(m.x-b.x, m.y-b.y) < 110) b._ppWaitUntil = 0;
  }
}
// решение, КАК брать угол, — до контакта, один раз на угол
function prePeekDecide(b, C, zB){
  var key = Math.round(C.pt.x/60)+","+Math.round(C.pt.y/60);
  var PD = b._ppDone || (b._ppDone = {}); if(PD.round !== roundNum){ PD = b._ppDone = {round:roundNum}; }
  if(PD[key]) return; PD[key] = 1;
  // инфа, что угол держат: свежая точка врага за углом или высокая вероятность
  var L = beliefLast[b.team] || {}, holder = null;
  for(var e in L){ var q = L[e]; if(tick - q.tick < 8*TICK_HZ && Math.hypot(q.x-C.beyond.x, q.y-C.beyond.y) < 450){ holder = q; break; } }
  // (10) в прошлых раундах CT пикнули отсюда агрессивно — считаем, что угол держат
  if(!holder && BAL.roundMem && b.team === "T"){ var ag = rmemRecent(RMEM.aggro, 2).filter(function(e){ return Math.hypot(e.x-C.beyond.x, e.y-C.beyond.y) < 380; })[0];
    if(ag){ holder = {x:ag.x, y:ag.y, tick:tick}; if(!b._agV || b._agV !== roundNum){ b._agV = roundNum; logEvent(b.id+": в прошлом раунде отсюда пикнули ("+ag.id+", "+calloutName(ag.x, ag.y)+") — беру угол аккуратно"); } } }
  var info = !!holder || beliefZoneKnown(b.team, zB) >= 0.45;
  var heardMe = BAL.heardMe && b._noisyT && tick - b._noisyT < 3*TICK_HZ;       // (4) он меня, скорее всего, слышал
  var repeek = b._avoidPeekUntil > tick && b._avoidPeekAt && Math.hypot(b._avoidPeekAt.x-C.beyond.x, b._avoidPeekAt.y-C.beyond.y) < 450;
  var tt = teamTac.T, execEntry = b.team === "T" && tt && tt.phase === "execute" && b.tRole === "entry";
  var secLeft = ROUND_TIME_SEC - (simTime - roundStartTime);
  var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === b.team && Math.hypot(o.x-b.x, o.y-b.y) < TRADE_R && !o._sawEnemy; });
  // (3) один угол за раз: из-за угла видно два опасных направления — второе
  // отдаём тиммейту (смотрит туда) или закрываем флешкой
  if(BAL.oneAngle){
    var dirs = [], zs = {};
    // (v136) раньше — только центры зон и вероятность ≥0.12: центры из-за угла
    // почти никогда не видны, и механика не срабатывала. Теперь — любые видимые
    // точки зоны (и соседей соседей), враг там может быть по таймингу
    var addD = function(j){ if(j < 0 || zs[j] || !reachPossible(b.team, j)) return; zs[j] = 1;
      var bj = beliefZoneKnown(b.team, j); if(bj < 0.04) return;
      var smp = ZONE_SAMPLES[BZ.ids[j]] || (BZ.cent[j] ? [BZ.cent[j]] : []), bestQ = null, bdq = Infinity;
      smp.forEach(function(q){ var dq = Math.hypot(q.x-C.beyond.x, q.y-C.beyond.y); if(dq > 60 && dq < 900 && dq < bdq && hasLOS(C.beyond.x, C.beyond.y, q.x, q.y)){ bdq = dq; bestQ = q; } });
      if(bestQ) dirs.push({pt:bestQ, a:Math.atan2(bestQ.y-C.beyond.y, bestQ.x-C.beyond.x), w:bj, d:bdq}); };
    addD(zB); (BZ.nbr[zB]||[]).forEach(function(j){ addD(j); (BZ.nbr[j]||[]).forEach(addD); });
    dirs.sort(function(a, c){ return a.d - c.d; });
    var second = dirs.slice(1).filter(function(x){ return Math.abs(((x.a-dirs[0].a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI) > 0.9; })[0];
    if(second){
      var cm = mates[0];
      if(cm){ cm._coverDir = {pt:second.pt, until: tick + 4*TICK_HZ}; voiceLog(b.team, "cov"+b.id+key, b.id, "беру "+calloutName(dirs[0].pt.x, dirs[0].pt.y)+", "+cm.id+" — смотри "+calloutName(second.pt.x, second.pt.y)); }
      else if(b.nades && b.nades.flash > 1 && !b.nadeTask && assignNade(b, "flash", second.pt, "закрыть второй угол", {now:true, range:700})) {}
    }
  }
  if(!info && !heardMe && !repeek) return;
  // (2) угол держат — прямо не выходим
  // (флешка себе) раньше рвалась в точке за углом — там, куда держащий не
  // смотрит (или вообще не видит): из 13 флешек слепила одна. Поп-флешка
  // должна хлопнуть у него перед глазами: на линии "держащий → край угла"
  var hPos = holder ? {x:holder.x, y:holder.y} : null;
  if(!hPos){ var bz0 = -1, bv0 = 0; [zB].concat(BZ.nbr[zB]||[]).forEach(function(j){ var v = beliefZoneKnown(b.team, j); if(v > bv0 && BZ.cent[j]){ bv0 = v; bz0 = j; } }); if(bz0 >= 0) hPos = BZ.cent[bz0]; }
  var popPt = C.beyond;
  if(BAL.popAim && hPos){ var fr = [0.35, 0.5, 0.22, 0.65];
    for(var fi=0; fi<fr.length; fi++){ var P = {x: C.pt.x + (hPos.x-C.pt.x)*fr[fi], y: C.pt.y + (hPos.y-C.pt.y)*fr[fi]};
      if(!insideSolidWall(P.x, P.y) && hasLOS(hPos.x, hPos.y, P.x, P.y) && Math.hypot(P.x-hPos.x, P.y-hPos.y) > 90){ popPt = P; break; } } }
  if(b.nades && b.nades.flash > 0 && !b.nadeTask && b._ppFlashR !== roundNum && (!BAL.popAim || holder) && assignNade(b, "flash", popPt, "флешу себе под пик", {now:true, range:700})){
    b._ppFlashR = roundNum; b._ppWaitUntil = tick + 40; b._ppMate = null;
    if(!b._ppV || tick - b._ppV > 6*TICK_HZ){ b._ppV = tick; logEvent(b.id+": угол держат — флешу себе и выхожу"); }
    return;
  }
  if(!execEntry && mates.length && secLeft > 25){
    b._ppWaitUntil = tick + Math.round(2.5*TICK_HZ); b._ppMate = mates[0];
    if(!b._ppV || tick - b._ppV > 6*TICK_HZ){ b._ppV = tick; logEvent(b.id+": угол держат — жду "+mates[0].id+", выходим вдвоём"); }
    return;
  }
  // один и без флешки: если меня слышали/уже пикал сюда — сначала пауза
  if((heardMe || repeek) && !execEntry && secLeft > 25){
    b._ppWaitUntil = tick + Math.round(2*TICK_HZ); b._ppMate = null;
    if(!b._ppV || tick - b._ppV > 6*TICK_HZ){ b._ppV = tick; logEvent(b.id+": "+(repeek ? "сюда уже пикал" : "меня, похоже, слышали")+" — не выхожу сразу, выгляну после паузы"); }
  }
}
// (5) засветился/ранен без фрага: контакт закончился, враги рядом живы —
// позиция известна, уходит глубже (как после фрага)
function exposedShiftTick(b){
  if(!BAL.seenShift || !b.alive || b._sawEnemy || !b.atPost || !b.post || !b.post.hold) return;
  var li = b.lastIntel; if(!li || li.src || tick - li.tick < 24 || tick - li.tick > 90) return;
  var hurt = b._hurtT && tick - b._hurtT < 4*TICK_HZ, shot = b._shotAtT && tick - b._shotAtT < 3*TICK_HZ;
  if(!hurt && !shot) return;
  if(b._esT && tick - b._esT < 6*TICK_HZ) return; b._esT = tick;
  var foe = b.team === "CT" ? "T" : "CT";
  if(aliveCount(foe) === 0) return;
  shiftHold(b, {x:li.x, y:li.y}, null, hurt ? "ранили, позиция известна" : "по мне стреляли, позиция известна");
}
// (v163) где враг из точки q выйдет на линию бота: идём по его пути к боту,
// первая точка, которую бот видит (не ближе 50px). Нет такой — null
// (v442, док владельца 27.10: «падает FPS»; отметка р7 — на тике решений 40–73 пути, почти все отсюда) кэш — на все точки q, пока бот в той же
// клетке 16 ед. (раньше одна запись: варианты взгляда перебирают несколько q подряд, и каждая выталкивала прошлую). Ответ тот же
function appearFrom(b, q){
  var pk = Math.round(b.x/16)+","+Math.round(b.y/16), k = Math.round(q.x/40)+","+Math.round(q.y/40);
  if(b._apfP !== pk){ b._apfP = pk; b._apfC = {}; }
  if(k in b._apfC) return b._apfC[k];
  var v = appearFromCalc(b, q); b._apfC[k] = v; return v;
}
function appearFromCalc(b, q){
  var wp = buildWaypointPath(q.x, q.y, 0, b.x, b.y, 0); if(!wp || !wp.length) return null;
  var prev = {x:q.x, y:q.y};
  for(var i=0;i<wp.length;i++){
    var p = {x:wp[i][0], y:wp[i][1]};
    if(hasLOS(b.x, b.y, p.x, p.y, b.z)){
      // уточняем на отрезке prev→p: первая видимая точка
      var lo = 0, hi = 1;
      for(var it=0; it<6; it++){ var m = (lo+hi)/2, mp = {x:prev.x+(p.x-prev.x)*m, y:prev.y+(p.y-prev.y)*m}; if(hasLOS(b.x, b.y, mp.x, mp.y, b.z)) hi = m; else lo = m; }
      var r = {x:prev.x+(p.x-prev.x)*hi, y:prev.y+(p.y-prev.y)*hi};
      if(Math.hypot(r.x-b.x, r.y-b.y) < 50) return null;
      return r;
    }
    prev = p;
  }
  return null;
}
function flatWallAhead(b, a, R){
  var dx = Math.cos(a), dy = Math.sin(a), best = null;
  for(var i=0;i<MANUAL_WALLS.length;i++){ var w = MANUAL_WALLS[i];
    if(Math.max(w[0],w[2]) < b.x-R || Math.min(w[0],w[2]) > b.x+R || Math.max(w[1],w[3]) < b.y-R || Math.min(w[1],w[3]) > b.y+R) continue;
    var sx = w[2]-w[0], sy = w[3]-w[1], den = dx*sy - dy*sx; if(Math.abs(den) < 1e-9) continue;
    var qx = w[0]-b.x, qy = w[1]-b.y, t = (qx*sy - qy*sx)/den, u = (qx*dy - qy*dx)/den;
    if(t > 0 && t < R && u >= 0 && u <= 1 && (!best || t < best.t)) best = {t:t, e:Math.min(u, 1-u)*Math.hypot(sx, sy)};
  }
  return !!(best && best.e > 18);
}
function openDirNear(b, a){
  var k = Math.round(a*20)+"|"+Math.round(b.x/10)+","+Math.round(b.y/10);
  if(b._odK === k) return b._odV;
  b._odK = k; b._odV = null;
  for(var st=1; st<=9; st++) for(var sg=-1; sg<=1; sg+=2){
    var an = a + sg*st*0.1745, c = rayClipWalls(b.x, b.y, b.x+Math.cos(an)*160, b.y+Math.sin(an)*160);
    if(Math.hypot(c.x-b.x, c.y-b.y) >= 140){ b._odV = {x:b.x+Math.cos(an)*220, y:b.y+Math.sin(an)*220}; return b._odV; }
  }
  return null;
}
// (v287, И27, владелец 14.10: раунд 9, игрок 9 в Dark смотрел в Cave, а magixx — в Lamp Room в 123 px) «угол по пути» к цели
// не разворачивает от неё: угол дальше 1,3 рад (75°) от прямого направления на цель — смотрим в сторону цели (≤ 220 px).
// Раньше это правило было только у угла поста (v281) — теперь одно место для всех
function cornerLook(b, p, from){
  var r = cornerLook0(b, p, from);
  if(!r || !p || !b) return r;
  var aDir = Math.atan2(p.y-b.y, p.x-b.x);
  if(Math.hypot(r.x-b.x, r.y-b.y) > 1 && _angOff(Math.atan2(r.y-b.y, r.x-b.x), aDir) > 1.3){
    var dl = Math.min(220, Math.hypot(p.x-b.x, p.y-b.y)); return {x: b.x + Math.cos(aDir)*dl, y: b.y + Math.sin(aDir)*dl}; }
  return r;
}
function cornerLook0(b, p, from){
  if(!p) return p;
  // (этап 3, P2-1) держит позицию и переминается (idle strafe: ±24 px вбок, ±7 вперёд — idleHold в stepTick): угол выбирается
  // от точки, где встал, а не от текущего пикселя. Раньше сдвиг на 6 px переключал «цель видна / не видна» и взгляд прыгал на 30–175°
  var H = b && b._hold;
  var o = from || ((H && H.post === b.post && b.atPost && Math.hypot(b.x-H.ax, b.y-H.ay) <= 26) ? {x: H.ax, y: H.ay} : b);
  if(smokes.length){ var se = smokeEdge(o, p); if(se) return se; }
  if(hasLOS(o.x, o.y, p.x, p.y, o.z)) return p;
  var pk = Math.round(p.x/80)+","+Math.round(p.y/80);
  // та же цель и прежний угол всё ещё виден — не пересчитываем (переминание на
  // месте иначе меняло "ближайший угол" и бот вертел головой)
  // (этап 4, P1) угол, выбранный по пути (бот тогда стоял дальше), мог оказаться точкой, куда бот потом встал: «смотреть» в
  // точку под ногами — направление прыгает от сдвига на пиксели (repos:assist: угол = место поста, повороты 78–152°).
  // Старый угол годится, только если он не ближе 30 px — как и при выборе нового (ниже)
  if(b._cornerPK === pk && b._cornerPt && Math.hypot(b._cornerPt.x-o.x, b._cornerPt.y-o.y) > 30 && hasLOS(o.x, o.y, b._cornerPt.x, b._cornerPt.y, o.z)) return b._cornerPt;
  b._cornerPK = pk;
  // угол — это место, где путь к цели уходит из видимости: последняя видимая
  // точка пути по навмешу (оттуда враг и выйдет). Раньше брались видимые точки
  // соседних зон — и бот часто смотрел в случайный угол
  var wp = buildWaypointPath(o.x, o.y, 0, p.x, p.y, 0), vis = null;
  for(var wi=0; wi<wp.length; wi++){
    var q0 = {x:wp[wi][0], y:wp[wi][1]};
    if(hasLOS(o.x, o.y, q0.x, q0.y, o.z)){ if(Math.hypot(q0.x-o.x, q0.y-o.y) > 30) vis = q0; }
    else break;
  }
  if(vis){ b._cornerPt = vis; return vis; }
  var zi = bzOf(p.x, p.y), cand = [];
  var addZ = function(j){ if(j < 0 || j == null) return; (ZONE_SAMPLES[BZ.ids[j]] || [BZ.cent[j]]).forEach(function(q){ cand.push(q); }); };
  addZ(zi); (BZ.nbr[zi]||[]).forEach(addZ);
  var zb = bzOf(o.x, o.y); if(zb >= 0 && zb !== zi) (BZ.nbr[zb]||[]).forEach(function(j){ if(j !== zi) addZ(j); });
  var best = null, bd = Infinity;
  cand.forEach(function(q){
    var dq = Math.hypot(q.x-o.x, q.y-o.y); if(dq < 40) return;
    if(!hasLOS(o.x, o.y, q.x, q.y, o.z)) return;
    var sc = Math.hypot(q.x-p.x, q.y-p.y) + 0.15*dq;
    if(sc < bd){ bd = sc; best = q; }
  });
  b._cornerPt = best || null;   // не нашли видимого угла — не смотреть сквозь стену
  return b._cornerPt;
}
function openLook(b, look){
  var k = Math.round(look.x/24)+","+Math.round(look.y/24)+"|"+Math.round(b.x/12)+","+Math.round(b.y/12);
  if(b._olK === k) return b._olV;
  b._olK = k; b._olV = look;
  var a = Math.atan2(look.y-b.y, look.x-b.x), dl = Math.hypot(look.x-b.x, look.y-b.y);
  if(dl < 60) return look;
  var free = function(an, r){ var c = rayClipWalls(b.x, b.y, b.x+Math.cos(an)*r, b.y+Math.sin(an)*r); return Math.hypot(c.x-b.x, c.y-b.y); };
  if(free(a, 120) >= 45) return look;
  for(var st = 1; st <= 7; st++){
    for(var sg = -1; sg <= 1; sg += 2){
      var an = a + sg*st*0.1745;
      if(free(an, 220) >= 110){ b._olV = {x:b.x+Math.cos(an)*200, y:b.y+Math.sin(an)*200}; return b._olV; }
    }
  }
  b._olV = null; return null;   // открытого направления рядом нет — не поворачиваемся в стену
}

