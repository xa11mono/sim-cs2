// [хозяева: ctBrain, ctBrainBombDown, ctBrainCall, ctBrainFlank, ctBrainRotate, ctBrainSave] (v469, п.18 владельца 29.10, р8 м1: в войсе «ПЕРЕКОЛЛ A → B: бомба замечена (~2)», а бомбу никто не видел) сайт планта выведен
// исключением («никто у A не услышал писк — значит B», 220 knowPlant, plantGuess) — так и говорится, а не «замечена»
function ctPlantGuessOnly(){
  if(!bomb || bomb.state !== "planted") return false;
  var cts = bots.filter(function(o){ return o.team === "CT" && o.alive && o.know; });
  return cts.some(function(o){ return o.know.plantGuess; }) && !cts.some(function(o){ return o.know.plantSite && !o.know.plantGuess; });
}
// (00_PLAN, аудит 4.2, 05.11) CT «у сайта» — по длине пути с его высотой, а не по прямой: за стеной или на другом этаже по
// прямой «рядом», а дойти — далеко; такой CT считался защитником, и на сайт не шли
// (22.11, Ж23-П4, разбор м271222 р6: karrigan слышал T на T Apps → Stove → B Apartments, на A давно тихо, но колла B и перетяжки не было
// до планта: T Apps не входит в зоны сайта B) звук «на подходе к сайту» — по пути: зона ближе по графу зон к этому сайту, чем к другому.
// Знание КОМАНДЫ (что сказали в войс): ветки «слышали здесь» за 5 с (то же окно, что у seen/heard колла)
var CT_SITE_D = null;
function ctSiteD(){ if(!CT_SITE_D || CT_SITE_D.n !== BZ.ids.length) CT_SITE_D = {n: BZ.ids.length, A: bzDist(BZ.siteZ.A || []), B: bzDist(BZ.siteZ.B || [])}; return CT_SITE_D; }
function ctHeardToward(k){
  var A = TEAMK.CT, K = A && A.know; if(!K || !K.enemies || !BZ.ids.length) return 0;
  var D = ctSiteD(), o = k === "A" ? "B" : "A", w = 0;
  bots.forEach(function(e){ if(!e.alive || e.team !== "T") return; var E = K.enemies[e.id]; if(!E || !E.hyps) return;
    E.hyps.forEach(function(h){ if(!h.heard || h.htick == null || tick - h.htick > 5*TICK_HZ || h.x == null) return;
      var z = bzOf(h.x, h.y); if(z >= 0 && D[k][z] < D[o][z]) w += h.weight || 0; }); });
  return w;
}
// живые T, о которых команда не знает, где они: «ушёл, куда — неизвестно» + свежие звуки на подходе к сайту k
function ctUnknownT(k){
  var A = TEAMK.CT, K = A && A.know, n = 0; if(!K || !K.enemies) return 0;
  bots.forEach(function(e){ if(!e.alive || e.team !== "T") return; var E = K.enemies[e.id]; if(!E || E.visible || !E.hyps) return;
    E.hyps.forEach(function(h){ if(h.type === "moved_unknown") n += h.weight || 0; }); });
  return n + ctHeardToward(k);
}
function ctNearSite(b, S, r){ return DM.hypot(b.x-S.x, b.y-S.y) < r && polyLen(pathPts(b.x, b.y, S.x, S.y, b.z)) < r; }
var CALL_WEAK = 0.5, CALL_WEAK_QUIET = 10;   // (v560) проектные числа: «слабый» колл, с тишины
function ctBrain(){
  // (Р3.2 команда) контекст мозга: общие для частей переменные (best, ct, cts, goOn, planted, planted0, res, secLeftCT)
  var K = {};
  K.ct = teamTac.CT;
  K.cts = bots.filter(function(b){ return b.team==="CT" && b.alive; });
  // ---- колл по сайтам: раздел 11 (инфа) + раздел 13 (карта вероятностей) ----
  // ПОВОД для колла — только реальная инфа: вижу/слышу/граната/носитель бомбы/
  // погиб опорник и сайт пустой. А "сколько их там" и "держать ли ещё колл" —
  // по карте вероятностей: CT на сайте, которые смотрят и никого не видят, сами
  // её "чистят" — и колл снимается, когда там вероятно уже пусто (раньше колл
  // висел 20с после последней инфы, и ротаторы стояли на пустом сайте).
  K.best = null, K.planted0 = bomb.state === "planted", K.res = {};
  // (v262, К5) бомбу выбили (носитель погиб, C4 лежит у тела) и кто-то из CT её видел — это знание всей
  // команды (сказали в войс): T придут её поднимать. Один держит бомбу взглядом с укрытия, а для колла
  // она — как замеченный носитель: колл и ротация идут на её сторону (раньше держали только без колла,
  // а колл при убитом носителе есть почти всегда — и никто не держал). Передача бомбы тиммейту — не выбитая.
  ctBrainBombDown(K);
  ctBrainCall(K);
  ctBrainRotate(K);
  // ---- фланг: "поджать в спину" ----
  // На подтверждённый выход (2+ T на сайте) один свободный CT — мидер или
  // роумер, которого не отправили на ротацию, — не бежит на сам сайт, а
  // заходит T за спину: через мид на их сторону карты → на подход T к сайту →
  // к входу на сайт, в спину заходящим. Раз за раунд, один игрок.
  K.secLeftCT = ROUND_TIME_SEC - (simTime - roundStartTime);
  if(K.ct.flank && !bots.some(function(o){ return o.id === K.ct.flank.id && o.alive; })) K.ct.flank.dead = true;
  // (v583a, Д2, владелец 17.11: р2 м302 — kyousuke получил фланг при колле «A», колл сменился на B, опорник B погиб — фланг не пересмотрен, «играю B»
  // только через 20 с) фланг — по колу и раскладу: колл сменил сайт, бомба стоит на другом сайте или флангер остался один — фланг отменяется
  // (дальше — обычные решения: ротация на колл, клатч)
  if(K.ct.flank && !K.ct.flank.dead){ var fWhy = K.cts.length <= 1 ? "остался один" : (K.ct.call && K.ct.call.site !== K.ct.flank.site) ? "колл сменился на " + K.ct.call.site :
      (K.planted0 && bomb && bomb.site && bomb.site !== K.ct.flank.site) ? "бомба на " + bomb.site : null;
    if(fWhy){ K.ct.flank.dead = true; voiceLog("CT", "flankoff", K.ct.flank.id, "фланг отменяю — " + fWhy); } }
  ctBrainFlank(K);
  K.planted = bomb.state === "planted";
  // сейв: ретейк безнадёжен (сильно меньше людей или не успеть дойти+дефузнуть) —
  // CT не идут умирать, а сохраняют оружие на следующий раунд
  // (v469, п.16 владельца 29.10, снимок м1 р6 т36243: m0NESY бежал на ретейк за 2,6 с до взрыва — не добежать, не то что дефузить) после
  // «сейв → ретейк» второй сейв запрещался (_noResave), даже когда время кончилось. «Не успеть дойти и снять» — новая инфа: сейв можно снова
  ctBrainSave(K);
  ctBrainPlayers(K);
}

