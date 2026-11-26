// (v510) быстрый выход (сняли CT на сайте / их ≤ 2 / там соло): критичный смок выхода уже брошен — заходим, как раскроется
// (не дольше EXU_FAST_MAX), ещё не брошен — сразу. Ожидание — exuHoldEta (366)
var EXU_FAST_MAX = 4;   // с (проектное число)
function tFastGo(tt, go){
  var eta = ROUND_TIME_SEC - (simTime - roundStartTime) >= EXU_LATE ? exuHoldEta(tt) : 0;
  if(!eta){ go(); return; }
  tt._fastGo = {go:go, r:roundNum, until: Math.min(eta, tick + EXU_FAST_MAX*TICK_HZ)};
  exuEv("wait", null, {why:"быстрый выход — ждём смок"}); logEvent("T: заходим, как раскроется смок");
}
var BOMB_HERE_R = 700;   // (v560) ед. карты: бомба лежит «у нашего сайта» — проектное число (как «рядом с сайтом» в эндгейме)
function tBrain(){
  // (Р3.2 команда) контекст мозга: общие для частей переменные (aT, fetchOk, fetcher, g, isMF, lurker, midOpt, other, pick, plantGo, plantPt, roleT, secLeft, sitS, site, tac, ts, tsS, tt, used)
  var K = {}; K.pick = pick;
  K.tt = teamTac.T; if(!K.tt) return;
  exuTick(K.tt);   // (тактика 30.10) гранаты выхода: жизненный цикл, провал, резервный исполнитель (366)
  if(K.tt.phase === "setup" && K.tt.minExec && K.tt.execTick < roundStartTick + K.tt.minExec*TICK_HZ) K.tt.execTick = roundStartTick + K.tt.minExec*TICK_HZ;
  bStageFix();
  if(K.tt.seenCT && tick % 16 === 0 && (K.tt.phase === "setup" || (K.tt.execStart != null && tick - K.tt.execStart < 8*TICK_HZ))){
    ["A","B"].forEach(function(k){ var e = intelEstimate("T", SITES[k].x, SITES[k].y, 450, 4*TICK_HZ); if(e.seen > K.tt.seenCT[k]) K.tt.seenCT[k] = e.seen; });
  }
  if(K.tt.phase !== "setup" && !K.tt.histed){ K.tt.histed = true; tSiteHist.push(K.tt.site); }
  // (v510) отложенный быстрый выход: брошенный критичный смок раскрылся (или ждали дольше EXU_FAST_MAX) — заходим
  if(K.tt._fastGo && (K.tt._fastGo.r !== roundNum || K.tt.phase !== "setup")) K.tt._fastGo = null;
  if(K.tt._fastGo && (!exuHoldEta(K.tt) || tick >= K.tt._fastGo.until)){ var fgo = K.tt._fastGo.go; K.tt._fastGo = null; fgo(); }
  K.tac = K.tt.tac, K.site = SITES[K.tt.site], K.g = GEO[K.tt.site];
  K.other = K.tt.site === "A" ? "B" : "A";
  K.plantPt = K.site.plant || K.site;
  K.secLeft = ROUND_TIME_SEC - (simTime - roundStartTime);
  // (v381, М130, владелец 16.10: «при сейве идут коллы ПЕРЕКОЛЛ B → A: минус на сайте») решили сейвить — план раунда кончился:
  // ни выхода, ни переколлов, ни коллов IGL. Раньше перепривязка ниже шла раньше проверки сейва
  // (v434, PRINCIPLES М158, владелец 25.10: «сейв должен пересматриваться по ходу раунда»; м1 Mirage р11: сейв с 2 на 4, sh1ro убил двоих —
  // 2 на 2, а сейв продолжался) расклад живых сменился — то же решение заново (tSaveWant): у про при новом раскладе не сейвят — сейв снят
  if(tBrainExecGo(K)) return;
  // ---- раздел 11: живая перепривязка тактики ----
  // IGL слушает коллы: если на нашем сайте стак CT (видели/слышали 2+ больше,
  // чем на другом) или там уже погибли двое наших, а времени хватает — один раз
  // за раунд меняем сайт. Выход не отменяется совсем: перегруппировка ~5с.
  if(tBrainSiteSwitch(K)) return;
  // ---- мид наш: сняли мидера CT → двое идут через мид на сторону CT (набор карты: tactics.plays.midTake;
  // на Ancient — через Red Room) и заходят на наш сайт оттуда, пока остальные — с обычной стороны ----
  tBrainMidTake(K);
  K.ts = bots.filter(function(b){ return b.team==="T" && b.alive; });
  // пост "плант" у того, кто уже не носитель (поставил, отдал бомбу) — снять,
  // иначе стоял на точке планта (игроки из захода с другой стороны не получают
  // пост-плант позицию и оставались на ней до конца раунда)
  if(tBrainTeam(K)) return;
  // бомба на земле — ближайший (не лёркер) идёт за ней
  K.fetcher = null;
  // бомбу уже подобрали — старый пост "за бомбой" снять (иначе носитель
  // стоял на месте, где она лежала, до конца раунда)
  tBrainBomb(K);
  K.isMF = function(b){ return (b._midFlank && b._midFlank.round === roundNum) || (K.tt.phase === "setup" && b._shift && b._shift.round === roundNum); };
  if(K.tt.phase === "setup") K.ts.forEach(function(b){ if(b._shift && b._shift.round === roundNum && !b.planting && !(K.tt.fetchId === b.id)) setPost(b, b._shift.pt, b._shift.look, true, "shift"); });
  // перегруппировка IGL: лёркер больше не лёркер — идёт с основной группой как поддержка
  // (В142, владелец 13.11 «да»: лёрк — решение раунда, а не роль на каждый раунд) лёрк одной меркой (tools/shadow/lurk_cmp.py): у про — 38 %
  // раундов, у ботов с лёрком каждый раунд — 55 %; в раунде без лёрка лёркер играет с группой (поддержка), как при перегруппировке IGL
  if(!K.tt._lurkR || K.tt._lurkR.round !== roundNum) K.tt._lurkR = {round: roundNum, on: hashRand(matchNum*977 + roundNum*131 + 5) < LURK_ROUND_P};
  K.roleT = function(b){ return ((K.tt.regroup || !K.tt._lurkR.on) && b.tRole === "lurker") ? "support" : b.tRole; };
  function pick(roles){ return K.ts.filter(function(b){ return roles.indexOf(K.roleT(b)) >= 0 && b !== K.fetcher && !b.planting && !K.isMF(b); }); }
  K.lurker = K.pick(["lurker"])[0];
  // лёркер с бомбой или последний живой — уже не лёркер, а тот, кто ставит
  if(K.lurker && ((bomb.state === "carried" && bomb.carrier === K.lurker) || K.ts.length === 1)) K.lurker = null;
  // ---- клатч T (один живой, бомба не стоит): играть на плант, а не на фраги ----
  // (док 6, п.18) «иду ставить» — только если успеть: бомба у него — дойти до ближнего сайта и поставить; лежит — как за бомбой (fetchOk)
  var soloCan = function(b){ if(bomb.state === "dropped") return K.fetchOk(b);
    if(bomb.state === "carried" && bomb.carrier === b) return Math.min(pathLenTo(b, SITES.A.x, SITES.A.y), pathLenTo(b, SITES.B.x, SITES.B.y))/SPEED + PLANT_TICKS/TICK_HZ <= K.secLeft;
    return false; };
  if(K.ts.length === 1 && bomb.state !== "planted" && K.tt.phase !== "postplant" && (K.tt.soloPlan || soloCan(K.ts[0]))){
    var solo = K.ts[0];
    if(!K.tt.soloPlan){
      // (п.1/п.31 владельца 29.10: м1 р1 — sh1ro один в бою на A, а «я один» перевёл сайт на B и путь отхода ушёл через T-спавн; м1 р8 —
      // через 20 с после колла «A стак» magixx пошёл ставить на A: знание о стаке «остыло», а сайт выбирался заново по карте врагов
      // × 400 + расстояние) сайт — тот, что выбрала команда; другой — только если на свой уже не успеть поставить. Сразу выход — ждать некого
      var canK = function(k){ return pathLenTo(solo, SITES[k].x, SITES[k].y)/SPEED + PLANT_TICKS/TICK_HZ <= K.secLeft; };
      var ks2 = K.tt.site && (canK(K.tt.site) || bomb.state !== "carried") ? K.tt.site : (K.tt.site === "A" ? "B" : "A");
      K.tt.soloPlan = ks2;
      if(ks2 !== K.tt.site){ var exS = K.tt.execStart; tSetSite(K.tt, ks2); K.tt.execStart = exS; K.site = SITES[ks2]; K.g = GEO[ks2]; K.other = ks2 === "A" ? "B" : "A"; K.plantPt = K.site.plant || K.site; }
      if(K.tt.phase === "setup"){ K.tt.phase = "execute"; K.tt.execStart = tick; }
      K.tt.wave2 = K.tt.wave2 || tick;
      voiceLog("T", "solo", solo.id, "один, иду ставить "+ks2);
    }
  }
  var stageOpt = function(k){ return {rMax:200, minGap:50, hideFrom:[SITES[k], GEO[k].anchor], see:[GEO[k].tEntry], avoidNades: tDeathSpots()}; };
  K.midOpt = {team: "T", rMax:160, minGap:50, see:[GEO.tMidLook]};
  if(!K.tt.tMidPick){
    var tm = POS.M.tHold, tmi = weightedPick(tm.length, roundNum*389 + matchNum*7);
    K.tt.tMidPick = tm[tmi] === "TMID" ? null : tm[tmi];
    K.tt.tMidPt = K.tt.tMidPick ? zonePoint(K.tt.tMidPick, GEO.tMid) : null;
    if(!K.tt.tMidPt) K.tt.tMidPick = "-";
  }

  if(K.tt.phase === "setup"){
    tBrainSetup(K);
  } else if(K.tt.phase === "execute"){
    tBrainExecute(K);
  } else if(K.tt.phase === "postplant"){
    if(tBrainPostplant(K)) return;
  }
}

// часть tBrain (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 31–91 исходного tBrain; true — выйти из мозга
function tBrainExecGo(K){
  if(K.tt.saving && bomb.state !== "planted"){
    K.tsS = bots.filter(function(b){ return b.team === "T" && b.alive; }), K.sitS = K.tsS.length+"v"+aliveCount("CT");
    // (00_PLAN п.10, ответ 6А) и когда появился реальный плант (tPlantChance, 180): сейв снят, при том же раскладе в этом раунде не включается
    K.plantGo = tPlantChance(K.tsS, K.secLeft);
    if(!K.plantGo && (K.sitS === K.tt.saveSit || tSaveWant(K.tsS, K.tsS.length, aliveCount("CT"), K.secLeft, K.site))){ K.tt.saveSit = K.sitS; tSaveHold(); return true; }
    if(K.plantGo){ K.tt.plantGo = roundNum+":"+K.sitS; if(K.plantGo !== K.tt.site) tSetSite(K.tt, K.plantGo); voiceLog("T", "tplgo"+roundNum, K.tsS[0].id, K.plantGo+" пустой — успеваем поставить, идём"); }
    K.tt.saving = 0; K.tt.saveSit = null;
    K.tsS.forEach(function(b){ b._saveSpot = null; if(b.post && b.post.tag === "save") clearPost(b); });
    logEvent("T: сейв снят — теперь "+K.sitS+", играем раунд");
    if(K.tsS[0]) voiceLog("T", "tunsave"+K.sitS, K.tsS[0].id, "теперь "+K.sitS.replace("v", " на ")+" — играем, не сейвим");
  }
  // поздно — выходим, даже если по плану ещё setup
  if(K.tt.phase === "setup" && (tick >= K.tt.execTick || K.secLeft < 35)){
    // раздел: синхронный выход по времени — команда не идёт на сайт вразнобой,
    // пока не собралась на точках сбора (иначе один уже на сайте, пока
    // остальные ещё в коридоре) — но ждём не дольше ~5с и не ждём, если время
    // раунда поджимает или флаг выключен
    var lateGrace = K.secLeft < 35 || tick - K.tt.execTick > (BAL.syncGrace||3)*TICK_HZ;
    var goNow = lateGrace;
    if(!goNow){
      var atk = bots.filter(function(b){ return b.team === "T" && b.alive && b.tRole !== "lurker" && !(b._midFlank && b._midFlank.round === roundNum); });
      var staged = atk.filter(function(b){ return b.atPost; }).length;
      var need = Math.max(1, Math.ceil(atk.length * (BAL.syncNeed||0.7)));
      goNow = staged >= need;
      if(!goNow && !K.tt._waitLog){ K.tt._waitLog = true; logEvent("T: ждём — не все на точках выхода"); }
    }
    // (тактика 30.10) критичные смоки выхода ещё не закрыли вход (идут кидать / летят / раскрываются / ищем замену) — ждём их, а не
    // «пока летят, но не дольше 5 с»: одно решение — exuGate (366). Поздно (< EXU_LATE с) — выходим и без них
    if(goNow && K.secLeft >= EXU_LATE){
      var XG = exuGate(K.tt);
      if(!XG.go){ goNow = false; if(K.tt._smWaitLog !== XG.why){ K.tt._smWaitLog = XG.why; logEvent("T: ждём — "+XG.why); exuEv("wait", null, {why:XG.why}); } }
    }
    if(goNow){
      K.tt.phase = "execute"; K.tt.execStart = tick; siteHeatPending[K.tt.site] = 1;
      exuEv("exec", null, {site:K.tt.site, late:K.secLeft < EXU_LATE});
      logEvent("T: выход на "+K.tt.site+"!"+(K.tt._waitLog ? " (все собрались)" : ""));
    }
  }
  // войс: "минус опорник на A" в сетапе — сайт сейчас слабый, заходим сразу,
  // не дожидаясь тайминга (пока CT не успели перекрыть его ротацией)
  if(K.tt.phase === "setup"){
    // только если сняли того, кто держит сам сайт (опорника или игрока прямо на
    // точке), а не первого встречного на подходах
    var ancR = K.tt.site === "A" ? "anchorA" : "anchorB";
    var pickSig = teamIntel.T.sig.filter(function(s){ return s.type === "kill" && tick - s.tick < 3*64 &&
      (s.role === ancR ? DM.hypot(s.x-K.site.x, s.y-K.site.y) < 600 : DM.hypot(s.x-K.site.x, s.y-K.site.y) < 350); })[0];
    // (v359, отметка владельца р7: TN1R снял двоих на A на 16-й с, а команда ещё ждала тайминга, и он ушёл кидать молотов на
    // Connector) раннее «не спешим» (proTempo, до 22 с) — не когда наш уже стоит на сайте: сайт взят, заходим
    var ourOnSite = bots.some(function(o){ return o.team === "T" && o.alive && (onSite(K.site, o.x, o.y) || DM.hypot(o.x-K.site.x, o.y-K.site.y) < 450); });
    if(!K.tt._fastGo && pickSig && aliveCount("T") >= 4 && (tick - roundStartTick > 22*TICK_HZ || ourOnSite) && iglTake(K.tt, pickSig.tick)){
      tFastGo(K.tt, function(){ K.tt.phase = "execute"; K.tt.execStart = tick; siteHeatPending[K.tt.site] = 1;
        voiceLog("T", "pick"+K.tt.site, "IGL", "минус на "+K.tt.site+", заходим сразу!");
        logEvent("T: выход на "+K.tt.site+"! (сняли CT на сайте)"); });
    }
  }
  if(bomb.state === "planted" && K.tt.phase !== "postplant"){ K.tt.phase = "postplant";
    // (v144) фланг через мид и охота имели смысл до планта. После планта у них
    // не было исполнителя — стояли, где оставили. Теперь все в пост-плант
    if(BAL.ppFix === true) bots.forEach(function(o){ if(o.team !== "T") return; o._midFlank = null; o._shift = null; o._egC = null;
      if(o.post && /^(endhunt|stage.*CTside)/.test(o.post.tag || "")) clearPost(o); });
  }
}

