paused=true; matchNum=__M__; BAL.ppFix=false; __F__ var pv={}, S={c:0,p:0,dead:0,n:0,cands:{}};
for(var t=0;t<180000;t++){ stepTick(); if(roundState!=='live'||bomb.state!=='planted'){ pv={}; continue; }
 bots.forEach(function(b){ if(b.team!=='T'||!b.post||!/CTside|endhunt/.test(b.post.tag)) return; if(!b.alive) return; S.n++;
  if(t%64===0&&b._lkTop){ var k=b._lkTop.map(function(x){return x[0]}).join(' > '); S.cands[k]=(S.cands[k]||0)+1; }
  var vis={}; bots.forEach(function(e){ if(!e.alive||e.team==='T'||Math.hypot(e.x-b.x,e.y-b.y)>1400||!hasVision(b.x,b.y,e.x,e.y)) return; vis[e.id]=1;
   if(!(pv[b.id]||{})[e.id]){ S.c++; var a=Math.atan2(e.y-b.y,e.x-b.x), off=Math.abs(((a-b.facing+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI); if(off<0.35) S.p++; } });
  pv[b.id]=vis; }); }
var top=Object.keys(S.cands).sort(function(a,b){return S.cands[b]-S.cands[a]}).slice(0,6).map(function(k){return S.cands[k]+'× '+k});
JSON.stringify({flankerContacts:S.c, prepared:(S.p/S.c).toFixed(2), looks:top})
