paused=true; matchNum=__M__; newMatch();
var REC={rounds:[], kills:[], pos:[], plants:[], buys:[]}, rs=null, cur=null;
var ofk=feedKill; feedKill=function(att,vic,weap,hs){ REC.kills.push([tick, att?att.id:null, att?att.team:null, att?Math.round(att.x):null, att?Math.round(att.y):null, vic.id, vic.team, Math.round(vic.x), Math.round(vic.y), String(weap), hs?1:0, att&&att.weapon?att.weapon.key:null]); return ofk.apply(this,arguments); };
var oer=endRound; endRound=function(w,reason){ if(cur){ cur.t1=tick; cur.winner=w; cur.reason=reason; cur.bomb=bomb.state; } return oer.apply(this,arguments); };
for(var t=0;t<__T__;t++){ stepTick();
 if(roundState!==rs){ if(roundState==='live'){ cur={r:roundNum, t0:tick, ctType:teamEco.CT.roundType, tType:teamEco.T.roundType, tac:teamTac.T&&teamTac.T.tac&&teamTac.T.tac.id, tsite:teamTac.T&&teamTac.T.site, ctSetup:teamTac.CT&&teamTac.CT.setup&&teamTac.CT.setup.id}; REC.rounds.push(cur);
   bots.forEach(function(b){ REC.buys.push([roundNum, b.id, b.team, b.primary||'', b.secondary||'', b.armor?1:0, b.helmet?1:0, b.kit?1:0, b.nades?(b.nades.smoke+b.nades.flash+b.nades.he+b.nades.molly):0, b.money]); }); }
   rs=roundState; }
 if(roundState!=='live') continue;
 if(bomb.state==='planted' && cur && cur.plant==null){ cur.plant=tick; cur.site=bomb.site; REC.plants.push([tick, bomb.site, Math.round(bomb.x), Math.round(bomb.y)]); }
 if(tick%16===0) bots.forEach(function(b){ REC.pos.push([tick, b.id, b.team==='CT'?1:0, Math.round(b.x), Math.round(b.y), b.alive?1:0, Math.round((b.facing||0)*100)/100, b.weapon?b.weapon.key:'']); });
}
JSON.stringify(REC)
