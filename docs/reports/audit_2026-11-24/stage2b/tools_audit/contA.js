if(typeof WARM!=="undefined"&&WARM.on){WARM={on:false};} paused=true; freshMatch(3);
for(var i=0;i<20000;i++) stepTick();
newMatch(); var t0=tick;
var h=2166136261>>>0, F64=new Float64Array(1), U32=new Uint32Array(F64.buffer); function mix(v){ F64[0]=+v||0; h=Math.imul(h^U32[0],16777619)>>>0; h=Math.imul(h^U32[1],16777619)>>>0; }
var firstDiv=null, snaps=[];
for(var j=0;j<8000;j++){ stepTick(); var hh=2166136261>>>0; bots.forEach(function(b){ mix(b.x); mix(b.y); mix(b.hp); }); if(j%500===0) snaps.push([j,h]); }
JSON.stringify({mode:"continue", matchNum:matchNum, round:roundNum, t0:t0, snaps:snaps, pos:bots.map(function(b){return [b.id,Math.round(b.x),Math.round(b.y),b.alive];})})
