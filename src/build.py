import sys
s=open('orig.html').read()
nl=open('newlook.js').read()+'\n'+open('holdpos.js').read()+'\n'+open('smokereact.js').read()+'\n'+open('proroles.js').read()+'\n'+open('proprior.js').read()+open('prolook.js').read()+open('prolineups.js').read()+open('proprior_fn.js').read()
def rep(old,new,cnt=1):
    global s
    assert s.count(old)>=1, old[:80]
    s=s.replace(old,new,cnt)
# 1) config flag
rep("var BAL = {\n", "var BAL = {\n  newLook: true,      // v141: единая оценка взгляда + вероятность только через невидимые входы\n")
# 2) module after threatLook (before flankPost comment)
rep("// маршрут фланга: мид со стороны T", nl+"\n// маршрут фланга: мид со стороны T")
# 3) belief: reset per-round look state
rep("bots.forEach(function(o){ o._tLookZ = null; o._tLook = null; o._tLookT = null; });",
    "bots.forEach(function(o){ o._tLookZ = null; o._tLook = null; o._tLookT = null; o._lkZ = null; o._lkPt = null; o._lkC = null; o._lkTop = null; });")
# 4) diffusion: no flow through watched portals
rep("""        for(var k2=0;k2<deg;k2++) Q[nb[k2]] += P[i]*go*wl[k2]/ws;""",
"""        for(var k2=0;k2<deg;k2++){
          // (v141) враг не может незаметно пройти через проход, который видит свой:
          // эта доля вероятности просто исчезает (прошёл бы — его бы увидели)
          if(BAL.newLook && PWb[i+","+nb[k2]]) continue;
          Q[nb[k2]] += P[i]*go*wl[k2]/ws; }""")
rep("""  ["CT","T"].forEach(function(team){
    var B = belief[team];
    Object.keys(B).forEach(function(eid){
      var e = bots.filter""","""  ["CT","T"].forEach(function(team){
    var B = belief[team];
    var PWb = BAL.newLook ? (PORTAL_W[team] = portalWatched(team)) : {};
    Object.keys(B).forEach(function(eid){
      var e = bots.filter""")
# 5) fallback: not uniform over all zones (tупики!) but only where enemy could be
rep("""      if(sum < 1e-6){ for(var i2=0;i2<n;i2++) P[i2] = 1/n; }""",
"""      if(sum < 1e-6 && BAL.newLook){
        // вся инфа противоречит — не "везде поровну" (тогда и в проверенных
        // тупиках снова появлялся враг), а только там, куда враг мог дойти и
        // что сейчас никто не видит
        var clr = {}; clearAll.forEach(function(cz){ if(cz[1] >= 0.5) clr[cz[0]] = 1; });
        var pot = (bots.filter(function(o){ return o.id === eid; })[0]||{}).team === "T" ? BZ.potT : BZ.potCT, s2 = 0;
        for(var i5=0;i5<n;i5++){ P[i5] = (!clr[i5] && reachPossible(team, i5)) ? Math.exp(-pot[i5]/600) : 0; s2 += P[i5]; }
        if(s2 <= 0){ for(var i6=0;i6<n;i6++) P[i6] = 1/n; } else for(var i7=0;i7<n;i7++) P[i7] /= s2;
      }
      else if(sum < 1e-6){ for(var i2=0;i2<n;i2++) P[i2] = 1/n; }""")
# 4b) remember when team last saw each zone; reset per round
rep('''    reachStep(team, clearAll);''','''    reachStep(team, clearAll);
    if(BAL.newLook){ var CLT = LAST_CLEAR[team] || (LAST_CLEAR[team] = {}); clearAll.forEach(function(cz){ if(cz[1] >= 0.5) CLT[cz[0]] = tick; }); }''')
