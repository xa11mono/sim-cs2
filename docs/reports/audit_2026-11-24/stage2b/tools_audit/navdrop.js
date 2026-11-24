(function(){ function cnt(){ var e=0; for(var k in zoneGraph) e+=(zoneGraph[k]||[]).length; return {edges:e, drop:navDropLinks, auto:navAutoLinks, step:NAV_DROP_STEP}; }
 var a=cnt(); rebuildNav(); var b=cnt(); NAV_DROP_STEP=8; rebuildNav(); var c=cnt(); NAV_DROP_STEP=24;
 return JSON.stringify({atLoad:a, afterRebuild:b, rebuildWithStep8:c}); })()
