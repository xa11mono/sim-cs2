// Сторож записи матча. Все итоги выводятся из журнала; WATCH не меняет объекты игры.
(function(){
  var W = {tick: observeTick, report: report};
  var match = matchNum, rs, siteChange, S = {}, all = {}, tasks = new WeakMap(), launches = new WeakMap();
  var errorStart = typeof simEvIn !== "undefined" ? (simEvIn.errs || []).length : 0;
  var next = 0, WAIT_RE = /^(gather|bombWait|utilWait|utilHold|smokeWait|retakeCover|rotateHold|waitPop|stage|exec:wait)/;
  var supported = typeof simEvOn === "function" && typeof nadeTaskObserved === "function";
  var live = function(){ return roundState === "live" && matchNum === match; };
  function point(b){ return [b.x,b.y,b.z]; }
  function state(b){ return S[b.id] || (S[b.id] = {}); }
  function eco(b){ return b.team+"|"+((teamEco[b.team] || {}).roundType || "unknown"); }
  function entry(k, actor, reason, facts){
    var row = [tick, actor, reason, roundNum, facts, next++];
    (all[k] || (all[k] = [])).push(row);
    return row;
  }
  function nadeRow(b, stage, type, task, reason, facts, delta, group){
    return entry("nade", b ? b.id : null, reason, {stage:stage, key:group || (b && type ? eco(b)+"|"+type : null),
      type:type, task:task, delta:delta, evidence:facts});
  }
  function taskStart(b, o, source){
    var known = tasks.get(o);
    if(known && !known.end) return known;
    var row = nadeRow(b,"intent",o.type,next,source,{start:o.start, until:o.until, target:[o.x,o.y], from:o.from ? point(o.from) : null,
      lineup:o.luId || null, why:o.why, share:o.exu || null, resumedFrom:known ? known.id : null},1);
    var t = {id:row[5], start:o.start, type:o.type, group:row[4].key, thrown:false, reached:false, end:false};
    tasks.set(o,t);
    return t;
  }
  function taskEnd(b,o,why,missing){
    var t = tasks.get(o) || taskStart(b,o,"owner-end-or-restored");
    if(t.end) return;
    t.end = true;
    var stage = missing || t.thrown ? "ended" : "lost";
    nadeRow(b,stage,t.type,t.id,why,{position:point(b), post:b.post ? b.post.tag : null, alive:b.alive,
      completed:t.thrown, censored:missing, lastAttempt:t.attempt == null ? null : t.attempt},stage === "lost" ? 1 : 0,t.group);
  }
  function closeSpan(row, why){
    if(row && row[4].toTick == null){ row[4].toTick = tick; row[4].end = why; }
  }
  function closeRound(why){
    bots.forEach(function(b){
      var s = S[b.id];
      if(!s) return;
      closeSpan(s.wait,why);
      closeSpan(s.fire,why);
      if(s.task) taskEnd(b,s.task,why,true);
    });
    siteChange = null; S = {};
  }
  function syncTask(b,o,source){
    var s = state(b), previous = s.task;
    if(previous && previous !== o){
      var queued = b.nadeQueue && b.nadeQueue.indexOf(previous) >= 0;
      taskEnd(b,previous,queued ? "queued" : "replacement-or-reset",true);
    }
    s.task = o || null;
    return o ? taskStart(b,o,source) : null;
  }
  if(supported){
    simEvOn("endRound",function(ph,A,r,wasLive){
      if(ph === "in") return live();
      if(wasLive && !live()) closeRound("round-end:"+A[1]);
    });
    simEvOn("tSetSite",function(ph,A,r,from){
      if(ph === "in") return live() && A[0] && A[0].site;
      if(!live() || !from || !A[1] || from === A[1]) return;
      var newSite = {from:from,to:A[1],tick:tick,phase:A[0].phase};
      if(siteChange && siteChange.to === from && siteChange.from === A[1] && tick-siteChange.tick <= 5*TICK_HZ){
        entry("flip","T","site-reversal",{first:siteChange, second:newSite});
        siteChange = null;
      } else siteChange = newSite;
    });
    simEvOn("nadeTaskObserved",function(ph,A){
      if(ph === "out" && live()) syncTask(A[0],A[0].nadeTask,"owner-open");
    });
    simEvOn("nadeTaskEnd",function(ph,A,r,o){
      if(ph === "in") return live() && A[0].nadeTask;
      if(o && live()){
        taskEnd(A[0],o,A[1],false);
        var s = state(A[0]);
        if(s.task === o) s.task = null;
      }
    });
    simEvOn("nadeLaunch",function(ph,A){ if(ph === "in" && live()) launches.set(A[0].thrower,A[0]); });
    simEvOn("throwNade",function(ph,A,r,s){
      var b = A[0], type = A[1], o = A[7];
      if(ph === "in"){
        if(!b || !live()) return null;
        var task = o && o === b.nadeTask && type === o.type ? taskStart(b,o,"owner-attempt") : null;
        launches.delete(b);
        return {task:task, origin:point(b)};
      }
      if(!s) return;
      var t = s.task;
      var row = nadeRow(b,"attempt",type,t ? t.id : null,r === true ? "released" : (NADE_FC || "cause-unavailable"),
        {ok:r === true, aim:[A[2],A[3]], origin:s.origin, label:A[5], detail:NADE_FAIL},0,t && t.group);
      if(t) t.attempt = row[5];
      if(r === true){
        var n = launches.get(b), assigned = t && !t.thrown;
        if(assigned) t.thrown = true;
        var released = nadeRow(b,assigned ? "thrown" : "unassigned",type,assigned ? t.id : null,
          assigned || !t ? "released" : "additional-release",{attempt:row[5], launch:n ? point(n) : null, task:t ? t.id : null},1,assigned && t.group);
        if(n) launches.set(n,released[5]);
      }
    });
    simEvOn("applyDamage",function(ph,A,r,hp){
      if(ph === "in") return live() && A[1].alive ? A[1].hp : null;
      if(hp == null) return;
      var b = A[1], dmg = hp-Math.max(0,b.hp);
      if(dmg <= 0) return;
      var src = A[3], s = state(b), at = A[4] && A[4].from;
      if(src === "C4"){
        entry("danger",b.id,"C4.damage",{hp:dmg, point:point(b), site:bomb.site, planted:bomb.plantTick, lethal:!b.alive});
      } else if(src === "молотов"){
        var f = b._fireIn, fire = f && f.f, key = fire ? [fire.born,fire.x,fire.y,fire.z].join("|") : null;
        if(s.fire && s.fire[4].source !== key){ closeSpan(s.fire,"source-changed"); s.fire = null; }
        if(!s.fire) s.fire = entry("danger",b.id,"fire.damage",{fromTick:f ? f.t : tick,toTick:null,source:key,
          origin:at ? point(at) : null, attacker:A[0] ? A[0].id : null, hits:[]});
        s.fire[4].hits.push([tick,dmg,b.x,b.y,b.z,!!b._burning,!b.alive]);
        if(!b.alive){ closeSpan(s.fire,"death"); s.fire = null; }
      }
    });
    simEvOn("detonate",function(ph,A){
      if(ph !== "in" || !live()) return;
      var n = A[0], release = launches.get(n);
      nadeRow(n.thrower,"detonated",n.type,null,"detonated",{release:release == null ? null : release, point:point(n)},1);
    });
    simEvOn("flashExposure",function(ph,A,r,prior){
      if(ph === "in") return live() ? A[1].blindUntil || 0 : null;
      if(prior == null) return;
      var n = A[0], b = A[1], release = launches.get(n), known = A[4] || !!(n.aware && n.aware[b.id]);
      entry("danger",b.id,known ? "flash.known" : "flash.unwarned",{until:b.blindUntil, prior:prior,
        seconds:A[2], direction:A[3], source:point(n), point:point(b), release:release == null ? null : release,
        thrower:n.thrower ? n.thrower.id : null, thrown:n.born, warned:A[4], team:n.team});
    });
    simEvOn("feedKill",function(ph,A){
      if(ph !== "in" || !live() || !A[0] || !A[1] || A[0].team === A[1].team) return;
      var a = A[0], b = A[1], m = A[4];
      entry("kills",b.id,"opponent-kill",{attacker:a.id,weapon:A[2]});
      if(m && m.smoke) entry("smokeProjected",b.id,"engine-smoke-flag",{attacker:a.id,weapon:A[2],from:point(a),to:point(b)});
    });
  }
  function observeTick(){
    if(!supported || matchNum !== match) return;
    if(!live()){ if(rs === roundNum){ closeRound("round-inactive"); rs = null; } return; }
    if(rs !== roundNum){
      if(rs != null) closeRound("round-changed");
      rs = roundNum;
      nadeRow(null,"rounds",null,null,"live-observed",{firstTick:tick},1);
      bots.forEach(function(b){
        if(b.nades) ["smoke","flash","he","molly"].forEach(function(t){
          if(b.nades[t] > 0) nadeRow(b,"hands",t,null,"inventory-at-first-live-tick",null,b.nades[t]);
        });
      });
    }
    bots.forEach(function(b){
      var s = state(b), o = b.nadeTask, p = b.post;
      if(s.task !== o) syncTask(b,o,"sampled-active");
      if(o){
        var t = tasks.get(o);
        if(!t.reached && o.from && b.atPost && p && p.tag === "lineup" && p.src && p.src.x === o.from.x && p.src.y === o.from.y){
          t.reached = true;
          nadeRow(b,"reached",o.type,t.id,"lineup-arrival-by-owner",{point:point(b),post:[p.x,p.y,p.z]},1,t.group);
        }
      }
      if(s.fire && (!b.alive || !b._fireIn || !fires.includes(b._fireIn.f))){
        closeSpan(s.fire,b.alive ? "left-or-extinguished" : "death");
        s.fire = null;
      }
      var key = b.alive && p && b.atPost && WAIT_RE.test(p.tag) ? p.id+"|"+p.tag+"|"+p.x+"|"+p.y+"|"+p.z : null;
      if(s.waitKey !== key){ closeSpan(s.wait,"post-or-eligibility-changed"); s.wait = null; s.waitKey = key; s.waitFrom = tick; }
      if(key && !s.wait && tick-s.waitFrom >= 8*TICK_HZ){
        s.wait = entry("wait",b.id,p.tag,{fromTick:s.waitFrom,toTick:null, post:[p.x,p.y,p.z,p.id],
          phase:(teamTac[b.team] || {}).phase, task:b._task ? b._task.tag : null, blind:tick < (b.blindUntil || 0),
          visible:(b._visible || []).map(function(x){ return x.id; })});
      }
    });
  }
  function inc(o,k,delta){ o[k] = (o[k] || 0) + delta; }
  function report(externalProb){
    var n = {}, ev = {}, dangerBy = {}, rows = Object.assign({},all);
    var nade = {rounds:0,hands:{},intent:{},reached:{},thrown:{},lost:{},lostWhy:{},unassigned:{},detonated:{}};
    var movement = typeof PROB !== "undefined" && PROB.revision === 2 ? PROB.all : [];
    ["stall","nav","tug","wait","flip","danger","kills","smokeProjected"].forEach(function(k){
      n[k] = (rows[k] || []).length;
      ev[k] = (rows[k] || []).slice(0,40);
    });
    movement.forEach(function(e){
      inc(n,e.kind,1); inc(n,e.sub,1);
      if(e.kind === "stall") inc(n,"stall.ep",1);
      if(ev[e.kind].length < 40) ev[e.kind].push([e.tick,e.id,e.text,e.x,e.y,e.round,e.seq]);
    });
    if(!externalProb) rows.movement = movement;
    (rows.danger || []).forEach(function(r){ inc(dangerBy,r[2],1); });
    (rows.nade || []).forEach(function(r){
      var e = r[4];
      if(e.stage === "rounds") nade.rounds += e.delta;
      else if(e.delta) inc(nade[e.stage],e.key,e.delta);
      if(e.stage === "lost") inc(nade.lostWhy,e.type+"|"+r[2],e.delta);
    });
    var errors = supported ? (simEvIn.errs || []).slice(errorStart) : ["missing-owner-events"];
    return {revision:2, match:match, toTick:tick, complete:supported && errors.length === 0 && matchNum === match,
      errors:errors, counts:{watch:next,movement:movement.length}, movementSource:externalProb ? "REC.prob" : "WATCH.all.movement",
      n:n, ev:ev, all:rows, emptyBy:{}, dangerBy:dangerBy, nade:nade};
  }
  (typeof window !== "undefined" ? window : globalThis).WATCH = W;
})();
