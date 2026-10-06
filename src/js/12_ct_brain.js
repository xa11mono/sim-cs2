var PRO_LINEUPS_RAW = @@DATA:lineups_pro.json@@;
// План IGL у CT (колл, сколько нужно в районах, сейв, ретейк) — здесь; куда
// встать — выбор действия (12_team.js). Сколько CT в каждом районе по расстановке:
var CT_NEED = {std212:{A:2,M:1,B:2}, std111:{A:1,M:1,B:1}, stackA:{A:3,M:1,B:1}, stackB:{A:1,M:1,B:3}, midAggro:{A:2,M:2,B:1},
  retakeA:{A:1,M:1,B:2}, retakeB:{A:2,M:1,B:1}};
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
// ---- эндгейм: у врага 1–2 живых, и известно, где он ----
// Раньше каждый продолжал стоять на своей точке по роли и чекать углы, где
// врага уже быть не может. Теперь: кто рядом (≤650) — держит угол на него,
// кто далеко — подтягивается к нему, на линию, откуда его видно. Носитель
// бомбы T продолжает ставить; после планта — обычная логика (ретейк/пост-плант).
function endgameBrain(){
  // (v146) после планта охоты нет: у T — пост-плант, у CT — ретейк/сейв
  if(BAL.egFix && bomb && bomb.state === "planted") bots.forEach(function(o){ if(o.alive && o.post && o.post.tag === "endhunt"){ dropTask(o, "endhunt"); o._egC = null; clearPost(o); } });
  if(roundState !== "live" || (bomb && bomb.state === "planted")) return;
  ["T"].forEach(function(team){   // (v190) CT — выбор действия 12_team.js; T — до шага 2б
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
    if(!b.alive || b.team === "CT") return;   // (v190) CT — выбор действия 12_team.js
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
      ct.call = {site:best.site, count:best.count, tick:tick, evTick:tick, since:(!isNew && ct.call.since) || tick, sinceSite:best.site, undefended:best.undefended, bombSeen: best.carrier || best.plant, seen: best.est ? best.est.seen : 0, nades: best.nades || 0};
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
      logEvent("CT: по "+ct.call.site+" давно тихо"+(massNow < 0.6 ? " и там вероятно пусто" : "")+" — по местам");
      ct.call = null;
    }
  }
  // ---- план IGL: сколько CT нужно в каждом районе (A / мид / B) ----
  // Расстановка даёт базу; колл по сайту — сколько там нужно сейчас (≈ сколько
  // там врагов по картине команды, на первый звук не дёргаемся). Кто именно
  // пойдёт — решает выбор действия (12_team.js): кому ближе и кто меньше нужен.
  var n = cts.length, need = {};
  var base = CT_NEED[(ct.setup && ct.setup.id) || "std212"] || CT_NEED.std212;
  ["A","M","B"].forEach(function(a){ need[a] = base[a]; });
  var sumN = function(){ return need.A + need.M + need.B; };
  var cut = function(order, floor){ order.forEach(function(a){ while(sumN() > n && need[a] > (floor[a]||0)) need[a]--; }); };
  var weaker = beliefMass("CT", BZ.siteNear.A||[]) < beliefMass("CT", BZ.siteNear.B||[]) ? "A" : "B";
  cut(["M", weaker, weaker === "A" ? "B" : "A"], {M:0, A:1, B:1}); cut(["M","A","B"], {});
  ct.spread = false;
  if(ct.call && !planted0){
    var ks = ct.call.site, ko = ks === "A" ? "B" : "A", sc0 = SITES[ks];
    if(!ct.call.since || ct.call.sinceSite !== ks){ ct.call.since = tick; ct.call.sinceSite = ks; }
    var want = Math.max(1, Math.ceil(ct.call.count - 0.25));
    var confirmed = tick - ct.call.since > 1.5*TICK_HZ;
    // терпение: на слабую инфу не снимаемся, пока она не подтвердилась
    if(BAL.ctPatience && !ct.call.bombSeen && !ct.call.undefended && ct.call.count < 2.5 && !confirmed) want = need[ks];
    // ротация по счёту: все известные T здесь — можно больше; кого-то видели в другом месте — там остаются
    var keepOther = false, keepMid = false;
    if(BAL.countRot){
      var tAliveN = aliveCount("T"), here = Math.min(tAliveN, Math.max(1, Math.round(ct.call.count))), elseO = 0, elseM = 0, elseAny = 0, PK = picKnown("CT");
      for(var eidR in PK){ var eR = PK[eidR]; if(tick - eR.tick > 8*TICK_HZ || Math.hypot(eR.x-sc0.x, eR.y-sc0.y) < 900) continue;
        elseAny++; if(Math.hypot(eR.x-SITES[ko].x, eR.y-SITES[ko].y) < 750) elseO++; else if(Math.hypot(eR.x-GEO.ctMid.x, eR.y-GEO.ctMid.y) < 650) elseM++; }
      var unacc = Math.max(0, tAliveN - here - elseAny); ct.call.unacc = unacc;
      keepOther = elseO > 0 || unacc >= 2; keepMid = elseM > 0;
      if(here >= 2 && tAliveN >= 2 && unacc === 0 && elseAny === 0 && confirmed) want = Math.max(want, here + 1);
    }
    // T разошлись по трём районам — один контакт не выход: максимум +1 на колл
    if(BAL.setup111 && !ct.call.bombSeen && !ct.call.undefended && aliveCount("T") >= 3){
      var zA = 0, zB = 0, zM = 0, PK2 = picKnown("CT");
      for(var eidS in PK2){ var eS = PK2[eidS]; if(tick - eS.tick > 10*TICK_HZ) continue;
        if(Math.hypot(eS.x-SITES.A.x, eS.y-SITES.A.y) < 800) zA++; else if(Math.hypot(eS.x-SITES.B.x, eS.y-SITES.B.y) < 800) zB++; else if(Math.hypot(eS.x-GEO.ctMid.x, eS.y-GEO.ctMid.y) < 700 || Math.hypot(eS.x-GEO.tMid.x, eS.y-GEO.tMid.y) < 500) zM++; }
      var bA = beliefMass("CT", BZ.siteNear.A||[]), bB = beliefMass("CT", BZ.siteNear.B||[]), bM = beliefMass("CT", BZ.midZ);
      ct.spread = ((zA || bA > 0.6) ? 1 : 0) + ((zB || bB > 0.6) ? 1 : 0) + ((zM || bM > 0.6) ? 1 : 0) >= 3 && ct.call.count < 2.5;
      if(ct.spread){ want = Math.min(want, need[ks] + 1); keepOther = true; keepMid = true; }
    }
    need[ks] = Math.max(need[ks], Math.min(n, want));
    cut(keepMid ? [ko, "M"] : ["M", ko], {M: keepMid ? 1 : 0, A: ks === "A" ? need.A : (keepOther ? 1 : 0), B: ks === "B" ? need.B : (keepOther ? 1 : 0)});
    cut(["M", ko], {A: ks === "A" ? need.A : 0, B: ks === "B" ? need.B : 0});
  }
  ct.need = need;
  ctAssign(cts, need);
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
      logEvent("CT: сейв — ретейк "+cts.length+"v"+tsAlive+(needSecs > secs ? ", не успеть" : "")+", сохраняем оружие");
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
        logEvent("CT: сейв → ретейк — теперь "+cts.length+"v"+tsS+", успеваем ("+Math.round(secsS)+"с)");
      }
    } else if(ct.preSave && cts.length >= tsS){
      ct.saving = false; ct.preSave = false; ct._noResave = true; cts.forEach(function(b){ b._saveSpot = null; });
      logEvent("CT: сейв → ретейк — теперь "+cts.length+"v"+tsS+", играем раунд");
    }
  }
  // сейв CT до планта: 1v3+/2v5, T уже заходят на сайт, у нас есть что сохранять
  if(BAL.ctPreSave && !planted && !ct.saving && !ct._noResave && ct.call && ct.call.count >= 3 && cts.length){
    var tsA2 = aliveCount("T"), eq2 = cts.reduce(function(a,b){ return a + (b.primary ? WEAPONS[b.primary].price : 0); }, 0)/cts.length;
    var secL2 = ROUND_TIME_SEC - (simTime - roundStartTime);
    if(((cts.length === 1 && tsA2 >= 3) || (cts.length === 2 && tsA2 >= 5)) && eq2 >= 2700 && secL2 > 25){
      ct.saving = true; ct.preSave = true;
      logEvent("CT: сейв до планта — "+cts.length+"v"+tsA2+", выход на "+ct.call.site+" — сохраняем оружие");
    }
  }
  // AWP не несут в почти проигранный ретейк (2 на 3+): снайпер сейвит
  cts.forEach(function(b){ b._awpSave = !!(BAL.awpSave && planted && b.primary === "AWP" && cts.length === 2 && aliveCount("T") >= 3); });
  if(planted && !ct.saving) updateRetake(cts);
  ctActTick(cts);
}

