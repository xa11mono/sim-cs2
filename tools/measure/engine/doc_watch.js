// (v438, док владельца м1 Mirage v436, 27.10) сторож замечаний дока — только запись, игру не меняет. Вставляется в rec2.js (walk_run.py).
// Считает то, что в доке проверялось руками на одном матче, — на 8 матчах: судьба заданий гранат, вход в огонь, шифт без слушателей,
// точка «выхода на врага» (видно ли оттуда, тот ли этаж), взгляд за спину «путь к врагу», дубли смоков, пост-плант у бомбы, войс,
// где стоят T в дефолте, сейв при деньгах, пик на перезарядку, нож при перезарядке, пути на тик решений.
(function(){
  var g = (typeof window !== "undefined" ? window : globalThis);
  var D = {nt:{}, ntEx:[], swEx:[], fire:{birth:0, commit:0, other:0}, walk:{n:0, far:0, bomb:0}, swing:{n:0, noLos:0, high:0}, known:{n:0, behind:0},
    smokeDup:{n:0, dup:0}, pp:{n:0, near:0}, voice:{n:0, rounds:0}, def:{}, save:{n:0, rich:0}, rl:{peek:0, knife:0}, path:{n:0, ticks:0, max:0},
    buy:{T:[0,0], CT:[0,0]}, thrown:{T:0, CT:0}, car:{n:0, swing:0, engage:0, lowEngage:0}, entryOther:{n:0, other:0}};
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
  if(typeof voiceFeed === "function"){ var VF = voiceFeed; voiceFeed = function(){ if(roundState === "live") D.voice.n++; return VF.apply(this, arguments); }; }
  // --- пути (FPS): сколько раз строится путь за тик ---
  if(typeof buildWaypointPath === "function"){ var BW = buildWaypointPath; buildWaypointPath = function(){ D.path.n++; return BW.apply(this, arguments); }; }
  var prevFire = {}, lastR = -1, pathT = 0;
  D.tick = function(){
    if(roundState !== "live"){ prevFire = {}; SM = []; return; }
    if(roundNum !== lastR){ lastR = roundNum; D.voice.rounds++;
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
      if(b.walking){ D.walk.n++; var dmin = 1e9; foes.forEach(function(o){ dmin = Math.min(dmin, Math.hypot(o.x-b.x, o.y-b.y)); }); if(dmin > 600) D.walk.far++;
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
        var key = teamTac.T.site + "|" + zn(b.x, b.y); inc(D.def, key); }
    });
    if(teamTac.T && teamTac.T.saving && !D.__sv){ D.__sv = roundNum; D.save.n++; var m = bots.filter(function(o){ return o.team === "T"; }).reduce(function(a, o){ return a + o.money; }, 0); if(m >= 15000) D.save.rich++; }
    if(D.__sv && D.__sv !== roundNum) D.__sv = 0;
  };
  D.report = function(){ var o = {}; for(var k in D) if(typeof D[k] !== "function" && k.indexOf("__") !== 0) o[k] = D[k]; return o; };
  g.DOCW = D;
})();
