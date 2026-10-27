function lookCands(b, W){
  var zb = (b.atPost && b.post) ? bzOf(b.post.x, b.post.y) : bzOf(b.x, b.y);
  if(zb < 0) zb = bzOf(b.x, b.y); if(zb < 0) return [];
  var team = b.team, out = [], moving = b.curSpeed > 60*SPD_K && b.heading !== undefined;
  var atHold = !moving && b.post && b.post.look && Math.hypot(b.post.x-b.x, b.post.y-b.y) < 160;
  var postA = (b.post && b.post.look && !(b.post.tag === "save")) ? Math.atan2(b.post.look.y-(b.post.y||b.y), b.post.look.x-(b.post.x||b.x)) : null;
  var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === team; });
  var rearCov = moving && mates.some(function(o){ return Math.hypot(o.x-b.x, o.y-b.y) < 500; });
  var habZ = {};
  bots.forEach(function(o){ if(!o.alive || o.team === team) return; var h = habitTop(o.id, 2); if(h){ var zh = bzOf(h.x, h.y); if(zh >= 0) habZ[zh] = 1; } });
  var Wd = ZONE_DANGER_W[BZ.ids[zb]] || {}, PW = PORTAL_W[team] || {};
  var D = LOOKDBG.on ? (b._ldZones = {}) : null;   // (v273) разбор взгляда: только запись для выбранного бота
  (ZONE_DANGER[BZ.ids[zb]]||[]).forEach(function(zid){
    var j = BZ.idx[zid]; if(j === undefined || j === zb) return;
    var cz = BZ.cent[j]; if(!cz || Math.hypot(cz.x-b.x, cz.y-b.y) > LOOK.maxDist){ if(D && cz) D[j] = {skip: "далеко"}; return; }
    if(isRearZone(team, zb, j, b)){ if(D) D[j] = {skip: REAR_WHY}; return; }   // (v148) свой тыл — не угроза
    // 1) сколько врагов оттуда вероятно выйдет
    var th = beliefZoneKnown(team, j), nBest = -1, nVal = 0, dz = D ? (D[j] = {bel: th, nbr: 0, hab: 0, unc: 0, tim: 0, wd: Wd[zid]||0}) : null;
    BZ.nbr[j].forEach(function(nn){ if(nn === zb) return;
      if(BAL.timing && !reachPossible(team, nn)) return;
      var v = LOOK.nbrW * nbrThreat(team, j, nn, zb);
      if(PW[j+","+nn]) v *= LOOK.watchedNbr;          // вход видит свой — враг выйдет на него первым
      th += v; if(dz) dz.nbr += v; if(v > nVal){ nVal = v; nBest = nn; } });
    if(habZ[j] && (!BAL.timing || reachPossible(team, j))){ th += LOOK.habitW; if(dz) dz.hab = LOOK.habitW; }
    if(moving){ var uw = LOOK.uncheckW * uncheckedW(team, j); th += uw; if(dz) dz.unc = uw; }   // стоя — держит главный угол, непроверенные углы чекает на ходу
    // тайминг: инфы ещё нет — смотрим туда, где враг МОЖЕТ появиться раньше всего.
    // Зона, куда враг не может попасть незаметно (тупик за спиной своего), даёт 0
    var R = REACH[team];
    if(R){ var rmin = R[j]; BZ.nbr[j].forEach(function(nn){ if(nn !== zb && R[nn] < rmin) rmin = R[nn]; });
      if(isFinite(rmin)){ var tw0 = LOOK.timingW * Math.exp(-Math.max(0, rmin - tick)/(LOOK.timingSec*TICK_HZ)); th += tw0; if(dz) dz.tim = tw0; } }
    if(dz) dz.th = th;
    if(th <= 0){ if(dz) dz.skip = "угрозы нет"; return; }
    // 2) точка взгляда: видимая точка зоны, ближайшая к проходу, откуда идёт угроза
    var ref = (nBest >= 0 && nVal > beliefZoneKnown(team, j)) ? (BZ.portal && BZ.portal[j][nBest]) || BZ.cent[nBest] : null;
    // врага в этой зоне недавно (≤8с) видели/слышали — целимся туда, где он был,
    // а не в любую точку большой зоны (Mid — это полкарты)
    var BLr = beliefLast[team] || {}, lkBest = null, lkAge = 1e9;
    for(var eidr in BLr){ var lr = BLr[eidr]; if(!lr || tick - lr.tick > 8*TICK_HZ || tick - lr.tick >= lkAge) continue;
      if(bzOf(lr.x, lr.y) !== j) continue;
      var er = bots.filter(function(o){ return o.id === eidr; })[0]; if(!er || !er.alive) continue;
      lkBest = lr; lkAge = tick - lr.tick; }
    if(lkBest && LOOK.lkRef !== false) ref = lkBest;
    var apZ = !lkBest ? appearPoint(b, (nBest >= 0 && nVal > beliefZoneKnown(team, j)) ? nBest : j) : null;
    var smp = ZONE_SAMPLES[zid] || [cz], c = null, cd = Infinity;
    smp.forEach(function(q){ var dq = Math.hypot(q.x-b.x, q.y-b.y); if(dq < 50 || !hasLOS(b.x, b.y, q.x, q.y, b.z)) return;
      var key = ref ? Math.hypot(q.x-ref.x, q.y-ref.y) : dq; if(key < cd){ cd = key; c = q; } });
    if(apZ && bzOf(apZ.x, apZ.y) === j || apZ && (nBest >= 0 && bzOf(apZ.x, apZ.y) === nBest)) c = apZ;
    if(!c){ if(dz) dz.skip = "не видно"; return; }
    var d = Math.hypot(c.x-b.x, c.y-b.y);
    // (v261, В4) точка ближе 200 px, за которой сразу стена, — смотреть некуда (взгляд в стену у носа): не кандидат
    if(d < 200){ var ext = {x:b.x+(c.x-b.x)/d*200, y:b.y+(c.y-b.y)/d*200}; if(!hasLOS(b.x, b.y, ext.x, ext.y, b.z)){ if(dz) dz.skip = "у носа стена"; return; } c = ext; d = 200; }
    var za = Math.atan2(c.y-b.y, c.x-b.x);
    var fresh = freshThreatNear(team, c);
    // 3) оценка
    var sc = th * (0.4 + (Wd[zid]||0)) / (1 + d/(moving ? LOOK.distMove : LOOK.distHold));
    var F = D ? [["угроза зоны", th], ["простреливает меня", 0.4 + (Wd[zid]||0)], ["дистанция " + Math.round(d), 1/(1 + d/(moving ? LOOK.distMove : LOOK.distHold))]] : null;
    var behind = moving ? _angOff(za, b.heading) > 1.9 : (atHold && postA !== null && _angOff(za, postA) > 2.2);
    if(d < LOOK.closeR && !behind){ sc *= LOOK.closeK; if(F) F.push(["близко", LOOK.closeK]); }
    if(fresh){ sc *= LOOK.freshK; if(F) F.push(["свежая угроза", LOOK.freshK]); }
    if(postA !== null && _angOff(za, postA) < 0.9){ sc *= LOOK.postK; if(F) F.push(["угол поста", LOOK.postK]); }
    if(moving){ var hd = _angOff(za, b.heading); if(hd < 0.9){ sc *= LOOK.headK; if(F) F.push(["по ходу", LOOK.headK]); } else if(hd > 1.9 && !(fresh && d <= 250)){ sc *= rearCov ? LOOK.behindMoveCov : LOOK.behindMove; if(F) F.push([rearCov ? "за спиной (прикрыт)" : "за спиной", rearCov ? LOOK.behindMoveCov : LOOK.behindMove]); } }
    else if(behind && !fresh){ sc *= LOOK.behindHold; if(F) F.push(["за спиной поста", LOOK.behindHold]); }
    if(!fresh){
      if(mates.some(function(o){ return Math.hypot(o.x-c.x, o.y-c.y) < 140 || (bzOf(o.x, o.y) === j && Math.hypot(o.x-c.x, o.y-c.y) < 260); })){ sc *= LOOK.mateThere; if(F) F.push(["там свой", LOOK.mateThere]); }
      else if(mates.some(function(o){ var dm = Math.hypot(o.x-b.x, o.y-b.y); return dm > 20 && dm < Math.min(d, 600) && _angOff(Math.atan2(o.y-b.y, o.x-b.x), za) < 0.22; })){ sc *= LOOK.mateInLine; if(F) F.push(["свой на линии", LOOK.mateInLine]); }
    }
    out.push({j:j, pt:c, sc:sc, fresh:fresh, a:za, f:F});
  });
  // входы в СВОЮ зону: враг из соседней зоны сначала войдёт туда, где стоит бот
  // (раньше такие входы не считались вообще — бот на CT-спавне не смотрел на
  // выходы из Alley/Temple, хотя там был враг). Смотрим на сам проход.
  if(BZ.portal) BZ.nbr[zb].forEach(function(nn){
    var p = BZ.portal[zb][nn]; if(!p) return;
    if(isRearZone(team, zb, nn, b)) return;   // (v148) проход в свой тыл — не угроза
    var d = Math.hypot(p.x-b.x, p.y-b.y); if(d < 40 || d > LOOK.maxDist || !hasLOS(b.x, b.y, p.x, p.y, b.z)) return;
    var th = beliefZoneKnown(team, nn);
    BZ.nbr[nn].forEach(function(n2){ if(n2 === zb) return; if(BAL.timing && !reachPossible(team, n2)) return;
      var v = LOOK.nbrW * nbrThreat(team, nn, n2, zb); if(PW[nn+","+n2]) v *= LOOK.watchedNbr; th += v; });
    if(habZ[nn]) th += LOOK.habitW;
    if(moving) th += LOOK.uncheckW * uncheckedW(team, nn);
    if(th <= 0) return;
    var c = p;
    // (v151) не середина прохода, а место, где враг из этой зоны реально появится
    var ap = appearPoint(b, nn); if(ap){ c = ap; d = Math.hypot(ap.x-b.x, ap.y-b.y); }
    if(d < 200){ var ext = {x:b.x+(c.x-b.x)/d*200, y:b.y+(c.y-b.y)/d*200}; if(hasLOS(b.x, b.y, ext.x, ext.y, b.z)) c = ext; }
    var za = Math.atan2(c.y-b.y, c.x-b.x), fresh = freshThreatNear(team, p);
    var sc = th * LOOK.entryExp / (1 + Math.max(d,200)/(moving ? LOOK.distMove : LOOK.distHold));
    var F = D ? [["угроза за входом", th], ["вход в мою зону", LOOK.entryExp], ["дистанция " + Math.round(d), 1/(1 + Math.max(d,200)/(moving ? LOOK.distMove : LOOK.distHold))]] : null;
    if(D && !D[nn]) D[nn] = {th: th, bel: beliefZoneKnown(team, nn), entry: true};
    var behind = moving ? _angOff(za, b.heading) > 1.9 : (atHold && postA !== null && _angOff(za, postA) > 2.2);
    if(d < LOOK.closeR && !behind){ sc *= LOOK.closeK; if(F) F.push(["близко", LOOK.closeK]); }
    if(fresh){ sc *= LOOK.freshK; if(F) F.push(["свежая угроза", LOOK.freshK]); }
    if(postA !== null && _angOff(za, postA) < 0.9){ sc *= LOOK.postK; if(F) F.push(["угол поста", LOOK.postK]); }
    if(moving){ var hd = _angOff(za, b.heading); if(hd < 0.9){ sc *= LOOK.headK; if(F) F.push(["по ходу", LOOK.headK]); } else if(hd > 1.9 && !(fresh && d <= 250)){ sc *= rearCov ? LOOK.behindMoveCov : LOOK.behindMove; if(F) F.push([rearCov ? "за спиной (прикрыт)" : "за спиной", rearCov ? LOOK.behindMoveCov : LOOK.behindMove]); } }
    else if(behind && !fresh){ sc *= LOOK.behindHold; if(F) F.push(["за спиной поста", LOOK.behindHold]); }
    if(!fresh && mates.some(function(o){ return Math.hypot(o.x-p.x, o.y-p.y) < 140; })){ sc *= LOOK.mateThere; if(F) F.push(["там свой", LOOK.mateThere]); }
    out.push({j:1000+nn, pt:c, sc:sc, fresh:fresh, a:za, f:F});
  });
  // (v281) известные позиции врага (из демок), которые отсюда видно и которые команда ещё не видела пустыми — в т. ч. в своей
  // зоне (раньше своя зона в варианты не входила, и угол внутри большой зоны никто не чекал). Вес — доля опасности зоны
  // по частоте позиции у про (сумма по позициям зоны = опасность зоны, не прибавка), дальше — те же множители, что у зон
  enemyPositions(team).forEach(function(q){
    var d = Math.hypot(q.x-b.x, q.y-b.y); if(d < 60 || d > LOOK.maxDist) return;
    if(posClearValid(team, q.id) || (BAL.timing && !reachPossible(team, q.z))) return;
    if(!hasLOS(b.x, b.y, q.x, q.y, b.z)) return;
    var th = beliefZoneKnown(team, q.z);
    BZ.nbr[q.z].forEach(function(nn){ if(nn === zb) return; if(BAL.timing && !reachPossible(team, nn)) return; th += LOOK.nbrW * nbrThreat(team, q.z, nn, zb); });
    if(th <= 0) return;
    var za = Math.atan2(q.y-b.y, q.x-b.x), fresh = freshThreatNear(team, q);
    var sc = th * q.frac / (1 + d/(moving ? LOOK.distMove : LOOK.distHold));
    var F = D ? [["опасность зоны " + (zoneUserName(BZ.ids[q.z]) || BZ.ids[q.z]), th], ["доля позиции у про", q.frac], ["дистанция " + Math.round(d), 1/(1 + d/(moving ? LOOK.distMove : LOOK.distHold))]] : null;
    if(fresh){ sc *= LOOK.freshK; if(F) F.push(["свежая угроза", LOOK.freshK]); }
    if(moving){ var hd = _angOff(za, b.heading); if(hd < 0.9){ sc *= LOOK.headK; if(F) F.push(["по ходу", LOOK.headK]); } else if(hd > 1.9 && !(fresh && d <= 250)){ sc *= rearCov ? LOOK.behindMoveCov : LOOK.behindMove; if(F) F.push(["за спиной", rearCov ? LOOK.behindMoveCov : LOOK.behindMove]); } }
    else if(atHold && postA !== null && _angOff(za, postA) > 2.2 && !fresh){ sc *= LOOK.behindHold; if(F) F.push(["за спиной поста", LOOK.behindHold]); }
    if(!fresh && mates.some(function(o){ return Math.hypot(o.x-q.x, o.y-q.y) < 140; })){ sc *= LOOK.mateThere; if(F) F.push(["там свой", LOOK.mateThere]); }
    out.push({j: "pos:" + q.id, pt: {x: q.x, y: q.y}, sc: sc, fresh: fresh, a: za, pos: q.id, f: F});
  });
  // (v381, арбитр взгляда) свежее ≤ 1 с (свои уши, команда, закреплённый контакт) — отдельные уровни арбитра (lookKnowCands), здесь
  // не дублируется. Здесь — то, что знали 1–1,5 с назад, и контакт старше 1 с: обычные кандидаты дележа, чтобы взгляд чередовал
  // их с открытыми углами (v375, отметка владельца: T0 смотрел только в смок и открыл спину Jungle и Connector)
  var cts = [];
  var hs = b.heardSound; if(hs && tick - hs.tick > LOOK_FRESH && tick - hs.tick <= 96) cts.push({x:hs.x, y:hs.y, age:tick-hs.tick, kind:hs.kind});
  if(b._contact && tick < b._contact.until && !lookContactFresh(b)) cts.push({x:b._contact.x, y:b._contact.y, age:32});
  var BLc = beliefLast[team] || {};
  for(var eid in BLc){ var lo = BLc[eid]; if(tick - lo.tick > 96 || tick - lo.tick <= LOOK_FRESH) continue;
    var eb = bots.filter(function(o){ return o.id === eid; })[0]; if(!eb || !eb.alive) continue; cts.push({x:lo.x, y:lo.y, age:tick-lo.tick, seen: lo.src === "spotted"}); }
  cts.forEach(function(q){
    var c = lookKnowPt(b, q, zb, mates, moving); if(!c) return;
    var pt = c.pt, d = c.d, za = c.a, cov = c.cov;
    var scS = LOOK.contactW * (d < 300 ? 2 : 1) / (1 + d/700) * (1 - q.age/192) * (cov ? LOOK.mateThere : 1);
    // (v296, И37) только что видел врага в упор (≤ 250 px) — это самая свежая угроза: тот же множитель, что у «свежей угрозы» зоны
    // (v359, отметка владельца: m0NESY не посмотрел на Connector, откуда в паре метров кинули флешку) бросок гранаты рядом (≤ 300 px) —
    // враг точно там, где кидал: та же «свежая угроза», что увиденный в упор
    var seenClose = (q.seen && d <= 250 || q.kind === "nade" && d < 300) && !cov; if(seenClose) scS *= LOOK.freshK;
    // (v278) путь закрывает свой — не «свежая» угроза для меня: не перебивает точку про и угол поста (игрок 9 дёргался на Cave)
    out.push({j:"snd"+Math.round(q.x/80)+","+Math.round(q.y/80), pt:pt, src:{x:q.x, y:q.y}, sc:scS, fresh:!cov, a:za, snd:true,
      f: D ? [["контакт/звук", LOOK.contactW], [d < 300 ? "ближе 300" : "дальше 300", d < 300 ? 2 : 1], ["дистанция " + Math.round(d), 1/(1 + d/700)], ["свежесть " + (q.age/TICK_HZ).toFixed(1) + " с", 1 - q.age/192]].concat(cov ? [["путь закрывает " + cov.id, LOOK.mateThere]] : []).concat(seenClose ? [["видел в упор", LOOK.freshK]] : []) : null});
  });
  // (v148) без инфы — туда, куда смотрят про с этой точки (по 12 демкам).
  // Вес маленький: реальная угроза его перебивает, а "почти нули" — нет
  { var PL = proLookAt(team, b.x, b.y);
    if(PL){ var ae = Math.atan2(PL.dy, PL.dx), cl = rayClipWalls(b.x, b.y, b.x+PL.dx*420, b.y+PL.dy*420), dl = Math.hypot(cl.x-b.x, cl.y-b.y);
      // (v273, владелец 14.10) направление про упирается в стену (у нас геометрия чуть другая) — не точка на стене, а самое открытое
      // направление в пределах ±30° от него (±30° — проектное число), если там видно дальше
      if(dl < 400){ var opn = openToward(b, ae, 0.52), dop = opn ? Math.hypot(opn.x-b.x, opn.y-b.y) : 0; if(opn && dop > dl + 40){ cl = opn; dl = dop; ae = Math.atan2(opn.y-b.y, opn.x-b.x); } }
      if(dl > 90){ var scp = LOOK.proLook * PL.R;
        if(moving){ var hdp = _angOff(ae, b.heading); if(hdp < 0.9) scp *= LOOK.headK; else scp = 0; }
        if(scp > 0) out.push({j:"pl", pt:{x:cl.x, y:cl.y}, sc:scp, fresh:false, a:ae, pro:true, f: D ? [["как у про с этой точки", LOOK.proLook], ["доля про", PL.R]] : null}); } } }
  // угол поста по сетапу — тоже кандидат (слабый), чтобы и он шёл через делёж:
  // двое на соседних постах не смотрят в одну точку, когда угроз нет
  if(atHold){ var pl = cornerLook(b, b.post.look) || b.post.look;
    // (v281 → v287) угол «по пути», ушедший от цели > 1,3 рад, правит сам cornerLook
    // (v149) точку взгляда поста отсюда не видно (стоит на краю поста, за углом) —
    // cornerLook вёл "по пути к ней", часто назад; берём видимый проход к врагу
    // (v296, И38, владелец 14.10: T4 шёл в Dark спиной — проход «к врагу» из Lamp Room оказался сзади, в сторону мида) замена не
    // уводит дальше 1,3 рад (75°) от самого угла поста — то же правило, что у «угла по пути» (cornerLook, v287)
    if(BAL.enemyward && !hasLOS(b.x, b.y, b.post.look.x, b.post.look.y, b.z)){ var ew0 = enemywardLook(team, b);
      if(ew0 && _angOff(Math.atan2(ew0.y-b.y, ew0.x-b.x), Math.atan2(b.post.look.y-b.y, b.post.look.x-b.x)) <= 1.3) pl = ew0; }
    // (v149) угол поста смотрит в тыл (заданная точка оказалась в своём коридоре) —
    // берём видимый проход, откуда враг придёт раньше всего
    if(BAL.enemyward){ var zpl = bzOf(pl.x, pl.y), zbb = bzOf(b.x, b.y);
      if(zpl >= 0 && zbb >= 0 && zpl !== zbb && isRearZone(team, zbb, zpl, b) || Math.hypot(pl.x-b.x, pl.y-b.y) < 60){ var ew = enemywardLook(team, b); if(ew) pl = cornerLook(b, ew) || ew; } }
    out.push({j:"post"+b.id, pt:pl, sc:LOOK.postBase, fresh:false, a:Math.atan2(pl.y-b.y, pl.x-b.x), f: D ? [["угол поста по сетапу", LOOK.postBase]] : null}); }
  // (v328, М45, отметка владельца: zont1x в коридоре у Short смотрел в стену «как у про», хотя команда 3 с назад видела
  // последнего CT на A) команда знает, где враг (видели / слышали ≤ KNOWN_SEC), — смотреть туда, откуда он придёт: вдоль
  // своего пути к нему, на дальнюю видимую точку этого пути (до 400 ед.). Вес KNOWN_W — проектное число
  var kw = knownWayLook(b);
  // (v441, док владельца 27.10, р1: m0NESY и karrigan шли к Van и смотрели назад на Kitchen — «путь» к sh1ro на T Spawn; замер: 36 % этого
  // взгляда на ходу — за спиной) на ходу — те же множители, что у остальных вариантов («по ходу» / «за спиной»); раньше их не было
  if(kw){ var kwa = Math.atan2(kw.pt.y-b.y, kw.pt.x-b.x), kws = kw.sc, kwF = D ? [["путь к известному врагу ("+kw.id+", "+kw.age.toFixed(1)+" с)", kw.sc]] : null;
    if(moving){ var kwh = _angOff(kwa, b.heading); if(kwh < 0.9){ kws *= LOOK.headK; if(kwF) kwF.push(["по ходу", LOOK.headK]); }
      else if(kwh > 1.9){ kws *= rearCov ? LOOK.behindMoveCov : LOOK.behindMove; if(kwF) kwF.push([rearCov ? "за спиной (прикрыт)" : "за спиной", rearCov ? LOOK.behindMoveCov : LOOK.behindMove]); } }
    out.push({j:"known", pt:kw.pt, sc:kws, fresh:false, a:kwa, f:kwF}); }
  return out;
}
var KNOWN_SEC = 10, KNOWN_W = 0.2;
function knownWayLook(b){
  var BL = beliefLast[b.team] || {}, best = null;
  for(var id in BL){ var l = BL[id]; if(!l) continue; var age = (tick - l.tick)/TICK_HZ; if(age > KNOWN_SEC) continue;
    var e = bots.filter(function(o){ return o.id === id; })[0]; if(!e || !e.alive) continue;   // жив — видно по табло
    if(!best || age < best.age) best = {id:id, x:l.x, y:l.y, age:age}; }
  if(!best || Math.hypot(best.x-b.x, best.y-b.y) < 120) return null;
  var P = buildWaypointPath(b.x, b.y, b.z, best.x, best.y, null, b.team); if(!P || !P.length) return null;
  var px = b.x, py = b.y, walked = 0, far = null;
  for(var i=0;i<P.length && walked < 400;i++){
    var qx = P[i][0], qy = P[i][1], L = Math.hypot(qx-px, qy-py), n = Math.max(1, Math.ceil(L/20));
    for(var k=1;k<=n && walked < 400;k++){ var x = px+(qx-px)*k/n, y = py+(qy-py)*k/n; walked += L/n;
      if(!hasLOS(b.x, b.y, x, y, b.z)){ i = P.length; break; } far = {x:x, y:y}; }
    px = qx; py = qy;
  }
  if(!far || Math.hypot(far.x-b.x, far.y-b.y) < 60) return null;
  return {pt:far, sc:KNOWN_W*Math.exp(-best.age/KNOWN_SEC), id:best.id, age:best.age};
}
// раз в 8 тиков: кандидаты всем + делёж направлений внутри команды
function lookPlan(team){
  PORTAL_W[team] = portalWatched(team);
  posClearTick(team);
  var W = PORTAL_W[team];
  var list = bots.filter(function(b){ return b.alive && b.team === team && !b._sawEnemy; });
  list.forEach(function(b){
    b._lkC = lookCands(b, W);
    // инерция: текущее направление получает бонус
    b._lkC.forEach(function(c){ if(c.j === b._lkZ){ c.sc *= LOOK.stick; if(c.f) c.f.push(["уже смотрит сюда", LOOK.stick]); } });
    b._lkPick = null;
  });
  // жадный делёж: самый важный угол команды берёт тот, у кого он важнее всего
  var left = list.slice();
  while(left.length){
    var bestB = null, bestC = null;
    left.forEach(function(b){ b._lkC.forEach(function(c){ if(!bestC || c.sc > bestC.sc){ bestC = c; bestB = b; } }); });
    if(!bestB){ left.forEach(function(b){ b._lkPick = null; }); break; }
    bestB._lkPick = bestC;
    left.splice(left.indexOf(bestB), 1);
    if(!(bestC.sc < LOOK.claimMin)) left.forEach(function(o){ if(Math.hypot(o.x-bestB.x, o.y-bestB.y) > LOOK.claimR) return;
      o._lkC.forEach(function(c){ if(c.fresh) return;
        if(c.j === bestC.j || Math.hypot(c.pt.x-bestC.pt.x, c.pt.y-bestC.pt.y) < 220){ c.sc *= LOOK.claim; if(c.f) c.f.push(["угол держит " + bestB.id, LOOK.claim]); } }); });
  }
  // инерция по времени + итог
  list.forEach(function(b){
    var p = b._lkPick, why = [];
    if(p && p.sc < LOOK.minScore){ why.push("лучший угол слабее порога " + LOOK.minScore); p = null; }
    if(p && b._lkZ != null && p.j !== b._lkZ && !p.fresh && tick - (b._lkSince||0) < LOOK.minDwell){
      var cur = b._lkC.filter(function(c){ return c.j === b._lkZ; })[0];
      if(cur && p.sc < LOOK.switchK * cur.sc){ why.push("держит старый угол: новый не в " + LOOK.switchK + " раза сильнее"); p = cur; }
    }
    // (v260, В3) стоя без свежей инфы — изредка проверяет второй сильный угол, если он сбоку/за спиной
    // (игрок на месте не держит спиной вход, откуда тоже могут прийти). Угол, который держит тиммейт, уже
    // ослаблен дележом выше и сюда не проходит. Числа LOOK.check* — проектные
    if(p && !p.fresh && !(b.curSpeed > 60*SPD_K)){
      var cc = (b._chk && tick < b._chk.until) ? b._lkC.filter(function(c){ return c.j === b._chk.j; })[0] : null;
      if(cc && cc.sc >= LOOK.minScore) p = cc;
      else if(tick >= (b._chkNext||0)){
        var alt = null;
        b._lkC.forEach(function(c){ if(c.fresh || c.j === p.j || c.sc < LOOK.checkK*p.sc/(p.j === b._lkZ ? LOOK.stick : 1) || _angOff(c.a, p.a) < LOOK.checkAng) return; if(!alt || c.sc > alt.sc) alt = c; });
        if(alt){ b._chk = {j:alt.j, until: tick + Math.round(LOOK.checkDur*TICK_HZ)}; p = alt; why.push("проверяет второй угол");
          b._chkNext = tick + Math.round((1 + hashRand(tick*7 + b.id.charCodeAt(b.id.length-1)*13)) * LOOK.checkEvery*TICK_HZ); }
      }
    } else b._chk = null;
    if((p ? p.j : null) !== b._lkZ){ b._lkSince = tick; b._lkZ = p ? p.j : null; }
    b._lkPt = p ? p.pt : null;
    if(LOOKDBG.on) b._ldPlan = {tick: tick, pick: p ? p.j : null, why: why, cands: b._lkC.map(function(c){ return {j: c.j, pt: c.pt, src: c.src, pos: c.pos, sc: c.sc, f: c.f, fresh: c.fresh, snd: c.snd, pro: c.pro}; })};
    b._lkTop = b._lkC.slice().sort(function(x, y){ return y.sc - x.sc; }).slice(0, 3).map(function(c){ return [c.pro ? "как у про" : c.snd ? "звук/контакт" : typeof c.j === "string" ? "свой угол" : c.j >= 1000 ? "выход из " + (ZONE_NAMES[BZ.ids[c.j-1000]] || BZ.ids[c.j-1000]) : (ZONE_NAMES[BZ.ids[c.j]] || BZ.ids[c.j]), c.sc]; });
  });
}
// итоговая точка взгляда бота (кроме "вижу врага" — это выше)
// ---------- (v153) плавный взгляд ----------
// У про взгляд "туда-обратно" больше 45° за полсекунды — 0,8 раза в минуту,
// у ботов было 4,6: каждые 8 тиков делёж углов в команде мог перекинуть
// бота на другой вход и тут же вернуть. Теперь: без срочной причины новое
// направление принимается, только если старое продержалось ≥0,8с (стоя) /
// 0,5с (на ходу), и не возвращаемся к только что брошенному направлению 1,5с.
var SL = {holdStand: 51, holdMove: 32, backBlock: 96, holdAlert: 16, backAlert: 40, same: 0.35, calmRate: 4.5, ease: 0.2, minStep: 0.012,
          glEvery: [70, 120], glDur: 44, glMin: 0.55, glMax: 2.2, glSc: 0.05};
