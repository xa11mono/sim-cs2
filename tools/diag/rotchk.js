paused=true; matchNum=__M__; __F__ var out=[], seen={};
for(var t=0;t<120000&&out.length<8;t++){ stepTick(); if(roundState!=='live'||t%32) continue;
 bots.forEach(function(b){ if(!b.alive||b.team!=='CT'||!b._proRole||b._proRole.key!=='rot'||b._proRole.round!==roundNum||!b.atPost||b._sawEnemy||seen[roundNum]) return; if(tick-roundStartTick<22*64) return; seen[roundNum]=1;
  var zb=bzOf(b.x,b.y), zl=b.lookTarget?bzOf(b.lookTarget.x,b.lookTarget.y):-1;
  out.push({r:roundNum, pos:b._proRole.nm, at:ZONE_NAMES[BZ.ids[zb]], lookZone: zl>=0?ZONE_NAMES[BZ.ids[zl]]:'-', rear: zl>=0&&zl!==zb&&enemySpawnDist('CT')[zl]>enemySpawnDist('CT')[zb]+150, why:whyText(b)}); }); }
JSON.stringify(out,null,1)
