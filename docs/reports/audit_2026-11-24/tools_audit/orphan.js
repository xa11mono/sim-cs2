if(typeof WARM!=="undefined"&&WARM.on){WARM={on:false};} paused=true; freshMatch(__M__);
var M0=matchNum, ep={}, done=[], N=__N__;
for(var i=0;i<N;i++){ stepTick(); if(matchNum!==M0) break; if(roundState!=="live") continue;
  bots.forEach(function(b){ if(!b.alive){ if(ep[b.id]){ done.push(ep[b.id]); delete ep[b.id]; } return; }
    var orphan = b.post && b.post.tag==="lineup" && !b.nadeTask;
    var e=ep[b.id];
    if(orphan){ if(!e) e=ep[b.id]={id:b.id, t0:tick, n:0, still:0, round:roundNum, why:b._nadeWhy||null}; e.n++; if((b.curSpeed||0)<1) e.still++; e.t1=tick; }
    else if(e){ e.next=b.post?String(b.post.tag):null; done.push(e); delete ep[b.id]; } }); }
Object.keys(ep).forEach(function(k){ done.push(ep[k]); });
var T=window.__TNT||[], paus=0, pausAfterSolve=0, byBot={}, ok=0, msP=0;
T.forEach(function(r){ if(r[3]) ok++; if(/^пауза: подбор/.test(r[4])){ paus++; if(r[5]>0){ pausAfterSolve++; msP+=r[6]; } } });
JSON.stringify({ticks:tick, rounds:roundNum, orphanEps:done.length, orphanTicks:done.reduce(function(a,e){return a+e.n;},0), stillTicks:done.reduce(function(a,e){return a+e.still;},0),
  longest:done.sort(function(a,b){return b.n-a.n;}).slice(0,8), tries:T.length, throwsOk:ok, pauseFails:paus, pauseAfterPaidSolve:pausAfterSolve, msWastedInThoseCalls:msP})
