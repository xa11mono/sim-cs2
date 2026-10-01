paused=true; matchNum=__M__; __F__ var pv={}, S={c:0,p:0,pl:0,tw:0}, st=null;
for(var t=0;t<180000;t++){ stepTick();
 if(roundState==='ending'&&st==='planted'){ S.pl++; if(bomb.state==='exploded'||!bots.some(function(b){return b.alive&&b.team==='CT'})) S.tw++; st='x'; }
 if(roundState!=='live'){ pv={}; if(roundState==='freeze') st=null; continue; } if(bomb.state==='planted') st='planted'; else continue;
 bots.forEach(function(b){ if(!b.alive||b.team!=='T') return; var vis={};
  bots.forEach(function(e){ if(!e.alive||e.team==='T'||Math.hypot(e.x-b.x,e.y-b.y)>1400||!hasVision(b.x,b.y,e.x,e.y)) return; vis[e.id]=1;
   if(!(pv[b.id]||{})[e.id]){ S.c++; var a=Math.atan2(e.y-b.y,e.x-b.x), off=Math.abs(((a-b.facing+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI); if(off<0.35) S.p++; } });
  pv[b.id]=vis; }); }
JSON.stringify({tPrepPostPlant:(S.p/S.c).toFixed(3), contacts:S.c, plantedRounds:S.pl, tWon:S.tw})
