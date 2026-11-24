(function(){ freshMatch(3); for(var i=0;i<5000&&roundState!=="live";i++) stepTick(); for(var j=0;j<64;j++) stepTick();
 function bot(id){ return bots.filter(function(b){return b.id===id;})[0]; }
 var th=bot("CT2"), mt=bot("CT3"); th.nades.he=1; th.nades.molly=Math.max(1,th.nades.molly|0); var tgt={x:th.x+300,y:th.y};
 window.__TNT=[]; mt.x=mt.baseX=tgt.x+40; mt.y=mt.baseY=tgt.y;
 throwNade(th,"he",tgt.x,tgt.y,false,"тест"); throwNade(th,"molly",tgt.x,tgt.y,false,"тест");
 mt.x=mt.baseX=tgt.x+600; th.nades.he=1; throwNade(th,"he",tgt.x,tgt.y,false,"тест");
 tick+=200; th.nades.he=1; throwNade(th,"he",tgt.x,tgt.y,false,"тест");
 return JSON.stringify({tnt:window.__TNT, los:hasLOS(th.x,th.y,tgt.x,tgt.y), wall:insideSolidWall(tgt.x,tgt.y), nav:!!navAt(tgt.x,tgt.y)}); })()
