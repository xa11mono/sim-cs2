// ---- эндгейм: у врага 1–2 живых, и известно, где он ----
// Раньше каждый продолжал стоять на своей точке по роли и чекать углы, где
// врага уже быть не может. Теперь: кто рядом (≤650) — держит угол на него,
// кто далеко — подтягивается к нему, на линию, откуда его видно. Носитель
// бомбы T продолжает ставить; после планта — обычная логика (ретейк/пост-плант).
// (v157) у про последнего добивают вдвоём: ведущий ждёт за углом, пока
// напарник подойдёт, и выходят вместе (у ботов шли по одному — последний
// забирал их по очереди: клатч 9% против 2% у про)
function egWaitPartner(b, mine, kp){
  var dMe = Math.hypot(kp.x-b.x, kp.y-b.y);
  var part = mine.filter(function(o){ return o !== b && o.alive && !o.planting && !o.defusing && Math.hypot(o.x-b.x, o.y-b.y) < 700; })
    .sort(function(a, c){ return Math.hypot(a.x-b.x, a.y-b.y) - Math.hypot(c.x-b.x, c.y-b.y); })[0];
  if(!part) return false;
  var dP = Math.hypot(kp.x-part.x, kp.y-part.y);
  if(dP - dMe < 180 || Math.hypot(part.x-b.x, part.y-b.y) < 160) { b._egWait = null; return false; } // напарник рядом или впереди — идём
  if(b._egWait && tick - b._egWait.t > 6*TICK_HZ) return false;            // ждём не дольше 6с
  if(!b._egWait || b._egWait.round !== roundNum){
    var wp = pickSpots("egw"+tick+b.id, {x:b.x, y:b.y}, 3, {rMax:140, minGap:30, hideFrom:[kp]})
      .filter(function(q){ return !hasLOS(q.x, q.y, kp.x, kp.y); })[0];
    if(!wp) return false;
    b._egWait = {round:roundNum, t:tick, pt:wp};
    voiceLog(b.team, "egw"+b.id+roundNum, b.id, "жду "+part.id+", заходим вдвоём");
  }
  b._probeLock = 0; b._reposUntil = 0;
  setPost(b, b._egWait.pt, {x:kp.x, y:kp.y}, true, "endhunt");
  return true;
}
function endgameBrain(){
  // (v146) после планта охоты нет: у T — пост-плант, у CT — ретейк/сейв
  if(BAL.egFix && bomb && bomb.state === "planted") bots.forEach(function(o){ if(o.alive && o.post && o.post.tag === "endhunt"){ o._egC = null; clearPost(o); } });
  if(!BAL.endgame || roundState !== "live" || (bomb && bomb.state === "planted")) return;
  ["CT","T"].forEach(function(team){
    var foe = team === "CT" ? "T" : "CT";
    var nFoe = aliveCount(foe), mine = bots.filter(function(b){ return b.team === team && b.alive; });
    if(nFoe === 0 || nFoe > 2 || mine.length < nFoe) return;
    if(team === "CT" && teamTac.CT && teamTac.CT.saving) return;
    var sig = teamIntel[team].sig, K = null;
    for(var i=sig.length-1; i>=0; i--){
      var sg = sig[i]; if(tick - sg.tick > 6*TICK_HZ) break;
      if(sg.type !== "spotted" && sg.type !== "sound") continue;
      var alive = bots.some(function(o){ return o.id === sg.id && o.alive; });
      if(!alive) continue;
      if(!K || (sg.type === "spotted" && K.type !== "spotted")) K = sg;
      if(K.type === "spotted") break;
    }
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
        // (v297, И41, владелец 14.10: T4 шёл на пик в Cave, на 3,1 с инфы охоту отпустило — за тик развернуло на точку лёрка)
        // начать охоту — враг свежий (≤ 3 с, демки); продолжить начатую — пока инфе ≤ 6 с (окно сигнала выше). Отпустило, а до точки
        // пика < 100 px (проектное число) — доходит и смотрит туда же (≤ 1,5 с), а не разворачивается за тик
        var hunting = b.post && b.post.tag === "endhunt";
        if(kAge > (hunting ? 6 : 3)*TICK_HZ || d > 700){
          if(hunting){
            var sp0 = b.post, nearSp = Math.hypot(sp0.x-b.x, sp0.y-b.y) < 100;
            if(nearSp && !b.atPost && (!b._egEnd || b._egEnd.round !== roundNum || tick - b._egEnd.t < 1.5*TICK_HZ)){
              if(!b._egEnd || b._egEnd.round !== roundNum) b._egEnd = {round:roundNum, t:tick};
              postKeep(b); return;
            }
            b._egC = null; b._egEnd = null; clearPost(b);
          }
          return;
        }
        b._egEnd = null;
      }
      // точка выбирается один раз на "клетку" цели (80px), а не каждый тик
      // заново от текущей позиции бота — иначе пост менялся на ходу
      // (v292, И33, владелец 14.10: раунд 1, тик 3865 — игрок 6 стоял в Connector и ждал пика, пока игрок 9 стрелялся с T2 в
      // 200 px от него) тиммейт уже в перестрелке с целью — не ждать пика, а заходить с другой стороны (та же точка, что у flankAssist)
      var mC = d < 650 && b.hp > LOW_HP ? mine.filter(function(m){ return m !== b && m._sawEnemy && m._nearestEnemyBot && m._nearestEnemyBot.id === K.id && (m.contactStreak||0) >= 20; })[0] : null;
      if(mC && !(b._egC && b._egC.round === roundNum && b._egC.fl === K.id) && !flankClaim(b, K.id)) mC = null;
      // (v359, «упал FPS»: точки захода не нашлось — раньше искал заново каждый тик, по пути до каждой точки) повтор через 0,5 с
      if(mC && b._fsFail && b._fsFail.id === K.id && tick - b._fsFail.t < 32 && b._fsFail.t <= tick) mC = null;
      if(mC && !(b._egC && b._egC.round === roundNum && b._egC.fl === K.id)){
        var fsp = flankSpot(b, mC, kp);
        if(!fsp) b._fsFail = {id: K.id, t: tick};
        if(fsp) flankClaim(b, K.id, true);
        if(fsp){ b._egC = {gk:gk, round:roundNum, spot:fsp, look:{x:kp.x, y:kp.y}, fl:K.id};
          voiceLog(team, "flank"+b.id, b.id, "захожу на "+K.id+" с другой стороны — помогаю "+mC.id); }
      }
      if(b._egC && b._egC.round === roundNum && b._egC.fl === K.id && mC){ b._probeLock = 0; b._reposUntil = 0; setPost(b, b._egC.spot, {x:kp.x, y:kp.y}, true, "endhunt"); return; }
      if(!b._egC || b._egC.gk !== gk || b._egC.round !== roundNum || b._egC.fl){
        var center = d < 650 ? {x:b.x, y:b.y} : walk({x: kp.x + (b.x-kp.x)*Math.min(0.9, 420/d), y: kp.y + (b.y-kp.y)*Math.min(0.9, 420/d)});
        var spots = pickSpots("eg:"+b.id+":"+gk, center, 2, {rMax: d < 650 ? 120 : 200, minGap:40, see:[kp]});
        b._egC = {gk:gk, round:roundNum, spot:spots[0], look:{x:kp.x, y:kp.y}};
      }
      b._probeLock = 0; b._reposUntil = 0;
      if(BAL.groupPlay && BAL.egPair && egWaitPartner(b, mine, kp)) return;
      setPost(b, b._egC.spot, b._egC.look, true, "endhunt");
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
  var sig = teamIntel[b.team].sig, ax = S.x - b.x, ay = S.y - b.y;
  for(var i=sig.length-1; i>=0; i--){
    var g = sig[i]; if(tick - g.tick > 6*TICK_HZ) break;
    if(g.type !== "spotted" && g.type !== "sound") continue;
    if(Math.hypot(g.x-S.x, g.y-S.y) > r + 350) continue;
    if((g.x-b.x)*ax + (g.y-b.y)*ay > 0) return true;   // по ту сторону, куда идём
  }
  var zi = bzOf(S.x, S.y); if(zi < 0) return false;
  var m = beliefZoneFresh(b.team, zi); (BZ.nbr[zi]||[]).forEach(function(n){ m += 0.5*beliefZoneFresh(b.team, n); });
  return m > 0.6;
}
function smokeEdgeTick(){
  if(!BAL.smokePush || !smokes.length && !bots.some(function(b){ return b._smokeWait; })) return;
  bots.forEach(function(b){
    if(!b.alive) return;
    var W = b._smokeWait;
    if(W){
      var still = smokes.indexOf(W.S) >= 0 && smokeRadiusNow(W.S) > 30;
      var why = still ? smokePushReason(b, W.S) : null;
      if(!still || why || tick - W.start > 9*TICK_HZ || b.state !== "patrol" || b.planting || b.defusing){
        b._smokeWait = null;
        if(still && (why || tick - W.start > 9*TICK_HZ)){ b._smokePush = {until: tick + 4*TICK_HZ, reason: why || "долго ждать нельзя"}; logEvent(b.id+": пушит в смок — "+b._smokePush.reason); }
        if(b.post && b.post.tag === "smokeWait"){ clearPost(b); if(W.want) setPost(b, W.want[0], W.want[1], W.want[2], W.want[3]); }   // ожидание кончилось — дальше к своей точке
        return;
      }
      // ждёт у дыма, за ним враг — HE в дым: и урон, и дыра, через которую видно
      if(BAL.heClearsSmoke && b.nades && b.nades.he > 0 && !b.nadeTask && !W.heDone && tick - W.start > 20){
        W.heDone = true; assignNade(b, "he", {x:W.S.x, y:W.S.y}, "HE в смок — разогнать", {now:true});
        voiceLog(b.team, "hesm"+b.id, b.id, "кидаю HE в смок — разгоню и посмотрю");
      }
      // (v378) задача важнее ожидания (арбитр места) — ожидание снимается: бот идёт по той задаче, а не «пушит срочно»
      if(!setPost(b, W.edge, {x:W.S.x, y:W.S.y}, true, "smokeWait")){ b._smokeWait = null; logEvent(b.id+": ожидание у смока снято — задача важнее"); }
      return;
    }
    if(b.state !== "patrol" || !b.post || b.atPost || b.planting || b.defusing || b._sawEnemy) return;
    if(b._smokePush && tick < b._smokePush.until) return;
    if(!taskCanSet(b, "smokeWait")) return;   // (v378) идёт по задаче важнее ожидания — арбитр места
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
      if(!setPost(b, edge, {x:S.x, y:S.y}, true, "smokeWait")) b._smokeWait = null;
      return;
    }
  });
}
// (v343, отметка владельца: zont1x спрыгнул с B Apps в 150 ед. от kyousuke, тот слышал, но остался на посту и не выпикнул)
// CT услышал приземление ОДНОГО врага рядом (≤ LAND_PUNISH_R ед. карты, свежее LAND_PUNISH_FRESH с), не видит его, HP ≥ 50 —
// выходит на точку приземления (до LAND_PUNISH_SEC с; увидел — дальше обычный бой). Выходит не каждый: вероятность — агрессия
// из профиля. Источника с числами нет — все числа проектные (приземлившийся в CS2 первые мгновения стреляет неточно)
var LAND_PUNISH_R = 250, LAND_PUNISH_FRESH = 1.5, LAND_PUNISH_SEC = 4;
function ctLandPunish(b){
  var P = b._lp;
  if(P && (P.round !== roundNum || tick > P.until || b._sawEnemy)){ b._lp = null; P = null; }
  if(P){ setPost(b, P.pt, P.pt, true, "repos:land"); return true; }
  var h = b.heardSound;
  if(!h || !h.land || h.team === b.team || tick - h.tick > LAND_PUNISH_FRESH*TICK_HZ || b._lpDone === h.tick) return false;
  b._lpDone = h.tick;
  if(Math.hypot(h.x-b.x, h.y-b.y) > LAND_PUNISH_R || hasLOS(b.x, b.y, h.x, h.y) || b.hp < 50) return false;
  // один: другого известного врага рядом с точкой команда не знает (свежая инфа за 3 с; безымянный звук — тот же игрок)
  var others = (teamIntel.CT && teamIntel.CT.sig || []).filter(function(q){ return q && q.x != null && q.id && q.id !== "?" && q.id !== h.src && tick - q.tick < 3*TICK_HZ && Math.hypot(q.x-h.x, q.y-h.y) < 400; }).length;
  if(others) return false;
  var go = hashRand(h.tick*13 + b.id.charCodeAt(b.id.length-1)*7 + roundNum) < (b.prof ? prof(b, "aggr") : 0.5);
  if(!go) return false;
  b._lp = {round: roundNum, pt: {x:h.x, y:h.y}, until: tick + LAND_PUNISH_SEC*TICK_HZ};
  voiceLog("CT", "lp"+b.id+h.tick, b.id, "спрыгнул один — "+calloutName(h.x, h.y)+", выхожу на него");
  setPost(b, b._lp.pt, b._lp.pt, true, "repos:land");
  return true;
}
