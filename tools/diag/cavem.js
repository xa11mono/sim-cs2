paused=true; BAL.newLook=__FLAG__; if(!BZ.ids.length) beliefBuild(); var zA=BZ.idx['zone46'], zB=BZ.idx['zone31'], zU=BZ.idx['zone34'];
var S={pass:0, checked:0, walkNear:0, nearN:0}, st={};
for(var t=0;t<150000;t++){ stepTick(); if(roundState!=='live'){ st={}; continue; } if(t%8) continue; var rt=(tick-roundStartTick)/64; if(rt>40) continue;
 bots.forEach(function(b){ if(!b.alive||b.team!=='T') return; var z=bzOf(b.x,b.y); var k=b.id;
  if(z===zU){ var s=st[k]||(st[k]={in:true,chk:false}); var lz=b.lookTarget?bzOf(b.lookTarget.x,b.lookTarget.y):-1; if(lz===zA||lz===zB) s.chk=true;
    if(b.curSpeed>0){ S.nearN++; if(b.curSpeed < 0.7*SPEED) S.walkNear++; } }
  else if(st[k]&&st[k].in){ S.pass++; if(st[k].chk) S.checked++; st[k].in=false; st[k].chk=false; }
 }); }
JSON.stringify({passesThroughTUpper:S.pass, lookedIntoCave:S.checked, pct:(S.checked/S.pass).toFixed(2), walkShare:(S.walkNear/S.nearN).toFixed(2)})
