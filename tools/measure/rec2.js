// (В5) nades: [..., ls, скорость бойца в миг броска px/с, лайнап 1/0]
// один воспроизводимый матч: позиции/фраги/раунды/закуп/гранаты + детектор дёрганий каждый тик
// (05.11, план «ускорение проверок») снимки раундов: /*@@SNAPS@@*/ → walk_run.py вставляет SNAP_ON = 1 (базовый прогон пишет REC.snaps —
// снимок в конце каждого раунда, на границе тика, из него новая версия переигрывает следующий раунд с закупкой); при переигровке
// строка «freshMatch» заменяется восстановлением снимка. В снимке — только то, что изменилось с загрузки страницы (постоянные таблицы
// кода — из новой версии), без точных кэшей (WPM, ZDJ, KPC — их содержимое не меняет результат) и без отметок (MK*)
var SNAP_ON = 0, SNAP_S0 = {}, SNAP_SKIP = /^(WPM|ZDJ|KPC|MK.*)$/, SNAP_NEXT = 0;
/*@@SNAPS@@*/
if(SNAP_ON) mkSnapList().forEach(function(e){ if(SNAP_SKIP.test(e[0])) return; try{ SNAP_S0[e[0]] = mkPack(e[1]()); }catch(x){} });
function snapTake(){ var o = {}; mkSnapList().forEach(function(e){ if(SNAP_SKIP.test(e[0])) return; var v = e[1](), s; try{ s = mkPack(v); }catch(x){ return; } if(s !== SNAP_S0[e[0]]) o[e[0]] = v; }); return mkPack(o); }
var R_END = 0;
freshMatch(__M__);
var M0=matchNum;
/*@@WATCH@@*/
var REC={rounds:[], kills:[], pos:[], plants:[], buys:[], nades:[], jit:{alive:0, look:0, moveEng:0, moveIdle:0, moveOther:0, ev:[]}}, rs=null, cur=null;
var ofk=feedKill; feedKill=function(att,vic,weap,hs){ REC.kills.push([tick, att?att.id:null, att?att.team:null, att?Math.round(att.x):null, att?Math.round(att.y):null, vic.id, vic.team, Math.round(vic.x), Math.round(vic.y), String(weap), hs?1:0, att&&att.weapon?att.weapon.key:null, vic.tRole||'']); return ofk.apply(this,arguments); };
var oer=endRound; endRound=function(w,reason){ if(SNAP_ON) SNAP_NEXT = roundNum + 1; if(cur){ cur.t1=tick; cur.winner=w; cur.reason=reason; cur.bomb=bomb.state; } return oer.apply(this,arguments); };
var otn=throwNade; throwNade=function(b,type,tx,ty){ var ok0=roundState==='live' && b.nades && b.nades[type]>0, x0=b.x, y0=b.y, sp0=Math.round(b.curSpeed||0), lu0=(arguments[6]||arguments[7])?1:0, ls=tick-(b.lastShotTick||-999); var res=otn.apply(this,arguments); if(ok0 && res!==false) REC.nades.push([tick, b.team, type, b.id, (b.tRole||b.ctRole||''), Math.round(x0), Math.round(y0), Math.round(tx), Math.round(ty), ls, sp0, lu0]); return res; };   // (v370) только состоявшийся бросок (throwNade может отказать)
// (v181) стрельба: каждый выстрел пулей — тик, стрелок, команда, оружие, дистанция, цель,
// сколько тиков враг уже виден, скорость стрелка (одинаково для любой версии)
REC.shots=[]; var ots=tryShoot; tryShoot=function(sh,tg,dist){ var a0=sh.ammo, l0=sh.lastShotTick; var r=ots.apply(this,arguments); if(roundState==='live' && (sh.ammo<a0 || sh.lastShotTick!==l0)) REC.shots.push([tick, sh.id, sh.team, sh.weapon?sh.weapon.key:'', Math.round(dist), tg.id, sh.contactStreak|0, Math.round(sh.curSpeed||0), sh._smokeShot?1:0, sh._prep?sh._prep.src:'']); return r; };
// гранатные детекторы: где разорвалась и стрелял ли рядом враг бросавшего за последнюю секунду
REC.det=[]; var odt=detonate; detonate=function(n){ if(roundState==='live'){ var sh=0; bots.forEach(function(o){ if(o.alive && o.team!==n.team && Math.hypot(o.x-n.x,o.y-n.y)<400 && tick-(o.lastShotTick||-999)<=64) sh++; }); REC.det.push([tick, n.team, n.type, Math.round(n.x), Math.round(n.y), sh, n.thrower?n.thrower.id:'', String(n.why||'')]); } return odt.apply(this,arguments); };
var H={};
// (05.11, владелец: «за один прогон записать всё, потом выбирать ситуации») полная запись для разборов — только наблюдает:
// dmg — каждый урон [тик, кто, команда, кому, урон, источник, HP жертвы после]; see — каждое новое появление врага в поле зрения
// [тик, кто видит, кого, дистанция px]; act — каждые 32 тика у живого [тик, бот, задача, решение боя, фаза цикла перестрелки,
// ослеплён 1/0, сидит 1/0, на посту 1/0]; в раунде — план IGL, начало выхода
REC.dmg=[]; REC.see=[]; REC.act=[]; var SEEN={};
// (05.11, замечания владельца Д1–Д5) fc — смена фазы цикла перестрелки [тик, бот, было, стало, враг, дист px, враг жив 1/0, видит врага 1/0,
// HP]; task — смена задачи [тик, бот, задача]; voice — каждая показанная реплика войса [тик, команда, кто, текст, вид]; slow — тик дольше
// 25 мс [тик, мс, гранат в полёте, у скольких задание гранаты, задание у кого (тип)]; exu — события смоков выхода (366)
REC.fc=[]; REC.task=[]; REC.voice=[]; REC.slow=[]; REC.exu=[]; var FCP={}, TKP={};
// duel — строки журнала игры о решениях в бою (почему ушёл с линии / держит / отходит / атакует, союзников рядом, врагов видит) [тик, текст]
REC.duel=[]; var DUEL_RE=/укрыт|с линии|в плечо|выгляд|держ|отход|отступ|атак|дуэл|пик|размен|добив|сближ|не лезет/;
if(typeof logEvent==='function'){ var olg=logEvent; logEvent=function(text){ if(roundState==='live' && REC.duel.length<40000 && DUEL_RE.test(String(text))) REC.duel.push([tick, String(text).slice(0,200)]); return olg.apply(this,arguments); }; }
if(SNAP_ON){ REC.snaps = {}; }
if(typeof voiceFeed==='function'){ var ovf=voiceFeed; voiceFeed=function(team,who,text,kind){ if(roundState==='live') REC.voice.push([tick, team, who||'', String(text), kind||'']); return ovf.apply(this,arguments); }; }
if(typeof exuEv==='function'){ var oex=exuEv; exuEv=function(kind,it,extra){ var r=oex.apply(this,arguments); REC.exu.push([tick, kind, it?it.id:null, it?it.owner:null, it?!!it.crit:null, it?it.site:null, it&&it.x!=null?Math.round(it.x):null, it&&it.y!=null?Math.round(it.y):null, extra?JSON.stringify(extra).slice(0,160):'']); return r; }; }
var oad=applyDamage; applyDamage=function(att,b,dmg,src){ var h0=b?b.hp:0; var r=oad.apply(this,arguments); if(roundState==='live'&&b) REC.dmg.push([tick, att?att.id:null, att?att.team:null, b.id, Math.round(Math.min(h0,dmg)), String(src||''), Math.max(0,Math.round(b.hp))]); return r; };
// (v262) К4: ротация CT — кто на какой сайт идёт по колу (ct.rot); разворот = сайт сменился (A→B) или сняли и снова
// послали на тот же в одном раунде; «бросили» = сняли с ротации без планта/смерти/конца раунда. К5: бомбу выбили
// (носитель погиб) — кто через 5 с её держит взглядом, сколько CT ближе 900 px, куда колл.
// (v518, пак владельца 09.11, шаг 0 — чего не было в записи) jump — прыжок / спрыг бота [тик, бот, x, y, z, вверх 1/0, на месте (удержание) 1/0, задача];
// arrive — «дошёл до поста» с высотой не своего пола [тик, бот, задача, z бота, верхний пол у точки поста]; defst — начал дефуз [тик, кто, назначен ретейком];
// recall — смена сайта T [тик, с, на, кто вызвал (функция)]; pick — подбор оружия [тик, текст]; he — урон HE [тик, жертва, 3D-линия от точки разрыва 1/0];
// blind — ослепление [тик, кто, секунд, чья флешка]
REC.jump=[]; REC.arrive=[]; REC.defst=[]; REC.recall=[]; REC.pick=[]; REC.he=[]; REC.blind=[]; var ATP={}, DFP={}, BLP={};
if(typeof tSetSite==='function'){ var oss=tSetSite; tSetSite=function(tt,site){ var old=tt&&tt.site; if(roundState==='live'&&old&&site&&old!==site){ var st=String(new Error().stack||'').split('\n')[2]||''; REC.recall.push([tick, old, site, (st.match(/at (\w+)/)||[])[1]||'?']); } return oss.apply(this,arguments); }; }
if(typeof logEvent==='function'){ var olp=logEvent; logEvent=function(text){ if(roundState==='live'&&/подобрал/.test(String(text))&&REC.pick.length<5000) REC.pick.push([tick, String(text).slice(0,120)]); return olp.apply(this,arguments); }; }
var odh=detonate; detonate=function(n){ if(roundState==='live'&&n&&n.type==='he'&&typeof visLine==='function'){ bots.forEach(function(b){ if(!b.alive||Math.hypot(b.x-n.x,b.y-n.y)>NADE.he.radius) return; if(!hasLOS(n.x,n.y,b.x,b.y,null,b.z)) return;
  var l3=visLine(n.x,n.y,n.z,b.x,b.y,visFloorAt(b.x,b.y,b.z)+VIS_EYE.crouch,false)?1:0; REC.he.push([tick, b.id, l3]); }); } return odh.apply(this,arguments); };
