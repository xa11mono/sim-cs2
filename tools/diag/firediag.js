paused=true; var ep={}, long=[], total=0;
for(var m of [3,7]){ matchNum=m; newMatch();
for(var t=0;t<100000;t++){ stepTick(); if(roundState!=='live') { ep={}; continue; }
 bots.forEach(function(b){ if(!b.alive){ delete ep[b.id]; return; } var f=inFire(b.baseX,b.baseY);
  if(f){ var e=ep[b.id]||(ep[b.id]={t0:tick,n:0,states:{}}); e.n++; var k=b.state+'|'+(b.post?b.post.tag.replace(/[0-9]/g,''):'-')+'|commit='+fireCommit(b)+'|hold='+!!b.holding+'|atPost='+b.atPost+'|path='+(b.path?b.path.length:0); e.states[k]=(e.states[k]||0)+1; }
  else if(ep[b.id]){ var e=ep[b.id]; total++; if(e.n>64) long.push({id:b.id,dur:(e.n/64).toFixed(1),top:Object.keys(e.states).sort(function(a,c){return e.states[c]-e.states[a]}).slice(0,3)}); delete ep[b.id]; } }); } }
JSON.stringify({episodes:total, over1s:long.length, ex:long.slice(0,12)},null,1)
