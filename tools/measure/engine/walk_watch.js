// (шаг 0а, ENGINE_AUDIT) сторож ходьбы — только запись, игру не меняет. Вставляется в rec2.js рядом с audit/watch.js.
// nav   — каждый «вне навмеша — перенесён» (navSnap), «спрыгнул на начало пути» (заплатка v373), сброс пути «застрял»
//         (stuckTicks > 40 и «нет прогресса 1,5 с» — navUnlinkBlocked), выход из стены (escapeWallLine): точка, высота, пост.
// stall — как в watch.js (задача «идти», не на посту, не занят, за 5 с < 25 px), плюс почему стоит:
//         want — доля тиков из этих 5 с, когда бот хотел идти (есть путь, скорость > 0.5, не holding, не fightCycle);
//         want ≥ 0,5 → «не может идти», иначе «стоит по задаче» (holding / скорость 0 / нет пути).
// who   — (шаг Б1) кто меняет путь: у каждого бота свойство path обёрнуто (запись вызывающего по стеку), setPost — тоже
//         (новый пост: тег, кто поставил). В stall — сколько раз и кем сменён путь за те же 5 с, и сколько раз сменилась цель
//         (конец пути сдвинулся > 60 px), итог по всем — WK.who[кто] = [смен, смен цели]. Последний столбец stall — тиков с последнего
//         нового поста: < 320 — «стоял» в окне 5 с был ещё на прошлой задаче (не застрял на этой).
// path  — позиции живых раз в 16 тиков (для путей ботов против про) берутся из REC.pos.
(function(){
  var WK = {nav:[], stall:[], S:{}};
  var g = (typeof window !== "undefined" ? window : globalThis);
  var cur = null;   // бот, которого сейчас двигает stepTick (navSnap/escape получают его аргументом)
  function row(kind, b){ WK.nav.push([tick, kind, b.id, b.team, Math.round(b.baseX), Math.round(b.baseY), b.z == null ? null : Math.round(b.z),
    b.post ? String(b.post.tag) : "-", b.path ? b.path.length - b.pathIdx : -1]); }
  var NS = navSnap; navSnap = function(b){ var x0 = b.baseX, y0 = b.baseY, z0 = b.z; var r = NS.apply(this, arguments);
    if(b.baseX !== x0 || b.baseY !== y0) WK.nav.push([tick, "snap", b.id, b.team, Math.round(x0), Math.round(y0), z0 == null ? null : Math.round(z0),
      b.post ? String(b.post.tag) : "-", Math.round(Math.hypot(b.baseX-x0, b.baseY-y0)), b.z == null ? null : Math.round(b.z)]); return r; };
  var NU = navUnlinkBlocked; navUnlinkBlocked = function(b){ if(roundState === "live") row("noprog", b); return NU.apply(this, arguments); };
  var EW = escapeWallLine; escapeWallLine = function(b){ if(roundState === "live") row("wall", b); return EW.apply(this, arguments); };
  var LE = logEvent; logEvent = function(msg){ var s = String(msg);
    if(/спрыгнул на начало пути/.test(s)){ var id = s.split(":")[0]; var b = bots.find(function(o){ return o.id === id; }); if(b) row("ledge", b); }
    return LE.apply(this, arguments); };
  WK.who = {}; WK.post = {};
  function caller(skip){ var st = String(new Error().stack).split("\n").slice(2 + skip), out = [];
    for(var i = 0; i < st.length && out.length < 3; i++){ var m = /at (?:Object\.|globalThis\.)?([\w$]+) \(/.exec(st[i]), nm;
      if(m) nm = m[1]; else { var l = /:(\d+):\d+\)?$/.exec(st[i]); nm = "@" + (l ? l[1] : "?"); }
      if(/^(setPost|set|SP|Array|forEach|some|filter|map|eval)$/.test(nm)) continue; out.push(nm); }
    return out.join("<"); }
  function wrapBot(b){ if(b.__pw) return; b.__pw = 1; var v = b.path;
    Object.defineProperty(b, "path", {enumerable:true, configurable:true, get:function(){ return v; }, set:function(nv){
      if(roundState === "live" && b.alive){ var who = caller(1), s = WK.S[b.id] || (WK.S[b.id] = {pos:[], want:[], why:[]});
        var e = nv && nv.length ? nv[nv.length-1] : null, moved = 0;
        if(/^assignNewDestination/.test(who)) who += "[" + (b.state === "retreat" ? "retreat" : (b.post && b.state === "patrol") ? "post" :
          (b.role === "roamer" && b.state === "patrol") ? "roam" : "pool:" + b.state) + "]";
        var pid = b.post ? b.post.id : "-";
        if(e){ if(s.lastEnd && Math.hypot(e[0]-s.lastEnd[0], e[1]-s.lastEnd[1]) > 60) moved = s.lastPid === pid ? 2 : 1; s.lastEnd = [e[0], e[1]]; s.lastPid = pid; }
        (s.pc || (s.pc = [])).push([tick, who, moved, e ? 1 : 0]);
        var w = WK.who[who] || (WK.who[who] = [0, 0, 0]); w[0]++; w[1] += moved ? 1 : 0; w[2] = (w[2]||0) + (moved === 2 ? 1 : 0); }
      v = nv; }}); }
  var SP = setPost; setPost = function(b, pt, look, hold, tag){ var id0 = b.post ? b.post.id : null; var r = SP.apply(this, arguments);
    if(roundState === "live" && b.alive && b.post && b.post.id !== id0){ var who = caller(1), k = String(b.post.tag).split(":")[0] + "<" + who.split("<")[0];
      var s = WK.S[b.id] || (WK.S[b.id] = {pos:[], want:[], why:[]}); (s.ps || (s.ps = [])).push([tick, k]); s.postT = tick; WK.post[k] = (WK.post[k]||0) + 1; }
    return r; };
  WK.tick = function(){
    if(roundState !== "live"){ WK.S = {}; return; }
    bots.forEach(function(b){ wrapBot(b); if(!b.alive) return;
      var s = WK.S[b.id] || (WK.S[b.id] = {pos:[], want:[], why:[]});
      var hasPath = !!(b.path && b.pathIdx < b.path.length), fc = !!(b._fc && b._fc.ph !== "line");
      // хотел идти в этом тике — то же условие, что пускает шаг в stepTick (без лестницы)
      var w = hasPath && !(b.holding && !b._burning) && (b.curSpeed||0) > 0.5 && !fc;
      // пройдено ногами (baseX/baseY, без покачиваний показа) и сколько раз сменился путь — за те же 5 с
      var dl = s.lb ? Math.hypot(b.baseX-s.lb[0], b.baseY-s.lb[1]) : 0; s.lb = [b.baseX, b.baseY];
      var rp = (s.lp !== undefined && s.lp !== b.path) ? 1 : 0; s.lp = b.path;
      (s.tr || (s.tr = [])).push([dl, rp]); if(s.tr.length > 320) s.tr.shift();
      s.want.push(w ? 1 : 0); s.why.push(w ? "" : (b.holding ? "holding" : (!hasPath ? "nopath" : (fc ? "fight" : "speed0")))); if(s.want.length > 320){ s.want.shift(); s.why.shift(); }
      while(s.pc && s.pc.length && s.pc[0][0] < tick - 320) s.pc.shift();
      while(s.ps && s.ps.length && s.ps[0][0] < tick - 320) s.ps.shift();
      if(tick % 16) return;
      s.pos.push([b.x, b.y]); if(s.pos.length > 21) s.pos.shift();
      var busy = b.planting || b.defusing || b._climb || b._sawEnemy || b._fc || tick < (b.blindUntil||0) || tick < (b.throwUntil||0);
      if(b.post && !b.atPost && !busy && s.pos.length === 21 && Math.hypot(b.post.x-b.x, b.post.y-b.y) > 40){
        var mv = Math.hypot(b.x-s.pos[0][0], b.y-s.pos[0][1]);
        if(mv < 25 && s.stallId !== b.post.id){ s.stallId = b.post.id;
          var n = s.want.length, wn = s.want.reduce(function(a, c){ return a + c; }, 0), why = {};
          s.why.forEach(function(k){ if(k) why[k] = (why[k]||0) + 1; });
          var top = Object.keys(why).sort(function(a, c){ return why[c]-why[a]; })[0] || "";
          WK.stall.push([tick, b.id, b.team, Math.round(b.x), Math.round(b.y), b.z == null ? null : Math.round(b.z), String(b.post.tag),
            Math.round(Math.hypot(b.post.x-b.x, b.post.y-b.y)), hasPath ? b.path.length - b.pathIdx : -1, Math.round(wn/n*100)/100, top,
            String(b.state||""), b.atPost ? 1 : 0,
            Math.round(s.tr.reduce(function(a, c){ return a + c[0]; }, 0)), s.tr.reduce(function(a, c){ return a + c[1]; }, 0),
            (s.pc||[]).map(function(c){ return c[1] + (c[2] === 2 ? "**" : c[2] ? "*" : "") + (c[3] ? "" : "∅"); }), (s.ps||[]).map(function(c){ return c[1]; }), s.postT == null ? -1 : tick - s.postT]); } }
    });
  };
  WK.report = function(){ return {nav:WK.nav, stall:WK.stall, who:WK.who, post:WK.post}; };
  g.WALK = WK;
})();
