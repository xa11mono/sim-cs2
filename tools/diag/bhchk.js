paused=true; __F__ var out=[], seen={};
[3,7,11,13].forEach(function(m){ if(typeof newMatch==='function'){ matchNum=m; newMatch(); }
 for(var t=0;t<60000;t++){ stepTick(); if(roundState!=='live'||t%16) continue;
  bots.forEach(function(b){ if(!b.alive||!b._proRole||b._proRole.key!=='rot'||b._proRole.round!==roundNum||!b.atPost||b._sawEnemy) return; var k=m+'|'+roundNum; if(seen[k]||tick-roundStartTick<22*64) return; seen[k]=1;
   var zb=bzOf(b.x,b.y), zl=b.lookTarget?bzOf(b.lookTarget.x,b.lookTarget.y):-1, ED=enemySpawnDist('CT');
   out.push(b._proRole.nm+' @'+ZONE_NAMES[BZ.ids[zb]]+' -> '+(zl>=0?ZONE_NAMES[BZ.ids[zl]]:'-')+(zl>=0&&zl!==zb&&ED[zl]>ED[zb]+150?' ТЫЛ':'')+' | '+whyText(b)); }); } });
out.join('\n')
