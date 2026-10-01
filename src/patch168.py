# v165: (1) "минус мидер" — мид берёт ближайший свободный CT и только если это
# имеет смысл; (2) перераспределение сайта — второй на сайте меняет угол, если
# его вход уже держат (тиммейт подпушил вперёд / двое на одном входе).
rep("var BAL = {", """var BAL = {
  midCover2: true,    // v165: мид за погибшего мидера берёт ближайший свободный CT; пересмотр каждые 3с; в пути — "идёт на мид"
  siteRebal: true,    // v165: двое на одном входе / тиммейт подпушил — второй берёт свободный вход или встаёт под размен""")
# ---------- (1) минус мидер ----------
rep("""function midCoverPost(b, cts){
  var midAlive = cts.some(function(o){ return o.tRole === "mid"; }); if(midAlive) return false;""","""function midCoverPick(cts){
  var ct = teamTac.CT, S = ct._mcv;
  if(S && S.round === roundNum && (S.id ? cts.some(function(o){ return o.id === S.id; }) : tick < S.until)) return S.id;
  var best = null, bd = 1e9;
  cts.forEach(function(o){
    if(o.tRole === "mid" || o.planting || o.defusing || o._sawEnemy) return;
    var k = Math.hypot(o.x-SITES.A.x, o.y-SITES.A.y) < Math.hypot(o.x-SITES.B.x, o.y-SITES.B.y) ? "A" : "B";
    // опорник уходит с сайта, только если на сайте остаётся ещё кто-то
    if(/^anchor/.test(o.tRole) && cts.filter(function(q){ return q !== o && Math.hypot(q.x-SITES[k].x, q.y-SITES[k].y) < 600; }).length === 0) return;
    // на его сайте инфа (видели/слышали T за 4с рядом со входом) — нужен там
    if(intelEstimate("CT", GEO[k].tEntry.x, GEO[k].tEntry.y, 600, 4*TICK_HZ).n > 0 && Math.hypot(o.x-SITES[k].x, o.y-SITES[k].y) < 700) return;
    var d = Math.hypot(o.x-GEO.ctMid.x, o.y-GEO.ctMid.y) + (o.tRole === "rotator" ? -150 : o.tRole === "roamer" ? -100 : 200);
    if(d < bd){ bd = d; best = o; }
  });
  ct._mcv = {round:roundNum, id: best ? best.id : null, until: tick + 3*TICK_HZ};
  return ct._mcv.id;
}
function midCoverPost(b, cts){
  var midAlive = cts.some(function(o){ return o.tRole === "mid"; }); if(midAlive) return false;
  if(BAL.midCover2){
    if(tick - roundStartTick < 5*TICK_HZ || (bomb && bomb.state === "planted")) return false;
    if(midCoverPick(cts) !== b.id) return false;
    var M2 = b._midCover;
    if(!M2 || M2.round !== roundNum){
      var sps2 = pickSpots("midcover", GEO.ctMid, 3, {rMin:60, rMax:300, minGap:60, see:[GEO.ctMidLook], hideFrom:[GEO.tMid]});
      M2 = b._midCover = {round:roundNum, pt: sps2[0] || GEO.ctMid};
      voiceLog("CT", "midcover"+roundNum, b.id, "минус мид — я ближе всех, беру мид");
    }
    var far = Math.hypot(b.x-M2.pt.x, b.y-M2.pt.y) > 220;
    setPost(b, M2.pt, GEO.ctMidLook, true, far ? "midcover:go" : "midcover");
    return true;
  }""")
