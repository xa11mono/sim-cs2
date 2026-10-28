// =====================================================================
// (v150) ПРО-ЛАЙНАПЫ ИЗ ДЕМОК: 12 матчей, повторяющиеся броски (одна точка
// броска → одна точка падения, ≥3 раз, ≥2 матча). У каждого — доля раундов,
// в которых про его кидают (prob), и среднее время броска (at, с от начала).
// Каждый раунд лайнап "разыгрывается" с этой вероятностью — так набор гранат
// меняется от раунда к раунду, как у живых команд.
// =====================================================================
if(BAL.nadeMore) PRO_LINEUPS_RAW = PRO_LINEUPS_RAW.concat(MAP.lineups.proExtra);
var PRO_LINEUPS = null, PRO_GROUPS = {};
function proLineups(){
  if(PRO_LINEUPS) return PRO_LINEUPS;
  if(typeof PRO_LINEUPS_RAW === "undefined") return (PRO_LINEUPS = []);
  PRO_LINEUPS = PRO_LINEUPS_RAW.map(function(L){
    var f = snapToWalkable(L.from.x, L.from.y) || L.from;
    return {id:L.id, team:L.team, type:L.type, trigger:L.trigger, site:L.site, name:L.name, from:{x:f.x, y:f.y}, to:L.to, prob:L.prob, at:L.at, pro:true};
  });
  // (v423, 3в) одна цель — одна граната: лайнапы про одной стороны, триггера, сайта и типа с целью в одной зоне карты — группа
  // (tools/cluster.py режет броски по месту броска: смок на Stairs с T Roof, с T Ramp… — у каждого свой маленький p)
  PRO_GROUPS = {};
  PRO_LINEUPS.forEach(function(L){
    var zt = zoneIdAt(L.to.x, L.to.y) || (Math.round(L.to.x/150)+","+Math.round(L.to.y/150));
    // (v430, М167, м1 Mirage р4: смок Catwalk «инста» (donk) и «сетап» (TN1R) — два дыма в одно место) группа — по моменту плана гранат
    // (365: CT по времени, T инста и сетап — «сейчас»), а не по триггеру; у «сейчас» — без сайта (та же цель в тактике на A и на B)
    var mo = npMomentOfLineup(L);
    L.grp = [L.team, mo, mo === "now" ? "" : L.site, L.type, zt].join("|");
    (PRO_GROUPS[L.grp] = PRO_GROUPS[L.grp] || []).push(L);
  });
  return PRO_LINEUPS;
}
// розыгрыш группы на раунд: граната в эту цель летит с вероятностью — сумма долей её лайнапов (не больше 1; доли посчитаны на одни
// и те же раунды — tools/cluster.py ctxN). Место броска заранее не выбирается (v424: в v423 выбиралось по долям — на Mirage м1 р3 выпал
// смок в Window со спавна, а со спавна кинуть было некому — окно не закрыли): выпала цель — открыты все места группы, кидают с того,
// где первым нашёлся бросающий, остальные места группы гасятся (proGroupDone)
function proRollGroup(L){
  var G = PRO_GROUPS[L.grp] || [L], hid = 0, i;
  // (v429) гранаты на тайминг (CT по времени) и сетапа / выхода T — по плану гранат команды (365): цель летит, если её запланировали
  // (у кого-то из живых граната с этой целью), а не по своему кубику; колл, ретейк, после планта — кубиком, как было
  if((L.team === "CT" && L.trigger === "timed") || (L.team === "T" && (L.trigger === "insta" || L.trigger === "setup" || L.trigger === "exec"))){
    var win0 = npPlanned(L); G.forEach(function(x){ nadeFlags["pr"+x.id] = win0; }); return;
  }
  for(i = 0; i < L.grp.length; i++) hid = (hid*31 + L.grp.charCodeAt(i)) % 1000003;
  var sum = 0; G.forEach(function(x){ sum += x.prob; });
  var win = hashRand(roundNum*7919 + matchNum*104729 + hid) < Math.min(1, sum);
  G.forEach(function(x){ nadeFlags["pr"+x.id] = win; });
}
// лайнап группы нашёл бросающего — другие места той же цели в этом раунде не кидаются
function proGroupDone(L){
  if(!L.pro || !L.grp) return;
  (PRO_GROUPS[L.grp] || []).forEach(function(x){ if(x !== L) nadeFlags["lu"+x.id] = true; });
}
// встроенная "общая" граната не летит, если про-лайнапы того же типа уже
// покрывают эту ситуацию (сторона, триггер, сайт)
var PRO_COVER = null;
function proCovers(key){
  if(!BAL.proLineups) return false;
  if(!PRO_COVER){ PRO_COVER = {}; proLineups().forEach(function(L){ PRO_COVER[L.team+"|"+L.trigger+"|"+L.site+"|"+L.type] = 1; if(L.site === "any"){ PRO_COVER[L.team+"|"+L.trigger+"|A|"+L.type] = 1; PRO_COVER[L.team+"|"+L.trigger+"|B|"+L.type] = 1; } }); }
  var p = key.split("."), trig = {insta:"insta", exec:"exec", pp:"postplant", call:"call", retake:"retake"}[p[1]];
  if(!trig) return false;
  var bl = (typeof builtinLineups === "function" ? builtinLineups() : []).filter(function(L){ return L.key === key; })[0];
  if(!bl) return false;
  var site = p[1] === "insta" ? "any" : p[p.length-1];
  // (v422, владелец 25.10: «выход в сухую, гранаты остаются в карманах»; Mirage м1 р2 — смок «вход CT» отклонён) граната выхода: встроенная
  // не летит, только если лайнап про того же типа на этот сайт В ЭТОМ РАУНДЕ выпал и нашёл, кто кинет (как свои лайнапы — builtinAllowed).
  // Было: отключалась, если такой лайнап про вообще есть, — на Mirage их десятки с p 0,02–0,09, и на выходе не летело почти ничего
  if(trig === "exec") return proLineups().some(function(L){
    return L.team === p[0] && L.trigger === "exec" && (L.site === site || L.site === "any") && L.type === bl.type &&
      nadeFlags["pr"+L.id] === true && !!nadeFlags["luok"+L.id];
  });
  return !!(PRO_COVER[p[0]+"|"+trig+"|"+site+"|"+bl.type] || PRO_COVER[p[0]+"|"+trig+"|any|"+bl.type]);
}

