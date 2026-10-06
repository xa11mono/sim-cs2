var PRO_LINEUPS_RAW = @@DATA:lineups_pro.json@@;
// Названные места для ролей CT (знание карты): опорники A/B, ротатор сзади,
// второй на B впереди. Из списка — лучшее по обзору и укрытию (bestNamed).
var CT_ROLE_SPOTS = {
  anchorA: ["Back Site","A Site","Temple","Short","Donut","Triple Box","Boost","Box","Plat"],
  anchorB: ["B Site","Site B","First Lane","Second Lane","90","Bonger"],
  rot212:  ["Alley","Red Room"],   // (v149) без Back Halls, спавна и CT Lane: оттуда нет полезного угла
  roam212: ["Cave","Lamp Room","Dark"]
};
// к какому сайту склоняться без явной инфы — где по картине команды сейчас больше вероятность T
function ctLeanSite(){ return beliefCount("CT", BZ.siteNear.A||[]) >= beliefCount("CT", BZ.siteNear.B||[]) ? "A" : "B"; }
function rolePost(b, key, names, ref, look, tag){
  var P = b._roleSpot;
  if(!(P && P.round === roundNum && P.m === matchNum && P.key === key)){
    var bn = bestNamed(names, ref, "CT", {see: look ? [look] : [], key:"pr"+key});
    if(!bn) return false;
    var lk = look;
    // (v149) взгляд с этой точки — туда, откуда враг придёт раньше всего
    if(BAL.enemyward){ var ewp = enemywardLook("CT", bn.p); if(ewp) lk = ewp; }
    P = b._roleSpot = {round:roundNum, m:matchNum, key:key, p:bn.p, look:lk, nm:bn.nm};
    logEvent(b.id+": "+({rot:"сзади на ротации", roam:"второй на B"})[key]+" — «"+bn.nm+"»");
  }
  setPost(b, P.p, P.look, true, tag);
  return true;
}
// =====================================================================
// (v150) ПРО-ЛАЙНАПЫ ИЗ ДЕМОК: 12 матчей, повторяющиеся броски (одна точка
// броска → одна точка падения, ≥3 раз, ≥2 матча). У каждого — доля раундов,
// в которых про его кидают (prob), и среднее время броска (at, с от начала).
// Каждый раунд лайнап "разыгрывается" с этой вероятностью — так набор гранат
// меняется от раунда к раунду, как у живых команд.
// =====================================================================
if(BAL.nadeMore) PRO_LINEUPS_RAW = PRO_LINEUPS_RAW.concat(@@DATA:lineups_pro_rare.json@@);
var PRO_LINEUPS = null;
function proLineups(){
  if(PRO_LINEUPS) return PRO_LINEUPS;
  if(typeof PRO_LINEUPS_RAW === "undefined") return (PRO_LINEUPS = []);
  PRO_LINEUPS = PRO_LINEUPS_RAW.map(function(L){
    var f = snapToWalkable(L.from.x, L.from.y) || L.from;
    return {id:L.id, team:L.team, type:L.type, trigger:L.trigger, site:L.site, name:L.name, from:{x:f.x, y:f.y}, to:L.to, prob:L.prob, at:L.at, pro:true};
  });
  return PRO_LINEUPS;
}
// встроенная "общая" граната не летит, если про-лайнапы того же типа уже
// покрывают эту ситуацию (сторона, триггер, сайт)
var PRO_COVER = null;
function proCovers(key){
  if(!PRO_COVER){ PRO_COVER = {}; proLineups().forEach(function(L){ PRO_COVER[L.team+"|"+L.trigger+"|"+L.site+"|"+L.type] = 1; if(L.site === "any"){ PRO_COVER[L.team+"|"+L.trigger+"|A|"+L.type] = 1; PRO_COVER[L.team+"|"+L.trigger+"|B|"+L.type] = 1; } }); }
  var p = key.split("."), trig = {insta:"insta", exec:"exec", pp:"postplant", call:"call", retake:"retake"}[p[1]];
  if(!trig) return false;
  var bl = (typeof builtinLineups === "function" ? builtinLineups() : []).filter(function(L){ return L.key === key; })[0];
  if(!bl) return false;
  var site = p[1] === "insta" ? "any" : p[p.length-1];
  return !!(PRO_COVER[p[0]+"|"+trig+"|"+site+"|"+bl.type] || PRO_COVER[p[0]+"|"+trig+"|any|"+bl.type]);
}

