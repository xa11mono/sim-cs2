(function(){ if(typeof WARM!=="undefined"&&WARM.on){WARM={on:false};} paused=true; freshMatch(3);
 while(tick<20000) stepTick();
 var unl0 = NAV_UNLINKED.length, text = mkPack(mkSnapshot());
 var H=[]; for(var j=0;j<2000;j++){ stepTick(); if(j%100===99) H.push(bots.map(function(b){return Math.round(b.x*100)+","+Math.round(b.y*100);}).join("|")); }
 return JSON.stringify({text:text, H:H, unl0:unl0, unl1:NAV_UNLINKED.length, tick:tick}); })()
