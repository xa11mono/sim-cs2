paused=true; var ex=[], seen={};
for(var t=0;t<300000&&ex.length<6;t++){ stepTick(); if(roundState!=='live'||t%32||bomb.state!=='planted') continue;
 bots.forEach(function(b){ if(!b.alive||b.team!=='T'||!b.post||b.post.tag!=='endhunt'||seen[roundNum+b.id]||tick-bomb.plantTick<3*64) return; seen[roundNum+b.id]=1;
  ex.push({r:roundNum, id:b.id, role:b.tRole, phase:teamTac.T.phase, sincePlant:((tick-bomb.plantTick)/64).toFixed(1), egLock:tick-(b._egLock||0), at:calloutName(b.x,b.y), bombAt:calloutName(bomb.x,bomb.y), cts:aliveCount('CT'), ctSaving:teamTac.CT.saving}); }); }
JSON.stringify(ex,null,1)