rep('''  beliefSeen = {CT:{}, T:{}}; beliefLast = {CT:{}, T:{}};''','''  beliefSeen = {CT:{}, T:{}}; beliefLast = {CT:{}, T:{}}; LAST_CLEAR = {CT:{}, T:{}};''')
# 4c) shift-walk past unchecked corners
rep('''    dz = Math.max(dz, own + 0.5*nb);
  });''','''    dz = Math.max(dz, own + 0.5*nb);
    // (v143) непроверенный угол вплотную к пути, куда враг мог успеть — тихо,
    // чтобы чекнуть его и не спалиться (у про: "иду шифтом, чекаю каждый угол")
    if(BAL.newLook){ var uc = uncheckedW(foe, zi); (BZ.nbr[zi]||[]).forEach(function(j){ var c = BZ.cent[j]; if(c && Math.hypot(c.x-q[0], c.y-q[1]) < 320) uc = Math.max(uc, uncheckedW(foe, j)); });
      if(uc >= 0.8) dz = Math.max(dz, LOOK.uncheckWalk); }
  });''')
# 4d) after plant: flank/hunt tasks end, everyone joins post-plant
rep('''  if(bomb.state === "planted" && tt.phase !== "postplant"){ tt.phase = "postplant"; }''','''  if(bomb.state === "planted" && tt.phase !== "postplant"){ tt.phase = "postplant";
    // (v144) фланг через мид и охота имели смысл до планта. После планта у них
    // не было исполнителя — стояли, где оставили. Теперь все в пост-плант
    if(BAL.newLook && BAL.ppFix === true) bots.forEach(function(o){ if(o.team !== "T") return; o._midFlank = null; o._shift = null; o._egLock = 0; o._egC = null;
      if(o.post && /^(endhunt|stage.*CTside)/.test(o.post.tag || "")) clearPost(o); });
  }''')
# 4e) enemy movement model: after plant CT go to the bomb
rep('''      var P = B[eid], Q = new Float32Array(n), pot = e.team === "T" ? BZ.potT : BZ.potCT;''','''      var P = B[eid], Q = new Float32Array(n), pot = e.team === "T" ? BZ.potT : BZ.potCT;
      // (v144) цель CT после планта — бомба (ретейк), а не "свои позиции"
      if(BAL.newLook && BAL.ppBelief !== false && e.team === "CT" && bomb && bomb.state === "planted"){
        // CT сначала собираются у входа на сайт со своей стороны, оттуда заходят
        var ge = GEO[bomb.site] && GEO[bomb.site].ctEntry, bzB = ge ? bzOf(ge.x, ge.y) : bzOf(bomb.x, bomb.y);
        if(BAL.ppSinkBomb) bzB = bzOf(bomb.x, bomb.y);
        if(!BZ.potBomb || BZ.potBomb.z !== bzB){ BZ.potBomb = {z:bzB, D: bzDist(bzB >= 0 ? [bzB] : [])}; }
        pot = BZ.potBomb.D;
      }''')
# 4f) hold-area task: T post-plant (close mode) and CT clutch
rep('''  newLook: true,''','''  newLook: true,
  holdTask: true,     // v145: задача "держать район" + одна оценка позиции (пост-плант T, клатч CT)''')
rep('''    if(BAL.namedPos){
      if(!tt.ppAssign) tt.ppAssign = {};''','''    if(BAL.holdTask){
      // (v145) пост-плант у бомбы = "держать район вокруг бомбы": бомбу видеть
      // обязательно (снять дефузера), встать под главный вход ретейка, от
      // остальных закрыться, не стоять кучей, по возможности кроссфаер
      holdGroup(group, {key:"pp"+bomb.site+Math.round(bp0.x/30), center:bp0, rArea:320, rMin:90, rMax:420, must:[bp0],
        voice:function(b, r){ if(r.main) voiceLog("T", "pphold"+b.id+Math.round(r.main.pt.x/60), b.id, "держу бомбу, смотрю "+calloutName(r.main.pt.x, r.main.pt.y).replace(/^на /,"")); }}, "postplant:hold");
      return;
    }
    if(BAL.namedPos){
      if(!tt.ppAssign) tt.ppAssign = {};''')
