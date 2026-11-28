// [хозяева: probTick] Диагностика движения. Источники: выполненный шаг, исправление навигации и действующая задача.
// PROB.all — журнал матча. PROB.ev — короткое окно для рисования, не источник итогов.
var PROB_STALL_SEC = 5, PROB_STALL_MOVE = 25, PROB_TUG_SEC = 2, PROB_SHOW_SEC = 4, PROB_BLOCK_SEC = 8;
var PROB = {n: {stall: 0, nav: 0, tug: 0}, ev: [], s: {}, round: -1, match: -1};
function probReset(){
  PROB.n = {stall: 0, nav: 0, tug: 0}; PROB.sub = {}; PROB.ep = 0; PROB.all = []; PROB.ev = [];
  PROB.s = {}; PROB.round = -1; PROB.match = -1; PROB.revision = 2;
}
function probTrace(b){
  var A = (typeof dlogOf === "function" ? dlogOf(b, "_dlogA") : []), a = A[A.length-1];
  return {task: b._task ? b._task.tag + " ур. " + b._task.lv : (b.post ? b.post.tag : null), walk: b._walkWhy || null, stop: b._stopWhy || null,
    look: b.lookReason || null, state: b.state, arb: a ? [a[0], a[2]] : null};
}
function probSync(){
  if(PROB.match !== matchNum || PROB.revision !== 2){ probReset(); PROB.match = matchNum; }
}
function probEvent(kind, b, text, sub, facts){
  var ep = kind === "stall" ? ++PROB.ep : null;
  var row = {kind:kind, id:b.id, x:Math.round(b.baseX), y:Math.round(b.baseY), tick:tick, round:roundNum,
    text:text, sub:kind + "." + sub, ep:ep, why:probTrace(b), seq:PROB.all.length, facts:facts};
  PROB.all.push(row); PROB.ev.push(row);
  if(PROB.ev.length > 400) PROB.ev.shift();
  PROB.n[kind]++;
  PROB.sub[row.sub] = (PROB.sub[row.sub] || 0) + 1;
  return row.seq;
}
function probState(b){ return PROB.s[b.id] || (PROB.s[b.id] = {round:roundNum}); }
// Ход сообщает попытку в точке, где уже известны результат и пройденное расстояние.
function probStep(b, blocked, moving, target){
  if(probTick.on === false || roundState !== "live") return;
  probSync();
  var s = probState(b);
  if(s.round !== roundNum) s = PROB.s[b.id] = {round:roundNum};
  s.stepTick = tick; s.blocked = blocked; s.moving = moving;
  if(blocked){
    var at = s.stepTarget || (s.stepTarget = []);
    at[0] = target[0]; at[1] = target[1]; at[2] = target[2];
  }
}
function probNav(b, reason, from){
  if(probTick.on === false || roundState !== "live") return;
  var to = [b.baseX,b.baseY,b.z,b._area];
  if(from[0] === to[0] && from[1] === to[1] && from[2] === to[2]) return;
  probSync();
  probEvent("nav", b, "коррекция навигации: " + reason, reason, {from:from, to:to});
}
function probClose(s, reason){
  if(s.stallSeq != null){
    var facts = PROB.all[s.stallSeq].facts, f = s.samples;
    facts.bounds = [f.minX,f.minY,f.maxX,f.maxY];
    facts.endTick = tick; facts.end = reason;
  }
  s.stallSeq = null; s.samples = null;
}
// Три смены поста — описательное наблюдение. Контакт, бой и реальный бросок объясняют временное переключение.
function probReversal(b, s, busy){
  var p = b.post, tag = p && p.tag, prev = s.tags || (s.tags = []);
  if(!tag){ prev.length = 0; return; }
  var lastPost = prev[prev.length-1];
  if(!lastPost || lastPost.tag !== tag || lastPost.point[0] !== p.x || lastPost.point[1] !== p.y || lastPost.point[2] !== p.z){
    lastPost = {tag:tag, tick:tick, point:[p.x,p.y,p.z], interrupted:busy || /^contact(?::|$)/.test(tag)};
    prev.push(lastPost);
    var a = prev[0], mid = prev[1];
    if(prev.length === 3 && a.tag === tag && a.point[0] === p.x && a.point[1] === p.y && a.point[2] === p.z &&
       tick-mid.tick <= PROB_TUG_SEC*TICK_HZ &&
       !a.interrupted && !mid.interrupted && !lastPost.interrupted &&
       !(b._lastNade && b._lastNade.t >= mid.tick)){
      probEvent("tug", b, a.tag + " → " + mid.tag + " → " + tag, "postReversal", {posts:prev.map(function(x){ return {tag:x.tag, tick:x.tick, point:x.point}; })});
      prev.length = 0; prev.push(lastPost);
    } else if(prev.length === 3) prev.shift();
  } else if(busy) lastPost.interrupted = true;
}
function probTick(){
  if(probTick.on === false) return;
  probSync();
  if(PROB.round !== roundNum || roundState !== "live"){
    Object.keys(PROB.s).forEach(function(id){
      var s = PROB.s[id];
      if(roundState !== "live" || s.round !== roundNum){ probClose(s, "round"); delete PROB.s[id]; }
    });
    PROB.round = roundNum;
    if(roundState !== "live") return;
  }
  bots.forEach(function(b){
    var s = probState(b);
    if(!b.alive){ probClose(s, "death"); delete PROB.s[b.id]; return; }
    var busy = b.planting || b.defusing || b._climb || b._fall || b._jc || b._boost || b._sawEnemy || b._fc ||
      tick < (b.blindUntil||0) || tick < (b.throwUntil||0) || b._fireWaitT === tick;
    probReversal(b, s, !!busy);
    var p = b.post, wants = p && !b.atPost && b.state === "patrol" && !b.holding &&
      !(b._sbOff && !b._sbGo) && DM.hypot(p.x-b.baseX,p.y-b.baseY) > 40;
    if(!wants || busy || s.stepTick === tick && s.blocked === "fire"){
      if(s.samples) probClose(s, "intent-ended");
      return;
    }
    var waypoint = s.stepTick === tick && s.moving && !s.blocked && b.pathIdx > s.pathIdx && s.pathLength === b.path.length;
    s.pathLength = b.path.length; s.pathIdx = b.pathIdx;
    var x = b.baseX, y = b.baseY, z = b.z, f = s.samples;
    if(f){
      f.minX = Math.min(f.minX,x); f.maxX = Math.max(f.maxX,x);
      f.minY = Math.min(f.minY,y); f.maxY = Math.max(f.maxY,y);
      if(waypoint || DM.hypot(f.maxX-f.minX,f.maxY-f.minY) >= PROB_STALL_MOVE || f.area !== b._area && f.z !== z){
        probClose(s, waypoint ? "waypoint-progress" : "progress");
        f = null;
      }
    }
    if(!f) f = s.samples = {tick:tick,x:x,y:y,z:z,area:b._area,minX:x,maxX:x,minY:y,maxY:y,tag:null,tasks:[],firstBlock:null};
    if(f.tag !== p.tag){
      f.tag = p.tag;
      var change = [tick,p.tag,p.x,p.y,p.z];
      f.tasks.push(change);
    }
    if(!f.firstBlock && s.stepTick === tick && s.blocked){
      f.firstBlock = {tick:tick, reason:s.blocked, target:s.stepTarget.slice(0,3), point:[x,y,z]};
    }
    if(s.stallSeq == null && tick-f.tick >= PROB_STALL_SEC*TICK_HZ){
      var block = f.firstBlock;
      s.stallSeq = probEvent("stall", b, block ? "нет продвижения: " + block.reason : "нет продвижения к посту; причина не подтверждена",
        block ? "blockedStep" : "unexplained", {fromTick:f.tick,endTick:null,from:[f.x,f.y,f.z], tasks:f.tasks,
          firstBlock:block, pathIdx:b.pathIdx, bounds:[f.minX,f.minY,f.maxX,f.maxY]});
    }
  });
}
