(function(){ function snap(){ var s={}; for(var k in zoneGraph) (zoneGraph[k]||[]).forEach(function(e){ s[k+">"+e.to]=1; }); return s; }
 var a=snap(); var st=NAV_DROP_STEP; NAV_DROP_STEP=8; rebuildNav(); var b=snap(); NAV_DROP_STEP=st;
 var onlyLoad=Object.keys(a).filter(function(k){return !b[k];}), onlyReb=Object.keys(b).filter(function(k){return !a[k];});
 function info(k){ var p=k.split(">"), A=navArea(+p[0])||navArea(p[0]), B=navArea(+p[1])||navArea(p[1]); return k+" dz="+(A&&B?Math.round(B.z-A.z):"?")+" up="+(!!NAV_CLIMB_UP[k])+" gap="+(typeof NAV_GAPS!=="undefined"&&!!(NAV_GAPS[k]))+" at="+(A?Math.round(zoneCentroid(A).x)+","+Math.round(zoneCentroid(A).y):"?"); }
 return JSON.stringify({onlyLoad:onlyLoad.length, onlyRebuild:onlyReb.length, exLoad:onlyLoad.slice(0,8).map(info), exReb:onlyReb.slice(0,12).map(info), m3AtLoad: typeof M3_AT_LOAD}); })()
