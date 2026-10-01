paused=true; var out=[], seenR={};
for(var t=0;t<200000 && out.length<8;t++){ stepTick(); if(roundState!=='live'||t%32) continue;
 var cts=bots.filter(function(b){return b.alive&&b.team==='CT'}), ts=bots.filter(function(b){return b.alive&&b.team==='T'});
 if(ts.length<2||cts.length>2||tick-roundStartTick<50*64) continue;
 cts.forEach(function(b){ var z=ZONE_NAMES[BZ.ids[bzOf(b.x,b.y)]]; if(z!=='CT Spawn'||seenR[roundNum+b.id]) return; if(b._sawEnemy) return; seenR[roundNum+b.id]=1;
  var zb=bzOf(b.x,b.y);
  out.push({r:roundNum,id:b.id,atPost:b.atPost,post:b.post&&b.post.tag,why:whyText(b),bomb:bomb.state+" "+calloutName(bomb.x,bomb.y), Ts:ts.map(function(e){return calloutName(e.x,e.y)}).join(","),
   danger:(ZONE_DANGER[BZ.ids[zb]]||[]).map(function(z){var j=BZ.idx[z];return (ZONE_NAMES[z]||z)+":"+beliefZoneKnown('CT',j).toFixed(3)+(BZ.cent[j]?"/d"+Math.round(Math.hypot(BZ.cent[j].x-b.x,BZ.cent[j].y-b.y)):"")}).join(" "),
   cands:(b._lkC||[]).map(function(c){return (typeof c.j==='string'?'post':ZONE_NAMES[BZ.ids[c.j]])+":"+c.sc.toFixed(4)}).join(" "),
   belief:BZ.ids.map(function(id,i){return [ZONE_NAMES[id]||id, beliefZoneKnown('CT',i)]}).filter(function(x){return x[1]>0.05}).map(function(x){return x[0]+":"+x[1].toFixed(2)}).join(" ") });
 });
}
JSON.stringify(out,null,1)
