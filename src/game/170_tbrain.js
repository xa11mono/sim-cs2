function tBrain(){
  var tt = teamTac.T; if(!tt) return;
  if(BAL.proTempo && tt.phase === "setup" && tt.minExec && tt.execTick < roundStartTick + tt.minExec*TICK_HZ) tt.execTick = roundStartTick + tt.minExec*TICK_HZ;
  bStageFix();
  if(tt.seenCT && tick % 16 === 0 && (tt.phase === "setup" || (tt.execStart != null && tick - tt.execStart < 8*TICK_HZ))){
    ["A","B"].forEach(function(k){ var e = intelEstimate("T", SITES[k].x, SITES[k].y, 450, 4*TICK_HZ); if(e.seen > tt.seenCT[k]) tt.seenCT[k] = e.seen; });
  }
  if(tt.phase !== "setup" && !tt.histed){ tt.histed = true; tSiteHist.push(tt.site); }
  var tac = tt.tac, site = SITES[tt.site], g = GEO[tt.site];
  var other = tt.site === "A" ? "B" : "A";
  var plantPt = site.plant || site;
  var secLeft = ROUND_TIME_SEC - (simTime - roundStartTime);
  // (v381, М130, владелец 16.10: «при сейве идут коллы ПЕРЕКОЛЛ B → A: минус на сайте») решили сейвить — план раунда кончился:
  // ни выхода, ни переколлов, ни коллов IGL. Раньше перепривязка ниже шла раньше проверки сейва
  // (v434, PRINCIPLES М158, владелец 25.10: «сейв должен пересматриваться по ходу раунда»; м1 Mirage р11: сейв с 2 на 4, sh1ro убил двоих —
  // 2 на 2, а сейв продолжался) расклад живых сменился — то же решение заново (tSaveWant): у про при новом раскладе не сейвят — сейв снят
  if(tt.saving && bomb.state !== "planted"){
    var tsS = bots.filter(function(b){ return b.team === "T" && b.alive; }), sitS = tsS.length+"v"+aliveCount("CT");
    if(sitS === tt.saveSit || tSaveWant(tsS, tsS.length, aliveCount("CT"), secLeft, site)){ tt.saveSit = sitS; tSaveHold(); return; }
    tt.saving = 0; tt.saveSit = null;
    tsS.forEach(function(b){ b._saveSpot = null; if(b.post && b.post.tag === "save") clearPost(b); });
    logEvent("T: сейв снят — теперь "+sitS+", играем раунд");
    if(tsS[0]) voiceLog("T", "tunsave"+sitS, tsS[0].id, "теперь "+sitS.replace("v", " на ")+" — играем, не сейвим");
  }
  // поздно — выходим, даже если по плану ещё setup
  if(tt.phase === "setup" && (tick >= tt.execTick || secLeft < 35)){
    // раздел: синхронный выход по времени — команда не идёт на сайт вразнобой,
    // пока не собралась на точках сбора (иначе один уже на сайте, пока
    // остальные ещё в коридоре) — но ждём не дольше ~5с и не ждём, если время
    // раунда поджимает или флаг выключен
    var lateGrace = secLeft < 35 || !BAL.syncExec || tick - tt.execTick > (BAL.syncGrace||3)*TICK_HZ;
    var goNow = lateGrace;
    if(!goNow){
      var atk = bots.filter(function(b){ return b.team === "T" && b.alive && b.tRole !== "lurker" && !(b._midFlank && b._midFlank.round === roundNum); });
      var staged = atk.filter(function(b){ return b.atPost; }).length;
      var need = Math.max(1, Math.ceil(atk.length * (BAL.syncNeed||0.7)));
      goNow = staged >= need;
      if(!goNow && !tt._waitLog){ tt._waitLog = true; logEvent("T: ждём — не все на точках выхода"); }
    }
    // смоки выхода ещё летят — ждём, пока встанут (до ~2с), чтобы энтри не пикал под открытые углы
    if(goNow && BAL.nadeEarly && secLeft >= 35 && tt._smT && tick - tt._smT < 5*TICK_HZ && tick - tt.execTick < 5*TICK_HZ && tExecNadesFlying()){
      goNow = false; if(!tt._smWaitLog){ tt._smWaitLog = true; logEvent("T: ждём, пока встанут смоки"); }
    }
    if(goNow){
      tt.phase = "execute"; tt.execStart = tick; siteHeatPending[tt.site] = 1;
      logEvent("T: выход на "+tt.site+"!"+(tt._waitLog ? " (все собрались)" : ""));
    }
  }
  // войс: "минус опорник на A" в сетапе — сайт сейчас слабый, заходим сразу,
  // не дожидаясь тайминга (пока CT не успели перекрыть его ротацией)
  if(tt.phase === "setup"){
    // только если сняли того, кто держит сам сайт (опорника или игрока прямо на
    // точке), а не первого встречного на подходах
    var ancR = tt.site === "A" ? "anchorA" : "anchorB";
    var pickSig = teamIntel.T.sig.filter(function(s){ return s.type === "kill" && tick - s.tick < 3*64 &&
      (s.role === ancR ? Math.hypot(s.x-site.x, s.y-site.y) < 600 : Math.hypot(s.x-site.x, s.y-site.y) < 350); })[0];
    // (v359, отметка владельца р7: TN1R снял двоих на A на 16-й с, а команда ещё ждала тайминга, и он ушёл кидать молотов на
    // Connector) раннее «не спешим» (proTempo, до 22 с) — не когда наш уже стоит на сайте: сайт взят, заходим
    var ourOnSite = bots.some(function(o){ return o.team === "T" && o.alive && (onSite(site, o.x, o.y) || Math.hypot(o.x-site.x, o.y-site.y) < 450); });
    if(pickSig && aliveCount("T") >= 4 && (!BAL.proTempo || tick - roundStartTick > 22*TICK_HZ || ourOnSite) && iglTake(tt, pickSig.tick)){
      tt.phase = "execute"; tt.execStart = tick; siteHeatPending[tt.site] = 1;
      voiceLog("T", "pick"+tt.site, "IGL", "минус на "+tt.site+", заходим сразу!");
      logEvent("T: выход на "+tt.site+"! (сняли CT на сайте)");
    }
  }
  if(bomb.state === "planted" && tt.phase !== "postplant"){ tt.phase = "postplant";
    // (v144) фланг через мид и охота имели смысл до планта. После планта у них
    // не было исполнителя — стояли, где оставили. Теперь все в пост-плант
    if(BAL.ppFix === true) bots.forEach(function(o){ if(o.team !== "T") return; o._midFlank = null; o._shift = null; o._egC = null;
      if(o.post && /^(endhunt|stage.*CTside)/.test(o.post.tag || "")) clearPost(o); });
  }
  // ---- раздел 11: живая перепривязка тактики ----
  // IGL слушает коллы: если на нашем сайте стак CT (видели/слышали 2+ больше,
  // чем на другом) или там уже погибли двое наших, а времени хватает — один раз
  // за раунд меняем сайт. Выход не отменяется совсем: перегруппировка ~5с.
  if(!tt.rebound && bomb.state !== "planted" && secLeft > 40 && !carrierAtSite(tt) &&
     (tt.phase === "setup" || tick - (tt.execStart != null ? tt.execStart : tick) < 6*TICK_HZ)){
    var thr = function(k){
      var e = intelEstimate("T", SITES[k].x, SITES[k].y, 400, 6*TICK_HZ); // раздел 11.1: тот же радиус 400 — мид не должен читаться как сайт
      // (перекол) раньше e.n — все, кого "карта вероятностей" держит у сайта,
      // даже увиденные 20с назад в другом месте: стак "~3" из памяти → лишний
      // перекол. Теперь реальная свежая инфа (видели/слышали за 6с) + память с весом 0.35
      var fr = e.seen + e.heard, mem = Math.max(0, e.n - fr);
      if(BAL.recallStrict) freshC[k] = fr;
      return (BAL.recallStrict ? fr + 0.35*mem : e.n) + 1.2*intelDeathsNear("T", SITES[k].x, SITES[k].y, 550, 10*TICK_HZ);
    };
    var freshC = {};
    var here = thr(tt.site), there = thr(other);
    // другой сайт — по всей памяти (свежей инфы оттуда обычно нет, но это не
    // значит, что там пусто): раньше "там" почти всегда было 0 и перекол шёл легко
    if(BAL.recallStrict){ var eO = intelEstimate("T", SITES[other].x, SITES[other].y, 400, 6*TICK_HZ); there = Math.max(there, eO.n + 1.2*intelDeathsNear("T", SITES[other].x, SITES[other].y, 550, 10*TICK_HZ)); }
    var aliveT = bots.filter(function(b){ return b.team==="T" && b.alive; }).length;
    // обычная защита сайта — 1-2 CT; перепривязка только на явный перегруз (3+)
    // или когда на выходе уже теряем людей
    var deathsHere = intelDeathsNear("T", SITES[tt.site].x, SITES[tt.site].y, 550, 10*TICK_HZ);
    var needAlive = tt.phase === "setup" ? 3 : 4; // на выходе с потерями разворачиваться поздно
    // раздел 12: минус на ДРУГОМ сайте (лёркер/проба сняли там CT), а там по
    // инфе почти пусто — переходим туда и заходим, пока не перекрыли
    // (раньше хватало любого килла в 600px от сайта — и килл мидера на Top Mid
    // считался "минусом на B": перекол на B с пустым мидом вместо захода через мид)
    var ancO = other === "A" ? "anchorA" : "anchorB";
    // (v333, М54, отметка владельца: 2 на 3, опорника B сняли, а носитель ставил на A, где трое) поздний колл — реактивный, по
    // пикам и ротациям (docs/PRO_PLAY.md, [1]): на выходе тоже можно, и вдвоём, если на нашем сайте видно больше CT, чем нас,
    // и носитель успевает дойти до пустого сайта (путь бегом + плант + 10 с запаса). 6 с на решение и порог — проектные числа
    var lateOK = tt.phase === "execute" && aliveT >= 2 && here >= aliveT + 1 && bomb && bomb.state === "carried" && bomb.carrier && bomb.carrier.alive &&
      secLeft > pathLenTo(bomb.carrier, SITES[other].x, SITES[other].y)/SPEED + PLANT_TICKS/TICK_HZ + 10;
    var pickWin = lateOK ? 6 : 3;
    var pickOther = (tt.phase === "setup" || lateOK) && teamIntel.T.sig.some(function(sg){ return sg.type === "kill" && tick - sg.tick < pickWin*TICK_HZ &&
      (sg.role === ancO ? Math.hypot(sg.x-SITES[other].x, sg.y-SITES[other].y) < 600 : Math.hypot(sg.x-SITES[other].x, sg.y-SITES[other].y) < 350); });
    var poSig = pickOther ? teamIntel.T.sig.filter(function(sg){ return sg.type === "kill" && tick - sg.tick < pickWin*TICK_HZ; }).pop() : null;
    // (v440, док владельца 27.10, р10: сняли CT на B — перекол на B, а носитель стоял у A и пошёл на B через мид) и на сетапе — только если
    // носитель успевает дойти до другого сайта по пути и поставить (та же мерка, что у позднего колла) и туда не дальше, чем до своего, на 800
    // (проектное число: другой сайт — через полкарты, пока группа ждёт носителя)
    var carOK = !(bomb && bomb.state === "carried" && bomb.carrier && bomb.carrier.alive) ||
      secLeft > pathLenTo(bomb.carrier, SITES[other].x, SITES[other].y)/SPEED + PLANT_TICKS/TICK_HZ + 10 &&
      pathLenTo(bomb.carrier, SITES[other].x, SITES[other].y) <= pathLenTo(bomb.carrier, SITES[tt.site].x, SITES[tt.site].y) + 800;
    if(pickOther && carOK && aliveT >= (lateOK ? 2 : 3) && beliefCount("T", BZ.siteNear[other]||[]) < 0.9 && there < 1.5 && iglReads(tt, "po") && iglTake(tt, poSig ? poSig.tick : tick)){
      tt.rebound = true;
      voiceLog("T", "reb"+other, "IGL", lateOK ? "ПЕРЕКОЛЛ "+tt.site+" → "+other+": на "+tt.site+" их больше, на "+other+" сняли опорника — бомба на "+other+"!" : "минус на "+other+", там пусто — все на "+other+"!");
      logEvent("IGL: перекол → "+other+" (сняли CT, сайт пустой)");
      tSetSite(tt, other); tt.phase = "setup"; tt.execTick = tick + 3*TICK_HZ;
      return;
    }
    // смерть своего у сайта в сетапе уже повод передумать, если там же видели 2+
    var stackRead = tt.phase === "setup" ? (here - there >= 1.5 && here >= 2.5) || (deathsHere >= 1 && here >= 2 && here > there)
                                         : (here - there >= 2 && (here >= 3.5 || deathsHere >= 2));
    // стак = минимум двое реально замечены/услышаны у сайта сейчас (или минус там)
    if(BAL.recallStrict && stackRead && (freshC[tt.site]||0) < 2 && deathsHere < 1) stackRead = false;
    if(aliveT >= needAlive && stackRead && iglReads(tt, "st") && iglTake(tt, tick)){
      tt.rebound = true;
      logEvent("IGL: на "+tt.site+" стак (~"+Math.round(here)+"), перепривязка → "+other);
      // (v324) перекол говорится в войс — раньше был только в консоли, и в войсе потом звучало «бомба на B», хотя все шли на A
      voiceLog("T", "reb"+other+"st", "IGL", "ПЕРЕКОЛЛ "+tt.site+" → "+other+": на "+tt.site+" стак (~"+Math.round(here)+(deathsHere ? ", минус там" : "")+") — все на "+other+"!");
      // перекол не значит "сразу выход": группа переходит и выходит примерно по
      // исходному таймингу (минимум через 8с, чтобы успеть дойти)
      var exT = tt.execTick; tSetSite(tt, other); tt.phase = "setup"; tt.execTick = Math.max(tick + 8*TICK_HZ, exT - 8*TICK_HZ);
      return; // со следующего тика мозг работает уже по новому сайту
    }
  }
  // (v282, владелец 14.10: матч 1, раунд 1, 3 на 1 — группа с бомбой у пустого A несла её через CT Spawn на B, где сидел
  // последний CT) на выходе с перевесом: до другого сайта носителю ближе и по знанию там пусто — ставим там, где стоим (PRO_PLAY: больше живых — пассивнее, тянуть время). Пороги — те же, что у перекола
  // (враг у сайта < 0,9 по карте, < 1,5 по свежей инфе); раз за раунд
  // (док 6, п.3: р3 3 на 3 — носитель в 213 от B и 1193 от A, по знанию на B 0,01, на A 0,94; правило требовало «нас больше» и не сработало,
  // носитель пошёл через карту на A) на выходе другой сайт берётся по знанию, а не по счёту: носителю туда ближе и врагов там по знанию меньше,
  // чем у нашего сайта; раз за раунд
  if(tt.phase === "execute" && !tt._exReb && bomb.state === "carried" && bomb.carrier && bomb.carrier.alive && !carrierAtSite(tt)){
    var crE = bomb.carrier, dHe = polyLen(pathPts(crE.x, crE.y, SITES[tt.site].x, SITES[tt.site].y)), dOe = polyLen(pathPts(crE.x, crE.y, SITES[other].x, SITES[other].y));
    var eOe = intelEstimate("T", SITES[other].x, SITES[other].y, 400, 6*TICK_HZ), bOe = beliefCount("T", BZ.siteNear[other]||[]), bHe = beliefCount("T", BZ.siteNear[tt.site]||[]);
    if(dOe < dHe && bOe < 0.9 && bOe < bHe && eOe.n < 1.5 && iglTake(tt, tick)){
      tt._exReb = true;
      voiceLog("T", "exreb"+other, "IGL", other+" пустой, бомба рядом — ставим "+other+"!");
      logEvent("IGL: на выходе перекол → "+other+" (носителю ближе, там пусто)");
      tSetSite(tt, other); tt.execStart = tick;
      return;
    }
  }
  // (v355, владелец: «zont1x чекнул Market, Window, Short, B Site, Bench, Car — пусто, но перекола нет», 4 на 1 стояли у A)
  // свои только что прочекали другой сайт — там пусто (2+ зоны у сайта за CLR_REB_SEC с), а по знанию CT там нет, и носитель
  // успевает дойти и поставить: идём туда. Повод — либо CT по знанию у нашего сайта, либо носитель ближе к другому. Раз за раунд
  if(!tt._clrReb && bomb.state === "carried" && bomb.carrier && bomb.carrier.alive && !carrierAtSite(tt) && aliveCount("T") >= 2){
    var So = SITES[other], nClr = 0;
    for(var zc in CLEARZ.T){ var Cz = CLEARZ.T[zc]; if(Cz && tick - Cz.tick < CLR_REB_SEC*TICK_HZ && Math.hypot(Cz.x-So.x, Cz.y-So.y) < 750) nClr++; }
    if(nClr >= 2){
      var crC = bomb.carrier, dHc = polyLen(pathPts(crC.x, crC.y, site.x, site.y)), dOc = polyLen(pathPts(crC.x, crC.y, So.x, So.y));
      var bO = beliefCount("T", BZ.siteNear[other]||[]), bH = beliefCount("T", BZ.siteNear[tt.site]||[]);
      // (v432, М167, м1 Mirage р10: в 1:06 «B прочекали — пусто», хотя T знали — karrigan на B, 6 с назад убил там donk) пусто — по знанию
      // команды (beliefCount: гипотезы врагов с направлением хода, уже со смертью своего), и другой сайт по знанию не полнее нашего: у него
      // меньше ждём врагов, или столько же, а носителю туда ближе. Было: «меньше одного врага» (0,69 < 0,9) и никого не видели и не слышали
      // за 6 с — знание о karrigan (0,69 на B против 0,57 на A) не учитывалось, и перекол уводил всех на сайт, где их ждали больше
      if(bO < 0.9 && (bO < bH || (bO <= bH && dOc < dHc)) && secLeft > dOc/SPEED + PLANT_TICKS/TICK_HZ + 8 && iglTake(tt, tick)){
        tt._clrReb = true; tt.rebound = true;
        voiceLog("T", "clrreb"+other, "IGL", "ПЕРЕКОЛЛ "+tt.site+" → "+other+": "+other+" прочекали — пусто, все на "+other+", ставим там!");
        logEvent("IGL: "+other+" прочекан и пуст — перекол → "+other);
        tSetSite(tt, other); site = SITES[tt.site];
        if(aliveCount("CT") <= 2 || tt.phase === "execute"){ tt.phase = "execute"; tt.execStart = tick; tt.fewGo = true; }
        else { tt.phase = "setup"; tt.execTick = tick + 4*TICK_HZ; }
        return;
      }
    }
  }
  if(BAL.iglReplan && tIglReplan(tt, site, other, secLeft)) return;
  // ---- мид наш: сняли мидера CT → двое идут через мид на сторону CT (набор карты: tactics.plays.midTake;
  // на Ancient — через Red Room) и заходят на наш сайт оттуда, пока остальные — с обычной стороны ----
  var MT = MAP.tactics.plays.midTake;
  if(BAL.midTake && MT && tt.phase === "setup" && !tt.midTaken && aliveCount("T") >= 4 && tick - roundStartTick > 8*TICK_HZ){
    var midKill = teamIntel.T.sig.filter(function(sg){ return sg.type === "kill" && tick - sg.tick < 3*TICK_HZ && sg.role === "mid"; })[0];
    if(midKill){
      tt.midTaken = tick;
      var tsM = bots.filter(function(b){ return b.team === "T" && b.alive && b.tRole !== "lurker" && !(bomb.state === "carried" && bomb.carrier === b); });
      var mp = zonePoint(MT.mid) || GEO.ctMid;
      tsM.sort(function(a, b2){ return Math.hypot(a.x-mp.x, a.y-mp.y) - Math.hypot(b2.x-mp.x, b2.y-mp.y); });
      var fl2 = tsM.slice(0, 2);
      fl2.forEach(function(b){ b._midFlank = {round:roundNum, site:tt.site}; b._route = null; b._routeDone = null;
        startRoute(b, MT.route, "midct"+roundNum); });
      tt.execTick = BAL.proTempo ? Math.max(tick + 18*TICK_HZ, Math.min(tt.execTick, tick + 30*TICK_HZ)) : Math.max(tick + 10*TICK_HZ, Math.min(tt.execTick, tick + 15*TICK_HZ));
      voiceLog("T", "midtake", midKill.by, "мид наш! "+fl2.map(function(b){ return b.id; }).join(" и ")+" — через "+MT.via+", "+tt.site+" с двух сторон");
      logEvent("IGL: мид взят — заход на "+tt.site+" с двух сторон (через "+MT.via+")");
    }
  }
  // (v321, М11, отметка владельца) CT осталось мало (по киллфиду знают все) и нас больше — не ждём тайминга сбора:
  // заходим сразу, на тот сайт, где по нашей инфе CT нет (было: бомба ждала сбора 2 против 1 на 67-й с)
  // (v356, владелец: «4 на 1, бомба в толпе на T Ramp, не выходят на A, чего-то ждут») раньше — раз за раунд: после перекола
  // (снова сетап) правило уже не срабатывало. Теперь и повторно, если сетап затянулся за назначенное время выхода
  if(tt.phase === "setup" && (!tt.fewGo || tick > (tt.execTick||0))){
    var aCT = aliveCount("CT"), aT = aliveCount("T");
    if(aCT <= 2 && aT > aCT){
      var seenHere = intelEstimate("T", site.x, site.y, 600, 8*TICK_HZ).seen, seenOther = intelEstimate("T", SITES[other].x, SITES[other].y, 600, 8*TICK_HZ).seen;
      var was = tt.site;
      if(seenHere > 0 && seenOther === 0){ tSetSite(tt, other); site = SITES[tt.site]; g = GEO[tt.site]; other = tt.site === "A" ? "B" : "A"; }
      tt.fewGo = true; tt.phase = "execute"; tt.execStart = tick; siteHeatPending[tt.site] = 1;
      voiceLog("T", "few"+roundNum, "IGL", was !== tt.site ? "ПЕРЕКОЛЛ "+was+" → "+tt.site+": их осталось "+aCT+", на "+was+" видели — заходим сейчас!"
                                                           : "их осталось "+aCT+" — заходим сейчас, бомба на "+tt.site+"!");
      logEvent("T: выход на "+tt.site+"! (CT осталось "+aCT+")");
    }
  }
  // (v381, М132) читаем расстановку CT по увиденному: новая картина — в войс (кто увидел — тот и говорит, команда понимает остальное)
  if(tt.phase === "setup" && tick % 16 === 0){ var SRd = knowSetupRead("T");
    if(SRd && SRd.n > (tt.setupRead ? tt.setupRead.n : 0)){ tt.setupRead = SRd;
      var sk = ["A","mid","B"].filter(function(r){ return SRd.seen[r]; }).map(function(r){ return (r === "mid" ? "на миду " : "на " + r + " ") + SRd.seen[r]; }).join(", ");
      voiceLog("T", "setup" + roundNum + "_" + SRd.n, "IGL", sk + " — у них " + SRd.top.join(" или ") + ": на A ~" + SRd.E.A.toFixed(1) + ", на B ~" + SRd.E.B.toFixed(1)); } }
  // раздел 12: проба увидела на нашем сайте ровно одного, и по карте там больше
  // никого — "там соло, заходим" (не ждём тайминга)
  if(tt.phase === "setup" && tick - roundStartTick > (BAL.proTempo ? 28 : 12)*TICK_HZ && !tt.soloGo && !(BAL.proTempo && hashRand(roundNum*577 + matchNum*41 + 3) < 0.5)){
    var eS = intelEstimate("T", site.x, site.y, 420, 5*TICK_HZ);
    var aliveT2 = aliveCount("T");
    // (v381, М132) или по расстановке: на нашем сайте видели одного, и по увиденному в других районах там больше одного не ждут
    var srS = tt.setupRead && tick - roundStartTick <= 40*TICK_HZ ? tt.setupRead.E[tt.site] : null;
    if(eS.seen === 1 && (beliefCount("T", BZ.siteNear[tt.site]||[]) < 1.4 || srS != null && srS <= 1.2) && aliveT2 >= 4 && iglReads(tt, "so")){
      tt.soloGo = true; tt.phase = "execute"; tt.execStart = tick; siteHeatPending[tt.site] = 1;
      voiceLog("T", "solo"+tt.site, "IGL", "на "+tt.site+" один — заходим сейчас!");
      logEvent("T: выход на "+tt.site+"! (по инфе там соло)");
    }
  }
  var ts = bots.filter(function(b){ return b.team==="T" && b.alive; });
  // пост "плант" у того, кто уже не носитель (поставил, отдал бомбу) — снять,
  // иначе стоял на точке планта (игроки из захода с другой стороны не получают
  // пост-плант позицию и оставались на ней до конца раунда)
  ts.forEach(function(b){ if(b.post && b.post.tag === "plantspot" && !b.planting && !(bomb.state === "carried" && bomb.carrier === b)) clearPost(b); });
  // ---- сейв T: раунд безнадёжен — сохранить оружие на следующий ----
  // Раньше последний T всегда шёл ставить, даже 1 против 4 за 15с до конца.
  // Про в такой ситуации прячется: винтовка на следующий раунд дороже
  // почти невозможного раунда. Не сейвят, если носитель уже на сайте (успеет
  // поставить) или сохранять нечего (пистолеты).
  if(BAL.tSave && bomb.state !== "planted" && !tt.saving && ts.length){
    var aC = aliveCount("CT"), aT = ts.length;
    if(tSaveWant(ts, aT, aC, secLeft, site)){
      tt.saving = tick; tt.saveSit = aT+"v"+aC; saveCancelTrades("T");
      logEvent("T: сейв — "+aT+"v"+aC+", "+Math.round(secLeft)+"с — сохраняем оружие");
      voiceLog("T", "tsave", ts[0].id, aT === 1 ? "я один против "+aC+" — сейвлю" : "двое на "+aC+", мало времени — сейв");
    }
  }
  // (35) T: двое против 4+, мало времени — снайпер сохраняет AWP, второй пробует
  if(BAL.awpSave && !tt.saving && bomb.state !== "planted" && ts.length === 2 && aliveCount("CT") >= 4 && secLeft < 45 && saveWorth("T")){   // (v434) есть что сохранять
    var awT = ts.filter(function(b){ return b.primary === "AWP" && !(bomb.state === "carried" && bomb.carrier === b); })[0];
    if(awT){ if(!awT._saveSpot){ awT._saveSpot = pickSaveSpotT(awT); voiceLog("T", "awpsaveT", awT.id, "сейвлю AWP"); }
      setPost(awT, awT._saveSpot, null, true, "save"); ts = ts.filter(function(b){ return b !== awT; }); }
  }
  // (v434, PRINCIPLES М158, владелец 25.10: «сейв должен пересматриваться по ходу раунда»; м1 Mirage р11: сейв с 2 на 4, sh1ro убил двоих —
  // 2 на 2, а сейв продолжался) расклад живых сменился — то же решение заново (tSaveWant): у про при новом раскладе не сейвят — сейв снят
  if(tt.saving && bomb.state !== "planted"){
    var tsS = bots.filter(function(b){ return b.team === "T" && b.alive; }), sitS = tsS.length+"v"+aliveCount("CT");
    if(sitS === tt.saveSit || tSaveWant(tsS, tsS.length, aliveCount("CT"), secLeft, site)){ tt.saveSit = sitS; tSaveHold(); return; }
    tt.saving = 0; tt.saveSit = null;
    tsS.forEach(function(b){ b._saveSpot = null; if(b.post && b.post.tag === "save") clearPost(b); });
    logEvent("T: сейв снят — теперь "+sitS+", играем раунд");
    if(tsS[0]) voiceLog("T", "tunsave"+sitS, tsS[0].id, "теперь "+sitS.replace("v", " на ")+" — играем, не сейвим");
  }
  // бомба на земле — ближайший (не лёркер) идёт за ней
  var fetcher = null;
  // бомбу уже подобрали — старый пост "за бомбой" снять (иначе носитель
  // стоял на месте, где она лежала, до конца раунда)
  if(bomb.state !== "dropped"){ tt.fetchId = null; tt.fetchCover = null; ts.forEach(function(b){ if(b.post && (b.post.tag === "fetch" || b.post.tag === "fetchCover")) clearPost(b); }); }
  // (док 6, п.18: р12 donk в 0:10,8 пошёл за бомбой — до неё 12,2 с, потом до A ещё 1597 ед.: поставить было невозможно) за бомбой идут, только
  // если успеть: дойти до бомбы, донести до ближнего сайта и поставить до конца раунда (бег — SPEED). Не успеть — бомбу не поднимают
  var fetchOk = function(b){ var Bk = bomb._toSite || (bomb._toSite = {});
    var key = Math.round(bomb.x)+","+Math.round(bomb.y); if(Bk.k !== key){ Bk.k = key; Bk.d = Math.min(polyLen(pathPts(bomb.x, bomb.y, SITES.A.x, SITES.A.y)), polyLen(pathPts(bomb.x, bomb.y, SITES.B.x, SITES.B.y))); }
    return (pathLenTo(b, bomb.x, bomb.y) + Bk.d)/SPEED + PLANT_TICKS/TICK_HZ <= secLeft; };
  if(bomb.state === "dropped" && !ts.some(fetchOk)){ if(tt.fetchId){ tt.fetchId = null; tt.fetchCover = null; ts.forEach(function(b){ if(b.post && (b.post.tag === "fetch" || b.post.tag === "fetchCover")) clearPost(b); }); } }
  else if(bomb.state === "dropped"){
    var bd = Infinity;
    // кто пошёл за бомбой — тот и идёт, пока жив (раньше каждый тик выбирался
    // ближайший, и двое попеременно получали то "за бомбой", то свою точку)
    var prevF = tt.fetchId && ts.filter(function(b){ return b.id === tt.fetchId; })[0];
    if(prevF){ bd = -1; fetcher = prevF;
      // (v286, И26) прикрывающий уже стоит у бомбы, а сборщик ещё далеко (> 350 px — «рядом свой») — меняются: поднимает тот,
      // кто рядом (раньше прикрывающий стоял в 120 px от бомбы десятки секунд и ждал сборщика)
      var FC0 = tt.fetchCover, cv0 = FC0 && FC0.id && FC0.round === roundNum ? ts.filter(function(o){ return o.id === FC0.id; })[0] : null;
      if(cv0 && cv0.tRole !== "lurker" && Math.hypot(cv0.x-FC0.pt.x, cv0.y-FC0.pt.y) < 60 && Math.hypot(prevF.x-bomb.x, prevF.y-bomb.y) > 350 &&
         Math.hypot(cv0.x-bomb.x, cv0.y-bomb.y) < Math.hypot(prevF.x-bomb.x, prevF.y-bomb.y)){
        fetcher = cv0; if(prevF.post && prevF.post.tag === "fetch") clearPost(prevF); }
    }
    ts.forEach(function(b){
      if(bd < 0 || !fetchOk(b)) return;
      if(b.tRole==="lurker" && ts.length > 2) return; // лёркер за бомбой — только когда нас мало
      // тот же приоритет по ролям: энтри и AWP за бомбой идут, только если сильно ближе
      var d = Math.hypot(b.baseX-bomb.x, b.baseY-bomb.y) + ((b.tRole==="entry"||b.tRole==="awp") ? 250 : 0);
      if(d < bd){ bd = d; fetcher = b; }
    });
    if(fetcher){ tt.fetchId = fetcher.id;
      // (v286, И26) сборщик бомбы — не проба: старая проба снимается (раньше проба на B каждые 6–9 с выдёргивала его от бомбы)
      if(fetcher._probe && fetcher._probe.round === roundNum){ fetcher._probe = null; fetcher._probeLock = 0; }
      // (v269, пункт 2) за бомбой — не в одиночку: бомба лежит там, где убили носителя, — под тем же стрелком. У ботов 27 из
      // 159 смертей T «один» (нет своего в 350 px) были по дороге за бомбой; у про в одиночку гибнут 20 % T (у ботов 49 %),
      // а смерть рядом со своим разменивают в 27 % (у ботов 33 %). Ближайший к сборщику T (не лёркер, ≤ 500 px — как напарник
      // пробы) прикрывает: встаёт на линии сборщик→бомба в 150 px от бомбы (как напарник пробы) и смотрит туда же
      var FC = tt.fetchCover;
      if(!FC || FC.round !== roundNum || FC.fid !== fetcher.id || FC.bx !== bomb.x || FC.by !== bomb.y){
        var cands = ts.filter(function(o){ return o !== fetcher && o.alive && o.tRole !== "lurker" && !o.planting && Math.hypot(o.x-fetcher.x, o.y-fetcher.y) < 500; })
          .sort(function(a, c){ return Math.hypot(a.x-fetcher.x, a.y-fetcher.y) - Math.hypot(c.x-fetcher.x, c.y-fetcher.y); });
        var lnF = Math.hypot(fetcher.x-bomb.x, fetcher.y-bomb.y) || 1, backF = Math.min(150, lnF*0.6);
        FC = tt.fetchCover = {round: roundNum, fid: fetcher.id, bx: bomb.x, by: bomb.y, id: cands[0] ? cands[0].id : null,
          pt: walk({x: bomb.x + (fetcher.x-bomb.x)/lnF*backF, y: bomb.y + (fetcher.y-bomb.y)/lnF*backF})};
      }
      var cov = FC.id ? ts.filter(function(o){ return o.id === FC.id && o.alive; })[0] : null;
      if(cov && cov._probe && cov._probe.round === roundNum){ cov._probe = null; cov._probeLock = 0; } // прикрывающий — тоже не проба
      if(cov && !cov._sawEnemy && !(cov._tradeLock && cov._tradeLock.until > tick)){ setPost(cov, FC.pt, {x:bomb.x, y:bomb.y}, true, "fetchCover"); cov._probeLock = tick; }
      // к бомбе — когда прикрывающий рядом (350 px — «рядом свой» в замерах); до того сборщик идёт к точке прикрытия.
      // Нет прикрывающего (рядом никого) — идёт один, как раньше
      var withCov = !cov || Math.hypot(cov.x-fetcher.x, cov.y-fetcher.y) <= 350;
      setPost(fetcher, withCov ? {x:bomb.x, y:bomb.y} : FC.pt, withCov ? null : {x:bomb.x, y:bomb.y}, false, "fetch");
    }
  }
  var isMF = function(b){ return (b._midFlank && b._midFlank.round === roundNum) || (tt.phase === "setup" && b._shift && b._shift.round === roundNum); };
  if(tt.phase === "setup") ts.forEach(function(b){ if(b._shift && b._shift.round === roundNum && !b.planting && !(tt.fetchId === b.id)) setPost(b, b._shift.pt, b._shift.look, true, "shift"); });
  // перегруппировка IGL: лёркер больше не лёркер — идёт с основной группой как поддержка
  var roleT = function(b){ return (tt.regroup && b.tRole === "lurker") ? "support" : b.tRole; };
  function pick(roles){ return ts.filter(function(b){ return roles.indexOf(roleT(b)) >= 0 && b !== fetcher && !b.planting && !isMF(b); }); }
  var lurker = pick(["lurker"])[0];
  // лёркер с бомбой или последний живой — уже не лёркер, а тот, кто ставит
  if(lurker && ((bomb.state === "carried" && bomb.carrier === lurker) || ts.length === 1)) lurker = null;
  // ---- клатч T (один живой, бомба не стоит): играть на плант, а не на фраги ----
  // (док 6, п.18) «иду ставить» — только если успеть: бомба у него — дойти до ближнего сайта и поставить; лежит — как за бомбой (fetchOk)
  var soloCan = function(b){ if(bomb.state === "dropped") return fetchOk(b);
    if(bomb.state === "carried" && bomb.carrier === b) return Math.min(pathLenTo(b, SITES.A.x, SITES.A.y), pathLenTo(b, SITES.B.x, SITES.B.y))/SPEED + PLANT_TICKS/TICK_HZ <= secLeft;
    return false; };
  if(ts.length === 1 && bomb.state !== "planted" && tt.phase !== "postplant" && (tt.soloPlan || soloCan(ts[0]))){
    var solo = ts[0];
    if(!tt.soloPlan){
      // сайт, где по инфе меньше CT (и ближе); сразу выход — ждать некого
      var sc = function(k){ return beliefCount("T", BZ.siteNear[k]||[]) * 400 + Math.hypot(solo.x-SITES[k].x, solo.y-SITES[k].y); };
      var ks2 = sc("A") <= sc("B") ? "A" : "B";
      tt.soloPlan = ks2;
      if(ks2 !== tt.site){ var exS = tt.execStart; tSetSite(tt, ks2); tt.execStart = exS; site = SITES[ks2]; g = GEO[ks2]; other = ks2 === "A" ? "B" : "A"; plantPt = site.plant || site; }
      if(tt.phase === "setup"){ tt.phase = "execute"; tt.execStart = tick; }
      tt.wave2 = tt.wave2 || tick;
      voiceLog("T", "solo", solo.id, "я один — иду ставить на "+ks2+", в дуэли не лезу");
    }
  }
  var stageOpt = function(k){ return {rMax:200, minGap:50, hideFrom:[SITES[k], GEO[k].anchor], see:[GEO[k].tEntry], avoidNades: BAL.tAdapt ? tDeathSpots() : []}; };
  var midOpt = {rMax:160, minGap:50, see:[GEO.tMidLook]};
  if(BAL.namedPos && !tt.tMidPick){
    var tm = POS.M.tHold, tmi = weightedPick(tm.length, roundNum*389 + matchNum*7);
    tt.tMidPick = tm[tmi] === "TMID" ? null : tm[tmi];
    tt.tMidPt = tt.tMidPick ? zonePoint(tt.tMidPick, GEO.tMid) : null;
    if(!tt.tMidPt) tt.tMidPick = "-";
  }

  if(tt.phase === "setup"){
    if(lurker) lurkerBrain(lurker, tt, other);
    // (v440, док владельца 27.10: «дефолт сравнить с про»; «энтри свою роль не играл») фаза дефолта — у всех тактик с долгим сетапом, и у
    // тактик-«дефолтов» тоже: раньше их группы с первой секунды шли к точке выхода (Connector, Apps) — на 25–50-й с у ботов 0,86 игрока на
    // A Site / Cross / Connector против 0,06 у про (демки Mirage, раунды с поздним плантом). Энтри — у своей цели (у про в дефолте перед A —
    // T Ramp 0,63 игрока), а не у другого сайта: раньше энтри стоял на B в выходе на A и шёл через карту / за лайнапом
    var inDef = BAL.proTempo && tt.defUntil && tick < tt.defUntil && tick < tt.execTick - tt.needT*TICK_HZ;
    if(inDef){
      // дефолт: лёркер — у другого сайта (lurkerBrain), остальные — по местам про (ниже)
      if(!tt._defLog){ tt._defLog = true; logEvent("T: сначала дефолт, "+tac.name+" — позже"); }
      // (снайпер — с группой у цели, мид держит поддержка: AWP на миде в дефолте
      // у ботов был первой жертвой в 19% раундов, у про — 4%)
      // (v443, док владельца 27.10 «дефолт сравнить с про») места — из демок (MAP.defaultpos, tools/defpos_bake.py): сколько T в среднем
      // в каждой зоне на 20–50-й с раундов с выходом на этот сайт. Раньше трое шли к точке подготовки цели: на Mirage B — 2,1 игрока
      // в T Apps / Stove / B Apartments против 1,1 у про, на миде 1,0 против 1,9. Зоны — жребий раз на раунд по этим долям (без
      // повтора); ближняя к цели — энтри, дальше IGL, AWP, поддержка; взгляд — на ближайший к зоне вход (A, B или мид)
      var DPS = ((MAP.defaultpos || {}).sites || {})[tt.site], dm = pick(["entry","igl","awp","support"]);
      if(DPS && DPS.length){
        // (v450, док владельца 28.10 №5: «выход через Палас — в Палас никто не пошёл», «Рамп + Палас, а заходят через Рампу и Коннектор»,
        // «тактика одна, а игроки делают другое») места дефолта — по долям про, но в районе своей группы тактики: зона про, ближняя
        // (≤ DEF_GROUP_R) к пути или точке подготовки группы (G.via, G.stage; мид — TMID). У группы нет таких зон — встаёт на точку подготовки
        // группы. Раньше зоны выпадали жребием по всей карте — группа Паласа стояла на миде, и потом шла в Палас через карту и врагов
        var gOf = function(b){ var r = null; (tac.groups || []).forEach(function(G){ if(!r && G.roles.indexOf(b.tRole) >= 0) r = G; }); return r; };
        var gPts = function(G){ var P = [];
          if(!G) return P;
          if(G.stage === "TMID"){ var tm = tt.tMidPt || GEO.tMid; if(tm) P.push(tm); return P; }
          (G.via || []).concat(G.stage ? [G.stage] : []).forEach(function(n){ var q = zonePoint(n, SITES[tt.site]); if(q) P.push(q); });
          return P; };
        var defPick = function(b, used, seed){ var P = gPts(gOf(b));
          var pool = DPS.filter(function(z){ var q = zonePoint(z[0]); return q && !used[z[0]] && (!P.length || P.some(function(p){ return Math.hypot(p.x-q.x, p.y-q.y) <= DEF_GROUP_R; })); });
          if(!pool.length) return null;
          var wt = pool.reduce(function(a, z){ return a + z[1]; }, 0), u = hashRand(seed)*wt, di = 0;
          while(di < pool.length - 1 && u > pool[di][1]){ u -= pool[di][1]; di++; }
          return pool[di][0]; };
        if(!tt._defZ || tt._defZ.n !== dm.length){
          var used = {}, ch = {};
          dm.forEach(function(b, dk){ ch[b.id] = defPick(b, used, roundNum*733 + matchNum*91 + dk*17 + 5); if(ch[b.id]) used[ch[b.id]] = 1; });
          tt._defZ = {n: dm.length, z: ch};
        }
        // (док 6, п.8, владелец 28.10: «он не должен там стоять, он должен двигаться — странность, что очень долго стоит и ничего не делает»)
        // у про T с 5-й по 60-ю с стоит на одном месте обычно до 4 с, 90 % — не дольше DEF_STAND (13 с; демки Mirage, tools/measure/pro_checks.py);
        // donk р5 стоял на месте дефолта ~60 с. Простоял на месте дефолта DEF_STAND — берёт другое место своей группы (те же доли про), не занятое своими
        dm.forEach(function(b, dk){ var z0 = tt._defZ.z[b.id];
          if(!z0 || !b.atPost || !b.post || b.post.tag !== "default:"+z0){ b._defArr = null; return; }
          if(!b._defArr || b._defArr.z !== z0) b._defArr = {z: z0, t: tick};
          if(tick - b._defArr.t < DEF_STAND*TICK_HZ) return;
          var used2 = {}; used2[z0] = 1; dm.forEach(function(o){ if(o !== b && tt._defZ.z[o.id]) used2[tt._defZ.z[o.id]] = 1; });
          var nz = defPick(b, used2, roundNum*733 + matchNum*91 + dk*17 + tick); if(nz){ tt._defZ.z[b.id] = nz; b._defArr = null; } });
        dm.forEach(function(b){
          var zn0 = tt._defZ.z[b.id], P = gPts(gOf(b)), tgt = SITES[tt.site];
          var Zp = zn0 ? zonePoint(zn0, P[P.length-1] || tgt) : (P[P.length-1] || null), tag = zn0 ? "default:"+zn0 : "default:group";
          if(!Zp) return;
          var lk = [GEO.A.tEntry, GEO.B.tEntry, GEO.tMidLook].filter(Boolean).sort(function(a, c){ return Math.hypot(a.x-Zp.x, a.y-Zp.y) - Math.hypot(c.x-Zp.x, c.y-Zp.y); })[0];
          groupPost([b], Zp, lk, tag, {rMax:160, minGap:50, see:[lk]});
        });
      } else {
        groupPost(pick(["support"]), tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", midOpt);
        stagePost(pick(["entry","igl","awp"]), tt.site);
      }
    } else if(tac.groups && tac.style !== "fake" && tt.site !== tac.site){   // (v365) фейк — своя ветка ниже
      // (этап 2, P1-1) сайт плана сменили: точки подготовки и маршруты групп тактики — под старый сайт (Donut, A Hall…).
      // Раньше группа ставилась на них и с новым сайтом (тег stageB:Donut у A): ждала на старой точке. Теперь — стандартная
      // подготовка нового сайта; мид (TMID) — как был
      var memAll = [];
      tac.groups.forEach(function(G){ var mem = pick(G.roles); if(!mem.length) return;
        if(G.stage === "TMID"){ mem.forEach(function(b){ b._stageInfo = null; }); groupPost(mem, tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", midOpt); return; }
        mem.forEach(function(b){ if(memAll.indexOf(b) < 0) memAll.push(b); }); });
      stagePost(memAll, tt.site);
    } else if(tac.groups && tac.style !== "fake"){
      tac.groups.forEach(function(G, gi){
        var mem = pick(G.roles);
        if(!mem.length) return;
        // после дефолта маршрут "от спавна" уже не нужен — идут к своей точке кратчайшим путём
        if(!tt.defUntil) mem.forEach(function(b){ startRoute(b, G.via, tac.id+":"+gi); });
        if(G.stage === "TMID"){ mem.forEach(function(b){ b._stageInfo = null; }); groupPost(mem, tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", midOpt); return; }
        var sp = G.stage ? (zonePoint(G.stage, g.tStage) || g.tStage) : g.tStage;
        var lk = G.look ? (zonePoint(G.look, sp) || g.tEntry) : g.tEntry;
        var tag = "stage"+tt.site+(G.stage ? ":"+G.stage : "");
        mem.forEach(function(b){ b._stageInfo = {from:sp, to:lk, look: G.look ? SITES[tt.site] : g.anchor, round:roundNum}; });
        groupPost(mem, sp, lk, tag, {rMax:200, minGap:50, hideFrom:[SITES[tt.site], lk], see:[lk]});
      });
    } else if(tac.style === "exec"){
      stagePost(pick(["entry","awp","igl"]), tt.site);
      groupPost(pick(["support"]), tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", midOpt);            // контроль мида
    } else if(tac.style === "default"){
      // дефолт: растягиваем CT — двое у другого сайта, AWP на миде, носитель у цели
      stagePost(pick(["entry","support"]), other);
      groupPost(pick(["awp"]), tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", midOpt);
      stagePost(pick(["igl"]), tt.site);
    } else if(tac.style === "split"){
      stagePost(pick(["entry","igl"]), tt.site);
      groupPost(pick(["awp","support"]), tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", midOpt);
    } else if(tac.style === "fake"){
      // раздел 12: фейк-выход. Основная группа тихо ждёт у настоящего сайта;
      // поддержка за ~14с до выхода громко "заходит" на другой сайт — бежит к
      // его входу, показывается, кидает смок/флешку (лёркер и так там же) —
      // чтобы CT перетянули туда ротацию. Потом настоящий выход, а фейкеры
      // догоняют второй волной.
      var fk = tac.fake, gf = GEO[fk];
      stagePost(pick(["entry","awp","igl"]), tt.site);
      var fakers = pick(["support"]);
      // копим факт "видели опорника у фейкового сайта" пока не поздно — читать
      // фейк можно только если реально знаем, что там кто-то БЫЛ
      if(BAL.fakeRead && !tt._fakeCtSeen && intelEstimate("T", gf.anchor.x, gf.anchor.y, 550, 4*TICK_HZ).n > 0) tt._fakeCtSeen = tick;
      if(tick < tt.execTick - 14*TICK_HZ){
        stagePost(fakers, fk);
      } else {
        if(!tt.fakeOn){ tt.fakeOn = tick;
          logEvent("T: фейк на "+fk+" — шумим и кидаем гранаты, выход на "+tt.site);
          if(fakers[0]) voiceLog("T", "fake"+fk, fakers[0].id, "делаю фейк на "+fk+", вы ждите на "+tt.site); }
        var fakeDied = teamIntel.T.sig.some(function(sg){ return sg.type === "died" && tick - sg.tick < 10*TICK_HZ && Math.hypot(sg.x-gf.tEntry.x, sg.y-gf.tEntry.y) < 450; });
        if(fakeDied){ stagePost(fakers, fk); if(!tt._fakeHoldLog){ tt._fakeHoldLog = true; logEvent("T: на фейке сняли своего — второй не лезет туда же, держит"); } }
        else groupPost(fakers, gf.tEntry, gf.anchor, "fake"+fk, {rMax:120, minGap:40, see:[gf.anchor]});
        // раздел 13: "купились ли CT на фейк" — IGL примерно оценивает это по
        // своей же инфе (не телепатия): опорник фейкового сайта, которого
        // фейкеры видели вначале, пропал из поля зрения/по последней инфе
        // (beliefLast+CLEARZ) — похоже, ушёл ротой на настоящий сайт. Читается один
        // раз за фейк, не каждый тик, и не идеально (IGL может ошибиться).
        if(BAL.fakeRead && !tt._fakeRead && tick - tt.fakeOn > 5*TICK_HZ && tick - tt.fakeOn < 16*TICK_HZ){
          var fkZ = zoneIdAt(gf.anchor.x, gf.anchor.y);
          var sawCtAtFakeEarly = !!tt._fakeCtSeen;
          var clearedNow = fkZ && CLEARZ.T[fkZ] && CLEARZ.T[fkZ].tick > tt.fakeOn;
          var stillThere = intelEstimate("T", gf.anchor.x, gf.anchor.y, 450, 5*TICK_HZ).n > 0;
          // "не видно" ≠ "ушёл" — читаем "пусто" только если кто-то из фейкеров
          // реально смотрит туда прямо сейчас (иначе просто не в курсе, а не
          // "точно знаем, что там пусто")
          var watchingNow = ts.some(function(o){ return o.alive && (Math.hypot(o.x-gf.anchor.x, o.y-gf.anchor.y) < 380 || (Math.hypot(o.x-gf.anchor.x, o.y-gf.anchor.y) < 600 && hasVision(o.x, o.y, gf.anchor.x, gf.anchor.y))); });
          if(sawCtAtFakeEarly && watchingNow && (clearedNow || !stillThere)){
            tt._fakeRead = tick;
            var save = Math.min(8*TICK_HZ, Math.max(0, tt.execTick - tick - 4*TICK_HZ));
            if(save > 0){
              tt.execTick -= save;
              logEvent("IGL: фейк на "+fk+" сработал — опорник ушёл, ускоряем выход на "+tt.site);
              voiceLog("T", "fakeworked", "IGL", "они купились, идём на "+tt.site+" раньше");
            }
          } else if(sawCtAtFakeEarly && stillThere && tick - tt.fakeOn > 10*TICK_HZ){
            tt._fakeRead = tick;
            logEvent("IGL: на "+fk+" не купились — держит место, играем по плану");
          }
        }
      }
    }
    tProbes(tt, ts);
    ts.forEach(function(b){
      var MF = b._midFlank; if(!MF || MF.round !== roundNum || b === fetcher) return; // за бомбой — не на фланг (посты перебивали друг друга каждый тик)
      var CS = MAP.tactics.plays.midTake.ctSide[tt.site === "A" ? "A" : "B"];   // куда выходят на стороне CT и куда смотрят
      var st = zonePoint(CS.stage, SITES[tt.site]);
      var lk = zonePoint(CS.look, st) || SITES[tt.site];
      if(st) setPost(b, pickSpots("midflank"+tt.site, st, 2, {rMax:150, minGap:40, see:[lk], hideFrom:[SITES[tt.site]]})[fl2idx(b)], lk, true, "stage"+tt.site+":CTside");
    });
  } else if(tt.phase === "execute"){
    if(lurker) lurkerBrain(lurker, tt, other);
    var since = tick - (tt.execStart != null ? tt.execStart : tick);   // (v380) выход с тика 0 (раш в 1-м раунде матча): 0 — тоже время, не «нет»
    var DELAY = {entry:0, awp:40, support:20, igl:90};
    // раздел 12: две волны. Первая — энтри (+поддержка сразу за ним на трейд,
    // AWP на линии) берёт первый контакт; вторая — IGL и носитель бомбы —
    // заходит на уже зачищенное: через ~0.75с после первого контакта/размена
    // первой волны или через 4.5с, если контакта так и не было. Раш — все сразу.
    var rush = tac.style === "rush";
    if(rush && tac.rushVia && tick - roundStartTick < 4*TICK_HZ) ts.forEach(function(b){ if(b.tRole !== "lurker") startRoute(b, tac.rushVia, tac.id); });
    if(!rush && !tt.wave2){
      var w1 = ts.filter(function(b){ return b.tRole === "entry" || b.tRole === "support" || b.tRole === "awp"; });
      var contact = w1.some(function(b){ return b._sawEnemy; }) ||
        teamIntel.T.sig.some(function(sg){ return (sg.type === "kill" || sg.type === "died") && sg.tick >= (tt.execStart != null ? tt.execStart : 0); });
      if(contact && !tt.w1Contact) tt.w1Contact = tick;
      if((tt.w1Contact && tick - tt.w1Contact > 48) || since > 4.5*TICK_HZ || ts.length <= 2){
        tt.wave2 = tick; logEvent("T: вторая волна заходит на "+tt.site+(tt.w1Contact ? " (после первого контакта)" : ""));
      }
    }
    var carrier = bomb.state === "carried" ? bomb.carrier : null;
    // (v346, отметка владельца: «выходят до взрыва флешек и гранат») боец у сайта (≤ 700 ед.) не заходит, пока гранаты своих на этот
    // сайт в воздухе; хлопнула / встала — заходит. Ждёт не дольше UTIL_WAIT с (раш — UTIL_WAIT_RUSH) с момента, как начал ждать:
    // числа проектные — по демкам «ждать после последней флешки» разное (0 / 4 / 8 с по вариантам), не правило
    // (v378) за раунд ждёт один раз (v353): ожидание кончилось по любой причине — второй раз в этом раунде не начинается (раньше
    // условие пропадало и появлялось, носитель переключался «ждать гранаты ↔ ставить» каждые ~0,7 с, таймер начинался заново)
    var utilWait = function(b){ var had = !!(b._utilW && b._utilW.round === roundNum), w = utilWait0(b); if(!w && had) b._utilWDone = roundNum;
      if(!w && b.post && b.post.tag === "utilWait"){ b._utilW = null; clearPost(b); } return w; };   // (v349) ждать нечего — пост ожидания снять
    var utilWait0 = function(b){
      // (v350, владелец: «теперь они все останавливаются далеко, а не только пикающий») ждёт только энтри — первый на угол; кто сам
      // несёт гранату — не ждёт
      // (v352, владелец: «донк стоит далеко от будущего контакта») ждёт у самого выхода на сайт — ближе UTIL_AT_ENTRY ед. к входу T
      // (GEO.tEntry + pos.entries), а не в 700 ед. от центра сайта (там он вставал на T Ramp, и остальные уходили вперёд)
      var S0 = SITES[tt.site], gE = GEO[tt.site], ents = gE ? [gE.tEntry].concat(entryPts(tt.site) || []).filter(Boolean) : [];
      var atExit = ents.some(function(q){ return Math.hypot(b.x-q.x, b.y-q.y) <= UTIL_AT_ENTRY; });
      // (v363, владелец: «до гранат на сайт не выходили, а то в чём смысл гранат») гранаты ждёт каждый, кто стоит у выхода на сайт
      // (не только энтри): у про 75 % смоков выхода встают до того, как первый T зашёл на сайт (демки Mirage, 774 раунда с
      // плантом; флешки — 52 %: их кидают под заход, их не ждут). Размен вдвоём — по-прежнему только энтри
      var secW = ROUND_TIME_SEC - (simTime - roundStartTime);
      if(!S0 || !atExit || b.nadeTask || b._utilWDone === roundNum || secW < UTIL_MIN_LEFT){ b._utilW = null; return false; }   // (v353) за раунд ждёт один раз
      var inAir = nadesInAir.some(function(n){ return n.team === "T" && n.type !== "flash" && Math.hypot((n.tx != null ? n.tx : n.x)-S0.x, (n.ty != null ? n.ty : n.y)-S0.y) < 900; });
      // (v349, отметка владельца: «всё равно выходят до взрыва») и пока свой несёт гранату выхода на этот сайт (лайнап «(выход, A)»)
      var reExec = new RegExp("выход, " + tt.site);
      var waitT = function(t){ return t && t.type !== "flash" && reExec.test(t.why || ""); };   // флешки выхода — под заход, их не ждут
      var pending = ts.some(function(o){ return o !== b && o.alive && (o.nadeTask && o.nadeTask.lineup && waitT(o.nadeTask) || (o.nadeQueue || []).some(waitT)); });
      // (v351, владелец: «зачем они выходят по одному») и пока рядом нет своего на размен (≤ TRADE_R) — выход вдвоём
      var mate = b.tRole !== "entry" || ts.some(function(o){ return o !== b && o.alive && o.tRole !== "lurker" && Math.hypot(o.x-b.x, o.y-b.y) <= TRADE_R; });
      if(!inAir && !pending && mate){ b._utilW = null; return false; }
      if(!mate && !inAir && !pending && !(b._utilW && b._utilW.round === roundNum)) voiceLog("T", "tradewait"+b.id+roundNum, b.id, "жду размен — выходим вдвоём");
      // (v349, отметка владельца: donk ждал на выходе с T Ramp на виду у NiKo — бой начинался раньше гранат) ждёт в ближайшем
      // укрытии (≤ 150 ед.: не видно с сайта, опорника и входа CT), а не там, где застала проверка
      if(!b._utilW || b._utilW.round !== roundNum){ var g0 = GEO[tt.site], hf = [S0, g0 && g0.anchor, g0 && g0.ctEntry].filter(Boolean);
        // (v353, владелец: «донк ждёт там, где его могут убить со Stairs») укрытие — и от мест, где CT держат этот сайт (pos.ctHold/ctSecond)
        var PC = POS[tt.site] || {}; (PC.ctHold || []).concat(PC.ctSecond || []).forEach(function(n){ var zp = zonePoint(n, S0); if(zp) hf.push(zp); });
        // (v350) там, где стоит, его не видно — ждёт на месте; видно — в ближайшее укрытие до 80 ед. (было 150 — отходил далеко)
        var seen = hf.some(function(q){ return hasLOS(b.x, b.y, q.x, q.y, b.z); });
        var cov = seen ? pickSpots("utilw"+Math.round(b.x/30)+","+Math.round(b.y/30)+tt.site, {x:b.x, y:b.y}, 1, {rMax:80, minGap:20, hideFrom:hf})[0] : null;
        if(cov && hf.some(function(q){ return hasLOS(cov.x, cov.y, q.x, q.y); })) cov = null;
        b._utilW = {round: roundNum, t: tick, x: cov ? cov.x : b.x, y: cov ? cov.y : b.y}; }
      var waitOn = tick - b._utilW.t < (rush ? UTIL_WAIT_RUSH : UTIL_WAIT)*TICK_HZ;
      // (v353, владелец: «в 351 знали про CT, но чего-то ждали и не выходили») ждал до предела — больше в этом раунде не ждёт: раньше
      // условие то пропадало, то появлялось, таймер начинался заново, и выход откладывался без конца
      if(!waitOn) b._utilWDone = roundNum;
      // ждёт — стоит, где начал ждать (прицел на сайт); раньше выданный пост (зачистка угла) иначе вёл его дальше под гранаты
      // (v378) носитель ещё не готов ставить (ждёт гранаты выхода) — свою же задачу плана «ставить» план и снимает: иначе
      // «ставить» (важнее ожидания по таблице арбитра) держала пост, а «готов» не наступало — бот переключался туда-обратно
      if(waitOn && b.post && b.post.tag === "plantspot" && !b.planting) clearPost(b);
      if(waitOn && b.post && b.post.tag === "utilWait") postKeep(b);
      else if(waitOn) setPost(b, {x:b._utilW.x, y:b._utilW.y}, S0, true, "utilWait");
      return waitOn;
    };
    var ready = function(b){
      if(b.tRole !== "lurker" && utilWait(b)) return false;
      // энтри под флешку от тиммейта: входит в угол сразу после хлопка (≤0.5с),
      // а если флешки не будет/не долетела за 3с — идёт без неё
      if(b.tRole === "entry" && nadeFlags.peekFlashPlanned){
        var popped = nadeFlags.peekFlashPop && tick - nadeFlags.peekFlashPop >= 0;
        return popped || since > 3*TICK_HZ;
      }
      if(!rush && (b.tRole === "igl" || (b === carrier && b.tRole !== "entry"))) return !!tt.wave2;
      return since >= (DELAY[b.tRole] !== undefined ? DELAY[b.tRole] : 60);
    };
    if(carrier && carrier.alive && !carrier.planting && ready(carrier)){
      // выбор точки — когда носитель уже на подходе к сайту (по ситуации в этот момент)
      if(BAL.plantChoice && !tt.plantPick && Math.hypot(carrier.x-site.x, carrier.y-site.y) < 500) choosePlant(tt);
      // (v272, пункт 3, просьба владельца 13.10) с бомбой на плант — не в одиночку (как за бомбой — fetchCover): рядом нет
      // своего, который тоже заходит (≤ TRADE_R), — ближайший свой не на сайте и не в бою идёт к носителю и заходит с ним
      // (войс), носитель ждёт его. Идёт один, только если своих нет, все уже на сайте (идёт к ним) или время поджимает
      // (дойти + поставить + 5 с запаса — проектное число). У про носитель за 10 с до планта один (нет своего ≤350 px)
      // 5 % времени, у ботов v269 — 13–16 % (88 демок; tools/measure/audit/carrier_plant.py)
      var ppt = tt.plantPick ? tt.plantPick.pt : plantPt;
      var cm = ts.filter(function(o){ return o !== carrier && o.alive && o.tRole !== "lurker"; });
      var cLeft = ROUND_TIME_SEC - (tick - roundStartTick)/TICK_HZ, cWalk = polyLen(pathPts(carrier.x, carrier.y, ppt.x, ppt.y))/SPEED + PLANT_TICKS/TICK_HZ + 5;
      var BE = tt.bombEsc && tt.bombEsc.round === roundNum && tt.bombEsc.cid === carrier.id ? tt.bombEsc : null;
      var esc = BE ? cm.filter(function(o){ return o.id === BE.id && !o._sawEnemy && !o.planting; })[0] : null;
      if(!esc && !cm.some(function(o){ return ready(o) && Math.hypot(o.x-carrier.x, o.y-carrier.y) <= TRADE_R; }) && cLeft >= cWalk){
        esc = cm.filter(function(o){ return !o._sawEnemy && !o.planting && !o.nadeTask && !(o._tradeLock && o._tradeLock.until > tick) && !(o._reposUntil && tick < o._reposUntil) && Math.hypot(o.x-ppt.x, o.y-ppt.y) > 350; })
          .sort(function(a, c){ return Math.hypot(a.x-carrier.x, a.y-carrier.y) - Math.hypot(c.x-carrier.x, c.y-carrier.y); })[0] || null;
        // (v342, отметка владельца: magixx с бомбой ждал у B «сопровождение» с A — через всю карту) сопровождающий — не дальше
        // ESC_MAX_SEC бега до носителя; иначе носитель идёт ставить сам
        if(esc && pathLenTo(esc, carrier.x, carrier.y)/SPEED > ESC_MAX_SEC) esc = null;
        if(esc){ BE = tt.bombEsc = {round: roundNum, cid: carrier.id, id: esc.id, since: tick}; voiceLog("T", "besc"+carrier.id, esc.id, "иду к бомбе — "+carrier.id+", заходим вместе"); }
      }
      // (v342) ждать сопровождение — не дольше ESC_WAIT_SEC и только если он не дальше ESC_MAX_SEC бега (проверка каждые 0,5 с;
      // проектные числа: в демках про — только доля «носитель один», 5 %)
      // (v359, отметка владельца: magixx с бомбой ждал на T Ramp ~10 с, сопровождающий кидал лайнап, а на A уже никого) сайт по
      // знанию пуст (на сайте и у него < 0,5 CT по карте команды) или сопровождающий занят гранатой — не ждём, идём ставить
      if(esc && (beliefCount("T", BZ.siteNear[tt.site]||[]) < 0.5 || esc.nadeTask)) esc = null;
      if(esc && BE){ if(BE.since == null) BE.since = tick;
        if(tick - (BE.lenT || -1e9) >= 32){ BE.lenT = tick; BE.far = pathLenTo(esc, carrier.x, carrier.y)/SPEED > ESC_MAX_SEC; }
        if(BE.far || tick - BE.since > ESC_WAIT_SEC*TICK_HZ) esc = null; }
      if(esc && cLeft >= cWalk){
        var dE = Math.hypot(esc.x-carrier.x, esc.y-carrier.y);
        var lnE = Math.hypot(ppt.x-carrier.x, ppt.y-carrier.y) || 1, ePt = walk({x: carrier.x + (ppt.x-carrier.x)/lnE*Math.min(90, lnE), y: carrier.y + (ppt.y-carrier.y)/lnE*Math.min(90, lnE)});
        if(!(esc.post && esc.post.tag === "bombEscort" && Math.hypot(esc.post.x-ePt.x, esc.post.y-ePt.y) < 80)) setPost(esc, ePt, g.ctEntry, true, "bombEscort");
        else postKeep(esc);
        esc._probeLock = tick;
        if(dE <= TRADE_R) setPost(carrier, ppt, g.ctEntry, true, "plantspot");
        else if(carrier.post && carrier.post.tag === "bombWait") postKeep(carrier);
        else setPost(carrier, {x:carrier.x, y:carrier.y}, esc, true, "bombWait");
      } else setPost(carrier, ppt, g.ctEntry, true, "plantspot");
    }
    var rest = pick(["entry","awp","support","igl"]).filter(function(b){ return b !== carrier && ready(b); });
    // (v350, владелец: «все останавливаются далеко») раш: кто без задачи (поддержка, IGL; AWP без лайнапа) — идёт за энтри и держится
    // позади него (60–110 ед., проектные числа), а не стоит на месте сбора; энтри ждёт гранаты — ждут за ним
    if(rush){ var eB = ts.filter(function(o){ return o.tRole === "entry" && o.alive; })[0];
      if(eB) ts.forEach(function(o){ if(o === eB || !o.alive || (o === carrier && Math.hypot(o.x-site.x, o.y-site.y) < 450) || o.tRole === "lurker" || o.nadeTask || o._sawEnemy || (o.post && !/^(rushFollow|utilWait|utilHold|route:|plantspot|bombWait)/.test(o.post.tag))) return;   // (v368) носитель — тоже за энтри, в группе, пока не у сайта   // (v352) и пост маршрута — иначе вставал на старой точке маршрута
        var dx = o.x-eB.x, dy = o.y-eB.y, dl = Math.hypot(dx, dy) || 1, k = Math.min(110, Math.max(60, dl));
        var fp = walk({x: eB.x + dx/dl*k, y: eB.y + dy/dl*k});
        // (v353, владелец: «тнир бежит и умирает, а донк ждёт») энтри ждёт — остальные стоят за ним (маршрут раша на паузе)
        if(eB.post && eB.post.tag === "utilWait"){
          if(o.post && o.post.tag === "utilHold" && Math.hypot(o.post.x-eB.x, o.post.y-eB.y) < 160) return;
          var hfF = [SITES[tt.site], GEO[tt.site].anchor, GEO[tt.site].ctEntry].filter(Boolean), PCf = POS[tt.site] || {};
          (PCf.ctHold || []).concat(PCf.ctSecond || []).forEach(function(n){ var zp = zonePoint(n, SITES[tt.site]); if(zp) hfF.push(zp); });
          var hp = pickSpots("uhold"+o.id+Math.round(fp.x/30)+","+Math.round(fp.y/30), fp, 1, {rMax:90, minGap:24, hideFrom:hfF})[0];
          if(hp && hfF.some(function(q){ return hasLOS(hp.x, hp.y, q.x, q.y); })) hp = null;
          setPost(o, hp || fp, SITES[tt.site], true, "utilHold"); return; }   // за энтри — в укрытии от мест CT (v353)
        if(o.post && o.post.tag === "rushFollow" && Math.hypot(o.post.x-fp.x, o.post.y-fp.y) < 40) return;   // не дёргать путь каждый тик
        if(o.post && /^route:/.test(o.post.tag) && o._route && o._route.pts[o._route.idx] && Math.hypot(o.post.x-o._route.pts[o._route.idx].x, o.post.y-o._route.pts[o._route.idx].y) < 40) return;   // идёт по маршруту к текущей точке
        setPost(o, fp, SITES[tt.site], true, "rushFollow"); }); }
    // (S5) ставят — двое ближних прикрывают подходы к ставящему под разными углами
    if(BAL.coverPlant && carrier && carrier.alive && (carrier.planting || (carrier.post && carrier.post.tag === "plantspot" && Math.hypot(carrier.x-carrier.post.x, carrier.y-carrier.post.y) < 90))){
      // (v409, владелец 22.10: «coverplant очень часто меняется, бегают по всему сайту») точки искались каждый тик вокруг того места, где
      // ставящий сейчас (он шёл — набор точек менялся), а какая кому — по тому, кто сейчас ближе (порядок переворачивался — менялись
      // местами): м1 р1 Mirage — ≈ 40 смен точки у двоих за 10 с. Теперь центр — точка планта (не сам ставящий), точки выбираются
      // один раз, кто взял — держит до конца прикрытия; второго добирают, только если прикрывающих меньше двух
      var cp0 = carrier.planting ? {x:carrier.baseX, y:carrier.baseY} : {x:carrier.post.x, y:carrier.post.y};
      var CV = tt._cov; if(!CV || CV.round !== roundNum || Math.hypot(CV.x-cp0.x, CV.y-cp0.y) > 90) CV = tt._cov = {round:roundNum, x:cp0.x, y:cp0.y, by:{}};
      var lkP = [g.ctEntry, g.anchor];
      var okCov = function(b){ return !b._sawEnemy && Math.hypot(b.x-CV.x, b.y-CV.y) < 550 && !(b._tradeLock && b._tradeLock.until > tick); };
      var covs = rest.filter(function(b){ return CV.by[b.id] && okCov(b); });
      Object.keys(CV.by).forEach(function(id){ if(!covs.some(function(b){ return b.id === id; })) delete CV.by[id]; });
      rest.filter(function(b){ return !CV.by[b.id] && okCov(b); }).sort(function(a, c){ return Math.hypot(a.x-CV.x, a.y-CV.y) - Math.hypot(c.x-CV.x, c.y-CV.y); })
        .forEach(function(b){ if(covs.length >= 2) return;
          var used = Object.keys(CV.by).map(function(id){ return CV.by[id].ci; }), ci = used.indexOf(0) < 0 ? 0 : 1;
          var sp = pickSpots("covplant"+tt.site+ci, CV, 2, {rMin:60, rMax:230, minGap:60, see:[lkP[ci]], must:[CV]})[0];
          if(sp){ CV.by[b.id] = {ci:ci, sp:sp}; covs.push(b); } });
      covs.forEach(function(b){ var A = CV.by[b.id]; setPost(b, A.sp, lkP[A.ci], true, "coverplant"); });
      if(covs.length && !tt._covVoice){ tt._covVoice = tick; voiceLog("T", "covplant", covs[0].id, "ставь, прикрываю"+(covs[1] ? " с "+covs[1].id : "")); }
      rest = rest.filter(function(b){ return covs.indexOf(b) < 0; });
    }
    ts.forEach(function(b){
      if(!isMF(b) || b === carrier || b.planting || b === fetcher) return; // за бомбой — не держать сайт (раньше посты чередовались и он стоял)
      var bestN = null, bdd = Infinity;
      POS[tt.site].tClear.forEach(function(n){ var zp = zonePoint(n, b); if(!zp) return; var d = Math.hypot(zp.x-b.x, zp.y-b.y); if(d < bdd){ bdd = d; bestN = n; } });
      var fp = bestN ? namedSpot(bestN, b, {see:[g.tEntry, plantPt], key:"mf"+tt.site}) : plantPt;
      setPost(b, fp, plantPt, true, "sitehold"+tt.site+":CT-"+(bestN||""));
    });
    // раздел 12: "байт и трейд" — пока энтри лезет в первый угол, поддержка не
    // бежит на сайт рядом с ним, а стоит у входа с прицелом туда же: убьют
    // энтри — стрелок уже виден ей и она сразу разменивает
    var entryB = ts.filter(function(b){ return b.tRole === "entry"; })[0];
    if(!rush && entryB && !entryB.atPost && since < 5*TICK_HZ){
      rest.filter(function(b){ return b.tRole === "support" && !(b._stageInfo && b._stageInfo.round === roundNum && Math.hypot(b._stageInfo.from.x-g.tStage.x, b._stageInfo.from.y-g.tStage.y) > 250); }).forEach(function(b){ setPost(b, g.tEntry, g.anchor, true, "trade"+tt.site, 1); rest = rest.filter(function(o){ return o !== b; }); });
    }
    // занять сайт: энтри, поддержка и IGL — каждый на свою названную позицию
    // (Back Site, Triple Box, 90, Second Lane…), ближайшую к тому, откуда он зашёл
    // кто ждал выхода на своей точке с другой стороны (Donut, Dark, CT Lane…) —
    // тоже занимает ближние к себе позиции сайта, а не бежит к стандартному входу
    var sideT = rest.filter(function(b){ var SI = b._stageInfo; return SI && SI.round === roundNum && Math.hypot(SI.from.x-g.tStage.x, SI.from.y-g.tStage.y) > 250; });
    var takers = rest.filter(function(b){ var r = roleT(b); return r==="entry" || r==="support" || r==="igl" || sideT.indexOf(b) >= 0; });
    rest = rest.filter(function(b){ return sideT.indexOf(b) < 0; });
    // распределять точки — когда смоки выхода уже встали (≤1.5с) — чтобы
    // занимать места, которые дым закрывает от CT
    var smokeUp = smokes.some(function(sm){ return Math.hypot(sm.x-g.ctEntry.x, sm.y-g.ctEntry.y) < 300 || Math.hypot(sm.x-site.x, sm.y-site.y) < 320; });
    if(BAL.namedPos && takers.length && (smokeUp || since > 1.5*TICK_HZ || rush)){
      if(!tt.takeAssign) tt.takeAssign = {};
      var used = {};
      Object.keys(tt.takeAssign).forEach(function(id){ used[tt.takeAssign[id]] = true; });
      takers.forEach(function(b){
        var nm = tt.takeAssign[b.id];
        if(!nm){
          var best = null, bd = Infinity;
          POS[tt.site].tClear.forEach(function(n){ if(used[n]) return; var zp = zonePoint(n, site); if(!zp) return;
            var d = Math.hypot(zp.x-b.x, zp.y-b.y);
            // точка, которую смок закрывает от входа CT/опорника, — "занимаем под смок"
            if(smokeUp && (smokeBlocks(zp.x, zp.y, g.ctEntry.x, g.ctEntry.y) || smokeBlocks(zp.x, zp.y, g.anchor.x, g.anchor.y))) d -= 260;
            if(d < bd){ bd = d; best = n; } });
          nm = best; if(nm){ tt.takeAssign[b.id] = nm; used[nm] = true;
            if(smokeUp && !tt._smokeTakeLog){ tt._smokeTakeLog = true; logEvent("T: смоки встали — занимают позиции под смоком ("+nm+")"); } }
        }
        var tp = nm ? namedSpot(nm, site, {see:[g.ctEntry], key:"take"+tt.site}) : null;
        // энтри чистит углы по очереди: ближний угол → следующий от него, на
        // каждом короткий чек (~0.5с); чисто — колл "чекнул X — пусто" и дальше
        if(BAL.clearOrder && b.tRole === "entry" && !rush){
          var C = b._clr;
          if(!C || C.round !== roundNum || C.site !== tt.site){
            var left = POS[tt.site].tClear.slice(), from = {x:b.x, y:b.y}, list = [];
            while(left.length && list.length < 3){
              var bi = -1, bdd = Infinity;
              left.forEach(function(n, i){ var zp = zonePoint(n, site); if(!zp) return; var dd = Math.hypot(zp.x-from.x, zp.y-from.y); if(dd < bdd){ bdd = dd; bi = i; } });
              if(bi < 0) break; var nn = left.splice(bi, 1)[0]; list.push(nn); from = zonePoint(nn, site) || from;
            }
            C = b._clr = {round:roundNum, site:tt.site, list:list, i:0, arr:0};
          }
          if(C.list.length){
            var cur = C.list[Math.min(C.i, C.list.length-1)];
            var cp = namedSpot(cur, site, {see:[g.ctEntry], key:"clr"+tt.site});
            var nxt = C.list[C.i+1] ? zonePoint(C.list[C.i+1], site) : null;
            if(cp){
              if(b.atPost && b.post && b.post.tag === "clear"+tt.site+":"+cur && C.i < C.list.length){
                if(!C.arr) C.arr = tick;
                if(tick - C.arr > 32 && !b._sawEnemy){ markClear("T", cp.x, cp.y, b.id); C.i++; C.arr = 0; }
              }
              setPost(b, cp, nxt || g.ctEntry, true, "clear"+tt.site+":"+cur);
              return;
            }
          }
        }
        // (v370, владелец: «выходят — просто стоят и стреляют, не протягивают выход дальше по зонам») занял точку на сайте и там
        // тихо TAKE_ADV с (не видит врага, не стрелял, нет свежего контакта) — переходит на следующую свободную точку глубже, к
        // стороне CT (ближе к входу CT на TAKE_STEP+, не дальше TAKE_REACH от нынешней), из мест, где T стоят на сайте по демкам
        // (pos.tClear + pos.tPost). Так выход растягивается по зонам до входа CT. Проектные числа
        if(tp && nm){
          var TA = b._takeAt; if(!TA || TA.nm !== nm || TA.round !== roundNum) TA = b._takeAt = {nm:nm, round:roundNum, arr:0};
          if(b.atPost && !TA.arr) TA.arr = tick;
          var calmT = !b._sawEnemy && tick - (b._shotAtT||-1e9) > 2*TICK_HZ && tick - (b.lastShotTick||-1e9) > 2*TICK_HZ && !(b._contact && tick < b._contact.until);
          if(TA.arr && calmT && tick - TA.arr > TAKE_ADV*TICK_HZ){
            var cz = zonePoint(nm, site), dC = cz ? Math.hypot(cz.x-g.ctEntry.x, cz.y-g.ctEntry.y) : 0, nx2 = null, bn = Infinity;
            var pool = (POS[tt.site].tClear || []).concat(POS[tt.site].tPost || []).filter(function(n, i, a){ return a.indexOf(n) === i; });
            if(cz) pool.forEach(function(n){ if(used[n] || n === nm) return; var zp = zonePoint(n, site); if(!zp) return;
              if(Math.hypot(zp.x-g.ctEntry.x, zp.y-g.ctEntry.y) > dC - TAKE_STEP) return; var dz = Math.hypot(zp.x-cz.x, zp.y-cz.y); if(dz > TAKE_REACH) return;
              if(dz < bn){ bn = dz; nx2 = n; } });
            if(nx2){ delete used[nm]; used[nx2] = true; tt.takeAssign[b.id] = nx2; voiceLog("T", "adv"+b.id+nx2+roundNum, b.id, "тут чисто, двигаюсь "+calloutName(zonePoint(nx2, site).x, zonePoint(nx2, site).y)); nm = nx2;
              tp = namedSpot(nm, site, {see:[g.ctEntry], key:"take"+tt.site}); b._takeAt = {nm:nm, round:roundNum, arr:0}; }
            else TA.arr = tick + 10*TICK_HZ;   // глубже некуда — держит
          }
        }
        if(tp) setPost(b, tp, g.ctEntry, true, (b.tRole === "entry" ? "clear" : "sitehold")+tt.site+":"+nm);
        else groupPost([b], plantPt, g.ctEntry, "sitehold"+tt.site, {rMin:40, rMax:210, minGap:60, see:[g.ctEntry]});
      });
    } else if(!BAL.namedPos){
      groupPost(rest.filter(function(b){ return b.tRole==="entry"; }), g.anchor, g.ctEntry, "clear"+tt.site, {rMax:130, minGap:50, see:[g.ctEntry]});
      groupPost(rest.filter(function(b){ return b.tRole==="support" || b.tRole==="igl"; }), plantPt, g.ctEntry, "sitehold"+tt.site, {rMin:40, rMax:210, minGap:60, see:[g.ctEntry]});
    }
    groupPost(rest.filter(function(b){ return b.tRole==="awp"; }), g.tEntry, g.ctEntry, "awpline"+tt.site, {rMax:130, minGap:50, see:[g.ctEntry, plantPt]});
  } else if(tt.phase === "postplant"){
    var gs = GEO[bomb.site];
    // прочь от бомбы (радиус взрыва убивает и своих). (v373, сторож: на Ancient T с постом «flee» за 2 с до взрыва ещё в зоне —
    // 60 раз на 100 раундов) раньше все уходили за 6 с, кто бы где ни стоял; у про последний раз в 520 px от бомбы — медиана за
    // 5,9 с до взрыва (демки Ancient, 1194 игрока). Теперь каждый — когда до своей точки ухода идти столько, сколько осталось,
    // + запас 2 с (проектное число), но не позже 6 с
    var leftS = bombTimeLeftTicks()/TICK_HZ, defusingNow = bots.some(function(o){ return o.defusing; });
    var fleeing = defusingNow ? [] : ts.filter(function(b){ if(b.planting) return false; var fp = bombFleePoint(b) || gs.tStage;
      return leftS < 6 || leftS < pathLenTo(b, fp.x, fp.y)/(SPEED*weaponSpeedMul(b)) + 2; });
    if(fleeing.length){
      if(!tt.fleeLogged){ tt.fleeLogged = true; logEvent("T: уходим от бомбы — сейчас рванёт"); }
      fleeing.forEach(function(b){ var fp = bombFleePoint(b); setPost(b, fp || gs.tStage, {x:bomb.x, y:bomb.y}, true, "flee"); });
      ts = ts.filter(function(b){ return fleeing.indexOf(b) < 0; });
      if(!ts.length) return;
    }
    // решили "не успеваем на дефуз — сейв": держим сейв, пока кто-то дефузит
    // (если дефуз оборвался — фейк/убили — через 2с снова играем бомбу)
    if(tt._defLate){
      if(bots.some(function(o){ return o.defusing && o.alive; })) tt._defLateSeen = tick;
      if(tick - (tt._defLateSeen || tt._defLate) > 2*TICK_HZ) tt._defLate = null;
      else { ts.forEach(function(b){ if(!b._saveSpot) b._saveSpot = pickSaveSpotT(b); if(!b.planting) setPost(b, b._saveSpot, null, true, "save"); }); return; }
    }
    var antiDef = [];
    defuseContTick();
    // (v296, владелец 14.10: «фейк-дефуз и обычный — его туда-сюда перенаправляет», отметка: раунд 1, тик 5848 — T2 за 10 тиков
    // «на время» → «на бомбу» → «на время» → «сейв») одно решение на одну попытку дефуза: кто пошёл на бомбу — идёт, пока дефуз
    // идёт, и ещё 2 с после того, как он стих (выглядывает на бомбу, а не разворачивается); «не успеваем — сейв» держит блок выше
    var dfNow = bots.filter(function(o){ return o.defusing && o.alive; })[0], AC = tt._adCommit;
    if(AC && (AC.round !== roundNum || (!dfNow && tick - AC.last > 2*TICK_HZ))) AC = tt._adCommit = null;
    if(AC){ if(dfNow) AC.last = tick;
      antiDef = ts.filter(function(b){ return AC.ids.indexOf(b.id) >= 0 && !b.planting; });
      var bpC = {x:bomb.x, y:bomb.y};
      antiDef.forEach(function(b){
        // (v353, отметка владельца: TN1R «слышит, что не фейк, но не идёт сбивать» — стоял на точке, откуда бомбу закрывает ящик)
        // пришёл на точку, дефуз идёт, а дефузера не видно 0,5 с — идёт прямо на бомбу
        var AS = b._adSpot && b._adSpot.round === roundNum ? b._adSpot : null;
        if(AS && b.atPost && dfNow && !b._sawEnemy){ if(!AS.arr) AS.arr = tick; else if(tick - AS.arr > 32 && !AS.push){ AS.push = true; AS.pt = bpC; voiceLog("T", "adpush"+b.id+roundNum, b.id, "отсюда бомбу не видно — иду прямо на дефуз"); } }
        setPost(b, AS ? AS.pt : bpC, bpC, true, "antidefuse"); b._stopPlantUntil = tick + 30; });
    } else
    if(BAL.antiDefuse && tDefuseGo(tt, ts)){
      var bpA = {x:bomb.x, y:bomb.y};
      antiDef = ts.filter(function(b){ return !b.planting && Math.hypot(b.x-bpA.x, b.y-bpA.y) < 1100; });
      // (S6) не успеть — не бежать на троих: сколько осталось дефузить (кит
      // не знаем — считаем, что есть, если у CT был фулл-бай), и сколько бежать
      if(BAL.defuseReach){
        var dfz = bots.filter(function(o){ return o.defusing && o.alive; })[0];
        var remT = dfz ? Math.max(0, (dfz.defuseUntil||tick) - tick) : 0;
        if(dfz && !(dfz.defuseUntil) ) remT = (teamEco.CT.roundType === "full" ? DEFUSE_KIT_TICKS : DEFUSE_TICKS);
        var late = antiDef.filter(function(b){ return pathLenTo(b, bpA.x, bpA.y)/SPEED*TICK_HZ > remT + 24; });
        if(dfz && late.length === antiDef.length && late.length && !tt._defLate){
          tt._defLate = tick;
          voiceLog("T", "deflate", late[0].id, "не успеваем на дефуз — сейв");
          late.forEach(function(b){ if(!b._saveSpot) b._saveSpot = pickSaveSpotT(b); setPost(b, b._saveSpot, null, true, "save"); b._stopPlantUntil = 0; });
          antiDef = [];
        } else if(dfz) antiDef = antiDef.filter(function(b){ return late.indexOf(b) < 0; });
      }
      var spA = pickSpots("antidef"+Math.round(bpA.x/30)+","+Math.round(bpA.y/30), bpA, 4, {rMin:50, rMax:300, minGap:45, must:[bpA]});
      antiDef.forEach(function(b){
        if(!b._adSpot || b._adSpot.round !== roundNum){
          var bs2 = null, bd2 = Infinity; spA.forEach(function(q){ var d = Math.hypot(q.x-b.x, q.y-b.y); if(d < bd2){ bd2 = d; bs2 = q; } });
          b._adSpot = {round:roundNum, pt: bs2 || bpA};
        }
        setPost(b, b._adSpot.pt, bpA, true, "antidefuse"); b._stopPlantUntil = tick + 30; // бегом, не шагом
      });
      if(antiDef.length && tt._adVoice !== roundNum){ tt._adVoice = roundNum; voiceLog("T", "antidef", antiDef[0].id, "дефузят! все на бомбу!"); }
      if(antiDef.length) tt._adCommit = {round:roundNum, ids:antiDef.map(function(b){ return b.id; }), last:tick};
    }
    if(lurker && antiDef.indexOf(lurker) < 0) lurkerBrain(lurker, tt, other);
    var group = pick(["entry","awp","support","igl"]).filter(function(b){ return antiDef.indexOf(b) < 0; });
    // лёркер, оставшийся последним (уже не лёркер), — тоже на пост-плант, а не стоит где поставил
    if(!lurker) group = group.concat(ts.filter(function(b){ return b.tRole === "lurker" && antiDef.indexOf(b) < 0 && group.indexOf(b) < 0 && !b.planting; }));
    // CT ушли в сейв и времени много — пара T идёт выбивать оружие
    // CT не идут на ретейк: после планта прошло 15с+, у бомбы и на подходах их
    // не видели и не слышали 10с, и их меньше нас — похоже на сейв
    var ctNearB = intelEstimate("T", bomb.x, bomb.y, 1200, 10*TICK_HZ);
    var ctSaving = tick - bomb.plantTick > 15*TICK_HZ && (ctNearB.seen + ctNearB.heard) === 0 && aliveCount("CT") < ts.length;
    if(ctSaving && bombTimeLeftTicks() > 12*TICK_HZ){
      var hunters = group.filter(function(b){ return b.tRole==="entry" || b.tRole==="support"; });
      // где CT вероятнее всего прячутся: раньше было всего 2-3 фиксированные
      // точки вокруг спавна — хантеры весь раунд бегали туда-обратно между
      // одними и теми же двумя углами. Теперь набираем 5-7 точек по всей
      // стороне CT (как в pickSaveSpot — по навмешу, подальше от бомбы и от
      // сайтов), и обходят их методично: не туда, где уже недавно смотрел
      // кто-то из своих, и не туда же, куда уже идёт другой хантер.
      if(!tt.huntPts || tt.huntPts.round !== roundNum){
        var cand = [];
        NAVAREAS.forEach(function(z, i){
          if(i % 2) return;
          if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
          var c = zoneCentroid(z);
          if(insideSolidWall(c.x, c.y)) return;
          if(Math.hypot(c.x-bomb.x, c.y-bomb.y) < 500) return; // не отходят от бомбы слишком далеко в другую сторону
          var dSite = Math.min(Math.hypot(c.x-SITES.A.x, c.y-SITES.A.y), Math.hypot(c.x-SITES.B.x, c.y-SITES.B.y));
          if(dSite < 350) return; // сам сайт не проверяем — это не "у CT-спавна"
          cand.push({x:c.x, y:c.y, dCT:Math.hypot(c.x-CT_SPAWN.x, c.y-CT_SPAWN.y)});
        });
        cand.sort(function(a, c2){ return a.dCT - c2.dCT; });
        // (v442, док владельца 27.10: «охота на последних — как будто рандомные точки, а не где была инфа») сначала — где по знанию команды
        // могут быть живые CT (гипотезы знания, тяжёлые первыми; точки на сайте — тоже, это и есть «где была инфа»); потом — места у спавна CT
        var minGap = 280, pts = [];
        var kn = []; bots.forEach(function(o){ if(o.team === "CT" && o.alive) knowEnemySpots("T", o.id).forEach(function(q){ if(q.w >= 0.05) kn.push(q); }); });
        kn.sort(function(a, c2){ return c2.w - a.w; });
        kn.forEach(function(q){ if(pts.length < 5 && !insideSolidWall(q.x, q.y) && pts.every(function(p){ return Math.hypot(p.x-q.x, p.y-q.y) > minGap; })) pts.push({x:q.x, y:q.y}); });
        if(pts.every(function(p){ return Math.hypot(p.x-CT_SPAWN.x, p.y-CT_SPAWN.y) > minGap; })) pts.push({x:CT_SPAWN.x, y:CT_SPAWN.y});
        for(var ci=0; ci<cand.length && pts.length<7; ci++){
          var c = cand[ci];
          if(pts.every(function(p){ return Math.hypot(p.x-c.x, p.y-c.y) > minGap; })) pts.push({x:c.x, y:c.y});
        }
        tt.huntPts = pts; tt.huntPts.round = roundNum; tt._huntSeen = {};
      }
      var pickNext = function(b, avoid){
        // методичный обход: сперва ближайшая ещё НЕ проверенная точка (не та,
        // куда уже идёт другой хантер); когда все проверены — начинаем заново
        var free = function(list){ return list.filter(function(hi){ return avoid.indexOf(hi) < 0; }); };
        var unvisited = free(tt.huntPts.map(function(hp, hi){ return hi; }).filter(function(hi){ return tt._huntSeen[hi] === undefined; }));
        if(!unvisited.length){ tt._huntSeen = {}; unvisited = free(tt.huntPts.map(function(hp, hi){ return hi; })); }
        var best = -1, bd = Infinity;
        unvisited.forEach(function(hi){ var hp = tt.huntPts[hi]; var d = Math.hypot(hp.x-b.x, hp.y-b.y); if(d < bd){ bd = d; best = hi; } });
        return best >= 0 ? best : 0;
      };
      hunters.forEach(function(b, hi){
        var taken = hunters.filter(function(o){ return o !== b && o._huntIdx !== undefined; }).map(function(o){ return o._huntIdx; });
        if(b._huntIdx === undefined){ b._huntIdx = pickNext(b, taken); b._huntStart = tick; }
        // не дошёл за 12с (точка недостижима/далеко) — следующая
        if(!b.atPost && tick - (b._huntStart||tick) > 12*TICK_HZ){ b._huntIdx = pickNext(b, taken); b._huntStart = tick; }
        if(b.atPost && b.post && b.post.tag === "hunt"){
          if(!b._huntArrive){ b._huntArrive = tick; tt._huntSeen[b._huntIdx] = tick; }
          if(tick - b._huntArrive > 90){ b._huntIdx = pickNext(b, taken); b._huntArrive = 0; b._huntStart = tick; }
        }
        var hp = tt.huntPts[b._huntIdx];
        setPost(b, hp, bomb ? {x:bomb.x, y:bomb.y} : null, true, "hunt");
      });
      if(hunters.length && !tt.huntLogged){ tt.huntLogged = true; logEvent("T: CT сейвят — "+hunters.map(function(h){return h.id;}).join(", ")+" идут выбивать оружие"); }
      group = group.filter(function(b){ return hunters.indexOf(b) < 0; });
    }
    // пост-плант: видеть бомбу (чтобы снять дефузера), но не стоять на виду у входа CT
    var bp0 = {x:bomb.x, y:bomb.y}, ppLeft = group.slice();
    // (9) играем на время: CT к бомбе не идут (не видели/не слышали их ближе
    // ~900px за 6с) и таймера ещё много — стоять вплотную к бомбе незачем,
    // только дарить ранний контакт. Отходим дальше, в укрытия, в пределах
    // слышимости дефуза; услышали дефуз — "все на бомбу" (анти-дефуз)
    // (5) клатч T после планта: один — сразу играет на время (дальнее укрытие в
    // пределах слышимости дефуза), выходит только на звук дефуза
    if(BAL.tClutch && group.length === 1 && aliveCount("CT") >= 1 && bombTimeLeftTicks() > 6*TICK_HZ){
      // (v443) «я один» — только если T правда один: группа пост-планта без лёркера и охотников бывала из одного при живых других
      if(!tt._tcPP){ tt._tcPP = tick; if(aliveCount("T") === 1) voiceLog("T", "tcpp", group[0].id, "я один на пост-планте — прячусь, играю на время, выйду на звук дефуза"); }
      if(!ppTimeNamed(group, bp0, bomb.site, DEFUSE_HEAR-90))
        groupPost(group, bp0, gs.ctEntry, "postplant:time", {rMin:300, rMax:Math.min(600, DEFUSE_HEAR-90), minGap:110, hideFrom:[gs.ctEntry, bp0]});
      return;
    }
    // (v469, п.9 владельца 29.10, р5 м1: после планта точки переназначались трижды — через 4 с тишины все уходили «на время» на T Ramp и CT,
    // через 2,7 с при первой инфе возвращались) ответ про-аналитика 29.10: держать расстановку, пока кроссфайр работает и позиции не раскрыты;
    // менять — по событию (раскрыли, граната, кто-то погиб, CT выходят), а не по таймеру. Режим «тихо — отходим на время» (BAL.ppTime) убран:
    // у каждого своя точка у бомбы (holdGroup ниже), смена — реакция на контакт / анти-дефуз
    if(BAL.holdTask){
      // (v145) пост-плант у бомбы = "держать район вокруг бомбы": бомбу видеть
      // обязательно (снять дефузера), встать под главный вход ретейка, от
      // остальных закрыться, не стоять кучей, по возможности кроссфаер
      holdGroup(group, {key:"pp"+bomb.site+Math.round(bp0.x/30), center:bp0, rArea: BAL.ppFar ? 420 : 320, rMin: BAL.ppFar ? 180 : 90, rMax: BAL.ppFar ? 520 : 420, must:[bp0], mustFirst:BAL.ppSpread, rMax2: BAL.ppFar ? 680 : 560,
        // (v442, док владельца 27.10: «войс спамится» — «держу бомбу, смотрю X» каждый игрок при каждой смене угла, 3–4 строки в секунду) — один
        // раз за раунд на игрока: куда смотрит дальше, видно на радаре
        voice:function(b, r){ if(r.main && b._ppSaid !== roundNum && (b._ppSaid = roundNum)) voiceLog("T", "pphold"+b.id, b.id, "держу бомбу, смотрю "+calloutName(r.main.pt.x, r.main.pt.y).replace(/^на /,"")); }}, "postplant:hold");
      return;
    }
    if(BAL.namedPos){
      if(!tt.ppAssign) tt.ppAssign = {};
      var usedP = {}; Object.keys(tt.ppAssign).forEach(function(id){ usedP[tt.ppAssign[id]] = true; });
      ppLeft = [];
      group.forEach(function(b){
        if(b._ppSplit && b._ppSplit.round === roundNum){ setPost(b, b._ppSplit.pt, bp0, true, "postplant:split"); return; }
        var nm = tt.ppAssign[b.id];
        if(!nm){
          var best = null, bd = Infinity;
          POS[bomb.site].tPost.forEach(function(n){ if(usedP[n]) return; var zp = zonePoint(n, bp0); if(!zp) return;
            var d = Math.hypot(zp.x-b.x, zp.y-b.y); if(Math.hypot(zp.x-bp0.x, zp.y-bp0.y) > 700) return;
            // (1) раньше — просто ближайшая к боту позиция (часто на самом сайте,
            // под входом CT). Теперь "стоимость": видна ли бомба, со скольких
            // выходов CT видно точку, не стоит ли прямо на линии входа CT
            if(BAL.tPostPlant){
              var sp = namedSpot(n, bp0, {must:[bp0], see:[gs.ctEntry], rMax:160, key:"pp"+Math.round(bp0.x/30)}) || zp;
              var ex = spotExposure("T", sp.x, sp.y), db = Math.hypot(sp.x-bp0.x, sp.y-bp0.y);
              d = d/500 + 0.9*ex + (hasLOS(sp.x, sp.y, bp0.x, bp0.y) ? 0 : 3) + (db < 150 ? 1.2 : 0) + (hasLOS(sp.x, sp.y, gs.ctEntry.x, gs.ctEntry.y) && db < 260 ? 0.8 : 0) +
                  0.6*hashRand(roundNum*131 + matchNum*17 + n.length*7 + b.id.length);
            }
            if(d < bd){ bd = d; best = n; } });
          nm = best; tt.ppAssign[b.id] = nm || "-"; if(nm){ usedP[nm] = true; logEvent(b.id+": пост-плант с «"+nm+"»"); }
        }
        var pp = nm && nm !== "-" ? namedSpot(nm, bp0, {must:[bp0], see:[gs.ctEntry], rMax:160, key:"pp"+Math.round(bp0.x/30)}) : null;
        if(pp && hasLOS(pp.x, pp.y, bp0.x, bp0.y)) setPost(b, pp, bp0, true, "postplant:"+nm); else ppLeft.push(b);
      });
    }
    groupPost(ppLeft, bp0, gs.ctEntry, "postplant", {rMin:90, rMax:340, minGap:70, must:[bp0], hideFrom:[gs.ctEntry], see:[gs.ctEntry]});
    // (S10) двое после планта в одной точке — один пик CT забирает обоих:
    // второй расходится на другой угол к бомбе (кроссфайр)
    if(BAL.ppSplit && group.length === 2 && !tt._ppSplitDone){
      var g0 = group[0], g1 = group[1];
      if(g0.post && g1.post && Math.hypot(g0.post.x-g1.post.x, g0.post.y-g1.post.y) < 250){
        tt._ppSplitDone = tick;
        var cand = pickSpots("ppsplit"+Math.round(bp0.x/30), bp0, 4, {rMin:150, rMax:420, minGap:60, must:[bp0]})
          .filter(function(q){ return Math.hypot(q.x-g0.post.x, q.y-g0.post.y) > 300; })[0];
        if(cand){ g1._ppSplit = {round:roundNum, pt:cand}; setPost(g1, cand, bp0, true, "postplant:split");
          voiceLog("T", "ppsplit", g1.id, "расходимся — я с другого угла на бомбу"); }
      }
    }
  }
}

