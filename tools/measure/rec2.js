// (В5) nades: [..., ls, скорость бойца в миг броска px/с, лайнап 1/0]
// один воспроизводимый матч: позиции/фраги/раунды/закуп/гранаты + детектор дёрганий каждый тик
freshMatch(__M__);
var M0=matchNum;
/*@@WATCH@@*/
var REC={rounds:[], kills:[], pos:[], plants:[], buys:[], nades:[], jit:{alive:0, look:0, moveEng:0, moveIdle:0, moveOther:0, ev:[]}}, rs=null, cur=null;
var ofk=feedKill; feedKill=function(att,vic,weap,hs){ if(typeof REC!=='undefined'&&REC.tac) REC.tac.d.push([tick, vic.id, vic.team, att?att.id:null]); REC.kills.push([tick, att?att.id:null, att?att.team:null, att?Math.round(att.x):null, att?Math.round(att.y):null, vic.id, vic.team, Math.round(vic.x), Math.round(vic.y), String(weap), hs?1:0, att&&att.weapon?att.weapon.key:null, vic.tRole||'']); return ofk.apply(this,arguments); };
var oer=endRound; endRound=function(w,reason){ if(cur){ cur.t1=tick; cur.winner=w; cur.reason=reason; cur.bomb=bomb.state; } return oer.apply(this,arguments); };
var otn=throwNade; throwNade=function(b,type,tx,ty){ var ok0=roundState==='live' && b.nades && b.nades[type]>0, x0=b.x, y0=b.y, sp0=Math.round(b.curSpeed||0), lu0=(arguments[6]||arguments[7])?1:0, ls=tick-(b.lastShotTick||-999); var res=otn.apply(this,arguments); if(ok0 && res!==false) REC.nades.push([tick, b.team, type, b.id, (b.tRole||b.ctRole||''), Math.round(x0), Math.round(y0), Math.round(tx), Math.round(ty), ls, sp0, lu0]); return res; };   // (v370) только состоявшийся бросок (throwNade может отказать)
// (v181) стрельба: каждый выстрел пулей — тик, стрелок, команда, оружие, дистанция, цель,
// сколько тиков враг уже виден, скорость стрелка (одинаково для любой версии)
REC.shots=[]; var ots=tryShoot; tryShoot=function(sh,tg,dist){ var a0=sh.ammo, l0=sh.lastShotTick; var r=ots.apply(this,arguments); if(roundState==='live' && (sh.ammo<a0 || sh.lastShotTick!==l0)) REC.shots.push([tick, sh.id, sh.team, sh.weapon?sh.weapon.key:'', Math.round(dist), tg.id, sh.contactStreak|0, Math.round(sh.curSpeed||0), sh._smokeShot?1:0, sh._prep?sh._prep.src:'']); return r; };
// гранатные детекторы: где разорвалась и стрелял ли рядом враг бросавшего за последнюю секунду
// (30.10) det: + z разрыва, первое касание [x, y, z, вид], куда целился [x, y], ошибка подбора e3; roof — граната легла на крышу (без действия)
REC.roof=[]; var oor=nadeOrigin; nadeOrigin=function(n){ if(roundState==='live' && n.onRoof) REC.roof.push([tick, n.team, n.type, Math.round(n.x), Math.round(n.y), n.thrower?n.thrower.id:'']); return oor.apply(this,arguments); };
REC.det=[]; var odt=detonate; detonate=function(n){ if(roundState==='live'){ var sh=0; bots.forEach(function(o){ if(o.alive && o.team!==n.team && Math.hypot(o.x-n.x,o.y-n.y)<400 && tick-(o.lastShotTick||-999)<=64) sh++; }); var f0=n.bounces&&n.bounces[0], R0=f0&&typeof m3Radar==='function'?m3Radar(m3(),f0[0],f0[1]):null; REC.det.push([tick, n.team, n.type, Math.round(n.x), Math.round(n.y), sh, n.thrower?n.thrower.id:'', String(n.why||''), n.z!=null?Math.round(n.z):null, R0?[Math.round(R0[0]),Math.round(R0[1]),Math.round(f0[2]),f0[3]]:null, n.aimX!=null?[Math.round(n.aimX),Math.round(n.aimY)]:(n.tx!=null?[Math.round(n.tx),Math.round(n.ty)]:null), n.plan?Math.round(n.plan[3]):null]); } return odt.apply(this,arguments); };