# 5b) clutch position from real threat entrances
rep('''  var k = C.site, g = GEO[k];
  if(!C.pt || C.ptSite !== k){''','''  var k = C.site, g = GEO[k];
  // (v142) позиция под реальные входы: откуда вероятно придут — туда смотреть
  // (один вход, максимум два), от остальных входов закрыться стеной
  if(BAL.newLook && (!C.dynT || tick - C.dynT > 3*TICK_HZ || C.ptSite !== k)){
    C.dynT = tick;
    var E = threatEntrances("CT", g.anchor, 280).filter(function(e){ return e.w > 0.03; });
    if(E.length){
      var see = [E[0].pt]; if(E[1] && E[1].w > 0.6*E[0].w) see.push(E[1].pt);
      var hide = E.slice(see.length).filter(function(e){ return e.w > 0.15*E[0].w; }).map(function(e){ return e.pt; });
      var sig = k + see.concat(hide).map(function(p){ return Math.round(p.x/60)+","+Math.round(p.y/60); }).join("|");
      if(sig !== C.sig){
        C.sig = sig;
        // главный вход видеть обязательно (must), остальные — по возможности закрыть
        var sp = pickSpots("clutchdyn"+sig, g.anchor, 1, {rMax:340, minGap:60, must:[see[0]], see:see, hideFrom:hide})[0] ||
                 pickSpots("clutchdyn2"+sig, g.anchor, 1, {rMax:340, minGap:60, see:see, hideFrom:hide})[0];
        if(sp){ C.pt = sp; C.ptSite = k; C.look = see[0];
          voiceLog("CT", "clutchpos"+sig, b.id, "встаю под "+calloutName(see[0].x, see[0].y).replace(/^на /,"")+(hide.length ? ", закрываюсь от остальных входов" : "")); }
      }
    }
  }
  if(!C.pt || C.ptSite !== k){''')
rep('''  setPost(b, C.pt, g.tEntry, true, "clutch:"+k);''','''  setPost(b, C.pt, (BAL.newLook && C.look) || g.tEntry, true, "clutch:"+k);''')
# 6) look pipeline
rep("""  var aimStep = AIM_TURN_RATE / TICK_HZ;
  bots.forEach(function(b){
    if(!b.alive) return;
    var look = null;
    if(b._sawEnemy && b._nearestEnemyBot){ look = b._nearestEnemyBot; b.lookReason = "enemy"; }
""","""  var aimStep = AIM_TURN_RATE / TICK_HZ;
  if(BAL.newLook && tick % 8 === 0 && BZ.ids.length){ lookPlan("CT"); lookPlan("T"); }
  bots.forEach(function(b){
    if(!b.alive) return;
    var look = null;
    if(b._sawEnemy && b._nearestEnemyBot){ look = b._nearestEnemyBot; b.lookReason = "enemy"; }
    else if(BAL.newLook){ look = newLookFor(b); }
""")
rep("if(BAL.smokeSweep && !b._sawEnemy &&", "if(!BAL.newLook && BAL.smokeSweep && !b._sawEnemy &&")
# 7) why text
rep("var WHY_LOOK = {", "var WHY_LOOK = {look:\"угроза\", ")
rep("""  if(b.lookTarget && (lr === "threat" ||""","""  if(lr === "look" && b._lkTop && b._lkTop.length){
    lt = "смотрит: " + b._lkTop.map(function(t){ return t[0] + " " + t[1].toFixed(2); }).join(" › ");
    return pt + " · " + lt; }
  if(b.lookTarget && (lr === "threat" ||""")
# 8) version + toggle UI
rep("версия 140 · 29.09","версия 152 · 30.09")
rep("""<label class="chk" title="Под каждым игроком""","""<label class="chk" title="Новый взгляд (v141–142): одна оценка угроз с дележом углов в команде. Выключи — вернётся старая логика v140"><input type="checkbox" id="chkNewLook" checked> новый взгляд</label>
    <label class="chk" title="Под каждым игроком""")