// часть tBrain (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 96–210 исходного tBrain; true — выйти из мозга
function tBrainSiteSwitch(K){
  if(!K.tt.rebound && bomb.state !== "planted" && K.secLeft > 40 && !carrierAtSite(K.tt) &&
     (K.tt.phase === "setup" || tick - (K.tt.execStart != null ? K.tt.execStart : tick) < 6*TICK_HZ)){
    var thr = function(k){
      var e = intelEstimate("T", SITES[k].x, SITES[k].y, 400, 6*TICK_HZ); // раздел 11.1: тот же радиус 400 — мид не должен читаться как сайт
      // (перекол) раньше e.n — все, кого "карта вероятностей" держит у сайта,
      // даже увиденные 20с назад в другом месте: стак "~3" из памяти → лишний
      // перекол. Теперь реальная свежая инфа (видели/слышали за 6с) + память с весом 0.35
      var fr = e.seen + e.heard, mem = Math.max(0, e.n - fr);
      freshC[k] = fr;
      return (fr + 0.35*mem) + 1.2*intelDeathsNear("T", SITES[k].x, SITES[k].y, 550, 10*TICK_HZ);
    };
    var freshC = {};
    var here = thr(K.tt.site), there = thr(K.other);
    // другой сайт — по всей памяти (свежей инфы оттуда обычно нет, но это не
    // значит, что там пусто): раньше "там" почти всегда было 0 и перекол шёл легко
    var eO = intelEstimate("T", SITES[K.other].x, SITES[K.other].y, 400, 6*TICK_HZ); there = Math.max(there, eO.n + 1.2*intelDeathsNear("T", SITES[K.other].x, SITES[K.other].y, 550, 10*TICK_HZ));
    var aliveT = bots.filter(function(b){ return b.team==="T" && b.alive; }).length;
    // обычная защита сайта — 1-2 CT; перепривязка только на явный перегруз (3+)
    // или когда на выходе уже теряем людей
    var deathsHere = intelDeathsNear("T", SITES[K.tt.site].x, SITES[K.tt.site].y, 550, 10*TICK_HZ);
    var needAlive = K.tt.phase === "setup" ? 3 : 4; // на выходе с потерями разворачиваться поздно
    // раздел 12: минус на ДРУГОМ сайте (лёркер/проба сняли там CT), а там по
    // инфе почти пусто — переходим туда и заходим, пока не перекрыли
    // (раньше хватало любого килла в 600px от сайта — и килл мидера на Top Mid
    // считался "минусом на B": перекол на B с пустым мидом вместо захода через мид)
    var ancO = K.other === "A" ? "anchorA" : "anchorB";
    // (v333, М54, отметка владельца: 2 на 3, опорника B сняли, а носитель ставил на A, где трое) поздний колл — реактивный, по
    // пикам и ротациям (docs/PRO_PLAY.md, [1]): на выходе тоже можно, и вдвоём, если на нашем сайте видно больше CT, чем нас,
    // и носитель успевает дойти до пустого сайта (путь бегом + плант + 10 с запаса). 6 с на решение и порог — проектные числа
    var lateOK = K.tt.phase === "execute" && aliveT >= 2 && here >= aliveT + 1 && bomb && bomb.state === "carried" && bomb.carrier && bomb.carrier.alive &&
      K.secLeft > pathLenTo(bomb.carrier, SITES[K.other].x, SITES[K.other].y)/SPEED + PLANT_TICKS/TICK_HZ + 10;
    var pickWin = lateOK ? 6 : 3;
    var pickOther = (K.tt.phase === "setup" || lateOK) && teamIntel.T.sig.some(function(sg){ return sg.type === "kill" && tick - sg.tick < pickWin*TICK_HZ &&
      (sg.role === ancO ? DM.hypot(sg.x-SITES[K.other].x, sg.y-SITES[K.other].y) < 600 : DM.hypot(sg.x-SITES[K.other].x, sg.y-SITES[K.other].y) < 350); });
    var poSig = pickOther ? teamIntel.T.sig.filter(function(sg){ return sg.type === "kill" && tick - sg.tick < pickWin*TICK_HZ; }).pop() : null;
    // (v440, док владельца 27.10, р10: сняли CT на B — перекол на B, а носитель стоял у A и пошёл на B через мид) и на сетапе — только если
    // носитель успевает дойти до другого сайта по пути и поставить (та же мерка, что у позднего колла) и туда не дальше, чем до своего, на 800
    // (проектное число: другой сайт — через полкарты, пока группа ждёт носителя)
    var carOK = !(bomb && bomb.state === "carried" && bomb.carrier && bomb.carrier.alive) ||
      K.secLeft > pathLenTo(bomb.carrier, SITES[K.other].x, SITES[K.other].y)/SPEED + PLANT_TICKS/TICK_HZ + 10 &&
      pathLenTo(bomb.carrier, SITES[K.other].x, SITES[K.other].y) <= pathLenTo(bomb.carrier, SITES[K.tt.site].x, SITES[K.tt.site].y) + 800;
    // (v560, В97, разбор владельца 11.11: «игрока перетягивают на B, хотя бомба не подобрана» — носитель погиб на Balcony, бомба легла на A,
    // в тот же тик «на A стак — перекол на B») бомба лежит у нашего сайта — перекол на другой не идёт: без неё там нечего делать, а нести её
    // через полкарты из-под огня — это не перекол. Сначала бомба (за ней идут — fetch), потом решение
    var bombHere = bomb && bomb.state === "dropped" && DM.hypot(bomb.x-SITES[K.tt.site].x, bomb.y-SITES[K.tt.site].y) < BOMB_HERE_R;
    if(!bombHere && pickOther && carOK && !tSiteTaking(K.tt) && aliveT >= (lateOK ? 2 : 3) && beliefCount("T", BZ.siteNear[K.other]||[]) < 0.9 && there < 1.5 && iglReads(K.tt, "po") && iglTake(K.tt, poSig ? poSig.tick : tick)){
      K.tt.rebound = true;
      voiceLog("T", "reb"+K.other, "IGL", lateOK ? "ПЕРЕКОЛЛ "+K.tt.site+" → "+K.other+": на "+K.tt.site+" их больше, на "+K.other+" сняли опорника — бомба на "+K.other+"!" : "минус на "+K.other+", там пусто — все на "+K.other+"!");
      logEvent("IGL: перекол → "+K.other+" (сняли CT, сайт пустой)");
      tSetSite(K.tt, K.other); K.tt.phase = "setup"; K.tt.execTick = tick + 3*TICK_HZ;
      return true;
    }
    // смерть своего у сайта в сетапе уже повод передумать, если там же видели 2+
    var stackRead = K.tt.phase === "setup" ? (here - there >= 1.5 && here >= 2.5) || (deathsHere >= 1 && here >= 2 && here > there)
                                         : (here - there >= 2 && (here >= 3.5 || deathsHere >= 2));
    // стак = минимум двое реально замечены/услышаны у сайта сейчас (или минус там)
    if(stackRead && (freshC[K.tt.site]||0) < 2 && deathsHere < 1) stackRead = false;
    if(!bombHere && aliveT >= needAlive && stackRead && !tSiteTaking(K.tt) && iglReads(K.tt, "st") && iglTake(K.tt, tick)){
      K.tt.rebound = true;
      logEvent("IGL: на "+K.tt.site+" стак (~"+Math.round(here)+"), перепривязка → "+K.other);
      // (v324) перекол говорится в войс — раньше был только в консоли, и в войсе потом звучало «бомба на B», хотя все шли на A
      voiceLog("T", "reb"+K.other+"st", "IGL", "ПЕРЕКОЛЛ "+K.tt.site+" → "+K.other+": на "+K.tt.site+" стак (~"+Math.round(here)+(deathsHere ? ", минус там" : "")+") — все на "+K.other+"!");
      // перекол не значит "сразу выход": группа переходит и выходит примерно по
      // исходному таймингу (минимум через 8с, чтобы успеть дойти)
      var exT = K.tt.execTick; tSetSite(K.tt, K.other); K.tt.phase = "setup"; K.tt.execTick = Math.max(tick + 8*TICK_HZ, exT - 8*TICK_HZ);
      return true; // со следующего тика мозг работает уже по новому сайту
    }
  }
  // (v282, владелец 14.10: матч 1, раунд 1, 3 на 1 — группа с бомбой у пустого A несла её через CT Spawn на B, где сидел
  // последний CT) на выходе с перевесом: до другого сайта носителю ближе и по знанию там пусто — ставим там, где стоим (PRO_PLAY: больше живых — пассивнее, тянуть время). Пороги — те же, что у перекола
  // (враг у сайта < 0,9 по карте, < 1,5 по свежей инфе); раз за раунд
  // (док 6, п.3: р3 3 на 3 — носитель в 213 от B и 1193 от A, по знанию на B 0,01, на A 0,94; правило требовало «нас больше» и не сработало,
  // носитель пошёл через карту на A) на выходе другой сайт берётся по знанию, а не по счёту: носителю туда ближе и врагов там по знанию меньше,
  // чем у нашего сайта; раз за раунд
  if(K.tt.phase === "execute" && !K.tt._exReb && bomb.state === "carried" && bomb.carrier && bomb.carrier.alive && !carrierAtSite(K.tt)){
    var crE = bomb.carrier, dHe = polyLen(pathPts(crE.x, crE.y, SITES[K.tt.site].x, SITES[K.tt.site].y, crE.z)), dOe = polyLen(pathPts(crE.x, crE.y, SITES[K.other].x, SITES[K.other].y, crE.z));
    var eOe = intelEstimate("T", SITES[K.other].x, SITES[K.other].y, 400, 6*TICK_HZ), bOe = beliefCount("T", BZ.siteNear[K.other]||[]), bHe = beliefCount("T", BZ.siteNear[K.tt.site]||[]);
    // (v519, пак 09.11 п.12; А-6: на раше в первые секунды «B пустой, бомба рядом — ставим B!») «там пусто» — по знанию команды (siteAssess, 150: каждый
    // живой CT где-то замечен, и не у того сайта), а не «по карте вероятностей меньше 0,9» — в начале раунда о CT ещё ничего не знают, и отсутствие
    // информации считалось пустым сайтом
    if(dOe < dHe && bOe < 0.9 && bOe < bHe && eOe.n < 1.5 && siteAssess("T", K.other).level === "empty" && !tSiteTaking(K.tt) && iglTake(K.tt, tick)){
      K.tt._exReb = true;
      voiceLog("T", "exreb"+K.other, "IGL", K.other+" пустой, бомба рядом — ставим "+K.other+"!");
      logEvent("IGL: на выходе перекол → "+K.other+" (носителю ближе, там пусто)");
      tSetSite(K.tt, K.other); K.tt.execStart = tick;
      return true;
    }
  }
  // (v355, владелец: «zont1x чекнул Market, Window, Short, B Site, Bench, Car — пусто, но перекола нет», 4 на 1 стояли у A)
  // (v490) другой сайт «вероятно пуст» — все живые CT недавно замечены в другом месте (siteAssess, 150; было: 2+ / 6 прочеканных зон), и носи-
  // успевает дойти и поставить: идём туда. Повод — либо CT по знанию у нашего сайта, либо носитель ближе к другому. Раз за раунд
  if(!K.tt._clrReb && bomb.state === "carried" && bomb.carrier && bomb.carrier.alive && !carrierAtSite(K.tt) && aliveCount("T") >= 2){
    var So = SITES[K.other], CR = siteAssess("T", K.other);   // (v490) «вероятно пуст» — все живые CT недавно замечены в другом месте
    if(CR.level === "empty"){
      var crC = bomb.carrier, dHc = polyLen(pathPts(crC.x, crC.y, K.site.x, K.site.y, crC.z)), dOc = polyLen(pathPts(crC.x, crC.y, So.x, So.y, crC.z));
      var bO = beliefCount("T", BZ.siteNear[K.other]||[]), bH = beliefCount("T", BZ.siteNear[K.tt.site]||[]);
      // (v432, М167, м1 Mirage р10: в 1:06 «B прочекали — пусто», хотя T знали — karrigan на B, 6 с назад убил там donk) пусто — по знанию
      // команды (beliefCount: гипотезы врагов с направлением хода, уже со смертью своего), и другой сайт по знанию не полнее нашего: у него
      // меньше ждём врагов, или столько же, а носителю туда ближе. Было: «меньше одного врага» (0,69 < 0,9) и никого не видели и не слышали
      // за 6 с — знание о karrigan (0,69 на B против 0,57 на A) не учитывалось, и перекол уводил всех на сайт, где их ждали больше
      if(bO < 0.9 && (bO < bH || (bO <= bH && dOc < dHc)) && K.secLeft > dOc/SPEED + PLANT_TICKS/TICK_HZ + 8 && !tSiteTaking(K.tt) && iglTake(K.tt, tick)){   // (22.11, Ж16) сайт берётся — доигрываем
        K.tt._clrReb = true; K.tt.rebound = true;
        // (ответ владельца 2) подтверждённо пуст (позиции и подходы проверены / закрыты) — выход и плант сразу; только вероятно пуст (все CT
        // замечены в другом месте) — переколл, но занимать осторожно: сетап (занять и прочекать сайт), выход — по таймингу
        var conf = CR.confirmed;
        voiceLog("T", "clrreb"+K.other, "IGL", "ПЕРЕКОЛЛ "+K.tt.site+" → "+K.other+": "+(conf ? K.other+" прочекали — пусто, все на "+K.other+", ставим там!" : K.other+" вероятно пустой — идём, заходим аккуратно, чекаем"));
        logEvent("IGL: "+K.other+(conf ? " прочекан и пуст" : " вероятно пуст")+" — перекол → "+K.other);
        tSetSite(K.tt, K.other); K.site = SITES[K.tt.site];
        if(conf){ K.tt.phase = "execute"; K.tt.execStart = tick; K.tt.fewGo = true; }
        else { K.tt.phase = "setup"; K.tt.execTick = tick + 4*TICK_HZ; }
        return true;
      }
    }
  }
  if(tIglReplan(K.tt, K.site, K.other, K.secLeft)) return true;
}

