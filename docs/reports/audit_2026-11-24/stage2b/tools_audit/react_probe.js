(function(){
 function setup(){ freshMatch(3); for(var i=0;i<5000&&roundState!=="live";i++) stepTick(); for(var j=0;j<64;j++) stepTick(); }
 function bot(id){ return bots.filter(function(b){return b.id===id;})[0]; }
 function park(ex){ bots.forEach(function(o){ if(ex.indexOf(o)>=0) return; o.x=o.baseX=(o.team==="CT"?CT_SPAWN.x:T_SPAWN.x); o.y=o.baseY=(o.team==="CT"?CT_SPAWN.y:T_SPAWN.y); }); }
 function openPair(){ for(var k=0;k<4000;k++){ var a=NAVAREAS[Math.floor(hashRand(k*7+1)*NAVAREAS.length)], c1=zoneCentroid(a); var ang=hashRand(k*13+5)*Math.PI*2, d=300+hashRand(k*17+3)*200; var c2={x:c1.x+Math.cos(ang)*d,y:c1.y+Math.sin(ang)*d};
   if(insideSolidWall(c1.x,c1.y)||insideSolidWall(c2.x,c2.y)) continue; if(bzOf(c2.x,c2.y)<0||visWallHit(c1.x,c1.y,c2.x,c2.y)||!hasLOS(c1.x,c1.y,c2.x,c2.y)) continue;
   var v=visParts(c1.x,c1.y,false,c2.x,c2.y,false,false), w=visParts(c2.x,c2.y,false,c1.x,c1.y,false,false); if(v.head&&v.body&&w.head&&w.body&&!smokeBlocks(c1.x,c1.y,c2.x,c2.y)) return [c1,c2]; } return null; }
 var out={};
 [false,true].forEach(function(fixZ){
  setup(); var ct=bot("CT2"), t=bot("T2"), P=openPair(); park([ct,t]);
  ct.x=ct.baseX=P[0].x; ct.y=ct.baseY=P[0].y; t.x=t.baseX=P[1].x; t.y=t.baseY=P[1].y;
  var z0=[ct.z,t.z];
  if(fixZ){ var a1=navAt(ct.x,ct.y), a2=navAt(t.x,t.y); ct.z=a1?a1.z:ct.z; t.z=a2?a2.z:t.z; }
  ct.facing=Math.atan2(t.y-ct.y,t.x-ct.x); ct.curSpeed=0; t.curSpeed=0; ct.state="hold"; ct.holding=true; ct.lastIntel=null; ct.contactStreak=0; ct.nextShotTick=0; ct.blindUntil=0; ct.throwUntil=0; ct._knife=false; ct._drawUntil=0;
  var a0=ct.ammo, first=null, log=[];
  for(var i=0;i<64&&first===null;i++){ tick++; resolveEngagements(); if(i<3||i%8===0) log.push([i, ct._sawEnemy, (ct._visible||[]).length, Math.round(((Math.atan2(t.y-ct.y,t.x-ct.x)-ct.facing+9*Math.PI)%(2*Math.PI)-Math.PI)*57.3), ct.state]); if(ct.ammo<a0) first=i+1; if(!t.alive) break; }
  out[fixZ?"zFixed":"zAsTest"]={first:first, expect:Math.round(ct.reactionTicks*BAL.holdReact), zBefore:z0.map(Math.round), zAfter:[Math.round(ct.z),Math.round(t.z)], P:P.map(function(p){return [Math.round(p.x),Math.round(p.y)];}), log:log};
 });
 return JSON.stringify(out);
})()
