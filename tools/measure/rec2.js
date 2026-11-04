// (В5) nades: [..., ls, скорость бойца в миг броска px/с, лайнап 1/0]
// один воспроизводимый матч: позиции/фраги/раунды/закуп/гранаты + детектор дёрганий каждый тик
freshMatch(__M__);
var M0=matchNum;
/*@@WATCH@@*/
var REC={rounds:[], kills:[], pos:[], plants:[], buys:[], nades:[], jit:{alive:0, look:0, moveEng:0, moveIdle:0, moveOther:0, ev:[]}}, rs=null, cur=null;
var ofk=feedKill; feedKill=function(att,vic,weap,hs){ if(typeof REC!=='undefined'&&REC.tac) REC.tac.d.push([tick, vic.id, vic.team, att?att.id:null]); REC.kills.push([tick, att?att.id:null, att?att.team:null, att?Math.round(att.x):null, att?Math.round(att.y):null, vic.id, vic.team, Math.round(vic.x), Math.round(vic.y), String(weap), hs?1:0, att&&att.weapon?att.weapon.key:null, vic.tRole||'']); return ofk.apply(this,arguments); };
var oer=endRound; endRound=function(w,reason){ if(cur){ cur.t1=tick; cur.winner=w; cur.reason=reason; cur.bomb=bomb.state; } return oer.apply(this,arguments); };
var otn=throwNade; throwNade=function(b,type,tx,ty){ var ok0=roundState==='live' && b.nades && b.nades[type]>0, x0=b.x, y0=b.y, sp0=Math.round(b.curSpeed||0), lu0=(arguments[6]||arguments[7])?1:0, ls=tick-(b.lastShotTick||-999); var res=otn.apply(this,arguments); if(ok0 && res!==false) { var nd1=nadesInAir[nadesInAir.length-1], ok1=nd1&&nd1.thrower===b&&nd1.born===tick; REC.nades.push([tick, b.team, type, b.id, (b.tRole||b.ctRole||''), Math.round(x0), Math.round(y0), Math.round(tx), Math.round(ty), ls, sp0, lu0, ok1?String(nd1.why||''):'', ok1&&nd1.plan?Math.round(nd1.plan[3]):-1, ok1?nd1.etaDet-tick:-1]); } return res; };   // (v370) только состоявшийся бросок (throwNade может отказать)
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

// (аудит 30.10) REC.task — смены задач места (арбитр 110: b._task) у живых ботов. На смену: класс —
//  react (новая важнее), end (старая кончилась: не подтверждалась, снята), swap (того же уровня, старая жива), down (ниже, старая жива —
//  арбитр так не должен), same (та же задача заново, сразу после конца); osc — качели A → B → A за 8 с (B короче 8 с).
//  n — назначений (новых задач), pr — игроко-раундов; pat — частые пары «было → стало» по классам swap / down / osc (до 40)
REC.task={n:0, pr:0, cls:{react:0, end:0, swap:0, down:0, same:0}, osc:0, oscThrow:0, oscPat:{}, pat:{}, ev:[]}; var TK={}, TKC={}, TKT={};
// снятие задачи механикой (clearPost) и состоявшийся бросок (throwNade) — перехват только для учёта (игру не меняет): снятая в тот же тик
// и заменённая задача — «кончилась», а не «понижение»; качели X → lineup → X с броском — «кинул и вернулся», считаются отдельно (oscThrow)
var ocp_=clearPost; clearPost=function(b){ if(b) TKC[b.id]=tick; return ocp_.apply(this,arguments); };
var otn_=throwNade; throwNade=function(b){ var r=otn_.apply(this,arguments); if(r!==false&&b) TKT[b.id]=tick; return r; };
// (03.11, гранаты) REC.nfail — отказы бросков (throwNade вернул false: причина NADE_FAIL) и задания гранат, снятые без броска
// (команда|тип|лайнап|причина → число): почему флешек CT стало меньше (прогоны 143–145). Только учёт — игру не меняет
REC.nfail={fail:{}, gone:{}}; var NFT={};
var otnF=throwNade; throwNade=function(b,type){ var had=roundState==='live'&&b&&b.nades&&b.nades[type]>0, r=otnF.apply(this,arguments);
  if(had&&r===false){ var k=b.team+'|'+type+'|'+((arguments[6]||arguments[7])?1:0)+'|'+String(typeof NADE_FAIL!=='undefined'?NADE_FAIL:'?'); REC.nfail.fail[k]=(REC.nfail.fail[k]||0)+1;
    if(/долетит/.test(String(NADE_FAIL))){ var tk=b.nadeTask; if(!REC.nfail.x) REC.nfail.x=[]; if(REC.nfail.x.length<4000) REC.nfail.x.push([tick,b.team,type,(arguments[6]||arguments[7])?1:0,Math.round(b.x),Math.round(b.y),Math.round(b.z!=null?b.z:-99999),Math.round(arguments[2]),Math.round(arguments[3]),String(arguments[5]||(tk&&tk.why)||''),b.crouching?1:0,Math.round(b.curSpeed||0)]); } } return r; };   // (03.11) отказы «не долетит»: место, цель, причина
