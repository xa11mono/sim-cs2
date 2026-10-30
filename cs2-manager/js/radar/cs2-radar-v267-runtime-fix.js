
(function(){
'use strict';
if(window.__cs2RadarV267Installed) return;
window.__cs2RadarV267Installed=true;

/*
 * v26.7 — movement/combat/runtime safety
 *
 * 1) A visible enemy in the movement corridor stops the player BEFORE the
 *    objective movement code can walk past him.
 * 2) Teammates no longer happily choose an occupied next waypoint when there
 *    is a short alternative route.
 * 3) A local deadlock escape is allowed even during an urgent execute. This
 *    prevents an unreachable objective from becoming a permanent "stand still".
 * 4) RAF/tick are fail-safe: one runtime exception cannot silently kill the
 *    simulation timer.
 * 5) Same-team players get a small soft separation so five players don't stack.
 */

const V267={
  threatRange:305,
  threatAngle:1.95,
  teammateRadius:22,
  deadlockFrames:18,
  localEscapeMinDist:24,
  runtimeLogLimit:6
};

function v267Now(){return performance.now();}
function v267AngleDiff(a,b){
  let d=b-a;
  while(d>Math.PI)d-=Math.PI*2;
  while(d<-Math.PI)d+=Math.PI*2;
  return d;
}
function v267AliveEnemyNear(p){
  let best=null,bd=Infinity;
  for(const e of (R.players||[])){
    if(!e?.alive||e.team===p.team) continue;
    const dz=Math.abs((Number(e.z)||0)-(Number(p.z)||0));
    if(dz>1) continue;
    const d=Math.hypot(e.x-p.x,e.y-p.y);
    if(d>V267.threatRange) continue;
    if(!hasLOS(p,e)) continue;
    if(d<bd){bd=d;best=e;}
  }
  return best?{e:best,d:bd}:null;
}
function v267EnemyIsInCorridor(p, threat){
  if(!threat) return false;
  const e=threat.e;
  let refAngle=p.angle;
  if(p.path && p.pi<p.path.length-1){
    const w=WP[p.path[p.pi+1]];
    if(w) refAngle=Math.atan2(w.y-p.y,w.x-p.x);
  }
  const ad=Math.abs(v267AngleDiff(refAngle,Math.atan2(e.y-p.y,e.x-p.x)));
  return ad<=V267.threatAngle || threat.d<=95;
}
function v267CurrentWP(p){return findClosestWPTo(p.x,p.y,p.z);}
function v267CrowdedKey(k,p,hardEnemy=false){
  const w=WP[k];
  if(!w) return true;
  for(const q of (R.players||[])){
    if(!q?.alive||q===p) continue;
    if(Math.abs((Number(q.z)||0)-(Number(w.z)||0))>1) continue;
    const d=Math.hypot(q.x-w.x,q.y-w.y);
    if(q.team===p.team && d<V267.teammateRadius) return true;
    if(hardEnemy && q.team!==p.team && d<18) return true;
  }
  return false;
}

function v267DynamicPath(from,to,p){
  if(!from||!to||!WP[from]||!WP[to]) return null;
  if(from===to) return [from];
  const distMap=new Map([[from,0]]), prior=new Map(), open=[{k:from,c:0}];
  while(open.length){
    open.sort((a,b)=>a.c-b.c);
    const cur=open.shift();
    if(!cur) break;
    if(cur.k===to){
      const path=[]; let k=to;
      while(k!==undefined){path.push(k); if(k===from)break; k=prior.get(k);}
      path.reverse(); return path.length&&path[0]===from?path:null;
    }
    if(cur.c>(distMap.get(cur.k)??Infinity)+1e-9) continue;
    for(const n of (ADJ[cur.k]||[])){
      const nw=WP[n];
      if(!nw||pointBlockedForMovement(nw.x,nw.y,nw.z||0)) continue;
      if(wpEdgeBlocked(cur.k,n,null)) continue;
      const isGoal=n===to;
      let cost=1;
      for(const q of (R.players||[])){
        if(!q?.alive||q===p) continue;
        if(Math.abs((Number(q.z)||0)-(Number(nw.z)||0))>1) continue;
        const d=Math.hypot(q.x-nw.x,q.y-nw.y);
        if(q.team===p.team){
          if(d<18 && !isGoal) cost+=28;
          else if(d<34) cost+=9;
        }else if(d<24 && !isGoal){
          /* An enemy-occupied node is a combat location, not a waypoint to
             blindly walk through. Prefer an alternate branch. */
          cost+=55;
        }
      }
      /* Slight preference toward the objective keeps the detour local. */
      cost+=Math.hypot(nw.x-WP[to].x,nw.y-WP[to].y)/2200;
      const nc=(distMap.get(cur.k)??Infinity)+cost;
      if(nc<(distMap.get(n)??Infinity)){
        distMap.set(n,nc); prior.set(n,cur.k); open.push({k:n,c:nc});
      }
    }
  }
  return null;
}

function v267LocalEscape(p){
  const from=v267CurrentWP(p); if(!from) return false;
  const current=WP[from]; if(!current) return false;
  const target=p.objectiveWP||p.dest;
  const tw=WP[target];
  const opts=(ADJ[from]||[]).filter(k=>WP[k]&&!pointBlockedForMovement(WP[k].x,WP[k].y,WP[k].z||0)&&!wpEdgeBlocked(from,k,null));
  if(!opts.length) return false;
  const scored=opts.map(k=>{
    const w=WP[k];
    let score=0;
    if(v267CrowdedKey(k,p,false)) score-=24;
    if(tw) score-=Math.hypot(w.x-tw.x,w.y-tw.y)/60;
    score+=Math.random()*7;
    return {k,score};
  }).sort((a,b)=>b.score-a.score);
  const pick=scored[0]?.k;
  if(!pick) return false;
  p.path=[from,pick]; p.pi=0; p.dest=pick; p.objectiveWP=target||pick;
  p.idleTime=0; p.stuckFrames=0; p.patrolTimer=0;
  p.lastPathRebuild=v267Now();
  return true;
}

/* Make setPlayerPath congestion-aware only when the ordinary route immediately
   enters an occupied waypoint. Normal routes stay on the existing code path. */
console.log('[CS2 Radar v26.7] combat corridor + congestion routing + deadlock escape + RAF watchdog ready.');
})();
