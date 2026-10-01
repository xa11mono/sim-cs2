paused=true; var R=[], cur=null, rs=null; var Z2R=__Z2R__;
var od=null;
for(var m of [3,7,11,13]){ matchNum=m; newMatch();
for(var t=0;t<80000;t++){ stepTick();
 if(roundState!==rs){ if(roundState==='live'){ cur={tac:teamTac.T&&teamTac.T.tac&&teamTac.T.tac.style, site:teamTac.T&&teamTac.T.site, tdead:0, ctdead:0, reg:null, carrier:null, plantSec:null}; R.push(cur); } rs=roundState; }
 if(roundState!=='live'||!cur) continue; var sec=(tick-roundStartTick)/64;
 if(sec<45 && tick%16===0){ var ta=aliveCount('T'), ca=aliveCount('CT'); cur._ta=cur._ta==null?5:cur._ta; cur._ca=cur._ca==null?5:cur._ca; if(ta<cur._ta){ cur.tdead+=cur._ta-ta; } if(ca<cur._ca){ cur.ctdead+=cur._ca-ca; } cur._ta=ta; cur._ca=ca; }
 if(cur.reg===null && sec>=30){ var c={'A сторона':0,'мид':0,'B сторона':0,'другое':0}; bots.forEach(function(b){ if(b.alive&&b.team==='T'){ var z=ZONE_NAMES[BZ.ids[bzOf(b.x,b.y)]]; c[Z2R[z]||'другое']++; } }); cur.reg=c;
   var car=bomb.state==='carried'&&bomb.carrier; cur.carrier = car ? (Z2R[ZONE_NAMES[BZ.ids[bzOf(car.x,car.y)]]]||'другое') : bomb.state; }
 if(bomb.state==='planted' && cur.plantSec===null) cur.plantSec=sec;
} }
var def=R.filter(function(r){return r.tac==='default' && r.reg;});
var agg={n:def.length, tdead:0, ctdead:0, reg:{}, carrier:{}};
def.forEach(function(r){ agg.tdead+=r.tdead; agg.ctdead+=r.ctdead; for(var k in r.reg) agg.reg[k]=(agg.reg[k]||0)+r.reg[k]; agg.carrier[r.carrier]=(agg.carrier[r.carrier]||0)+1; });
for(var k in agg.reg) agg.reg[k]=+(agg.reg[k]/agg.n).toFixed(2); agg.tdead=+(agg.tdead/agg.n).toFixed(2); agg.ctdead=+(agg.ctdead/agg.n).toFixed(2);
JSON.stringify(agg)
