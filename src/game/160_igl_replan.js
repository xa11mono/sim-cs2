// ---- IGL: перестройка плана по ходу раунда ----
// Раньше IGL менял план в двух случаях (стак на сайте / минус опорника), а в
// остальном играл "по бумажке": потеряли человека на миде — всё равно ждём
// тайминга; энтри и поддержку сняли на входе — оставшиеся двое по одному
// лезли в тот же прострелянный угол. Теперь:
//  1) минус в сетапе, а убийца далеко от нашего сайта — их человек не там,
//     заходим раньше, пока он не вернулся;
//  2) минус двое без размена в сетапе — лёркер возвращается к группе, заход
//     всеми вместе (не распыляемся 3 против 5);
//  3) выход провалился (на входе потеряли двоих больше, чем убили) — не
//     добиваем себя, отходим; если на другом сайте по инфе пусто и время есть —
//     переходим туда, иначе перегруппировка и повторный заход вместе.
// (6) бомба уже на сайте (носитель в ~4м от точки) — никаких переколов:
// раньше колл уводил носителя, и он пробегал сайт, не поставив
// (v247) ОДНО РЕШЕНИЕ IGL НА ОДНО СОБЫТИЕ. Раньше один и тот же фраг запускал сразу несколько решений
// («перекол на B», «не спешим», «заходим сразу») в соседних тиках — команда слышала противоречивые коллы.
// Теперь событие (фраг / смерть / инфа) двигает план не больше одного раза: первое сработавшее решение
// забирает событие; решения по более старым событиям не принимаются. Решает и говорит IGL.
// (22.11, аудит 019) решение IGL «раз за раунд» — до смены ситуации: живых T, живых CT и сайта плана. Было — флаг до конца раунда: после новых смертей
// / перекола ветка больше не пересматривалась. iglOnce(tt, k) — решение k ещё не принято в этой ситуации; iglDone(tt, k) — принято
function iglSit(tt){ return roundNum + ":" + aliveCount("T") + ":" + aliveCount("CT") + ":" + tt.site; }
function iglOnce(tt, k){ return !(tt._once && tt._once[k] === iglSit(tt)); }
function iglDone(tt, k){ (tt._once || (tt._once = {}))[k] = iglSit(tt); }
// (22.11, аудит 020) фаза плана T и время выхода — один хозяин (IGL): запись только здесь
function tPhase(tt, ph){ if(tt.phase !== ph) tt._phT = tick; tt.phase = ph; }
function tExecAt(tt, tk){ tt.execTick = tk; }
function iglTake(tt, evTick){ if(evTick <= (tt._evDone||-1)) return false; tt._evDone = evTick; return true; }
function carrierAtSite(tt){
  if(bomb.state !== "carried" || !bomb.carrier || !bomb.carrier.alive) return false;
  var S = SITES[tt.site]; return Math.hypot(bomb.carrier.x-S.x, bomb.carrier.y-S.y) < 330 || onSite(S, bomb.carrier.x, bomb.carrier.y);
}
// (22.11, аудит 059) время группы T до точки — по пути (медиана живых, кроме лёркера), а не «прямая × 1,4» от центра группы; одно место
// для перекола по ротации, отмены выхода и ускорения после минуса
function iglTravel(x, y){
  var ts = bots.filter(function(b){ return b.team === "T" && b.alive && b.tRole !== "lurker"; }); if(!ts.length) ts = bots.filter(function(b){ return b.team === "T" && b.alive; });
  var t = ts.map(function(b){ return pathLenTo(b, x, y)/(SPEED*weaponSpeedMul(b)); }).sort(function(a, c){ return a - c; });
  return t.length ? t[t.length >> 1] : Infinity;
}
// ожидаемые CT по карте команды T (belief — своё знание) у точки: зоны с центром ближе r
function iglCtNear(x, y, r){ var m = 0; BZ.cent.forEach(function(c, j){ if(c && Math.hypot(c.x-x, c.y-y) < r) m += beliefZoneKnown("T", j); }); return m; }
var CONT_SEC = 6, CONT_REGROUP = 6;   // с: решение о продолжении дефолта — за столько до выхода; перестроиться — столько (проектные числа)
function tIglReplan(tt, site, other, secLeft){
  var DL = tt._dl || [], aliveT = aliveCount("T"), aliveCT = aliveCount("CT");
  if(bomb.state === "planted" || aliveT <= 1) return false;
  if(carrierAtSite(tt)) return false;
  // (v561, этап 3 docs/tasks/PLAN_TACTICS_V2.md; PRO_PLAY §6з: «тактика — не маршрут, а начало + продолжения; продолжение — по тому, что узнали»)
  // дефолт — начало: в конце фазы дефолта (defUntil — группа идёт на точку выхода; нет её — за CONT_SEC до выхода) IGL выбирает продолжение на этот сайт из выходов и сплитов набора — путь, который команда уже держит
  // (свой в 250 px от точки пути), лучше; где команда знает свежего CT (300 px) — хуже; поровну — жребий. Группа перестраивается под него
  // (выход — не раньше чем через CONT_REGROUP с). Тактика раунда в памяти матча — начало (tt.open)
  if(tt.phase === "setup" && tt.tac.style === "default" && !tt._cont && tt.site === tt.tac.site && aliveT >= 3 && tt.execTick > tick && (tt.defUntil ? tick >= tt.defUntil : tt.execTick - tick <= CONT_SEC*TICK_HZ)){
    tt._cont = tick;
    var tsC = bots.filter(function(b){ return b.team === "T" && b.alive; });
    var contScore = function(t){ var sc = 0; t.groups.forEach(function(g){ (g.via || []).forEach(function(n){ var zp = zonePoint(n, site); if(!zp) return;
      if(tsC.some(function(b){ return Math.hypot(b.x-zp.x, b.y-zp.y) < 250; })) sc += 1;
      sc -= 2*Math.min(1, iglCtNear(zp.x, zp.y, 300)); }); }); return sc; };   // (аудит 059) CT по карте команды (с давностью), было — «свежий виденный в 300»
    var cands = T_TACTICS.filter(function(t){ return t.site === tt.site && (t.style === "exec" || t.style === "split") && t.groups && t.groups.length; });
    var bestC = null, bsC = -Infinity;
    // (22.11, аудит 059, владелец: «убрать случайное число») было: + жребий до 0,5. Равные по оценке — то, что дольше не играли в этом матче
    // (CT читают повторы — та же память, что у выбора тактики, tacHist), затем — что чаще выигрывали (tacMem); жребия нет
    var since = function(t){ var k = tacHist.lastIndexOf(t.id); return k < 0 ? 1e9 : tacHist.length - k; }, wr = function(t){ var M = tacMem[t.id]; return M && M.n ? M.w/M.n : 0.5; };
    cands.forEach(function(t){ var v = contScore(t);
      if(v > bsC + 1e-9 || (Math.abs(v - bsC) <= 1e-9 && bestC && (since(t) > since(bestC) || (since(t) === since(bestC) && wr(t) > wr(bestC))))){ bsC = v; bestC = t; } });
    if(bestC){
      tt.open = tt.open || tt.tac; tt.tac = bestC; tExecAt(tt, Math.max(tt.execTick, tick + CONT_REGROUP*TICK_HZ));
      voiceLog("T", "cont"+roundNum, "IGL", "после дефолта — "+bestC.name);
      logEvent("IGL: дефолт → продолжение «"+bestC.name+"» (держим путь: "+Math.max(0, Math.round(bsC))+")");
    }
  }
  if(tt.phase === "setup"){
    var sd = DL.filter(function(e){ return e.t === "T" && e.phase === "setup"; });
    var last = sd[sd.length-1];
    // (1) убийца далеко от нашего сайта
    // (22.11, аудит 059) было: окно 1,5–4 с после минуса и «убийца дальше 1100 по прямой». Стало — гонка по пути: CT, который нас убил, обратно на
    // наш сайт идёт path(место убийцы → сайт) / скорость минус уже прошедшее; мы — время группы по пути + 4 с на подготовку выхода (то же, что ниже
    // ставится в execTick). Успеваем раньше — заходим раньше; пока минус не разменян и событие не взято. Решение — по каждому тику до выхода,
    // а не в окне: перестали успевать — не ускоряемся
    var raceOk = function(e){ if(e.kx === null) return false; var back = polyLen(pathPts(e.kx, e.ky, site.x, site.y))/SPEED - (tick - e.tick)/TICK_HZ; return iglTravel(site.x, site.y) + 4 < back; };
    if(last && !tt._rpFast && last.kx !== null && tick % 16 === 0 &&
       aliveT >= 3 && tt.execTick - tick > 6*TICK_HZ && !last.traded && last.tick > (tt._evDone||-1)){
      if(raceOk(last) && iglTake(tt, last.tick)){
        tt._rpFast = true;
        tExecAt(tt, Math.max(tick + 4*TICK_HZ, Math.min(tt.execTick, tick + 6*TICK_HZ)));
        voiceLog("T", "rpfast", "IGL", "их игрок "+calloutName(last.kx, last.ky)+" — на "+tt.site+" без него, заходим раньше!");
        logEvent("IGL: минус в сетапе, но CT далеко от "+tt.site+" — выход раньше");
      }
    }
    // (0) сняли CT в сетапе, мы в большинстве — не спешим: контроль карты и
    // выход всей группой (не дарить размен, заходя по одному в спешке)
    if(!tt._upSlow && aliveT >= aliveCT + 1 && secLeft > 50){
      var cdS = DL.filter(function(e){ return e.t === "CT" && e.phase === "setup"; });
      var lastC = cdS[cdS.length-1];
      if(lastC && tick - lastC.tick < 2*TICK_HZ && iglTake(tt, lastC.tick)){
        tt._upSlow = tick; tt._rpFast = true; // и не ускоряемся на следующий минус
        if(tt.execTick - tick < 8*TICK_HZ) tExecAt(tt, tick + 8*TICK_HZ);
        voiceLog("T", "upslow", "IGL", aliveT+" на "+aliveCT+" — не спешим, берём карту и заходим все вместе");
        logEvent("IGL: численный перевес "+aliveT+"v"+aliveCT+" — без спешки, выход всей группой");
      }
    }
    // (2) двое без размена — лёркер к нам
    var untraded = sd.filter(function(e){ return !e.traded; }).length;
    if(!tt.regroup && untraded >= 2 && aliveT <= 3 && aliveCT >= aliveT && iglTake(tt, sd[sd.length-1].tick)){
      var lk = bots.filter(function(b){ return b.team === "T" && b.alive && b.tRole === "lurker"; })[0];
      tt.regroup = tick;
      if(lk){ lk._route = null; lk._routeDone = null; }
      tExecAt(tt, Math.max(tt.execTick, tick + 5*TICK_HZ)); // дать дойти
      voiceLog("T", "regroup", "IGL", "минус два — "+(lk ? lk.id+" к нам, " : "")+"заходим все вместе");
      logEvent("IGL: потеряли двоих без размена — перегруппировка"+(lk ? " (лёркер "+lk.id+" к основной группе)" : ""));
    }
    // (S8) слышим ротацию CT на наш сайт — можно перейти на другой. Но это
    // только чтение, не гарантия: IGL верит ему не всегда (~60%), и другой сайт
    // НЕ считается пустым — заходим туда обычным выходом, с гранатами и чеком углов
    if(!tt.rebound && iglOnce(tt, "rot") && aliveT >= 3 && secLeft > 45 && tick % 16 === 0){
      var RH = tt._rotH || (tt._rotH = {});
      teamIntel.T.sig.forEach(function(sg){ if((sg.type !== "spotted" && sg.type !== "sound") || !sg.id || sg.id === "?" || tick - sg.tick > 16) return;
        var h = RH[sg.id] || (RH[sg.id] = []); if(!h.length || sg.tick - h[h.length-1].tick >= TICK_HZ){ h.push({x:sg.x, y:sg.y, tick:sg.tick}); if(h.length > 3) h.shift(); } });
      var toward = [];
      for(var rid in RH){ var h = RH[rid]; if(h.length < 2) continue; var a0 = h[0], a1 = h[h.length-1]; if(tick - a1.tick > 6*TICK_HZ) continue;
        var dS0 = Math.hypot(a0.x-site.x, a0.y-site.y), dS1 = Math.hypot(a1.x-site.x, a1.y-site.y);
        var dO0 = Math.hypot(a0.x-SITES[other].x, a0.y-SITES[other].y), dO1 = Math.hypot(a1.x-SITES[other].x, a1.y-SITES[other].y);
        if(dS0 - dS1 > 120 && dO1 - dO0 > 80 && dS1 < 1400) toward.push(rid); }
      if(toward.length >= (aliveCT <= 3 ? 1 : 2) && !tSiteTaking(tt) && iglTake(tt, tick)){   // (22.11, Ж16) сайт берётся — не уходим
        iglDone(tt, "rot");
        // (22.11, аудит 059) было: «верим чтению» жребием 60 %. Стало — сравнение по карте команды (ротация уже в ней — гипотезы движения): CT ожидается
        // на другом сайте меньше, чем на нашем, и время дойти туда по пути оставляет 15 с на выход (то же, что при отмене выхода ниже)
        var ctHere = beliefCount("T", BZ.siteNear[tt.site] || []), ctOther = beliefCount("T", BZ.siteNear[other] || []), trvR = iglTravel(SITES[other].x, SITES[other].y);
        if(ctOther < ctHere && secLeft > trvR + 15){
          tt.rebound = true;
          voiceLog("T", "rotread", "IGL", toward.length+" CT ротируют на "+tt.site+" — идём на "+other+", но углы чекаем, там может кто-то остаться");
          logEvent("IGL: слышим ротацию CT на "+tt.site+" → перекол на "+other+" (не значит, что там пусто)");
          tSetSite(tt, other); tPhase(tt, "setup");
          tExecAt(tt, tick + Math.round(Math.min(Math.max(4, trvR*0.7), 12)*TICK_HZ));
          return true;
        } else logEvent("IGL: слышим ротацию CT на "+tt.site+", но на "+other+" их не меньше (" + ctOther.toFixed(1) + " против " + ctHere.toFixed(1) + ") или не успеть — играем по плану");
      }
    }
    return false;
  }
  if(tt.phase === "execute" && iglOnce(tt, "abort") && tt.execStart != null && tick - tt.execStart < 10*TICK_HZ && secLeft > 40){
    var tD = DL.filter(function(e){ return e.t === "T" && e.tick >= tt.execStart; }).length;
    var cD = DL.filter(function(e){ return e.t === "CT" && e.tick >= tt.execStart; }).length;
    var lastD = DL.length ? DL[DL.length-1].tick : tick;
    if(tD - cD >= 2 && aliveT <= 3 && aliveCT >= aliveT && iglTake(tt, lastD)){
      tt.aborted = tick; iglDone(tt, "abort");
      var otherB = beliefCount("T", BZ.siteNear[other]||[]);
      var tsA = bots.filter(function(b){ return b.team === "T" && b.alive; });
      var travel = iglTravel(SITES[other].x, SITES[other].y);   // (аудит 059) по пути, было — прямая × 1,4
      var goOther = otherB < 1.2 && secLeft > travel + 15 && !tSiteTaking(tt);   // (22.11, Ж16)
      tsA.forEach(function(b){ b._route = null; b._routeDone = null; b._stageInfo = null; });
      tt.takeAssign = null; tt.plantPick = null; tt.wave2 = null; tt.w1Contact = null; tt._popDone = false; tt._waitLog = false;
      nadeFlags.tExec = false; nadeFlags.tExecSm = false; nadeFlags.peekFlashPlanned = false;
      if(goOther){
        tSetSite(tt, other); tPhase(tt, "setup"); tExecAt(tt, tick + Math.round(Math.min(travel*0.8, 14)*TICK_HZ));
        voiceLog("T", "abort", "IGL", "выход не прошёл — отходим, все на "+other+"!");
        logEvent("IGL: выход провалился ("+tD+" наших против "+cD+") — отход, перекол на "+other);
      } else {
        tPhase(tt, "setup"); tt.execStart = null; tExecAt(tt, tick + 6*TICK_HZ);
        voiceLog("T", "abort", "IGL", "стоп, отходим — перегруппируемся и заходим вместе");
        logEvent("IGL: выход провалился ("+tD+" наших против "+cD+") — отход и повторный заход на "+tt.site);
      }
      return true;
    }
  }
  return false;
}
function fl2idx(b){ return bots.filter(function(o){ return o._midFlank && o._midFlank.round === roundNum; }).indexOf(b) > 0 ? 1 : 0; }
// (13) сбор перед выходом в две точки (набор карты: tactics.plays.stageSplit — нижняя low, верхняя up для второй пары,
// upLook — куда смотрит верхняя). На Ancient так у B (T Lower + T Upper), а не Ruins: точка 560px по пути от сайта
// попадала глубоко назад, выход шёл растянутой колонной через весь Ramp
function bStageFix(){
  var SS = MAP.tactics.plays.stageSplit || {};
  for(var k in SS){
    var g = GEO[k]; if(!g || g._lowSet) continue;
    var lo = zonePoint(SS[k].low, SITES[k]); if(!lo) continue;
    g._lowSet = true; g._tStageOrig = g.tStage;
    g.tStage = pickSpots(k.toLowerCase()+"stageLow", lo, 1, {rMax:140, minGap:40, hideFrom:[SITES[k], g.anchor], see:[g.tEntry]})[0] || lo;
    var up = zonePoint(SS[k].up, SITES[k]);
    if(up) g.tStageUp = pickSpots(k.toLowerCase()+"stageUp", up, 1, {rMax:140, minGap:40, hideFrom:[SITES[k], g.anchor]})[0] || up;
  }
}
var AHEAD_GAP = 120;   // (v450) ед. карты: «уже впереди точки подготовки» — проектное число
function stagePost(mem, k){
  var g = GEO[k], opt = {rMax:200, minGap:50, hideFrom:[SITES[k], g.anchor], see:[g.tEntry], avoidNades: tDeathSpots()};
  // (v450, владелец 28.10: м1 р6 — «почти вышли на B, у игрока 0 появляется якорь stageB, который ведёт назад. Зачем?») точка подготовки —
  // одна на всех, и кто уже прошёл дальше неё к сайту (после перекола, после дефолта), шёл назад «собираться». Теперь он ждёт там, где
  // стоит, — в укрытии рядом (≤ 160 ед., не видно с сайта и с якоря CT, видно вход), а выход начинается и от него. «Дальше» — ближе к сайту
  // по пути, чем точка подготовки, на AHEAD_GAP (проектное число)
  if(!mem.length) return;
  var dSt = pathLenTo({baseX:g.tStage.x, baseY:g.tStage.y, z:g.tStage.z}, SITES[k].x, SITES[k].y);
  mem = mem.filter(function(b){
    if(!(dSt > 0)) return true;
    var dB = pathLenTo(b, SITES[k].x, SITES[k].y); if(!(dB > 0) || dB > dSt - AHEAD_GAP) return true;
    if(b.post && /^stage/.test(b.post.tag) && taskProp(b.post.tag, "waitsAhead")) return false;   // уже ждёт впереди
    groupPost([b], {x:b.x, y:b.y}, g.tEntry, "stage"+k+":ahead", {rMax:160, minGap:40, hideFrom:[SITES[k], g.anchor], see:[g.tEntry]});
    return false; });
  if(!mem.length) return;
  var SSk = (MAP.tactics.plays.stageSplit || {})[k];
  if(SSk && g.tStageUp && mem.length >= 3){
    // двое-трое ниже, один-двое выше (Ancient B: T Lower → Ramp и T Upper → Rat/Dark): выход с двух сторон
    var nUp = mem.length >= 4 ? 2 : 1;
    var srt = mem.slice().sort(function(a, c){ return Math.hypot(a.x-g.tStageUp.x, a.y-g.tStageUp.y) - Math.hypot(c.x-g.tStageUp.x, c.y-g.tStageUp.y); });
    var ups = srt.filter(function(b){ return b.tRole !== "entry"; }).slice(0, nUp), low = mem.filter(function(b){ return ups.indexOf(b) < 0; });
    var upLook = zonePoint(SSk.upLook, g.tStageUp) || g.tEntry;
    groupPost(low, g.tStage, g.tEntry, "stage"+k, opt);
    ups.forEach(function(b){ b._stageInfo = {from:g.tStageUp, to:upLook, look:SITES[k], round:roundNum}; });
    groupPost(ups, g.tStageUp, upLook, "stage"+k+":"+SSk.up, {rMax:160, minGap:50, hideFrom:[SITES[k], g.anchor], see:[upLook]});
    return;
  }
  groupPost(mem, g.tStage, g.tEntry, "stage"+k, opt);
}
// (аудит 11.10) смена сайта плана T — одно место. Раньше из пяти мест смены только два снимали маршруты к старому сайту,
// и ни одно — гранаты-задания туда: через 5 с после смены у кого-то из T в 37 % смен ещё был маршрут, а в части смен —
// граната в сторону старого сайта. Снимается то, что T делали под старый сайт; фаза и тайминг выхода — у вызывающего
// (22.11, Ж16, владелец: «терры убили двоих на сайте и сделали перекол на другой сайт»; прогон v583n Mirage: 4 эпизода, м13 р7 — 4 убийства у A,
// один CT с 13 HP у A, двое T → «B вероятно пустой — идём») «сайт берётся»: в этом раунде мы убили CT у нашего сайта (sig «kill» — свои
// видели / киллфид), у сайта есть наши живые (не лёркер, по пути ≤ BOMB_HERE_R), и по знанию команды CT там не больше, чем нас там. Тогда
// реактивного перекола нет — доигрываем этот сайт (добить, поставить). Стак больше нас — перекол как раньше. Плановый фейк и «успеваем
// поставить» на сейве / в одиночку это не трогает. Было: ветки перекола не знали, что защитники сняты и мы уже здесь
function tSiteTaking(tt){
  var S = tt && SITES[tt.site]; if(!S) return false;
  var kills = (teamIntel.T.sig || []).filter(function(sg){ return sg.type === "kill" && sg.tick >= roundStartTick && nearP(sg.x, sg.y, null, S.x, S.y, null, BOMB_HERE_R); }).length;
  if(!kills) return false;
  var tNear = bots.filter(function(b){ return b.team === "T" && b.alive && b.tRole !== "lurker" && nearP(b.x, b.y, b.z, S.x, S.y, null, BOMB_HERE_R); }).length;
  return tNear > 0 && beliefCount("T", BZ.siteNear[tt.site] || []) <= tNear;
}
function tSetSite(tt, site){
  var old = tt.site;
  // (v450, владелец 28.10: «в экономике после главной тактики писать перекол») — для показа (630): откуда и куда перекол
  if(old && site && old !== site) (tt.recalls || (tt.recalls = [])).push({from: old, to: site, sec: Math.round((tick - roundStartTick)/TICK_HZ)});
  tt.site = site; tt.execStart = null; tt.plantPick = null;
  // (п.4 владельца 29.10, м1 р2 т11617: после перекола B→A T1 остался на «siteholdA: B Boost») места на сайте (takeAssign) — под
  // старый сайт; сбрасывались только в двух местах смены из пяти
  if(old !== site) tt.takeAssign = null;
  nadeFlags.tExec = false; nadeFlags.tExecSm = false; nadeFlags.peekFlashPlanned = false;
  bots.forEach(function(b){
    if(b.team !== "T") return;
    // маршрут тактики задан под старый сайт — снят и помечен пройденным, чтобы тактика не запустила его заново
    // (раньше два пути смены обнуляли и «пройден», и группа снова шла по маршруту к старому сайту)
    if(b._route) b._routeDone = b._route.key + "|" + roundNum;
    b._route = null; b._stageInfo = null;
    // (п.4 владельца 29.10, м1 р2: после перекола B→A носитель ещё 3 с шёл на «stageB» в B Apartments) пост под старый сайт (стадия,
    // зачистка, удержание) — снят: новый даст тактика под новый сайт
    var tg = b.post && b.post.tag;
    // (v519, пак 09.11 п.12) и проба под старый сайт (у пробы свой тег probe…, раньше не снималась — после перекола бот ещё шёл «посмотреть» старый сайт)
    if(old && old !== site && tg && (tg.indexOf("stage" + old) === 0 || tg.indexOf("sitehold" + old) === 0 || tg.indexOf("clear" + old) === 0 || (tg.indexOf("probe" + old) === 0))){ clearPost(b); if(b._probe) b._probe = null; }
    var t = b.nadeTask;
    if(old && old !== site && t && SITES[old] && Math.hypot(t.x-SITES[old].x, t.y-SITES[old].y) < Math.hypot(t.x-SITES[site].x, t.y-SITES[site].y)){
      nadeCancel(b, "igl-site"); if(b.post && taskProp(b.post.tag, "lineupTask")) clearPost(b);
    }
  });
}
