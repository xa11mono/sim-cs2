// (v438, док владельца м1 Mirage v436, 27.10) сторож замечаний дока — только запись, игру не меняет. Вставляется в rec2.js (walk_run.py).
// Считает то, что в доке проверялось руками на одном матче, — на 8 матчах: судьба заданий гранат, вход в огонь, шифт без слушателей,
// точка «выхода на врага» (видно ли оттуда, тот ли этаж), взгляд за спину «путь к врагу», дубли смоков, пост-плант у бомбы, войс,
// где стоят T в дефолте, сейв при деньгах, пик на перезарядку, нож при перезарядке, пути на тик решений.
(function(){
  var g = (typeof window !== "undefined" ? window : globalThis);
  var D = {nt:{}, ntEx:[], swEx:[], fire:{birth:0, commit:0, other:0}, walk:{n:0, far:0, bomb:0}, swing:{n:0, noLos:0, high:0}, known:{n:0, behind:0},
    smokeDup:{n:0, dup:0}, pp:{n:0, near:0}, voice:{n:0, rounds:0}, def:{}, save:{n:0, rich:0}, rl:{peek:0, knife:0}, path:{n:0, ticks:0, max:0},
    buy:{T:[0,0], CT:[0,0]}, thrown:{T:0, CT:0}, car:{n:0, swing:0, engage:0, lowEngage:0}, entryOther:{n:0, other:0}, defD:{}, tacZ:{}, walkWhy:{}, voiceK:{}, walk2:{}, execWhy:{}, voiceRep:{}, defTr:[], lateTr:[]};
  function inc(o, k, v){ o[k] = (o[k]||0) + (v == null ? 1 : v); }
  function zn(x, y){ var z = zoneIdAt(x, y); return (z && zoneUserName(z)) || "?"; }
  // --- задания гранат: чем кончилось (брошена / задача важнее не пустила / отказ броска / срок) ---
  var thrownBy = {}, failBy = {};
  if(typeof throwNade === "function"){ var TN = throwNade; throwNade = function(b){ var r = TN.apply(this, arguments);
    if(roundState === "live"){ if(r !== false){ thrownBy[b.id] = tick; inc(D.thrown, b.team); } else failBy[b.id] = NADE_FAIL; } return r; }; }
  if(typeof updateNadeTasks === "function"){ var UN = updateNadeTasks; updateNadeTasks = function(){
    var pre = {}; bots.forEach(function(b){ if(b.nadeTask) pre[b.id] = {t:b.nadeTask, walk: !!(b.nadeTask.from && Math.hypot(b.nadeTask.from.x-b.baseX, b.nadeTask.from.y-b.baseY) > 36 && !(b.atPost && b.post && b.post.tag === "lineup")), exp: tick > b.nadeTask.until, tag: b.post ? String(b.post.tag).split(":")[0] : ""}; });
    thrownBy = {}; failBy = {};
    var r = UN.apply(this, arguments);
    if(roundState === "live") bots.forEach(function(b){ var p = pre[b.id]; if(!p || b.nadeTask === p.t) return;
      var k = thrownBy[b.id] === tick ? "thrown" : p.exp ? "expired" : failBy[b.id] ? "fail:" + failBy[b.id] : p.walk ? "task:" + p.tag : "other";
      inc(D.nt, b.team + "|" + k); });
    return r; }; }
  // --- дубли смоков: смок той же команды разорвался ≤ 160 от другого за ≤ 15 с ---
  var SM = [];
  if(typeof detonate === "function"){ var DT = detonate; detonate = function(n){ if(roundState === "live" && n.type === "smoke"){ D.smokeDup.n++;
      if(SM.some(function(s){ return s.team === n.team && tick - s.t <= 15*TICK_HZ && Math.hypot(s.x-n.x, s.y-n.y) < 160; })) D.smokeDup.dup++;
      SM.push({team:n.team, t:tick, x:n.x, y:n.y}); } return DT.apply(this, arguments); }; }
  // --- войс ---
  if(typeof voiceFeed === "function"){ var VF = voiceFeed; voiceFeed = function(team, who, text, kind){ if(roundState === "live"){ D.voice.n++; var k = String(text).replace(/«[^»]*»/g, "X").replace(/\d+/g, "N").replace(/(T|CT)N/g, "ID").slice(0, 34); inc(D.voiceK, k); var rk = roundNum + "|" + who + "|" + k; VR[rk] = (VR[rk]||0) + 1; var vr = D.voiceRep[k] || (D.voiceRep[k] = [0, 0, 0]); vr[0]++; if(VR[rk] === 1) vr[1]++; if(VR[rk] === 3) vr[2]++; } return VF.apply(this, arguments); }; }
  // --- пути (FPS): сколько раз строится путь за тик ---
  if(typeof buildWaypointPath === "function"){ var BW = buildWaypointPath; buildWaypointPath = function(){ D.path.n++; return BW.apply(this, arguments); }; }

  // (v443б) почему выход раньше плана: последние сообщения IGL / T до смены фазы или подтягивания execTick
  var LOGS = [];
  if(typeof logEvent === "function"){ var LE = logEvent; logEvent = function(text){ if(roundState === "live" && /^(IGL|T[: ])/.test(String(text))) { LOGS.push(String(text).replace(/«[^»]*»/g, "X").replace(/\d+(\.\d+)?/g, "N").replace(/(T|CT)N/g, "ID").slice(0, 70)); if(LOGS.length > 3) LOGS.shift(); } return LE.apply(this, arguments); }; }
  var prevPh = null, prevEx = null, VR = {};
  // (v443б) шифт: какое условие шага из 540 сработало — пересчёт тех же условий без побочных эффектов (кэш dangerWalk не трогаем)
  function dwPure(b){
    var foe = b.team, pts = [], acc = 0, px = b.baseX, py = b.baseY, o = {zone:0, real:0, unc:0, near:0};
    for(var i = b.pathIdx || 0; b.path && i < b.path.length && acc < 260; i++){ var q = b.path[i]; acc += Math.hypot(q[0]-px, q[1]-py); px = q[0]; py = q[1]; pts.push([px, py]); }
    if(!pts.length && b.post) pts.push([b.post.x, b.post.y]);
    var thr = BAL.dangerWalkThr || 0.12, seen = {}, flagZ = {};
    // (v443) как в 470: без запаса по таймингу (если в игре он убран) и только при живом враге, не засвеченном далеко за 5 с
    var v443 = /unacc/.test(String(dangerWalk)), BLw = beliefLast[b.team] || {};
    var unacc = !v443 || bots.some(function(e){ if(!e.alive || e.team === b.team) return false; var l = BLw[e.id]; if(!l || tick - l.tick > 5*TICK_HZ) return true;
      return pts.some(function(q){ return Math.hypot(q[0]-l.x, q[1]-l.y) <= 1.5*STEP_HEAR_R(); }); });
    var uW = function(j){ var R = REACH[foe]; return (v443 && R && !(R[j] <= tick)) ? 0 : uncheckedW(foe, j); };
    pts.forEach(function(q){ var zi = bzOf(q[0], q[1]); if(zi < 0 || seen[zi]) return; seen[zi] = 1;
      var own = reachPossible(foe, zi) ? beliefZoneKnown(foe, zi) : 0, nb = 0;
      (BZ.nbr[zi]||[]).forEach(function(j){ if(reachPossible(foe, j)){ var v = beliefZoneKnown(foe, j); if(v > nb) nb = v; } });
      if(own + 0.5*nb >= thr){ o.zone = 1; flagZ[zi] = 1; (BZ.nbr[zi]||[]).forEach(function(j){ flagZ[j] = 1; }); }
      var uc = uW(zi); (BZ.nbr[zi]||[]).forEach(function(j){ var c = BZ.cent[j]; if(c && Math.hypot(c.x-q[0], c.y-q[1]) < 320) uc = Math.max(uc, uW(j)); });
      if(unacc && uc >= 0.8 && LOOK.uncheckWalk >= thr) o.unc = 1; });
    if(o.zone) o.real = bots.some(function(e){ return e.alive && e.team !== b.team && flagZ[bzOf(e.x, e.y)]; }) ? 1 : 0;
    if(BAL.clearQuiet){ var BL = beliefLast[b.team] || {};
      for(var eid in BL){ var lo = BL[eid]; if(!lo || tick - lo.tick > 15*TICK_HZ) continue; var fb = teamBot(eid); if(!fb || !fb.alive) continue;
        if(pts.some(function(q){ return Math.hypot(q[0]-lo.x, q[1]-lo.y) < 650; })){ o.near = 1; break; } } }
    return o;
  }
  function walkParts(b){
    var R = [], tg = b.post ? String(b.post.tag) : "", ps = b.post && b.state === "patrol", dp = b.post ? Math.hypot(b.post.x-b.baseX, b.post.y-b.baseY) : 1e9;
    var mv = b.path && b.pathIdx < b.path.length;
    if(!mv && b._hold && b._hold.post === b.post && (b.atPost || b.holding)) R.push("hold");
    if(b._pie && b._pie.slice && tick - b._pie.t < 16) R.push("pie");
    if(b.lastIntel && tick - b.lastIntel.tick < CAUTION_TICKS && Math.hypot(b.lastIntel.x-b.baseX, b.lastIntel.y-b.baseY) <= 1.5*STEP_HEAR_R()) R.push("intel");
    if(b.heardSound && tick - b.heardSound.tick < SOUND_CAUTION_TICKS && Math.hypot(b.heardSound.x-b.baseX, b.heardSound.y-b.baseY) <= 1.5*STEP_HEAR_R()) R.push("heard");
    if(b.role === "roamer" && !b.roamChecking && b.roamTarget && b.state === "patrol" && Math.hypot(b.roamTarget.x-b.baseX, b.roamTarget.y-b.baseY) < ROAM_QUIET_RADIUS) R.push("roam");
    if(ps && (tg === "flank1" || tg === "flank2")) R.push("flank");
    if(ps && /^gather/.test(tg) && dp < 500) R.push("gather"); if(ps && /^probe/.test(tg) && dp < 420) R.push("probe"); if(ps && tg === "shift" && dp < 450) R.push("shift");
    if(BAL.soloSlow && b.team === "T" && bomb && bomb.state === "carried" && bomb.carrier === b && aliveCount("T") === 1 && soloMayWalk(b)) R.push("solo");
    if(BAL.cautious && ps && /^(retake|rotate|defuse)$/.test(tg) && dp < 350) R.push("cautious");
    if(b.tRole === "lurker" && ps && /^lurk/.test(tg) && tg !== "lurkStage"+(teamTac.T && teamTac.T.site==="A"?"B":"A")) R.push("lurker");
    if(BAL.dangerWalk){ var P = dwPure(b); if(P.zone) R.push(P.real ? "dz:zone" : "dz:zone-phantom"); if(P.unc) R.push("dz:unchecked"); if(P.near) R.push("dz:near");
      if(!P.zone && !P.unc && !P.near && b._dwVal) R.push("dz:commit"); }
    if(defuseWalk(b)) R.push("defuse"); if(ps && tg === "endhunt" && dp < 350) R.push("endhunt");
    return (mv ? "mv" : "st") + "|" + (R.join(",") || "?");
  }
  var prevFire = {}, lastR = -1, pathT = 0;
  D.tick = function(){
    if(roundState !== "live"){ prevFire = {}; SM = []; return; }
    if(roundNum !== lastR){ lastR = roundNum; D.voice.rounds++; VR = {}; prevPh = null; prevEx = null; LOGS = [];
      bots.forEach(function(b){ var n = b.nades ? b.nades.smoke + b.nades.flash + b.nades.he + b.nades.molly : 0; D.buy[b.team][0] += n; D.buy[b.team][1]++; }); }
    var pn = D.path.n - pathT; pathT = D.path.n; D.path.ticks++; if(pn > D.path.max) D.path.max = pn;
    bots.forEach(function(b){ if(!b.alive) return;
      var f = inFire(b.baseX, b.baseY);
      if(f && !prevFire[b.id]){ if(tick - f.born <= 20) D.fire.birth++; else if(typeof fireCommit === "function" && fireCommit(b)) D.fire.commit++; else D.fire.other++; }
      prevFire[b.id] = !!f;
      if(b.post && b.post.tag === "repos:reload" && b._reloading && b.__rlT !== b.post) { b.__rlT = b.post; D.rl.peek++; }
      if(b._knife && b._reloading && !b.__kr){ b.__kr = 1; D.rl.knife++; } else if(!(b._knife && b._reloading)) b.__kr = 0; });
    if(tick % 32) return;
    var secIn = (tick - roundStartTick)/TICK_HZ;
    bots.forEach(function(b){ if(!b.alive) return;
      var foes = bots.filter(function(o){ return o.alive && o.team !== b.team; });
      if(b.walking){ D.walk.n++; var dmin = 1e9; foes.forEach(function(o){ dmin = Math.min(dmin, Math.hypot(o.x-b.x, o.y-b.y)); }); if(dmin > 600){ D.walk.far++;
          var wr = [], tgw = b.post ? String(b.post.tag) : "";
          if(b.lastIntel && tick - b.lastIntel.tick < CAUTION_TICKS) wr.push("intel"); if(b.heardSound && tick - b.heardSound.tick < SOUND_CAUTION_TICKS) wr.push("heard");
          if(b.role === "roamer" && b.roamTarget) wr.push("roam"); if(/^(flank|gather|probe|shift|retake|rotate|defuse|endhunt)/.test(tgw)) wr.push("tag:" + tgw.split(":")[0]);
          if(b.tRole === "lurker" && /^lurk/.test(tgw)) wr.push("lurker"); if(b._dwVal) wr.push("danger:" + (b._dwWhy || "zone")); if(b._pie && b._pie.slice && tick - b._pie.t < 16) wr.push("pie");
          inc(D.walkWhy, b.team + "|" + (wr.join(",") || "?")); }
        if(bomb && bomb.state === "planted" && bombTimeLeftTicks() < 5*TICK_HZ && bombDamageAt(b.x, b.y) >= b.hp) D.walk.bomb++; }
      if(b.post && b.post.tag === "contact:swing" && b._contact && D.swEx.length < 1500 && b.__swP !== b.post){ b.__swP = b.post;   // (v438) примеры: раунд, тик, бот, точка, контакт, видно, на полу
        var lz = b.z != null ? navAtLevel(b.post.x, b.post.y, b.z) : null;
        D.swEx.push([roundNum, tick, b.id, Math.round(b.post.x), Math.round(b.post.y), Math.round(b._contact.x), Math.round(b._contact.y), hasLOS(b.post.x, b.post.y, b._contact.x, b._contact.y, lz ? lz.z : b.z) ? 1 : 0, (b.z == null || lz) ? 1 : 0]); }
      if(b.post && b.post.tag === "contact:swing" && b._contact){ D.swing.n++;
        if(!hasLOS(b.post.x, b.post.y, b._contact.x, b._contact.y)) D.swing.noLos++;
        if(b.z != null && !navAtLevel(b.post.x, b.post.y, b.z)) D.swing.high++; }   // на уровне бота пола у точки нет (ящик, другой этаж)
      if(b._lkPick && b._lkPick.j === "known" && b.curSpeed > 60*SPD_K && b.heading !== undefined){ D.known.n++;
        var a = Math.atan2(b._lkPick.pt.y-b.y, b._lkPick.pt.x-b.x), d = Math.abs(((a - b.heading + Math.PI) % (2*Math.PI) + 2*Math.PI) % (2*Math.PI) - Math.PI); if(d > 1.9) D.known.behind++; }
      if(bomb && bomb.state === "carried" && bomb.carrier === b){ D.car.n++; if(b.post && b.post.tag === "contact:swing") D.car.swing++; if(b.state === "engage"){ D.car.engage++; if(b.hp < 30) D.car.lowEngage++; } }
      if(b.team === "T" && b.tRole === "entry" && teamTac.T && teamTac.T.phase === "setup" && secIn >= 15 && typeof npZoneAt === "function"){ D.entryOther.n++; var zs = npZoneAt(b.x, b.y); if((zs === "A" || zs === "B") && zs !== teamTac.T.site) D.entryOther.other++; }
      if(b.team === "T" && bomb && bomb.state === "planted"){ var sp = (tick - bomb.plantTick)/TICK_HZ; if(sp >= 10 && sp < 40){ D.pp.n++; if(Math.hypot(b.x-bomb.x, b.y-bomb.y) < 150) D.pp.near++; } }
      if(b.team === "T" && secIn >= 25 && secIn <= 50 && teamTac.T && teamTac.T.tac && teamTac.T.tac.style === "default" && bomb.state !== "planted"){
        var key = teamTac.T.site + "|" + zn(b.x, b.y); inc(D.def, key);
        inc(D.defD, teamTac.T.site + "|" + zn(b.x, b.y) + "|" + b.tRole + "|" + (b.post ? String(b.post.tag).split(":")[0] : "-") + "|" + teamTac.T.phase); }
      // (v443) все тактики: где стоят T на 25–50-й с по стилю тактики — дефолт ли это у других стилей и у Ancient
      if(b.team === "T" && secIn >= 25 && secIn <= 50 && teamTac.T && teamTac.T.tac && bomb.state !== "planted") inc(D.tacZ, teamTac.T.tac.style + "|" + teamTac.T.site + "|" + zn(b.x, b.y));
    });
    // (v443б) выход: смена фазы setup → execute и подтягивание выхода (> 2 с) — с последними сообщениями IGL
    if(teamTac.T && teamTac.T.tac){ var TT = teamTac.T, st = TT.tac.style, sc = Math.round((tick - roundStartTick)/TICK_HZ), sb = sc < 20 ? "<20" : sc < 35 ? "20-35" : sc < 50 ? "35-50" : ">50";
      if(prevPh === "setup" && TT.phase === "execute") inc(D.execWhy, "go|" + st + "|" + sb + "|" + (LOGS[LOGS.length-1] || "-"));
      if(prevPh === "setup" && TT.phase === "setup" && prevEx != null && TT.execTick < prevEx - 2*TICK_HZ) inc(D.execWhy, "pull|" + st + "|" + sb + "|" + (LOGS[LOGS.length-1] || "-"));
      prevPh = TT.phase; prevEx = TT.execTick; }
    if(tick % 32 === 0){ var sec2 = (tick - roundStartTick)/TICK_HZ, tb2 = sec2 < 20 ? "<20" : sec2 < 45 ? "20-45" : ">45";
      bots.forEach(function(b){ if(!b.alive || !b.walking) return; var dm = 1e9; bots.forEach(function(o){ if(o.alive && o.team !== b.team) dm = Math.min(dm, Math.hypot(o.x-b.x, o.y-b.y)); });
        if(dm <= 600) return; inc(D.walk2, b.team + "|" + tb2 + "|" + (dm < 900 ? "600-900" : dm < 1300 ? "900-1300" : ">1300") + "|" + walkParts(b)); }); }
    // (v443б) след дефолта: раз в 2 с — фаза, время до выхода, у каждого T роль, тег поста, зона
    if(tick % 128 === 0 && teamTac.T && teamTac.T.tac && teamTac.T.tac.style === "default" && D.defTr.length < 4000){ var TT2 = teamTac.T;
      D.defTr.push([roundNum, Math.round((tick - roundStartTick)/TICK_HZ), TT2.tac.id, TT2.site, TT2.phase, Math.round((TT2.execTick - tick)/TICK_HZ), TT2.defUntil ? Math.round((TT2.defUntil - tick)/TICK_HZ) : null,
        bots.filter(function(o){ return o.team === "T" && o.alive; }).map(function(o){ return o.tRole + ":" + (o.post ? o.post.tag : "-") + "@" + zn(o.x, o.y); }).join(" ; "), LOGS.slice(-2).join(" / ")]); }
    // (v444) последние 25 с без планта: что делают T (роль:задача@зона, носитель), фаза, сайт, стиль — «стоят и ждут контакт, когда надо ставить»
    var secLeft2 = ROUND_TIME_SEC - (simTime - roundStartTime);
    if(tick % 128 === 0 && secLeft2 <= 25 && bomb && bomb.state !== "planted" && teamTac.T && teamTac.T.tac && D.lateTr.length < 3000 && aliveCount("T") > 0){ var TT3 = teamTac.T;
      D.lateTr.push([roundNum, Math.round(secLeft2), TT3.tac.style, TT3.site, TT3.phase, !!TT3.saving, bomb.state, aliveCount("CT"),
        bots.filter(function(o){ return o.team === "T" && o.alive; }).map(function(o){ return (bomb.carrier === o ? "*" : "") + o.tRole + ":" + (o.post ? o.post.tag : "-") + "@" + zn(o.x, o.y) + (o._sawEnemy ? "!" : ""); }).join(" ; ")]); }
    if(teamTac.T && teamTac.T.saving && !D.__sv){ D.__sv = roundNum; D.save.n++; var m = bots.filter(function(o){ return o.team === "T"; }).reduce(function(a, o){ return a + o.money; }, 0); if(m >= 15000) D.save.rich++; }
    if(D.__sv && D.__sv !== roundNum) D.__sv = 0;
  };
  D.report = function(){ var o = {}; for(var k in D) if(typeof D[k] !== "function" && k.indexOf("__") !== 0) o[k] = D[k]; return o; };
  g.DOCW = D;
})();
