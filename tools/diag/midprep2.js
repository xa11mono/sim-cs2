paused=true; var pv={}, ex=[]; if(!BZ.ids.length) beliefBuild();
for(var t=0;t<300000&&ex.length<10;t++){ stepTick(); if(roundState!=='live'){ pv={}; continue; } var rt=(tick-roundStartTick)/64; if(rt>40) continue;
 bots.forEach(function(b){ if(!b.alive||b.team!=='CT'||b.tRole!=='mid') return; var vis={};
  bots.forEach(function(e){ if(!e.alive||e.team==='CT'||Math.hypot(e.x-b.x,e.y-b.y)>1400||!hasVision(b.x,b.y,e.x,e.y)) return; vis[e.id]=1;
   if(!(pv[b.id]||{})[e.id]){ var a=Math.atan2(e.y-b.y,e.x-b.x), off=Math.abs(((a-b.facing+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
    if(off>=0.35) ex.push({rt:rt.toFixed(1), me:ZONE_NAMES[BZ.ids[bzOf(b.x,b.y)]], meXY:[Math.round(b.x),Math.round(b.y)], speed:Math.round(b.curSpeed), offDeg:Math.round(off*57), lookXY:b.lookTarget&&[Math.round(b.lookTarget.x),Math.round(b.lookTarget.y)], enemy:ZONE_NAMES[BZ.ids[bzOf(e.x,e.y)]], eXY:[Math.round(e.x),Math.round(e.y)], dist:Math.round(Math.hypot(e.x-b.x,e.y-b.y)), why:whyText(b), wantDeg: b.lookTarget?Math.round(_angOff(Math.atan2(b.lookTarget.y-b.y,b.lookTarget.x-b.x), b.facing)*57):null}); } });
  pv[b.id]=vis; }); }
JSON.stringify(ex,null,1)
