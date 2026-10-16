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
function iglTake(tt, evTick){ if(evTick <= (tt._evDone||-1)) return false; tt._evDone = evTick; return true; }
function carrierAtSite(tt){
  if(!BAL.carrierStay || bomb.state !== "carried" || !bomb.carrier || !bomb.carrier.alive) return false;
  var S = SITES[tt.site]; return Math.hypot(bomb.carrier.x-S.x, bomb.carrier.y-S.y) < 330 || onSite(S, bomb.carrier.x, bomb.carrier.y);
}
function tIglReplan(tt, site, other, secLeft){
  var DL = tt._dl || [], aliveT = aliveCount("T"), aliveCT = aliveCount("CT");
  if(bomb.state === "planted" || aliveT <= 1) return false;
  if(carrierAtSite(tt)) return false;
  if(tt.phase === "setup"){
    var sd = DL.filter(function(e){ return e.t === "T" && e.phase === "setup"; });
    var last = sd[sd.length-1];
    // (1) убийца далеко от нашего сайта
    if(last && !tt._rpFast && tick - last.tick > 1.5*TICK_HZ && tick - last.tick < 4*TICK_HZ && last.kx !== null &&
       aliveT >= 3 && tt.execTick - tick > 6*TICK_HZ && !last.traded){
      var dS = Math.hypot(last.kx-site.x, last.ky-site.y);
      if(dS > 1100 && iglTake(tt, last.tick)){
        tt._rpFast = true;
        tt.execTick = Math.max(tick + 4*TICK_HZ, Math.min(tt.execTick, tick + 6*TICK_HZ));
        voiceLog("T", "rpfast", "IGL", "их игрок "+calloutName(last.kx, last.ky)+" — на "+tt.site+" без него, заходим раньше!");
        logEvent("IGL: минус в сетапе, но CT далеко от "+tt.site+" — выход раньше");
      }
    }
    // (0) сняли CT в сетапе, мы в большинстве — не спешим: контроль карты и
    // выход всей группой (не дарить размен, заходя по одному в спешке)
    if(BAL.numbersPlay && !tt._upSlow && aliveT >= aliveCT + 1 && secLeft > 50){
      var cdS = DL.filter(function(e){ return e.t === "CT" && e.phase === "setup"; });
      var lastC = cdS[cdS.length-1];
      if(lastC && tick - lastC.tick < 2*TICK_HZ && iglTake(tt, lastC.tick)){
        tt._upSlow = tick; tt._rpFast = true; // и не ускоряемся на следующий минус
        if(tt.execTick - tick < 8*TICK_HZ) tt.execTick = tick + 8*TICK_HZ;
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
      tt.execTick = Math.max(tt.execTick, tick + 5*TICK_HZ); // дать дойти
      voiceLog("T", "regroup", "IGL", "минус два — "+(lk ? lk.id+" к нам, " : "")+"заходим все вместе");
      logEvent("IGL: потеряли двоих без размена — перегруппировка"+(lk ? " (лёркер "+lk.id+" к основной группе)" : ""));
    }
    // (S8) слышим ротацию CT на наш сайт — можно перейти на другой. Но это
    // только чтение, не гарантия: IGL верит ему не всегда (~60%), и другой сайт
    // НЕ считается пустым — заходим туда обычным выходом, с гранатами и чеком углов
    if(BAL.rotRead && !tt.rebound && !tt._rotDone && aliveT >= 3 && secLeft > 45 && tick % 16 === 0){
      var RH = tt._rotH || (tt._rotH = {});
      teamIntel.T.sig.forEach(function(sg){ if((sg.type !== "spotted" && sg.type !== "sound") || !sg.id || sg.id === "?" || tick - sg.tick > 16) return;
        var h = RH[sg.id] || (RH[sg.id] = []); if(!h.length || sg.tick - h[h.length-1].tick >= TICK_HZ){ h.push({x:sg.x, y:sg.y, tick:sg.tick}); if(h.length > 3) h.shift(); } });
      var toward = [];
      for(var rid in RH){ var h = RH[rid]; if(h.length < 2) continue; var a0 = h[0], a1 = h[h.length-1]; if(tick - a1.tick > 6*TICK_HZ) continue;
        var dS0 = Math.hypot(a0.x-site.x, a0.y-site.y), dS1 = Math.hypot(a1.x-site.x, a1.y-site.y);
        var dO0 = Math.hypot(a0.x-SITES[other].x, a0.y-SITES[other].y), dO1 = Math.hypot(a1.x-SITES[other].x, a1.y-SITES[other].y);
        if(dS0 - dS1 > 120 && dO1 - dO0 > 80 && dS1 < 1400) toward.push(rid); }
      if(toward.length >= (aliveCT <= 3 ? 1 : 2) && iglTake(tt, tick)){
        tt._rotDone = tick;
        if(hashRand(roundNum*389 + matchNum*23 + 7) < 0.6){
          tt.rebound = true;
          var ctrR = {x:0, y:0}, tsR = bots.filter(function(b){ return b.team === "T" && b.alive; });
          tsR.forEach(function(b){ ctrR.x += b.x/tsR.length; ctrR.y += b.y/tsR.length; });
          var trvR = Math.hypot(ctrR.x-SITES[other].x, ctrR.y-SITES[other].y)*1.4/SPEED;
          voiceLog("T", "rotread", "IGL", toward.length+" CT ротируют на "+tt.site+" — идём на "+other+", но углы чекаем, там может кто-то остаться");
          logEvent("IGL: слышим ротацию CT на "+tt.site+" → перекол на "+other+" (не значит, что там пусто)");
          tSetSite(tt, other); tt.phase = "setup"; tt.takeAssign = null;
          tt.execTick = tick + Math.round(Math.min(Math.max(4, trvR*0.7), 12)*TICK_HZ);
          return true;
        } else logEvent("IGL: слышим ротацию CT на "+tt.site+", но это может быть фейк — играем по плану");
      }
    }
    return false;
  }
  if(tt.phase === "execute" && !tt.aborted && tt.execStart != null && tick - tt.execStart < 10*TICK_HZ && secLeft > 40){
    var tD = DL.filter(function(e){ return e.t === "T" && e.tick >= tt.execStart; }).length;
    var cD = DL.filter(function(e){ return e.t === "CT" && e.tick >= tt.execStart; }).length;
    var lastD = DL.length ? DL[DL.length-1].tick : tick;
    if(tD - cD >= 2 && aliveT <= 3 && aliveCT >= aliveT && iglTake(tt, lastD)){
      tt.aborted = tick;
      var otherB = beliefCount("T", BZ.siteNear[other]||[]);
      var ctr = {x:0, y:0}, tsA = bots.filter(function(b){ return b.team === "T" && b.alive; });
      tsA.forEach(function(b){ ctr.x += b.x/tsA.length; ctr.y += b.y/tsA.length; });
      var travel = Math.hypot(ctr.x-SITES[other].x, ctr.y-SITES[other].y)*1.4/SPEED;
      var goOther = otherB < 1.2 && secLeft > travel + 15;
      tsA.forEach(function(b){ b._route = null; b._routeDone = null; b._stageInfo = null; });
      tt.takeAssign = null; tt.plantPick = null; tt.wave2 = null; tt.w1Contact = null; tt._popDone = false; tt._waitLog = false;
      nadeFlags.tExec = false; nadeFlags.tExecSm = false; nadeFlags.peekFlashPlanned = false;
      if(goOther){
        tSetSite(tt, other); tt.phase = "setup"; tt.execTick = tick + Math.round(Math.min(travel*0.8, 14)*TICK_HZ);
        voiceLog("T", "abort", "IGL", "выход не прошёл — отходим, все на "+other+"!");
        logEvent("IGL: выход провалился ("+tD+" наших против "+cD+") — отход, перекол на "+other);
      } else {
        tt.phase = "setup"; tt.execStart = null; tt.execTick = tick + 6*TICK_HZ;
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
  if(!BAL.bStageLow) return;
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
function stagePost(mem, k){
  var g = GEO[k], opt = {rMax:200, minGap:50, hideFrom:[SITES[k], g.anchor], see:[g.tEntry], avoidNades: BAL.tAdapt ? tDeathSpots() : []};
  if(!mem.length) return;
  var SSk = (MAP.tactics.plays.stageSplit || {})[k];
  if(SSk && BAL.bStageLow && g.tStageUp && mem.length >= 3){
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
function tSetSite(tt, site){
  var old = tt.site;
  tt.site = site; tt.execStart = null; tt.plantPick = null;
  nadeFlags.tExec = false; nadeFlags.tExecSm = false; nadeFlags.peekFlashPlanned = false;
  bots.forEach(function(b){
    if(b.team !== "T") return;
    // маршрут тактики задан под старый сайт — снят и помечен пройденным, чтобы тактика не запустила его заново
    // (раньше два пути смены обнуляли и «пройден», и группа снова шла по маршруту к старому сайту)
    if(b._route) b._routeDone = b._route.key + "|" + roundNum;
    b._route = null; b._stageInfo = null;
    var t = b.nadeTask;
    if(old && old !== site && t && SITES[old] && Math.hypot(t.x-SITES[old].x, t.y-SITES[old].y) < Math.hypot(t.x-SITES[site].x, t.y-SITES[site].y)){
      nadeDrop(b, "смена сайта", true);
    }
  });
}
// (v359, отметка владельца р4: «почему не занимают позиции под плант — Palace, Ramp…», лёрк zont1x стоял в Underpass) на время
// после планта T встают на места про (набор карты pos.<сайт>.tPost — где про стоят после планта, по демкам), в пределах слышимости
// дефуза; каждому — своё, ближайшее по пути. Раньше — любые укрытия в 300–620 ед. от бомбы, имена мест не учитывались
function ppTimeNamed(group, bp0, site, rMax){
  var P = POS[site] && POS[site].tPost; if(!P || !P.length) return false;
  var pts = []; P.forEach(function(n){ var zp = zonePoint(n, bp0); if(zp && Math.hypot(zp.x-bp0.x, zp.y-bp0.y) <= rMax && !pts.some(function(q){ return Math.hypot(q.x-zp.x, q.y-zp.y) < 110; })) pts.push({n:n, x:zp.x, y:zp.y}); });
  if(!pts.length) return false;
  var used = {};
  group.forEach(function(b){
    var C = b._ppTN; if(C && C.round === roundNum && C.site === site && pts[C.i] && !used[C.i]){ used[C.i] = true; setPost(b, pts[C.i], bp0, true, "postplant:time:"+pts[C.i].n); return; }
    var best = null, bd = Infinity;
    pts.forEach(function(q, i){ if(used[i]) return; var d = pathLenTo(b, q.x, q.y); if(d < bd){ bd = d; best = i; } });
    if(best == null) best = 0;   // мест меньше, чем игроков, — к ближайшему
    used[best] = true; b._ppTN = {round: roundNum, site: site, i: best};
    setPost(b, pts[best], bp0, true, "postplant:time:"+pts[best].n);
  });
  return true;
}