// маршрут фланга: мид со стороны T → подход T к сайту → вход на сайт (в спину).
// Возвращает false, когда фланг закончен и бот играет по обычной логике.
function flankPost(b, F, planted){
  var g = GEO[F.site];
  // маршрут фланга по названиям зон: вниз через мид на сторону T (набор карты: tactics.plays.ctFlank)
  var CF = MAP.tactics.plays.ctFlank || {route:{}, stage:{}}, fk = F.site === "A" ? "A" : "B";
  if(!F.routed){ F.routed = true;
    startRoute(b, CF.route[fk], "flank"+F.site); }
  var fst = CF.stage[fk];
  var pts = [
    {p: (fst && zonePoint(fst, g.tStage)) || GEO.tMid,  look: g.tStage, tag: "flank0"},
    {p: g.tStage,  look: g.tEntry, tag: "flank1"},
    {p: g.tEntry,  look: planted && bomb ? {x:bomb.x, y:bomb.y} : SITES[F.site], tag: "flank2"}
  ];
  // уже заложили, а он ещё даже не на стороне T — смысла обходить нет, ретейк
  if(planted && F.stage === 0) return false;
  if(F.stage >= pts.length) return false;
  var P = pts[F.stage];
  setPost(b, P.p, P.look, true, P.tag);
  if(b.atPost){
    if(!F.arr) F.arr = tick;
    if(tick - F.arr > 40){ F.stage++; F.arr = 0; }   // коротко проверил угол — дальше
  }
  return true;
}
// раздел 12: где стоит (или встанет) опорник этого сайта — второй защитник
// выбирает точку под перекрёстный огонь относительно него
// второй защитник сайта: названная позиция под перекрёстный огонь с опорником
function secondOnSite(b, k, ap){
  if(!BAL.namedPos) return false;
  var names = POS[k].ctSecond, ents = [GEO[k].tEntry].concat(entryPts(k));
  // точка выбирается один раз на раунд: иначе при каждом сдвиге опорника
  // (ap) ключ менялся и второй прыгал между двумя точками ("анкор-флап")
  if(BAL.stable2nd !== false && b._2nd && b._2nd.round === roundNum && b._2nd.k === k && b._2nd.m === matchNum){ setPost(b, b._2nd.p, b._2nd.look, true, "anchor2"+k); return true; }
  var ni = BAL.proPrior ? posPickName(b, names, roundNum*211 + matchNum*37 + b.id.charCodeAt(2||1)) : weightedPick(names.length, roundNum*211 + matchNum*37 + b.id.charCodeAt(2||1));
  var p = null;
  for(var t=0; t<names.length && !p; t++){
    var nm = names[(ni + t) % names.length];
    var q = namedSpot(nm, SITES[k], {see:ents, hideFrom:[GEO[k].tStage], cross: ap ? {from:ap, pt:GEO[k].tEntry} : null, key:"2nd"+k+(ap?Math.round(ap.x/40):"")});
    if(q && (!ap || Math.hypot(q.x-ap.x, q.y-ap.y) > 90)){ p = q; if(b._holdLog !== roundNum){ b._holdLog = roundNum; logEvent(b.id+": вторым на "+k+" — «"+nm+"»"); } }
  }
  if(!p) return false;
  var lk2 = lookFrom(p, ents, GEO[k].tEntry, b);
  b._2nd = {round:roundNum, m:matchNum, k:k, p:p, look:lk2};
  setPost(b, p, lk2, true, "anchor2"+k);
  return true;
}
// ранний пик за инфой: агрессивный CT (опорник/роумер/AWP) в начале раунда
// иногда выходит вперёд — к подходу T, пока они ещё не дошли, — пару секунд
// смотрит и возвращается на своё место. Раз за раунд, только без инфы о T рядом.
function ctEarlyPeek(b, ct){
  var pa = prof(b, "aggr");
  if(!b.prof || pa < 0.7 || b._sawEnemy) return false;
  if(BAL.numbersPlay && aliveCount("CT") < aliveCount("T")) return false; // нас меньше — не рискуем ранним пиком
  if(teamTac.CT && teamTac.CT.antiEco) return false; // против эко — не пикаем рано
  if(BAL.roundMem && b.tRole === "mid" && rmemRecent(RMEM.midDeath, 3).length >= 2) return false; // мидера рано снимают — без ранних пиков
  var since = (tick - roundStartTick)/TICK_HZ;
  var E = b._early;
  if(!E || E.round !== roundNum){
    // (v272) чаще не выходят: с выходом сразу CT были в мейне A в первые 35 с в 39 % раундов против 13,5 % у про (88 демок;
    // tools/measure/audit/ct_early.py) — шанс ×0,35 (= 13,5 / 39)
    E = b._early = {round:roundNum, go: hashRand(roundNum*733 + matchNum*41 + b.id.charCodeAt(2)*9) < (pa-0.5)*1.3*0.35, st:0};
  }
  if(!E.go || E.st === 2) return false;
  if(ct.call || since > 24){ if(E.st === 1){ E.st = 2; } return false; }
  // (v271) выходит сразу — у про CT впервые в мейне A на 10,8-й с (медиана, 88 демок); раньше бот ждал 6 с и приходил на 14,5-й
  // (док 6, «2-1-2, а на B один»: р13 роумер с местами на B со спавна CT пошёл в ранний пик на A — к нему был ближе — и остался там в контакте)
  // сторона раннего пика — сторона его мест в расстановке (npZoneOf); мид или расстановки нет — ближний сайт, как было
  var zs = npZoneOf(b), k = zs === "A" || zs === "B" ? zs : (Math.hypot(b.x-SITES.A.x, b.y-SITES.A.y) < Math.hypot(b.x-SITES.B.x, b.y-SITES.B.y) ? "A" : "B");
  if(!/^(anchor|roamer|mid)/.test(b.tRole)) return false;
  // (v248) за инфой — не в одиночку: один выглядывает, тиммейт рядом на размене [11]
  if(E.st === 0 && !bots.some(function(o){ return o !== b && o.alive && o.team === b.team && Math.hypot(o.x-b.x, o.y-b.y) <= TRADE_R; })) return false;
  // (v285, владелец 14.10) опорник выходит за инфой, только если на его сайте остаётся свой (≤450 px — как защитники в ротациях)
  if(E.st === 0 && /^anchor/.test(b.tRole) && !bots.some(function(o){ return o !== b && o.alive && o.team === b.team && Math.hypot(o.x-SITES[k].x, o.y-SITES[k].y) < 450; })) return false;
  // (v450, док владельца 28.10 №5: «в расстановке 3-0-2 kyousuke идёт пикать окно, хотя на миду 0») роль «мид» пикает с мида, только если
  // по расстановке он стоит на миде (npZoneOf — сторона мест роли); стоит на сайте (3-0-2: B Plat) — выглядывает от своего места в сторону
  // мида (на B — Short), а не идёт в окно. Владелец: «можно, чтобы шёл шорт пикать»
  var midSide = b.tRole === "mid" && npZoneOf(b) === "mid";
  var g = GEO[k], stg = b.tRole === "mid" ? (GEO.tMid || g.tStage) : g.tStage;
  // уже слышим/видим T рядом с точкой выхода — поздно, не лезем
  if(intelEstimate("CT", g.tEntry.x, g.tEntry.y, 600, 4*TICK_HZ).n > 0){ E.st = 2; return false; }
  if(!E.pt){
    var from = b.tRole === "mid" ? (midSide ? GEO.ctMid : (b.post || b)) : g.tEntry;
    E.pt = pickSpots("early"+k+b.tRole, from, 1, {rMax:220, minGap:40, see:[stg]})[0];
    if(!E.pt){ E.st = 2; return false; }
    E.st = 1;
    voiceLog("CT", "early"+b.id, b.id, "выгляну за инфой "+calloutName(E.pt.x, E.pt.y));
    // флешка себе под ранний пик (если есть и не эко у соперника)
    if(BAL.ctEarlyUtil && b.nades && b.nades.flash > 0 && !antiEco("CT") && hashRand(roundNum*97 + b.id.charCodeAt(2)*5) < 0.6){
      var whyF = "себе под ранний пик "+b.id;
      throwNade(b, "flash", stg.x, stg.y, true, whyF);
      b._waitPopUntil = tick + Math.round(1.1*TICK_HZ); b._waitPopKey = "pop:"+whyF;
    }
  }
  if(b.atPost && b.post && b.post.tag === "earlyPeek"){
    if(!E.arr) E.arr = tick;
    // (v271, просьба владельца 13.10) никого — подпуш идёт дальше, пока по таймингу T туда ещё не могли дойти (REACH —
    // знание команды, не подглядывание): до конца прохода к их стороне. У про CT в 8 % раундов доходят до Candle, в 5 % —
    // до A Hall, в 4 % — до Stairs (88 демок, первые 35 с); у ботов до v271 — 0 (стояли у входа 2,5 с и назад).
    // Дальше идти некуда — «пусто» в войс (markClear: знание команды и колл «чекнул … — пусто») и назад на точку
    if(tick - E.arr > 0.8*TICK_HZ && !E.deepDone){
      var wp = buildWaypointPath(b.x, b.y, 0, stg.x, stg.y, 0), nxt = null;
      for(var wi = 0; wi < wp.length; wi++){
        var q = {x: wp[wi][0], y: wp[wi][1]}, zq = bzOf(q.x, q.y);
        if(zq < 0 || reachPossible("CT", zq)) break;   // туда T уже могли дойти — дальше не лезем
        nxt = q;
      }
      if(nxt && Math.hypot(nxt.x-b.x, nxt.y-b.y) > 60){ E.pt = walk(nxt); E.arr = 0; E.deep = (E.deep||0) + 1; setPost(b, E.pt, stg, true, "earlyPeek"); return true; }
      E.deepDone = true;
    }
    if(E.deepDone && tick - E.arr > 0.8*TICK_HZ){
      E.st = 2;
      markClear("CT", b.x, b.y, b.id);
      logEvent(b.id+": ранний пик — никого"+(E.deep ? " (прошёл до конца)" : "")+", назад на точку");
      return false;
    }
  }
  setPost(b, E.pt, stg, true, "earlyPeek");
  return true;
}
// ---- клатч CT до планта ----
// Раньше последний CT оставался "ротатором/опорником по роли": колл то
// появлялся, то гас — и бот бегал туда-сюда между точкой ротации и своей
// позицией, никуда не доходя. Теперь одно решение: сайт, где по инфе T
// (плант слышен / бомбу видели / карта вероятностей), иначе — угадывает
// (ближний). Играет его из укрытия с видом на вход; меняет решение только
// на сильную инфу (плант, бомба) или если новая инфа держится 8с+.
function ctClutch(b, ct){
  var C = b._clutch;
  if(!C || C.round !== roundNum) C = b._clutch = {round:roundNum, site:null, since:0};
  var PH = teamIntel.CT.plantHeard, car = teamIntel.CT.carrier;
  var plantSite = PH && tick - PH.tick < 5*TICK_HZ ? PH.site : null;
  var carSite = null;
  if(car && tick - car.tick < 8*TICK_HZ){ var dA = Math.hypot(car.x-SITES.A.x, car.y-SITES.A.y), dB = Math.hypot(car.x-SITES.B.x, car.y-SITES.B.y); if(Math.min(dA, dB) < 1000) carSite = dA < dB ? "A" : "B"; }
  var mA = beliefCount("CT", BZ.siteNear.A||[]), mB = beliefCount("CT", BZ.siteNear.B||[]);
  var infoSite = mA > mB + 0.5 ? "A" : (mB > mA + 0.5 ? "B" : null);
  var want = plantSite || carSite || infoSite;
  var nT = aliveCount("T");
  if(!C.site){
    C.site = want || (Math.hypot(b.x-SITES.A.x, b.y-SITES.A.y) < Math.hypot(b.x-SITES.B.x, b.y-SITES.B.y) ? "A" : "B");
    C.since = tick; C.want = want; C.wantSince = tick;
    voiceLog("CT", "clutch", b.id, "я один против "+nT+" — "+(want ? "по инфе они на "+C.site+", играю "+C.site : "угадываю "+C.site+", тяну время"));
  } else if(want && want !== C.site){
    if(C.want !== want){ C.want = want; C.wantSince = tick; }
    if(plantSite || carSite || tick - C.wantSince > 8*TICK_HZ){
      C.site = want; C.since = tick;
      voiceLog("CT", "clutchsw"+C.site, b.id, (plantSite ? "плант на "+want : carSite ? "бомба у "+want : "инфа на "+want)+" — иду туда");
    }
  }
  var k = C.site, g = GEO[k];
  if(BAL.holdTask){
    holdGroup([b], {key:"clutch"+k, center:g.anchor, rArea:280, rMax:340,
      voice:function(bb, r){ if(r.main) voiceLog("CT", "clutchpos"+k+Math.round(r.main.pt.x/60), bb.id, "встаю под "+calloutName(r.main.pt.x, r.main.pt.y).replace(/^на /,"")+(r.open - (r.main ? r.main.wn : 0) < 0.2 ? ", остальные входы закрыты" : "")); }}, "clutch:"+k);
    return true;
  }
  // (v142) позиция под реальные входы: откуда вероятно придут — туда смотреть
  // (один вход, максимум два), от остальных входов закрыться стеной
  if((!C.dynT || tick - C.dynT > 3*TICK_HZ || C.ptSite !== k)){
    C.dynT = tick;
    var E = threatEntrances("CT", g.anchor, 280).filter(function(e){ return e.w > 0.03; });
    if(E.length){
      var see = [E[0].pt]; if(E[1] && E[1].w > 0.6*E[0].w) see.push(E[1].pt);
      var hide = E.slice(see.length).filter(function(e){ return e.w > 0.15*E[0].w; }).map(function(e){ return e.pt; });
      var sig = k + see.concat(hide).map(function(p){ return Math.round(p.x/60)+","+Math.round(p.y/60); }).join("|");
      if(sig !== C.sig){
        C.sig = sig;
        // главный вход видеть обязательно (must), остальные — по возможности закрыть
        var sp = pickSpots("clutchdyn"+sig, g.anchor, 1, {rMax:340, minGap:60, must:[see[0]], see:see, hideFrom:hide})[0] ||
                 pickSpots("clutchdyn2"+sig, g.anchor, 1, {rMax:340, minGap:60, see:see, hideFrom:hide})[0];
        if(sp){ C.pt = sp; C.ptSite = k; C.look = see[0];
          voiceLog("CT", "clutchpos"+sig, b.id, "встаю под "+calloutName(see[0].x, see[0].y).replace(/^на /,"")+(hide.length ? ", закрываюсь от остальных входов" : "")); }
      }
    }
  }
  if(!C.pt || C.ptSite !== k){
    var sps = pickSpots("clutch"+k, g.anchor, 3, {rMax:260, minGap:60, see:[g.tEntry], hideFrom:[g.tStage]});
    C.pt = sps[weightedPick(sps.length, roundNum*37 + matchNum*11)] || g.anchor; C.ptSite = k;
  }
  setPost(b, C.pt, C.look || g.tEntry, true, "clutch:"+k);
  return true;
}
// ---- минус мидер: мид держит ротатор (или роумер), но не в открытую ----
function midCoverPick(cts){
  var ct = teamTac.CT, S = ct._mcv;
  if(S && S.round === roundNum && (S.id ? cts.some(function(o){ return o.id === S.id; }) : tick < S.until)) return S.id;
  var best = null, bd = 1e9;
  cts.forEach(function(o){
    if(o.tRole === "mid" || o.planting || o.defusing || o._sawEnemy) return;
    var k = Math.hypot(o.x-SITES.A.x, o.y-SITES.A.y) < Math.hypot(o.x-SITES.B.x, o.y-SITES.B.y) ? "A" : "B";
    // опорник уходит с сайта, только если на сайте остаётся ещё кто-то
    if(/^anchor/.test(o.tRole) && cts.filter(function(q){ return q !== o && Math.hypot(q.x-SITES[k].x, q.y-SITES[k].y) < 600; }).length === 0) return;
    // на его сайте инфа (видели/слышали T за 4с рядом со входом) — нужен там
    if(intelEstimate("CT", GEO[k].tEntry.x, GEO[k].tEntry.y, 600, 4*TICK_HZ).n > 0 && Math.hypot(o.x-SITES[k].x, o.y-SITES[k].y) < 700) return;
    var d = Math.hypot(o.x-GEO.ctMid.x, o.y-GEO.ctMid.y) + (o.tRole === "rotator" ? -150 : o.tRole === "roamer" ? -100 : 200);
    if(d < bd){ bd = d; best = o; }
  });
  ct._mcv = {round:roundNum, id: best ? best.id : null, until: tick + 3*TICK_HZ};
  return ct._mcv.id;
}
function midCoverPost(b, cts){
  var midAlive = cts.some(function(o){ return o.tRole === "mid"; }); if(midAlive) return false;
  if(BAL.midCover2){
    if(tick - roundStartTick < 5*TICK_HZ || (bomb && bomb.state === "planted")) return false;
    if(midCoverPick(cts) !== b.id) return false;
    var M2 = b._midCover;
    if(!M2 || M2.round !== roundNum){
      var sps2 = pickSpots("midcover", GEO.ctMid, 3, {rMin:60, rMax:300, minGap:60, see:[GEO.ctMidLook], hideFrom:[GEO.tMid]});
      M2 = b._midCover = {round:roundNum, pt: sps2[0] || GEO.ctMid};
      voiceLog("CT", "midcover"+roundNum, b.id, "минус мид — я ближе всех, беру мид");
    }
    var far = Math.hypot(b.x-M2.pt.x, b.y-M2.pt.y) > 220;
    setPost(b, M2.pt, GEO.ctMidLook, true, far ? "midcover:go" : "midcover");
    return true;
  }
  var rotAlive = cts.some(function(o){ return o.tRole === "rotator"; });
  if(!(b.tRole === "rotator" || (b.tRole === "roamer" && !rotAlive))) return false;
  if(tick - roundStartTick < 5*TICK_HZ) return false;
  var M = b._midCover;
  if(!M || M.round !== roundNum){
    var sps = pickSpots("midcover", GEO.ctMid, 3, {rMin:60, rMax:300, minGap:60, see:[GEO.ctMidLook], hideFrom:[GEO.tMid]});
    M = b._midCover = {round:roundNum, pt: sps[0] || GEO.ctMid};
    voiceLog("CT", "midcover", b.id, "минус мид — держу мид сам, с укрытия");
  }
  setPost(b, M.pt, GEO.ctMidLook, true, "midcover");
  return true;
}
function anchorPosOf(k){
  var a = bots.filter(function(o){ return o.team === "CT" && o.alive && o.tRole === (k === "A" ? "anchorA" : "anchorB"); })[0];
  if(!a) return null;
  return a.post ? {x:a.post.x, y:a.post.y} : {x:a.x, y:a.y};
}
