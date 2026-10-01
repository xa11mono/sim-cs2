paused=true; matchNum=__M__; var rows=[];
for(var t=0;t<__T__;t++){ stepTick(); if(roundState!=='live'||tick%16) continue;
 var sec=(tick-roundStartTick)/64, ph = bomb.state==='planted' ? 3 : sec<20 ? 0 : sec<50 ? 1 : 2;
 bots.forEach(function(b){ if(!b.alive) return; rows.push([roundNum, tick, b.id, b.team==='CT'?1:0, Math.round(b.x), Math.round(b.y), Math.round((b.facing||0)*1000)/1000, ph]); }); }
JSON.stringify(rows)
