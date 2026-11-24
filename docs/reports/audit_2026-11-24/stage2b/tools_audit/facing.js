if(typeof WARM!=="undefined"&&WARM.on){WARM={on:false};} paused=true; freshMatch(3);
var mn=0,mx=0,over=0,n=0,ex=null,hist={};
for(var i=0;i<30000;i++){ stepTick(); if(tick%16) continue; bots.forEach(function(b){ if(!b.alive||b.facing===undefined) return; n++; var f=b.facing; if(f<mn){mn=f;ex=[tick,b.id,f];} if(f>mx) mx=f; var k=Math.round(f/Math.PI); hist[k]=(hist[k]||0)+1; if(f < -2*Math.PI || f > 4*Math.PI) over++; }); }
JSON.stringify({samples:n, min:mn, max:mx, beyond:over, minAt:ex, histByPi:hist})
