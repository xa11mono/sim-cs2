paused=true; matchNum=5; var R=[], cur=null, rs=null;
for(var t=0;t<300000;t++){ stepTick();
 if(roundState!==rs){ if(roundState==='freeze') cur=null; rs=roundState; }
 if(roundState!=='live') { if(cur&&!cur.done){ cur.done=true; } continue; }
 if(t%16) continue;
 var nT=aliveCount('T'), nC=aliveCount('CT');
 if(!cur && bomb.state!=='planted' && nC>=1 && nC<=2 && nT>nC){ cur={t0:tick, nT:nT, nC:nC, secLeft:Math.round(ROUND_TIME_SEC-(simTime-roundStartTime)), hunt:0, samples:0}; R.push(cur); }
 if(cur && !cur.done){ if(bomb.state==='planted' && cur.plant==null) cur.plant=+((tick-cur.t0)/64).toFixed(1);
   if(cur.plant==null){ var ts=bots.filter(function(b){return b.alive&&b.team==='T'}); cur.samples+=ts.length; cur.hunt+=ts.filter(function(b){return b.post&&b.post.tag==='endhunt'}).length; } }
}
var n=R.length, pl=R.filter(function(r){return r.plant!=null}), times=pl.map(function(r){return r.plant}).sort(function(a,b){return a-b});
JSON.stringify({cases:n, plantedShare:(pl.length/n).toFixed(2), medianTimeToPlant:times[Math.floor(times.length/2)], huntShareOfTbotTime:(R.reduce(function(a,r){return a+r.hunt},0)/R.reduce(function(a,r){return a+r.samples},0)).toFixed(2)})
