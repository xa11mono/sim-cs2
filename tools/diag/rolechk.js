paused=true; __F__ var S={20:{T:0,CT:0},45:{T:0,CT:0}}, n=0, rs=null, prev=null, N={}, fb=0, rounds={T:{},CT:{}};
var od=detonate; detonate=function(nd){ if(nd.thrower){ var k=nd.thrower.team+" "+pRole(nd.thrower); N[k]=(N[k]||0)+1; } return od.apply(this,arguments); };
var ov=voiceLog; voiceLog=function(t,k,id,s){ if(/^fb/.test(k)) fb++; return ov.apply(this,arguments); };
for(var m of [__M__]){ matchNum=m; newMatch(); for(var t=0;t<150000;t++){ stepTick(); if(roundState!==rs){ if(roundState==="live"){ n++; prev={T:5,CT:5}; } rs=roundState; } if(roundState!=="live"||tick%8) continue; var sec=(tick-roundStartTick)/64; if(bomb.state==="planted") continue; ["T","CT"].forEach(function(s){ var a=aliveCount(s); if(a<prev[s]){ var k=prev[s]-a; if(sec<20) S[20][s]+=k; if(sec<45) S[45][s]+=k; } prev[s]=a; }); } }
var nr={}; for(var k in N) nr[k]=+(N[k]/n).toFixed(2);
JSON.stringify({rounds:n, d20:{T:+(S[20].T/n).toFixed(2),CT:+(S[20].CT/n).toFixed(2)}, d45:{T:+(S[45].T/n).toFixed(2),CT:+(S[45].CT/n).toFixed(2)}, fallbacks:+(fb/n).toFixed(2), nadesPerRound:nr})
