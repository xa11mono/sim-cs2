paused=true; BAL.newLook=__FLAG__; var pv={}, S={c:0,prep:0,looks:{}}; if(!BZ.ids.length) beliefBuild();
for(var t=0;t<300000;t++){ stepTick(); if(roundState!=='live'){ pv={}; continue; } var rt=(tick-roundStartTick)/64; if(rt>40) continue;
 bots.forEach(function(b){ if(!b.alive||b.team!=='CT'||b.tRole!=='mid') return; var vis={};
  bots.forEach(function(e){ if(!e.alive||e.team==='CT'||Math.hypot(e.x-b.x,e.y-b.y)>1400||!hasVision(b.x,b.y,e.x,e.y)) return; vis[e.id]=1;
   if(!(pv[b.id]||{})[e.id]){ S.c++; var a=Math.atan2(e.y-b.y,e.x-b.x), off=Math.abs(((a-b.facing+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI);
    if(off<0.35) S.prep++; else { var lz=b.lookTarget?ZONE_NAMES[BZ.ids[bzOf(b.lookTarget.x,b.lookTarget.y)]]:'по ходу'; var k=lz+' (враг: '+ZONE_NAMES[BZ.ids[bzOf(e.x,e.y)]]+')'; S.looks[k]=(S.looks[k]||0)+1; } } });
  pv[b.id]=vis; }); }
S.rate=(S.prep/S.c).toFixed(2); JSON.stringify(S,null,1)
