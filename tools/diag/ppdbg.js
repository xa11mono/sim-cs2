paused=true; var out=[], seen={};
for(var t=0;t<120000&&out.length<8;t++){ stepTick(); if(roundState!=='live'||bomb.state!=='planted'||tick-bomb.plantTick<5*64) continue;
 bots.forEach(function(b){ if(!b.alive||b.team!=='T'||!b.post||b.post.tag!=='postplant:hold'||!b.atPost||seen[roundNum+b.id]) return; seen[roundNum+b.id]=1; var H=b._hTask; if(!H||!H.look) return;
  out.push({r:roundNum,id:b.id,bomb:calloutName(bomb.x,bomb.y),at:calloutName(b.x,b.y),seesBomb:hasLOS(b.x,b.y,bomb.x,bomb.y),look:calloutName(H.look.x,H.look.y),score:H.s.toFixed(2),why:whyText(b)}); }); }
var T0=Date.now(); for(var k=0;k<3000;k++) stepTick(); out.push({msPer1000:((Date.now()-T0)/3).toFixed(0)});
JSON.stringify(out,null,1)
