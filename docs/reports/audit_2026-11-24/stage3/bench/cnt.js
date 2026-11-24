(function(){ if(typeof WARM!=="undefined"&&WARM.on){WARM={on:false};} paused=true; freshMatch(3);
 while(roundState!=="live") stepTick();
 for(var k in __CNT) delete __CNT[k]; for(var k2 in __RS) __RS[k2]=[0,0,0]; var t0=tick, live=0;
 var dur=[]; for(var i=0;i<12000;i++){ var a=performance.now(); stepTick(); dur.push(performance.now()-a); if(roundState==="live") live++; }
 dur.sort(function(a,b){return a-b;});
 return JSON.stringify({ticks:tick-t0, live:live, cnt:__CNT, rep:__RS, p50:dur[6000], p95:dur[11400], p99:dur[11880], max:dur[11999], mean:dur.reduce(function(a,b){return a+b;},0)/12000}); })()
