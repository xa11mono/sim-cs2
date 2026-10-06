function fl2idx(b){ return bots.filter(function(o){ return o._midFlank && o._midFlank.round === roundNum; }).indexOf(b) > 0 ? 1 : 0; }
// (13) сбор перед выходом на B — T Lower (+ T Upper для второй пары), а не
// Ruins: точка 560px по пути от сайта попадала глубоко назад, выход шёл
// растянутой колонной через весь Ramp
function bStageFix(){
  if(!GEO.B || GEO.B._lowSet) return;
  var lo = zonePoint("T Lower", SITES.B); if(!lo) return;
  GEO.B._lowSet = true; GEO.B._tStageOrig = GEO.B.tStage;
  GEO.B.tStage = pickSpots("bstageLow", lo, 1, {rMax:140, minGap:40, hideFrom:[SITES.B, GEO.B.anchor], see:[GEO.B.tEntry]})[0] || lo;
  var up = zonePoint("T Upper", SITES.B);
  if(up) GEO.B.tStageUp = pickSpots("bstageUp", up, 1, {rMax:140, minGap:40, hideFrom:[SITES.B, GEO.B.anchor]})[0] || up;
}
function stagePost(mem, k){
  var g = GEO[k], opt = {rMax:200, minGap:50, hideFrom:[SITES[k], g.anchor], see:[g.tEntry], avoidNades: BAL.tAdapt ? tDeathSpots() : []};
  if(!mem.length) return;
  if(k === "B" && g.tStageUp && mem.length >= 3){
    // двое-трое ниже (T Lower → Ramp), один-двое выше (T Upper → Rat/Dark): выход с двух сторон
    var nUp = mem.length >= 4 ? 2 : 1;
    var srt = mem.slice().sort(function(a, c){ return Math.hypot(a.x-g.tStageUp.x, a.y-g.tStageUp.y) - Math.hypot(c.x-g.tStageUp.x, c.y-g.tStageUp.y); });
    var ups = srt.filter(function(b){ return b.tRole !== "entry"; }).slice(0, nUp), low = mem.filter(function(b){ return ups.indexOf(b) < 0; });
    var upLook = zonePoint("Rat", g.tStageUp) || g.tEntry;
    groupPost(low, g.tStage, g.tEntry, "stage"+k, opt);
    ups.forEach(function(b){ b._stageInfo = {from:g.tStageUp, to:upLook, look:SITES[k], round:roundNum}; });
    groupPost(ups, g.tStageUp, upLook, "stage"+k+":T Upper", {rMax:160, minGap:50, hideFrom:[SITES[k], g.anchor], see:[upLook]});
    return;
  }
  groupPost(mem, g.tStage, g.tEntry, "stage"+k, opt);
}
function tBrain(){
  var tt = teamTac.T; if(!tt) return;
  if(tt.phase === "setup" && tt.minExec && tt.execTick < roundStartTick + tt.minExec*TICK_HZ) tt.execTick = roundStartTick + tt.minExec*TICK_HZ;
  bStageFix();
  if(tt.seenCT && tick % 16 === 0 && (tt.phase === "setup" || (tt.execStart && tick - tt.execStart < 8*TICK_HZ))){
    ["A","B"].forEach(function(k){ var e = intelEstimate("T", SITES[k].x, SITES[k].y, 450, 4*TICK_HZ); if(e.seen > tt.seenCT[k]) tt.seenCT[k] = e.seen; });
  }
  if(tt.phase !== "setup" && !tt.histed){ tt.histed = true; MEMORY.tSiteHist.push(tt.site); }
  var tac = tt.tac, site = SITES[tt.site], g = GEO[tt.site];
  var other = tt.site === "A" ? "B" : "A";
  var plantPt = site.plant || site;
  var secLeft = ROUND_TIME_SEC - (simTime - roundStartTime);
  // поздно — выходим, даже если по плану ещё setup
  if(tt.phase === "setup" && (tick >= tt.execTick || secLeft < 35)){
    // раздел: синхронный выход по времени — команда не идёт на сайт вразнобой,
    // пока не собралась на точках сбора (иначе один уже на сайте, пока
    // остальные ещё в коридоре) — но ждём не дольше ~5с и не ждём, если время
    // раунда поджимает или флаг выключен
    var lateGrace = secLeft < 35 || tick - tt.execTick > (BAL.syncGrace||3)*TICK_HZ;
    var goNow = lateGrace;
    if(!goNow){
      var atk = bots.filter(function(b){ return b.team === "T" && b.alive && b.tRole !== "lurker" && !(b._midFlank && b._midFlank.round === roundNum); });
      var staged = atk.filter(function(b){ return b.atPost; }).length;
      var need = Math.max(1, Math.ceil(atk.length * (BAL.syncNeed||0.7)));
      goNow = staged >= need;
      if(!goNow && !tt._waitLog){ tt._waitLog = true; logEvent("T: ждём — не все на точках выхода"); }
    }
    // смоки выхода ещё летят — ждём, пока встанут (до ~2с), чтобы энтри не пикал под открытые углы
    if(goNow && secLeft >= 35 && tt._smT && tick - tt._smT < 5*TICK_HZ && tick - tt.execTick < 5*TICK_HZ && tExecNadesFlying()){
      goNow = false; if(!tt._smWaitLog){ tt._smWaitLog = true; logEvent("T: ждём, пока встанут смоки"); }
    }
    if(goNow){
      tt.phase = "execute"; tt.execStart = tick; if(BAL.noLeaks) MEMORY.siteHeatPending[tt.site] = 1; else MEMORY.siteHeat[tt.site] = (MEMORY.siteHeat[tt.site]||0) + 1;
      logEvent("T: выход на "+tt.site+"!"+(tt._waitLog ? " (все собрались)" : ""));
    }
  }
  // войс: "минус опорник на A" в сетапе — сайт сейчас слабый, заходим сразу,
  // не дожидаясь тайминга (пока CT не успели перекрыть его ротацией)
  if(tt.phase === "setup"){
    // только если сняли того, кто держит сам сайт (опорника или игрока прямо на
    // точке), а не первого встречного на подходах
    var ancR = tt.site === "A" ? "anchorA" : "anchorB";
    var pickSig = picEvents("T").filter(function(s){ return s.type === "kill" && tick - s.tick < 3*64 &&
      (s.role === ancR ? Math.hypot(s.x-site.x, s.y-site.y) < 600 : Math.hypot(s.x-site.x, s.y-site.y) < 350); })[0];
    if(pickSig && aliveCount("T") >= 4 && (tick - roundStartTick > 22*TICK_HZ)){
      tt.phase = "execute"; tt.execStart = tick; if(BAL.noLeaks) MEMORY.siteHeatPending[tt.site] = 1; else MEMORY.siteHeat[tt.site] = (MEMORY.siteHeat[tt.site]||0) + 1;
      voiceLog("T", "pick"+tt.site, pickSig.by, "минус на "+tt.site+", заходим сразу!");
      logEvent("T: выход на "+tt.site+"! (сняли CT на сайте)");
    }
  }
  if(bomb.state === "planted" && tt.phase !== "postplant"){ tt.phase = "postplant";
    // (v144) фланг через мид и охота имели смысл до планта. После планта у них
    // не было исполнителя — стояли, где оставили. Теперь все в пост-плант
    if(BAL.ppFix === true) bots.forEach(function(o){ if(o.team !== "T") return; o._midFlank = null; o._shift = null; dropTask(o, "endhunt"); o._egC = null;
      if(o.post && /^(endhunt|stage.*CTside)/.test(o.post.tag || "")) clearPost(o); });
  }
  // ---- раздел 11: живая перепривязка тактики ----
  // IGL слушает коллы: если на нашем сайте стак CT (видели/слышали 2+ больше,
  // чем на другом) или там уже погибли двое наших, а времени хватает — один раз
  // за раунд меняем сайт. Выход не отменяется совсем: перегруппировка ~5с.
  if(!tt.rebound && bomb.state !== "planted" && secLeft > 40 && !carrierAtSite(tt) &&
     (tt.phase === "setup" || tick - (tt.execStart||tick) < 6*TICK_HZ)){
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
    var pickOther = tt.phase === "setup" && picEvents("T").some(function(sg){ return sg.type === "kill" && tick - sg.tick < 3*TICK_HZ &&
      (sg.role === ancO ? Math.hypot(sg.x-SITES[other].x, sg.y-SITES[other].y) < 600 : Math.hypot(sg.x-SITES[other].x, sg.y-SITES[other].y) < 350); });
    if(pickOther && aliveT >= 3 && beliefCount("T", BZ.siteNear[other]||[]) < 0.9 && there < 1.5 && iglReads(tt, "po")){
      tt.rebound = true;
      voiceLog("T", "reb"+other, "IGL", "минус на "+other+", там пусто — все на "+other+"!");
      logEvent("IGL: перекол → "+other+" (сняли CT, сайт пустой)");
      tt.site = other; tt.phase = "setup"; tt.execTick = tick + 3*TICK_HZ; tt.execStart = null; tt.plantPick = null;
      nadeFlags.tExec = false; nadeFlags.tExecSm = false; nadeFlags.peekFlashPlanned = false;
      return;
    }
    // смерть своего у сайта в сетапе уже повод передумать, если там же видели 2+
    var stackRead = tt.phase === "setup" ? (here - there >= 1.5 && here >= 2.5) || (deathsHere >= 1 && here >= 2 && here > there)
                                         : (here - there >= 2 && (here >= 3.5 || deathsHere >= 2));
    // стак = минимум двое реально замечены/услышаны у сайта сейчас (или минус там)
    if(BAL.recallStrict && stackRead && (freshC[tt.site]||0) < 2 && deathsHere < 1) stackRead = false;
    if(aliveT >= needAlive && stackRead && iglReads(tt, "st")){
      tt.rebound = true;
      logEvent("IGL: на "+tt.site+" стак (~"+Math.round(here)+"), перепривязка → "+other);
      // перекол не значит "сразу выход": группа переходит и выходит примерно по
      // исходному таймингу (минимум через 8с, чтобы успеть дойти)
      tt.site = other; tt.phase = "setup"; tt.execTick = Math.max(tick + 8*TICK_HZ, tt.execTick - 8*TICK_HZ); tt.execStart = null; tt.plantPick = null;
      nadeFlags.tExec = false; nadeFlags.tExecSm = false; nadeFlags.peekFlashPlanned = false;
      return; // со следующего тика мозг работает уже по новому сайту
    }
  }
  if(BAL.iglReplan && tIglReplan(tt, site, other, secLeft)) return;
  // ---- мид наш: сняли мидера CT → двое идут через Red Room на сторону CT и
  // заходят на наш сайт оттуда, пока остальные — с обычной стороны ----
  if(BAL.midTake && tt.phase === "setup" && !tt.midTaken && aliveCount("T") >= 4 && tick - roundStartTick > 8*TICK_HZ){
    var midKill = picEvents("T").filter(function(sg){ return sg.type === "kill" && tick - sg.tick < 3*TICK_HZ && sg.role === "mid"; })[0];
    if(midKill){
      tt.midTaken = tick;
      var tsM = bots.filter(function(b){ return b.team === "T" && b.alive && b.tRole !== "lurker" && !(bomb.state === "carried" && bomb.carrier === b); });
      var mp = zonePoint("Mid") || GEO.ctMid;
      tsM.sort(function(a, b2){ return Math.hypot(a.x-mp.x, a.y-mp.y) - Math.hypot(b2.x-mp.x, b2.y-mp.y); });
      var fl2 = tsM.slice(0, 2);
      fl2.forEach(function(b){ b._midFlank = {round:roundNum, site:tt.site}; b._route = null; b._routeDone = null;
        startRoute(b, ["Mid","Top Mid","Sniper Nest","Red Room","Alley"], "midct"+roundNum); });
      tt.execTick = Math.max(tick + 18*TICK_HZ, Math.min(tt.execTick, tick + 30*TICK_HZ));
      voiceLog("T", "midtake", midKill.by, "мид наш! "+fl2.map(function(b){ return b.id; }).join(" и ")+" — через Red Room, "+tt.site+" с двух сторон");
      logEvent("IGL: мид взят — заход на "+tt.site+" с двух сторон (через Red Room)");
    }
  }
  // раздел 12: проба увидела на нашем сайте ровно одного, и по карте там больше
  // никого — "там соло, заходим" (не ждём тайминга)
  if(tt.phase === "setup" && tick - roundStartTick > 28*TICK_HZ && !tt.soloGo && !(hashRand(roundNum*577 + matchNum*41 + 3) < 0.5)){
    var eS = intelEstimate("T", site.x, site.y, 420, 5*TICK_HZ);
    var aliveT2 = aliveCount("T");
    if(eS.seen === 1 && beliefCount("T", BZ.siteNear[tt.site]||[]) < 1.4 && aliveT2 >= 4 && iglReads(tt, "so")){
      tt.soloGo = true; tt.phase = "execute"; tt.execStart = tick; if(BAL.noLeaks) MEMORY.siteHeatPending[tt.site] = 1; else MEMORY.siteHeat[tt.site] = (MEMORY.siteHeat[tt.site]||0) + 1;
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
    var gunVal = ts.reduce(function(a, b){ return a + (b.primary ? WEAPONS[b.primary].price : 0); }, 0) / aT;
    var carOn = bomb.state === "carried" && bomb.carrier && bomb.carrier.alive && Math.hypot(bomb.carrier.x-site.x, bomb.carrier.y-site.y) < 380;
    var hopeless = (aT === 1 && aC >= 3 && secLeft < 30) || (aT === 1 && aC >= 4 && secLeft < 55) || (aT === 2 && aC >= 4 && secLeft < 30);
    if(hopeless && gunVal >= 1500 && !carOn){
      tt.saving = tick;
      logEvent("T: сейв — "+aT+"v"+aC+", "+Math.round(secLeft)+"с — сохраняем оружие");
      voiceLog("T", "tsave", ts[0].id, aT === 1 ? "я один против "+aC+" — сейвлю" : "двое на "+aC+", мало времени — сейв");
    }
  }
  // (35) T: двое против 4+, мало времени — снайпер сохраняет AWP, второй пробует
  if(BAL.awpSave && !tt.saving && bomb.state !== "planted" && ts.length === 2 && aliveCount("CT") >= 4 && secLeft < 45){
    var awT = ts.filter(function(b){ return b.primary === "AWP" && !(bomb.state === "carried" && bomb.carrier === b); })[0];
    if(awT){ if(!awT._saveSpot){ awT._saveSpot = pickSaveSpotT(awT); voiceLog("T", "awpsaveT", awT.id, "сейвлю AWP"); }
      setPost(awT, awT._saveSpot, null, true, "save"); ts = ts.filter(function(b){ return b !== awT; }); }
  }
  if(tt.saving && bomb.state !== "planted"){
    ts.forEach(function(b){ if(!b._saveSpot){ b._saveSpot = pickSaveSpotT(b); b._saveLooks = null; } if(!b.planting) setPost(b, b._saveSpot, null, true, "save"); });
    return;
  }
  // бомба на земле — ближайший (не лёркер) идёт за ней
  var fetcher = null;
  // бомбу уже подобрали — старый пост "за бомбой" снять (иначе носитель
  // стоял на месте, где она лежала, до конца раунда)
  if(bomb.state !== "dropped"){ tt.fetchId = null; ts.forEach(function(b){ if(b.post && b.post.tag === "fetch") clearPost(b); }); }
  if(bomb.state === "dropped"){
    var bd = Infinity;
    // кто пошёл за бомбой — тот и идёт, пока жив (раньше каждый тик выбирался
    // ближайший, и двое попеременно получали то "за бомбой", то свою точку)
    var prevF = tt.fetchId && ts.filter(function(b){ return b.id === tt.fetchId; })[0];
    if(prevF){ bd = -1; fetcher = prevF; }
    ts.forEach(function(b){
      if(bd < 0) return;
      if(b.tRole==="lurker" && ts.length > 2) return; // лёркер за бомбой — только когда нас мало
      // тот же приоритет по ролям: энтри и AWP за бомбой идут, только если сильно ближе
      var d = Math.hypot(b.baseX-bomb.x, b.baseY-bomb.y) + ((b.tRole==="entry"||b.tRole==="awp") ? 250 : 0);
      if(d < bd){ bd = d; fetcher = b; }
    });
    if(fetcher){ tt.fetchId = fetcher.id;
      if(fetcher.nadeTask && fetcher.nadeTask.lineup){ fetcher.nadeTask = null; dropTask(fetcher, "lineup"); } // бомба важнее лайнапа
      setPost(fetcher, {x:bomb.x, y:bomb.y}, null, false, "fetch"); }
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
  if(ts.length === 1 && bomb.state !== "planted" && tt.phase !== "postplant"){
    var solo = ts[0];
    if(!tt.soloPlan){
      // сайт, где по инфе меньше CT (и ближе); сразу выход — ждать некого
      var sc = function(k){ return beliefCount("T", BZ.siteNear[k]||[]) * 400 + Math.hypot(solo.x-SITES[k].x, solo.y-SITES[k].y); };
      var ks2 = sc("A") <= sc("B") ? "A" : "B";
      tt.soloPlan = ks2;
      if(ks2 !== tt.site){ tt.site = ks2; tt.plantPick = null; site = SITES[ks2]; g = GEO[ks2]; other = ks2 === "A" ? "B" : "A"; plantPt = site.plant || site; }
      if(tt.phase === "setup"){ tt.phase = "execute"; tt.execStart = tick; }
      tt.wave2 = tt.wave2 || tick;
      voiceLog("T", "solo", solo.id, "я один — иду ставить на "+ks2+", в дуэли не лезу");
    }
  }
  var stageOpt = function(k){ return {rMax:200, minGap:50, hideFrom:[SITES[k], GEO[k].anchor], see:[GEO[k].tEntry], avoidNades: BAL.tAdapt ? tDeathSpots() : []}; };
  var midOpt = {rMax:160, minGap:50, see:[GEO.tMidLook]};
  if(!tt.tMidPick){
    var tm = POS.M.tHold, tmi = weightedPick(tm.length, roundNum*389 + matchNum*7);
    tt.tMidPick = tm[tmi] === "TMID" ? null : tm[tmi];
    tt.tMidPt = tt.tMidPick ? zonePoint(tt.tMidPick, GEO.tMid) : null;
    if(!tt.tMidPt) tt.tMidPick = "-";
  }

  if(tt.phase === "setup"){
    if(lurker) lurkerBrain(lurker, tt, other);
    var inDef = tt.defUntil && tick < tt.defUntil && tick < tt.execTick - tt.needT*TICK_HZ && tac.style !== "default";
    if(inDef){
      // дефолт: растягиваем CT — двое у другого сайта, AWP на миде, IGL у цели
      if(!tt._defLog){ tt._defLog = true; logEvent("T: сначала дефолт, "+tac.name+" — позже"); }
      // (снайпер — с группой у цели, мид держит поддержка: AWP на миде в дефолте
      // у ботов был первой жертвой в 19% раундов, у про — 4%)
      stagePost(pick(["entry"]), other);
      groupPost(pick(["support"]), tt.tMidPt || GEO.tMid, GEO.tMidLook, "tmid", midOpt);
      stagePost(pick(["igl","awp"]), tt.site);
    } else if(tac.groups){
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
      if(!tt._fakeCtSeen && intelEstimate("T", gf.anchor.x, gf.anchor.y, 550, 4*TICK_HZ).n > 0) tt._fakeCtSeen = tick;
      if(tick < tt.execTick - 14*TICK_HZ){
        stagePost(fakers, fk);
      } else {
        if(!tt.fakeOn){ tt.fakeOn = tick;
          logEvent("T: фейк на "+fk+" — шумим и кидаем гранаты, выход на "+tt.site);
          if(fakers[0]) voiceLog("T", "fake"+fk, fakers[0].id, "делаю фейк на "+fk+", вы ждите на "+tt.site); }
        var fakeDied = picEvents("T").some(function(sg){ return sg.type === "died" && tick - sg.tick < 10*TICK_HZ && Math.hypot(sg.x-gf.tEntry.x, sg.y-gf.tEntry.y) < 450; });
        if(fakeDied){ stagePost(fakers, fk); if(!tt._fakeHoldLog){ tt._fakeHoldLog = true; logEvent("T: на фейке сняли своего — второй не лезет туда же, держит"); } }
        else groupPost(fakers, gf.tEntry, gf.anchor, "fake"+fk, {rMax:120, minGap:40, see:[gf.anchor]});
        // раздел 13: "купились ли CT на фейк" — IGL примерно оценивает это по
        // своей же инфе (не телепатия): опорник фейкового сайта, которого
        // фейкеры видели вначале, пропал из поля зрения/по последней инфе
        // (картина команды) — похоже, ушёл ротой на настоящий сайт. Читается один
        // раз за фейк, не каждый тик, и не идеально (IGL может ошибиться).
        if(!tt._fakeRead && tick - tt.fakeOn > 5*TICK_HZ && tick - tt.fakeOn < 16*TICK_HZ){
          var fkZ = zoneIdAt(gf.anchor.x, gf.anchor.y);
          var sawCtAtFakeEarly = !!tt._fakeCtSeen;
          var fkI = bzOf(gf.anchor.x, gf.anchor.y), clearedNow = fkZ && fkI >= 0 && (LAST_CLEAR.T[fkI] || -1) > tt.fakeOn;
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
      var st = zonePoint(tt.site === "A" ? "CT Lane" : "Back Halls", SITES[tt.site]);
      var lk = zonePoint(tt.site === "A" ? "Triple Box" : "Second Lane", st) || SITES[tt.site];
      if(st) setPost(b, pickSpots("midflank"+tt.site, st, 2, {rMax:150, minGap:40, see:[lk], hideFrom:[SITES[tt.site]]})[fl2idx(b)], lk, true, "stage"+tt.site+":CTside");
    });
  } else if(tt.phase === "execute"){
    if(lurker) lurkerBrain(lurker, tt, other);
    var since = tick - (tt.execStart || tick);
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
        picEvents("T").some(function(sg){ return (sg.type === "kill" || sg.type === "died") && sg.tick >= (tt.execStart||0); });
      if(contact && !tt.w1Contact) tt.w1Contact = tick;
      if((tt.w1Contact && tick - tt.w1Contact > 48) || since > 4.5*TICK_HZ || ts.length <= 2){
        tt.wave2 = tick; logEvent("T: вторая волна заходит на "+tt.site+(tt.w1Contact ? " (после первого контакта)" : ""));
      }
    }
    var carrier = bomb.state === "carried" ? bomb.carrier : null;
    var ready = function(b){
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
      setPost(carrier, tt.plantPick ? tt.plantPick.pt : plantPt, g.ctEntry, true, "plantspot");
    }
    var rest = pick(["entry","awp","support","igl"]).filter(function(b){ return b !== carrier && ready(b); });
    // (S5) ставят — двое ближних прикрывают подходы к ставящему под разными углами
    if(BAL.coverPlant && carrier && carrier.alive && (carrier.planting || (carrier.post && carrier.post.tag === "plantspot" && Math.hypot(carrier.x-carrier.post.x, carrier.y-carrier.post.y) < 90))){
      var cp0 = {x:carrier.x, y:carrier.y};
      var covs = rest.filter(function(b){ return !b._sawEnemy && Math.hypot(b.x-cp0.x, b.y-cp0.y) < 550 && !taskOn(b, "tradeR"); })
        .sort(function(a, c){ return Math.hypot(a.x-cp0.x, a.y-cp0.y) - Math.hypot(c.x-cp0.x, c.y-cp0.y); }).slice(0, 2);
      var lkP = [g.ctEntry, g.anchor];
      covs.forEach(function(b, ci){
        var sp = pickSpots("covplant"+tt.site+ci, cp0, 2, {rMin:60, rMax:230, minGap:60, see:[lkP[ci]], must:[cp0]})[0];
        if(sp){ setPost(b, sp, lkP[ci], true, "coverplant"); }
      });
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
    if(takers.length && (smokeUp || since > 1.5*TICK_HZ || rush)){
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
        if(tp) setPost(b, tp, g.ctEntry, true, (b.tRole === "entry" ? "clear" : "sitehold")+tt.site+":"+nm);
        else groupPost([b], plantPt, g.ctEntry, "sitehold"+tt.site, {rMin:40, rMax:210, minGap:60, see:[g.ctEntry]});
      });
    }
    groupPost(rest.filter(function(b){ return b.tRole==="awp"; }), g.tEntry, g.ctEntry, "awpline"+tt.site, {rMax:130, minGap:50, see:[g.ctEntry, plantPt]});
  } else if(tt.phase === "postplant"){
    var gs = GEO[bomb.site];
    // за ~6с до взрыва — все прочь от бомбы (радиус взрыва убивает и своих)
    if(bombTimeLeftTicks() < 6*TICK_HZ && !bots.some(function(o){ return o.defusing; })){
      if(!tt.fleeLogged){ tt.fleeLogged = true; logEvent("T: уходим от бомбы — сейчас рванёт"); }
      ts.forEach(function(b){ if(!b.planting){ var fp = bombFleePoint(b); setPost(b, fp || gs.tStage, {x:bomb.x, y:bomb.y}, true, "flee"); } });
      return;
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
    }
    if(lurker && antiDef.indexOf(lurker) < 0) lurkerBrain(lurker, tt, other);
    var group = pick(["entry","awp","support","igl"]).filter(function(b){ return antiDef.indexOf(b) < 0; });
    // лёркер, оставшийся последним (уже не лёркер), — тоже на пост-плант, а не стоит где поставил
    if(!lurker) group = group.concat(ts.filter(function(b){ return b.tRole === "lurker" && antiDef.indexOf(b) < 0 && group.indexOf(b) < 0 && !b.planting; }));
    // CT ушли в сейв и времени много — пара T идёт выбивать оружие
    var ctSaving = teamTac.CT && teamTac.CT.saving;
    if(BAL.noLeaks){
      // CT не идут на ретейк: после планта прошло 15с+, у бомбы и на подходах их
      // не видели и не слышали 10с, и их меньше нас — похоже на сейв
      var ctNearB = intelEstimate("T", bomb.x, bomb.y, 1200, 10*TICK_HZ);
      ctSaving = tick - bomb.plantTick > 15*TICK_HZ && (ctNearB.seen + ctNearB.heard) === 0 && aliveCount("CT") < ts.length;
    }
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
        var pts = [{x:CT_SPAWN.x, y:CT_SPAWN.y}], minGap = 280;
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
      if(!tt._tcPP){ tt._tcPP = tick; voiceLog("T", "tcpp", group[0].id, "я один на пост-планте — прячусь, играю на время, выйду на звук дефуза"); }
      groupPost(group, bp0, gs.ctEntry, "postplant:time", {rMin:300, rMax:Math.min(600, DEFUSE_HEAR-90), minGap:110, hideFrom:[gs.ctEntry, bp0]});
      return;
    }
    if(BAL.ppTime && bombTimeLeftTicks() > 18*TICK_HZ && group.length){
      var ctNear = intelEstimate("T", bp0.x, bp0.y, 900, 6*TICK_HZ);
      var quiet = (ctNear.seen + ctNear.heard) === 0 && tick - bomb.plantTick > 4*TICK_HZ;
      // гистерезис: раньше "тихо/не тихо" переключалось каждые пару секунд и
      // T бегали между дальним укрытием и точкой у бомбы. Раз CT объявились —
      // до конца раунда играем от бомбы; раз ушли на время — ждём реальной инфы
      if(BAL.ppCommit){
        if(tt._ppMode === "close") quiet = false;
        else if(tt._ppMode === "time"){ var ctN2 = intelEstimate("T", bp0.x, bp0.y, 700, 3*TICK_HZ); if(ctN2.seen + ctN2.heard > 0){ tt._ppMode = "close"; quiet = false; } else quiet = true; }
        else if(quiet) tt._ppMode = "time";
        else if((ctNear.seen + ctNear.heard) > 0) tt._ppMode = "close";
      }
      if(quiet){
        if(!tt._ppTimeLog){ tt._ppTimeLog = tick; voiceLog("T", "pptime", group[0].id, "их не слышно — отходим от бомбы, играем на время, слушаем дефуз"); }
        groupPost(group, bp0, gs.ctEntry, "postplant:time", {rMin:320, rMax:Math.min(620, DEFUSE_HEAR-80), minGap:110, hideFrom:[gs.ctEntry, bp0]});
        return;
      }
    }
    if(BAL.holdTask){
      // (v145) пост-плант у бомбы = "держать район вокруг бомбы": бомбу видеть
      // обязательно (снять дефузера), встать под главный вход ретейка, от
      // остальных закрыться, не стоять кучей, по возможности кроссфаер
      holdGroup(group, {key:"pp"+bomb.site+Math.round(bp0.x/30), center:bp0, rArea: BAL.ppFar ? 420 : 320, rMin: BAL.ppFar ? 180 : 90, rMax: BAL.ppFar ? 520 : 420, must:[bp0], mustFirst:BAL.ppSpread, rMax2: BAL.ppFar ? 680 : 560,
        voice:function(b, r){ if(r.main) voiceLog("T", "pphold"+b.id+Math.round(r.main.pt.x/60), b.id, "держу бомбу, смотрю "+calloutName(r.main.pt.x, r.main.pt.y).replace(/^на /,"")); }}, "postplant:hold");
      return;
    }
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

function pickSaveSpot(b){
  // только то, что команда знает (радар/слышали за 15с), а не настоящие позиции T
  var ts = [], BLs = beliefLast.CT || {};
  for(var eidS in BLs){ var loS = BLs[eidS]; if(tick - loS.tick > 15*TICK_HZ) continue; if(bots.some(function(o){ return o.id === eidS && o.alive; })) ts.push({x:loS.x, y:loS.y}); }
  var best = null, bs = -Infinity;
  NAVAREAS.forEach(function(z, i){
    if(i % 3) return; // прореживаем кандидатов — ~650 хватает с запасом
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var c = zoneCentroid(z);
    if(insideSolidWall(c.x, c.y)) return;
    var dB = Math.hypot(c.x-bomb.x, c.y-bomb.y);
    if(dB < BOMB_KILL_RADIUS + 150) return;
    var dT = Infinity, seen = false;
    ts.forEach(function(t){ dT = Math.min(dT, Math.hypot(c.x-t.x, c.y-t.y)); if(hasLOS(c.x,c.y,t.x,t.y)) seen = true; });
    if(seen || dT < 500) return;
    if(Math.hypot(c.x-CT_SPAWN.x, c.y-CT_SPAWN.y) < 220) return; // не на самом спавне
    var dSelf = Math.hypot(c.x-b.baseX, c.y-b.baseY);
    var sc = Math.min(dT, 1200)*0.6 - dSelf; // подальше от T, но не бежать через всю карту
    if(sc > bs){ bs = sc; best = c; }
  });
  return best ? {x:best.x, y:best.y} : {x:CT_SPAWN.x, y:CT_SPAWN.y};
}
// укрытие для сейва T: подальше от известных CT и от сайтов, не на виду у живых CT
function pickSaveSpotT(b){
  var cts = [], BLt = beliefLast.T || {};
  for(var eidT in BLt){ var loT = BLt[eidT]; if(tick - loT.tick > 15*TICK_HZ) continue; if(bots.some(function(o){ return o.id === eidT && o.alive; })) cts.push({x:loT.x, y:loT.y}); }
  var known = []; for(var id in picKnown("T")){ known.push(picKnown("T")[id]); }
  var best = null, bs = -Infinity;
  NAVAREAS.forEach(function(z, i){
    if(i % 3) return;
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var c = zoneCentroid(z);
    if(insideSolidWall(c.x, c.y)) return;
    var dSite = Math.min(Math.hypot(c.x-SITES.A.x, c.y-SITES.A.y), Math.hypot(c.x-SITES.B.x, c.y-SITES.B.y));
    if(dSite < 500) return;
    var dK = Infinity, seen = false;
    known.forEach(function(k){ dK = Math.min(dK, Math.hypot(c.x-k.x, c.y-k.y)); });
    cts.forEach(function(t){ if(hasLOS(c.x, c.y, t.x, t.y)) seen = true; });
    if(seen || dK < 550) return;
    var dSelf = Math.hypot(c.x-b.baseX, c.y-b.baseY);
    var dTS = Math.hypot(c.x-T_SPAWN.x, c.y-T_SPAWN.y);
    var sc = Math.min(dK, 1200)*0.5 - dSelf - dTS*0.15; // подальше от CT, недалеко бежать, ближе к своей стороне
    if(sc > bs){ bs = sc; best = c; }
  });
  return best ? {x:best.x, y:best.y} : {x:T_SPAWN.x, y:T_SPAWN.y};
}