// жива ли прошлая задача — только чтение (taskKeepUntil меняет состояние бота — сторож игру не трогает): подтверждалась ≤ TASK_STALE или держит
// свой замок (контакт, перестановка, размен, подмена)
function tkKeep(b, tag){ tag=String(tag); if(/^contact/.test(tag)) return b._contact&&b._contact.lock?b._contact.until:0; if(/^repos/.test(tag)) return b._reposUntil||0;
  if(/^tradeR/.test(tag)) return b._tradeLock?b._tradeLock.until:0; if(/^fill/.test(tag)) return b._fillLock?b._fillLock.until:0; return 0; }
function tkCls(b, P, T){ if(!P) return null; var alive=!P.cleared&&((tick-P.t<=TASK_STALE)||(tick<tkKeep(b,P.tag))); if(P.tb===T.tb) return 'same'; if(T.lv>P.lv) return 'react'; if(!alive) return 'end'; return T.lv===P.lv?'swap':'down'; }
var H={};
// (v262) К4: ротация CT — кто на какой сайт идёт по колу (ct.rot); разворот = сайт сменился (A→B) или сняли и снова
// послали на тот же в одном раунде; «бросили» = сняли с ротации без планта/смерти/конца раунда. К5: бомбу выбили
// (носитель погиб) — кто через 5 с её держит взглядом, сколько CT ближе 900 px, куда колл.
REC.rotx={n:0, rev:0, back:0, drop:0, ev:[]}; REC.bd=[]; var RX={}, BD=null, BS0=null;
// (04.11, проверка гранат по просьбе владельца) только учёт, игру не меняет:
//  REC.gx.exec — выход T: [раунд, тик выхода, критичных смоков: готов / ждали / провал, ждёт ли exuGate]
//  REC.gx.molly — враги в огне в миг разрыва молотова: [раунд, команда бросившего, id, вышел через тиков (-1 — погиб в огне, -2 — не вышел до конца огня)]
//  REC.gx.react — вражеская граната, которую видел хоть один боец: [раунд, тип, сколько видели, ответная граната ≤ 5 с, смена поста ≤ 3 с, отошёл ≥ 60 px ≤ 3 с]
REC.gx={exec:[],molly:[],react:[]}; var GXR=null, GXT=[], GXM=[], GXE=null;
var odetGX=detonate; detonate=function(n){
  var r=odetGX.apply(this,arguments);
  try{ if(roundState==='live' && n && n.type!=='decoy'){
    var foes=bots.filter(function(o){ return o.alive && o.team!==n.team; });
    if(n.type==='molly'){ var fr=fires[fires.length-1]; if(fr && fr.born===tick) foes.forEach(function(o){ if(inFire(o.x,o.y)) GXM.push({o:o,t0:tick,f:fr,r:roundNum,team:n.team}); }); }
    var seers=foes.filter(function(o){ return hasVision(o.x,o.y,n.x,n.y); });
    if(seers.length) GXT.push({t0:tick,r:roundNum,type:n.type,seen:seers.map(function(o){ return {o:o,x:o.x,y:o.y,tag:o.post&&o.post.tag}; }),nx:n.x,ny:n.y,cn:0,pc:0,mv:0});
  } }catch(e){}
  return r; };
