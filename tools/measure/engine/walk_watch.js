// (шаг 0а, ENGINE_AUDIT) сторож ходьбы — только запись, игру не меняет. Вставляется в rec2.js рядом с audit/watch.js.
// nav   — каждый «вне навмеша — перенесён» (navSnap), «спрыгнул на начало пути» (заплатка v373), сброс пути «застрял»
//         (stuckTicks > 40 и «нет прогресса 1,5 с» — navUnlinkBlocked), выход из стены (escapeWallLine): точка, высота, пост.
// stall — как в watch.js (задача «идти», не на посту, не занят, за 5 с < 25 px), плюс почему стоит:
//         want — доля тиков из этих 5 с, когда бот хотел идти (есть путь, скорость > 0.5, не holding, не fightCycle);
//         want ≥ 0,5 → «не может идти», иначе «стоит по задаче» (holding / скорость 0 / нет пути).
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
  WK.tick = function(){
    if(roundState !== "live"){ WK.S = {}; return; }
    bots.forEach(function(b){ if(!b.alive) return;
      var s = WK.S[b.id] || (WK.S[b.id] = {pos:[], want:[], why:[]});
      var hasPath = !!(b.path && b.pathIdx < b.path.length), fc = !!(b._fc && b._fc.ph !== "line");
      // хотел идти в этом тике — то же условие, что пускает шаг в stepTick (без лестницы)
      var w = hasPath && !(b.holding && !b._burning) && (b.curSpeed||0) > 0.5 && !fc;
      s.want.push(w ? 1 : 0); s.why.push(w ? "" : (b.holding ? "holding" : (!hasPath ? "nopath" : (fc ? "fight" : "speed0")))); if(s.want.length > 320){ s.want.shift(); s.why.shift(); }
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
            String(b.state||""), b.atPost ? 1 : 0]); } }
    });
  };
  WK.report = function(){ return {nav:WK.nav, stall:WK.stall}; };
  g.WALK = WK;
})();