// часть ctBrain (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 46–66 исходного ctBrain
function ctBrainBombDown(K){
  K.ct.bombDown = null;
  var deathDrop = bomb.state === "dropped" && bots.some(function(o){ return o.team === "T" && !o.alive && DM.hypot(o.x-bomb.x, o.y-bomb.y) < 20; });
  if(!deathDrop) K.ct.bombWatch = null;
  else {
    if(K.ct.bombWatch && K.ct.bombWatch.id && !K.cts.some(function(o){ return o.id === K.ct.bombWatch.id; })) K.ct.bombWatch.id = null; // держащий погиб — знание остаётся
    if(!K.ct.bombWatch){
      var seer = K.cts.filter(function(o){ return DM.hypot(o.x-bomb.x, o.y-bomb.y) < 1000 && hasVision(o.x, o.y, bomb.x, bomb.y); })
        .sort(function(a, c){ return DM.hypot(a.x-bomb.x, a.y-bomb.y) - DM.hypot(c.x-bomb.x, c.y-bomb.y); })[0];
      if(seer){ K.ct.bombWatch = {id:null, pt:null};
        voiceLog("CT", "bombw", seer.id, "бомба лежит "+calloutName(bomb.x, bomb.y).replace(/^на /, "")+", держим"); }
    }
    if(K.ct.bombWatch && !K.ct.bombWatch.id && K.cts.length >= 2){
      // держит ближайший к бомбе — с укрытия рядом с собой, откуда её видно (если он далеко — у бомбы)
      var bw = K.cts.slice().sort(function(a, c){ return DM.hypot(a.x-bomb.x, a.y-bomb.y) - DM.hypot(c.x-bomb.x, c.y-bomb.y); })[0];
      var bwNear = DM.hypot(bw.x-bomb.x, bw.y-bomb.y) < 450;
      var bwp = pickSpots("bombwatch"+Math.round(bomb.x/30)+","+Math.round(bomb.y/30)+(bwNear ? "" : "f"), bwNear ? {x:bw.x, y:bw.y} : {x:bomb.x, y:bomb.y}, 2,
        {team: "CT", rMin:bwNear ? 0 : 150, rMax:bwNear ? 200 : 450, minGap:40, must:[{x:bomb.x, y:bomb.y}], hideFrom:[GEO.A.tStage, GEO.B.tStage]})[0] || {x:bw.x, y:bw.y};
      K.ct.bombWatch.id = bw.id; K.ct.bombWatch.pt = bwp;
    }
    if(K.ct.bombWatch) K.ct.bombDown = {x:bomb.x, y:bomb.y};
  }
}

