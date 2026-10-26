function ctBrain(){
  var ct = teamTac.CT;
  var cts = bots.filter(function(b){ return b.team==="CT" && b.alive; });
  // ---- колл по сайтам: раздел 11 (инфа) + раздел 13 (карта вероятностей) ----
  // ПОВОД для колла — только реальная инфа: вижу/слышу/граната/носитель бомбы/
  // погиб опорник и сайт пустой. А "сколько их там" и "держать ли ещё колл" —
  // по карте вероятностей: CT на сайте, которые смотрят и никого не видят, сами
  // её "чистят" — и колл снимается, когда там вероятно уже пусто (раньше колл
  // висел 20с после последней инфы, и ротаторы стояли на пустом сайте).
  var best = null, planted0 = bomb.state === "planted", res = {};
  // (v262, К5) бомбу выбили (носитель погиб, C4 лежит у тела) и кто-то из CT её видел — это знание всей
  // команды (сказали в войс): T придут её поднимать. Один держит бомбу взглядом с укрытия, а для колла
  // она — как замеченный носитель: колл и ротация идут на её сторону (раньше держали только без колла,
  // а колл при убитом носителе есть почти всегда — и никто не держал). Передача бомбы тиммейту — не выбитая.
  ct.bombDown = null;
  if(BAL.bombWatch){
    var deathDrop = bomb.state === "dropped" && bots.some(function(o){ return o.team === "T" && !o.alive && Math.hypot(o.x-bomb.x, o.y-bomb.y) < 20; });
    if(!deathDrop) ct.bombWatch = null;
    else {
      if(ct.bombWatch && ct.bombWatch.id && !cts.some(function(o){ return o.id === ct.bombWatch.id; })) ct.bombWatch.id = null; // держащий погиб — знание остаётся
      if(!ct.bombWatch){
        var seer = cts.filter(function(o){ return Math.hypot(o.x-bomb.x, o.y-bomb.y) < 1000 && hasVision(o.x, o.y, bomb.x, bomb.y); })
          .sort(function(a, c){ return Math.hypot(a.x-bomb.x, a.y-bomb.y) - Math.hypot(c.x-bomb.x, c.y-bomb.y); })[0];
        if(seer){ ct.bombWatch = {id:null, pt:null};
          voiceLog("CT", "bombw", seer.id, "бомба лежит "+calloutName(bomb.x, bomb.y)+" — держим её"); }
      }
      if(ct.bombWatch && !ct.bombWatch.id && cts.length >= 2){
        // держит ближайший к бомбе — с укрытия рядом с собой, откуда её видно (если он далеко — у бомбы)
        var bw = cts.slice().sort(function(a, c){ return Math.hypot(a.x-bomb.x, a.y-bomb.y) - Math.hypot(c.x-bomb.x, c.y-bomb.y); })[0];
        var bwNear = Math.hypot(bw.x-bomb.x, bw.y-bomb.y) < 450;
        var bwp = pickSpots("bombwatch"+Math.round(bomb.x/30)+","+Math.round(bomb.y/30)+(bwNear ? "" : "f"), bwNear ? {x:bw.x, y:bw.y} : {x:bomb.x, y:bomb.y}, 2,
          {rMin:bwNear ? 0 : 150, rMax:bwNear ? 200 : 450, minGap:40, must:[{x:bomb.x, y:bomb.y}], hideFrom:[GEO.A.tStage, GEO.B.tStage]})[0] || {x:bw.x, y:bw.y};
        ct.bombWatch.id = bw.id; ct.bombWatch.pt = bwp;
      }
      if(ct.bombWatch) ct.bombDown = {x:bomb.x, y:bomb.y};
    }
  }
  ["A","B"].forEach(function(k){
    var est = intelEstimate("CT", SITES[k].x, SITES[k].y, 400, 5*64);
    // бомба у сайта / на подходе к нему (заметно ближе к нему, чем к другому). (v432, М167, м1 Mirage р11: sh1ro с бомбой видели в Connector,
    // потом на Mid, уже по пути на B, — CT до конца раунда держали A) где носитель — по знанию команды (knowEnemySpots: гипотезы с
    // направлением хода, со временем расходятся), а не точка, где его видели, на 5 с: точка у Connector считалась «бомба идёт на A»,
    // куда бы он ни шёл. Бомба выбита и лежит — где лежит. «Скорее всего» — больше половины веса гипотез
    var ko2 = k === "A" ? "B" : "A";
    var carS = ct.bombDown ? [{x:ct.bombDown.x, y:ct.bombDown.y, w:1}] : (teamIntel.CT.carrierId ? knowEnemySpots("CT", teamIntel.CT.carrierId) : []);
    var wHere = 0, wTo = 0;
    carS.forEach(function(q){ var dk = Math.hypot(q.x-SITES[k].x, q.y-SITES[k].y);
      if(dk < 400) wHere += q.w; else if(dk < 900 && dk + 250 < Math.hypot(q.x-SITES[ko2].x, q.y-SITES[ko2].y)) wTo += q.w; });
    var carrierHere = wHere > 0.5, carrierTo = !carrierHere && wHere + wTo > 0.5;
    // войс: "минус на A" — тиммейта убили у сайта за последние 8с
    var deathsHere = intelDeathsNear("CT", SITES[k].x, SITES[k].y, 450, 8*64);
    // слышали плант — T точно на этом сайте, и их там минимум двое
    var PH = teamIntel.CT.plantHeard, plantHere = PH && PH.site === k && tick - PH.tick < 5*TICK_HZ;
    var anchorRole = k==="A" ? "anchorA" : "anchorB";
    var anchorAlive = cts.some(function(b){ return b.tRole===anchorRole; });
    var holdingHere = cts.some(function(b){ return Math.hypot(b.x-SITES[k].x, b.y-SITES[k].y) < 420; });
    // (v355, владелец: «колл сработал, хотя у него клатч» — 2 на 4, опорника B сняли, колл «B пустой» увёл NiKo с A, где были T) «сайт пустой» —
    // повод для колла только при 3+ живых CT: вдвоём / в одиночку сайт без опорника — не довод бросать свой
    var undefended = !anchorAlive && !holdingHere && !planted0 && cts.length >= 3;
    // повод для колла — СВЕЖЕЕ наблюдение (видели/слышали за окно), а не
    // "враг где-то тут по памяти": с единым хранилищем est.n постоянный, и колл
    // повторялся каждые 4с по одной и той же старой инфе
    var evN = BAL.oneStore ? (est.seen + est.heard) : est.n;
    // (v151) раньше nadeHere использовалась ДО подсчёта (undefined → NaN): ev и
    // score сайта всегда были NaN, колл вечно висел на A, а B не мог его перебить
    var nadeHere = BAL.callFix ? 0 : undefined;
    // гранаты в первые ~18с — стандартный контроль карты (инсты, молотов на рампу),
    // про не читают их как выход; флешки — не довод (их кидают и в фейках)
    if(BAL.callFix && BAL.tacRead && tick - roundStartTick > 18*TICK_HZ){
      (teamIntel.CT.nadeSeen||[]).forEach(function(q){ if(tick - q.tick > 6*TICK_HZ || q.type === "flash") return;
        if(Math.hypot(q.x-SITES[k].x, q.y-SITES[k].y) < 600 || Math.hypot(q.x-GEO[k].tEntry.x, q.y-GEO[k].tEntry.y) < 300 || Math.hypot(q.x-GEO[k].ctEntry.x, q.y-GEO[k].ctEntry.y) < 300)
          nadeHere += q.type === "flash" ? 0.5 : 1; });
    }
    var ev = evN + (carrierHere ? 1 : 0) + (carrierTo ? 0.5 : 0) + (undefended ? 1 : 0) + deathsHere + (plantHere ? 2 : 0) + (nadeHere >= 2 ? 1.2 : nadeHere * 0.4);
    var mass = beliefCount("CT", BZ.siteNear[k]||[]);
    // (11) чтение тактики по гранатам: 2+ гранаты T за 6с у сайта/его входов —
    // это выход (смоки на вход CT и кросс, молотов на опорника), даже если
    // самих T ещё не видели. Одна граната — только намёк (может быть фейк)
    if(!BAL.callFix) nadeHere = 0;
    if(!BAL.callFix && BAL.tacRead){
      (teamIntel.CT.nadeSeen||[]).forEach(function(q){ if(tick - q.tick > 6*TICK_HZ) return;
        if(Math.hypot(q.x-SITES[k].x, q.y-SITES[k].y) < 600 || Math.hypot(q.x-GEO[k].tEntry.x, q.y-GEO[k].tEntry.y) < 300 || Math.hypot(q.x-GEO[k].ctEntry.x, q.y-GEO[k].ctEntry.y) < 300)
          nadeHere += q.type === "flash" ? 0.5 : 1; });
    }
    // повод — не только реальный контакт РЯДОМ с сайтом, но и когда карта
    // вероятностей (по контакту где-то ещё, например засветили у КТ-спавна на
    // пути к Б) уже уверенно "верит", что враг у этого сайта — иначе колл на
    // такой заход никогда не появляется, пока враг физически не дойдёт до
    // самого сайта, и его встречает только штатный опорник в одиночку
    if(ev <= 0 && mass < 1.7) return;
    // бомбу видели у сайта — это выход, а не один игрок: минимум двое
    var cnt = Math.max(est.seen, est.heard ? 1 : 0, (carrierHere||carrierTo) ? 2 : 0, plantHere ? 2 : 0, undefended ? 1 : 0, Math.min(3, deathsHere), Math.min(5, mass), nadeHere >= 2 ? 2.6 : 0);
    var score = ev + mass;
    res[k] = {site:k, score:score, ev:ev, count:cnt, est:est, carrier:carrierHere||carrierTo, undefended:undefended, deaths:deathsHere, plant:plantHere, nades:nadeHere};
    if(!best || score > best.score) best = res[k];
  });
  // (v262, К4) одна ротация — одно решение. Ротаторы уже бегут на сайт колла — другой сайт перебивает колл
  // только новой инфой о T: там свежо видели/слышали/убили нашего и T там БОЛЬШЕ, чем на нашем, или там
  // бомба / плант (проектное правило). «Сайт пустой» — не инфа о T: опорник мог сам уйти на ротацию.
  // Раньше колл скакал между A и B по разнице «счёта» в доли (A1 ↔ B1,1 за 16 тиков), и ротаторы
  // разворачивались туда-обратно.
  var goOn = !!(ct.go && ct.call && ct.go.site === ct.call.site && cts.some(function(o){ return ct.go.ids[o.id]; }));
  if(goOn && best && best.site !== ct.go.site){
    var fresh = best.est.seen + best.est.heard > 0 || best.carrier || best.plant || best.deaths > 0 || best.nades >= 2;
    if(!(fresh && (best.carrier || best.plant || Math.round(best.count) > Math.round(ct.call.count)))) best = res[ct.go.site] || null;
  }
  if(best){
    var isNew = !ct.call || ct.call.site !== best.site;
    if(isNew || best.count > ct.call.count + 0.4 || tick - ct.call.tick > 64){
      var prevSite = ct.call ? ct.call.site : null;   // (v321, М23) колл переходит на другой сайт — «переколл»
      var prevCnt = isNew ? 0 : ct.call.count, prevLogged = isNew ? 0 : (ct.call.logged || 0);
      ct.call = {logged: prevLogged, site:best.site, count:best.count, tick:tick, evTick:tick, since:(!isNew && ct.call.since) || tick, sinceSite:best.site, undefended:best.undefended, bombSeen: best.carrier || best.plant, seen: best.est ? best.est.seen : 0, nades: best.nades || 0};
      var how = best.plant ? "слышно плант" : (best.nades >= 2 && !best.est.seen) ? "гранаты на "+best.site+" — выход" : best.undefended ? "сайт пустой, опорник погиб" : best.carrier ? (ct.bombDown ? "бомба выбита, лежит там" : "бомба замечена") : best.deaths ? "минус на сайте" : (best.est.seen ? "вижу "+best.est.seen : best.est.heard ? "слышу" : "по инфе");
      var n1 = Math.max(1, Math.round(best.count));
      // в войс — только новый колл или когда их стало БОЛЬШЕ, чем уже говорили
      // (повтор колла) колл снялся и через пару секунд поднялся снова по той же
      // инфе — раньше в войс шёл тот же текст ещё раз. Повторяем, только если их
      // стало больше или прошло 15с
      var CM = ct._callMem || (ct._callMem = {}), cm = CM[best.site];
      var dup = BAL.callDedup && cm && n1 <= cm.n && tick - cm.tick < 15*TICK_HZ;
      // (v381, М130, владелец 16.10: «при сейве идут коллы ПЕРЕКОЛЛ B → A: минус на сайте (~1)») команда сейвит — коллов сайта нет
      if((isNew || n1 > prevLogged) && !dup && !ct.saving){ ct.call.logged = n1; CM[best.site] = {n:n1, tick:tick};
        if(isNew && prevSite && prevSite !== best.site) intelCallLog("CT", "recall"+best.site+tick, "ПЕРЕКОЛЛ "+prevSite+" → "+best.site+": "+how+" (~"+n1+")", null, "recall");
        else intelCallLog("CT", "site"+best.site+n1, "T на "+best.site+" (~"+n1+", "+how+")", null, "plan"); }
      else if(dup) ct.call.logged = Math.max(ct.call.logged||0, cm.n);
    } else { ct.call.evTick = tick; ct.call.undefended = best.undefended; if(best.carrier || best.plant) ct.call.bombSeen = true; }
  } else if(ct.call){
    // новой инфы нет — оценка "сколько там" только тает вместе с картой
    ct.call.count = Math.min(ct.call.count, beliefCount("CT", BZ.siteNear[ct.call.site]||[]) + 0.3);
  }
  if(ct.call){
    var quiet = tick - (ct.call.evTick||ct.call.tick);
    var massNow = beliefCount("CT", BZ.siteNear[ct.call.site]||[]);
    var lkpHere = lkpNear("CT", SITES[ct.call.site].x, SITES[ct.call.site].y, 500);
    // (v262, К4) тишина — не новая инфа: колл, под который уже ушла ротация, тишиной не снимается
    // (раньше «давно тихо — по местам» разворачивал ротаторов на полпути и оставлял их на промежуточной точке)
    if(!goOn && lkpHere === 0 && ((quiet > 6*64 && massNow < 0.6) || quiet > 18*64)){
      logEvent("CT: по "+ct.call.site+" давно тихо"+(massNow < 0.6 ? " и там вероятно пусто" : "")+" — по местам");
      intelCallLog("CT", "calloff"+ct.call.site+tick, "отбой колла на "+ct.call.site+": давно тихо"+(massNow < 0.6 ? ", там вероятно пусто" : "")+" — по местам", null, "plan");   // (v321, М23)
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
      // (v281, владелец 14.10: после зачистки B колл «все 1 на B» при последнем T на A) честное число: хвост 0,3 — это 0, а не 1
      var tAliveN = aliveCount("T"), here = Math.min(tAliveN, Math.round(ct.call.count));
      var elseO = 0, elseM = 0, elseAny = 0, hereKnown = 0;
      var BLh = beliefLast.CT || {}; for(var eidH in BLh){ var eH = BLh[eidH], obH = teamBot(eidH); if(!obH || !obH.alive || tick - eH.tick > 8*TICK_HZ) continue; if(Math.hypot(eH.x-sc0.x, eH.y-sc0.y) < 900) hereKnown++; }   // (v365) знание команды по игрокам — beliefLast (beliefLast бывает пуст)
      for(var eidR in beliefLast.CT){ var eR = beliefLast.CT[eidR]; if(tick - eR.tick > 8*TICK_HZ) continue; if(Math.hypot(eR.x-sc0.x, eR.y-sc0.y) < 900) continue;
        elseAny++; if(Math.hypot(eR.x-SITES[ko].x, eR.y-SITES[ko].y) < 750) elseO++; else if(Math.hypot(eR.x-GEO.ctMid.x, eR.y-GEO.ctMid.y) < 650) elseM++; }
      var unacc = Math.max(0, tAliveN - here - elseAny);
      ct.call.unacc = unacc;
      keepOther = elseO > 0 || unacc >= 2; keepMid = elseM > 0;
      // (v257, К1) все живые T учтены здесь — снимаются все, и когда T остался один (раньше — только при 2+)
      // (v361, владелец: «колл "все 2 на A — B пустой, все на A!", но на B есть») «все здесь» — только когда каждого живого T
      // команда реально знает у этого сайта (видели/слышали за 8 с — beliefLast, по игроку), а не по оценке «их ~2» (карта вероятностей
      // считала одного на A за двоих, второй T стоял у B незамеченным)
      allIn = tAliveN >= 1 && hereKnown >= tAliveN && unacc === 0 && elseAny === 0 && confirmed;
      // (v257, К1) все T здесь, другой сайт пуст — идут все (как и говорят в войс), а не «врагов + 1»
      if(allIn){ need = Math.max(need, cts.length); send = Math.max(0, Math.min(4, need - defenders)); }
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
      for(var eidS in beliefLast.CT){ var eS = beliefLast.CT[eidS]; if(tick - eS.tick > 10*TICK_HZ) continue;
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
        if(r === (ko === "A" ? "anchorA" : "anchorB")) return keepOther ? (ct.call.undefended && !(ct.call.unacc >= 2) && otherMass < 1 ? 3 : 99) : (allIn || ct.call.undefended || (need >= 3 && confirmed && otherMass < 0.35)) ? 3 : 99;
      }
      // "сайт пустой, опорник погиб" — это не догадка по карте вероятностей, а
      // точный факт (в реальной игре об этом сказали бы в голос) — под такой
      // колл идёт даже единственный живой ротатор, а не только по порогу need
      if(r === "mid") return (ct.call.undefended || (ct.call.bombSeen && midMass < 0.9) || (need >= 2 && confirmed && midMass < 0.5)) ? 2 : 99;
      if(r === (ko === "A" ? "anchorA" : "anchorB")) return (ct.call.undefended || (need >= 3 && confirmed && otherMass < 0.35)) ? 3 : 99;
      return 99;
    };
    // (v262, К4) кого послали — тот идёт до конца: ротация не снимается, когда «счёт» на сайте подтаял, при
    // «разошлись по одному» или терпении — только новый колл на другой сайт (новая инфа) или конец колла.
    // Новых посылаем столько, сколько ещё не хватает с учётом уже идущих. Держащий выбитую бомбу — не ротирует.
    if(!ct.go || ct.go.site !== ks) ct.go = {site:ks, ids:{}, tick:tick};
    var goingFar = 0;
    cts.forEach(function(b){ if(ct.go.ids[b.id]){ ct.rot[b.id] = true; if(Math.hypot(b.x-sc0.x, b.y-sc0.y) >= 450) goingFar++; } });
    cts.filter(function(b){ return pri(b) < 99 && !ct.rot[b.id] && !(ct.bombWatch && ct.bombWatch.id === b.id) && Math.hypot(b.x-sc0.x, b.y-sc0.y) >= 450; })
       .sort(function(a,b){ return pri(a) - pri(b) || (Math.hypot(a.x-sc0.x,a.y-sc0.y) - Math.hypot(b.x-sc0.x,b.y-sc0.y)); })
       .slice(0, Math.max(0, send - goingFar)).forEach(function(b){ ct.rot[b.id] = true; ct.go.ids[b.id] = true;
         voiceLog("CT", "rot"+b.id+ks+roundNum, b.id, "иду на "+ks+" ("+(ROLE_LABEL_CT(b.tRole))+")");   // (v321, М23) кто ротирует
       });
  } else if(!ct.call) ct.go = null;
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
  // сейв: ретейк безнадёжен (сильно меньше людей или не успеть дойти+дефузнуть) —
  // CT не идут умирать, а сохраняют оружие на следующий раунд
  if(planted && !ct.saving && !ct._noResave){
    var tsAlive = bots.filter(function(b){ return b.team==="T" && b.alive; }).length;
    var secs = bombTimeLeftTicks()/TICK_HZ;
    // честный расчёт (план §8): для каждого CT — длина реального пути до бомбы
    // / скорость + время дефуза ЕГО (с китом или без); берём лучший вариант
    var needSecs = Infinity;
    cts.forEach(function(b){
      var t = pathLenTo(b, bomb.x, bomb.y)/SPEED + (b.kit ? 5 : 10) + 1.0;
      if(t < needSecs) needSecs = t;
    });
    // сейвить имеет смысл только то, что стоит денег: с пистолетами и без
    // брони терять нечего — лучше попробовать ретейк
    var equip = cts.reduce(function(a,b){ return a + (b.primary ? WEAPONS[b.primary].price : 0) + (b.armor ? 650 : 0); }, 0) / Math.max(1, cts.length);
    // (v334, М63, отметка владельца: karrigan 1 на 4 с USP не сейвился, хотя рядом на Top Mid лежал АК) сохранить можно и то, что
    // подберёт по пути: лучшее оружие ≤ 450 ед. карты от CT, где врага по инфе нет, — в цену сейва
    cts.forEach(function(b){ var add = 0; groundWeapons.forEach(function(G){ if(Math.hypot(G.x-b.x, G.y-b.y) < 450 && weaponValue(G.key) > weaponValue(b.primary) &&
      intelEstimate("CT", G.x, G.y, 450, 5*TICK_HZ).n === 0) add = Math.max(add, WEAPONS[G.key].price); }); equip += add/Math.max(1, cts.length); });
    var hopeless = (cts.length === 1 && tsAlive >= BAL.saveGap) || (cts.length <= tsAlive - BAL.saveGap) || needSecs > secs;
    // (v158) у про после взрыва живы 2,1 CT, у ботов было 1,2: сейвят раньше
    if(BAL.groupRetake) hopeless = hopeless || (cts.length >= 2 && cts.length <= tsAlive - 2) || (cts.length === 1 && tsAlive >= 3) ||
      (cts.length === 1 && tsAlive === 2 && !(cts[0].kit && needSecs + 8 < secs)); // 2v4 — ещё пробуем, 1v3/1v4/2v5 — сейв
    if(cts.length && hopeless && ((equip >= 1800 && saveWorth("CT")) || needSecs > secs)){   // (v434) сохранять — если оружие перейдёт в следующий раунд (saveWorth); не успеть — сейв всё равно
      ct.saving = true; saveCancelTrades("CT");
      logEvent("CT: сейв — ретейк "+cts.length+"v"+tsAlive+(needSecs > secs ? ", не успеть" : "")+", сохраняем оружие");
    }
  }
  // (8) сейв → ретейк: на сейве сняли T и расклад выровнялся (1v1, 2v2, 1v2 при
  // запасе времени) — сейв отменяется, идём ретейкать/защищать
  if(BAL.saveRetake && ct.saving && cts.length && tick % 16 === 0){
    var tsS = aliveCount("T");
    if(planted){
      var secsS = bombTimeLeftTicks()/TICK_HZ, needS = Infinity;
      cts.forEach(function(b){ var t = pathLenTo(b, bomb.x, bomb.y)/SPEED + (b.kit ? 5 : 10) + 1.0; if(t < needS) needS = t; });
      var evenS = cts.length >= tsS || (cts.length === tsS - 1 && needS + 7 < secsS);
      if(evenS && needS + 2 < secsS && tsS > 0){
        ct.saving = false; ct._noResave = true; cts.forEach(function(b){ b._saveSpot = null; });
        logEvent("CT: сейв → ретейк — теперь "+cts.length+"v"+tsS+", успеваем ("+Math.round(secsS)+"с)");
        voiceLog("CT", "sv2rt", cts[0].id, cts.length+" на "+tsS+" — успеваем, идём ретейкать!");
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
    if(((cts.length === 1 && tsA2 >= 3) || (cts.length === 2 && tsA2 >= 5)) && eq2 >= 2700 && secL2 > 25 && saveWorth("CT")){
      ct.saving = true; ct.preSave = true; saveCancelTrades("CT");
      logEvent("CT: сейв до планта — "+cts.length+"v"+tsA2+", выход на "+ct.call.site+" — сохраняем оружие");
      voiceLog("CT", "presave", cts[0].id, cts.length+" против "+tsA2+", они уже на "+ct.call.site+" — сейв");
    }
  }
  if(planted && !ct.saving) updateRetake(cts);
  cts.forEach(function(b){
    if(b.defusing) return;
    var role = b.tRole;
    if((planted || ct.preSave) && ct.saving){
      // сейв не на CT-спавне (там T как раз и будут искать), а в месте подальше от
      // бомбы и от живых T, откуда их не видно; каждый — своё ближайшее такое место
      if(!b._saveSpot){ b._saveSpot = pickSaveSpot(b); }
      if(b.post && b.post.tag === "pickup" && taskAlive(b)) return;   // (v334, М63) по пути на сейв подбирает оружие — не перебивать
      setPost(b, b._saveSpot, {x:bomb.x, y:bomb.y}, true, "save"); // взгляд — на угол, из-за которого придут от бомбы
      return;
    }
    if(ct.bombDown && ct.bombWatch.id === b.id){ // (v262, К5) держит выбитую бомбу и при колле
      setPost(b, ct.bombWatch.pt, {x:bomb.x, y:bomb.y}, true, "bombwatch"); return; }
    if(!planted && !ct.saving && ctLandPunish(b)) return;   // (v343) услышал приземление одного рядом — выходит на него
    if(ct.flank && !ct.flank.dead && ct.flank.id === b.id && !ct.saving && flankPost(b, ct.flank, planted)) return;
    // (35) ретейк 2 на 3+ — AWP не несут в почти проигранный ретейк: снайпер сейвит
    if(BAL.awpSave && planted && b.primary === "AWP" && cts.length === 2 && aliveCount("T") >= 3 && saveWorth("CT")){
      if(!b._saveSpot){ b._saveSpot = pickSaveSpot(b); voiceLog("CT", "awpsave"+b.id, b.id, "2 на "+aliveCount("T")+" — сейвлю AWP"); }
      setPost(b, b._saveSpot, {x:bomb.x, y:bomb.y}, true, "save"); return;
    }
    if(planted){ retakePost(b, cts); return; }
    if(BAL.styles && ctEarlyPeek(b, ct)) return;
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
      spSmart = ctNearP >= tNearP || secLeftP < 12 || hasLOS(b.x, b.y, PHs.x, PHs.y, b.z);
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
        b._stopPlantUntil = tick + 2*TICK_HZ; b._reposUntil = 0;
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
      var sg2 = teamIntel.CT.sig, srcs = {}, sx = 0, sy = 0, sn = 0;
      for(var q2=sg2.length-1; q2>=0; q2--){
        var g2 = sg2[q2]; if(tick - g2.tick > 5*TICK_HZ) break;
        if(g2.type !== "sound" || srcs[g2.id]) continue;
        if(Math.hypot(g2.x-b.x, g2.y-b.y) > 650 || hasLOS(b.x, b.y, g2.x, g2.y, b.z)) continue;
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
          b._reposUntil = 0; setPost(b, bestR, sc0, true, "repos"); b._reposUntil = tick + 6*TICK_HZ;
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
      var threatSig = null, TIsig = teamIntel.CT.sig;
      for(var si=TIsig.length-1; si>=0; si--){
        var sgz = TIsig[si];
        if(tick - sgz.tick > 6*TICK_HZ) break;
        if((sgz.type==="spotted" || sgz.type==="sound") && Math.hypot(sgz.x-siteC.x, sgz.y-siteC.y) < 450){ threatSig = sgz; break; }
      }
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
    // (v342, отметка владельца: «бомба выбита — колл, а NiKo стоит опорником на Palace») C4 лежит у другого сайта (колл «бомба
    // лежит — держим её», ct.bombDown), CT ≤ 3 — опорник идёт к бомбе: на его сайте без бомбы ставить нечего. При 4–5 CT остаётся
    if((role === "anchorA" || role === "anchorB") && ct.bombDown && cts.length <= 3 && !(bomb && bomb.state === "planted")){
      var kMine = role === "anchorA" ? "A" : "B", kBomb = kMine === "A" ? "B" : "A", bd = ct.bombDown;
      if(Math.hypot(bd.x-SITES[kBomb].x, bd.y-SITES[kBomb].y) + 250 < Math.hypot(bd.x-SITES[kMine].x, bd.y-SITES[kMine].y)){
        var bdp = pickSpots("bdrot"+kBomb, GEO[kBomb].anchor, 3, {rMax:260, minGap:60, see:[{x:bd.x, y:bd.y}], hideFrom:[GEO[kBomb].tStage]})[0] || GEO[kBomb].anchor;
        var wasBd = b.post && b.post.tag === "rotate:bomb";
        if(setPost(b, bdp, {x:bd.x, y:bd.y}, true, "rotate:bomb") && !wasBd){ voiceLog("CT", "bdrot"+b.id+roundNum, b.id, "бомба на "+kBomb+" — иду к вам с "+kMine); safeRotate(b, bdp, kBomb); }
        return;
      }
    }
    if(BAL.ctSetups && ctSetupRole(b, role, ct)) return;
    if(role === "anchorA" || role === "anchorB"){
      // опорник каждый раунд встаёт на одну из нескольких позиций у сайта, а не
      // всегда в одну точку — иначе T кидали бы молотов/флешку ровно в него по
      // заученной точке (в CS тоже меняют позиции, чтобы не читали)
      var kA = role === "anchorA" ? "A" : "B";
      // раздел 11.1: точки оценены и по второму направлению обзора (мид —
      // коннектор, "двойное покрытие"), и со штрафом за места, куда T в этом
      // матче уже кидали молотов/HE по этому сайту ("занимают под раскид")
      var opts = pickSpots("anchorOpts"+kA, GEO[kA].anchor, 5, {rMax:230, minGap:60,
        see:[GEO[kA].tEntry], seeW:[{pt:GEO.ctMid, w:0.6}], hideFrom:[GEO[kA].tStage],
        avoidNades: enemyNadeSpots("CT", kA)});
      var pickI = weightedPick(opts.length, roundNum*131 + matchNum*977 + (kA==="A"?1:2));
      // позиции по названиям зон (Temple, Back Site, 90, First Lane…): каждый
      // раунд — одна из них; первые в списке чаще, последние — как офф-угол
      var names = (BAL.proSetup ? PRO_ROLE["anchor"+kA] : POS[kA].ctHold), ents = [GEO[kA].tEntry].concat(entryPts(kA));
      var ni = BAL.proPrior ? posPickName(b, names, roundNum*131 + matchNum*977 + (kA==="A"?1:2)) : weightedPick(names.length, roundNum*131 + matchNum*977 + (kA==="A"?1:2));
      var offP = (BAL.styles && b.prof) ? 0.08 + 0.3*prof(b, "aggr") : 0.2; // агрессивный чаще берёт нестандартный угол
      var off = BAL.offAngle && hashRand(roundNum*577 + matchNum*31 + (kA==="A"?3:4)) < offP;
      if(BAL.proPrior) off = false;
      if(off) ni = names.length - 1 - Math.floor(hashRand(roundNum*11 + matchNum)*Math.min(3, names.length));
      var nsp = BAL.namedPos ? namedSpot(names[ni], GEO[kA].anchor, {see:ents, hideFrom:[GEO[kA].tStage], key:"hold"+kA}) : null;
      var holdPt = nsp || opts[pickI];
      if(nsp && b._holdLog !== roundNum){ b._holdLog = roundNum; logEvent(b.id+": держит "+kA+" с «"+names[ni]+"»"+(off ? " (офф-угол)" : "")); }
      // (плант 74%) опорник один на сайте, а туда идут 3+ (колл/гранаты выхода):
      // раньше стоял на своём угле и умирал первым, и сайт брали 4 на 0. Про в
      // такой ситуации отходит к входу CT, тянет время и остаётся живым на ретейк
      var cl = ct.call;
      if(BAL.anchorFall && cl && cl.site === kA && cl.count >= 2.6 && !(bomb && bomb.state === "planted") &&
         (!BAL.proCtSetup || (cl.seen || 0) >= 2 || (cl.nades || 0) >= 2 || cl.bombSeen) &&
         !cts.some(function(o){ return o !== b && Math.hypot(o.x-SITES[kA].x, o.y-SITES[kA].y) < 450; })){
        if(!b._afPt || b._afPt.round !== roundNum || b._afPt.k !== kA){
          var afp = pickSpots("afall"+kA, GEO[kA].ctEntry, 3, {rMin:40, rMax:260, minGap:50, hideFrom:[GEO[kA].tEntry, SITES[kA]], see:[GEO[kA].ctEntry]})[0];
          b._afPt = {round:roundNum, k:kA, pt: afp || GEO[kA].ctEntry};
          voiceLog("CT", "afall"+kA+roundNum, b.id, "их ~"+Math.round(cl.count)+" на "+kA+", я один — отхожу к CT, тяну время, ретейк с ротацией");
        }
        setPost(b, b._afPt.pt, SITES[kA], true, "anchor:fall");
        return;
      }
      // (v280, владелец 14.10: игрок 7 в Dark шёл петлёй ради 54 px) место сменилось на соседнее (< 100 px — проектное число) —
      // остаётся, где стоит: это то же место
      if(b.post && b.post.tag === "anchor" && holdPt && Math.hypot(holdPt.x-b.post.x, holdPt.y-b.post.y) < 100) holdPt = {x:b.post.x, y:b.post.y};
      setPost(b, holdPt, lookFrom(holdPt, ents, GEO[kA].tEntry, b), true, "anchor");
    }
    else if(role === "mid"){
      // раздел: дефолтная точка мида была одной и той же ВСЕГДА открытой точкой
      // со статичным взглядом — бот стоял в открытую, даже если известно, где
      // враг реально был. Теперь: несколько укрытых вариантов вместо одной
      // открытой точки, и взгляд — туда, где враг реально недавно замечен
      // рядом с мидом, а не всегда в одну сторону по умолчанию
      var midThreat = null, TImid = teamIntel.CT.sig;
      for(var smi=TImid.length-1; smi>=0; smi--){
        var sgm = TImid[smi];
        if(tick - sgm.tick > 6*TICK_HZ) break;
        if((sgm.type==="spotted"||sgm.type==="sound") && Math.hypot(sgm.x-GEO.ctMid.x, sgm.y-GEO.ctMid.y) < 420){ midThreat = sgm; break; }
      }
      var midLook = midThreat ? {x:midThreat.x, y:midThreat.y} : GEO.ctMidLook;
      // мидер с AWP: не всегда мид — иногда встаёт снайпером на сайт (длинная
      // линия), в остальное время пикает/держит мид
      if(BAL.namedPos && b.primary === "AWP" && !midThreat){
        var rr2 = hashRand(roundNum*613 + matchNum*29);
        var AS = MAP.tactics.plays.awpSite, AWPS = null;   // набор карты: none — доля раундов на миде, sets — места по долям
        if(AS && rr2 >= AS.none){ for(var asi = 0; asi < AS.sets.length; asi++){ AWPS = AS.sets[asi].spots; if(rr2 < AS.sets[asi].upTo) break; } }
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
        var midCare = BAL.roundMem && rmemRecent(RMEM.midDeath, 3).length >= 2;   // (10) рано умирал — отходит уже от одного
        if(nMid >= (midCare ? 1 : 2) || (b._midBack && b._midBack.round === roundNum && tick < b._midBack.until)){
          if(!b._midBack || b._midBack.round !== roundNum){
            var MHb = (MAP.tactics.plays.midHold || {}).back;   // куда мидер отходит (набор карты)
            var deep = (MHb && namedSpot(MHb, GEO.ctMid, {hideFrom:[GEO.tMid], see:[GEO.ctMid], key:"midback"})) ||
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
      // вперёд — реже; чаще глубже (набор карты: tactics.plays.midHold; Ancient — Jungle/Red Room, вперёд Top Mid/Sniper Nest)
      var MH = MAP.tactics.plays.midHold || {};
      // (v411, Б5з) места мида — и свои места игрока по демкам карты, выбор по доле его времени (posPickName)
      var mNames = posNamesOwn(b, BAL.midSafe && MH.safe ? MH.safe : POS.M.ctHold), mi = BAL.proPrior && posOwnZones(b.team, nick(b.id)).length ? posPickName(b, mNames, roundNum*191 + matchNum*433 + 7) : weightedPick(mNames.length, roundNum*191 + matchNum*433 + 7);
      // (10) мидер рано умирал в 2 из 3 последних раундов — в этом раунде глубже
      if(BAL.roundMem && MH.care && rmemRecent(RMEM.midDeath, 3).length >= 2){ mNames = MH.care; mi = weightedPick(MH.care.length, roundNum*191 + matchNum*433 + 7);
        if(b._midCareV !== roundNum){ b._midCareV = roundNum; voiceLog("CT", "midcare"+roundNum, b.id, "меня на миде рано снимают — сегодня играю глубже"); } }
      var mp = BAL.namedPos && !midThreat ? namedSpot(mNames[mi], GEO.ctMid, {see:[GEO.ctMidLook, GEO.tMid], hideFrom:[GEO.tMid], key:"mid"}) : null;
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
        // (v285, владелец 14.10: «в 2-1-2 пропадает опорник на A») 2-1-2 — это двое на A, мид, двое на B: роумер — второй на B
        // (roam212), ротатор — второй на A (раньше — к «горячему» сайту или на точку про-ротатора Alley/Red Room между сайтами,
        // и на A оставался один)
        var ks = "A";
        var ap2 = anchorPosOf(ks);
        if(!secondOnSite(b, ks, ap2))
        groupPost([b], GEO[ks].anchor, GEO[ks].tEntry, "anchor2"+ks, {rMin:70, rMax:230, minGap:60, see:[GEO[ks].tEntry], hideFrom:[GEO[ks].tStage],
          cross: ap2 ? {from:ap2, pt:GEO[ks].tEntry} : null});
      } else {
        // 1-1-1: ротатор бегает по первой инфе (это делает блок ротаций выше);
        // погиб мидер — занимает мид; иначе стоит на связке с видом на проход,
        // а не лицом в стену
        var midAlive = cts.some(function(o){ return o.tRole === "mid"; });
        if(!midAlive && BAL.namedPos){
          var mn = POS.M.ctHold[weightedPick(POS.M.ctHold.length, roundNum*17 + 3)];
          var mpp = namedSpot(mn, GEO.ctMid, {see:[GEO.ctMidLook, GEO.tMid], hideFrom:[GEO.tMid], key:"rotmid"}) || GEO.ctMid;
          if(b._rotMidLog !== roundNum){ b._rotMidLog = roundNum; logEvent(b.id+": мидер погиб — занимает мид («"+mn+"»)"); }
          setPost(b, mpp, GEO.ctMidLook, true, "mid");
        } else {
          // Alley и так закрывают мид и опорники — ротатор ждёт ближе к сайту,
          // куда T чаще ходят: место ротатора у этого сайта (набор карты: tactics.plays.rotatorHot; Ancient — у A CT Lane,
          // у B Back Halls); оттуда он и помогает быстрее, и сам держит полезный угол на сайт
          var hotR = siteHeat.A >= siteHeat.B ? "A" : "B";
          var rpn = (MAP.tactics.plays.rotatorHot || {})[hotR];
          var rEnts = [GEO[hotR].tEntry].concat(entryPts(hotR)).concat([SITES[hotR]]);
          var rp = (BAL.namedPos && namedSpot(rpn, SITES[hotR], {see:rEnts, key:"rot"+hotR})) || GEO.rotator;
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
      var hot = siteHeat.A >= siteHeat.B ? "A" : "B", ko2 = hot === "A" ? "B" : "A", apR = anchorPosOf(ko2);
      if(!(BAL.proSetup ? proRolePost(b, "roam", PRO_ROLE.roam212, GEO.B.anchor, GEO.B.tEntry, "anchor2B") : secondOnSite(b, ko2, apR)))
      groupPost([b], GEO[ko2].anchor, GEO[ko2].tEntry, "anchor2"+ko2, {rMin:70, rMax:230, minGap:60, see:[GEO[ko2].tEntry], hideFrom:[GEO[ko2].tStage],
        cross: apR ? {from:apR, pt:GEO[ko2].tEntry} : null});
    }
    // роумер — свой маршрут (пост роли). (v136) Раньше снимал ЛЮБОЙ пост каждый тик — временные затеи чередовались с ним.
    // (v378) снимает только то, что ниже его роли или кончилось — арбитр места
    else if(!b.post || !taskAlive(b) || b._task.lv <= 1) clearPost(b);
  });
}

