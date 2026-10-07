freshMatch(__M__); var M0=matchNum, D=[], rs0=0;
var ofk=feedKill; feedKill=function(att,vic,weap,hs){ try{ if(roundState==='live'){ 
 var mate=Infinity; bots.forEach(function(o){ if(o!==vic&&o.alive&&o.team===vic.team) mate=Math.min(mate,Math.hypot(o.x-vic.x,o.y-vic.y)); });
 var li=vic.lastIntel?tick-vic.lastIntel.tick:-1;
 D.push({s:+((tick-roundStartTick)/64).toFixed(1), vt:vic.team, vr:vic.tRole||'', vtag:vic.post?vic.post.tag:'', vst:vic.state, vsp:Math.round(vic.curSpeed||0), vpk:vic.peekType||'', vap:vic.atPost?1:0, vli:li, mate:Math.round(mate),
   kt:att?att.team:'', kr:att?att.tRole||'':'', ktag:att&&att.post?att.post.tag:'', kst:att?att.state:'', ksp:att?Math.round(att.curSpeed||0):0, kpk:att?att.peekType||'':'', kap:att&&att.atPost?1:0,
   z:String(calloutName(vic.x,vic.y)), d:att?Math.round(Math.hypot(att.x-vic.x,att.y-vic.y)):0, ph:(typeof teamTac!=='undefined'&&teamTac.T)?teamTac.T.phase:'', bomb:bomb?bomb.state:'', w:att&&att.weapon?att.weapon.key:''}); } }catch(e){} return ofk.apply(this,arguments); };
for(var t=0;t<200000;t++){ stepTick(); if(matchNum!==M0) break; }
JSON.stringify(D)
