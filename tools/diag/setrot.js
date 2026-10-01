paused=true; var out=[], seen={};
for(var m of [3,7,11,13,17]){ matchNum=m; newMatch();
 for(var t=0;t<90000;t++){ stepTick(); if(roundState!=='live'||t%16) continue; var sec=(tick-roundStartTick)/64; if(sec>30) continue;
  bots.forEach(function(b){ if(!b.alive||b.team!=='CT'||!b.post||!/^set:/.test(b.post.tag)||b._sawEnemy||!b.lookTarget) return; var k=m+'|'+roundNum+'|'+b.id; if(seen[k]) return;
   var zb=bzOf(b.x,b.y), zl=bzOf(b.lookTarget.x,b.lookTarget.y), ED=enemySpawnDist('CT'); if(zl===zb) return;
   if(!(ED[zl] > ED[zb] - 50)) return; seen[k]=1;
   out.push(m+'/'+roundNum+' '+sec.toFixed(0)+'s '+b.post.tag+' setup='+teamTac.CT.setup.id+' @'+ZONE_NAMES[BZ.ids[zb]]+'(ED '+Math.round(ED[zb])+') → '+ZONE_NAMES[BZ.ids[zl]]+'(ED '+Math.round(ED[zl])+') moving='+(b.curSpeed>60*SPD_K)+' | '+whyText(b)); }); } }
out.slice(0,25).join('\n')
