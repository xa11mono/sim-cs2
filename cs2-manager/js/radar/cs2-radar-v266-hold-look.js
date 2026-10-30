
(function(){
'use strict';
if (window.__cs2RadarV266Installed) return;
window.__cs2RadarV266Installed = true;

/*
 * v26.6 — HOLD / LOOK / PRE-AIM layer
 *
 * Goals:
 * 1) Do not make a defender leave his assigned hold anchor just because he
 *    reached it and setPlayerPath() received the same waypoint again.
 * 2) When a player is waiting for a fight, rotate his view smoothly between
 *    likely enemy exits / learned entry points instead of staring forever at
 *    one direction.
 * 3) Keep the scan human-like: short dwell, smooth turn, small look variance.
 * 4) Use learned CT receiving positions and actual round task information so
 *    the look direction has a reason instead of being random map-wide spinning.
 */

const V266 = {
  sameWPDist: 9,
  scanTurnSpeed: 2.65,
  minDwell: 0.65,
  maxDwell: 1.45,
  replanEvery: 1.10,
  lookJitter: 0.05,
  maxTargets: 5,
  holdSafeRadius: 80
};

function v266AngleDiff(a,b){
  let d=b-a;
  while(d>Math.PI) d-=Math.PI*2;
  while(d<-Math.PI) d+=Math.PI*2;
  return d;
}
function v266AngleLerp(current,target,maxStep){
  const d=v266AngleDiff(current,target);
  if(Math.abs(d)<=maxStep) return target;
  return current + Math.sign(d)*maxStep;
}
function v266ValidPoint(w){
  return !!(w && Number.isFinite(w.x) && Number.isFinite(w.y));
}
function v266PushTarget(arr, x, y, weight=1){
  if(!Number.isFinite(x)||!Number.isFinite(y)) return;
  arr.push({x,y,weight});
}
function v266AddWP(arr,key,weight=1){
  const w=WP[key];
  if(v266ValidPoint(w)) v266PushTarget(arr,w.x,w.y,weight);
}
function v266UniqueTargets(arr){
  const out=[];
  for(const t of arr){
    if(out.some(x=>Math.hypot(x.x-t.x,x.y-t.y)<24)) continue;
    out.push(t);
  }
  return out.slice(0,V266.maxTargets);
}

function v266LikelyEnemyTargets(p){
  const arr=[];
  const phase=getRoundPhase();

  /* Confirmed visible enemy: use that first, but only for this frame's scan.
     updatePlayer itself handles combat and will override the scan naturally. */
  const near=nearestEnemy(p);
  if(near.e && near.d<430 && hasLOS(p,near.e)){
    v266PushTarget(arr,near.e.x,near.e.y,4.0);
  }

  if(p.team==='CT'){
    const asg=p.ctAssignment||p.ctHoldSite||'MID';

    /* Learned T entries: CTs gradually become better at holding the places
       from which these opponents repeatedly appeared. */
    if(asg==='A' || asg==='B'){
      try{
        for(const e of v265PreferredEnemyEntries(asg).slice(0,4)){
          const w=WP[e.wp];
          if(v266ValidPoint(w)) v266PushTarget(arr,w.x,w.y,1.5+e.w*2.2);
        }
      }catch(e){}
    }

    if(asg==='A'){
      ['asite','adef','ticket','ctjungle','jungle','palasexit','palas'].forEach((k,i)=>v266AddWP(arr,k,1.3-(i*0.06)));
      /* A defender should still respect mid as a plausible attack lane. */
      ['mid','topmid','kontomid'].forEach(k=>v266AddWP(arr,k,0.9));
    }else if(asg==='B'){
      ['bsite','peredB','goB','naB','bapps1','bapps2','banana','banan'].forEach((k,i)=>v266AddWP(arr,k,1.35-(i*0.06)));
      ['mid','topmid','kontomid'].forEach(k=>v266AddWP(arr,k,0.72));
    }else{
      ['mid','spuskmid','kontomid','topmid','pochtimid','mezhdy'].forEach((k,i)=>v266AddWP(arr,k,1.45-(i*0.10)));
      /* MID player can glance toward both bomb sites. */
      ['asite','bsite'].forEach(k=>v266AddWP(arr,k,0.75));
    }

    /* If direct bomb evidence exists, pre-aim the relevant entries more often. */
    const observed=R.info?.CT?.bombSite;
    if(observed==='A') ['asite','adef','ticket','jungle'].forEach(k=>v266AddWP(arr,k,2.0));
    if(observed==='B') ['bsite','peredB','goB','banan'].forEach(k=>v266AddWP(arr,k,2.0));
  }else{
    /* T side: while waiting for the execute/plant/retake, expect CTs from
       the defensive site anchors instead of staring at the center. */
    const site=R.bomb.state==='planted'||R.bomb.state==='dropped' ? currentBombSite() : (p.tMainSite||R.tTargetSite||'A');
    if(phase==='retake'){
      const anchors=(R.sitePlan?.anchors||[]).slice(0,5);
      anchors.forEach(k=>v266AddWP(arr,k,1.35));
      if(site==='A') ['ctjungle','ticket','palasexit','adef'].forEach(k=>v266AddWP(arr,k,1.0));
      if(site==='B') ['ctjungle','peredB','goB','naB'].forEach(k=>v266AddWP(arr,k,1.0));
    }else if(p.tTask==='LURKER_FAKE'){
      const fake=p.tFakeSite|| (site==='A'?'B':'A');
      if(fake==='A') ['asite','ticket','adef','jungle','palas'].forEach(k=>v266AddWP(arr,k,1.1));
      else ['bsite','peredB','goB','banan','bapps1'].forEach(k=>v266AddWP(arr,k,1.1));
    }else{
      const anchors=(R.sitePlan?.anchors||[]).slice(0,5);
      anchors.forEach(k=>v266AddWP(arr,k,1.0));
      if(site==='A') ['ctjungle','ticket','adef','asite'].forEach(k=>v266AddWP(arr,k,1.0));
      else ['ctjungle','peredB','goB','bsite','banan'].forEach(k=>v266AddWP(arr,k,1.0));
    }
  }

  return v266UniqueTargets(arr);
}

function v266EnsureLookState(p){
  if(!p.lookState){
    p.lookState={targets:[],index:0,targetX:null,targetY:null,dwell:0,nextPlan:0};
  }
  return p.lookState;
}

function v266ChooseNextLook(p,force=false){
  const st=v266EnsureLookState(p);
  const now=performance.now();
  if(!force && now<st.nextPlan && st.targetX!==null) return true;
  const targets=v266LikelyEnemyTargets(p);
  if(!targets.length) return false;
  st.targets=targets;
  /* Weighted choice: prefer stronger/relevant angles, but do not always pick
     the same one. */
  const curIndex=Number.isInteger(st.index)?st.index:0;
  let pool=targets.map((t,i)=>({t,i})).filter(x=>targets.length===1||x.i!==curIndex);
  if(!pool.length) pool=targets.map((t,i)=>({t,i}));
  pool.sort((a,b)=>(b.t.weight||1)-(a.t.weight||1));
  const top=pool.slice(0,Math.min(3,pool.length));
  const pick=top[Math.floor(Math.random()*top.length)];
  st.index=pick.i;
  st.targetX=pick.t.x;
  st.targetY=pick.t.y;
  st.dwell=0;
  st.nextPlan=now+V266.minDwell*1000+Math.random()*(V266.maxDwell-V266.minDwell)*1000;
  return true;
}

function v266UpdateHoldLook(p,dt){
  if(!p.alive) return;
  const now=performance.now();
  const moving=p.path && p.pi<p.path.length-1;
  const hazard=p.hazardUntil>now;
  const blind=p.blindTimer>0;
  const near=nearestEnemy(p);
  const visibleEnemy=near.e && near.d<COMBAT_RANGE && hasLOS(p,near.e);

  /* Movement/combat owns the view. */
  if(moving || hazard || blind || visibleEnemy){
    if(moving || visibleEnemy) p.lookMode='combat';
    return;
  }

  /* We only scan when the player really is holding/waiting. */
  p.lookMode='hold';
  const st=v266EnsureLookState(p);
  st.dwell=(st.dwell||0)+dt;
  if(st.targetX===null || now>=st.nextPlan){
    v266ChooseNextLook(p, true);
  }
  if(st.targetX===null) return;

  const dx=st.targetX-p.x, dy=st.targetY-p.y;
  if(Math.hypot(dx,dy)<3) return;

  /* Tiny random offset prevents every scan from having exactly the same angle. */
  let want=Math.atan2(dy,dx);
  want += ((Math.sin(now/3700 + p.planSlot*1.73))*V266.lookJitter);
  const maxStep=V266.scanTurnSpeed*dt;
  p.angle=v266AngleLerp(p.angle,want,maxStep);
}

/* Reaching an assigned hold waypoint is a valid state. The previous generic
   fallback could send a defender onto an arbitrary neighboring waypoint,
   making him oscillate between a hold point and a utility/path target. */
console.log('[CS2 Radar v26.6] Hold anchors + smooth pre-aim/look scanning ready.');
})();

window.CS2AI=window.CS2AI||{};
window.CS2AI.lookTick=function(p,dt){try{if(p&&p.alive)v266UpdateHoldLook(p,dt);}catch(_){}};