// (тактика 30.10) REC.tac — выход T, коллы и ротации CT, «сайт пуст», дефуз и байт-пики; для любой версии игры (typeof-проверки).
//  ex: [r, тик выхода, сайт]; on: [r, тик первого T на сайте, сайт]; call: [тик, сайт, счёт, видели, гранат, некому держать];
//  rot: [тик, кто, сайт]; sc: [тик, сайт, CT на сайте по факту, возраст проверки 9 главных точек CT (с, −1 — не проверялась),
//  проверенных зон в 750 за 8 / 12 / 20 с]; dv: [тик, команда, ключ войса, кто, текст]; fk: [тик, текст] — фейк-дефуз / дефуз; d: [тик, жертва, команда, убийца]
REC.tac={ex:[], on:[], call:[], rot:[], sc:[], dv:[], fk:[], d:[]}; var TACR={};
var ovl_=voiceLog; voiceLog=function(team,key,who,text){ if(roundState==='live' && /^(bait|dfreal|dffake|antidef|deflate|clrreb|exreb|reb|rot)/.test(String(key))) REC.tac.dv.push([tick, team, String(key).replace(/\d+$/,''), who, String(text).slice(0,60)]); return ovl_.apply(this,arguments); };
var olg_=logEvent; logEvent=function(s){ if(roundState==='live' && /фейк-дефуз|дефузит/.test(String(s))) REC.tac.fk.push([tick, String(s).slice(0,40)]); return olg_.apply(this,arguments); };
var H={};
// (v262) К4: ротация CT — кто на какой сайт идёт по колу (ct.rot); разворот = сайт сменился (A→B) или сняли и снова
// послали на тот же в одном раунде; «бросили» = сняли с ротации без планта/смерти/конца раунда. К5: бомбу выбили
// (носитель погиб) — кто через 5 с её держит взглядом, сколько CT ближе 900 px, куда колл.
REC.rotx={n:0, rev:0, back:0, drop:0, ev:[]}; REC.bd=[]; var RX={}, BD=null, BS0=null;
for(var t=0;t<__T__;t++){ stepTick(); if(typeof WATCH!=='undefined') WATCH.tick();
 if(matchNum!==M0) break;
 if(roundState!==rs){ if(roundState==='live'){ cur={r:roundNum, t0:tick, ctType:teamEco.CT.roundType, tType:teamEco.T.roundType, tac:(typeof teamTac!=='undefined'&&teamTac.T&&teamTac.T.tac)?teamTac.T.tac.id:null, tsite:(typeof teamTac!=='undefined'&&teamTac.T)?teamTac.T.site:null, ctSetup:(typeof teamTac!=='undefined'&&teamTac.CT&&teamTac.CT.setup)?teamTac.CT.setup.id:null}; REC.rounds.push(cur);
   bots.forEach(function(b){ REC.buys.push([roundNum, b.id, b.team, b.primary||'', b.secondary||'', b.armor?1:0, b.helmet?1:0, b.kit?1:0, b.nades?(b.nades.smoke+b.nades.flash+b.nades.he+b.nades.molly):0, b.money]); }); H={}; }
   rs=roundState; }
 if(roundState!=='live'){ RX={}; BD=null; BS0=null; continue; }
 (function(){ var ct=teamTac.CT, pl=bomb.state==='planted';
  bots.forEach(function(b){ if(b.team!=='CT') return; var r=RX[b.id]||(RX[b.id]={cur:null, seen:{}});
   if(!b.alive||pl){ r.cur=null; return; }
   var c=(ct.rot&&ct.rot[b.id]&&ct.call)?ct.call.site:null; if(c===r.cur) return;
   if(c){ REC.rotx.n++; if(r.cur&&r.cur!==c){ REC.rotx.rev++; if(REC.rotx.ev.length<60) REC.rotx.ev.push([tick,b.id,r.cur,c]); } else if(!r.cur&&r.seen[c]){ REC.rotx.back++; if(REC.rotx.ev.length<60) REC.rotx.ev.push([tick,b.id,'-',c]); } r.seen[c]=1; }
   else REC.rotx.drop++;
   r.cur=c; });
  var dd=bomb.state==='dropped'&&bots.some(function(o){ return o.team==='T'&&!o.alive&&Math.hypot(o.x-bomb.x,o.y-bomb.y)<20; });
  if(dd&&!BD){ BD={t0:tick, r:roundNum, x:Math.round(bomb.x), y:Math.round(bomb.y), place:String(calloutName(bomb.x,bomb.y)||''), call0:ct.call?ct.call.site:null}; REC.bd.push(BD); }
  if(BD&&BD.t5==null&&tick-BD.t0>=320){ var cts=bots.filter(function(o){ return o.team==='CT'&&o.alive; });
   BD.t5=tick; BD.state5=bomb.state; BD.call5=ct.call?ct.call.site:null; BD.watch=(ct.bombWatch&&ct.bombWatch.id)?ct.bombWatch.id:null;
   BD.eyes=cts.filter(function(o){ return Math.hypot(o.x-BD.x,o.y-BD.y)<1000&&hasVision(o.x,o.y,BD.x,BD.y); }).length;
   BD.near=cts.filter(function(o){ return Math.hypot(o.x-BD.x,o.y-BD.y)<900; }).length; BD.cts=cts.length;
   BD.dist=cts.map(function(o){ return Math.round(Math.hypot(o.x-BD.x,o.y-BD.y)); }).sort(function(a,c){ return a-c; }); }
  if(BD&&BD.pick==null&&bomb.state==='carried') BD.pick=tick-BD.t0;
 })();
 if(bomb.state==='planted' && cur && cur.plant==null){ cur.plant=tick; cur.site=bomb.site; REC.plants.push([tick, bomb.site, Math.round(bomb.x), Math.round(bomb.y)]); }

 (function(){ if(typeof teamTac==='undefined') return; var tt=teamTac.T, ct=teamTac.CT, TA=REC.tac;
  if(TACR.r!==roundNum) TACR={r:roundNum};
  if(tt&&tt.phase==='execute'&&TACR.ex==null){ TACR.ex=tick; TA.ex.push([roundNum,tick,tt.site]); }
  if(tt&&TACR.on==null&&SITES[tt.site]&&bots.some(function(b){ return b.team==='T'&&b.alive&&onSite(SITES[tt.site],b.x,b.y); })){ TACR.on=tick; TA.on.push([roundNum,tick,tt.site]); }
  var c=ct&&ct.call; var ck=c?c.site+'|'+Math.round(c.count*2)+'|'+(c.seen||0)+'|'+(c.nades||0)+'|'+(c.undefended?1:0):''; if(ck!==TACR.ck){ TACR.ck=ck; if(c) TA.call.push([tick,c.site,+c.count.toFixed(1),c.seen||0,c.nades||0,c.undefended?1:0]); }
  if(ct&&ct.go&&ct.go.ids){ for(var id in ct.go.ids){ var kk=id+ct.go.site; if(!TACR['g'+kk]){ TACR['g'+kk]=1; TA.rot.push([tick,id,ct.go.site]); } } }
  if(tick%64===0&&bomb.state!=='planted'&&typeof CLEARZ!=='undefined'&&typeof POS!=='undefined') ['A','B'].forEach(function(k){
   var P=POS[k], names=((P&&P.ctHold)||[]).slice(0,9), zs={}; names.forEach(function(nm){ var zp=zonePoint(nm,SITES[k]), z=zp?zoneIdAt(zp.x,zp.y):null; if(z) zs[z]=1; });
   var truth=bots.filter(function(o){ return o.team==='CT'&&o.alive&&(zs[zoneIdAt(o.x,o.y)]||Math.hypot(o.x-SITES[k].x,o.y-SITES[k].y)<750); }).length;
   var ages=names.map(function(nm){ var zp=zonePoint(nm,SITES[k]), z=zp?zoneIdAt(zp.x,zp.y):null, C=z?CLEARZ.T[z]:null; return C?Math.round((tick-C.tick)/TICK_HZ):-1; });
   var near=[8,12,20].map(function(F){ var n=0; for(var zc in CLEARZ.T){ var Cz=CLEARZ.T[zc]; if(Cz&&tick-Cz.tick<F*TICK_HZ&&Math.hypot(Cz.x-SITES[k].x,Cz.y-SITES[k].y)<750) n++; } return n; });
   TA.sc.push([tick,k,truth,ages,near]); });
 })();
 if(tick%16===0){ REC.hp=REC.hp||[]; bots.forEach(function(b){ if(b.alive) REC.hp.push([tick, b.id, b.hp]); }); }   // (v373) HP — для сравнения раскладов с про
 if(tick%16===0) bots.forEach(function(b){ REC.pos.push([tick, b.id, b.team==='CT'?1:0, Math.round(b.x), Math.round(b.y), b.alive?1:0, Math.round((b.facing||0)*100)/100, b.weapon?b.weapon.key:'', b._knife?1:0]); });
 bots.forEach(function(b){ if(!b.alive){ delete H[b.id]; return; } REC.jit.alive++;
  var h=H[b.id]||(H[b.id]={p:[],f:[]}); h.p.push([b.x,b.y]); h.f.push(b.facing||0); if(h.p.length>12){h.p.shift();h.f.shift();} if(h.p.length<12) return;
  var a=h.p[0],m=h.p[5],c=h.p[11], v1x=m[0]-a[0],v1y=m[1]-a[1],v2x=c[0]-m[0],v2y=c[1]-m[1], l1=Math.hypot(v1x,v1y),l2=Math.hypot(v2x,v2y);
  if(l1>5&&l2>5&&(v1x*v2x+v1y*v2y)/(l1*l2)<-0.6){ if(b._sawEnemy) REC.jit.moveEng++; else if(!b.post) { REC.jit.moveIdle++; if(REC.jit.ev.length<200) REC.jit.ev.push(['idle',tick,b.id,Math.round(b.x),Math.round(b.y)]); } else REC.jit.moveOther++; h.p=[]; h.f=[]; return; }
  var d1=h.f[5]-h.f[0], d2=h.f[11]-h.f[5]; d1=Math.atan2(Math.sin(d1),Math.cos(d1)); d2=Math.atan2(Math.sin(d2),Math.cos(d2));
  if(!b._sawEnemy&&Math.abs(d1)>0.87&&Math.abs(d2)>0.87&&d1*d2<0){ REC.jit.look++; if(REC.jit.ev.length<200) REC.jit.ev.push(['look',tick,b.id,Math.round(b.x),Math.round(b.y),b.post?b.post.tag:'']); h.p=[]; h.f=[]; }
 });
}
if(typeof WATCH!=='undefined') REC.watch=WATCH.report();
REC.match=M0; REC.ticks=tick; if(typeof VOICE_STATS!=='undefined') REC.voice=VOICE_STATS;
JSON.stringify(REC)
