if(typeof WARM!=="undefined"&&WARM.on){WARM={on:false};} paused=true; freshMatch(3);
while(tick < 32689) stepTick();
window.__TNT=[]; window.__NGK=[]; for(var i=0;i<12;i++) stepTick();
var T0=bots.find(function(o){return o.id==="T0";}), T1=bots.find(function(o){return o.id==="T1";});
JSON.stringify({ngk:window.__NGK, gsize:Object.keys(nadeGuessStore.all()).length, tnt:window.__TNT, T0:{post:T0.post&&T0.post.tag, nt:T0.nadeTask&&{from:T0.nadeTask.from, x:T0.nadeTask.x,y:T0.nadeTask.y, runPh:T0.nadeTask.runPh, gen:T0.nadeTask.gen}}, T1:{post:T1.post&&T1.post.tag, nt:T1.nadeTask&&{from:T1.nadeTask.from,runPh:T1.nadeTask.runPh,gen:T1.nadeTask.gen,here:T1.nadeTask._hereTried,nearFail:T1.nadeTask._nearFail}, pos:[T1.x,T1.y]}})
