paused=true; var R={dead:{}, dup:{}, deadMass:[] , n:0}; var DEAD={}; if(!BZ.ids.length) beliefBuild(); BZ.ids.forEach(function(id,i){ if(BZ.nbr[i].length<=1 && id!=='zone58') DEAD[i]=1; });
for(var t=0;t<60000;t++){ stepTick(); if(roundState!=='live'||t%16) continue;
 bots.forEach(function(b){ if(!b.alive||!b.lookTarget||b._sawEnemy) return; R.n++;
  var lz=bzOf(b.lookTarget.x,b.lookTarget.y);
  if(DEAD[lz] && !bots.some(function(e){return e.alive&&e.team!==b.team&&bzOf(e.x,e.y)===lz;})){ var k=b.team+" "+(ZONE_NAMES[BZ.ids[lz]]||lz)+" <"+b.lookReason+"> from "+(ZONE_NAMES[BZ.ids[bzOf(b.x,b.y)]]||""); R.dead[k]=(R.dead[k]||0)+1; }
  var la=Math.atan2(b.lookTarget.y-b.y,b.lookTarget.x-b.x);
  bots.forEach(function(o){ if(o.id<=b.id||!o.alive||o.team!==b.team||!o.lookTarget||o._sawEnemy) return; if(Math.hypot(o.x-b.x,o.y-b.y)>350) return;
   var oa=Math.atan2(o.lookTarget.y-o.y,o.lookTarget.x-o.x); if(Math.abs(((oa-la+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI)<0.3){ var k=b.lookReason+"+"+o.lookReason+(b.curSpeed>60*SPD_K&&o.curSpeed>60*SPD_K?" moving":""); R.dup[k]=(R.dup[k]||0)+1; } });
 });
 if(t%640===0){ var zb=BZ.idx['zone57']; R.deadMass.push(beliefZoneKnown('CT',zb).toFixed(2)); }
}
JSON.stringify(R,null,1)
