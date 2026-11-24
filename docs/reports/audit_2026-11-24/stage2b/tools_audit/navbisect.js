(function(){ function snap(){ var s={}; for(var k in zoneGraph) (zoneGraph[k]||[]).forEach(function(e){ s[k+">"+e.to]=1; }); return s; }
 function diff(a,b){ var x=0,y=0; for(var k in a) if(!b[k]) x++; for(var k2 in b) if(!a[k2]) y++; return [x,y]; }
 var base=snap(), R={}; var st=NAV_DROP_STEP;
 function tryV(name, set, restore){ NAV_DROP_STEP=8; set(); try{ rebuildNav(); buildWaypointPath(100,100,0,200,200,0); R[name]=diff(base,snap()); }catch(e){ R[name]="ERR "+String(e).slice(0,80); } restore(); NAV_DROP_STEP=st; }
 tryV("plain", function(){}, function(){});
 tryV("plain2", function(){}, function(){});
 var J=JUMP_UP; tryV("JUMP_UP=undef", function(){ JUMP_UP=undefined; }, function(){ JUMP_UP=J; });
 var D=NAV_NEAR_DIRS; tryV("NAV_NEAR_DIRS=undef", function(){ NAV_NEAR_DIRS=undefined; }, function(){ NAV_NEAR_DIRS=D; });
 var LD=LAND_SOUND_DROP; 
 tryV("JUMP+DIRS undef", function(){ JUMP_UP=undefined; NAV_NEAR_DIRS=undefined; }, function(){ JUMP_UP=J; NAV_NEAR_DIRS=D; });
 return JSON.stringify(R); })()