REC.rotx={n:0, rev:0, back:0, drop:0, ev:[]}; REC.bd=[]; var RX={}, BD=null, BS0=null;
for(var t=0;t<__T__;t++){ var _t0=performance.now(); stepTick(); var _dt=performance.now()-_t0; if(_dt>25 && roundState==='live'){ var _nt=bots.filter(function(b){return b.alive&&b.nadeTask;}); REC.slow.push([tick, Math.round(_dt), (typeof nadesInAir!=='undefined'&&nadesInAir.length)||0, _nt.length, _nt.map(function(b){return b.id+':'+b.nadeTask.type;}).join(' ')]); } if(typeof WATCH!=='undefined') WATCH.tick();
 if(SNAP_NEXT && matchNum===M0){ REC.snaps[SNAP_NEXT] = {t:tick, s:snapTake()}; SNAP_NEXT = 0; }
 if(R_END && roundNum > R_END) break;
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

 if(roundState==='live') bots.forEach(function(b){ var V=b.alive?(b._visible||[]):[], now={}; V.forEach(function(v){ now[v.id]=1; if(!(SEEN[b.id]||{})[v.id]) REC.see.push([tick, b.id, v.id, Math.round(Math.hypot(v.x-b.x,v.y-b.y))]); }); SEEN[b.id]=now; });
 if(roundState==='live') bots.forEach(function(b){ var ph=b.alive&&b._fc?b._fc.ph:''; if((FCP[b.id]||'')!==ph){ var e=b._fc&&b._fc.e; REC.fc.push([tick, b.id, FCP[b.id]||'', ph, e?e.id:'', e?Math.round(Math.hypot(e.x-b.x,e.y-b.y)):0, e&&e.alive?1:0, b._sawEnemy?1:0, Math.round(b.hp)]); FCP[b.id]=ph; }
   var tg=b.alive&&b.post?String(b.post.tag):''; if((TKP[b.id]||'')!==tg){ REC.task.push([tick, b.id, tg]); TKP[b.id]=tg; } });
 if(roundState==='live') bots.forEach(function(b){ if(!b.alive) return;
   if(b._jump&&b._jump.t===tick&&REC.jump.length<20000) REC.jump.push([tick, b.id, Math.round(b.x), Math.round(b.y), Math.round(b.z||0), b._jump.up?1:0, b._jc?1:0, b.post?String(b.post.tag):'']);
   if(b.atPost&&!ATP[b.id]&&b.post&&b.z!=null){ var fz=visFloorAt(b.post.x,b.post.y,null); if(Math.abs(fz-b.z)>40) REC.arrive.push([tick, b.id, String(b.post.tag), Math.round(b.z), Math.round(fz)]); } ATP[b.id]=!!b.atPost;
   if(b.defusing&&!DFP[b.id]) REC.defst.push([tick, b.id, (bomb.retake&&bomb.retake.defId)||'']); DFP[b.id]=!!b.defusing;
   var bu=b.blindUntil||0; if(bu>tick&&bu>(BLP[b.id]||0)+8) REC.blind.push([tick, b.id, Math.round((bu-tick)/TICK_HZ*10)/10, b._blindBy||'']); BLP[b.id]=bu; });
 if(tick%32===0 && roundState==='live') bots.forEach(function(b){ if(b.alive) REC.act.push([tick, b.id, b.post?String(b.post.tag):'', b.state||'', b._fc?b._fc.ph:'', tick<(b.blindUntil||0)?1:0, b.crouching?1:0, b.atPost?1:0]); });
 if(cur && typeof teamTac!=='undefined' && teamTac.T){ if(cur.lowPlan===undefined) cur.lowPlan=teamTac.T.lowPlan||null; if(cur.exec==null && teamTac.T.execStart!=null) cur.exec=teamTac.T.execStart; }
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
