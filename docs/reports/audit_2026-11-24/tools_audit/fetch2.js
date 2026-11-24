if(typeof WARM!=="undefined"&&WARM.on){WARM={on:false};} paused=true; freshMatch(3);
var out=[];
while(tick < 33520){ stepTick(); if(tick>=32640 && tick%128===0){ var tt=teamTac.T, FC=tt&&tt.fetchCover; var cov=FC&&FC.id?bots.find(function(o){return o.id===FC.id;}):null; var T1=bots.find(function(o){return o.id==="T1";});
  out.push({t:tick, FC:FC?{id:FC.id, pt:[Math.round(FC.pt.x),Math.round(FC.pt.y)]}:null, cov:cov?{id:cov.id, alive:cov.alive, tag:cov.post&&cov.post.tag, lvl:cov._task&&cov._task.lv, d:Math.round(Math.hypot(cov.x-T1.x,cov.y-T1.y)), saw:!!cov._sawEnemy, sp:Math.round(cov.curSpeed||0), dl:(cov._dlog||[]).slice(-2).map(function(x){return x[2].slice(0,70);})}:null}); } }
JSON.stringify(out)
