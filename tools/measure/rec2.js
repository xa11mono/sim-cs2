// один воспроизводимый матч: позиции/фраги/раунды/закуп/гранаты + детектор дёрганий каждый тик
freshMatch(__M__);
var M0=matchNum;
var REC={rounds:[], kills:[], pos:[], plants:[], buys:[], nades:[], jit:{alive:0, look:0, moveEng:0, moveIdle:0, moveOther:0, ev:[]}}, rs=null, cur=null;
var ofk=feedKill; feedKill=function(att,vic,weap,hs){ REC.kills.push([tick, att?att.id:null, att?att.team:null, att?Math.round(att.x):null, att?Math.round(att.y):null, vic.id, vic.team, Math.round(vic.x), Math.round(vic.y), String(weap), hs?1:0, att&&att.weapon?att.weapon.key:null, vic.tRole||'']); return ofk.apply(this,arguments); };
var oer=endRound; endRound=function(w,reason){ if(cur){ cur.t1=tick; cur.winner=w; cur.reason=reason; cur.bomb=bomb.state; } return oer.apply(this,arguments); };
var otn=throwNade; throwNade=function(b,type,tx,ty){ if(roundState==='live' && b.nades && b.nades[type]>0) REC.nades.push([tick, b.team, type, b.id, (b.tRole||b.ctRole||''), Math.round(b.x), Math.round(b.y), Math.round(tx), Math.round(ty), tick-(b.lastShotTick||-999)]); return otn.apply(this,arguments); };
// гранатные детекторы: где разорвалась и стрелял ли рядом враг бросавшего за последнюю секунду
REC.det=[]; var odt=detonate; detonate=function(n){ if(roundState==='live'){ var sh=0; bots.forEach(function(o){ if(o.alive && o.team!==n.team && Math.hypot(o.x-n.x,o.y-n.y)<400 && tick-(o.lastShotTick||-999)<=64) sh++; }); REC.det.push([tick, n.team, n.type, Math.round(n.x), Math.round(n.y), sh, n.thrower?n.thrower.id:'', String(n.why||'')]); } return odt.apply(this,arguments); };
// (v176) детекторы взгляда: В9 — стоит и смотрит туда, откуда враг сейчас появиться не может
// (все зоны по лучу взгляда и их соседи закрыты по таймингу REACH); В8 — смотрит на угол,
// (unreachAlt — при этом было куда смотреть: видна зона, куда враг мог дойти); В8 — смотрит на угол,
// открытый давно (>20 с) без единого наблюдения врага рядом за 20 с; В10 — после планта CT
// на сборе ретейка в 450–1400 px от сайта с бомбой стоит спиной к сайту (>100° от направления на центр)
REC.ld={CT:{n:0,unreach:0,stale:0,ex:[]},T:{n:0,unreach:0,stale:0,ex:[]},rt:{n:0,back:0,ex:[]}};
var SITEC={A:{x:630,y:518},B:{x:1533,y:845}};
function lookDet(){
 bots.forEach(function(b){
  if(!b.alive||b._sawEnemy||tick<(b.blindUntil||0)) return;
  var still=(b.curSpeed||0)<60*SPD_K, f=b.facing||0;
  if(bomb.state==='planted'){
   // только сбор на ретейк (не сейв, не тот, кто смотрит в спину на люрк)
   if(b.team!=='CT'||!still||!SITEC[bomb.site]||!(b.post&&/^gather/.test(b.post.tag||''))||(bomb.retake&&bomb.retake.backWatch===b.id)) return; var c=SITEC[bomb.site], d=Math.hypot(c.x-b.x,c.y-b.y); if(d<450||d>1400) return;
   var a=Math.atan2(c.y-b.y,c.x-b.x), off=Math.abs(Math.atan2(Math.sin(f-a),Math.cos(f-a)));
   REC.ld.rt.n++; if(off>100*Math.PI/180){ REC.ld.rt.back++; if(REC.ld.rt.ex.length<40) REC.ld.rt.ex.push([roundNum,tick,b.id,Math.round(b.x),Math.round(b.y),b.post?b.post.tag:'']); }
   return; }
  var R=REACH[b.team]; if(!still||!R) return;
  var far=rayClipWalls(b.x,b.y,b.x+Math.cos(f)*1100,b.y+Math.sin(f)*1100), L=Math.hypot(far.x-b.x,far.y-b.y), z0=bzOf(b.x,b.y), Z={};
  for(var s=120;s<L;s+=40){ var z=bzOf(b.x+Math.cos(f)*s,b.y+Math.sin(f)*s); if(z>=0&&z!==z0) Z[z]=1; }
  var zs=Object.keys(Z).map(Number); if(!zs.length) return;
  var E={}; zs.forEach(function(z){ E[z]=1; BZ.nbr[z].forEach(function(n){ if(n!==z0) E[n]=1; }); });
  var es=Object.keys(E).map(Number), D=REC.ld[b.team], sl=4*TICK_HZ; D.n++;
  var open=es.filter(function(z){ return R[z]<=tick+sl; });
  if(!open.length){
   // было ли куда смотреть: видимая зона рядом (≤1100 px), куда враг мог дойти
   var alt=false; for(var zi=0;zi<R.length&&!alt;zi++){ if(zi===z0||R[zi]>tick+sl) continue; var cz=BZ.cent[zi]; if(!cz||Math.hypot(cz.x-b.x,cz.y-b.y)>1100) continue;
     (ZONE_SAMPLES[BZ.ids[zi]]||[cz]).forEach(function(q){ if(!alt&&Math.hypot(q.x-b.x,q.y-b.y)>=60&&hasLOS(b.x,b.y,q.x,q.y)) alt=true; }); }
   if(alt) D.unreachAlt=(D.unreachAlt||0)+1;
   D.unreach++; if(D.ex.length<60) D.ex.push(['unreach',roundNum,tick,b.id,Math.round(b.x),Math.round(b.y),Math.round(f*100)/100]); return; }
  var old=open.every(function(z){ return R[z]<tick-20*TICK_HZ; }), BL=beliefLast[b.team]||{}, info=false;
  for(var e in BL){ var o=BL[e]; if(o&&tick-o.tick<20*TICK_HZ&&E[bzOf(o.x,o.y)]) info=true; }
  if(old&&!info){ D.stale++; if(D.ex.length<60) D.ex.push(['stale',roundNum,tick,b.id,Math.round(b.x),Math.round(b.y),Math.round(f*100)/100]); }
 });
}
var H={};
for(var t=0;t<__T__;t++){ stepTick();
 if(matchNum!==M0) break;
 if(roundState!==rs){ if(roundState==='live'){ cur={r:roundNum, t0:tick, ctType:teamEco.CT.roundType, tType:teamEco.T.roundType, tac:teamTac.T&&teamTac.T.tac&&teamTac.T.tac.id, tsite:teamTac.T&&teamTac.T.site, ctSetup:teamTac.CT&&teamTac.CT.setup&&teamTac.CT.setup.id}; REC.rounds.push(cur);
   bots.forEach(function(b){ REC.buys.push([roundNum, b.id, b.team, b.primary||'', b.secondary||'', b.armor?1:0, b.helmet?1:0, b.kit?1:0, b.nades?(b.nades.smoke+b.nades.flash+b.nades.he+b.nades.molly):0, b.money]); }); H={}; }
   rs=roundState; }
 if(roundState!=='live') continue;
 if(bomb.state==='planted' && cur && cur.plant==null){ cur.plant=tick; cur.site=bomb.site; REC.plants.push([tick, bomb.site, Math.round(bomb.x), Math.round(bomb.y)]); }

 // (v176) детекторы взгляда В8/В9/В10 — по картине команды (REACH), одинаково для любой версии
 if(tick%16===0) lookDet();
 if(tick%16===0) bots.forEach(function(b){ REC.pos.push([tick, b.id, b.team==='CT'?1:0, Math.round(b.x), Math.round(b.y), b.alive?1:0, Math.round((b.facing||0)*100)/100, b.weapon?b.weapon.key:'', b._knife?1:0]); });
 bots.forEach(function(b){ if(!b.alive){ delete H[b.id]; return; } REC.jit.alive++;
  var h=H[b.id]||(H[b.id]={p:[],f:[]}); h.p.push([b.x,b.y]); h.f.push(b.facing||0); if(h.p.length>12){h.p.shift();h.f.shift();} if(h.p.length<12) return;
  var a=h.p[0],m=h.p[5],c=h.p[11], v1x=m[0]-a[0],v1y=m[1]-a[1],v2x=c[0]-m[0],v2y=c[1]-m[1], l1=Math.hypot(v1x,v1y),l2=Math.hypot(v2x,v2y);
  if(l1>5&&l2>5&&(v1x*v2x+v1y*v2y)/(l1*l2)<-0.6){ if(b._sawEnemy) REC.jit.moveEng++; else if(!b.post) { REC.jit.moveIdle++; if(REC.jit.ev.length<200) REC.jit.ev.push(['idle',tick,b.id,Math.round(b.x),Math.round(b.y)]); } else REC.jit.moveOther++; h.p=[]; h.f=[]; return; }
  var d1=h.f[5]-h.f[0], d2=h.f[11]-h.f[5]; d1=Math.atan2(Math.sin(d1),Math.cos(d1)); d2=Math.atan2(Math.sin(d2),Math.cos(d2));
  if(!b._sawEnemy&&Math.abs(d1)>0.87&&Math.abs(d2)>0.87&&d1*d2<0){ REC.jit.look++; if(REC.jit.ev.length<200) REC.jit.ev.push(['look',tick,b.id,Math.round(b.x),Math.round(b.y),b.post?b.post.tag:'']); h.p=[]; h.f=[]; }
 });
}
REC.match=M0; REC.ticks=tick;
JSON.stringify(REC)
