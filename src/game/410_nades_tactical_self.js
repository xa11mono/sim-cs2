// ---------- тактическое использование ----------
var nadeFlags = {};
var comboCd = {}; // раздел 11.1: кулдаун комбо-гранаты на конкретного замеченного врага
function antiEco(team){
  if(!BAL.antiEco) return false;
  var me = teamEco[team], en = teamEco[team === "CT" ? "T" : "CT"];
  if(BAL.buyRead){
    // не "знаем" чужой закуп, а читаем: по оружию, которое реально увидели
    // (первые контакты), иначе — по оценке денег до раунда
    var R = teamIntel[team] && teamIntel[team].buy;
    var enEco = R && R.n >= 1 ? R.read === "eco" : !!(me && me.enemyGuess && me.enemyGuess.eco);
    return !!(me && (me.roundType === "full" || me.roundType === "half") && enEco);
  }
  return me && en && (me.roundType === "full" || me.roundType === "half") && en.roundType === "eco";
}
// (13) инфа о закупе врага по первым контактам: увидели — запомнили, с чем он.
// Двое+ с пистолетами → эко; хоть одна винтовка/AWP → закуп (эко-оценка снимается)
function buyReadSee(team, eid){
  var e = bots.filter(function(o){ return o.id === eid; })[0]; if(!e || !e.alive) return;
  var TI = teamIntel[team], R = TI.buy || (TI.buy = {seen:{}, n:0, pistols:0, rifles:0, smg:0, read:null});
  if(R.seen[eid]) return;
  // (v293, владелец 14.10) пистолетка — у всех пистолеты, это не эко: оценку закупа по оружию не делаем
  if(teamEco[team] && teamEco[team].roundType === "pistol") return;
  var k = e.primary || null, W = k && WEAPONS[k];
  R.seen[eid] = k || "pistol"; R.n++;
  if(!W) R.pistols++; else if(W.price >= 2000) R.rifles++; else R.smg++;
  var prev = R.read;
  if(R.rifles >= 1 || (R.smg + R.rifles >= 2)) R.read = "buy";
  else if(R.pistols >= 2) R.read = "eco";
  else if(R.pistols >= 1 && R.n === 1) R.read = R.read || null;
  if(R.read && R.read !== prev && team === "CT" && teamTac.CT){ var myT = teamEco.CT && teamEco.CT.roundType; teamTac.CT.antiEco = R.read === "eco" && (myT === "full" || myT === "force" || myT === "half"); }
  if(R.read && R.read !== prev){
    var mate = bots.filter(function(o){ return o.team === team && o.alive; })[0];
    if(mate) voiceLog(team, "buy"+R.read, mate.id, R.read === "eco" ? "у них пистолеты ("+R.pistols+" видели) — эко, не лезем в упор, держим дистанцию"
      : "у "+eid+" "+(W ? W.name : "оружие")+" — это закуп, не эко");
    logEvent(team+": закуп врага по контактам — "+(R.read === "eco" ? "эко" : "закуп")+" (видели: "+R.n+", винтовок "+R.rifles+", пистолетов "+R.pistols+")");
  }
}
function nadeCombos(){
  ["CT","T"].forEach(function(team){
    if(typeof teamIntel === "undefined") return;
    var mine = bots.filter(function(b){ return b.team===team && b.alive; });
    if(mine.length < 2) return;
    if(antiEco(team)) return; // против эко комбо-гранаты не тратим
    var sig = teamIntel[team].sig, seen = {};
    for(var i=sig.length-1;i>=0;i--){
      var s = sig[i]; if(s.type !== "spotted") continue;
      if(tick - s.tick > 20) continue; // только очень свежий контакт — комбо не по старой памяти
      if(!seen[s.id]) seen[s.id] = s;
    }
    Object.keys(seen).forEach(function(eid){
      var key = team+":"+eid;
      if(tick < (comboCd[key]||0)) return;
      var s = seen[eid];
      if(fires.some(function(f){ return Math.hypot(f.x-s.x, f.y-s.y) < 100; })) return;
      var cands = mine.filter(function(b){
        var dd = Math.hypot(b.x-s.x, b.y-s.y);
        return nadeCanTake(b, NADE_LEVEL.react, b.nades.molly>0 ? "molly" : b.nades.he>0 ? "he" : "flash", s) && !b.planting && !b.defusing && !b._sawEnemy &&
               dd >= 140 && dd <= NADE_THROW_RANGE && // не кидать себе под ноги в упор
               (b.nades.molly>0 || b.nades.he>0 || b.nades.flash>0);
      });
      if(mine.some(function(o){ return o.alive && !cands.includes(o) && Math.hypot(o.x-s.x, o.y-s.y) < 130; })) return;
      if(cands.length < 2) return;
      cands.sort(function(a,b2){ return Math.hypot(a.x-s.x,a.y-s.y) - Math.hypot(b2.x-s.x,b2.y-s.y); });
      var order = ["molly","he","flash"], typesUsed = {}, thrown = 0;
      for(var ci=0; ci<cands.length && thrown<2; ci++){
        var b = cands[ci];
        var t = order.filter(function(tp){ return b.nades[tp]>0 && !typesUsed[tp]; })[0];
        if(!t) continue;
        assignNade(b, t, {x:s.x, y:s.y}, "комбо по "+eid, {now:true, lvl:NADE_LEVEL.react});
        typesUsed[t] = true; thrown++;
      }
      if(thrown >= 2){
        comboCd[key] = tick + 16*TICK_HZ;
        logEvent(team+" комбо-граната по "+eid+": "+Object.keys(typesUsed).join("+"));
      }
    });
  });
}
// ---- (v244, из переделки) гранаты «себе» по своему знанию ----
//  • смок под плант: носитель на сайте, по его знанию кто-то видит точку планта — смок на себя;
//  • флешка под выход: путь через ~250 px выведет на место, где по знанию может стоять враг (весомая
//    гипотеза; без инфы — типичное место врага, которое бот ещё не видел пустым, и только близкое к выходу).
// Бросок — через assignNade (одно место броска). Числа SELF — проектные числа переделки.
var SELF = {
  every:   8,    // как часто бот сверяется, тиков
  threatW: 0.5,  // проектное число: весомая гипотеза врага (как угроза на угол в переделке)
  ahead:   250,  // проектное число: через сколько px пути он выйдет на линию врага
  far:     700,  // проектное число: и не дальше стольких px до врага
  cone:    75,   // проектное число: и не шире стольких ° от направления хода
  spotNear: 350, // проектное число: типичное место без инфы — не дальше стольких px от точки выхода
  sightR:  900   // проектное число: смок под плант — гипотеза врага с линией на точку не дальше стольких px
};
// (v294) стоит ли кидать гранату «на всякий случай» (без увиденного врага): команда ждёт там врага — масса знания (belief) в зоне
// точки и соседних зонах в 300 px ≥ 0,3 врага, или свежая инфа (видели/слышали за 4 с) в 500 px. Числа — проектные
var NADE_WORTH = {r:300, mass:0.3, infoR:500, infoT:4};
function nadeWorth(team, pt){
  var zl = [];
  BZ.cent.forEach(function(c, i){ if(c && Math.hypot(c.x-pt.x, c.y-pt.y) <= NADE_WORTH.r) zl.push(i); });
  var z0 = bzOf(pt.x, pt.y); if(z0 >= 0 && zl.indexOf(z0) < 0) zl.push(z0);
  if(zl.length && beliefCount(team, zl) >= NADE_WORTH.mass) return true;
  var e = intelEstimate(team, pt.x, pt.y, NADE_WORTH.infoR, NADE_WORTH.infoT*TICK_HZ);
  return e.seen + e.heard > 0;
}
function selfHyps(b, fn){
  var K = b.know; if(!K) return;
  for(var id in K.enemies){ var B = K.enemies[id]; if(B.visible) continue;
    B.hyps.forEach(function(h){ if(h.x !== undefined && h.weight >= SELF.threatW) fn(h, id); }); }
}
// смок под плант: бомба у своего, выход на сайт плана идёт (execute) и носитель уже на дистанции броска от сайта —
// кто из T может (сам носитель или свой рядом), кидает смок на точку планта, если по его знанию её кто-то видит.
// (v245) раньше — только когда носитель уже стоит на сайте: он сразу ставил бомбу, смок не успевал ни разу
function selfPlantSmoke(b){
  if(b.team !== "T" || b.nades.smoke <= 0 || !bomb || bomb.state !== "carried" || !bomb.carrier || !bomb.carrier.alive) return false;
  var tt = teamTac.T, k = tt && tt.site; if(!k || !SITES[k] || tt.phase !== "execute" || nadeFlags["plantSmoke"+k]) return false;
  var p = {x:SITES[k].x, y:SITES[k].y}, c = bomb.carrier;
  if(Math.hypot(c.x-p.x, c.y-p.y) > NADE_THROW_RANGE || Math.hypot(b.x-p.x, b.y-p.y) > NADE_THROW_RANGE) return false;
  if(smokes.some(function(q){ return Math.hypot(q.x-p.x, q.y-p.y) < smokeRadiusNow(q); })) return false;
  var seen = null;
  selfHyps(b, function(h){ if(!seen && Math.hypot(h.x-p.x, h.y-p.y) <= SELF.sightR && hasVision(h.x, h.y, p.x, p.y)) seen = h; });
  // инфы нет — типичные места CT, которые бот ещё не видел пустыми (знание карты), откуда видно точку
  if(!seen && b.know) (b.know.spots || []).forEach(function(q){ if(!seen && q.open && knowSpotReach(q) && Math.hypot(q.x-p.x, q.y-p.y) <= SELF.sightR && hasVision(q.x, q.y, p.x, p.y)) seen = q; });
  if(!seen) return false;
  if(!assignNade(b, "smoke", p, "смок под плант — точку видно с " + calloutName(seen.x, seen.y), {now:true, lvl:NADE_LEVEL.bomb})) return false;
  nadeFlags["plantSmoke"+k] = true;
  if(b !== c) voiceLog("T", "psm"+k, b.id, "даю смок под плант " + k);
  return true;
}
function selfExitFlash(b){
  if(b.nades.flash <= 0 || !(b.path && b.pathIdx < b.path.length) || b.heading === undefined || b.curSpeed < 30) return false;
  var cone = SELF.cone*Math.PI/180, cands = [];
  b._selfDone = (b._selfDone && b._selfDone.r === roundNum) ? b._selfDone : {r: roundNum};
  function ahead(x, y){ var d = Math.hypot(x-b.x, y-b.y); if(d > SELF.far || d < 60) return false;
    var a = Math.atan2(y-b.y, x-b.x) - b.heading; return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) <= cone; }
  selfHyps(b, function(h, id){ if(ahead(h.x, h.y)) cands.push({x:h.x, y:h.y, w:h.weight, key:id+":"+h.zone, info:true}); });
  if(!cands.length && b.know && b.know.alive) (b.know.spots || []).forEach(function(p){
    if(p.open && knowSpotReach(p) && ahead(p.x, p.y)) cands.push({x:p.x, y:p.y, w:0, key:"spot:"+p.id, info:false}); });
  var best = null;
  cands.forEach(function(c){
    if(b._selfDone[c.key] || hasLOS(b.x, b.y, c.x, c.y)) return;   // уже на линии — это бой, не выход
    var px = b.x, py = b.y, run = 0, ex = null;
    for(var i = b.pathIdx; i < b.path.length && run <= SELF.ahead; i++){
      var q = b.path[i]; run += Math.hypot(q[0]-px, q[1]-py); px = q[0]; py = q[1];
      if(run <= SELF.ahead && hasLOS(px, py, c.x, c.y)){ ex = {x:px, y:py}; break; }
    }
    if(!ex) return;
    if(bots.some(function(m){ return m !== b && m.alive && m.team === b.team && Math.hypot(m.x-ex.x, m.y-ex.y) < 150; })) return;   // свой уже там
    if(!c.info && Math.hypot(c.x-ex.x, c.y-ex.y) > SELF.spotNear) return;   // дальний угол без инфы — прицелом
    // (v294) типичное место без инфы — только если команда там врага ждёт (у CT «типичное место Connector» рвалось у врага в 38 %)
    if(!c.info && !nadeWorth(b.team, c)) return;
    var d = Math.hypot(c.x-b.x, c.y-b.y);
    if(!best || c.w > best.c.w || (c.w === best.c.w && d < best.d)) best = {c:c, ex:ex, d:d};
  });
  if(!best) return false;
  var c = best.c, ex = best.ex, dE = Math.hypot(c.x-ex.x, c.y-ex.y), kf = Math.min(1, 140/Math.max(1, dE));
  b._selfDone[c.key] = true;
  return assignNade(b, "flash", {x: ex.x + (c.x-ex.x)*kf, y: ex.y + (c.y-ex.y)*kf}, "флешка под выход — " + (c.info ? "по знанию " : "типичное место ") + calloutName(c.x, c.y), {now:true, range:700, lvl:NADE_LEVEL.self});
}
function selfNadeTick(){
  if(roundState !== "live") return;
  bots.forEach(function(b){
    if(!b.alive || !b.nades || b.planting || b.defusing || b._sawEnemy || tick < (b.blindUntil||0)) return;
    if((tick + (b.id.charCodeAt(b.id.length-1)||0)) % SELF.every) return;
    if(selfPlantSmoke(b)) return;
    selfExitFlash(b);
  });
}
// ---- гранаты по ситуации (не по сценарию) ----
//  • молотов на раш: CT слышит 2+ бегущих T у входа на свой сайт — молотов во
//    вход, пока они не зашли (раз за раунд на сайт);
//  • HE в стак: двое+ врагов видели/слышали почти в одной точке (≤160px) —
//    HE туда, если рядом нет своих;
//  • флешка себе под пик: идёт один на угол, за которым свежая инфа о враге
//    (≤5с) — кидает флешку через угол и выходит на хлопок.
var nadeReactCd = {CT:0, T:0};
function nadeReact(){
  if(tick % 8) return;
  // (19) мало HP и враг рядом — выкинуть оставшиеся гранаты во врага, пока жив
  if(BAL.utilDump) bots.forEach(function(b){
    if(!b.alive || b.hp > 25 || !nadeCanSet(b, NADE_LEVEL.fight) || b.planting || b.defusing || !b.nades || tick < (b._dumpCd||0)) return;
    var tp = b.nades.molly > 0 ? "molly" : b.nades.he > 0 ? "he" : b.nades.flash > 0 ? "flash" : null; if(!tp) return;
    var BLd = beliefLast[b.team] || {}, tg = null, bd = Infinity;
    for(var eD in BLd){ var lo = BLd[eD]; if(tick - lo.tick > 3*TICK_HZ) continue; if(!bots.some(function(o){ return o.id === eD && o.alive; })) continue;
      var dd = Math.hypot(lo.x-b.x, lo.y-b.y); if(dd > 140 && dd < NADE_THROW_RANGE && dd < bd){ bd = dd; tg = lo; } }
    if(!tg) return;
    if(bots.some(function(o){ return o !== b && o.alive && o.team === b.team && Math.hypot(o.x-tg.x, o.y-tg.y) < 150; })) return;
    b._dumpCd = tick + 3*TICK_HZ;
    if(assignNade(b, tp, {x:tg.x, y:tg.y}, "у меня "+b.hp+" — кидаю всё", {now:true, lvl:NADE_LEVEL.fight}) && !b._dumpVoice){ b._dumpVoice = roundNum; voiceLog(b.team, "dump"+b.id, b.id, "у меня "+b.hp+" — выкидываю гранаты"); }
  });
  // (16) HE по раненому за укрытием (HE до 57 урона, по броне вдвое меньше)
  if(BAL.heFinish) ["CT","T"].forEach(function(team){
    var HT = teamIntel[team].hurt; if(!HT) return;
    var BLh = beliefLast[team] || {};
    for(var eH in HT){ var h = HT[eH]; if(h.hp > 28 || tick - h.tick > 8*TICK_HZ || h._heDone) continue;
      var lo = BLh[eH]; if(!lo || tick - lo.tick > 3*TICK_HZ) continue;
      if(!bots.some(function(o){ return o.id === eH && o.alive; })) continue;
      if(bots.some(function(o){ return o.alive && o.team === team && Math.hypot(o.x-lo.x, o.y-lo.y) < 170; })) continue;
      var th = bots.filter(function(b){ return b.alive && b.team === team && b.nades && b.nades.he > 0 && nadeCanTake(b, NADE_LEVEL.fight, "he", lo) && !b._sawEnemy &&
        Math.hypot(b.x-lo.x, b.y-lo.y) > 150 && Math.hypot(b.x-lo.x, b.y-lo.y) < NADE_THROW_RANGE && !hasLOS(b.x, b.y, lo.x, lo.y); })[0];
      if(th && assignNade(th, "he", {x:lo.x, y:lo.y}, "HE добить "+eH, {now:true, lvl:NADE_LEVEL.fight})){ h._heDone = true;
        voiceLog(team, "hefin"+eH, th.id, eH+" на "+h.hp+" за углом — HE"); }
    }
  });
  ["A","B"].forEach(function(k){
    if(nadeFlags["rushMolly"+k] || !(bomb.state !== "planted")) return;
    var g = GEO[k], ent = g.tEntry, srcs = {};
    // раньше: только ЗВУК от 2+ T за 1.5с в 550px и ни одного T на сайте —
    // почти не срабатывало (звук через колл приходит с задержкой, часть теряется).
    // Теперь: видели или слышали, окно 2.5с, 700px; в начале раунда (≤25с)
    // хватает одного — это ранний раш; один T уже на сайте — не помеха
    var early = tick - roundStartTick < 25*TICK_HZ;
    teamIntel.CT.sig.forEach(function(sg){ if((sg.type === "sound" || sg.type === "spotted") && tick - sg.tick < 2.5*TICK_HZ && Math.hypot(sg.x-ent.x, sg.y-ent.y) < 700 && sg.id && sg.id !== "?") srcs[sg.id] = 1; });
    if(Object.keys(srcs).length < (early ? 1 : 2)) return;
    var onS = {}; teamIntel.CT.sig.forEach(function(sg){ if(sg.type === "spotted" && sg.id && tick - sg.tick < 1.5*TICK_HZ && Math.hypot(sg.x-SITES[k].x, sg.y-SITES[k].y) < 220) onS[sg.id] = 1; });
    if(Object.keys(onS).length > 1) return; // уже зашли — поздно
    var c = bots.filter(function(b){ return b.alive && b.team === "CT" && b.nades && b.nades.molly > 0 && nadeCanTake(b, NADE_LEVEL.react, "molly", ent) && !b._sawEnemy &&
      Math.hypot(b.x-ent.x, b.y-ent.y) < NADE_THROW_RANGE*1.1 && Math.hypot(b.x-ent.x, b.y-ent.y) > 150; })
      .sort(function(a, b2){ return Math.hypot(a.x-ent.x, a.y-ent.y) - Math.hypot(b2.x-ent.x, b2.y-ent.y); })[0];
    if(!c) return;
    if(assignNade(c, "molly", ent, "молотов на раш "+k, {now:true, lvl:NADE_LEVEL.react})){ nadeFlags["rushMolly"+k] = tick;
      voiceLog("CT", "rushm"+k, c.id, "слышу раш на "+k+" — молотов во вход!"); }
  });
  // (v294) «ранняя граната на задержку» (молотов/HE опорника во вход своего сайта на 7–18 с) убрана: у ботов рвалась рядом с врагом
  // в 3 % случаев; у про такого броска нет (CT молотовы по времени — Mid, T Lower, Ramp — есть в лайнапах про)
  ["CT","T"].forEach(function(team){
    if(tick < nadeReactCd[team]) return;
    var L = beliefLast[team] || {}, pts = [];
    for(var eid in L){ var lo = L[eid]; if(tick - lo.tick > 3*TICK_HZ) continue; var e = bots.filter(function(o){ return o.id === eid; })[0]; if(e && e.alive) pts.push(lo); }
    for(var i=0;i<pts.length;i++) for(var j=i+1;j<pts.length;j++){
      if(Math.hypot(pts[i].x-pts[j].x, pts[i].y-pts[j].y) > 160) continue;
      var tg = {x:(pts[i].x+pts[j].x)/2, y:(pts[i].y+pts[j].y)/2};
      if(bots.some(function(o){ return o.alive && o.team === team && Math.hypot(o.x-tg.x, o.y-tg.y) < 170; })) continue;
      var th = bots.filter(function(b){ return b.alive && b.team === team && b.nades && b.nades.he > 0 && nadeCanTake(b, NADE_LEVEL.react, "he", tg) && !b._sawEnemy && !b.planting && !b.defusing &&
        Math.hypot(b.x-tg.x, b.y-tg.y) > 250 && Math.hypot(b.x-tg.x, b.y-tg.y) < NADE_THROW_RANGE; })
        .sort(function(a, b2){ return Math.hypot(a.x-tg.x, a.y-tg.y) - Math.hypot(b2.x-tg.x, b2.y-tg.y); })[0];
      if(th && assignNade(th, "he", tg, "HE в стак", {now:true, lvl:NADE_LEVEL.react})){ nadeReactCd[team] = tick + 10*TICK_HZ;
        voiceLog(team, "hestack"+tick, th.id, "их двое "+calloutName(tg.x, tg.y)+" — кидаю HE"); return; }
    }
  });
  bots.forEach(function(b){
    if(!b.alive || b._sawEnemy || (b.nadeTask && b.nadeTask.lvl > NADE_LEVEL.self) || b.planting || b.defusing || !b.nades || b.nades.flash <= 0) return;
    if(!b.post || b.atPost || b.state !== "patrol" || tick < (b._selfFlashCd||0)) return;
    if(bomb.state === "carried" && bomb.carrier === b) return;
    if(bots.some(function(o){ return o !== b && o.alive && o.team === b.team && Math.hypot(o.x-b.x, o.y-b.y) < 220; })) return; // не один — пикнут вместе
    var dP = Math.hypot(b.post.x-b.x, b.post.y-b.y); if(dP > 260 || dP < 50) return;
    var L = beliefLast[b.team] || {}, tgt = null;
    for(var eid in L){ var lo = L[eid]; if(tick - lo.tick > 5*TICK_HZ) continue;
      var e = bots.filter(function(o){ return o.id === eid; })[0]; if(!e || !e.alive) continue;
      if(Math.hypot(lo.x-b.post.x, lo.y-b.post.y) > 420 || hasLOS(b.x, b.y, lo.x, lo.y)) continue;
      tgt = lo; break; }
    if(!tgt) return;
    if(nadesInAir.some(function(n){ return n.team === b.team && n.type === "flash" && Math.hypot((n.tx||n.x)-tgt.x, (n.ty||n.y)-tgt.y) < 150; })) return; // туда уже летит флешка
    if(teamSaving(b.team)) return;   // (v247) сейв — не выходим
    b._selfFlashCd = tick + 12*TICK_HZ;
    var why = "себе под пик "+b.id;
    if(!nadeThrowNow(b, NADE_LEVEL.self, "flash", tgt.x, tgt.y, true, why)) return;   // не вышло — пикает без неё
    b._waitPopUntil = tick + Math.round(1.1*TICK_HZ); b._waitPopKey = "pop:"+why;
    voiceLog(b.team, "sflash"+b.id, b.id, "флешу себе и выхожу");
  });
}
// (v374, этап 3 плана владельца: «граната — часть действия») сторож: гранаты покупают почти как про, но бросают меньше — из 3,2
// дымов на руках у T на форсе задача появлялась у 1,9; сравнение раскладов: T у сайта до планта бросают за 5 с в 0,12–0,18 случаев
// у про и 0,0–0,06 у ботов, CT на сайте в начале раунда 0,32–0,39 / 0,15–0,22, T у бомбы после планта 0,12 / 0,02. Решения
// «кинуть» были только под отдельные моменты (выход, проба, «выкурить по инфе»). Теперь одно место: каждый боец с гранатой, раз в
// 0,5 с, сам смотрит, нужна ли граната тому, что он делает по тому, что знает:
//   идёт в бой (выход T, выход на контакт, размен, заход на ретейк) — флешка/молотов/смок на место, куда идёт, и на входы к нему;
//   держит, а враг известен (≤ 4 с) рядом и не на виду — молотов/HE/флешка на него (своих рядом с точкой нет);
//   T после планта: CT у бомбы известен или дефузят — молотов/HE на бомбу.
// Куда — откуда сюда кидали про (MAP.nadelanes: бросок с этого места (≤ 60 px) в нужную точку), иначе прямо, если стены нет.
// Пауза бойца между такими решениями — 3 с (проектное число)
var NADE_USE_GAP = 192;   // 3 с (TICK_HZ объявлен ниже — число)
