paused=true; matchNum=__M__; __F__ var rows=[], prev={}, plantT=null, rs=null;
for(var t=0;t<__T__;t++){ stepTick();
 if(roundState!==rs){ if(roundState==='live'){ plantT=null; prev={}; } rs=roundState; }
 if(roundState!=='live') continue;
 if(bomb.state==='planted' && plantT===null) plantT=tick;
 if(tick%16) continue;
 var sec=(tick-roundStartTick)/64, ph = plantT!==null ? 'post' : sec<20 ? 'early' : sec<50 ? 'setup' : 'late';
 bots.forEach(function(b){ if(!b.alive) { prev[b.id]=null; return; } var p=prev[b.id], spd = p ? Math.hypot(b.x-p[0],b.y-p[1])/(16/64) : 0; prev[b.id]=[b.x,b.y];
  var f=b.facing||0; rows.push([Math.round(b.x),Math.round(b.y),Math.round(Math.cos(f)*100)/100,Math.round(Math.sin(f)*100)/100,b.team==='CT'?1:0,['early','setup','late','post'].indexOf(ph),Math.round(spd)]); }); }
JSON.stringify({spdk:SPD_K, rows:rows})