rep("""\nrequestAnimationFrame(frame);\n""","""\ndocument.getElementById("chkNewLook").addEventListener("change", function(){ BAL.newLook = this.checked; bots.forEach(function(o){ o._lkZ = null; o._lkPt = null; o._tLookZ = null; o._tLook = null; }); logEvent(this.checked ? "Взгляд: новая единая оценка" : "Взгляд: старая логика v140"); });
window.__ev=function(src){return eval(src);};
requestAnimationFrame(frame);\n""")
rep('''  var k = C.site, g = GEO[k];
  // (v142)''','''  var k = C.site, g = GEO[k];
  if(BAL.holdTask){
    holdGroup([b], {key:"clutch"+k, center:g.anchor, rArea:280, rMax:340,
      voice:function(bb, r){ if(r.main) voiceLog("CT", "clutchpos"+k+Math.round(r.main.pt.x/60), bb.id, "встаю под "+calloutName(r.main.pt.x, r.main.pt.y).replace(/^на /,"")+(r.open - (r.main ? r.main.wn : 0) < 0.2 ? ", остальные входы закрыты" : "")); }}, "clutch:"+k);
    return true;
  }
  // (v142)''')

# ===== v146: утечки знания + охота на последних =====
rep("  holdTask: true,", "  holdTask: true,\n  noLeaks: true,      // v146: команды решают только по тому, что реально знают\n  egFix: true,        // v146: охота на последних — только рядом со свежим врагом; до планта T идут ставить")
# (1) siteHeat: CT узнают, куда ходили T, только по итогам раунда
s = s.replace("siteHeat[tt.site] = (siteHeat[tt.site]||0) + 1;", "if(BAL.noLeaks) siteHeatPending[tt.site] = 1; else siteHeat[tt.site] = (siteHeat[tt.site]||0) + 1;")
rep("var siteHeat = {A:1, B:1};", "var siteHeatPending = {};\nvar siteHeat = {A:1, B:1};")
rep("function endRound(winner, reason){\n", "function endRound(winner, reason){\n  for(var shk in siteHeatPending){ siteHeat[shk] = (siteHeat[shk]||0) + 1; } siteHeatPending = {};\n")
# (2) T "CT сейвят": не флаг из мозга CT, а вывод по своей инфе
rep("    var ctSaving = teamTac.CT && teamTac.CT.saving;", """    var ctSaving = teamTac.CT && teamTac.CT.saving;
    if(BAL.noLeaks){
      // CT не идут на ретейк: после планта прошло 15с+, у бомбы и на подходах их
      // не видели и не слышали 10с, и их меньше нас — похоже на сейв
      var ctNearB = intelEstimate("T", bomb.x, bomb.y, 1200, 10*TICK_HZ);
      ctSaving = tick - bomb.plantTick > 15*TICK_HZ && (ctNearB.seen + ctNearB.heard) === 0 && aliveCount("CT") < ts.length;
    }""")
# (3) лёркер на пост-планте: не план ретейка CT, а вход CT на сайт (это знает любой)
rep("    var R = bomb && bomb.retake;\n    if(R && R.approaches && R.approaches.length){\n      var a = R.approaches[0];",
    "    var R = bomb && bomb.retake;\n    if(BAL.noLeaks && GEO[tt.site] && GEO[tt.site].ctEntry){ R = {approaches:[GEO[tt.site].ctEntry]}; }\n    if(R && R.approaches && R.approaches.length){\n      var a = R.approaches[0];")
