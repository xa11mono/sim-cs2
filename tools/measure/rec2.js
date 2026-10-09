// один воспроизводимый матч: позиции/фраги/раунды/закуп/гранаты + детектор дёрганий каждый тик
freshMatch(__M__);
var M0=matchNum;
var REC={rounds:[], kills:[], pos:[], plants:[], buys:[], nades:[], jit:{alive:0, look:0, moveEng:0, moveIdle:0, moveOther:0, ev:[]}}, rs=null, cur=null;
var ofk=feedKill; feedKill=function(att,vic,weap,hs){ REC.kills.push([tick, att?att.id:null, att?att.team:null, att?Math.round(att.x):null, att?Math.round(att.y):null, vic.id, vic.team, Math.round(vic.x), Math.round(vic.y), String(weap), hs?1:0, att&&att.weapon?att.weapon.key:null, vic.tRole||'']); return ofk.apply(this,arguments); };
var oer=endRound; endRound=function(w,reason){ if(cur){ cur.t1=tick; cur.winner=w; cur.reason=reason; cur.bomb=bomb.state; } return oer.apply(this,arguments); };
var otn=throwNade; throwNade=function(b,type,tx,ty){ if(roundState==='live' && b.nades && b.nades[type]>0) REC.nades.push([tick, b.team, type, b.id, (b.tRole||b.ctRole||''), Math.round(b.x), Math.round(b.y), Math.round(tx), Math.round(ty), tick-(b.lastShotTick||-999)]); return otn.apply(this,arguments); };
// (v181) стрельба: каждый выстрел пулей — тик, стрелок, команда, оружие, дистанция, цель,
// сколько тиков враг уже виден, скорость стрелка (одинаково для любой версии)
REC.shots=[]; var ots=tryShoot; tryShoot=function(sh,tg,dist){ var a0=sh.ammo, l0=sh.lastShotTick; var r=ots.apply(this,arguments); if(roundState==='live' && (sh.ammo<a0 || sh.lastShotTick!==l0)) REC.shots.push([tick, sh.id, sh.team, sh.weapon?sh.weapon.key:'', Math.round(dist), tg.id, sh.contactStreak|0, Math.round(sh.curSpeed||0), sh._smokeShot?1:0, sh._prep?sh._prep.src:'']); return r; };
// гранатные детекторы: где разорвалась и стрелял ли рядом враг бросавшего за последнюю секунду
REC.det=[]; var odt=detonate; detonate=function(n){ if(roundState==='live'){ var sh=0; bots.forEach(function(o){ if(o.alive && o.team!==n.team && Math.hypot(o.x-n.x,o.y-n.y)<400 && tick-(o.lastShotTick||-999)<=64) sh++; }); REC.det.push([tick, n.team, n.type, Math.round(n.x), Math.round(n.y), sh, n.thrower?n.thrower.id:'', String(n.why||'')]); } return odt.apply(this,arguments); };
var H={};
for(var t=0;t<__T__;t++){ stepTick();
 if(matchNum!==M0) break;
 if(roundState!==rs){ if(roundState==='live'){ cur={r:roundNum, t0:tick, ctType:teamEco.CT.roundType, tType:teamEco.T.roundType, tac:(typeof teamTac!=='undefined'&&teamTac.T&&teamTac.T.tac)?teamTac.T.tac.id:null, tsite:(typeof teamTac!=='undefined'&&teamTac.T)?teamTac.T.site:null, ctSetup:(typeof teamTac!=='undefined'&&teamTac.CT&&teamTac.CT.setup)?teamTac.CT.setup.id:null}; REC.rounds.push(cur);
   bots.forEach(function(b){ REC.buys.push([roundNum, b.id, b.team, b.primary||'', b.secondary||'', b.armor?1:0, b.helmet?1:0, b.kit?1:0, b.nades?(b.nades.smoke+b.nades.flash+b.nades.he+b.nades.molly):0, b.money]); }); H={}; }
   rs=roundState; }
 if(roundState!=='live') continue;
 if(bomb.state==='planted' && cur && cur.plant==null){ cur.plant=tick; cur.site=bomb.site; REC.plants.push([tick, bomb.site, Math.round(bomb.x), Math.round(bomb.y)]); }

 if(tick%16===0) bots.forEach(function(b){ REC.pos.push([tick, b.id, b.team==='CT'?1:0, Math.round(b.x), Math.round(b.y), b.alive?1:0, Math.round((b.facing||0)*100)/100, b.weapon?b.weapon.key:'', b._knife?1:0]); });
 bots.forEach(function(b){ if(!b.alive){ delete H[b.id]; return; } REC.jit.alive++;
  var h=H[b.id]||(H[b.id]={p:[],f:[]}); h.p.push([b.x,b.y]); h.f.push(b.facing||0); if(h.p.length>12){h.p.shift();h.f.shift();} if(h.p.length<12) return;
  var a=h.p[0],m=h.p[5],c=h.p[11], v1x=m[0]-a[0],v1y=m[1]-a[1],v2x=c[0]-m[0],v2y=c[1]-m[1], l1=Math.hypot(v1x,v1y),l2=Math.hypot(v2x,v2y);
  if(l1>5&&l2>5&&(v1x*v2x+v1y*v2y)/(l1*l2)<-0.6){ if(b._sawEnemy) REC.jit.moveEng++; else if(!b.post) { REC.jit.moveIdle++; if(REC.jit.ev.length<200) REC.jit.ev.push(['idle',tick,b.id,Math.round(b.x),Math.round(b.y)]); } else REC.jit.moveOther++; h.p=[]; h.f=[]; return; }
  var d1=h.f[5]-h.f[0], d2=h.f[11]-h.f[5]; d1=Math.atan2(Math.sin(d1),Math.cos(d1)); d2=Math.atan2(Math.sin(d2),Math.cos(d2));
  if(!b._sawEnemy&&Math.abs(d1)>0.87&&Math.abs(d2)>0.87&&d1*d2<0){ REC.jit.look++; if(REC.jit.ev.length<200) REC.jit.ev.push(['look',tick,b.id,Math.round(b.x),Math.round(b.y),b.post?b.post.tag:'']); h.p=[]; h.f=[]; }
 });
}
REC.match=M0; REC.ticks=tick; if(typeof VOICE_STATS!=='undefined') REC.voice=VOICE_STATS;
JSON.stringify(REC)
