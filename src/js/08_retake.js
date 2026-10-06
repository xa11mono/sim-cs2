// ======================= ретейк CT =======================
// План команды после планта (фазы сбор → утилита → заход, дефузер, первый
// входящий) — updateRetake. Куда встать на сборе и заходе — выбор действия
// (12_team.js) по разметке карты. Сейв — план CT (12_ct_brain.js).
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
    if(seen){ bomb.ctSeen = tick; }
  }
  if(bomb.ctSeen) return {x:bomb.x, y:bomb.y};
  if(!bomb.ctNoise){ var a = hashRand(bomb.plantTick*7 + 3)*Math.PI*2, r = 60 + hashRand(bomb.plantTick*11 + 5)*80; bomb.ctNoise = {dx:Math.cos(a)*r, dy:Math.sin(a)*r}; }
  var k = Math.max(0.15, bombTimeLeftTicks()/BOMB_TICKS);
  return walk({x: bomb.x + bomb.ctNoise.dx*k, y: bomb.y + bomb.ctNoise.dy*k});
}
// (v190) план ретейка — фазы команды: сбор → (утилита) → заход; дефузер и первый
// входящий. Точки сбора и захода — выбор действия (12_team.js) по разметке:
// сбор — укрытие своей стороны у входа на сайт, бомбу оттуда не видно; заход —
// укрытия с линией на бомбу.
function updateRetake(cts){
  var BP = ctBombPos(); // где бомба по мнению CT (писк), а не точка в игре
  var R = bomb.retake;
  if(!R){ R = bomb.retake = {phase:"gather", goTick:-1}; logEvent("CT: ретейк "+bomb.site+" — собираемся"); }
  var alive = cts.filter(function(b){ return !b._awpSave; });
  if(!alive.length) return;
  var def = null, dBest = Infinity;
  // дефузер выбран — остаётся им, пока жив
  var prevDef = R.defId && alive.filter(function(b){ return b.id === R.defId; })[0];
  if(prevDef) def = prevDef;
  else alive.forEach(function(b){
    var d = Math.hypot(b.baseX-BP.x, b.baseY-BP.y) - (b.kit ? 400 : 0); // кит важнее пары метров
    if(d < dBest){ dBest = d; def = b; }
  });
  if(def) R.defId = def.id;
  alive.forEach(function(b){ b.retakeRole = (b === def) ? "defuser" : "cover"; });
  if(BAL.ninjaDefuse && (R.phase === "gather" || R.phase === "util") && def && ninjaOk()){
    var tLeftN = bombTimeLeftTicks()/TICK_HZ, dN = Math.hypot(def.x-BP.x, def.y-BP.y);
    if(tLeftN > dN/SPEED*1.3 + (def.kit ? 5 : 10) + 1){
      R.phase = "go"; R.goTick = tick; R.ninja = tick; R.entryId = "-";
      logEvent("CT: ниндзя-дефуз — все T известны далеко от бомбы");
    }
  }
  var gp = function(b){ return b._act && b._act.mode === "gather" && b._act.round === roundNum ? b._act : {x:b.x, y:b.y}; };
  if(R.phase === "gather"){
    var ready = alive.filter(function(b){ return b._act && b._act.mode === "gather" && b.atPost; }).length;
    var sL = bombTimeLeftTicks()/TICK_HZ, aD = gp(def);
    var goNeed = Math.hypot(aD.x-BP.x, aD.y-BP.y)/SPEED*1.3 + (def.kit ? 5 : 10) + 1.5;
    // ждём каждого, кто успевает дойти до своей точки сбора и ещё зайти на дефуз
    var need = Math.max(1, alive.filter(function(b){ var ap = gp(b); return pathLenTo(b, ap.x, ap.y)/SPEED <= sL - goNeed - 2; }).length);
    var late = sL - goNeed < 3;
    if(ready >= need || late){
      // ретейк как команда: сначала утилита, заход — под хлопок; нет гранат или время поджимает — сразу
      var util = BAL.retakeRoles && !late && alive.length >= 2 && retakeUtil(R, alive);
      if(util){ R.phase = "util"; R.utilTick = tick;
        logEvent("CT: ретейк — все на точках ("+ready+"/"+alive.length+"), "+util+" — заход под флешку"); }
      else { R.phase = "go"; R.goTick = tick;
        logEvent("CT: ретейк — заходим! ("+ready+"/"+alive.length+" на точках"+(late ? ", время поджимает" : "")+")"); }
    }
    R.ready = ready; R.need = need;
  }
  if(R.phase === "util"){
    var popped = nadeFlags["pop:ретейк"] !== undefined && tick - nadeFlags["pop:ретейк"] >= 6;
    var lateU = bombTimeLeftTicks()/TICK_HZ - ((def ? Math.hypot(def.x-BP.x, def.y-BP.y) : 400)/SPEED*1.3 + (def && def.kit ? 5 : 10) + 1.5) < 3;
    if(popped || tick - R.utilTick > 2.2*TICK_HZ || lateU){
      R.phase = "go"; R.goTick = tick;
      logEvent("CT: ретейк — заходим"+(popped ? " под флешку!" : "!"));
    }
  }
  // дефуз под смоком: дефузер подходит к бомбе — смок на неё
  if(BAL.defuseSmoke && R.phase === "go" && !nadeFlags.defSmoke && def && aliveCount("T") > 0){
    var bpS = ctBombPos(), dDef = Math.hypot(def.x-bpS.x, def.y-bpS.y);
    if(dDef < 420 && !smokeCovered(bpS.x, bpS.y)){
      var smk = [def].concat(alive.filter(function(b){ return b !== def; })).filter(function(b){ return b.nades && b.nades.smoke > 0 && !b.nadeTask && Math.hypot(b.x-bpS.x, b.y-bpS.y) < NADE_THROW_RANGE; })[0];
      if(smk && assignNade(smk, "smoke", bpS, "смок на бомбу — дефуз под ним", {now:true})){ nadeFlags.defSmoke = tick; }
    }
  }
  // первый входящий: не дефузер, ближе всех к бомбе
  if(R.phase === "go" && BAL.retakeRoles && !R.entryId){
    var ents = alive.filter(function(b){ return b !== def; });
    ents.sort(function(a, c){ return Math.hypot(a.x-BP.x, a.y-BP.y) - Math.hypot(c.x-BP.x, c.y-BP.y); });
    R.entryId = ents[0] ? ents[0].id : "-";
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
  return fl.id+" кидает флешку"+(smr ? ", "+smr.id+" — смок" : "");
}
function retakeDefGo(b, R, cts){
  var bp = ctBombPos();
  var secsLeft = bombTimeLeftTicks()/TICK_HZ;
  var late2 = secsLeft - (Math.hypot(b.x-bp.x, b.y-bp.y)/SPEED*1.2 + (b.kit ? 5 : 10) + 1) < 2.5;
  if(late2) return true;
  if(cts.filter(function(o){ return !o._awpSave; }).length <= 1) return true;
  var ent = R.entryId && bots.filter(function(o){ return o.id === R.entryId; })[0];
  if(!ent || !ent.alive) return true;
  if(Math.hypot(ent.x-bp.x, ent.y-bp.y) < 280) return true;
  return tick - R.goTick > 2.5*TICK_HZ;
}
