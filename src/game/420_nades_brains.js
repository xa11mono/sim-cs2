function nadeUsePick(b, pts, R){
  var I = nadeLaneIdx(), L = I.L, best = null, bd = Infinity;
  pts.forEach(function(p){
    nadeLaneFroms(p.x, p.y).forEach(function(q){ var dF = Math.hypot(q.x-b.x, q.y-b.y); if(dF <= NADE_LANE_FROM && dF < bd){ bd = dF; best = {x:p.x, y:p.y}; } });
    if(!best && Math.hypot(p.x-b.x, p.y-b.y) <= NADE_THROW_RANGE && !crossesWall(b.x, b.y, p.x, p.y)) best = {x:p.x, y:p.y}; });
  return best;
}
function nadeUseTick(b){
  if(!b.alive || !b.nades || b.nadeTask || b.planting || b.defusing || !nadeReady(b) || roundState !== "live") return;
  if(tick - (b._nadeUseT || -1e9) < NADE_USE_GAP || teamSaving(b.team)) return;
  var have = function(t){ return b.nades[t] > 0; };
  if(!have("smoke") && !have("flash") && !have("he") && !have("molly")) return;
  var foe = b.team === "T" ? "CT" : "T", BL = beliefLast[b.team] || {}, known = [];
  for(var e in BL){ var q = BL[e]; if(q && tick - q.tick <= 4*TICK_HZ && bots.some(function(o){ return o.id === e && o.alive; })) known.push({x:q.x, y:q.y}); }
  var mateNear = function(p){ return bots.some(function(o){ return o !== b && o.alive && o.team === b.team && Math.hypot(o.x-p.x, o.y-p.y) < 160; }); };
  var tt = teamTac.T, why = null, plan = null;
  var tag = b.post ? String(b.post.tag) : "", toPost = b.post ? Math.hypot(b.post.x-b.x, b.post.y-b.y) : 0;
  // (v375, отметка владельца: «граната врезалась в стену и взорвалась перед своими» — на раше в начале раунда T флешили точки
  // маршрута у своего спавна) в бой — только туда, где враг может быть: выход на контакт/размен/ретейк/зачистка или выход T к
  // самому сайту (≤ 600 от него); точки маршрута — не бой; и рядом с точкой нет своих (mateNear)
  var siteT = tt && SITES[tt.site];
  var entering = b.post && toPost > 120 && toPost < 800 && !/^route/.test(tag) && (/^(contact:swing|tradeR|retakeEntry|retake|clear)/.test(tag) ||
    (b.team === "T" && tt && tt.phase === "execute" && b.tRole !== "lurker" && siteT && Math.hypot(b.post.x-siteT.x, b.post.y-siteT.y) < 600));
  if(entering){
    var area = {x:b.post.x, y:b.post.y}, ents = threatEntrances(b.team, area, 260).slice(0, 3).map(function(E){ return E.pt; });
    if(mateNear(area)) area = null;
    var spots = known.filter(function(k){ return Math.hypot(k.x-b.post.x, k.y-b.post.y) < 500; }).concat(ents).filter(function(p){ return !mateNear(p); });
    // какую — по долям про у этой стороны и типа раунда (MAP.pro.nadesBy), из тех, что есть и для которых есть цель
    // (было: всегда флешка первой — флешек стало 6,0 на команду в фулле против 4,0 у про, дыма — 2,9 против 4,1)
    var NBu = ((MAP.pro.nadesBy || {})[b.team] || {})[({pistol:"pistol", eco:"eco", force:"force", half:"force"})[(teamEco[b.team]||{}).roundType] || "full"] || {};
    var opts = [];
    if(have("flash") && (area || spots.length)) opts.push({t:"flash", pts:(area ? [area] : []).concat(spots), w:NBu.flash || 1});
    if(have("molly") && spots.length) opts.push({t:"molly", pts:spots, w:NBu.molly || 1});
    if(have("he") && spots.length) opts.push({t:"he", pts:spots, w:NBu.he || 0.5});
    if(have("smoke") && ents.length && (b.team !== "T" || tSmokeReserveOk())) opts.push({t:"smoke", pts:ents, w:NBu.smoke || 1});
    var wS = opts.reduce(function(a, o){ return a + o.w; }, 0), rr = hashRand(tick*13 + b.id.charCodeAt(b.id.length-1)*29) * wS;
    for(var oi = 0; oi < opts.length && !plan; oi++){ rr -= opts[oi].w; if(rr <= 0) plan = opts[oi]; }
    if(!plan && opts.length) plan = opts[opts.length-1];
    why = "иду в бой — "+calloutName(b.post.x, b.post.y).replace(/^на /, "");
  } else if(bomb.state === "planted" && b.team === "T" && (bots.some(function(o){ return o.defusing; }) || known.some(function(k){ return Math.hypot(k.x-bomb.x, k.y-bomb.y) < 700; }))){
    if(have("molly")) plan = {t:"molly", pts:[{x:bomb.x, y:bomb.y}]}; else if(have("he")) plan = {t:"he", pts:[{x:bomb.x, y:bomb.y}]};
    why = "на бомбу — их слышно у неё";
  } else if(known.length && (b.atPost || b.state === "hold")){
    var tgt = known.filter(function(k){ var d = Math.hypot(k.x-b.x, k.y-b.y); return d > 150 && d < 900 && !hasLOS(b.x, b.y, k.x, k.y) && !mateNear(k); });
    if(tgt.length){ var tp = have("molly") ? "molly" : (have("he") ? "he" : (have("flash") ? "flash" : null)); if(tp) plan = {t:tp, pts:tgt}; }
    why = "по инфе — туда, где они";
  }
  if(!plan || !plan.pts.length) return;
  b._nadeUseT = tick;
  var pt = nadeUsePick(b, plan.pts); if(!pt) return;
  if(plan.t === "smoke" && smokeCovered(pt.x, pt.y)) return;
  if(assignNade(b, plan.t, pt, why, {now:true})) logEvent(b.id+": "+NADE[plan.t].name+" — "+why);
}
function nadeBrains(){
  bots.forEach(function(b){ if((tick + b.id.charCodeAt(b.id.length-1)*7) % 32 === 0) nadeUseTick(b); });   // (v374) граната — часть действия
  var tt = teamTac.T; if(!tt) return;
  var g = GEO[tt.site], site = SITES[tt.site];
  var ts = bots.filter(function(b){ return b.team==="T" && b.alive; });
  var cts = bots.filter(function(b){ return b.team==="CT" && b.alive; });
  function byRole(list, r){ return list.filter(function(b){ return b.tRole===r; })[0]; }
  // (v294, Г-пункт, владелец 14.10: «кидают гранаты на рандом») «инстасмок мид» (план §7) убран: у про его нет (в 1654 лайнапах про
  // инста-смок T — Sniper Nest, Chamber Lane, Lamp Room), а у ботов он был 32 % смоков T и рвался рядом с врагом в 9 % случаев
  // (10) AWP CT в прошлых раундах стрелял с одной точки — смок на его линию,
  // когда кто-то из T проходит рядом (один раз за раунд, запас смоков на выход не трогаем)
  if(BAL.roundMem && tt.phase === "setup" && !nadeFlags.antiAwp && tick - roundStartTick > 6*TICK_HZ && BAL.tUtil){
    var aw = rmemRecent(RMEM.awp, 3);
    if(aw.length){
      var A0 = aw[aw.length-1];
      var smA = ts.filter(function(b){ return b.tRole !== "lurker" && b.nades.smoke > 0 && !b.nadeTask && Math.hypot(b.x-A0.x, b.y-A0.y) < 1250 && Math.hypot(b.x-A0.x, b.y-A0.y) > 350; })
        .sort(function(a, c){ return Math.hypot(a.x-A0.x, a.y-A0.y) - Math.hypot(c.x-A0.x, c.y-A0.y); })[0];
      if(smA && tSmokeReserveOk()){
        var spAw = {x: A0.x + (smA.x-A0.x)*0.3, y: A0.y + (smA.y-A0.y)*0.3};
        if(assignNade(smA, "smoke", spAw, "смок на линию AWP", {now:true, range:1300})){ nadeFlags.antiAwp = true;
          voiceLog("T", "antiawp", smA.id, "их AWP в прошлых раундах бил "+calloutName(A0.x, A0.y)+" — смок на его линию"); }
      } else if(tick - roundStartTick > 25*TICK_HZ) nadeFlags.antiAwp = true;
    } else nadeFlags.antiAwp = true;
  }
  // раздел 12: фейк — смок на вход CT и флешка на фейковый сайт, чтобы звучало
  // и выглядело как настоящий выход
  if(tt.fakeOn && !nadeFlags.fakeNades && tt.phase === "setup" && BAL.tUtil){
    nadeFlags.fakeNades = true;
    var gf = GEO[tt.tac.fake], fsite = SITES[tt.tac.fake];
    var fakers = ts.filter(function(b){ return b.tRole === "support" || b.tRole === "lurker"; });
    var fs1 = fakers.filter(function(b){ return b.nades.smoke > 0; })[0];
    if(fs1) assignNade(fs1, "smoke", gf.ctEntry, "фейк-смок", {bkey:"T.fake.smoke."+tt.tac.fake});
    var ff1 = fakers.filter(function(b){ return b !== fs1 && b.nades.flash > 0; })[0] || (fs1 && fs1.nades.flash > 0 ? fs1 : null);
    if(ff1) assignNade(ff1, "flash", {x:gf.tEntry.x + (fsite.x-gf.tEntry.x)*0.4, y:gf.tEntry.y + (fsite.y-gf.tEntry.y)*0.4}, "фейк-флешка", {bkey:"T.fake.flash."+tt.tac.fake});
  }
  // T: выход — два смока (вход CT, линия опорника), флешка ПОД ПИК энтри от
  // поддержки (синхронизация двух ботов: энтри ждёт хлопка), молотов на опорника
  var preEx = preExecNow(tt);
  if((tt.phase === "execute" || preEx) && !nadeFlags.tExecSm && BAL.tUtil){
    nadeFlags.tExecSm = true;
    var smokers = ts.filter(function(b){ return b.nades.smoke > 0 && b.tRole !== "lurker"; });
    var cross = {x:(g.anchor.x+g.ctEntry.x)/2, y:(g.anchor.y+g.ctEntry.y)/2};
    var eo = BAL.nadeEarly ? {now:true, range:1300} : {};
    if(BAL.tSmoke && smokers[0] && assignNade(smokers[0], "smoke", g.ctEntry, "вход CT", Object.assign({bkey:"T.exec.ctEntry."+tt.site}, eo))) smokers[0].nadeTask.exec = true;
    if(BAL.tSmoke && smokers[1] && assignNade(smokers[1], "smoke", cross, "кросс", Object.assign({bkey:"T.exec.cross."+tt.site}, eo))) smokers[1].nadeTask.exec = true;
    if(preEx) logEvent("T: гранаты выхода на "+tt.site+" — заранее, до пика");
    tt._smT = tick;
  }
  if(tt.phase === "execute" && !nadeFlags.tExec && BAL.tUtil){
    nadeFlags.tExec = true;
    var ent = byRole(ts, "entry");
    var fx = g.tEntry.x + (site.x-g.tEntry.x)*0.35, fy = g.tEntry.y + (site.y-g.tEntry.y)*0.35;
    var flasher = ts.filter(function(b){ return b !== ent && b.nades.flash > 0 && (b.tRole === "support" || b.tRole === "awp"); })[0];
    if(BAL.tFlash && ent && flasher){
      nadeFlags.peekFlashPlanned = tick;
      assignNade(flasher, "flash", {x:fx, y:fy}, "под пик", {now:true, bkey:"T.exec.flash."+tt.site});
    } else if(BAL.tFlash && ent && ent.nades.flash > 0){
      assignNade(ent, "flash", {x:fx, y:fy}, "под заход", {bkey:"T.exec.flash."+tt.site}); // некому — сам себе
    }
    var mollies = ts.filter(function(b){ return b.nades.molly > 0; });
    // раздел 12: последний молотов команды не тратим на выход — он нужен на
    // пост-плант, сбить дефуз (если CT мало — выход дожмут и без него)
    var keepMol = BAL.keepMol && mollies.length === 1 && aliveCount("CT") >= 2;
    var mol = keepMol ? null : mollies.filter(function(b){ return !(bomb.state === "carried" && bomb.carrier === b); })[0] || mollies[0];
    if(keepMol) logEvent("T: единственный молотов берегут на пост-плант");
    var molT = g.anchor, molWhy = "выжечь опорника";
    if(BAL.habits){
      bots.forEach(function(o){
        if(o.team !== "CT" || !o.alive) return;
        var h = habitTop(o.id, 2); if(!h || Math.hypot(h.x-site.x, h.y-site.y) > 380) return;
        molT = {x:h.x, y:h.y}; molWhy = "в любимый угол "+o.id;
      });
      if(molWhy !== "выжечь опорника") logEvent("T: знают привычку — молотов "+molWhy+" ("+(zoneUserName(zoneIdAt(molT.x, molT.y))||"сайт "+tt.site)+")");
    }
    if(BAL.tMolly && mol) assignNade(mol, "molly", molT, molWhy, BAL.nadeEarly ? {bkey:"T.exec.molly."+tt.site, now:true, range:1200} : {bkey:"T.exec.molly."+tt.site});
  }
  // (7) молотов "на всякий" в угол: на выходе, не зная, есть ли там кто, —
  // выжечь ближний угол сайта, куда обычно встают CT (из списка позиций сайта),
  // пока он ещё не виден. По одному на раунд, последний молотов — на пост-плант
  if(BAL.mollyClear && tt.phase === "execute" && !nadeFlags.molClear && tick - (tt.execStart||tick) < 10*TICK_HZ){
    var mc = ts.filter(function(b){ return b.nades.molly > 0 && !b.nadeTask && Math.hypot(b.x-site.x, b.y-site.y) < 750 && !(bomb.state === "carried" && bomb.carrier === b); })[0];
    var molLeft = ts.reduce(function(a, b){ return a + b.nades.molly; }, 0);
    if(mc && (molLeft >= 2 || aliveCount("CT") <= 1)){
      var cands = POS[tt.site].ctHold.map(function(n){ return zonePoint(n, site); }).filter(function(q){ return q && Math.hypot(q.x-mc.x, q.y-mc.y) < 650 && Math.hypot(q.x-mc.x, q.y-mc.y) > 160 && !hasLOS(mc.x, mc.y, q.x, q.y) && !fires.some(function(f){ return Math.hypot(f.x-q.x, f.y-q.y) < 120; }); })
        .sort(function(a, c){ return Math.hypot(a.x-mc.x, a.y-mc.y) - Math.hypot(c.x-mc.x, c.y-mc.y); });
      if(cands[0] && assignNade(mc, "molly", cands[0], "выжечь угол «"+(zoneUserName(zoneIdAt(cands[0].x, cands[0].y)) || "угол")+"»", {now:true, range:700})){
        nadeFlags.molClear = true; logEvent(mc.id+": не знаю, есть ли кто в «"+(zoneUserName(zoneIdAt(cands[0].x, cands[0].y)) || "углу")+"», — выжигаю перед заходом"); }
      else if(tick - (tt.execStart||tick) > 6*TICK_HZ) nadeFlags.molClear = true;
    } else if(!mc) {} else nadeFlags.molClear = true;
  }
  // T пост-плант: CT дефузит — молотов на бомбу
  if(bomb && bomb.state === "planted"){
    // (v244) дефуз знают, только если услышали сами или им сказали «дефузят!» (K.defuseT — знание бота)
    var mt = nadeFlags.antiDef ? null : ts.filter(function(b){ return b.know && b.know.defuseT !== undefined && tick - b.know.defuseT <= TICK_HZ &&
      b.nades.molly > 0 && Math.hypot(b.x-bomb.x, b.y-bomb.y) < NADE_THROW_RANGE; })[0];
    if(mt){
      nadeFlags.antiDef = true; if(assignNade(mt, "molly", {x:bomb.x, y:bomb.y}, "на дефуз — слышим дефуз", {bkey:"T.pp.molly."+bomb.site})) mt.nadeTask.until = tick + 4*64;
    }
  }
  // CT: T закрыли сайт смоком на выходе — не дать спокойно занять позиции за
  // ним: HE/молотов в точки, куда T встают первыми (вход и первые углы сайта)
  if(BAL.smokeEntry && tt.phase === "execute" && !nadeFlags["ctTake"+tt.site]){
    var gs2 = GEO[tt.site], sT = SITES[tt.site];
    var smokeOn = smokes.some(function(sm){ return tick - sm.born < 3*TICK_HZ && (Math.hypot(sm.x-gs2.ctEntry.x, sm.y-gs2.ctEntry.y) < 260 || Math.hypot(sm.x-sT.x, sm.y-sT.y) < 300); });
    if(smokeOn){
      nadeFlags["ctTake"+tt.site] = true;
      var near = cts.filter(function(b){ return !b.nadeTask && Math.hypot(b.x-sT.x, b.y-sT.y) < 700 && (b.nades.he > 0 || b.nades.molly > 0); });
      var takePt = {x: gs2.tEntry.x + (sT.x-gs2.tEntry.x)*0.35, y: gs2.tEntry.y + (sT.y-gs2.tEntry.y)*0.35};
      near.slice(0, 2).forEach(function(b, i){
        var tp = i === 0 ? takePt : gs2.tEntry;
        if(b.nades.he > 0) assignNade(b, "he", tp, "в смок — не дать занять сайт", {now:true, bkey:"CT.take.he."+tt.site});
        else assignNade(b, "molly", tp, "в смок — не дать занять сайт", {now:true, bkey:"CT.take.he."+tt.site});
      });
      if(near.length) logEvent("CT: T закрыли смоком "+tt.site+" — гранаты туда, где они встают");
    }
  }
  // CT: колл по сайту — опорник того сайта задерживает выход молотовом, при 2+ добавляет HE
  var call = teamTac.CT && teamTac.CT.call;
  if(call && !nadeFlags["ct"+call.site]){
    nadeFlags["ct"+call.site] = true;
    var anc = byRole(cts, call.site === "A" ? "anchorA" : "anchorB");
    var ge = GEO[call.site];
    if(anc){
      if(anc.nades.molly > 0) assignNade(anc, "molly", ge.tEntry, "задержать выход", {bkey:"CT.call.molly."+call.site});
      else if(anc.nades.he > 0) assignNade(anc, "he", ge.tEntry, "по выходу", {bkey:"CT.call.molly."+call.site});
    }
    var rot = byRole(cts, "rotator");
    if(rot && rot.nades.smoke > 0 && (call.count >= 2 || BAL.ctUtilEarly)) assignNade(rot, "smoke", ge.tEntry, "перекрыть вход", {bkey:"CT.call.smoke."+call.site});
    if(BAL.ctUtilEarly && anc && !anc.nadeTask && anc.nades.smoke > 0) assignNade(anc, "smoke", ge.tEntry, "перекрыть вход", {bkey:"CT.call.smoke."+call.site});
  }
  // раздел 11.1: гранатный комбо — не одна граната по инфе от одного бота, а
  // несколько РАЗНЫХ типов от РАЗНЫХ тиммейтов синхронно по одному только что
  // замеченному защитнику, чтобы сдвинуть/выбить его перед проходом
  nadeCombos();
  // план §7: молотов/HE по СВЕЖЕЙ инфе — враг только что был виден и ушёл за
  // укрытие → выкурить его оттуда. Не чаще раза в 8с на бота, не туда, где уже
  // горит, и не туда, где рядом свои.
  bots.forEach(function(b){
    if(!b.alive || b._sawEnemy || b.nadeTask || b.planting || b.defusing) return;
    if(tick < (b._nadeCd||0) || !b.lastIntel) return;
    var age = tick - b.lastIntel.tick;
    if(age < 26 || age > 160) return;
    var type = b.nades.molly > 0 ? "molly" : (b.nades.he > 0 ? "he" : null);
    if(!type) return;
    var L = b.lastIntel, dd = Math.hypot(L.x-b.x, L.y-b.y);
    if(dd > NADE_THROW_RANGE || dd < 120) return;
    if(fires.some(function(f){ return Math.hypot(f.x-L.x, f.y-L.y) < 100; })) return;
    if(bots.some(function(o){ return o.alive && o.team === b.team && Math.hypot(o.x-L.x, o.y-L.y) < 130; })) return;
    b._nadeCd = tick + 8*TICK_HZ;
    assignNade(b, type, {x:L.x, y:L.y}, "по инфе — выкурить", {now:true});
  });
  if(BAL.nadeReact) nadeReact();
  selfNadeTick();
  // план §7: граната на отходе — проигрывает дуэль и уходит: смок между собой
  // и врагом (или флешка в него), чтобы выйти живым. Реакция, а не план.
  bots.forEach(function(b){
    if(!b.alive || b.state !== "retreat" || b._retreatNade === roundNum) return;
    var foe = b._nearestEnemyBot; if(!foe || !b._sawEnemy) return;
    var mid = {x:b.x + (foe.x-b.x)*0.35, y:b.y + (foe.y-b.y)*0.35};
    if(b.nades.smoke > 0 && !smokeCovered(mid.x, mid.y)){ b._retreatNade = roundNum; throwNade(b, "smoke", mid.x, mid.y, false, "на отходе"); }
    else if(b.nades.flash > 0){ b._retreatNade = roundNum; throwNade(b, "flash", foe.x, foe.y, false, "на отходе"); }
  });
  // CT ретейк: перед заходом — флешка на сайт
  if(bomb && bomb.state === "planted" && !(teamTac.CT && teamTac.CT.saving) && !nadeFlags.retakeFlash && bomb.retake && bomb.retake.phase === "go"){
    var gs = GEO[bomb.site];
    // заходим — флешка на бомбу с точки сбора, смок на подход T (отрезать подмогу)
    var fl = cts.filter(function(b){ return b.nades.flash > 0; })[0];
    if(fl){ nadeFlags.retakeFlash = true; assignNade(fl, "flash", {x:bomb.x, y:bomb.y}, "ретейк", {bkey:"CT.retake.flash."+bomb.site}); }
    var smr = cts.filter(function(b){ return b !== fl && b.nades.smoke > 0; })[0];
    if(smr && !nadeFlags.retakeSmoke){ nadeFlags.retakeSmoke = true; if(retakeCutUseful()) assignNade(smr, "smoke", gs.tEntry, "отрезать вход T", {bkey:"CT.retake.smoke."+bomb.site}); }
  }
}
// смок "отрезать вход T" на ретейке нужен, только если кто-то из T может
// прийти на подмогу снаружи; если все T по инфе уже на сайте — смок пустой
function retakeCutUseful(){
  if(!BAL.ctUtilSmart || !bomb) return true;
  var ts = bots.filter(function(o){ return o.alive && o.team === "T"; });
  var L = beliefLast.CT || {}, outside = 0, known = 0;
  ts.forEach(function(t){ var e = L[t.id]; if(!e || tick - e.tick > 12*TICK_HZ){ outside++; return; } known++; if(Math.hypot(e.x-bomb.x, e.y-bomb.y) > 650) outside++; });
  return outside > 0;
}
function resetNades(){
  nadesInAir.length = 0; smokes.length = 0; fires.length = 0; nadeFx.length = 0; nadeFlags = {}; groundWeapons.length = 0; groundItems.length = 0;
  comboCd = {};
  bots.forEach(function(b){ b._route = null; b.nadeTask = null; b.nadeQueue = null; b.blindUntil = 0; b.throwUntil = 0; b._fireAcc = 0; b._fireIn = null; b._nadeCd = 0; if(!b.nades) b.nades = emptyNades(); });
}

