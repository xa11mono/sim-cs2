// (v263, Б2) Кто стоит во вражеском молотове дольше 1 с и почему.
// node src/q.js sim.html "$(sed s/__M__/3/ tools/measure/fire.js)"
// Причина на каждый тик в огне: plant / defuse / commit:<почему fireCommit> / noExit (все точки выхода за стеной) / exiting.
freshMatch(__M__);
var M0 = matchNum, S = {}, OUT = {match:M0, streaks:[]};
function why(b){
  if(b.planting) return "plant";
  if(b.defusing) return "defuse";
  if(typeof fireCommit === "function" && fireCommit(b)){
    if(b.team === "T" && tick - (b._defuseHeard||-9999) < 110) return "commit:heardDefuse";
    if(b.post && /^(defuse|plantspot|retake)$/.test(b.post.tag)) return "commit:post_" + b.post.tag;
    if(bomb && bomb.retake && bomb.retake.phase === "go" && b.team === "CT") return "commit:retakeGo";
    return "commit:other";
  }
  if(b._burning && !b._fireExit) return "noExit";
  return "exiting";
}
for(var t = 0; t < 200000; t++){
  stepTick();
  if(matchNum !== M0) break;
  if(roundState !== "live"){ S = {}; continue; }
  bots.forEach(function(b){
    var f = b.alive ? inFire(b.x, b.y) : null;
    var enemy = f && f.team !== b.team;
    var s = S[b.id];
    if(enemy){
      if(!s) s = S[b.id] = {id:b.id, team:b.team, r:roundNum, t0:tick, hp0:b.hp, why:{}, x:Math.round(b.x), y:Math.round(b.y), tag:b.post?b.post.tag:""};
      var w = why(b); s.why[w] = (s.why[w]||0) + 1;
      s.n = (s.n||0) + 1; s.spd = (s.spd||0) + (b.curSpeed||0);
      if(b._fc && b._fc.ph !== "line") s.fc = (s.fc||0) + 1;
      if(b.holding) s.hold = (s.hold||0) + 1;
      if(b.atPost) s.atPost = (s.atPost||0) + 1;
      if(!b.path || !b.path.length) s.noPath = (s.noPath||0) + 1;
      if(b._fireExit) s.dEx = (s.dEx||0) + Math.hypot(b._fireExit.x-b.baseX, b._fireExit.y-b.baseY);
      if(Math.hypot(b.x-b.baseX, b.y-b.baseY) > 3) s.off = (s.off||0) + 1;
    } else if(s){
      s.dur = (tick - s.t0)/TICK_HZ; s.spd = Math.round(s.spd/s.n); if(s.dEx) s.dEx = Math.round(s.dEx/s.n); s.died = !b.alive; s.hp1 = b.hp;
      if(s.dur > 1) OUT.streaks.push(s);
      delete S[b.id];
    }
  });
}
OUT.ticks = tick;
JSON.stringify(OUT)