// план IGL: кто в каком районе. Сначала по роли (опорники — свои сайты, мидер —
// мид), лишние снимаются, нехватку закрывает ближайший из тех, кто нужен меньше
// всех (сказано всем — это и есть «ротатор, иди на B»)
function ctAssign(cts, need){
  var ct = teamTac.CT, A = ct.assign || (ct.assign = {}), RA = {anchorA:"A", anchorB:"B", mid:"M"};
  var anchorOf = function(a){ return a === "M" ? GEO.ctMid : GEO[a].anchor; };
  Object.keys(A).forEach(function(id){ if(!cts.some(function(o){ return o.id === id; })) delete A[id]; });
  cts.forEach(function(b){ if(!A[b.id] && RA[b.tRole] && need[RA[b.tRole]] > 0) A[b.id] = RA[b.tRole]; });
  var inA = function(a){ return cts.filter(function(o){ return A[o.id] === a; }); };
  // лишние в районе — снять дальних от него
  ["A","M","B"].forEach(function(a){ var L = inA(a), ap = anchorOf(a);
    L.sort(function(p, q){ return Math.hypot(q.x-ap.x, q.y-ap.y) - Math.hypot(p.x-ap.x, p.y-ap.y); });
    while(L.length > (need[a]||0)){ delete A[L.shift().id]; } });
  // нехватка — ближайший свободный
  ["A","B","M"].sort(function(p, q){ return (need[q]||0) - (need[p]||0); }).forEach(function(a){ var ap = anchorOf(a);
    while(inA(a).length < (need[a]||0)){
      var free = cts.filter(function(o){ return !A[o.id]; }).sort(function(p, q){ return Math.hypot(p.x-ap.x, p.y-ap.y) - Math.hypot(q.x-ap.x, q.y-ap.y); })[0];
      if(!free) break; A[free.id] = a; } });
  // свободные (сверх плана) — к сайту, где по картине команды вероятнее T
  var lean = beliefMass("CT", BZ.siteNear.A||[]) >= beliefMass("CT", BZ.siteNear.B||[]) ? "A" : "B";
  cts.forEach(function(b){ if(!A[b.id]) A[b.id] = lean; });
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