// часть tBrain (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 213–263 исходного tBrain
function tBrainMidTake(K){
  var MT = MAP.tactics.plays.midTake;
  if(MT && K.tt.phase === "setup" && !K.tt.midTaken && aliveCount("T") >= 4 && tick - roundStartTick > 8*TICK_HZ){
    var midKill = teamIntel.T.sig.filter(function(sg){ return sg.type === "kill" && tick - sg.tick < 3*TICK_HZ && sg.role === "mid"; })[0];
    if(midKill){
      K.tt.midTaken = tick;
      var tsM = bots.filter(function(b){ return b.team === "T" && b.alive && b.tRole !== "lurker" && !(bomb.state === "carried" && bomb.carrier === b); });
      var mp = zonePoint(MT.mid) || GEO.ctMid;
      tsM.sort(function(a, b2){ return DM.hypot(a.x-mp.x, a.y-mp.y) - DM.hypot(b2.x-mp.x, b2.y-mp.y); });
      var fl2 = tsM.slice(0, 2);
      fl2.forEach(function(b){ b._midFlank = {round:roundNum, site:K.tt.site}; b._route = null; b._routeDone = null;
        startRoute(b, MT.route, "midct"+roundNum); });
      K.tt.execTick = Math.max(tick + 18*TICK_HZ, Math.min(K.tt.execTick, tick + 30*TICK_HZ));
      voiceLog("T", "midtake", midKill.by, "мид наш! "+fl2.map(function(b){ return b.id; }).join(" и ")+" — через "+MT.via+", "+K.tt.site+" с двух сторон");
      logEvent("IGL: мид взят — заход на "+K.tt.site+" с двух сторон (через "+MT.via+")");
    }
  }
  // (v321, М11, отметка владельца) CT осталось мало (по киллфиду знают все) и нас больше — не ждём тайминга сбора:
  // заходим сразу, на тот сайт, где по нашей инфе CT нет (было: бомба ждала сбора 2 против 1 на 67-й с)
  // (v356, владелец: «4 на 1, бомба в толпе на T Ramp, не выходят на A, чего-то ждут») раньше — раз за раунд: после перекола
  // (снова сетап) правило уже не срабатывало. Теперь и повторно, если сетап затянулся за назначенное время выхода
  if(K.tt.phase === "setup" && !K.tt._fastGo && (!K.tt.fewGo || tick > (K.tt.execTick||0))){
    var aCT = aliveCount("CT"); K.aT = aliveCount("T");
    if(aCT <= 2 && K.aT > aCT){ K.tt.fewGo = true; tFastGo(K.tt, function(){
      var seenHere = intelEstimate("T", K.site.x, K.site.y, 600, 8*TICK_HZ).seen, seenOther = intelEstimate("T", SITES[K.other].x, SITES[K.other].y, 600, 8*TICK_HZ).seen;
      var was = K.tt.site;
      if(seenHere > 0 && seenOther === 0 && !tSiteTaking(K.tt)){ tSetSite(K.tt, K.other);   // (22.11, Ж16) последних видели у нас, но сайт берётся — добиваем здесь
        K.site = SITES[K.tt.site]; K.g = GEO[K.tt.site]; K.other = K.tt.site === "A" ? "B" : "A"; }
      K.tt.fewGo = true; K.tt.phase = "execute"; K.tt.execStart = tick; siteHeatPending[K.tt.site] = 1;
      voiceLog("T", "few"+roundNum, "IGL", was !== K.tt.site ? "ПЕРЕКОЛЛ "+was+" → "+K.tt.site+": их осталось "+aCT+", на "+was+" видели — заходим сейчас!"
                                                           : "их осталось "+aCT+" — заходим сейчас, бомба на "+K.tt.site+"!");
      logEvent("T: выход на "+K.tt.site+"! (CT осталось "+aCT+")"); });
    }
  }
  // (v381, М132) читаем расстановку CT по увиденному: новая картина — в войс (кто увидел — тот и говорит, команда понимает остальное)
  if(K.tt.phase === "setup" && tick % 16 === 0){ var SRd = knowSetupRead("T");
    if(SRd && SRd.n > (K.tt.setupRead ? K.tt.setupRead.n : 0)){ K.tt.setupRead = SRd;
      var sk = ["A","mid","B"].filter(function(r){ return SRd.seen[r]; }).map(function(r){ return (r === "mid" ? "на миду " : "на " + r + " ") + SRd.seen[r]; }).join(", ");
      voiceLog("T", "setup" + roundNum + "_" + SRd.n, "IGL", sk + " — похоже " + SRd.top[0] + (SRd.E.A >= SRd.E.B + 0.5 ? ", на A плотнее" : SRd.E.B >= SRd.E.A + 0.5 ? ", на B плотнее" : "")); } }
  // раздел 12: проба увидела на нашем сайте ровно одного, и по карте там больше
  // никого — "там соло, заходим" (не ждём тайминга)
  if(K.tt.phase === "setup" && tick - roundStartTick > (28)*TICK_HZ && !K.tt.soloGo && !(hashRand(roundNum*577 + matchNum*41 + 3) < 0.5)){
    var eS = intelEstimate("T", K.site.x, K.site.y, 420, 5*TICK_HZ);
    var aliveT2 = aliveCount("T");
    // (v381, М132) или по расстановке: на нашем сайте видели одного, и по увиденному в других районах там больше одного не ждут
    var srS = K.tt.setupRead && tick - roundStartTick <= 40*TICK_HZ ? K.tt.setupRead.E[K.tt.site] : null;
    if(eS.seen === 1 && (beliefCount("T", BZ.siteNear[K.tt.site]||[]) < 1.4 || srS != null && srS <= 1.2) && aliveT2 >= 4 && iglReads(K.tt, "so")){
      K.tt.soloGo = true; tFastGo(K.tt, function(){ K.tt.phase = "execute"; K.tt.execStart = tick; siteHeatPending[K.tt.site] = 1;
        voiceLog("T", "solo"+K.tt.site, "IGL", "на "+K.tt.site+" один — заходим сейчас!");
        logEvent("T: выход на "+K.tt.site+"! (по инфе там соло)"); });
    }
  }
}

// часть tBrain (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 268–300 исходного tBrain; true — выйти из мозга
function tBrainTeam(K){
  K.ts.forEach(function(b){ if(b.post && b.post.tag === "plantspot" && !b.planting && !(bomb.state === "carried" && bomb.carrier === b)) clearPost(b); });
  // ---- сейв T: раунд безнадёжен — сохранить оружие на следующий ----
  // Раньше последний T всегда шёл ставить, даже 1 против 4 за 15с до конца.
  // Про в такой ситуации прячется: винтовка на следующий раунд дороже
  // почти невозможного раунда. Не сейвят, если носитель уже на сайте (успеет
  // поставить) или сохранять нечего (пистолеты).
  if(bomb.state !== "planted" && !K.tt.saving && K.ts.length){
    var aC = aliveCount("CT"); K.aT = K.ts.length;
    var pcS = K.tt.plantGo !== roundNum+":"+K.aT+"v"+aC && tSaveWant(K.ts, K.aT, aC, K.secLeft, K.site) ? tPlantChance(K.ts, K.secLeft) : false;
    if(pcS){ K.tt.plantGo = roundNum+":"+K.aT+"v"+aC; if(pcS !== K.tt.site) tSetSite(K.tt, pcS); voiceLog("T", "tplgo"+roundNum, K.ts[0].id, pcS+" пустой — успеваем поставить, идём"); }   // (п.10, ответ 6А) реальный плант — не сейв
    else if(pcS === null && K.tt.plantGo !== roundNum+":"+K.aT+"v"+aC){
      K.tt.saving = tick; K.tt.saveSit = K.aT+"v"+aC; saveCancelTrades("T");
      logEvent("T: сейв — "+K.aT+"v"+aC+", "+Math.round(K.secLeft)+"с — сохраняем оружие");
      voiceLog("T", "tsave", K.ts[0].id, K.aT === 1 ? "я один против "+aC+" — сейвлю" : "двое на "+aC+", мало времени — сейв");
    }
  }
  // (35) T: двое против 4+, мало времени — снайпер сохраняет AWP, второй пробует
  // (v519, пак 09.11 п.22; А-15: «один тер уходит на сейв, а второй один выходит — либо оба сейвят, либо оба выходят») отдельное правило «двое против
  // 4+, < 45 с — снайпер сейвит AWP, второй пробует» убрано: сейв — решение команды (tSaveWant ниже, по доле про для расклада 2 на N)

  // (v434, PRINCIPLES М158, владелец 25.10: «сейв должен пересматриваться по ходу раунда»; м1 Mirage р11: сейв с 2 на 4, sh1ro убил двоих —
  // 2 на 2, а сейв продолжался) расклад живых сменился — то же решение заново (tSaveWant): у про при новом раскладе не сейвят — сейв снят
  if(K.tt.saving && bomb.state !== "planted"){
    K.tsS = bots.filter(function(b){ return b.team === "T" && b.alive; }), K.sitS = K.tsS.length+"v"+aliveCount("CT");
    // (00_PLAN п.10, ответ 6А) и когда появился реальный плант (tPlantChance, 180): сейв снят, при том же раскладе в этом раунде не включается
    K.plantGo = tPlantChance(K.tsS, K.secLeft);
    if(!K.plantGo && (K.sitS === K.tt.saveSit || tSaveWant(K.tsS, K.tsS.length, aliveCount("CT"), K.secLeft, K.site))){ K.tt.saveSit = K.sitS; tSaveHold(); return true; }
    if(K.plantGo){ K.tt.plantGo = roundNum+":"+K.sitS; if(K.plantGo !== K.tt.site) tSetSite(K.tt, K.plantGo); voiceLog("T", "tplgo"+roundNum, K.tsS[0].id, K.plantGo+" пустой — успеваем поставить, идём"); }
    K.tt.saving = 0; K.tt.saveSit = null;
    K.tsS.forEach(function(b){ b._saveSpot = null; if(b.post && b.post.tag === "save") clearPost(b); });
    logEvent("T: сейв снят — теперь "+K.sitS+", играем раунд");
    if(K.tsS[0]) voiceLog("T", "tunsave"+K.sitS, K.tsS[0].id, "теперь "+K.sitS.replace("v", " на ")+" — играем, не сейвим");
  }
}

// часть tBrain (Р3.2 команда, разрезание в прежнем порядке) — операторы строк 305–355 исходного tBrain
function tBrainBomb(K){
  if(bomb.state !== "dropped"){ K.tt.fetchId = null; K.tt.fetchCover = null; K.ts.forEach(function(b){ if(b.post && (b.post.tag === "fetch" || b.post.tag === "fetchCover")) clearPost(b); }); }
  // (док 6, п.18: р12 donk в 0:10,8 пошёл за бомбой — до неё 12,2 с, потом до A ещё 1597 ед.: поставить было невозможно) за бомбой идут, только
  // если успеть: дойти до бомбы, донести до ближнего сайта и поставить до конца раунда (бег — SPEED). Не успеть — бомбу не поднимают
  K.fetchOk = function(b){ var Bk = bomb._toSite || (bomb._toSite = {});
    var key = Math.round(bomb.x)+","+Math.round(bomb.y); if(Bk.k !== key){ Bk.k = key; Bk.d = Math.min(polyLen(pathPts(bomb.x, bomb.y, SITES.A.x, SITES.A.y, bomb.z)), polyLen(pathPts(bomb.x, bomb.y, SITES.B.x, SITES.B.y, bomb.z))); }
    return (pathLenTo(b, bomb.x, bomb.y) + Bk.d)/SPEED + PLANT_TICKS/TICK_HZ <= K.secLeft; };
  if(bomb.state === "dropped" && !K.ts.some(K.fetchOk)){ if(K.tt.fetchId){ K.tt.fetchId = null; K.tt.fetchCover = null; K.ts.forEach(function(b){ if(b.post && (b.post.tag === "fetch" || b.post.tag === "fetchCover")) clearPost(b); }); } }
  else if(bomb.state === "dropped"){
    var bd = Infinity;
    // кто пошёл за бомбой — тот и идёт, пока жив (раньше каждый тик выбирался
    // ближайший, и двое попеременно получали то "за бомбой", то свою точку)
    var prevF = K.tt.fetchId && K.ts.filter(function(b){ return b.id === K.tt.fetchId; })[0];
    if(prevF){ bd = -1; K.fetcher = prevF;
      // (v286, И26) прикрывающий уже стоит у бомбы, а сборщик ещё далеко (> 350 px — «рядом свой») — меняются: поднимает тот,
      // кто рядом (раньше прикрывающий стоял в 120 px от бомбы десятки секунд и ждал сборщика)
      var FC0 = K.tt.fetchCover, cv0 = FC0 && FC0.id && FC0.round === roundNum ? K.ts.filter(function(o){ return o.id === FC0.id; })[0] : null;
      if(cv0 && cv0.tRole !== "lurker" && DM.hypot(cv0.x-FC0.pt.x, cv0.y-FC0.pt.y) < 60 && DM.hypot(prevF.x-bomb.x, prevF.y-bomb.y) > 350 &&
         DM.hypot(cv0.x-bomb.x, cv0.y-bomb.y) < DM.hypot(prevF.x-bomb.x, prevF.y-bomb.y)){
        K.fetcher = cv0; if(prevF.post && prevF.post.tag === "fetch") clearPost(prevF); }
    }
    K.ts.forEach(function(b){
      if(bd < 0 || !K.fetchOk(b)) return;
      if(b.tRole==="lurker" && K.ts.length > 2) return; // лёркер за бомбой — только когда нас мало
      // тот же приоритет по ролям: энтри и AWP за бомбой идут, только если сильно ближе
      var d = DM.hypot(b.baseX-bomb.x, b.baseY-bomb.y) + ((b.tRole==="entry"||b.tRole==="awp") ? 250 : 0);
      if(d < bd){ bd = d; K.fetcher = b; }
    });
    if(K.fetcher){ K.tt.fetchId = K.fetcher.id;
      // (v286, И26) сборщик бомбы — не проба: старая проба снимается (раньше проба на B каждые 6–9 с выдёргивала его от бомбы)
      if(K.fetcher._probe && K.fetcher._probe.round === roundNum){ K.fetcher._probe = null; K.fetcher._probeLock = 0; }
      // (v269, пункт 2) за бомбой — не в одиночку: бомба лежит там, где убили носителя, — под тем же стрелком. У ботов 27 из
      // 159 смертей T «один» (нет своего в 350 px) были по дороге за бомбой; у про в одиночку гибнут 20 % T (у ботов 49 %),
      // а смерть рядом со своим разменивают в 27 % (у ботов 33 %). Ближайший к сборщику T (не лёркер, ≤ 500 px — как напарник
      // пробы) прикрывает: встаёт на линии сборщик→бомба в 150 px от бомбы (как напарник пробы) и смотрит туда же
      var FC = K.tt.fetchCover;
      if(!FC || FC.round !== roundNum || FC.fid !== K.fetcher.id || FC.bx !== bomb.x || FC.by !== bomb.y){
        var cands = K.ts.filter(function(o){ return o !== K.fetcher && o.alive && o.tRole !== "lurker" && !o.planting && DM.hypot(o.x-K.fetcher.x, o.y-K.fetcher.y) < 500; })
          .sort(function(a, c){ return DM.hypot(a.x-K.fetcher.x, a.y-K.fetcher.y) - DM.hypot(c.x-K.fetcher.x, c.y-K.fetcher.y); });
        var lnF = DM.hypot(K.fetcher.x-bomb.x, K.fetcher.y-bomb.y) || 1, backF = Math.min(150, lnF*0.6);
        FC = K.tt.fetchCover = {round: roundNum, fid: K.fetcher.id, bx: bomb.x, by: bomb.y, id: cands[0] ? cands[0].id : null,
          pt: walk({x: bomb.x + (K.fetcher.x-bomb.x)/lnF*backF, y: bomb.y + (K.fetcher.y-bomb.y)/lnF*backF})};
      }
      var cov = FC.id ? K.ts.filter(function(o){ return o.id === FC.id && o.alive; })[0] : null;
      if(cov && cov._probe && cov._probe.round === roundNum){ cov._probe = null; cov._probeLock = 0; } // прикрывающий — тоже не проба
      if(cov && !cov._sawEnemy && !tradeGoing(cov)){ setPost(cov, FC.pt, {x:bomb.x, y:bomb.y}, true, "fetchCover"); cov._probeLock = tick; }
      // к бомбе — когда прикрывающий рядом (350 px — «рядом свой» в замерах); до того сборщик идёт к точке прикрытия.
      // Нет прикрывающего (рядом никого) — идёт один, как раньше
      var withCov = !cov || DM.hypot(cov.x-K.fetcher.x, cov.y-K.fetcher.y) <= 350;
      setPost(K.fetcher, withCov ? {x:bomb.x, y:bomb.y} : FC.pt, withCov ? null : {x:bomb.x, y:bomb.y}, false, "fetch");
    }
  }
}