// часть ctBrain (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 67–181 исходного ctBrain
function ctBrainCall(K){
  ["A","B"].forEach(function(k){
    var est = intelEstimate("CT", SITES[k].x, SITES[k].y, 400, 5*64);
    // бомба у сайта / на подходе к нему (заметно ближе к нему, чем к другому). (v432, М167, м1 Mirage р11: sh1ro с бомбой видели в Connector,
    // потом на Mid, уже по пути на B, — CT до конца раунда держали A) где носитель — по знанию команды (knowEnemySpots: гипотезы с
    // направлением хода, со временем расходятся), а не точка, где его видели, на 5 с: точка у Connector считалась «бомба идёт на A»,
    // куда бы он ни шёл. Бомба выбита и лежит — где лежит. «Скорее всего» — больше половины веса гипотез
    var ko2 = k === "A" ? "B" : "A";
    var carS = K.ct.bombDown ? [{x:K.ct.bombDown.x, y:K.ct.bombDown.y, w:1}] : (teamIntel.CT.carrierId ? knowEnemySpots("CT", teamIntel.CT.carrierId) : []);
    var wHere = 0, wTo = 0;
    carS.forEach(function(q){ var dk = DM.hypot(q.x-SITES[k].x, q.y-SITES[k].y);
      if(dk < 400) wHere += q.w; else if(dk < 900 && dk + 250 < DM.hypot(q.x-SITES[ko2].x, q.y-SITES[ko2].y)) wTo += q.w; });
    var carrierHere = wHere > 0.5, carrierTo = !carrierHere && wHere + wTo > 0.5;
    // войс: "минус на A" — тиммейта убили у сайта за последние 8с
    var deathsHere = intelDeathsNear("CT", SITES[k].x, SITES[k].y, 450, 8*64);
    // слышали плант — T точно на этом сайте, и их там минимум двое
    var PH = teamIntel.CT.plantHeard, plantHere = PH && PH.site === k && tick - PH.tick < 5*TICK_HZ;
    var anchorRole = k==="A" ? "anchorA" : "anchorB";
    var anchorAlive = K.cts.some(function(b){ return b.tRole===anchorRole; });
    var holdingHere = K.cts.some(function(b){ return ctNearSite(b, SITES[k], 420); });
    // (v355, владелец: «колл сработал, хотя у него клатч» — 2 на 4, опорника B сняли, колл «B пустой» увёл NiKo с A, где были T) «сайт пустой» —
    // повод для колла только при 3+ живых CT: вдвоём / в одиночку сайт без опорника — не довод бросать свой
    var undefended = !anchorAlive && !holdingHere && !K.planted0 && K.cts.length >= 3;
    // повод для колла — СВЕЖЕЕ наблюдение (видели/слышали за окно), а не
    // "враг где-то тут по памяти": с единым хранилищем est.n постоянный, и колл
    // повторялся каждые 4с по одной и той же старой инфе
    var evN = (est.seen + est.heard);
    // (v151) раньше nadeHere использовалась ДО подсчёта (undefined → NaN): ev и
    // score сайта всегда были NaN, колл вечно висел на A, а B не мог его перебить
    var nadeHere = 0;
    // гранаты в первые ~18с — стандартный контроль карты (инсты, молотов на рампу),
    // про не читают их как выход; флешки — не довод (их кидают и в фейках)
    if(tick - roundStartTick > 18*TICK_HZ){
      (teamIntel.CT.nadeSeen||[]).forEach(function(q){ if(tick - q.tick > 6*TICK_HZ || q.type === "flash") return;
        if(DM.hypot(q.x-SITES[k].x, q.y-SITES[k].y) < 600 || DM.hypot(q.x-GEO[k].tEntry.x, q.y-GEO[k].tEntry.y) < 300 || DM.hypot(q.x-GEO[k].ctEntry.x, q.y-GEO[k].ctEntry.y) < 300)
          nadeHere += q.type === "flash" ? 0.5 : 1; });
    }
    // (22.11, Ж23-П4) слышали на подходе к сайту (по пути) — тоже наблюдение у этого сайта: один враг (вес веток «слышали»)
    var apprW = ctHeardToward(k);
    var ev = (apprW >= 0.5 ? 1 : 0) + evN + (carrierHere ? 1 : 0) + (carrierTo ? 0.5 : 0) + (undefended ? 1 : 0) + deathsHere + (plantHere ? 2 : 0) + (nadeHere >= 2 ? 1.2 : nadeHere * 0.4);
    var mass = beliefCount("CT", BZ.siteNear[k]||[]);
    // (11) чтение тактики по гранатам: 2+ гранаты T за 6с у сайта/его входов —
    // это выход (смоки на вход CT и кросс, молотов на опорника), даже если
    // самих T ещё не видели. Одна граната — только намёк (может быть фейк)
    // повод — не только реальный контакт РЯДОМ с сайтом, но и когда карта
    // вероятностей (по контакту где-то ещё, например засветили у КТ-спавна на
    // пути к Б) уже уверенно "верит", что враг у этого сайта — иначе колл на
    // такой заход никогда не появляется, пока враг физически не дойдёт до
    // самого сайта, и его встречает только штатный опорник в одиночку
    if(ev <= 0 && mass < 1.7) return;
    // бомбу видели у сайта — это выход, а не один игрок: минимум двое
    // (тактика 30.10, задание владельца: «CT реагируют на информацию, а не на сам факт гранаты; фейк не уводит всех») гранаты без увиденных /
    // услышанных T, смерти своего, бомбы — намёк, а не «выход ~3»: было 2,6 (две гранаты — и колл обходил терпение, уходили ротатор, роумер,
    // мидер). Теперь — один (проектное число; ротатор идёт после терпения); выход подтверждают шаги, контакт, бомба — тогда счёт растёт по ним
    // (тактика 30.10, задание владельца: «не смешивать отсутствие защитников CT с отсутствием T») «сайт пустой» (undefended) — некому
    // держать: повод заполнить сайт (pri ниже), но не знание о T — в счёт T не входит (было +1, и колл звучал «сайт пустой (~1)»)
    var cnt = Math.max(est.seen, est.heard ? 1 : 0, apprW >= 0.5 ? 1 : 0, (carrierHere||carrierTo) ? 2 : 0, plantHere ? 2 : 0, Math.min(3, deathsHere), Math.min(5, mass), nadeHere >= 2 ? 1 : 0);
    var score = ev + mass;
    // (22.11, Ж23, разбор м271222 р6: колл «A — двое» 40 с «свежий» каждый тик по догадке «носитель на T Ramp» — тишина его не снимала)
    // obs — новое НАБЛЮДЕНИЕ о T у сайта (видели / слышали / минус свой / плант / гранаты / бомба лежит на виду); догадка (вес гипотез,
    // носитель «скорее всего там», «некому держать») колл держит, но свежим его не делает
    var obs = est.seen + est.heard > 0 || deathsHere > 0 || !!plantHere || nadeHere > 0 || !!(K.ct.bombDown && (carrierHere || carrierTo)) || apprW >= 0.5;
    K.res[k] = {site:k, score:score, ev:ev, count:cnt, est:est, carrier:carrierHere||carrierTo, undefended:undefended, deaths:deathsHere, plant:plantHere, nades:nadeHere, obs:obs};
    if(obs){ if(!K.ct._obsT || K.ct._obsT.r !== roundNum) K.ct._obsT = {r: roundNum}; K.ct._obsT[k] = tick; }   // (Ж23-П4) когда у сайта было последнее наблюдение
    if(!K.best || score > K.best.score) K.best = K.res[k];
  });
  // (v262, К4) одна ротация — одно решение. Ротаторы уже бегут на сайт колла — другой сайт перебивает колл
  // только новой инфой о T: там свежо видели/слышали/убили нашего и T там БОЛЬШЕ, чем на нашем, или там
  // бомба / плант (проектное правило). «Сайт пустой» — не инфа о T: опорник мог сам уйти на ротацию.
  // Раньше колл скакал между A и B по разнице «счёта» в доли (A1 ↔ B1,1 за 16 тиков), и ротаторы
  // разворачивались туда-обратно.
  K.goOn = !!(K.ct.go && K.ct.call && K.ct.go.site === K.ct.call.site && K.cts.some(function(o){ return K.ct.go.ids[o.id]; }));
  if(K.goOn && K.best && K.best.site !== K.ct.go.site){
    var fresh = K.best.est.seen + K.best.est.heard > 0 || K.best.carrier || K.best.plant || K.best.deaths > 0 || K.best.nades >= 2;
    if(!(fresh && (K.best.carrier || K.best.plant || Math.round(K.best.count) > Math.round(K.ct.call.count)))) K.best = K.res[K.ct.go.site] || null;
  }
  // (Д2, владелец 05.11: «спамился колл отбой… все на B») остался один T до планта — колл снят на весь раунд (эндгейм 330: один на него), а не
  // ставится снова новой инфой на следующем тике (колл ↔ отбой каждый тик, «отбой» каждый раз шёл в войс)
  if(K.best && K.ct._lastTOff === roundNum && !K.planted0 && aliveCount("T") === 1) K.best = null;
  if(K.best){
    var isNew = !K.ct.call || K.ct.call.site !== K.best.site;
    if(isNew || K.best.count > K.ct.call.count + 0.4 || tick - K.ct.call.tick > 64){
      var prevSite = K.ct.call ? K.ct.call.site : null;   // (v321, М23) колл переходит на другой сайт — «переколл»
      var prevCnt = isNew ? 0 : K.ct.call.count, prevLogged = isNew ? 0 : (K.ct.call.logged || 0);
      K.ct.call = {logged: prevLogged, site:K.best.site, count:K.best.count, tick:tick, evTick:(isNew || K.best.obs) ? tick : (K.ct.call.evTick || K.ct.call.tick), since:(!isNew && K.ct.call.since) || tick, sinceSite:K.best.site, undefended:K.best.undefended, bombSeen: K.best.carrier || K.best.plant, seen: K.best.est ? K.best.est.seen : 0, nades: K.best.nades || 0};
      var how = K.best.plant ? "слышно плант" : (K.best.nades >= 2 && !K.best.est.seen) ? "гранаты на "+K.best.site+" — выход" : K.best.undefended ? "некому держать — опорник погиб" : K.best.carrier ? (K.ct.bombDown ? "бомба выбита, лежит там" : ctPlantGuessOnly() ? "плант не слышали на "+(K.best.site === "A" ? "B" : "A")+" — значит "+K.best.site : "бомба замечена") : K.best.deaths ? "минус на сайте" : (K.best.est.seen ? "вижу "+K.best.est.seen : K.best.est.heard ? "слышу" : "по инфе");
      var n1 = Math.max(1, Math.round(K.best.count));
      // в войс — только новый колл или когда их стало БОЛЬШЕ, чем уже говорили
      // (повтор колла) колл снялся и через пару секунд поднялся снова по той же
      // инфе — раньше в войс шёл тот же текст ещё раз. Повторяем, только если их
      // стало больше или прошло 15с
      var CM = K.ct._callMem || (K.ct._callMem = {}), cm = CM[K.best.site];
      var dup = cm && n1 <= cm.n && tick - cm.tick < 15*TICK_HZ;
      // (v381, М130, владелец 16.10: «при сейве идут коллы ПЕРЕКОЛЛ B → A: минус на сайте (~1)») команда сейвит — коллов сайта нет
      if((isNew || n1 > prevLogged) && !dup && !K.ct.saving){ K.ct.call.logged = n1; CM[K.best.site] = {n:n1, tick:tick};
        // о T ничего не знаем (только «некому держать») — так и говорят, без «T на … (~1)»
        var noT = K.best.count < 0.5;
        if(isNew && prevSite && prevSite !== K.best.site) intelCallLog("CT", "recall"+K.best.site+tick, "ПЕРЕКОЛЛ "+prevSite+" → "+K.best.site+": "+how+(noT ? "" : " (~"+n1+")"), null, "recall");
        else intelCallLog("CT", "site"+K.best.site+n1, noT ? K.best.site+": "+how+", T там не видели" : K.best.site+" — "+(["", "один", "двое", "трое", "четверо", "все"][Math.min(5, n1)])+", "+how, null, "plan"); }
      else if(dup) K.ct.call.logged = Math.max(K.ct.call.logged||0, cm.n);
    } else { if(K.best.obs) K.ct.call.evTick = tick; K.ct.call.undefended = K.best.undefended; if(K.best.carrier || K.best.plant) K.ct.call.bombSeen = true; }
  } else if(K.ct.call){
    // новой инфы нет — оценка "сколько там" только тает вместе с картой
    K.ct.call.count = Math.min(K.ct.call.count, beliefCount("CT", BZ.siteNear[K.ct.call.site]||[]) + 0.3);
  }
  // (00_PLAN п.11, 05.11: колл A держался, когда последний T с бомбой ушёл в мид — опорник B 15 с бежал ротацией) новая инфа снимает колл,
  // под который ушла ротация: все живые T замечены командой за SITE_SEEN_SEC далеко от сайта колла (siteAssess «empty» — та же оценка, что у T)
  // (ответ 6Б) остался один T до планта, нас двое и больше — это эндгейм (endgame: один на него, остальные держат линии), а не ротация под колл
  var lastT = !K.planted0 && aliveCount("T") === 1 && K.cts.length >= 2;
  if(K.ct.call && (lastT || (!K.planted0 && siteAssess("CT", K.ct.call.site).level === "empty"))){
    // в войс — раз за раунд на сайт и причину (ключ войса раньше был с тиком — повтор не гасился)
    var offK = K.ct.call.site + (lastT ? "L" : "E"), OS = K.ct._offSaid || (K.ct._offSaid = {});
    if(OS[offK] !== roundNum){ OS[offK] = roundNum; intelCallLog("CT", "calloffK"+offK, "отбой колла на "+K.ct.call.site+": "+(lastT ? "остался один — играем на него" : "все T замечены не там — по ситуации"), null, "plan"); }
    if(lastT) K.ct._lastTOff = roundNum;
    K.ct.call = null; K.ct.go = null;
  }
}

