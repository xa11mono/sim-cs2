paused=true; matchNum=__M__; __F__ var rows=[], R={n:0,rear:0,rearCT:0,nCT:0,rearLate:0,nLate:0};
for(var t=0;t<250000;t++){ stepTick(); if(roundState!=='live'||tick%16) continue;
 var sec=(tick-roundStartTick)/64, ph = bomb.state==='planted' ? 3 : sec<20 ? 0 : sec<50 ? 1 : 2;
 bots.forEach(function(b){ if(!b.alive) return; rows.push([roundNum, tick, b.id, b.team==='CT'?1:0, Math.round(b.x), Math.round(b.y), Math.round((b.facing||0)*1000)/1000, ph]);
  if(b._sawEnemy || !b.lookTarget) return;
  var zb=bzOf(b.x,b.y), zl=bzOf(b.lookTarget.x,b.lookTarget.y); if(zb<0||zl<0||zl===zb) return;
  var ED=enemySpawnDist(b.team), rear = ED[zl] > ED[zb] + 150 && beliefZoneKnown(b.team, zl) < 0.15;
  R.n++; if(rear) R.rear++; if(b.team==='CT'){ R.nCT++; if(rear) R.rearCT++; } if(ph>=2){ R.nLate++; if(rear) R.rearLate++; } }); }
JSON.stringify({rows:rows, rear:(R.rear/R.n).toFixed(3), rearCT:(R.rearCT/R.nCT).toFixed(3), rearLate:(R.rearLate/R.nLate).toFixed(3)})
