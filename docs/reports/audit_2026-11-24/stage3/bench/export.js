(function(){ if(typeof WARM!=="undefined"&&WARM.on){WARM={on:false};} paused=true; freshMatch(3);
 while(tick<14000) stepTick();
 var ids=NAVAREAS.map(function(a){return a.id;}), idx={}; ids.forEach(function(id,i){idx[id]=i;});
 var nodes=NAVAREAS.map(function(a){ var c=zoneCentroid(a); return [Math.round(c.x*1000)/1000, Math.round(c.y*1000)/1000]; });
 var edges=[]; NAVAREAS.forEach(function(a){ (zoneGraph[a.id]||[]).forEach(function(e){ if(idx[e.to]===undefined||!e.mid) return; edges.push([idx[a.id], idx[e.to], e.mid.x, e.mid.y, ROUTE_PORTAL + navJumpCost(zonesById[a.id], e)]); }); });
 var kp=knownPathSpots("CT").map(function(q){return [q.x,q.y,q.w];}); if(kp.length<3) kp=kp.concat(knownPathSpots("T").map(function(q){return [q.x,q.y,q.w];}));
 var qs=[]; for(var k in __R.zd){ var p=k.split("|")[0].split(">"); var a=idx[p[0]], b=idx[p[1]]; if(a!==undefined&&b!==undefined&&a!==b) qs.push([a,b]); if(qs.length>=3000) break; }
 return JSON.stringify({nodes:nodes, edges:edges, kp:kp, R:KNOWN_PATH_R, DET:KNOWN_DETOUR, CK:KNOWN_CLOSE_K, queries:qs, tick:tick}); })()