// часть tBrain (Р3.2 команда, разрезание в прежнем порядке) — ветка строк 396–588 исходного tBrain
function tBrainSetup(K){
  if(K.lurker) lurkerBrain(K.lurker, K.tt, K.other);
    // (v440, док владельца 27.10: «дефолт сравнить с про»; «энтри свою роль не играл») фаза дефолта — у всех тактик с долгим сетапом, и у
    // тактик-«дефолтов» тоже: раньше их группы с первой секунды шли к точке выхода (Connector, Apps) — на 25–50-й с у ботов 0,86 игрока на
    // A Site / Cross / Connector против 0,06 у про (демки Mirage, раунды с поздним плантом). Энтри — у своей цели (у про в дефолте перед A —
    // T Ramp 0,63 игрока), а не у другого сайта: раньше энтри стоял на B в выходе на A и шёл через карту / за лайнапом
    var inDef = K.tt.defUntil && tick < K.tt.defUntil && tick < K.tt.execTick - K.tt.needT*TICK_HZ;
    if(inDef){
      // дефолт: лёркер — у другого сайта (lurkerBrain), остальные — по местам про (ниже)
      if(!K.tt._defLog){ K.tt._defLog = true; logEvent("T: сначала дефолт, "+K.tac.name+" — позже"); }
      // (снайпер — с группой у цели, мид держит поддержка: AWP на миде в дефолте
      // у ботов был первой жертвой в 19% раундов, у про — 4%)
      // (v443, док владельца 27.10 «дефолт сравнить с про») места — из демок (MAP.defaultpos, tools/map/defpos_bake.py): сколько T в среднем
      // в каждой зоне на 20–50-й с раундов с выходом на этот сайт. Раньше трое шли к точке подготовки цели: на Mirage B — 2,1 игрока
      // в T Apps / Stove / B Apartments против 1,1 у про, на миде 1,0 против 1,9. Зоны — жребий раз на раунд по этим долям (без
      // повтора); ближняя к цели — энтри, дальше IGL, AWP, поддержка; взгляд — на ближайший к зоне вход (A, B или мид)
      var DEF_SPAWN_FRAC = 0.3;   // (v519) проектное число
      var DPS = ((MAP.defaultpos || {}).sites || {})[K.tt.site], dm = K.pick(["entry","igl","awp","support"]);
      if(DPS && DPS.length){
        // (v450, док владельца 28.10 №5: «выход через Палас — в Палас никто не пошёл», «Рамп + Палас, а заходят через Рампу и Коннектор»,
        // «тактика одна, а игроки делают другое») места дефолта — по долям про, но в районе своей группы тактики: зона про, ближняя
        // (≤ DEF_GROUP_R) к пути или точке подготовки группы (G.via, G.stage; мид — TMID). У группы нет таких зон — встаёт на точку подготовки
        // группы. Раньше зоны выпадали жребием по всей карте — группа Паласа стояла на миде, и потом шла в Палас через карту и врагов
        // (v570, отметка владельца м1 р4 38 с: «подобрав бомбу, пошёл в Палас дефолт, а не переколил на B, хотя знал, что там стак») после
        // перекола на другой сайт группы тактики (пути к старому сайту — Рамп, Палас) — уже не район места: место дефолта — по долям про
        // у нового сайта. И выбор мест (_defZ) — заново под новый сайт: было — раз на раунд, и после перекола A → B носитель шёл в Палас
        var gOf = function(b){ var r = null; if(K.tac.site && K.tac.site !== K.tt.site) return null; (K.tac.groups || []).forEach(function(G){ if(!r && G.roles.indexOf(b.tRole) >= 0) r = G; }); return r; };
        var laneOf = function(G){ var V = G.via || [], si = G.stage ? V.indexOf(G.stage) : -1; return si >= 0 ? V.slice(0, si + 1) : V.concat(G.stage ? [G.stage] : []); };
        var gPts = function(G){ var P = [];
          if(!G) return P;
          if(G.stage === "TMID"){ var tm = K.tt.tMidPt || GEO.tMid; if(tm) P.push(tm); return P; }
          // (22.11, Ж15, разбор м5 р3: игрок Palace получил дефолт у Tetris — путь группы Palace кончается Pillars / Palace Exit у сайта A, рядом
          // с выходом Ramp) район группы на дефолте — своя дорожка ДО стадии: что после стадии — уже выход, там дорожки групп сходятся у сайта.
          // Было: все точки пути группы
          laneOf(G).forEach(function(n){ var q = zonePoint(n, SITES[K.tt.site]); if(q) P.push(q); });
          return P; };
        var defPick = function(b, used, seed){ var P = gPts(gOf(b));
          // (п.28 владельца 29.10, м1 р8: группа Ramp получила места Mid Boxes / Chair / Connector — по прямой ≤ 450 сквозь стены) район
          // группы — по пути, а не по прямой
          // (Г4, 04.11, владелец: «дефолт играется сразу, на спавне так долго не стоят — возможно, в демках раунды-паузы») зона своего
          // спавна — не место дефолта (в defaultpos.json у сайта A — 0,27 игрока; проверить данные на ПК — 00_PLAN)
          var spZ = zoneIdAt(T_SPAWN.x, T_SPAWN.y);
          // (v519, пак 09.11 п.21; А-24: «многие якоря рядом с T-спавном — их не должно быть») доли про — где T БЫЛИ на 20–50 с, в том числе
          // проходя мимо спавна; место дефолта — не ближе DEF_SPAWN_FRAC пути от спавна T до цели (Mirage: T Spawn 4 %, Side Alley 11–14 %,
          // Apps Ramp 19–25 %, Palace Entry 21–26 %, T Roof 27–34 % — места прохода)
          var spL = polyLen(pathPts(T_SPAWN.x, T_SPAWN.y, SITES[K.tt.site].x, SITES[K.tt.site].y));
          var pool = DPS.filter(function(z){ var q = zonePoint(z[0]); return q && !used[z[0]] && zoneIdAt(q.x, q.y) !== spZ && polyLen(pathPts(T_SPAWN.x, T_SPAWN.y, q.x, q.y)) >= DEF_SPAWN_FRAC*spL && (!P.length || P.some(function(p){ return DM.hypot(p.x-q.x, p.y-q.y) <= DEF_GROUP_R && polyLen(pathPts(p.x, p.y, q.x, q.y)) <= DEF_GROUP_R; })); });
          if(!pool.length) return null;
          var wt = pool.reduce(function(a, z){ return a + z[1]; }, 0), u = hashRand(seed)*wt, di = 0;
          while(di < pool.length - 1 && u > pool[di][1]){ u -= pool[di][1]; di++; }
          return pool[di][0]; };
        if(!K.tt._defZ || K.tt._defZ.n !== dm.length || K.tt._defZ.site !== K.tt.site){
          K.used = {}; var ch = {};
          dm.forEach(function(b, dk){ ch[b.id] = defPick(b, K.used, roundNum*733 + matchNum*91 + dk*17 + 5); if(ch[b.id]) K.used[ch[b.id]] = 1; });
          K.tt._defZ = {n: dm.length, z: ch, site: K.tt.site};
        }
        // (Г3, 04.11, пп. 27/29 и ответ владельца: «в реальности нет таймера — место меняют по ситуации, по геймсенсу») смена места дефолта
        // через DEF_STAND (13 с стояния) убрана: место меняется по событиям — контакт (350), перестановки (470/480), план IGL (160)
        dm.forEach(function(b){
          var zn0 = K.tt._defZ.z[b.id], G0 = gOf(b), P = gPts(G0), tgt = SITES[K.tt.site];
          // (22.11, Ж15, владелец: «путь в якорь в Паласе — с T-спавна в Palace Entry, Palace, потом Palace Exit, а не через рампу, через врагов»)
          // к месту дефолта — по дорожке своей группы до стадии (последовательность зон тактики, маршрут 110: пост роли — его конец). Было:
          // маршрут группы на дефолте не запускался (`if(!tt.defUntil)` ниже), к месту — кратчайшим путём (якорь у Palace Exit — через T Ramp)
          if(G0 && G0.stage !== "TMID") startRoute(b, laneOf(G0), K.tac.id + ":lane:" + K.tt.site);
          var Zp = zn0 ? zonePoint(zn0, P[P.length-1] || tgt) : (P[P.length-1] || null), tag = zn0 ? "default:"+zn0 : "default:group";
          if(!Zp) return;
          var lk = [GEO.A.tEntry, GEO.B.tEntry, GEO.tMidLook].filter(Boolean).sort(function(a, c){ return DM.hypot(a.x-Zp.x, a.y-Zp.y) - DM.hypot(c.x-Zp.x, c.y-Zp.y); })[0];
          // (v519, А-27: «не должно быть якорей в полностью открытых местах» — стоял в центре мида под Short, Connector, Window) место — укрытое
          // от сторон CT (мид CT, сайты), видеть вход — как было
          groupPost([b], Zp, lk, tag, {team: "T", rMax:160, minGap:50, see:[lk], zone: zn0 ? zoneIdAt(Zp.x, Zp.y) : null, hideFrom:[GEO.ctMid, GEO.A.anchor, GEO.B.anchor].filter(Boolean)});   // (Г4, п.13: «default:Side Alley» стоял на T Spawn)
        });
      } else {
        groupPost(K.pick(["support"]), K.tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", K.midOpt);
        stagePost(K.pick(["entry","igl","awp"]), K.tt.site);
      }
    } else if(K.tac.groups && K.tac.style !== "fake" && K.tt.site !== K.tac.site){   // (v365) фейк — своя ветка ниже
      // (этап 2, P1-1) сайт плана сменили: точки подготовки и маршруты групп тактики — под старый сайт (Donut, A Hall…).
      // Раньше группа ставилась на них и с новым сайтом (тег stageB:Donut у A): ждала на старой точке. Теперь — стандартная
      // подготовка нового сайта; мид (TMID) — как был
      var memAll = [];
      K.tac.groups.forEach(function(G){ var mem = K.pick(G.roles); if(!mem.length) return;
        if(G.stage === "TMID"){ mem.forEach(function(b){ b._stageInfo = null; }); groupPost(mem, K.tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", K.midOpt); return; }
        mem.forEach(function(b){ if(memAll.indexOf(b) < 0) memAll.push(b); }); });
      stagePost(memAll, K.tt.site);
    } else if(K.tac.groups && K.tac.style !== "fake"){
      // (00_PLAN, пакет тактики, ответ владельца 1 от 04.11: «сплит, игрок группы погиб до выхода — продолжить (оставшийся держит позицию),
      // ждать или отменить; оставшийся не обязан идти вместо погибшего — держать пространство или к основной группе; мало времени — группой»)
      // основная группа — та, где больше ролей; в другой группе погиб свой — решение один раз за раунд: мало времени (EXU_LATE) — к основной;
      // оставшиеся на своей точке и без контакта — держат её (сплит продолжается); иначе — к основной. Ключевая граната погибшего — exuBackup (366)
      var gMain = 0; K.tac.groups.forEach(function(G, gi){ if(G.roles.length > K.tac.groups[gMain].roles.length) gMain = gi; });
      var GN = K.tt._gN && K.tt._gN.r === roundNum ? K.tt._gN : (K.tt._gN = {r: roundNum, n: {}, dec: {}});
      K.tac.groups.forEach(function(G, gi){
        var mem = K.pick(G.roles);
        if(GN.n[gi] == null) GN.n[gi] = mem.length;
        if(!mem.length) return;
        if(gi !== gMain && mem.length < GN.n[gi] && K.tt.phase === "setup"){
          if(!GN.dec[gi]){ var hold = mem.every(function(b){ return b.atPost && !b._sawEnemy && b.post && /^stage/.test(b.post.tag); });
            GN.dec[gi] = (K.secLeft < EXU_LATE || !hold) ? "merge" : "hold";
            voiceLog("T", "splitdec"+gi+roundNum, mem[0].id, GN.dec[gi] === "merge" ? "своего сняли — сплит отменяем, иду к основной" : "своего сняли — держу здесь, отвлекаю ротацию");
            logEvent("T: сплит — в группе «"+(G.stage || "?")+"» погиб свой — "+(GN.dec[gi] === "merge" ? "к основной группе" : "держат позицию")); }
          if(GN.dec[gi] === "merge"){ var GM = K.tac.groups[gMain], spM = GM.stage ? (zonePoint(GM.stage, K.g.tStage) || K.g.tStage) : K.g.tStage, lkM = GM.look ? (zonePoint(GM.look, spM) || K.g.tEntry) : K.g.tEntry;
            mem.forEach(function(b){ b._route = null; b._stageInfo = {from:spM, to:lkM, look: GM.look ? SITES[K.tt.site] : K.g.anchor, round:roundNum}; });
            groupPost(mem, spM, lkM, "stage"+K.tt.site+(GM.stage ? ":"+GM.stage : ""), {team: "T", rMax:200, minGap:50, hideFrom:[SITES[K.tt.site], lkM], see:[lkM]});
            return; }
        }
        // после дефолта маршрут "от спавна" уже не нужен — идут к своей точке кратчайшим путём
        if(!K.tt.defUntil) mem.forEach(function(b){ startRoute(b, G.via, K.tac.id+":"+gi); });
        if(G.stage === "TMID"){ mem.forEach(function(b){ b._stageInfo = null; }); groupPost(mem, K.tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", K.midOpt); return; }
        var sp = G.stage ? (zonePoint(G.stage, K.g.tStage) || K.g.tStage) : K.g.tStage;
        var lk = G.look ? (zonePoint(G.look, sp) || K.g.tEntry) : K.g.tEntry;
        var tag = "stage"+K.tt.site+(G.stage ? ":"+G.stage : "");
        mem.forEach(function(b){ b._stageInfo = {from:sp, to:lk, look: G.look ? SITES[K.tt.site] : K.g.anchor, round:roundNum}; });
        groupPost(mem, sp, lk, tag, {team: "T", rMax:200, minGap:50, hideFrom:[SITES[K.tt.site], lk], see:[lk]});
      });
    } else if(K.tac.style === "exec"){
      stagePost(K.pick(["entry","awp","igl"]), K.tt.site);
      groupPost(K.pick(["support"]), K.tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", K.midOpt);            // контроль мида
    } else if(K.tac.style === "default"){
      // дефолт: растягиваем CT — двое у другого сайта, AWP на миде, носитель у цели
      stagePost(K.pick(["entry","support"]), K.other);
      groupPost(K.pick(["awp"]), K.tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", K.midOpt);
      stagePost(K.pick(["igl"]), K.tt.site);
    } else if(K.tac.style === "split"){
      stagePost(K.pick(["entry","igl"]), K.tt.site);
      groupPost(K.pick(["awp","support"]), K.tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", K.midOpt);
    } else if(K.tac.style === "fake"){
      // раздел 12: фейк-выход. Основная группа тихо ждёт у настоящего сайта;
      // поддержка за ~14с до выхода громко "заходит" на другой сайт — бежит к
      // его входу, показывается, кидает смок/флешку (лёркер и так там же) —
      // чтобы CT перетянули туда ротацию. Потом настоящий выход, а фейкеры
      // догоняют второй волной.
      var fk = K.tac.fake, gf = GEO[fk];
      stagePost(K.pick(["entry","awp","igl"]), K.tt.site);
      var fakers = K.pick(["support"]);
      // копим факт "видели опорника у фейкового сайта" пока не поздно — читать
      // фейк можно только если реально знаем, что там кто-то БЫЛ
      if(!K.tt._fakeCtSeen && intelEstimate("T", gf.anchor.x, gf.anchor.y, 550, 4*TICK_HZ).n > 0) K.tt._fakeCtSeen = tick;
      if(tick < K.tt.execTick - 14*TICK_HZ){
        stagePost(fakers, fk);
      } else {
        if(!K.tt.fakeOn){ K.tt.fakeOn = tick;
          logEvent("T: фейк на "+fk+" — шумим и кидаем гранаты, выход на "+K.tt.site);
          if(fakers[0]) voiceLog("T", "fake"+fk, fakers[0].id, "делаю фейк на "+fk+", вы ждите на "+K.tt.site); }
        var fakeDied = teamIntel.T.sig.some(function(sg){ return sg.type === "died" && tick - sg.tick < 10*TICK_HZ && DM.hypot(sg.x-gf.tEntry.x, sg.y-gf.tEntry.y) < 450; });
        if(fakeDied){ stagePost(fakers, fk); if(!K.tt._fakeHoldLog){ K.tt._fakeHoldLog = true; logEvent("T: на фейке сняли своего — второй не лезет туда же, держит"); } }
        else groupPost(fakers, gf.tEntry, gf.anchor, "fake"+fk, {team: "T", rMax:120, minGap:40, see:[gf.anchor]});
        // раздел 13: "купились ли CT на фейк" — IGL примерно оценивает это по
        // своей же инфе (не телепатия): опорник фейкового сайта, которого
        // фейкеры видели вначале, пропал из поля зрения/по последней инфе
        // (beliefLast+CLEARZ) — похоже, ушёл ротой на настоящий сайт. Читается один
        // раз за фейк, не каждый тик, и не идеально (IGL может ошибиться).
        if(!K.tt._fakeRead && tick - K.tt.fakeOn > 5*TICK_HZ && tick - K.tt.fakeOn < 16*TICK_HZ){
          var fkZ = zoneIdAt(gf.anchor.x, gf.anchor.y);
          var sawCtAtFakeEarly = !!K.tt._fakeCtSeen;
          var clearedNow = fkZ && CLEARZ.T[fkZ] && CLEARZ.T[fkZ].tick > K.tt.fakeOn;
          var stillThere = intelEstimate("T", gf.anchor.x, gf.anchor.y, 450, 5*TICK_HZ).n > 0;
          // "не видно" ≠ "ушёл" — читаем "пусто" только если кто-то из фейкеров
          // реально смотрит туда прямо сейчас (иначе просто не в курсе, а не
          // "точно знаем, что там пусто")
          var watchingNow = K.ts.some(function(o){ return o.alive && (DM.hypot(o.x-gf.anchor.x, o.y-gf.anchor.y) < 380 || (DM.hypot(o.x-gf.anchor.x, o.y-gf.anchor.y) < 600 && hasVision(o.x, o.y, gf.anchor.x, gf.anchor.y))); });
          if(sawCtAtFakeEarly && watchingNow && (clearedNow || !stillThere)){
            K.tt._fakeRead = tick;
            var save = Math.min(8*TICK_HZ, Math.max(0, K.tt.execTick - tick - 4*TICK_HZ));
            if(save > 0){
              K.tt.execTick -= save;
              logEvent("IGL: фейк на "+fk+" сработал — опорник ушёл, ускоряем выход на "+K.tt.site);
              voiceLog("T", "fakeworked", "IGL", "они купились, идём на "+K.tt.site+" раньше");
            }
          } else if(sawCtAtFakeEarly && stillThere && tick - K.tt.fakeOn > 10*TICK_HZ){
            K.tt._fakeRead = tick;
            // (v561, этап 3 docs/tasks/PLAN_TACTICS_V2.md; PRO_PLAY §6з: «фейк не поверили — не ждать бесконечно, фейк может стать настоящим
            // выходом») на фейке — один держит, а на нашем сайте команда знает двоих и больше: фейк становится выходом на сайт фейка (перекол), если
            // бомба не лежит у нашего сайта и время есть; иначе — по плану
            var hereN = siteAssess("T", K.tt.site).near, fkN = siteAssess("T", fk).near;
            if(hereN >= 2 && fkN <= 1 && K.secLeft > 35 && !(bomb.state === "dropped" && DM.hypot(bomb.x-SITES[K.tt.site].x, bomb.y-SITES[K.tt.site].y) < BOMB_HERE_R)){
              var trvF = DM.hypot(SITES[fk].x - SITES[K.tt.site].x, SITES[fk].y - SITES[K.tt.site].y)*1.2/SPEED;
              tSetSite(K.tt, fk); K.tt.phase = "setup"; K.tt.execTick = tick + Math.round(Math.min(trvF*0.8, 12)*TICK_HZ);
              logEvent("IGL: на "+fk+" не купились, но там один, а у нас их "+hereN+" — фейк становится выходом на "+fk);
              voiceLog("T", "fakereal", "IGL", "на "+fk+" один и не уходит, у нас их "+hereN+" — заходим на "+fk);
            } else logEvent("IGL: на "+fk+" не купились — держит место, играем по плану");
          }
        }
      }
    }
    tProbes(K.tt, K.ts);
    K.ts.forEach(function(b){
      var MF = b._midFlank; if(!MF || MF.round !== roundNum || b === K.fetcher) return; // за бомбой — не на фланг (посты перебивали друг друга каждый тик)
      var CS = MAP.tactics.plays.midTake.ctSide[K.tt.site === "A" ? "A" : "B"];   // куда выходят на стороне CT и куда смотрят
      var st = zonePoint(CS.stage, SITES[K.tt.site]);
      var lk = zonePoint(CS.look, st) || SITES[K.tt.site];
      if(st) setPost(b, pickSpots("midflank"+K.tt.site, st, 2, {team: "T", rMax:150, minGap:40, see:[lk], hideFrom:[SITES[K.tt.site]]})[fl2idx(b)], lk, true, "stage"+K.tt.site+":CTside");
    });
}

// часть tBrain (Р3.2 команда, разрезание в прежнем порядке) — ветка строк 588–850 исходного tBrain
function tBrainExecute(K){
  if(K.lurker) lurkerBrain(K.lurker, K.tt, K.other);
    var since = tick - (K.tt.execStart != null ? K.tt.execStart : tick);   // (v380) выход с тика 0 (раш в 1-м раунде матча): 0 — тоже время, не «нет»
    var DELAY = {entry:0, awp:40, support:20, igl:90};
    // раздел 12: две волны. Первая — энтри (+поддержка сразу за ним на трейд,
    // AWP на линии) берёт первый контакт; вторая — IGL и носитель бомбы —
    // заходит на уже зачищенное: через ~0.75с после первого контакта/размена
    // первой волны или через 4.5с, если контакта так и не было. Раш — все сразу.
    var rush = K.tac.style === "rush";
    if(rush && K.tac.rushVia && tick - roundStartTick < 4*TICK_HZ) K.ts.forEach(function(b){ if(b.tRole !== "lurker") startRoute(b, K.tac.rushVia, K.tac.id); });
    if(!rush && !K.tt.wave2){
      var w1 = K.ts.filter(function(b){ return b.tRole === "entry" || b.tRole === "support" || b.tRole === "awp"; });
      var contact = w1.some(function(b){ return b._sawEnemy; }) ||
        teamIntel.T.sig.some(function(sg){ return (sg.type === "kill" || sg.type === "died") && sg.tick >= (K.tt.execStart != null ? K.tt.execStart : 0); });
      if(contact && !K.tt.w1Contact) K.tt.w1Contact = tick;
      if((K.tt.w1Contact && tick - K.tt.w1Contact > 48) || since > 4.5*TICK_HZ || K.ts.length <= 2){
        K.tt.wave2 = tick; logEvent("T: вторая волна заходит на "+K.tt.site+(K.tt.w1Contact ? " (после первого контакта)" : ""));
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
      var S0 = SITES[K.tt.site], gE = GEO[K.tt.site], ents = gE ? [gE.tEntry].concat(entryPts(K.tt.site) || []).filter(Boolean) : [];
      var atExit = ents.some(function(q){ return DM.hypot(b.x-q.x, b.y-q.y) <= UTIL_AT_ENTRY; });
      // (v363, владелец: «до гранат на сайт не выходили, а то в чём смысл гранат») гранаты ждёт каждый, кто стоит у выхода на сайт
      // (не только энтри): у про 75 % смоков выхода встают до того, как первый T зашёл на сайт (демки Mirage, 774 раунда с
      // плантом; флешки — 52 %: их кидают под заход, их не ждут). Размен вдвоём — по-прежнему только энтри
      var secW = ROUND_TIME_SEC - (simTime - roundStartTime);
      if(!S0 || !atExit || b.nadeTask || b._utilWDone === roundNum || secW < UTIL_MIN_LEFT){ b._utilW = null; return false; }   // (v353) за раунд ждёт один раз
      // (тактика 30.10) и критичный смок выхода, который ещё не встал (идут кидать / летит / раскрывается — 366), а не только граната в воздухе
      // (Г3, 04.11, разбор отметок п.30: T0 и T3 ждали «смок выхода» у T1, который уже стоял на сайте, — exuGate в тот момент: можно) ждать ли
      // гранаты выхода — одно решение, exuGate (366: критичные смоки — назначен / летит / раскрывается / не вышел, замена). Убраны вторые
      // правила здесь: «свой несёт лайнап «(выход, …)»» (v349) и «любой смок T в воздухе у сайта»
      var inAir = !exuGate(K.tt).go;
      var mate = b.tRole !== "entry" || K.ts.some(function(o){ return o !== b && o.alive && o.tRole !== "lurker" && nearP(o.x, o.y, o.z, b.x, b.y, b.z, TRADE_R); });
      // (v555, отметка владельца м300 р3: «ждёт гранаты, когда он один») размен ждать не от кого — живых своих нет (кроме лёрка): не ждёт
      var anyMate = K.ts.some(function(o){ return o !== b && o.alive && o.tRole !== "lurker"; });
      if(!inAir && (mate || !anyMate)){ b._utilW = null; return false; }
      if(!mate && !inAir && !(b._utilW && b._utilW.round === roundNum)) voiceLog("T", "tradewait"+b.id+roundNum, b.id, "жду, выходим вдвоём");
      // (v349, отметка владельца: donk ждал на выходе с T Ramp на виду у NiKo — бой начинался раньше гранат) ждёт в ближайшем
      // укрытии (≤ 150 ед.: не видно с сайта, опорника и входа CT), а не там, где застала проверка
      if(!b._utilW || b._utilW.round !== roundNum){ var g0 = GEO[K.tt.site], hf = [S0, g0 && g0.anchor, g0 && g0.ctEntry].filter(Boolean);
        // (v353, владелец: «донк ждёт там, где его могут убить со Stairs») укрытие — и от мест, где CT держат этот сайт (pos.ctHold/ctSecond)
        var PC = POS[K.tt.site] || {}; (PC.ctHold || []).concat(PC.ctSecond || []).forEach(function(n){ var zp = zonePoint(n, S0); if(zp) hf.push(zp); });
        // (v350) там, где стоит, его не видно — ждёт на месте; видно — в ближайшее укрытие до 80 ед. (было 150 — отходил далеко)
        var seen = hf.some(function(q){ return hasLOS(b.x, b.y, q.x, q.y, b.z); });
        var cov = seen ? pickSpots("utilw"+Math.round(b.x/30)+","+Math.round(b.y/30)+K.tt.site, {x:b.x, y:b.y}, 1, {team: "T", rMax:80, minGap:20, hideFrom:hf})[0] : null;
        if(cov && hf.some(function(q){ return hasLOS(cov.x, cov.y, q.x, q.y); })) cov = null;
        b._utilW = {round: roundNum, t: tick, x: cov ? cov.x : b.x, y: cov ? cov.y : b.y}; }
      // (v485) предел UTIL_WAIT — и для критичного смока: без предела (v481) носитель дольше висел «ждать гранаты ↔ ставить» (прогон 133,
      // Ancient: tug с utilWait 8,7 → 12,1 на 100 раундов, «plantspot → utilWait → plantspot» 3,0). Ждёт ли команда смоков — решает exuGate
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
        // (тактика 30.10) флешка уже летит — ждёт хлопка (когда — знает физика броска: etaDet), а не уходит по 3 с, пока она в воздухе
        var popped = nadeFlags.peekFlashPop && tick - nadeFlags.peekFlashPop >= 0;
        var flying = nadesInAir.some(function(n){ return n.team === "T" && n.type === "flash" && n.why === "под пик"; });
        return popped || (since > 3*TICK_HZ && !flying);
      }
      if(!rush && (b.tRole === "igl" || (b === carrier && b.tRole !== "entry"))) return !!K.tt.wave2;
      return since >= (DELAY[b.tRole] !== undefined ? DELAY[b.tRole] : 60);
    };
    if(carrier && carrier.alive && !carrier.planting && ready(carrier)){
      // выбор точки — когда носитель уже на подходе к сайту (по ситуации в этот момент)
      if(!K.tt.plantPick && DM.hypot(carrier.x-K.site.x, carrier.y-K.site.y) < 500) choosePlant(K.tt);
      // (v272, пункт 3, просьба владельца 13.10) с бомбой на плант — не в одиночку (как за бомбой — fetchCover): рядом нет
      // своего, который тоже заходит (≤ TRADE_R), — ближайший свой не на сайте и не в бою идёт к носителю и заходит с ним
      // (войс), носитель ждёт его. Идёт один, только если своих нет, все уже на сайте (идёт к ним) или время поджимает
      // (дойти + поставить + 5 с запаса — проектное число). У про носитель за 10 с до планта один (нет своего ≤350 px)
      // 5 % времени, у ботов v269 — 13–16 % (88 демок; tools/measure/audit/carrier_plant.py)
      var ppt = K.tt.plantPick ? K.tt.plantPick.pt : K.plantPt;
      var cm = K.ts.filter(function(o){ return o !== carrier && o.alive && o.tRole !== "lurker"; });
      var cLeft = ROUND_TIME_SEC - (tick - roundStartTick)/TICK_HZ, cWalk = polyLen(pathPts(carrier.x, carrier.y, ppt.x, ppt.y, carrier.z))/SPEED + PLANT_TICKS/TICK_HZ + 5;
      var BE = K.tt.bombEsc && K.tt.bombEsc.round === roundNum && K.tt.bombEsc.cid === carrier.id ? K.tt.bombEsc : null;
      // (п.21 владельца 29.10, м1 р5 т37570: «почему бы не отложить выход… пока игрок 2 не сможет выйти с паласа, чтобы сыграть вдвоём» —
      // TN1R у огня в Palace увидел врага, и magixx в тот же тик пошёл ставить один) назначенный сопровождающий в бою — всё ещё сопровождающий:
      // носитель ждёт его в пределах того же времени ожидания / ESC_MAX_SEC (раньше бой снимал сопровождение сразу)
      var esc = BE ? cm.filter(function(o){ return o.id === BE.id && !o.planting; })[0] : null;
      if(!esc && !cm.some(function(o){ return ready(o) && nearP(o.x, o.y, o.z, carrier.x, carrier.y, carrier.z, TRADE_R); }) && cLeft >= cWalk){
        esc = cm.filter(function(o){ return !o._sawEnemy && !o.planting && !o.nadeTask && !tradeGoing(o) && !(tick < taskKeepUntil(o, "repos")) && DM.hypot(o.x-ppt.x, o.y-ppt.y) > 350; })
          .sort(function(a, c){ return DM.hypot(a.x-carrier.x, a.y-carrier.y) - DM.hypot(c.x-carrier.x, c.y-carrier.y); })[0] || null;
        // (v342, отметка владельца: magixx с бомбой ждал у B «сопровождение» с A — через всю карту) сопровождающий — не дальше
        // ESC_MAX_SEC бега до носителя; иначе носитель идёт ставить сам
        if(esc && pathLenTo(esc, carrier.x, carrier.y)/SPEED > ESC_MAX_SEC) esc = null;
        if(esc){ BE = K.tt.bombEsc = {round: roundNum, cid: carrier.id, id: esc.id, since: tick}; voiceLog("T", "besc"+carrier.id, esc.id, "иду к бомбе — "+carrier.id+", заходим вместе"); }
      }
      // (v342) ждать сопровождение — не дольше времени по ситуации (ниже) и только если он не дальше ESC_MAX_SEC бега (проверка каждые 0,5 с;
      // проектные числа: в демках про — только доля «носитель один», 5 %)
      // (v359, отметка владельца: magixx с бомбой ждал на T Ramp ~10 с, сопровождающий кидал лайнап, а на A уже никого) сайт по
      // знанию пуст (на сайте и у него < 0,5 CT по карте команды) или сопровождающий занят гранатой — не ждём, идём ставить
      if(esc && (beliefCount("T", BZ.siteNear[K.tt.site]||[]) < 0.5 || esc.nadeTask)) esc = null;
      if(esc && BE){ if(BE.since == null) BE.since = tick;
        if(tick - (BE.lenT || -1e9) >= 32){ BE.lenT = tick; BE.far = pathLenTo(esc, carrier.x, carrier.y)/SPEED > ESC_MAX_SEC; }
        // (00_PLAN, пакет тактики, ответ владельца 10 от 04.11: «не 8 с для всех: рядом 1,5–2,5; сопровождающий в бою 2–3; опасный проход
        // 2–3,5; ждём гранаты 3–4,5; 8 с — только при явном «держим»») сколько ждать — по ситуации, середины диапазонов (проектные числа ответа)
        var escW = !exuGate(K.tt).go ? 3.75 : siteAssess("T", K.tt.site).near >= 1 ? 2.75 : esc._sawEnemy ? 2.5 : 2.0;
        if(BE.far || tick - BE.since > escW*TICK_HZ) esc = null; }
      if(esc && cLeft >= cWalk){
        var lnE = DM.hypot(ppt.x-carrier.x, ppt.y-carrier.y) || 1, ePt = walk({x: carrier.x + (ppt.x-carrier.x)/lnE*Math.min(90, lnE), y: carrier.y + (ppt.y-carrier.y)/lnE*Math.min(90, lnE)});
        if(!(esc.post && esc.post.tag === "bombEscort" && DM.hypot(postSrc(esc).x-ePt.x, postSrc(esc).y-ePt.y) < 80)) setPost(esc, ePt, K.g.ctEntry, true, "bombEscort");
        else postKeep(esc);
        esc._probeLock = tick;
        if(nearP(esc.x, esc.y, esc.z, carrier.x, carrier.y, carrier.z, TRADE_R)) setPost(carrier, ppt, K.g.ctEntry, true, "plantspot");   // (v532) напарник рядом — по пути
        else if(carrier.post && carrier.post.tag === "bombWait") postKeep(carrier);
        else setPost(carrier, {x:carrier.x, y:carrier.y}, esc, true, "bombWait");
      } else setPost(carrier, ppt, K.g.ctEntry, true, "plantspot");
    }
    // (п.4 владельца 29.10, м1 р2: «перекол на другой сайт, но туда идут не все») носитель ещё не готов ставить (ждёт вторую волну), а
    // поста нет — после перекола пост старого сайта снят (tSetSite): к точке подготовки нового сайта, как остальные (раньше 3,5 с стоял)
    else if(carrier && carrier.alive && !carrier.planting && !carrier.post) stagePost([carrier], K.tt.site);
    var rest = K.pick(["entry","awp","support","igl"]).filter(function(b){ return b !== carrier && ready(b); });
    // (v350, владелец: «все останавливаются далеко») раш: кто без задачи (поддержка, IGL; AWP без лайнапа) — идёт за энтри и держится
    // позади него (60–110 ед., проектные числа), а не стоит на месте сбора; энтри ждёт гранаты — ждут за ним
    if(rush){ var eB = K.ts.filter(function(o){ return o.tRole === "entry" && o.alive; })[0];
      if(eB) K.ts.forEach(function(o){ if(o === eB || !o.alive || (o === carrier && DM.hypot(o.x-K.site.x, o.y-K.site.y) < 450) || o.tRole === "lurker" || o.nadeTask || o._sawEnemy || (o.post && !taskProp(o.post.tag, "rushFollowable"))) return;   // (v368) носитель — тоже за энтри, в группе, пока не у сайта   // (v352) и пост маршрута — иначе вставал на старой точке маршрута
        var dx = o.x-eB.x, dy = o.y-eB.y, dl = DM.hypot(dx, dy) || 1, k = Math.min(110, Math.max(60, dl));
        var fp = walk({x: eB.x + dx/dl*k, y: eB.y + dy/dl*k});
        // (v353, владелец: «тнир бежит и умирает, а донк ждёт») энтри ждёт — остальные стоят за ним (маршрут раша на паузе)
        if(eB.post && eB.post.tag === "utilWait"){
          if(o.post && o.post.tag === "utilHold" && DM.hypot(postSrc(o).x-eB.x, postSrc(o).y-eB.y) < 160) return;
          var hfF = [SITES[K.tt.site], GEO[K.tt.site].anchor, GEO[K.tt.site].ctEntry].filter(Boolean), PCf = POS[K.tt.site] || {};
          (PCf.ctHold || []).concat(PCf.ctSecond || []).forEach(function(n){ var zp = zonePoint(n, SITES[K.tt.site]); if(zp) hfF.push(zp); });
          var hp = pickSpots("uhold"+o.id+Math.round(fp.x/30)+","+Math.round(fp.y/30), fp, 1, {team: "T", rMax:90, minGap:24, hideFrom:hfF})[0];
          if(hp && hfF.some(function(q){ return hasLOS(hp.x, hp.y, q.x, q.y); })) hp = null;
          setPost(o, hp || fp, SITES[K.tt.site], true, "utilHold"); return; }   // за энтри — в укрытии от мест CT (v353)
        if(o.post && o.post.tag === "rushFollow" && DM.hypot(postSrc(o).x-fp.x, postSrc(o).y-fp.y) < 40) return;   // не дёргать путь каждый тик; (v570) сверка — с точкой задачи (src): пост, сдвинутый раздвиганием на 80, «далеко» всегда — путь ставился каждый тик
        if(o.post && taskProp(o.post.tag, "onRoute") && o._route && o._route.pts[o._route.idx] && DM.hypot(o.post.x-o._route.pts[o._route.idx].x, o.post.y-o._route.pts[o._route.idx].y) < 40) return;   // идёт по маршруту к текущей точке
        setPost(o, fp, SITES[K.tt.site], true, "rushFollow"); }); }
    // (S5) ставят — двое ближних прикрывают подходы к ставящему под разными углами
    if(carrier && carrier.alive && (carrier.planting || (carrier.post && carrier.post.tag === "plantspot" && DM.hypot(carrier.x-carrier.post.x, carrier.y-carrier.post.y) < 90))){
      // (v409, владелец 22.10: «coverplant очень часто меняется, бегают по всему сайту») точки искались каждый тик вокруг того места, где
      // ставящий сейчас (он шёл — набор точек менялся), а какая кому — по тому, кто сейчас ближе (порядок переворачивался — менялись
      // местами): м1 р1 Mirage — ≈ 40 смен точки у двоих за 10 с. Теперь центр — точка планта (не сам ставящий), точки выбираются
      // один раз, кто взял — держит до конца прикрытия; второго добирают, только если прикрывающих меньше двух
      var cp0 = carrier.planting ? {x:carrier.baseX, y:carrier.baseY} : {x:carrier.post.x, y:carrier.post.y};
      var CV = K.tt._cov; if(!CV || CV.round !== roundNum || DM.hypot(CV.x-cp0.x, CV.y-cp0.y) > 90) CV = K.tt._cov = {round:roundNum, x:cp0.x, y:cp0.y, by:{}};
      // (v521, отметка владельца 10.11 м200 р1: двое T стояли на Tetris, пока sh1ro ставил, — «могут пройти в сайт и занять позицию») прикрытие
      // планта — той же системой, что пост-плант (holdGroup): все, кто рядом с точкой планта, видят её и держат разные входы (неизвестный
      // враг может прийти любым — HOLD.anyW, знание сверху). Было: двое ближних на два заданных входа (вход CT, место опорника)
      var okCov = function(b){ return !b._sawEnemy && DM.hypot(b.x-CV.x, b.y-CV.y) < 550 && !tradeGoing(b); };
      var covs = rest.filter(okCov);
      if(covs.length) holdGroup(covs, {key:"cp"+K.tt.site+Math.round(CV.x/30)+","+Math.round(CV.y/30), center:{x:CV.x, y:CV.y}, rArea:320, rMin:60, rMax:420, must:[{x:CV.x, y:CV.y}], anyFrom:true}, "coverplant");
      if(covs.length && !K.tt._covVoice){ K.tt._covVoice = tick; voiceLog("T", "covplant", covs[0].id, "ставь, прикрываю"+(covs[1] ? " с "+covs[1].id : "")); }
      rest = rest.filter(function(b){ return covs.indexOf(b) < 0; });
    }
    K.ts.forEach(function(b){
      if(!K.isMF(b) || b === carrier || b.planting || b === K.fetcher) return; // за бомбой — не держать сайт (раньше посты чередовались и он стоял)
      var bestN = null, bdd = Infinity;
      POS[K.tt.site].tClear.forEach(function(n){ var zp = zonePoint(n, b); if(!zp) return; var d = DM.hypot(zp.x-b.x, zp.y-b.y); if(d < bdd){ bdd = d; bestN = n; } });
      var fp = bestN ? namedSpot(bestN, b, {team: "T", see:[K.g.tEntry, K.plantPt], key:"mf"+K.tt.site}) : K.plantPt;
      setPost(b, fp, K.plantPt, true, "sitehold"+K.tt.site+":CT-"+(bestN||""));
    });
    // раздел 12: "байт и трейд" — пока энтри лезет в первый угол, поддержка не
    // бежит на сайт рядом с ним, а стоит у входа с прицелом туда же: убьют
    // энтри — стрелок уже виден ей и она сразу разменивает
    var entryB = K.ts.filter(function(b){ return b.tRole === "entry"; })[0];
    if(!rush && entryB && !entryB.atPost && since < 5*TICK_HZ){
      rest.filter(function(b){ return b.tRole === "support" && !(b._stageInfo && b._stageInfo.round === roundNum && DM.hypot(b._stageInfo.from.x-K.g.tStage.x, b._stageInfo.from.y-K.g.tStage.y) > 250); }).forEach(function(b){ setPost(b, K.g.tEntry, K.g.anchor, true, "trade"+K.tt.site, 1); rest = rest.filter(function(o){ return o !== b; }); });
    }
    // занять сайт: энтри, поддержка и IGL — каждый на свою названную позицию
    // (Back Site, Triple Box, 90, Second Lane…), ближайшую к тому, откуда он зашёл
    // кто ждал выхода на своей точке с другой стороны (Donut, Dark, CT Lane…) —
    // тоже занимает ближние к себе позиции сайта, а не бежит к стандартному входу
    var sideT = rest.filter(function(b){ var SI = b._stageInfo; return SI && SI.round === roundNum && DM.hypot(SI.from.x-K.g.tStage.x, SI.from.y-K.g.tStage.y) > 250; });
    // (v469, п.1 владельца 29.10, р2 м1: sh1ro с MAC-10 получал «AWP линия») снайпер без AWP — обычный игрок захода: линия AWP — только с AWP
    var takers = rest.filter(function(b){ var r = K.roleT(b); return r==="entry" || r==="support" || r==="igl" || (r==="awp" && b.primary!=="AWP") || sideT.indexOf(b) >= 0; });
    rest = rest.filter(function(b){ return sideT.indexOf(b) < 0; });
    // распределять точки — когда смоки выхода уже встали (≤1.5с) — чтобы
    // занимать места, которые дым закрывает от CT
    var smokeUp = smokes.some(function(sm){ return DM.hypot(sm.x-K.g.ctEntry.x, sm.y-K.g.ctEntry.y) < 300 || DM.hypot(sm.x-K.site.x, sm.y-K.site.y) < 320; });
    if(takers.length && (smokeUp || since > 1.5*TICK_HZ || rush)){
      if(!K.tt.takeAssign) K.tt.takeAssign = {};
      K.used = {};
      Object.keys(K.tt.takeAssign).forEach(function(id){ K.used[K.tt.takeAssign[id]] = true; });
      takers.forEach(function(b){
        var nm = K.tt.takeAssign[b.id];
        if(!nm){
          var best = null, bd = Infinity;
          POS[K.tt.site].tClear.forEach(function(n){ if(K.used[n]) return; var zp = zonePoint(n, K.site); if(!zp) return;
            var d = DM.hypot(zp.x-b.x, zp.y-b.y);
            // точка, которую смок закрывает от входа CT/опорника, — "занимаем под смок"
            if(smokeUp && (smokeBlocks(zp.x, zp.y, K.g.ctEntry.x, K.g.ctEntry.y) || smokeBlocks(zp.x, zp.y, K.g.anchor.x, K.g.anchor.y))) d -= 260;
            if(d < bd){ bd = d; best = n; } });
          nm = best; if(nm){ K.tt.takeAssign[b.id] = nm; K.used[nm] = true;
            if(smokeUp && !K.tt._smokeTakeLog){ K.tt._smokeTakeLog = true; logEvent("T: смоки встали — занимают позиции под смоком ("+nm+")"); } }
        }
        var tp = nm ? namedSpot(nm, K.site, {team: "T", see:[K.g.ctEntry], key:"take"+K.tt.site}) : null;
        // энтри чистит углы по очереди: ближний угол → следующий от него, на
        // каждом короткий чек (~0.5с); чисто — колл "чекнул X — пусто" и дальше
        if(b.tRole === "entry" && !rush){
          var C = b._clr;
          if(!C || C.round !== roundNum || C.site !== K.tt.site){
            var left = POS[K.tt.site].tClear.slice(), from = {x:b.x, y:b.y}, list = [];
            while(left.length && list.length < 3){
              var bi = -1, bdd = Infinity;
              left.forEach(function(n, i){ var zp = zonePoint(n, K.site); if(!zp) return; var dd = DM.hypot(zp.x-from.x, zp.y-from.y); if(dd < bdd){ bdd = dd; bi = i; } });
              if(bi < 0) break; var nn = left.splice(bi, 1)[0]; list.push(nn); from = zonePoint(nn, K.site) || from;
            }
            C = b._clr = {round:roundNum, site:K.tt.site, list:list, i:0, arr:0};
          }
          if(C.list.length){
            var cur = C.list[Math.min(C.i, C.list.length-1)];
            var cp = namedSpot(cur, K.site, {team: "T", see:[K.g.ctEntry], key:"clr"+K.tt.site});
            var nxt = C.list[C.i+1] ? zonePoint(C.list[C.i+1], K.site) : null;
            if(cp){
              if(b.atPost && b.post && b.post.tag === "clear"+K.tt.site+":"+cur && C.i < C.list.length){
                if(!C.arr) C.arr = tick;
                if(tick - C.arr > 32 && !b._sawEnemy){ markClear("T", cp.x, cp.y, b.id); C.i++; C.arr = 0; }
              }
              setPost(b, cp, nxt || K.g.ctEntry, true, "clear"+K.tt.site+":"+cur);
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
            var cz = zonePoint(nm, K.site), dC = cz ? DM.hypot(cz.x-K.g.ctEntry.x, cz.y-K.g.ctEntry.y) : 0, nx2 = null, bn = Infinity;
            var pool = (POS[K.tt.site].tClear || []).concat(POS[K.tt.site].tPost || []).filter(function(n, i, a){ return a.indexOf(n) === i; });
            if(cz) pool.forEach(function(n){ if(K.used[n] || n === nm) return; var zp = zonePoint(n, K.site); if(!zp) return;
              if(DM.hypot(zp.x-K.g.ctEntry.x, zp.y-K.g.ctEntry.y) > dC - TAKE_STEP) return; var dz = DM.hypot(zp.x-cz.x, zp.y-cz.y); if(dz > TAKE_REACH) return;
              if(dz < bn){ bn = dz; nx2 = n; } });
            if(nx2){ delete K.used[nm]; K.used[nx2] = true; K.tt.takeAssign[b.id] = nx2; voiceLog("T", "adv"+b.id+nx2+roundNum, b.id, "чисто, иду "+calloutName(zonePoint(nx2, K.site).x, zonePoint(nx2, K.site).y)); nm = nx2;
              tp = namedSpot(nm, K.site, {team: "T", see:[K.g.ctEntry], key:"take"+K.tt.site}); b._takeAt = {nm:nm, round:roundNum, arr:0}; }
            else TA.arr = tick + 10*TICK_HZ;   // глубже некуда — держит
          }
        }
        if(tp) setPost(b, tp, K.g.ctEntry, true, (b.tRole === "entry" ? "clear" : "sitehold")+K.tt.site+":"+nm);
        else groupPost([b], K.plantPt, K.g.ctEntry, "sitehold"+K.tt.site, {team: "T", rMin:40, rMax:210, minGap:60, see:[K.g.ctEntry]});
      });
    }
    groupPost(rest.filter(function(b){ return b.tRole==="awp" && b.primary==="AWP"; }), K.g.tEntry, K.g.ctEntry, "awpline"+K.tt.site, {team: "T", rMax:130, minGap:50, see:[K.g.ctEntry, K.plantPt]});
}

// часть tBrain (Р3.2 команда, разрезание в прежнем порядке) — ветка строк 850–1075 исходного tBrain; true — выйти из мозга
function tBrainPostplant(K){
  var gs = GEO[bomb.site];
    // прочь от бомбы (радиус взрыва убивает и своих). (v373, сторож: на Ancient T с постом «flee» за 2 с до взрыва ещё в зоне —
    // 60 раз на 100 раундов) раньше все уходили за 6 с, кто бы где ни стоял; у про последний раз в 520 px от бомбы — медиана за
    // 5,9 с до взрыва (демки Ancient, 1194 игрока). Теперь каждый — когда до своей точки ухода идти столько, сколько осталось,
    // + запас 2 с (проектное число), но не позже 6 с
    var leftS = bombTimeLeftTicks()/TICK_HZ, defusingNow = bots.some(function(o){ return o.defusing; });
    // (v519, пак 09.11 п.13; Р-17: «частое перебитие путей flee и postplant») решил уходить — уходит до взрыва (защёлка b._flee), точка ухода —
    // одна (b._fleePt), а не пересчёт каждый тик: «оставшийся путь / скорость + 2 с» убывал, пока бот шёл, и он возвращался на пост-плант.
    // Снимает уход только событие — начали дефуз (анти-дефуз важнее)
    var fleeKey = roundNum + ":" + bomb.plantTick;
    // (v530, отметка владельца 10.11: «игрока 0 уводит далеко от бомбы, хотя он знает, что рядом враг» — уход за 18,7 с до взрыва при CT в 58 px
    // от бомбы) пока CT, о котором команда знает (видели / слышали ≤ 10 с — как «свежая позиция» в pathDanger), успевает дойти от того места
    // и дефузнуть (с китом — кита у врага игрок не видит, считает худшее), бомбу не бросают: уйти — отдать раунд
    var BLf = kvLast("T"), ctCanDefuse = false;
    for(var fid in BLf){ var fq = BLf[fid], fo = teamBot(fid); if(!fo || !fo.alive || fo.team !== "CT" || tick - fq.tick > 10*TICK_HZ) continue;
      if(polyLen(pathPts(fq.x, fq.y, bomb.x, bomb.y, fo.z, bomb.z))/SPEED + DEFUSE_KIT_TICKS/TICK_HZ < leftS){ ctCanDefuse = true; break; } }
    if(ctCanDefuse) K.ts.forEach(function(b){ b._flee = null; if(b.post && b.post.tag === "flee") clearPost(b); });
    var fleeing = (defusingNow || ctCanDefuse) ? [] : K.ts.filter(function(b){ if(b.planting) return false;
      if(b._flee === fleeKey) return true;
      var fp = bombFleePoint(b) || gs.tStage;
      if(leftS < 6 || leftS < pathLenTo(b, fp.x, fp.y)/(SPEED*weaponSpeedMul(b)) + 2){ b._flee = fleeKey; b._fleePt = fp; return true; }
      return false; });
    if(defusingNow) K.ts.forEach(function(b){ b._flee = null; });
    if(fleeing.length){
      if(!K.tt.fleeLogged){ K.tt.fleeLogged = true; logEvent("T: уходим от бомбы — сейчас рванёт"); }
      fleeing.forEach(function(b){ setPost(b, b._fleePt || gs.tStage, {x:bomb.x, y:bomb.y}, true, "flee"); });
      K.ts = K.ts.filter(function(b){ return fleeing.indexOf(b) < 0; });
      if(!K.ts.length) return true;
    }
    // решили "не успеваем на дефуз — сейв": держим сейв, пока кто-то дефузит
    // (если дефуз оборвался — фейк/убили — через 2с снова играем бомбу)
    if(K.tt._defLate){
      if(bots.some(function(o){ return o.defusing && o.alive; })) K.tt._defLateSeen = tick;
      if(tick - (K.tt._defLateSeen || K.tt._defLate) > 2*TICK_HZ) K.tt._defLate = null;
      else { K.ts.forEach(function(b){ if(!b._saveSpot) b._saveSpot = pickSaveSpotT(b); if(!b.planting) setPost(b, b._saveSpot, null, true, "save"); }); return true; }
    }
    var antiDef = [], dfGo = false;
    defuseContTick();
    // (v296, владелец 14.10: «фейк-дефуз и обычный — его туда-сюда перенаправляет», отметка: раунд 1, тик 5848 — T2 за 10 тиков
    // «на время» → «на бомбу» → «на время» → «сейв») одно решение на одну попытку дефуза: кто пошёл на бомбу — идёт, пока дефуз
    // идёт, и ещё 2 с после того, как он стих (выглядывает на бомбу, а не разворачивается); «не успеваем — сейв» держит блок выше
    var dfNow = bots.filter(function(o){ return o.defusing && o.alive; })[0], AC = K.tt._adCommit;
    if(AC && (AC.round !== roundNum || (!dfNow && tick - AC.last > 2*TICK_HZ))) AC = K.tt._adCommit = null;
    if(AC){ if(dfNow) AC.last = tick;
      antiDef = K.ts.filter(function(b){ return AC.ids.indexOf(b.id) >= 0 && !b.planting; });
      var bpC = {x:bomb.x, y:bomb.y};
      antiDef.forEach(function(b){
        // (v353, отметка владельца: TN1R «слышит, что не фейк, но не идёт сбивать» — стоял на точке, откуда бомбу закрывает ящик)
        // пришёл на точку, дефуз идёт, а дефузера не видно 0,5 с — идёт прямо на бомбу
        var AS = b._adSpot && b._adSpot.round === roundNum ? b._adSpot : null;
        if(AS && b.atPost && dfNow && !b._sawEnemy){ if(!AS.arr) AS.arr = tick; else if(tick - AS.arr > 32 && !AS.push){ AS.push = true; AS.pt = bpC; voiceLog("T", "adpush"+b.id+roundNum, b.id, "отсюда бомбу не видно — иду прямо на дефуз"); } }
        setPost(b, AS ? AS.pt : bpC, bpC, true, "antidefuse"); b._stopPlantUntil = tick + 30; });
    } else
    if((dfGo = tDefuseGo(K.tt, K.ts))){
      var bpA = {x:bomb.x, y:bomb.y};
      // байт-пик: на первый звук выглядывает один (tDefuseBaiter), остальные держат свои места (120: tDefuseGo)
      antiDef = dfGo === "bait" ? K.ts.filter(function(b){ return b.id === K.tt._baiter && !b.planting; }) : K.ts.filter(function(b){ return !b.planting && DM.hypot(b.x-bpA.x, b.y-bpA.y) < 1100; });
      if(dfGo === "bait" && antiDef.length && K.tt._baitV !== K.tt._baitH0){ K.tt._baitV = K.tt._baitH0; voiceLog("T", "bait"+K.tt._baitH0, antiDef[0].id, "звук дефуза — выгляну проверить, прикройте"); }
      // (S6) не успеть — не бежать на троих: сколько осталось дефузить (кит
      // не знаем — считаем, что есть, если у CT был фулл-бай), и сколько бежать
      var dfz = bots.filter(function(o){ return o.defusing && o.alive; })[0];
      var remT = dfz ? Math.max(0, (dfz.defuseUntil||tick) - tick) : 0;
      if(dfz && !(dfz.defuseUntil) ) remT = (teamEco.CT.roundType === "full" ? DEFUSE_KIT_TICKS : DEFUSE_TICKS);
      // (п.17 владельца 29.10, м1 р4 т30711: «могли пикнуть через зону B Short, откуда отлично видно бомбу, и убить дефузера издалека») успеть —
      // дойти до первой точки по пути, откуда бомбу видно (оттуда и стреляют), а не до самой бомбы
      var late = antiDef.filter(function(b){ return bombSightLen(b, bpA)/SPEED*TICK_HZ > remT + 24; });
      if(dfz && late.length === antiDef.length && late.length && !K.tt._defLate){
        K.tt._defLate = tick;
        voiceLog("T", "deflate", late[0].id, "не успеваем на дефуз — сейв");
        late.forEach(function(b){ if(!b._saveSpot) b._saveSpot = pickSaveSpotT(b); setPost(b, b._saveSpot, null, true, "save"); b._stopPlantUntil = 0; });
        antiDef = [];
      } else if(dfz) antiDef = antiDef.filter(function(b){ return late.indexOf(b) < 0; });
      var spA = pickSpots("antidef"+Math.round(bpA.x/30)+","+Math.round(bpA.y/30), bpA, 4, {team: "T", rMin:50, rMax:300, minGap:45, must:[bpA]});
      // (п.16 владельца 29.10, м1 р4 т30561: «они оба стоят в одной позиции») каждый — ближайшая к себе из точек, которую ещё не занял свой
      var adUsed = antiDef.filter(function(o){ return o._adSpot && o._adSpot.round === roundNum; }).map(function(o){ return o._adSpot.pt; });
      antiDef.forEach(function(b){
        if(!b._adSpot || b._adSpot.round !== roundNum){
          var bs2 = null, bd2 = Infinity; spA.forEach(function(q){ if(adUsed.some(function(u){ return u.x === q.x && u.y === q.y; })) return; var d = DM.hypot(q.x-b.x, q.y-b.y); if(d < bd2){ bd2 = d; bs2 = q; } });
          if(bs2) adUsed.push(bs2);
          b._adSpot = {round:roundNum, pt: bs2 || bpA};
        }
        // (v555) с ножом на дефузящего (knifeDefuseTick, 450) — точка сбить дефуз — сам дефузящий, а не точка с видом на бомбу
        var kD = b._knife && b._knDef ? bots.filter(function(o){ return o.id === b._knDef && o.alive && o.defusing; })[0] : null;
        setPost(b, kD ? {x:kD.x, y:kD.y} : b._adSpot.pt, kD || bpA, true, "antidefuse"); b._stopPlantUntil = tick + 30; // бегом, не шагом
      });
      if(dfGo === "all" && antiDef.length && K.tt._adVoice !== roundNum){ K.tt._adVoice = roundNum; voiceLog("T", "antidef", antiDef[0].id, "дефузят! все на бомбу!"); }
      // байт — не обязательство: проверяющий не держится за бомбу после звука (снимется с решением «фейк»); все — до конца дефуза (как было)
      if(antiDef.length && dfGo === "all") K.tt._adCommit = {round:roundNum, ids:antiDef.map(function(b){ return b.id; }), last:tick};
    }
    if(K.lurker && antiDef.indexOf(K.lurker) < 0) lurkerBrain(K.lurker, K.tt, K.other);
    var group = K.pick(["entry","awp","support","igl"]).filter(function(b){ return antiDef.indexOf(b) < 0; });
    // лёркер, оставшийся последним (уже не лёркер), — тоже на пост-плант, а не стоит где поставил
    if(!K.lurker) group = group.concat(K.ts.filter(function(b){ return b.tRole === "lurker" && antiDef.indexOf(b) < 0 && group.indexOf(b) < 0 && !b.planting; }));
    // CT ушли в сейв и времени много — пара T идёт выбивать оружие
    // CT не идут на ретейк: после планта прошло 15с+, у бомбы и на подходах их
    // не видели и не слышали 10с, и их меньше нас — похоже на сейв
    var ctNearB = intelEstimate("T", bomb.x, bomb.y, 1200, 10*TICK_HZ);
    var ctSaving = tick - bomb.plantTick > 15*TICK_HZ && (ctNearB.seen + ctNearB.heard) === 0 && aliveCount("CT") < K.ts.length;
    if(ctSaving && bombTimeLeftTicks() > 12*TICK_HZ){
      var hunters = group.filter(function(b){ return b.tRole==="entry" || b.tRole==="support"; });
      // где CT вероятнее всего прячутся: раньше было всего 2-3 фиксированные
      // точки вокруг спавна — хантеры весь раунд бегали туда-обратно между
      // одними и теми же двумя углами. Теперь набираем 5-7 точек по всей
      // стороне CT (как в pickSaveSpot — по навмешу, подальше от бомбы и от
      // сайтов), и обходят их методично: не туда, где уже недавно смотрел
      // кто-то из своих, и не туда же, куда уже идёт другой хантер.
      if(!K.tt.huntPts || K.tt.huntPts.round !== roundNum){
        var cand = [];
        NAVAREAS.forEach(function(z, i){
          if(i % 2) return;
          if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
          var c = zoneCentroid(z);
          if(insideSolidWall(c.x, c.y)) return;
          if(DM.hypot(c.x-bomb.x, c.y-bomb.y) < 500) return; // не отходят от бомбы слишком далеко в другую сторону
          var dSite = Math.min(DM.hypot(c.x-SITES.A.x, c.y-SITES.A.y), DM.hypot(c.x-SITES.B.x, c.y-SITES.B.y));
          if(dSite < 350) return; // сам сайт не проверяем — это не "у CT-спавна"
          cand.push({x:c.x, y:c.y, dCT:DM.hypot(c.x-CT_SPAWN.x, c.y-CT_SPAWN.y)});
        });
        cand.sort(function(a, c2){ return a.dCT - c2.dCT; });
        // (v442, док владельца 27.10: «охота на последних — как будто рандомные точки, а не где была инфа») сначала — где по знанию команды
        // могут быть живые CT (гипотезы знания, тяжёлые первыми; точки на сайте — тоже, это и есть «где была инфа»); потом — места у спавна CT
        var minGap = 280, pts = [];
        var kn = []; bots.forEach(function(o){ if(o.team === "CT" && o.alive) knowEnemySpots("T", o.id).forEach(function(q){ if(q.w >= 0.05) kn.push(q); }); });
        kn.sort(function(a, c2){ return c2.w - a.w; });
        kn.forEach(function(q){ if(pts.length < 5 && !insideSolidWall(q.x, q.y) && pts.every(function(p){ return DM.hypot(p.x-q.x, p.y-q.y) > minGap; })) pts.push({x:q.x, y:q.y}); });
        if(pts.every(function(p){ return DM.hypot(p.x-CT_SPAWN.x, p.y-CT_SPAWN.y) > minGap; })) pts.push({x:CT_SPAWN.x, y:CT_SPAWN.y});
        for(var ci=0; ci<cand.length && pts.length<7; ci++){
          var c = cand[ci];
          if(pts.every(function(p){ return DM.hypot(p.x-c.x, p.y-c.y) > minGap; })) pts.push({x:c.x, y:c.y});
        }
        K.tt.huntPts = pts; K.tt.huntPts.round = roundNum; K.tt._huntSeen = {};
      }
      var pickNext = function(b, avoid){
        // методичный обход: сперва ближайшая ещё НЕ проверенная точка (не та,
        // куда уже идёт другой хантер); когда все проверены — начинаем заново
        var free = function(list){ return list.filter(function(hi){ return avoid.indexOf(hi) < 0; }); };
        var unvisited = free(K.tt.huntPts.map(function(hp, hi){ return hi; }).filter(function(hi){ return K.tt._huntSeen[hi] === undefined; }));
        if(!unvisited.length){ K.tt._huntSeen = {}; unvisited = free(K.tt.huntPts.map(function(hp, hi){ return hi; })); }
        var best = -1, bd = Infinity;
        unvisited.forEach(function(hi){ var hp = K.tt.huntPts[hi]; var d = DM.hypot(hp.x-b.x, hp.y-b.y); if(d < bd){ bd = d; best = hi; } });
        return best >= 0 ? best : 0;
      };
      hunters.forEach(function(b, hi){
        var taken = hunters.filter(function(o){ return o !== b && o._huntIdx !== undefined; }).map(function(o){ return o._huntIdx; });
        if(b._huntIdx === undefined){ b._huntIdx = pickNext(b, taken); b._huntStart = tick; }
        // не дошёл за 12с (точка недостижима/далеко) — следующая
        if(!b.atPost && tick - (b._huntStart||tick) > 12*TICK_HZ){ b._huntIdx = pickNext(b, taken); b._huntStart = tick; }
        if(b.atPost && b.post && b.post.tag === "hunt"){
          if(!b._huntArrive){ b._huntArrive = tick; K.tt._huntSeen[b._huntIdx] = tick; }
          if(tick - b._huntArrive > 90){ b._huntIdx = pickNext(b, taken); b._huntArrive = 0; b._huntStart = tick; }
        }
        var hp = K.tt.huntPts[b._huntIdx];
        setPost(b, hp, bomb ? {x:bomb.x, y:bomb.y} : null, true, "hunt");
      });
      if(hunters.length && !K.tt.huntLogged){ K.tt.huntLogged = true; logEvent("T: CT сейвят — "+hunters.map(function(h){return h.id;}).join(", ")+" идут выбивать оружие"); }
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
    if(group.length === 1 && aliveCount("CT") >= 1 && bombTimeLeftTicks() > 6*TICK_HZ){
      // (v443) «я один» — только если T правда один: группа пост-планта без лёркера и охотников бывала из одного при живых других
      if(!K.tt._tcPP){ K.tt._tcPP = tick; if(aliveCount("T") === 1) voiceLog("T", "tcpp", group[0].id, "я один на пост-планте — прячусь, играю на время, выйду на звук дефуза"); }
      if(!ppTimeNamed(group, bp0, bomb.site, DEFUSE_HEAR-90))
        groupPost(group, bp0, gs.ctEntry, "postplant:time", {team: "T", rMin:300, rMax:Math.min(600, DEFUSE_HEAR-90), minGap:110, hideFrom:[gs.ctEntry, bp0]});
      return true;
    }
    // (v469, п.9 владельца 29.10, р5 м1: после планта точки переназначались трижды — через 4 с тишины все уходили «на время» на T Ramp и CT,
    // через 2,7 с при первой инфе возвращались) ответ про-аналитика 29.10: держать расстановку, пока кроссфайр работает и позиции не раскрыты;
    // менять — по событию (раскрыли, граната, кто-то погиб, CT выходят), а не по таймеру. Режим «тихо — отходим на время» (BAL.ppTime) убран:
    // у каждого своя точка у бомбы (holdGroup ниже), смена — реакция на контакт / анти-дефуз
    // (v145) пост-плант у бомбы = "держать район вокруг бомбы": бомбу видеть
    // обязательно (снять дефузера), встать под главный вход ретейка, от
    // остальных закрыться, не стоять кучей, по возможности кроссфаер
    // (v583a, Д14) места про при такой бомбе (MAP.postplant) — ppProGroup (280); нет данных о зоне бомбы — держать район вокруг бомбы
    // (отметка владельца 18.11, м5 р1: место про сдвигали «ради обзора» / «от своего» — T3 со Stairs на открытый Cross, T2 на открытую часть T Ramp)
    // место про — точное (exactSpot, 110): «postplant:pro»
    var ppRest = ppProGroup(group, bp0, bomb.site, "postplant:pro"); if(ppRest && !ppRest.length) return true;
    holdGroup(ppRest || group, {key:"pp"+bomb.site+Math.round(bp0.x/30), center:bp0, rArea: 420, rMin: 180, rMax: 520, must:[bp0], anyFrom:true,   // (v520, владелец 09.11: «занимают позиции, с которых видна бомба») бомбу видят все, не только первый (было mustFirst, до 680 px — встали в Hole)
      // (v442, док владельца 27.10: «войс спамится» — «держу бомбу, смотрю X» каждый игрок при каждой смене угла, 3–4 строки в секунду) — один
      // раз за раунд на игрока: куда смотрит дальше, видно на радаре
      voice:function(b, r){ if(r.main && b._ppSaid !== roundNum && (b._ppSaid = roundNum)) voiceLog("T", "pphold"+b.id, b.id, "смотрю бомбу "+calloutName(r.main.pt.x, r.main.pt.y).replace(/^на /,"")); }}, "postplant:hold");
    return true;
    if(!K.tt.ppAssign) K.tt.ppAssign = {};
    var usedP = {}; Object.keys(K.tt.ppAssign).forEach(function(id){ usedP[K.tt.ppAssign[id]] = true; });
    ppLeft = [];
    group.forEach(function(b){
      if(b._ppSplit && b._ppSplit.round === roundNum){ setPost(b, b._ppSplit.pt, bp0, true, "postplant:split"); return; }
      var nm = K.tt.ppAssign[b.id];
      if(!nm){
        var best = null, bd = Infinity;
        POS[bomb.site].tPost.forEach(function(n){ if(usedP[n]) return; var zp = zonePoint(n, bp0); if(!zp) return;
          var d = DM.hypot(zp.x-b.x, zp.y-b.y); if(DM.hypot(zp.x-bp0.x, zp.y-bp0.y) > 700) return;
          // (1) раньше — просто ближайшая к боту позиция (часто на самом сайте,
          // под входом CT). Теперь "стоимость": видна ли бомба, со скольких
          // выходов CT видно точку, не стоит ли прямо на линии входа CT
          var sp = namedSpot(n, bp0, {team: "T", must:[bp0], see:[gs.ctEntry], rMax:160, key:"pp"+Math.round(bp0.x/30)}) || zp;
          var ex = spotExposure("T", sp.x, sp.y), db = DM.hypot(sp.x-bp0.x, sp.y-bp0.y);
          d = d/500 + 0.9*ex + (hasLOS(sp.x, sp.y, bp0.x, bp0.y) ? 0 : 3) + (db < 150 ? 1.2 : 0) + (hasLOS(sp.x, sp.y, gs.ctEntry.x, gs.ctEntry.y) && db < 260 ? 0.8 : 0) +
              0.6*hashRand(roundNum*131 + matchNum*17 + n.length*7 + b.id.length);
          if(d < bd){ bd = d; best = n; } });
        nm = best; K.tt.ppAssign[b.id] = nm || "-"; if(nm){ usedP[nm] = true; logEvent(b.id+": пост-плант с «"+nm+"»"); }
      }
      var pp = nm && nm !== "-" ? namedSpot(nm, bp0, {team: "T", must:[bp0], see:[gs.ctEntry], rMax:160, key:"pp"+Math.round(bp0.x/30)}) : null;
      if(pp && hasLOS(pp.x, pp.y, bp0.x, bp0.y)) setPost(b, pp, bp0, true, "postplant:"+nm); else ppLeft.push(b);
    });
    groupPost(ppLeft, bp0, gs.ctEntry, "postplant", {team: "T", rMin:90, rMax:340, minGap:70, must:[bp0], hideFrom:[gs.ctEntry], see:[gs.ctEntry]});
    // (S10) двое после планта в одной точке — один пик CT забирает обоих:
    // второй расходится на другой угол к бомбе (кроссфайр)
    if(group.length === 2 && !K.tt._ppSplitDone){
      var g0 = group[0], g1 = group[1];
      if(g0.post && g1.post && DM.hypot(g0.post.x-g1.post.x, g0.post.y-g1.post.y) < 250){
        K.tt._ppSplitDone = tick;
        var cand = pickSpots("ppsplit"+Math.round(bp0.x/30), bp0, 4, {team: "T", rMin:150, rMax:420, minGap:60, must:[bp0]})
          .filter(function(q){ return DM.hypot(q.x-g0.post.x, q.y-g0.post.y) > 300; })[0];
        if(cand){ g1._ppSplit = {round:roundNum, pt:cand}; setPost(g1, cand, bp0, true, "postplant:split");
          voiceLog("T", "ppsplit", g1.id, "расходимся — я с другого угла на бомбу"); }
      }
    }
}

