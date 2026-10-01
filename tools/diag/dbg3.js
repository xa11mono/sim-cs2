paused=true; var out=[];
for(var t=0;t<300000&&out.length<3;t++){ stepTick(); if(roundState!=='live'||t%64) continue;
 bots.forEach(function(b){ if(!b.alive||b.team!=='CT'||!b.post||!/^clutch/.test(b.post.tag)||!b.atPost||out.length>=3) return; var C=b._clutch; if(C._dbg) return; C._dbg=1;
  var k=C.site, g=GEO[k]; [250,450].forEach(function(r){ var E=threatEntrances('CT', g.anchor, r);
  out.push({r:r, site:k, pt:C.pt&&[Math.round(C.pt.x),Math.round(C.pt.y)], anchor:[Math.round(g.anchor.x),Math.round(g.anchor.y)], sig:C.sig, E:E.slice(0,5).map(function(e){ return (ZONE_NAMES[BZ.ids[e.z]]||e.z)+" w"+e.w.toFixed(2)+" d"+Math.round(Math.hypot(e.pt.x-g.anchor.x,e.pt.y-g.anchor.y))+" losFromBot:"+hasLOS(b.x,b.y,e.pt.x,e.pt.y); })}); });
 }); }
JSON.stringify(out,null,1)
