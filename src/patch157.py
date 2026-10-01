# v155 шаг 6: темп T как у про — дефолт в начале, раши редко, время выхода по демкам.
rep("var BAL = {", """var BAL = {
  proTempo: true,     // v155: раши ~5–8% раундов (в основном эко/пистолетка), время выхода по распределению плантов про (медиана ~66с), длинный сетап начинается с дефолта""")

# A) доля рашей по типу раунда + B) время выхода по демкам
rep("""  var tac = pool[weightedChoice(pool, weights, roundNum*7919 + matchNum*104729 + 17)];""","""  // (v155) у про плант раньше 35с — 13% плантов; у ботов было 26%, раши шли
  // в 19% раундов. Доля рашей теперь задана по типу закупа, остальное — выходы
  if(BAL.proTempo){
    var RP = {pistol:0.20, eco:0.25, force:0.08, half:0, full:0}[type] || 0;
    var rW = 0, nW = 0; pool.forEach(function(t, i){ if(t.style === "rush") rW += weights[i]; else nW += weights[i]; });
    if(rW > 0 && nW > 0){ var kR = RP > 0 ? (RP/(1-RP))*nW/rW : 0; pool.forEach(function(t, i){ if(t.style === "rush") weights[i] *= kR; }); }
  }
  var tac = pool[weightedChoice(pool, weights, roundNum*7919 + matchNum*104729 + 17)];""")

rep("""  teamTac.T = {tac:tac, site:tac.site, phase: tac.setupEnd > 0 ? "setup" : "execute", execTick: roundStartTick + setupSec*64,""","""  var defUntil = null;
  if(BAL.proTempo && tac.setupEnd > 0){
    // время планта — из распределения про (квантили 10/25/50/75/90% = 34/44/66/88/103с),
    // выход ~12с до планта (у ботов от выхода до планта 10–15с); стиль тактики сдвигает: выходы раньше, дефолт/фейк позже
    var u = hashRand(roundNum*6271 + matchNum*353 + 29);
    if(tempoRead === "slow") u = 0.5 + 0.5*u; else if(tempoRead === "fast") u = 0.5*u;
    var bias = {exec:[0, 0.8], split:[0.05, 0.9], fake:[0.25, 0.75], "default":[0.3, 0.7]}[tac.style] || [0, 1];
    u = bias[0] + bias[1]*u;
    var QX = [0, 0.10, 0.25, 0.50, 0.75, 0.90, 1], QY = [22, 34, 44, 66, 88, 100, 106], pT = QY[QY.length-1];
    for(var qi = 1; qi < QX.length; qi++){ if(u <= QX[qi]){ pT = QY[qi-1] + (QY[qi]-QY[qi-1])*(u-QX[qi-1])/(QX[qi]-QX[qi-1]); break; } }
    setupSec = Math.round(Math.max(tac.setupEnd*0.6, Math.min(ROUND_TIME_SEC - 26, pT - 12)));
    tmode = setupSec < tac.setupEnd - 6 ? ", быстрый" : (setupSec > tac.setupEnd + 8 ? ", поздний" : "");
    // длинный сетап: сначала дефолт (контроль карты), свою расстановку тактика
    // занимает за столько же секунд до выхода, сколько ей нужно было с начала раунда
    var need = Math.max(14, tac.setupEnd - 6);
    if(setupSec - need >= 12) defUntil = roundStartTick + (setupSec - need)*64;
  }
  teamTac.T = {tac:tac, site:tac.site, phase: tac.setupEnd > 0 ? "setup" : "execute", execTick: roundStartTick + setupSec*64, defUntil: defUntil, minExec: (BAL.proTempo && tac.setupEnd > 0) ? Math.min(setupSec, 30) : 0, needT: (BAL.proTempo && tac.setupEnd > 0) ? Math.max(14, tac.setupEnd - 6) : 0,""")

# C) дефолт в начале длинного сетапа
rep("""    if(lurker) lurkerBrain(lurker, tt, other);
    if(tac.groups){
      tac.groups.forEach(function(G, gi){
        var mem = pick(G.roles);
        if(!mem.length) return;
        mem.forEach(function(b){ startRoute(b, G.via, tac.id+":"+gi); });""","""    if(lurker) lurkerBrain(lurker, tt, other);
    var inDef = BAL.proTempo && tt.defUntil && tick < tt.defUntil && tick < tt.execTick - tt.needT*TICK_HZ && tac.style !== "default";
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
        if(!tt.defUntil) mem.forEach(function(b){ startRoute(b, G.via, tac.id+":"+gi); });""")
rep("версия 154 · 30.09","версия 155 · 30.09")

# реакции IGL (минус в сетапе, взяли мид, перекол) не должны превращать
# поздний выход в раш на 13-й секунде: не раньше 30с (или планового, если он раньше)
rep("""function tBrain(){
  var tt = teamTac.T; if(!tt) return;""","""function tBrain(){
  var tt = teamTac.T; if(!tt) return;
  if(BAL.proTempo && tt.phase === "setup" && tt.minExec && tt.execTick < roundStartTick + tt.minExec*TICK_HZ) tt.execTick = roundStartTick + tt.minExec*TICK_HZ;""")
# быстрые выходы "по инфе" (соло на сайте, сняли опорника) — у про бывают, но
# не на 13-й секунде и не каждый раз: соло читаем с 28с и в половине случаев
rep("""  if(tt.phase === "setup" && tick - roundStartTick > 12*TICK_HZ && !tt.soloGo){""","""  if(tt.phase === "setup" && tick - roundStartTick > (BAL.proTempo ? 28 : 12)*TICK_HZ && !tt.soloGo && !(BAL.proTempo && hashRand(roundNum*577 + matchNum*41 + 3) < 0.5)){""")
rep("""    if(pickSig && aliveCount("T") >= 4){""","""    if(pickSig && aliveCount("T") >= 4 && (!BAL.proTempo || tick - roundStartTick > 22*TICK_HZ)){""")
# "мид взят" ускорял выход до ≤15с — это был главный источник ранних выходов
rep("""      tt.execTick = Math.max(tick + 10*TICK_HZ, Math.min(tt.execTick, tick + 15*TICK_HZ));
      voiceLog("T", "midtake",""","""      tt.execTick = BAL.proTempo ? Math.max(tick + 18*TICK_HZ, Math.min(tt.execTick, tick + 30*TICK_HZ)) : Math.max(tick + 10*TICK_HZ, Math.min(tt.execTick, tick + 15*TICK_HZ));
      voiceLog("T", "midtake",""")
