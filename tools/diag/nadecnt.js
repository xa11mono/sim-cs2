paused=true; matchNum=__M__; __F__ var C={rounds:0}, rs=null, LU={};
var od=detonate; detonate=function(n){ var k=n.team+" "+n.type; C[k]=(C[k]||0)+1; return od.apply(this,arguments); };
var ol=logEvent; logEvent=function(s){ s=String(s); var m=/идёт на лайнап «(про: [^»]+)»/.exec(s); if(m) LU[m[1]]=(LU[m[1]]||0)+1; return ol.apply(this,arguments); };
for(var t=0;t<150000;t++){ stepTick(); if(roundState!==rs){ if(roundState==='ending') C.rounds++; rs=roundState; } }
var top=Object.keys(LU).sort(function(a,b){return LU[b]-LU[a]}).slice(0,12).map(function(k){return LU[k]+'× '+k});
JSON.stringify({C:C, perRound:Object.keys(C).filter(function(k){return k!=='rounds'}).reduce(function(o,k){o[k]=+(C[k]/C.rounds).toFixed(2);return o;},{}), topLineups:top},null,1)
