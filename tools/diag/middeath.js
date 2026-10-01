paused=true; BAL.newLook=__FLAG__; var prev={}, S={n:0, lookJ:0, ex:[]}; if(!BZ.ids.length) beliefBuild(); var zJ=BZ.idx['zone6'];
for(var t=0;t<300000;t++){ stepTick(); if(roundState!=='live'){ prev={}; continue; } var rt=(tick-roundStartTick)/64;
 bots.forEach(function(b){ if(b.team!=='CT'||b.tRole!=='mid') return;
  if(prev[b.id] && !b.alive && rt<40){ var P=prev[b.id]; S.n++; var lz=P.look?bzOf(P.look.x,P.look.y):-1; if(lz===zJ) S.lookJ++;
    var killer=bots.filter(function(e){return e.team==='T'&&e.alive}).sort(function(a,c){return Math.hypot(a.x-P.x,a.y-P.y)-Math.hypot(c.x-P.x,c.y-P.y)})[0];
    if(S.ex.length<8) S.ex.push({rt:rt.toFixed(1), at:ZONE_NAMES[BZ.ids[bzOf(P.x,P.y)]], looked:lz>=0?ZONE_NAMES[BZ.ids[lz]]:'-', why:P.why, killerAt:killer?ZONE_NAMES[BZ.ids[bzOf(killer.x,killer.y)]]:'-'}); }
  prev[b.id]= b.alive ? {x:b.x,y:b.y,look:b.lookTarget&&{x:b.lookTarget.x,y:b.lookTarget.y},why:whyText(b)} : null;
 }); }
JSON.stringify(S,null,1)