// часть ctBrain (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 182–326 исходного ctBrain
function ctBrainRotate(K){
  if(K.ct.call){
    var quiet = tick - (K.ct.call.evTick||K.ct.call.tick);
    // (v441, док владельца 27.10, р6: убили лёркера в Palace и T в B Apps — через 6 с «отбой колла на B: там вероятно пусто», трое ушли на A)
    // «пусто» — и у сайта, и в зонах подхода к нему (соседние зоны сайта: T Apps у B): T, стоящие у входа, — не пустой сайт
    var nearZ = (BZ.siteNear[K.ct.call.site]||[]).slice(); nearZ.slice().forEach(function(z){ (BZ.nbr[z]||[]).forEach(function(n){ if(nearZ.indexOf(n) < 0) nearZ.push(n); }); });
    var massNow = beliefCount("CT", nearZ);
    var lkpHere = lkpNear("CT", SITES[K.ct.call.site].x, SITES[K.ct.call.site].y, 500);
    // (v262, К4) тишина — не новая инфа: колл, под который уже ушла ротация, тишиной не снимается
    // (раньше «давно тихо — по местам» разворачивал ротаторов на полпути и оставлял их на промежуточной точке)
    // (v560, В80, разбор владельца 11.11: «бомба на миду, в Коннекторе шаги и флешка, а CT ротируются на другой сайт» — колл B с весом 0,33
    // держался 33 с: под него ушла ротация, а тишина его не снимала) слабый колл (меньше CALL_WEAK врагов по знанию) — снимается тишиной и
    // когда под него уже идут: ротация по нему — догадка, а не инфа
    var weak = K.ct.call.count < CALL_WEAK && massNow < CALL_WEAK;
    if((!K.goOn || (weak && quiet > CALL_WEAK_QUIET*64)) && lkpHere === 0 && ((quiet > 6*64 && massNow < 0.6) || quiet > 18*64)){
      logEvent("CT: по "+K.ct.call.site+" давно тихо"+(massNow < 0.6 ? " и там вероятно пусто" : "")+" — по местам");
      intelCallLog("CT", "calloff"+K.ct.call.site+tick, "отбой колла на "+K.ct.call.site+": давно тихо"+(massNow < 0.6 ? ", там вероятно пусто" : "")+" — по местам", null, "plan");   // (v321, М23)
      K.ct.call = null;
    }
  }
  // ---- кто ротирует: ровно столько, сколько нужно ----
  // Раньше на любой колл шли ротатор+роумер, а на 2+ — ещё мидер и второй
  // опорник: на А оказывалось 3-4 CT против 1-2 T, а мид и Б пустели.
  // Теперь: нужно ~столько защитников, сколько там вероятно врагов, +1 к одному;
  // первыми идут ротатор и роумер, мидер — только если на миде вероятно пусто,
  // второй опорник — только на большой стак и если на его сайте никого.
  K.ct.rot = {};
  if(!K.ct.call || K.planted0) K.ct.playRetake = null;
  if(K.ct.call && !K.planted0){
    var ks = K.ct.call.site, ko = ks === "A" ? "B" : "A", sc0 = SITES[ks];
    var need = Math.max(1, Math.ceil(K.ct.call.count - 0.25));
    var defenders = K.cts.filter(function(b){ return ctNearSite(b, sc0, 450); }).length;
    // защитников ≈ сколько там врагов (сайт даёт позиционное преимущество)
    var send = Math.max(0, Math.min(3, need - defenders));
    // (22.11, Ж23-П4, разбор м271222 р6) тишина меняет колл (PRO_PLAY: ротируют по давности и надёжности инфы; «тишина меняет колл»):
    // у этого сайта свежее наблюдение, у другого давно тихо (то же «давно», что у отбоя колла, 6 с), а живых T, о которых команда не знает,
    // где они, ≥ 2 — один ротатор идёт, даже если по счёту «хватает» своих (опорник один против неизвестно скольких). Не всех: может быть фейк
    var OT = K.ct._obsT && K.ct._obsT.r === roundNum ? K.ct._obsT : {};
    var otherQuiet = tick - (OT[ko] != null ? OT[ko] : roundStartTick) > 6*TICK_HZ, freshHere = tick - (K.ct.call.evTick || K.ct.call.tick) <= 5*TICK_HZ;
    if(send === 0 && freshHere && otherQuiet && ctUnknownT(ks) >= 2){ send = 1;
      if(K.ct._quietRot !== roundNum+ks){ K.ct._quietRot = roundNum+ks; logEvent("CT: на "+ko+" давно тихо, на "+ks+" инфа, где остальные — не знаем — ротатор на "+ks); } }
    // терпение: на первый звук/одного-двух не дёргаемся — ротация только
    // когда инфа подтвердилась (~2.5с держится) или это точно выход (бомба,
    // пустой сайт). Про-CT в это время просто тихо держат свои углы
    if(!K.ct.call.bombSeen && !K.ct.call.undefended && K.ct.call.count < 2.5 &&
       tick - (K.ct.call.since||tick) < (1.5)*TICK_HZ && !(K.ct.call.sinceSite && K.ct.call.sinceSite !== ks)){
      // (баланс) при реальной скорости ротация идёт в 1.5 раза дольше — ждём
      // подтверждения 1.5с, а не 2.5с, иначе ротатор приходил к уже взятому сайту
      send = 0;
      if(K.ct._patLog !== ks+roundNum+"|"+K.ct.call.since){ K.ct._patLog = ks+roundNum+"|"+K.ct.call.since; }
    }
    if(K.ct.call.bombSeen && !K.ct["_bv"+ks]){ K.ct["_bv"+ks] = true;
      voiceLog("CT", "bombrot"+ks, "CT", "бомба "+ks+"! ротейт"+(midMass < 0.9 ? " и мид" : "")); }
    if(!K.ct.call.since || K.ct.call.sinceSite !== ks){ K.ct.call.since = tick; K.ct.call.sinceSite = ks; }
    var confirmed = tick - K.ct.call.since > 1.5*TICK_HZ; // мидер/второй опорник снимаются не с первого звука
    var midMass = beliefMass("CT", BZ.midZ), otherMass = beliefMass("CT", BZ.siteNear[ko]||[]);
    // ---- раздел: ротация по счёту ----
    // Сколько T живо и сколько из них уже "учтены": видели/слышали здесь (колл)
    // и свежо (≤8с) видели в другом месте. Все учтены здесь → можно снимать
    // всех (другой сайт пуст); кого-то держат у другого сайта/мида → тот
    // опорник/мидер остаётся; нас меньше и на сайт идёт стак → ротаторы не
    // бегут по одному в 1в3, а ждут у входа и играют ретейк.
    var allIn = false, keepOther = false, keepMid = false;
    // (v281, владелец 14.10: после зачистки B колл «все 1 на B» при последнем T на A) честное число: хвост 0,3 — это 0, а не 1
    var tAliveN = aliveCount("T"), here = Math.min(tAliveN, Math.round(K.ct.call.count));
    var elseO = 0, elseM = 0, elseAny = 0, hereKnown = 0;
    var BLh = kvLast("CT"); for(var eidH in BLh){ var eH = BLh[eidH], obH = teamBot(eidH); if(!obH || !obH.alive || tick - eH.tick > 8*TICK_HZ) continue; if(DM.hypot(eH.x-sc0.x, eH.y-sc0.y) < 900) hereKnown++; }   // (v365) знание команды по игрокам — beliefLast (beliefLast бывает пуст)
    for(var eidR in kvLast("CT")){ var eR = kvLast("CT")[eidR]; if(tick - eR.tick > 8*TICK_HZ) continue; if(DM.hypot(eR.x-sc0.x, eR.y-sc0.y) < 900) continue;
      elseAny++; if(DM.hypot(eR.x-SITES[ko].x, eR.y-SITES[ko].y) < 750) elseO++; else if(DM.hypot(eR.x-GEO.ctMid.x, eR.y-GEO.ctMid.y) < 650) elseM++; }
    var unacc = Math.max(0, tAliveN - here - elseAny);
    K.ct.call.unacc = unacc;
    keepOther = elseO > 0 || unacc >= 2; keepMid = elseM > 0;
    // (v257, К1) все живые T учтены здесь — снимаются все, и когда T остался один (раньше — только при 2+)
    // (v361, владелец: «колл "все 2 на A — B пустой, все на A!", но на B есть») «все здесь» — только когда каждого живого T
    // команда реально знает у этого сайта (видели/слышали за 8 с — beliefLast, по игроку), а не по оценке «их ~2» (карта вероятностей
    // считала одного на A за двоих, второй T стоял у B незамеченным)
    allIn = tAliveN >= 1 && hereKnown >= tAliveN && unacc === 0 && elseAny === 0 && confirmed;
    // (v257, К1) все T здесь, другой сайт пуст — идут все (как и говорят в войс), а не «врагов + 1»
    if(allIn){ need = Math.max(need, K.cts.length); send = Math.max(0, Math.min(4, need - defenders)); }
    if(allIn && K.ct._allInLog !== ks+roundNum){ K.ct._allInLog = ks+roundNum;
      voiceLog("CT", "allin"+ks, "CT", "все "+tAliveN+" на "+ks+" — "+ko+" пустой, все на "+ks+"!"); }
    // нас меньше, а на сайт идёт стак — не в одиночку на сайт, а ретейк
    var stackIn = here >= defenders + 2 && here >= 3;
    if(stackIn && K.cts.length < tAliveN && !K.ct.call.bombSeen){
      if(!K.ct.playRetake || K.ct.playRetake.site !== ks){ K.ct.playRetake = {site:ks, tick:tick};
        voiceLog("CT", "prt"+ks, "CT", "их больше ("+here+" на "+ks+", нас "+K.cts.length+") — не лезем по одному, играем ретейк"); }
    } else if(K.ct.playRetake && (K.ct.playRetake.site !== ks || K.ct.call.bombSeen)) K.ct.playRetake = null;
    // (7) расстановка 1-1-1 (T разошлись: у A, на миде и у B по одному):
    // один контакт — это не выход. Держим дефолт, на колл идёт максимум один
    // (ротатор), мид и второй опорник не снимаются, пока нет бомбы/стака
    var spread = false;
    if(!K.ct.call.bombSeen && !K.ct.call.undefended && aliveCount("T") >= 3){
      var zA = 0, zB = 0, zM = 0;
      for(var eidS in kvLast("CT")){ var eS = kvLast("CT")[eidS]; if(tick - eS.tick > 10*TICK_HZ) continue;
        if(DM.hypot(eS.x-SITES.A.x, eS.y-SITES.A.y) < 800) zA++; else if(DM.hypot(eS.x-SITES.B.x, eS.y-SITES.B.y) < 800) zB++; else if(DM.hypot(eS.x-GEO.ctMid.x, eS.y-GEO.ctMid.y) < 700 || DM.hypot(eS.x-GEO.tMid.x, eS.y-GEO.tMid.y) < 500) zM++; }
      var bA = beliefMass("CT", BZ.siteNear.A||[]), bB = beliefMass("CT", BZ.siteNear.B||[]), bM = beliefMass("CT", BZ.midZ);
      var areas = ((zA || bA > 0.6) ? 1 : 0) + ((zB || bB > 0.6) ? 1 : 0) + ((zM || bM > 0.6) ? 1 : 0);
      spread = areas >= 3 && K.ct.call.count < 2.5;
      if(spread){
        allIn = false; keepOther = true; keepMid = true; send = Math.min(send, 1);
        if(K.ct._s111Log !== roundNum){ K.ct._s111Log = roundNum; voiceLog("CT", "s111", "CT", "они разошлись по одному (A, мид, B) — держим свои, не перекручиваемся, играем от количества"); }
      }
    }
    K.ct.spread = spread;
    // (v519, пак 09.11 п.9) «защита сайта потеряна» — по тому, где свои погибли (у этого сайта и на миде рядом), а не по названиям ролей: роли CT
    // меняются по расстановке каждый раунд, и «опорник A» в этом раунде мог стоять на миде. Нужны: хотя бы один погиб у самого сайта и всего ≥ 2
    // у сайта / на миде (как было: опорник + ещё один с той стороны). 700 px — проектное число («у сайта» по прямой, как ctNearSite у колла)
    var deadCT = bots.filter(function(o){ return o.team === "CT" && !o.alive; });
    var nearS = function(o){ return DM.hypot(o.x-SITES[ks].x, o.y-SITES[ks].y) < 700; }, nearM = function(o){ return DM.hypot(o.x-GEO.ctMid.x, o.y-GEO.ctMid.y) < 700; };
    var aLost = deadCT.some(nearS) && deadCT.filter(function(o){ return nearS(o) || nearM(o); }).length >= 2;
    var pri = function(b){
      var r = b.tRole;
      if(r === "rotator") return 0;
      if(r === "roamer") return 1;
      if(r === "mid") return keepMid ? 99 : (allIn || K.ct.call.undefended || (K.ct.call.bombSeen && midMass < 0.9) || (need >= 2 && confirmed && midMass < 0.5)) ? 2 : 99;
      // (v469, п.7 владельца 29.10, снимок м1 р4 т20487: мидер, ротатор и опорник A убиты, колл «T на A ~3», karrigan стоял на B до 1:24 —
      // его держали «двое неучтённых») ответ про-аналитика 29.10: защита A потеряна (её опорник и ещё один с той стороны мертвы) и там 3+ T —
      // опорник другого сайта стягивается сразу, не ждёт бомбу; держит свой сайт только свежая инфа о T у него (elseO), а не «двое неизвестно где»
      if(r === (ko === "A" ? "anchorA" : "anchorB") && aLost && Math.round(K.ct.call.count) >= 3 && elseO === 0) return 3;
      if(r === (ko === "A" ? "anchorA" : "anchorB")) return keepOther ? (K.ct.call.undefended && !(K.ct.call.unacc >= 2) && otherMass < 1 ? 3 : 99) : (allIn || K.ct.call.undefended || (need >= 3 && confirmed && otherMass < 0.35)) ? 3 : 99;
      // "сайт пустой, опорник погиб" — это не догадка по карте вероятностей, а
      // точный факт (в реальной игре об этом сказали бы в голос) — под такой
      // колл идёт даже единственный живой ротатор, а не только по порогу need
      if(r === "mid") return (K.ct.call.undefended || (K.ct.call.bombSeen && midMass < 0.9) || (need >= 2 && confirmed && midMass < 0.5)) ? 2 : 99;
      if(r === (ko === "A" ? "anchorA" : "anchorB")) return (K.ct.call.undefended || (need >= 3 && confirmed && otherMass < 0.35)) ? 3 : 99;
      return 99;
    };
    // (v262, К4) кого послали — тот идёт до конца: ротация не снимается, когда «счёт» на сайте подтаял, при
    // «разошлись по одному» или терпении — только новый колл на другой сайт (новая инфа) или конец колла.
    // Новых посылаем столько, сколько ещё не хватает с учётом уже идущих. Держащий выбитую бомбу — не ротирует.
    if(!K.ct.go || K.ct.go.site !== ks) K.ct.go = {site:ks, ids:{}, tick:tick};
    var goingFar = 0;
    K.cts.forEach(function(b){ if(K.ct.go.ids[b.id]){ K.ct.rot[b.id] = true; if(DM.hypot(b.x-sc0.x, b.y-sc0.y) >= 450) goingFar++; } });
    // (отметка владельца 18.11 №7: «почему у тиммейта 3 раза путь пересобрался, пока седьмой стрелялся») опорник другого сайта уже у сайта колла
    // (пришёл к выбитой бомбе, ≤ 450) — играет этот сайт, а не уходит по роли на свой через перестрелку: в раздачу ротации шли только те, кто
    // дальше 450, и karrigan с A ушёл «опорником B» (473,flight), потом «выйти на врага», потом снова на B
    // (18.11, «чинить механику целиком») не только опорник другого сайта — любая роль (мидер, ротатор, роумер), кто уже у сайта колла и не в
    // ротации; кроме опорника этого сайта (его пост и так здесь)
    K.cts.forEach(function(b){
      if(b.tRole !== "anchor"+ks && !K.ct.rot[b.id] && !(K.ct.bombWatch && K.ct.bombWatch.id === b.id) && DM.hypot(b.x-sc0.x, b.y-sc0.y) < 450){ K.ct.rot[b.id] = true; K.ct.go.ids[b.id] = true; } });
    K.cts.filter(function(b){ return pri(b) < 99 && !K.ct.rot[b.id] && !(K.ct.bombWatch && K.ct.bombWatch.id === b.id) && DM.hypot(b.x-sc0.x, b.y-sc0.y) >= 450; })
       .sort(function(a,b){ return pri(a) - pri(b) || (DM.hypot(a.x-sc0.x,a.y-sc0.y) - DM.hypot(b.x-sc0.x,b.y-sc0.y)); })
       .slice(0, Math.max(0, send - goingFar)).forEach(function(b){ K.ct.rot[b.id] = true; K.ct.go.ids[b.id] = true;
         voiceLog("CT", "rot"+b.id+ks+roundNum, b.id, "ротейт "+ks);   // (v321, М23) кто ротирует
       });
  } else if(!K.ct.call) K.ct.go = null;
}