# (4) CT граната на выход: "уже зашли" — по коллам, а не по настоящим позициям
rep('    if(bots.filter(function(o){ return o.alive && o.team === "T" && Math.hypot(o.x-SITES[k].x, o.y-SITES[k].y) < 220; }).length > 1) return;',
    '    if(BAL.noLeaks){ var onS = {}; teamIntel.CT.sig.forEach(function(sg){ if(sg.type === "spotted" && sg.id && tick - sg.tick < 1.5*TICK_HZ && Math.hypot(sg.x-SITES[k].x, sg.y-SITES[k].y) < 220) onS[sg.id] = 1; }); if(Object.keys(onS).length > 1) return; }\n    else if(bots.filter(function(o){ return o.alive && o.team === "T" && Math.hypot(o.x-SITES[k].x, o.y-SITES[k].y) < 220; }).length > 1) return;')
# (5) "ранили — сменить позицию": не проверять настоящие позиции врагов
rep('  if(!bots.some(function(o){ return o.alive && o.team === foe && Math.hypot(o.x-b.x, o.y-b.y) < 1400; })) return;',
    '  if(BAL.noLeaks ? aliveCount(foe) === 0 : !bots.some(function(o){ return o.alive && o.team === foe && Math.hypot(o.x-b.x, o.y-b.y) < 1400; })) return;')
# (6) охота на последних
rep("function endgameBrain(){\n  if(!BAL.endgame || roundState !== \"live\" || (bomb && bomb.state === \"planted\")) return;",
"""function endgameBrain(){
  // (v146) после планта охоты нет: у T — пост-плант, у CT — ретейк/сейв
  if(BAL.egFix && bomb && bomb.state === "planted") bots.forEach(function(o){ if(o.alive && o.post && o.post.tag === "endhunt"){ o._egLock = 0; o._egC = null; clearPost(o); } });
  if(!BAL.endgame || roundState !== "live" || (bomb && bomb.state === "planted")) return;""")
rep("""    mine.forEach(function(b){
      if(b.planting || b.defusing || b._sawEnemy || b._stopPlantUntil > tick) return;
      if(team === "T" && bomb && bomb.state === "carried" && bomb.carrier === b) return; // носитель ставит
      var d = Math.hypot(kp.x-b.x, kp.y-b.y);""","""    mine.forEach(function(b){
      if(b.planting || b.defusing || b._sawEnemy || b._stopPlantUntil > tick) return;
      if(team === "T" && bomb && bomb.state === "carried" && bomb.carrier === b) return; // носитель ставит
      var d = Math.hypot(kp.x-b.x, kp.y-b.y);
      // (v146) по демкам: у про при перевесе до планта T в 77% идут ставить (≈8с),
      // а не ищут последних; CT — время на их стороне. Добивать идёт только тот,
      // кто рядом со СВЕЖИМ врагом (≤3с, ≤700px) — остальные играют свою задачу
      if(BAL.egFix){
        var klo = (beliefLast[team] || {})[K.id], kAge = klo ? tick - klo.tick : 1e9;
        if(klo && Math.hypot(klo.x-kp.x, klo.y-kp.y) > 300) kAge = Math.min(kAge, K.tick != null ? tick - K.tick : kAge);
        if(kAge > 3*TICK_HZ || d > 700){
          if(b.post && b.post.tag === "endhunt"){ b._egLock = 0; b._egC = null; clearPost(b); }
          return;
        }
      }""")

exec(open('patch147.py').read())
exec(open('patch148.py').read())
exec(open('patch149.py').read())
exec(open('patch150.py').read())
exec(open('patch150b.py').read())
exec(open('patch151.py').read())
exec(open('patch152.py').read())
exec(open('patch153.py').read())
exec(open('patch154.py').read())
exec(open('patch155.py').read())
exec(open('patch156.py').read())
exec(open('patch157.py').read())
exec(open('patch158.py').read())
exec(open('patch159.py').read())
exec(open('patch160.py').read())
exec(open('patch161.py').read())
exec(open('patch162.py').read())
exec(open('patch163.py').read())
exec(open('patch164.py').read())
exec(open('patch165.py').read())
exec(open('patch166.py').read())
exec(open('patch167.py').read())
exec(open('patch168.py').read())
exec(open('patch169.py').read())
open(sys.argv[1],'w').write(s)