// 2 — бой (враг виден, прикрытие ослеплённого, спам, бросок): без фильтра;
// 1 — тревога (свежий звук/контакт рядом): поворот быстрый, но тоже без
//     метаний — держит новое направление хотя бы 0,25с; 0 — спокойно
var LOOK_REPLAN = {CT:false, T:false};   // (v291) фраг — пересчитать оценку взгляда команды стрелка на следующем тике
function lookUrgent(b){
  // (v291, И32) лучший вариант оценки — свежая угроза: «плавность» не держит прежний спокойный угол (раньше держала 0,7 с —
  // игрок 6 после фрага смотрел на Mid, пока второй T выходил из T Lower)
  if(b.lookReason === "look" && b._lkPick && b._lkPick.fresh) return 2;
  if(b._sawEnemy || b._lookLvl >= LOOK_LEVEL.fight) return 2;   // (v381) уровень «бой» арбитра: контакт, спам, второй угол
  if(b._lookLvl >= LOOK_LEVEL.team) return 1;                   // (v381) свежий звук / смерть рядом / инфа команды ≤ 1 с
  if(b.planting || b.defusing) return 2;
  if(tick < (b.blindUntil||0) + 32) return 2;
  if(b.lastIntel && tick - b.lastIntel.tick < 48) return 1;
  var hs = b.heardSound;
  if(hs && hs.team && hs.team !== b.team && tick - hs.tick < 24 && Math.hypot(hs.x-b.x, hs.y-b.y) < 700) return 1;
  // (v261, В6) рядом убили тиммейта (окно размена) или враг шумел совсем близко (≤300 px, ≤1,5 с — те же числа,
  // что у кандидата «звук/контакт») — игрок настороже: поворачивается быстро, не досматривая старый угол
  if(b._tradeLock && tick < b._tradeLock.until) return 1;
  if(hs && hs.team && hs.team !== b.team && tick - hs.tick <= 96 && Math.hypot(hs.x-b.x, hs.y-b.y) < 300) return 1;
  return 0;
}
function smoothLookFilter(b, look, urgent){
  var moving = b.curSpeed > 60*SPD_K && b.heading !== undefined;
  // на бегу без цели — изредка короткий взгляд на опасный угол сбоку
  if(!look && !urgent && moving){
    if(b._gl && tick < b._gl.until) look = b._gl.pt;
    else if(tick >= (b._glNext||0)){
      b._glNext = tick + SL.glEvery[0] + Math.floor(hashRand(tick*13 + b.id.charCodeAt(b.id.length-1)*7)*(SL.glEvery[1]-SL.glEvery[0]));
      var best = null, bs = SL.glSc;
      (typeof lookCands === "function" ? lookCands(b) : []).forEach(function(c){
        if(!c || !c.pt) return;
        var a = Math.atan2(c.pt.y-b.y, c.pt.x-b.x), d = Math.abs(((a-b.heading+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
        if(d < SL.glMin || d > SL.glMax) return;
        if(c.sc > bs){ bs = c.sc; best = c.pt; } });
      if(best){ b._gl = {pt:{x:best.x, y:best.y}, until: tick + SL.glDur}; look = b._gl.pt; b.lookReason = "glance"; }
    }
  } else if(!moving) b._gl = null;
  // (v259, В1) «нет цели — смотрю по ходу» — такое же направление, как любое: держится не меньше holdMove и к
  // только что брошенному углу сразу не возвращаемся. Раньше пропажа цели на ходу сбрасывала память фильтра, и взгляд
  // метался «на угол ↔ по ходу» (матч 1 владельца: 255 раз за матч «туда-сюда» за 1 с)
  // (v283, владелец 14.10: игрок 9 дошёл до поста и ещё 0,7 с смотрел назад на точку, взятую по пути) встал на свой пост —
  // смотрит на свой угол сразу, не «досматривая» дорожную точку
  if(b.atPost && !b._slAtPrev) b._sl = null;
  b._slAtPrev = !!b.atPost;
  var S = b._sl;
  // (v276, владелец 14.10: матч 1, тики 1790–1830, игрок 8 смотрел в стену) держали точку угла у самого носа (55 px —
  // угол по пути, взятый cornerLook), бот прошёл мимо — направление на неё стало «в стену» и держалось ещё 1,5 с
  // запретом «не возвращаться к брошенному». Точку ближе 60 px (проектное число) не держим: такой угол уже пройден
  if(S && S.pt && Math.hypot(S.pt.x-b.x, S.pt.y-b.y) < 60){ b._sl = S = null; }
  // (v278, владелец 14.10: матч 1, тики 1452–1508, игрок 7 крутился в Cave) на бегу повернул — удерживаемая точка осталась
  // за спиной (> 1,9 рад ≈ 110° от направления бега — тот же порог «за спиной на ходу», что во всём взгляде): не держим
  if(S && S.pt && moving && _angOff(Math.atan2(S.pt.y-b.y, S.pt.x-b.x), b.heading) > 1.9){ b._sl = S = null; }
  if(!look){
    if(!moving){ return look; }
    if(urgent === 2){ b._sl = null; return look; }
    if(S && S.pt && tick - S.since < SL.holdMove) return S.pt;                    // угол ещё не «досмотрели»
    if(!S || S.pt) b._sl = {pt:null, since:tick, prev: S ? S.pt : null, left:tick}; // переходим на «по ходу»
    return look;
  }
  var aN = Math.atan2(look.y-b.y, look.x-b.x);
  if(urgent === 2 || !S){ b._sl = {pt:{x:look.x, y:look.y}, since:tick, prev: S ? S.pt : null, left: tick}; return look; }
  if(!S.pt){                                                                     // сейчас смотрит по ходу
    if(moving && tick - S.since < (urgent ? SL.holdAlert : SL.holdMove)) return null;
    if(moving && S.prev && tick - S.since < (urgent ? SL.backAlert : SL.backBlock)){
      var aQ = Math.atan2(S.prev.y-b.y, S.prev.x-b.x), dQ = Math.abs(((aN-aQ+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
      if(dQ < SL.same) return null;                                              // не возвращаемся сразу к брошенному углу
    }
    b._sl = {pt:{x:look.x, y:look.y}, since:tick, prev:null, left:tick}; return look;
  }
  var aS = Math.atan2(S.pt.y-b.y, S.pt.x-b.x);
  var dA = Math.abs(((aN-aS+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
  if(dA < SL.same){ S.pt = {x:look.x, y:look.y}; return look; }            // то же направление — просто уточняем точку
  var hold = urgent ? SL.holdAlert : (moving ? SL.holdMove : SL.holdStand);
  if(tick - S.since < hold) return S.pt;                                    // старое ещё не "досмотрели"
  if(S.prev && tick - S.left < (urgent ? SL.backAlert : SL.backBlock)){                                // не возвращаться сразу к брошенному
    var aP = Math.atan2(S.prev.y-b.y, S.prev.x-b.x);
    var dP = Math.abs(((aN-aP+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
    if(dP < SL.same && tick - S.since < (urgent ? SL.backAlert : SL.backBlock)) return S.pt;
  }
  b._sl = {pt:{x:look.x, y:look.y}, since:tick, prev:S.pt, left:tick};
  return look;
}
// (v273) разбор взгляда: какой бот выбран для показа (галочка «разбор взгляда» + клик по игроку). Только для записи —
// игру не меняет: при включённой галочке каждый бот пишет кандидаты взгляда с множителями, зоны с опасностью и этапы
// выбора (всем — чтобы на паузе можно было переключаться между игроками)
var LOOKDBG = {on: false};
function lookDbgId(){ return LOOKDBG.on && typeof plSelected !== "undefined" ? plSelected : null; }
// ======================= АРБИТР ВЗГЛЯДА (v381, М126 шаг 4) =======================
// Одно место выбора, куда смотрит бот (кроме «вижу врага» — это выше, в resolveEngagements). Механики только предлагают
// кандидатов {уровень, вид, точка, вес}; арбитр берёт верхний уровень таблицы LOOK_LEVEL, внутри уровня — больший вес (свежее,
// ближе, важнее). Кандидаты — только из того, что бот знает: свои уши, радар (что видят свои), войс, киллфид. Роль и ситуация в
// таблицу не входят — они только порождают кандидатов (роумер — точку проверки, пост — свой угол). После выбора — один общий
// шаг lookFilter (не в своего, не в стену, плавность). Порядок — ПРОЕКТНЫЙ (docs/ARCHITECTURE.md, «Арбитр взгляда»).
var LOOK_LEVEL = {
  enemy:  12,  // враг виден (resolveEngagements)
  fight:  11,  // бой: свой закреплённый контакт ≤ 1 с, спам в смок, тиммейт попросил держать второй угол
  sound:  10,  // свои уши ≤ 1 с (шаги, выстрел, граната рядом), убили тиммейта рядом ≤ 3 с (киллфид + радар)
  team:    9,  // команда знает сейчас (видят / слышат / сказали ≤ 1 с)
  angle:   7,  // мой угол: поручен задачей (роум-чек, фейк-дефуз, точка про на посту) или выдан делёжом команды (lookPlan);
               // последняя позиция врага (1–8 с) и контакт старше 1 с — веса внутри дележа, чтобы чередовались с открытыми углами
  corner:  6,  // угол по пути, за которым может быть враг (prePeekTick)
  post:    4   // угол поста по сетапу (делёж ничего не выдал)
};
var LOOK_FRESH = 64;   // 1 с (TICK_HZ): «свежее» для уровней fight / sound / team — проектное число (задача шага 4: «свежий, ≤ 1 с»)
function lookContactFresh(b){
  return !!(b._contact && tick < b._contact.until && tick - Math.max(b._contactT || -1e9, b._lastSawT || -1e9) <= LOOK_FRESH);
}
// точка взгляда на знание «враг там» (звук, контакт, инфа): не сквозь стену, а туда, где он выйдет на линию
function lookKnowPt(b, q, zb, mates, moving){
  var d = Math.hypot(q.x-b.x, q.y-b.y); if(d > 700 || d < 20) return null;
  // (v279, владелец 14.10: якорь B развернулся спиной к Ramp на бой на миде в 650 px) держит пост — дальняя инфа вне его угла не
  // отвлекает (holdRelevant: > 550 px и вне ±66° от угла поста)
  if(!q.commit && !holdRelevant(b, q)) return null;
  var za = Math.atan2(q.y-b.y, q.x-b.x);
  // на бегу за спину — только на самый свежий и близкий (v296, И37: отходя от врага, держит его, если он свежий ≤ 0,3 с или ≤ 250 px)
  if(!q.commit && moving && _angOff(za, b.heading) > 1.9 && q.age > 20 && d > 250) return null;
  // (v280) туда, где враг от шума появится (первая видимая точка его пути ко мне); (v287) видна с места бота — не пересчитывать
  var apf = appearFrom(b, q); if(apf) apf = {x: apf.x, y: apf.y, vis: true};
  var pt = apf || cornerLook(b, q) || openToward(b, za, LOOK.sndOpen);
  // (v281) видимой точки нет — место, где враг на своём пути зайдёт в мою зону
  if(!pt){ var wq0 = buildWaypointPath(q.x, q.y, 0, b.x, b.y, 0) || [];
    for(var wi0 = 0; wi0 < wq0.length; wi0++){ if(bzOf(wq0[wi0][0], wq0[wi0][1]) === zb){ var ep = {x: wq0[wi0][0], y: wq0[wi0][1]}; if(Math.hypot(ep.x-b.x, ep.y-b.y) > 40) pt = ep; break; } } }
  // (v296, И37) враг рядом (≤ 250 px), а ни угла, ни точки появления — смотрим прямо на место, где он был
  if(!pt && d <= 250) pt = {x:q.x, y:q.y};
  if(!pt) return null;
  // (v277) враг от шума к боту сначала выйдет на тиммейта, стоящего на его пути, — угол закрыт им
  var cov = null;
  if(d >= 300){ var wq = buildWaypointPath(q.x, q.y, 0, b.x, b.y, 0) || [];
    cov = mates.filter(function(o){ return wq.some(function(w){ return Math.hypot(w[0]-b.x, w[1]-b.y) > 150 && Math.hypot(w[0]-o.x, w[1]-o.y) <= 120; }); })[0] || null; }
  return {pt: pt, d: d, a: za, cov: cov};
}
// кандидаты уровней fight / sound / team: свежее знание
function lookKnowCands(b){
  var out = [], moving = b.curSpeed > 60*SPD_K && b.heading !== undefined;
  var zb = (b.atPost && b.post) ? bzOf(b.post.x, b.post.y) : bzOf(b.x, b.y); if(zb < 0) zb = bzOf(b.x, b.y);
  var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === b.team; });
  var add = function(lvl, kind, q, k){
    var c = lookKnowPt(b, q, zb, mates, moving); if(!c || (c.cov && !q.commit)) return;   // путь закрывает свой — угол его
    out.push({lvl: lvl, kind: kind, pt: c.pt, sc: LOOK.contactW * (c.d < 300 ? 2 : 1) / (1 + c.d/700) * Math.max(0.05, 1 - q.age/192) * (k || 1)});
  };
  // бой: прикрыть второй угол по просьбе тиммейта, спам в смок, свой контакт (v367; держится, пока видно или видели ≤ 1 с)
  if(b._coverDir && tick < b._coverDir.until && !b._sawEnemy) out.push({lvl: LOOK_LEVEL.fight, kind: "cover", pt: cornerLook(b, b._coverDir.pt) || b._coverDir.pt, sc: 1});
  if(b._spam && tick < b._spam.until) out.push({lvl: LOOK_LEVEL.fight, kind: "spam", pt: b._spam.pt, sc: 2});
  if(lookContactFresh(b)) add(LOOK_LEVEL.fight, "contact", {x: b._contact.x, y: b._contact.y, age: 0, commit: true}, 3);
  // свои уши ≤ 1 с; бросок гранаты рядом — враг точно там (v359)
  var hs = b.heardSound;
  if(hs && tick - hs.tick <= LOOK_FRESH) add(LOOK_LEVEL.sound, "sound", {x: hs.x, y: hs.y, age: tick - hs.tick}, hs.kind === "nade" ? LOOK.freshK : 1);
  // убили тиммейта рядом ≤ 3 с: туда, откуда убили (убийцу видел он — точка на радаре), иначе место смерти
  var sg = teamIntel[b.team] && teamIntel[b.team].sig;
  if(sg) for(var i = sg.length-1; i >= 0; i--){ var s = sg[i]; if(tick - s.tick > 3*TICK_HZ) break;
    if(s.type !== "died" || s.id === b.id) continue;
    add(LOOK_LEVEL.sound, "death", {x: s.kx != null ? s.kx : s.x, y: s.kx != null ? s.ky : s.y, age: tick - s.tick}); break; }
  // команда знает сейчас: видят (радар) / слышали / сказали ≤ 1 с; в упор (≤ 250 px) — та же «свежая угроза», что у зоны
  var BL = beliefLast[b.team] || {};
  for(var eid in BL){ var lo = BL[eid]; if(!lo || tick - lo.tick > LOOK_FRESH) continue;
    var eb = bots.filter(function(o){ return o.id === eid; })[0]; if(!eb || !eb.alive) continue;
    add(LOOK_LEVEL.team, "team", {x: lo.x, y: lo.y, age: tick - lo.tick}, lo.src === "spotted" && Math.hypot(lo.x-b.x, lo.y-b.y) <= 250 ? LOOK.freshK : 1); }
  return out;
}
// уровень angle: угол, поручённый задачей, иначе угол из дележа команды
function lookAngleCand(b, moving){
  if(b.roamChecking && b.roamLookPt) return {lvl: LOOK_LEVEL.angle, kind: "roam", pt: b.roamLookPt, sc: 1};
  if(b.fakeHoldUntil && tick < b.fakeHoldUntil && bomb && bomb.site) return {lvl: LOOK_LEVEL.angle, kind: "fake", pt: GEO[bomb.site].tEntry, sc: 1};
  if(BAL.proSpots && b.atPost && b.post && b.post.pro && !moving){ var plk = proSpotLook(b); if(plk) return {lvl: LOOK_LEVEL.angle, kind: "pro", pt: plk, sc: 1}; }
  if(!b._lkPt) return null;
  // (v259, В2) после планта на бегу не идёт спиной вперёд ради угла из дележа (догадка, не свежая угроза): смотрит, куда идёт.
  // Отход (repos, flee, save) — исключение. После планта у ботов спиной было T 20 % / CT 15 %, у про 10 / 6,5 %
  if(moving && bomb && bomb.state === "planted" && !(b.post && /^(repos|flee|save)/.test(b.post.tag||"")) && !(b.lastIntel && tick - b.lastIntel.tick < CAUTION_TICKS) &&
     _angOff(Math.atan2(b._lkPt.y-b.y, b._lkPt.x-b.x), b.heading) > 1.9) return null;
  return {lvl: LOOK_LEVEL.angle, kind: "look", pt: (b._lkPt.vis ? b._lkPt : cornerLook(b, b._lkPt)) || b._lkPt, sc: 1};
}
function lookArbiter(b){
  var moving = b.curSpeed > 60*SPD_K && b.heading !== undefined;
  var C = lookKnowCands(b), ang = lookAngleCand(b, moving);
  if(ang) C.push(ang);
  else {
    // (v135) угол по пути, за которым может быть враг: прицел на край
    var P = b._pie; if(P && P.danger > 0 && tick - P.t < 16 && P.dist < 320 && hasLOS(b.x, b.y, P.pt.x, P.pt.y, b.z)) C.push({lvl: LOOK_LEVEL.corner, kind: "corner", pt: P.pt, sc: P.danger});
    if(!moving && b.atPost && b.post && b.post.look) C.push({lvl: LOOK_LEVEL.post, kind: "post", pt: cornerLook(b, b.post.look) || b.post.look, sc: 1});
  }
  var best = null;
  C.forEach(function(c){ if(c.pt && (!best || c.lvl > best.lvl || c.lvl === best.lvl && c.sc > best.sc)) best = c; });
  b._lookLvl = best ? best.lvl : 0; b.lookReason = best ? best.kind : null;
  if(LOOKDBG.on) b._ldArb = C.map(function(c){ return {lvl: c.lvl, kind: c.kind, sc: c.sc, pt: c.pt}; });
  return best ? best.pt : null;
}
// общий шаг после выбора: не в спину своему, не в стену, плавный поворот (на бегу без цели — по ходу)
function lookFilter(b, look, LD){
  if(look && b._lookLvl <= LOOK_LEVEL.angle && lookOnMate(b, look)){ var alt = openDirLook(b);
    if(alt){ look = alt; b.lookReason = "open"; if(LD) LD.steps.push("на линии свой — взял другое открытое направление"); }
    // (v413, Б5д-3) на бегу открытого направления впереди нет — по ходу движения, а не в спину своему
    else if(b.curSpeed > 60*SPD_K){ look = null; b.lookReason = null; if(LD) LD.steps.push("на линии свой, впереди открытого нет — по ходу движения"); } }
  if(look && !/^(enemy|pro)$/.test(b.lookReason || "")){ var lw0 = look; look = openLook(b, look); if(LD && look !== lw0) LD.steps.push("стена по взгляду — взял открытое направление рядом"); }
  if(!b._sawEnemy && !/^(enemy|spam|cover|contact)$/.test(b.lookReason || "")){
    var wla = look ? Math.atan2(look.y-b.y, look.x-b.x) : (!(b.curSpeed > 15*SPD_K) && b.facing !== undefined ? b.facing : null);
    if(wla !== null && flatWallAhead(b, wla, 80)){ var wal = openDirNear(b, wla); look = wal || null; if(wal) b.lookReason = (b.lookReason||"") + "+open"; if(LD) LD.steps.push(wal ? "стена в 80 px — повернул на открытое" : "стена в 80 px — открытого нет"); }
  }
  var urg = lookUrgent(b), lk0 = look;
  look = smoothLookFilter(b, look, urg);
  if(LD){ LD.urgent = urg; if(look !== lk0) LD.steps.push(look ? "плавность: держит прежний угол ещё " + (b._sl ? Math.max(0, ((urg ? SL.holdAlert : (b.curSpeed > 60*SPD_K ? SL.holdMove : SL.holdStand)) - (tick - b._sl.since))/TICK_HZ).toFixed(1) : "?") + " с" : "плавность: пока смотрит по ходу");
    if(b.lookReason === "glance") LD.steps.push("на бегу мельком глянул на опасный угол сбоку"); }
  return {look: look, urgent: urg};
}

// Входы в район (вокруг center, радиус r), взвешенные по тому, сколько врагов
// вероятно за каждым из них. Для выбора позиции: смотреть на главный вход
// (или два), от остальных — закрыться стеной.
function threatEntrances(team, center, r){
  if(!BZ.portal) bzPortals();
  var inside = {}; BZ.cent.forEach(function(c, i){ if(c && Math.hypot(c.x-center.x, c.y-center.y) <= r) inside[i] = 1; });
  var zc = bzOf(center.x, center.y); if(zc >= 0) inside[zc] = 1;
  var E = [];
  Object.keys(inside).forEach(function(is){ var i = +is;
    BZ.nbr[i].forEach(function(nn){ if(inside[nn]) return; var p = BZ.portal[i][nn]; if(!p) return;
      var w = beliefZoneKnown(team, nn);
      BZ.nbr[nn].forEach(function(n2){ if(!inside[n2]) w += LOOK.nbrW * beliefZoneKnown(team, n2); });
      if(!BAL.timing || reachPossible(team, nn)) w += 0.02;
      var m = E.filter(function(e){ return Math.hypot(e.pt.x-p.x, e.pt.y-p.y) < 120; })[0];
      if(m){ m.w += w; } else E.push({pt:p, w:w, z:nn}); }); });
  E.sort(function(a, b){ return b.w - a.w; });
  return E;
}