// часть ctBrain (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 340–353 исходного ctBrain
function ctBrainFlank(K){
  if(!K.ct.flank && K.ct.call && !K.planted0 && K.ct.call.count >= 2 && tick - (K.ct.call.since||tick) > 2*TICK_HZ && K.secLeftCT > 25 && K.cts.length >= 2){
    var fs = K.ct.call.site;
    var cand = K.cts.filter(function(b){ return (b.tRole === "mid" || b.tRole === "roamer") && !(K.ct.rot && K.ct.rot[b.id]) &&
      DM.hypot(b.x-SITES[fs].x, b.y-SITES[fs].y) > 500; })
      .sort(function(a, b2){ return (a.tRole === "mid" ? 0 : 1) - (b2.tRole === "mid" ? 0 : 1); })[0];
    // (ответ владельца 9) маршрут у врага — не идти: на зоне маршрута фланга (набор карты) команда недавно (SITE_SEEN_SEC) видела / слышала T
    var CFr = ((MAP.tactics.plays.ctFlank || {}).route || {})[fs === "A" ? "A" : "B"] || [], BLc = kvLast("CT");
    if(cand && CFr.some(function(n){ var zp = zonePoint(n, SITES[fs]), zz = zp && zoneIdAt(zp.x, zp.y); return zz && bots.some(function(o){ var e = BLc[o.id];
      return o.alive && o.team === "T" && e && tick - e.tick <= SITE_SEEN_SEC*TICK_HZ && zoneIdAt(e.x, e.y) === zz; }); })) cand = null;
    if(cand){
      K.ct.flank = {id:cand.id, site:fs, stage:0, arr:0};
      voiceLog("CT", "flank"+fs, cand.id, "захожу в спину через мид");
    }
  }
}