rep("""[/^midcover/,"держит мид вместо мидера"]""","""[/^midcover:go/,"идёт на мид (мидер погиб)"],[/^midcover/,"держит мид вместо мидера"]""")
# ---------- (2) перераспределение сайта ----------
rep("""function infoFallbackTick(){
  tFallbackTick();""","""// (v165) ПЕРЕРАСПРЕДЕЛЕНИЕ САЙТА. Точка, куда смотрит защитник = луч взгляда с
// его поста до стены (≤500px). Двое смотрят в одну точку, или туда уже вышел
// тиммейт — второй берёт угол, который про с этого сайта держат, а сейчас не
// держит никто; не нашёл — встаёт глубже, под размен вышедшего вперёд.
var REBAL = {every:48, minHold:5, R:560, same:190, fwdR:230, freeR:260};
function rebalTarget(px, py, a){ var c = rayClipWalls(px, py, px + Math.cos(a)*500, py + Math.sin(a)*500); return {x:c.x, y:c.y}; }
function rebalLookOf(o){
  var px = o.post.x, py = o.post.y, a;
  if(o.post.pro && o._proM && o._proM.k === o.post.pro.k && o.post.pro.m[o._proM.i]) a = o.post.pro.m[o._proM.i][0];
  else if(o.post.look) a = Math.atan2(o.post.look.y-py, o.post.look.x-px);
  else a = o.facing || 0;
  return rebalTarget(px, py, a);
}
function rebalSpot(b, k, taken, avoidPts, opt){
  var L = PRO_SPOTS["CT|pre"] || [], best = null, bs = -1e9;
  for(var i=0;i<L.length;i++){ var s = L[i];
    if(Math.hypot(s[0]-SITES[k].x, s[1]-SITES[k].y) > REBAL.R || insideSolidWall(s[0], s[1])) continue;
    if(bots.some(function(o){ return o !== b && o.alive && o.team === "CT" && Math.hypot(o.x-s[0], o.y-s[1]) < 70; })) continue;
    var modes = [[s[3], s[4]]]; if(s.length > 5) modes.push([s[5], s[6]]);
    modes.forEach(function(m){
      var t = rebalTarget(s[0], s[1], m[0]);
      if(Math.hypot(t.x-s[0], t.y-s[1]) < 90) return;
      if(opt && opt.see){ if(!hasLOS(s[0], s[1], opt.see.x, opt.see.y) || Math.hypot(s[0]-SITES[k].x, s[1]-SITES[k].y) > Math.hypot(opt.see.x-SITES[k].x, opt.see.y-SITES[k].y) - 60) return;
        if(_angOff(m[0], Math.atan2(opt.see.y-s[1], opt.see.x-s[0])) > 0.7) return; }
      else if(taken.some(function(q){ return Math.hypot(q.x-t.x, q.y-t.y) < REBAL.freeR; }) || avoidPts.some(function(q){ return Math.hypot(q.x-t.x, q.y-t.y) < REBAL.freeR; })) return;
      // угол в сторону своего спавна/тыла — не угол
      if(Math.hypot(t.x-CT_SPAWN.x, t.y-CT_SPAWN.y) < Math.hypot(s[0]-CT_SPAWN.x, s[1]-CT_SPAWN.y) - 120) return;
      var sc = Math.log(1 + s[2]) + 1.2*m[1] - Math.hypot(s[0]-b.x, s[1]-b.y)/400;
      if(sc > bs){ bs = sc; best = {pt:{x:s[0], y:s[1]}, look:{x:s[0] + Math.cos(m[0])*300, y:s[1] + Math.sin(m[0])*300}, t:t}; }
    });
  }
  return best;
}
function siteRebalanceTick(){
  if(!BAL.siteRebal || tick % REBAL.every || roundState !== "live" || (bomb && bomb.state === "planted")) return;
  if(tick - roundStartTick < 12*TICK_HZ) return;
  var cts = bots.filter(function(o){ return o.alive && o.team === "CT"; });
  cts.forEach(function(o){ var R = o._rebal; if(!R) return;
    if(R.round !== roundNum || o._sawEnemy){ o._rebal = null; return; }
    if(tick - R.t < REBAL.minHold*TICK_HZ) return;
    var q = bots.filter(function(x){ return x.id === R.by; })[0];
    var still = q && q.alive && (R.fwd ? Math.hypot(q.x-R.fx, q.y-R.fy) < 220 : true);
    if(!still){ o._rebal = null; voiceLog("CT", "rebalOff"+o.id+tick, o.id, "возвращаюсь на свой угол"); }
  });
  ["A","B"].forEach(function(k){
    var site = SITES[k];
    var defs = cts.filter(function(o){ return o.atPost && o.post && !o._sawEnemy && !o.nadeTask && Math.hypot(o.post.x-site.x, o.post.y-site.y) < REBAL.R && /^(anchor|rotator|set:|stack|cts:|rebal|rotateHold|sitehold)/.test(o.post.tag); });
    if(!defs.length) return;
    var T = defs.map(function(o){ return rebalLookOf(o); });
    defs.forEach(function(o, i){
      if(o._rebal) return;
      var t = T[i], dO = Math.hypot(o.post.x-site.x, o.post.y-site.y), by = null, fwd = false;
      // тиммейт вышел туда, куда я смотрю (дальше от сайта, чем я)
      cts.forEach(function(q){ if(q === o || by) return;
        if(!(q.curSpeed > 40*SPD_K) && Math.hypot(q.x-t.x, q.y-t.y) < REBAL.fwdR && Math.hypot(q.x-site.x, q.y-site.y) > dO + 80 && hasLOS(o.post.x, o.post.y, q.x, q.y)){ by = q; fwd = true; } });
      // другой защитник смотрит в ту же точку, и он к ней ближе
      if(!by) defs.forEach(function(q, j){ if(q === o || by) return;
        if(Math.hypot(T[j].x-t.x, T[j].y-t.y) < REBAL.same && Math.hypot(q.post.x-T[j].x, q.post.y-T[j].y) <= Math.hypot(o.post.x-t.x, o.post.y-t.y)) by = q; });
      if(!by) return;
      var taken = T.filter(function(_, j){ return j !== i; }), avoid = cts.filter(function(q){ return q !== o; }).map(function(q){ return {x:q.x, y:q.y}; });
      var sp = rebalSpot(o, k, taken, fwd ? avoid.concat([t]) : [t]), why;
      if(sp) why = (fwd ? by.id+" вышел вперёд" : by.id+" держит тот же угол")+" — беру угол "+calloutName(sp.t.x, sp.t.y);
      else if(fwd){ sp = rebalSpot(o, k, [], [], {see:{x:by.x, y:by.y}}); if(sp){ sp.look = {x:by.x, y:by.y}; why = by.id+" впереди — встаю под размен"; } }
      if(!sp) return;
      o._rebal = {round:roundNum, t:tick, by:by.id, fwd:fwd, fx:by.x, fy:by.y};
      setPost(o, sp.pt, sp.look, true, "rebal"+k);
      voiceLog("CT", "rebal"+o.id+tick, o.id, why);
    });
  });
}
function infoFallbackTick(){
  siteRebalanceTick();
  tFallbackTick();""")
# пост роли не перебивает перераспределение (кроме срочного)
rep("""  // игрок на пробе (вышел вперёд за инфой) — пост группы его не перебивает""","""  if(BAL.siteRebal && b._rebal && b._rebal.round === roundNum && !/^(rebal|retake|defuse|flee|save|fetch|stopplant|antidefuse|tradeR|repos|clutch|rotate|endhunt|gather|midcover|lineup|smokeWait|pickup)/.test(tag)) return;
  // игрок на пробе (вышел вперёд за инфой) — пост группы его не перебивает""")
rep("""var PSN_TAGS = /^(anchor|""","""var PSN_TAGS = /^(rebal|anchor|""")
rep("""[/^midcover:go/,""","""[/^rebal/,"сменил угол: вход держат"],[/^midcover:go/,""")
rep("версия 164 · 01.10","версия 165 · 01.10")
