paused=true; BAL.newLook=__FLAG__; var S={n:0,expo:0,one2:0,lookTop:0, clutchR:0, clutchW:0}, seen={}; if(!BZ.ids.length) beliefBuild();
for(var t=0;t<__T__;t++){ stepTick();
 if(roundState==='ending' && seen['c'+roundNum]==='live'){ seen['c'+roundNum]='done'; S.clutchR++; if(bots.some(function(b){return b.alive&&b.team==='CT'})||bomb.state==='defused') S.clutchW++; }
 if(roundState!=='live'||t%32) continue;
 bots.forEach(function(b){ if(!b.alive||b.team!=='CT'||!b.post||!/^clutch/.test(b.post.tag)||b._sawEnemy) return; seen['c'+roundNum]='live';
  if(!b.atPost) return;
  var k=b.post.tag.split(':')[1], E=threatEntrances('CT', GEO[k].anchor, 280).filter(function(e){return e.w>0.03}); if(!E.length) return;
  var top=E[0].w, vis=E.filter(function(e){return e.w>0.15*top && hasLOS(b.x,b.y,e.pt.x,e.pt.y)});
  S.n++; S.expo+=vis.length; if(vis.length>=1&&vis.length<=2&&hasLOS(b.x,b.y,E[0].pt.x,E[0].pt.y)) S.one2++;
  if(b.lookTarget){ var a1=Math.atan2(b.lookTarget.y-b.y,b.lookTarget.x-b.x),a2=Math.atan2(E[0].pt.y-b.y,E[0].pt.x-b.x); if(Math.abs(((a1-a2+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI)<0.5) S.lookTop++; }
 });
}
JSON.stringify({samples:S.n, avgOpenEntrances:(S.expo/S.n).toFixed(2), coversMain_1to2:(S.one2/S.n).toFixed(2), looksAtMain:(S.lookTop/S.n).toFixed(2), clutchRounds:S.clutchR, clutchWon:S.clutchW})