// часть ctBrain (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 359–419 исходного ctBrain
function ctBrainSave(K){
  if(K.planted && !K.ct.saving){
    var tsAlive = bots.filter(function(b){ return b.team==="T" && b.alive; }).length;
    var secs = bombTimeLeftTicks()/TICK_HZ;
    // честный расчёт (план §8): для каждого CT — длина реального пути до бомбы
    // / скорость + время дефуза ЕГО (с китом или без); берём лучший вариант
    var needSecs = Infinity;
    K.cts.forEach(function(b){
      var t = defuseEta(b) + 1.0;   // (Г1) дефузит — остаток дефуза
      if(t < needSecs) needSecs = t;
    });
    // сейвить имеет смысл только то, что стоит денег: с пистолетами и без
    // брони терять нечего — лучше попробовать ретейк
    var equip = K.cts.reduce(function(a,b){ return a + (b.primary ? WEAPONS[b.primary].price : 0) + (b.armor ? 650 : 0); }, 0) / Math.max(1, K.cts.length);
    // (v334, М63, отметка владельца: karrigan 1 на 4 с USP не сейвился, хотя рядом на Top Mid лежал АК) сохранить можно и то, что
    // подберёт по пути: лучшее оружие ≤ 450 ед. карты от CT, где врага по инфе нет, — в цену сейва
    K.cts.forEach(function(b){ var add = 0; groundWeapons.forEach(function(G){ if(DM.hypot(G.x-b.x, G.y-b.y) < 450 && weaponValue(G.key) > weaponValue(b.primary) &&
      intelEstimate("CT", G.x, G.y, 450, 5*TICK_HZ).n === 0) add = Math.max(add, WEAPONS[G.key].price); }); equip += add/Math.max(1, K.cts.length); });
    var hopeless = (K.cts.length === 1 && tsAlive >= BAL.saveGap) || (K.cts.length <= tsAlive - BAL.saveGap) || needSecs > secs;
    // (v158) у про после взрыва живы 2,1 CT, у ботов было 1,2: сейвят раньше
    hopeless = hopeless || (K.cts.length >= 2 && K.cts.length <= tsAlive - 2) || (K.cts.length === 1 && tsAlive >= 3) ||
      (K.cts.length === 1 && tsAlive === 2 && !(K.cts[0].kit && needSecs + 8 < secs)); // 2v4 — ещё пробуем, 1v3/1v4/2v5 — сейв
    if(K.ct._noResave && !(needSecs > secs)) hopeless = false;
    // (v530, отметка владельца 10.11 «не идёт дефузить»: все T мертвы, до взрыва 10,9 с, дефуз 6,4 с — а оба CT шли «на сейв», включённый раньше)
    // врагов не осталось (видно по табло) — сохранять не от кого: решает только «успеть ли дефузнуть» (снятие уже включённого сейва — ниже)
    if(tsAlive === 0) hopeless = needSecs > secs;   // после «сейв → ретейк» — снова сейв только если не успеть
    if(K.cts.length && hopeless && ((equip >= 1800 && saveWorth("CT")) || needSecs > secs)){   // (v434) сохранять — если оружие перейдёт в следующий раунд (saveWorth); не успеть — сейв всё равно
      K.ct.saving = true; saveCancelTrades("CT");
      logEvent("CT: сейв — ретейк "+K.cts.length+"v"+tsAlive+(needSecs > secs ? ", не успеть" : "")+", сохраняем оружие");
    }
  }
  // (8) сейв → ретейк: на сейве сняли T и расклад выровнялся (1v1, 2v2, 1v2 при
  // запасе времени) — сейв отменяется, идём ретейкать/защищать
  if(K.ct.saving && K.cts.length && tick % 16 === 0){
    var tsS = aliveCount("T");
    if(K.planted){
      var secsS = bombTimeLeftTicks()/TICK_HZ, needS = Infinity;
      K.cts.forEach(function(b){ var t = defuseEta(b) + 1.0; if(t < needS) needS = t; });
      var evenS = K.cts.length >= tsS || (K.cts.length === tsS - 1 && needS + 7 < secsS);
      // (v530) врагов не осталось (tsS = 0, видно по табло) — сохранять не от кого: сейв снимается, если просто успеть дефузнуть (было: при tsS = 0
      // сейв не снимался вовсе — оба CT уходили от бомбы при мёртвых T)
      if(tsS > 0 ? (evenS && needS + 2 < secsS) : needS < secsS){
        K.ct.saving = false; K.ct._noResave = true; K.cts.forEach(function(b){ b._saveSpot = null; });
        logEvent("CT: сейв → ретейк — теперь "+K.cts.length+"v"+tsS+", успеваем ("+Math.round(secsS)+"с)");
        voiceLog("CT", "sv2rt", K.cts[0].id, K.cts.length+" на "+tsS+" — успеваем, идём ретейкать!");
      }
    } else if(K.ct.preSave && K.cts.length >= tsS){
      K.ct.saving = false; K.ct.preSave = false; K.ct._noResave = true; K.cts.forEach(function(b){ b._saveSpot = null; });
      logEvent("CT: сейв → ретейк — теперь "+K.cts.length+"v"+tsS+", играем раунд");
    }
  }
  // сейв CT до планта: 1v3+/2v5, T уже заходят на сайт, у нас есть что сохранять
  if(!K.planted && !K.ct.saving && !K.ct._noResave && K.ct.call && K.ct.call.count >= 3 && K.cts.length){
    var tsA2 = aliveCount("T"), eq2 = K.cts.reduce(function(a,b){ return a + (b.primary ? WEAPONS[b.primary].price : 0); }, 0)/K.cts.length;
    var secL2 = ROUND_TIME_SEC - (simTime - roundStartTime);
    if(((K.cts.length === 1 && tsA2 >= 3) || (K.cts.length === 2 && tsA2 >= 5)) && eq2 >= 2700 && secL2 > 25 && saveWorth("CT")){
      K.ct.saving = true; K.ct.preSave = true; saveCancelTrades("CT");
      logEvent("CT: сейв до планта — "+K.cts.length+"v"+tsA2+", выход на "+K.ct.call.site+" — сохраняем оружие");
      voiceLog("CT", "presave", K.cts[0].id, K.cts.length+" против "+tsA2+", они уже на "+K.ct.call.site+" — сейв");
    }
  }
  if(K.planted && !K.ct.saving) updateRetake(K.cts);
}
