paused=true; matchNum=__M__; __F__
var S=[], R={smokes:0, spammed:0, bursts:0, he:0, moveN:0, moved:0, baseN:0, baseMoved:0}, lastShot={}, pend=[], base=[];
var od=detonate; detonate=function(n){ var r=od.apply(this,arguments);
  if(n.type==='smoke'){ var s={x:n.x,y:n.y,team:n.team,t0:tick,bursts:0,he:false,burstB:{}}; S.push(s); R.smokes++;
    bots.forEach(function(b){ if(!b.alive||b.team===n.team) return; var d=Math.hypot(b.x-n.x,b.y-n.y); if(d<150||d>700||!hasLOS(b.x,b.y,n.x,n.y)) return;
      if(!b._p2 || Math.hypot(b._p2.x-b.x,b._p2.y-b.y)>30) return; pend.push({b:b,x:b.x,y:b.y,t:tick+256}); }); }
  if(n.type==='he'){ S.forEach(function(s){ if(tick-s.t0<15*64 && s.team!==n.team && Math.hypot(n.x-s.x,n.y-s.y)<70*1.3) s.he=true; }); }
  return r; };
for(var t=0;t<200000;t++){ stepTick(); if(roundState!=='live'){ continue; }
 if(tick%128===0) bots.forEach(function(b){ b._p2 = b._p1 || null; b._p1={x:b.x,y:b.y}; });
 bots.forEach(function(b){ if(!b.alive) return; if(b.lastShotTick===tick){ var bk=b.id+'|'+(tick>>5);
   S.forEach(function(s){ if(tick-s.t0>15*64 || s.team===b.team || s.burstB[bk]) return; var dx=Math.cos(b.facing),dy=Math.sin(b.facing), vx=s.x-b.x, vy=s.y-b.y, proj=vx*dx+vy*dy; if(proj<70||proj>900) return; if(Math.abs(vx*dy-vy*dx)>63) return; if(Math.hypot(vx,vy)<70) return; if(!hasLOS(b.x,b.y,b.x+dx*(proj-70),b.y+dy*(proj-70))) return; s.burstB[bk]=1; s.bursts++; }); } });
 pend=pend.filter(function(p){ if(tick<p.t) return true; if(p.b.alive){ R.moveN++; if(Math.hypot(p.b.x-p.x,p.b.y-p.y)>100) R.moved++; } return false; });
 if(tick%97===0) bots.forEach(function(b){ if(b.alive && b._p2 && Math.hypot(b._p2.x-b.x,b._p2.y-b.y)<=30) base.push({b:b,x:b.x,y:b.y,t:tick+256}); });
 base=base.filter(function(p){ if(tick<p.t) return true; if(p.b.alive){ R.baseN++; if(Math.hypot(p.b.x-p.x,p.b.y-p.y)>100) R.baseMoved++; } return false; });
}
S.forEach(function(s){ R.bursts+=s.bursts; if(s.bursts) R.spammed++; if(s.he) R.he++; });
JSON.stringify({smokes:R.smokes, spammedShare:+(R.spammed/R.smokes).toFixed(3), burstsPerSmoke:+(R.bursts/R.smokes).toFixed(2), heClearedShare:+(R.he/R.smokes).toFixed(3), moveAfterSmoke:+(R.moved/Math.max(1,R.moveN)).toFixed(3), moveN:R.moveN, moveBaseline:+(R.baseMoved/Math.max(1,R.baseN)).toFixed(3), baseN:R.baseN})