var othGX=throwNade; throwNade=function(b){ var had=b&&b.nades?JSON.stringify(b.nades):null, r=othGX.apply(this,arguments);
  if(r!==false && had){ GXT.forEach(function(g){ if(tick-g.t0<=5*TICK_HZ && g.seen.some(function(s){ return s.o.team===b.team; })) g.cn=1; }); } return r; };
function GX_TICK(){
  if(roundState!=='live'){ GXE=null; return; }
  var tt=teamTac&&teamTac.T;
  if(tt && tt.phase==='execute' && GXE!==roundNum){ GXE=roundNum; var E=(typeof exuCur==='function')?exuCur():null, c={ready:0,wait:0,fail:0};
    if(E) Object.keys(E.items).forEach(function(k){ var it=E.items[k]; if(!it.crit||it.site!==tt.site) return; if(it.state==='ready') c.ready++; else if(it.state==='failed'||it.state==='void') c.fail++; else c.wait++; });
    REC.gx.exec.push([roundNum,tick,c.ready,c.wait,c.fail,(typeof exuGate==='function'&&!exuGate(tt).go)?1:0]); }
  GXM=GXM.filter(function(m){ var o=m.o;
    if(!o.alive){ REC.gx.molly.push([m.r,m.team,o.id,-1]); return false; }
    if(!inFire(o.x,o.y)){ REC.gx.molly.push([m.r,m.team,o.id,tick-m.t0]); return false; }
    if(tick>m.f.until||m.r!==roundNum){ REC.gx.molly.push([m.r,m.team,o.id,-2]); return false; } return true; });
  GXT=GXT.filter(function(g){
    if(tick-g.t0<=3*TICK_HZ) g.seen.forEach(function(s){ var o=s.o; if(!o.alive) return; if((o.post&&o.post.tag)!==s.tag) g.pc=1; if(Math.hypot(o.x-g.nx,o.y-g.ny)-Math.hypot(s.x-g.nx,s.y-g.ny)>=60) g.mv=1; });
    if(tick-g.t0>5*TICK_HZ||g.r!==roundNum){ REC.gx.react.push([g.r,g.type,g.seen.length,g.cn,g.pc,g.mv]); return false; } return true; });
}
// (04.11) перед каждым «переносом» (PROB nav) — последние 6 тиков бойца: база, видимая позиция, высота, состояние, путь, подъём. Только учёт
REC.navx=[]; var NAVH={}, NAVN=0;
function NAVH_TICK(){ if(typeof PROB==='undefined'||!PROB.n) return;
  bots.forEach(function(b){ if(!b.alive) return; var h=NAVH[b.id]||(NAVH[b.id]=[]); var wp=b.path&&b.path[b.pathIdx];
    h.push([tick,Math.round(b.baseX*10)/10,Math.round(b.baseY*10)/10,Math.round(b.x*10)/10,Math.round(b.y*10)/10,Math.round(b.z||0),b.state,b.walking?1:0,b.crouching?1:0,wp?[Math.round(wp.x),Math.round(wp.y)]:null,b._climb?1:0,b.holding?1:0,Math.round(b.curSpeed||0)]); if(h.length>6) h.shift(); });
  if(PROB.n.nav>NAVN){ var k=PROB.n.nav-NAVN; NAVN=PROB.n.nav; for(var i=PROB.ev.length-1;i>=0&&k>0;i--){ var e=PROB.ev[i]; if(e.kind!=='nav'||e.tick!==tick) continue; k--; if(REC.navx.length<800) REC.navx.push({e:[e.tick,e.id,e.text,e.x,e.y,e.round],h:(NAVH[e.id]||[]).slice()}); } }
  else if(PROB.n.nav<NAVN) NAVN=PROB.n.nav;
}
for(var t=0;t<__T__;t++){ stepTick(); if(typeof WATCH!=='undefined') WATCH.tick();
 NAVH_TICK(); GX_TICK();
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
   // (аудит 30.10) оценка T: ожидаемое число CT у сайта по знанию команды (beliefCount по зонам у сайта — гипотезы: видели, слышали, убили,
   // проверили) и свежая инфа T о CT у сайта за 8 с (intelEstimate: видели + слышали); сторож только читает
   var bel=(typeof beliefCount==='function'&&BZ.siteNear)?+beliefCount('T',BZ.siteNear[k]||[]).toFixed(2):null;
   var fr=typeof intelEstimate==='function'?intelEstimate('T',SITES[k].x,SITES[k].y,600,8*TICK_HZ):null;
   // ожидание CT на сайте по расстановкам про, совместимым с увиденным (knowSetupRead — только до 40-й с и при 5 живых CT); CT, которых T
   // свежо (≤ 8 с) видели в другом месте (дальше 900 от сайта), и сколько CT мертво — для оценки «насколько защищён» (калибровка)
   var SR=typeof knowSetupRead==='function'?knowSetupRead('T'):null, BLT=(typeof beliefLast!=='undefined'&&beliefLast.T)||{}, away=0;
   for(var eid in BLT){ var q=BLT[eid], ob=bots.filter(function(o){return o.id===eid&&o.alive;})[0]; if(ob&&tick-q.tick<=8*TICK_HZ&&Math.hypot(q.x-SITES[k].x,q.y-SITES[k].y)>900) away++; }
   TA.sc.push([tick,k,truth,ages,near,bel,fr?fr.seen+fr.heard:null,aliveCount('CT'),aliveCount('T'),SR?+SR.E[k].toFixed(2):null,away,Math.round((tick-roundStartTick)/TICK_HZ)]); });
 })();
 if(roundState==='live'){ bots.forEach(function(b){ var t0=NFT[b.id], t=b.alive?b.nadeTask:null;
   if(t0&&t0.t!==t&&TKT[b.id]!==tick&&t0.r===roundNum){ var why=!b.alive?'погиб':tick>t0.t.until?'срок':(b.nades&&b.nades[t0.t.type]<=0)?'нет гранаты':'снято';
     var k=b.team+'|'+t0.t.type+'|'+(t0.t.from?1:0)+'|'+why; REC.nfail.gone[k]=(REC.nfail.gone[k]||0)+1; }
   NFT[b.id]=t?{t:t, r:roundNum}:null; }); }
 (function(){ if(typeof taskLevel!=='function') return; var RT=REC.task;
  if(TK.r!==roundNum){ TK={r:roundNum, b:{}}; RT.pr+=bots.length; }
  bots.forEach(function(b){ if(!b.alive) return; var T=b._task, S=TK.b[b.id]||(TK.b[b.id]={k:null,P:null,h:[]});
   if(!T||T.round!==roundNum){ if(S.P) S.P.cleared=true; return; }   // задачу сняли (clearPost) — прошлая кончилась
   if(S.P&&TKC[b.id]>=S.P.seen) S.P.cleared=true;   // снята и заменена в один тик
   var k=T.tb+'|'+T.t0;
   if(S.k===k&&!(S.P&&S.P.cleared)){ S.P={tb:T.tb,lv:T.lv,t:T.t,tag:T.tag,t0:T.t0,seen:tick}; return; }
   RT.n++; var c=tkCls(b, S.P, T);
   if(c){ RT.cls[c]++; if(c==='swap'||c==='down'){ var pk=c+': '+S.P.tb+' → '+T.tb; RT.pat[pk]=(RT.pat[pk]||0)+1; if(RT.ev.length<300) RT.ev.push([tick,b.id,c,S.P.tb,T.tb,Math.round(b.x),Math.round(b.y)]); } }
   S.h.push([T.tb, tick]); if(S.h.length>3) S.h.shift();
   if(S.h.length===3 && S.h[0][0]===S.h[2][0] && S.h[1][0]!==S.h[0][0] && S.h[2][1]-S.h[1][1]<8*64 && S.h[2][1]-S.h[0][1]<16*64){ var thr=S.h[1][0]==='lineup'&&TKT[b.id]>=S.h[1][1]; if(thr) RT.oscThrow++; else { RT.osc++; var ok=S.h[0][0]+' → '+S.h[1][0]+' → '+S.h[0][0]; RT.oscPat[ok]=(RT.oscPat[ok]||0)+1; } }
   S.k=k; S.P={tb:T.tb,lv:T.lv,t:T.t,tag:T.tag,t0:T.t0,seen:tick}; });
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
