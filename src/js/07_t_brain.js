// План IGL у T (тактика, фазы, перекол, сейв, кто за бомбой, волны выхода,
// анти-дефуз) — здесь; куда встать — выбор действия (12_team.js, tChoose).
function tBrain(){
  var tt = teamTac.T; if(!tt) return;
  if(tt.phase === "setup" && tt.minExec && tt.execTick < roundStartTick + tt.minExec*TICK_HZ) tt.execTick = roundStartTick + tt.minExec*TICK_HZ;
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
      var atk = bots.filter(function(b){ return b.team === "T" && b.alive && b.tRole !== "lurker"; });
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
      tt.phase = "execute"; tt.execStart = tick;
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
      tt.phase = "execute"; tt.execStart = tick;
      logEvent("T: выход на "+tt.site+"! (сняли CT на сайте)");
    }
  }
  if(bomb.state === "planted" && tt.phase !== "postplant") tt.phase = "postplant";
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
    if(pickOther && aliveT >= 3 && infoCount("T", BZ.siteNear[other]||[], 10) < 0.9 && there < 1.5){
      tt.rebound = true;
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
    if(aliveT >= needAlive && stackRead){
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
  // раздел 12: проба увидела на нашем сайте ровно одного, и по карте там больше
  // никого — "там соло, заходим" (не ждём тайминга)
  if(tt.phase === "setup" && tick - roundStartTick > 28*TICK_HZ && !tt.soloGo && !(hashRand(roundNum*577 + matchNum*41 + 3) < 0.5)){
    var eS = intelEstimate("T", site.x, site.y, 420, 5*TICK_HZ);
    var aliveT2 = aliveCount("T");
    if(eS.seen === 1 && infoCount("T", BZ.siteNear[tt.site]||[], 10) < 1.4 && aliveT2 >= 4){
      tt.soloGo = true; tt.phase = "execute"; tt.execStart = tick;
      logEvent("T: выход на "+tt.site+"! (по инфе там соло)");
    }
  }
  var ts = bots.filter(function(b){ return b.team==="T" && b.alive; });
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
    }
  }
  // AWP сохраняют, когда раунд почти проигран (двое против 4+, мало времени)
  ts.forEach(function(b){ b._awpSave = !!(BAL.awpSave && !tt.saving && bomb.state !== "planted" && ts.length === 2 && aliveCount("CT") >= 4 && secLeft < 45 &&
    b.primary === "AWP" && !(bomb.state === "carried" && bomb.carrier === b)); });
  // бомба на земле — ближайший (не лёркер) идёт за ней
  var fetcher = null;
  // бомбу уже подобрали — старый пост "за бомбой" снять (иначе носитель
  // стоял на месте, где она лежала, до конца раунда)
  if(bomb.state !== "dropped") tt.fetchId = null;
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
      if(fetcher.nadeTask && fetcher.nadeTask.lineup){ fetcher.nadeTask = null; } } // бомба важнее лайнапа
  }
  var roleT = function(b){ return (tt.regroup && b.tRole === "lurker") ? "support" : b.tRole; };
  if(ts.length === 1 && bomb.state !== "planted" && tt.phase !== "postplant"){
    var solo = ts[0];
    if(!tt.soloPlan){
      // сайт, где по инфе меньше CT (и ближе); сразу выход — ждать некого
      var sc = function(k){ return infoCount("T", BZ.siteNear[k]||[], 10) * 400 + Math.hypot(solo.x-SITES[k].x, solo.y-SITES[k].y); };
      var ks2 = sc("A") <= sc("B") ? "A" : "B";
      tt.soloPlan = ks2;
      if(ks2 !== tt.site){ tt.site = ks2; tt.plantPick = null; site = SITES[ks2]; g = GEO[ks2]; other = ks2 === "A" ? "B" : "A"; plantPt = site.plant || site; }
      if(tt.phase === "setup"){ tt.phase = "execute"; tt.execStart = tick; }
      tt.wave2 = tt.wave2 || tick;
    }
  }
  // ---- фейк: поддержка шумит у другого сайта; IGL читает, купились ли CT ----
  if(tt.phase === "setup" && tac.style === "fake"){
    var fk = tac.fake, gf = GEO[fk];
      // копим факт "видели опорника у фейкового сайта" пока не поздно — читать
      // фейк можно только если реально знаем, что там кто-то БЫЛ
      if(!tt._fakeCtSeen && intelEstimate("T", gf.anchor.x, gf.anchor.y, 550, 4*TICK_HZ).n > 0) tt._fakeCtSeen = tick;
      if(tick >= tt.execTick - 14*TICK_HZ){
        if(!tt.fakeOn){ tt.fakeOn = tick;
          logEvent("T: фейк на "+fk+" — шумим и кидаем гранаты, выход на "+tt.site);
           }
        // на фейке сняли своего — второй не лезет туда же, держит с точки сбора
        tt._fakeHold = picEvents("T").some(function(sg){ return sg.type === "died" && tick - sg.tick < 10*TICK_HZ && Math.hypot(sg.x-gf.tEntry.x, sg.y-gf.tEntry.y) < 450; });
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
            }
          } else if(sawCtAtFakeEarly && stillThere && tick - tt.fakeOn > 10*TICK_HZ){
            tt._fakeRead = tick;
            logEvent("IGL: на "+fk+" не купились — держит место, играем по плану");
          }
        }
      }
  }
  // ---- выход: две волны (энтри и поддержка сразу, IGL и носитель — после
  // первого контакта или через 4,5 с), энтри ждёт флешку тиммейта ----
  tt.go = {};
  if(tt.phase === "execute"){
    var since = tick - (tt.execStart || tick), rush = tac.style === "rush";
    var DELAY = tac.style === "split" ? {entry:0, awp:10, support:0, igl:30} : {entry:0, awp:40, support:20, igl:90}; // сплит: обе группы заходят разом
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
    ts.forEach(function(b){
      var r = roleT(b), ok;
      if(r === "lurker") ok = !!tt.wave2 && since > 8*TICK_HZ;            // лёркер подтягивается, когда сайт уже берут
      else if(r === "entry" && nadeFlags.peekFlashPlanned) ok = (nadeFlags.peekFlashPop && tick - nadeFlags.peekFlashPop >= 0) || since > 3*TICK_HZ;
      else if(!rush && (r === "igl" || (b === carrier && r !== "entry"))) ok = !!tt.wave2;
      else ok = since >= (DELAY[r] !== undefined ? DELAY[r] : 60);
      tt.go[b.id] = ok;
    });
  }
  // ---- после планта: отход от взрыва, анти-дефуз (успевает ли кто) ----
  tt.flee = false; tt.antiDef = false; tt.lateIds = null;
  if(tt.phase === "postplant"){
    if(bombTimeLeftTicks() < 6*TICK_HZ && !bots.some(function(o){ return o.defusing; })){
      tt.flee = true; if(!tt.fleeLogged){ tt.fleeLogged = true; logEvent("T: уходим от бомбы — сейчас рванёт"); }
    }
    if(tt._defLate){
      if(bots.some(function(o){ return o.defusing && o.alive; })) tt._defLateSeen = tick;
      if(tick - (tt._defLateSeen || tt._defLate) > 2*TICK_HZ) tt._defLate = null;
    }
    defuseContTick();
    if(!tt.flee && !tt._defLate && BAL.antiDefuse && tDefuseGo(tt, ts)){
      tt.antiDef = true;
      var bpA = {x:bomb.x, y:bomb.y}, near = ts.filter(function(b){ return !b.planting && Math.hypot(b.x-bpA.x, b.y-bpA.y) < 1100; });
      if(BAL.defuseReach){
        // не успеть — не бежать на троих: сколько осталось дефузить и сколько бежать
        var remT = tDefuseLeftGuess(ts);
        if(remT != null){
          var late = near.filter(function(b){ return pathLenTo(b, bpA.x, bpA.y)/SPEED*TICK_HZ > remT + 24; });
          if(late.length && late.length === near.length && !tt._defLate){ tt._defLate = tick; tt.antiDef = false; }
          else { tt.lateIds = {}; late.forEach(function(b){ tt.lateIds[b.id] = 1; }); }
        }
      }
    }
  }
  tAssign(tt, ts, roleT, other);
  teamActTick("T", ts);
}
// план IGL у T: у каждого — район и точка сбора (по тактике: группы, маршруты
// по названиям зон, мид со стороны T, лёркер у другого сайта, фейкеры)
function tAssign(tt, ts, roleT, other){
  var tac = tt.tac, k = tt.site, g = GEO[k];
  var inDef = tt.defUntil && tick < tt.defUntil && tick < tt.execTick - tt.needT*TICK_HZ && tac.style !== "default";
  var S = tt.stage || (tt.stage = {}), A = tt.assign = {};
  var mid = {pt:GEO.tMid, look:GEO.tMidLook, area:"M"};
  var siteP = function(kk){ return {pt:GEO[kk].tStage, look:GEO[kk].tEntry, area:kk}; };
  var plan = {};
  ts.forEach(function(b){ var r = roleT(b), P = null;
    if(r === "lurker") P = siteP(other);
    else if(inDef) P = r === "entry" ? siteP(other) : r === "support" ? mid : siteP(k);
    else if(tac.groups){ tac.groups.forEach(function(G, gi){ if(P || G.roles.indexOf(r) < 0) return;
        if(G.stage === "TMID") P = {pt:mid.pt, look:mid.look, area:"M", via:G.via};
        else { var sp = G.stage ? (zonePoint(G.stage, g.tStage) || g.tStage) : g.tStage; P = {pt:sp, look: G.look ? (zonePoint(G.look, sp) || g.tEntry) : g.tEntry, area:k, via: tt.defUntil ? null : G.via, key:gi}; } }); }
    else if(tac.style === "exec") P = r === "support" ? mid : siteP(k);
    else if(tac.style === "default") P = (r === "entry" || r === "support") ? siteP(other) : r === "awp" ? mid : siteP(k);
    else if(tac.style === "split") P = (r === "awp" || r === "support") ? mid : siteP(k);
    else if(tac.style === "fake") P = r === "support" ? (tt.fakeOn && !tt._fakeHold ? {pt:GEO[tac.fake].tEntry, look:GEO[tac.fake].anchor, area:tac.fake} : siteP(tac.fake)) : siteP(k);
    P = P || siteP(k);
    var key = r+"|"+k+"|"+Math.round(P.pt.x)+","+Math.round(P.pt.y);
    var old = S[b.id];
    S[b.id] = old && old.key2 === key ? old : {pt:P.pt, look:P.look, area:P.area, via:P.via, key:P.key != null ? P.key : r, key2:key};
    A[b.id] = P.area;
  });
}
