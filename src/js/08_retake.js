// ======================= ШАГ 6: ретейк (план §8, §11.1 п.6) =======================
// После планта у CT роли: Defuser (дефузит; предпочтительно с китом) / Cover
// (держит углы с видом на бомбу, пока идёт дефуз) / Flank (заходит с другой
// стороны) / Save (если ретейк безнадёжен — см. выше).
// Синхронизация: сначала каждый идёт к своей ТОЧКЕ СБОРА — укрытию у сайта,
// откуда бомбу не видно (не подставляться по одному под пост-плант позиции
// T); точки сбора выводятся из геометрии сами: кольцо 230-480px вокруг
// бомбы, делится на сектора по направлению, в каждом — ближайшее к CT
// укрытие. Заходят все вместе, когда у точек собралось достаточно людей —
// или раньше, если по честному расчёту иначе не успеть (путь от точки сбора
// до бомбы + дефуз > остаток таймера).
function pathLenTo(b, x, y){
  var p = buildWaypointPath(b.baseX, b.baseY, b.z, x, y, 0);
  var L = 0, px = b.baseX, py = b.baseY;
  p.forEach(function(q){ L += Math.hypot(q[0]-px, q[1]-py); px = q[0]; py = q[1]; });
  return L;
}
// где бомба по мнению CT: пока её никто не видел и не подошёл — по писку
// примерно (±140px в начале, к концу таймера писк частый — почти точно)
function ctBombPos(){
  if(!bomb || bomb.state !== "planted") return {x:bomb.x, y:bomb.y};
  if(!bomb.ctSeen){
    var seen = bots.some(function(o){ return o.alive && o.team === "CT" && (Math.hypot(o.x-bomb.x, o.y-bomb.y) < 300 || (Math.hypot(o.x-bomb.x, o.y-bomb.y) < 1100 && hasVision(o.x, o.y, bomb.x, bomb.y))); });
    if(seen){ bomb.ctSeen = tick; voiceLog("CT", "bombseen", "CT", "вижу бомбу — "+calloutName(bomb.x, bomb.y)); }
  }
  if(bomb.ctSeen) return {x:bomb.x, y:bomb.y};
  if(!bomb.ctNoise){ var a = hashRand(bomb.plantTick*7 + 3)*Math.PI*2, r = 60 + hashRand(bomb.plantTick*11 + 5)*80; bomb.ctNoise = {dx:Math.cos(a)*r, dy:Math.sin(a)*r}; }
  var k = Math.max(0.15, bombTimeLeftTicks()/BOMB_TICKS);
  return walk({x: bomb.x + bomb.ctNoise.dx*k, y: bomb.y + bomb.ctNoise.dy*k});
}
function computeApproaches(){
  var bp = ctBombPos();
  var sectors = {};
  NAVAREAS.forEach(function(z){
    if(NAV_BLOCKED[z.id] || !(zoneGraph[z.id]||[]).length) return;
    var c = zoneCentroid(z);
    var d = Math.hypot(c.x-bp.x, c.y-bp.y);
    if(d < 230 || d > 480 || insideSolidWall(c.x, c.y)) return;
    if(hasLOS(c.x, c.y, bp.x, bp.y)) return; // укрытие: бомбу отсюда не видно
    var ang = Math.atan2(c.y-bp.y, c.x-bp.x);
    var sec = Math.floor(((ang + Math.PI) / (Math.PI*2)) * 6) % 6; // 6 секторов по 60°
    var dCT = Math.hypot(c.x-CT_SPAWN.x, c.y-CT_SPAWN.y);
    // предпочитаем то, что ближе к стороне CT и ближе к бомбе
    var sc = dCT*0.6 + d*0.4;
    if(!sectors[sec] || sc < sectors[sec].sc) sectors[sec] = {x:c.x, y:c.y, sc:sc, sec:sec};
  });
  var list = Object.keys(sectors).map(function(k){ return sectors[k]; }).sort(function(a,b){ return a.sc - b.sc; });
  // до 3 точек, не соседние сектора (иначе это один и тот же заход)
  var out = [];
  list.forEach(function(p){
    if(out.length >= 3) return;
    if(out.some(function(q){ var dd = Math.abs(q.sec - p.sec); return Math.min(dd, 6-dd) < 2; })) return;
    out.push(p);
  });
  // сначала — названные точки сбора (Temple, CT Lane, Back Halls, 90…),
  // если от них бомбу не видно (укрытие) и они не дальше ~650
  if(POS[bomb.site]){
    var named = [];
    POS[bomb.site].ctRetake.forEach(function(n){
      var zp = zonePoint(n, bp); if(!zp) return;
      var d = Math.hypot(zp.x-bp.x, zp.y-bp.y); if(d < 180 || d > 650) return;
      var sp = pickSpots("rt:"+n, zp, 1, {rMax:110, minGap:40, hideFrom:[bp]})[0] || zp;
      if(hasLOS(sp.x, sp.y, bp.x, bp.y)) return;
      var ang = Math.atan2(sp.y-bp.y, sp.x-bp.x), sec = Math.floor(((ang + Math.PI) / (Math.PI*2)) * 6) % 6;
      if(named.some(function(q){ var dd = Math.abs(q.sec - sec); return Math.min(dd, 6-dd) < 2; })) return;
      named.push({x:sp.x, y:sp.y, sec:sec, name:n});
    });
    if(named.length){
      out.forEach(function(p){ if(named.length < 3 && !named.some(function(q){ var dd = Math.abs(q.sec - p.sec); return Math.min(dd, 6-dd) < 2; })) named.push(p); });
      out = named.slice(0, 3);
    }
  }
  if(!out.length){ var gs = GEO[bomb.site]; out.push({x:gs.ctEntry.x, y:gs.ctEntry.y, sec:0}); }
  return out;
}
function updateRetake(cts){
  var BP = ctBombPos(); // где бомба по мнению CT (писк), а не точка в игре
  var R = bomb.retake;
  if(!R){
    R = bomb.retake = {approaches: computeApproaches(), assign:{}, phase:"gather", goTick:-1};
    logEvent("CT: ретейк "+bomb.site+" — "+R.approaches.length+" точк"+(R.approaches.length===1?"а":"и")+" сбора"+
      (R.approaches.some(function(a){ return a.name; }) ? " ("+R.approaches.map(function(a){ return a.name || "укрытие"; }).join(", ")+")" : ""), "team");
  }
  // роли: дефузер — с китом и ближе всех; фланг — самый дальний от основной точки,
  // если людей 3+ и точек сбора больше одной; остальные — прикрытие
  var alive = cts.filter(function(b){ return !b._saveSpot; });
  if(!alive.length) return;
  var main = R.approaches[0];
  alive.forEach(function(b){
    if(R.assign[b.id] !== undefined) return;
    var bi = 0, bd = Infinity;
    R.approaches.forEach(function(a, i){ var d = Math.hypot(a.x-b.baseX, a.y-b.baseY); if(d < bd){ bd = d; bi = i; } });
    R.assign[b.id] = bi;
  });
  if(alive.length >= 3 && R.approaches.length > 1 && !R.flankSet){
    R.flankSet = true;
    var onMain = alive.filter(function(b){ return R.assign[b.id] === 0; });
    if(onMain.length === alive.length){
      var far = onMain.slice().sort(function(a,b){ return Math.hypot(b.baseX-main.x,b.baseY-main.y) - Math.hypot(a.baseX-main.x,a.baseY-main.y); })[0];
      R.assign[far.id] = 1;
    }
  }
  var def = null, dBest = Infinity;
  // дефузер выбран — остаётся им, пока жив (раньше выбирался каждый тик заново:
  // двое по очереди получали "дефузить"/"прикрывать" и дёргались на месте)
  var prevDef = R.defId && alive.filter(function(b){ return b.id === R.defId; })[0];
  if(prevDef) def = prevDef;
  else alive.forEach(function(b){
    var d = Math.hypot(b.baseX-BP.x, b.baseY-BP.y) - (b.kit ? 400 : 0); // кит важнее пары метров
    if(d < dBest){ dBest = d; def = b; }
  });
  if(def) R.defId = def.id;
  alive.forEach(function(b){ b.retakeRole = (b === def) ? "defuser" : (R.assign[b.id] !== 0 ? "flank" : "cover"); });
  if(BAL.ninjaDefuse && (R.phase === "gather" || R.phase === "util") && def && ninjaOk()){
    var tLeftN = bombTimeLeftTicks()/TICK_HZ, dN = Math.hypot(def.x-BP.x, def.y-BP.y);
    if(tLeftN > dN/SPEED*1.3 + (def.kit ? 5 : 10) + 1){
      R.phase = "go"; R.goTick = tick; R.ninja = tick; R.entryId = "-";
      voiceLog("CT", "ninja", def.id, "их нет у бомбы — тихо дефузю, прикройте");
      logEvent("CT: ниндзя-дефуз — все T известны далеко от бомбы", "team");
    }
  }
  if(R.phase === "gather"){
    var ready = alive.filter(function(b){ var a = R.approaches[R.assign[b.id]]; return Math.hypot(a.x-b.baseX, a.y-b.baseY) < 70; }).length;
    var need = Math.min(alive.length, alive.length >= 3 ? 3 : alive.length);
    if(BAL.groupRetake){
      // у про второй заходит через ~3с после первого, у ботов было 5с: ждём
      // каждого, кто успевает дойти до своей точки сбора и ещё зайти на дефуз
      var sL = bombTimeLeftTicks()/TICK_HZ, aD = R.approaches[R.assign[def.id]] || R.approaches[0];
      var gN = Math.hypot(aD.x-BP.x, aD.y-BP.y)/SPEED*1.3 + (def.kit ? 5 : 10) + 1.5;
      need = alive.filter(function(b){ var ap = R.approaches[R.assign[b.id]] || aD; return pathLenTo(b, ap.x, ap.y)/SPEED <= sL - gN - 2; }).length;
      need = Math.max(1, need);
      if(!R.gStart) R.gStart = tick;
    }
    var secsLeft = bombTimeLeftTicks()/TICK_HZ;
    // сколько нужно на заход: от точки сбора до бомбы + дефуз
    var a0 = R.approaches[R.assign[def.id]];
    var goNeed = Math.hypot(a0.x-BP.x, a0.y-BP.y)/SPEED*1.3 + (def.kit ? 5 : 10) + 1.5;
    var late = secsLeft - goNeed < 3;
    if(ready >= need || late){
      // ретейк как команда: сначала утилита (флешка на сайт/на известного T,
      // смок на подход T), заход — под хлопок; если гранат нет или время
      // поджимает — сразу
      var util = BAL.retakeRoles && !late && alive.length >= 2 && retakeUtil(R, alive);
      if(util){ R.phase = "util"; R.utilTick = tick;
        logEvent("CT: ретейк — все на точках ("+ready+"/"+alive.length+"), "+util+" — заход под флешку", "team"); }
      else { R.phase = "go"; R.goTick = tick;
        logEvent("CT: ретейк — заходим! ("+ready+"/"+alive.length+" на точках"+(late ? ", время поджимает" : "")+")", "team"); }
    }
    R.ready = ready; R.need = need;
  }
  if(R.phase === "util"){
    var popped = nadeFlags["pop:ретейк"] !== undefined && tick - nadeFlags["pop:ретейк"] >= 6;
    var lateU = bombTimeLeftTicks()/TICK_HZ - ((def ? Math.hypot(def.x-BP.x, def.y-BP.y) : 400)/SPEED*1.3 + (def && def.kit ? 5 : 10) + 1.5) < 3;
    if(popped || tick - R.utilTick > 2.2*TICK_HZ || lateU){
      R.phase = "go"; R.goTick = tick;
      logEvent("CT: ретейк — заходим"+(popped ? " под флешку!" : "!"), "team");
    }
  }
  // дефуз под смоком: дефузер подходит к бомбе — смок на неё (его или тиммейта),
  // T с пост-плант позиций не видят того, кто дефузит
  if(BAL.defuseSmoke && R.phase === "go" && !nadeFlags.defSmoke && def && aliveCount("T") > 0){
    var bpS = ctBombPos(), dDef = Math.hypot(def.x-bpS.x, def.y-bpS.y);
    if(dDef < 420 && !smokeCovered(bpS.x, bpS.y)){
      var smk = [def].concat(alive.filter(function(b){ return b !== def; })).filter(function(b){ return b.nades && b.nades.smoke > 0 && !b.nadeTask && Math.hypot(b.x-bpS.x, b.y-bpS.y) < NADE_THROW_RANGE; })[0];
      if(smk && assignNade(smk, "smoke", bpS, "смок на бомбу — дефуз под ним", {now:true})){ nadeFlags.defSmoke = tick;
        voiceLog("CT", "defsmk", smk.id, smk === def ? "кидаю смок на бомбу, дефужу под ним" : "смок на бомбу — "+def.id+", дефузь под ним"); }
    }
  }
  // первый входящий: не дефузер, из основной точки захода, ближе всех к бомбе
  if(R.phase === "go" && BAL.retakeRoles && !R.entryId){
    var ents = alive.filter(function(b){ return b !== def; });
    ents.sort(function(a, c){ return ((R.assign[a.id] === 0 ? 0 : 300) + Math.hypot(a.x-BP.x, a.y-BP.y)) - ((R.assign[c.id] === 0 ? 0 : 300) + Math.hypot(c.x-BP.x, c.y-BP.y)); });
    R.entryId = ents[0] ? ents[0].id : "-";
    if(ents[0]) voiceLog("CT", "rtentry", ents[0].id, "захожу первым, "+(def ? def.id+" дефузит за мной" : "прикрывайте"));
  }
}
// утилита перед заходом на ретейк: кто кидает флешку (не дефузер, если можно)
// и куда — на известного T у бомбы (свежая инфа), иначе на саму бомбу
function retakeUtil(R, alive){
  if(nadeFlags.retakeFlash) return null;
  var bp = ctBombPos(), def = alive.filter(function(b){ return b.id === R.defId; })[0];
  var fls = alive.filter(function(b){ return b.nades && b.nades.flash > 0; })
    .sort(function(a, c){ return ((a === def) ? 500 : 0) + Math.hypot(a.x-bp.x, a.y-bp.y) - (((c === def) ? 500 : 0) + Math.hypot(c.x-bp.x, c.y-bp.y)); });
  var fl = fls[0]; if(!fl) return null;
  var tgt = bp, L = picKnown("CT"), bestA = Infinity;
  for(var id in L){ var e = L[id]; if(tick - e.tick > 10*TICK_HZ) continue; if(Math.hypot(e.x-bp.x, e.y-bp.y) > 650) continue;
    var dd = Math.hypot(e.x-fl.x, e.y-fl.y); if(dd < bestA){ bestA = dd; tgt = {x:e.x, y:e.y}; } }
  if(!assignNade(fl, "flash", tgt, "ретейк", {bkey:"CT.retake.flash."+bomb.site, now:true, range:900})) return null;
  nadeFlags.retakeFlash = true;
  var gs = GEO[bomb.site];
  var smr = alive.filter(function(b){ return b !== fl && b.nades && b.nades.smoke > 0; })[0];
  if(smr && !nadeFlags.retakeSmoke && retakeCutUseful()){ nadeFlags.retakeSmoke = true; assignNade(smr, "smoke", gs.tEntry, "отрезать вход T", {bkey:"CT.retake.smoke."+bomb.site, now:true}); }
  voiceLog("CT", "rtflash", fl.id, "даю флешку "+(tgt === bp ? "на бомбу" : "на "+calloutName(tgt.x, tgt.y))+" — заходим на хлопок");
  return fl.id+" кидает флешку"+(smr ? ", "+smr.id+" — смок" : "");
}
function retakePost(b, cts){
  var R = bomb.retake; if(!R){ return; }
  var bp = ctBombPos();
  var a = R.approaches[R.assign[b.id] || 0];
  if(R.phase === "gather" || R.phase === "util"){
    // стоим в укрытии и смотрим туда, откуда будет заход
    // один из собирающихся смотрит не на бомбу, а в спину — туда, откуда может
    // прийти лёркер (проход между сайтами), пока T ещё хватает на люрк
    if(BAL.lurkCheck && aliveCount("T") >= 2){
      if(!R.backWatch){ var bwb = null, bwd = Infinity; cts.forEach(function(c){ var d = Math.hypot(c.x-GEO.rotator.x, c.y-GEO.rotator.y); if(d < bwd){ bwd = d; bwb = c; } }); R.backWatch = bwb ? bwb.id : "-";
        if(bwb) voiceLog("CT", "back", bwb.id, "смотрю спину — может прийти люрк"); }
      if(R.backWatch === b.id){ setPost(b, a, GEO.rotator, true, "gather"+(R.assign[b.id]||0), 0); return; }
    }
    setPost(b, a, bp, true, "gather"+(R.assign[b.id]||0), 0);
    return;
  }
  if(b.retakeRole === "defuser"){
    // дефузер не тапает бомбу сразу на заходе (под пост-плант позиции T):
    // сначала первый входящий чистит, дефузер — за ним. Сразу — если время
    // поджимает, он один или первый уже на сайте/погиб
    if(BAL.retakeRoles && !retakeDefGo(b, R, cts)){
      var dsp = pickSpots("retakeD"+bomb.site+"_"+(R.assign[b.id]||0), bp, 1, {rMin:120, rMax:320, minGap:60, must:[bp], see:[a]})[0];
      setPost(b, dsp || a, bp, true, "retakeCover"); return;
    }
    setPost(b, bp, null, true, "defuse"); return;
  }
  // остальные заходят за первым с задержкой ~0.5с (не толпой в один проход)
  if(BAL.groupRetake && R.goTick >= 0){
    if(!R.delay){
      R.delay = {}; var dm = 0;
      R.approaches.forEach(function(ap){ dm = Math.max(dm, Math.hypot(ap.x-bp.x, ap.y-bp.y)); });
      R.approaches.forEach(function(ap, i){ R.delay[i] = Math.min(2.5*TICK_HZ, Math.max(0, (dm - Math.hypot(ap.x-bp.x, ap.y-bp.y))/SPEED*TICK_HZ)); });
    }
    var dl = R.delay[R.assign[b.id]||0] || 0;
    if(tick - R.goTick < dl){ setPost(b, a, bp, true, "gather"+(R.assign[b.id]||0), 0); return; }
  }
  if(BAL.retakeRoles && R.entryId && R.entryId !== "-" && b.id !== R.entryId && tick - R.goTick < 0.5*TICK_HZ){
    setPost(b, a, bp, true, "gather"+(R.assign[b.id]||0), 0); return;
  }
  // прикрытие/фланг — места с видом на бомбу, со своей стороны захода
  var others = cts.filter(function(c){ return c.retakeRole !== "defuser" && !c.defusing && R.assign[c.id] === R.assign[b.id]; });
  var spots = pickSpots("retake"+bomb.site+"_"+(R.assign[b.id]||0), bp, others.length, {rMin:80, rMax:300, minGap:90, must:[bp], see:[a]});
  var oi = Math.max(0, others.indexOf(b));
  setPost(b, spots[oi] || bp, bp, true, (BAL.retakeRoles && b.id === R.entryId) ? "retakeEntry" : "retake");
}
function retakeDefGo(b, R, cts){
  var bp = ctBombPos();
  var secsLeft = bombTimeLeftTicks()/TICK_HZ;
  var late2 = secsLeft - (Math.hypot(b.x-bp.x, b.y-bp.y)/SPEED*1.2 + (b.kit ? 5 : 10) + 1) < 2.5;
  if(late2) return true;
  if(cts.filter(function(o){ return !o._saveSpot; }).length <= 1) return true;
  var ent = R.entryId && bots.filter(function(o){ return o.id === R.entryId; })[0];
  if(!ent || !ent.alive) return true;
  if(Math.hypot(ent.x-bp.x, ent.y-bp.y) < 280) return true;
  return tick - R.goTick > 2.5*TICK_HZ;
}
