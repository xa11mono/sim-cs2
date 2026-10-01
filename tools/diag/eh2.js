paused=true; var log=[], watch=null, orig=setPost;
setPost=function(b,pt,look,hold,tag){ if(watch&&b===watch&&log.length<25) log.push(tick+" setPost "+tag+" | cur="+(b.post&&b.post.tag)+" locks eg:"+(tick-(b._egLock||0))+" pick:"+(tick-(b._pickLock||0))+" sw:"+(tick-(b._smokeWaitLock||0))+" lu:"+(tick-(b._lineupLock||0))+" probe:"+(tick-(b._probeLock||0))+" trade:"+!!b._tradeLock+" route:"+!!b._route+" repos:"+(b._reposUntil?b._reposUntil-tick:0)); var r=orig.apply(this,arguments); if(watch&&b===watch&&log.length<25) log.push("   -> now "+(b.post&&b.post.tag)); return r; };
for(var t=0;t<300000&&!watch;t++){ stepTick(); if(roundState!=='live'||bomb.state!=='planted'||tick-bomb.plantTick<3*64) continue;
 bots.forEach(function(b){ if(!watch&&b.alive&&b.team==='T'&&b.post&&b.post.tag==='endhunt') watch=b; }); }
for(var k=0;k<200;k++) stepTick();
JSON.stringify({id:watch&&watch.id, log:log})
