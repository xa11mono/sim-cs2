if(typeof WARM!=="undefined"&&WARM.on){WARM={on:false};} paused=true; freshMatch(3);
function L(p,x,y){ var s=0,px=x,py=y; (p||[]).forEach(function(q){ s+=Math.hypot(q[0]-px,q[1]-py); px=q[0]; py=q[1]; }); return s; }
var n=0, nw=0, d10=0, d25=0, dw10=0, ex=[];
for(var i=0;i<25000;i++){ stepTick(); if(tick%64 || roundState!=="live") continue;
  bots.forEach(function(b){ if(!b.alive||!b.post||b.atPost) return; var P=b.post; if(Math.hypot(P.x-b.baseX,P.y-b.baseY)<100) return;
    var a=pathLenTo(b,P.x,P.y), m=L(buildWaypointPath(b.baseX,b.baseY,b.z,P.x,P.y,P.z||0,b.team,botLane(b),b.walking),b.baseX,b.baseY);
    if(!(a>0&&m>0)) return; n++; var r=Math.abs(a-m)/m; if(b.walking) nw++; if(r>0.10){ d10++; if(b.walking) dw10++; } if(r>0.25){ d25++; if(ex.length<8) ex.push([tick,b.id,P.tag,Math.round(a),Math.round(m),b.walking,P.z!=null]); } }); }
JSON.stringify({samples:n, walkingSamples:nw, diff10:d10, diff25:d25, walkingDiff10:dw10, ex:ex})
