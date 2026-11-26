// (18.11, «чинить механику целиком») направление «по ходу» для взгляда — одно место: отходит от известных врагов (знание команды ≤ BACK_KNOW с,
// ближе BACK_R, ход от них дальше 115°) — пятится лицом к ним: «по ходу» / «за спиной» — от направления на врагов, иначе — по ходу движения
function lookHeading(b){
  var h = b.heading; if(h === undefined) return h;
  var BLk = kvLast(b.team), ekx = 0, eky = 0;
  for(var ek in BLk){ var lk = BLk[ek]; if(!lk || tick - lk.tick > BACK_KNOW*TICK_HZ) continue; var eo = teamBot(ek); if(!eo || !eo.alive || eo.team === b.team) continue;
    if(DM.hypot(lk.x-b.x, lk.y-b.y) > BACK_R) continue; var ea = DM.atan2(lk.y-b.y, lk.x-b.x); ekx += DM.cos(ea); eky += DM.sin(ea); }
  return (ekx || eky) && _angOff(DM.atan2(eky, ekx), h) > 2.0 ? DM.atan2(eky, ekx) : h;
}
var BACK_KNOW = 15, BACK_R = 900;   // проектные числа: с — враг, которого знает команда, ещё «тот, от кого отхожу»; ед. карты — и он рядом
function lookCands(b, W){
  return beliefAsBot(b, function(){ return lookCands0(b, W); });
}
function lookCands0(b, W){
  var zb = (b.atPost && b.post) ? bzOf(b.post.x, b.post.y) : bzOf(b.x, b.y);
  if(zb < 0) zb = bzOf(b.x, b.y); if(zb < 0) return [];
  var team = b.team, out = [], moving = b.curSpeed > 60*SPD_K && b.heading !== undefined;
  var atHold = !moving && b.post && b.post.look && DM.hypot(b.post.x-b.x, b.post.y-b.y) < 160;
  var postA = (b.post && b.post.look && !(taskProp(b.post.tag, "saveTask"))) ? DM.atan2(b.post.look.y-(b.post.y||b.y), b.post.look.x-(b.post.x||b.x)) : null;
  var mates = bots.filter(function(o){ return o !== b && o.alive && o.team === team; });
  // (отметка владельца 18.11, м5 р2 т8883, CT3: «зачем стал отворачиваться от врагов» — отходил от известных врагов за укрытие, и «по ходу» /
  // «близко» дали первое место выходу у себя за спиной) отходит от известных врагов (знание команды ≤ BACK_KNOW с, ход от них дальше 115°) —
  // пятится лицом к ним, как живой игрок: «по ходу» и «за спиной» считаются от направления на врагов, а не от хода
  var hdA = moving ? lookHeading(b) : 0;
  // (v583a, Д1, владелец 17.11: «пока бежит, враг всё время смотрел на него справа — не повернулся»; м302 р2, CT2: Tetris за спиной ×0,15
  // «прикрыт», а свой рядом смотрел в другую сторону) спину прикрывает свой рядом (500 px), только если он смотрит туда (mateWatches, 260)
  var rearCov = function(pt){ return moving && mates.some(function(o){ return DM.hypot(o.x-b.x, o.y-b.y) < 500 && mateWatches(o, pt); }); };
  var habZ = {};
  bots.forEach(function(o){ if(!o.alive || o.team === team) return; var h = habitTop(o.id, 2); if(h){ var zh = bzOf(h.x, h.y); if(zh >= 0) habZ[zh] = 1; } });
  var Wd = ZONE_DANGER_W[BZ.ids[zb]] || {}, PW = PORTAL_W[team] || {};
  // (отметка владельца 18.11, м33 р1 т4055, magixx: «смотрел на Doors, потом отвернулся на вход из B Window») угроза из Kitchen шла к входу
  // в мою зону через Doors и Empty — обе я вижу: враг сначала покажется там. Угроза, которая течёт через видимую мне зону, считается у самой
  // этой зоны (её кандидат), а не у точки дальше по его пути (раньше вход в 87 ед. брал «близко ×2» и перевешивал Doors)
  var visZ = {}; (ZONE_DANGER[BZ.ids[zb]]||[]).forEach(function(zid){ var q = BZ.idx[zid]; if(q !== undefined) visZ[q] = 1; });
  var D = LOOKDBG.on ? (b._ldZones = {}) : null, mateZ = {};   // mateZ — зоны, где стоит свой (v583a, Д5): туда не смотрим ни на зону, ни на вход из неё   // (v273) разбор взгляда: только запись для выбранного бота
  (ZONE_DANGER[BZ.ids[zb]]||[]).forEach(function(zid){
    var j = BZ.idx[zid]; if(j === undefined || j === zb) return;
    var cz = BZ.cent[j]; if(!cz || DM.hypot(cz.x-b.x, cz.y-b.y) > LOOK.maxDist){ if(D && cz) D[j] = {skip: "далеко"}; return; }
    if(isRearZone(team, zb, j, b)){ if(D) D[j] = {skip: REAR_WHY}; return; }   // (v148) свой тыл — не угроза
    // 1) сколько врагов оттуда вероятно выйдет
    var th = beliefZoneKnown(team, j), nBest = -1, nVal = 0, dz = D ? (D[j] = {bel: th, nbr: 0, hab: 0, unc: 0, tim: 0, wd: Wd[zid]||0}) : null;
    BZ.nbr[j].forEach(function(nn){ if(nn === zb) return;
      if(!reachPossible(team, nn)) return;
      if(visZ[nn]) return;   // (18.11) враг идёт через зону, которую я вижу, — увижу его там (у её кандидата), а не дальше по пути
      var v = LOOK.nbrW * nbrThreat(team, j, nn, zb);
      if(PW[j+","+nn]) v *= LOOK.watchedNbr;          // вход видит свой — враг выйдет на него первым
      th += v; if(dz) dz.nbr += v; if(v > nVal){ nVal = v; nBest = nn; } });
    if(habZ[j] && (reachPossible(team, j))){ th += LOOK.habitW; if(dz) dz.hab = LOOK.habitW; }
    if(moving){ var uw = LOOK.uncheckW * uncheckedW(team, j); th += uw; if(dz) dz.unc = uw; }   // стоя — держит главный угол, непроверенные углы чекает на ходу
    // тайминг: инфы ещё нет — смотрим туда, где враг МОЖЕТ появиться раньше всего.
    // Зона, куда враг не может попасть незаметно (тупик за спиной своего), даёт 0
    var R = REACH[team];
    if(R){ var rmin = R[j]; BZ.nbr[j].forEach(function(nn){ if(nn !== zb && R[nn] < rmin) rmin = R[nn]; });
      if(isFinite(rmin)){ var tw0 = LOOK.timingW * DM.exp(-Math.max(0, rmin - tick)/(LOOK.timingSec*TICK_HZ)); th += tw0; if(dz) dz.tim = tw0; } }
    if(dz) dz.th = th;
    if(th <= 0){ if(dz) dz.skip = "угрозы нет"; return; }
    // 2) точка взгляда: видимая точка зоны, ближайшая к проходу, откуда идёт угроза
    var ref = (nBest >= 0 && nVal > beliefZoneKnown(team, j)) ? (BZ.portal && BZ.portal[j][nBest]) || BZ.cent[nBest] : null;
    // врага в этой зоне недавно (≤8с) видели/слышали — целимся туда, где он был,
    // а не в любую точку большой зоны (Mid — это полкарты)
    var BLr = kvLast(team), lkBest = null, lkAge = 1e9;
    for(var eidr in BLr){ var lr = BLr[eidr]; if(!lr || tick - lr.tick > 8*TICK_HZ || tick - lr.tick >= lkAge) continue;
      if(bzOf(lr.x, lr.y) !== j) continue;
      var er = bots.filter(function(o){ return o.id === eidr; })[0]; if(!er || !er.alive) continue;
      lkBest = lr; lkAge = tick - lr.tick; }
    if(lkBest && LOOK.lkRef !== false) ref = lkBest;
    var apZ = !lkBest ? appearPoint(b, (nBest >= 0 && nVal > beliefZoneKnown(team, j)) ? nBest : j) : null;
    var smp = ZONE_SAMPLES[zid] || [cz], c = null, cd = Infinity;
    smp.forEach(function(q){ var dq = DM.hypot(q.x-b.x, q.y-b.y); if(dq < 50 || !hasLOS(b.x, b.y, q.x, q.y, b.z)) return;
      var key = ref ? DM.hypot(q.x-ref.x, q.y-ref.y) : dq; if(key < cd){ cd = key; c = q; } });
    if(apZ && bzOf(apZ.x, apZ.y) === j || apZ && (nBest >= 0 && bzOf(apZ.x, apZ.y) === nBest)) c = apZ;
    if(!c){ if(dz) dz.skip = "не видно"; return; }
    var d = DM.hypot(c.x-b.x, c.y-b.y);
    // (v261, В4) точка ближе 200 px, за которой сразу стена, — смотреть некуда (взгляд в стену у носа): не кандидат
    if(d < 200){ var ext = {x:b.x+(c.x-b.x)/d*200, y:b.y+(c.y-b.y)/d*200}; if(!hasLOS(b.x, b.y, ext.x, ext.y, b.z)){ if(dz) dz.skip = "у носа стена"; return; } c = ext; d = 200; }
    var za = DM.atan2(c.y-b.y, c.x-b.x);
    var fresh = freshThreatNear(team, c);
    // 3) оценка
    var sc = th * (0.4 + (Wd[zid]||0)) / (1 + d/(moving ? LOOK.distMove : LOOK.distHold));
    var F = D ? [["угроза зоны", th], ["простреливает меня", 0.4 + (Wd[zid]||0)], ["дистанция " + Math.round(d), 1/(1 + d/(moving ? LOOK.distMove : LOOK.distHold))]] : null;
    var behind = moving ? _angOff(za, hdA) > 1.9 : (atHold && postA !== null && _angOff(za, postA) > 2.2);
    if(d < LOOK.closeR && !behind){ sc *= LOOK.closeK; if(F) F.push(["близко", LOOK.closeK]); }
    if(fresh){ sc *= LOOK.freshK; if(F) F.push(["свежая угроза", LOOK.freshK]); }
    if(postA !== null && _angOff(za, postA) < 0.9){ sc *= LOOK.postK; if(F) F.push(["угол поста", LOOK.postK]); }
    if(moving){ var hd = _angOff(za, hdA); if(hd < 0.9){ sc *= LOOK.headK; if(F) F.push(["по ходу", LOOK.headK]); } else if(hd > 1.9 && !(fresh && d <= 250)){ sc *= rearCov(c) ? LOOK.behindMoveCov : LOOK.behindMove; if(F) F.push([rearCov(c) ? "за спиной (прикрыт)" : "за спиной", rearCov(c) ? LOOK.behindMoveCov : LOOK.behindMove]); } }
    else if(behind && !fresh){ sc *= LOOK.behindHold; if(F) F.push(["за спиной поста", LOOK.behindHold]); }
    if(!fresh){ var mk = lookMateAhead(b, mates, j, c, d, za, F); if(!mk){ mateZ[j] = 1; if(dz) dz.skip = "там стоит свой"; return; } sc *= mk; }
    out.push({j:j, pt:c, sc:sc, fresh:fresh, a:za, f:F});
  });
  // входы в СВОЮ зону: враг из соседней зоны сначала войдёт туда, где стоит бот
  // (раньше такие входы не считались вообще — бот на CT-спавне не смотрел на
  // выходы из Alley/Temple, хотя там был враг). Смотрим на сам проход.
  if(BZ.portal) BZ.nbr[zb].forEach(function(nn){
    var p = BZ.portal[zb][nn]; if(!p) return;
    if(isRearZone(team, zb, nn, b)) return;   // (v148) проход в свой тыл — не угроза
    // (владелец 18.11: «выход из зоны B Window — просто открытое место, зоны — только чтобы обозначить, где враг») зону nn я вижу — врага увижу
    // в ней самой (её кандидат: точка, где он из неё появится), граница зон посреди пола — не выход; вход в мою зону — только из невидимой зоны
    if(visZ[nn]) return;
    var d = DM.hypot(p.x-b.x, p.y-b.y); if(d < 40 || d > LOOK.maxDist || !hasLOS(b.x, b.y, p.x, p.y, b.z)) return;
    var th = beliefZoneKnown(team, nn);
    BZ.nbr[nn].forEach(function(n2){ if(n2 === zb) return; if(!reachPossible(team, n2)) return; if(visZ[n2]) return;
      var v = LOOK.nbrW * nbrThreat(team, nn, n2, zb); if(PW[nn+","+n2]) v *= LOOK.watchedNbr; th += v; });
    if(habZ[nn]) th += LOOK.habitW;
    if(moving) th += LOOK.uncheckW * uncheckedW(team, nn);
    if(th <= 0) return;
    var c = p;
    // (v151) не середина прохода, а место, где враг из этой зоны реально появится
    var ap = appearPoint(b, nn); if(ap){ c = ap; d = DM.hypot(ap.x-b.x, ap.y-b.y); }
    if(d < 200){ var ext = {x:b.x+(c.x-b.x)/d*200, y:b.y+(c.y-b.y)/d*200}; if(hasLOS(b.x, b.y, ext.x, ext.y, b.z)) c = ext; }
    var za = DM.atan2(c.y-b.y, c.x-b.x), fresh = freshThreatNear(team, p);
    var sc = th * LOOK.entryExp / (1 + Math.max(d,200)/(moving ? LOOK.distMove : LOOK.distHold));
    var F = D ? [["угроза за входом", th], ["вход в мою зону", LOOK.entryExp], ["дистанция " + Math.round(d), 1/(1 + Math.max(d,200)/(moving ? LOOK.distMove : LOOK.distHold))]] : null;
    if(D && !D[nn]) D[nn] = {th: th, bel: beliefZoneKnown(team, nn), entry: true};
    var behind = moving ? _angOff(za, hdA) > 1.9 : (atHold && postA !== null && _angOff(za, postA) > 2.2);
    if(d < LOOK.closeR && !behind){ sc *= LOOK.closeK; if(F) F.push(["близко", LOOK.closeK]); }
    if(fresh){ sc *= LOOK.freshK; if(F) F.push(["свежая угроза", LOOK.freshK]); }
    if(postA !== null && _angOff(za, postA) < 0.9){ sc *= LOOK.postK; if(F) F.push(["угол поста", LOOK.postK]); }
    if(moving){ var hd = _angOff(za, hdA); if(hd < 0.9){ sc *= LOOK.headK; if(F) F.push(["по ходу", LOOK.headK]); } else if(hd > 1.9 && !(fresh && d <= 250)){ sc *= rearCov(c) ? LOOK.behindMoveCov : LOOK.behindMove; if(F) F.push([rearCov(c) ? "за спиной (прикрыт)" : "за спиной", rearCov(c) ? LOOK.behindMoveCov : LOOK.behindMove]); } }
    else if(behind && !fresh){ sc *= LOOK.behindHold; if(F) F.push(["за спиной поста", LOOK.behindHold]); }
    if(!fresh){ var mk = mateZ[nn] ? 0 : lookMateAhead(b, mates, nn, c, d, za, F, p); if(!mk) return; sc *= mk; }   // зона за входом выкинута из-за своего — и вход   // (v583a, Д5) вход — то же правило, что зона за ним
    out.push({j:1000+nn, pt:c, sc:sc, fresh:fresh, a:za, f:F});
  });
  // (v281) известные позиции врага (из демок), которые отсюда видно и которые команда ещё не видела пустыми — в т. ч. в своей
  // зоне (раньше своя зона в варианты не входила, и угол внутри большой зоны никто не чекал). Вес — доля опасности зоны
  // по частоте позиции у про (сумма по позициям зоны = опасность зоны, не прибавка), дальше — те же множители, что у зон
  enemyPositions(team).forEach(function(q){
    var d = DM.hypot(q.x-b.x, q.y-b.y); if(d < 60 || d > LOOK.maxDist) return;
    if(posClearValid(team, q.id) || (!reachPossible(team, q.z))) return;
    if(!hasLOS(b.x, b.y, q.x, q.y, b.z)) return;
    var th = beliefZoneKnown(team, q.z);
    BZ.nbr[q.z].forEach(function(nn){ if(nn === zb) return; if(!reachPossible(team, nn)) return; th += LOOK.nbrW * nbrThreat(team, q.z, nn, zb); });
    if(th <= 0) return;
    var za = DM.atan2(q.y-b.y, q.x-b.x), fresh = freshThreatNear(team, q);
    var sc = th * q.frac / (1 + d/(moving ? LOOK.distMove : LOOK.distHold));
    var F = D ? [["опасность зоны " + (zoneUserName(BZ.ids[q.z]) || BZ.ids[q.z]), th], ["доля позиции у про", q.frac], ["дистанция " + Math.round(d), 1/(1 + d/(moving ? LOOK.distMove : LOOK.distHold))]] : null;
    if(fresh){ sc *= LOOK.freshK; if(F) F.push(["свежая угроза", LOOK.freshK]); }
    if(moving){ var hd = _angOff(za, hdA); if(hd < 0.9){ sc *= LOOK.headK; if(F) F.push(["по ходу", LOOK.headK]); } else if(hd > 1.9 && !(fresh && d <= 250)){ sc *= rearCov(q) ? LOOK.behindMoveCov : LOOK.behindMove; if(F) F.push(["за спиной", rearCov(q) ? LOOK.behindMoveCov : LOOK.behindMove]); } }
    else if(atHold && postA !== null && _angOff(za, postA) > 2.2 && !fresh){ sc *= LOOK.behindHold; if(F) F.push(["за спиной поста", LOOK.behindHold]); }
    if(!fresh){ var mk = lookMateAhead(b, mates, q.z, q, d, za, F); if(!mk) return; sc *= mk; }   // (v583a, Д5) то же правило «свой впереди»
    out.push({j: "pos:" + q.id, pt: {x: q.x, y: q.y}, sc: sc, fresh: fresh, a: za, pos: q.id, f: F});
  });
  // (v381, арбитр взгляда) свежее ≤ 1 с (свои уши, команда, закреплённый контакт) — отдельные уровни арбитра (lookKnowCands), здесь
  // не дублируется. Здесь — то, что знали 1–1,5 с назад, и контакт старше 1 с: обычные кандидаты дележа, чтобы взгляд чередовал
  // их с открытыми углами (v375, отметка владельца: T0 смотрел только в смок и открыл спину Jungle и Connector)
  var cts = [];
  var hs = b.heardSound; if(hs && tick - hs.tick > LOOK_FRESH && tick - hs.tick <= 96) cts.push({x:hs.x, y:hs.y, age:tick-hs.tick, kind:hs.kind});
  if(b._contact && tick < b._contact.until && !lookContactFresh(b)) cts.push({x:b._contact.x, y:b._contact.y, age:32});
  var BLc = kvLast(team);
  for(var eid in BLc){ var lo = BLc[eid]; if(tick - lo.tick > 96 || tick - lo.tick <= LOOK_FRESH) continue;
    var eb = bots.filter(function(o){ return o.id === eid; })[0]; if(!eb || !eb.alive || ignoredShooter(b, eid)) continue; cts.push({x:lo.x, y:lo.y, age:tick-lo.tick, seen: lo.src === "spotted"}); }
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
    if(PL){ var ae = DM.atan2(PL.dy, PL.dx), cl = rayClipWalls(b.x, b.y, b.x+PL.dx*420, b.y+PL.dy*420), dl = DM.hypot(cl.x-b.x, cl.y-b.y);
      // (v273, владелец 14.10) направление про упирается в стену (у нас геометрия чуть другая) — не точка на стене, а самое открытое
      // направление в пределах ±30° от него (±30° — проектное число), если там видно дальше
      if(dl < 400){ var opn = openToward(b, ae, 0.52), dop = opn ? DM.hypot(opn.x-b.x, opn.y-b.y) : 0; if(opn && dop > dl + 40){ cl = opn; dl = dop; ae = DM.atan2(opn.y-b.y, opn.x-b.x); } }
      if(dl > 90 && lookMateAhead(b, mates, bzOf(cl.x, cl.y), cl, dl, ae, null)){ var scp = LOOK.proLook * PL.R;   // (v583a, Д5) туда, где свой, — нет
        if(moving){ var hdp = _angOff(ae, hdA); if(hdp < 0.9) scp *= LOOK.headK; else scp = 0; }
        if(scp > 0) out.push({j:"pl", pt:{x:cl.x, y:cl.y}, sc:scp, fresh:false, a:ae, pro:true, f: D ? [["как у про с этой точки", LOOK.proLook], ["доля про", PL.R]] : null}); } } }
  // угол поста по сетапу — тоже кандидат (слабый), чтобы и он шёл через делёж:
  // двое на соседних постах не смотрят в одну точку, когда угроз нет
  if(atHold){ var pl = cornerLook(b, b.post.look) || b.post.look;
    // (v281 → v287) угол «по пути», ушедший от цели > 1,3 рад, правит сам cornerLook
    // (v149) точку взгляда поста отсюда не видно (стоит на краю поста, за углом) —
    // cornerLook вёл "по пути к ней", часто назад; берём видимый проход к врагу
    // (v296, И38, владелец 14.10: T4 шёл в Dark спиной — проход «к врагу» из Lamp Room оказался сзади, в сторону мида) замена не
    // уводит дальше 1,3 рад (75°) от самого угла поста — то же правило, что у «угла по пути» (cornerLook, v287)
    if(!hasLOS(b.x, b.y, b.post.look.x, b.post.look.y, b.z)){ var ew0 = enemywardLook(team, b);
      if(ew0 && _angOff(DM.atan2(ew0.y-b.y, ew0.x-b.x), DM.atan2(b.post.look.y-b.y, b.post.look.x-b.x)) <= 1.3) pl = ew0; }
    // (v149) угол поста смотрит в тыл (заданная точка оказалась в своём коридоре) —
    // берём видимый проход, откуда враг придёт раньше всего
    var zpl = bzOf(pl.x, pl.y), zbb = bzOf(b.x, b.y);
      if(zpl >= 0 && zbb >= 0 && zpl !== zbb && isRearZone(team, zbb, zpl, b) || DM.hypot(pl.x-b.x, pl.y-b.y) < 60){ var ew = enemywardLook(team, b); if(ew) pl = cornerLook(b, ew) || ew; } 
    out.push({j:"post"+b.id, pt:pl, sc:LOOK.postBase, fresh:false, a:DM.atan2(pl.y-b.y, pl.x-b.x), f: D ? [["угол поста по сетапу", LOOK.postBase]] : null}); }
  // (v328, М45, отметка владельца: zont1x в коридоре у Short смотрел в стену «как у про», хотя команда 3 с назад видела
  // последнего CT на A) команда знает, где враг (видели / слышали ≤ KNOWN_SEC), — смотреть туда, откуда он придёт: вдоль
  // своего пути к нему, на дальнюю видимую точку этого пути (до 400 ед.). Вес KNOWN_W — проектное число
  var kw = knownWayLook(b);
  // (v441, док владельца 27.10, р1: m0NESY и karrigan шли к Van и смотрели назад на Kitchen — «путь» к sh1ro на T Spawn; замер: 36 % этого
  // взгляда на ходу — за спиной) на ходу — те же множители, что у остальных вариантов («по ходу» / «за спиной»); раньше их не было
  if(kw){ var kwa = DM.atan2(kw.pt.y-b.y, kw.pt.x-b.x), kws = kw.sc, kwF = D ? [["путь к известному врагу ("+kw.id+", "+kw.age.toFixed(1)+" с)", kw.cov ? kw.sc/LOOK.mateThere : kw.sc]].concat(kw.cov ? [["путь закрывает свой", LOOK.mateThere]] : []) : null;
    if(moving){ var kwh = _angOff(kwa, hdA); if(kwh < 0.9){ kws *= LOOK.headK; if(kwF) kwF.push(["по ходу", LOOK.headK]); }
      else if(kwh > 1.9){ kws *= rearCov(kw.pt) ? LOOK.behindMoveCov : LOOK.behindMove; if(kwF) kwF.push([rearCov(kw.pt) ? "за спиной (прикрыт)" : "за спиной", rearCov(kw.pt) ? LOOK.behindMoveCov : LOOK.behindMove]); } }
    out.push({j:"known", pt:kw.pt, sc:kws, fresh:false, a:kwa, f:kwF}); }
  return out;
}
var KNOWN_SEC = 10, KNOWN_W = 0.2;
var KWL_CELL = 24, KWL_TTL = 32;   // проектные числа
// (v583a, Д5, владелец 17.11: «туда, где стоит свой, смотреть не нужно — враг встретит его первым; один вход с разных сторон — нужно»)
// свой впереди на угрозу — одно правило для зоны и для входа в неё (раньше у входа — только «свой в 140 px от прохода»: T3 у B Window
// смотрел на выход из Kitchen, где стоял T4): свой у точки появления (140 px) или в самой зоне угрозы рядом с ней (260 px) — 0 (не смотреть);
// свой на моей линии к ней — «свой на линии». Множитель веса; F — разбор
// пол в точке c, который видно с глаз бота (из всех полов этой точки по 3D-геометрии; не видно ни один — null)
function lookPtFloor(b, c){
  var M = typeof m3 === "function" ? m3() : null; if(!M || b.z == null) return null;
  var ez = visFloorAt(b.x, b.y, b.z) + VIS_EYE.stand, F = m3Floors(M, c.x, c.y).slice().sort(function(p, q){ return Math.abs(p - b.z) - Math.abs(q - b.z); });
  for(var i = 0; i < F.length; i++) if(visMarch(b.x, b.y, ez, c.x, c.y, F[i] + VIS_BODY.stand[0])) return F[i];
  return null;
}
// свой на том же уровне, что точка взгляда (этаж zf — lookPtFloor): иначе он стоит над / под ней и угол не закрывает. Одно место для «там стоит
// свой» (lookMateAhead) и «на линии свой» (здесь и lookOnMate, 250); на линии — свой на моём уровне или на уровне точки
function mateOnLevel(o, zf){ return zf == null || o.z == null || Math.abs(o.z - zf) <= 2*JUMP_UP; }
function lookMateAhead(b, mates, j, c, d, za, F, p){
  // (отметка владельца 18.11, м1 р2: «игрок 5 не учитывает Under»; «чинить механику целиком» — этаж) свой «там» — только на том этаже, где точка
  // угрозы, которую вижу я (пол в точке c, видимый с моих глаз): над Underpath стоять — не значит держать Underpath. Было: 140 ед. на плоскости
  var zf = lookPtFloor(b, c), lvl = function(o){ return mateOnLevel(o, zf); };
  if(mates.some(function(o){ return lvl(o) && (DM.hypot(o.x-c.x, o.y-c.y) < 140 || (p && DM.hypot(o.x-p.x, o.y-p.y) < 140) || (bzOf(o.x, o.y) === j && DM.hypot(o.x-c.x, o.y-c.y) < 260)); })) return 0;   // (владелец 17.11, второй раз: «зачем смотрит выход, если там стоит тиммейт») — не кандидат вовсе (было ×0,15)
  if(mates.some(function(o){ var dm = DM.hypot(o.x-b.x, o.y-b.y); return (lvl(o) || mateOnLevel(o, b.z)) && dm > 20 && dm < Math.min(d, 600) && _angOff(DM.atan2(o.y-b.y, o.x-b.x), za) < 0.22; })){ if(F) F.push(["свой на линии", LOOK.mateInLine]); return LOOK.mateInLine; }
  return 1;
}
function knownWayLook(b){
  var BL = kvLast(b.team), best = null;
  for(var id in BL){ var l = BL[id]; if(!l) continue; var age = (tick - l.tick)/TICK_HZ; if(age > KNOWN_SEC) continue;
    var e = bots.filter(function(o){ return o.id === id; })[0]; if(!e || !e.alive) continue;   // жив — видно по табло
    if(!best || age < best.age) best = {id:id, x:l.x, y:l.y, age:age}; }
  if(!best || DM.hypot(best.x-b.x, best.y-b.y) < 120) return null;
  // (Д3, скорость; облако м7: в долгих тиках поиск пути зовут прежде всего отсюда — путь к известному врагу каждый тик каждого бота с
  // точной позиции) путь — тот же, пока бот в той же клетке KWL_CELL и враг (и его место — с той же клеткой) тот же, не дольше KWL_TTL тиков
  // (проектные числа, как кэш appearPoint — клетка 24). Сдвигает игру на доли — проверка прогоном
  var KC = b._kwl, kk = best.id+"|"+Math.round(best.x/KWL_CELL)+","+Math.round(best.y/KWL_CELL)+"|"+Math.round(b.x/KWL_CELL)+","+Math.round(b.y/KWL_CELL);
  var P = KC && KC.k === kk && tick - KC.t <= KWL_TTL && KC.t <= tick ? KC.P : null;
  if(!P){ P = buildWaypointPath(b.x, b.y, b.z, best.x, best.y, null, b.team); b._kwl = {k:kk, t:tick, P:P}; }
  if(!P || !P.length) return null;
  var px = b.x, py = b.y, walked = 0, far = null;
  for(var i=0;i<P.length && walked < 400;i++){
    var qx = P[i][0], qy = P[i][1], L = DM.hypot(qx-px, qy-py), n = Math.max(1, Math.ceil(L/20));
    for(var k=1;k<=n && walked < 400;k++){ var x = px+(qx-px)*k/n, y = py+(qy-py)*k/n; walked += L/n;
      if(!hasLOS(b.x, b.y, x, y, b.z)){ i = P.length; break; } far = {x:x, y:y}; }
    px = qx; py = qy;
  }
  if(!far || DM.hypot(far.x-b.x, far.y-b.y) < 60) return null;
  // (Г2, 04.11, разбор отметок п.28: T1 смотрел в андер, где стоит T0) на этом пути стоит свой — враг сначала выйдет на него: путь закрыт
  // своим — то же правило, что у взгляда на звук (lookKnowPt: «путь закрывает свой» → LOOK.mateThere)
  var cov = bots.some(function(o){ return o !== b && o.alive && o.team === b.team && P.some(function(w){ return DM.hypot(w[0]-b.x, w[1]-b.y) > 60 && DM.hypot(w[0]-o.x, w[1]-o.y) <= 120; }); });
  return {pt:far, sc:KNOWN_W*DM.exp(-best.age/KNOWN_SEC)*(cov ? LOOK.mateThere : 1), id:best.id, age:best.age, cov:cov};
}
// раз в 8 тиков: кандидаты всем + делёж направлений внутри команды
var LOOK_SMOKE_K = 0.6;   // (владелец 17.11: «дым тоже надо смотреть») проектное: видимый угол той же угрозы важнее, но дым не выпадает; угол в дым закрепляется за взявшим — смотрит один
function lookPlan(team){
  PORTAL_W[team] = portalWatched(team);
  posClearTick(team);
  var W = PORTAL_W[team];
  var list = bots.filter(function(b){ return b.alive && b.team === team && !b._sawEnemy; });
  list.forEach(function(b){
    b._lkC = lookCands(b, W);
    // (v583a, владелец 17.11: «игрок 3 смотрит в смок, а Short никто не видит») угол, на который у меня линия закрыта дымом, — мне виден только
    // край дыма: вес ×LOOK_SMOKE_K (проектное число); свежий (только что видел / слышал) — как есть
    if(smokes.length) b._lkC.forEach(function(c){ if(!c.fresh && c.pt && smokeBlocks(b.x, b.y, c.pt.x, c.pt.y)){ c.sc *= LOOK_SMOKE_K; if(c.f) c.f.push(["в дым", LOOK_SMOKE_K]); } });
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
    if(!(bestC.sc < LOOK.claimMin)) left.forEach(function(o){ if(DM.hypot(o.x-bestB.x, o.y-bestB.y) > LOOK.claimR) return;
      o._lkC.forEach(function(c){ if(c.fresh) return;
        if(c.j === bestC.j || DM.hypot(c.pt.x-bestC.pt.x, c.pt.y-bestC.pt.y) < 220){ c.sc *= LOOK.claim; if(c.f) c.f.push(["угол держит " + bestB.id, LOOK.claim]); } }); });
  }
  // инерция по времени + итог
  list.forEach(function(b){
    var p = b._lkPick, why = [];
    if(p && p.sc < LOOK.minScore){ why.push("лучший угол слабее порога " + LOOK.minScore); p = null; }
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
    if((p ? p.j : null) !== b._lkZ){ b._lkZ = p ? p.j : null; }
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
// направление принимается, только когда старое продержалось срок удержания (slHold — паузы про из демок, В147).
// (15.11, перестройка, фаза 3 шаг 3) удержание взгляда — одно: slHold. Убраны дубли по проектным числам: «не менять зону раньше
// LOOK.minDwell» (48 тиков, lookPlan) и «не возвращаться к брошенному углу» SL.backBlock / backAlert (96 / 40 тиков) с исключением
// lookPtAlive (v448) — держали взгляд в ≈ 2 % решений каждый, slHold — в 37 % (замер 15.11, 2 матча Mirage).
var SL = {refine: 0.09,
          glEvery: [70, 120], glDur: 44, glMin: 0.55, glMax: 2.2, glSc: 0.05};
// 2 — бой (враг виден, прикрытие ослеплённого, спам, бросок): без фильтра;
// 1 — тревога (свежий звук/контакт рядом): поворот быстрый, но тоже без
//     метаний — держит новое направление хотя бы 0,25с; 0 — спокойно
var LOOK_REPLAN = {CT:false, T:false};   // (v291) фраг — пересчитать оценку взгляда команды стрелка на следующем тике
function lookUrgent(b){
  // (v291, И32) лучший вариант оценки — свежая угроза: «плавность» не держит прежний спокойный угол (раньше держала 0,7 с —
  // игрок 6 после фрага смотрел на Mid, пока второй T выходил из T Lower)
  // (В147, 15.11) свежая угроза из дележа — «тревога» (1): поворот сразу, новое направление держится по паузам про в перестрелке (slHold).
  // Было 2 (без фильтра): точка свежего угла перескакивала при каждом пересчёте дележа — стоя 3,4 крупных поворота в мин
  if(b.lookReason === "look" && b._lkPick && b._lkPick.fresh) return 1;
  if(b.lookReason === "jump") return 2;   // (v551) разворот к прыжку — сразу (иначе «плавность» держала прежний угол, бот прыгал боком)
  if(b._sawEnemy || b._lookLvl >= LOOK_LEVEL.fight) return 2;   // (v381) уровень «бой» арбитра: контакт, спам, второй угол
  if(b._lookLvl >= LOOK_LEVEL.team) return 1;                   // (v381) свежий звук / смерть рядом / инфа команды ≤ 1 с
  if(b.planting || b.defusing) return 2;
  if(tick < (b.blindUntil||0) + 32) return 2;
  if(b.lastIntel && tick - b.lastIntel.tick < 48) return 1;
  var hs = b.heardSound;
  if(hs && hs.team && hs.team !== b.team && tick - hs.tick < 24 && DM.hypot(hs.x-b.x, hs.y-b.y) < 700) return 1;
  // (v261, В6) рядом убили тиммейта (окно размена) или враг шумел совсем близко (≤300 px, ≤1,5 с — те же числа,
  // что у кандидата «звук/контакт») — игрок настороже: поворачивается быстро, не досматривая старый угол
  if(tradeGoing(b)) return 1;
  if(hs && hs.team && hs.team !== b.team && tick - hs.tick <= 96 && DM.hypot(hs.x-b.x, hs.y-b.y) < 300) return 1;
  return 0;
}
// (В147) сколько держать взгляд на точке — жребием по распределению про для ситуации (стоит / шагом / бегом), MAP.turnmodel.dwell (квантили
// 10/25/50/75/90 пауз между поворотами ≥ 5°, tools/measure/motion/pro_dwell.py): стоя у про медиана 59 тиков, у четверти — 200+. Было: минимум
// SL.holdStand 51 / holdMove 32 тика (проектные) — боты перекладывали взгляд в 2–3 раза чаще про (поворотов 140 в мин против 82)
function slHold(b, S, moving, alert){   // alert — тревога (lookUrgent 1): паузы про в перестрелке (dwell.fight)
  if(S.hold != null) return S.hold;
  var TMd = MAP.turnmodel, DW = TMd && TMd.dwell, sit = alert ? "fight" : !moving ? "stand" : (b.walking ? "walk" : "run"), q = DW && DW[sit];
  if(alert) DW = TMd && TMd.dwell, q = DW && DW.fight;
  if(!q) return (S.hold = moving ? 32 : 51);
  var u = hashRand(tick*37 + b.id.charCodeAt(b.id.length-1)*19 + b.id.charCodeAt(0)), P = [[0, q[0]*0.6], [0.1, q[0]], [0.25, q[1]], [0.5, q[2]], [0.75, q[3]], [0.9, q[4]], [1, q[4]*1.5]], h = q[4];
  for(var i = 1; i < P.length; i++) if(u <= P[i][0]){ h = P[i-1][1] + (P[i][1] - P[i-1][1])*(u - P[i-1][0])/(P[i][0] - P[i-1][0]); break; }
  return (S.hold = Math.round(h));
}
// (v583a, Д1 / Д4, владелец 17.11: «смотрит в старую сторону, хотя угроза важнее», «смотрит правее, пока идёт») что держит плавность:
// зону плана (её ключ j в дележе) или замену без угрозы («open» — на линии свой / стена, «glance» — мельком на ходу). Живой игрок держит
// проход, а не точку: пока идёт, прицел остаётся на той же зоне; и досматривает угол, только пока другой не стал важнее
var SL_MORE = 2, SL_THREAT = 1;   // проектные числа: SL_MORE — новый угол «важнее» держимого, если его вес в дележе хотя бы вдвое больше (меньше — паузы про, slHold)
// SL_THREAT — «настоящая угроза» в дележе (вес ≈ один вероятный враг): мелочь (0,05–0,3) переставляется сама и на ходу удержание не снимает
// (владелец 17.11, кадр +3,6 с: T3 на уходе от бомбы развернулся на 113° к B Site из-за мелькания плана на 0,08 с)
function slKey(b){ return b.lookReason === "look" && b._lkPick ? b._lkPick.j : (b.lookReason || null); }
function slSub(k){ return typeof k === "string" && /(open|^glance)$/.test(k); }   // замена без угрозы — не досматривается ради угрозы
function slVal(b, k){ var c = (b._lkC || []).filter(function(x){ return x.j === k; })[0]; return c ? c.sc : 0; }   // вес зоны k в текущем дележе
function slNew(b, pt){ return (b._sl = {pt: pt ? {x: pt.x, y: pt.y} : null, since: tick, key: pt ? slKey(b) : null, plan: !!pt && b.lookReason === "look" && !!b._lkPick, val: pt && b._lkPick ? (b._lkPick.sc || 0) : 0, lvl: pt ? b._lookLvl : 0}); }
// (К3) вход за спиной, откуда команда допускает врага, — для того, кто идёт последним: своих позади (в REAR_MATE_R, за линией плеч) нет.
// REAR_MATE_R, радиус входов 400 — проектные числа
var REAR_MATE_R = 500, REAR_EVERY = [3, 6];
function lookRearThreat(b){
  var hd = lookHeading(b); if(hd == null) return null;
  var behind = function(x, y){ return DM.cos(DM.atan2(y-b.y, x-b.x) - hd) < 0; };
  if(bots.some(function(o){ return o !== b && o.alive && o.team === b.team && DM.hypot(o.x-b.x, o.y-b.y) < REAR_MATE_R && behind(o.x, o.y); })) return null;
  var best = null;
  threatEntrances(b.team, {x:b.x, y:b.y}, 400).forEach(function(e){ if(e.w >= LOOK.claimMin && _angOff(DM.atan2(e.pt.y-b.y, e.pt.x-b.x), hd) > SL.glMax && (!best || e.w > best.w)) best = {pt:e.pt, w:e.w}; });
  return best;
}
function smoothLookFilter(b, look, urgent){
  var moving = b.curSpeed > 60*SPD_K && b.heading !== undefined;
  // (18.11, владелец: «чередовать») стоя с поручённым углом — мельком на второй угол (lookAssigned) по тем же часам, что на ходу
  if(!urgent && !moving && b._lkAltPt && look){
    if(b._gl && tick < b._gl.until){ look = b._gl.pt; b.lookReason = "glance"; }
    else if(tick >= (b._glNext||0)){
      if(b._glNext) { b._gl = {pt:{x:b._lkAltPt.x, y:b._lkAltPt.y}, until: tick + SL.glDur}; look = b._gl.pt; b.lookReason = "glance"; }
      b._glNext = tick + SL.glEvery[0] + Math.floor(hashRand(tick*13 + b.id.charCodeAt(b.id.length-1)*7)*(SL.glEvery[1]-SL.glEvery[0]));
    }
  }
  // на бегу без цели — изредка короткий взгляд на опасный угол сбоку
  else if(!look && !urgent && moving){
    // (19.11, видео пробы CT0: «что за точки взгляда» — взгляд назад на Balcony держался секундами) мельком — весь срок с пометкой «glance»: без неё со
    // второго тика удержание принимало точку за угол плана и держало после конца взгляда
    if(b._gl && tick < b._gl.until && (tick & 3 || lookVisible(b, b._gl.pt))){ look = b._gl.pt; b.lookReason = "glance"; }   // скрылась за стеной — мельком кончился
    else if(tick >= (b._glNext||0)){
      b._glNext = tick + SL.glEvery[0] + Math.floor(hashRand(tick*13 + b.id.charCodeAt(b.id.length-1)*7)*(SL.glEvery[1]-SL.glEvery[0]));
      var best = null, bs = SL.glSc;
      (typeof lookCands === "function" ? lookCands(b) : []).forEach(function(c){
        if(!c || !c.pt) return;
        var a = DM.atan2(c.pt.y-b.y, c.pt.x-b.x), d = Math.abs(((a-lookHeading(b)+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
        if(d < SL.glMin || d > SL.glMax) return;
        if(c.sc > bs){ bs = c.sc; best = c.pt; } });
      // (К3, владелец 18.11: «T должны понимать, что их могут обходить») идёт последним (своих за спиной нет) — мельком и назад, на вход сзади,
      // где команда допускает врага (threatEntrances: ожидание зон по таймингам / инфе), если он весомее найденного сбоку
      // назад — реже, чем вбок: раз в REAR_EVERY с (случайно в диапазоне; проектные числа)
      var rr = tick >= (b._rearNext || 0) ? lookRearThreat(b) : null; if(rr && rr.w > bs){ bs = rr.w; best = rr.pt; b._rearNext = tick + Math.round((REAR_EVERY[0] + (REAR_EVERY[1]-REAR_EVERY[0])*hashRand(tick*7 + b.id.charCodeAt(b.id.length-1)))*TICK_HZ); }
      // (19.11, владелец, фото 3: «почему взгляд через стенки») точка «мельком» — середина зоны за стеной: как у любого взгляда (lookFilter) — туда, откуда
      // враг выйдет на мою линию (appearFrom / cornerLook); видимой нет — мельком не смотрит
      if(best && !lookVisible(b, best)){ var bv = appearFrom(b, best) || cornerLook(b, best); best = bv && lookVisible(b, bv) ? bv : null; }
      if(best){ b._gl = {pt:{x:best.x, y:best.y}, until: tick + SL.glDur}; look = b._gl.pt; b.lookReason = "glance"; }
    }
  } else if(!moving && !b._lkAltPt) b._gl = null;
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
  if(S && S.pt && DM.hypot(S.pt.x-b.x, S.pt.y-b.y) < 60){ b._sl = S = null; }
  // (v278, владелец 14.10: матч 1, тики 1452–1508, игрок 7 крутился в Cave) на бегу повернул — удерживаемая точка осталась
  // за спиной (> 1,9 рад ≈ 110° от направления бега — тот же порог «за спиной на ходу», что во всём взгляде): не держим
  if(S && S.pt && moving && _angOff(DM.atan2(S.pt.y-b.y, S.pt.x-b.x), lookHeading(b)) > 1.9){ b._sl = S = null; }
  // (v583a, владелец 17.11, кадр CT1 у Connector: «забежал за несколько стен, а смотрит в старую точку — прилип прицел») на ходу держимая точка
  // скрылась за стеной — держать нечего: удержание снимается (проверка раз в 4 тика — путь бота «за угол» за это время короче шага)
  if(S && S.pt && moving && (tick & 3) === 0 && !hasLOS(b.x, b.y, S.pt.x, S.pt.y, b.z)){ b._sl = S = null; }
  if(!look){
    if(!moving){ return look; }
    if(urgent === 2){ b._sl = null; return look; }
    if(S && S.pt && !slSub(S.key) && tick - S.since < slHold(b, S, true)) return S.pt;   // угол ещё не «досмотрели» (мельком / замену — не досматривает)
    if(!S || S.pt) slNew(b, null); // переходим на «по ходу»
    return look;
  }
  var aN = DM.atan2(look.y-b.y, look.x-b.x);
  if(urgent === 2 || !S){ slNew(b, look); return look; }
  if(!S.pt){                                                                     // сейчас смотрит по ходу
    if(moving && tick - S.since < slHold(b, S, true, !!urgent)) return null;
    slNew(b, look); return look;
  }
  var aS = DM.atan2(S.pt.y-b.y, S.pt.x-b.x);
  var dA = Math.abs(((aN-aS+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
  // (В147) стоя, без срочности, держимая точка не уточняется до конца срока удержания: точка плана осмотра «гуляет» на 1–5° при пересчёте, и
  // рука доворачивала на каждый сдвиг — у ботов стоя 34 мелких поворота в минуту против 9 у про (tools/measure/motion/turn_rate.py)
  if(dA < SL.refine && !moving && !urgent){ if(tick - S.since < slHold(b, S, false)) return S.pt; S.pt = {x:look.x, y:look.y}; S.since = tick; S.hold = null; return look; }   // уточнил — новый срок
  if(dA < SL.refine){ S.pt = {x:look.x, y:look.y}; return look; }          // то же направление — просто уточняем точку (В147: до 5°, было до 20° — SL.same; сдвиги 5–20° шли без удержания: крупных поворотов в 1,7 раза больше про)
  // (v583a, Д4) на ходу та же зона плана — держим её: точка зоны с нового места (угол меняется сам), срок удержания не сбрасывается
  var kN = slKey(b);
  // (отметка владельца 18.11, видео игрока 6 у B: «хочет смотреть на край зоны, а смотрит в стену и ящик») точка той же зоны на ходу пересчитывалась
  // каждый тик («откуда выйдет на мою линию» — appearFrom / cornerLook) и прыгала между краями (Kitchen ↔ B Window, 50–70°): рука рывком к одной,
  // пауза — цель уже на другой, прицел полсекунды между ними, в стене. Держит прежнюю точку, пока она видна; скрылась — берёт новую
  if(moving && S.plan && b.lookReason === "look" && kN === S.key){ if(S.pt && lookVisible(b, S.pt)) return S.pt; S.pt = {x:look.x, y:look.y}; return look; }
  // (v583a, Д1) важнее держимого — сразу, без досматривания: уровень арбитра выше (звук, команда, бой) или вес в дележе вдвое больше;
  // вес держимого — на момент, когда угол взяли (проверенный угол теряет вес сам — это не «стал важнее другой»); у замены («open», «glance») —
  // вес зоны плана, вместо которой её взяли; текущий вес не годится — он гуляет сам (угроза зоны по таймингу, делёж соседних зон)
  // (v583a, Д5, владелец 17.11, кадр +2,4 с: «а вот сюда он зачем смотрит») держимая зона выпала из кандидатов — угрозы там больше нет, там встал
  // свой, она стала тылом: досматривать нечего (м302 р2, T3: Empty → «угрозы нет», а удержание держало её ещё 9,5 с)
  if(S.plan && S.key != null && b._lkC && !b._lkC.some(function(x){ return x.j === S.key; })){ slNew(b, look); return look; }
  if(b._lookLvl > (S.lvl || 0) || b.lookReason === "look" && kN != null && (slSub(S.key) || moving && S.plan && slVal(b, kN) >= Math.max(SL_MORE*(S.val || 0), SL_THREAT)) && slVal(b, kN) > 0){ slNew(b, look); return look; }
  var hold = slHold(b, S, moving, !!urgent);   // (15.11) тревога — паузы про в перестрелке; было SL.holdAlert (16 тиков, проектное)
  if(tick - S.since < hold) return S.pt;                                    // старое ещё не "досмотрели"
  slNew(b, look);
  return look;
}
