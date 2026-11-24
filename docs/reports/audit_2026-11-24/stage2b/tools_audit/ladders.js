(function(){ function c(){ return {lad:(LADDERS||[]).length, up:(LADDERS||[]).filter(function(L){return L.up;}).length, cut:navTallCut, climbUpKeys:Object.keys(NAV_CLIMB_UP).length}; }
 var a=c(); var st=NAV_DROP_STEP; NAV_DROP_STEP=8; rebuildNav(); buildWaypointPath(100,100,0,200,200,0); var b=c(); NAV_DROP_STEP=st;
 return JSON.stringify({atLoad:a, afterRebuild:b}); })()
