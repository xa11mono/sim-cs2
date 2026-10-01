paused=true; __F__ var C={A:0,B:0}, early={A:0,B:0}, n=0, rs=null, nanScore=0, tExecB=0, callBduringB=0, ok={};
for(var m of [3,7]){ matchNum=m; newMatch(); for(var t=0;t<100000;t++){ stepTick(); if(roundState!==rs){ if(roundState==='live') n++; rs=roundState; } if(roundState!=='live'||tick%16) continue;
 var c=teamTac.CT&&teamTac.CT.call, sec=(tick-roundStartTick)/64; if(c){ C[c.site]++; if(sec<15) early[c.site]++; }
 var tt=teamTac.T; if(tt&&tt.phase==='execute'&&tt.site==='B'&&bomb.state!=='planted'){ tExecB++; if(c&&c.site==='B') callBduringB++; } } }
JSON.stringify({rounds:n, callTicks:C, callFirst15s:early, execBticks:tExecB, callBduringExecB:callBduringB})
