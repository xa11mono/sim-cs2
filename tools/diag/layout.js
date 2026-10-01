paused=true; matchNum=__M__; __F__ var Z2R=__Z2R__; var cnt={}, n=0, done={};
for(var t=0;t<250000;t++){ stepTick(); if(roundState!=="live"||done[roundNum]) continue;
 if(tick-roundStartTick>=25*64){ done[roundNum]=1; var c=bots.filter(function(b){return b.alive&&b.team==="CT"}); if(c.length<5) continue; n++;
  c.forEach(function(b){ var z=ZONE_NAMES[BZ.ids[bzOf(b.x,b.y)]]; var r=Z2R[z]||"прочее"; cnt[r]=(cnt[r]||0)+1; }); } }
JSON.stringify({n:n, cnt:cnt})
