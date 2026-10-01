paused=true; matchNum=5; var R=[], cur=null, rs=null;
for(var t=0;t<300000;t++){ stepTick();
 if(roundState!==rs){ if(roundState==='freeze') cur=null; rs=roundState; }
 if(roundState!=='live'||t%16) continue;
 if(bomb.state==='planted' && !cur){ var nC=aliveCount('CT'), nT=aliveCount('T'); if(nC>0){ cur={diff:nC-nT, attempt:false, save:false}; R.push(cur);} else cur={dead:1}; }
 if(cur && cur.diff!=null){ if(bots.some(function(b){return b.alive&&b.team==='CT'&&Math.hypot(b.x-bomb.x,b.y-bomb.y)<450})) cur.attempt=true; if(teamTac.CT&&teamTac.CT.saving) cur.save=true; }
}
var by={}; R.forEach(function(r){ var k=r.diff; by[k]=by[k]||[0,0]; by[k][0]++; if(r.attempt) by[k][1]++; });
JSON.stringify({plants:R.length, attempt:(R.filter(function(r){return r.attempt}).length/R.length).toFixed(2), save:(R.filter(function(r){return r.save}).length/R.length).toFixed(2), byDiff:by})
