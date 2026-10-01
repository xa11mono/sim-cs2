paused=true; var J=BZ.idx?null:null; if(!BZ.ids.length) beliefBuild(); var zJ=BZ.ids.indexOf('zone6'), zC=BZ.ids.indexOf('zone64');
var R={jungle:[], cave:{n:0,look:0,ex:[]}};
for(var t=0;t<120000;t++){ stepTick(); if(roundState!=='live'||t%16) continue; var rt=(tick-roundStartTick)/64;
 bots.forEach(function(b){ if(!b.alive||b._sawEnemy) return;
  if(b.team==='CT' && rt<30 && b.lookTarget && bzOf(b.lookTarget.x,b.lookTarget.y)===zJ && R.jungle.length<6){
    R.jungle.push({rt:rt.toFixed(1), id:b.id, role:b.tRole, at:ZONE_NAMES[BZ.ids[bzOf(b.x,b.y)]], why:whyText(b), bJ:beliefZoneKnown('CT',zJ).toFixed(3), reachJ:reachPossible('CT',zJ), habits:bots.filter(function(o){return o.team==='T'&&o.alive}).map(function(o){var h=habitTop(o.id,2);return h?calloutName(h.x,h.y):'-'}).join(',')}); }
  if(b.team==='T' && rt<40 && b.curSpeed>60*SPD_K && BZ.cent[zC] && Math.hypot(b.x-BZ.cent[zC].x,b.y-BZ.cent[zC].y)<350 && bzOf(b.x,b.y)!==zC){
    R.cave.n++; var lk=b.lookTarget&&bzOf(b.lookTarget.x,b.lookTarget.y)===zC; if(lk) R.cave.look++;
    if(!lk && R.cave.ex.length<5) R.cave.ex.push({rt:rt.toFixed(1), id:b.id, at:ZONE_NAMES[BZ.ids[bzOf(b.x,b.y)]], why:whyText(b), bCave:beliefZoneKnown('T',zC).toFixed(3), reach:reachPossible('T',zC), cands:(b._lkC||[]).map(function(c){return (typeof c.j==='string'?'post':c.j>=1000?'вых '+ZONE_NAMES[BZ.ids[c.j-1000]]:ZONE_NAMES[BZ.ids[c.j]])+':'+c.sc.toFixed(4)}).join(' ')});
  }
 });
}
JSON.stringify(R,null,1)
