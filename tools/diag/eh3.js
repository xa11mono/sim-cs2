paused=true; var log=[], watch=null, og=groupPost;
for(var t=0;t<300000&&!watch;t++){ stepTick(); if(roundState!=='live'||bomb.state!=='planted'||tick-bomb.plantTick<3*64) continue;
 bots.forEach(function(b){ if(!watch&&b.alive&&b.team==='T'&&b.post&&b.post.tag==='endhunt') watch=b; }); }
groupPost=function(g,c,l,tag){ log.push(tick+" groupPost "+tag+" ["+g.map(function(b){return b.id}).join(",")+"]"); return og.apply(this,arguments); };
var tt=teamTac.T; var info={phase:tt.phase, ppMode:tt._ppMode, defLate:tt._defLate, lurker:bots.filter(function(b){return b.alive&&b.team==='T'}).map(function(b){return b.id+":"+b.tRole+":"+(b.post&&b.post.tag)})};
for(var k=0;k<40;k++) stepTick();
JSON.stringify({id:watch.id, info:info, log:log.slice(0,8)})
