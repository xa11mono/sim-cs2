if(typeof WARM!=="undefined"&&WARM.on){WARM={on:false};} paused=true; freshMatch(3);
var out=[];
while(tick < 33480){ stepTick(); if(tick>=32600 && tick%64===0){ var T1=bots.find(function(o){return o.id==="T1";}); var tt=teamTac.T;
  out.push({t:tick, bomb:bomb.state, bx:Math.round(bomb.x), by:Math.round(bomb.y), carrier:bomb.carrier&&bomb.carrier.id, fetchId:tt&&tt.fetchId, T1role:T1.tRole, T1:[Math.round(T1.baseX),Math.round(T1.baseY)], d:Math.round(Math.hypot(T1.baseX-bomb.x,T1.baseY-bomb.y)), tag:T1.post&&T1.post.tag, aliveT:aliveCount("T"), fetchers:bots.filter(function(o){return o.team==="T"&&o.alive&&o.post&&o.post.tag==="fetch";}).map(function(o){return o.id+":"+o.tRole;})}); } }
JSON.stringify(out)
