// [хозяева: tBrain, tBrainBomb, tBrainExecGo, tBrainMidTake, tBrainSiteSwitch, tBrainTeam] (v510) быстрый выход (сняли CT на сайте / их ≤ 2 / там соло): критичный смок выхода уже брошен — заходим, как раскроется
// (не дольше EXU_FAST_MAX), ещё не брошен — сразу. Ожидание — exuHoldEta (exec-sync)
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
  exuTick(K.tt);   // (тактика 30.10) гранаты выхода: жизненный цикл, провал, резервный исполнитель (exec-sync)
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
      if(K.tt.phase === "setup"){ tPhaseSet(K.tt, "execute", "tBrain"); K.tt.execStart = tick; }
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
    // (00_PLAN п.10, ответ 6А) и когда появился реальный плант (tPlantChance, save-retake): сейв снят, при том же раскладе в этом раунде не включается
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
    // «пока летят, но не дольше 5 с»: одно решение — exuGate (exec-sync). Поздно (< EXU_LATE с) — выходим и без них
    if(goNow && K.secLeft >= EXU_LATE){
      var XG = exuGate(K.tt);
      if(!XG.go){ goNow = false; if(K.tt._smWaitLog !== XG.why){ K.tt._smWaitLog = XG.why; logEvent("T: ждём — "+XG.why); exuEv("wait", null, {why:XG.why}); } }
    }
    if(goNow){
      tPhaseSet(K.tt, "execute", "tBrainExecGo"); K.tt.execStart = tick; siteHeatPending[K.tt.site] = 1;
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
      tFastGo(K.tt, function(){ tPhaseSet(K.tt, "execute", "tBrainExecGo"); K.tt.execStart = tick; siteHeatPending[K.tt.site] = 1;
        voiceLog("T", "pick"+K.tt.site, "IGL", "минус на "+K.tt.site+", заходим сразу!");
        logEvent("T: выход на "+K.tt.site+"! (сняли CT на сайте)"); });
    }
  }
  if(bomb.state === "planted" && K.tt.phase !== "postplant"){ tPhaseSet(K.tt, "postplant", "tBrainExecGo");
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
      tSetSite(K.tt, K.other); tPhaseSet(K.tt, "setup", "tBrainSiteSwitch"); K.tt.execTick = tick + 3*TICK_HZ;
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
      var exT = K.tt.execTick; tSetSite(K.tt, K.other); tPhaseSet(K.tt, "setup", "tBrainSiteSwitch"); K.tt.execTick = Math.max(tick + 8*TICK_HZ, exT - 8*TICK_HZ);
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
        if(conf){ tPhaseSet(K.tt, "execute", "tBrainSiteSwitch"); K.tt.execStart = tick; K.tt.fewGo = true; }
        else { tPhaseSet(K.tt, "setup", "tBrainSiteSwitch"); K.tt.execTick = tick + 4*TICK_HZ; }
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
      fl2.forEach(function(b){ b._midFlank = {round:roundNum, site:K.tt.site}; routeDrop(b, true);
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
      K.tt.fewGo = true; tPhaseSet(K.tt, "execute", "tBrainMidTake"); K.tt.execStart = tick; siteHeatPending[K.tt.site] = 1;
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
      K.tt.soloGo = true; tFastGo(K.tt, function(){ tPhaseSet(K.tt, "execute", "tBrainMidTake"); K.tt.execStart = tick; siteHeatPending[K.tt.site] = 1;
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
    // (00_PLAN п.10, ответ 6А) и когда появился реальный плант (tPlantChance, save-retake): сейв снят, при том же раскладе в этом раунде не включается
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