// маршрут фланга: мид со стороны T → подход T к сайту → вход на сайт (в спину).
// Возвращает false, когда фланг закончен и бот играет по обычной логике.
function flankPost(b, F, planted){
  var g = GEO[F.site];
  // маршрут фланга по названиям зон: вниз через мид на сторону T
  if(!F.routed){ F.routed = true;
    startRoute(b, F.site === "A" ? ["Top Mid","Mid","Lower Mid","Split"] : ["Top Mid","Mid","Triple","T Upper"], "flank"+F.site); }
  var pts = [
    {p: F.site === "A" ? GEO.tMid : (zonePoint("T Lower", g.tStage) || GEO.tMid),  look: g.tStage, tag: "flank0"},
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
  if(!C.dynT || tick - C.dynT > 3*TICK_HZ || C.ptSite !== k){
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
// ---- эндгейм: у врага 1–2 живых, и известно, где он ----
// Раньше каждый продолжал стоять на своей точке по роли и чекать углы, где
// врага уже быть не может. Теперь: кто рядом (≤650) — держит угол на него,
// кто далеко — подтягивается к нему, на линию, откуда его видно. Носитель
// бомбы T продолжает ставить; после планта — обычная логика (ретейк/пост-плант).
function endgameBrain(){
  // (v146) после планта охоты нет: у T — пост-плант, у CT — ретейк/сейв
  if(BAL.egFix && bomb && bomb.state === "planted") bots.forEach(function(o){ if(o.alive && o.post && o.post.tag === "endhunt"){ dropTask(o, "endhunt"); o._egC = null; clearPost(o); } });
  if(roundState !== "live" || (bomb && bomb.state === "planted")) return;
  ["CT","T"].forEach(function(team){
    var foe = team === "CT" ? "T" : "CT";
    var nFoe = aliveCount(foe), mine = bots.filter(function(b){ return b.team === team && b.alive; });
    if(nFoe === 0 || nFoe > 2 || mine.length < nFoe) return;
    if(team === "CT" && teamTac.CT && teamTac.CT.saving) return;
    // последний известный враг по картине команды (видели — важнее, чем слышали)
    var K = null;
    picRecent(team, 6*TICK_HZ).forEach(function(q){ var sg = {id:q.id, x:q.x, y:q.y, type:q.src, tick:q.tick};
      if(!K || (sg.type === "spotted" && K.type !== "spotted") || (sg.type === K.type && sg.tick > K.tick)) K = sg; });
    // (15) нет свежего сигнала 6с — раньше эндгейм сразу отпускал, боты
    // возвращались на роль (якорь), новый звук — снова "все на него": качели
    // туда-обратно. Теперь помним последнюю точку ещё до 12с
    var TT0 = teamTac[team] || {};
    if(K) TT0._egLast = {id:K.id, x:K.x, y:K.y, type:K.type, tick:tick};
    else if(BAL.ppCommit && TT0._egLast && tick - TT0._egLast.tick < 12*TICK_HZ && bots.some(function(o){ return o.id === TT0._egLast.id && o.alive; })) K = TT0._egLast;
    if(!K) return;
    // цель держится хотя бы ~2с: раньше при двух врагах цель менялась каждый
    // тик (свежий сигнал то от одного, то от другого) — и все дёргались между
    // двумя точками, не доходя ни до одной
    var TT = teamTac[team] || {}, ST = TT._egStick;
    if(ST && tick < ST.until && bots.some(function(o){ return o.id === ST.id && o.alive; })){
      if(K.id === ST.id){ ST.x = K.x; ST.y = K.y; }
      K = {id:ST.id, x:ST.x, y:ST.y, type:K.type};
    } else if(teamTac[team]) teamTac[team]._egStick = {id:K.id, x:K.x, y:K.y, until: tick + 2*TICK_HZ};
    var kp = {x:K.x, y:K.y}, gk = Math.round(kp.x/80)+","+Math.round(kp.y/80);
    var egId = K.id + "|" + nFoe;
    if(teamTac[team] && teamTac[team]._egKey !== egId){
      teamTac[team]._egKey = egId;
      voiceLog(team, "eg"+gk, mine[0].id, (nFoe === 1 ? "последний" : "их двое")+" "+calloutName(kp.x, kp.y)+" — все на него!");
    }
    mine.forEach(function(b){
      if(b.planting || b.defusing || b._sawEnemy || b._stopPlantUntil > tick) return;
      if(team === "T" && bomb && bomb.state === "carried" && bomb.carrier === b) return; // носитель ставит
      var d = Math.hypot(kp.x-b.x, kp.y-b.y);
      // (v146) по демкам: у про при перевесе до планта T в 77% идут ставить (≈8с),
      // а не ищут последних; CT — время на их стороне. Добивать идёт только тот,
      // кто рядом со СВЕЖИМ врагом (≤3с, ≤700px) — остальные играют свою задачу
      if(BAL.egFix){
        var klo = (beliefLast[team] || {})[K.id], kAge = klo ? tick - klo.tick : 1e9;
        if(klo && Math.hypot(klo.x-kp.x, klo.y-kp.y) > 300) kAge = Math.min(kAge, K.tick != null ? tick - K.tick : kAge);
        if(kAge > 3*TICK_HZ || d > 700){
          if(b.post && b.post.tag === "endhunt"){ dropTask(b, "endhunt"); b._egC = null; clearPost(b); }
          return;
        }
      }
      // точка выбирается один раз на "клетку" цели (80px), а не каждый тик
      // заново от текущей позиции бота — иначе пост менялся на ходу
      if(!b._egC || b._egC.gk !== gk || b._egC.round !== roundNum){
        var center = d < 650 ? {x:b.x, y:b.y} : walk({x: kp.x + (b.x-kp.x)*Math.min(0.9, 420/d), y: kp.y + (b.y-kp.y)*Math.min(0.9, 420/d)});
        var spots = pickSpots("eg:"+b.id+":"+gk, center, 2, {rMax: d < 650 ? 120 : 200, minGap:40, see:[kp]});
        b._egC = {gk:gk, round:roundNum, spot:spots[0], look:{x:kp.x, y:kp.y}};
      }
      dropTask(b, "probe"); dropTask(b, "repos");
      setPost(b, b._egC.spot, b._egC.look, true, "endhunt"); holdTask(b, "endhunt", tick+1);
    });
  });
}
// ---- смок на пути: ждать или пушить ----
// Если на пути к посту стоит смок, а за ним по инфе враг — без причины в дым
// не лезут: ждут у края (до ~9с или пока дым не сойдёт). С причиной — пушат
// сквозь дым: выход T, время на исходе, ретейк/бомба на сайте у CT, добить
// последнего, или тиммейт рядом уже пушит — идут вместе.
function segPtDist(px, py, x1, y1, x2, y2){
  var dx = x2-x1, dy = y2-y1, L = dx*dx + dy*dy, t = L ? Math.max(0, Math.min(1, ((px-x1)*dx + (py-y1)*dy)/L)) : 0;
  return Math.hypot(px - (x1 + t*dx), py - (y1 + t*dy));
}
function smokePushReason(b, S){
  var tt = teamTac.T, ct = teamTac.CT, secLeft = ROUND_TIME_SEC - (simTime - roundStartTime);
  if(b.post && b.post.tag === "endhunt") return "добить последнего";
  if(b.team === "T"){
    if(bomb.state === "carried" && bomb.carrier === b && secLeft < 40) return "время — надо ставить";
    if(secLeft < 30 && bomb.state !== "planted") return "время на исходе";
    if(tt && tt.phase === "execute" && b.tRole !== "lurker") return "выход";
  } else {
    if(bomb.state === "planted") return "ретейк — бомба стоит";
    if(b._stopPlantUntil > tick) return "сбить плант";
    if(ct && ct.call && ct.call.bombSeen && ct.rot && ct.rot[b.id]) return "бомба на сайте";
    // идёт на помощь, а на сайте своих почти нет — ждать у дыма некогда
    if(ct && ct.call && ct.rot && ct.rot[b.id]){
      var sc = SITES[ct.call.site];
      var def = bots.filter(function(o){ return o.team === "CT" && o.alive && o !== b && Math.hypot(o.x-sc.x, o.y-sc.y) < 450; }).length;
      if(def === 0) return "на сайте никого — надо успеть";
    }
  }
  var mate = bots.some(function(o){ return o !== b && o.alive && o.team === b.team && o._smokePush && tick < o._smokePush.until && Math.hypot(o.x-b.x, o.y-b.y) < 220; });
  if(mate) return "пушим вместе";
  return null;
}
function enemyBeyondSmoke(b, S, r){
  var ax = S.x - b.x, ay = S.y - b.y;
  if(picRecent(b.team, 6*TICK_HZ).some(function(g){ return Math.hypot(g.x-S.x, g.y-S.y) <= r + 350 && (g.x-b.x)*ax + (g.y-b.y)*ay > 0; })) return true; // по ту сторону, куда идём
  var zi = bzOf(S.x, S.y); if(zi < 0) return false;
  var m = beliefZoneFresh(b.team, zi); (BZ.nbr[zi]||[]).forEach(function(n){ m += 0.5*beliefZoneFresh(b.team, n); });
  return m > 0.6;
}
function smokeEdgeTick(){
  if(!smokes.length && !bots.some(function(b){ return b._smokeWait; })) return;
  bots.forEach(function(b){
    if(!b.alive) return;
    var W = b._smokeWait;
    if(W){
      var still = smokes.indexOf(W.S) >= 0 && smokeRadiusNow(W.S) > 30;
      var why = still ? smokePushReason(b, W.S) : null;
      // срочная задача (сорвать дефуз, сейв, бегство) важнее ожидания у смока —
      // раньше обе механики перезаписывали пост каждый тик
      var urgent = b.post && b.post.tag !== "smokeWait" && /^(defuse|flee|save|antidefuse|stopplant)/.test(b.post.tag||"");
      if(urgent){ b._smokeWait = null; dropTask(b, "smokeWait"); b._smokePush = {until: tick + 4*TICK_HZ, reason:"срочно"}; return; }
      if(!still || why || tick - W.start > 9*TICK_HZ || b.state !== "patrol" || b.planting || b.defusing){
        b._smokeWait = null; dropTask(b, "smokeWait");
        if(still && (why || tick - W.start > 9*TICK_HZ)){ b._smokePush = {until: tick + 4*TICK_HZ, reason: why || "долго ждать нельзя"}; logEvent(b.id+": пушит в смок — "+b._smokePush.reason); }
        if(W.want) setPost(b, W.want[0], W.want[1], W.want[2], W.want[3]);
        return;
      }
      setPost(b, W.edge, {x:W.S.x, y:W.S.y}, true, "smokeWait"); holdTask(b, "smokeWait", tick+1);
      return;
    }
    if(b.state !== "patrol" || !b.post || b.atPost || b.planting || b.defusing || b._sawEnemy) return;
    if(b._smokePush && tick < b._smokePush.until) return;
    if(/^(defuse|flee|save|antidefuse|stopplant)/.test(b.post.tag||"")) return;
    var px = b.post.x, py = b.post.y;
    for(var i=0;i<smokes.length;i++){
      var S = smokes[i], r = smokeRadiusNow(S); if(r < 30) continue;
      var dS = Math.hypot(S.x-b.x, S.y-b.y);
      if(dS < r + 5 || dS > r + 140) continue;                     // уже в дыму / ещё далеко
      if((S.x-b.x)*(px-b.x) + (S.y-b.y)*(py-b.y) <= 0) continue;    // дым не впереди
      if(segPtDist(S.x, S.y, b.x, b.y, px, py) > r*0.9) continue;    // путь его не пересекает
      if(Math.hypot(px-S.x, py-S.y) < r) continue;                   // пост прямо в дыму — не наш случай
      var why2 = smokePushReason(b, S);
      if(why2){
        b._smokePush = {until: tick + 4*TICK_HZ, reason: why2};
        if(b._smokeLog !== S.born){ b._smokeLog = S.born; logEvent(b.id+": пушит в смок — "+why2); }
        return;
      }
      if(!enemyBeyondSmoke(b, S, r)) return;                        // за дымом никого — просто идёт
      var ux = (b.x-S.x)/dS, uy = (b.y-S.y)/dS;
      var edge = walk({x: S.x + ux*(r+45), y: S.y + uy*(r+45)});
      b._smokeWait = {S:S, start:tick, edge:edge, want:[{x:px, y:py}, b.post.look, b.post.hold, b.post.tag]};
      if(b._smokeLog !== -S.born){ b._smokeLog = -S.born; logEvent(b.id+": ждёт у смока — за ним враг, причины лезть нет"); }
      setPost(b, edge, {x:S.x, y:S.y}, true, "smokeWait"); holdTask(b, "smokeWait", tick+1);
      return;
    }
  });
}
function ctBrain(){
  var ct = teamTac.CT;
  var cts = bots.filter(function(b){ return b.team==="CT" && b.alive; });
  // ---- колл по сайтам: раздел 11 (инфа) + раздел 13 (карта вероятностей) ----
  // ПОВОД для колла — только реальная инфа: вижу/слышу/граната/носитель бомбы/
  // погиб опорник и сайт пустой. А "сколько их там" и "держать ли ещё колл" —
  // по карте вероятностей: CT на сайте, которые смотрят и никого не видят, сами
  // её "чистят" — и колл снимается, когда там вероятно уже пусто (раньше колл
  // висел 20с после последней инфы, и ротаторы стояли на пустом сайте).
  var best = null, planted0 = bomb.state === "planted";
  ["A","B"].forEach(function(k){
    var est = intelEstimate("CT", SITES[k].x, SITES[k].y, 400, 5*64);
    var car = teamIntel.CT.carrier;
    var carrierHere = car && tick - car.tick < 5*64 && Math.hypot(car.x-SITES[k].x, car.y-SITES[k].y) < 400;
    // войс: бомбу видели на подходе к этому сайту (заметно ближе к нему, чем к другому)
    var ko2 = k === "A" ? "B" : "A";
    var carrierTo = !carrierHere && car && tick - car.tick < 5*64 &&
      Math.hypot(car.x-SITES[k].x, car.y-SITES[k].y) < 900 &&
      Math.hypot(car.x-SITES[k].x, car.y-SITES[k].y) + 250 < Math.hypot(car.x-SITES[ko2].x, car.y-SITES[ko2].y);
    // войс: "минус на A" — тиммейта убили у сайта за последние 8с
    var deathsHere = intelDeathsNear("CT", SITES[k].x, SITES[k].y, 450, 8*64);
    // слышали плант — T точно на этом сайте, и их там минимум двое
    var PH = teamIntel.CT.plantHeard, plantHere = PH && PH.site === k && tick - PH.tick < 5*TICK_HZ;
    var anchorRole = k==="A" ? "anchorA" : "anchorB";
    var anchorAlive = cts.some(function(b){ return b.tRole===anchorRole; });
    var holdingHere = cts.some(function(b){ return Math.hypot(b.x-SITES[k].x, b.y-SITES[k].y) < 420; });
    var undefended = !anchorAlive && !holdingHere && !planted0;
    // повод для колла — СВЕЖЕЕ наблюдение (видели/слышали за окно), а не
    // "враг где-то тут по памяти": с единым хранилищем est.n постоянный, и колл
    // повторялся каждые 4с по одной и той же старой инфе
    var evN = est.seen + est.heard;
    // (v151) раньше nadeHere использовалась ДО подсчёта (undefined → NaN): ev и
    // score сайта всегда были NaN, колл вечно висел на A, а B не мог его перебить
    var nadeHere = 0;
    // гранаты в первые ~18с — стандартный контроль карты (инсты, молотов на рампу),
    // про не читают их как выход; флешки — не довод (их кидают и в фейках)
    if(BAL.tacRead && tick - roundStartTick > 18*TICK_HZ){
      (teamIntel.CT.nadeSeen||[]).forEach(function(q){ if(tick - q.tick > 6*TICK_HZ || q.type === "flash") return;
        if(Math.hypot(q.x-SITES[k].x, q.y-SITES[k].y) < 600 || Math.hypot(q.x-GEO[k].tEntry.x, q.y-GEO[k].tEntry.y) < 300 || Math.hypot(q.x-GEO[k].ctEntry.x, q.y-GEO[k].ctEntry.y) < 300)
          nadeHere += q.type === "flash" ? 0.5 : 1; });
    }
    var ev = evN + (carrierHere ? 1 : 0) + (carrierTo ? 0.5 : 0) + (undefended ? 1 : 0) + deathsHere + (plantHere ? 2 : 0) + (nadeHere >= 2 ? 1.2 : nadeHere * 0.4);
    var mass = beliefCount("CT", BZ.siteNear[k]||[]);
    // повод — не только реальный контакт РЯДОМ с сайтом, но и когда карта
    // вероятностей (по контакту где-то ещё, например засветили у КТ-спавна на
    // пути к Б) уже уверенно "верит", что враг у этого сайта — иначе колл на
    // такой заход никогда не появляется, пока враг физически не дойдёт до
    // самого сайта, и его встречает только штатный опорник в одиночку
    if(ev <= 0 && mass < 1.7) return;
    // бомбу видели у сайта — это выход, а не один игрок: минимум двое
    var cnt = Math.max(est.seen, est.heard ? 1 : 0, (carrierHere||carrierTo) ? 2 : 0, plantHere ? 2 : 0, undefended ? 1 : 0, Math.min(3, deathsHere), Math.min(5, mass), nadeHere >= 2 ? 2.6 : 0);
    var score = ev + mass;
    if(!best || score > best.score) best = {site:k, score:score, count:cnt, est:est, carrier:carrierHere||carrierTo, undefended:undefended, deaths:deathsHere, plant:plantHere, nades:nadeHere};
  });
  if(best){
    var isNew = !ct.call || ct.call.site !== best.site;
    if(isNew || best.count > ct.call.count + 0.4 || tick - ct.call.tick > 64){
      var prevCnt = isNew ? 0 : ct.call.count, prevLogged = isNew ? 0 : (ct.call.logged || 0);
      ct.call = {logged: prevLogged, site:best.site, count:best.count, tick:tick, evTick:tick, since:(!isNew && ct.call.since) || tick, sinceSite:best.site, undefended:best.undefended, bombSeen: best.carrier || best.plant, seen: best.est ? best.est.seen : 0, nades: best.nades || 0};
      var how = best.plant ? "слышно плант" : (best.nades >= 2 && !best.est.seen) ? "гранаты на "+best.site+" — выход" : best.undefended ? "сайт пустой, опорник погиб" : best.carrier ? "бомба замечена" : best.deaths ? "минус на сайте" : (best.est.seen ? "вижу "+best.est.seen : best.est.heard ? "слышу" : "по инфе");
      var n1 = Math.max(1, Math.round(best.count));
      // в войс — только новый колл или когда их стало БОЛЬШЕ, чем уже говорили
      // (повтор колла) колл снялся и через пару секунд поднялся снова по той же
      // инфе — раньше в войс шёл тот же текст ещё раз. Повторяем, только если их
      // стало больше или прошло 15с
      var CM = ct._callMem || (ct._callMem = {}), cm = CM[best.site];
      var dup = BAL.callDedup && cm && n1 <= cm.n && tick - cm.tick < 15*TICK_HZ;
      if((isNew || n1 > prevLogged) && !dup){ ct.call.logged = n1; CM[best.site] = {n:n1, tick:tick}; intelCallLog("CT", "site"+best.site+n1, "CT колл: T на "+best.site+" (~"+n1+", "+how+")"); }
      else if(dup) ct.call.logged = Math.max(ct.call.logged||0, cm.n);
    } else { ct.call.evTick = tick; ct.call.undefended = best.undefended; if(best.carrier || best.plant) ct.call.bombSeen = true; }
  } else if(ct.call){
    // новой инфы нет — оценка "сколько там" только тает вместе с картой
    ct.call.count = Math.min(ct.call.count, beliefCount("CT", BZ.siteNear[ct.call.site]||[]) + 0.3);
  }
  if(ct.call){
    var quiet = tick - (ct.call.evTick||ct.call.tick);
    var massNow = beliefCount("CT", BZ.siteNear[ct.call.site]||[]);
    var lkpHere = picNear("CT", SITES[ct.call.site].x, SITES[ct.call.site].y, 500);
    if(lkpHere === 0 && ((quiet > 6*64 && massNow < 0.6) || quiet > 18*64)){
      logEvent("CT: по "+ct.call.site+" давно тихо"+(massNow < 0.6 ? " и там вероятно пусто" : "")+" — по местам", "team");
      ct.call = null;
    }
  }
  // ---- кто ротирует: ровно столько, сколько нужно ----
  // Раньше на любой колл шли ротатор+роумер, а на 2+ — ещё мидер и второй
  // опорник: на А оказывалось 3-4 CT против 1-2 T, а мид и Б пустели.
  // Теперь: нужно ~столько защитников, сколько там вероятно врагов, +1 к одному;
  // первыми идут ротатор и роумер, мидер — только если на миде вероятно пусто,
  // второй опорник — только на большой стак и если на его сайте никого.
  ct.rot = {};
  if(!ct.call || planted0) ct.playRetake = null;
  if(ct.call && !planted0){
    var ks = ct.call.site, ko = ks === "A" ? "B" : "A", sc0 = SITES[ks];
    var need = Math.max(1, Math.ceil(ct.call.count - 0.25));
    var defenders = cts.filter(function(b){ return Math.hypot(b.x-sc0.x, b.y-sc0.y) < 450; }).length;
    // защитников ≈ сколько там врагов (сайт даёт позиционное преимущество)
    var send = Math.max(0, Math.min(3, need - defenders));
    // терпение: на первый звук/одного-двух не дёргаемся — ротация только
    // когда инфа подтвердилась (~2.5с держится) или это точно выход (бомба,
    // пустой сайт). Про-CT в это время просто тихо держат свои углы
    if(BAL.ctPatience && !ct.call.bombSeen && !ct.call.undefended && ct.call.count < 2.5 &&
       tick - (ct.call.since||tick) < (BAL.realSpeed ? 1.5 : 2.5)*TICK_HZ && !(ct.call.sinceSite && ct.call.sinceSite !== ks)){
      // (баланс) при реальной скорости ротация идёт в 1.5 раза дольше — ждём
      // подтверждения 1.5с, а не 2.5с, иначе ротатор приходил к уже взятому сайту
      send = 0;
      if(ct._patLog !== ks+roundNum+"|"+ct.call.since){ ct._patLog = ks+roundNum+"|"+ct.call.since; }
    }
    if(ct.call.bombSeen && !ct["_bv"+ks]){ ct["_bv"+ks] = true;
      voiceLog("CT", "bombrot"+ks, "CT", "бомба на "+ks+" — ротатор"+(midMass < 0.9 ? " и мид" : "")+" на "+ks+"!"); }
    if(!ct.call.since || ct.call.sinceSite !== ks){ ct.call.since = tick; ct.call.sinceSite = ks; }
    var confirmed = tick - ct.call.since > 1.5*TICK_HZ; // мидер/второй опорник снимаются не с первого звука
    var midMass = beliefMass("CT", BZ.midZ), otherMass = beliefMass("CT", BZ.siteNear[ko]||[]);
    // ---- раздел: ротация по счёту ----
    // Сколько T живо и сколько из них уже "учтены": видели/слышали здесь (колл)
    // и свежо (≤8с) видели в другом месте. Все учтены здесь → можно снимать
    // всех (другой сайт пуст); кого-то держат у другого сайта/мида → тот
    // опорник/мидер остаётся; нас меньше и на сайт идёт стак → ротаторы не
    // бегут по одному в 1в3, а ждут у входа и играют ретейк.
    var allIn = false, keepOther = false, keepMid = false;
    if(BAL.countRot){
      var tAliveN = aliveCount("T"), here = Math.min(tAliveN, Math.max(1, Math.round(ct.call.count)));
      var elseO = 0, elseM = 0, elseAny = 0;
      for(var eidR in picKnown("CT")){ var eR = picKnown("CT")[eidR]; if(tick - eR.tick > 8*TICK_HZ) continue; if(Math.hypot(eR.x-sc0.x, eR.y-sc0.y) < 900) continue;
        elseAny++; if(Math.hypot(eR.x-SITES[ko].x, eR.y-SITES[ko].y) < 750) elseO++; else if(Math.hypot(eR.x-GEO.ctMid.x, eR.y-GEO.ctMid.y) < 650) elseM++; }
      var unacc = Math.max(0, tAliveN - here - elseAny);
      ct.call.unacc = unacc;
      keepOther = elseO > 0 || unacc >= 2; keepMid = elseM > 0;
      allIn = here >= 2 && tAliveN >= 2 && unacc === 0 && elseAny === 0 && confirmed;
      if(allIn){ need = Math.max(need, here + 1); send = Math.max(0, Math.min(4, need - defenders)); }
      if(allIn && ct._allInLog !== ks+roundNum){ ct._allInLog = ks+roundNum;
        voiceLog("CT", "allin"+ks, "CT", "все "+tAliveN+" на "+ks+" — "+ko+" пустой, все на "+ks+"!"); }
      // нас меньше, а на сайт идёт стак — не в одиночку на сайт, а ретейк
      var stackIn = here >= defenders + 2 && here >= 3;
      if(stackIn && cts.length < tAliveN && !ct.call.bombSeen){
        if(!ct.playRetake || ct.playRetake.site !== ks){ ct.playRetake = {site:ks, tick:tick};
          voiceLog("CT", "prt"+ks, "CT", "их больше ("+here+" на "+ks+", нас "+cts.length+") — не лезем по одному, играем ретейк"); }
      } else if(ct.playRetake && (ct.playRetake.site !== ks || ct.call.bombSeen)) ct.playRetake = null;
    }
    // (7) расстановка 1-1-1 (T разошлись: у A, на миде и у B по одному):
    // один контакт — это не выход. Держим дефолт, на колл идёт максимум один
    // (ротатор), мид и второй опорник не снимаются, пока нет бомбы/стака
    var spread = false;
    if(BAL.setup111 && !ct.call.bombSeen && !ct.call.undefended && aliveCount("T") >= 3){
      var zA = 0, zB = 0, zM = 0;
      for(var eidS in picKnown("CT")){ var eS = picKnown("CT")[eidS]; if(tick - eS.tick > 10*TICK_HZ) continue;
        if(Math.hypot(eS.x-SITES.A.x, eS.y-SITES.A.y) < 800) zA++; else if(Math.hypot(eS.x-SITES.B.x, eS.y-SITES.B.y) < 800) zB++; else if(Math.hypot(eS.x-GEO.ctMid.x, eS.y-GEO.ctMid.y) < 700 || Math.hypot(eS.x-GEO.tMid.x, eS.y-GEO.tMid.y) < 500) zM++; }
      var bA = beliefMass("CT", BZ.siteNear.A||[]), bB = beliefMass("CT", BZ.siteNear.B||[]), bM = beliefMass("CT", BZ.midZ);
      var areas = ((zA || bA > 0.6) ? 1 : 0) + ((zB || bB > 0.6) ? 1 : 0) + ((zM || bM > 0.6) ? 1 : 0);
      spread = areas >= 3 && ct.call.count < 2.5;
      if(spread){
        allIn = false; keepOther = true; keepMid = true; send = Math.min(send, 1);
        if(ct._s111Log !== roundNum){ ct._s111Log = roundNum; voiceLog("CT", "s111", "CT", "они разошлись по одному (A, мид, B) — держим свои, не перекручиваемся, играем от количества"); }
      }
    }
    ct.spread = spread;
    var pri = function(b){
      var r = b.tRole;
      if(r === "rotator") return 0;
      if(r === "roamer") return 1;
      if(BAL.countRot){
        if(r === "mid") return keepMid ? 99 : (allIn || ct.call.undefended || (ct.call.bombSeen && midMass < 0.9) || (need >= 2 && confirmed && midMass < 0.5)) ? 2 : 99;
        if(r === (ko === "A" ? "anchorA" : "anchorB")) return keepOther ? (ct.call.undefended && !(ct.call.unacc >= 2) ? 3 : 99) : (allIn || ct.call.undefended || (need >= 3 && confirmed && otherMass < 0.35)) ? 3 : 99;
      }
      // "сайт пустой, опорник погиб" — это не догадка по карте вероятностей, а
      // точный факт (в реальной игре об этом сказали бы в голос) — под такой
      // колл идёт даже единственный живой ротатор, а не только по порогу need
      if(r === "mid") return (ct.call.undefended || (ct.call.bombSeen && midMass < 0.9) || (need >= 2 && confirmed && midMass < 0.5)) ? 2 : 99;
      if(r === (ko === "A" ? "anchorA" : "anchorB")) return (ct.call.undefended || (need >= 3 && confirmed && otherMass < 0.35)) ? 3 : 99;
      return 99;
    };
    cts.filter(function(b){ return pri(b) < 99 && Math.hypot(b.x-sc0.x, b.y-sc0.y) >= 450; })
       .sort(function(a,b){ return pri(a) - pri(b) || (Math.hypot(a.x-sc0.x,a.y-sc0.y) - Math.hypot(b.x-sc0.x,b.y-sc0.y)); })
       .slice(0, send).forEach(function(b){ ct.rot[b.id] = true;
         // заплатка до шага «позиция»: свой откат не держит игрока, которого команда отправила на ротацию
         if(b.post && b.post.tag === "repos:fallback") dropTask(b, "repos"); });
    // уже стоящий на ротации не сбрасывается туда-сюда каждую секунду
    cts.forEach(function(b){ if(b.post && /^rotate/.test(b.post.tag) && Math.hypot(b.x-sc0.x, b.y-sc0.y) < 450 && pri(b) < 99) ct.rot[b.id] = true; });
  }
  // ---- фланг: "поджать в спину" ----
  // На подтверждённый выход (2+ T на сайте) один свободный CT — мидер или
  // роумер, которого не отправили на ротацию, — не бежит на сам сайт, а
  // заходит T за спину: через мид на их сторону карты → на подход T к сайту →
  // к входу на сайт, в спину заходящим. Раз за раунд, один игрок.
  var secLeftCT = ROUND_TIME_SEC - (simTime - roundStartTime);
  if(ct.flank && !bots.some(function(o){ return o.id === ct.flank.id && o.alive; })) ct.flank.dead = true;
  if(!ct.flank && ct.call && !planted0 && ct.call.count >= 2 && tick - (ct.call.since||tick) > 2*TICK_HZ && secLeftCT > 25 && cts.length >= 2){
    var fs = ct.call.site;
    var cand = cts.filter(function(b){ return (b.tRole === "mid" || b.tRole === "roamer") && !(ct.rot && ct.rot[b.id]) &&
      Math.hypot(b.x-SITES[fs].x, b.y-SITES[fs].y) > 500; })
      .sort(function(a, b2){ return (a.tRole === "mid" ? 0 : 1) - (b2.tRole === "mid" ? 0 : 1); })[0];
    if(cand){
      ct.flank = {id:cand.id, site:fs, stage:0, arr:0};
      voiceLog("CT", "flank"+fs, cand.id, "захожу им в спину через мид на "+fs);
    }
  }
  var planted = bomb.state === "planted";
  // сколько секунд нужно лучшему CT, чтобы обезвредить бомбу: кто уже дефузит —
  // остаток его дефуза; остальные — реальный путь до бомбы / скорость + дефуз
  // (с китом или без). Одна оценка и для решения «сейв», и для «сейв → ретейк».
  function ctDefuseNeedSecs(){
    var need = Infinity;
    cts.forEach(function(b){
      var t = b.defusing ? (b.defuseUntil - tick)/TICK_HZ : pathLenTo(b, bomb.x, bomb.y)/SPEED + (b.kit ? 5 : 10) + 1.0;
      if(t < need) need = t;
    });
    return need;
  }
  // сейв: ретейк безнадёжен (сильно меньше людей или не успеть дойти+дефузнуть) —
  // CT не идут умирать, а сохраняют оружие на следующий раунд
  if(planted && !ct.saving && !ct._noResave){
    var tsAlive = bots.filter(function(b){ return b.team==="T" && b.alive; }).length;
    var secs = bombTimeLeftTicks()/TICK_HZ;
    var needSecs = ctDefuseNeedSecs();
    // сейвить имеет смысл только то, что стоит денег: с пистолетами и без
    // брони терять нечего — лучше попробовать ретейк
    var equip = cts.reduce(function(a,b){ return a + (b.primary ? WEAPONS[b.primary].price : 0) + (b.armor ? 650 : 0); }, 0) / Math.max(1, cts.length);
    var hopeless = (cts.length === 1 && tsAlive >= BAL.saveGap) || (cts.length <= tsAlive - BAL.saveGap) || needSecs > secs;
    // (v158) у про после взрыва живы 2,1 CT, у ботов было 1,2: сейвят раньше
    if(BAL.groupRetake) hopeless = hopeless || (cts.length >= 2 && cts.length <= tsAlive - 2) || (cts.length === 1 && tsAlive >= 3) ||
      (cts.length === 1 && tsAlive === 2 && !(cts[0].kit && needSecs + 8 < secs)); // 2v4 — ещё пробуем, 1v3/1v4/2v5 — сейв
    if(cts.length && hopeless && (equip >= 1800 || needSecs > secs)){
      ct.saving = true;
      logEvent("CT: сейв — ретейк "+cts.length+"v"+tsAlive+(needSecs > secs ? ", не успеть" : "")+", сохраняем оружие", "team");
    }
  }
  // (8) сейв → ретейк: на сейве сняли T и расклад выровнялся (1v1, 2v2, 1v2 при
  // запасе времени) — сейв отменяется, идём ретейкать/защищать
  if(BAL.saveRetake && ct.saving && cts.length && tick % 16 === 0){
    var tsS = aliveCount("T");
    if(planted){
      var secsS = bombTimeLeftTicks()/TICK_HZ, needS = ctDefuseNeedSecs();
      var evenS = cts.length >= tsS || (cts.length === tsS - 1 && needS + 7 < secsS);
      // врагов не осталось — сейвить не от кого: идём дефузить, если успеваем
      if(evenS && needS + (tsS ? 2 : 0) < secsS){
        ct.saving = false; ct._noResave = true; cts.forEach(function(b){ b._saveSpot = null; });
        logEvent("CT: сейв → ретейк — теперь "+cts.length+"v"+tsS+", успеваем ("+Math.round(secsS)+"с)", "team");
        voiceLog("CT", "sv2rt", cts[0].id, cts.length+" на "+tsS+" — успеваем, идём ретейкать!");
      }
    } else if(ct.preSave && cts.length >= tsS){
      ct.saving = false; ct.preSave = false; ct._noResave = true; cts.forEach(function(b){ b._saveSpot = null; });
      logEvent("CT: сейв → ретейк — теперь "+cts.length+"v"+tsS+", играем раунд", "team");
    }
  }
  // сейв CT до планта: 1v3+/2v5, T уже заходят на сайт, у нас есть что сохранять
  if(BAL.ctPreSave && !planted && !ct.saving && !ct._noResave && ct.call && ct.call.count >= 3 && cts.length){
    var tsA2 = aliveCount("T"), eq2 = cts.reduce(function(a,b){ return a + (b.primary ? WEAPONS[b.primary].price : 0); }, 0)/cts.length;
    var secL2 = ROUND_TIME_SEC - (simTime - roundStartTime);
    if(((cts.length === 1 && tsA2 >= 3) || (cts.length === 2 && tsA2 >= 5)) && eq2 >= 2700 && secL2 > 25){
      ct.saving = true; ct.preSave = true;
      logEvent("CT: сейв до планта — "+cts.length+"v"+tsA2+", выход на "+ct.call.site+" — сохраняем оружие", "team");
      voiceLog("CT", "presave", cts[0].id, cts.length+" против "+tsA2+", они уже на "+ct.call.site+" — сейв");
    }
  }
  // (S4) бомба лежит на виду у CT — один держит её из укрытия: T придут за ней
  if(BAL.bombWatch){
    if(bomb.state !== "dropped") ct.bombWatch = null;
    else if(!ct.bombWatch){
      var seer = cts.filter(function(o){ return Math.hypot(o.x-bomb.x, o.y-bomb.y) < 1000 && hasVision(o.x, o.y, bomb.x, bomb.y); })
        .sort(function(a, c){ return Math.hypot(a.x-bomb.x, a.y-bomb.y) - Math.hypot(c.x-bomb.x, c.y-bomb.y); })[0];
      if(seer && cts.length >= 2){
        var bwp = pickSpots("bombwatch"+Math.round(bomb.x/30)+","+Math.round(bomb.y/30), {x:seer.x, y:seer.y}, 2, {rMax:200, minGap:40, must:[{x:bomb.x, y:bomb.y}], hideFrom:[GEO.A.tStage, GEO.B.tStage]})[0] || {x:seer.x, y:seer.y};
        ct.bombWatch = {id:seer.id, pt:bwp};
        voiceLog("CT", "bombw", seer.id, "бомба лежит "+calloutName(bomb.x, bomb.y)+" — держу её");
      }
    } else if(!cts.some(function(o){ return o.id === ct.bombWatch.id; })) ct.bombWatch = null;
  }
  if(planted && !ct.saving) updateRetake(cts);
  cts.forEach(function(b){
    if(b.defusing) return;
    var role = b.tRole;
    if((planted || ct.preSave) && ct.saving){
      // сейв не на CT-спавне (там T как раз и будут искать), а в месте подальше от
      // бомбы и от живых T, откуда их не видно; каждый — своё ближайшее такое место
      if(!b._saveSpot){ b._saveSpot = pickSaveSpot(b); b._saveLooks = null; }
      setPost(b, b._saveSpot, {x:bomb.x, y:bomb.y}, true, "save"); // взгляд — на угол, из-за которого придут от бомбы
      return;
    }
    if(BAL.bombWatch && ct.bombWatch && ct.bombWatch.id === b.id && bomb.state === "dropped" && !ct.call){
      setPost(b, ct.bombWatch.pt, {x:bomb.x, y:bomb.y}, true, "bombwatch"); return; }
    if(ct.flank && !ct.flank.dead && ct.flank.id === b.id && !ct.saving && flankPost(b, ct.flank, planted)) return;
    // (35) ретейк 2 на 3+ — AWP не несут в почти проигранный ретейк: снайпер сейвит
    if(BAL.awpSave && planted && b.primary === "AWP" && cts.length === 2 && aliveCount("T") >= 3){
      if(!b._saveSpot){ b._saveSpot = pickSaveSpot(b); voiceLog("CT", "awpsave"+b.id, b.id, "2 на "+aliveCount("T")+" — сейвлю AWP"); }
      setPost(b, b._saveSpot, {x:bomb.x, y:bomb.y}, true, "save"); return;
    }
    if(planted){ retakePost(b, cts); return; }
    // ---- слышно плант рядом: сбить его — выйти на линию, откуда видно того, кто ставит ----
    var PHs = teamIntel.CT.plantHeard;
    // с умом: под плант лезут, только если нас там не меньше, чем их (или время
    // раунда почти вышло — тогда плант решает раунд). Иначе "их больше — под
    // плант не лезу": держит свою линию и играет ретейк вместе, а не бежит
    // в одиночку на 2–3 T, которые прикрывают ставящего
    var spSmart = true;
    if(BAL.smartPlant && PHs && tick - PHs.tick < PLANT_TICKS + 32 && Math.hypot(b.x-PHs.x, b.y-PHs.y) < 480 && !ct.saving){
      var tNearP = Math.max(1, intelEstimate("CT", PHs.x, PHs.y, 450, 5*TICK_HZ).n);
      var ctNearP = cts.filter(function(o){ return Math.hypot(o.x-PHs.x, o.y-PHs.y) < 600; }).length;
      var secLeftP = ROUND_TIME_SEC - (simTime - roundStartTime);
      spSmart = ctNearP >= tNearP || secLeftP < 12 || hasLOS(b.x, b.y, PHs.x, PHs.y);
      if(!spSmart && b._noStopLog !== PHs.tick){ b._noStopLog = PHs.tick;
        voiceLog("CT", "nostop"+b.id, b.id, "их "+tNearP+", нас "+ctNearP+" — под плант не лезу, держу и играем ретейк"); }
    }
    if(BAL.stopPlant && spSmart && PHs && tick - PHs.tick < PLANT_TICKS + 32 && Math.hypot(b.x-PHs.x, b.y-PHs.y) < 480 && !ct.saving){
      var ppt = {x:PHs.x, y:PHs.y};
      var sps = pickSpots("stopplant"+Math.round(ppt.x/40)+","+Math.round(ppt.y/40), ppt, 4, {rMin:60, rMax:280, minGap:50, must:[ppt]});
      var bsp = null, bsd = Infinity;
      sps.forEach(function(q){ var d = Math.hypot(q.x-b.x, q.y-b.y); if(d < bsd){ bsd = d; bsp = q; } });
      if(bsp){
        if(b._stopPlantLog !== PHs.tick){ b._stopPlantLog = PHs.tick; voiceLog("CT", "stop"+b.id, b.id, "слышу плант — иду сбивать!"); }
        b._stopPlantUntil = tick + 2*TICK_HZ; dropTask(b, "repos");
        setPost(b, bsp, ppt, true, "stopplant");
        return;
      }
    }
    // ---- последний CT до планта: одно решение, а не "то ротация, то опорник" ----
    if(BAL.ctClutch && cts.length === 1 && ctClutch(b, ct)) return;
    // ---- минус мидер: мид не бросают пустым ----
    if(BAL.midCover && !ct.call && cts.length >= 3 && midCoverPost(b, cts)) return;
    // ---- слышит нескольких, но со своей точки их не видно — выйти туда, откуда видно ----
    if(BAL.reangle && b.atPost && !b._sawEnemy && tick >= (b._reangleNext||0) && /^(anchor|stack|set:)/.test(b.post.tag)){
      var sg2 = picEvents("CT"), srcs = {}, sx = 0, sy = 0, sn = 0;
      for(var q2=sg2.length-1; q2>=0; q2--){
        var g2 = sg2[q2]; if(tick - g2.tick > 5*TICK_HZ) break;
        if(g2.type !== "sound" || srcs[g2.id]) continue;
        if(Math.hypot(g2.x-b.x, g2.y-b.y) > 650 || hasLOS(b.x, b.y, g2.x, g2.y)) continue;
        srcs[g2.id] = true; sx += g2.x; sy += g2.y; sn++;
      }
      if(sn >= 2){
        var sc0 = {x:sx/sn, y:sy/sn}, kk = Math.hypot(b.x-SITES.A.x, b.y-SITES.A.y) < Math.hypot(b.x-SITES.B.x, b.y-SITES.B.y) ? "A" : "B";
        var bestR = null, bestRN = null, brd = Infinity;
        POS[kk].ctHold.forEach(function(n){
          var q = namedSpot(n, b, {see:[sc0], key:"reang"}); if(!q) return;
          var d = Math.hypot(q.x-b.x, q.y-b.y); if(d < 40 || d > 380 || !hasLOS(q.x, q.y, sc0.x, sc0.y)) return;
          if(d < brd){ brd = d; bestR = q; bestRN = n; }
        });
        b._reangleNext = tick + 8*TICK_HZ;
        if(bestR){
          logEvent(b.id+": слышит "+sn+" — выходит на «"+bestRN+"», откуда их видно");
          setPost(b, bestR, sc0, true, "repos"); holdTask(b, "repos", tick + 6*TICK_HZ);
          return;
        }
      }
    }
    var call = ct.call;
    var strong = call && call.count >= 2;
    // любой колл — ротатор и роумер идут на помощь; подтверждённый выход (2+) — и мидер
    var oldRot = call && (role === "rotator" || role === "roamer" || (strong && role === "mid"));
    if(call && (BAL.beliefRot ? (ct.rot && ct.rot[b.id]) : oldRot)){
      var gc = GEO[call.site];
      // раздел: ротация не в одну и ту же открытую точку вслепую по умолчанию —
      // 1) смотрим туда, где враг РЕАЛЬНО известен (свежий вижу/слышу у этого
      //    сайта), а не всегда строго во вход, иначе бот держит вход, пока враг
      //    заходит совсем с другой стороны;
      // 2) если рядом с этим сайтом ещё нет ни одного своего — в одиночку не
      //    лезем на открытую опорную точку (там его просто расстреляют с двух
      //    углов), сначала подтягиваемся до входа на сайт и ждём напарника;
      // 3) когда напарник уже есть — берём одну из нескольких прикрытых точек,
      //    а не всегда одну и ту же (её иначе легко читать по прошлым раундам)
      var siteC = SITES[call.site];
      var threatSig = picRecent("CT", 6*TICK_HZ).filter(function(q){ return Math.hypot(q.x-siteC.x, q.y-siteC.y) < 450; }).sort(function(a, c){ return c.tick - a.tick; })[0] || null;
      var lookPt = threatSig ? {x:threatSig.x, y:threatSig.y} : gc.tEntry;
      // (плант 74%) ротация по одному в стак — не заходят по одному: первый у
      // входа CT ждёт второго (до ~5с), дальше заходят вместе
      var defOn = cts.filter(function(o){ return Math.hypot(o.x-siteC.x, o.y-siteC.y) < 450; }).length;
      if(BAL.rotGroup && call.count >= 2.6 && defOn <= 1 && Math.hypot(b.x-siteC.x, b.y-siteC.y) > 380 && !(bomb && bomb.state === "planted")){
        var RG = ct._rg || (ct._rg = {}); var rg = RG[call.site] || (RG[call.site] = {since:tick, go:false});
        var atEnt = cts.filter(function(o){ return ct.rot[o.id] && Math.hypot(o.x-gc.ctEntry.x, o.y-gc.ctEntry.y) < 280; }).length;
        if(!rg.go && (atEnt >= 2 || tick - rg.since > 5*TICK_HZ || Object.keys(ct.rot).length <= 1)){ rg.go = true;
          if(atEnt >= 2) voiceLog("CT", "rgo"+call.site+roundNum, b.id, "мы вдвоём у входа — заходим вместе"); }
        if(!rg.go){
          var hs0 = pickSpots("rg"+call.site, gc.ctEntry, 3, {rMin:40, rMax:220, minGap:55, hideFrom:[siteC, gc.tEntry], see:[gc.ctEntry]});
          setPost(b, hs0[Object.keys(ct.rot).sort().indexOf(b.id) % Math.max(1, hs0.length)] || gc.ctEntry, siteC, true, "rotateHold");
          return;
        }
      }
      if(BAL.countRot && ct.playRetake && ct.playRetake.site === call.site && Math.hypot(b.x-siteC.x, b.y-siteC.y) > 380){
        // ждём у входа CT, вне видимости с сайта: подтянуться к бомбе на ретейк
        var hs = pickSpots("prt"+call.site, gc.ctEntry, 4, {rMin:60, rMax:260, minGap:60, hideFrom:[siteC, gc.tEntry], see:[gc.ctEntry]});
        var hi2 = Object.keys(ct.rot).sort().indexOf(b.id);
        setPost(b, hs[Math.max(0, hi2) % Math.max(1, hs.length)] || gc.ctEntry, gc.ctEntry, true, "rotateHold");
        return;
      }
      // важно: сайт всё равно надо прикрыть, поэтому НЕ ждём напарника, чтобы
      // не оставить точку вообще пустой — просто не всегда одна и та же открытая
      // точка и не всегда взгляд строго во вход по умолчанию
      var apos = anchorPosOf(call.site);
      var rSpots = pickSpots("rotateSpots"+call.site, gc.anchor, 5, {rMax:230, minGap:60, see:[lookPt], hideFrom:[gc.tStage],
        cross: apos ? {from:apos, pt:gc.tEntry} : null});
      var rPick = weightedPick(rSpots.length, roundNum*271 + (role==="rotator"?11:role==="roamer"?23:37));
      if(Math.hypot(b.x-siteC.x, b.y-siteC.y) > 600) safeRotate(b, rSpots[rPick] || siteC, call.site);
      setPost(b, rSpots[rPick], lookPt, true, "rotate", role==="rotator"?1:-1);
      return;
    }
    if(BAL.ctSetups && ctSetupRole(b, role, ct)) return;
    if(role === "anchorA" || role === "anchorB"){
      // опорник каждый раунд встаёт на одну из нескольких позиций у сайта, а не
      // всегда в одну точку — иначе T кидали бы молотов/флешку ровно в него по
      // заученной точке (в CS тоже меняют позиции, чтобы не читали)
      var kA = role === "anchorA" ? "A" : "B";
      // раздел 11.1: точки оценены и по второму направлению обзора (мид —
      // коннектор, "двойное покрытие")
      var opts = pickSpots("anchorOpts"+kA, GEO[kA].anchor, 5, {rMax:230, minGap:60,
        see:[GEO[kA].tEntry], seeW:[{pt:GEO.ctMid, w:0.6}], hideFrom:[GEO[kA].tStage]});
      var pickI = weightedPick(opts.length, roundNum*131 + matchNum*977 + (kA==="A"?1:2));
      // позиции по названиям зон (Temple, Back Site, 90, First Lane…): каждый
      // раунд — одна из них; первые в списке чаще, последние — как офф-угол
      var ents = [GEO[kA].tEntry].concat(entryPts(kA));
      var bnA = bestNamed(CT_ROLE_SPOTS["anchor"+kA], GEO[kA].anchor, "CT", {see:ents, hideFrom:[GEO[kA].tStage], key:"hold"+kA});
      var holdPt = bnA ? bnA.p : opts[pickI];
      if(bnA && b._holdLog !== roundNum){ b._holdLog = roundNum; logEvent(b.id+": держит "+kA+" с «"+bnA.nm+"»"); }
      // (плант 74%) опорник один на сайте, а туда идут 3+ (колл/гранаты выхода):
      // раньше стоял на своём угле и умирал первым, и сайт брали 4 на 0. Про в
      // такой ситуации отходит к входу CT, тянет время и остаётся живым на ретейк
      var cl = ct.call;
      if(BAL.anchorFall && cl && cl.site === kA && cl.count >= 2.6 && !(bomb && bomb.state === "planted") &&
         ((cl.seen || 0) >= 2 || (cl.nades || 0) >= 2 || cl.bombSeen) &&
         !cts.some(function(o){ return o !== b && Math.hypot(o.x-SITES[kA].x, o.y-SITES[kA].y) < 450; })){
        if(!b._afPt || b._afPt.round !== roundNum || b._afPt.k !== kA){
          var afp = pickSpots("afall"+kA, GEO[kA].ctEntry, 3, {rMin:40, rMax:260, minGap:50, hideFrom:[GEO[kA].tEntry, SITES[kA]], see:[GEO[kA].ctEntry]})[0];
          b._afPt = {round:roundNum, k:kA, pt: afp || GEO[kA].ctEntry};
          voiceLog("CT", "afall"+kA+roundNum, b.id, "их ~"+Math.round(cl.count)+" на "+kA+", я один — отхожу к CT, тяну время, ретейк с ротацией");
        }
        setPost(b, b._afPt.pt, SITES[kA], true, "anchor:fall");
        return;
      }
      setPost(b, holdPt, lookFrom(holdPt, ents, GEO[kA].tEntry, b), true, "anchor");
    }
    else if(role === "mid"){
      // раздел: дефолтная точка мида была одной и той же ВСЕГДА открытой точкой
      // со статичным взглядом — бот стоял в открытую, даже если известно, где
      // враг реально был. Теперь: несколько укрытых вариантов вместо одной
      // открытой точки, и взгляд — туда, где враг реально недавно замечен
      // рядом с мидом, а не всегда в одну сторону по умолчанию
      var midThreat = picRecent("CT", 6*TICK_HZ).filter(function(q){ return Math.hypot(q.x-GEO.ctMid.x, q.y-GEO.ctMid.y) < 420; }).sort(function(a, c){ return c.tick - a.tick; })[0] || null;
      var midLook = midThreat ? {x:midThreat.x, y:midThreat.y} : GEO.ctMidLook;
      // мидер с AWP: не всегда мид — иногда встаёт снайпером на сайт (длинная
      // линия), в остальное время пикает/держит мид
      if(b.primary === "AWP" && !midThreat){
        var rr2 = hashRand(roundNum*613 + matchNum*29);
        var AWPS = rr2 < 0.42 ? null : rr2 < 0.71 ? [{n:"Back Site", l:"Long", k:"A"}, {n:"Temple", l:"Short", k:"A"}] : [{n:"Site B", l:"Ramp", k:"B"}, {n:"Second Lane", l:"Cave", k:"B"}];
        if(AWPS){
          var AW = AWPS[Math.floor(hashRand(roundNum*7 + matchNum)*AWPS.length)];
          var awl = zonePoint(AW.l, SITES[AW.k]);
          var awp = namedSpot(AW.n, SITES[AW.k], {see: awl ? [awl] : [], hideFrom:[GEO[AW.k].tStage], key:"awp"+AW.k});
          if(awp){
            if(b._awpLog !== roundNum){ b._awpLog = roundNum; logEvent(b.id+" (AWP): играет на "+AW.k+" с «"+AW.n+"», держит «"+AW.l+"»"); }
            setPost(b, awp, awl || GEO[AW.k].tEntry, true, "mid");
            return;
          }
        }
      }
      // мидер один против мид-группы T: раньше стоял на Top Mid/Sniper Nest
      // до конца и умирал первым в ~40% раундов (двое T на одного). Теперь:
      // на миде слышно/видно двоих+ — отходит на глубокую точку (Red Room/
      // Connector сторона), откуда их встретит вместе с тиммейтами
      if(BAL.midSafe && !b._sawEnemy){
        var nMid = intelEstimate("CT", GEO.ctMid, 750, 4*TICK_HZ).n;
        if(nMid >= 2 || (b._midBack && b._midBack.round === roundNum && tick < b._midBack.until)){
          if(!b._midBack || b._midBack.round !== roundNum){
            var deep = namedSpot("Red Room", GEO.ctMid, {hideFrom:[GEO.tMid], see:[GEO.ctMid], key:"midback"}) ||
                       pickSpots("midback", GEO.ctMid, 2, {rMin:180, rMax:420, minGap:60, hideFrom:[GEO.tMid, GEO.ctMidLook]})[0];
            b._midBack = {round:roundNum, pt:deep || GEO.ctMid, until: tick + 12*TICK_HZ};
            voiceLog("CT", "midback", b.id, "на миде их "+nMid+" — отхожу глубже, не дуэлю один");
          }
          if(nMid >= 2) b._midBack.until = tick + 8*TICK_HZ;
          setPost(b, b._midBack.pt, GEO.ctMid, true, "mid:back");
          return;
        }
      }
      var midOpts = pickSpots("ctMidOpts", GEO.ctMid, 5, {rMax:190, minGap:55, see:[midLook], hideFrom:[GEO.tMid]});
      var midPick = weightedPick(midOpts.length, roundNum*191 + matchNum*433);
      // вперёд (Top Mid/Sniper Nest) — реже; чаще глубже (Jungle/Red Room)
      var mNames = BAL.midSafe ? ["Jungle","Red Room","Sniper Nest","Top Mid"] : POS.M.ctHold, mi = weightedPick(mNames.length, roundNum*191 + matchNum*433 + 7);
      var mp = !midThreat ? namedSpot(mNames[mi], GEO.ctMid, {see:[GEO.ctMidLook, GEO.tMid], hideFrom:[GEO.tMid], key:"mid"}) : null;
      // (мидер) разбор ранних смертей: в 6 из 14 у мидера был пистолет против AK
      // на 450–530px (заведомо проигранная дуэль), AWP умирал на 250px в упор.
      // Позиция — под оружие: пистолет/ПП — ближний угол у двери (длинные линии
      // закрыты), AWP — самая дальняя точка, откуда виден мид
      if(BAL.midWeapon && !midThreat){
        var wT = b.weapon ? b.weapon.tier : 0, isAwp = b.weapon && (b.weapon.key === "AWP" || b.weapon.key === "SSG");
        if(isAwp){
          var ac = pickSpots("midAwpLong", GEO.ctMid, 6, {rMax:340, minGap:50, see:[GEO.ctMidLook], hideFrom:[]})
            .filter(function(q){ return hasLOS(q.x, q.y, GEO.ctMidLook.x, GEO.ctMidLook.y); })
            .sort(function(a, c){ return Math.hypot(c.x-GEO.ctMidLook.x, c.y-GEO.ctMidLook.y) - Math.hypot(a.x-GEO.ctMidLook.x, a.y-GEO.ctMidLook.y); });
          if(ac[0]){ mp = ac[0]; if(b._mwV !== roundNum){ b._mwV = roundNum; logEvent(b.id+" (AWP): мид с дальней точки — дистанция моя"); } }
        } else if(wT < 5){
          var cc = pickSpots("midClose", GEO.ctMid, 4, {rMin:120, rMax:360, minGap:50, see:[GEO.ctMid], hideFrom:[GEO.ctMidLook, GEO.tMid]})[0];
          if(cc){ mp = cc; if(b._mwV !== roundNum){ b._mwV = roundNum; logEvent(b.id+": с "+(b.weapon ? b.weapon.name : "пистолетом")+" на миде — ближний угол, на длинные линии не выхожу"); } }
        }
      }
      if(mp && b._holdLog !== roundNum){ b._holdLog = roundNum; logEvent(b.id+": мид с «"+mNames[mi]+"»"); }
      setPost(b, mp || midOpts[midPick], midLook, true, "mid");
    }
    else if(role === "rotator"){
      if(ct.setup ? ct.setup.rot === "212" : BAL.ctSetup === "2-1-2"){
        // второй на сайт: к опорнику того сайта, где по картине команды вероятнее T
        var ks = ctLeanSite();
        var ap2 = anchorPosOf(ks);
        if(!rolePost(b, "rot", CT_ROLE_SPOTS.rot212, GEO.rotator || CT_SPAWN, GEO.ctMid, "rotator"))
        groupPost([b], GEO[ks].anchor, GEO[ks].tEntry, "anchor2"+ks, {rMin:70, rMax:230, minGap:60, see:[GEO[ks].tEntry], hideFrom:[GEO[ks].tStage],
          cross: ap2 ? {from:ap2, pt:GEO[ks].tEntry} : null});
      } else {
        // 1-1-1: ротатор бегает по первой инфе (это делает блок ротаций выше);
        // погиб мидер — занимает мид; иначе стоит на связке с видом на проход,
        // а не лицом в стену
        var midAlive = cts.some(function(o){ return o.tRole === "mid"; });
        if(!midAlive){
          var mn = POS.M.ctHold[weightedPick(POS.M.ctHold.length, roundNum*17 + 3)];
          var mpp = namedSpot(mn, GEO.ctMid, {see:[GEO.ctMidLook, GEO.tMid], hideFrom:[GEO.tMid], key:"rotmid"}) || GEO.ctMid;
          if(b._rotMidLog !== roundNum){ b._rotMidLog = roundNum; logEvent(b.id+": мидер погиб — занимает мид («"+mn+"»)"); }
          setPost(b, mpp, GEO.ctMidLook, true, "mid");
        } else {
          // Alley и так закрывают мид и опорники — ротатор ждёт ближе к сайту,
          // где по картине команды вероятнее T: у A — CT Lane, у B — Back Halls;
          // оттуда он и помогает быстрее, и сам держит полезный угол на сайт
          var hotR = ctLeanSite();
          var rpn = hotR === "A" ? "CT Lane" : "Back Halls";
          var rEnts = [GEO[hotR].tEntry].concat(entryPts(hotR)).concat([SITES[hotR]]);
          var rp = namedSpot(rpn, SITES[hotR], {see:rEnts, key:"rot"+hotR}) || GEO.rotator;
          var rl = lookFrom(rp, rEnts, SITES[hotR], b);
          setPost(b, rp, rl, true, "rotator");
        }
      }
    }
    else if(role === "roamer" && ct.stack){
      // раздел 12: стак — роумер не бродит, а третьим встаёт на "горячий" сайт
      var sk = ct.stack, apS = anchorPosOf(sk);
      groupPost([b], GEO[sk].anchor, GEO[sk].tEntry, "stack"+sk, {rMin:60, rMax:260, minGap:60, see:[GEO[sk].tEntry], hideFrom:[GEO[sk].tStage],
        cross: apS ? {from:apS, pt:GEO[sk].tEntry} : null});
    }
    else if(role === "roamer" && (ct.setup ? ct.setup.rot === "212" : BAL.ctSetup === "2-1-2")){
      // 2-1-2 = двое на A, один мид, двое на B: ротатор — вторым на "горячий"
      // сайт, роумер — вторым на другой (раньше роумер бродил своим маршрутом
      // и часто уходил на тот же A, а на B оставался один опорник)
      var hot = ctLeanSite(), ko2 = hot === "A" ? "B" : "A", apR = anchorPosOf(ko2);
      if(!rolePost(b, "roam", CT_ROLE_SPOTS.roam212, GEO.B.anchor, GEO.B.tEntry, "anchor2B"))
      groupPost([b], GEO[ko2].anchor, GEO[ko2].tEntry, "anchor2"+ko2, {rMin:70, rMax:230, minGap:60, see:[GEO[ko2].tEntry], hideFrom:[GEO[ko2].tStage],
        cross: apR ? {from:apR, pt:GEO[ko2].tEntry} : null});
    }
    // роумер — свой маршрут. (v136) Раньше снимал ЛЮБОЙ пост каждый тик — и пост
    // "за оружием" (и другие временные) чередовался: поставили/сняли, бот стоял
    else if(!(BAL.pickFix && b.post && /^(pickup|tradeR|repos|lineup|smokeWait|endhunt)/.test(b.post.tag))) clearPost(b);
  });
}

function teamBrains(){
  if(roundState !== "live" || !teamTac.T) return;
  bombTick();
  if(roundState !== "live") return; // дефуз мог только что закончить раунд
  routeTick();
  SPOT_TEAM = "T"; tBrain(); SPOT_TEAM = "CT"; ctBrain(); SPOT_TEAM = null; endgameBrain(); lineupTick(); smokeEdgeTick(); weaponPickupTick(); picCheckTick();
  bots.forEach(function(b){ if(b.alive) reloadPeek(b); });
  if(tick % 4 === 0) bots.forEach(function(b){ if(b.alive) assistPeek(b); });
  if(tick % 8 === 2) bots.forEach(function(b){ if(b.alive) lowHpBack(b); });
  if(tick % 8 === 4) bots.forEach(function(b){ if(b.alive) finishPush(b); });
  smokeFadeTick(); awpSmokeTick(); bombPassTick();
}

